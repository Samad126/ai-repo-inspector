# ai-repo-inspector

TypeScript (ESM, Node >=20) dev tool: inspects Git changes, runs optional validation commands, emits a Markdown report. Exposed via CLI (`src/cli.ts`) and MCP server (`src/mcp-server.ts`).

## Commands
- `npm test` — vitest (tests in `test/`)
- `npm run typecheck` — tsc --noEmit
- `npm run build` — compile to `dist/`
- `npm run inspector` / `npm run mcp-server` — run via tsx

## Layout
- `core.ts` — orchestration, returns a structured `ReviewResult`; `report.ts` — renders Markdown/JSON
- `git.ts` — git access, rename parsing, `GitError`; `validation.ts` — runs shell commands (CLI) and allowlisted checks (MCP)
- `policy.ts` — MCP trust boundary (allowlist, repo root, ref validation, `PolicyError`); `config.ts` — `INSPECTOR_ROOT`
- `args.ts` — CLI parsing; `cli.ts` — CLI adapter; `server.ts` — MCP server (`createServer`); `mcp-server.ts` — stdio entry point
- CLI and MCP must stay behaviorally consistent; share logic in `core.ts`/`report.ts`, not in the entry points.

## Conventions
- ESM: use `.js` extensions in relative imports.
- Validate external input with zod.
- The tool shells out to git/user commands: never build shell strings from untrusted input (see SECURITY.md).
- Run `npm run typecheck && npm test` before finishing a change.
