import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd });

/** A repo on branch `feat` with one file (b.txt) added relative to `main`. */
export function makeRepo(dir: string) {
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "a.txt"), "a");
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ scripts: { test: "echo ran-test", build: "echo ran-build" } }),
  );
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "init");
  git(dir, "checkout", "-q", "-b", "feat");
  writeFileSync(join(dir, "b.txt"), "b");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "change");
}
