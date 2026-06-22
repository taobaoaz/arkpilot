import { describe, it, expect, vi, beforeEach } from "vitest";
import { logs } from "../../src/providers/logs.js";
import { run } from "../../src/lib/run.js";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("../../src/providers/sdk.js", () => ({ hdcBin: vi.fn().mockResolvedValue("hdc") }));

beforeEach(() => vi.mocked(run).mockReset());

describe("logs", () => {
  it("filters by keyword and limits lines", async () => {
    const raw = "line INFO tag hello\nline ERROR tag world\nline DEBUG tag foo\n";
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: raw, stderr: "", combined: raw, brief: raw });
    const r = await logs({ serial: "s", filter: "world", lines: 500 });
    expect(r.ok).toBe(true);
    expect(r.filteredLines).toBe(1);
  });
});
