# HarmonyOS Dev 插件设计规格 (Spec)

- **日期:** 2026-06-21
- **插件名:** `harmonyos-dev`
- **版本:** 0.1.0 (P0 闭环)
- **状态:** 待用户评审

## 1. 概述

### 1.1 目标

为 ZCode 提供一套完整的 HarmonyOS NEXT (纯血鸿蒙) 开发流程插件,覆盖环境预检、ArkTS 工程发现与创建、hvigor 构建、模拟器/真机运行、截图、日志、基础 UI 自动化,以及 ArkTS 代码脚手架动态生成。模型通过 MCP 工具驱动整个开发闭环,平台差异由工具封装,而非由模型拼装裸命令。

### 1.2 技术栈与目标平台

- **HarmonyOS 技术栈:** HarmonyOS NEXT,ArkTS + ArkUI(声明式 UI),Stage 模型
- **工具链:** hdc(设备/调试)+ hvigorw(构建),通过命令行驱动
- **MCP Server 实现:** TypeScript + esbuild 单文件打包,依赖 `@modelcontextprotocol/sdk` + `zod`
- **宿主平台:** Windows + macOS (对齐 `android-emulator`)
- **P0 边界:** 只发现/复用已运行的模拟器或真机,**不自动创建或启动 DevEco 模拟器**

### 1.3 架构方案(已确认)

采用**单插件单 MCP Server** 方案,与官方 `android-emulator@zcode-plugins-official` 同构:一个 `harmonyos-dev` 插件,内含一个 stdio MCP server,所有工具注册在同一 server 中,按 `src/providers/*.ts` 分层。模型侧可见工具为 `mcp__harmonyos_dev__<tool>`。

## 2. 目录结构

```
harmonyos-dev/0.1.0/
├── .zcode-plugin/
│   └── plugin.json                 # 插件清单:metadata + skills/commands 路径 + mcpServers + userConfig
├── .zcode-plugin-seed.json         # 安装源信息(marketplace/plugin/pluginVersion/hash)
├── .mcp.json                       # Claude 兼容的 stdio MCP server 声明(开发用)
├── package.json                    # @zcode/harmonyos-dev-plugin
├── tsconfig.json
├── esbuild.config.mjs              # 单文件打包配置(产出 dist/mcp/server.js)
├── README.md
├── .gitignore
│
├── skills/
│   └── harmonyos-dev/
│       ├── SKILL.md                # 模型工作流(对标 android-dev/SKILL.md)
│       └── INSTALL_ENVIRONMENT.md  # 固定的 Windows PowerShell / macOS 环境安装流程
│
├── commands/
│   └── harmonyos-dev.md            # /harmonyos-dev 斜杠命令入口
│
├── hooks/
│   └── hooks.json                  # P0 为空 hooks:{},预留扩展点
│
├── templates/
│   └── stage-app/                  # 最小 HarmonyOS NEXT Stage 模型工程模板资产
│       └── README.md
│
├── src/
│   ├── mcp/
│   │   └── server.ts               # MCP 入口:注册所有工具、对接 stdio
│   ├── lib/
│   │   ├── run.ts                  # 子进程执行封装(超时/编码/Windows+macOS 兼容)
│   │   ├── result.ts               # 统一结果类型 {ok, output, ...} + ok()/fail()/brief() 辅助
│   │   ├── path.ts                 # 跨平台路径/SDK 定位/工程根查找
│   │   ├── schema.ts               # 复用的 zod schema 片段(serial/timeout/overwrite)
│   │   └── http.ts                 # 轻量 HTTP 客户端(超时/UA/JSON 解析,供 updates.ts 用)
│   └── providers/
│       ├── sdk.ts                  # HarmonyOS SDK / DevEco / command-line-tools 定位
│       ├── preflight.ts            # 环境预检(13 项检查)
│       ├── project.ts              # 工程发现(build-profile.json5) + 创建(Stage 模板)
│       ├── build.ts                # hvigorw 构建(assembleHap)
│       ├── device.ts               # hdc 设备列表/连接复用(P0 不启模拟器)
│       ├── app.ts                  # 安装/启动/终止/打开 URL
│       ├── logs.ts                 # hilog 日志拉取与过滤
│       ├── screenshot.ts           # hdc 截图
│       ├── ui.ts                   # UiTest UI 自动化(状态/描述/点击/输入)
│       ├── scaffold.ts             # ArkTS 页面/组件/Ability/模块 动态生成
│       └── updates.ts              # 在线版本检查:查官方最新 SDK/hvigor/ohpm/API,与本地对比提示升级
│
├── test/
│   ├── fixtures/
│   │   ├── sample-stage-app/       # 最小真实工程,测 discover/build
│   │   ├── dumpLayout.xml          # UiTest 输出样本,测 ui 解析
│   │   └── hvigor-output.txt       # hvigorw 构建输出样本,测 hap 解析
│   ├── lib/{run,result,path}.test.ts
│   ├── providers/{preflight,project,build,device,ui,scaffold}.test.ts
│   └── server.test.ts
│
└── dist/
    └── mcp/server.js               # esbuild 单文件产物,ZCode 通过 node 启动
```

### 2.1 三层职责划分

