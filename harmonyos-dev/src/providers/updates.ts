// src/providers/updates.ts
import { httpJson } from "../lib/http.js";
import { apiLevel, hvigorVersion, compatibleSdk } from "./config.js";

// Source URL constants (decision 5: calibrate valid URLs at implementation/runtime time).
const UPDATE_SOURCES = {
  api_level: "https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/api-level", // TODO calibrate
  hvigor: "https://ohpm.openharmony.cn/ohpm/hvigor-version", // TODO calibrate
  ohpm: "https://ohpm.openharmony.cn/ohpm/version",
  deveco: "https://developer.huawei.com/consumer/cn/deveco-studio/",
} as const;

let cache: { at: number; result: Awaited<ReturnType<typeof checkUpdates>> } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export function compareVersion(a: string, b: string): number {
  const na = a.match(/\d+/g)?.map(Number);
  const nb = b.match(/\d+/g)?.map(Number);
  if (na && nb) {
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const da = na[i] ?? 0;
      const db = nb[i] ?? 0;
      if (da !== db) return da < db ? -1 : 1;
    }
    return 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface UpdateItem {
  name: string;
  latest?: string;
  current: string;
  outdated: boolean;
  source: string;
  note?: string;
}

export interface CheckUpdatesInput {
  check?: string[];
  timeout?: number;
  offline?: boolean;
  force?: boolean;
}

export async function checkUpdates(input: CheckUpdatesInput = {}): Promise<{
  ok: boolean;
  output: string;
  updates: UpdateItem[];
  docs: { title: string; url: string }[];
  fetchedAt: string;
}> {
  if (!input.force && cache && Date.now() - cache.at < CACHE_TTL) return cache.result;

  const items: UpdateItem[] = [];
  const docs = [
    { title: "HarmonyOS 开发文档", url: "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/" },
    { title: "ArkTS 语法", url: "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-getting-started" },
  ];

  const targets: Array<{ name: string; current: string; source: string }> = [
    { name: "api_level", current: apiLevel(), source: UPDATE_SOURCES.api_level },
    { name: "hvigor", current: hvigorVersion(), source: UPDATE_SOURCES.hvigor },
    { name: "ohpm", current: "0.0.0", source: UPDATE_SOURCES.ohpm },
    { name: "compatible_sdk", current: compatibleSdk(), source: UPDATE_SOURCES.api_level },
    { name: "deveco", current: "0.0.0", source: UPDATE_SOURCES.deveco },
  ].filter((t) => !input.check || input.check.includes(t.name));

  for (const t of targets) {
    if (input.offline) {
      items.push({ name: t.name, current: t.current, outdated: false, source: t.source, note: "offline" });
      continue;
    }
    const res = await httpJson(t.source, { timeout: input.timeout ?? 15000 });
    if (!res.ok || !res.json) {
      items.push({
        name: t.name,
        current: t.current,
        outdated: false,
        source: t.source,
        note: `fetch failed: ${res.error ?? res.status}`,
      });
      continue;
    }
    // Version extraction: prefer json.version, fall back to regex on stringified payload.
    const latest =
      (res.json as { version?: string }).version ??
      String(res.json).match(/(\d+\.\d+\.\d+)/)?.[1];
    const outdated = latest ? compareVersion(t.current, latest) < 0 : false;
    items.push({ name: t.name, latest, current: t.current, outdated, source: t.source });
  }

  const result = {
    ok: true,
    output: `checked ${items.length} items; ${items.filter((i) => i.outdated).length} outdated`,
    updates: items,
    docs,
    fetchedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), result };
  return result;
}
