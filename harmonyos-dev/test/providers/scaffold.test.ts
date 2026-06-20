import { describe, it, expect } from "vitest";
import { createPage } from "../../src/providers/scaffold.js";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import os from "node:os";

// Helper: create a minimal project skeleton for scaffold tests.
function makeProject(): string {
  const tmp = mkdtempSync(nodePath.join(os.tmpdir(), "scaf-"));
  mkdirSync(nodePath.join(tmp, "entry/src/main/ets/pages"), { recursive: true });
  mkdirSync(nodePath.join(tmp, "entry/src/main/resources/base/profile"), { recursive: true });
  writeFileSync(
    nodePath.join(tmp, "entry/src/main/resources/base/profile/main_pages.json"),
    JSON.stringify({ src: ["pages/Index"] }),
  );
  writeFileSync(
    nodePath.join(tmp, "build-profile.json5"),
    `{ "modules": [{ "name": "entry", "srcPath": "./entry" }] }`,
  );
  return tmp;
}

describe("scaffold.createPage", () => {
  it("generates .ets page and appends to main_pages.json", () => {
    const root = makeProject();
    const r = createPage({ root, name: "Login" });
    expect(r.ok).toBe(true);
    expect(existsSync(nodePath.join(root, "entry/src/main/ets/pages/Login.ets"))).toBe(true);
    const pages = JSON.parse(
      readFileSync(nodePath.join(root, "entry/src/main/resources/base/profile/main_pages.json"), "utf8"),
    );
    expect(pages.src).toContain("pages/Login");
  });

  it("refuses overwrite", () => {
    const root = makeProject();
    createPage({ root, name: "Login" });
    const r2 = createPage({ root, name: "Login" });
    expect(r2.ok).toBe(false);
    expect(r2.output).toContain("already exists");
  });
});
