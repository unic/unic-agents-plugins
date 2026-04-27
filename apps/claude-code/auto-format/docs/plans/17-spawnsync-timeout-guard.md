# 17. `spawnSync` timeout guard for Prettier and ESLint
**Status: done — 2026-04-28**

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-03
**Touches:** `scripts/format-hook.mjs`, `tests/format-hook.test.mjs`

## Context

`runPrettier` and `runEslint` in `format-hook.mjs` call `spawnSync` with no `timeout` option. A pathological input (e.g. a 50 MB minified JS file, a deeply nested JSON structure, an unterminated template literal) can cause Prettier or ESLint to hang indefinitely.

The plugin's documented invariant #1 is "always exits 0 — never blocks Claude's tool flow." Without a timeout, that invariant only holds when the external tools themselves behave. A hung formatter keeps Claude's tool pipeline stalled until the user force-kills the session.

Adding a `timeout` option to both `spawnSync` calls enforces the invariant unconditionally. The default of 30 s is generous for any single file; a per-project `formatTimeoutMs` escape hatch accommodates unusual setups.

Note: spec-19 (Biome support) will introduce a third `spawnSync` call; the timeout guard must also be applied there. If spec-17 lands before spec-19, Ralph implementing spec-19 should copy the same pattern.

## Current behaviour

After spec-03 and spec-04: `runPrettier` and `runEslint` in `scripts/format-hook.mjs` both call `spawnSync` with `stdio: ['ignore', 'ignore', 'pipe']` and no `timeout`. If a formatter hangs, the hook hangs with it.

## Target behaviour

- Both `spawnSync` calls include `timeout: CONFIG.formatTimeoutMs` and `killSignal: 'SIGTERM'`.
- `CONFIG.formatTimeoutMs` defaults to `30_000` (30 s), read from `.claude/unic-format.json` when present, clamped to `[1_000, 120_000]`.
- When a formatter times out (`r.signal === 'SIGTERM'` or `r.status === null`), the hook logs one stderr line `unic-format: prettier timed out after 30s` (or `eslint`) and continues — the hook still exits 0.
- A new smoke test stubs a hanging `prettier` binary and asserts the hook completes within ~33 s with the expected stderr message.

## Implementation steps

### Step 1 — Add `formatTimeoutMs` to `DEFAULTS` and `loadProjectConfig`

In `scripts/format-hook.mjs`:

1. Add to `DEFAULTS`:
   ```js
   const DEFAULTS = {
   	// … existing keys …
   	formatTimeoutMs: 30_000,
   }
   ```

2. In `loadProjectConfig`, read and clamp the new key:
   ```js
   const raw = Number(cfg.formatTimeoutMs)
   formatTimeoutMs: Number.isFinite(raw) ? Math.min(Math.max(raw, 1_000), 120_000) : DEFAULTS.formatTimeoutMs,
   ```

### Step 2 — Add timeout to `runPrettier` and `runEslint`

Update both functions to include `timeout` and `killSignal`, and detect the timeout condition:

```js
function runPrettier(filePath) {
	if (!existsSync(PRETTIER_BIN)) return
	const r = spawnSync('node', [PRETTIER_BIN, '--write', '--ignore-unknown', '--log-level', 'warn', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: CONFIG.formatTimeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: prettier timed out after ${CONFIG.formatTimeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	if (r.status !== 0) {
		process.stderr.write(`unic-format: prettier failed: ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

function runEslint(filePath) {
	if (!existsSync(ESLINT_BIN)) return
	const r = spawnSync('node', [ESLINT_BIN, '--fix', '--no-error-on-unmatched-pattern', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: CONFIG.formatTimeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: eslint timed out after ${CONFIG.formatTimeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	// Status 1 = lint warnings/errors remain after --fix (not a hook failure).
	if (r.status !== 0 && r.status !== 1) {
		process.stderr.write(`unic-format: eslint failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}
```

### Step 3 — Add timeout smoke test in `tests/format-hook.test.mjs`

Create a stub `fake-prettier.mjs` that sleeps longer than the hook's default timeout, install it as a fake `node_modules/.bin/prettier` in a temp consumer dir, and assert the hook returns within a reasonable time with the timeout message.

```js
import { setTimeout as sleep } from 'node:timers/promises'

test('exits 0 and logs timeout when prettier hangs', async () => {
	const dir = makeConsumer((d) => {
		// Create a stub prettier that sleeps for 90s (much longer than the 2s test timeout)
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const stubScript = `#!/usr/bin/env node\nawait new Promise(r => setTimeout(r, 90_000))\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'prettier'), stubScript, { mode: 0o755 })
		writeFileSync(join(d, 'test.md'), '# hello\n')
	})
	try {
		// Override timeout to 2 s so the test doesn't actually wait 30 s
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'test.md') } }),
			dir,
			{ UNIC_FORMAT_TIMEOUT_MS: '2000' },
		)
		assert.equal(exitCode, 0)
		assert.match(stderr, /timed out/, 'should log timeout warning')
	} finally {
		cleanup(dir)
	}
})
```

Note: `UNIC_FORMAT_TIMEOUT_MS` is an env-var shorthand the implementation may expose as an alternative to the JSON config (simpler for tests); if the implementation only supports the JSON config key, the test should write a `.claude/unic-format.json` with `{"formatTimeoutMs": 2000}` instead.

The preferred approach: read `formatTimeoutMs` from the JSON config only (not env var) and in the test, write the config file. The env-var shorthand shown above is for convenience only and need not be implemented.

### Step 4 — Commit

```sh
git add scripts/format-hook.mjs tests/format-hook.test.mjs
git commit -m "fix(spec-17): add spawnSync timeout guard (default 30s) to prevent hanging hook"
```

## Acceptance criteria

- `runPrettier` and `runEslint` both include `timeout` and `killSignal: 'SIGTERM'` in their `spawnSync` options.
- Timeout defaults to 30 000 ms; clamped to [1 000, 120 000] if overridden.
- A timed-out call logs to stderr and returns — it does not throw or exit non-zero.
- `pnpm test` passes including the new timeout test.
- No external deps added.

## Verification

```sh
# 1. timeout present in both spawnSync calls
grep -n "timeout:" scripts/format-hook.mjs
# Expected: 2 lines (one per function)

# 2. All tests pass
pnpm test
```

## Out of scope

- Applying the timeout to the Biome `spawnSync` call (done in spec-19 which adds Biome).
- Exposing timeout via env var (config file is sufficient).
- SIGKILL escalation if SIGTERM is ignored (30 s is already generous; escalation adds complexity with minimal practical benefit).

_Ralph: append findings here._
