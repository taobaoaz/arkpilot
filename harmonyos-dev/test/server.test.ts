import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/mcp/server.js";

describe("server tool registry", () => {
  it("registers all tools from the plan (25 across all categories)", () => {
    // Categories: env(1) + version(1) + project(2) + build(2) + device(2)
    // + app(5: install/uninstall/launch/terminate/open_url) + logs(1)
    // + screenshot(1) + ui(6) + scaffold(4) = 25.
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
});
