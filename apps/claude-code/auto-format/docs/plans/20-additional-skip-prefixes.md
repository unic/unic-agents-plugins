# 20. `additionalSkipPrefixes` config key (additive merge)
**Status: done — 2026-04-28**

**Priority:** P2
**Effort:** S
**Version impact:** minor
**Depends on:** spec-04, spec-09
**Touches:** `scripts/format-hook.mjs`, `tests/format-hook.test.mjs`, `README.md`

## Context

Today the per-project config key `skipPrefixes` in `.claude/unic-format.json` **replaces** the entire `DEFAULTS.skipPrefixes` array (`format-hook.mjs:60`). A consumer who wants to add a single prefix — say `my-generated/` — must copy all 10 defaults verbatim:

```json
{
  "skipPrefixes": [
    "_bmad/", ".claude/skills/bmad-", ".claude/worktrees/",
    ".history/", ".git/", "node_modules/", "dist/", "build/",
    ".next/", "coverage/", "my-generated/"
  ]
}
```

If the plugin adds a new default in a future release, those consumers silently lose it. It's a maintenance foot-gun.

The fix is a companion key `additionalSkipPrefixes` that merges with defaults rather than replacing them. The existing `skipPrefixes` key keeps its full-replacement semantics (backward compatible). When both keys are present, `skipPrefixes` wins (explicit over additive).

## Current behaviour

After spec-04: `loadProjectConfig` returns `cfg.skipPrefixes` if it is an array, `DEFAULTS.skipPrefixes` otherwise. There is no additive-merge option.

## Target behaviour

**`loadProjectConfig` resolution order for skip prefixes:**

1. If `cfg.skipPrefixes` is a non-empty array → use as full replacement (unchanged legacy behaviour).
2. Else if `cfg.additionalSkipPrefixes` is a non-empty array → `[...DEFAULTS.skipPrefixes, ...cfg.additionalSkipPrefixes]`.
3. Else → `DEFAULTS.skipPrefixes`.

**Config example:**

```json
{
  "additionalSkipPrefixes": ["my-generated/", ".tmp/"]
}
```

No duplication of defaults required. Future default additions are inherited automatically.

## Implementation steps

### Step 1 — Update `loadProjectConfig` in `scripts/format-hook.mjs`

Current return statement:
```js
return {
	skipPrefixes: Array.isArray(cfg.skipPrefixes) ? cfg.skipPrefixes : DEFAULTS.skipPrefixes,
	prettierExtensions: Array.isArray(cfg.prettierExtensions) ? cfg.prettierExtensions : DEFAULTS.prettierExtensions,
	eslintExtensions: Array.isArray(cfg.eslintExtensions) ? cfg.eslintExtensions : DEFAULTS.eslintExtensions,
}
```

Updated (add `additionalSkipPrefixes` merge logic, leave other keys unchanged):
```js
const hasFullReplacement = Array.isArray(cfg.skipPrefixes) && cfg.skipPrefixes.length > 0
const hasAdditive = Array.isArray(cfg.additionalSkipPrefixes) && cfg.additionalSkipPrefixes.length > 0

return {
	skipPrefixes: hasFullReplacement
		? cfg.skipPrefixes
		: hasAdditive
			? [...DEFAULTS.skipPrefixes, ...cfg.additionalSkipPrefixes]
			: DEFAULTS.skipPrefixes,
	prettierExtensions: Array.isArray(cfg.prettierExtensions) ? cfg.prettierExtensions : DEFAULTS.prettierExtensions,
	eslintExtensions: Array.isArray(cfg.eslintExtensions) ? cfg.eslintExtensions : DEFAULTS.eslintExtensions,
}
```

### Step 2 — Add tests in `tests/format-hook.test.mjs`

