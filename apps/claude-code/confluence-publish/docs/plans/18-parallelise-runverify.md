# 18. Parallelise `runVerify()` with `Promise.all`

**Priority:** P2
**Effort:** S
**Depends on:** spec 01 outcome — if `--verify` was fully deleted by spec 01, this spec is superseded. Spec 15 (`CliError`) is a soft dependency: if it has landed, replace `process.exit(1)` calls below with `throw new CliError(msg)`.
**Touches:** `scripts/push-to-confluence.mjs`

## Context

`runVerify()` (lines 256–306 of `scripts/push-to-confluence.mjs`) performs one HTTP GET per entry in `confluence-pages.json` using a sequential `for...of` loop. Each GET waits for the previous one to complete before starting. For a team that accumulates 10 mapped pages, a verify run makes 10 serial requests; at ~300ms per request over VPN, that is 3 seconds minimum. At 20 pages it is 6 seconds. The requests are independent — no result depends on another — so there is no reason for the serialisation. Replacing the loop with `Promise.all` cuts verify time to approximately one round-trip regardless of page count. The change also restructures the function slightly: ID validation (synchronous, no I/O) is separated from the HTTP phase so that invalid IDs are reported immediately without firing any network requests.

**Prerequisite check:** Read spec 01 (`docs/plans/01-drop-verify-from-slash-command.md`). Spec 01 removes `--verify` from the slash command's pre-flight step but explicitly states "The existing `--verify` subcommand is left unchanged — it remains useful as an interactive diagnostic tool." If the version of spec 01 that was actually implemented kept `runVerify()` in place (the intended outcome), proceed with this spec. If for some reason `runVerify()` was deleted entirely, mark this spec as superseded by spec 01 and skip it.

## Current behaviour

`scripts/push-to-confluence.mjs`, lines 256–307:

```js
async function runVerify() {
	const pagesPath = path.join(process.cwd(), "confluence-pages.json");
	if (!existsSync(pagesPath)) {
		console.error("confluence-pages.json not found — create it first");
		process.exit(1);
	}

	let pages;
	try {
		pages = JSON.parse(readFileSync(pagesPath, "utf8"));
	} catch {
		console.error("invalid JSON in confluence-pages.json — check syntax");
		process.exit(1);
	}

	const pageKeys = Object.keys(pages).filter((k) => k !== "_comment");
	console.log(`Verifying ${pageKeys.length} page(s): ${pageKeys.join(", ")}`);

	const { url: baseUrl, username, token } = loadCredentials();
	const authHeader = makeBasicAuth(username, token);

	let hasErrors = false;
	for (const [key, id] of Object.entries(pages)) {
		if (key === "_comment") continue;
		if (!Number.isInteger(id) || id <= 0) {
			console.error(
				`❌ ${key}: Invalid page ID in confluence-pages.json: ${JSON.stringify(id)} — must be a positive integer`,
			);
			hasErrors = true;
			continue;
		}
		const getUrl = `${baseUrl.replace(/\/$/, "")}/wiki/api/v2/pages/${id}?body-format=storage`;
		try {
			const res = await httpsRequest("GET", getUrl, authHeader);
			if (res.status === 200) {
				const pageData = JSON.parse(res.body);
				console.log(`✅ ${key} (${id}): ${pageData.title}`);
			} else if (res.status === 404) {
				console.error(`❌ ${key} (${id}): Page not found — 404`);
				hasErrors = true;
			} else {
				console.error(`⚠️  ${key} (${id}): Unexpected HTTP ${res.status}`);
				hasErrors = true;
			}
		} catch {
			console.error(`⚠️  ${key} (${id}): Network error`);
			hasErrors = true;
		}
	}

	process.exit(hasErrors ? 1 : 0);
}
```

Performance characteristics: N entries → N serial HTTP GETs. Each GET blocks the next.

## Target behaviour

`runVerify()` fires all HTTP GETs concurrently via `Promise.all`. The function:

1. Validates the `confluence-pages.json` file (sync — unchanged).
2. Validates all page IDs synchronously before making any network requests. If any ID is invalid, prints all invalid-ID errors immediately and exits 1 without firing any GETs.
3. Fires all GETs in parallel with `Promise.all`.
4. After all settle, prints results in the original key order (order preserved because `Promise.all` preserves order).
5. Exits 0 if all passed, 1 if any failed.

The output format is identical — same `✅ / ❌ / ⚠️` lines, same stderr/stdout distinction. The only observable difference is that output lines may arrive in a different order than file order if some requests resolve before others, but since all results are collected before printing (see implementation), the printed order matches the `confluence-pages.json` key order.

