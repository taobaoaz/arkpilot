import { describe, it, expect, vi, beforeEach } from "vitest";
import { sdkRoot, checkTool } from "../../src/providers/sdk.js";
import { run } from "../../src/lib/run.js";
import { existsSync } from "node:fs";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));

beforeEach(() => {
  vi.mocked(run).mockReset();
  vi.mocked(existsSync).mockReset();
  process.env.HARMONYOS_PLUGIN_SDK_PATH = "";
  process.env.HOS_SDK_HOME = "";
});

describe("sdk", () => {
  it("sdkRoot prefers userConfig sdk_path", async () => {
    process.env.HARMONYOS_PLUGIN_SDK_PATH = "/custom/sdk";
    vi.mocked(existsSync).mockReturnValue(true);
    expect(await sdkRoot()).toBe("/custom/sdk");
  });

  it("sdkRoot falls back to HOS_SDK_HOME", async () => {
    process.env.HOS_SDK_HOME = "/hos/sdk";
    vi.mocked(existsSync).mockImplementation((p) => String(p) === "/hos/sdk");
    expect(await sdkRoot()).toBe("/hos/sdk");
  });

  it("sdkRoot returns null when nothing found", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(run).mockResolvedValue({ ok: false, code: 1, stdout: "", stderr: "", combined: "", brief: "" });
    expect(await sdkRoot()).toBeNull();
  });

  it("checkTool returns ok when which finds it", async () => {
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: "/usr/bin/hdc", stderr: "", combined: "/usr/bin/hdc", brief: "/usr/bin/hdc" });
    const r = await checkTool("hdc");
    expect(r.ok).toBe(true);
    expect(r.path).toBe("/usr/bin/hdc");
  });
});
