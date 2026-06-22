# AppGallery 抓取功能设计规格 (Spec)

- **日期:** 2026-06-22
- **所属插件:** `harmonyos-dev` (集成,非独立项目)
- **版本:** 0.2.0
- **状态:** 待用户评审

## 1. 概述

### 1.1 目标

在现有 `harmonyos-dev` MCP 插件中新增一组 **appstore tools**,抓取华为应用市场 (AppGallery, `appgallery.huawei.com`) 应用的元数据(名称、包名、开发者、分类、图标 URL、详情页 URL)。结果作为 MCP tool 返回值,供任意 MCP 客户端消费。

**核心接入场景(定向搜索):** 外部软件通过 MCP 协议调用 `appstore_search` 传入应用名 → 返回匹配应用的 JSON 列表。这是"某软件介入本仓库,用户输入应用名称,返回名称"的实现方式。

### 1.2 不做 (YAGNI)

- ❌ 不抓取图标二进制文件(只存 URL)
- ❌ 不下载 APK
- ❌ 不做登录态抓取(避免账号风险)
- ❌ 不做独立 CLI(MCP tool 即入口)
- ❌ 不做前端展示页

### 1.3 技术栈

- 与现有仓库一致:**TypeScript + esbuild 单文件打包**
- 依赖 `@modelcontextprotocol/sdk` + `zod`(现有)
- **Playwright 为可选依赖**(见 §3.3),按需加载,不破坏轻量插件

### 1.4 现实约束(诚实声明)

华为 AppGallery 没有公开"列出所有应用"的接口,反爬较严(真机指纹检测、IP 频率限制)。因此:

- **覆盖率不保证 100%**。目标是覆盖榜单 + 主要分类 + 搜索可达的应用。
- 文档(README + SKILL.md)必须明确写明此限制。
- 所有 tool 返回值携带 `source` 字段(`online` | `cache` | `partial`)和 `note` 字段,如实反映数据质量。

## 2. 新增 MCP Tools (5 个)

沿用现有 `harmony_` 前缀命名规范,新增 `appstore_` 系列。注册到 `src/mcp/server.ts` 的 `TOOLS` 数组。模型侧可见为 `mcp__harmonyos_dev__appstore_<name>`。工具总数 **25 → 30**。

| Tool 名 | 作用 | 关键参数 | 返回摘要 |
|---|---|---|---|
| `appstore_search` | **定向搜索**(核心):按名称返回匹配应用 | `query: string`, `limit?: number`(默认 10), `exact?: boolean` | `{ ok, apps: AppInfo[], source, fetchedAt }` |
| `appstore_categories` | 列出 AppGallery 所有分类 | 无 | `{ ok, categories: Category[], source, fetchedAt }` |
| `appstore_list_by_category` | 按分类分页列出应用 | `category: string`, `page?: number`(默认 1), `pageSize?: number`(默认 20) | `{ ok, apps: AppInfo[], page, totalPages?, source, fetchedAt }` |
| `appstore_detail` | 抓单个应用详情(补全字段) | `appId?: string`, `url?: string`(二选一) | `{ ok, app: AppInfo, source, fetchedAt }` |
| `appstore_check` | 探测数据源可用性(诊断,read-only) | 无 | `{ ok, http: bool, browser_fallback: bool, note }` |

### 2.1 定向搜索契约(核心场景)

```
调用: appstore_search({ query: "微信", limit: 5 })
返回:
{
  "ok": true,
  "apps": [
    { "name": "微信", "pkg": "com.tencent.mm", "dev": "...",
      "icon": "https://...", "url": "https://...", "category": "社交" }
  ],
  "source": "online",
  "fetchedAt": "2026-06-22T03:00:00.000Z"
}
```

`exact: true` 时只返回名称精确等于 `query` 的结果(大小写不敏感)。

## 3. 架构与模块

### 3.1 目录结构(遵循现有 `src/providers/` 模式)

