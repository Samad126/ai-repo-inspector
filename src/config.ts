import { realpathSync } from "node:fs";
import { parse } from "node:path";
import { PolicyError } from "./policy.js";

/**
 * The MCP server's repository root comes from INSPECTOR_ROOT and has no
 * default: a default of the working directory would silently become "anything
 * under $HOME" (or "/") whenever a client launches the server from there.
 */
export function resolveRoot(env: NodeJS.ProcessEnv): string {
  const raw = env.INSPECTOR_ROOT?.trim();
  if (!raw) {
    throw new PolicyError(
      "INSPECTOR_ROOT is not set. Set it to the directory that contains the repositories this server may inspect.",
    );
  }
  let real: string;
  try {
    real = realpathSync(raw);
  } catch {
    throw new PolicyError(`INSPECTOR_ROOT does not exist: ${raw}`);
  }
  if (real === parse(real).root) {
    throw new PolicyError("INSPECTOR_ROOT is too broad (the filesystem root); choose a narrower directory");
  }
  return real;
}
