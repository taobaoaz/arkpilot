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

// 校准后的真实 AppGallery 接口(spec §10 开放问题,2026-06-22 抓包确认)。
// webEdge 入口(env.js 的 webEdge.baseUrl_north.china),统一 GET /uowap/index + params.method。
const API_BASE = "https://web-drcn.hispace.dbankcloud.com/edge/uowap/index";
const WEB_BASE = "https://appgallery.huawei.com";
const SERVICE_TYPE = 20;
const MAX_RESULTS = 25;

/** 构造真实接口 URL:GET /uowap/index + query params。 */
function buildApiUrl(method: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    method,
    serviceType: String(SERVICE_TYPE),
    maxResults: String(MAX_RESULTS),
    zone: "",
    locale: "zh",
    ...extra,
  });
  return `${API_BASE}?${params.toString()}`;
}

/**
 * 浏览器降级:webEdge 接口需 InterfaceCode 签名,纯 HTTP 会被 403(rtnCode 1002)。
 * 用 Playwright 加载真实页面,拦截 getTabDetail 的 JSON 响应返回。
 * Playwright 未安装时返回 null(调用方降级为 partial)。
 */
async function fetchViaBrowser(
  pageUrl: string,
  opts: { searchKeyword?: string; timeoutMs?: number; collectAll?: boolean } = {},
): Promise<any | null> {
  let chromium: any;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return null; // playwright 未安装
  }
  const timeoutMs = opts.timeoutMs ?? 45000;
  let browser: any;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    let captured: any = null;
    const collected: any[] = []; // 仅 collectAll 时使用
    page.on("response", async (r: any) => {
      const u = r.url();
      try {
        const t = await r.text();
        if (!t.trim().startsWith("{")) return;
        // 搜索场景:只取 completeSearchWord(精确匹配 app)
        if (opts.searchKeyword) {
          if (u.includes("completeSearchWord")) {
            const j = JSON.parse(t);
            if (j?.app?.detailId) {
              captured = { kind: "exact-app", payload: j.app };
            }
          }
          return;
        }
        // 收集模式(详情场景):记录所有 getTabDetail 响应
        if (opts.collectAll && u.includes("getTabDetail")) {
          collected.push({ url: u, json: JSON.parse(t) });
          return;
        }
        // 常规模式:取首个 getTabDetail
        if (u.includes("getTabDetail") && !captured) {
          captured = { kind: "tab-detail", payload: JSON.parse(t) };
        }
      } catch {
        /* ignore */
      }
    });
    const targetUrl = opts.searchKeyword ? WEB_BASE : pageUrl;
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => {});
    if (opts.searchKeyword) {
      try {
        await page.waitForSelector("input", { timeout: 10000 }).catch(() => null);
        const input = await page.$("input").catch(() => null);
        if (input) {
          await input.click();
          await input.fill("");
          await input.type(opts.searchKeyword, { delay: 100 });
          await page.waitForTimeout(3500);
        }
      } catch {
        /* 输入触发失败时忽略。 */
      }
    }
    await page.waitForTimeout(1500);
    if (opts.collectAll) {
      return { kind: "tab-detail-all", payload: collected };
    }
    return captured;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** 测试 hook:允许单测替换浏览器降级,避免启动真实 Chromium。 */
export const _testHooks = {
  fetchViaBrowser,
};

/** 判断 httpJson 结果是否因签名/反爬失效(403 或 rtnCode 1002)。 */
function isBlockedBySignature(res: { ok: boolean; json?: any }): boolean {
  if (res.ok) {
    const code = res.json?.rtnCode;
    return code === 1002 || code === "1002";
  }
  return true; // 非 200 也视为需降级
}

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

/** 把 appId(C10001) 补全为 AppGallery 详情页绝对 URL。 */
function detailWebUrl(appId?: string): string {
  if (!appId) return "";
  return `${WEB_BASE}/app/${appId}`;
}

