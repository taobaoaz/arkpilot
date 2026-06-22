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
