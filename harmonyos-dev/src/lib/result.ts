// src/lib/result.ts
export interface ToolResult {
  ok: boolean;
  output: string;
  [key: string]: unknown;
}

export function ok(output: string, extra: Record<string, unknown> = {}): ToolResult {
  return { ok: true, output, ...extra };
}

export function fail(output: string, extra: Record<string, unknown> = {}): ToolResult {
  return { ok: false, output, ...extra };
}

export function brief(text: string, max = 2000): string {
  if (text.length <= max) return text;
  return "..." + text.slice(text.length - max);
}
