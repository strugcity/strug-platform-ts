# CLAUDE.md — Strug Platform TS

## Project Overview

TypeScript monorepo for cross-product Strug City packages.
Initial package: `@strugcity/calendar-primitives` (ICS parsing, ETag fetching, subscription state, change detection).

## Tech Stack
- TypeScript 5.x
- npm workspaces
- Vitest (unit tests)
- ESLint 9 + typescript-eslint

## Build & Lint Commands
- `npm run build` — compile all packages (`tsc --build`)
- `npm run lint` — ESLint all package src files
- `npm run typecheck` — typecheck without emitting
- `npm test` — run all tests (`vitest run`)
- `npm run test:watch` — watch mode

## Critical Rules
- This is a shared library. Any breaking change requires a version bump **before** any consumer repo imports the new version.
- All exported types and functions must have JSDoc comments.
- Phase 2 surfaces (GCal OAuth, Apple CalDAV, outbound feed) are **typed and stubbed only**. Do not implement until a consuming product opens an issue requesting it.
- Before adding any dependency, verify it does not break Metro bundler (Expo/React Native) compatibility — check bundle size and ESM/CJS support.
- SSRF guard is **non-negotiable** on all URL-fetching code. See `packages/calendar-primitives/src/fetching/ssrf.ts`.
- The `dist/` directory is never committed — it is built on publish.

---

<!-- STRUG-STANDARDS-BEGIN: do not edit this block manually — run sync-claude-md.js -->

> **Resolving the `../strug-standards/...` paths below.** They are relative to **this repository's root** — the directory `git rev-parse --show-toplevel` prints — not to the directory you happen to be reading from. This matters when you are in a worktree: this file is tracked, so it also appears at `.claude/worktrees/<name>/CLAUDE.md`, and resolved from there every path below lands somewhere that does not exist. Resolve from the repo root, or use `$(git rev-parse --show-toplevel)/../strug-standards/...`.

## Naming & Routing

Use canonical product names only — never deprecated names. Full roster: `../strug-standards/standards/naming-roster.md`

When producing PRDs, architecture docs, or SOPs, route to Notion immediately (not as follow-up). Full routing table: `../strug-standards/standards/notion-routing.md`

This project's Anti-Strug role: **platform-component**

## Linear (Enforced)

Agents create only at the **Issue** level. Never create Initiatives, Milestones, or Cycles. Pre-create check: search for existing issue first — no duplicates. Full taxonomy and trigger rules: `../strug-standards/standards/linear-playbook.md`

## PR Closing Block (Required)

Every PR description must end with a closing block — one line per Linear issue this PR resolves:

```
Closes SCE-123
Closes SCE-456
```

Linear's GitHub integration reads these lines on merge and automatically transitions the linked issues to Done. Without this block, tickets stay open after merge and must be closed manually.

## Design System

Before building or changing UI, read this project's **canonical** design source — the briefs and
system docs under `docs/design/`, not a derived artifact.

Derived artifacts (token files, generated CSS, compiled Tailwind config, exported style JSON) are
outputs. They omit the invariants the canon encodes — spacing rationale, state coverage,
accessibility constraints, when *not* to use a component — so they are insufficient inputs on their
own. Building from a derived artifact is how a UI ends up technically on-token and still wrong.

If a project has no `docs/design/` canon, say so rather than inferring the system from existing
components.

## Linear MCP (Non-Negotiable)

Use `mcp__plugin_linear_linear__<tool>` directly. The token is stored and valid across sessions — do not start a new auth flow.

- **Never** use `mcp__claude_ai_Linear__authenticate` — wrong server, triggers unnecessary OAuth
- **Never** tell the user to run `/mcp` to authenticate Linear
- If a Linear tool call fails, verify you are using the `mcp__plugin_linear_linear__` prefix before assuming the token is expired

## QA Gates (Non-Negotiable)

Before committing or pushing, run:
- **`git status` first** — if the tree is unexpectedly dirty, stop and resolve before proceeding
- **Python files changed:** `python -m py_compile <file>` — fix any errors before committing
- **Frontend files changed:** `npm run lint` — fix all warnings (max-warnings=0)
- **Never use `--no-verify`** to bypass the pre-push hook
- **Never use `git add .` or `git add -A`** — stage only the files this task changed

If a check fails: **stop, fix it, then commit.** Do not push broken code.

## Worktrees (Enforced)

