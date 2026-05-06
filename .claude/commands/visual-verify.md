You are performing a visual verification audit on **$ARGUMENTS**.

If `$ARGUMENTS` is a URL, use it directly. If it is empty or not a URL, detect a running dev server (check `localhost:3000`, `localhost:5173`, `localhost:4321`, `localhost:8080` in that order) and use the first one that responds.

---

## Step 1: Preflight Check

Confirm Playwright MCP is operational:

```
browser_navigate -> { url: "<target-url>" }
browser_snapshot -> {}
```

If navigation fails, report the error and stop. Do not proceed with a broken target.

---

## Step 2: Capture Screenshots at Three Viewports

For each viewport — **mobile (375px)**, **tablet (768px)**, **desktop (1280px)** — perform the following capture sequence. Use a fixed height of 800px for all viewports.

### Capture Sequence (per viewport)

1. **Resize the browser**
   ```
   browser_resize -> { width: <width>, height: 800 }
   ```

2. **Navigate to the target URL** (re-navigate to reset scroll and layout state)
   ```
   browser_navigate -> { url: "<target-url>" }
   ```

3. **Wait for page stability** (allow render to settle)
   ```
   browser_wait_for -> { time: 2 }
   ```

4. **Take a screenshot**
   ```
   browser_take_screenshot -> { type: "png" }
   ```

5. **Take an accessibility snapshot** (for structural context)
   ```
   browser_snapshot -> {}
   ```

### Retry Logic

If a screenshot capture fails or the page appears to not have loaded (blank screenshot, navigation error):

- Retry up to **3 times** per viewport with a 2-second wait between attempts.
- If all 3 attempts fail for a viewport, log the failure and continue with remaining viewports.
- Report any capture failures in the final output.

---

## Step 3: Evaluate Each Screenshot

For each captured screenshot, perform a visual evaluation using your vision capabilities. Analyze the screenshot and accessibility tree together to assess quality across **six categories**.

### Evaluation Categories

For each category, identify specific issues and classify them by severity:

- **Critical** — Broken layout, unreadable text, missing content, completely non-functional appearance
- **Warning** — Noticeable quality issues that degrade user experience but do not break functionality
- **Info** — Minor polish opportunities, suggestions for improvement

#### 1. Layout / Spacing
- Content overflow or clipping
- Broken flex/grid layouts
- Inconsistent padding or margins
- Elements overlapping unintentionally
- Excessive whitespace or cramped sections

#### 2. Typography
- Text too small to read (below 14px on mobile, below 12px on desktop)
- Missing or incorrect font rendering
- Poor line height or letter spacing
- Inconsistent heading hierarchy
- Text truncation without indication (no ellipsis)

#### 3. Color / Contrast
- Insufficient text-to-background contrast (WCAG AA requires 4.5:1 for normal text)
- Colors that clash or create visual discomfort
- Missing focus indicators on interactive elements
- Inconsistent color usage across similar elements

#### 4. Visual Hierarchy
- Unclear primary call-to-action
- Heading sizes that do not establish clear document structure
- Important content buried or visually de-emphasized
- Too many competing visual elements at the same weight

#### 5. Component Quality
- Buttons, inputs, or cards that look broken or unstyled
- Missing hover/focus states (check accessibility snapshot for interactive elements)
- Icons or images that are missing, broken, or incorrectly sized
- Form elements that lack labels (cross-reference accessibility tree)

#### 6. Responsiveness
- Content that does not adapt to the current viewport width
- Horizontal scrolling on mobile
- Navigation that is unusable at smaller sizes
- Touch targets smaller than 44x44px on mobile
- Images or media that overflow their containers

---

## Step 4: Produce Structured Report

Compile findings into the following format:

```
## Visual Verification Report

**Target:** <url>
**Date:** <current date>
**Viewports tested:** 375px (mobile), 768px (tablet), 1280px (desktop)
**Capture failures:** <count, or "None">

### Overall Score: X / 10

<1-2 sentence summary of overall visual quality>

### Findings by Viewport

#### Mobile (375px)
| # | Category | Severity | Finding | Suggested Fix |
|---|----------|----------|---------|---------------|
| 1 | Layout/Spacing | Critical | ... | ... |
| 2 | Typography | Warning | ... | ... |

#### Tablet (768px)
| # | Category | Severity | Finding | Suggested Fix |
|---|----------|----------|---------|---------------|
| 1 | ... | ... | ... | ... |

#### Desktop (1280px)
| # | Category | Severity | Finding | Suggested Fix |
|---|----------|----------|---------|---------------|
| 1 | ... | ... | ... | ... |

### Cross-Viewport Issues
<Issues that appear at multiple breakpoints — list once here with affected viewports>

### Summary
- **Critical:** <count>
- **Warning:** <count>
- **Info:** <count>
- **Total findings:** <count>

### Limitations
This report was generated using Claude's vision capabilities on static screenshots.
Known constraints:
- **Spatial accuracy is 50-60%** — pixel-level measurements are approximate, not exact.
- **Static only** — hover states, animations, transitions, and scroll behavior are not evaluated.
- **No baseline comparison** — this is a standalone assessment, not a regression test against a previous version.
- **Color perception is approximate** — exact hex values and precise contrast ratios cannot be determined from screenshots.
- **Complements but does not replace** CI-based visual regression tools (Playwright `toHaveScreenshot()`, Chromatic, Applitools).
```

### Scoring Guide

Use this rubric for the overall score:

| Score | Meaning |
|-------|---------|
| 9-10 | Production-ready. No critical or warning findings. |
| 7-8 | Good. Minor warnings only, no critical issues. Ship with optional polish. |
| 5-6 | Acceptable. A few warnings, possibly one non-blocking critical. Needs attention before production. |
| 3-4 | Poor. Multiple critical issues or many warnings. Requires significant fixes. |
| 1-2 | Broken. Page is unusable or severely broken at one or more viewports. |

---

## Step 5: Provide Fix Priority

After the report, list the **top 3 highest-priority fixes** with specific, actionable guidance:

```
### Priority Fixes

1. **[Category — Severity]** <description>
   - **Where:** <element or section affected>
   - **Fix:** <specific CSS/HTML change to make>
   - **Impact:** <what improves when fixed>

2. ...

3. ...
```

If no issues are found, state: "No issues detected. Page passes visual verification at all tested viewports."

---

*Reference: `standards/visual-verification-gap.md` — Domain 7: Claude Code Integration Patterns*
*Reference: `standards/agent-sop.md` — Visual Verification Policy*
