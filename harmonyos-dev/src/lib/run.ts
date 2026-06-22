// src/lib/run.ts
import { spawn } from "node:child_process";
import { brief as briefText } from "./result.js";

export interface RunOptions {
  cwd?: string;
  timeout?: number;          // default 120000
  env?: Record<string, string>;
  captureStderr?: boolean;   // default true
}

export interface RunResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  combined: string;
  brief: string;
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const timeout = opts.timeout ?? 120000;
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;
    let settled = false;

    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: process.platform === "win32",
    });

    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    const finish = (code: number, timedOut = false) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const combined = stdout + (opts.captureStderr === false ? "" : stderr);
      resolve({
        ok: !timedOut && code === 0,
        code: timedOut ? -1 : code,
        stdout,
        stderr: timedOut ? `${cmd} ${args.join(" ")} timed out after ${timeout}ms` : stderr,
        combined,
        brief: briefText(combined),
      });
    };

    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore kill errors
      }
      finish(-1, true);
    }, timeout);

    child.on("close", (code) => finish(code ?? 0));
    child.on("error", () => finish(-1));
  });
}
