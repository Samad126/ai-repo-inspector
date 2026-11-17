import { execFileSync } from "node:child_process";
import { assertSafeRef } from "./policy.js";
import type { ChangedFile } from "./types.js";

/** A git problem the user can act on. The message is safe to show to any client. */
export class GitError extends Error {}

type GitResult = { ok: true; stdout: string } | { ok: false; stderr: string };

function runGit(repositoryPath: string, args: string[]): GitResult {
  try {
    const stdout = execFileSync("git", args, {
      cwd: repositoryPath,
      encoding: "utf8",
      // Capture stderr: otherwise git's own error text goes straight to the terminal.
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout };
  } catch (error) {
    const { stderr, code } = error as { stderr?: Buffer | string; code?: string };
    if (code === "ENOENT") throw new GitError("git could not be run (is it installed and on PATH?)");
    return { ok: false, stderr: String(stderr ?? "").trim() };
  }
}

/** Check the preconditions explicitly, so errors do not depend on git's (localized) wording. */
function assertReviewable(repositoryPath: string, base: string): void {
  if (!runGit(repositoryPath, ["rev-parse", "--is-inside-work-tree"]).ok) {
    throw new GitError(`Not a git repository: ${repositoryPath}`);
  }
  if (!runGit(repositoryPath, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]).ok) {
    throw new GitError("This repository has no commits yet, so there is nothing to review");
  }
  if (!runGit(repositoryPath, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]).ok) {
    throw new GitError(
      `Base ref "${base}" was not found in this repository. ` +
        'Specify an existing branch or commit as the base ref (the default is "main").',
    );
  }
}

/**
 * Parse `git diff --name-status -z` output: NUL-separated tokens, where a
 * status token is followed by one path (two for renames and copies). Using -z
 * keeps paths with tabs, quotes or newlines intact.
 */
export function parseNameStatus(output: string): ChangedFile[] {
  const tokens = output.split("\0").filter((token) => token !== "");
  const files: ChangedFile[] = [];
  for (let i = 0; i < tokens.length; ) {
    const code = tokens[i++];
    if (code.startsWith("R") || code.startsWith("C")) {
      const oldPath = tokens[i++];
      const path = tokens[i++];
      files.push({ path, status: code.startsWith("R") ? "renamed" : "copied", oldPath });
    } else {
      const path = tokens[i++];
      files.push({ path, status: code === "A" ? "added" : code === "D" ? "deleted" : "modified" });
    }
  }
  return files;
}

export function changedFiles(repositoryPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";
  assertSafeRef(base);
  // --find-renames is explicit so a user's diff.renames=false cannot change the report.
  assertReviewable(repositoryPath, base);
  const result = runGit(repositoryPath, [
    "diff", "--name-status", "-z", "--find-renames", `${base}...HEAD`,
  ]);
  if (!result.ok) {
    // e.g. no merge base between the base ref and HEAD
    const reason = result.stderr.split("\n")[0] || "unknown error";
    throw new GitError(`Could not compare ${base} with HEAD: ${reason}`);
  }
  return parseNameStatus(result.stdout);
}
