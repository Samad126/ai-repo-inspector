#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveRoot } from "./config.js";
import { PolicyError } from "./policy.js";
import { createServer } from "./server.js";

let root: string;
try {
  root = resolveRoot(process.env);
} catch (error) {
  if (error instanceof PolicyError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

await createServer({ root }).connect(new StdioServerTransport());
