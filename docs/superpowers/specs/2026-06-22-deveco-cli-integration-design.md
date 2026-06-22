# deveco-cli 集成设计（ZCode 引导层）

- 日期：2026-06-22
- 分支：feature/harmonyos-dev-plugin
- 状态：待评审

## 1. 背景与目标

### 1.1 现状

`harmonyos-dev/` 目录当前是一个**自研** HarmonyOS MCP 插件：

- TypeScript 工程（`src/lib`、`src/providers`、`src/mcp/server.ts`）+ 自定义 MCP server。
- 25 个自研工具（`harmony_preflight`、`harmony_build_and_run`、`harmony_ui_*` 等）直接调用裸 `hdc`/`hvigorw`/`ohpm`。
- 自带 `skills/harmonyos-dev/SKILL.md` + `INSTALL_ENVIRONMENT.md` + `commands/harmonyos-dev.md`。
- 痛点：维护成本高；工具链探测、PATH/SDK 手配逻辑全部自实现；缺少模拟器生命周期管理、本地文档检索、ArkTS/C++ 语法检查。

### 1.2 官方 deveco-cli

华为 HDC 2026 发布的官方 CLI（npm 包 `@deveco/deveco-cli`，仓库 `openharmony-sig/deveco-cli`）：

- 把 DevEco Studio 工具链（ohpm/hvigor/hdc/emulator/hilog）统一封装为 `devecocli` 命令，**自动探测 DevEco Studio**，无需手配 `PATH`/`DEVECO_SDK_HOME`/`JAVA_HOME`。
- 内置模拟器生命周期（create/start/stop/delete、镜像下载/删除、license）、本地文档检索（docs search/read/catalog）、语法检查 MCP（`serve mcp`，ArkTS/C++）。
- 提供 AI Agent 集成：`devecocli init --skill/--mcp` 把官方 skill 和 MCP 配置注入 agent。

### 1.3 决策

**完全替换自研插件，采用官方 skill + MCP，纯手动注册到 ZCode。**

- ZCode 不在 `devecocli init --agent` 的已知列表（opencode/cursor/trae-cn）中 → 用 `--path` 把官方 skill 文件落到 `~/.zcode/skills/deveco-cli/`。
- MCP server（`devecocli serve mcp`）手动注册进 `~/.zcode/cli/config.json` 的 `mcpServers` 段。
- 仓库 `harmonyos-dev/` 改造为**纯引导层**：安装脚本 + INSTALL 文档 + config 样例，**不构建任何 JS**，所有运行时能力由 `devecocli` 二进制提供。

### 1.4 非目标

- 不维护任何 HarmonyOS 工具链封装代码。
- 不提供除 `devecocli` 之外的 MCP server。
- 不在脚本里后台静默安装 devecocli（由用户手动 npm 安装）。
- 不自动接受 HarmonyOS 模拟器许可协议（需用户本地交互终端执行 `devecocli emulator license accept`）。

## 2. 整体架构

### 2.1 改造后仓库结构

```
ZCodeProject/
└── harmonyos-dev/                         # 目录保留，内容重塑为引导层
    ├── README.md                          # 改写：说明是 devecocli 官方能力接入 ZCode 的引导层
    ├── INSTALL.md                         # 新增：完整安装步骤（中文，面向 ZCode 用户）
    ├── scripts/
    │   ├── install-deveco-cli.ps1         # 新增：Windows 引导脚本
    │   └── install-deveco-cli.sh          # 新增：macOS 引导脚本
    ├── config-samples/
    │   └── zcode-mcp-snippet.json         # 新增：config.json 要合并的 MCP 片段（带占位）
    └── test/
        └── install.test.mjs               # 新增：脚本 dry-run 输出的自动化测试
```

### 2.2 删除清单

`harmonyos-dev/` 下以下文件/目录**全部删除**：

- `src/`（含 `lib/`、`providers/`、`mcp/server.ts`）
- `dist/`
- `test/` 现有内容（`lib/`、`providers/`、`server.test.ts`、`fixtures/`）
- `templates/`
- `skills/harmonyos-dev/`（`SKILL.md` + `INSTALL_ENVIRONMENT.md`）
- `commands/harmonyos-dev.md`
- `.mcp.json`
- `.zcode-plugin/plugin.json`
- `.zcode-plugin-seed.json`
- `esbuild.config.mjs`
- `tsconfig.json`
- `package.json` + `package-lock.json`
- `.gitignore`（若无保留必要；若需忽略 `node_modules` 等可留）

旧 spec/plan（`docs/superpowers/specs/2026-06-21-*`、`docs/superpowers/plans/2026-06-21-*`）作为**历史**保留，不修改——它们记录的是被取代的自研方案。

