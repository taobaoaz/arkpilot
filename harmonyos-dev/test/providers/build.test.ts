import { describe, it, expect, vi, beforeEach } from "vitest";
import { build, parseHapPath } from "../../src/providers/build.js";
import { run } from "../../src/lib/run.js";
import { readFileSync } from "node:fs";
import nodePath from "node:path";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("../../src/providers/sdk.js", () => ({ hvigorwPath: vi.fn().mockResolvedValue("/proj/hvigorw") }));

beforeEach(() => vi.mocked(run).mockReset());

describe("build.parseHapPath", () => {
  it("extracts hap path from hvigor output", () => {
    const out = readFileSync(nodePath.resolve(__dirname, "../fixtures/hvigor-output.txt"), "utf8");
    const hap = parseHapPath(out);
    expect(hap).toBe("/proj/entry/build/default/outputs/default/entry-default-signed.hap");
  });

  it("returns null when no hap line", () => {
    expect(parseHapPath("BUILD SUCCESSFUL\n")).toBeNull();
  });
});

describe("build.build", () => {
  it("returns hapPath on successful build", async () => {
    const out = readFileSync(nodePath.resolve(__dirname, "../fixtures/hvigor-output.txt"), "utf8");
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: out, stderr: "", combined: out, brief: out });
    const r = await build({ root: "/proj" });
    expect(r.ok).toBe(true);
    expect(r.hapPath).toContain("entry-default-signed.hap");
  });

  it("returns ok=false on build failure", async () => {
    vi.mocked(run).mockResolvedValue({ ok: false, code: 1, stdout: "", stderr: "compile error", combined: "compile error", brief: "compile error" });
    const r = await build({ root: "/proj" });
    expect(r.ok).toBe(false);
  });
});
