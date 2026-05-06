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

## Naming & Routing

Use canonical product names only — never deprecated names. Full roster: `strug-standards/standards/naming-roster.md`

When producing PRDs, architecture docs, or SOPs, route to Notion immediately (not as follow-up). Full routing table: `strug-standards/standards/notion-routing.md`

This project's Anti-Strug role: **platform-component**

## Linear (Enforced)

Agents create only at the **Issue** level. Never create Initiatives, Milestones, or Cycles. Pre-create check: search for existing issue first — no duplicates. Full taxonomy and trigger rules: `strug-standards/standards/linear-playbook.md`

## QA Gates (Non-Negotiable)

Before committing or pushing, run:
- **`git status` first** — if the tree is unexpectedly dirty, stop and resolve before proceeding
- **Python files changed:** `python -m py_compile <file>` — fix any errors before committing
- **Frontend files changed:** `npm run lint` — fix all warnings (max-warnings=0)
- **Never use `--no-verify`** to bypass the pre-push hook
- **Never use `git add .` or `git add -A`** — stage only the files this task changed

If a check fails: **stop, fix it, then commit.** Do not push broken code.

Parallel agents must use `isolation: "worktree"` — see `strug-standards/standards/multi-task-work.md`.

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

Frontend changes require visual verification before review. Protocol: `strug-standards/standards/visual-test-guidelines.md`

## Standards Reference

Full SOP: `strug-city/strug-standards` repo
TDD PR Audit protocol: `strug-standards/standards/tdd-pr-audit.md`

<!-- STRUG-STANDARDS-END -->
