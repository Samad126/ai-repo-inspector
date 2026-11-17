import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("package.json bin", () => {
  it("points at where tsc actually emits src/cli.ts", () => {
    const { compilerOptions } = read("tsconfig.json");
    const emitted = join(compilerOptions.outDir, relative(compilerOptions.rootDir, "src/cli.ts")).replace(/\.ts$/, ".js");
    expect(read("package.json").bin.inspector).toBe(`./${emitted}`);
  });

  it("has a shebang so the installed command is executable by node", () => {
    expect(readFileSync("src/cli.ts", "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
