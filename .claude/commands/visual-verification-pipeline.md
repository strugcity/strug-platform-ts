You are running the **closed-loop visual verification pipeline** on **$ARGUMENTS**.

If `$ARGUMENTS` is a URL, use it as the target. If it is empty, auto-detect a running dev server by checking `localhost:3000`, `localhost:5173`, `localhost:4321`, `localhost:8080` in that order.

Optional context (extract from user message if provided):
- **Figma reference URL** -- enables design comparison via Figma MCP
- **Testing constitution path** -- e.g., `.visual-testing/constitutions/dashboard.json`

---

## Preflight: Verify Tool Chain

Before starting the pipeline, confirm each required tool is operational.

### Required: Playwright MCP

```
browser_navigate -> { url: "about:blank" }
```

If this fails, report: "Playwright MCP is not available. Cannot proceed with visual verification." and stop.

### Required: Visual Diff MCP

Confirm the Visual Diff MCP tools are registered by checking tool availability. If not available, log: "Visual Diff MCP not available. Pipeline will run without pixel diff and SSIM evaluation (reduced confidence)." Continue in degraded mode.

### Optional: Figma MCP

If a Figma URL was provided, parse the `fileKey` and `nodeId`:

| URL Format | fileKey | nodeId |
|------------|---------|--------|
| `figma.com/design/:fileKey/:fileName?node-id=1-2` | `:fileKey` | `1:2` |
| `figma.com/design/:fileKey/branch/:branchKey/:fileName?node-id=1-2` | `:branchKey` | `1:2` |

Test with:
```
get_design_context -> { fileKey, nodeId }
```

If this fails, log: "Figma MCP not available. Pipeline will run without design baseline comparison." Continue without Figma.

### Optional: Testing Constitution

If a constitution path was provided, read it:

```
Read file at <constitution-path>
```

Parse the JSON. If parsing fails, log the error and continue without constitution-driven evaluation.

If no path was provided, check for a constitution matching the target URL path at `.visual-testing/constitutions/<path-slug>.json`. Use it if found.

---

## Pipeline Variables

Initialize these at session start:

```
TARGET_URL = <resolved target URL>
MAX_ITERATIONS = 5
CURRENT_ITERATION = 0
PREVIOUS_SCORE = 0
MIN_IMPROVEMENT = 5
VIEWPORTS = [
  { name: "mobile",  width: 375,  height: 800 },
  { name: "tablet",  width: 768,  height: 800 },
  { name: "desktop", width: 1280, height: 800 }
]
HAS_BASELINE = false
HAS_VISUAL_DIFF = <true if Visual Diff MCP available>
HAS_FIGMA = <true if Figma MCP available and URL provided>
HAS_CONSTITUTION = <true if constitution loaded>
SESSION_LOG = []
```

---

## Step 1: Capture Baseline (If Available)

If `HAS_FIGMA` is true, fetch the Figma design screenshot as the baseline:

```
get_screenshot -> { fileKey, nodeId }
```

Store this as `BASELINE_SCREENSHOT`. Set `HAS_BASELINE = true`.

If a previous version of the page exists (pre-change screenshots from the current branch), those can also serve as baselines. The pipeline prioritizes: Figma design > pre-change screenshots > no baseline.

---

## Step 2: Capture Current State

For each viewport in `VIEWPORTS`:

### 2a. Resize

```
browser_resize -> { width: <viewport.width>, height: <viewport.height> }
```

### 2b. Navigate

```
browser_navigate -> { url: TARGET_URL }
```

### 2c. Wait for Stability

```
browser_wait_for -> { time: 2 }
```

### 2d. Screenshot

```
browser_take_screenshot -> { type: "png" }
```

Store as `CURRENT_SCREENSHOTS[viewport.name]`.

### 2e. Accessibility Snapshot

```
browser_snapshot -> {}
```

Store as `A11Y_SNAPSHOTS[viewport.name]`.

### Retry Logic

If a screenshot capture fails (blank image, navigation error):
- Retry up to 3 times with a 2-second wait between attempts
- If all retries fail for a viewport, log the failure and continue with remaining viewports
- If all viewports fail, report the error and stop the pipeline

---

## Step 3: Evaluate (Parallel)

Run all three evaluators on the captured screenshots. They are independent and can execute in any order.

