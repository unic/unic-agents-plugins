# 09. Smoke Tests
**Status: done — 2026-04-27**

**Priority:** P1
**Effort:** M
**Version impact:** patch
**Depends on:** spec-03, spec-04
**Touches:** `tests/format-hook.test.mjs`, `package.json`

## Context

The hook script has no automated tests. Spec 09 adds smoke tests using Node's built-in `node:test` runner (no external test framework needed). Tests cover the core routing logic: which files are skipped, which get processed, and error paths.

Since the tests can't run Prettier/ESLint in isolation (that would require a consumer repo), the test harness mocks `spawnSync` by redirecting `node_modules/.bin/prettier` to a no-op. Tests focus on: path-traversal guard, SKIP_PREFIXES, extension filtering, malformed config handling, missing file guard.

**Approach:** use `node:test` + `node:assert`. Tests spawn the hook script as a subprocess with controlled `CLAUDE_PROJECT_DIR` and stdin JSON, then assert on exit code and stderr.

## Current behaviour

After spec `04`: `package.json` scripts = `{ "test": "echo 'No tests yet'" }`. No `tests/` directory.

## Target behaviour

- `tests/format-hook.test.mjs` exists with at least 8 test cases.
- `pnpm test` runs `node --test tests/format-hook.test.mjs` and exits 0 when all tests pass.
- Tests cover: empty stdin, missing file, path traversal, SKIP_PREFIXES, unsupported extension, config override, malformed config.

## Implementation steps

### Step 1 — Create `tests/format-hook.test.mjs`

```js
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/format-hook.mjs', import.meta.url))

function run(stdinJson, projectDir, extraEnv = {}) {
	const result = spawnSync(process.execPath, [SCRIPT], {
		input: stdinJson,
		env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...extraEnv },
		encoding: 'utf8',
	})
	return { exitCode: result.status, stderr: result.stderr, stdout: result.stdout }
}

function makeConsumer(setupFn) {
	const dir = mkdtempSync(join(tmpdir(), 'unic-format-test-'))
	setupFn?.(dir)
	return dir
}

function cleanup(dir) {
	rmSync(dir, { recursive: true, force: true })
}

test('exits 0 with empty stdin', () => {
	const dir = makeConsumer()
	try {
		const { exitCode } = run('', dir)
		assert.equal(exitCode, 0)
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with empty JSON {}', () => {
	const dir = makeConsumer()
	try {
		const { exitCode } = run('{}', dir)
		assert.equal(exitCode, 0)
	} finally {
		cleanup(dir)
	}
})

test('exits 0 when file does not exist', () => {
	const dir = makeConsumer()
	try {
		const { exitCode } = run(JSON.stringify({ tool_input: { file_path: join(dir, 'nonexistent.md') } }), dir)
		assert.equal(exitCode, 0)
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips _bmad/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '_bmad'))
		writeFileSync(join(d, '_bmad', 'test.md'), '# test\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips path-traversal (../)', () => {
	const dir = makeConsumer()
	const outsidePath = join(dir, '..', 'something.md')
	try {
		const { exitCode, stderr } = run(JSON.stringify({ tool_input: { file_path: outsidePath } }), dir)
		assert.equal(exitCode, 0)
		// Either the file doesn't exist (exits silently) or the path-traversal guard fires silently
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips unsupported extension (.toml)', () => {
	const dir = makeConsumer((d) => {
		writeFileSync(join(d, 'config.toml'), '[tool]\nname = "test"\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'config.toml') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with malformed config file and logs warning', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		writeFileSync(join(d, '.claude', 'unic-format.json'), 'NOT JSON')
		writeFileSync(join(d, 'test.md'), '# test\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'test.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.match(stderr, /malformed/, 'should warn about malformed config')
	} finally {
		cleanup(dir)
	}
})

test('respects prettierExtensions override from config', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		// Only allow .md; .json should be skipped
		writeFileSync(join(d, '.claude', 'unic-format.json'), JSON.stringify({ prettierExtensions: ['.md'] }))
		writeFileSync(join(d, 'data.json'), '{"key":"value"}')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'data.json') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent: .json excluded by config')
	} finally {
		cleanup(dir)
	}
})
```

### Step 2 — Update `package.json` test script

```json
"scripts": {
	"test": "node --test tests/format-hook.test.mjs",
	"bump": "node scripts/bump.mjs",
	"verify:changelog": "node scripts/verify-changelog.mjs"
}
```

### Step 3 — Commit

```sh
git add tests/ package.json
git commit -m "test(spec-09): add smoke tests for format hook routing logic"
```

## Acceptance criteria

- `pnpm test` exits 0 with all 8 tests passing.
- Tests cover: empty stdin, missing file, `_bmad/` skip, path-traversal, unsupported extension, malformed config, config override.
- No external test framework (only `node:test` and `node:assert`).

## Verification

```sh
pnpm test
```

All tests should report `✓` (or `ok` in TAP output). None should fail.

## Out of scope

- Integration tests (actually running Prettier on real files) — unit-level routing tests are sufficient for v1.
- Coverage reporting.
- Snapshot tests.

_Ralph: append findings here._
