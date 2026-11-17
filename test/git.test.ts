import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changedFiles, GitError, parseNameStatus } from "../src/git.js";
import { markdownReport } from "../src/report.js";
import { git, makeRepo } from "./helpers.js";

describe("parseNameStatus", () => {
  it("parses added, modified, deleted, renamed and copied entries from -z output", () => {
    const out = ["A", "b.txt", "M", "m.txt", "D", "gone.txt", "R100", "old name.txt", "new.txt", "C75", "src.txt", "copy.txt"].join("\0") + "\0";
    expect(parseNameStatus(out)).toEqual([
      { path: "b.txt", status: "added" },
      { path: "m.txt", status: "modified" },
      { path: "gone.txt", status: "deleted" },
      { path: "new.txt", status: "renamed", oldPath: "old name.txt" },
      { path: "copy.txt", status: "copied", oldPath: "src.txt" },
    ]);
  });

  it("returns an empty list for empty output", () => {
    expect(parseNameStatus("")).toEqual([]);
  });

  it("treats a type change as modified", () => {
    expect(parseNameStatus("T\0link\0")).toEqual([{ path: "link", status: "modified" }]);
  });
});

describe("changedFiles", () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "git-"));
    makeRepo(repo);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it("reports a pure rename as one renamed file with its old path", () => {
    git(repo, "mv", "a.txt", "renamed.txt");
    git(repo, "commit", "-qm", "rename");
    const files = changedFiles(repo, "main");
    expect(files).toContainEqual({ path: "renamed.txt", status: "renamed", oldPath: "a.txt" });
    expect(files.some((f) => f.path.includes("\t"))).toBe(false);
  });

  it("keeps odd file names intact (tab in the name)", () => {
    writeFileSync(join(repo, "we\tird.txt"), "x");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "odd");
    expect(changedFiles(repo, "main")).toContainEqual({ path: "we\tird.txt", status: "added" });
  });

  it("is not thrown off by a user's diff.renames=false config", () => {
    git(repo, "config", "diff.renames", "false");
    renameSync(join(repo, "a.txt"), join(repo, "r2.txt"));
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "rename2");
    expect(changedFiles(repo, "main")).toContainEqual({ path: "r2.txt", status: "renamed", oldPath: "a.txt" });
  });
});

describe("markdownReport renames", () => {
  it("shows where a renamed file came from", () => {
    const md = markdownReport({
      repositoryPath: "/r",
      changedFiles: [{ path: "new.txt", status: "renamed", oldPath: "old.txt" }],
      validationResults: [],
    });
    expect(md).toContain("- new.txt (renamed from old.txt)");
  });
});

describe("changedFiles errors", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "git-err-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("explains a missing default base ref instead of crashing (master-only repo)", () => {
    git(dir, "init", "-q", "-b", "master");
    git(dir, "commit", "-q", "--allow-empty", "-m", "init");
    expect(() => changedFiles(dir)).toThrow(GitError);
    expect(() => changedFiles(dir)).toThrow(/Base ref "main" was not found/);
  });

  it("explains an unknown base ref", () => {
    makeRepo(dir);
    expect(() => changedFiles(dir, "nosuchbranch")).toThrow(/Base ref "nosuchbranch" was not found/);
  });

  it("explains a repository with no commits", () => {
    git(dir, "init", "-q", "-b", "main");
    expect(() => changedFiles(dir, "main")).toThrow(/no commits/);
  });

  it("explains a directory that is not a git repository", () => {
    expect(() => changedFiles(dir, "main")).toThrow(GitError);
    expect(() => changedFiles(dir, "main")).not.toThrow(/--no-index|Command failed/);
  });

  it("never leaks raw git stderr into the message", () => {
    makeRepo(dir);
    try {
      changedFiles(dir, "nosuchbranch");
    } catch (error) {
      expect((error as Error).message).not.toMatch(/fatal:|usage:/i);
    }
  });
});
