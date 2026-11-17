import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd });

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "inspector-"));
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "a.txt"), "a");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "init");
  git(repo, "checkout", "-q", "-b", "feat");
  writeFileSync(join(repo, "b.txt"), "b");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "change");
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

async function connect() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverSide);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientSide);
  return client;
}

describe("review_repository tool", () => {
  it("uses the repo_path argument it advertises", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "review_repository",
      arguments: { repo_path: repo, baseRef: "main" },
    });
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain(`# Review Report: ${repo}`);
    expect(text).toContain("b.txt (added)");
  });
});
