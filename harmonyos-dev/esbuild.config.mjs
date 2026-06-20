import { build } from "esbuild";
import { rm } from "node:fs/promises";

// esbuild single-file bundle: src/mcp/server.ts -> dist/mcp/server.js
// Inlines @modelcontextprotocol/sdk + zod + json5 into one ESM file runnable by node.
await rm("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/mcp/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "dist/mcp/server.js",
  banner: { js: "#!/usr/bin/env node" },
  packages: "external",
});
console.log("built dist/mcp/server.js");
