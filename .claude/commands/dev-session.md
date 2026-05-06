You are starting a **collaborative dev session** on **$ARGUMENTS**.

Parse `$ARGUMENTS`:
- If it contains `--url <value>`, extract `<value>` as `SESSION_URL` and skip Phase 1.
- Otherwise set `SESSION_URL = null` and run Phase 1.

> **Preflight:** If this skill fails with browser errors, run `visual-verify-setup` first to confirm Playwright MCP is operational.

---

## HARD LIMITS — Read Before Starting

This skill opens a browser to the running app. It is NOT a debugging tool. If anything goes wrong, **stop and ask the user** — do not attempt to fix it.

**Never:**
- Modify any project source or build file (`next.config.ts`, `package.json`, `.env*`, source code, etc.) — exception: `dev-session.config.json` may be updated per the Self-Update Protocol below
- Delete or clean project directories (`.next`, `node_modules`, cache, etc.)
- Kill running processes beyond what is strictly needed to start the dev server
- Retry a failed server start more than once
- Diagnose or fix dev server errors — surface them and stop

**If the dev server fails to start:** Report the last 20 lines of server output and say:
> "The dev server didn't start. Fix the issue manually, then run `/dev-session --url http://localhost:{port}` to skip server launch."

**If any phase (other than server start) takes more than 3 retries:** Stop and ask the user what to do next. (Server start is limited to 1 retry per the Never list above.)

---

## Phase 1: Launch Dev Server

*Skip this phase if `SESSION_URL` is already set.*

### 1a. Check for Config Override

Read `dev-session.config.json` from the project root if it exists. Extract any of these optional fields:
- `command` — override the dev command
- `port` — override the port
- `loginUrl` — override the login path (default: `/`)
- `authEnvVar` — override the env var name for the dev password (default: `DEV_PASSWORD`)
- `devEmail` — the email to use when filling the login form (only needed if form has an email field)
- `gateParam` — URL query param name for gate-style auth (e.g. `"gate"`)
- `gateEnvVar` — env var name containing the gate secret (default: `GATE_SECRET`)

### 1a-w. Worktree `.env.local` Check

Check whether the current working directory is a git worktree:

```bash
git rev-parse --git-dir
```

If the output is a path ending in `.git/worktrees/…` (rather than `.git`), this is a worktree. Gitignored files like `.env.local` are **not** copied into worktrees automatically.

**If running in a worktree AND `.env.local` does not exist in the project root:**

1. Find the main worktree root:
   ```bash
   git worktree list --porcelain | head -1
   # "worktree <path>" — that path is the main repo root
   ```
2. Check whether `.env.local` exists in the main worktree root.
3. If it does, report and stop:
   > "This is a git worktree and `.env.local` is missing here. Copy it from the main repo before starting the dev server:
   > `cp <main-repo-root>/.env.local .`
   > Then retry `/dev-session`."
4. If it doesn't exist in the main repo either, proceed — the auth phases will handle a missing password gracefully.

Do **not** copy the file yourself. Env files may contain secrets; the user must perform the copy.

### 1b. Auto-Detect (Fields Not Provided by Config)

**Package manager:**
- `pnpm-lock.yaml` present → `pnpm`
- `yarn.lock` present → `yarn`
- Otherwise → `npm`

**Dev command:**
Read `package.json`. Use the first matching script: `dev` → `start` → `develop`.
Final command: `{pm} run {script}` (or config `command` if set).

**Port:**
Check `.env.local` for `PORT=` or `VITE_PORT=`. If not found, use framework default:
- `next.config.*` present → 3000
- `vite.config.*` present → 5173
- `astro.config.*` present → 4321
- Fallback → 3000

### 1c. Start the Dev Server

First, check if the server is already running by polling `http://localhost:{port}` once using any available browser tool.

- If the port responds → set `SESSION_URL = http://localhost:{port}`, report *"Dev server already running at `{SESSION_URL}`."* and skip to Phase 2.
- If the port does not respond → run the dev command as a background process:

```bash
{command} &
```

### 1d. Wait for Ready

Poll `http://localhost:{port}` every 2 seconds for up to 30 seconds using any available browser tool (e.g. `browser_navigate`, `preview_start`, or `navigate`). The tool used here does not need to match the browser tier selected in Phase 2 — use whatever is available.

- If the page loads before 30 seconds → set `SESSION_URL = http://localhost:{port}` and proceed.
- If 30 seconds elapse with no response → report the error and the server's recent stdout. Stop and ask the user to investigate.

