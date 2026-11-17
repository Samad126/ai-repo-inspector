import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

export function runValidation(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join("\n");
      if (!error) {
        resolve({ command, status: "passed", output, exitCode: 0 });
        return;
      }
      // A non-zero exit is a normal review outcome, not a tool failure.
      const exitCode = typeof error.code === "number" ? error.code : null;
      resolve({ command, status: "failed", output: output || error.message, exitCode });
    });
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
