# 07. HTTP Timeout and `--check-auth` Subcommand
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** spec 01 (which introduced `--ping`; this spec formalises it as `--check-auth`)
**Touches:** `scripts/push-to-confluence.mjs`, `commands/unic-confluence.md`

## Context

`httpsRequest` (lines 64–95) creates an HTTPS request but never sets a timeout. If the connection hangs — due to a VPN drop mid-flight, a firewall that silently drops packets without sending TCP RST, or a Confluence server that accepts the connection but never sends response bytes — the process waits indefinitely. There is no way to interrupt it short of `Ctrl+C`. For a CLI tool used inside Claude Code slash commands (which have their own timeout budget), a hung sub-process is particularly damaging because it holds the Claude context open without making progress.

The fix is a 30-second socket timeout using Node's `req.setTimeout()`, which emits a `timeout` event and allows the code to call `req.destroy(err)` to surface a clean error message. The existing `req.on("error", reject)` handler already catches the resulting error, so no new control flow is needed.

Spec 01 introduced a lightweight `--ping` branch for cheap credential probing. This spec formalises that as `--check-auth`, which is the name used in the updated slash command documentation. If spec 01 landed with `--ping`, this spec renames it. If spec 01 has not landed, this spec adds `--check-auth` from scratch.

## Current behaviour

### `httpsRequest` — no timeout (lines 64–95)

```js
function httpsRequest(method, urlStr, authHeader, bodyObj) {
	return new Promise((resolve, reject) => {
		const parsed = new URL(urlStr);
		const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
		const options = {
			method,
			hostname: parsed.hostname,
			path: parsed.pathname + parsed.search,
			headers: {
				Authorization: authHeader,
				"Content-Type": "application/json",
				Accept: "application/json",
				...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
			},
		};

		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => resolve({ status: res.statusCode, body: data }));
		});

		req.on("error", () => {
			reject(
				new Error("Cannot reach Confluence — check VPN/network connectivity"),
			);
		});

		if (bodyStr) req.write(bodyStr);
		req.end();
	});
}
```

There is no `req.setTimeout()` call. If the server never responds, the Promise never settles and the process hangs forever.

### `main()` — no `--check-auth` (lines 388–398)

```js
async function main() {
	const args = process.argv.slice(2);

	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--verify") { await runVerify(); return; }
	// ... no --ping or --check-auth branch
```

### `commands/unic-confluence.md` — step 2 uses `--verify`

```markdown
### 2. Check credentials
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --verify

If credentials missing, instruct user to run --setup.
```

(This was the target for spec 01; check whether spec 01 has landed and already replaced `--verify` with `--ping`.)

## Target behaviour

### `httpsRequest` — 30-second timeout

Every call to `httpsRequest` times out after 30 seconds. On timeout:

- The error message is: `"Request timed out after 30s — check VPN/network connectivity"`.
- The process exits with code 1 (through the existing `catch (err) { console.error(err.message); process.exit(1); }` pattern used at every call site).
- The underlying socket is destroyed, releasing file descriptors.

### `--check-auth` subcommand

Calling `node scripts/push-to-confluence.mjs --check-auth`:

- Loads credentials via `loadCredentials()`. If credentials are not configured, exits 1 with "Run `npm run confluence -- --setup` to configure credentials" (the message from `loadCredentials`).
- Makes a single GET to `{baseUrl}/wiki/api/v2/pages?limit=1`.
- If the response status is 2xx: prints "✓ Credentials valid" to stdout and exits 0.
- If the response status is 4xx/5xx: calls `handleHttpError(status, "")` and exits 1.
- If the request throws (network unreachable, timeout): prints `err.message` to stderr and exits 1.

### `commands/unic-confluence.md` — step 2 uses `--check-auth`

```markdown
### 2. Check credentials
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --check-auth

If this fails with a credential error, instruct the user to run --setup first.
```

## Implementation steps

### Step 1 — Add timeout to `httpsRequest`

**File:** `scripts/push-to-confluence.mjs`

**Location:** Inside `httpsRequest`, after the `const req = https.request(...)` call (line 80), before the `req.on("error", ...)` call (line 86).

**Before** (lines 80–94):

```js
		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => resolve({ status: res.statusCode, body: data }));
		});

		req.on("error", () => {
			reject(
				new Error("Cannot reach Confluence — check VPN/network connectivity"),
			);
		});

		if (bodyStr) req.write(bodyStr);
		req.end();
```

**After:**

