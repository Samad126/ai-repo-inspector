#!/usr/bin/env node
import { statSync, writeFileSync } from "node:fs";
import { parseArgs, UsageError, USAGE } from "./args.js";
import { reviewRepository } from "./core.js";
import { GitError } from "./git.js";
import { renderReport, reportFileName } from "./report.js";

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n${USAGE}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  // Check up front: a missing cwd otherwise surfaces as a misleading "spawn git ENOENT".
  if (!statSync(args.repositoryPath, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Repository path is not a directory: ${args.repositoryPath}`);
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = await reviewRepository({
      repositoryPath: args.repositoryPath,
      baseRef: args.baseRef,
      validationCommands: args.validations,
    });
  } catch (error) {
    if (error instanceof GitError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  const fileName = reportFileName(args.format);
  writeFileSync(fileName, renderReport(result, args.format), "utf8");
  console.log(`Review report written to ${fileName}`);

  // Exit non-zero when a validation failed so the CLI can gate CI. The report
  // is written first, so the failure details are still available.
  const failed = result.validationResults.filter((v) => v.status === "failed").length;
  if (failed > 0) {
    console.error(`${failed} of ${result.validationResults.length} validations failed`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
