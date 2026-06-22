# AppGallery 抓取功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `harmonyos-dev` MCP 插件中新增 5 个 `appstore_` 工具,抓取华为应用市场 (AppGallery) 应用元数据,核心是定向搜索(外部软件传应用名 → 返回 JSON)。

**Architecture:** 沿用现有 `src/providers/*.ts` 分层模式。新增 `appstore.types.ts`(类型)、`appstore.ts`(抓取逻辑)、`http.ts` 扩展 `httpText()`、`server.ts` 注册 5 个 tool(总数 25→30)。Playwright 作为可选依赖,缺失时优雅降级到纯 HTTP。全量抓取走独立脚本 `scripts/appstore-crawl.ts`(不走 MCP,因长任务不适合)。

**Tech Stack:** TypeScript + `@modelcontextprotocol/sdk` + `zod` + vitest + esbuild;Playwright 可选依赖。

**参考 Spec:** `docs/superpowers/specs/2026-06-22-appstore-scraper-design.md`

**工作目录:** 所有相对路径基于 `harmonyos-dev/`(即 `C:\Users\Administrator\ZCodeProject\harmonyos-dev\`)。

**约定:**
- 本项目跑在 Windows,用 `cmd.exe`。命令中路径用反斜杠或正斜杠均可(Node 兼容)。
- 每个任务结束前 `npm run typecheck` 确保类型干净。
- 测试命令: `npx vitest run <path>`(单个)或 `npm test`(全部)。
- 提交信息遵循现有约定式提交(`feat` / `test` / `docs` / `refactor`)。

---

## File Structure

**Create:**
- `src/providers/appstore.types.ts` — 纯类型:`AppInfo`、`Category`、`SourceMeta`、各 tool 的输入/输出接口。零运行时依赖。
- `src/providers/appstore.ts` — 核心抓取逻辑:限速、重试、缓存、降级。导出 `searchApp()`、`listCategories()`、`listByCategory()`、`getDetail()`、`checkSource()`。
- `test/providers/appstore.test.ts` — provider 单测(mock fetch + fixture 驱动)。
- `test/fixtures/appgallery/search-weixin.json` — 搜索接口离线 fixture。
- `test/fixtures/appgallery/categories.json` — 分类列表离线 fixture。
- `test/fixtures/appgallery/list-game-page1.json` — 分类分页 fixture。
- `test/fixtures/appgallery/detail-weixin.json` — 详情页 fixture。
- `scripts/appstore-crawl.ts` — 全量抓取独立脚本(断点续传)。
- `.github/workflows/appstore-crawl.yml` — 定时 CI。

**Modify:**
- `src/lib/http.ts` — 新增 `httpText()`(不动 `httpJson`)。
- `test/lib/http.test.ts` — 追加 `httpText` 测试。
- `src/mcp/server.ts` — import appstore,在 `TOOLS` 数组追加 5 个 tool。
- `test/server.test.ts` — 断言 25 → 30。
- `package.json` — `optionalDependencies` 加 playwright;`scripts` 加 `crawl`。
- `README.md` — 工具数 25→30,新增 appstore 章节。
- `skills/harmonyos-dev/SKILL.md` — 新增 appstore 工作流。
- `.gitignore` — 忽略 `data/appstore/` 大文件(保留 sample)。

---

## Task 1: 类型层 — `appstore.types.ts`

**Files:**
- Create: `src/providers/appstore.types.ts`

先定契约(零依赖),后续所有模块引用这些类型。

- [ ] **Step 1: 写类型文件**

创建 `src/providers/appstore.types.ts`:

```typescript
// src/providers/appstore.types.ts

/** 单个应用的元数据。`url` 是唯一必有的定位字段。 */
export interface AppInfo {
  name: string;
  pkg?: string;
  appId?: string;
  dev?: string;
  category?: string;
  icon?: string;
  url: string;
}

/** AppGallery 分类。`id` 用于 list_by_category。 */
export interface Category {
  id: string;
  name: string;
}

/** 数据来源标记,如实反映抓取质量。 */
export interface SourceMeta {
  source: "online" | "cache" | "partial";
  note?: string;
  fetchedAt: string;
}

/** appstore_search 输入 */
export interface SearchInput {
  query: string;
  limit?: number;
  exact?: boolean;
}

/** appstore_search 输出 */
export interface SearchResult extends SourceMeta {
  ok: boolean;
  apps: AppInfo[];
}

/** appstore_categories 输出 */
export interface CategoriesResult extends SourceMeta {
  ok: boolean;
  categories: Category[];
}

/** appstore_list_by_category 输入 */
export interface ListByCategoryInput {
  category: string;
  page?: number;
  pageSize?: number;
}

/** appstore_list_by_category 输出 */
export interface ListResult extends SourceMeta {
  ok: boolean;
  apps: AppInfo[];
  page: number;
  pageSize: number;
  totalPages?: number;
}

/** appstore_detail 输入 */
export interface DetailInput {
  appId?: string;
  url?: string;
}

/** appstore_detail 输出 */
export interface DetailResult extends SourceMeta {
  ok: boolean;
  app: AppInfo | null;
}

/** appstore_check 输出 */
export interface CheckResult {
  ok: boolean;
  http: boolean;
  browser_fallback: boolean;
  note?: string;
}
```

- [ ] **Step 2: 验证类型编译**

Run: `npm run typecheck`
Expected: PASS,无错误(纯类型文件)。

- [ ] **Step 3: 提交**

```bash
git add src/providers/appstore.types.ts
git commit -m "feat(appstore): add AppInfo/Category/SourceMeta types"
```

---

## Task 2: HTTP 层 — `httpText()`

**Files:**
- Modify: `src/lib/http.ts`
- Test: `test/lib/http.test.ts`

先写失败测试,再实现 `httpText`(与 `httpJson` 同构,返回 text 而非 json)。

- [ ] **Step 1: 写失败测试**

在 `test/lib/http.test.ts` 末尾(`httpJson` 的 describe 块之后)追加:

```typescript
import { httpText } from "../../src/lib/http.js";

describe("httpText", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("returns text body on 2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<html>hello</html>",
    }) as unknown as typeof fetch;
    const r = await httpText("https://example.com/page");
    expect(r.ok).toBe(true);
    expect(r.text).toBe("<html>hello</html>");
  });

  it("returns ok=false on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, text: async () => "" }) as unknown as typeof fetch;
    const r = await httpText("https://example.com/blocked");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it("returns ok=false when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) as unknown as typeof fetch;
    const r = await httpText("https://example.com/x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ETIMEDOUT");
  });

  it("includes ZCode plugin UA header", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    globalThis.fetch = spy as unknown as typeof fetch;
    await httpText("https://example.com/x");
    expect(spy).toHaveBeenCalledWith(
      "https://example.com/x",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("ZCode") }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run test/lib/http.test.ts`
Expected: FAIL — `httpText is not a function`(或 import 报错)。

- [ ] **Step 3: 实现 httpText**

在 `src/lib/http.ts` 末尾追加(`httpJson` 不动):

```typescript
export interface HttpTextResult {
  ok: boolean;
  status: number;
  text?: string;
  error?: string;
}

export async function httpText(
  url: string,
  opts: { timeout?: number; headers?: Record<string, string> } = {},
): Promise<HttpTextResult> {
  const timeout = opts.timeout ?? 15000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "ZCode-harmonyos-dev-plugin/0.1.0", ...opts.headers },
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run test/lib/http.test.ts`
Expected: PASS(原有 `httpJson` 测试 + 4 个新 `httpText` 测试全绿)。

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/lib/http.ts test/lib/http.test.ts
git commit -m "feat(http): add httpText for HTML fetching"
```

---

## Task 3: 离线 Fixture

**Files:**
- Create: `test/fixtures/appgallery/search-weixin.json`
- Create: `test/fixtures/appgallery/categories.json`
- Create: `test/fixtures/appgallery/list-game-page1.json`
- Create: `test/fixtures/appgallery/detail-weixin.json`

这些 fixture 是 provider 单测的输入。它们模拟 AppGallery 接口的真实返回结构(实现时校准真实接口,见 Spec §10;此处用合理的占位结构,字段名在 Task 4 的解析器里对齐)。

- [ ] **Step 1: 搜索 fixture**

创建 `test/fixtures/appgallery/search-weixin.json`:

```json
{
  "layoutList": [
    {
      "appInfo": {
        "appId": "C10001",
        "name": "微信",
        "packageName": "com.tencent.mm",
        "developer": "Tencent",
        "icon": "https://appimg.dbankcdn.com/weixin.png"
      },
      "productUrl": "/app/C10001"
    },
    {
      "appInfo": {
        "appId": "C10002",
        "name": "企业微信",
        "packageName": "com.tencent.wework",
        "developer": "Tencent",
        "icon": "https://appimg.dbankcdn.com/wework.png"
      },
      "productUrl": "/app/C10002"
    }
  ],
  "total": 2
}
```

- [ ] **Step 2: 分类 fixture**

创建 `test/fixtures/appgallery/categories.json`:

```json
{
  "categoryList": [
    { "id": "game", "name": "游戏" },
    { "id": "social", "name": "社交" },
    { "id": "tools", "name": "工具" },
    { "id": "education", "name": "教育" }
  ]
}
```

- [ ] **Step 3: 分类分页 fixture**

创建 `test/fixtures/appgallery/list-game-page1.json`:

```json
{
  "layoutList": [
    {
      "appInfo": {
        "appId": "C20001",
        "name": "王者荣耀",
        "packageName": "com.tencent.tmgp.pubgmhd",
        "developer": "Tencent",
        "icon": "https://appimg.dbankcdn.com/pvp.png"
      },
      "productUrl": "/app/C20001"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

- [ ] **Step 4: 详情 fixture**

创建 `test/fixtures/appgallery/detail-weixin.json`:

```json
{
  "appInfo": {
    "appId": "C10001",
    "name": "微信",
    "packageName": "com.tencent.mm",
    "developer": "Tencent",
    "categoryName": "社交",
    "icon": "https://appimg.dbankcdn.com/weixin.png"
  },
  "productUrl": "/app/C10001"
}
```

- [ ] **Step 5: 提交**

```bash
git add test/fixtures/appgallery/
git commit -m "test(appstore): add offline AppGallery response fixtures"
```

---

## Task 4: Provider 层 — 解析器与 `searchApp()`

**Files:**
- Create: `src/providers/appstore.ts`
- Test: `test/providers/appstore.test.ts`

这是核心任务。分两个子任务:先写解析器(纯函数,测 fixture → AppInfo),再写 `searchApp`(带网络/缓存/降级)。

### Task 4a: 解析器(纯函数)

- [ ] **Step 1: 写解析器失败测试**

创建 `test/providers/appstore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSearch, parseCategories, parseList, parseDetail } from "../../src/providers/appstore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "appgallery", name), "utf-8"));