### 3a. Visual Diff MCP (if HAS_VISUAL_DIFF and HAS_BASELINE)

For each viewport where both baseline and current screenshots exist:

**Pixel diff:**
```
compare_screenshots -> {
  baseline: <BASELINE_SCREENSHOT or pre-change screenshot>,
  current: <CURRENT_SCREENSHOTS[viewport]>,
  threshold: 0.1,
  includeAntiAlias: false
}
```

Record: `DIFF_PERCENTAGE[viewport]`, `DIFF_IMAGE[viewport]`

**SSIM:**
```
perceptual_compare -> {
  baseline: <baseline>,
  current: <current>
}
```

Record: `SSIM_SCORE[viewport]`, `SSIM_QUALITY[viewport]`

**Highlight overlay:**
```
highlight_differences -> {
  baseline: <baseline>,
  current: <current>
}
```

Record: `HIGHLIGHT_IMAGE[viewport]`, `BOUNDING_BOXES[viewport]`

### 3b. Claude Vision Assessment

For each viewport screenshot, perform a visual evaluation.

**If HAS_CONSTITUTION:**

Evaluate each feature in the constitution:
- Read the feature's `criteria` text
- If the feature has a `selector`, focus evaluation on that element
- Judge: PASS or FAIL against the criteria
- Record per-feature results

Calculate: `VISION_SCORE = (passing_features / total_features) * 100`

**If NOT HAS_CONSTITUTION:**

Evaluate the six standard categories from the visual-verify skill:

1. **Layout / Spacing** -- overflow, broken flex/grid, inconsistent padding, overlapping elements
2. **Typography** -- text too small, wrong font, poor line height, truncation
3. **Color / Contrast** -- insufficient contrast, clashing colors, missing focus indicators
4. **Visual Hierarchy** -- unclear CTA, heading structure, competing visual weight
5. **Component Quality** -- broken/unstyled components, missing states, broken images
6. **Responsiveness** -- content not adapting, horizontal scroll, small touch targets

Rate overall: 1-10 scale.

Calculate: `VISION_SCORE = overall_rating * 10`

Record all findings with severity (Critical / Warning / Info) and specific descriptions.

### 3c. axe-core Accessibility Audit

For the desktop viewport (1280px), run axe-core:

```
browser_evaluate -> {
  function: "async () => {
    if (!window.axe) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';
      document.head.appendChild(s);
      await new Promise(r => { s.onload = r; s.onerror = () => r(); });
    }
    if (!window.axe) return { error: 'axe-core failed to load' };
    return await axe.run();
  }"
}
```

Count violations by severity:
- `CRITICAL_VIOLATIONS` = count of critical
- `SERIOUS_VIOLATIONS` = count of serious
- `MODERATE_VIOLATIONS` = count of moderate
- `MINOR_VIOLATIONS` = count of minor

Calculate: `A11Y_SCORE = max(0, 100 - (CRITICAL * 25) - (SERIOUS * 10) - (MODERATE * 3) - (MINOR * 1))`

If the constitution defines `accessibility.severityThresholds`, use those thresholds to determine pass/fail instead of the formula.

Record violation details (selector, description, impact) for the fix analysis step.

---

## Step 4: Aggregate

Compute the composite score from evaluator outputs.

**With baseline (HAS_BASELINE = true):**

```
COMPOSITE = (VISION_SCORE * 0.35) + (avg(SSIM_SCORE) * 100 * 0.35) + (A11Y_SCORE * 0.30)
```

**Without baseline (HAS_BASELINE = false):**

```
COMPOSITE = (VISION_SCORE * 0.55) + (A11Y_SCORE * 0.45)
```

Record the composite score and per-evaluator scores for this iteration.

**Per-evaluator confidence summary:**

| Evaluator | Score | Confidence |
|-----------|-------|------------|
| Claude Vision | VISION_SCORE/100 | Medium (50-60% spatial accuracy) |
| SSIM | avg(SSIM_SCORE) | High (deterministic) |
| Pixel Diff | avg(DIFF_PERCENTAGE)% changed | High (deterministic) |
| axe-core | A11Y_SCORE/100 | High (rule-based) |

---

## Step 5: Decision

