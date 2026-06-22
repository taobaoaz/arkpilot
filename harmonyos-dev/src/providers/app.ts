// src/providers/app.ts
import { run } from "../lib/run.js";
import { hdcBin } from "./sdk.js";
import { build, type BuildInput } from "./build.js";
import { listDevices } from "./device.js";
import { ok, fail } from "../lib/result.js";

async function hdc(): Promise<string> {
  return (await hdcBin()) ?? "hdc";
}

export interface AppResult {
  ok: boolean;
  output: string;
  [k: string]: unknown;
}

export async function installApp(input: { serial: string; hapPath: string; reinstall?: boolean }): Promise<AppResult> {
  const h = await hdc();
  const args = ["-t", input.serial];
  if (input.reinstall) args.push("-r");
  args.push("install", input.hapPath);
  const r = await run(h, args, { timeout: 60000 });
  return r.ok ? ok(`installed ${input.hapPath}`, { packageName: input.hapPath }) : fail(`install failed\n${r.brief}`);
}

export async function uninstallApp(input: { serial: string; bundleName: string }): Promise<AppResult> {
  const h = await hdc();
  const r = await run(h, ["-t", input.serial, "uninstall", input.bundleName], { timeout: 30000 });
  return r.ok ? ok(`uninstalled ${input.bundleName}`) : fail(`uninstall failed\n${r.brief}`);
}

export async function launchApp(input: { serial: string; bundleName: string; abilityName: string }): Promise<AppResult> {
  const h = await hdc();
  const args = ["-t", input.serial, "shell", "aa", "start", "-a", input.abilityName, "-b", input.bundleName];
  const r = await run(h, args, { timeout: 15000 });
  return r.ok ? ok(`launched ${input.bundleName}/${input.abilityName}`) : fail(`launch failed\n${r.brief}`);
}

export async function terminateApp(input: { serial: string; bundleName: string }): Promise<AppResult> {
  const h = await hdc();
  const r = await run(h, ["-t", input.serial, "shell", "aa", "force-stop", input.bundleName], { timeout: 10000 });
  return r.ok ? ok(`terminated ${input.bundleName}`) : fail(`terminate failed\n${r.brief}`);
}

export async function openUrl(input: { serial: string; uri: string }): Promise<AppResult> {
  const h = await hdc();
  const r = await run(h, ["-t", input.serial, "shell", "aa", "start", "-d", input.uri, "-a", "ohos.want.action.viewData"], { timeout: 15000 });
  return r.ok ? ok(`opened ${input.uri}`) : fail(`open url failed\n${r.brief}`);
}

export async function buildAndRun(
  input: BuildInput & { serial?: string; bundleName: string; abilityName: string },
): Promise<AppResult> {
  const b = await build(input);
  if (!b.ok || !b.hapPath) return fail(`build_and_run stopped at build:\n${b.output}`, { step: "build" });

  let serial = input.serial;
  if (!serial) {
    const devs = await listDevices();
    if (devs.length === 0)
      return fail("build_and_run stopped: no device available", {
        step: "device",
        hapPath: b.hapPath,
        nextStep: "connect a device or start emulator then pass serial",
      });
    serial = devs[0].serial;
  }

  const inst = await installApp({ serial, hapPath: b.hapPath, reinstall: true });
  if (!inst.ok) return fail(`build_and_run stopped at install:\n${inst.output}`, { step: "install", hapPath: b.hapPath, serial });

  const launch = await launchApp({ serial, bundleName: input.bundleName, abilityName: input.abilityName });
  if (!launch.ok) return fail(`build_and_run stopped at launch:\n${launch.output}`, { step: "launch", hapPath: b.hapPath, serial });

  return ok("build_and_run succeeded", {
    hapPath: b.hapPath,
    serial,
    bundleName: input.bundleName,
    abilityName: input.abilityName,
  });
}
