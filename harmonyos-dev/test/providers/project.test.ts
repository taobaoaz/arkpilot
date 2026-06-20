import { describe, it, expect } from "vitest";
import { discover } from "../../src/providers/project.js";
import nodePath from "node:path";

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
