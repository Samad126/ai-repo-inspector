export class UsageError extends Error {}

export type Args = {
  command: "review";
  repositoryPath: string;
  baseRef?: string;
  format?: "markdown" | "json";
  validations: string[];
};

export const USAGE =
  "Usage: inspector review --repo <path> [--base-ref <ref>] [--format markdown|json] [--validate <command>]...";

const FORMATS = ["markdown", "json"] as const;

export function parseArgs(argv: string[]): Args {
  const command = argv[0];
  if (command !== "review") {
    throw new UsageError(`Unknown or missing command: ${command ?? "(none)"}`);
  }

  let repositoryPath: string | undefined;
  let baseRef: string | undefined;
  let format: Args["format"];
  const validations: string[] = [];

  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index];
    if (!["--repo", "--base-ref", "--format", "--validate"].includes(flag)) {
      throw new UsageError(`Unknown option: ${flag}`);
    }
    const value = argv[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new UsageError(`Option ${flag} needs a value`);
    }
    if (flag === "--repo") repositoryPath = value;
    else if (flag === "--base-ref") baseRef = value;
    else if (flag === "--validate") validations.push(value);
    else {
      if (!(FORMATS as readonly string[]).includes(value)) {
        throw new UsageError(`Unsupported format "${value}" (use markdown or json)`);
      }
      format = value as Args["format"];
    }
  }

  if (!repositoryPath) throw new UsageError("Option --repo is required");
  return { command, repositoryPath, baseRef, format, validations };
}