```js
		const req = https.request(options, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => resolve({ status: res.statusCode, body: data }));
		});

		req.setTimeout(30_000, () => {
			req.destroy(
				new Error("Request timed out after 30s — check VPN/network connectivity"),
			);
		});

		req.on("error", (err) => {
			reject(err);
		});

		if (bodyStr) req.write(bodyStr);
		req.end();
```

Two changes in this diff:

1. Add `req.setTimeout(30_000, callback)` — the callback calls `req.destroy(err)`. `req.destroy(err)` emits the `"error"` event with the provided error, which causes the existing `req.on("error", ...)` handler to fire and `reject` the promise with that error.

2. Change `req.on("error", () => { reject(new Error("Cannot reach...")) })` to `req.on("error", (err) => { reject(err) })` — the error is now forwarded directly rather than replaced with a generic message. This preserves the timeout message ("timed out after 30s") as well as any other OS-level errors (ECONNREFUSED, ENOTFOUND) verbatim. The old generic message masked useful diagnostic information.

**Why `req.destroy(new Error(...))` triggers `req.on("error")`**: Node.js `ClientRequest.destroy(err)` emits the `"error"` event with the provided error object. This is documented behaviour in Node.js `net.Socket` (which `ClientRequest` inherits from). Confirmed in Node.js docs: "If `error` is provided, an 'error' event will be emitted and `error` will be passed as an argument to any listeners on that event." Do not add a separate `req.on("timeout", ...)` listener — the `req.setTimeout()` callback is cleaner for this pattern.

### Step 2 — Add `--check-auth` branch to `main()`

**File:** `scripts/push-to-confluence.mjs`

**Location:** In `main()`, after the `--verify` branch (or after the `--ping` branch if spec 01 landed).

**Before** (lines 391–398):

```js
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--verify") { await runVerify(); return; }

	if (args.length < 2) {
```

**After** (if spec 01 has NOT landed — add both `--ping` removal and `--check-auth`):

```js
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--verify") { await runVerify(); return; }
	if (args[0] === "--check-auth") {
		const { url: baseUrl, username, token } = loadCredentials();
		const authHeader = makeBasicAuth(username, token);
		let res;
		try {
			res = await httpsRequest(
				"GET",
				`${baseUrl.replace(/\/$/, "")}/wiki/api/v2/pages?limit=1`,
				authHeader,
			);
		} catch (err) {
			console.error(err.message);
			process.exit(1);
		}
		if (res.status >= 200 && res.status < 300) {
			console.log("✓ Credentials valid");
			process.exit(0);
		}
		handleHttpError(res.status, "");
	}

	if (args.length < 2) {
```

**After** (if spec 01 has ALREADY landed with `--ping` — rename it):

Replace the `--ping` branch with the `--check-auth` block shown above. The implementation is identical; only the argument name changes.

**Note for Ralph**: Check whether spec 01 landed. Look for an `args[0] === "--ping"` block. If present, rename `"--ping"` to `"--check-auth"` in the condition. If absent, add the full block shown above.

### Step 3 — Update `commands/unic-confluence.md`

**File:** `commands/unic-confluence.md`

Find the line that reads (one of the following, depending on what spec 01 did):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --verify
```

or:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --ping
```

Replace it with:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" --check-auth
```

Also update any surrounding text that mentions `--verify` or `--ping` in the context of the credential check step. The `--verify` subcommand is still valid for its original purpose (full page enumeration health check) — do not remove it from the script, only from the slash command's default pre-flight path.

## Test cases

### TC-01: Timeout fires after 30 seconds (manual / observational)

Simulate a hung connection by blocking the Confluence hostname at the firewall level or by connecting to a known non-responsive host, then running:

```sh
time node scripts/push-to-confluence.mjs my-page /tmp/test.md
```

Expected: process exits after ~30 seconds with exit code 1 and stderr message "Request timed out after 30s — check VPN/network connectivity".

A lighter test: use Node's `--inspect` to pause the response callback, or use a local netcat listener that accepts the TCP connection but never sends a response:

```sh
# Terminal 1: listen but never respond
nc -l 8443

# Terminal 2: (temporarily edit credentials to point at localhost:8443)
CONFLUENCE_URL=https://localhost:8443 CONFLUENCE_USER=u CONFLUENCE_TOKEN=t \
  node scripts/push-to-confluence.mjs --check-auth
