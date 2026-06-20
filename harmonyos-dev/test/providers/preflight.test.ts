import { describe, it, expect, vi } from "vitest";
import { preflight, preflightOk, type Check } from "../../src/providers/preflight.js";
import { run } from "../../src/lib/run.js";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("../../src/providers/sdk.js", async () => ({
  sdkRoot: vi.fn().mockResolvedValue("/sdk"),
  checkTool: vi.fn().mockResolvedValue({ ok: true, path: "/x", detail: "ok" }),
  hdcBin: vi.fn().mockResolvedValue("hdc"),
}));
vi.mock("../../src/providers/device.js", () => ({ listDevices: vi.fn().mockResolvedValue([]) }));
vi.mock("../../src/providers/project.js", () => ({ discover: vi.fn().mockResolvedValue({ ok: false }) }));

describe("preflight.preflightOk", () => {
  it("true when all required checks ok", () => {
    const checks: Check[] = [
      { name: "Host OS", ok: true, detail: "win32", fix: "" },
      { name: "HarmonyOS SDK root", ok: true, detail: "/sdk", fix: "" },
    ];
    expect(preflightOk(checks, { hasReadyTarget: false })).toBe(true);
  });

  it("false when a required check fails", () => {
    const checks: Check[] = [{ name: "Host OS", ok: false, detail: "linux", fix: "use win/mac" }];
    expect(preflightOk(checks, { hasReadyTarget: false })).toBe(false);
  });
});

describe("preflight.run", () => {
  it("returns checks array with hasReadyTarget", async () => {
    const r = await preflight();
    expect(r.ok).toBeDefined();
    expect(Array.isArray(r.checks)).toBe(true);
    expect(r).toHaveProperty("hasReadyTarget");
  });
});
