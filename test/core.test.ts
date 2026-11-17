import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";
import { makeRepo } from "./helpers.js";

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "core-"));
  makeRepo(repo);
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("reviewRepository", () => {
  it("returns a structured result, not rendered text", async () => {
    const result = await reviewRepository({
      repositoryPath: repo,
      baseRef: "main",
      validationCommands: ["echo hi", "exit 2"],
    });
    expect(result.schemaVersion).toBe(1);
    expect(result.repositoryPath).toBe(repo);
    expect(result.changedFiles).toEqual([{ path: "b.txt", status: "added" }]);
    expect(result.validationResults.map((r) => r.status)).toEqual(["passed", "failed"]);
  });
});
