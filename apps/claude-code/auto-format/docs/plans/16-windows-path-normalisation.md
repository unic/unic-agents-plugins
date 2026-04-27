# 16. Windows path-separator normalisation in `shouldSkip`
**Status: todo**

**Priority:** P0
**Effort:** S
**Version impact:** patch
**Depends on:** spec-03
**Touches:** `scripts/format-hook.mjs`, `tests/format-hook.test.mjs`

## Context

`shouldSkip` in `format-hook.mjs` compares paths against forward-slash prefixes like `_bmad/`, `node_modules/`, `.git/`. The comparison works because `path.relative()` on macOS and Linux always returns forward-slash paths.

On Windows, `path.relative()` returns backslash-separated paths (`_bmad\foo.md`). Every `SKIP_PREFIXES` check that uses `/` will silently fail to match, meaning files inside `node_modules`, `.git`, `_bmad`, and `.claude/worktrees` get reformatted when Claude runs on a Windows machine.

This is a real-world concern: a significant share of consumers are Product Owners who write specs and run Claude Code on Windows. The hook silently misbehaves for them today.

The fix is a one-line normalisation applied to `rel` before any prefix comparison. Extracting `shouldSkip` into a pure, parameterised function also makes it testable with synthetic backslash-style inputs on macOS CI.

## Current behaviour

After spec-03 and spec-04: `scripts/format-hook.mjs` computes `rel` with `path.relative()` and immediately passes it to `shouldSkip(rel)` and `extname(rel)`. No separator normalisation is applied. On Windows this causes all skip-prefix guards to silently miss.

## Target behaviour

- A pure helper `toPosix(p)` converts any backslashes to forward slashes.
- `shouldSkip` is renamed to `shouldSkip(posixRel)` and receives an already-normalised string.
- `main()` applies `toPosix` to `rel` exactly once, immediately after `relative()`, before any guard.
- `extname` receives the same normalised path.
- All existing skip-prefix tests remain green.
- Three new tests exercise synthetic Windows-style paths and verify they are skipped.

## Implementation steps

### Step 1 — Add `toPosix` helper and update `shouldSkip` in `scripts/format-hook.mjs`

1. Add the import `import { sep } from 'node:path'` to the existing import line:
   ```js
   import { extname, relative, resolve, sep } from 'node:path'
   ```

2. Add `toPosix` immediately before `shouldSkip`:
   ```js
   function toPosix(p) {
   	return sep === '/' ? p : p.split(sep).join('/')
   }
   ```
   The `sep` guard makes it a no-op on POSIX so there is zero overhead in production.

3. Inside `main()`, replace:
   ```js
   	const rel = relative(PROJECT_DIR, filePath)
   	if (shouldSkip(rel)) return

   	const ext = extname(rel).toLowerCase()
   ```
   with:
   ```js
   	const rel = toPosix(relative(PROJECT_DIR, filePath))
   	if (shouldSkip(rel)) return

   	const ext = extname(rel).toLowerCase()
   ```
   (`extname` handles forward-slash paths correctly on all platforms; no additional change needed.)

4. `shouldSkip` signature and body are unchanged — it already receives `rel` and works on forward-slash strings.

### Step 2 — Add Windows-path smoke tests in `tests/format-hook.test.mjs`

Since `relative()` on macOS never produces backslashes, tests cannot rely on it to exercise this path. Instead, construct `file_path` values that already contain backslashes, then verify the hook either skips silently or handles them correctly.

Add three tests:

```js
test('exits 0 and skips Windows-style _bmad\\ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '_bmad'))
		writeFileSync(join(d, '_bmad', 'test.md'), '# test\n')
	})
	try {
		// Simulate a Windows absolute path: replace the forward-slash separator
		// with backslash inside the subdir portion. After toPosix(), this should
		// still resolve to a _bmad/ prefix and be skipped.
		const winStylePath = join(dir, '_bmad', 'test.md').replace(/_bmad\//, '_bmad\\')
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: winStylePath } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '', 'should be silent when skipping Windows-style path')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 and skips Windows-style node_modules\\ path', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', 'foo'), { recursive: true })
		writeFileSync(join(d, 'node_modules', 'foo', 'index.md'), '# test\n')
	})
	try {
		const winStylePath = join(dir, 'node_modules', 'foo', 'index.md').replace(/node_modules\//, 'node_modules\\')
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: winStylePath } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})

test('exits 0 with mixed-separator traversal path (..\\\\..\\\\)', () => {
	const dir = makeConsumer()
	const mixedTraversal = join(dir, 'sub', '..', '..', 'outside.md').replace(/\//g, '\\')
	try {
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: mixedTraversal } }),
			dir,
		)
		assert.equal(exitCode, 0)
		// Either the file doesn't exist or path-traversal guard fires — both exit 0 silently
		assert.equal(stderr, '')
	} finally {
		cleanup(dir)
	}
})
```

### Step 3 — Commit

```sh
git add scripts/format-hook.mjs tests/format-hook.test.mjs
git commit -m "fix(spec-16): normalise path separators for Windows compatibility in shouldSkip"
```

## Acceptance criteria

- `toPosix` helper exists in `scripts/format-hook.mjs`, applied to `rel` before any guard.
- `sep` is imported from `node:path`.
- `toPosix` is a no-op when `sep === '/'` (POSIX systems).
- All original 8 smoke tests continue to pass.
- 3 new Windows-path tests pass on macOS CI (they exercise the normalisation logic even though `relative()` on macOS never produces native backslashes).
- No external deps added.

## Verification

```sh
# 1. toPosix helper exists and sep is imported
grep "toPosix\|from 'node:path'" scripts/format-hook.mjs

# 2. toPosix applied before shouldSkip in main()
grep -A2 "const rel = " scripts/format-hook.mjs

# 3. All tests pass
pnpm test
```

## Out of scope

- Handling Windows drive-letter prefixes (`C:\`) in the path-traversal guard (the `..` guard covers the practical traversal cases; drive-letter edge cases are rare in Claude Code context).
- Changes to `SKIP_PREFIXES` content.
- Any change to how `CLAUDE_PROJECT_DIR` is set on Windows.

_Ralph: append findings here._
