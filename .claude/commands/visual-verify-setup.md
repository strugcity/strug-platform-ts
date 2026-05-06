# Visual Verify Setup Checklist

**Purpose:** Confirm Playwright MCP is installed and operational before starting frontend work.

---

## Prerequisites

- `playwright@claude-plugins-official` is listed in `~/.claude/settings.json` under `mcpServers`
- Permissions include `mcp__plugin_playwright_playwright__*` in allowed tools

---

## Verification Steps

1. **Navigate to target URL**
   ```
   browser_navigate → { url: "<target-url>" }
   ```
   Confirm the page loads without errors.

2. **Take an accessibility snapshot**
   ```
   browser_snapshot → {}
   ```
   Confirm a valid accessibility tree is returned with element references (e.g., `ref="1"`, `ref="2"`).

3. **Capture a screenshot**
   ```
   browser_take_screenshot → { type: "png" }
   ```
   Confirm the screenshot renders the expected page layout.

4. **Check console for errors (optional)**
   ```
   browser_console_messages → { level: "error" }
   ```
   Review any client-side errors relevant to the task.

---

## Pass Criteria

- All three core steps (navigate, snapshot, screenshot) complete without tool errors.
- The accessibility tree contains interactive elements matching the page.
- The screenshot visually matches the expected state.

If any step fails, check `~/.claude/settings.json` for correct plugin configuration before proceeding.

---

*Reference: `standards/agent-sop.md` — Visual Verification Tooling section*
