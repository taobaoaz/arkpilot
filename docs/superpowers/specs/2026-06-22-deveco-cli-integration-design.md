# deveco-cli 集成（接入官方 skill + MCP）

- 日期：2026-06-22
- 分支：feature/harmonyos-dev-plugin
- 状态：待评审

## 目标

接入华为官方 `deveco-cli`（npm 包 `@deveco/deveco-cli`，仓库 `openharmony-sig/deveco-cli`）的
官方 skill 与 `deveco-mcp`，让 ZCode 直接获得官方维护的 HarmonyOS 开发能力（构建/运行/设备/模拟器/
日志/文档检索/ArkTS·C++ 语法检查）。

## 范围边界（重要）

- **不动仓库里任何现有内容**：`harmonyos-dev/` 目录（自研插件 + appstore 工作）原样保留，不删除、不修改。
- 本集成是**独立的新增工作**，单独占 `deveco-cli/` 目录，只放一份指南文档。
- **不写脚本、不写测试、不写胶水代码**。`devecocli`、`npm`、ZCode 自己就是工具，无需再封装。

## 为什么这样集成

官方提供了两条直接能力：

- `devecocli init --path <dir>` —— 把官方 `deveco-cli` skill 写入指定目录（绕开 ZCode 不在
  `--agent` 已知列表的问题）。
- `devecocli serve mcp` —— 以 stdio 方式提供 `deveco-mcp` 服务（ArkTS/C++ 语法检查）。

ZCode 不在 `devecocli init --agent` 的已知列表（opencode/cursor/trae-cn）里，所以：
**skill 用 `--path` 落到 ZCode skills 目录，MCP 手动写进 ZCode config.json。**
两步都是官方机制，无需任何胶水代码。

## 集成步骤（写入指南，由用户执行）

```bash
# 1. 安装官方 CLI
npm install -g @deveco/deveco-cli@latest
devecocli --version          # 验证

# 2. 落地官方 skill 到 ZCode skills 目录
devecocli init --path ~/.zcode/skills                       # macOS/Linux
devecocli init --path "%USERPROFILE%\.zcode\skills"         # Windows cmd

# 3. 把 MCP 配置加进 ZCode config.json（手动，因 ZCode 不在 --agent 列表）
#    编辑 ~/.zcode/cli/config.json，合并下面的片段
```

`config.json` 要加的片段（`PROJECT_PATH` 留空跟随当前工程；`DEVECO_PATH` 可选，填 DevEco Studio 安装目录）：

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

## 验证

```bash
devecocli --version          # CLI 就绪
devecocli device list        # 能列出设备/模拟器
devecocli docs search List   # 本地文档检索可用
```

重启 ZCode 后，模型应能据官方 skill 调用 `devecocli` 命令，并通过 `mcp__deveco_cli__*` 做语法检查。

## 交付物

仅一份文档 `deveco-cli/INTEGRATION.md`：上面三步 + config 片段 + 验证 + 常见问题。
无脚本、无测试、无 package.json、无自研代码。

## 常见问题（写入文档）

- `devecocli` 找不到 → 重开终端；确认 npm 全局 bin 在 PATH。
- DevEco Studio 未装 → 官方下载页安装（图形化，手动）；`DEVECO_PATH` 可留空。
- 模拟器被许可阻塞 → 本地交互终端跑 `devecocli emulator license accept`（AI 不能代办）。
- 安装报 `install sign info inconsistent` → `devecocli run --uninstall`。
- 多设备 → `--device <名称|序列号>`。

## 不做（YAGNI）

- 不做安装脚本：三条命令用户自己跑，比脚本开关好理解。
- 不做 config 合并工具：用户手动粘贴 JSON 片段一次即可，写合并器反而要处理幂等/解析失败/缩进。
- 不做 dry-run / shim 测试：没有代码就没有测试负担。
- 不删除 `harmonyos-dev/`：那是另一条工作线（含 appstore），与本集成无关。
