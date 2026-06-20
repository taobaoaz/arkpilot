// src/lib/path.ts
import { existsSync } from "node:fs";
import nodePath from "node:path";
import os from "node:os";

const PROJECT_MARKER = "build-profile.json5";

export function harmonyRoot(startDir: string): string | null {
  let dir = nodePath.resolve(startDir);
  for (let i = 0; i < 20; i++) {
    if (existsSync(nodePath.join(dir, PROJECT_MARKER))) return dir;
    const parent = nodePath.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function pluginDataDir(): string {
  return process.env.HARMONYOS_PLUGIN_DATA || os.tmpdir();
}
