// src/providers/logs.ts
import { run } from "../lib/run.js";
import { hdcBin } from "./sdk.js";
import { ok, brief } from "../lib/result.js";

export interface LogsInput {
  serial: string;
  filter?: string;
  domain?: string;
  level?: "D" | "I" | "W" | "E" | "F";
  lines?: number;
  clear?: boolean;
  timeout?: number;
}

export async function logs(input: LogsInput) {
  const h = (await hdcBin()) ?? "hdc";
  if (input.clear) {
    await run(h, ["-t", input.serial, "shell", "hilog", "-r"], { timeout: 5000 });
  }
  const args = ["-t", input.serial, "shell", "hilog"];
  if (input.level) args.push("-L", input.level);
  if (input.domain) args.push("-D", input.domain);
  const r = await run(h, args, { timeout: input.timeout ?? 8000 });
  const all = r.stdout.split(/\r?\n/).filter(Boolean);
  let filtered = all;
  if (input.filter) filtered = all.filter((l) => l.includes(input.filter!));
  const limit = input.lines ?? 500;
  filtered = filtered.slice(-limit);
  return ok(brief(filtered.join("\n")), { totalLines: all.length, filteredLines: filtered.length });
}