| Composite Score | Decision | Action |
|----------------|----------|--------|
| > 90 | **PASS** | Proceed to Step 7 (proof generation) |
| 75-90 | **WARN** | If fixable Critical/Warning findings exist and CURRENT_ITERATION < MAX_ITERATIONS, proceed to Step 6. Otherwise proceed to Step 7 with advisory. |
| < 75 | **FAIL** | If CURRENT_ITERATION < MAX_ITERATIONS, proceed to Step 6. Otherwise proceed to Step 7 with escalation. |

**Additional stop conditions (proceed to Step 7 regardless of score):**

- `CURRENT_ITERATION >= MAX_ITERATIONS` -- max iterations reached
- `COMPOSITE - PREVIOUS_SCORE < MIN_IMPROVEMENT` and `CURRENT_ITERATION > 0` -- diminishing returns
- `COMPOSITE < PREVIOUS_SCORE` -- score regressed (fix made things worse)
- All Critical findings in current iteration are outside agent scope (design ambiguity, missing tokens, backend dependency)

---

## Step 6: Fix and Re-verify (Loop)

When the decision is FAIL or WARN with fixable issues:

### 6a. Rank Findings

Collect all findings from Step 3 evaluators. Rank by:

1. **Severity first:** Critical > Serious a11y violation > Warning > Moderate a11y > Info > Minor a11y
2. **Impact second:** Issues affecting more viewports rank higher
3. **Fix confidence third:** Issues with clear, specific fixes rank above ambiguous ones

### 6b. Select Top Fix Target

Choose the single highest-ranked finding. Attempting to fix multiple issues simultaneously risks introducing regressions.

### 6c. Apply Fix

Modify the relevant source file to address the finding. Document what was changed:

```
FIXES_APPLIED.push({
  iteration: CURRENT_ITERATION,
  finding: <description>,
  fix: <what was changed>,
  file: <path>
})
```

### 6d. Update Iteration State

```
CURRENT_ITERATION += 1
PREVIOUS_SCORE = COMPOSITE
```

### 6e. Log Iteration

Append to `SESSION_LOG`:

```
### Iteration {CURRENT_ITERATION}

**Fix Applied:** {fix description}
**File:** {file path}
**Composite Score:** {COMPOSITE} ({delta from previous})
- Vision: {VISION_SCORE}/100
- SSIM: {avg SSIM} ({quality})
- A11y: {A11Y_SCORE}/100 ({critical} critical, {serious} serious)

**Top Remaining Findings:**
1. {finding 1}
2. {finding 2}
3. {finding 3}
```

### 6f. Loop Back

Return to **Step 2** (Capture Current State). The dev server should hot-reload the fix automatically. If not, trigger a page refresh.

---

## Step 7: Generate Proof Artifacts

Whether the pipeline passed, warned, or escalated, generate the full proof package.

### 7a. Screenshot Package

For each viewport, compile:

| File | Content |
|------|---------|
| `{viewport}-before.png` | Baseline screenshot (Figma or pre-change) |
| `{viewport}-after.png` | Final iteration screenshot |
| `{viewport}-diff.png` | Pixel diff overlay from Visual Diff MCP |

If no baseline exists, omit the before and diff images.

### 7b. Accessibility Report

```json
{
  "score": A11Y_SCORE,
  "violations": {
    "critical": [],
    "serious": [],
    "moderate": [],
    "minor": []
  },
  "passes": <count>,
  "timestamp": "<ISO 8601>"
}
```

### 7c. Drift Scores (if applicable)

If baseline comparison was performed, include per-dimension drift scores from the visual drift scoring methodology:

```json
{
  "composite": COMPOSITE,
  "dimensions": {
    "layout": <score>,
    "color": <score>,
    "typography": <score>,
    "spacing": <score>,
    "stateCoverage": <score or "N/A">
  },
  "weights": "40/20/15/15/10"
}
```

### 7d. Session Log

Compile the full `SESSION_LOG` as a markdown document showing every iteration, every fix, and every score change. This is the audit trail.

### 7e. PR Comment

Format the final output as a structured PR comment:

