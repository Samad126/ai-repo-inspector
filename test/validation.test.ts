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

describe("runValidation limits", () => {
  it("kills a command that exceeds the timeout and marks it failed", async () => {
    const started = Date.now();
    const result = await runValidation("sleep 5", process.cwd(), { timeoutMs: 200 });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(result.status).toBe("failed");
    expect(result.timedOut).toBe(true);
  });

  it("does not start the output with a blank line when a silent command times out", async () => {
    const result = await runValidation("sleep 5", process.cwd(), { timeoutMs: 200 });
    expect(result.output).toBe("[timed out after 200 ms]");
  });

  it("kills the whole process tree, not just the shell", async () => {
    const started = Date.now();
    const result = await runValidation("sh -c 'sleep 5; echo done'", process.cwd(), {
      timeoutMs: 200,
    });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(result.output).not.toContain("done");
  });

  it("truncates large output with a visible marker but keeps the real exit status", async () => {
    const result = await runValidation("yes x | head -c 100000", process.cwd(), {
      maxOutputBytes: 1000,
    });
    expect(result.status).toBe("passed");
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.output)).toBeLessThan(1200);
    expect(result.output).toContain("[output truncated");
  });

  it("does not leave a trailing blank line in output", async () => {
    const result = await runValidation("echo ok", process.cwd());
    expect(result.output).toBe("ok");
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

describe("runValidation stdin", () => {
  it("gives commands a closed stdin so they cannot hang waiting for input", async () => {
    const result = await runValidation("cat; echo eof", process.cwd(), { timeoutMs: 2000 });
    expect(result.status).toBe("passed");
    expect(result.output).toBe("eof");
  });
});
