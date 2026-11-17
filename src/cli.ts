#!/usr/bin/env node
import { statSync, writeFileSync } from "node:fs";
import { parseArgs, UsageError, USAGE } from "./args.js";
import { reviewRepository } from "./core.js";

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

  const report = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
    format: args.format,
  });
  writeFileSync("review-report.md", report, "utf8");
  console.log("Review report written to review-report.md");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
