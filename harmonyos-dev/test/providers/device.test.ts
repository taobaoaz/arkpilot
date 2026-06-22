import { describe, it, expect, vi, beforeEach } from "vitest";
import { listDevices, parseDevices } from "../../src/providers/device.js";
import { run } from "../../src/lib/run.js";

vi.mock("../../src/lib/run.js", () => ({ run: vi.fn() }));
vi.mock("../../src/providers/sdk.js", () => ({ hdcBin: vi.fn().mockResolvedValue("hdc") }));

beforeEach(() => vi.mocked(run).mockReset());

describe("device.parseDevices", () => {
  it("parses hdc list targets output", () => {
    const out = "127.0.0.1:5555\nEFGH5678\n\n";
    const devs = parseDevices(out);
    expect(devs).toHaveLength(2);
    expect(devs[0].serial).toBe("127.0.0.1:5555");
    expect(devs[0].type).toBe("emulator");
    expect(devs[1].serial).toBe("EFGH5678");
    expect(devs[1].type).toBe("usb");
  });

  it("returns empty for blank output", () => {
    expect(parseDevices("[Empty]\n")).toEqual([]);
  });
});

describe("device.listDevices", () => {
  it("returns [] when no devices (no throw)", async () => {
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: "[Empty]\n", stderr: "", combined: "[Empty]\n", brief: "[Empty]\n" });
    const devs = await listDevices();
    expect(devs).toEqual([]);
  });

  it("returns parsed devices", async () => {
    vi.mocked(run).mockResolvedValue({ ok: true, code: 0, stdout: "127.0.0.1:5555\n", stderr: "", combined: "127.0.0.1:5555\n", brief: "127.0.0.1:5555\n" });
    const devs = await listDevices();
    expect(devs).toHaveLength(1);
    expect(devs[0].serial).toBe("127.0.0.1:5555");
  });
});
