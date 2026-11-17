import { execFileSync } from "node:child_process";
import { assertSafeRef } from "./policy.js";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
  });
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
  const output = git(repositoryPath, [
    "diff", "--name-status", "-z", "--find-renames", `${base}...HEAD`,
  ]);
  return parseNameStatus(output);
}
