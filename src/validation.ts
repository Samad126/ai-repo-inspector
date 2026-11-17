import { spawn } from "node:child_process";
import type { ValidationResult } from "./types.js";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

export type ValidationLimits = {
  timeoutMs?: number;
  maxOutputBytes?: number;
};

export function runValidation(
  command: string,
  cwd: string,
  limits: ValidationLimits = {},
): Promise<ValidationResult> {
  const timeoutMs = limits.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = limits.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  return new Promise((resolve) => {
    // Own process group, so a timeout can kill grandchildren that would
    // otherwise keep the output pipes open.
    const child = spawn(command, {
      cwd,
      shell: true,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let kept = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;

    // Keep draining past the cap so the command can finish and report its
    // real exit status; only the stored output is bounded.
    const collect = (data: Buffer) => {
      const room = maxBytes - kept;
      if (room <= 0) {
        truncated = true;
        return;
      }
      const slice = data.length > room ? data.subarray(0, room) : data;
      if (slice.length < data.length) truncated = true;
      chunks.push(slice);
      kept += slice.length;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    const finish = (status: "passed" | "failed", exitCode: number | null, extra = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const notes = [
        truncated && `[output truncated at ${maxBytes} bytes]`,
        timedOut && `[timed out after ${timeoutMs} ms]`,
        extra,
      ].filter(Boolean);
      const output = [Buffer.concat(chunks).toString("utf8").trimEnd(), ...notes]
        .filter(Boolean)
        .join("\n");
      resolve({
        command,
        status,
        output,
        exitCode,
        ...(timedOut && { timedOut }),
        ...(truncated && { truncated }),
      });
    };

    child.on("error", (error) => finish("failed", null, error.message));
    child.on("close", (code) => finish(code === 0 && !timedOut ? "passed" : "failed", code));
  });
}

export async function runValidations(
  commands: string[],
  cwd: string,
  limits?: ValidationLimits,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd, limits));
  }
  return results;
}
