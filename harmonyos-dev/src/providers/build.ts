// src/providers/build.ts
import { run } from "../lib/run.js";
import { hvigorwPath } from "./sdk.js";
import { ok, fail } from "../lib/result.js";

export interface BuildInput {
  module?: string;
  mode?: "debug" | "release";
  product?: string;
  target?: string;
  root?: string;
  clean?: boolean;
  timeout?: number;
}

export interface BuildResult {
  ok: boolean;
  output: string;
  hapPath?: string;
  durationMs?: number;
  warnings?: string[];
}

export function parseHapPath(stdout: string): string | null {
  // Match the hap artifact path line in hvigor output.
  const m = stdout.match(/hap:\s*(\S+\.hap)/i);
  return m ? m[1] : null;
}

export async function build(input: BuildInput = {}): Promise<BuildResult> {
  const root = input.root || process.cwd();
  const hvigorw = await hvigorwPath(root);
  const module = input.module || "entry";
  const mode = input.mode || "debug";
  const product = input.product || "default";
  const target = input.target || "assembleHap";
  const timeout = input.timeout ?? 600000;
  const warnings: string[] = [];

  if (!hvigorw) {
    return fail("hvigorw not found in project root", {
      nextStep: "ensure hvigorw/hvigorw.bat exists or run harmony_create_app",
    });
  }

  const cmd = hvigorw;
  const args = [
    "--mode",
    "module",
    "-p",
    `product=${product}`,
    "-p",
    `module=${module}@${target}`,
    "--no-daemon",
    "assembleHap",
    mode === "release" ? "--release" : "--debug",
  ];

  const start = Date.now();
  const r = await run(cmd, args, { cwd: root, timeout });
  const durationMs = Date.now() - start;

  if (!r.ok) {
    return fail(`build failed (code ${r.code})\n${r.brief}`, {
      durationMs,
      warnings,
      nextStep: "read output for compile errors",
    });
  }

  const hapPath = parseHapPath(r.combined);
  if (!hapPath) warnings.push("could not parse hap path from output");
  return ok(`build succeeded in ${durationMs}ms\n${r.brief}`, { hapPath, durationMs, warnings });
}
