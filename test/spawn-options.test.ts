import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawn = vi.fn();
vi.mock("node:child_process", () => ({ spawn: (...args: unknown[]) => spawn(...args) }));

const { runCheck, runValidation } = await import("../src/validation.js");

function fakeChild() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    pid: 4242,
    kill: vi.fn(),
  });
  setImmediate(() => child.emit("close", 0));
  return child;
}

beforeEach(() => {
  spawn.mockReset();
  spawn.mockImplementation(() => fakeChild());
});

describe("how commands are spawned", () => {
  it.each([
    ["test", ["test"]],
    ["typecheck", ["run", "typecheck"]],
    ["build", ["run", "build"]],
  ] as const)("runs the %s check as fixed argv with no shell", async (name, args) => {
    await runCheck(name, "/repo");
    const [file, argv, options] = spawn.mock.calls[0];
    expect(file).toBe("npm");
    expect(argv).toEqual(args);
    expect(options.shell).toBe(false);
  });

  it("runs a CLI --validate string through a shell", async () => {
    await runValidation("echo hi && echo there", "/repo");
    const [file, argv, options] = spawn.mock.calls[0];
    expect(file).toBe("echo hi && echo there");
    expect(argv).toEqual([]);
    expect(options.shell).toBe(true);
  });
});
