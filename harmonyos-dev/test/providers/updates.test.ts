import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkUpdates, compareVersion } from "../../src/providers/updates.js";
import { httpJson } from "../../src/lib/http.js";

vi.mock("../../src/lib/http.js", () => ({ httpJson: vi.fn() }));
vi.mock("../../src/providers/config.js", () => ({
  apiLevel: () => "12",
  hvigorVersion: () => "4.0.2",
  compatibleSdk: () => "5.0.0",
}));
vi.mock("../../src/providers/sdk.js", () => ({ checkTool: vi.fn().mockResolvedValue({ ok: false, detail: "" }) }));

beforeEach(() => {
  vi.mocked(httpJson).mockReset();
});

describe("updates.compareVersion", () => {
  it("5.0.0 < 5.0.1", () => {
    expect(compareVersion("5.0.0", "5.0.1")).toBe(-1);
  });
  it("5.0.1 > 5.0.0", () => {
    expect(compareVersion("5.0.1", "5.0.0")).toBe(1);
  });
  it("equal", () => {
    expect(compareVersion("5.0.0", "5.0.0")).toBe(0);
  });
  it("12 < 13", () => {
    expect(compareVersion("12", "13")).toBe(-1);
  });
  it("non-numeric falls back to string compare", () => {
    expect(compareVersion("abc", "abd")).toBe(-1);
  });
});

describe("updates.checkUpdates", () => {
  it("marks outdated when latest > current", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: true, status: 200, json: { version: "5.1.0" } });
    const r = await checkUpdates({ force: true });
    expect(r.ok).toBe(true);
    const sdk = r.updates.find((u) => u.name === "compatible_sdk");
    expect(sdk?.outdated).toBe(true);
  });

  it("returns latest=undefined on network failure without blocking", async () => {
    vi.mocked(httpJson).mockResolvedValue({ ok: false, status: 0, error: "ENOTFOUND" });
    const r = await checkUpdates({ force: true });
    expect(r.ok).toBe(true);
    const u = r.updates[0];
    expect(u.latest).toBeUndefined();
    expect(u.outdated).toBe(false);
  });
});
