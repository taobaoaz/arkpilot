import { describe, it, expect } from "vitest";
import { parseLayout, resolveCenter } from "../../src/providers/ui.js";
import { readFileSync } from "node:fs";
import nodePath from "node:path";

const xml = readFileSync(nodePath.resolve(__dirname, "../fixtures/dumpLayout.xml"), "utf8");

describe("ui.parseLayout", () => {
  it("extracts UiNode list", () => {
    const nodes = parseLayout(xml);
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe("Text");
    expect(nodes[0].text).toBe("Login");
    expect(nodes[0].bounds).toEqual({ left: 100, top: 200, right: 300, bottom: 260 });
  });
});

describe("ui.resolveCenter", () => {
  it("returns center coords for matching text", () => {
    const nodes = parseLayout(xml);
    const c = resolveCenter(nodes, { text: "Submit" });
    expect(c).toEqual({ x: 200, y: 430 });
  });

  it("returns null when no match", () => {
    const nodes = parseLayout(xml);
    expect(resolveCenter(nodes, { text: "Nope" })).toBeNull();
  });
});
