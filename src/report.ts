import type { ReportFormat, ReviewResult } from "./types.js";

type ReportInput = Pick<ReviewResult, "repositoryPath" | "changedFiles" | "validationResults">;

/** A code fence longer than any backtick run inside `text`, so output cannot close it early. */
function fenceFor(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

export function markdownReport(input: ReportInput): string {
  const lines = [`# Review Report: ${input.repositoryPath}`, "", "## Changed files"];
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("", "## Validation output");
  for (const result of input.validationResults) {
    const fence = fenceFor(result.output);
    lines.push(`### ${result.command} (${result.status})`, fence, result.output, fence);
  }
  return lines.join("\n");
}

export function renderReport(result: ReviewResult, format: ReportFormat = "markdown"): string {
  return format === "json" ? JSON.stringify(result, null, 2) : markdownReport(result);
}

export function reportFileName(format: ReportFormat = "markdown"): string {
  return format === "json" ? "review-report.json" : "review-report.md";
}
