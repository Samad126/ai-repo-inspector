import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

  server.tool(
    "review_repository",
    "Inspects a Git repository and returns a review report.",
    {
      repo_path: z.string().describe("Repository path to inspect."),
      baseRef: z.string().optional(),
      validationCommands: z.array(z.string()).optional(),
    },
    async ({ repo_path, baseRef, validationCommands }) => {
      const report = await reviewRepository({
        repositoryPath: repo_path,
        baseRef,
        validationCommands,
      });
      return { content: [{ type: "text", text: report }] };
    },
  );

  return server;
}
