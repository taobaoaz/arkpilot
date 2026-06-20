import { describe, it, expect, vi, beforeEach } from "vitest";
import { installApp, launchApp } from "../../src/providers/app.js";
import { run } from "../../src/lib/run.js";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("../../src/providers/sdk.js", () => ({ hdcBin: vi.fn().mockResolvedValue("hdc") }));
vi.mock("../../src/providers/build.js", () => ({ build: vi.fn() }));
vi.mock("../../src/providers/device.js", () => ({ listDevices: vi.fn() }));

beforeEach(() => vi.mocked(run).mockReset());

describe("app.installApp", () => {
  it("calls hdc install", async () => {
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: "success", stderr: "", combined: "success", brief: "success" });
    const r = await installApp({ serial: "127.0.0.1:5555", hapPath: "/x/app.hap" });
    expect(r.ok).toBe(true);
    expect((vi.mocked(run).mock.calls[0][1] as string[]).join(" ")).toContain("install");
  });
});

describe("app.launchApp", () => {
  it("launches with bundle+ability", async () => {
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "", combined: "", brief: "" });
    const r = await launchApp({ serial: "s", bundleName: "com.x", abilityName: "EntryAbility" });
    expect(r.ok).toBe(true);
    const args = vi.mocked(run).mock.calls[0][1] as string[];
    expect(args.join(" ")).toContain("aa start");
    expect(args.join(" ")).toContain("com.x");
    expect(args.join(" ")).toContain("EntryAbility");
  });
});
