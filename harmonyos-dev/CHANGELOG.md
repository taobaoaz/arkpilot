# Changelog

All notable changes to arkpilot (the `harmonyos-dev` ZCode plugin) are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-22

### Added

**AppGallery app metadata scraper (5 new MCP tools)**
- `appstore_search` — search apps by name, exact-match supported. Core "input name → return name" use case for external MCP clients.
- `appstore_categories` — list 15 common categories (游戏/工具/社交/...) curated from the mobile AppGallery experience (the web has no category nav, so categories are returned offline-tolerant).
- `appstore_list_by_category` — page through apps in a category (`app|game`, `app|tool`, etc.).
- `appstore_detail` — full detail for one app by `appId` or `url`.
- `appstore_check` — diagnostic; reports http reachability + Playwright fallback availability.

**Real API integration** (no more guess-work URLs)
- Calibrated to the actual `webEdge /uowap/index` endpoint (`web-drcn.hispace.dbankcloud.com/edge/uowap/index`) with `method` query parameter convention.
- All app field names verified against real responses (`package`, `ID`, `detailId`, etc.).
- Correct 3-level response nesting handled: `layoutData[].dataList[].list[]` plus `dataList[0]` as a direct app object for detail pages.

**Browser fallback** (signature-bypass)
- AppGallery's web API requires an `InterfaceCode` signature on every request, computed in browser JS. Pure HTTP from the server returns 403 + `rtnCode: 1002`.
- When the HTTP path fails, every `appstore_*` request automatically falls back to a headless Chromium (Playwright) that simulates real user input and captures the correct XHR (`completeSearchWord` for exact-match search, `getTabDetail` for category/detail).
- `appstore_search` prefers exact matches from `completeSearchWord.app` over the "related apps" from `getTabDetail`.

**Full-crawl script**
- `scripts/appstore-crawl.ts` (run via `npm run crawl` or `npx tsx`).
- Walks every category, paginates, dedupes, writes `data/appstore/apps.json`.
- Resume support via `data/appstore/.progress.json` (re-runs skip completed work).
- GitHub Actions workflow (`.github/workflows/appstore-crawl.yml`) runs weekly and uploads the result as an artifact.

**Quality & ops**
- 82 vitest tests (was 53 before this release). 100% pass.
- All tests use offline JSON fixtures under `test/fixtures/appgallery/` for fast, deterministic runs.
- Network calls in tests are mocked via `vi.mock`. Real network smoke verification is documented in `docs/superpowers/specs/2026-06-22-appstore-scraper-design.md`.

### Changed

- `src/lib/http.ts` — added `httpText()` for HTML fetching (parallels `httpJson`).
- `README.md` — rewrote as the `arkpilot` brand entry point, with AppGallery tools as a featured section. Internal npm package name (`@zcode/harmonyos-dev-plugin`), MCP server name (`harmonyos-dev`), and skill/command names are unchanged for backward compatibility.
- `skills/harmonyos-dev/SKILL.md` — added a 5-step "AppGallery 工作流" section so the model knows when and how to use each `appstore_*` tool.

### Tooling

- `playwright` moved to `optionalDependencies` (was a hard dep in earlier drafts; reverted to optional so the plugin stays lightweight when users only need HTTP).
- `tsx` added to `devDependencies` for running the crawl script.
- `npm run crawl` script added.

### Limitations (honest)

- AppGallery has **no public "list all apps" API**. Coverage is best-effort: search (exact match), categories, and detail all work; full coverage of every published app is not promised.
- All `appstore_*` responses carry a `source` field (`online` | `cache` | `partial`) so the model and the user can see how fresh the data is.
- Without `playwright` installed, some anti-scraped responses return `partial`; the plugin still works in HTTP-only mode for popular apps.

## [0.1.0] - 2026-06-15

Initial release. 25 MCP tools covering the full HarmonyOS NEXT dev loop:

- Env check (`harmony_preflight`) and online version probe (`harmony_check_updates`).
- Project discovery and creation (`harmony_discover_project`, `harmony_create_app`).
- Build orchestration (`harmony_build_app`, `harmony_build_and_run`).
- Device and app lifecycle (`harmony_list_devices`, `harmony_wait_for_device`, `harmony_install_app`, `harmony_uninstall_app`, `harmony_launch_app`, `harmony_terminate_app`, `harmony_open_url`).
- Runtime inspection (`harmony_logs`, `harmony_screenshot`).
- UI automation through `hdc shell uitest` (`harmony_ui_status`, `harmony_ui_describe`, `harmony_ui_resolve`, `harmony_ui_tap`, `harmony_ui_type_text`, `harmony_ui_back`).
- ArkTS scaffolding (`harmony_create_page`, `harmony_create_component`, `harmony_create_ability`, `harmony_create_module`).

[0.2.0]: #020---2026-06-22
[0.1.0]: #010---2026-06-15