The main working tree is **read-only for branch work** — it is shared state, and two sessions there clobber each other's HEAD. A PreToolUse hook blocks `git checkout`/`switch`/`rebase`/`reset --hard` **and `gh pr checkout`** from the main root; they exit with an error. This applies to PR reviews too — reviewing a PR is branch work, not an exception.

- **Reviewing a PR?** Never `gh pr checkout` in the main tree. Create a worktree first:
  `git worktree add --detach .claude/worktrees/pr-<n> && cd .claude/worktrees/pr-<n> && gh pr checkout <n>`
- **Any feature/branch work?** `git worktree add .claude/worktrees/<name> <branch>`, then work there.
- Parallel agents must use `isolation: "worktree"` — see `../strug-standards/standards/multi-task-work.md`.

### Retiring a finished worktree

**Do not retire a worktree by hand, and never from inside it.** Run the tool, from the main root:

```
node ../strug-standards/scripts/retire-merged-worktrees.js --dry-run   # report only; deletes nothing
node ../strug-standards/scripts/retire-merged-worktrees.js             # retire what qualifies
node ../strug-standards/scripts/retire-merged-worktrees.js --repo <path>
```

It lives in the standards checkout and acts on **any** repo via `--repo`, so it is not copied here — there is one copy to keep correct, not eight.

`--dry-run` deletes nothing, but it is **not inert**: it still proves containment, which fetches `refs/pull/<n>/head` from `origin` into a temp ref. That is deliberate — a dry run that cannot tell you the merge oracle is down is not a safe way to inspect a repo.

**"The PR is merged, so `-D` is safe" is false, and is why this tool exists.** A merged PR says nothing about what the LOCAL branch holds. Twice in one day the local tip was not the merged head, and on its first real run this tool refused a retirement because the branch held 1,028 lines that were never pushed. It proves containment against `refs/pull/<n>/head` every time instead of when someone remembers to.

It retires a worktree only when all of these are PROVEN — never assumed, and a check that could not run is never treated as a pass:

- you are not standing inside the worktree being retired (`--repo` does not make that safe — it re-aims the git operations, not the process)
- the worktree is clean, and `gh` reported a MERGED PR whose head OID matches the ref actually fetched
- the local tip is an ancestor of that merged head, and is still the tip at the moment of deletion
- nothing has the branch checked out — re-established immediately before deleting, because removing the worktree is what frees the branch

Anything it cannot establish *before it touches anything* is reported and **skipped**. If a fact comes apart later — after the worktree is already gone — the line reads `PARTIAL` instead, and the branch is left alone. Either way the run exits non-zero, so a hook reading `$?` can tell "nothing to do" from "the merge oracle was down". A skip that rests on proof — `locked`, `detached HEAD — no branch to retire`, uncommitted work, no merged PR for this branch — is an answer, not a failure, and keeps the run green.

Read the line either way, but do not expect a remedy on all of them. Every `PARTIAL` carries one: the worktree is gone and its branch outlived it, and the line says what to do about that. A `SKIP` that could not establish something usually names only the cause (`could not ask GitHub whether this branch was merged: …`) — fix the cause it names.

If you are inside the worktree you want to retire, leave it first (`ExitWorktree` with action `keep` returns the session to the main root), then run the tool from there.

If node reports `Cannot find module`, you are running it from somewhere that path does not resolve from — see the note at the top of this block. Run it from the repository root; from inside `.claude/worktrees/<name>` it will not resolve. That is the same mistake, caught one step earlier by the wrong error message.

## CI Failure Protocol

When CI fails:
1. `gh run list --branch <branch> --limit 3`
2. `gh run view <run-id> --log-failed`
3. Read the FULL traceback — note file paths inside site-packages
4. Only then write a fix

Never fix from Copilot/AI summaries. Never guess at the error.

## Writing Tests

| Scenario | How to test |
|---|---|
| Invalid Pydantic field | `pytest.raises(ValidationError)` at constructor |
| Invalid HTTP payload | TestClient + raw JSON, assert 422 |
| Business logic error | Valid model, call endpoint, assert HTTPException |
| Auth failure | Test with/without credentials, missing config = 401 not 500 |

## Visual Verification

Frontend changes require visual verification before review. Protocol: `../strug-standards/standards/visual-test-guidelines.md`

## Standards Reference

Full SOP: `../strug-standards/`
TDD PR Audit protocol: `../strug-standards/standards/tdd-pr-audit.md`

<!-- STRUG-STANDARDS-END -->
