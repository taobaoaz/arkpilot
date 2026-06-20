// src/providers/ui.ts
import { run } from "../lib/run.js";
import { hdcBin } from "./sdk.js";
import { ok, fail } from "../lib/result.js";

export interface UiNode {
  type: string;
  text?: string;
  id?: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  enabled: boolean;
  visible: boolean;
}

const NODE_RE = /<node\b([^>]*)\/?>/g;
const ATTR = (attrs: string, name: string): string | undefined => {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : undefined;
};

export function parseLayout(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  let m: RegExpExecArray | null;
  while ((m = NODE_RE.exec(xml)) !== null) {
    const attrs = m[1];
    const bRaw = ATTR(attrs, "bounds");
    if (!bRaw) continue;
    const bm = bRaw.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!bm) continue;
    nodes.push({
      type: ATTR(attrs, "type") || "unknown",
      text: ATTR(attrs, "text"),
      id: ATTR(attrs, "id"),
      bounds: { left: +bm[1], top: +bm[2], right: +bm[3], bottom: +bm[4] },
      enabled: ATTR(attrs, "enabled") !== "false",
      visible: ATTR(attrs, "visible") !== "false",
    });
  }
  return nodes;
}

export function resolveCenter(
  nodes: UiNode[],
  q: { text?: string; id?: string },
): { x: number; y: number } | null {
  const hit = nodes.find(
    (n) => (q.text && n.text === q.text) || (q.id && n.id === q.id),
  );
  if (!hit) return null;
  return {
    x: Math.round((hit.bounds.left + hit.bounds.right) / 2),
    y: Math.round((hit.bounds.top + hit.bounds.bottom) / 2),
  };
}

export async function uiStatus(serial: string) {
  const h = (await hdcBin()) ?? "hdc";
  const remote = "/data/local/tmp/layout.xml";
  const dump = await run(h, ["-t", serial, "shell", "uitest", "dumpLayout"], { timeout: 10000 });
  if (!dump.ok) return ok("uitest unavailable, UI automation disabled", { available: false });
  const recv = await run(h, ["-t", serial, "shell", "cat", remote], { timeout: 5000 });
  const xml = recv.ok ? recv.stdout : "";
  const nodes = parseLayout(xml);
  return ok(`UI layout: ${nodes.length} nodes`, { available: true, nodes });
}

export async function uiTap(serial: string, x: number, y: number) {
  const h = (await hdcBin()) ?? "hdc";
  const r = await run(h, ["-t", serial, "shell", "uitest", "input", "tapEvent", String(x), String(y)], { timeout: 10000 });
  return r.ok ? ok(`tapped (${x},${y})`) : fail(`tap failed\n${r.brief}`);
}

export async function uiTypeText(serial: string, text: string) {
  const h = (await hdcBin()) ?? "hdc";
  const r = await run(h, ["-t", serial, "shell", "uitest", "input", "inputText", text], { timeout: 10000 });
  return r.ok ? ok(`typed ${text.length} chars`) : fail(`type failed\n${r.brief}`);
}

export async function uiBack(serial: string) {
  const h = (await hdcBin()) ?? "hdc";
  const r = await run(h, ["-t", serial, "shell", "uitest", "input", "keyEvent", "Back"], { timeout: 10000 });
  return r.ok ? ok("back pressed") : fail(`back failed\n${r.brief}`);
}
