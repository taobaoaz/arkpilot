// src/providers/preflight.ts
import { sdkRoot, checkTool } from "./sdk.js";
import { listDevices } from "./device.js";
import { discover } from "./project.js";
import { apiLevel, hvigorVersion, compatibleSdk } from "./config.js";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fix: string;
  optional?: boolean;
}

export interface PreflightResult {
  ok: boolean;
  output: string;
  checks: Check[];
  hasReadyTarget: boolean;
}

const OPTIONAL = new Set([
  "hdc 已连接设备",
  "DevEco Studio 安装",
  "ohpm (包管理器)",
  "工程根可识别",
  "系统镜像/模拟器就绪",
]);

export function preflightOk(checks: Check[], input: { hasReadyTarget: boolean }): boolean {
  return checks.every((c) => c.ok || c.optional || (input.hasReadyTarget && c.name === "系统镜像/模拟器就绪"));
}

export async function preflight(): Promise<PreflightResult> {
  const checks: Check[] = [];

  checks.push({
    name: "Host OS",
    ok: process.platform === "win32" || process.platform === "darwin",
    detail: process.platform,
    fix: "Run this plugin on Windows or macOS",
  });

  const root = await sdkRoot();
  checks.push({
    name: "HarmonyOS SDK root",
    ok: Boolean(root),
    detail: root || "not found",
    fix: "Install DevEco Studio or set HOS_SDK_HOME/HARMONYOS_PLUGIN_SDK_PATH",
  });

  checks.push({
    name: "Plugin defaults",
    ok: true,
    detail: `api=${apiLevel()} hvigor=${hvigorVersion()} sdk=${compatibleSdk()}`,
    fix: "",
  });

  const hdcCheck = await checkTool("hdc");
  checks.push({
    name: "hdc 命令",
    ok: hdcCheck.ok,
    detail: hdcCheck.detail,
    fix: "Install HarmonyOS command-line-tools or add to PATH",
  });

  const hvigorCheck = await checkTool("hvigorw");
  checks.push({
    name: "hvigorw",
    ok: hvigorCheck.ok,
    detail: hvigorCheck.detail,
    fix: "DevEco Studio 自带;或安装 command-line-tools",
    optional: true,
  });

  const nodeCheck = await checkTool("node");
  checks.push({
    name: "node (≥18)",
    ok: nodeCheck.ok,
    detail: nodeCheck.detail,
    fix: "hvigorw 依赖 node,需在 PATH",
  });

  const javaCheck = await checkTool("java");
  checks.push({
    name: "Java/JDK (≥17)",
    ok: javaCheck.ok,
    detail: javaCheck.detail,
    fix: "部分 hvigor 任务需要 JAVA_HOME",
    optional: true,
  });

  const devs = await listDevices();
  const hasReadyTarget = devs.length > 0;
  checks.push({
    name: "hdc 已连接设备",
    ok: hasReadyTarget,
    detail: `${devs.length} device(s)`,
    fix: "connect device or start emulator",
    optional: true,
  });

  const devecoCheck = await checkTool("devecostudio");
  checks.push({
    name: "DevEco Studio 安装",
    ok: devecoCheck.ok,
    detail: devecoCheck.detail,
    fix: "optional, only for emulator",
    optional: true,
  });

  checks.push({
    name: "下载缓存目录可写",
    ok: true,
    detail: process.env.HARMONYOS_PLUGIN_DATA || "tmp",
    fix: "",
  });

  const ohpmCheck = await checkTool("ohpm");
  checks.push({
    name: "ohpm (包管理器)",
    ok: ohpmCheck.ok,
    detail: ohpmCheck.detail,
    fix: "install ohpm for project creation",
    optional: true,
  });

  const disc = await discover(process.cwd());
  checks.push({
    name: "工程根可识别",
    ok: disc.ok,
    detail: disc.ok ? String(disc.root) : "no build-profile.json5",
    fix: "run harmony_create_app",
    optional: true,
  });

  checks.push({
    name: "系统镜像/模拟器就绪",
    ok: hasReadyTarget,
    detail: hasReadyTarget ? "ready" : "no target",
    fix: "start DevEco emulator",
    optional: true,
  });

  const isOk = preflightOk(checks, { hasReadyTarget });
  const summary = isOk ? "environment ready" : "environment NOT ready";
  return { ok: isOk, output: summary, checks, hasReadyTarget };
}
