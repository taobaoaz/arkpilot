// src/providers/sdk.ts
import { existsSync } from "node:fs";
import nodePath from "node:path";
import os from "node:os";
import { run } from "../lib/run.js";
import { sdkPath as userSdkPath, hdcPath as userHdcPath } from "./config.js";

// System-default SDK path candidates.
function defaultSdkCandidates(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      nodePath.join(process.env.LOCALAPPDATA || "", "Huawei", "Sdk"),
      nodePath.join(process.env.DEVECO_HOME || "", "sdk"),
    ];
  }
  return [
    nodePath.join(home, "Library", "Huawei", "Sdk"),
    "/Applications/DevEco Studio.app/Contents/sdk",
  ];
}

export async function sdkRoot(): Promise<string | null> {
  // 1. userConfig sdk_path
  const cfg = userSdkPath();
  if (cfg && existsSync(cfg)) return cfg;
  // 2. environment variables
  for (const envKey of ["HOS_SDK_HOME", "HDC_HOME", "DEVECO_SDK_HOME"]) {
    const v = process.env[envKey];
    if (v && existsSync(v)) return v;
  }
  // 3. system default paths
  for (const c of defaultSdkCandidates()) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

export async function checkTool(name: string): Promise<{ ok: boolean; path?: string; detail: string }> {
  const which = process.platform === "win32" ? "where" : "which";
  const r = await run(which, [name]);
  if (!r.ok) return { ok: false, detail: `${name} not found on PATH` };
  const p = r.stdout.trim().split(/\r?\n/)[0];
  return { ok: true, path: p, detail: p };
}

export async function hdcBin(): Promise<string | null> {
  const cfg = userHdcPath();
  if (cfg && existsSync(cfg)) return cfg;
  const root = await sdkRoot();
  if (root) {
    const guess = nodePath.join(root, "toolchains", process.platform === "win32" ? "hdc.exe" : "hdc");
    if (existsSync(guess)) return guess;
  }
  const t = await checkTool("hdc");
  return t.ok ? t.path ?? null : null;
}

export async function hvigorwPath(projectRoot: string): Promise<string | null> {
  const candidates = process.platform === "win32" ? ["hvigorw.bat", "hvigorw"] : ["hvigorw"];
  for (const c of candidates) {
    const p = nodePath.join(projectRoot, c);
    if (existsSync(p)) return p;
  }
  return null;
}
