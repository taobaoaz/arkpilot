# deveco-cli 集成（接入官方 skill + MCP）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仓库新建 `deveco-cli/` 目录,放一份 INTEGRATION.md 指南,告诉 ZCode 用户如何用官方 `devecocli` 命令接入官方 skill + deveco-mcp。不改 `harmonyos-dev/` 或任何现有文件。

**Architecture:** 零代码集成。官方提供 `devecocli init --path`(写 skill)和 `devecocli serve mcp`(stdio MCP)。ZCode 不在 devecocli 的 `--agent` 已知列表,所以 skill 走 `--path`、MCP 手动写进 `~/.zcode/cli/config.json`。本仓库只提供指南文档。

**Tech Stack:** Markdown 文档。无脚本、无测试、无依赖。

**Spec:** `docs/superpowers/specs/2026-06-22-deveco-cli-integration-design.md`

---

## File Structure

| 文件 | 责任 |
|---|---|
| `deveco-cli/INTEGRATION.md` | 唯一交付物。中文指南:前置要求、三步集成、验证、常用命令速查、常见问题 |
| `deveco-cli/README.md` | 目录入口,一句话说明用途,指向 INTEGRATION.md |

不创建其他文件。不修改 `harmonyos-dev/` 或现有 docs。

---

## Task 1: 创建目录入口 README

**Files:**
- Create: `deveco-cli/README.md`

- [ ] **Step 1: 创建 `deveco-cli/README.md`**

```markdown
# deveco-cli 集成

把华为官方 [deveco-cli](https://gitcode.com/openharmony-sig/deveco-cli)（npm 包 `@deveco/deveco-cli`）
的官方 skill 与 deveco-mcp 接入 ZCode，获得官方维护的 HarmonyOS 开发能力：构建/运行/设备/模拟器/
日志/本地文档检索/ArkTS·C++ 语法检查。

本目录只提供接入指南，不含任何自研代码。完整步骤见 [INTEGRATION.md](./INTEGRATION.md)。

官方资源：
- 仓库：https://gitcode.com/openharmony-sig/deveco-cli
- npm：https://www.npmjs.com/package/@deveco/deveco-cli
- 文档：https://developer.harmonyos.cool/docs/tools/deveco-code/deveco-cli
```

- [ ] **Step 2: Commit**

```bash
git add deveco-cli/README.md
git commit -m "docs(deveco-cli): add directory README pointing to integration guide"
```

---

## Task 2: 写 INTEGRATION.md 主体（前置 + 三步 + 验证）

**Files:**
- Create: `deveco-cli/INTEGRATION.md`

- [ ] **Step 1: 创建 `deveco-cli/INTEGRATION.md`,写入前置要求与三步集成**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add deveco-cli/INTEGRATION.md
git commit -m "docs(deveco-cli): add integration guide — prerequisites, 3 steps, verification"
```

---

## Task 3: 在 INTEGRATION.md 追加常用命令速查与常见问题

**Files:**
- Modify: `deveco-cli/INTEGRATION.md`（追加到文件末尾）

- [ ] **Step 1: 在文件末尾追加「常用命令速查」和「常见问题」两节**

```markdown

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
```

- [ ] **Step 2: Commit**

```bash
git add deveco-cli/INTEGRATION.md
git commit -m "docs(deveco-cli): add command cheatsheet and FAQ"
```

---

## Task 4: 自检与最终验证

**Files:**
- 仅检查,不修改

- [ ] **Step 1: 确认 `harmonyos-dev/` 与其他现有文件未被改动**

```bash
git status --short
```

Expected: 只有 `deveco-cli/README.md` 和 `deveco-cli/INTEGRATION.md` 是新增(已提交)。
`harmonyos-dev/` 不出现在 status 里(未动)。

- [ ] **Step 2: 确认目录结构干净**

```bash
ls deveco-cli
```

Expected: 只有 `INTEGRATION.md` 和 `README.md` 两个文件,无其他。

- [ ] **Step 3: 人工通读 INTEGRATION.md**

按一个新用户的视角走一遍三步,确认:
- 前置要求完整(Node/DevEco/OS)
- 三条命令可直接复制执行
- config.json 片段是合法 JSON 且字段说明清楚
- 验证步骤可执行
- 常见问题覆盖了 devecocli 找不到、DevEco 探测、许可协议、签名冲突、多设备

如发现遗漏,补到 INTEGRATION.md 并 amend 最后一个 commit,或新增 commit。
