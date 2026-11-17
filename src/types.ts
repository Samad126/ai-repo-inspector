import type { CheckName } from "./policy.js";

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked";
};

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  output: string;
  exitCode?: number | null;
  timedOut?: boolean;
  truncated?: boolean;
};

export type ReviewRequest = {
  repositoryPath: string;
  baseRef?: string;
  /** Shell command strings. Trusted callers only (the CLI). */
  validationCommands?: string[];
  /** Allowlisted checks, run without a shell. Safe for untrusted callers. */
  checks?: CheckName[];
  format?: "markdown" | "json";
};