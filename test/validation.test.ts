import { describe, expect, it } from "vitest";
import { markdownReport } from "../src/report.js";
import { runValidation, runValidations } from "../src/validation.js";

describe("runValidation", () => {
  it("reports a passing command as passed", async () => {
    const result = await runValidation("echo ok", process.cwd());
    expect(result.status).toBe("passed");
    expect(result.output).toContain("ok");
  });

  it("reports a failing command as failed instead of throwing", async () => {
    const result = await runValidation("echo boom >&2; exit 3", process.cwd());
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(3);
    expect(result.output).toContain("boom");
  });

  it("keeps running later commands after one fails", async () => {
    const results = await runValidations(["exit 1", "echo after"], process.cwd());
    expect(results.map((r) => r.status)).toEqual(["failed", "passed"]);
  });
});

describe("markdownReport", () => {
  it("shows the status of a failed validation", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [{ command: "npm test", status: "failed", output: "x", exitCode: 1 }],
    });
    expect(report).toContain("### npm test (failed)");
  });
});
