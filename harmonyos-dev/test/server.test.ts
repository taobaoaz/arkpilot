import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/mcp/server.js";

describe("server tool registry", () => {
  it("registers all 25 harmony_* tools (AppGallery tools were split out to the arkgallery repo in v0.3.0)", () => {
    expect(TOOLS).toHaveLength(25);
  });

  it("all tool names start with harmony_ and have descriptions", () => {
    for (const t of TOOLS) {
      expect(t.name.startsWith("harmony_")).toBe(true);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it("includes check_updates tool", () => {
    expect(TOOLS.some((t) => t.name === "harmony_check_updates")).toBe(true);
  });

  it("does not include any appstore_* tool (those moved to arkgallery)", () => {
    const names = TOOLS.map((t) => t.name);
    for (const n of names) {
      expect(n.startsWith("appstore_")).toBe(false);
    }
  });
});
