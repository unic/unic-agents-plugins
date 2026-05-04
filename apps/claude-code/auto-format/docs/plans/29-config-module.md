# 29. Extract `lib/config.mjs` with `DEFAULTS`, `loadConfig`, and tests

**Priority:** P2
**Effort:** S
**Version impact:** patch
**Depends on:** spec-22
**Touches:** `scripts/lib/config.mjs` (new), `scripts/lib/config.test.mjs` (new), `package.json`

## Context

`loadProjectConfig()` in `format-hook.mjs` closes over the module-level `PROJECT_DIR` constant,
making the merge logic untestable in isolation. `DEFAULTS` (the full config contract) lives in the
hook entry point with no clear seam. See PRD at `docs/issues/auto-format-config/PRD.md`.

This spec creates `lib/config.mjs` and its tests. `format-hook.mjs` is unchanged — that is
spec-30.

## Current behaviour

No `scripts/lib/config.mjs` exists. Config defaults and merge logic are inline in `format-hook.mjs`
with no unit tests for the merge strategy.

## Target behaviour

`scripts/lib/config.mjs` exports `DEFAULTS` and `loadConfig(projectDir)`.
`scripts/lib/config.test.mjs` has ten passing tests.
`pnpm test` runs both the existing and new test files.

## Affected files

| File | Change |
|---|---|
| `scripts/lib/config.mjs` | New — `DEFAULTS` constant + `loadConfig` function |
| `scripts/lib/config.test.mjs` | New — ten tests |
| `package.json` | Update `scripts.test` to include the new test file |

## Implementation steps

### Step 1 — Create `scripts/lib/config.mjs`

The content is derived from `format-hook.mjs` lines 25–93, with two changes:
- `DEFAULTS` is exported
- `loadProjectConfig()` is renamed `loadConfig(projectDir)` and the `PROJECT_DIR` reference is
  replaced by the `projectDir` parameter

```js
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/** @import { ProjectConfig, FormatterName } from './types.mjs' */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** @type {ProjectConfig} */
export const DEFAULTS = {
	skipPrefixes: [
		'_bmad/',
		'.claude/skills/bmad-',
		'.claude/worktrees/',
		'.history/',
		'.git/',
		'node_modules/',
		'dist/',
		'build/',
		'.next/',
		'coverage/',
	],
	prettierExtensions: [
		'.md',
		'.mdx',
		'.json',
		'.jsonc',
		'.yml',
		'.yaml',
		'.js',
		'.mjs',
		'.cjs',
		'.ts',
		'.mts',
		'.cts',
		'.tsx',
		'.feature',
	],
	eslintExtensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.json', '.jsonc', '.md'],
	formatTimeoutMs: 30_000,
	formatter: 'auto',
}

const VALID_FORMATTERS = new Set(['auto', 'prettier', 'biome'])

/**
 * Reads `.claude/unic-format.json` from `projectDir` and merges it with DEFAULTS.
 * Returns DEFAULTS on missing file or parse error.
 *
 * @param {string} projectDir - Absolute path to the consumer project root.
 * @returns {ProjectConfig}
 */
export function loadConfig(projectDir) {
	const configPath = resolve(projectDir, '.claude/unic-format.json')
	if (!existsSync(configPath)) return DEFAULTS
	try {
		const cfg = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(configPath, 'utf8')))
		const raw = Number(cfg.formatTimeoutMs)
		const hasFullReplacement = Array.isArray(cfg.skipPrefixes) && cfg.skipPrefixes.length > 0
		const hasAdditive = Array.isArray(cfg.additionalSkipPrefixes) && cfg.additionalSkipPrefixes.length > 0
		return {
			skipPrefixes: hasFullReplacement
				? /** @type {string[]} */ (cfg.skipPrefixes)
				: hasAdditive
					? [...DEFAULTS.skipPrefixes, .../** @type {string[]} */ (cfg.additionalSkipPrefixes)]
					: DEFAULTS.skipPrefixes,
			prettierExtensions: Array.isArray(cfg.prettierExtensions) ? cfg.prettierExtensions : DEFAULTS.prettierExtensions,
			eslintExtensions: Array.isArray(cfg.eslintExtensions) ? cfg.eslintExtensions : DEFAULTS.eslintExtensions,
			formatTimeoutMs: Number.isFinite(raw) ? Math.min(Math.max(raw, 1_000), 120_000) : DEFAULTS.formatTimeoutMs,
			formatter: /** @type {FormatterName} */ (
				VALID_FORMATTERS.has(/** @type {string} */ (cfg.formatter)) ? cfg.formatter : DEFAULTS.formatter
			),
		}
	} catch (err) {
		process.stderr.write(
			`unic-format: ignoring malformed .claude/unic-format.json: ${/** @type {Error} */ (err).message}\n`,
		)
		return DEFAULTS
	}
}
```

### Step 2 — Create `scripts/lib/config.test.mjs`

