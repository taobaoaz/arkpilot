// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { preflight } from "../providers/preflight.js";
import { discover, createApp } from "../providers/project.js";
import { build } from "../providers/build.js";
import { buildAndRun, installApp, uninstallApp, launchApp, terminateApp, openUrl } from "../providers/app.js";
import { listDevices, waitForDevice } from "../providers/device.js";
import { logs } from "../providers/logs.js";
import { screenshot } from "../providers/screenshot.js";
import { uiStatus, uiTap, uiTypeText, uiBack, parseLayout, resolveCenter } from "../providers/ui.js";
import { createPage, createComponent, createAbility, createModule } from "../providers/scaffold.js";
import { checkUpdates } from "../providers/updates.js";
import { searchApp, listCategories, listByCategory, getDetail, checkSource } from "../providers/appstore.js";

const serial = z.object({ serial: z.string() });
const root = z.object({ root: z.string().optional() });

interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodType<any>;
  handler: (a: any) => Promise<any> | any;
}

export const TOOLS: ToolDef[] = [
  {
    name: "harmony_preflight",
    description: "Check HarmonyOS dev environment readiness. Call FIRST before any build/run. Read-only.",
    schema: z.object({}),
    handler: async () => preflight(),
  },
  {
    name: "harmony_check_updates",
    description: "Online check for latest HarmonyOS SDK/hvigor/ohpm/DevEco versions. Read-only, never auto-upgrades.",
    schema: z.object({
      check: z.array(z.string()).optional(),
      offline: z.boolean().optional(),
      force: z.boolean().optional(),
    }),
    handler: async (a) => checkUpdates(a),
  },
  {
    name: "harmony_discover_project",
    description: "Discover HarmonyOS project (build-profile.json5, bundleName, abilityName).",
    schema: root,
    handler: async (a) => discover(a.root || process.cwd()),
  },
  {
    name: "harmony_create_app",
    description: "Create minimal HarmonyOS NEXT Stage ArkTS app. Refuses overwrite unless overwrite:true.",
    schema: z.object({
      name: z.string().optional(),
      bundleName: z.string().optional(),
      targetDir: z.string().optional(),
      overwrite: z.boolean().optional(),
    }),
    handler: async (a) => createApp(a),
  },
  {
    name: "harmony_build_app",
    description: "Build HarmonyOS app via hvigorw (assembleHap).",
    schema: z.object({
      module: z.string().optional(),
      mode: z.enum(["debug", "release"]).optional(),
      root: z.string().optional(),
    }),
    handler: async (a) => build(a),
  },
  {
    name: "harmony_build_and_run",
    description: "Build -> select device -> install -> launch. Atomic steps.",
    schema: z.object({
      serial: z.string().optional(),
      bundleName: z.string(),
      abilityName: z.string(),
      root: z.string().optional(),
    }),
    handler: async (a) => buildAndRun(a),
  },
  {
    name: "harmony_list_devices",
    description: "List hdc-connected devices/emulators.",
    schema: z.object({}),
    handler: async () => ({ ok: true, output: "list", devices: await listDevices() }),
  },
  {
    name: "harmony_wait_for_device",
    description: "Poll until a device appears or timeout.",
    schema: z.object({ serial: z.string().optional(), timeout: z.number().optional() }),
    handler: async (a) => ({ ok: true, output: "wait", device: await waitForDevice(a.serial, a.timeout) }),
  },
  {
    name: "harmony_install_app",
    description: "Install .hap on device.",
    schema: z.object({ serial: z.string(), hapPath: z.string(), reinstall: z.boolean().optional() }),
    handler: async (a) => installApp(a),
  },
  {
    name: "harmony_uninstall_app",
    description: "Uninstall bundle from device.",
    schema: z.object({ serial: z.string(), bundleName: z.string() }),
    handler: async (a) => uninstallApp(a),
  },
  {
    name: "harmony_launch_app",
    description: "Launch app ability.",
    schema: z.object({ serial: z.string(), bundleName: z.string(), abilityName: z.string() }),
    handler: async (a) => launchApp(a),
  },
  {
    name: "harmony_terminate_app",
    description: "Force-stop app.",
    schema: z.object({ serial: z.string(), bundleName: z.string() }),
    handler: async (a) => terminateApp(a),
  },
  {
    name: "harmony_open_url",
    description: "Open URI on device.",
    schema: z.object({ serial: z.string(), uri: z.string() }),
    handler: async (a) => openUrl(a),
  },
  {
    name: "harmony_logs",
    description: "Pull hilog logs with filter.",
    schema: z.object({
      serial: z.string(),
      filter: z.string().optional(),
      level: z.enum(["D", "I", "W", "E", "F"]).optional(),
      lines: z.number().optional(),
    }),
    handler: async (a) => logs(a),
  },
  {
    name: "harmony_screenshot",
    description: "Capture device screen to local jpeg (use Read tool to view path).",
    schema: z.object({ serial: z.string(), outDir: z.string().optional() }),
    handler: async (a) => screenshot(a),
  },
  {
    name: "harmony_ui_status",
    description: "Dump current UI layout via uitest. available:false when unsupported.",
    schema: serial,
    handler: async (a) => uiStatus(a.serial),
  },
  {
    name: "harmony_ui_describe",
    description: "Describe visible UI nodes from a dumpLayout string.",
    schema: z.object({ layout: z.string() }),
    handler: async (a) => ({ ok: true, output: "nodes", nodes: parseLayout(a.layout) }),
  },
  {
    name: "harmony_ui_resolve",
    description: "Resolve center coords of a node by text/id.",
    schema: z.object({ layout: z.string(), text: z.string().optional(), id: z.string().optional() }),
    handler: async (a) => ({ ok: true, output: "resolve", point: resolveCenter(parseLayout(a.layout), a) }),
  },
  {
    name: "harmony_ui_tap",
    description: "Tap screen coords.",
    schema: z.object({ serial: z.string(), x: z.number(), y: z.number() }),
    handler: async (a) => uiTap(a.serial, a.x, a.y),
  },
  {
    name: "harmony_ui_type_text",
    description: "Type text into focused field.",
    schema: z.object({ serial: z.string(), text: z.string() }),
    handler: async (a) => uiTypeText(a.serial, a.text),
  },
  {
    name: "harmony_ui_back",
    description: "Press Back key.",
    schema: serial,
    handler: async (a) => uiBack(a.serial),
  },
  {
    name: "harmony_create_page",
    description: "Scaffold ArkUI @Entry page + register in main_pages.json.",
    schema: z.object({
      root: z.string(),
      name: z.string(),
      title: z.string().optional(),
      overwrite: z.boolean().optional(),
    }),
    handler: (a) => createPage(a),
  },
  {
    name: "harmony_create_component",
    description: "Scaffold @Component custom component.",
    schema: z.object({ root: z.string(), name: z.string(), overwrite: z.boolean().optional() }),
    handler: (a) => createComponent(a),
  },
  {
    name: "harmony_create_ability",
    description: "Scaffold UIAbility/UIExtensionAbility.",
    schema: z.object({ root: z.string(), name: z.string(), type: z.enum(["UIAbility", "UIExtensionAbility"]) }),
    handler: (a) => createAbility(a),
  },
  {
    name: "harmony_create_module",
    description: "Scaffold feature/shared module.",
    schema: z.object({ root: z.string(), name: z.string(), type: z.enum(["feature", "shared"]) }),
    handler: (a) => createModule(a),
  },
  {
    name: "appstore_search",
    description: "Search AppGallery apps by name. Returns matching apps with icon URL + detail URL. Core tool for 'input name -> return name'.",
    schema: z.object({
      query: z.string(),
      limit: z.number().optional(),
      exact: z.boolean().optional(),
    }),
    handler: async (a) => searchApp(a),
  },
  {
    name: "appstore_categories",
    description: "List all AppGallery categories. Read-only.",
    schema: z.object({}),
    handler: async () => listCategories(),
  },
  {
    name: "appstore_list_by_category",
    description: "Page through apps in a category (page default 1, pageSize default 20).",
    schema: z.object({
      category: z.string(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    }),
    handler: async (a) => listByCategory(a),
  },
  {
    name: "appstore_detail",
    description: "Fetch single app detail by appId or url (one required). Fills pkg/dev/category fields.",
    schema: z.object({
      appId: z.string().optional(),
      url: z.string().optional(),
    }),
    handler: async (a) => getDetail(a),
  },
  {
    name: "appstore_check",
    description: "Probe AppGallery data source availability (http + optional playwright fallback). Read-only diagnostic.",
    schema: z.object({}),
    handler: async () => checkSource(),
  },
];

async function asyncWrap(handler: (a: any) => Promise<any> | any, args: unknown) {
  try {
    return await handler(args);
  } catch (e) {
    return { ok: false, output: `failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// Minimal zod -> JSON Schema (P0 simplification; MCP clients tolerate additionalProperties).
function zodToJsonSchema(_schema: z.ZodType<any>): any {
  return { type: "object", additionalProperties: true };
}

const server = new Server(
  { name: "harmonyos-dev", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.schema),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const def = TOOLS.find((t) => t.name === req.params.name);
  if (!def) return { content: [{ type: "text", text: `unknown tool: ${req.params.name}` }] };
  const parsed = def.schema.parse(req.params.arguments || {});
  const result = await asyncWrap(def.handler, parsed);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-connect when run as the server entrypoint, not when imported by tests.
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("mcp/server.js")) {
  main().catch((e) => {
    console.error("harmonyos-dev server fatal:", e);
    process.exit(1);
  });
}
