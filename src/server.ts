import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { GitError } from "./git.js";
import { CHECK_NAMES, PolicyError, resolveRepo } from "./policy.js";
import { renderReport } from "./report.js";

export type ServerOptions = {
  /** Only repositories inside this directory may be inspected. */
  root: string;
};

export function createServer({ root }: ServerOptions): McpServer {
  const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

  // .strict(): unknown arguments are an error. Silently dropping them would let
  // a client believe it had run validation (or passed a path) when it had not.
  const inputSchema = z
    .object({
      repo_path: z.string().describe("Path to a Git repository inside the allowed root."),
      baseRef: z.string().optional().describe("Base ref to diff against. Defaults to main."),
      checks: z
        .array(z.enum(CHECK_NAMES))
        .optional()
        .describe("Named checks to run. Arbitrary commands are not accepted."),
      format: z
        .enum(["markdown", "json"])
        .optional()
        .describe("Report format. json also returns structuredContent. Defaults to markdown."),
    })
    .strict();

  server.registerTool(
    "review_repository",
    {
      description:
        "Inspects a Git repository under the configured root and returns a review report. " +
        "Optional checks (test, typecheck, build) run the repository's npm scripts.",
      inputSchema,
    },
    async ({ repo_path, baseRef, checks, format }) => {
      try {
        const result = await reviewRepository({
          repositoryPath: resolveRepo(repo_path, root),
          baseRef,
          checks,
        });
        const text = renderReport(result, format);
        return format === "json"
          ? { content: [{ type: "text" as const, text }], structuredContent: { ...result } }
          : { content: [{ type: "text" as const, text }] };
      } catch (error) {
        if (error instanceof PolicyError || error instanceof GitError) {
          return { isError: true, content: [{ type: "text", text: error.message }] };
        }
        throw error;
      }
    },
  );

  return server;
}
