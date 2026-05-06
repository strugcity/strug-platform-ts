You are generating a **visual drift score** for a PR by comparing a Figma design to its rendered implementation. This skill produces a quantitative composite score (0-100) with per-dimension breakdowns and a pass/warn/block recommendation.

**Input:** $ARGUMENTS

Expected arguments: `<figma-url> <rendered-url>`

If arguments are missing, ask the user for:
1. A Figma URL (format: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y`)
2. The rendered page URL (local dev server, Vercel preview, or production)

---

## Step 1: Parse Figma URL and Extract Identifiers

Extract `fileKey` and `nodeId` from the Figma URL.

| URL Format | fileKey | nodeId |
|------------|---------|--------|
| `figma.com/design/:fileKey/:fileName?node-id=1-2` | `:fileKey` | `1:2` |
| `figma.com/design/:fileKey/branch/:branchKey/:fileName?node-id=1-2` | `:branchKey` | `1:2` |

Convert dashes in node IDs to colons (URL `1-2` becomes API `1:2`).

If no `node-id` parameter is present, ask the user which frame or component to score.

---

## Step 2: Fetch Figma Design Baseline

### 2a. Fetch design context

Call Figma MCP `get_design_context` with the extracted `fileKey` and `nodeId`.

Save:
- The **screenshot** as the design baseline image
- Frame **dimensions** for viewport matching
- Any **Code Connect mappings** for component identification

### 2b. Fetch design tokens

Call Figma MCP `get_variable_defs` with the same `fileKey` and `nodeId`.

Record all token values as ground truth:
- Colors (hex, rgba)
- Spacing (px, rem)
- Typography (font-family, font-size, font-weight, line-height)
- Border radius, shadows, opacity

---

## Step 3: Capture Rendered Implementation

### 3a. Match viewport to Figma frame

Use the frame dimensions from Step 2a. If unavailable, default to 1280x800.

```
browser_resize -> { width: <frame_width>, height: <frame_height> }
```

### 3b. Navigate and stabilize

```
browser_navigate -> { url: "<rendered-url>" }
browser_wait_for -> { time: 2 }
```

Wait 2 seconds for animations to settle and fonts to load.

### 3c. Capture rendered screenshot

```
browser_take_screenshot -> { type: "png" }
```

Save this as the rendered output image.

---

## Step 4: Deterministic Comparison via Visual Diff MCP

Run all three comparison tools against the Figma baseline and rendered screenshots.

### 4a. Pixel diff

Call Visual Diff MCP `compare_screenshots` with both images:

```json
{
  "baseline": "<figma-screenshot-base64>",
  "current": "<rendered-screenshot-base64>",
  "threshold": 0.1,
  "includeAntiAlias": false
}
```

Record: `diffPercentage`, `diffPixels`, `diffImage`.

### 4b. Perceptual similarity

Call Visual Diff MCP `perceptual_compare` with both images.

Record: `ssim` (overall), `channels` (per R/G/B), `qualityAssessment`.

### 4c. Region highlighting

Call Visual Diff MCP `highlight_differences` with both images.

Record: the overlay image and bounding box coordinates for changed regions.

---

## Step 5: Per-Dimension Scoring

Score each of the five dimensions on a 0-100 scale. Use the measurement hierarchy: deterministic evidence first, vision assessment for what deterministic tools cannot measure.

### 5a. Layout Match (weight: 40%)

**Deterministic signals:**
- Pixel diff percentage from Step 4a (lower = better layout match)
- Bounding box analysis from Step 4c (count and size of changed regions)
- SSIM score from Step 4b (structural similarity)

**Vision assessment:**
Compare the Figma baseline and rendered screenshots side by side. Evaluate:
- Overall structure: header, content, sidebar, footer arrangement
- Element positioning and alignment
- Flex/grid layout fidelity
- Element ordering and stacking
- Responsive behavior at tested viewport

**Computed style verification (if score < 90):**
For elements in changed regions, extract:
```javascript
() => {
  const el = document.querySelector('<selector>');
  const s = getComputedStyle(el);
  return { display: s.display, flexDirection: s.flexDirection, gridTemplateColumns: s.gridTemplateColumns, position: s.position, width: s.width, height: s.height };
}
```

**Scoring guide:**
- 100: SSIM >= 0.98, diffPercentage < 0.5%, no structural bounding boxes
- 85-99: SSIM >= 0.92, diffPercentage < 3%, minor positional offsets
- 70-84: SSIM >= 0.80, some elements mispositioned, structure recognizable
- 50-69: SSIM >= 0.65, missing or rearranged sections
- 0-49: SSIM < 0.65, fundamentally different layout

### 5b. Color Accuracy (weight: 20%)

**Deterministic signals:**
- Per-channel SSIM from Step 4b (R/G/B channel scores reveal color shifts)
- Design tokens from Step 2b as ground truth

**Computed style verification:**
For key elements, extract and compare against tokens:
```javascript
() => {
  const elements = document.querySelectorAll('<key-selectors>');
  return Array.from(elements).map(el => {
    const s = getComputedStyle(el);
    return { selector: el.className, color: s.color, backgroundColor: s.backgroundColor, borderColor: s.borderColor };
  });
}
```

**Vision assessment:**
- Are background colors visually correct?
- Are text colors correct (light/dark, brand colors)?
- Are borders and dividers the right color?
- Are shadows and gradients present and correct?

**Scoring guide:**
- 100: All extracted colors match design tokens exactly
- 85-99: Minor deviations (similar shades, correct family)
- 70-84: Some colors noticeably off but functional
- 50-69: Multiple clearly wrong colors
- 0-49: Major color failures (missing backgrounds, invisible text, wrong theme)

### 5c. Typography Fidelity (weight: 15%)

**Computed style verification (primary):**
```javascript
() => {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, label');
  return Array.from(headings).slice(0, 20).map(el => {
    const s = getComputedStyle(el);
    return { tag: el.tagName, text: el.textContent.substring(0, 30), fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing };
  });
}
```

Compare each extracted value against design tokens from Step 2b.

**Vision assessment:**
- Is the correct typeface visually rendering (not a fallback)?
- Are headings visually distinguishable by size/weight hierarchy?
- Is text alignment correct?

**Scoring guide:**
- 100: All typography properties match tokens
- 85-99: Correct font family, minor size or weight deviations
- 70-84: Some properties wrong (wrong weight, line-height off)
- 50-69: Wrong font family loaded or major sizing issues
- 0-49: Typography fundamentally broken

### 5d. Spacing Precision (weight: 15%)

**Computed style verification (primary -- vision is unreliable for spacing):**
```javascript
() => {
  const containers = document.querySelectorAll('main, section, article, header, footer, nav, aside, [class*="card"], [class*="container"]');
  return Array.from(containers).slice(0, 15).map(el => {
    const s = getComputedStyle(el);
    return { selector: el.className || el.tagName, padding: s.padding, margin: s.margin, gap: s.gap, rowGap: s.rowGap, columnGap: s.columnGap };
  });
}
```

Compare against spacing tokens from Step 2b.

**Bounding box analysis:**
Use the changed-region bounding boxes from Step 4c. If bounding boxes are offset from expected positions, calculate the offset in pixels as a spacing error signal.

**Scoring guide:**
- 100: All spacing matches tokens within 1px
- 85-99: Mostly correct, deviations under 4px
- 70-84: Noticeable issues (4-12px deviations)
- 50-69: Significant errors affecting visual rhythm
- 0-49: Spacing completely wrong

### 5e. Component State Coverage (weight: 10%)

**Check for defined states in Figma:**
If the Figma component has variants for hover, focus, disabled, active, or error states, those states should be implemented.

**Test interaction states:**

1. **Hover:** Use `browser_hover` on buttons and links, capture screenshot, compare to Figma hover variant
2. **Focus:** Use `browser_click` on inputs/buttons, capture screenshot, check for focus ring
3. **Disabled:** Use accessibility snapshot to find `[disabled]` or `[aria-disabled]` elements, verify styling
4. **Active:** Press and hold (if possible), or check CSS `:active` via computed styles

**If design does not define states:** Mark as N/A. Redistribute weight proportionally:
- Layout: 44.4%, Color: 22.2%, Typography: 16.7%, Spacing: 16.7%

**Scoring guide:**
- 100: All defined states implemented and visually correct
- 85-99: Most states present, minor styling differences
- 70-84: Some states missing or incorrectly styled
- 50-69: Most states missing
- 0-49: No interaction states implemented

---

## Step 6: Compute Composite Score

Calculate the weighted composite:

```
composite = (layout_score * 0.40) + (color_score * 0.20) + (typography_score * 0.15)
          + (spacing_score * 0.15) + (state_score * 0.10)
```

If any dimension is N/A, redistribute its weight proportionally across remaining dimensions.

Determine the verdict:

| Score | Verdict | Action |
|-------|---------|--------|
| >= 91 | PASS (Excellent) | No action required |
| 75-90 | PASS (Good) | Advisory findings noted |
| 60-74 | WARN | Does not block merge, flags for design review |
| < 60 | BLOCK | Must be fixed before merge or design team must approve deviation |

---

## Step 7: Generate Actionable Fixes

For every dimension scoring below 90, list specific findings with fix suggestions:

Format each finding as:

```
**[Dimension]: [what is wrong]**
- Design value: [from Figma tokens]
- Rendered value: [from computed styles]
- Impact: -[points deducted] on [dimension] score
- Fix: [specific CSS/Tailwind/component prop change]
```

Prioritize findings by score impact (largest deductions first).

---

## Step 8: Output Structured Report

Output the complete drift report in this exact format:

```markdown
## Visual Drift Report

**Component:** [component or page name, from Figma frame name]
**Figma source:** [Figma URL]
**Rendered URL:** [rendered URL]
**Viewport:** [width]x[height]
**Date:** [today's date]
**Score: [composite]/100 ([rating])**

### Dimension Scores

| Dimension | Score | Weight | Weighted | Key Finding |
|-----------|-------|--------|----------|-------------|
| Layout | [score] | 40% | [weighted] | [one-line summary or "Match"] |
| Color | [score] | 20% | [weighted] | [one-line summary or "Match"] |
| Typography | [score] | 15% | [weighted] | [one-line summary or "Match"] |
| Spacing | [score] | 15% | [weighted] | [one-line summary or "Match"] |
| State Coverage | [score] | 10% | [weighted] | [one-line summary or "N/A"] |

### Deterministic Measurements

- **Pixel diff:** [diffPercentage]% ([diffPixels] pixels of [totalPixels])
- **SSIM:** [ssim] ([qualityAssessment])
- **Changed regions:** [count] bounding boxes detected

### Verdict: [PASS/WARN/BLOCK] ([rating])

[If PASS]: No blocking issues. [count] advisory findings noted below.
[If WARN]: [count] findings require attention. Does not block merge but should be reviewed by design.
[If BLOCK]: [count] critical findings. PR should not merge until score improves above 60 or design team approves deviations.

### Findings

[List all findings from Step 7, ordered by score impact]

#### [Finding 1 title]
- **Dimension:** [dimension name]
- **Design value:** [expected]
- **Rendered value:** [actual]
- **Impact:** -[points] on [dimension] score
- **Fix:**
```[css/tailwind]
[specific fix code]
```

[Repeat for each finding]

### Measurement Confidence

- Layout: [HIGH if SSIM + pixel diff used, MEDIUM if vision-only]
- Color: [HIGH if computed styles matched against tokens, MEDIUM if vision-only]
- Typography: [HIGH if computed styles extracted, MEDIUM if vision-only]
- Spacing: [HIGH if computed styles extracted, LOW if vision-only -- spacing detection is weakest]
- State Coverage: [MEDIUM if states tested, LOW if inferred from static screenshot]

### Limitations

- Vision-based comparison has ~50-60% spatial reasoning accuracy
- Spacing scores below HIGH confidence should be verified manually
- Single viewport tested ([width]x[height]) -- run at additional breakpoints for responsive coverage
- Static screenshots only -- animations and transitions not evaluated
- For production-grade verification, combine with Playwright toHaveScreenshot(), Chromatic, or Applitools
```

---

## Step 9: Delta Comparison (if previous score available)

If the user provides a previous score for the same component, calculate and report the delta:

```markdown
### Trend

| Metric | Value |
|--------|-------|
| Previous score | [previous] |
| Current score | [current] |
| Delta | [+/-change] |
| Trend | [improving/stable/degrading] |

[If delta > +15]: Score improved significantly. Good progress.
[If delta between -5 and +15]: Score is stable.
[If delta between -15 and -6]: Score degraded. Review findings to prevent further drift.
[If delta < -15]: ALERT: Significant regression. This PR introduces substantial visual drift.
```

---

## Key Constraints

1. **Do not skip deterministic measurement.** Always run Visual Diff MCP comparison (Step 4) before vision assessment. Deterministic signals anchor the score.

2. **Do not rely on vision alone for spacing.** Spacing is the weakest dimension for vision models. Always extract computed styles for spacing-critical elements.

3. **Round all scores to whole numbers.** Drift scores are integers 0-100. Do not report decimal scores -- the precision is not meaningful given measurement uncertainty.

4. **Report confidence levels honestly.** If a dimension was scored primarily via vision (no computed style verification), mark confidence as MEDIUM or LOW. Users need to know which scores are trustworthy.

5. **Limit scope to one viewport per run.** If the user needs responsive scoring, run the skill separately at each breakpoint and report independently.

6. **Cap fix iteration at 5 cycles.** If the user asks to fix-and-rescore, limit to 5 iterations. After 5 cycles, recommend manual design review.

---

*Methodology reference: `standards/visual-drift-scoring.md`*
*Design comparison workflow: `templates/commands/design-compare.md`*
*Visual Diff MCP tools: `tools/visual-diff-mcp/README.md`*
*Research basis: `standards/visual-verification-gap.md` Domain 8 (Metrics and Measurement)*
