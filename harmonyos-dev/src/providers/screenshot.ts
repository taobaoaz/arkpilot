// src/providers/screenshot.ts
import { run } from "../lib/run.js";
import { hdcBin } from "./sdk.js";
import { pluginDataDir } from "../lib/path.js";
import { ok, fail } from "../lib/result.js";
import nodePath from "node:path";
import { mkdirSync } from "node:fs";

export async function screenshot(input: { serial: string; outDir?: string }) {
  const h = (await hdcBin()) ?? "hdc";
  const dir = input.outDir || nodePath.join(pluginDataDir(), "screenshots");
  mkdirSync(dir, { recursive: true });
  const stamp = Date.now();
  const local = nodePath.join(dir, `screenshot_${input.serial.replace(/[^\w.]/g, "_")}_${stamp}.jpeg`);
  const remote = "/data/local/tmp/harm_shot.jpeg";

  const shot = await run(h, ["-t", input.serial, "shell", "snapshot_display", "-f", remote], { timeout: 15000 });
  if (!shot.ok) return fail(`screenshot failed: snapshot_display unavailable\n${shot.brief}`, { available: false });
  const recv = await run(h, ["-t", input.serial, "file", "recv", remote, local], { timeout: 15000 });
  await run(h, ["-t", input.serial, "shell", "rm", remote], { timeout: 5000 });
  if (!recv.ok) return fail(`screenshot recv failed\n${recv.brief}`);
  return ok("screenshot saved", { path: local });
}