Report: *"Server started at `{SESSION_URL}` using `{command}`."*

---

## Phase 2: Connect Browser & Authenticate

### 2a. Select Browser Tier

Try each in order. Use the first that succeeds.

**Tier 1 — Claude Preview (embedded panel):**

Check `.claude/launch.json` in the project root. Find the entry whose `port` matches the target port (or the first entry if only one exists). If no entry exists for this port, create one:

```json
{
  "name": "<project-name>",
  "runtimeExecutable": "node",
  "runtimeArgs": ["node_modules/next/dist/bin/next", "dev"],
  "port": <port>
}
```

Then call:
```
preview_start -> { name: "<entry-name>" }
```

If this succeeds, set `BROWSER_TIER = "Claude Preview"`. Proceed to 2b using `preview_*` tools.

**Tier 2 — Claude in Chrome (user's browser):**
```
navigate -> { url: SESSION_URL }
```
(This is `mcp__Claude_in_Chrome__navigate`.) If this succeeds, set `BROWSER_TIER = "Claude in Chrome"`. Proceed to 2b using `mcp__Claude_in_Chrome__*` tools.

**Tier 3 — Playwright headed (fallback):**
```
browser_navigate -> { url: SESSION_URL }
```
(This is `mcp__plugin_playwright_playwright__browser_navigate`.) Set `BROWSER_TIER = "Playwright"`. Proceed to 2b using `browser_*` tools.

If this call returns an error containing **"already in use"**, **"already connected"**, **"lock"**, **"EBUSY"**, or **"could not launch"**, the Playwright MCP browser is locked by a prior session — do NOT retry. Jump to the "Playwright MCP locked" edge case below.

### 2b. Detect Auth Requirement

**If `gateParam` is set in config** → skip to 2c-gate directly (do not navigate to `{loginUrl}` for form detection — 2c-gate handles its own navigation using `{loginUrl}` as the base URL).

Otherwise, navigate to `{loginUrl}` (from config, default `/`) using the active browser tier.

Take an accessibility snapshot of the current page.

- If the snapshot tool fails or returns empty → stop and report: "Unable to take an accessibility snapshot to check for auth. The browser may not be connected properly. Run `visual-verify-setup` to check Playwright MCP, then try again." Do not proceed to Phase 3.
- If no login form is detected (no `<input type="password">` or similar auth elements) → already authenticated. Proceed to Phase 3.
- If a login form is detected → proceed to 2c-form.

### 2c-gate. Handle Gate Auth

Read `.env.local`. Look for `{gateEnvVar}` (from config, default: `GATE_SECRET`).

**If found:**

1. Navigate to `{loginUrl}?{gateParam}={secret}` (use `&` instead of `?` if `{loginUrl}` already contains query parameters; e.g. `http://localhost:3005/?gate=<value>`)
2. Wait 1 second for the redirect to complete.
3. Take a snapshot and check the result:
   - If the snapshot tool fails or returns empty → stop and report: "Snapshot failed after navigating to the gate URL — cannot verify auth state. Run `visual-verify-setup` to check Playwright MCP, then try again." Do not proceed to Phase 3.
   - If the browser shows a connection error or navigation failure → stop and report: "Navigation to the gate URL failed — the server may have stopped. Check that the dev server is still running and try again." Do not proceed to Phase 3.
   - If the page renders the app (no 403 block and no connection error) → auth succeeded. Proceed to Phase 3.
   - If still blocked (403 present or redirect back to gate) → stop and report: "Gate auth may have failed. Check the `{gateEnvVar}` value in `.env.local` and try again." Do not proceed to Phase 3.
   - If the page rendered but shows none of the above (e.g. blank page, 500 error, maintenance screen) → stop and report: "Gate auth result is ambiguous — the page shows neither app content nor a 403. Please check `{loginUrl}` manually and try again." Do not proceed to Phase 3.

**If not found:**

Stop and tell the user:
> "Gate auth requires `{gateEnvVar}` in `.env.local` but it wasn't found. Please add it and try again."

Do not proceed to Phase 3.

### 2c-form. Handle Form Authentication

**Check for dev credentials in `.env.local`:**

Read `.env.local`. Look for the auth env var (default: `DEV_PASSWORD`, or `authEnvVar` from config).

**If password found:**

1. Fill the password field with the value of `DEV_PASSWORD` (or the configured authEnvVar).

2. If the form also has an email or username field:
   - If `devEmail` is set in config → fill it with the config value.
   - If `devEmail` is NOT set → pause and ask: "I found a login form with an email field. What email should I use? You can set `devEmail` in `dev-session.config.json` to skip this prompt next time."
     - Wait for the user's response, then fill the email field with that value before proceeding to step 3.
     - If the user does not provide an email → stop and report: "Cannot submit the login form — an email is required. Please provide one or set `devEmail` in `dev-session.config.json`." Do not proceed to Phase 3.

3. Submit the form (click the submit button or press Enter).

4. Wait 2 seconds for redirect.

5. Verify authentication succeeded:
   - Take a snapshot.
   - If the snapshot tool fails or returns empty → stop and report: "Could not take a verification snapshot after login — the browser connection may have dropped. Please check the app manually and run `/dev-session --url {SESSION_URL}` to continue." Do not proceed to Phase 3.
   - If the page shows app content (no auth form or error message visible) → login succeeded. Proceed to Phase 3. (URL may or may not have changed — some apps set a session without redirecting.)
   - If the auth form is still visible or the page shows an error → stop and report: "Login may have failed. Check credentials and try again." Do not proceed to Phase 3.
   - If you cannot determine auth state (e.g. intermediate loading screen) → wait 2 more seconds and check once more. If auth state is still indeterminate → stop and report: "Login state could not be confirmed. Please check the app manually and run `/dev-session --url {SESSION_URL}` to continue." Do not proceed to Phase 3.

**If password NOT found:**

Pause and ask the user:
> "I found a login form at `{SESSION_URL}` but no dev credentials in `.env.local`. What password should I use? You can also add `DEV_PASSWORD=<value>` to `.env.local` so I can handle this automatically next time."

Wait for the user's response. If the form also has an email or username field, ask for that as well before filling.

Then fill and submit the form. After submitting, follow steps 4–5 above to verify authentication succeeded before proceeding to Phase 3.

---

## Phase 3: Initial Orientation

### 3a. Report Session State

```
Dev session active
  Browser:  {BROWSER_TIER}
  URL:      {SESSION_URL}
  Auth:     {logged in as {devEmail} | no auth required | logged in (user-provided credentials)}
```

### 3b. Take Orientation Snapshot

Resize the viewport to 1280×800 using the active browser tier before taking the screenshot:

- **Claude Preview:** `preview_resize -> { width: 1280, height: 800 }`
- **Claude in Chrome:** `resize_window -> { width: 1280, height: 800 }` (this is `mcp__Claude_in_Chrome__resize_window`)
- **Playwright:** `browser_resize -> { width: 1280, height: 800 }`

Then take a screenshot at the resized viewport.

Describe what you see in 2-3 sentences: overall layout, primary content visible, any immediate visual issues that stand out.

Then invoke the visual-verify skill for a full structured report:

> Run: `visual-verify {SESSION_URL}`

**Note:** `visual-verify` uses Playwright MCP internally regardless of the active browser tier. Playwright MCP must be available even when using Claude Preview or Claude in Chrome as the primary tier. If this call fails, run `visual-verify-setup` to confirm Playwright is operational.

### 3c. Hand Off

After the visual-verify report, say:

> "Ready — I can see the frontend. What would you like to work on?"

---

## Tool Reference

Use the tools corresponding to the active `BROWSER_TIER`:

| Action | Claude Preview | Claude in Chrome | Playwright |
|--------|---------------|-----------------|------------|
| Navigate | `preview_start` | `navigate` | `browser_navigate` |
| Screenshot | `preview_screenshot` | `computer` (screenshot) | `browser_take_screenshot` |
| Snapshot | `preview_snapshot` | `read_page` | `browser_snapshot` |
| Fill field | `preview_fill` | `form_input` | `browser_fill_form` |
| Click | `preview_click` | `computer` (click) | `browser_click` |
| Resize | `preview_resize` | `resize_window` | `browser_resize` |

---

## Edge Cases

**Port conflict:**
If the server starts but responds with an error page (not the app), try the next common port (+1). Report the conflict to the user.

**Playwright MCP locked by prior session:**
When Tier 3 (`browser_navigate`) fails with "already in use", "already connected", "lock", "EBUSY", or "could not launch", stop and report:

> "Playwright MCP browser is locked by a prior session. To unblock, run one of these in your terminal:
>
> **Option A — close the lock file only (surgical):**
> `del /F "%USERPROFILE%\AppData\Local\ms-playwright\mcp-chrome-*\Default\Lock" 2>nul`
>
> **Option B — kill all Chrome instances (nuclear):**
> `taskkill /F /IM chrome.exe /T`
>
> Lock files are in: `%USERPROFILE%\AppData\Local\ms-playwright\mcp-chrome-*\`
>
> After running the command, retry with `/dev-session --url {SESSION_URL}`."

Do not attempt to kill processes yourself. Surface this to the user and stop.

**All browser tiers fail:**
If Tier 1, 2, and 3 all fail for reasons *other than* the Playwright lock, report:
> "Unable to open a browser. Playwright MCP, Claude Preview, and Claude in Chrome all failed. Please check your MCP configuration and try again."

**Login form but no password field found after submit:**
Take a snapshot. If the page shows app content (no auth form or error message visible) → login succeeded. If the auth form is still visible or the page shows an error → report: "Login may have failed. Check credentials and try again." Do not proceed to Phase 3. (URL may or may not have changed — some apps authenticate without redirecting.)

---

## Config Reference (`dev-session.config.json`)

All fields optional. Place in project root.

| Field | Default | Purpose |
|-------|---------|---------|
| `command` | auto-detected | Dev server command |
| `port` | auto-detected | Dev server port |
| `loginUrl` | `/` | URL to navigate for auth check |
| `authEnvVar` | `DEV_PASSWORD` | `.env.local` key for form-based password |
| `devEmail` | — | Email to fill if form has email field |
| `gateParam` | — | URL query param for gate-style auth |
| `gateEnvVar` | `GATE_SECRET` | `.env.local` key for gate secret |

---

## Self-Update Protocol

**When you discover something this skill doesn't know**, update it before handing off. This keeps the skill accurate for future sessions. Updates are part of completing the skill — not optional.

### What triggers an update

- Auth method changed (e.g. DEMO_PASSWORD replaced, gate secret rotated, login form added/removed)
- Dev port changed from what's in `dev-session.config.json`
- New project added to the Strug City portfolio
- Login URL changed
- A new auth pattern discovered (e.g. OAuth, magic link)

### What to update

1. **`dev-session.config.json`** in the project root — update `port`, `loginUrl`, `authEnvVar`, `gateParam`, etc.
2. **The Strug City Project Registry below** — update the entry for the affected project.
3. **The deployed skill file** (typically `~/.claude/skills/dev-session/SKILL.md`) — update the registry table and any relevant phase instructions if the pattern itself is new.
4. **The canonical template** (`strug-standards/templates/commands/dev-session.md` in the strug-standards repo) — keep the registry table in sync with this file. Only update the registry table, not the phase instructions (those require a design change review).

### How to update

Edits to `dev-session.config.json` files and the registry table below are **safe to make without asking** — they are factual corrections, not design changes. If you discover a new auth *pattern* that requires adding a new phase to the skill logic, surface it to the user first.

If any file write fails, stop the update sequence immediately — do not attempt the remaining writes. Instead, report:
> "I tried to update `{file}` but the write failed. Please update it manually: {what needs to change}. The remaining files in the update sequence were not modified."

Only include the update notice in your Phase 3 session report after confirming all writes succeeded:
> "I updated `dev-session.config.json` — the login URL changed from `/login` to `/signin`."

---

## Strug City Project Registry

Quick reference for all Strug City frontends. Always check `dev-session.config.json` in the project root for the current authoritative values — this table is a convenience summary.

| Project | Repo dir | Port | Auth type | Auth config | Launch.json name |
|---------|----------|------|-----------|-------------|-----------------|
| **Feedtumi** | `feedtumi` | 3000 | Password form | `authEnvVar: DEMO_PASSWORD`, `loginUrl: /signin` | `feedtumi` |
| **Strug Works** | `dreamTeam` | 3005 | URL gate param | `gateParam: gate`, `gateEnvVar: GATE_SECRET`, `command: npm run dev -- --port 3005` | `dreamTeam` |
| **Sabine** | `sabine-super-agent` | 3000 | None | — | `sabine-dev` |
| **Strug Enterprise** | `strugEnterprise` | 3000 | None | — | `strugEnterprise` |

> **Note:** Sabine's frontend lives in `sabine-super-agent/`. When launching from the `dreamTeam` session, use the `sabine-dev` launch.json entry (runs `scripts/sabine-dev.js`). When launching from `sabine-super-agent/` directly, use that project's own launch.json.

---

*Reference: `docs/plans/2026-04-04-dev-session-skill-design.md`*
*Related skills: `visual-verify`, `visual-verify-setup`, `visual-verification-pipeline`*
