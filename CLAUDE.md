# ai-repo-inspector

TypeScript (ESM, Node >=20) dev tool: inspects Git changes, runs optional validation commands, emits a Markdown report. Exposed via CLI (`src/cli.ts`) and MCP server (`src/mcp-server.ts`).

## Commands
- `npm test` — vitest (tests in `test/`)
- `npm run typecheck` — tsc --noEmit
- `npm run build` — compile to `dist/`
- `npm run inspector` / `npm run mcp-server` — run via tsx

## Layout
- `src/core.ts` — inspection logic; `git.ts` — git access; `report.ts` — Markdown output; `validation.ts` — validation command running; `types.ts` — shared types
- CLI and MCP must stay behaviorally consistent; share logic in `core.ts`, not in the entry points.

## Conventions
- ESM: use `.js` extensions in relative imports.
- Validate external input with zod.
- The tool shells out to git/user commands: never build shell strings from untrusted input (see SECURITY.md).
- Run `npm run typecheck && npm test` before finishing a change.
