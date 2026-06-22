# ZCode 接入 deveco-cli 指南

把华为官方 `deveco-cli` 的官方 skill 与 `deveco-mcp` 服务接入 ZCode。本指南只做接入引导，
所有运行时能力由官方 `devecocli` 命令提供，本仓库不含自研代码。

## 前置要求

- 操作系统：macOS 或 Windows
- Node.js ≥ 18（推荐 ≥ 22）
- DevEco Studio ≥ 6.1.0
  - Windows：必须是安装版本（非便携/解压版），默认路径 `C:\Program Files\Huawei\DevEco Studio`
  - macOS：安装在 `~/Applications` 或 `/Applications` 下

## 集成步骤

### 1. 安装官方 CLI

```bash
npm install -g @deveco/deveco-cli@latest
devecocli --version          # 验证安装
```

### 2. 落地官方 skill 到 ZCode skills 目录

ZCode 不在 `devecocli init --agent` 的已知列表（opencode/cursor/trae-cn）里，因此用 `--path`
把官方 skill 直接写到 ZCode 的 skills 目录：

```bash
# macOS / Linux
devecocli init --path ~/.zcode/skills

# Windows (cmd)
devecocli init --path "%USERPROFILE%\.zcode\skills"

# Windows (PowerShell)
devecocli init --path "$env:USERPROFILE\.zcode\skills"
```

执行后 `~/.zcode/skills/` 下会出现官方 `deveco-cli` skill（含 `SKILL.md` 等）。

### 3. 把 MCP 配置加进 ZCode config.json

因 ZCode 不在 `--agent` 列表，MCP 配置需手动合并。编辑 `~/.zcode/cli/config.json`，
在 `mcpServers` 段加入：

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

字段说明：
- `PROJECT_PATH`：留空则跟随 ZCode 当前工程；也可填固定工程路径。
- `NODE_MAX_OLD_SPACE_SIZE`：内部 node 进程老生代内存上限，默认 `8192`（MB）。
- `DEVECO_PATH`：可选。DevEco Studio 安装目录，留空时 devecocli 自动探测。

> 如果 config.json 里已有其他 `mcpServers` 条目，把上面的 `deveco-cli` 键并入即可，
> 不要覆盖已有的其他 server。

## 验证

重启 ZCode，然后在会话里直接描述任务，或手动验证：

```bash
devecocli --version          # CLI 就绪
devecocli device list        # 能列出已连接设备/模拟器
devecocli docs search List   # 本地 HarmonyOS 文档检索可用
```

集成后，模型可据官方 skill 调用 `devecocli` 命令（create/build/run/log/emulator/docs），
并通过 `mcp__deveco_cli__*` 做 ArkTS / C++ 语法检查。

## 常用命令速查

| 命令 | 用途 |
| --- | --- |
| `devecocli create --app-name MyApp` | 创建新的 HarmonyOS 项目 |
| `devecocli build` | 构建项目，产出 `.hap` / `.hsp` / `.har` / `.app` |
| `devecocli run` | 安装并运行应用到设备/模拟器 |
| `devecocli device list` | 查看已连接设备 |
| `devecocli emulator list` | 查看本地模拟器实例 |
| `devecocli log` | 查看 hilog 或崩溃日志 |
| `devecocli docs search <关键词>` | 搜索本地 HarmonyOS 文档 |
| `devecocli docs read <文档ID>` | 按文档 ID 读取完整文档 |
| `devecocli docs catalog` | 列出文档分类 |
| `devecocli update` | 升级 devecocli 到最新版本 |

完整命令与参数见 `devecocli --help` 或官方文档
https://developer.harmonyos.cool/docs/tools/deveco-code/deveco-cli 。

## 常见问题

**`devecocli` 命令找不到**

重开终端；确认 npm 全局 bin 目录在 PATH。可用 `npm root -g` 查全局 node_modules 位置，
其上一级通常是 bin 目录。

**DevEco Studio 未安装或探测不到**

从华为官方下载页安装 DevEco Studio（图形化安装，手动完成）。安装后 devecocli 会自动探测；
若探测失败，在 config.json 的 `DEVECO_PATH` 手填安装目录，例如：
- Windows：`C:\\Program Files\\Huawei\\DevEco Studio`
- macOS：`/Applications/DevEco Studio.app`

**模拟器启动/镜像下载被许可协议阻塞**

需在本地交互终端（不能由 AI 代做）运行：

```bash
devecocli emulator license accept
```

阅读并确认 `y` 后重试。AI Agent 无法替用户完成该交互步骤。

**安装应用报 `install sign info inconsistent`**

旧版本签名信息不一致，先卸载再装：

```bash
devecocli run --uninstall
```

**多设备环境如何选目标**

用 `--device` 指定设备名或序列号：

```bash
devecocli run --device "My Phone"
devecocli run --device 127.0.0.1:5555
```
