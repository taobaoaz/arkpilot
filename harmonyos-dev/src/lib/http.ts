// src/lib/http.ts
export interface HttpJsonResult {
  ok: boolean;
  status: number;
  json?: unknown;
  error?: string;
}

export async function httpJson(
  url: string,
  opts: { timeout?: number; headers?: Record<string, string> } = {},
): Promise<HttpJsonResult> {
  const timeout = opts.timeout ?? 15000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "ZCode-harmonyos-dev-plugin/0.1.0", ...opts.headers },
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const json = await res.json();
    return { ok: true, status: res.status, json };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
