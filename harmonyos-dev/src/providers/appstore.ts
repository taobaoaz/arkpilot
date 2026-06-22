// src/providers/appstore.ts
import { httpJson } from "../lib/http.js";
import type {
  AppInfo,
  Category,
  SearchInput,
  SearchResult,
  CategoriesResult,
  ListByCategoryInput,
  ListResult,
  DetailInput,
  DetailResult,
  CheckResult,
} from "./appstore.types.js";

const BASE = "https://appgallery.huawei.com";

// 限速令牌桶(模块级):默认 1 req/s + 随机抖动
const MIN_INTERVAL_MS = 1000;
let lastReqAt = 0;
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastReqAt);
  if (wait > 0) await sleep(wait + Math.random() * 500);
  lastReqAt = Date.now();
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// 内存缓存(5min TTL),key = "fn:argString"
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { at: number; result: any }>();
async function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    const cached = { ...(hit.result as object), source: "cache" } as T;
    return cached;
  }
  const result = await fn();
  cache.set(key, { at: Date.now(), result });
  return result;
}

// 重试:仅 429/503,指数退避,max 3 次
async function retryWithBackoff<T>(
  fn: () => Promise<{ ok: boolean; status: number } & T>,
): Promise<{ ok: boolean; status: number } & T> {
  const backoffs = [200, 600, 1800];
  let last: { ok: boolean; status: number } & T;
  for (let i = 0; i <= backoffs.length; i++) {
    last = await fn();
    if (last.ok) return last;
    const retryable = last.status === 429 || last.status === 503;
    if (!retryable || i === backoffs.length) return last;
    await sleep(backoffs[i]);
  }
  return last!;
}

/** 把 productUrl('/app/C10001') 补全为绝对 URL。 */
function absUrl(productUrl?: string): string {
  if (!productUrl) return "";
  if (productUrl.startsWith("http")) return productUrl;
  return BASE + (productUrl.startsWith("/") ? productUrl : "/" + productUrl);
}

/** 任意结构里按一组候选 key 取字符串值。 */
function pick(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/** 单个 layoutList/appInfo 条目 → AppInfo。 */
function mapItem(item: any): AppInfo | null {
  const info = item?.appInfo ?? item;
  const name = pick(info, ["name", "appName", "title"]);
  const url = absUrl(pick(item, ["productUrl"]) ?? pick(info, ["productUrl", "url"]));
  if (!name || !url) return null;
  return {
    name,
    pkg: pick(info, ["packageName", "pkg", "bundleName"]),
    appId: pick(info, ["appId", "id"]),
    dev: pick(info, ["developer", "dev", "developerName"]),
    icon: pick(info, ["icon", "iconUrl", "logo"]),
    category: pick(info, ["categoryName", "category"]),
    url,
  };
}

export function parseSearch(raw: any): AppInfo[] {
  const list = raw?.layoutList ?? raw?.data?.layoutList ?? [];
  if (!Array.isArray(list)) return [];
  return list.map(mapItem).filter((a): a is AppInfo => a !== null);
}

export function parseCategories(raw: any): Category[] {
  const list = raw?.categoryList ?? raw?.data?.categoryList ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map((c: any) => {
      const id = pick(c, ["id", "categoryId", "code"]);
      const name = pick(c, ["name", "categoryName"]);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((c): c is Category => c !== null);
}

export function parseList(raw: any): AppInfo[] {
  // 结构与 search 一致(layoutList)
  return parseSearch(raw);
}

export function parseDetail(raw: any): AppInfo | null {
  const item = raw?.appInfo ? raw : { appInfo: raw };
  return mapItem(item);
}

export async function searchApp(input: SearchInput): Promise<SearchResult> {
  const limit = input.limit ?? 10;
  const cacheKey = `search:${input.query}:${limit}:${input.exact ?? false}`;
  const fetchedAt = new Date().toISOString();

  return withCache(cacheKey, async () => {
    await rateLimit();
    const url = `${BASE}/app/search?keyword=${encodeURIComponent(input.query)}&pageSize=${limit}`;
    const res = await retryWithBackoff(() => httpJson(url));
    if (!res.ok || !res.json) {
      return {
        ok: true,
        apps: [],
        source: "partial",
        note: `fetch failed: ${res.error ?? res.status}`,
        fetchedAt,
      };
    }
    let apps = parseSearch(res.json);
    if (input.exact) {
      const q = input.query.toLowerCase();
      apps = apps.filter((a) => a.name.toLowerCase() === q);
    }
    apps = apps.slice(0, limit);
    return { ok: true, apps, source: "online", fetchedAt };
  });
}

/** 测试用:清空缓存与限速状态。 */
export function _resetAppstoreStateForTest(): void {
  cache.clear();
  lastReqAt = 0;
}

export async function listCategories(): Promise<CategoriesResult> {
  const fetchedAt = new Date().toISOString();
  return withCache("categories", async () => {
    await rateLimit();
    const res = await retryWithBackoff(() => httpJson(`${BASE}/app/categoryList`));
    if (!res.ok || !res.json) {
      return { ok: true, categories: [], source: "partial", note: `fetch failed: ${res.error ?? res.status}`, fetchedAt };
    }
    return { ok: true, categories: parseCategories(res.json), source: "online", fetchedAt };
  });
}

export async function listByCategory(input: ListByCategoryInput): Promise<ListResult> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const cacheKey = `list:${input.category}:${page}:${pageSize}`;
  const fetchedAt = new Date().toISOString();
  return withCache(cacheKey, async () => {
    await rateLimit();
    const url = `${BASE}/app/listByCategory?categoryId=${encodeURIComponent(input.category)}&page=${page}&pageSize=${pageSize}`;
    const res = await retryWithBackoff(() => httpJson(url));
    if (!res.ok || !res.json) {
      return { ok: true, apps: [], page, pageSize, source: "partial", note: `fetch failed: ${res.error ?? res.status}`, fetchedAt };
    }
    const apps = parseList(res.json);
    const total = (res.json as any)?.total ?? 0;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : undefined;
    return { ok: true, apps, page, pageSize, totalPages, source: "online", fetchedAt };
  });
}

export async function getDetail(input: DetailInput): Promise<DetailResult> {
  const fetchedAt = new Date().toISOString();
  const target = input.url ?? (input.appId ? `${BASE}/app/${input.appId}` : "");
  if (!target) {
    return { ok: false, app: null, source: "partial", note: "need appId or url", fetchedAt };
  }
  const cacheKey = `detail:${target}`;
  return withCache(cacheKey, async () => {
    await rateLimit();
    const res = await retryWithBackoff(() => httpJson(`${target}/detail`));
    if (!res.ok || !res.json) {
      return { ok: true, app: null, source: "partial", note: `fetch failed: ${res.error ?? res.status}`, fetchedAt };
    }
    return { ok: true, app: parseDetail(res.json), source: "online", fetchedAt };
  });
}

export async function checkSource(): Promise<CheckResult> {
  const res = await httpJson(`${BASE}/app/categoryList`, { timeout: 8000 });
  let browser_fallback = false;
  try {
    await import("playwright");
    browser_fallback = true;
  } catch {
    browser_fallback = false;
  }
  const http = res.ok;
  const note = browser_fallback ? undefined : "install playwright for browser fallback";
  return { ok: true, http, browser_fallback, note };
}