```markdown
## Visual Verification Report

**Page:** {TARGET_URL}
**Viewports:** 375px, 768px, 1280px
**Iterations:** {CURRENT_ITERATION} / {MAX_ITERATIONS}
**Final Score: {COMPOSITE}/100 ({PASS|WARN|FAIL})**

| Evaluator | Score | Confidence |
|-----------|-------|------------|
| Claude Vision | {VISION_SCORE}/100 | Medium |
| SSIM | {avg SSIM} ({quality}) | High |
| Pixel Diff | {avg diff}% changed | High |
| axe-core | {A11Y_SCORE}/100 ({critical}c/{serious}s) | High |

### Fixes Applied ({count})
{numbered list of fixes with iteration number}

### Remaining Advisories
{numbered list of unfixed findings, or "None"}

### Constitution Compliance
{if HAS_CONSTITUTION: feature pass/fail table}
{if not: "No testing constitution found for this page."}

### Proof Artifacts
- Screenshots: {viewport}-before.png, {viewport}-after.png, {viewport}-diff.png
- Accessibility report: a11y-report.json
- Drift scores: drift-scores.json
- Session log: session-log.md
```

---

## Tool Chain Reference

This pipeline orchestrates the following tools. Each tool has a specific role and the pipeline degrades gracefully when optional tools are unavailable.

### Playwright MCP (Required)

| Tool | Purpose in Pipeline |
|------|-------------------|
| `browser_navigate` | Load target URL at each viewport |
| `browser_resize` | Set viewport dimensions (375/768/1280 x 800) |
| `browser_wait_for` | Wait for render stability (2s) |
| `browser_take_screenshot` | Capture PNG screenshots for evaluation |
| `browser_snapshot` | Capture accessibility tree for structural context |
| `browser_evaluate` | Inject and run axe-core, extract computed styles |

### Visual Diff MCP (Recommended)

| Tool | Purpose in Pipeline |
|------|-------------------|
| `compare_screenshots` | Pixel diff percentage between baseline and current |
| `perceptual_compare` | SSIM structural similarity score |
| `highlight_differences` | Visual overlay with bounding boxes around changes |
| `generate_report` | Aggregate comparison results into pass/fail |

**Degraded mode:** Without Visual Diff MCP, the pipeline relies on Claude Vision + axe-core only. Composite score uses the no-baseline weighting (55% Vision / 45% A11y). Confidence is reduced.

### Figma MCP (Optional)

| Tool | Purpose in Pipeline |
|------|-------------------|
| `get_screenshot` | Fetch design baseline screenshot for comparison |
| `get_design_context` | Retrieve reference code and design metadata |
| `get_variable_defs` | Fetch design tokens for computed style verification |

**Without Figma MCP:** No design baseline comparison. Pipeline evaluates current state quality without Figma fidelity scoring. Useful for visual bug fixes and general quality checks.

### Claude Vision (Built-in)

Used implicitly through the agent's multimodal capabilities. Evaluates screenshots against either:
- Testing constitution feature criteria (structured evaluation)
- Six-category visual quality rubric (generic evaluation)

### Testing Constitutions (Optional)

| Source | Purpose in Pipeline |
|--------|-------------------|
| `.visual-testing/constitutions/*.json` | Per-page acceptance criteria with selectors, severity levels, and a11y thresholds |

**Without constitution:** The pipeline uses the generic visual-verify six-category rubric. This provides broad coverage but less precision than constitution-driven evaluation.

---

## Edge Cases

### Dev server not running

If no dev server is detected on any of the standard ports:
1. Report: "No dev server detected. Please start your dev server and re-run the pipeline."
2. Do not attempt to start the dev server unless the user explicitly requests it.

### Page requires authentication

If the target URL returns a login page or 401/403:
1. Report: "Target page requires authentication. Please log in via the browser first, then re-run."
2. Do not attempt to fill login forms automatically.

### Large page with scroll

The pipeline captures above-the-fold content only (800px viewport height). For long pages:
1. Note in the report: "Only above-the-fold content was evaluated."
2. If the constitution defines features below the fold, scroll to those elements before capture.

### Dynamic content (timestamps, avatars, random data)

If the constitution defines `ignoreRegions`, apply them as masks during Visual Diff comparison. Without a constitution, the agent should note in findings when dynamic content may be causing false positives.

---

*Protocol reference: `standards/closed-loop-verification.md`*
*Scoring reference: `standards/visual-drift-scoring.md`*
*Constitution guide: `standards/testing-constitution-guide.md`*
*Visual Diff tools: `tools/visual-diff-mcp/README.md`*