| 层 | 职责 | 文件 |
|---|---|---|
| **MCP 入口层** | 注册工具、定义 zod schema、对接 stdio 协议、统一错误兜底 | `src/mcp/server.ts` |
| **Provider 层** | 每个领域一个文件,封装命令拼装与结果解析 | `src/providers/*.ts` |
| **Lib 层** | 无业务的通用工具:进程执行、结果封装、路径、schema | `src/lib/*.ts` |

### 2.2 与 android-emulator 的关键差异

1. **工具链不同:** `adb/gradle/emulator` → `hdc/hvigorw`
2. **工程模型不同:** Gradle 多模块 → HarmonyOS Stage 模型(`build-profile.json5` + `module.json5`)
3. **模板不同:** Kotlin/Compose → ArkTS/ArkUI
4. **无 AVD 概念:** HarmonyOS 模拟器由 DevEco Studio 配套 emulator 管理,P0 只做 hdc 设备发现 + 已运行模拟器复用,**不自动创建/启动模拟器**

## 3. Provider 组件详细设计

每个组件按「职责 / 输入 / 输出 / 依赖」描述。所有 Provider 依赖 `lib/run.ts`、`lib/result.ts`、`lib/path.ts`。

### 3.1 `lib/run.ts` —— 进程执行内核

**职责:** 封装 `child_process.spawn`,处理 Windows(`cmd.exe`)与 macOS(`/bin/sh`)的差异、超时、UTF-8 编码、stdout/stderr 合并、退出码判定。

**API:**
```ts
run(cmd: string, args: string[], opts?: {
  cwd?: string;
  timeout?: number;        // 默认 120000ms
  env?: Record<string,string>;
  captureStderr?: boolean; // 默认 true
}): Promise<RunResult>
// RunResult = { ok; code; stdout; stderr; combined; brief }
```

**行为:**
- Windows 上 `spawn` 使用 `shell:true`,确保 `hvigorw.bat` / `hdc.exe` 可被找到
- 超时则 kill 子进程并返回 `{ok:false, stderr:"<cmd> timed out after Xms"}`
- `brief()` 截取 combined 末尾 2000 字符,避免长输出撑爆模型上下文

### 3.2 `lib/result.ts` —— 统一结果类型

```ts
interface ToolResult {
  ok: boolean;
  output: string;          // 人类可读摘要(模型优先读)
  [key: string]: any;      // 结构化字段
}
// 辅助:ok(output, extra?) / fail(output, extra?) / brief(text, max=2000)
```

### 3.3 `lib/path.ts` —— 路径与定位工具

- `harmonyRoot()`:从 cwd 向上查找含 `build-profile.json5` 的目录
- `pluginDataDir()`:解析 `HARMONYOS_PLUGIN_DATA` 环境变量
- 跨平台路径拼接

### 3.4 `lib/schema.ts` —— 复用 zod 片段

`serial`(string, 设备序列号)、`timeout`(number, 可选)、`overwrite`(boolean, 默认 false)、`root`(string, 可选工程根)等公共 schema。

### 3.5 `providers/sdk.ts` —— HarmonyOS SDK 定位

**定位优先级(高→低):**
1. userConfig `sdk_path`(经 `HARMONYOS_PLUGIN_SDK_PATH` 注入)
2. 环境变量 `HOS_SDK_HOME` / `HDC_HOME` / `DEVECO_SDK_HOME`
3. 系统默认路径:
   - Windows: `%LOCALAPPDATA%\Huawei\Sdk`、`%DEVECO_HOME%\sdk`
   - macOS: `~/Library/Huawei/Sdk`、`/Applications/DevEco Studio.app/Contents/sdk`
4. `hdc` / `hvigorw` 是否在 `PATH` 上(`which`/`where`)

**API:** `sdkRoot()` / `hdcPath()` / `hvigorwPath(root)` / `checkTool(name)`

### 3.6 `providers/preflight.ts` —— 环境预检

**职责:** 一次性返回环境就绪度报告,是 SKILL 工作流的第一步。纯诊断,**只读、不修改**。

**输出:**
```ts
{
  ok: boolean;
  output: string;
  checks: Array<{ name; ok; detail; fix; optional? }>;
  hasReadyTarget: boolean;
}
```

**13 项检查清单:**

| # | 检查项 | 失败修复指引 |
|---|---|---|
| 1 | Host OS (win32/darwin) | "Run this plugin on Windows or macOS" |
| 2 | HarmonyOS SDK root | "Install DevEco Studio or set HOS_SDK_HOME/HARMONYOS_PLUGIN_SDK_PATH" |
| 3 | Plugin defaults | api level / hvigor version / 兼容版本(内置 ok,详情展示配置值) |
| 4 | `hdc` 命令 | "Install HarmonyOS command-line-tools or add to PATH" |
| 5 | `hvigorw` / `hvigor` | "DevEco Studio 自带;或安装 command-line-tools" |
| 6 | `node` (≥18) | "hvigorw 依赖 node,需在 PATH" |
| 7 | Java/JDK (≥17) | "部分 hvigor 任务需要 JAVA_HOME" |
| 8 | hdc 已连接设备 | 可选(无设备不阻塞;`hasReadyTarget=false`) |
| 9 | DevEco Studio 安装 | 可选(仅用于模拟器) |
| 10 | 下载缓存目录可写 | `${ZCODE_PLUGIN_DATA}` 可写性检查 |
| 11 | ohpm (包管理器) | 可选,创建工程用 |
| 12 | 工程根可识别 | 可选,有 `build-profile.json5` 才算 |
| 13 | 系统镜像/模拟器就绪 | 可选,与 `hasReadyTarget` 联动 |

