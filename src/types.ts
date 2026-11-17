import type { CheckName } from "./policy.js";

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked";
  /** Previous path, for renamed and copied files. */
  oldPath?: string;
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
};

export type ReportFormat = "markdown" | "json";

/** The structured outcome of a review. Rendering to text is a separate step. */
export type ReviewResult = {
  /** Bump when the shape changes incompatibly. */
  schemaVersion: 1;
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};