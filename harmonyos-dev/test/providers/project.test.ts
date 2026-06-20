import { describe, it, expect } from "vitest";
import { discover, createApp } from "../../src/providers/project.js";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import os from "node:os";

describe("project.discover", () => {
  it("discovers bundleName/abilityName/module from fixture", async () => {
    const fixtureRoot = nodePath.resolve(__dirname, "../fixtures/sample-stage-app");
    const r = await discover(fixtureRoot);
    expect(r.ok).toBe(true);
    expect(r.bundleName).toBe("com.example.sample");
    expect(r.abilityName).toBe("EntryAbility");
    expect(r.moduleName).toBe("entry");
    expect(r.warnings).toBeDefined();
  });

  it("returns ok=false when no build-profile.json5", async () => {
    const r = await discover(nodePath.resolve(__dirname, "../fixtures"));
    expect(r.ok).toBe(false);
    expect(r.output).toContain("not a HarmonyOS project");
  });
});

describe("project.createApp", () => {
  it("generates minimal Stage app", async () => {
    const tmp = mkdtempSync(nodePath.join(os.tmpdir(), "harm-"));
    const r = await createApp({ targetDir: tmp, bundleName: "com.test.app", name: "TestApp" });
    expect(r.ok).toBe(true);
    expect(existsSync(nodePath.join(tmp, "build-profile.json5"))).toBe(true);
    expect(existsSync(nodePath.join(tmp, "AppScope", "app.json5"))).toBe(true);
    expect(existsSync(nodePath.join(tmp, "entry", "src", "main", "ets", "pages", "Index.ets"))).toBe(true);
    const profile = readFileSync(nodePath.join(tmp, "build-profile.json5"), "utf8");
    expect(profile).toContain("com.test.app");
  });

  it("refuses to overwrite without overwrite:true", async () => {
    const tmp = mkdtempSync(nodePath.join(os.tmpdir(), "harm2-"));
    await createApp({ targetDir: tmp });
    const r2 = await createApp({ targetDir: tmp });
    expect(r2.ok).toBe(false);
    expect(r2.output).toContain("already exists");
  });
});

