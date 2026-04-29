# 12. Fix handleHttpError argv Leak
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** none (self-contained change to one function and its two call sites)
**Touches:** `scripts/push-to-confluence.mjs`

## Context

`handleHttpError` is the central HTTP error handler. It currently reads `process.argv[2]` and `process.argv[3]` directly to build the 409 conflict retry hint (line 102). This is fragile: `process.argv[2]` is always whatever the first CLI token after `node script.mjs` was, and `process.argv[3]` is the second. Today the call is `node scripts/push-to-confluence.mjs <pageArg> <filePath>`, so `argv[2]` and `argv[3]` are the right values — but that is only true as long as no flags are inserted before the positional arguments. Specs 03 and 04 introduce flags like `--dry-run` and `--replace-all`, which may appear as `argv[2]`, pushing the page argument to `argv[3]` or later and making the retry hint in the 409 message print the wrong values. The fix is to pass the resolved page argument and file path explicitly from the call sites into `handleHttpError`, decoupling the error formatter from the global argv state.

A secondary issue: the message currently reads `npm run confluence --` which is inconsistent with the rest of the codebase moving to `pnpm confluence` (spec 00). The fix updates this reference too.

## Current behaviour

**File:** `scripts/push-to-confluence.mjs`

**`handleHttpError` definition (lines 97–109):**
```js
function handleHttpError(status, title) {
	const messages = {
		401: "API token rejected — generate a new one at https://id.atlassian.com → Security → API tokens (note: tokens created before 2025 may have expired)",
		403: "Access denied — check that your API token has permission to read and write this page",
		404: "Page ID not found — check confluence-pages.json or verify the page still exists",
		409: `Page was updated by someone else. Retry with: npm run confluence -- ${process.argv[2]} ${process.argv[3]}`,
	};
	const msg =
		messages[status] ??
		`Unexpected response from Confluence (HTTP ${status}) — check VPN/network and retry`;
	console.error(msg);
	process.exit(1);
}
```

**Problems on line 102:**
1. `process.argv[2]` and `process.argv[3]` are global state — they break when flags appear before positional args.
2. If either is `undefined` (e.g. the user only passed one argument), the message reads `"Retry with: pnpm confluence undefined undefined"`.
3. `"npm run confluence --"` should be `"pnpm confluence"` after spec 00.

**Call sites:**

Call site A — GET response error path (line 443):
```js
if (getRes.status < 200 || getRes.status >= 300) {
	handleHttpError(getRes.status, "");
}
```

Call site B — PUT response error path (line 487–488):
```js
if (putRes.status < 200 || putRes.status >= 300) {
	handleHttpError(putRes.status, title);
}
```

Both call sites are inside `main()`, which already has `pageArg` and `filePath` in scope (line 405):
```js
const [pageArg, filePath] = args;
```

**`runVerify` (lines 256–310):** calls `httpsRequest` directly and uses `console.error` for failures — does NOT call `handleHttpError`. No change needed there.

## Target behaviour

`handleHttpError` accepts an optional third argument `{ pageArg, filePath }`. The 409 message is built from those values. If `pageArg` is absent or empty, the message degrades gracefully to a version-agnostic retry instruction. Both call sites in `main()` pass `{ pageArg, filePath }`.

The 409 message changes from:
```
Page was updated by someone else. Retry with: npm run confluence -- my-page docs/spec.md
```
to:
```
Page was updated by someone else. Retry with: pnpm confluence my-page docs/spec.md
```

Or, if no pageArg is available:
```
Page was updated by someone else. Re-run the command with the current page version.
```

All other messages (401, 403, 404, the catch-all) are unchanged.

## Implementation steps

### Step 1 — Update the function signature and 409 message

**File:** `scripts/push-to-confluence.mjs`, lines 97–109

