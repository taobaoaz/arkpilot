# arkpilot

> **⚠️ BREAKING in v0.3.0** — Plugin renamed from `harmonyos-dev` to `arkpilot`. Update your ZCode config:
> - `enabledPlugins: { "harmonyos-dev@local": true }` → `{ "arkpilot@local": true }`
> - MCP server is now `arkpilot` (tools are `mcp__arkpilot__<tool>`).

This is the ZCode plugin for **model-driven HarmonyOS NEXT (ArkTS) app development**. It bundles **25 MCP tools** that drive the full dev loop — environment check, project discovery, build, device, run, UI automation, ArkTS scaffolding, and version updates.

The model drives dev tools through MCP. You focus on the product.

> **AppGallery tools were moved out in v0.3.0.** See the sister project **[taobaoaz/arkgallery](https://github.com/taobaoaz/arkgallery)** for `appstore_search`, `appstore_categories`, `appstore_list_by_category`, `appstore_detail`, and `appstore_icon` (the new icon proxy).

## Quick start

```bash
# 1. Enable the plugin
# In ~/.zcode/cli/config.json:
{
  "plugins": {
    "enabledPlugins": { "arkpilot@local": true },
    "options": {
      "arkpilot@local": { "api_level": "12", "compatible_sdk": "5.0.0" }
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
- `.mcp.json` for the stdio MCP server (named `arkpilot`; the model sees `mcp__arkpilot__<tool>`).
- `skills/harmonyos-dev/SKILL.md` for the model workflow.
- `commands/arkpilot.md` as a convenience slash command.

## 25 MCP tools, in 6 capability groups

| Group | Tools |
|---|---|
| **Env & version** | `harmony_preflight`, `harmony_check_updates` |
| **Project** | `harmony_discover_project`, `harmony_create_app` |
| **Build** | `harmony_build_app`, `harmony_build_and_run` |
| **Device & run** | `harmony_list_devices`, `harmony_wait_for_device`, `harmony_install_app`, `harmony_uninstall_app`, `harmony_launch_app`, `harmony_terminate_app`, `harmony_open_url` |
| **Inspect & automate** | `harmony_logs`, `harmony_screenshot`, `harmony_ui_status`, `harmony_ui_describe`, `harmony_ui_resolve`, `harmony_ui_tap`, `harmony_ui_type_text`, `harmony_ui_back` |
| **Scaffold** | `harmony_create_page`, `harmony_create_component`, `harmony_ability`, `harmony_create_module` |

The `harmony_*` tools cover the **build loop**. For AppGallery queries (search, list, detail, icon proxy), install the companion plugin **[arkgallery](https://github.com/taobaoaz/arkgallery)**.

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

## Requirements

- Windows or macOS.
- DevEco Studio or HarmonyOS command-line tools.
- `hdc`, `hvigorw`, Node.js ≥ 18, optional `ohpm`.
- For emulator workflows: a DevEco-managed emulator already registered with `hdc`.
  This plugin discovers/reuses targets; it does not start DevEco emulators itself.
- Node.js 24 for development.

Use `harmony_preflight` for diagnostics. When setup is missing, the
`arkpilot` skill follows `skills/harmonyos-dev/INSTALL_ENVIRONMENT.md`
for fixed macOS shell or Windows PowerShell setup procedures before returning
to MCP tools.

## Development

```bash
npm install
npm run build      # tsc + esbuild -> dist/mcp/server.js
npm run typecheck
npm test           # vitest run test (62 tests, was 82 before v0.3.0 split)
```

## Project layout

```
arkpilot/
├── .github/workflows/dependabot.yml   # weekly npm updates
├── .zcode-plugin/plugin.json          # plugin manifest (name: "arkpilot")
├── .mcp.json                          # stdio MCP server declaration
├── harmonyos-dev/                     # MCP plugin root
│   ├── package.json                   # @zcode/arkpilot-plugin
│   ├── src/
│   │   ├── mcp/server.ts              # 25 tools registered
│   │   ├── providers/                 # app, build, device, ui, scaffold, updates
│   │   ├── lib/                       # http, run, result, path
│   │   └── types/
│   ├── test/                          # vitest suites
│   ├── skills/harmonyos-dev/          # model workflow
│   ├── commands/arkpilot.md           # slash command
│   └── templates/stage-app/           # stage-model ArkTS scaffold
└── docs/
    ├── superpowers/specs/             # design specs
    └── superpowers/plans/             # implementation plans
```

## Extension points

- `src/providers/project.ts` — project discovery and creation.
- `src/providers/build.ts` — hvigor build orchestration.
- `src/providers/device.ts` — hdc device discovery.
- `src/providers/ui.ts` — UI automation operations.
- `src/providers/updates.ts` — online version checking.
- `src/providers/scaffold.ts` — ArkTS page / component / ability / module generators.

For AppGallery scraping, see **[taobaoaz/arkgallery](https://github.com/taobaoaz/arkgallery)** (4 metadata tools + 1 icon proxy).

## License

MIT
