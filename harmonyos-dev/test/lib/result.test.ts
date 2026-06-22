import { describe, it, expect } from "vitest";
import { ok, fail, brief, type ToolResult } from "../../src/lib/result.js";

describe("result", () => {
  it("ok() builds success ToolResult with extra fields", () => {
    const r = ok("done", { serial: "127.0.0.1:5555" });
    expect(r.ok).toBe(true);
    expect(r.output).toBe("done");
    expect(r.serial).toBe("127.0.0.1:5555");
  });

  it("fail() builds failure ToolResult with nextStep", () => {
    const r = fail("no device", { nextStep: "run harmony_list_devices" });
    expect(r.ok).toBe(false);
    expect(r.output).toBe("no device");
    expect(r.nextStep).toBe("run harmony_list_devices");
  });

  it("brief() truncates to last N chars with marker", () => {
    const long = "x".repeat(3000);
    const b = brief(long, 2000);
    expect(b.length).toBeLessThanOrEqual(2010);
    expect(b.startsWith("...")).toBe(true);
  });

  it("brief() returns short strings unchanged", () => {
    expect(brief("short", 2000)).toBe("short");
  });
});