### 2.3 运行时形态

集成后，ZCode 用户机器上的关键资产（脚本负责创建/注册）：

| 位置 | 内容 | 由谁创建 |
|---|---|---|
| `~/.zcode/skills/deveco-cli/` | 官方 `deveco-cli` skill（`SKILL.md` + 资源） | 脚本调 `devecocli init --skill --path` |
| `~/.zcode/cli/config.json` 的 `mcpServers.deveco-cli` | `devecocli serve mcp` stdio server 配置 | 脚本合并 config 样例 |
| 全局 PATH | `devecocli` 二进制 | 用户手动 `npm install -g` |

模型侧：ZCode 加载官方 skill（提供工作流知识），通过 `mcp__deveco_cli__*` 调用语法检查等 MCP 能力，或直接建议用户/脚本运行 `devecocli <command>`。

## 3. 组件设计

### 3.1 `scripts/install-deveco-cli.ps1`（Windows）/ `.sh`（macOS）

**单一职责**：环境检测 + 官方 skill 落地 + ZCode config 合并。

**调用形态**：
```powershell
.\install-deveco-cli.ps1 [-DryRun] [-Force] [-ZCodeConfig <path>] [-SkillsDir <path>]
```
```bash
./install-deveco-cli.sh [--dry-run] [--force] [--zcode-config <path>] [--skills-dir <path>]
```

**参数**：
| 参数 | 说明 | 默认 |
|---|---|---|
| `-DryRun`/`--dry-run` | 只打印将要执行的命令，不写盘 | 关 |
| `-Force`/`--force` | config.json 已有 `deveco-cli` 段时整体覆盖 | 关（默认跳过并提示） |
| `-ZCodeConfig`/`--zcode-config` | ZCode config.json 路径 | `~/.zcode/cli/config.json` |
| `-SkillsDir`/`--skills-dir` | ZCode skills 根目录 | `~/.zcode/skills` |

**路径解析优先级**（config.json 与 skills 目录的最终取值）：
1. 环境变量 `ZCODE_CONFIG_OVERRIDE` / `ZCODE_SKILLS_DIR_OVERRIDE`（最高，供测试与高级用户覆写）。
2. 命令行参数 `-ZCodeConfig` / `-SkillsDir`。
3. 默认值 `~/.zcode/cli/config.json` / `~/.zcode/skills`。

环境变量与命令行参数同时存在时，**环境变量胜出**——这样测试可以零侵入注入临时路径，不污染真实 `~/.zcode`。

**内部纯函数（两侧一一对应）**：

1. **`Test-DevecoCli` / `has_deveco_cli`**
   跑 `devecocli --version`，成功返回版本字符串，失败返回空。
2. **`Resolve-DevecoPath` / `resolve_deveco_path`**
   - Windows：注册表 `HKLM\SOFTWARE\HUAWEI\DevEco Studio` → `C:\Program Files\Huawei\DevEco Studio`
   - macOS：`/Applications/DevEco Studio.app` → `~/Applications/DevEco Studio.app`
   找不到返回空字符串（非致命，填进 `DEVECO_PATH` 占位，提示用户手填）。
3. **`Resolve-ZCodeSkillsDir` / `resolve_zcode_skills_dir`**
   解析 `~/.zcode/skills`，缺失则创建（DryRun 模式只打印 `mkdir`）。
4. **`Install-Skill` / `install_skill`**
   调 `devecocli init --skill --path <SkillsDir>/deveco-cli`。
   官方 `init` 默认行为即安装 skill（`--skill` 显式化），`--path` 绕开 ZCode 不在已知 agent 列表的问题。
5. **`Merge-McpConfig` / `merge_mcp_config`**
   读 `~/.zcode/cli/config.json`：
   - 文件不存在 → 初始化为 `{"mcpServers": {}}`（DryRun 打印将创建）。
   - 解析 JSON（解析失败 → 报错退出，**不覆盖**用户文件）。
   - 检查 `mcpServers.deveco-cli`：已存在且无 `-Force` → 打印提示并跳过本步（退出码 0，skill 已装）；有 `-Force` → 整体替换该段。
   - 用 `config-samples/zcode-mcp-snippet.json` 内容填入，`DEVECO_PATH` 填第 2 步探测结果（可空），`PROJECT_PATH` 留空（运行时跟随当前工程）。
   - 写回（保留缩进风格：2 空格）。DryRun 模式打印最终 JSON diff，不写盘。