If spec 15 (`CliError`) has landed: replace `process.exit(1)` in the early-exit paths with `throw new CliError(msg)`.

## Implementation steps

### Step 1 — Replace the `for...of` loop in `runVerify()`

Locate the `for...of` loop starting at approximately line 278:

```js
	let hasErrors = false;
	for (const [key, id] of Object.entries(pages)) {
		if (key === "_comment") continue;
		// ... validation and await httpsRequest ...
	}

	process.exit(hasErrors ? 1 : 0);
```

Replace everything from `let hasErrors = false;` to the end of the function with:

```js
	const entries = Object.entries(pages).filter(([k]) => k !== "_comment");

	// Phase 1: synchronous ID validation (no network I/O)
	// Report all invalid IDs before making any HTTP requests.
	let hasErrors = false;
	for (const [key, id] of entries) {
		if (!Number.isInteger(id) || id <= 0) {
			console.error(
				`❌ ${key}: Invalid page ID in confluence-pages.json: ${JSON.stringify(id)} — must be a positive integer`,
			);
			hasErrors = true;
		}
	}
	if (hasErrors) {
		process.exit(1);
		// If spec 15 has landed, use: throw new CliError("Invalid page IDs found — fix confluence-pages.json", 1);
	}

	// Phase 2: parallel GET requests
	const results = await Promise.all(
		entries.map(async ([key, id]) => {
			const getUrl = `${baseUrl.replace(/\/$/, "")}/wiki/api/v2/pages/${id}?body-format=storage`;
			try {
				const res = await httpsRequest("GET", getUrl, authHeader);
				if (res.status === 200) {
					const pageData = JSON.parse(res.body);
					return { ok: true, key, id, title: pageData.title };
				}
				return { ok: false, key, id, status: res.status };
			} catch {
				return { ok: false, key, id, networkError: true };
			}
		}),
	);

	// Phase 3: collect results and print in key order
	for (const r of results) {
		if (r.ok) {
			console.log(`✅ ${r.key} (${r.id}): ${r.title}`);
		} else if (r.networkError) {
			console.error(`⚠️  ${r.key} (${r.id}): Network error`);
			hasErrors = true;
		} else if (r.status === 404) {
			console.error(`❌ ${r.key} (${r.id}): Page not found — 404`);
			hasErrors = true;
		} else {
			console.error(`⚠️  ${r.key} (${r.id}): Unexpected HTTP ${r.status}`);
			hasErrors = true;
		}
	}

	process.exit(hasErrors ? 1 : 0);
	// If spec 15 has landed, use:
	// if (hasErrors) throw new CliError("One or more pages failed verification — see errors above", 1);
	// (and remove process.exit — main()'s catch handles it)
}
```

No other changes to `runVerify()`. The file-loading preamble (lines 257–275: `existsSync`, `JSON.parse`, `loadCredentials`, `makeBasicAuth`, `console.log("Verifying...")`) is unchanged.

### Step 2 — Verify no sequential `await` remains inside the verify loop

After the edit, confirm that `runVerify` contains no `await` inside a `for` loop. The only `await` should be `await Promise.all(...)`.

```sh
# Should show 0 matches (no await inside a for loop in runVerify)
awk '/async function runVerify/,/^}/' scripts/push-to-confluence.mjs | grep -c "await httpsRequest"
# Expected: 0
```

### Step 3 — Conditional: if spec 15 has already landed

If `CliError` is already imported in the file (check with `grep "CliError" scripts/push-to-confluence.mjs`), replace the two `process.exit(1)` calls added in Step 1 with `throw new CliError(...)` as noted in the comments:

```js
// Phase 1 early exit
if (hasErrors) {
	throw new CliError("Invalid page IDs found — fix confluence-pages.json", 1);
}

// Phase 3 terminal exit
if (hasErrors) {
	throw new CliError("One or more pages failed verification — see errors above", 1);
}
// success: return normally; main()'s try/catch handles process.exit(0)
```

If spec 15 has not landed, leave `process.exit(1)` and `process.exit(hasErrors ? 1 : 0)` as-is.

## Test cases