```js
// BEFORE:
function handleHttpError(status, title) {
	const messages = {
		401: "API token rejected — generate a new one at https://id.atlassian.com → Security → API tokens (note: tokens created before 2025 may have expired)",
		403: "Access denied — check that your API token has permission to read and write this page",
		404: "Page ID not found — check confluence-pages.json or verify the page still exists",
		409: `Page was updated by someone else. Retry with: npm run confluence -- ${process.argv[2]} ${process.argv[3]}`,
	};
	const msg =
		messages[status] ??
		`Unexpected response from Confluence (HTTP ${status}) — check VPN/network and retry`;
	console.error(msg);
	process.exit(1);
}

// AFTER:
function handleHttpError(status, title, { pageArg = "", filePath = "" } = {}) {
	const retryHint = pageArg
		? `Retry with: pnpm confluence ${pageArg} ${filePath}`
		: "Re-run the command with the current page version.";
	const messages = {
		401: "API token rejected — generate a new one at https://id.atlassian.com → Security → API tokens (note: tokens created before 2025 may have expired)",
		403: "Access denied — check that your API token has permission to read and write this page",
		404: "Page ID not found — check confluence-pages.json or verify the page still exists",
		409: `Page was updated by someone else. ${retryHint}`,
	};
	const msg =
		messages[status] ??
		`Unexpected response from Confluence (HTTP ${status}) — check VPN/network and retry`;
	console.error(msg);
	process.exit(1);
}
```

The `retryHint` variable is computed before the `messages` object so the template literal on line 409 can reference it cleanly.

### Step 2 — Update call site A (GET error path)

**File:** `scripts/push-to-confluence.mjs`, around line 443

```js
// BEFORE:
if (getRes.status < 200 || getRes.status >= 300) {
	handleHttpError(getRes.status, "");
}

// AFTER:
if (getRes.status < 200 || getRes.status >= 300) {
	handleHttpError(getRes.status, "", { pageArg, filePath });
}
```

`pageArg` and `filePath` are already in scope — they are destructured from `args` at line 405:
```js
const [pageArg, filePath] = args;
```

### Step 3 — Update call site B (PUT error path)

**File:** `scripts/push-to-confluence.mjs`, around line 487–488

```js
// BEFORE:
if (putRes.status < 200 || putRes.status >= 300) {
	handleHttpError(putRes.status, title);
}

// AFTER:
if (putRes.status < 200 || putRes.status >= 300) {
	handleHttpError(putRes.status, title, { pageArg, filePath });
}
```

`title` is in scope (derived from `pageData?.title ?? ""` at line 464). `pageArg` and `filePath` are also in scope from line 405.

### Step 4 — Confirm no other call sites exist

Search for all occurrences of `handleHttpError` in the file:

```sh
grep -n "handleHttpError" scripts/push-to-confluence.mjs
```

Expected output (exact line numbers may shift after prior specs):
```
97:function handleHttpError(status, title, { pageArg = "", filePath = "" } = {}) {
443:	handleHttpError(getRes.status, "", { pageArg, filePath });
488:	handleHttpError(putRes.status, title, { pageArg, filePath });
```

If any additional call site appears (e.g. inside `runVerify`), examine it. `runVerify` should NOT call `handleHttpError` — it uses `console.error` directly. If a call site exists in `runVerify`, do not pass `pageArg`/`filePath` (they would not be in scope there); instead add a separate guard so the 409 message falls back to the no-arg path.

### Step 5 — Note on pageArg vs pageId

Pass `pageArg` (the raw string the user typed, e.g. `"my-page"` or `"123456789"`), NOT `pageId` (the resolved numeric integer). The retry hint is for the user to re-type on their terminal. A human-readable key name like `"home-overview"` is more useful in the retry hint than the resolved numeric `"987654321"`.

`pageArg` is the pre-resolution string at line 405:
```js
const [pageArg, filePath] = args;      // raw user input: "my-page", "docs/spec.md"
const pageId = resolvePageId(pageArg); // resolved: 987654321
```

## Test cases

### TC-01: 409 with both pageArg and filePath provided
Simulate a 409 response with `pageArg = "home-overview"` and `filePath = "docs/home.md"`:

Expected message printed to stderr:
```
Page was updated by someone else. Retry with: pnpm confluence home-overview docs/home.md
```

Expected exit code: `1`