**规则:**
- 检查 8/9/11/12/13 为可选,失败不阻断 `ok`
- `hasReadyTarget=true` 时,模拟器相关可选检查豁免
- 缺失依赖返回 `fix` 文本,由 SKILL 引导走 `INSTALL_ENVIRONMENT.md`
- 敏感操作(许可证、密码、删数据)**必须停下问用户**

**依赖:** `sdk.ts`、`device.ts`、`project.ts`

### 3.7 `providers/project.ts` —— 工程发现与创建

**发现 `harmony_discover_project`:**
- 从 cwd 向上找 `build-profile.json5` → 工程根
- 解析 `build-profile.json5`(JSON5)、各 `*/build-profile.json5`、`*/src/main/module.json5`
- 提取:`moduleName`、`bundleName`、`abilityName`、产物 `.hap` 路径、签名配置状态、hvigorw 位置
- 返回 `warnings`:缺 `oh-package.json5`、签名未配置、hvigorw 缺失等

**创建 `harmony_create_app`:**
- 输入:`{ name?, bundleName?, targetDir?, overwrite? }`
- 从 `templates/stage-app/` 复制最小 ArkTS 工程 → 替换变量(`{{BUNDLE_NAME}}`、`{{MODULE_NAME}}`)
- **默认拒绝覆盖已存在文件**,`overwrite:true` 需用户显式确认
- 生成最小内容:
  - `AppScope/app.json5`(bundleName/versionCode/versionName/icon/label)
  - `AppScope/resources/base/media/`(占位图标)
  - `entry/build-profile.json5` + `entry/src/main/module.json5`(entry 类型、mainAbility)
  - `entry/src/main/ets/pages/Index.ets`(ArkUI 最小页面:`@Entry @Component` + `Text('Hello HarmonyOS')`)
  - `entry/src/main/resources/base/profile/main_pages.json`(`src` 指向 pages)
  - `oh-package.json5` + `hvigorfile.ts` + `hvigorw`/`hvigorw.bat` + `hvigor/hvigor-config.json5`

### 3.8 `providers/build.ts` —— hvigor 构建编排

**API:**
```ts
build(input: {
  module?: string;         // 默认 "entry"
  mode?: "debug"|"release"; // 默认 debug
  product?: string;        // 默认 default
  target?: string;         // 默认 assembleHap
  root?: string;
  clean?: boolean;
  timeout?: number;        // 默认 600000ms (10分钟)
}): Promise<ToolResult>
```

**命令拼装:**
- Windows: `hvigorw.bat --mode module -p product=<product> -p module=<module>@<target> --no-daemon assembleHap --debug`
- macOS: `./hvigorw ...`(`--release` 时替换)
- 解析输出定位 `*.hap` 产物路径

**返回:** `{ ok, output, hapPath, durationMs, warnings[] }`

**故障兜底:** 签名缺失 → 提示 debug 自动签名或 DevEco 配置;hvigorw 不可执行(macOS)→ `chmod +x`;node 版本低 → INSTALL_ENVIRONMENT。

### 3.9 `providers/device.ts` —— hdc 设备与模拟器复用

**API:**
```ts
listDevices(): Promise<Device[]>
// Device = { serial; state: "device"|"offline"|"unauthorized"; type: "emulator"|"usb"; model?; osVersion? }
waitForDevice(input: { serial?, timeout?: 30000 }): Promise<ToolResult>
```

**工具:** `harmony_list_devices` / `harmony_wait_for_device`

**规则:**
- 不调 `hdc tmode` / 不改 USB 模式 / 不 reset 设备
- 模拟器发现依赖 hdc 已连上(DevEco 启动的模拟器自动注册),**不主动启动 DevEco 模拟器进程**
- `serial` 前缀 `127.0.0.1:*` 判为模拟器

### 3.10 `providers/app.ts` —— 应用生命周期

| 工具 | hdc 命令 | 输入 |
|---|---|---|
| `harmony_install_app` | `hdc -t <serial> install <hap>` | `{ serial, hapPath, reinstall? }` |
| `harmony_uninstall_app` | `hdc -t <serial> uninstall <bundle>` | `{ serial, bundleName }` |
| `harmony_launch_app` | `hdc -t <serial> shell aa start -a <ability> -b <bundle>` | `{ serial, bundleName, abilityName? }` |
| `harmony_terminate_app` | `hdc -t <serial> shell aa force-stop <bundle>` | `{ serial, bundleName }` |
| `harmony_open_url` | `hdc -t <serial> shell aa start -d <uri> -a ohos.want.action.viewData` | `{ serial, uri }` |

**`harmony_launch_app` 兜底:** 未传 `abilityName` 时从 `project.ts` 的 `module.json5` 读取 `mainElement`。

**`harmony_build_and_run` 编排工具:** `build()` → 选设备(serial 复用,否则取首个,无设备 fail)→ `install()` → `launch()`。每步失败即返回,`output` 说明停在哪一步。返回 `{ ok, hapPath, serial, bundleName, abilityName, output }`。