```
harmonyos-dev/
├── src/
│   ├── providers/
│   │   ├── appstore.ts          # 新增:核心抓取逻辑
│   │   ├── appstore.types.ts    # 新增:AppInfo / Category 类型
│   │   └── (现有 providers 不动)
│   ├── lib/
│   │   ├── http.ts              # 扩展:新增 httpText() 拿 HTML(现有 httpJson 不变)
│   │   └── (现有 lib 不动)
│   └── mcp/
│       └── server.ts            # 修改:import appstore,注册 5 个 tool
├── scripts/
│   └── appstore-crawl.ts        # 新增:全量抓取独立脚本(不走 MCP)
├── data/
│   └── appstore/                # 新增:脚本输出目录(gitignored 大文件,保留 sample)
└── (现有结构不动)
```

### 3.2 模块职责

- **`appstore.types.ts`**: 导出 `AppInfo`、`Category`、`SearchResult` 等 TypeScript 接口。纯类型,零运行时依赖。
- **`appstore.ts`**: 导出 `searchApp()`、`listCategories()`、`listByCategory()`、`getDetail()`、`checkSource()` 五个函数,对应 5 个 tool。内含限速、重试、缓存、降级逻辑。
- **`http.ts`**: 新增 `httpText(url, opts)` 返回 `{ ok, status, text, error }`,与 `httpJson` 同构。`httpJson` 不修改。
- **`server.ts`**: 在 `TOOLS` 数组末尾追加 5 个 `appstore_` 项,handler 调用 `appstore.ts` 导出函数。

### 3.3 Fetch 策略(混合,已确认)

- **优先**: `fetch` 请求 AppGallery 网页/接口 → 用 `httpJson` / `httpText` → 解析。
- **降级**: 检测到动态内容(空结果 + 200 状态)或反爬迹象(验证码关键词) → 调用 Playwright 重新请求该 URL。
- **Playwright 为可选依赖**:
  - 不写入 `package.json` 的 `dependencies`,写入 `optionalDependencies`。
  - 运行时用动态 `import("playwright")` 包裹 try/catch;未安装时 `browser_fallback: false`,工具仍以纯 HTTP 模式工作,`note` 字段提示"install playwright for browser fallback"。
  - `appstore_check` 明确报告 `browser_fallback` 可用性。

### 3.4 内部数据模型

```typescript
// src/providers/appstore.types.ts
export interface AppInfo {
  name: string;
  pkg?: string;          // 包名(详情页才有,列表页可能缺)
  appId?: string;        // AppGallery 内部 ID
  dev?: string;          // 开发者
  category?: string;
  icon?: string;         // 图标 URL
  url: string;           // 详情页 URL(唯一必有的定位字段)
}

export interface Category {
  id: string;            // 分类标识(用于 list_by_category)
  name: string;          // 显示名
}

export interface SourceMeta {
  source: "online" | "cache" | "partial";
  note?: string;
  fetchedAt: string;     // ISO 时间戳
}
```

## 4. 数据流

### 4.1 定向搜索流(核心场景)

```
外部 MCP 客户端
  ──call──> appstore_search({ query })
    → server.ts handler
    → appstore.ts: searchApp(query)
      → 命中内存缓存(5min TTL)? 直接返回
      → 否则 httpJson/httpText 调 AppGallery 搜索接口
      → 空结果 + 可疑迹象? → 降级 Playwright(若可用)
      → 解析 → AppInfo[]
    → 返回 { ok, apps, source, fetchedAt }
```

### 4.2 全量抓取流(独立脚本,不走 MCP)

**设计依据:** MCP tool 不适合跑长任务(model 等待 + 客户端超时)。全量抓取(遍历所有分类分页)是分钟到小时级任务,故走独立脚本。