| Scenario | Input | Expected output | Exit code |
|---|---|---|---|
| All pages valid | `confluence-pages.json` with 3 valid numeric IDs, all return HTTP 200 | Three `✅ key (id): Title` lines; printed in key order | 0 |
| One invalid ID (string, not integer) | `{ "page": "not-a-number" }` in `confluence-pages.json` | `❌ page: Invalid page ID … must be a positive integer` on stderr; no GETs fired | 1 |
| One invalid ID (zero) | `{ "page": 0 }` | `❌ page: Invalid page ID …` on stderr; no GETs fired | 1 |
| Multiple invalid IDs | `{ "a": "x", "b": -1 }` | Two `❌` lines on stderr; no GETs fired | 1 |
| One 404 response | Page ID in file, Confluence returns 404 | `❌ key (id): Page not found — 404` on stderr | 1 |
| One network error | `httpsRequest` rejects for one entry | `⚠️  key (id): Network error` on stderr | 1 |
| One unexpected HTTP status (e.g. 503) | Confluence returns 503 | `⚠️  key (id): Unexpected HTTP 503` on stderr | 1 |
| Mix: one ✅, one ❌ 404 | Two entries, one passes, one 404 | One `✅` line, one `❌` line; both GETs fired in parallel | 1 |
| Empty `confluence-pages.json` (only `_comment`) | `{ "_comment": "…" }` | `Verifying 0 page(s):` on stdout; exits immediately | 0 |
| Performance: 5 entries at 200ms each (simulated) | — | Total time ≈ 200ms (one round trip), not ≈ 1000ms (five serial) | 0 |

## Acceptance criteria

- [ ] `runVerify()` contains no `await` inside a `for` loop — ID validation is sync, HTTP calls are concurrent.
- [ ] `Promise.all` is used for the HTTP phase.
- [ ] Results are printed after all promises settle (not interleaved with I/O operations).
- [ ] Output lines are printed in `confluence-pages.json` key order.
- [ ] Invalid page IDs are reported synchronously, before any HTTP requests are made.
- [ ] If any IDs are invalid, the function exits 1 without firing any GETs.
- [ ] The output format (`✅ / ❌ / ⚠️` prefix + `key (id): message`) is identical to the current format.
- [ ] The `_comment` key is filtered out and never included in verification.
- [ ] All other functions in the file are unchanged.
- [ ] Lint passes.

## Verification

```sh
# 1. Confirm no sequential await inside verify
awk '/^async function runVerify/,/^\}/' scripts/push-to-confluence.mjs | grep "await httpsRequest"
# Expected: no output (no direct await httpsRequest inside the function body outside Promise.all)

# 2. Confirm Promise.all is used
grep -n "Promise.all" scripts/push-to-confluence.mjs
# Expected: at least one match inside runVerify

# 3. Confirm ID validation phase is separate from HTTP phase
grep -n "Phase 1\|Phase 2\|Phase 3" scripts/push-to-confluence.mjs
# Expected: three comment lines (optional — they may be removed, but the structure should exist)

# 4. Confirm output format is unchanged (key strings present)
grep "✅\|❌\|⚠️" scripts/push-to-confluence.mjs | grep "runVerify\|key.*id\|r\.key"
# Expected: matches in the results-printing loop

# 5. Smoke test — no confluence-pages.json
unset CONFLUENCE_URL CONFLUENCE_USER CONFLUENCE_TOKEN
node scripts/push-to-confluence.mjs --verify 2>&1; echo "Exit: $?"
# Expected: "confluence-pages.json not found" error, exit 1

# 6. Timing test (optional, requires real credentials and 3+ entries in confluence-pages.json)
# time node scripts/push-to-confluence.mjs --verify
# Before this change: ~N × round-trip latency
# After this change:  ~1 × round-trip latency
```

## Out of scope

- Do not add rate limiting or a concurrency cap. Confluence's API handles the typical number of mapped pages (< 50) without throttling. If a project has hundreds of entries, a concurrency cap can be added as a follow-up.
- Do not change the output format (`✅ / ❌ / ⚠️` lines).
- Do not modify `httpsRequest`, `loadCredentials`, `makeBasicAuth`, or any other helper.
- Do not add `--verbose` or `--quiet` flags.
- Do not modify `runSetup()`, `main()`, or any other function.
- No version bump required for this internal refactor.

## Follow-ups

- If a project accumulates > 50 pages in `confluence-pages.json`, consider adding a `p-limit` concurrency cap (e.g. 10 concurrent requests) to avoid saturating the VPN or hitting Confluence rate limits. This is not needed now.
- After spec 15 (`CliError`) lands, update the two `process.exit` calls in this function to `throw new CliError(...)` as noted in the Step 3 conditional.
- After spec 09 (unit tests) lands, add a test that mocks `httpsRequest` to return immediately and asserts that all calls were made before any results were printed.

_Ralph: append findings here._
