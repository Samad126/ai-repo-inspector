import { changedFiles } from "./git.js";
import type { ReviewRequest, ReviewResult } from "./types.js";
import { runChecks, runValidations } from "./validation.js";

export async function reviewRepository(request: ReviewRequest): Promise<ReviewResult> {
  const files = changedFiles(request.repositoryPath, request.baseRef);
  const validations = [
    ...(await runValidations(request.validationCommands ?? [], request.repositoryPath)),
    ...(await runChecks(request.checks ?? [], request.repositoryPath)),
  ];
  return {
    schemaVersion: 1,
    repositoryPath: request.repositoryPath,
    changedFiles: files,
    validationResults: validations,
  };
}