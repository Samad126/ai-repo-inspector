import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";
import { CHECK_NAMES, PolicyError, resolveRepo } from "./policy.js";

export type ServerOptions = {
  /** Only repositories inside this directory may be inspected. */
  root: string;
};

export function createServer({ root }: ServerOptions): McpServer {
  const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

  server.tool(
    "review_repository",
    "Inspects a Git repository under the configured root and returns a review report. " +
      "Optional checks (test, typecheck, build) run the repository's npm scripts.",
    {
      repo_path: z.string().describe("Path to a Git repository inside the allowed root."),
      baseRef: z.string().optional().describe("Base ref to diff against. Defaults to main."),
      checks: z
        .array(z.enum(CHECK_NAMES))
        .optional()
        .describe("Named checks to run. Arbitrary commands are not accepted."),
    },
    async ({ repo_path, baseRef, checks }) => {
      try {
        const report = await reviewRepository({
          repositoryPath: resolveRepo(repo_path, root),
          baseRef,
          checks,
        });
        return { content: [{ type: "text", text: report }] };
      } catch (error) {
        if (error instanceof PolicyError) {
          return { isError: true, content: [{ type: "text", text: error.message }] };
        }
        throw error;
      }
    },
  );

  return server;
}
