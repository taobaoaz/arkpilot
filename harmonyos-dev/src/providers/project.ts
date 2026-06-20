// src/providers/project.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

export interface CreateAppInput {
  name?: string;
  bundleName?: string;
  targetDir?: string;
  overwrite?: boolean;
}

export async function createApp(input: CreateAppInput = {}): Promise<DiscoverResult> {
  const dir = nodePath.resolve(input.targetDir || process.cwd());
  const bundle = input.bundleName || "com.example.helloapp";
  const marker = nodePath.join(dir, "build-profile.json5");
  if (existsSync(marker) && !input.overwrite) {
    return fail(`already exists: ${marker}; pass overwrite:true to replace`);
  }
  // Variable substitution (decision 1: {{...}} syntax).
  const T = (s: string) =>
    s
      .replace(/\{\{BUNDLE_NAME\}\}/g, bundle)
      .replace(/\{\{MODULE_NAME\}\}/g, "entry");

  const file = (rel: string, content: string) => {
    const p = nodePath.join(dir, rel);
    mkdirSync(nodePath.dirname(p), { recursive: true });
    writeFileSync(p, T(content));
  };

  file(
    "build-profile.json5",
    `{
  "app": {
    "signingConfigs": [],
    "products": [{ "name": "default", "signingConfig": "default" }],
    "buildMode": "debug",
    "bundleName": "{{BUNDLE_NAME}}",
    "versionCode": 1000000,
    "versionName": "1.0.0"
  },
  "modules": [{ "name": "entry", "srcPath": "./entry", "targets": [{ "name": "default", "applyToProducts": ["default"] }] }]
}
`,
  );
  file(
    "AppScope/app.json5",
    `{
  "app": {
    "bundleName": "{{BUNDLE_NAME}}",
    "vendor": "example",
    "versionCode": 1000000,
    "versionName": "1.0.0",
    "icon": "$media:app_icon",
    "label": "$string:app_name"
  }
}
`,
  );
  file("AppScope/resources/base/media/.gitkeep", "");
  file(
    "entry/build-profile.json5",
    `{
  "apiType": "stageMode",
  "buildOption": {},
  "buildMode": "debug",
  "targets": [{ "name": "default", "runtimeOS": "HarmonyOS" }]
}
`,
  );
  file(
    "entry/src/main/module.json5",
    `{
  "module": {
    "name": "entry",
    "type": "entry",
    "deviceTypes": ["phone"],
    "mainElement": "EntryAbility",
    "abilities": [{ "name": "EntryAbility", "srcEntry": "./ets/entryability/EntryAbility.ets" }]
  }
}
`,
  );
  file(
    "entry/src/main/ets/pages/Index.ets",
    `@Entry
@Component
struct Index {
  build() {
    Column() {
      Text('Hello HarmonyOS')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
    }
    .width('100%')
    .height('100%')
  }
}
`,
  );
  file(
    "entry/src/main/resources/base/profile/main_pages.json",
    `{
  "src": ["pages/Index"]
}
`,
  );
  file(
    "oh-package.json5",
    `{
  "name": "{{BUNDLE_NAME}}",
  "version": "1.0.0",
  "description": "HarmonyOS app"
}
`,
  );
  file("hvigorfile.ts", `export { appTasks } from '@ohos/hvigor-ohos-plugin';\n`);
  file(
    "hvigor/hvigor-config.json5",
    `{
  "hvigorVersion": "4.0.2",
  "dependencies": { "@ohos/hvigor-ohos-plugin": "4.0.2" }
}
`,
  );
  file("hvigorw", "#!/bin/sh\nexec node node_modules/@ohos/hvigor/bin/hvigor.js \"$@\"\n");
  file("hvigorw.bat", "@echo off\nnode node_modules\\@ohos\\hvigor\\bin\\hvigor.js %*\n");

  return ok(`created HarmonyOS Stage app at ${dir}`, {
    root: dir,
    bundleName: bundle,
    moduleName: "entry",
    abilityName: "EntryAbility",
  });
}
