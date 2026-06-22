# arkpilot

> **arkpilot** is a ZCode plugin for model-driven HarmonyOS NEXT (ArkTS) app development.
> It bundles 30 MCP tools covering the full dev loop — environment check, project discovery, build, device, run, UI automation, ArkTS scaffolding, version updates, **and AppGallery app metadata scraping**.

It is your **co-pilot for the ArkTS stack**: the model drives dev tools through MCP, you focus on the product.

## Quick start

```bash
# 1. Enable the plugin
# In ~/.zcode/cli/config.json:
{
  "plugins": {
    "enabledPlugins": { "harmonyos-dev@local": true },
    "options": {
      "harmonyos-dev@local": { "api_level": "12", "compatible_sdk": "5.0.0" }
    }
  }
}

# 2. Load the plugin
zcode --plugin-dir /absolute/path/to/arkpilot/harmonyos-dev

# 3. Ask the model anything
# "Create a HarmonyOS NEXT stage app called weather, build it, install on my device, and tell me when it launches."
```

When enabled, ZCode loads:

- `.zcode-plugin/plugin.json` for plugin metadata and skill/command paths.
- `.mcp.json` for the stdio MCP server (named `harmonyos-dev`; the model sees `mcp__harmonyos_dev__<tool>`).
- `skills/harmonyos-dev/SKILL.md` for the model workflow.
- `commands/harmonyos-dev.md` as a convenience slash command.

## What's inside

### 30 MCP tools, in 6 capability groups

| Group | Tools |
|---|---|
| **Env & version** | `harmony_preflight`, `harmony_check_updates` |
| **Project** | `harmony_discover_project`, `harmony_create_app` |
| **Build** | `harmony_build_app`, `harmony_build_and_run` |
| **Device & run** | `harmony_list_devices`, `harmony_wait_for_device`, `harmony_install_app`, `harmony_uninstall_app`, `harmony_launch_app`, `harmony_terminate_app`, `harmony_open_url` |
| **Inspect & automate** | `harmony_logs`, `harmony_screenshot`, `harmony_ui_status`, `harmony_ui_describe`, `harmony_ui_resolve`, `harmony_ui_tap`, `harmony_ui_type_text`, `harmony_ui_back` |
| **Scaffold** | `harmony_create_page`, `harmony_create_component`, `harmony_create_ability`, `harmony_create_module` |
| **AppGallery** ⭐ | `appstore_search`, `appstore_categories`, `appstore_list_by_category`, `appstore_detail`, `appstore_check` |

The `harmony_*` tools cover the **build loop**. The `appstore_*` tools answer
"what apps exist, who's published what, and what's the icon URL" — useful when the model
needs to recommend apps, build a launch list, or fetch metadata into your own app.

## AppGallery tools — in detail

5 tools fetch app metadata from `appgallery.huawei.com`: name, package name, developer,
category, icon URL, detail page URL.

### Core use case — `appstore_search`

> External MCP clients pass an app name, get back a JSON list of matching apps.

```ts
appstore_search({ query: "微信", limit: 5 })
// → {
//     ok: true,
//     apps: [{ name: "微信", pkg: "com.tencent.mm", appId: "C5683",
//              icon: "https://appimg-drcn.dbankcdn.com/.../weixin.png",
//              url: "https://appgallery.huawei.com/app/C5683" }],
//     source: "online",
//     note: "exact match via browser fallback",
//     fetchedAt: "2026-06-22T..."
//   }
```

The other 4 tools round it out:

| Tool | When to use |
|---|---|
| `appstore_detail({ appId: "C5683" })` | Get full detail (name, pkg, icon, URL) by appId |
| `appstore_categories()` | List 15 common categories (游戏/工具/社交/...) |
| `appstore_list_by_category({ category: "app\|game", page: 1 })` | Browse apps in a category |
| `appstore_check()` | Diagnose: is the data source reachable? Is Playwright available for browser fallback? |

### Coverage & honesty

AppGallery has **no public "list all apps" API** and applies anti-scraping
(browser fingerprinting, IP rate limits). These tools cover reachable apps
(rankings + categories + search) but **do not guarantee 100% coverage**.

Every result carries a `source` field:
- `online` (fresh, just fetched)
- `cache` (within 5min TTL, no network call)
- `partial` (degraded; see `note` for why)

A `note` explains every non-`online` result — for example, when Playwright isn't
installed and only the HTTP path is available.

### How it works (technical, optional reading)

AppGallery's web API (`webEdge /uowap/index`) requires an `InterfaceCode` signature
on every request, which it computes in the browser. Pure HTTP from the server is
rejected with HTTP 403 + `rtnCode: 1002`.

So every `appstore_*` request follows this strategy:

1. **Try** `httpJson` against the public endpoint (fast, no browser).
2. **On signature rejection or failure**, fall back to Playwright:
   - Spin up headless Chromium.
   - Load the AppGallery SPA at the relevant URL.
   - Simulate user input to trigger the correct XHR (`completeSearchWord` for search,
     `getTabDetail` for category/detail).
   - Capture the JSON response.
3. **Cache** successful results in memory for 5 minutes.
4. **Mark** the result as `partial` if every layer failed.

This is the honest answer to "why don't I just call the API directly from my server" —
you can't, without reverse-engineering the signature algorithm, which AppGallery
rotates regularly.

