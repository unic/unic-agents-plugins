# 18. Smoke-test coverage for `notebook_path` and skip-prefix matrix
**Status: done — 2026-04-28**

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-09
**Touches:** `tests/format-hook.test.mjs`

## Context

Two coverage gaps remain in `tests/format-hook.test.mjs`:

1. **`notebook_path` branch.** `format-hook.mjs:117` reads either `tool_input.file_path` or `tool_input.notebook_path` to support NotebookEdit events. No test covers the `notebook_path` branch.

2. **Skip-prefix matrix.** `SKIP_PREFIXES` contains 10 entries but only `_bmad/` has a dedicated test. `node_modules/`, `.git/`, and `.claude/worktrees/` are the three most critical because they contain large or sensitive files that must never be formatted. None are tested.

These are additive tests only — no production code changes.

## Current behaviour

After spec-09: `tests/format-hook.test.mjs` has 8 tests:
- empty stdin / empty JSON / missing file / `_bmad/` skip / path-traversal / `.toml` extension / malformed config / `prettierExtensions` override.
- No test for `tool_input.notebook_path`.
- No test for `node_modules/`, `.git/`, or `.claude/worktrees/` skip.

## Target behaviour

Four additional tests added to `tests/format-hook.test.mjs`:

| Test | Scenario | Assertion |
|---|---|---|
| `notebook_path` event | `tool_input.notebook_path` points to an existing `.ipynb` (no formatter installed) | exits 0, silent |
| `node_modules/` skip | `file_path` inside `node_modules/` of the consumer dir | exits 0, silent |
| `.git/` skip | `file_path` inside `.git/` of the consumer dir | exits 0, silent |
| `.claude/worktrees/` skip | `file_path` inside `.claude/worktrees/wt-1/` of the consumer dir | exits 0, silent |

## Implementation steps

### Step 1 — Add four tests to `tests/format-hook.test.mjs`

Append after the last existing test:

```js
test('exits 0 with notebook_path event (no formatter installed)', () => {
	const dir = makeConsumer((d) => {
		writeFileSync(join(d, 'notebook.ipynb'), '{"cells":[],"nbformat":4,"nbformat_minor":5}\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { notebook_path: join(dir, 'notebook.ipynb') } }),
			dir,
		)
		// .ipynb is not in ALLOWED_PRETTIER_EXT → skips silently before touching any tool
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips node_modules/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', 'foo'), { recursive: true })
		writeFileSync(join(d, 'node_modules', 'foo', 'index.js'), 'module.exports = {}\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'node_modules', 'foo', 'index.js') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips .git/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.git', 'hooks'), { recursive: true })
		writeFileSync(join(d, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '.git', 'hooks', 'pre-commit') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips .claude/worktrees/ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude', 'worktrees', 'wt-1'), { recursive: true })
		writeFileSync(join(d, '.claude', 'worktrees', 'wt-1', 'feature.md'), '# feature\n')
	})
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '.claude', 'worktrees', 'wt-1', 'feature.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})
```

### Step 2 — Commit

```sh
git add tests/format-hook.test.mjs
git commit -m "test(spec-18): add notebook_path and skip-prefix matrix coverage"
```

## Acceptance criteria

- `pnpm test` reports 12 passing tests (8 existing + 4 new).
- No production code changed.
- All four new tests are silent on stderr (verifying the skip-prefix / extension guards fire before any tool invocation).

## Verification

```sh
pnpm test
# Output must contain: "12 pass"
```

## Out of scope

- Testing `.ipynb` formatting if Jupyter/Prettier is installed (`.ipynb` is intentionally absent from `ALLOWED_PRETTIER_EXT`).
- Testing every entry in `SKIP_PREFIXES` (the matrix covers the three highest-risk entries; the rest share the same code path verified by the `_bmad/` test).
- Any change to `format-hook.mjs`.

_Ralph: append findings here._
