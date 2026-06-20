import { describe, it, expect, vi, beforeEach } from "vitest";
import nodePath from "node:path";
import { harmonyRoot, pluginDataDir } from "../../src/lib/path.js";
import { existsSync } from "node:fs";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

beforeEach(() => vi.mocked(existsSync).mockReset());

describe("path", () => {
  it("harmonyRoot walks up to dir containing build-profile.json5", () => {
    // Only the /proj root has the marker file.
    const marker = nodePath.join(nodePath.resolve("/proj"), "build-profile.json5");
    vi.mocked(existsSync).mockImplementation((p) => String(p) === marker);
    const root = harmonyRoot("/proj/entry/src/main");
    expect(root).toBe(nodePath.resolve("/proj"));
  });

  it("harmonyRoot returns null when not found", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(harmonyRoot("/a/b/c")).toBeNull();
  });

  it("pluginDataDir reads HARMONYOS_PLUGIN_DATA env", () => {
    process.env.HARMONYOS_PLUGIN_DATA = "/data/harmony";
    expect(pluginDataDir()).toBe("/data/harmony");
  });

  it("pluginDataDir falls back to os tmpdir", () => {
    delete process.env.HARMONYOS_PLUGIN_DATA;
    const d = pluginDataDir();
    expect(d.length).toBeGreaterThan(0);
  });
});
