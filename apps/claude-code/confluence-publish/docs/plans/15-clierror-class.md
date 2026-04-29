# 15. Introduce `CliError` Class — Replace `console.error` + `process.exit` Pairs
**Status: done — 2026-04-24**

**Priority:** P2
**Effort:** M
**Depends on:** 09 (unit tests must exist to catch regressions when error-path behaviour changes)
**Touches:** `scripts/push-to-confluence.mjs`, `scripts/lib/errors.mjs` (new file)

## Context

`scripts/push-to-confluence.mjs` contains approximately 20 sites where error handling is expressed as `console.error(msg); process.exit(1)`. This pattern has two problems. First, it is untestable: any test that calls a function containing `process.exit` will kill the test process unless the caller mocks `process.exit` globally — a brittle technique that leaks state between tests. Second, it scatters output and exit-code logic across the file, making it impossible to change the exit-code strategy (e.g. add structured error output, or return exit code 2 for configuration errors vs. 1 for runtime errors) without touching every site. Replacing the pattern with a `CliError` class centralises both concerns: callers `throw new CliError(msg)` and a single `try/catch` in `main()` handles `console.error` and `process.exit`. Tests can now assert `throws CliError` without mocking the process.

The new class lives in `scripts/lib/errors.mjs` to keep the main file clean. The `httpsRequest` helper's `reject(new Error(...))` pattern is intentionally left unchanged — those are network-layer errors that propagate to callers via promise rejection and are already handled by dedicated `catch` blocks.

## Current behaviour

All error paths in `scripts/push-to-confluence.mjs` call `console.error` then `process.exit(1)` directly. Full list of sites (file line numbers from current source):

| Line(s) | Context | Message |
|---|---|---|
| 54–55 | `loadCredentials()` | `"Run \`npm run confluence -- --setup\` to configure credentials"` |
| 107–108 | `handleHttpError()` | Various HTTP error messages, then `process.exit(1)` |
| 133–136 | `injectContent()` strategy 1 | `"Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END]…"` |
| 153–156 | `injectContent()` strategy 1 label mismatch | `"Marker label mismatch on page…"` |
| 179–181 | `injectContent()` strategy 2 | `"Found md-start anchor without md-end (or vice versa)…"` |
| 210–211 | `resolvePageId()` numeric path | `"Invalid page ID: ${arg}"` |
| 219–221 | `resolvePageId()` key path — file missing | `"confluence-pages.json not found…"` |
| 229–230 | `resolvePageId()` key path — bad JSON | `"invalid JSON in confluence-pages.json…"` |
| 237–239 | `resolvePageId()` key path — key absent | `"'${arg}' not found in confluence-pages.json…"` |
| 244–247 | `resolvePageId()` key path — invalid ID | `"Invalid page ID for key '${arg}'…"` |
| 258–260 | `runVerify()` — file missing | `"confluence-pages.json not found…"` |
| 263–265 | `runVerify()` — bad JSON | `"invalid JSON in confluence-pages.json…"` |
| 306 | `runVerify()` exit | `process.exit(hasErrors ? 1 : 0)` |
| 313–315 | `runSetup()` — not a TTY | `"--setup requires an interactive terminal"` |
| 358–360 | `runSetup()` — missing fields | `"Username and API token are required."` |
| 401–402 | `main()` — insufficient args | `"Usage: npm run confluence -- {pageId} {file.md}"` |
| 410–411 | `main()` — file not found | `"File not found: ${filePath}"` |
| 415–416 | `main()` — file too large | `"File too large for Confluence API…"` |
| 425–427 | `main()` — empty HTML | `"Markdown converted to empty HTML…"` |
| 439–440 | `main()` GET catch | `err.message` |
| 450–453 | `main()` — JSON parse failure | `"Unexpected response from Confluence…"` |
| 458–460 | `main()` — no version | `"Could not read page version…"` |
| 481–482 | `main()` PUT catch | `err.message` |

None of these are catchable by callers without a `process.exit` mock.

## Target behaviour

After this change:

1. A new file `scripts/lib/errors.mjs` exports `CliError extends Error` with `exitCode`.
2. Every `console.error(msg); process.exit(1)` pair in `push-to-confluence.mjs` becomes `throw new CliError(msg)`.
3. `handleHttpError` throws `new CliError(msg)` instead of calling `process.exit(1)`.
4. `runVerify()`'s terminal `process.exit(hasErrors ? 1 : 0)` becomes `throw new CliError("One or more pages failed verification", hasErrors ? 1 : 0)` when `hasErrors` is true, and simply `return` (exit 0) when all pages passed.
5. `main()` wraps its body in a `try/catch` that catches `CliError`, calls `console.error(err.message)`, and calls `process.exit(err.exitCode)`. All other errors are re-thrown so they become unhandled-exception crashes (useful for unexpected bugs).
6. `httpsRequest`'s `reject(new Error(...))` is unchanged — it is a promise rejection, not a direct exit, and callers already handle it in their own `catch` blocks.
7. Tests written under spec 09 can now use `assert.throws(() => fn(), CliError)` without mocking the process.

The external observable behaviour is identical: error messages still go to stderr, the process still exits 1 on error, exit 0 on success.

## Implementation steps

### Step 1 — Create `scripts/lib/errors.mjs`

Create a new file at `scripts/lib/errors.mjs` (create the `scripts/lib/` directory if it does not exist):

```js
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * CliError — thrown by any function in push-to-confluence.mjs when user-facing
 * error conditions are encountered. Caught once in main() which handles
 * console.error output and process.exit.
 *
 * Using a dedicated class (instead of process.exit) makes all error paths
 * testable: callers can assert.throws(fn, CliError) without mocking process.exit.
 */
export class CliError extends Error {
	/** @param {string} message @param {number} [exitCode=1] */
	constructor(message, exitCode = 1) {
		super(message);
		this.name = "CliError";
		this.exitCode = exitCode;
	}
}
```

### Step 2 — Import `CliError` in `scripts/push-to-confluence.mjs`

At the top of `scripts/push-to-confluence.mjs`, after the existing `import` statements (approximately line 23), add:

```js
import { CliError } from "./lib/errors.mjs";
```

### Step 3 — Replace error sites in `loadCredentials()` (lines 54–55)

Before:
```js
	console.error("Run `npm run confluence -- --setup` to configure credentials");
	process.exit(1);
```

After:
```js
	throw new CliError("Run `npm run confluence -- --setup` to configure credentials");
```

### Step 4 — Update `handleHttpError()` (lines 97–109)

Before:
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

After:
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
	throw new CliError(msg);
}
```

### Step 5 — Replace error sites in `injectContent()` (lines 133–136, 153–156, 179–181)

Three `console.error(...); process.exit(1)` pairs in `injectContent`. Replace each:

**Lines 133–136** (unmatched start marker):
```js
// Before
console.error(
	`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`,
);
process.exit(1);

// After
throw new CliError(
	`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`,
);
```

**Lines 153–156** (label mismatch):
```js
// Before
console.error(
	`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`,
);
process.exit(1);

// After
throw new CliError(
	`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`,
);
```

**Lines 179–181** (unmatched anchor macro):
```js
// Before
console.error(
	`Found md-start anchor without md-end (or vice versa) on page "${title}" — fix the Confluence page before publishing`,
);
process.exit(1);

// After
throw new CliError(
	`Found md-start anchor without md-end (or vice versa) on page "${title}" — fix the Confluence page before publishing`,
);
```

### Step 6 — Replace error sites in `resolvePageId()` (lines 210–249)

Five sites. Replace each `console.error(msg); process.exit(1)` pair with `throw new CliError(msg)`:

```js
// Line 210-211 — invalid numeric ID
throw new CliError(`Invalid page ID: ${arg}`);

// Line 219-221 — file missing
throw new CliError(
	"confluence-pages.json not found — create it or pass a page ID directly",
);

// Line 229-230 — bad JSON
throw new CliError("invalid JSON in confluence-pages.json — check syntax");

// Line 237-239 — key not found
throw new CliError(
	`'${arg}' not found in confluence-pages.json — available keys: ${keys}`,
);

// Line 244-247 — invalid ID for key
throw new CliError(
	`Invalid page ID for key '${arg}': ${id} — must be a positive integer`,
);
```

### Step 7 — Replace error sites in `runVerify()` (lines 258–306)

Two `console.error + process.exit` pairs at the top of the function, plus the terminal `process.exit` at line 306.

**Lines 258–260** (file missing):
```js
throw new CliError("confluence-pages.json not found — create it first");
```

**Lines 263–265** (bad JSON):
```js
throw new CliError("invalid JSON in confluence-pages.json — check syntax");
```

**Line 306** (terminal exit — only the failure case needs a throw; success case returns normally):
```js
// Before
process.exit(hasErrors ? 1 : 0);

