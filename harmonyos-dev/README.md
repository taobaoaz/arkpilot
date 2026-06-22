# HarmonyOS Dev Plugin

ZCode plugin for model-driven HarmonyOS NEXT (ArkTS) app development.

The package root is the plugin root:

```bash
zcode --plugin-dir /absolute/path/to/harmonyos-dev
```

When enabled, ZCode loads:

- `.zcode-plugin/plugin.json` for plugin metadata and skill/command paths.
- `.mcp.json` for the stdio MCP server.
- `skills/harmonyos-dev/SKILL.md` for the model workflow.
- `commands/harmonyos-dev.md` as a convenience slash command.

## Example `~/.zcode/cli/config.json` entry

```json
{
  "plugins": {
    "enabledPlugins": {
      "harmonyos-dev@local": true
    },
    "options": {
      "harmonyos-dev@local": {
        "api_level": "12",
        "compatible_sdk": "5.0.0"
      }
    }
  }
}
```

The plugin MCP server name is `harmonyos-dev`. ZCode normalizes that name for model-visible
MCP tools, so the model sees `mcp__harmonyos_dev__<tool>`, e.g.
`mcp__harmonyos_dev__harmony_preflight`.

## MVP Scope

- Discover or create a minimal HarmonyOS NEXT Stage-model ArkTS app.
- Build with `hvigorw` (assembleHap).
- Reuse a connected device or running emulator by serial, install, launch, terminate, open URL,
  screenshot, and read logs through `hdc`.
- Online version check (`harmony_check_updates`) against official sources — read-only, never
  auto-upgrades.
- Expose UI actions through `hdc shell uitest` (status/describe/resolve/tap/type/back).
- Scaffold ArkTS pages, components, abilities, and modules.
- Query Huawei AppGallery app metadata via `appstore_search` / `appstore_categories` / `appstore_list_by_category` / `appstore_detail`.

## MCP Tools (30)

- `harmony_preflight`
- `harmony_check_updates`
- `harmony_discover_project`
- `harmony_create_app`
- `harmony_build_app`
- `harmony_build_and_run`
- `harmony_list_devices`
- `harmony_wait_for_device`
- `harmony_install_app`
- `harmony_uninstall_app`
- `harmony_launch_app`
- `harmony_terminate_app`
- `harmony_open_url`
- `harmony_logs`
- `harmony_screenshot`
- `harmony_ui_status`
- `harmony_ui_describe`
- `harmony_ui_resolve`
- `harmony_ui_tap`
- `harmony_ui_type_text`
- `harmony_ui_back`
- `harmony_create_page`
- `harmony_create_component`
- `harmony_create_ability`
- `harmony_create_module`
- `appstore_search`
- `appstore_categories`
- `appstore_list_by_category`
- `appstore_detail`
- `appstore_check`

## Requirements

- Windows or macOS.
- DevEco Studio or HarmonyOS command-line-tools.
- `hdc`, `hvigorw`, node (≥18), optional ohpm.
- For emulator workflows: a DevEco-managed emulator already registered with hdc.
  This plugin discovers/reuses targets; it does not start DevEco emulators itself.
- Node.js 24 for development.

Use `harmony_preflight` for diagnostics. When setup is missing, the `harmonyos-dev` skill
follows `skills/harmonyos-dev/INSTALL_ENVIRONMENT.md` for fixed macOS shell or Windows
PowerShell setup procedures before returning to MCP tools.

## Development

```bash
npm install
npm run build      # tsc + esbuild -> dist/mcp/server.js
npm run typecheck
npm test           # vitest run test
```

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

## Extension Points

- `src/providers/project.ts` owns project discovery and creation.
- `src/providers/build.ts` owns hvigor build orchestration.
- `src/providers/device.ts` owns hdc device discovery.
- `src/providers/ui.ts` owns UI automation operations.
- `src/providers/updates.ts` owns online version checking.
- `src/providers/appstore.ts` owns AppGallery metadata fetching (search/categories/list/detail).