- `scripts/appstore-crawl.ts` 用 `tsx` 直接运行:`npx tsx scripts/appstore-crawl.ts`
- 流程: `listCategories()` → 遍历每分类 → 分页 `listByCategory()` 直到空 → 去重 → 写 `data/appstore/apps.json`
- **断点续传**: 进度写 `data/appstore/.progress.json`(`{ category, page, doneIds: string[] }`),重跑时跳过已完成。
- 复用 `appstore.ts` 的全部抓取函数,不重复实现。

## 5. 反爬与健壮性

- **限速**: `appstore.ts` 模块级令牌桶(默认 1 req/s)+ 随机抖动 0-500ms。
- **重试**: 429/503 指数退避(200ms / 600ms / 1800ms,max 3 次);其他错误不重试。
- **超时**: 复用 `httpJson` / `httpText` 现有 15s 超时。
- **User-Agent**: 复用现有 `ZCode-harmonyos-dev-plugin/0.1.0`。
- **缓存**: 内存缓存(5min TTL),复用 `updates.ts` 的缓存模式(key = 函数名 + 参数哈希)。
- **降级标记**: 所有返回值带 `source`(`online` | `cache` | `partial`)和 `note`。

## 6. 测试(沿用 vitest)

- **离线 fixture**: `test/fixtures/appgallery/` 存几份真实搜索结果、分类页、详情页的 HTML/JSON。解析器单测不依赖网络。
- **Provider 单测**: `test/providers/appstore.test.ts`,mock `fetch`(`vi.stubGlobal` 或拦截 `httpJson`/`httpText`),验证 `searchApp` / `listByCategory` / `getDetail` 的解析与缓存逻辑。
- **Server 集成测试**: 扩展现有 `test/server.test.ts`,断言 tool 总数 25 → 30,且 5 个 `appstore_` tool 已注册、schema 可解析。
- **网络测试**: `test/network/appstore.network.test.ts`,用 `it.skipIf(!process.env.NETWORK_TEST)` 默认跳过;CI 不跑。

## 7. GitHub Actions

`.github/workflows/appstore-crawl.yml`:
- **定时**: 每周日 03:00 UTC(cron)。
- **手动触发**: `workflow_dispatch`,可选参数 `--categories`(限定分类)。
- **步骤**: checkout → setup-node 24 → npm ci → `npx tsx scripts/appstore-crawl.ts`。
- **产物**: 结果提交到 `data/appstore/` 分支(或作为 Release artifact 附档)。
- **失败处理**: workflow 失败时 Action 默认标红;不静默吞错。

## 8. 文档更新

- **`README.md`**: 工具数 25 → 30;新增 "AppGallery Tools" 章节说明 5 个 tool 用途与限制;更新 "MCP Tools" 列表。
- **`skills/harmonyos-dev/SKILL.md`**: 新增 appstore 工作流说明(何时用 search vs list_by_category vs detail)。
- **诚实声明**: README 明确"覆盖率受反爬限制,不保证全站 100%;`source` 字段如实反映数据来源"。

## 9. 实现顺序(供后续 plan 参考)

1. 类型层:`appstore.types.ts`(零依赖,先定契约)。
2. HTTP 层:`http.ts` 新增 `httpText()`。
3. Provider 层:`appstore.ts` 五个函数 + fixture 驱动的单测(先解析,后网络)。
4. 注册层:`server.ts` 追加 5 个 tool + 集成测试断言 30 个。
5. 脚本层:`scripts/appstore-crawl.ts` + 断点续传。
6. 文档层:README + SKILL.md 更新。
7. CI 层:`appstore-crawl.yml`。

## 10. 开放问题

- **AppGallery 搜索/分类接口的具体 URL 与参数**: 需在实现阶段抓包确认(决策点 5 模式:实现时校准)。`appstore_check` 工具辅助探测。
- **图标 URL 的时效性**: AppGallery CDN URL 可能带签名过期。文档注明"icon URL 可能在抓取后失效,建议即时使用"。
