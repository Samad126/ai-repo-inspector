import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd });

function makeRepo(dir: string) {
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "a.txt"), "a");
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ scripts: { test: "echo ran-test", build: "echo ran-build" } }),
  );
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "init");
  git(dir, "checkout", "-q", "-b", "feat");
  writeFileSync(join(dir, "b.txt"), "b");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "change");
}

let root: string; // the allowed root
let repo: string; // a repo inside the root
let outside: string; // a directory (and repo) outside the root
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "inspector-root-"));
  outside = mkdtempSync(join(tmpdir(), "inspector-outside-"));
  repo = join(root, "repo");
  makeRepo(repo);
  makeRepo(join(outside, "repo"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

async function call(args: Record<string, unknown>) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer({ root }).connect(serverSide);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientSide);
  try {
    const result = await client.callTool({ name: "review_repository", arguments: args });
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    return { isError: Boolean(result.isError), text };
  } catch (error) {
    // Older/newer SDKs report schema violations as a thrown protocol error.
    return { isError: true, text: String(error) };
  }
}

describe("review_repository tool", () => {
  it("uses the repo_path argument it advertises", async () => {
    const { isError, text } = await call({ repo_path: repo, baseRef: "main" });
    expect(isError).toBe(false);
    expect(text).toContain("b.txt (added)");
    expect(text).toContain("Review Report:");
  });

  it("runs allowlisted checks without a shell", async () => {
    const { text } = await call({ repo_path: repo, baseRef: "main", checks: ["test", "build"] });
    expect(text).toContain("### npm test (passed)");
    expect(text).toContain("ran-test");
    expect(text).toContain("### npm run build (passed)");
  });
});

describe("review_repository trust boundary", () => {
  it("never runs arbitrary shell strings", async () => {
    const marker = join(outside, "pwned");
    await call({ repo_path: repo, baseRef: "main", validationCommands: [`touch ${marker}`] });
    expect(existsSync(marker)).toBe(false);
  });

  it("rejects a check that is not on the allowlist", async () => {
    const marker = join(outside, "pwned");
    const { isError } = await call({
      repo_path: repo,
      baseRef: "main",
      checks: [`touch ${marker}`],
    });
    expect(isError).toBe(true);
    expect(existsSync(marker)).toBe(false);
  });

  it("rejects a repo outside the allowed root", async () => {
    const { isError, text } = await call({ repo_path: join(outside, "repo"), baseRef: "main" });
    expect(isError).toBe(true);
    expect(text).toMatch(/outside the allowed root/);
  });

  it("rejects .. traversal out of the root", async () => {
    const { isError } = await call({
      repo_path: join(root, "..", outside.split("/").pop()!, "repo"),
      baseRef: "main",
    });
    expect(isError).toBe(true);
  });

  it("rejects a symlink inside the root that points outside", async () => {
    symlinkSync(join(outside, "repo"), join(root, "escape"));
    const { isError } = await call({ repo_path: join(root, "escape"), baseRef: "main" });
    expect(isError).toBe(true);
  });

  it("rejects a baseRef that git would parse as an option", async () => {
    const target = join(outside, "written");
    const { isError } = await call({ repo_path: repo, baseRef: `--output=${target}` });
    expect(isError).toBe(true);
    expect(existsSync(target + "...HEAD")).toBe(false);
  });
});
