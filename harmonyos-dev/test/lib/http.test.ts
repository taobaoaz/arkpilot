import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpJson } from "../../src/lib/http.js";

describe("httpJson", () => {
  const origFetch = globalThis.fetch;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.useRealTimers();
  });

  it("parses JSON response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: "5.0.1" }),
    }) as unknown as typeof fetch;
    const r = await httpJson("https://example.com/v.json");
    expect(r.ok).toBe(true);
    expect(r.json).toEqual({ version: "5.0.1" });
  });

  it("returns ok=false on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as unknown as typeof fetch;
    const r = await httpJson("https://example.com/missing");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  it("returns ok=false when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND")) as unknown as typeof fetch;
    const r = await httpJson("https://example.com/x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ENOTFOUND");
  });

  it("includes ZCode plugin UA header", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    globalThis.fetch = spy as unknown as typeof fetch;
    await httpJson("https://example.com/v");
    expect(spy).toHaveBeenCalledWith(
      "https://example.com/v",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("ZCode") }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
