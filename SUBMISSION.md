
# Submission

## What did you investigate first, and why?

I had Claude Code read `src/` in plan mode (the starter is about 150 lines) and
list bug hypotheses before any edit. I then read the key files myself
(`mcp-server.ts`, `validation.ts`, `git.ts`, `cli.ts`) to check the agent's
list. The seven hypotheses were: the MCP tool reading `repoPath` while
advertising `repo_path`, validation failures crashing the review, `--repo`
being split on spaces, `--format json` being ignored, arbitrary shell execution
over MCP, unrestricted repository paths, and no timeout or output cap.

I treated them as guesses and reproduced each one by hand in a throwaway Git
repo (outside the project) before fixing it. Confirmed by running: the MCP
`repo_path` mismatch (report header `undefined`), the validation crash, the
`--repo` truncation, ignored `--format json`, arbitrary command execution
(a `touch` marker file was created), and renames reported as one `modified`
file with a tab in the path. The path restriction could not be tested while
the argument mismatch hid `repo_path`, so I tested it after that fix. The
timeout and output cap are covered by failing tests, not a manual repro.

Why this order: the trust boundary and the correctness of the report matter
most when AI agents call the tool, and a confirmed reproduction keeps the
fixes honest.

## What did you choose to implement or fix?

One commit per fix, each with a test that failed first. Several commits have
timestamps within minutes of each other because I verified a fix and then
committed it together with the next one, so the history is tidy but the rhythm
is not a live work log.

1. MCP argument mismatch (`repo_path`), with a typed handler and an in-memory MCP test.
2. Failed validations are reported as `failed` instead of crashing the review.
3. 60 s timeout (whole process group killed), 64 KiB output cap with a marker,
   closed stdin, and the real exit status preserved.
4. MCP trust boundary: named checks (`test`, `typecheck`, `build`) run as fixed
   argv without a shell, `INSPECTOR_ROOT` restriction via `realpath`, and
   `baseRef` validation (git would otherwise read `--output=...` as an option).
5. CLI argument parsing: paths with spaces, unknown flags, missing values, format validation.
6. `vitest` no longer runs stale compiled tests from `dist/`.
7. JSON output: `reviewRepository` returns a structured `ReviewResult`
   (`schemaVersion: 1`); Markdown and JSON are renderers over it; MCP returns
   `structuredContent` for JSON. Code fences can no longer be broken by output.
