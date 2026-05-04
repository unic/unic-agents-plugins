# 26. Extract `lib/runners.mjs` with `runFormatter` and tests
**Status: done — 2026-05-04**

**Priority:** P2
**Effort:** S
**Version impact:** patch
**Depends on:** spec-25
**Touches:** `scripts/lib/runners.mjs` (new), `scripts/lib/runners.test.mjs` (new), `package.json`

## Context

The three formatter runner functions in `format-hook.mjs` share identical subprocess logic
duplicated three times. See PRD at `docs/issues/auto-format-runners/PRD.md`.

This spec creates the generic `runFormatter` module and its tests. `format-hook.mjs` is not
modified here — that is spec-27.

## Current behaviour

No `scripts/lib/runners.mjs` exists. `spawnSync` contract is duplicated across `runPrettier`,
`runEslint`, `runBiome` in `format-hook.mjs`. Subprocess timeout and signal behaviour cannot be
tested without running the full hook.

## Target behaviour

`scripts/lib/runners.mjs` exports `runFormatter(descriptor, filePath, cwd, timeoutMs)`.
`scripts/lib/runners.test.mjs` has six passing tests covering the subprocess contract.
`pnpm test` runs both test files.

## Affected files

| File | Change |
|---|---|
| `scripts/lib/runners.mjs` | New — the `runFormatter` function |
| `scripts/lib/runners.test.mjs` | New — six tests |
| `package.json` | Update `scripts.test` to include the new test file |

## Implementation steps

### Step 1 — Create `scripts/lib/runners.mjs`

```js
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/** @import { FormatterDescriptor } from './types.mjs' */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Invokes a formatter binary as a child process, handling timeout, signal, and exit-code
 * reporting. Always returns — never throws. Diagnostics go to stderr only.
 *
 * @param {FormatterDescriptor} descriptor
 * @param {string} filePath - Absolute path of the file to format.
 * @param {string} cwd - Working directory for the child process.
 * @param {number} timeoutMs - Milliseconds before the process is sent SIGTERM.
 * @returns {void}
 */
export function runFormatter(descriptor, filePath, cwd, timeoutMs) {
	if (!existsSync(descriptor.bin)) {
		if (descriptor.warnIfMissing)
			process.stderr.write(`unic-format: ${descriptor.name} binary not found at ${descriptor.bin}\n`)
		return
	}
	const r = spawnSync('node', [descriptor.bin, ...descriptor.args(filePath)], {
		cwd,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: timeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: ${descriptor.name} timed out after ${timeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	const tolerated = descriptor.toleratedStatuses ?? []
	if (r.status !== 0 && !tolerated.includes(r.status))
		process.stderr.write(
			`unic-format: ${descriptor.name} failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`,
		)
}
```

### Step 2 — Create `scripts/lib/runners.test.mjs`

