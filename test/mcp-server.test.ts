import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { makeRepo } from "./helpers.js";

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
    return {
      isError: Boolean(result.isError),
      text,
      structured: result.structuredContent as Record<string, unknown> | undefined,
    };
  } catch (error) {
    // Older/newer SDKs report schema violations as a thrown protocol error.
    return { isError: true, text: String(error), structured: undefined };
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

describe("review_repository format", () => {
  it("returns JSON text and structuredContent when format is json", async () => {
    const { isError, text, structured } = await call({
      repo_path: repo,
      baseRef: "main",
      checks: ["test"],
      format: "json",
    });
    expect(isError).toBe(false);
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.changedFiles).toEqual([{ path: "b.txt", status: "added" }]);
    expect(parsed.validationResults[0]).toMatchObject({ command: "npm test", status: "passed" });
    expect(structured).toEqual(parsed);
  });

  it("returns markdown without structuredContent by default", async () => {
    const { text, structured } = await call({ repo_path: repo, baseRef: "main" });
    expect(text.startsWith("# Review Report:")).toBe(true);
    expect(structured).toBeUndefined();
  });

  it("rejects an unknown format", async () => {
    const { isError } = await call({ repo_path: repo, baseRef: "main", format: "xml" });
    expect(isError).toBe(true);
  });
});

describe("review_repository git errors", () => {
  it("returns a readable error for an unknown base ref", async () => {
    const { isError, text } = await call({ repo_path: repo, baseRef: "nosuchbranch" });
    expect(isError).toBe(true);
    expect(text).toMatch(/Base ref "nosuchbranch" was not found/);
  });
});

describe("review_repository strict input", () => {
  it.each([
    ["validationCommands", ["echo hi"]],
    ["command", "echo hi"],
    ["repoPath", "/tmp"],
  ])("rejects the unknown argument %s instead of silently ignoring it", async (key, value) => {
    const { isError, text } = await call({ repo_path: repo, baseRef: "main", [key]: value });
    expect(isError).toBe(true);
    expect(text).toContain(key);
  });

  it("advertises additionalProperties:false so clients can see the contract", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer({ root }).connect(serverSide);
    const client = new Client({ name: "test", version: "1" });
    await client.connect(clientSide);
    const { tools } = await client.listTools();
    const schema = tools.find((t) => t.name === "review_repository")!.inputSchema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(["baseRef", "checks", "format", "repo_path"]);
    expect(schema.required).toEqual(["repo_path"]);
  });
});

describe("review_repository checks limits", () => {
  it("rejects repeated checks", async () => {
    const { isError, text } = await call({ repo_path: repo, baseRef: "main", checks: ["build", "build"] });
    expect(isError).toBe(true);
    expect(text).toMatch(/must not repeat/);
  });

  it("rejects a long list of checks without running them", async () => {
    const checks = Array.from({ length: 1000 }, () => "build");
    const started = Date.now();
    const { isError } = await call({ repo_path: repo, baseRef: "main", checks });
    expect(isError).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("advertises at most one of each check in the tool schema", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer({ root }).connect(serverSide);
    const client = new Client({ name: "test", version: "1" });
    await client.connect(clientSide);
    const { tools } = await client.listTools();
    const checks = (tools[0].inputSchema.properties as any).checks;
    expect(checks.maxItems).toBe(3);
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