```

Expected: after 30s, exits 1 with the timeout message.

### TC-02: `--check-auth` with valid credentials

```sh
node scripts/push-to-confluence.mjs --check-auth
# Expected exit code: 0
# Expected stdout: "✓ Credentials valid"
```

Requires valid `~/.unic-confluence.json` or `CONFLUENCE_URL` / `CONFLUENCE_USER` / `CONFLUENCE_TOKEN` env vars.

### TC-03: `--check-auth` with wrong API token

Set `CONFLUENCE_TOKEN` to an invalid value:

```sh
CONFLUENCE_TOKEN=wrong node scripts/push-to-confluence.mjs --check-auth
# Expected exit code: 1
# Expected stderr: "API token rejected — generate a new one at ..."
```

### TC-04: `--check-auth` with no credentials configured

Remove `~/.unic-confluence.json` and unset env vars:

```sh
node scripts/push-to-confluence.mjs --check-auth
# Expected exit code: 1
# Expected stderr: "Run `npm run confluence -- --setup` to configure credentials"
```

### TC-05: `--check-auth` with network unreachable

Disconnect from VPN / network so that DNS resolution fails:

```sh
node scripts/push-to-confluence.mjs --check-auth
# Expected exit code: 1
# Expected stderr: error message from the OS (ENOTFOUND or similar)
# Expected: exits within 30 seconds (not hung)
```

Note: DNS failures typically return immediately (ENOTFOUND is synchronous with OS DNS). The 30-second timeout covers TCP-level hangs, not DNS failures.

### TC-06: Regular publish still works (regression)

```sh
node scripts/push-to-confluence.mjs my-page /tmp/test.md
# Expected: publishes normally, exits 0, no timeout side effects
```

The timeout is transparent for connections that complete within 30 seconds.

## Acceptance criteria

- `httpsRequest` no longer hangs indefinitely — it rejects after 30 seconds with a descriptive error.
- The timeout error message contains "30s" and "VPN/network".
- The underlying socket is destroyed on timeout (no open file descriptors after the process exits).
- `--check-auth` exits 0 with "✓ Credentials valid" when credentials are correct.
- `--check-auth` exits 1 with the appropriate `handleHttpError` message for 401, 403, 404, 409.
- `--check-auth` exits 1 with the `loadCredentials` error message when no credentials are configured.
- `commands/unic-confluence.md` uses `--check-auth` (not `--verify` or `--ping`) for the pre-flight credential probe.
- All existing functionality (publish, `--setup`, `--verify`) is unaffected by the timeout addition.

## Verification

```sh
# 1. Confirm req.setTimeout is present in the source:
grep -n "setTimeout" scripts/push-to-confluence.mjs
# Expected: one line containing "req.setTimeout(30_000,"

# 2. Confirm --check-auth branch exists:
grep -n "check-auth" scripts/push-to-confluence.mjs
# Expected: one line with args[0] === "--check-auth"

# 3. Confirm commands file references --check-auth:
grep -n "check-auth" commands/unic-confluence.md
# Expected: at least one hit

# 4. Confirm --ping or --verify is not used in the commands file for the credential step:
grep -n "\-\-ping\|\-\-verify" commands/unic-confluence.md
# Expected: no hits (or any hits are in comments/explanatory text, not as the invoked command)

# 5. Live check-auth test (requires valid credentials):
node scripts/push-to-confluence.mjs --check-auth
# Expected: "✓ Credentials valid" and exit 0
```

## Out of scope

- Do not change the 30-second timeout value — it is the conventional network operation timeout for interactive CLI tools. If the value needs to be configurable, that is a follow-up.
- Do not add retry logic — retrying automatically on timeout could exacerbate the problem (e.g., a server that is overloaded). Retrying is a user decision.
- Do not add a `--timeout` flag to override the default.
- Do not add response-streaming timeout (time between chunks) — only the initial connection / response-start timeout is addressed here.
- Do not change `runVerify()` — it keeps the sequential-GET behaviour and is still accessible via `--verify` for users who want the full health check.

## Follow-ups

- **Response body timeout**: Currently the 30-second timeout covers the time until the first response byte. A very large page body could then hang indefinitely while streaming. A `res.setTimeout()` on the response stream would address this — deferred.
- **Configurable timeout**: If users on particularly slow VPNs report false positives, add a `--timeout <ms>` flag or respect a `CONFLUENCE_TIMEOUT_MS` env var.
- **`--check-auth` in `runSetup()`**: The setup flow currently does its own inline credential validation GET (lines 368–383). After this spec lands, consider refactoring `runSetup()` to call the same code path as `--check-auth`. Deferred to avoid scope creep.
