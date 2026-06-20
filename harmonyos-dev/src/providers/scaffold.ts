// src/providers/scaffold.ts
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { ok, fail } from "../lib/result.js";

interface ScaffoldResult {
  ok: boolean;
  output: string;
  path?: string;
}

function writeIfNew(file: string, content: string, overwrite: boolean): ScaffoldResult | null {
  if (existsSync(file) && !overwrite) return fail(`already exists: ${file}; pass overwrite:true`);
  mkdirSync(nodePath.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return null; // null = written, no conflict
}

function appendToPagesJson(root: string, module: string, srcName: string) {
  const f = nodePath.join(root, module, "src/main/resources/base/profile/main_pages.json");
  if (!existsSync(f)) return;
  // Minimal-touch: full read -> JSON.parse (this file is plain JSON, not json5) -> append -> write.
  const data = JSON.parse(readFileSync(f, "utf8"));
  if (!data.src.includes(srcName)) data.src.push(srcName);
  writeFileSync(f, JSON.stringify(data, null, 2));
}

export function createPage(input: {
  root: string;
  name: string;
  title?: string;
  dir?: string;
  overwrite?: boolean;
}): ScaffoldResult {
  const module = "entry";
  const dir = input.dir || nodePath.join(input.root, module, "src/main/ets/pages");
  const file = nodePath.join(dir, `${input.name}.ets`);
  const content = `@Entry
@Component
struct ${input.name} {
  @State message: string = '${input.title || input.name}'

  aboutToAppear() {
    // TODO: init
  }

  build() {
    Column() {
      Text(this.message)
        .fontSize(30)
    }
    .width('100%')
    .height('100%')
  }
}
`;
  const conflict = writeIfNew(file, content, !!input.overwrite);
  if (conflict) return conflict;
  appendToPagesJson(input.root, module, `pages/${input.name}`);
  return ok(`created page ${input.name}`, { path: file });
}

export function createComponent(input: {
  root: string;
  name: string;
  props?: string[];
  dir?: string;
  overwrite?: boolean;
}): ScaffoldResult {
  const module = "entry";
  const dir = input.dir || nodePath.join(input.root, module, "src/main/ets/components");
  const file = nodePath.join(dir, `${input.name}.ets`);
  const propsDecl = (input.props || []).map((p) => `  @Prop ${p}: string = '';`).join("\n");
  const content = `@Component
export struct ${input.name} {
${propsDecl}
  build() {
    Column() {
      Text('${input.name}')
    }
  }
}
`;
  const conflict = writeIfNew(file, content, !!input.overwrite);
  if (conflict) return conflict;
  return ok(`created component ${input.name}`, { path: file });
}

export function createAbility(input: {
  root: string;
  name: string;
  type: "UIAbility" | "UIExtensionAbility";
  moduleName?: string;
  overwrite?: boolean;
}): ScaffoldResult {
  const module = input.moduleName || "entry";
  const dir = nodePath.join(input.root, module, `src/main/ets/${input.type.toLowerCase()}`);
  const file = nodePath.join(dir, `${input.name}.ets`);
  const content = `import { ${input.type}, Want } from '@kit.AbilityKit';

export default class ${input.name} extends ${input.type} {
  onCreate(want: Want) {}
  onDestroy() {}
}
`;
  const conflict = writeIfNew(file, content, !!input.overwrite);
  if (conflict) return conflict;
  // Note: full registration in module.json5 needs minimal-touch JSON5 update; P0 leaves a note for manual registration.
  return ok(`created ability ${input.name}; note: register in ${module}/src/main/module.json5`, { path: file });
}

export function createModule(input: {
  root: string;
  name: string;
  type: "feature" | "shared";
  template?: string;
  overwrite?: boolean;
}): ScaffoldResult {
  const dir = nodePath.join(input.root, input.name);
  const file = nodePath.join(dir, "build-profile.json5");
  const content = `{
  "apiType": "stageMode",
  "buildOption": {},
  "targets": [{ "name": "default", "runtimeOS": "HarmonyOS" }]
}
`;
  const conflict = writeIfNew(file, content, !!input.overwrite);
  if (conflict) return conflict;
  return ok(`created module ${input.name}; note: register in root build-profile.json5 modules[]`, { path: file });
}