### 3.11 `providers/logs.ts` —— hilog 日志

**`harmony_logs`:**
```ts
input: {
  serial: string;
  filter?: string;
  domain?: string;
  level?: "D"|"I"|"W"|"E"|"F";
  lines?: number;      // 默认 500
  clear?: boolean;
  timeout?: number;    // 默认 8000
}
```
命令:`hdc -t <serial> shell hilog -x`(快照)或带 tag/timeout。返回 `{ ok, output, totalLines, filteredLines }`。

### 3.12 `providers/screenshot.ts` —— 截图

**`harmony_screenshot`:**
```ts
input: { serial: string; outDir?: string }  // outDir 默认 ${HARMONYOS_PLUGIN_DATA}/screenshots
output: { ok, output, path }  // 模型可用 Read 工具打开 path
```
命令:`snapshot_display` → `file recv` → `rm` 设备临时文件。文件名带时间戳防覆盖:`screenshot_<serial>_<timestamp>.jpeg`。

### 3.13 `providers/ui.ts` —— UiTest UI 自动化

P0 采用轻量方案,基于 `hdc shell uitest dumpLayout`。

| 工具 | 实现 |
|---|---|
| `harmony_ui_status` | `hdc shell uitest dumpLayout`,导出 UI 树到设备文件,pull 回本地解析 |
| `harmony_ui_describe` | 解析 dumpLayout 产物,返回可见组件列表(type/text/bounds) |
| `harmony_ui_resolve` | 输入组件文本/desc,返回其中心坐标 |
| `harmony_ui_tap` | `hdc shell uitest input tapEvent <x> <y>` |
| `harmony_ui_type_text` | `hdc shell uitest input inputText <text>` |
| `harmony_ui_back` | `hdc shell uitest input keyEvent Back` |

**UiNode 结构:**
```ts
interface UiNode {
  type: string;       // Text/Button/Image...
  text?: string;
  id?: string;
  bounds: { left; top; right; bottom };
  enabled: boolean;
  visible: boolean;
}
```

**降级策略:** `uitest` 命令不存在时,`harmony_ui_status` 返回 `{ok:true, available:false}`,SKILL 指示回退截图+日志。P0 不提供 swipe/keyevent 全集(留 P1)。

### 3.14 `providers/scaffold.ts` —— ArkTS 代码脚手架

基于内置 TS 模板字符串(可参数化)动态生成。

| 工具 | 生成内容 | 输入 |
|---|---|---|
| `harmony_create_page` | `@Entry @Component` ArkUI 页面 + 注册到 `main_pages.json` | `{ name, title?, dir? }` |
| `harmony_create_component` | `@Component custom` 可复用组件 | `{ name, props?, dir? }` |
| `harmony_create_ability` | UIAbility / UIExtensionAbility + 注册到 `module.json5` | `{ name, type, moduleName? }` |
| `harmony_create_module` | 新增 Feature/HSP 模块 + 注册到 `build-profile.json5` | `{ name, type, template }` |

**规则:**
- 默认目标目录:页面/组件 → `<module>/src/main/ets/{pages,components}/`;Ability → `<module>/src/main/ets/<ability>/`
- 文件已存在 → 默认拒绝,`overwrite:true` 需确认
- **注册联动:** 生成页面追加 `main_pages.json` 的 `src` 数组;生成 Ability 更新 `module.json5` 的 `abilities`/`extensionAbilities`(JSON5 解析后写回,保留注释)
- 模板内置最佳实践:`@State`/`@Prop`/`@Link` 示例、`build()` 结构、`aboutToAppear()` 占位

### 3.15 `providers/updates.ts` —— 在线版本检查(知识库实时性)

**职责:** 查询 HarmonyOS 官方源的最新版本信息,与本地配置(userConfig + 当前 SDK)对比,提示哪些可升级。**只读、只提示,绝不自动修改用户环境或工程**。这是保证插件知识库「实时最新」的核心机制 —— 因为 HarmonyOS NEXT 迭代快,写死的默认版本/命令会过时,此工具让模型和用户随时得知最新状态。

**检查项(5 类):**

| # | 检查项 | 数据源(优先用稳定 JSON/TXT 接口,回退 HTML 抓取) | 本地对比值 |
|---|---|---|---|
| 1 | 最新 HarmonyOS API level / SDK 版本 | 华为开发者官方 SDK 发布页 | `api_level` userConfig + 设备实际 OS 版本 |
| 2 | 最新 hvigor 版本 | ohpm/hvigor 官方仓库或发布说明 | `hvigor_version` userConfig + 工程内 `hvigor/hvigor-config.json5` 实际版本 |
| 3 | 最新 ohpm 版本 | ohpm 官方仓库 | `ohpm -v` 实际输出 |
| 4 | 最新 DevEco Studio 版本 | DevEco 官方下载页 | 本地 DevEco 安装版本(若能探测) |
| 5 | 官方文档/troubleshooting 关键 URL 清单 | 官方文档站 | 无对比,直接返回有效链接供模型按需查 |