```js
// @ts-check
import { strictEqual, ok } from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runFormatter } from './runners.mjs'

/**
 * Writes a stub Node.js script to a temp directory and returns its path.
 * Caller is responsible for rmSync(dir) in a finally block.
 *
 * @param {string} script - Body of the stub (executed by node).
 * @returns {{ binPath: string, dir: string }}
 */
function makeStub(script) {
	const dir = mkdtempSync(join(tmpdir(), 'runners-test-'))
	const binPath = join(dir, 'stub.mjs')
	writeFileSync(binPath, script)
	return { binPath, dir }
}

/**
 * Intercepts process.stderr.write for the duration of fn, returns captured lines.
 *
 * @param {() => void} fn
 * @returns {string[]}
 */
function captureStderr(fn) {
	/** @type {string[]} */
	const lines = []
	const orig = process.stderr.write.bind(process.stderr)
	// @ts-ignore — overriding for test purposes
	process.stderr.write = (/** @type {string} */ s) => { lines.push(String(s)); return true }
	try { fn() } finally { process.stderr.write = orig }
	return lines
}

test('silent when binary is missing and warnIfMissing is false (or omitted)', () => {
	const lines = captureStderr(() => {
		runFormatter(
			{ name: 'fake', bin: '/nonexistent/bin/fake', args: (f) => [f] },
			'/some/file.ts', '/tmp', 5_000,
		)
	})
	strictEqual(lines.length, 0)
})

test('warns when binary is missing and warnIfMissing is true', () => {
	const lines = captureStderr(() => {
		runFormatter(
			{ name: 'fake', bin: '/nonexistent/bin/fake', args: (f) => [f], warnIfMissing: true },
			'/some/file.ts', '/tmp', 5_000,
		)
	})
	strictEqual(lines.length, 1)
	ok(lines[0].includes('binary not found'), `expected "binary not found" in: ${lines[0]}`)
})

test('reports timeout when process exceeds timeoutMs', () => {
	const { binPath, dir } = makeStub('setInterval(() => {}, 999)')
	try {
		const lines = captureStderr(() => {
			runFormatter(
				{ name: 'slow', bin: binPath, args: (f) => [f] },
				'/some/file.ts', dir, 50,
			)
		})
		strictEqual(lines.length, 1)
		ok(lines[0].includes('timed out'), `expected "timed out" in: ${lines[0]}`)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('silent for exit codes in toleratedStatuses', () => {
	const { binPath, dir } = makeStub('process.exit(1)')
	try {
		const lines = captureStderr(() => {
			runFormatter(
				{ name: 'eslint', bin: binPath, args: (f) => [f], toleratedStatuses: [1] },
				'/some/file.ts', dir, 5_000,
			)
		})
		strictEqual(lines.length, 0)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('reports failure for non-tolerated non-zero exit code', () => {
	const { binPath, dir } = makeStub('process.exit(2)')
	try {
		const lines = captureStderr(() => {
			runFormatter(
				{ name: 'biome', bin: binPath, args: (f) => [f] },
				'/some/file.ts', dir, 5_000,
			)
		})
		strictEqual(lines.length, 1)
		ok(lines[0].includes('failed (exit 2)'), `expected "failed (exit 2)" in: ${lines[0]}`)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('passes args(filePath) to the subprocess', () => {
	const { binPath, dir } = makeStub(
		`import { writeFileSync } from 'node:fs'\nwriteFileSync(process.argv[2] + '.called', '1')\n`,
	)
	const targetFile = join(dir, 'target.ts')
	writeFileSync(targetFile, '')
	try {
		captureStderr(() => {
			runFormatter(
				{ name: 'sentinel', bin: binPath, args: (f) => [f] },
				targetFile, dir, 5_000,
			)
		})
		ok(existsSync(targetFile + '.called'), 'stub should have written the sentinel file')
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
```

### Step 3 — Update `package.json` test script

Change:

```json
"test": "node --test tests/format-hook.test.mjs"
```

to:

```json
"test": "node --test tests/format-hook.test.mjs scripts/lib/runners.test.mjs"
```

### Step 4 — Verify

```sh
node --test scripts/lib/runners.test.mjs
pnpm test
pnpm typecheck
```

### Step 5 — Commit

```sh
git add scripts/lib/runners.mjs scripts/lib/runners.test.mjs package.json
git commit -m "chore(spec-26): extract runFormatter to lib/runners.mjs with tests"
```

## Verification

```sh
# Module exports runFormatter
node --input-type=module <<'EOF'
import { runFormatter } from './scripts/lib/runners.mjs'
console.log(typeof runFormatter)
EOF

# New tests pass
node --test scripts/lib/runners.test.mjs

# Full suite passes
pnpm test

# Type-check passes
pnpm typecheck
```

## Acceptance criteria

- [ ] `scripts/lib/runners.mjs` exists and exports `runFormatter`
- [ ] `runFormatter` signature: `(descriptor, filePath, cwd, timeoutMs) => void`
- [ ] All 6 tests in `scripts/lib/runners.test.mjs` pass
- [ ] `pnpm test` passes (existing `format-hook` tests unaffected)
- [ ] `pnpm typecheck` passes
- [ ] `format-hook.mjs` is not modified in this spec

## Out of scope

- Changes to `format-hook.mjs` (spec-27)
- Async subprocess execution
- Configurable binary resolution

_Ralph: append findings here._
