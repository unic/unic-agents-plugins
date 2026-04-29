# 01. Drop --verify from Slash Command, Replace with Cheap Auth Probe
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** none (spec 07 is a follow-up, not a prerequisite)
**Touches:** `scripts/push-to-confluence.mjs`, `commands/unic-confluence.md`

## Context

Every time a user runs `/unic-confluence`, the slash command calls `--verify` before publishing. The `--verify` subcommand iterates over every entry in `confluence-pages.json` and performs an HTTP GET for each page to confirm it still exists. On a repo with 20 mapped pages this fires 20 HTTP requests before even starting the actual publish. Latency scales linearly with the number of mapped pages and the pre-flight check provides marginal safety value — if a specific page is missing, the subsequent publish GET/PUT will surface that error anyway. The fix is to replace `--verify` in the slash command with a single cheap auth probe: one GET to `/wiki/api/v2/pages?limit=1`. This proves credentials are valid without touching any specific pages.

Spec 07 will later formalise this as a `--check-auth` subcommand. This spec implements a temporary `--ping` arg that is cheap to add now and easy to rename in spec 07.

## Current behaviour

`commands/unic-confluence.md`, step 2 (exact text):

```markdown
### 2. Check credentials
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --verify

If credentials missing, instruct user to run --setup.
```

`scripts/push-to-confluence.mjs`, `main()` starting at line 388:

```js
async function main() {
	const args = process.argv.slice(2);
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--verify") { await runVerify(); return; }
	if (args.length < 2) { console.error("Usage: npm run confluence -- {pageId} {file.md}"); process.exit(1); }
```

The `--verify` branch (line 391) calls `runVerify()`, which GETs every page in `confluence-pages.json` (function defined somewhere between lines 252-388 — not shown in the provided excerpt but known to perform N HTTP GETs). This happens on every publish invocation through the slash command.

## Target behaviour

### `scripts/push-to-confluence.mjs`

A new `--ping` branch is added in `main()` immediately before the existing `--verify` branch. When `--ping` is passed:

1. Load credentials via `loadCredentials()` (exits 1 with setup hint if credentials are missing).
2. Make a single GET to `{baseUrl}/wiki/api/v2/pages?limit=1`.
3. If the response is 2xx → exit 0, no stdout.
4. If the network call throws → print `err.message` to stderr and exit 1.
5. For non-2xx responses → call `handleHttpError(res.status, "")` (exits 1 with a specific message for 401/403/404/other).

The existing `--verify` subcommand is left unchanged — it remains useful as an interactive diagnostic tool.

### `commands/unic-confluence.md`

Step 2 is replaced: the expensive `--verify` call becomes `--ping`. The heading and explanatory text are updated to describe the lightweight nature of the check.

### Edge cases

- `--ping` with no credentials file and no env vars → `loadCredentials()` prints the setup hint and exits 1 (unchanged behaviour, propagated from the existing helper).
- `--ping` with a valid token but network unreachable → exits 1 with the "Cannot reach Confluence — check VPN/network connectivity" message from `httpsRequest`'s error handler (line 85).
- `--ping` with a 401 → exits 1 with the API token rejected message from `handleHttpError` (line 99).
- `--ping` with a 403 → exits 1 with the access denied message (line 100).

## Implementation steps

### Step 1 — Add `--ping` branch to `main()` in `scripts/push-to-confluence.mjs`

File: `scripts/push-to-confluence.mjs`

Locate `main()` starting at line 388. The current top of the function reads:

```js
async function main() {
	const args = process.argv.slice(2);
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--verify") { await runVerify(); return; }
	if (args.length < 2) { console.error("Usage: npm run confluence -- {pageId} {file.md}"); process.exit(1); }
```

Insert the `--ping` branch between `--setup` and `--verify`:

```js
async function main() {
	const args = process.argv.slice(2);
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--ping") {
		const { url: baseUrl, username, token } = loadCredentials();
		const authHeader = makeBasicAuth(username, token);
		let res;
		try {
			res = await httpsRequest("GET", `${baseUrl.replace(/\/$/, "")}/wiki/api/v2/pages?limit=1`, authHeader);
		} catch (err) {
			console.error(err.message);
			process.exit(1);
		}
		if (res.status >= 200 && res.status < 300) { process.exit(0); }
		handleHttpError(res.status, "");
	}
	if (args[0] === "--verify") { await runVerify(); return; }
	if (args.length < 2) { console.error("Usage: npm run confluence -- {pageId} {file.md}"); process.exit(1); }
```