### Optional browser fallback

Playwright is an `optionalDependency`. When installed, dynamic/anti-scraped
responses fall back to a headless browser. Without it, tools work in HTTP-only
mode (most searches still succeed for popular apps).

```bash
# Optional — for highest coverage
npm install playwright
npx playwright install chromium

# Probe availability
# → appstore_check() returns { browser_fallback: true, ... }
```

### Full crawl (not via MCP)

Long-running full crawl runs as a standalone script (MCP tools are unsuitable
for multi-hour jobs):

```bash
npm run crawl                                    # all categories
npx tsx scripts/appstore-crawl.ts --categories "app|game,app|tool"   # subset
```

Output: `data/appstore/apps.json` (gitignored). Resume support via
`data/appstore/.progress.json`.

A weekly GitHub Actions workflow (`.github/workflows/appstore-crawl.yml`) runs
this automatically and uploads the result as an artifact.

## Default workflow

1. `harmony_preflight` FIRST. Missing deps → follow `INSTALL_ENVIRONMENT.md`
   (fixed Windows PowerShell / macOS shell steps, no improvisation). Sensitive
   actions (licenses, passwords, data deletion) must pause and ask the user.
2. `harmony_check_updates` (optional, non-blocking). Tells you version drift
   and suggests a fix; **never auto-upgrades**. Skip on offline.
3. `harmony_discover_project`. No project & want new → `harmony_create_app`
   (refuses overwrite unless `overwrite: true`).
4. `harmony_build_and_run`. Pass `serial` to pin a device; otherwise first
   found. No device → fail. Compile errors first read `output`.
5. `harmony_screenshot` to verify visually.
6. Runtime checks: `harmony_open_url` / `harmony_launch_app` / `harmony_terminate_app` / `harmony_logs`.
7. UI automation: first `harmony_ui_status`. Prefer `harmony_ui_describe` /
   `harmony_ui_resolve` then `harmony_ui_tap`. `available: false` → fall back to
   screenshot + logs.

## AppGallery workflow (appstore_*)

When the model needs to look up AppGallery app info (name, package, developer,
icon, category), use the `appstore_*` tools:

1. **Find a specific app** → `appstore_search({ query: "微信" })`.
   `exact: true` returns only exact-name matches.
2. **List categories** → `appstore_categories()`, grab the `id` for the next step.
3. **Browse a category** → `appstore_list_by_category({ category: "app|game", page: 1 })`.
4. **Enrich one app's fields** → `appstore_detail({ appId })` or `{ url }`.
5. **Diagnose** → `appstore_check()`, reports http reachability + browser fallback.

Notes:
- Coverage is not 100%. Every response has a `source` field (`online` / `cache` / `partial`).
- `partial` includes a `note` explaining the degradation.
- For full crawl, use the `npm run crawl` script, not MCP (long-running).

## Requirements

- Windows or macOS.
- DevEco Studio or HarmonyOS command-line tools.
- `hdc`, `hvigorw`, Node.js ≥ 18, optional `ohpm`.
- For emulator workflows: a DevEco-managed emulator already registered with `hdc`.
  This plugin discovers/reuses targets; it does not start DevEco emulators itself.
- Node.js 24 for development.
- For AppGallery browser fallback: `playwright` + `npx playwright install chromium`.

Use `harmony_preflight` for diagnostics. When setup is missing, the
`harmonyos-dev` skill follows `skills/harmonyos-dev/INSTALL_ENVIRONMENT.md`
for fixed macOS shell or Windows PowerShell setup procedures before returning
to MCP tools.

## Development

```bash
npm install
npm run build      # tsc + esbuild -> dist/mcp/server.js
npm run typecheck
npm test           # vitest run test (82 tests)
```

## Project layout

```
arkpilot/
├── .github/workflows/appstore-crawl.yml   # weekly AppGallery crawl
├── .zcode-plugin/plugin.json              # plugin manifest
├── .mcp.json                              # stdio MCP server declaration
├── harmonyos-dev/                         # MCP plugin root
│   ├── package.json                       # @zcode/harmonyos-dev-plugin
│   ├── src/
│   │   ├── mcp/server.ts                  # 30 tools registered
│   │   ├── providers/                     # app, build, device, ui, scaffold, updates, appstore
│   │   ├── lib/                           # http, run, result, path
│   │   └── types/
│   ├── test/                              # vitest suites
│   ├── scripts/appstore-crawl.ts          # full-crawl script
│   ├── data/appstore/                     # crawl output (gitignored)
│   ├── skills/harmonyos-dev/              # model workflow
│   ├── commands/harmonyos-dev.md          # slash command
│   └── templates/stage-app/               # stage-model ArkTS scaffold
└── docs/
    ├── superpowers/specs/                 # design specs
    └── superpowers/plans/                 # implementation plans
```

## Extension points

- `src/providers/project.ts` — project discovery and creation.
- `src/providers/build.ts` — hvigor build orchestration.
- `src/providers/device.ts` — hdc device discovery.
- `src/providers/ui.ts` — UI automation operations.
- `src/providers/updates.ts` — online version checking.
- `src/providers/appstore.ts` — AppGallery metadata fetching (search / categories / list / detail).
- `src/providers/scaffold.ts` — ArkTS page / component / ability / module generators.

## License

MIT