/** 从 detailId('app|C10001__search__x') 提取可读 appId。 */
function appIdFromDetailId(detailId?: string): string | undefined {
  if (!detailId) return undefined;
  // 'app|C10001__...' -> 'C10001'
  const m = detailId.match(/app\|([A-Za-z0-9]+)/);
  return m?.[1];
}

/** 任意结构里按一组候选 key 取字符串值。 */
function pick(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/** 单个应用条目 → AppInfo。字段名经真实接口校准(2026-06-22)。 */
function mapItem(info: any): AppInfo | null {
  const name = pick(info, ["name", "appName", "title"]);
  if (!name) return null;
  const appId = pick(info, ["appid", "appId"]) ?? appIdFromDetailId(pick(info, ["detailId"])) ?? pick(info, ["ID", "id"]);
  const url = detailWebUrl(appId);
  if (!url) return null;
  return {
    name,
    pkg: pick(info, ["package", "packageName", "pkg", "bundleName"]),
    appId,
    dev: pick(info, ["developerName", "developer", "dev", "companyName", "authorName"]),
    icon: pick(info, ["icon", "iconUrl", "logo"]),
    category: pick(info, ["kindName", "categoryName", "category", "tagName"]),
    url,
  };
}

/** 真实结构:layoutData[].dataList[].list[] 才是 app 数组。详情页/搜索相关: dataList[0] 自身可能是 app 对象(有 appid/name/package)。 */
function extractApps(raw: any): AppInfo[] {
  const layoutData = raw?.layoutData ?? raw?.data?.layoutData ?? [];
  if (!Array.isArray(layoutData)) return [];
  const out: AppInfo[] = [];
  for (const layout of layoutData) {
    const dataList = layout?.dataList ?? [];
    if (!Array.isArray(dataList)) continue;
    for (const dl of dataList) {
      // 情况 1:dl 本身就是 app 对象(详情页/相关推荐卡片)
      if (dl && typeof dl === "object" && (dl.appid || dl.ID || dl.package) && dl.name) {
        const mapped = mapItem(dl);
        if (mapped) out.push(mapped);
        continue;
      }
      // 情况 2:dl.list 或 dl.appList 是 app 数组(搜索结果列表)
      const apps = dl?.list ?? dl?.appList ?? (Array.isArray(dl) ? dl : []);
      if (!Array.isArray(apps)) continue;
      for (const a of apps) {
        const mapped = mapItem(a);
        if (mapped) out.push(mapped);
      }
    }
  }
  return out;
}

export function parseSearch(raw: any): AppInfo[] {
  return extractApps(raw);
}

export function parseCategories(raw: any): Category[] {
  const list = raw?.tabInfo ?? raw?.categoryList ?? raw?.data?.categoryList ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map((c: any) => {
      const id = pick(c, ["tabId", "tabCode", "id", "categoryId", "code"]);
      const name = pick(c, ["name", "categoryName"]);
      if (!id || !name) return null;
      return { id, name };
    })
    .filter((c): c is Category => c !== null);
}

export function parseList(raw: any): AppInfo[] {
  // 结构与 search 一致(layoutData[].dataList[].list[])
  return extractApps(raw);
}

export function parseDetail(raw: any): AppInfo | null {
  // 详情页结构与列表一致,取第一个 app。
  const apps = extractApps(raw);
  return apps[0] ?? null;
}

export async function searchApp(input: SearchInput): Promise<SearchResult> {
  const limit = input.limit ?? 10;
  const cacheKey = `search:${input.query}:${limit}:${input.exact ?? false}`;
  const fetchedAt = new Date().toISOString();

  return withCache(cacheKey, async () => {
    await rateLimit();
    // 搜索固定 uri=app|search;keyword 经 currentUrl 传递(真实 SPA 行为)。
    const currentUrl = `${WEB_BASE}/app/search?keyword=${encodeURIComponent(input.query)}`;
    const url = buildApiUrl("internal.getTabDetail", {
      reqPageNum: "1",
      uri: "app|search",
      appid: "search",
      currentUrl: encodeURIComponent(currentUrl),
    });
    const res = await retryWithBackoff(() => httpJson(url));
    let json: any = res.json;
    let source: "online" | "partial" = "online";
    let note: string | undefined;
    if (!res.ok || !res.json || isBlockedBySignature(res)) {
      // 纯 HTTP 被签名校验拦截,降级到浏览器(输入关键词触发联想 API)。
      const browserResult = await _testHooks.fetchViaBrowser(currentUrl, { searchKeyword: input.query });
      if (browserResult) {
        if (browserResult.kind === "exact-app" && browserResult.payload) {
          // 精确匹配:completeSearchWord 的 app 字段
          const app = mapItem(browserResult.payload);
          if (app) {
            const apps = [app];
            return { ok: true, apps, source: "online", note: "exact match via browser fallback", fetchedAt };
          }
        }
        json = browserResult.payload;
        source = "online";
        note = "via browser fallback (related)";
      } else {
        return {
          ok: true,
          apps: [],
          source: "partial",
          note: `fetch failed: ${res.error ?? res.status}; browser fallback unavailable (install playwright)`,
          fetchedAt,
        };
      }
    }
    let apps = parseSearch(json);
    if (input.exact) {
      const q = input.query.toLowerCase();
      apps = apps.filter((a) => a.name.toLowerCase() === q);
    }
    apps = apps.slice(0, limit);
    return { ok: true, apps, source, note, fetchedAt };
  });
}

/** 测试用:清空缓存与限速状态。 */
export function _resetAppstoreStateForTest(): void {
  cache.clear();
  lastReqAt = 0;
}

/**
 * 常见 AppGallery 分类(基于移动端 App 实际分类,2026-06 抓包确认)。
 * web 端无分类导航,这里返回预设集合供 listByCategory 使用,id 是分类名(详情接口的 uri 兼容形式)。
 * 如需更多分类,可在 mobile App 里观察后补充。
 */
const KNOWN_CATEGORIES: Category[] = [
  { id: "app|game", name: "游戏" },
  { id: "app|app", name: "应用" },
  { id: "app|tool", name: "工具" },
  { id: "app|social", name: "社交" },
  { id: "app|education", name: "教育" },
  { id: "app|music", name: "音乐" },
  { id: "app|video", name: "视频" },
  { id: "app|shopping", name: "购物" },
  { id: "app|photography", name: "摄影" },
  { id: "app|finance", name: "金融理财" },
  { id: "app|travel", name: "出行" },
  { id: "app|health", name: "运动健康" },
  { id: "app|reading", name: "阅读" },
  { id: "app|news", name: "新闻" },
  { id: "app|weather", name: "天气" },
];

export async function listCategories(): Promise<CategoriesResult> {
  const fetchedAt = new Date().toISOString();
  return withCache("categories", async () => {
    await rateLimit();
    // 尝试从 web 模板拉真实分类(通常返回 searchbox 类 tab,不实用)
    const url = buildApiUrl("internal.getTemplate");
    const res = await retryWithBackoff(() => httpJson(url));
    let webCats: Category[] = [];
    if (res.ok && res.json) {
      const all = parseCategories(res.json);
      // 只保留非 searchbox 类的(真实分类应 titleType=tab)
      webCats = all.filter((c) => !c.id.startsWith("tab_") || c.name !== "搜索");
    }
    // 合并:已知分类在前,web 真实分类去重后追加
    const seen = new Set(KNOWN_CATEGORIES.map((c) => c.id));
    const merged = [...KNOWN_CATEGORIES];
    for (const c of webCats) if (!seen.has(c.id)) { merged.push(c); seen.add(c.id); }
    return {
      ok: true,
      categories: merged,
      source: "online",
      note: KNOWN_CATEGORIES.length > 0
        ? "web 端无分类导航,基于移动端常见分类预设 + web 模板补充"
        : undefined,
      fetchedAt,
    };
  });
}

export async function listByCategory(input: ListByCategoryInput): Promise<ListResult> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const cacheKey = `list:${input.category}:${page}:${pageSize}`;
  const fetchedAt = new Date().toISOString();
  return withCache(cacheKey, async () => {
    await rateLimit();
    // uri=分类 tabId(来自 listCategories 的 tabInfo)。
    const url = buildApiUrl("internal.getTabDetail", {
      reqPageNum: String(page),
      uri: input.category,
    });
    const res = await retryWithBackoff(() => httpJson(url));
    let json: any = res.json;
    let source: "online" | "partial" = "online";
    let note: string | undefined;
    if (!res.ok || !res.json || isBlockedBySignature(res)) {
      // 降级:浏览器直接访问分类页(URL 用 query 模拟 tabId,实际 web 版通常以 query 或 hash 表达)
      const pageUrl = `${WEB_BASE}/app/${encodeURIComponent(input.category)}`;
      const browserResult = await _testHooks.fetchViaBrowser(pageUrl);
      if (browserResult?.kind === "tab-detail") {
        json = browserResult.payload;
        note = "via browser fallback";
      } else {
        return { ok: true, apps: [], page, pageSize, source: "partial", note: `fetch failed: ${res.error ?? res.status}; browser fallback unavailable`, fetchedAt };
      }
    }
    const apps = parseList(json);
    const totalPages = json?.totalPages;
    return { ok: true, apps, page, pageSize, totalPages, source, note, fetchedAt };
  });
}