// After
if (hasErrors) {
	throw new CliError("One or more pages failed verification — see errors above", 1);
}
// success: fall through; main() handles exit 0 after await runVerify()
```

### Step 8 — Replace error sites in `runSetup()` (lines 313–315, 358–360)

**Lines 313–315** (not a TTY):
```js
throw new CliError("--setup requires an interactive terminal");
```

**Lines 358–360** (missing fields):
```js
throw new CliError("Username and API token are required.");
```

Note: `runSetup()` also calls `process.exit(0)` on user abort (line 339) — that is a normal early exit, not an error. Leave it as `process.exit(0)`.

### Step 9 — Replace error sites in `main()` (lines 401–482)

Replace eight sites in the main publish flow:

```js
// Line 401-402 — insufficient args
throw new CliError("Usage: npm run confluence -- {pageId} {file.md}");

// Line 410-411 — file not found
throw new CliError(`File not found: ${filePath}`);

// Line 415-416 — file too large
throw new CliError("File too large for Confluence API — split the document");

// Line 425-427 — empty HTML
throw new CliError(
	"Markdown converted to empty HTML — check the source file is not empty",
);

// Line 439-440 — GET catch block (err.message from httpsRequest rejection)
// Before:
catch (err) {
	console.error(err.message);
	process.exit(1);
}
// After:
catch (err) {
	throw new CliError(err.message);
}

// Line 450-453 — JSON parse failure on GET body
throw new CliError(
	"Unexpected response from Confluence — check VPN/network and retry",
);

// Line 458-460 — no version in response
throw new CliError(
	"Could not read page version from Confluence response — retry or contact support",
);

// Line 481-482 — PUT catch block
// Before:
catch (err) {
	console.error(err.message);
	process.exit(1);
}
// After:
catch (err) {
	throw new CliError(err.message);
}
```

### Step 10 — Wrap `main()` body in `try/catch`

File: `scripts/push-to-confluence.mjs`, `main()` starting at line 388.

Before (the current overall structure):
```js
async function main() {
	const args = process.argv.slice(2);
	// ... all logic ...
	console.log(`✓ Published "${title}" to Confluence (version ${version + 1})`);
}

main();
```

After:
```js
async function main() {
	try {
		const args = process.argv.slice(2);
		// ... all logic (unchanged) ...
		console.log(`✓ Published "${title}" to Confluence (version ${version + 1})`);
	} catch (err) {
		if (err instanceof CliError) {
			console.error(err.message);
			process.exit(err.exitCode);
		}
		throw err; // re-throw unexpected errors as unhandled exceptions
	}
}

