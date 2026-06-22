// src/providers/device.ts
import { run } from "../lib/run.js";
import { hdcBin } from "./sdk.js";

export interface Device {
  serial: string;
  state: "device" | "offline" | "unauthorized";
  type: "emulator" | "usb";
}

export function parseDevices(stdout: string): Device[] {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0 || lines.includes("[Empty]")) return [];
  return lines.map((serial) => ({
    serial,
    state: "device" as const,
    type: serial.startsWith("127.0.0.1:") ? ("emulator" as const) : ("usb" as const),
  }));
}

export async function listDevices(): Promise<Device[]> {
  const hdc = await hdcBin();
  const cmd = hdc ?? "hdc";
  const r = await run(cmd, ["list", "targets"], { timeout: 10000 });
  if (!r.ok) return [];
  return parseDevices(r.stdout);
}

export async function waitForDevice(serial?: string, timeout = 30000): Promise<Device | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const devs = await listDevices();
    if (serial) {
      const hit = devs.find((d) => d.serial === serial);
      if (hit) return hit;
    } else if (devs.length > 0) {
      return devs[0];
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}