**`harmony_check_updates` 工具:**
```ts
input: {
  check?: Array<"api_level"|"hvigor"|"ohpm"|"deveco"|"docs">; // 默认全部
  timeout?: number;   // 默认 15000(单次 HTTP);总体上限 30000
  offline?: boolean;  // true 时跳过网络,只返回本地当前配置(供离线诊断)
}
output: {
  ok: boolean;
  output: string;     // 摘要:哪些有新版本、建议动作
  updates: Array<{
    name: string;         // "api_level" / "hvigor" ...
    latest?: string;      // 官方最新版本;网络失败时为 undefined
    current: string;      // 本地当前值
    outdated: boolean;    // latest > current(语义化版本比较,失败回退字符串比较)
    source: string;       // 数据来源 URL
    note?: string;        // 升级注意事项(如"需同时升级 hvigorw wrapper")
  }>;
  docs: Array<{ title; url }>;   // 关键官方文档链接
  fetchedAt: string;     // ISO 时间戳
}
```

**关键行为与边界:**
- **网络容错:** 任一检查项 HTTP 失败/超时,该项 `latest=undefined`、`outdated=false`、`note="fetch failed: <reason>"`,**不阻断其他项**,整体 `ok` 仍为 true(版本检查不是硬性工作流步骤)
- **离线降级:** 完全无网络时返回所有项 `latest=undefined` + `output:"offline, showing local config only"`,SKILL 指示继续工作流,不阻塞构建/运行
- **不修改任何东西:** 只读网络 + 读本地配置;**不写文件、不改 userConfig、不跑安装命令**。升级动作由 SKILL 引导用户/模型走 `INSTALL_ENVIRONMENT.md`(且安装命令需用户确认)
- **版本比较:** 用语义化版本比较(`semver` 风格),失败回退字符串比较;`outdated` 保守判定 —— 无法确定时不报过时
- **数据源可配置:** 数据源 URL 集中在 `updates.ts` 顶部常量表,官方改址时只需改常量;P0 数据源先标注为「实现时校准」(见决策 5)
- **缓存:** 同一进程内缓存一次结果(默认 5 分钟 TTL),避免模型重复调用导致频繁请求;缓存可通过 `force?: boolean` 入参绕过

**`lib/http.ts` 辅助:**
```ts
httpJson(url, { timeout?: 15000, headers? }): Promise<{ ok; status; json?; error? }>
// 轻量封装 Node fetch(globalThis.fetch,Node 18+ 内置),超时 AbortController,UA 标识 ZCode HarmonyOS plugin
```

**依赖:** `lib/http.ts`、`sdk.ts`(本地版本探测)、`config`(读 userConfig 经 env 注入的 `HARMONYOS_PLUGIN_*`)

**何时调用(SKILL 工作流位置):**
- **非阻塞、可插拔** —— 放在 preflight 之后、discover 之前作为「可选建议步骤」;模型也可在用户问"环境是不是最新的"时单独调用
- 检查到过时项时,SKILL 指示:告知用户具体差异 + 建议动作,**不自动升级**;若用户同意升级,走 INSTALL_ENVIRONMENT.md 且安装命令需用户确认

### 3.16 P0 工具总清单(共 23 个)

| 类别 | 工具 |
|---|---|
| 环境(1) | `harmony_preflight` |
| **版本检查(1)** | **`harmony_check_updates`** |
| 工程(2) | `harmony_discover_project`、`harmony_create_app` |
| 构建(2) | `harmony_build_app`、`harmony_build_and_run` |
| 设备(2) | `harmony_list_devices`、`harmony_wait_for_device` |
| 应用(5) | `harmony_install_app`、`harmony_uninstall_app`、`harmony_launch_app`、`harmony_terminate_app`、`harmony_open_url` |
| 日志(1) | `harmony_logs` |
| 截图(1) | `harmony_screenshot` |
| UI 自动化(6) | `harmony_ui_status`、`harmony_ui_describe`、`harmony_ui_resolve`、`harmony_ui_tap`、`harmony_ui_type_text`、`harmony_ui_back` |
| 脚手架(4) | `harmony_create_page`、`harmony_create_component`、`harmony_create_ability`、`harmony_create_module` |

### 3.17 Provider 依赖关系

```
                 lib/run.ts (地基)        lib/http.ts (网络)
                    │                          │
        ┌───────────┼───────────┐              │
        │           │           │              │
    lib/path.ts  lib/result.ts  lib/schema.ts  │
        │                                        │
    sdk.ts ──────────────────────────────┬──────┘
        │                                 │  │
    preflight.ts ◄── device.ts           │  │
        │                                 │  │
    project.ts ───┬──► build.ts          │  │
        │         │      │                │  │
        │         │   app.ts ◄── device.ts│  │
        │         │      │                │  │
        │         │   logs.ts ────────────┤  │
        │         │   screenshot.ts ──────┤  │
        │         │   ui.ts ──────────────┘  │
        │         │                          │
        │         └──► scaffold.ts           │
        │                                    │
        └──────────────────────────────► updates.ts ◄── http.ts
                                         (读 sdk/config 本地版本 + 查官方源)
    (server.ts 注册所有工具,串联工作流)
```

## 4. MCP Server 与周边文件

### 4.1 `src/mcp/server.ts`

- 导入 23 个工具的 `{name, description, schema, handler}` 注册表
- `ListTools`:返回 name + description + inputSchema(zod → JSON Schema)
- `CallTool`:按 name 路由,handler 包 `asyncWrap` 捕获异常转 `{ok:false, output:"<tool> failed: <msg>"}`,**server 不崩**
- `server.connect(new StdioServerTransport())`
- 工具命名规范:`harmony_<动词>_<名词>`;description 说明「何时用、做什么、关键约束」

