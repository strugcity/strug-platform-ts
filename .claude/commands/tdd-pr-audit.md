You are performing a TDD PR audit on **PR #$ARGUMENTS**.

Check the PR to determine how many prior review rounds exist, then follow the full protocol.

## Step 0: PR State Gate

Before doing anything else, check the PR state:

```bash
gh pr view $ARGUMENTS --json state,mergedAt,headRefName
```

**Rules — enforce strictly, no exceptions:**
- `state == "MERGED"` → **HALT immediately.** Output: `PR #$ARGUMENTS is already merged. Auditing a merged PR is a no-op. Exiting.` Do not proceed to any further step.
- `state == "CLOSED"` → **HALT immediately.** Output: `PR #$ARGUMENTS is closed. No active branch to audit or fix. Exiting.`
- `state == "OPEN"` → store the `headRefName` value as `HEAD_BRANCH` (you will need it in Step 7), then proceed.

## Step 1: Gather Context

```
gh pr view $ARGUMENTS --json title,body,files,reviews,comments
gh pr diff $ARGUMENTS
```

Read the full content of every changed file (not just the diff).

Parse prior audit round comments — look for comments containing `## TDD Audit — PR #$ARGUMENTS · Round`. For each one found, extract the per-round stats row. You will need these to build the cumulative summary table in Step 7. The number of prior audit comments determines the current round number (e.g., 0 prior = this is Round 1).

## Step 2: Run Review Agents

Launch these pr-review-toolkit agents in parallel against the PR diff:

- `code-reviewer` — style, patterns, CLAUDE.md adherence
- `silent-failure-hunter` — catch blocks, fallback behavior, swallowed errors
- `type-design-analyzer` — type invariants, encapsulation
- `pr-test-analyzer` — test coverage gaps

Collect all findings into a single list.

## Step 3: Independent Audit

For each finding from Step 2:

1. **Read the actual file** (not just the diff context) to verify the finding is real.
2. **Cross-reference with the codebase** — does the issue actually exist, or is the code correct?
3. **Check prior review comments** — if a prior reviewer flagged something that is actually correct, mark it as a false finding.

Remove false positives. Categorize confirmed findings: `bug`, `type-safety`, `test-gap`, `style`, `security`.

## Step 4: Write Failing Tests

For **every confirmed finding**, write a test that:
- Fails on the current code
- Will pass after the fix is applied
- Has a comment: `// Audit PR #$ARGUMENTS: [finding description]`

Test file naming: `<module>.audit.test.ts` or `test_<module>_audit.py`

Run the test suite to confirm all new audit tests fail:
```
# TypeScript projects:
npx vitest run --reporter=verbose
# Python projects:
pytest -q
```

## Step 5: Implement Fixes

Fix each issue one at a time. After each fix:
1. Run the specific audit test — confirm it now passes.
2. Run the full test suite — confirm zero regressions.

```
# TypeScript projects:
npx vitest run
tsc --noEmit
# Python projects:
pytest -q
```

If a fix touches shared code (types, helpers, DB interfaces), run tests across all consuming modules.

## Step 6: Final Verification

Run the complete verification stack:
```
# TypeScript projects:
tsc --noEmit
npx eslint . --max-warnings=0
npm run build   # Next.js only — catches broken dynamic imports and missing env references
npx vitest run
# Python projects:
pytest -q
```

All audit tests must pass. All pre-existing tests must still pass. Zero regressions.

Review your own diff to ensure no unrelated changes crept in.

## Step 7: Push Fixes

**Before pushing, re-verify PR state** — the PR may have been merged while the audit was running:

```bash
gh pr view $ARGUMENTS --json state
```

- `state != "OPEN"` → **HALT. Do not push.** Output: `PR #$ARGUMENTS state changed to [state] during audit. Findings are on disk but not pushed. Review manually.`
- `state == "OPEN"` → proceed.

Push fixes directly to the PR branch:
```bash
git push origin $HEAD_BRANCH
```

The PR is updated.

**Post the following as a PR comment, then output it verbatim in the session as your final message. Both are mandatory — the PR comment so future rounds can read prior stats; the session output so the operator sees it now. Never substitute "see the Linear ticket" or "see Notion" for the inline session output.**

Determine the current round number from prior audit comments collected in Step 1. Build the table with one row per prior round (stats parsed from their comments) plus the current round bolded.

```
## TDD Audit — PR #$ARGUMENTS · Round R

| Round | Findings | False Positives | Tests Written | Fixes Applied | Regressions |
|-------|----------|-----------------|---------------|---------------|-------------|
| 1     | X        | X               | X             | X             | 0           |
| **R (this)** | **X** | **X**      | **X**         | **X**         | **0**       |
| **Total** | **X** | **X**         | **X**         | **X**         | **0**       |

Issues remaining: 0
```

If this is Round 1, the table has only the current round row and the total row (they are identical).

## Step 8: Post-Audit

1. **Post retrospective to Notion** at `Engineering/Standards & SOPs` with metrics, findings, and learnings.
2. **Update qa-learnings-template.md** with any new rules discovered. Each new rule **must** be tagged on the line immediately before its bullet:

   ```
   <!-- qa: tier=critical stacks=typescript,supabase -->
   - **Rule text...**
   ```

   **Tier:** `critical` (severe consequence, agent reliably violates) or `reference` (never synced, lookup only).
   **Stacks:** `all` or comma-separated from `python`, `typescript`, `supabase`, `nextjs` — project must have ALL listed.

   Then run both sync scripts (from the `strug-standards` repo root):
   ```bash
   node scripts/sync-claude-md.js --all
   node scripts/sync-qa-learnings.js --all
   ```