6. **`Print-Verify` / `print_verify`**
   输出验证清单：
   ```
   ✓ devecocli 版本：<版本>
   ✓ 官方 skill 已写入：~/.zcode/skills/deveco-cli/
   ✓ MCP 配置已合并：~/.zcode/cli/config.json [mcpServers.deveco-cli]
   验证命令：
     devecocli --version
     devecocli device list
     devecocli docs search List
     devecocli emulator list
   下一步：重启 ZCode 使 MCP server 生效。
   ```

### 3.2 `config-samples/zcode-mcp-snippet.json`

官方文档推荐形态（`devecocli init --mcp` 生成的等价结构），变量留占位：

```json
{
  "mcpServers": {
    "deveco-cli": {
      "command": "devecocli",
      "args": ["serve", "mcp"],
      "env": {
        "PROJECT_PATH": "",
        "NODE_MAX_OLD_SPACE_SIZE": "8192",
        "DEVECO_PATH": ""
      }
    }
  }
}
```

说明字段（`PROJECT_PATH` 空 = 跟随 ZCode 当前工程；`DEVECO_PATH` 由脚本探测后回填；`NODE_MAX_OLD_SPACE_SIZE` 默认 8192）写在 INSTALL.md，不污染 JSON。

### 3.3 `INSTALL.md`（中文，面向 ZCode 用户）

章节：
1. **前置要求**：Node.js ≥18（推荐 ≥22）、DevEco Studio ≥6.1.0、Windows 或 macOS。
2. **第一步：安装 devecocli**：`npm install -g @deveco/deveco-cli@latest`；`devecocli --version` 验证。
3. **第二步：运行引导脚本**：
   - Windows：`.\scripts\install-deveco-cli.ps1`
   - macOS：`./scripts/install-deveco-cli.sh`
   - 先 `-DryRun` 预览，确认后正式跑。
4. **第三步：核对 config.json**：打开 `~/.zcode/cli/config.json`，确认 `mcpServers.deveco-cli` 段存在，`DEVECO_PATH` 已填或手填。
5. **第四步：验证**：重启 ZCode；在会话里要求模型跑 `devecocli device list` 或 `devecocli docs search List`。
6. **常用命令速查**：`create`/`build`/`run`/`device list`/`emulator list`/`log`/`docs search` 表（链接官方文档）。
7. **常见问题**：
   - 找不到 devecocli → 重开终端 / 检查 npm 全局 bin 在 PATH。
   - DevEco 找不到 → INSTALL 给出官方下载页；`DEVECO_PATH` 手填示例。
   - 模拟器被许可阻塞 → 用户**本地交互终端**跑 `devecocli emulator license accept`（AI 无法代做）。
   - 安装报 `install sign info inconsistent` → `devecocli run --uninstall`。
   - 多设备 → `--device <名称|序列号>`。

### 3.4 `README.md`（改写）

首段说明本目录是「deveco-cli 官方能力接入 ZCode 的引导层」，列出集成后获得的能力（构建/运行/设备/模拟器/日志/文档检索/语法检查 MCP），指向 INSTALL.md，给出官方仓库与 npm 包链接。明确**不再**提供自研 MCP 工具。

### 3.5 `test/install.test.mjs`

Node 原生 test runner（`node:test`），不引入 vitest（已删 `package.json`）。用 `child_process.spawn` 在受控环境下跑脚本 `--dry-run`，断言 stdout：

- **未装 devecocli**：mock PATH 不含 devecocli → 退出码非 0，stdout 含安装提示。
- **正常 dry-run**：stdout 含 `devecocli init --skill`、`mcpServers.deveco-cli`、验证清单三行。
- **config 已存在且无 force**：预置一个含 `deveco-cli` 段的临时 config → dry-run stdout 提示跳过。
- **config 已存在且带 force**：stdout 提示覆盖。

测试用环境变量 `ZCODE_CONFIG_OVERRIDE` / `ZCODE_SKILLS_DIR_OVERRIDE` 注入临时路径，脚本读取这些变量（优先级高于默认值，便于测试与高级用户覆写）。

## 4. 数据流

```
用户                install-deveco-cli.{ps1|sh}          官方 devecocli 二进制           ZCode 运行时
 │                   │                                       │                              │
 │  运行脚本 ───────▶│                                       │                              │
 │                   │── devecocli --version ────────────────▶│                              │
 │                   │◀────────── 版本 / not found ───────────│                              │
 │                   │── 探测 DevEco Studio 路径 ────────────▶│(仅查注册表/文件系统)          │
 │                   │── devecocli init --skill --path ~/.zcode/skills ─▶│                    │
 │                   │◀──────────── skill 文件写入 ─────────────────────│                     │
 │                   │── 读/合并 ~/.zcode/cli/config.json ──┐ │                              │
 │                   │   (PROJECT_PATH 空, DEVECO_PATH 填)   │ │                              │
 │                   │◀──────────── 写回 ───────────────────┘ │                              │
 │◀── 打印验证清单 ──│                                       │                              │
 │                                                                                          │
 │ (之后) 启动 ZCode ──────────────────────────────────────────────────────────────────────▶│
 │   ZCode 加载 ~/.zcode/skills/deveco-cli/SKILL.md + 启动 devecocli serve mcp (stdio)       │
 │   模型据 skill 建议 devecocli 命令 / 调 mcp__deveco_cli__* 语法检查 ─────────────────────▶│
```