### 4.2 `skills/harmonyos-dev/SKILL.md` 工作流(7 步)

```
1. harmony_preflight  ── 失败 ──► INSTALL_ENVIRONMENT.md(固定步骤)
        │  ok                        敏感操作(许可证/密码/删数据)停下问用户
        ▼                            重跑 preflight,从最新结果继续
2. harmony_check_updates (可选,非阻塞)
        │ 查官方最新 SDK/hvigor/ohpm/DevEco 版本 + 文档链接
        │ 有过时项 ► 告知用户差异 + 建议动作,不自动升级;
        │           用户同意升级才走 INSTALL_ENVIRONMENT.md(安装命令需用户确认)
        │ 网络失败/离线 ► 跳过,继续工作流,不阻塞
        ▼
3. harmony_discover_project
        │ 无工程且用户要新建 ► harmony_create_app(默认拒覆盖)
        │ 读 warnings 修缺失项
        ▼
4. harmony_build_and_run  ── 编译错误先读 output
        │ serial 复用指定设备;无 serial 取首个;无设备 fail
        ▼
5. harmony_screenshot ── 可视化验证
        ▼
6. 运行时检查:harmony_open_url / launch / terminate / logs
        ▼
7. UI 自动化:先 harmony_ui_status
        ├─ 优先 describe / resolve 再 tap 坐标
        ├─ tap/type/back 用 uitest 后端
        └─ available:false 时回退截图+日志
```

**Tool Notes 关键约束:** preflight 纯诊断;check_updates 只读提示、不自动升级、离线降级不阻塞;工具接受 `serial`;不自动启动 DevEco 模拟器;create_app 默认拒覆盖;debug 走自动签名;UI 自动化走 `uitest dumpLayout`;保持用 MCP 工具而非裸 hdc/hvigorw。

**HarmonyOS 工程必备文件清单(P0):** `build-profile.json5`(工程级)、`entry/build-profile.json5`(模块级)、`entry/src/main/module.json5`(Stage 模型)、`oh-package.json5`、`hvigorw`/`hvigorw.bat` + `hvigor/hvigor-config.json5`、`AppScope/app.json5` + `AppScope/resources/base/media/`。

**Build Troubleshooting:** 签名缺失 → DevEco 配置 / debug 自动签名;hvigorw 不可执行(macOS)→ `chmod +x`;node 低版本 → INSTALL_ENVIRONMENT;SDK 路径错 → 配置 `HOS_SDK_HOME`;`ohpm install` 失败 → 检查 `oh-package.json5`/网络/仓库源。

### 4.3 `skills/harmonyos-dev/INSTALL_ENVIRONMENT.md`

**Guardrails:** 安装命令用显式长超时(10-30 分钟);不在后台跑 ohpm/SDK/PowerShell 安装器;不把长输出只 `tail` 截断;要求密码/管理员/许可证时停下问用户;每阶段后重跑 preflight。

**可配置默认值:** `HARMONYOS_PLUGIN_API_LEVEL=12`、`HARMONYOS_PLUGIN_HVIGOR_VERSION=4.0.2`、`HARMONYOS_PLUGIN_COMPATIBLE_SDK=5.0.0`、`HARMONYOS_PLUGIN_DEV_MANAGE=true`。

**Quick Fix:** hvigorw / node not found(单独小节,不重装 SDK)。

**macOS 段:** DevEco Studio 下载安装 / ohpm / node / hdc PATH / JAVA_HOME。

**Windows PowerShell 段:** DevEco Studio(winget 或官网)/ node / hdc PATH(`setx`)/ JAVA_HOME / 模拟器加速(WHPX 提示)。

### 4.4 `commands/harmonyos-dev.md`

```markdown
---
description: 启动 HarmonyOS NEXT 开发循环。
argument-hint: "[目标或问题描述]"
skills: harmonyos-dev
---

Use the `harmonyos-dev` skill for this request:

$ARGUMENTS

Start with `harmony_preflight`. If setup is missing, follow
`skills/harmonyos-dev/INSTALL_ENVIRONMENT.md`, re-run `harmony_preflight`,
then discover or create the HarmonyOS project, build and launch it,
and verify with a screenshot.
```

### 4.5 `plugin.json` userConfig(8 项)

| 配置项 | 默认值 | 对应 env 变量 | 说明 |
|---|---|---|---|
| `sdk_path` | `""` | `HARMONYOS_PLUGIN_SDK_PATH` | 可选 HarmonyOS SDK 根目录,空时回退到 HOS_SDK_HOME/HDC_HOME/系统默认 |
| `api_level` | `12` | `HARMONYOS_PLUGIN_API_LEVEL` | HarmonyOS NEXT API 等级 |
| `hvigor_version` | `4.0.2` | `HARMONYOS_PLUGIN_HVIGOR_VERSION` | hvigor 构建系统版本 |
| `compatible_sdk` | `5.0.0` | `HARMONYOS_PLUGIN_COMPATIBLE_SDK` | compatibleSdkVersion,生成工程时使用 |
| `dev_manage` | `true` | `HARMONYOS_PLUGIN_DEV_MANAGE` | 是否启用 hvigor dev 管理模式 |
| `hdc_path` | `""` | `HARMONYOS_PLUGIN_HDC_PATH` | 可选 hdc 可执行文件路径覆盖 |
| `node_major` | `18` | `HARMONYOS_PLUGIN_NODE_MAJOR` | hvigorw 依赖的 node 主版本 |
| `jdk_major` | `17` | `HARMONYOS_PLUGIN_JDK_MAJOR` | 部分 hvigor 任务需要的 JDK 主版本 |

