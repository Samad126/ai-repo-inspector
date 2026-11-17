#!/usr/bin/env node
import { statSync, writeFileSync } from "node:fs";
import { parseArgs, UsageError, USAGE } from "./args.js";
import { reviewRepository } from "./core.js";
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

  const result = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
  });
  const fileName = reportFileName(args.format);
  writeFileSync(fileName, renderReport(result, args.format), "utf8");
  console.log(`Review report written to ${fileName}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