**幂等不变量**：
- skill 文件由 `devecocli init` 自身处理覆盖（重复跑安全）。
- config 合并：无 `deveco-cli` 段则加；已有且无 `-Force` 跳过；`-Force` 整段替换。其他 MCP server 键**永不触碰**。

## 5. 错误处理

| 场景 | 行为 | 退出码 |
|---|---|---|
| `devecocli` 未装 | 打印 `npm install -g @deveco/deveco-cli@latest` 提示后退出 | 1 |
| DevEco Studio 找不到 | 警告（非致命），`DEVECO_PATH` 留空，继续装 skill | 0（含警告） |
| `~/.zcode/skills` 不可写 | 报权限错误，不吞 | 1 |
| `config.json` 不存在 | 初始化为 `{"mcpServers":{}}` 后合并 | 0 |
| `config.json` 解析失败 | 报错**不覆盖**，提示用户手动备份排查 | 1 |
| `config.json` 已有 `deveco-cli` 段（无 `-Force`） | 打印提示，跳过合并，skill 已装则成功 | 0 |
| `devecocli init --skill` 失败 | 透传 stderr 与退出码 | 透传 |
| DryRun 任何步骤 | 只打印，不写盘，退出码 0 | 0 |

所有错误消息走 stderr，验证清单走 stdout，便于测试断言与脚本管道使用。

## 6. 测试策略

`test/install.test.mjs`（Node 原生 `node:test`）通过 `--dry-run` 验证脚本行为，不实际写盘：

1. **未装 devecocli**：注入空 PATH → 退出码非 0，stdout/stderr 含 `npm install -g @deveco/deveco-cli`。
2. **正常 dry-run**：mock `devecocli --version` 成功（用 shim 脚本）→ stdout 含 `devecocli init --skill`、`mcpServers.deveco-cli`、`devecocli device list`（验证清单）。
3. **config 已有段（无 force）**：预置临时 config 含 `deveco-cli` → dry-run stdout 含「跳过」/「skip」字样。
4. **config 已有段（带 force）**：dry-run stdout 含「覆盖」/「overwrite」字样。

跨平台：CI 在 Windows 跑 `.ps1` 测试，macOS/Linux 跑 `.sh` 测试（用 GitHub Actions matrix 或本地双跑）。无 vitest，无 TypeScript 编译步骤。

**shim 机制**：测试在临时目录创建一个名为 `devecocli` 的可执行脚本（Windows 用 `.cmd`/`.bat`，POSIX 用 shell 脚本），内容为模拟官方二进制的最小行为（`--version` 打印固定版本；`init --skill --path <dir>` 在该 dir 下写一个标记文件），并把该临时目录前置到 `PATH`（或通过脚本支持的环境变量注入），使脚本在不依赖真实安装的情况下被测。

## 7. 实施顺序（概览，细节交由 plan）

1. 删除自研文件（按第 2.2 清单）。
2. 写 `config-samples/zcode-mcp-snippet.json`。
3. 写 `scripts/install-deveco-cli.ps1`。
4. 写 `scripts/install-deveco-cli.sh`（与 ps1 行为对齐）。
5. 写 `test/install.test.mjs`，本地双跑通过。
6. 改写 `README.md`；写 `INSTALL.md`。
7. 提交。

## 8. 验收标准

- `harmonyos-dev/` 下不再有 `src/`、`dist/`、`.mcp.json`、`.zcode-plugin/`、`package.json`、TS 文件。
- `scripts/install-deveco-cli.{ps1,sh}` 在装了 devecocli 的机器上：
  - `--dry-run` 输出含 skill 安装命令、MCP 合并、验证清单。
  - 正式运行后 `~/.zcode/skills/deveco-cli/` 存在、`~/.zcode/cli/config.json` 含 `mcpServers.deveco-cli`。
  - 重复运行不产生重复段；`-Force` 能覆盖。
- `test/install.test.mjs` 全绿（`node --test`）。
- `INSTALL.md` 可被一个新用户照做完成集成（人工验收）。