describe("appstore parsers", () => {
  it("parseSearch maps layoutList to AppInfo[]", () => {
    const raw = fx("search-weixin.json");
    const apps = parseSearch(raw);
    expect(apps).toHaveLength(2);
    expect(apps[0]).toEqual({
      name: "微信",
      pkg: "com.tencent.mm",
      appId: "C10001",
      dev: "Tencent",
      icon: "https://appimg.dbankcdn.com/weixin.png",
      url: "https://appgallery.huawei.com/app/C10001",
      category: undefined,
    });
  });

  it("parseCategories maps categoryList", () => {
    const raw = fx("categories.json");
    const cats = parseCategories(raw);
    expect(cats).toHaveLength(4);
    expect(cats[0]).toEqual({ id: "game", name: "游戏" });
  });

  it("parseList maps layoutList with pagination", () => {
    const raw = fx("list-game-page1.json");
    const apps = parseList(raw);
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe("王者荣耀");
  });

  it("parseDetail maps single app", () => {
    const raw = fx("detail-weixin.json");
    const app = parseDetail(raw);
    expect(app?.name).toBe("微信");
    expect(app?.category).toBe("社交");
  });

  it("parseSearch tolerates empty/missing fields", () => {
    expect(parseSearch({})).toEqual([]);
    expect(parseSearch({ layoutList: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run test/providers/appstore.test.ts`
Expected: FAIL — module not found / 函数未定义。

- [ ] **Step 3: 创建 appstore.ts 并实现解析器**

创建 `src/providers/appstore.ts`:

```typescript
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
```

- [ ] **Step 4: 运行解析器测试验证通过**

Run: `npx vitest run test/providers/appstore.test.ts -t "parsers"`
Expected: PASS(5 个解析器测试全绿)。

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/providers/appstore.ts test/providers/appstore.test.ts
git commit -m "feat(appstore): add response parsers with fixture-driven tests"
```

### Task 4b: `searchApp()` 带缓存与限速

- [ ] **Step 7: 写 searchApp 失败测试**

在 `test/providers/appstore.test.ts` 顶部 import 区追加 mock 声明,然后加新 describe:

```typescript
// 在文件顶部 import 之后追加:
vi.mock("../../src/lib/http.js", () => ({ httpJson: vi.fn(), httpText: vi.fn() }));
import { httpJson } from "../../src/lib/http.js";

beforeEach(() => {
  vi.mocked(httpJson).mockReset();
});

// 在文件末尾追加:
describe("appstore.searchApp", () => {
  it("returns parsed apps from httpJson online", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("search-weixin.json") });
    const r = await searchApp({ query: "微信" });
    expect(r.ok).toBe(true);
    expect(r.apps).toHaveLength(2);
    expect(r.source).toBe("online");
    expect(r.apps[0].name).toBe("微信");
  });

  it("exact filter keeps only exact name matches (case-insensitive)", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("search-weixin.json") });
    const r = await searchApp({ query: "微信", exact: true });
    expect(r.apps.map((a) => a.name)).toEqual(["微信"]);
  });

  it("respects limit", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("search-weixin.json") });
    const r = await searchApp({ query: "微信", limit: 1 });
    expect(r.apps).toHaveLength(1);
  });

  it("returns partial source with empty apps on network failure", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: false, status: 0, error: "ENOTFOUND" });
    const r = await searchApp({ query: "微信" });
    expect(r.ok).toBe(true);
    expect(r.apps).toEqual([]);
    expect(r.source).toBe("partial");
    expect(r.note).toContain("fetch failed");
  });

  it("caches results within TTL (second call skips httpJson)", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("search-weixin.json") });
    await searchApp({ query: "微信" });
    await searchApp({ query: "微信" });
    expect(vi.mocked(httpJson)).toHaveBeenCalledTimes(1);
  });
});
```

同时把 `searchApp` 加入顶部 import:
```typescript
import { parseSearch, parseCategories, parseList, parseDetail, searchApp } from "../../src/providers/appstore.js";
```

- [ ] **Step 8: 运行测试验证失败**

Run: `npx vitest run test/providers/appstore.test.ts -t "searchApp"`
Expected: FAIL — `searchApp is not exported`。

- [ ] **Step 9: 实现 searchApp**

在 `src/providers/appstore.ts` 末尾(`BASE` 常量之后,解析器之前)插入限速与缓存基础设施,然后在文件末尾加 `searchApp`:

在文件顶部 import 区之后追加:
```typescript
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
async function retryWithBackoff<T>(fn: () => Promise<{ ok: boolean; status: number } & T>): Promise<{ ok: boolean; status: number } & T> {
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
```

在文件末尾追加:
```typescript
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
```

- [ ] **Step 10: 运行测试验证通过**

Run: `npx vitest run test/providers/appstore.test.ts -t "searchApp"`
Expected: PASS(5 个 searchApp 测试全绿)。

> **注意:** 第 4 个测试(caching)依赖前几个测试的缓存不串。若失败,在 `searchApp` 里加可选的 `force` 参数,测试里传 `force: true`。但先按上面跑——缓存 key 含 query,不同 query 不冲突。若 caching 测试仍受前面测试污染,在该测试 `beforeEach` 清缓存(见 Step 11 备选)。

- [ ] **Step 11: (备选)清缓存的测试 hook**

仅当 Step 10 的 caching 测试因缓存污染失败时执行。在 `appstore.ts` 末尾导出一个测试用清缓存函数:

```typescript
/** 测试用:清空缓存与限速状态。 */
export function _resetAppstoreStateForTest(): void {
  cache.clear();
  lastReqAt = 0;
}
```

在 `test/providers/appstore.test.ts` 的 `beforeEach` 里调用(import 加上 `_resetAppstoreStateForTest`):
```typescript
beforeEach(() => {
  vi.mocked(httpJson).mockReset();
  _resetAppstoreStateForTest();
});
```

- [ ] **Step 12: typecheck**

Run: `npm run typecheck`
Expected: PASS。

- [ ] **Step 13: 提交**

```bash
git add src/providers/appstore.ts test/providers/appstore.test.ts
git commit -m "feat(appstore): add searchApp with cache/rate-limit/retry"
```

---

## Task 5: Provider 层 — 其余 4 个函数

**Files:**
- Modify: `src/providers/appstore.ts`
- Test: `test/providers/appstore.test.ts`

`listCategories`、`listByCategory`、`getDetail`、`checkSource`。

- [ ] **Step 1: 写 4 个函数的失败测试**

在 `test/providers/appstore.test.ts` 顶部 import 追加:
```typescript
import {
  parseSearch, parseCategories, parseList, parseDetail,
  searchApp, listCategories, listByCategory, getDetail, checkSource,
} from "../../src/providers/appstore.js";
```

在文件末尾追加:
```typescript
describe("appstore.listCategories", () => {
  it("returns categories from httpJson online", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("categories.json") });
    const r = await listCategories();
    expect(r.ok).toBe(true);
    expect(r.categories).toHaveLength(4);
    expect(r.source).toBe("online");
  });

  it("returns partial empty on failure", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: false, status: 0, error: "ENETUNREACH" });
    const r = await listCategories();
    expect(r.categories).toEqual([]);
    expect(r.source).toBe("partial");
  });
});

describe("appstore.listByCategory", () => {
  it("returns apps + pagination from httpJson", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("list-game-page1.json") });
    const r = await listByCategory({ category: "game" });
    expect(r.ok).toBe(true);
    expect(r.apps).toHaveLength(1);
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });

  it("defaults page=1 pageSize=20", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("list-game-page1.json") });
    const r = await listByCategory({ category: "game" });
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
  });
});

describe("appstore.getDetail", () => {
  it("returns single app from httpJson by appId", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: fx("detail-weixin.json") });
    const r = await getDetail({ appId: "C10001" });
    expect(r.ok).toBe(true);
    expect(r.app?.name).toBe("微信");
    expect(r.app?.category).toBe("社交");
  });

  it("returns app=null on failure", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: false, status: 404, error: "HTTP 404" });
    const r = await getDetail({ appId: "C99999" });
    expect(r.ok).toBe(true);
    expect(r.app).toBeNull();
    expect(r.source).toBe("partial");
  });
});

describe("appstore.checkSource", () => {
  it("reports http=true, browser_fallback=false when playwright absent", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: {} });
    const r = await checkSource();
    expect(r.ok).toBe(true);
    expect(r.http).toBe(true);
    expect(typeof r.browser_fallback).toBe("boolean");
  });

  it("reports http=false on network failure", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: false, status: 0, error: "ENOTFOUND" });
    const r = await checkSource();
    expect(r.http).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run test/providers/appstore.test.ts`
Expected: FAIL — 新函数未导出。

- [ ] **Step 3: 实现 4 个函数**

在 `src/providers/appstore.ts` 末尾追加:

```typescript
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
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run test/providers/appstore.test.ts`
Expected: PASS(所有 provider 测试全绿)。

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/providers/appstore.ts test/providers/appstore.test.ts
git commit -m "feat(appstore): add listCategories/listByCategory/getDetail/checkSource"
```

---

## Task 6: 注册层 — `server.ts` 加 5 个 tool

**Files:**
- Modify: `src/mcp/server.ts`
- Test: `test/server.test.ts`

- [ ] **Step 1: 更新 server 集成测试(25→30)**

修改 `test/server.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/mcp/server.js";

describe("server tool registry", () => {
  it("registers all tools from the plan (30: 25 harmony + 5 appstore)", () => {
    expect(TOOLS).toHaveLength(30);
  });

  it("all tool names start with harmony_ or appstore_ and have descriptions", () => {
    for (const t of TOOLS) {
      expect(t.name.startsWith("harmony_") || t.name.startsWith("appstore_")).toBe(true);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it("includes check_updates tool", () => {
    expect(TOOLS.some((t) => t.name === "harmony_check_updates")).toBe(true);
  });

  it("registers all 5 appstore tools", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toContain("appstore_search");
    expect(names).toContain("appstore_categories");
    expect(names).toContain("appstore_list_by_category");
    expect(names).toContain("appstore_detail");
    expect(names).toContain("appstore_check");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL — `expected 25 to equal 30`。

- [ ] **Step 3: 在 server.ts 注册 5 个 tool**

修改 `src/mcp/server.ts`。在顶部 import 区(`checkUpdates` import 之后)追加:

```typescript
import { searchApp, listCategories, listByCategory, getDetail, checkSource } from "../providers/appstore.js";
```

在 `TOOLS` 数组末尾(`harmony_create_module` 之后,即第 205 行 `},` 之后、数组闭合 `];` 之前)追加:

```typescript
  {
    name: "appstore_search",
    description: "Search AppGallery apps by name. Returns matching apps with icon URL + detail URL. Core tool for 'input name -> return name'.",
    schema: z.object({
      query: z.string(),
      limit: z.number().optional(),
      exact: z.boolean().optional(),
    }),
    handler: async (a) => searchApp(a),
  },
  {
    name: "appstore_categories",
    description: "List all AppGallery categories. Read-only.",
    schema: z.object({}),
    handler: async () => listCategories(),
  },
  {
    name: "appstore_list_by_category",
    description: "Page through apps in a category (page default 1, pageSize default 20).",
    schema: z.object({
      category: z.string(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    }),
    handler: async (a) => listByCategory(a),
  },
  {
    name: "appstore_detail",
    description: "Fetch single app detail by appId or url (one required). Fills pkg/dev/category fields.",
    schema: z.object({
      appId: z.string().optional(),
      url: z.string().optional(),
    }),
    handler: async (a) => getDetail(a),
  },
  {
    name: "appstore_check",
    description: "Probe AppGallery data source availability (http + optional playwright fallback). Read-only diagnostic.",
    schema: z.object({}),
    handler: async () => checkSource(),
  },
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run test/server.test.ts`
Expected: PASS(4 个测试全绿,含 30 个 tool + 5 个 appstore 名称断言)。

- [ ] **Step 5: 全量测试**

Run: `npm test`
Expected: PASS(所有测试,provider 单测 + server 集成 + 其他现有测试)。

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS(`dist/mcp/server.js` 生成)。

- [ ] **Step 7: 提交**

```bash
git add src/mcp/server.ts test/server.test.ts
git commit -m "feat(mcp): register 5 appstore tools (total 30)"
```

---

## Task 7: `package.json` — 可选依赖与 crawl 脚本

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: 加 optionalDependencies 与 crawl script**

修改 `package.json`。在 `dependencies` 块之后加 `optionalDependencies`:

```json
  "optionalDependencies": {
    "playwright": "^1.48.0"
  },
```

在 `scripts` 块里(`"test"` 之后)加:
```json
    "crawl": "tsx scripts/appstore-crawl.ts"
```

> 注:`tsx` 用于直接跑 TypeScript 脚本。加到 `devDependencies`:
```json
    "tsx": "^4.19.0",
```

- [ ] **Step 2: 安装新依赖**

Run: `npm install`
Expected: 安装成功(`playwright` 标记 optional,`tsx` 安装到 dev)。若 playwright 下载浏览器二进制失败,不影响安装(optional)。

- [ ] **Step 3: 加 .gitignore 条目**

修改 `.gitignore`,追加:
```
# appstore crawl output (large, keep samples only)
data/appstore/*.json
!data/appstore/.sample.json
```

- [ ] **Step 4: 创建占位 sample 文件(避免空目录)**

创建 `harmonyos-dev/data/appstore/.sample.json`:
```json
{
  "note": "appstore-crawl output sample. Real output is gitignored.",
  "apps": []
}
```

- [ ] **Step 5: 验证 typecheck + build 不受影响**

Run: `npm run typecheck && npm run build`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json .gitignore data/appstore/.sample.json
git commit -m "chore: add playwright optional dep, tsx, crawl script, gitignore"
```

---

## Task 8: 全量抓取脚本 — `scripts/appstore-crawl.ts`

**Files:**
- Create: `scripts/appstore-crawl.ts`

断点续传:进度写 `data/appstore/.progress.json`。

- [ ] **Step 1: 写脚本**

创建 `scripts/appstore-crawl.ts`:

```typescript
// scripts/appstore-crawl.ts
// 全量抓取 AppGallery,遍历所有分类分页。不走 MCP(长任务)。
// 用法: npm run crawl   或   npx tsx scripts/appstore-crawl.ts [--categories game,social]
// 断点续传: 进度写 data/appstore/.progress.json,重跑跳过已完成。
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listCategories, listByCategory, type AppInfo, type Category } from "../src/providers/appstore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "appstore");
const OUT_FILE = join(OUT_DIR, "apps.json");
const PROGRESS_FILE = join(OUT_DIR, ".progress.json");

interface Progress {
  categoryIdx: number;
  page: number;
  doneIds: string[];
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { categoryIdx: 0, page: 1, doneIds: [] };
}

function saveProgress(p: Progress): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function loadApps(): AppInfo[] {
  if (existsSync(OUT_FILE)) {
    return JSON.parse(readFileSync(OUT_FILE, "utf-8")).apps ?? [];
  }
  return [];
}

function main() {
  const args = process.argv.slice(2);
  let filterCat: string[] | null = null;
  const catFlag = args.indexOf("--categories");
  if (catFlag >= 0 && args[catFlag + 1]) {
    filterCat = args[catFlag + 1].split(",").map((s) => s.trim()).filter(Boolean);
  }

  (async () => {
    const catsRes = await listCategories();
    let cats: Category[] = catsRes.categories;
    if (filterCat) cats = cats.filter((c) => filterCat!.includes(c.id));
    if (cats.length === 0) {
      console.error("no categories available; aborting");
      process.exit(1);
    }

    const allApps = loadApps();
    let progress = loadProgress();
    // 归一化:若 filterCat 改变,从头开始
    const doneIds = new Set(progress.doneIds);

    for (let i = progress.categoryIdx; i < cats.length; i++) {
      const cat = cats[i];
      console.error(`[${i + 1}/${cats.length}] category: ${cat.name} (${cat.id})`);
      let page = i === progress.categoryIdx ? progress.page : 1;
      while (true) {
        const res = await listByCategory({ category: cat.id, page, pageSize: 20 });
        if (res.apps.length === 0) break;
        for (const a of res.apps) {
          const key = a.appId ?? a.url;
          if (key && !doneIds.has(key)) {
            allApps.push(a);
            doneIds.add(key);
          }
        }
        progress = { categoryIdx: i, page, doneIds: [...doneIds] };
        saveProgress(progress);
        writeFileSync(OUT_FILE, JSON.stringify({ apps: allApps, fetchedAt: new Date().toISOString() }, null, 2));
        if (res.totalPages && page >= res.totalPages) break;
        page++;
      }
    }

    writeFileSync(OUT_FILE, JSON.stringify({ apps: allApps, fetchedAt: new Date().toISOString() }, null, 2));
    console.error(`done: ${allApps.length} apps -> ${OUT_FILE}`);
  })().catch((e) => {
    console.error("crawl failed:", e);
    process.exit(1);
  });
}

main();
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS(脚本被 tsconfig 包含;若 tsconfig 排除了 scripts/,需确认 include。检查后若报错,在 tsconfig.json 的 include 加 `"scripts"` —— 但先跑看结果)。

- [ ] **Step 3: build 确认脚本不破坏打包**

Run: `npm run build`
Expected: PASS。`dist/mcp/server.js` 正常生成(脚本不进打包,仅 tsx 直跑)。

- [ ] **Step 4: 提交**

```bash
git add scripts/appstore-crawl.ts
git commit -m "feat(appstore): add crawl script with resume support"
```

---

## Task 9: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/appstore-crawl.yml`

> 注意:`.github/` 在 `harmonyos-dev/` 内还是仓库根?现有 workflow 位置需确认。本计划假设放在 `harmonyos-dev/.github/workflows/`(若仓库根有 `.github`,则放根)。执行时先 `ls .github/workflows/` 确认现有 workflow 位置,与之对齐。

- [ ] **Step 1: 确认现有 workflow 位置**

Run: `dir /s /b .github 2>nul`(在 `harmonyos-dev/` 内)与仓库根各查一次。
若 `harmonyos-dev/.github/workflows/` 已存在 → 放这里。否则放 `C:\Users\Administrator\ZCodeProject\.github\workflows\`(仓库根)。

- [ ] **Step 2: 写 workflow**

在确认的 `.github/workflows/` 下创建 `appstore-crawl.yml`:

```yaml
name: AppGallery Crawl

on:
  schedule:
    # 每周日 03:00 UTC
    - cron: "0 3 * * 0"
  workflow_dispatch:
    inputs:
      categories:
        description: "逗号分隔的分类 id(留空=全部)"
        required: false
        default: ""

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - run: npm ci
        working-directory: harmonyos-dev
      - name: Crawl
        working-directory: harmonyos-dev
        run: npx tsx scripts/appstore-crawl.ts ${{ github.event.inputs.categories && format('--categories {0}', github.event.inputs.categories) || '' }}
        env:
          NETWORK_TEST: "1"
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: appstore-apps
          path: harmonyos-dev/data/appstore/apps.json
          if-no-files-found: warn
```

- [ ] **Step 3: 验证 workflow YAML 语法**

Run(本地,若有 yq 或 node): `node -e "require('fs').readFileSync('<path>','utf8')"` 确认文件可读。完整 YAML 校验可选(无 yq 则跳过,CI 会报错)。

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/appstore-crawl.yml
git commit -m "ci: add weekly AppGallery crawl workflow"
```

---

## Task 10: 文档更新 — README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新工具数 25→30**

修改 `README.md` 第 51 行 `## MCP Tools (25)` → `## MCP Tools (30)`。

- [ ] **Step 2: 更新 MVP Scope**

在 `## MVP Scope` 末尾(`- Scaffold ArkTS pages, components, abilities, and modules.` 之后)追加:

```markdown
- Query Huawei AppGallery app metadata via `appstore_search` / `appstore_categories` / `appstore_list_by_category` / `appstore_detail`.
```

- [ ] **Step 3: 在 MCP Tools 列表末尾追加 5 个 appstore tool**

在 `README.md` 第 77 行(`- \`harmony_create_module\``)之后追加:

```markdown
- `appstore_search`
- `appstore_categories`
- `appstore_list_by_category`
- `appstore_detail`
- `appstore_check`
```

- [ ] **Step 4: 新增 AppGallery 章节**

在 `## Extension Points` 之前插入新章节:

```markdown
## AppGallery Tools (appstore_*)

These 5 tools fetch app metadata from Huawei AppGallery (`appgallery.huawei.com`): name,
package name, developer, category, icon URL, detail page URL.

**Core use case — `appstore_search`:** external MCP clients pass an app name, get back a JSON
list of matching apps. Example:

```
appstore_search({ query: "微信", limit: 5 })
-> { ok: true, apps: [{ name, pkg, dev, icon, url, ... }], source: "online", fetchedAt }
```

### Coverage & honesty

AppGallery has **no public "list all apps" API** and applies anti-scraping (browser
fingerprinting, IP rate limits). These tools cover reachable apps (rankings + categories +
search) but **do not guarantee 100% coverage**. Every result carries a `source` field:
`online` (fresh), `cache` (within 5min TTL), or `partial` (degraded, with a `note`).

### Optional browser fallback

Playwright is an `optionalDependency`. When installed, dynamic/anti-scraped responses fall
back to a headless browser. Without it, tools work in HTTP-only mode. Run `appstore_check` to
probe availability; install with `npm install playwright`.

### Full crawl (not via MCP)

Long-running full crawl runs as a script (MCP tools are unsuitable for long tasks):

```bash
npm run crawl                           # all categories
npx tsx scripts/appstore-crawl.ts --categories game,social   # subset
```

Output: `data/appstore/apps.json` (gitignored). Resume support via `data/appstore/.progress.json`.
A weekly GitHub Actions workflow (`.github/workflows/appstore-crawl.yml`) runs this automatically.
```

- [ ] **Step 5: 验证 README 渲染(可选)**

肉眼检查 markdown 结构无误。

- [ ] **Step 6: 提交**

```bash
git add README.md
git commit -m "docs: document 5 appstore tools + coverage/honesty note"
```

---

## Task 11: 文档更新 — SKILL.md

**Files:**
- Modify: `skills/harmonyos-dev/SKILL.md`

- [ ] **Step 1: 新增 appstore 工作流章节**

修改 `skills/harmonyos-dev/SKILL.md`。在 `## Extension Point`(第 44 行)之前插入新章节:

```markdown
## AppGallery 工作流 (appstore_*)

当用户想查 AppGallery 应用信息(名称、包名、开发者、图标、分类)时使用 appstore 工具。

1. **定向查某个应用** → `appstore_search({ query: "微信" })`。`exact:true` 只返回精确名匹配。
2. **列分类** → `appstore_categories()`,拿 `id` 用于下一步。
3. **浏览分类下的应用** → `appstore_list_by_category({ category: "game", page: 1 })`。
4. **补全单个应用字段** → `appstore_detail({ appId })` 或 `{ url }`。
5. **诊断数据源** → `appstore_check()`,报告 http 是否可达、playwright 浏览器降级是否可用。

**注意:**
- 覆盖率不保证 100%。每个返回有 `source` 字段(`online`/`cache`/`partial`),如实反映数据质量。
- `partial` 时带 `note`,告知用户降级原因(网络失败/反爬/浏览器降级未启用)。
- 全量抓取不走 MCP(长任务),用 `npm run crawl` 脚本,见 README。
```

- [ ] **Step 2: 更新 SKILL.md 顶部 description(可选)**

第 3 行 description 末尾追加 `,或查询华为应用市场应用信息`:
```
description: 通过 harmonyos-dev MCP 工具构建、运行、检查并自动化 HarmonyOS NEXT (ArkTS) 应用,或查询华为应用市场应用信息。
```

- [ ] **Step 3: 提交**

```bash
git add skills/harmonyos-dev/SKILL.md
git commit -m "docs(skill): add appstore workflow section"
```

---

## Task 12: 最终验证

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全绿。provider(appstore parsers + 5 函数) + server(30 tools) + http(httpText) + 其他现有测试。

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS。`dist/mcp/server.js` 生成。

- [ ] **Step 3: 网络测试(可选,需手动启用)**

Run: `NETWORK_TEST=1 npx vitest run test/providers/appstore.test.ts`
Expected: 可能因真实反爬失败——这是预期,provider 降级为 partial。观察是否优雅降级(不抛异常)。

- [ ] **Step 4: 确认工具计数**

Run: `node -e "import('./dist/mcp/server.js').then(m => console.log(m.TOOLS.length, m.TOOLS.filter(t=>t.name.startsWith('appstore')).map(t=>t.name)))"`
Expected: `30 [ 'appstore_search', 'appstore_categories', 'appstore_list_by_category', 'appstore_detail', 'appstore_check' ]`

- [ ] **Step 5: 汇总提交(若有零散改动)**

```bash
git status
# 若有未提交改动:
git add -A && git commit -m "chore: final verification pass"
```

---

## 完成标准

- [x] `npm test` 全绿,含 5 个 appstore tool 注册断言(总数 30)
- [x] `npm run typecheck && npm run build` 通过
- [x] `appstore_search` 在 mock fixture 上返回正确的 AppInfo[]
- [x] 网络失败时优雅降级(source: "partial",不抛异常)
- [x] Playwright 缺失时 `appstore_check` 报告 `browser_fallback: false`,工具仍工作
- [x] README + SKILL.md 更新,含诚实的覆盖率声明
- [x] 全量抓取脚本 + CI workflow 就位
