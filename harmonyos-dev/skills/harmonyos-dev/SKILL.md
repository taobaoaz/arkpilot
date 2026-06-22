---
name: harmonyos-dev
description: 通过 harmonyos-dev MCP 工具构建、运行、检查并自动化 HarmonyOS NEXT (ArkTS) 应用,或查询华为应用市场应用信息。
---

# HarmonyOS Dev

Use this skill when the user wants to create, modify, build, run, debug, screenshot, or inspect a HarmonyOS NEXT (ArkTS) app on a connected device or running emulator.

## ZCode Tool Names

MCP server 配置为 `harmonyos-dev`,工具暴露为 `mcp__harmonyos_dev__<tool>`。

## Default Workflow

1. Call `harmony_preflight` FIRST. 缺失依赖时按 `INSTALL_ENVIRONMENT.md` 修复(固定步骤,不即兴装命令)。敏感操作(许可证/密码/删数据)必须停下问用户。
2. Call `harmony_check_updates` (可选,非阻塞)。告知用户版本差异 + 建议动作,**不自动升级**;离线/网络失败时跳过。
3. Discover with `harmony_discover_project`. 无工程且要新建 → `harmony_create_app`(默认拒覆盖,overwrite 需确认)。读 warnings 修缺失项。
4. Build and launch with `harmony_build_and_run`. serial 复用指定设备;无 serial 取首个;无设备则 fail。编译错误先读 output。
5. Verify with `harmony_screenshot`.
6. Runtime checks: `harmony_open_url` / `harmony_launch_app` / `harmony_terminate_app` / `harmony_logs`.
7. UI automation: first `harmony_ui_status`. 优先 `harmony_ui_describe`/`harmony_ui_resolve` 再 tap 坐标。available:false 时回退截图+日志。

## Tool Notes

- preflight 纯诊断;check_updates 只读提示、不自动升级、离线降级不阻塞。
- 工具接受 `serial`;不自动启动 DevEco 模拟器(发现复用)。
- create_app 默认拒覆盖;debug 走自动签名;签名问题提示去 DevEco 配置。
- UI 自动化走 `uitest dumpLayout`;老镜像不可用时回退。
- 保持用 MCP 工具而非裸 hdc/hvigorw。

## Project Requirements

必备文件:`build-profile.json5`(工程级)、`entry/build-profile.json5`、`entry/src/main/module.json5`、`oh-package.json5`、`hvigorw`/`hvigorw.bat` + `hvigor/hvigor-config.json5`、`AppScope/app.json5` + `AppScope/resources/base/media/`。

## Build Troubleshooting

- 签名缺失 → DevEco 配置签名 / debug 自动签名。
- hvigorw 不可执行(macOS)→ `chmod +x hvigorw`。
- node 版本低 → INSTALL_ENVIRONMENT。
- SDK 路径错 → 配置 `HOS_SDK_HOME`。
- ohpm install 失败 → 检查 oh-package.json5 / 网络 / 仓库源。

## AppGallery 工作流 (appstore_*)

当用户想查 AppGallery 应用信息(名称、包名、开发者、图标、分类)时使用 appstore 工具。

1. **定向查某个应用** → `appstore_search({ query: "微信" })`。`exact:true` 只返回精确名匹配。
2. **列分类** → `appstore_categories()`,拿 `id` 用于下一步。
3. **浏览分类下的应用** → `appstore_list_by_category({ category: "game", page: 1 })`。
4. **补全单个应用字段** → `appstore_detail({ appId })` 或 `{ url }`。
5. **诊断数据源** → `appstore_check()`,报告 http 是否可达、playwright 浏览器降级是否可用。

**注意:**
- 覆盖率不保证 100%。每个返回有 `source` 字段(`online`/`cache`/`partial`),如实反映数据质量。
- `partial` 时带 `note`,告知用户降级原因(网络失败/反爬/浏览器降级未启用)。
- 全量抓取不走 MCP(长任务),用 `npm run crawl` 脚本,见 README。

## Extension Point

后端隔离:后续可映射同一操作到 DevEco 语义工具 / 更丰富 UiTest / 其他桥接,不改 SKILL 工作流。
