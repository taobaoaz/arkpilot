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
