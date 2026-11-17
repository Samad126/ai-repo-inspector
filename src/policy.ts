import { existsSync, realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/** A request the MCP trust boundary refuses. Message is safe to show the client. */
export class PolicyError extends Error {}

/**
 * Checks an MCP client may ask for. Each maps to a fixed command that is run
 * without a shell, so a client can pick a check but never supply a command.
 * Note: the repo's own package.json defines what these scripts do, so they
 * still execute repo-controlled code.
 */
export const ALLOWED_CHECKS = {
  test: { file: "npm", args: ["test"] },
  typecheck: { file: "npm", args: ["run", "typecheck"] },
  build: { file: "npm", args: ["run", "build"] },
} as const;

export const CHECK_NAMES = ["test", "typecheck", "build"] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

/**
 * Resolve a client-supplied repo path and require it to be a git repository
 * inside `root`. Both sides go through realpath, so `..` and symlinks cannot
 * escape, and the boundary check includes the separator so `/root-evil` is
 * not accepted for `/root`.
 */
export function resolveRepo(input: string, root: string): string {
  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    throw new PolicyError("The configured allowed root does not exist");
  }
  let real: string;
  try {
    real = realpathSync(resolve(input));
  } catch {
    throw new PolicyError("Repository path does not exist");
  }
  if (real !== realRoot && !real.startsWith(realRoot + sep)) {
    throw new PolicyError("Repository path is outside the allowed root");
  }
  if (!existsSync(join(real, ".git"))) {
    throw new PolicyError("Path is not a git repository");
  }
  return real;
}

/** Refs go into `git diff <ref>...HEAD`; reject anything git could parse as an option. */
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/~^@-]*$/;
export function assertSafeRef(ref: string): void {
  if (!SAFE_REF.test(ref) || ref.includes("..")) {
    throw new PolicyError("baseRef contains characters that are not allowed");
  }
}
