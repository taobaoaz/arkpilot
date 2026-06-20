import { describe, it, expect, vi, beforeEach } from "vitest";
import { run } from "../../src/lib/run.js";

// Mock child_process.spawn; each test injects a fake child via mockSpawn.
const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

beforeEach(() => mockSpawn.mockReset());

describe("run", () => {
  it("resolves ok when exit code 0", async () => {
    mockSpawn.mockReturnValue(fakeChild({ code: 0, stdout: "hello" }));
    const r = await run("echo", ["hi"]);
    expect(r.ok).toBe(true);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("hello");
  });

  it("resolves ok=false when exit code non-zero", async () => {
    mockSpawn.mockReturnValue(fakeChild({ code: 1, stderr: "boom" }));
    const r = await run("bad", []);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe("boom");
  });

  it("kills process and returns timeout error", async () => {
    const child = fakeChild({ hang: true });
    mockSpawn.mockReturnValue(child);
    const r = await run("slow", [], { timeout: 50 });
    expect(r.ok).toBe(false);
    expect(r.stderr).toContain("timed out after 50ms");
    expect(child.killed).toBe(true);
  });

  it("brief returns last 2000 chars of combined", async () => {
    mockSpawn.mockReturnValue(fakeChild({ code: 0, stdout: "y".repeat(3000) }));
    const r = await run("e", []);
    expect(r.brief.startsWith("...")).toBe(true);
    expect(r.brief.length).toBeLessThanOrEqual(2010);
  });
});

// Helper: build a fake child object emitting data/close events like a real spawn.
function fakeChild(opts: { code?: number; stdout?: string; stderr?: string; hang?: boolean }) {
  const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
  const child = {
    killed: false,
    stdout: emitter(handlers, "data"),
    stderr: emitter(handlers, "data"),
    on(event: string, cb: (...a: unknown[]) => void) {
      (handlers[event] ||= []).push(cb);
      return child;
    },
    kill() {
      // Mark killed but do NOT emit 'close' synchronously: the real run()
      // timeout handler must be the one that finalizes the result.
      child.killed = true;
      return true;
    },
  };
  // Defer event emission so listeners attach first.
  setTimeout(() => {
    if (opts.hang) return; // never emits close -> triggers timeout path
    if (opts.stdout) emit(handlers, opts.stdout);
    if (opts.stderr) emit(handlers, opts.stderr);
    handlers["close"]?.forEach((cb) => cb(opts.code ?? 0));
  }, 0);
  return child;
}

function emitter(handlers: Record<string, Array<(...a: unknown[]) => void>>, _event: string) {
  return {
    on(event: string, cb: (...a: unknown[]) => void) {
      (handlers[event] ||= []).push(cb);
      return this;
    },
  };
}

function emit(handlers: Record<string, Array<(...a: unknown[]) => void>>, data: string) {
  handlers["data"]?.forEach((cb) => cb(data));
}