No other changes to this function at this step.

### Step 2 — Update step 2 in `commands/unic-confluence.md`

File: `commands/unic-confluence.md`

Before (step 2, exact text):

```markdown
### 2. Check credentials
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --verify

If credentials missing, instruct user to run --setup.
```

After:

```markdown
### 2. Check credentials (quick auth probe)
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --ping

Performs a single HTTP GET to verify credentials are valid. If credentials are missing or rejected, instruct user to run --setup.
```

No other changes to `commands/unic-confluence.md`.

## Test cases

| Command | Precondition | Expected stderr | Expected stdout | Exit code |
|---|---|---|---|---|
| `node scripts/push-to-confluence.mjs --ping` | Valid credentials, network reachable | (empty) | (empty) | 0 |
| `node scripts/push-to-confluence.mjs --ping` | No credentials file, no env vars | `Run \`npm run confluence -- --setup\` to configure credentials` | (empty) | 1 |
| `node scripts/push-to-confluence.mjs --ping` | Credentials present, bad token (401) | `API token rejected — generate a new one at...` | (empty) | 1 |
| `node scripts/push-to-confluence.mjs --ping` | Credentials present, 403 response | `Access denied — check that your API token...` | (empty) | 1 |
| `node scripts/push-to-confluence.mjs --ping` | Credentials present, network down | `Cannot reach Confluence — check VPN/network connectivity` | (empty) | 1 |
| `node scripts/push-to-confluence.mjs --verify` | Any | Unchanged — `--verify` still works as before | — | unchanged |

## Acceptance criteria

- `--ping` is handled in `main()` before `--verify` (to avoid accidental fallthrough).
- `--ping` with valid credentials makes exactly one HTTP request (GET `/wiki/api/v2/pages?limit=1`).
- `--ping` exits 0 on a valid 2xx response with no output.
- `--ping` exits 1 for any error or non-2xx response with an appropriate message to stderr.
- `--verify` behaviour is unchanged (this spec does not touch `runVerify`).
- `commands/unic-confluence.md` step 2 calls `--ping`, not `--verify`.
- Lint passes.
- Slash command `/unic-confluence` still works end-to-end: the pre-flight auth probe fires, and a valid publish completes successfully.

## Verification

```sh
# 1. Confirm --ping branch exists in the script
grep -n "\-\-ping" scripts/push-to-confluence.mjs

# 2. Confirm commands file uses --ping
grep "\-\-ping" commands/unic-confluence.md

# 3. Confirm --verify is still present (not removed)
grep -n "\-\-verify" scripts/push-to-confluence.mjs

# 4. Smoke test with no credentials
unset CONFLUENCE_URL CONFLUENCE_USER CONFLUENCE_TOKEN
node scripts/push-to-confluence.mjs --ping; echo "Exit: $?"
# Expected: exit 1 with setup hint

# 5. With valid credentials set in env (replace with real values for manual test):
# CONFLUENCE_URL=https://yoursite.atlassian.net \
# CONFLUENCE_USER=you@example.com \
# CONFLUENCE_TOKEN=your-token \
# node scripts/push-to-confluence.mjs --ping; echo "Exit: $?"
# Expected: exit 0
```

## Out of scope

- Do not modify or remove `--verify` / `runVerify()`. The `--verify` subcommand remains fully functional.
- Do not implement `--check-auth` as a formal subcommand — that is spec 07. This spec adds `--ping` as a minimal stepping stone.
- Do not add any new dependencies.
- No version bump.
- No changes to `confluence-pages.json` or credential storage logic.
- No changes to `handleHttpError` or `httpsRequest`.

## Follow-ups

- Spec 07 will formalise `--check-auth` as the canonical auth-probe subcommand. At that point `--ping` can be aliased to `--check-auth` or replaced.
- If the Confluence API returns 200 even for invalid tokens on the `pages?limit=1` endpoint (e.g. returns an empty list with 200), consider probing `/wiki/api/v2/spaces?limit=1` or checking the response body for a `results` array instead.

_Ralph: append findings here._
