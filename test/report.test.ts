import { describe, expect, it } from "vitest";
import { markdownReport, renderReport, reportFileName } from "../src/report.js";
import type { ReviewResult } from "../src/types.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [{ command: "npm test", status: "passed", output: "ok" }],
    });

    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });
});

const result: ReviewResult = {
  schemaVersion: 1,
  repositoryPath: "/work/sample",
  changedFiles: [{ path: "src/index.ts", status: "modified" }],
  validationResults: [{ command: "npm test", status: "failed", output: "```\nboom", exitCode: 1 }],
};

describe("renderReport", () => {
  it("renders JSON that round-trips to the structured result", () => {
    expect(JSON.parse(renderReport(result, "json"))).toEqual(result);
  });

  it("renders markdown identically to markdownReport", () => {
    expect(renderReport(result, "markdown")).toBe(markdownReport(result));
  });

  it("is not broken by output containing a code fence", () => {
    const md = renderReport(result, "markdown");
    const fenceLines = md.split("\n").filter((l) => /^`{3,}$/.test(l));
    expect(fenceLines[0].length).toBeGreaterThan(3); // outer fence is longer than the inner one
  });
});

describe("reportFileName", () => {
  it("picks the extension from the format", () => {
    expect(reportFileName("markdown")).toBe("review-report.md");
    expect(reportFileName("json")).toBe("review-report.json");
    expect(reportFileName(undefined)).toBe("review-report.md");
  });
});
