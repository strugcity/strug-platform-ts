You are performing a **design-to-code visual comparison** between a Figma design and its rendered implementation.

**Figma URL:** $ARGUMENTS

If no URL was provided, ask the user for a Figma URL (format: `https://figma.com/design/:fileKey/:fileName?node-id=X-Y`) and the rendered page URL before proceeding.

---

## Step 1: Parse Figma URL

Extract `fileKey` and `nodeId` from the Figma URL.

| URL Format | fileKey | nodeId |
|------------|---------|--------|
| `figma.com/design/:fileKey/:fileName?node-id=1-2` | `:fileKey` | `1:2` |
| `figma.com/design/:fileKey/branch/:branchKey/:fileName?node-id=1-2` | `:branchKey` | `1:2` |

Node IDs in URLs use dashes (`1-2`); convert to colons (`1:2`) for the API.

If the URL does not contain a `node-id` parameter, ask the user which frame or component to compare.

---

## Step 2: Fetch Figma Design Context

Call `get_design_context` with the extracted `fileKey` and `nodeId`. This returns:
- A **screenshot** of the Figma design (visual reference)
- **Reference code** (HTML/CSS or framework-specific)
- **Asset download URLs** for images
- **Code Connect mappings** if they exist

Save the screenshot mentally as the "design baseline."

Note the frame dimensions from the response metadata — you will need these for viewport matching in Step 4.

---

## Step 3: Fetch Design Tokens

Call `get_variable_defs` with the same `fileKey` and `nodeId` to retrieve design token values:
- Colors (hex, rgba)
- Spacing values (px, rem)
- Typography tokens (font-family, font-size, font-weight, line-height)
- Border radius, shadows, opacity

Record these tokens — they are the ground truth for the comparison.

---

## Step 4: Capture Rendered Implementation

Ask the user for the rendered page URL if not already provided (local dev server, Vercel preview, or production URL).

### 4a. Match viewport to Figma frame dimensions

If the Figma frame has specific dimensions (e.g., 1440x900), resize the browser viewport to match:

```
browser_resize → { width: <frame_width>, height: <frame_height> }
```

If the frame dimensions are not available from Step 2, use 1280x800 as the default desktop viewport.

### 4b. Navigate and wait for render

```
browser_navigate → { url: "<rendered-page-url>" }
```

Wait for the page to fully load. If the page has animations or transitions, wait an additional 2 seconds for visual stability:

```
browser_wait_for → { time: 2 }
```

### 4c. Capture screenshot

```
browser_take_screenshot → { type: "png" }
```

This is the "rendered output" for comparison.

---

## Step 5: Side-by-Side Comparison

You now have two images:
1. **Design baseline** — Figma screenshot from Step 2
2. **Rendered output** — Browser screenshot from Step 4

Compare them using your vision capabilities. Evaluate each category below and assign a rating: **Match**, **Minor deviation**, or **Mismatch**.

### 5a. Layout Match

- Overall structure (header, content, sidebar, footer arrangement)
- Element positioning (left/right/center alignment)
- Flex/grid layout fidelity
- Element ordering and stacking
- Responsive behavior at the tested viewport

### 5b. Color Accuracy

- Background colors vs design tokens from Step 3
- Text colors vs design tokens
- Border colors
- Shadow colors and opacity
- Gradient accuracy (direction, stops)

### 5c. Typography Fidelity

- Font family (correct typeface loaded?)
- Font size (visually proportional?)
- Font weight (bold, medium, regular)
- Line height (text density and spacing)
- Letter spacing
- Text alignment
- Text truncation/overflow behavior

### 5d. Spacing Precision

- Padding (internal spacing within containers)
- Margins (spacing between elements)
- Gap values (flex/grid gaps)
- Section spacing (vertical rhythm)
- Edge-to-container distances

### 5e. Component Details

- Border radius (corners)
- Icon sizing and alignment
- Image aspect ratios and cropping
- Button sizing and padding
- Input field dimensions
- Dividers and separators

---

## Step 6: Computed Style Spot-Checks

For any category rated "Minor deviation" or "Mismatch," verify with computed style inspection using the Playwright MCP:

```
browser_evaluate → {
  function: "() => {
    const el = document.querySelector('<selector>');
    const s = getComputedStyle(el);
    return {
      color: s.color,
      backgroundColor: s.backgroundColor,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontFamily: s.fontFamily,
      lineHeight: s.lineHeight,
      padding: s.padding,
      margin: s.margin,
      gap: s.gap,
      borderRadius: s.borderRadius
    };
  }"
}
```

Compare the computed values against the design tokens from Step 3. This provides deterministic evidence to supplement the visual comparison.

---

## Step 7: Component State Coverage (if applicable)

If the design includes multiple states (hover, active, disabled, focus, error), attempt to verify them:

1. **Hover state**: Use `browser_hover` on interactive elements, then capture a screenshot.
2. **Focus state**: Use `browser_click` on an input, then capture a screenshot.
3. **Disabled state**: Check if disabled variants exist in the rendered page via snapshot inspection.

If the Figma file includes state variants, fetch screenshots of those states via `get_screenshot` with their respective `nodeId` values.

Note: Component state verification is best-effort. Vision comparison of interaction states is less reliable than static layout comparison.

---

## Step 8: Structured Report

Output the comparison report in this format:

```
## Design Comparison Report

**Figma source:** [fileKey/nodeId]
**Rendered URL:** [url]
**Viewport:** [width]x[height]
**Date:** [today]

### Summary

| Category            | Rating           | Issues |
|---------------------|------------------|--------|
| Layout              | Match / Minor / Mismatch | count |
| Color               | Match / Minor / Mismatch | count |
| Typography          | Match / Minor / Mismatch | count |
| Spacing             | Match / Minor / Mismatch | count |
| Component details   | Match / Minor / Mismatch | count |
| State coverage      | Match / Minor / N/A      | count |

**Overall verdict:** PASS / NEEDS FIXES / MAJOR MISMATCH

### Findings

#### [Category]: [Rating]

**Issue:** [description of what differs]
**Design value:** [expected value from Figma/tokens]
**Rendered value:** [actual computed value]
**Severity:** Low / Medium / High
**Suggested fix:**
```css
/* or tailwind class, or component prop change */
.selector {
  property: correct-value;
}
```

[Repeat for each finding]

### Limitations

- Vision-based comparison achieves ~50-60% spatial reasoning accuracy
- Subtle spacing differences (<4px) may not be detected
- Color accuracy is approximate — hex values verified via computed styles where flagged
- Animation and transition states are not evaluated
- This is a coarse validation pass, not pixel-perfect regression testing
- For production-grade verification, combine with Playwright toHaveScreenshot(),
  Chromatic, or Applitools
```

---

## Step 9: Fix Iteration (optional)

If the user asks to fix identified issues:

1. Apply fixes one at a time.
2. After each fix, re-capture the rendered screenshot.
3. Re-compare the specific category that was fixed.
4. Confirm the fix resolves the finding without introducing new issues.

Limit to **5 fix-verify cycles** maximum. After 5 cycles, report remaining issues and recommend manual review or deterministic visual testing tools.

---

## Key Limitations

Document these clearly in every report:

- **Vision comparison is coarse (50-60% accuracy):** Useful for catching major layout breaks, unreliable for pixel-level precision. This skill catches gross mismatches, not subtle polish issues.
- **Spacing detection is weakest:** Differences under 4px are unlikely to be detected visually. Use computed style spot-checks (Step 6) for spacing-critical elements.
- **Color matching is approximate:** Vision models identify wrong colors by name but cannot distinguish between similar hex values (e.g., `#333` vs `#3a3a3a`). Computed style verification is authoritative.
- **No animation/transition evaluation:** Static screenshots only. Interaction timing, easing, and animation sequences require manual review or specialized tools.
- **Single-viewport comparison:** This skill compares at one viewport size. For responsive verification, run the skill multiple times at different breakpoints (375px mobile, 768px tablet, 1280px desktop).
- **Design tokens are necessary but not sufficient:** Even with 100% correct token usage, composition and optical balance may differ from the design.

---

*References:*
- *standards/figma-mcp-guide.md — Figma MCP tools and design-to-code workflow*
- *standards/visual-verification-gap.md — Domain 3 (design-to-code verification research)*
