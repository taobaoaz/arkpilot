import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/mcp/server.js";

describe("server tool registry", () => {
  it("registers all tools from the plan (30: 25 harmony + 5 appstore)", () => {
    expect(TOOLS).toHaveLength(30);
  });

  it("all tool names start with harmony_ or appstore_ and have descriptions", () => {
    for (const t of TOOLS) {
      expect(t.name.startsWith("harmony_") || t.name.startsWith("appstore_")).toBe(true);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it("includes check_updates tool", () => {
    expect(TOOLS.some((t) => t.name === "harmony_check_updates")).toBe(true);
  });

  it("registers all 5 appstore tools", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toContain("appstore_search");
    expect(names).toContain("appstore_categories");
    expect(names).toContain("appstore_list_by_category");
    expect(names).toContain("appstore_detail");
    expect(names).toContain("appstore_check");
  });
});