```js
// @ts-check
import { deepStrictEqual, strictEqual, ok } from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DEFAULTS, loadConfig } from './config.mjs'

/**
 * Creates a temp directory to act as the consumer project root.
 * Caller must rmSync(dir) in a finally block.
 *
 * @returns {string}
 */
function makeProjectDir() {
	return mkdtempSync(join(tmpdir(), 'config-test-'))
}

/**
 * Writes `.claude/unic-format.json` into dir with the given content.
 *
 * @param {string} dir
 * @param {unknown} content
 */
function writeConfig(dir, content) {
	mkdirSync(join(dir, '.claude'), { recursive: true })
	writeFileSync(join(dir, '.claude', 'unic-format.json'), JSON.stringify(content))
}

test('returns DEFAULTS when no config file exists', () => {
	const dir = makeProjectDir()
	try {
		deepStrictEqual(loadConfig(dir), DEFAULTS)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('returns DEFAULTS and writes stderr on malformed JSON', () => {
	const dir = makeProjectDir()
	const stderrLines = /** @type {string[]} */ ([])
	const orig = process.stderr.write.bind(process.stderr)
	// @ts-ignore
	process.stderr.write = (/** @type {string} */ s) => { stderrLines.push(String(s)); return true }
	try {
		mkdirSync(join(dir, '.claude'), { recursive: true })
		writeFileSync(join(dir, '.claude', 'unic-format.json'), '{not valid json')
		deepStrictEqual(loadConfig(dir), DEFAULTS)
		strictEqual(stderrLines.length, 1)
		ok(stderrLines[0].includes('malformed'))
	} finally {
		process.stderr.write = orig
		rmSync(dir, { recursive: true, force: true })
	}
})

test('full skipPrefixes replacement when non-empty array provided', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { skipPrefixes: ['custom/'] })
		const cfg = loadConfig(dir)
		deepStrictEqual(cfg.skipPrefixes, ['custom/'])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('additionalSkipPrefixes appends to DEFAULTS when no skipPrefixes given', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { additionalSkipPrefixes: ['extra/'] })
		const cfg = loadConfig(dir)
		deepStrictEqual(cfg.skipPrefixes, [...DEFAULTS.skipPrefixes, 'extra/'])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('uses DEFAULTS.skipPrefixes when neither field is provided', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, {})
		const cfg = loadConfig(dir)
		deepStrictEqual(cfg.skipPrefixes, DEFAULTS.skipPrefixes)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('clamps formatTimeoutMs to minimum 1000', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatTimeoutMs: 100 })
		strictEqual(loadConfig(dir).formatTimeoutMs, 1_000)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('clamps formatTimeoutMs to maximum 120000', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatTimeoutMs: 999_999 })
		strictEqual(loadConfig(dir).formatTimeoutMs, 120_000)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accepts valid formatTimeoutMs within range', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatTimeoutMs: 15_000 })
		strictEqual(loadConfig(dir).formatTimeoutMs, 15_000)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('uses DEFAULTS.formatter for invalid formatter value', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatter: 'webpack' })
		strictEqual(loadConfig(dir).formatter, DEFAULTS.formatter)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accepts valid formatter value "biome"', () => {
	const dir = makeProjectDir()
	try {
		writeConfig(dir, { formatter: 'biome' })
		strictEqual(loadConfig(dir).formatter, 'biome')
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
```

### Step 3 — Update `package.json` test script

Change:

```json
"test": "node --test tests/format-hook.test.mjs scripts/lib/runners.test.mjs"
```

to:

```json
"test": "node --test tests/format-hook.test.mjs scripts/lib/runners.test.mjs scripts/lib/config.test.mjs"
```

Note: if spec-26 has not yet landed, the test command before this spec will be
`node --test tests/format-hook.test.mjs` — update accordingly.

### Step 4 — Verify

```sh
node --test scripts/lib/config.test.mjs
pnpm test
pnpm typecheck
```

### Step 5 — Commit

```sh
git add scripts/lib/config.mjs scripts/lib/config.test.mjs package.json
git commit -m "chore(spec-29): extract loadConfig and DEFAULTS to lib/config.mjs with tests"
```

## Verification

```sh
# Exports present
node --input-type=module <<'EOF'
import { DEFAULTS, loadConfig } from './scripts/lib/config.mjs'
console.log(typeof DEFAULTS, typeof loadConfig)
EOF

# New tests pass
node --test scripts/lib/config.test.mjs

# Full suite passes
pnpm test

# Type-check passes
pnpm typecheck
```

## Acceptance criteria

- [ ] `scripts/lib/config.mjs` exports `DEFAULTS` and `loadConfig`
- [ ] `loadConfig` accepts `projectDir: string` — no reference to `process.env` or `process.cwd()`
- [ ] All 10 tests in `scripts/lib/config.test.mjs` pass
- [ ] `pnpm test` passes (existing tests unaffected)
- [ ] `pnpm typecheck` passes
- [ ] `format-hook.mjs` is not modified

## Out of scope

- Changes to `format-hook.mjs` (spec-30)
- Changing the config schema or DEFAULTS values
- Exporting `VALID_FORMATTERS`

_Ralph: append findings here._