### TC-02: 409 with numeric pageArg
Simulate a 409 with `pageArg = "987654321"` and `filePath = "docs/spec.md"`:

Expected message:
```
Page was updated by someone else. Retry with: pnpm confluence 987654321 docs/spec.md
```

### TC-03: 409 with empty pageArg (degraded path)
Call `handleHttpError(409, "My Page", {})` directly (or with `pageArg = ""`):

Expected message:
```
Page was updated by someone else. Re-run the command with the current page version.
```

Expected exit code: `1`

### TC-04: 409 with no third argument (default parameter path)
Call `handleHttpError(409, "My Page")` with no third argument:

Expected message:
```
Page was updated by someone else. Re-run the command with the current page version.
```

Expected exit code: `1`

This verifies the `= {}` default prevents a destructuring TypeError.

### TC-05: Other status codes unchanged
- `handleHttpError(401, "")` → `"API token rejected — …"`
- `handleHttpError(403, "")` → `"Access denied — …"`
- `handleHttpError(404, "")` → `"Page ID not found — …"`
- `handleHttpError(500, "")` → `"Unexpected response from Confluence (HTTP 500) — …"`

All should still work without providing `pageArg`/`filePath`.

### TC-06: No `process.argv` reference inside handleHttpError
```sh
grep -n "process\.argv" scripts/push-to-confluence.mjs
```
Expected: `process.argv` appears only in `main()` (line 389, `process.argv.slice(2)`), NOT inside `handleHttpError`.

## Acceptance criteria

- `handleHttpError` signature is `(status, title, { pageArg = "", filePath = "" } = {})`
- No `process.argv` reference exists inside the body of `handleHttpError`
- The 409 message includes `"pnpm confluence"` (not `"npm run confluence --"`) when `pageArg` is non-empty
- The 409 message falls back gracefully when `pageArg` is empty or not provided
- Both call sites in `main()` pass `{ pageArg, filePath }` as the third argument
- `runVerify` does not call `handleHttpError` — verify with `grep`
- All other error messages (401, 403, 404, catch-all) are unchanged in text
- `pnpm test` passes (spec 09 tests cover `handleHttpError` indirectly via integration paths, or spec 09 adds a direct unit test — either way, no test regression)

## Verification

```sh
# No argv reference inside handleHttpError body
# (The function spans ~15 lines starting at line 97; argv should only appear in main())
grep -n "process\.argv" scripts/push-to-confluence.mjs

# Confirm new signature is present
grep -n "pageArg" scripts/push-to-confluence.mjs

# Confirm pnpm reference in 409 message
grep -n "pnpm confluence" scripts/push-to-confluence.mjs

# Confirm no "npm run confluence" reference remains in the 409 message
grep -n "npm run confluence" scripts/push-to-confluence.mjs
# Expected: 0 matches (the Usage error at line ~401 may still say "npm run confluence" — that is
# a separate issue; only the 409 message is in scope for this spec)

# Confirm both call sites pass the third argument
grep -A2 "handleHttpError" scripts/push-to-confluence.mjs
```

## Out of scope

- Do not change the 401, 403, or 404 messages.
- Do not change `runVerify` — it uses `console.error` directly and does not call `handleHttpError`.
- Do not add a `--retry` flag or automatic retry logic — the message is informational only.
- Do not update the `Usage:` error message at the top of `main()` (line ~401 — `"Usage: npm run confluence -- {pageId} {file.md}"`). That is a separate cleanup item.
- Do not add tests for `handleHttpError` in this spec — tests are spec 09's domain.

## Follow-ups

- Update the `Usage:` error message at line ~401 from `"npm run confluence --"` to `"pnpm confluence"` (small follow-up, can be bundled with spec 00 cleanup or spec 12 itself if convenient).
- Once spec 09 (lib extraction) lands, add a unit test for `handleHttpError` that verifies the 409 message text programmatically rather than relying on manual grep.
- Update the README troubleshooting entry for 409 (spec 11) to show the exact `pnpm confluence <pageArg> <filePath>` form once this fix is shipped.