export async function getDetail(input: DetailInput): Promise<DetailResult> {
  const fetchedAt = new Date().toISOString();
  const appId = input.appId ?? (input.url ? input.url.split("/").pop() : undefined);
  if (!appId) {
    return { ok: false, app: null, source: "partial", note: "need appId or url", fetchedAt };
  }
  const cacheKey = `detail:${appId}`;
  return withCache(cacheKey, async () => {
    await rateLimit();
    // uri=app|<appId>;详情页用 getTabDetail 拉。
    const url = buildApiUrl("internal.getTabDetail", {
      reqPageNum: "1",
      uri: `app|${appId}`,
    });
    const res = await retryWithBackoff(() => httpJson(url));
    let json: any = res.json;
    let source: "online" | "partial" = "online";
    let note: string | undefined;
    if (!res.ok || !res.json || isBlockedBySignature(res)) {
      const pageUrl = `${WEB_BASE}/app/${appId}`;
      const browserResult = await _testHooks.fetchViaBrowser(pageUrl, { collectAll: true });
      if (browserResult?.kind === "tab-detail-all" && Array.isArray(browserResult.payload)) {
        // 详情页会发出多个 getTabDetail(模板/相关推荐/实际详情),
        // 找到含目标 appId 的那一条,通常 layoutData[*].dataList[*].list[*].appid === appId
        const wanted = browserResult.payload.find((entry: any) => {
          const j = entry.json;
          if (!j) return false;
          const apps = extractApps(j);
          return apps.some((a) => a.appId === appId);
        });
        json = wanted?.json ?? browserResult.payload[0]?.json;
        note = "via browser fallback";
      } else {
        return { ok: true, app: null, source: "partial", note: `fetch failed: ${res.error ?? res.status}; browser fallback unavailable`, fetchedAt };
      }
    }
    // 即使匹配到了含 appId 的响应,parseDetail 取第一个 app 即可(此时第一个就是目标)
    return { ok: true, app: parseDetail(json), source, note, fetchedAt };
  });
}

export async function checkSource(): Promise<CheckResult> {
  const res = await httpJson(buildApiUrl("internal.getTemplate"), { timeout: 8000 });
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
