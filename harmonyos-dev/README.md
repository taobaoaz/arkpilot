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

## MCP Tools (25)

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

## Extension Points

- `src/providers/project.ts` owns project discovery and creation.
- `src/providers/build.ts` owns hvigor build orchestration.
- `src/providers/device.ts` owns hdc device discovery.
- `src/providers/ui.ts` owns UI automation operations.
- `src/providers/updates.ts` owns online version checking.
