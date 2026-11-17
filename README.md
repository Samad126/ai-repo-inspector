# Repository Inspector

A small TypeScript tool that inspects the changes on a Git branch, optionally
runs validation commands, and produces a review report as Markdown or JSON.
It has two interfaces over one shared core:

- **CLI** for developers, who are trusted to run any command on their own machine.
- **MCP server** for AI agents, which is restricted to a repository root and a
  fixed set of named checks.

Requires Node 20 or newer and `git` on `PATH`.

## Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

## CLI

```bash
npm run inspector -- review --repo ./path/to/repo
npm run inspector -- review --repo ./path/to/repo --base-ref develop --format json
npm run inspector -- review --repo . --validate "npm test" --validate "npm run build"
```

After `npm run build` and `npm install -g .`, the command is `inspector review ...`.

| Option | Meaning |
|---|---|
| `--repo <path>` | Repository to inspect. Required. Paths with spaces are fine. |
| `--base-ref <ref>` | Branch or commit to diff against. Defaults to `main`. |
| `--format markdown\|json` | Report format. Defaults to `markdown`. |
| `--validate <command>` | Shell command to run in the repo. Repeatable. |

The report is written to `review-report.md` (or `review-report.json`) in the
**current directory**.

**Exit codes:** `0` on success, `1` for a usage error, a git problem (no `main`
branch, unknown base ref, no commits, not a repository), or when **any
validation failed**. In the last case the report is still written first.

`--validate` accepts arbitrary shell strings. That is intentional for the CLI:
whoever runs it already controls the machine.

## MCP server

```bash
INSPECTOR_ROOT=/path/to/projects npm run mcp-server
# It prints nothing and waits: it speaks MCP over stdio and expects a client.
```

Example client configuration (after `npm run build`):

```json
{
  "mcpServers": {
    "repository-inspector": {
      "command": "node",
      "args": ["/abs/path/to/ai-repo-inspector/dist/src/mcp-server.js"],
      "env": { "INSPECTOR_ROOT": "/abs/path/to/projects" }
    }
  }
}
```

`INSPECTOR_ROOT` is **required**. The server prints an error and exits 1 if it
is missing, does not exist, or is the filesystem root.

### Tool: `review_repository`

| Argument | Type | Notes |
|---|---|---|
| `repo_path` | string, required | A Git repository **inside `INSPECTOR_ROOT`**. |
| `baseRef` | string, optional | Defaults to `main`. Letters, digits and `. _ / ~ ^ @ -` only; cannot start with `-`. |
| `checks` | array of `test` \| `typecheck` \| `build`, optional | Each at most once. Runs `npm test`, `npm run typecheck` or `npm run build` in the repo. |
| `format` | `markdown` \| `json`, optional | `json` also returns `structuredContent`. Defaults to `markdown`. |

Unknown arguments are rejected with an error that names them. Problems the
caller can fix (path outside the root, not a repository, unknown base ref) come
back as readable `isError` results.

## Trust model

| | CLI | MCP |
|---|---|---|
| Who calls it | A developer on their own machine | An AI agent, treated as untrusted input |
| Commands | Any shell string (`--validate`) | Only `test`, `typecheck`, `build`, run as fixed argv with **no shell** |
| Repository | Any path | Must resolve (via `realpath`) inside `INSPECTOR_ROOT`; `..` and symlink escapes are refused |
| `baseRef` | Validated | Validated so git cannot read it as an option (for example `--output=file`) |
| Limits | 60 s timeout, 64 KiB output per command | Same |

**Known limits**

- The allowlisted checks run the repository's own `npm` scripts, so a malicious
  repository can still execute code through its `package.json`. Only point the
  MCP server at repositories you trust. Real isolation would need a sandbox or
  container, which this tool does not provide.
- The checks inherit the server's environment, including any secrets in the MCP
  client configuration. There is no scrubbing yet.
- Output is capped at 64 KiB **per command**, and the cap keeps the start of
  the output, so a failure summary at the end of a long log can be cut off.
  With `format: json` the report is returned twice (text and
  `structuredContent`), and the list of changed files is not capped.
- Each check may run for 60 s, so a call with three checks can take 180 s. An
  MCP client's default request timeout is often 60 s; it may give up while the
  server keeps working. There is no cancellation or concurrency limit.
- Options in an untrusted repository's own git configuration were not tested.
- A failed validation makes the CLI exit 1, but over MCP the call still
  succeeds (`isError: false`) and the failure is in `validationResults`.

## Output

Markdown lists changed files and each validation's status and output. Code
fences grow to stay longer than any backticks in the output.

JSON (`schemaVersion: 1`):

```json
{
  "schemaVersion": 1,
  "repositoryPath": "/abs/repo",
  "changedFiles": [
    { "path": "new.txt", "status": "renamed", "oldPath": "old.txt" },
    { "path": "b.txt", "status": "added" }
  ],
  "validationResults": [
    { "command": "npm test", "status": "failed", "output": "...", "exitCode": 1,
      "timedOut": true, "truncated": true }
  ]
}
```

`status` for files is `added`, `modified`, `deleted`, `renamed` or `copied`.
`timedOut` and `truncated` appear only when true. Only committed changes
between the base ref and `HEAD` are reported (`git diff <base>...HEAD`);
uncommitted and untracked files are not.

## Project layout

```text
src/core.ts         review orchestration; returns a structured ReviewResult
src/report.ts       renders a ReviewResult as Markdown or JSON
src/git.ts          git inspection, rename parsing, readable git errors
src/validation.ts   runs shell commands (CLI) and allowlisted checks (MCP)
src/policy.ts       MCP trust boundary: allowlist, repo root, ref validation
src/config.ts       reads INSPECTOR_ROOT
src/args.ts         CLI argument parsing
src/cli.ts          command-line adapter
src/server.ts       MCP server definition (createServer)
src/mcp-server.ts   MCP stdio entry point
src/types.ts        shared types
test/               vitest suite
```

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (compiled copies in dist/ are excluded)
npm run build       # tsc, emits to dist/
```

## Limitations

- Tested on Linux with Node 24. CI uses Node 20, and the process-group kill
  used for timeouts is POSIX-specific (untested on Windows and macOS).
- No default-branch detection: pass `--base-ref` when the base is not `main`.
- The CLI accepts a subdirectory of a repository; the MCP server requires the
  repository root.
- A `baseRef` must be a plain branch, tag or commit expression; forms such as
  `HEAD@{1}` are rejected.
