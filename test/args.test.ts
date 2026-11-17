import { describe, expect, it } from "vitest";
import { parseArgs, UsageError } from "../src/args.js";

describe("parseArgs", () => {
  it("keeps a repo path that contains spaces intact", () => {
    const args = parseArgs(["review", "--repo", "/tmp/dir with space/a b"]);
    expect(args.repositoryPath).toBe("/tmp/dir with space/a b");
  });

  it("collects repeated --validate flags in order", () => {
    const args = parseArgs(["review", "--repo", "r", "--validate", "npm test", "--validate", "npm run build"]);
    expect(args.validations).toEqual(["npm test", "npm run build"]);
  });

  it("parses base ref and format", () => {
    const args = parseArgs(["review", "--repo", "r", "--base-ref", "develop", "--format", "json"]);
    expect(args).toMatchObject({ baseRef: "develop", format: "json" });
  });

  it("rejects a flag with no value", () => {
    expect(() => parseArgs(["review", "--repo"])).toThrow(UsageError);
    expect(() => parseArgs(["review", "--repo", "--format", "json"])).toThrow(/--repo/);
  });

  it("rejects an unknown flag instead of ignoring it", () => {
    expect(() => parseArgs(["review", "--repo", "r", "--bogus", "x"])).toThrow(/--bogus/);
  });

  it("rejects an unsupported format", () => {
    expect(() => parseArgs(["review", "--repo", "r", "--format", "xml"])).toThrow(/format/);
  });

  it("requires the review command and a repo", () => {
    expect(() => parseArgs([])).toThrow(UsageError);
    expect(() => parseArgs(["review"])).toThrow(/--repo/);
    expect(() => parseArgs(["scan", "--repo", "r"])).toThrow(/command/);
  });
});
