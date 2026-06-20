// src/providers/project.ts
import { existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import JSON5 from "json5";
import { ok, fail } from "../lib/result.js";

export interface DiscoverResult {
  ok: boolean;
  output: string;
  root?: string;
  bundleName?: string;
  moduleName?: string;
  abilityName?: string;
  hapPath?: string;
  warnings?: string[];
}

export async function discover(startDir: string): Promise<DiscoverResult> {
  let dir = nodePath.resolve(startDir);
  let root: string | null = null;
  for (let i = 0; i < 20; i++) {
    if (existsSync(nodePath.join(dir, "build-profile.json5"))) {
      root = dir;
      break;
    }
    const parent = nodePath.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!root) return fail(`not a HarmonyOS project (no build-profile.json5 under ${startDir})`);

  const warnings: string[] = [];
  let bundleName: string | undefined;
  let moduleName: string | undefined;
  let abilityName: string | undefined;

  try {
    const profile = JSON5.parse(readFileSync(nodePath.join(root, "build-profile.json5"), "utf8"));
    bundleName = profile?.app?.bundleName;
    moduleName = profile?.modules?.[0]?.name;
  } catch (e) {
    warnings.push(`failed to parse build-profile.json5: ${(e as Error).message}`);
  }

  // Parse module.json5 for mainElement.
  if (moduleName) {
    const moduleJson5 = nodePath.join(root, moduleName, "src", "main", "module.json5");
    if (existsSync(moduleJson5)) {
      try {
        const m = JSON5.parse(readFileSync(moduleJson5, "utf8"));
        abilityName = m?.module?.mainElement;
      } catch (e) {
        warnings.push(`failed to parse module.json5: ${(e as Error).message}`);
      }
    } else {
      warnings.push(`missing ${moduleName}/src/main/module.json5`);
    }
  }

  if (!bundleName) warnings.push("bundleName not found");
  if (!existsSync(nodePath.join(root, "oh-package.json5"))) warnings.push("missing oh-package.json5");

  return ok("discovered HarmonyOS project", {
    root,
    bundleName,
    moduleName,
    abilityName,
    warnings,
  });
}