**env 注入共 9 个变量:** 上述 8 项 userConfig 映射的 `HARMONYOS_PLUGIN_*`,加上 ZCode 固定注入的 `HARMONYOS_PLUGIN_DATA`=${ZCODE_PLUGIN_DATA}(插件数据目录)。

### 4.6 `.zcode-plugin-seed.json`

```json
{ "hash": "<构建时计算>", "marketplace": "<marketplace 名>", "plugin": "harmonyos-dev", "pluginVersion": "0.1.0", "source": "filesystem", "version": 1 }
```

### 4.7 `.mcp.json`(开发期)

`command: "node"`,`args: ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"]`,env 同 plugin.json(用 `CLAUDE_*` 占位符)。

### 4.8 `package.json`

`name: @zcode/harmonyos-dev-plugin`,`type: module`,`bin.harmonyos-dev-mcp: ./dist/mcp/server.js`。scripts: `build`(tsc + esbuild)、`typecheck`、`test`(vitest)。deps: `@modelcontextprotocol/sdk ^1.27.1`、`zod ^4.4.3`、`json5 ^2.2`(JSON5 解析,见决策 4)。devDeps: `@types/node ^24`、`esbuild ^0.25`、`typescript ^5.9`、`vitest ^4.1.5`。

## 5. 数据流与错误处理

### 5.1 三条主线数据流

**主线 A(首次开发流):** preflight → check_updates(可选非阻塞,告知版本差异不自动升级)→ discover(无工程则 create_app)→ build_and_run → screenshot + logs。数据载体:preflight 的 `hasReadyTarget`、check_updates 的 `updates[]`(供模型向用户报告)、discover 的 `bundleName/abilityName/hapPath`、build_and_run 的 `serial`,由模型显式传递,工具无状态。

**主线 B(UI 自动化验证流):** ui_status → (available:false 降级到截图+日志) / (available:true) → ui_describe/ui_resolve → ui_tap/type_text/back → screenshot 确认。

**主线 C(代码生成流):** discover → create_page/create_component/... → build_and_run 编译验证。

### 5.2 状态传递约定

工具间**不共享内存态**。`harmonyRoot()` 每次重新解析(不缓存,避免跨工程切换脏读);设备 `serial` 由模型显式当参数传递。

### 5.3 错误处理四层

1. **lib/run.ts 进程级:** 命令不存在/超时 kill/非零退出 → `RunResult`
2. **provider 业务级:** 返回 `ToolResult` 带语义化错误;`available:false` 等"软失败"用 `ok:true` + 标志位,不阻断工作流
3. **server.ts 兜底:** handler 异常 → `asyncWrap` → `{ok:false}`,server 不崩
4. **SKILL 引导:** preflight 失败 → INSTALL_ENVIRONMENT.md;敏感操作停下问用户

### 5.4 错误信息规范

`output` 字段:第一行结论(ok/failed + 一句话原因)→ 后续细节(命令/退出码/日志摘录,brief ≤2000 字符)→ `nextStep`(失败时的自然语言下一步建议)。

### 5.5 幂等性与副作用边界

| 类别 | 幂等? | 边界 |
|---|---|---|
| 只读类(preflight/discover/list_devices/screenshot/logs/ui_*) | ✅ | 仅写 pluginDataDir 截图/临时文件 |
| check_updates | ✅(5 分钟内缓存) | 纯网络只读;**绝不写文件、不改 userConfig、不跑安装命令**;`force` 绕过缓存 |
| create 类(create_app/page/...) | ❌ | 默认拒覆盖;overwrite 需确认;只写工程内目标路径 |
| build | ❌(产出) | 只写工程 `build/` 目录 |
| install/uninstall | install 幂等(reinstall 标志)/ uninstall 幂等 | 操作指定 serial 设备 |
| launch/terminate/open_url | ✅ | 操作指定设备运行态 |

**硬约束:** 不删除用户工程文件;不 `hdc tmode` 改 USB 模式 / 不 reset 设备 / 不清用户数据;不自动接受许可证、不输入密码。

## 6. 测试策略

采用 vitest,三层:

**第 1 层 lib 单元测试(纯函数):** `run.test.ts`(mock child_process,验证超时 kill/退出码/Windows+macOS 命令拼装)、`result.test.ts`、`path.test.ts`(harmonyRoot 向上查找、pluginDataDir)、`http.test.ts`(mock globalThis.fetch,验证超时 AbortController、非 2xx 状态、JSON 解析失败、UA 头注入)。

