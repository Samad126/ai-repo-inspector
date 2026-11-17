import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

describe("cli exit code", () => {
  it("exits 0 when every validation passes", () => {
    const result = run("review", "--repo", repo, "--base-ref", "main", "--validate", "echo ok");
    expect(result.status).toBe(0);
  });

  it("exits 0 when no validation was requested", () => {
    expect(run("review", "--repo", repo, "--base-ref", "main").status).toBe(0);
  });

  it("exits 1 when a validation fails, but still writes the report", () => {
    const result = run(
      "review", "--repo", repo, "--base-ref", "main",
      "--validate", "echo ok", "--validate", "exit 3",
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/1 of 2 validations failed/);
    const report = readFileSync(join(cwd, "review-report.md"), "utf8");
    expect(report).toContain("### exit 3 (failed)");
  });

  it("exits 1 for a timed-out or missing command too", () => {
    const result = run("review", "--repo", repo, "--base-ref", "main", "--validate", "no-such-command-xyz");
    expect(result.status).toBe(1);
  });

  it("does not write a report when the arguments are invalid", () => {
    run("review", "--bogus");
    expect(existsSync(join(cwd, "review-report.md"))).toBe(false);
  });
});
