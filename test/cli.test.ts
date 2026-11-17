import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo } from "./helpers.js";

const tsx = resolve("node_modules/.bin/tsx");
const cli = resolve("src/cli.ts");

let repo: string;
let cwd: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "cli-repo-"));
  cwd = mkdtempSync(join(tmpdir(), "cli-cwd-"));
  makeRepo(repo);
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
});

const run = (...args: string[]) => spawnSync(tsx, [cli, ...args], { cwd, encoding: "utf8" });

describe("cli git errors", () => {
  it("prints a readable message and exits 1 for an unknown base ref", () => {
    const result = run("review", "--repo", repo, "--base-ref", "nosuchbranch");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Base ref "nosuchbranch" was not found/);
    expect(result.stderr).not.toMatch(/Fatal error|\n\s+at /);
  });

  it("prints a readable message for a directory that is not a repository", () => {
    const result = run("review", "--repo", cwd);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/not a git repository/i);
    expect(result.stderr).not.toMatch(/--no-index|usage: git/i);
  });
});
