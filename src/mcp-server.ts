#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// Repositories outside this directory are refused. Defaults to the server's cwd.
const root = process.env.INSPECTOR_ROOT ?? process.cwd();

await createServer({ root }).connect(new StdioServerTransport());