main();
```

The `try` wraps the entire existing body of `main()`. The `catch` only handles `CliError`; anything else (e.g. a `TypeError` from a bug) propagates as an unhandled rejection and prints a full stack trace — which is correct debugging behaviour.

### Step 11 — Update tests (spec 09 test files)

In any test files under `scripts/lib/*.test.mjs`, replace `process.exit` spy patterns with direct assertion:

```js
// Before (mock-based, brittle)
const exitSpy = sinon.stub(process, "exit");
resolvePageId("-1");
assert.ok(exitSpy.calledWith(1));
exitSpy.restore();

// After (clean, no mocking)
import { CliError } from "./errors.mjs";
assert.throws(() => resolvePageId("-1"), CliError);
```

> Ralph: if spec 09 tests have not yet landed when this spec is implemented, skip this step and note it in the follow-ups.

## Test cases

| Input | Function under test | Expected result |
|---|---|---|
| No credentials file, no env vars | `loadCredentials()` | Throws `CliError` with message `"Run \`npm run confluence -- --setup\` to configure credentials"` |
| `resolvePageId("0")` | `resolvePageId()` | Throws `CliError` with message containing `"Invalid page ID: 0"` |
| `resolvePageId("my-key")` without `confluence-pages.json` | `resolvePageId()` | Throws `CliError` with message containing `"confluence-pages.json not found"` |
| `resolvePageId("missing-key")` with valid `confluence-pages.json` | `resolvePageId()` | Throws `CliError` with message containing `"not found in confluence-pages.json"` |
| `injectContent` with `[AUTO_INSERT_START: x]` but no `[AUTO_INSERT_END: x]` | `injectContent()` | Throws `CliError` with message containing `"without a matching [AUTO_INSERT_END]"` |
| `main()` receives a `CliError` thrown from deep in the call stack | `main()` `catch` block | `console.error` called once with `err.message`; `process.exit` called once with `err.exitCode` (1) |
| `main()` receives an unexpected `TypeError` (bug) | `main()` `catch` block | Error is re-thrown; Node prints stack trace; process exits with non-zero code |
| `runVerify()` with one failing page | `runVerify()` | Throws `CliError` with `exitCode: 1`; caught by `main()`'s try/catch |
| `runVerify()` with all pages passing | `runVerify()` | Returns normally; `main()` falls through to exit 0 |

## Acceptance criteria

- [ ] `scripts/lib/errors.mjs` exists and exports `CliError extends Error` with `name`, `message`, and `exitCode` properties.
- [ ] `CliError` constructor defaults `exitCode` to `1`.
- [ ] Every `console.error(msg); process.exit(1)` pair in `push-to-confluence.mjs` is replaced with `throw new CliError(msg)`.
- [ ] `handleHttpError` throws `new CliError(msg)` instead of calling `process.exit(1)`.
- [ ] `runVerify()`'s terminal `process.exit(hasErrors ? 1 : 0)` is replaced: success path returns normally; failure path throws `CliError`.
- [ ] `main()` has a single top-level `try/catch` that handles `CliError` with `console.error` + `process.exit`, and re-throws all other errors.
- [ ] `httpsRequest`'s `reject(new Error(...))` is unchanged.
- [ ] `runSetup()`'s `process.exit(0)` on user abort (line 339) is unchanged.
- [ ] Observable behaviour is identical: same messages to stderr, same exit codes.
- [ ] `grep 'process\.exit(1)' scripts/push-to-confluence.mjs` returns zero matches (all replaced).
- [ ] `grep 'process\.exit' scripts/push-to-confluence.mjs` returns only the two legitimate exits: the `process.exit(0)` in `runSetup()` abort, and the one inside `main()`'s `catch` block.
- [ ] Lint passes (`pnpm run lint` if configured).

## Verification

```sh
# 1. Confirm CliError file was created
ls scripts/lib/errors.mjs

# 2. Confirm CliError is imported in the main script
grep "CliError" scripts/push-to-confluence.mjs | head -3

# 3. Confirm no bare process.exit(1) calls remain (should be 0 matches)
grep -n 'process\.exit(1)' scripts/push-to-confluence.mjs
# Expected: no output

# 4. Confirm only expected process.exit calls remain
grep -n 'process\.exit' scripts/push-to-confluence.mjs
# Expected: two lines — the abort in runSetup() (exit 0) and main()'s catch (err.exitCode)

# 5. Confirm CliError is thrown in resolvePageId
grep -n 'throw new CliError' scripts/push-to-confluence.mjs | wc -l
# Expected: ~20 lines

# 6. Confirm main() has a try/catch wrapping its body
grep -n 'instanceof CliError' scripts/push-to-confluence.mjs
# Expected: 1 match in main()

# 7. Smoke test — no credentials
unset CONFLUENCE_URL CONFLUENCE_USER CONFLUENCE_TOKEN
node scripts/push-to-confluence.mjs some-key docs/plans/15-clierror-class.md; echo "Exit: $?"
# Expected: stderr "Run `npm run confluence -- --setup`...", exit 1

# 8. Smoke test — insufficient args
node scripts/push-to-confluence.mjs; echo "Exit: $?"
# Expected: stderr "Usage: npm run confluence...", exit 1
```

## Out of scope

- Do not add `exitCode: 2` or other non-1 exit codes (beyond the `runVerify` false case). A single `exitCode` field is added for structural correctness but the values remain 1 in all new paths.
- Do not change `httpsRequest`'s `reject(new Error(...))` pattern.
- Do not add structured JSON error output.
- Do not create a top-level `errors.mjs` at the repo root — the file goes in `scripts/lib/`.
- Do not modify the slash command (`commands/unic-confluence.md`).
- No version bump required for this change.

## Follow-ups

- If spec 09 (unit tests) has not yet landed: once it does, update the tests to use `assert.throws(fn, CliError)` as described in Step 11.
- Consider adding `exitCode: 2` for configuration errors (missing credentials, missing `confluence-pages.json`) vs. `exitCode: 1` for runtime errors — deferred until there is a demonstrated need.
- `handleHttpError` currently uses `process.argv[2]` / `process.argv[3]` to construct the 409 retry hint. After this change the function signature could accept the page arg directly — deferred.

_Ralph: append findings here._
