import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRoot } from "../src/config.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "config-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("resolveRoot", () => {
  it("returns the real path of INSPECTOR_ROOT", () => {
    expect(resolveRoot({ INSPECTOR_ROOT: dir })).toBe(dir);
  });

  it.each([undefined, "", "   "])("refuses to start without a usable INSPECTOR_ROOT (%j)", (value) => {
    expect(() => resolveRoot({ INSPECTOR_ROOT: value })).toThrow(/INSPECTOR_ROOT/);
  });

  it("refuses a root that does not exist", () => {
    expect(() => resolveRoot({ INSPECTOR_ROOT: join(dir, "missing") })).toThrow(/does not exist/);
  });

  it("refuses a filesystem root, which would allow everything", () => {
    expect(() => resolveRoot({ INSPECTOR_ROOT: "/" })).toThrow(/too broad/);
  });
});

describe("mcp-server entry point", () => {
  const run = (env: Record<string, string>) =>
    spawnSync(resolve("node_modules/.bin/tsx"), [resolve("src/mcp-server.ts")], {
      encoding: "utf8",
      input: "",
      env: { PATH: process.env.PATH ?? "", ...env },
      timeout: 10_000,
    });

  it("exits 1 with a clear message when INSPECTOR_ROOT is not set", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/INSPECTOR_ROOT/);
  });

  it("starts when INSPECTOR_ROOT is set (and exits when stdin closes)", () => {
    const result = run({ INSPECTOR_ROOT: dir });
    expect(result.status).toBe(0);
  });
});