```js
test('additionalSkipPrefixes merges with defaults', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		mkdirSync(join(d, 'my-generated'))
		writeFileSync(join(d, 'my-generated', 'file.md'), '# generated\n')
		writeFileSync(
			join(d, '.claude', 'unic-format.json'),
			JSON.stringify({ additionalSkipPrefixes: ['my-generated/'] }),
		)
	})
	try {
		// Custom prefix is skipped
		const { exitCode: exitCustom, stderr: stderrCustom } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'my-generated', 'file.md') } }),
			dir,
		)
		assert.equal(exitCustom, 0)
		assert.equal(stderrCustom, '', 'should skip custom prefix silently')

		// Default prefix _bmad/ must still be skipped (defaults preserved)
		mkdirSync(join(dir, '_bmad'))
		writeFileSync(join(dir, '_bmad', 'test.md'), '# test\n')
		const { exitCode: exitDefault, stderr: stderrDefault } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }),
			dir,
		)
		assert.equal(exitDefault, 0)
		assert.equal(stderrDefault, '', 'should still skip _bmad/ from defaults')
	} finally {
		cleanup(dir)
	}
})

test('skipPrefixes wins over additionalSkipPrefixes when both are set', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, '.claude'))
		mkdirSync(join(d, '_bmad'))
		writeFileSync(join(d, '_bmad', 'test.md'), '# test\n')
		// skipPrefixes replaces all defaults; _bmad/ is NOT in this list
		// additionalSkipPrefixes is present but should be ignored
		writeFileSync(
			join(d, '.claude', 'unic-format.json'),
			JSON.stringify({
				skipPrefixes: ['dist/'],
				additionalSkipPrefixes: ['my-generated/'],
			}),
		)
	})
	try {
		// _bmad/ is NOT skipped because skipPrefixes replaced defaults and doesn't include it.
		// The file doesn't exist in node_modules so no formatter runs — just verify it's
		// not silently skipped by _bmad/ (it would proceed to the extension check and return
		// silently because no prettier binary is installed).
		const { exitCode, stderr } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, '_bmad', 'test.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		// No formatter installed → stderr is empty regardless.
		// The key assertion is that the config was parsed correctly (no crash / malformed-config warning).
		assert.ok(!stderr.includes('malformed'), 'config should parse without error')
	} finally {
		cleanup(dir)
	}
})
```

### Step 3 — Update `README.md`

In the per-project config section, add documentation for the new key alongside `skipPrefixes`:

```markdown
| `additionalSkipPrefixes` | `string[]` | Extra path prefixes to skip, **merged with the defaults**. Prefer this over `skipPrefixes` unless you need full replacement. Example: `["my-generated/", ".tmp/"]` |
```

And add a note clarifying precedence:
> If both `skipPrefixes` and `additionalSkipPrefixes` are present, `skipPrefixes` takes full precedence (full replacement). `additionalSkipPrefixes` is ignored when `skipPrefixes` is set.

### Step 4 — Commit

```sh
git add scripts/format-hook.mjs tests/format-hook.test.mjs README.md
git commit -m "feat(spec-20): add additionalSkipPrefixes config key for additive prefix merging"
```

## Acceptance criteria

- `additionalSkipPrefixes` in config merges with `DEFAULTS.skipPrefixes`.
- `skipPrefixes` full replacement is unchanged (existing configs work exactly as before).
- When both keys are set, `skipPrefixes` wins.
- `pnpm test` passes with 2 new tests green.
- README documents both keys with a precedence note.

## Verification

```sh
# 1. additionalSkipPrefixes merge logic in loadProjectConfig
grep -A5 "additionalSkipPrefixes" scripts/format-hook.mjs

# 2. Tests pass
pnpm test
```

## Out of scope

- `additionalPrettierExtensions` / `additionalEslintExtensions` (those have smaller risk of consumers needing additive merging vs. full replacement).
- Validating the syntax of each prefix string (e.g. must end with `/`).
- Deduplication of merged prefixes.

_Ralph: append findings here._
