import { describe, it, expect, vi, beforeEach } from "vitest";
import { screenshot } from "../../src/providers/screenshot.js";
import { run } from "../../src/lib/run.js";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("../../src/providers/sdk.js", () => ({ hdcBin: vi.fn().mockResolvedValue("hdc") }));
vi.mock("../../src/lib/path.js", () => ({ pluginDataDir: () => "/tmp/harm" }));

beforeEach(() => vi.mocked(run).mockReset());

describe("screenshot", () => {
  it("returns local path", async () => {
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: "", stderr: "", combined: "", brief: "" });
    const r = await screenshot({ serial: "s" });
    expect(r.ok).toBe(true);
    expect(String(r.path)).toMatch(/\.jpeg$/);
  });
});