**第 2 层 provider 测试(mock run + fixture):**
- `preflight.test.ts`:mock sdkRoot/listDevices,验证 13 项检查组合 → ok 判定 + hasReadyTarget
- `project.test.ts`:`test/fixtures/sample-stage-app/` 测 discover;临时目录测 create 拒覆盖/变量替换/结构校验
- `build.test.ts`:mock run 返回固定 hvigorw 输出,验证 hap 路径解析、mode/product 参数拼装
- `device.test.ts`:mock `hdc list targets` 各类输出(空/多设备/offline/unauthorized)
- `ui.test.ts`:fixture `dumpLayout.xml` 验证 UiNode 解析、resolve 坐标计算
- `scaffold.test.ts`:临时工程 fixture,验证 create_page 的 main_pages.json 联动、create_ability 的 module.json5 更新(JSON5 注释保留)
- `updates.test.ts`:mock `httpJson`(lib/http.ts)返回固定官方版本,验证 5 类检查项的 `outdated` 语义化版本比较、网络失败单项降级(`latest=undefined` 不阻断)、离线模式、5 分钟缓存命中与 `force` 绕过;版本比较边界(5.0.0 vs 5.0.1、12 vs 13、无法比较时保守判定)

**第 3 层 server 集成测试:** 启动真实 stdio server 子进程,MCP 客户端发 `tools/list` 验证 23 个工具名 + schema;发 `tools/call` 对 preflight(只读安全)验证返回结构;注入会 throw 的 handler 验证 asyncWrap 返回 `{ok:false}` 且 server 存活。

**不测:** 真实 hdc/hvigorw 端到端(依赖真机/模拟器,CI 不稳定);INSTALL_ENVIRONMENT.md 的安装命令(会改系统)。

## 7. P0 范围与非目标

### 7.1 P0 包含

- 23 个 MCP 工具(见 3.16),含在线版本检查工具 `harmony_check_updates`
- 完整 SKILL 工作流(7 步,含可选 check_updates)+ INSTALL_ENVIRONMENT.md
- `/harmonyos-dev` 斜杠命令
- 8 项 userConfig
- TypeScript + esbuild 构建,vitest 三层测试
- Windows + macOS 支持

### 7.2 P0 不包含(留后续版本)

- 自动创建/启动 DevEco 模拟器(P0 仅发现复用)
- **自动升级环境/SDK**(check_updates 只检查并提示,不自动安装;升级由用户确认后走 INSTALL_ENVIRONMENT.md)
- UI 自动化 swipe / 完整 keyevent 全集
- 多产物/多 product 复杂签名编排
- 自动生成签名证书(走 DevEco 配置 / debug 自动签名)
- Linux 平台支持
- 真机/模拟器端到端自动化测试(留手动验收)
- `harmony_create_service` 后台服务脚手架(P0 仅 page/component/ability/module)

## 8. 验收清单(手动)

- [ ] `pnpm build` 产出 `dist/mcp/server.js` 无类型错误
- [ ] `pnpm test` 三层测试全绿
- [ ] `node dist/mcp/server.js` 启动 stdio server,响应 `tools/list` 返回 23 个工具
- [ ] 在空目录创建工程:`harmony_create_app` → 生成最小 Stage 工程结构完整
- [ ] 在有真机的环境:`harmony_preflight` → `harmony_build_and_run` → App 在设备启动
- [ ] `harmony_screenshot` 产出可被 Read 工具打开的 jpeg
- [ ] `harmony_create_page` 生成页面并联动 `main_pages.json`
- [ ] 模拟 `uitest` 缺失时 `harmony_ui_status` 返回 `available:false` 不报错
- [ ] `harmony_check_updates` 联网返回各项 `latest` + `outdated` 标志;断网时返回 `latest=undefined` 且 `ok:true` 不阻塞

## 9. 实现决策(已定)

1. **模板变量占位符语法:** 统一使用 `{{BUNDLE_NAME}}` / `{{MODULE_NAME}}` 风格(双花括号)。理由:`${...}` 会与 ArkTS 模板字符串和 JSON5 求值冲突,而 `{{...}}` 在 HarmonyOS 工程文件中无语义冲突,且替换逻辑简单(全局字符串替换)。
2. **JSON5 写回注释保留:** 采用成熟库 `json5`(parse)+ 自写格式化回写。`json5` 解析会丢失注释,因此对 `module.json5`/`build-profile.json5` 的写回采用「读原文 → 正则定位目标数组段 → 字符串拼接插入新项 → 保留其余原文」的最小侵入方案,而非整体重新序列化。这样保留注释和格式。
3. **hvigorw hap 产物路径:** 以 fixture 样本 `test/fixtures/hvigor-output.txt` 为准对齐解析正则。若实际版本路径不同,build.ts 的解析正则需在实现时用真实输出校准;spec 不锁定具体正则。
4. **JSON5 解析依赖:** discover/project 读取解析用 `json5` 库(parse 容错),加入 `package.json` dependencies。
5. **check_updates 数据源校准:** HarmonyOS 官方版本发布页/下载页 URL 可能随官方站点改版而变动,spec 不锁定具体 URL。`updates.ts` 顶部用常量表 `UPDATE_SOURCES` 集中管理每类检查项的数据源 + 解析方式(优先稳定 JSON/TXT 接口,回退 HTML 正则抓取)。实现时需联网校准有效数据源,并在源失效时返回 `note:"source unavailable"` 而非崩溃。版本号解析失败时 `outdated` 保守判为 `false`(宁可不报过时,不误报)。
