# arkpilot

> **⚠️ BREAKING in v0.3.0** — Plugin renamed from `harmonyos-dev` to `arkpilot`. Update your `~/.zcode/cli/config.json`:
> - `enabledPlugins: { "harmonyos-dev@local": true }` → `{ "arkpilot@local": true }`
> - `options: { "harmonyos-dev@local": { ... } }` → `{ "arkpilot@local": { ... } }`
> - The MCP server is now named `arkpilot` (tools are still `mcp__arkpilot__<tool>`).

**arkpilot** is a ZCode plugin for model-driven HarmonyOS NEXT (ArkTS) app development.

It bundles **25 MCP tools** covering the full dev loop — environment check, project discovery, build, device, run, UI automation, ArkTS scaffolding, and version updates.

The model drives dev tools through MCP. You focus on the product.

## Sister project: arkgallery

AppGallery (`appstore_*`) tools were split out to a separate plugin in v0.3.0:
**[taobaoaz/arkgallery](https://github.com/taobaoaz/arkgallery)** — 4 metadata tools + 1 icon proxy (`appstore_icon`).

Install both:

```json
{
  "plugins": {
    "enabledPlugins": {
      "arkpilot@local": true,
      "arkgallery@local": true
    }
  }
}
```

## What's in this repo

| Path | What it is |
|---|---|
| `harmonyos-dev/` | The actual ZCode plugin. `package.json`, MCP server source, vitest suites, the `arkpilot` skill, the slash command, and a stage-app ArkTS template. **Start here.** |
| `deveco-cli/` | Documentation bridge — see its [INTEGRATION.md](deveco-cli/INTEGRATION.md). |
| `docs/superpowers/` | Design specs and implementation plans (Keep a Changelog–style records for the v0.1.0 → v0.3.0 evolution). |

## Install

In `~/.zcode/cli/config.json`:

```json
{
  "plugins": {
    "enabledPlugins": { "arkpilot@local": true },
    "options": {
      "arkpilot@local": { "api_level": "12", "compatible_sdk": "5.0.0" }
    }
  }
}
```

Then load it:

```bash
zcode --plugin-dir /absolute/path/to/arkpilot/harmonyos-dev
```

## 25 MCP tools, in 6 capability groups

| Group | Tools |
|---|---|
| **Env & version** | `harmony_preflight`, `harmony_check_updates` |
| **Project** | `harmony_discover_project`, `harmony_create_app` |
| **Build** | `harmony_build_app`, `harmony_build_and_run` |
| **Device & run** | `harmony_list_devices`, `harmony_wait_for_device`, `harmony_install_app`, `harmony_uninstall_app`, `harmony_launch_app`, `harmony_terminate_app`, `harmony_open_url` |
| **Inspect & automate** | `harmony_logs`, `harmony_screenshot`, `harmony_ui_status`, `harmony_ui_describe`, `harmony_ui_resolve`, `harmony_ui_tap`, `harmony_ui_type_text`, `harmony_ui_back` |
| **Scaffold** | `harmony_create_page`, `harmony_create_component`, `harmony_create_ability`, `harmony_create_module` |

For full details, examples, and UI-automation recipes, see:

- **[harmonyos-dev/README.md](harmonyos-dev/README.md)** — user-facing docs
- **[harmonyos-dev/CHANGELOG.md](harmonyos-dev/CHANGELOG.md)** — what changed in each release
- **[harmonyos-dev/skills/harmonyos-dev/SKILL.md](harmonyos-dev/skills/harmonyos-dev/SKILL.md)** — the model workflow

## Releases

| Tag | Date | Highlights |
|---|---|---|
| [`v0.3.0`](https://github.com/taobaoaz/arkpilot/releases/tag/v0.3.0) | 2026-06-23 | **BREAKING**: plugin renamed `harmonyos-dev` → `arkpilot`; AppGallery tools split out to [arkgallery](https://github.com/taobaoaz/arkgallery). |
| [`v0.2.0`](https://github.com/taobaoaz/arkpilot/releases/tag/v0.2.0) | 2026-06-22 | 5 AppGallery tools, real `webEdge /uowap/index` API integration, Playwright browser fallback, weekly crawl workflow, 82 vitest tests. (Tools moved out in v0.3.0.) |
| `harmonyos-dev-v0.1.0` | 2026-06-15 | Initial 25 tools covering the full HarmonyOS NEXT dev loop. |

## License

[MIT](LICENSE) — see [harmonyos-dev/package.json](harmonyos-dev/package.json) for the canonical declaration.