8. Renames and copies parsed correctly (`git diff --name-status -z`).
9. `package.json` `bin` pointed at a file the build never produces.
10. Clear errors for a missing `main`, unknown base ref, no commits and a
    non-repository (explicit `git rev-parse` checks, not parsing git's text).
11. Unknown MCP arguments are an error instead of silently ignored.
12. The CLI exits 1 when a validation fails, so it can gate CI.
13. An invalid `--base-ref` (for example `"a b"` or `-x`) printed a stack trace
    because the CLI caught `GitError` but not `PolicyError`. This was a
    regression from fix 4, found by an independent review and fixed with a test.
14. `checks` accepts each check at most once (maximum 3). Before, a single call
    could queue hundreds of sequential builds.
15. `INSPECTOR_ROOT` is required. The server exits with a message if it is
    missing, does not exist, or is the filesystem root, instead of defaulting
    to the working directory.
16. Test fixes: a test that could pass without anything throwing, a mistitled
    CLI test, and a mocked-`spawn` test that fails if `shell: false` is flipped
    for the allowlisted checks (a mutation check confirmed that it fails when
    the flag is flipped).

Final state: 95 tests in 11 files.

## What did you intentionally not do?

- Uncommitted and untracked files are not reported (only `base...HEAD`).
- No default-branch detection; the error tells the user to pass a base ref.
- No sandbox for the allowlisted `npm` scripts (see limits below).
- No secret redaction or prompt-injection sanitising of file names and command output.
- No `--help`, config file, output-path option or progress output.
- No Windows or macOS support work; the process-group kill is POSIX-specific.
- No environment scrubbing: the checks' npm scripts inherit the server's
  environment, including any secrets in the MCP client configuration.
- No request cancellation, total time budget or concurrency limit on the MCP side.
- I did not test whether options in an untrusted repository's own git config
  (for example `core.fsmonitor`) can run commands during `git diff`.
- I did not run the GitHub Actions workflow or test on Node 20.

## Interface decision

- Decision: **hybrid**, with one shared core.
- Primary user and execution environment: a developer running the CLI locally
  or in CI, and an AI coding agent calling the MCP server over stdio on the
  developer's machine.
- Trust boundary and allowed capabilities: the CLI user is trusted and may pass
  any shell command. The MCP caller is untrusted: it can only choose among
  three named checks (each at most once), only inside a mandatory
  `INSPECTOR_ROOT`, with a validated `baseRef` and strict input (unknown
  arguments rejected). Both have the same timeout
  and output cap. The allowlisted checks still run the target repository's own
  npm scripts, so a malicious repository can execute code; the MCP server
  should only be pointed at repositories the developer trusts.
- Reliability, discoverability, latency/context, and output tradeoffs: problems
  the caller can fix come back as readable `isError` results, not stack traces,
  and unknown arguments are rejected by name. Every argument has a description,
  but the `baseRef` character rules are only in the README. Output is bounded
  per command, not per response: each command keeps at most 64 KiB, so three
  checks can add roughly 192 KiB; `format: json` returns the report twice (as
  text and as `structuredContent`); and the list of changed files has no
  limit. The cap also keeps the start of the output, so a test summary at the
  end of a long log can be lost; keeping both ends would be better. Latency:
  each check has a 60 s limit, so a call with three checks can run 180 s, but
  the MCP client's default request timeout is 60 s, so a slow call can be
  abandoned by the client while the server keeps running it. There is no
  cancellation. The cost of the allowlist is that agents cannot run arbitrary
  commands, which is deliberate.
- How supported interfaces remain consistent: both call `reviewRepository` and
  `renderReport`, so the report content comes from one code path. Differences:
  the command policy, the repo-root check, where output goes (file versus
  inline), the subdirectory rule (the CLI accepts a subdirectory of a repo, MCP
  requires the root), and how a failed validation is signalled (the CLI exits 1;
  MCP returns `isError: false` with the failure inside the report, so an agent
  must read `validationResults`). The last one I have not settled. I did not add
  a test that compares CLI and MCP output directly.
- Evidence that would change this decision: if agents mostly need arbitrary
  commands, the right move is a real sandbox rather than a wider allowlist; if
  almost all use is by agents, I would make MCP primary and trim the CLI; if
  the report is consumed by other programs, I would version and document the
  JSON schema as the main contract.

## How did you use an AI coding agent?

I used Claude Code in plan mode first: it read the code, listed hypotheses and
a plan, and I approved the scope and chose the design (allowlist contents,
root restriction, JSON behaviour, CLI trust level) before any edit. Then it
worked one fix at a time: failing test, fix, verification commands. I ran the
verification commands myself, pasted the output back.

## Where did you check, correct, or reject an AI suggestion? (required)

Cases where the agent was wrong or I did not accept its first answer:

- **I would not accept an unverified bug list.** The agent's first answer
  listed bugs as facts from reading the code, and its plan marked every one as
  a guess. I rejected the plan and asked whether they could be verified. I ran
  the repros myself. Most held, but the agent's prediction for the `--repo`
  case was wrong: it expected an error mentioning the truncated path, and the
  real output was a misleading `spawnSync git ENOENT`. The renaming problem and
  the `undefined` header were only visible by running it.
- **The agent's own timeout design was wrong, and it said so before shipping.**
  The approved plan said to add `timeout` and `maxBuffer` to the existing `exec`
  call. While implementing, the agent realised `exec` kills the child when
  `maxBuffer` is exceeded, so a verbose but passing test run would be reported
  as failed. It switched to `spawn` in its own process group, which discards
  output past the cap while the command finishes. This was the agent catching
  itself, not me.
- **A wrong prediction, caught by running it.** The agent said a silent command
  that times out would give clean output. My run printed
  `'\n[timed out after 500 ms]'`, with a leading newline. A failing test came
  first, then the fix.
- **A wrong claim about my own repository.** The agent said a step was already
  committed and ran a `git stash` check as proof that the tests fail without
  the fix. My `git status` showed the files were still uncommitted, and the
  check had passed against the fixed code, so it proved nothing. This led to
  the worktree approach below.
- **A bug the agent introduced and did not test.** In fix 4 it made
  `assertSafeRef` throw `PolicyError`, but the CLI only caught `GitError`, so
  `--base-ref "a b"` printed a stack trace. An independent review of the
  finished work found it, it was reproduced by running the CLI, and it is fixed
  with a test (item 13).

## Commands used to verify the result, with outcomes

- `npm run typecheck` passes with no errors.
- `npm test`: 11 files, 95 tests passed.
- `npm run build` succeeds.
- For the first four fixes the failing test run was shown in the session before
  the code changed. From the CLI argument fix onward I also copied the new tests
  into a throwaway `git worktree` at the previous commit and ran them there.
  Each set failed as expected (for example 7 failures for JSON, 7 for renames,
  8 for git errors and 3 for strict MCP input). I did not keep logs of those
  runs, so they can be reproduced but not shown.
- Manual runs of the CLI in temporary repositories for each fix (failed
  validation, path with spaces, bad format, rename, missing `main`, no
  commits, non-repository, exit codes).
- Over real stdio, the MCP client script confirmed the structured JSON result,
  that `validationCommands` is rejected, and that no `PWNED` file is created.
- `npm install -g --prefix <tmp> .` then running the installed `inspector`
  command confirmed the `bin` fix.

## A blocker you hit and how you approached it

Proving that each new test fails without its fix. My first approach was
`git stash push src` followed by `npm test`. It passed, which should have been
a failure: `git stash` ignores untracked files, so a brand-new module (such as
`src/args.ts`) stayed in place and the tests still found it. I switched to
creating a throwaway `git worktree` at the previous commit, copying only the
new test files into it, symlinking `node_modules`, and running vitest there.
That fails for the right reason (a missing module or a wrong assertion) and
never touches my working tree. I used it from the CLI argument fix onward.

## Known limitations and the next three things you would do

Limitations:

- Allowlisted checks run repository-controlled scripts (no sandbox).
- Uncommitted and untracked changes are not reported.
- Tested on Linux and Node 24 only; CI uses Node 20 and is unverified.
- The CLI accepts a subdirectory of a repository; the MCP server needs the root.
- No secret redaction in captured command output, and the checks inherit the
  server's environment.
- Output is capped per command, keeps only the start of the log, and the JSON
  response contains the report twice.
- A 60 s limit per check can exceed a typical MCP client's request timeout.
- Whether a failed validation should be an MCP error is undecided.

Next three:

1. Run checks in a sandbox with a scrubbed environment, and redact secrets
   from output.
2. Add a test that CLI and MCP produce identical JSON for the same repository,
   and align the subdirectory behaviour.
3. Keep both ends of long output, add cancellation and a total time budget,
   report uncommitted and untracked changes, and detect the default branch.

## Approximate focused-work time

- Start: November 17, 16:21
- Finish: November 17, 17:51
