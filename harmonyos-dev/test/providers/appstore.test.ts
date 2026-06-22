import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseSearch,
  parseCategories,
  parseList,
  parseDetail,
  searchApp,
  listCategories,
  listByCategory,
  getDetail,
  checkSource,
  _resetAppstoreStateForTest,
} from "../../src/providers/appstore.js";

vi.mock("../../src/lib/http.js", () => ({ httpJson: vi.fn(), httpText: vi.fn() }));
import { httpJson } from "../../src/lib/http.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "appgallery", name), "utf-8"));

beforeEach(() => {
  vi.mocked(httpJson).mockReset();
  _resetAppstoreStateForTest();
});

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
  it("reports http=true, browser_fallback boolean when playwright absent", async () => {
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
