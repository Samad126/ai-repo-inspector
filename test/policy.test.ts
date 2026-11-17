import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertSafeRef, resolveRepo } from "../src/policy.js";

let base: string;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "policy-"));
  mkdirSync(join(base, "root", "repo", ".git"), { recursive: true });
  mkdirSync(join(base, "root", "plain"), { recursive: true });
  mkdirSync(join(base, "root-evil", "repo", ".git"), { recursive: true });
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("resolveRepo", () => {
  it("accepts a git repo inside the root", () => {
    const root = join(base, "root");
    expect(resolveRepo(join(root, "repo"), root)).toBe(join(root, "repo"));
  });

  it("rejects a sibling directory that merely shares the root's name prefix", () => {
    const root = join(base, "root");
    expect(() => resolveRepo(join(base, "root-evil", "repo"), root)).toThrow(/outside the allowed root/);
  });

  it("rejects a directory that is not a git repository", () => {
    const root = join(base, "root");
    expect(() => resolveRepo(join(root, "plain"), root)).toThrow(/not a git repository/);
  });

  it("rejects a path that does not exist", () => {
    const root = join(base, "root");
    expect(() => resolveRepo(join(root, "missing"), root)).toThrow(/does not exist/);
  });

  it("rejects a symlink that escapes the root", () => {
    const root = join(base, "root");
    symlinkSync(join(base, "root-evil", "repo"), join(root, "link"));
    expect(() => resolveRepo(join(root, "link"), root)).toThrow(/outside the allowed root/);
  });
});

describe("assertSafeRef", () => {
  it.each(["main", "origin/main", "feature/x-1", "v1.2.3", "HEAD~2", "abc123"])("allows %s", (ref) => {
    expect(() => assertSafeRef(ref)).not.toThrow();
  });
  it.each(["--output=/tmp/x", "-p", "a b", "a;b", "", "a..b"])("rejects %j", (ref) => {
    expect(() => assertSafeRef(ref)).toThrow();
  });
});
