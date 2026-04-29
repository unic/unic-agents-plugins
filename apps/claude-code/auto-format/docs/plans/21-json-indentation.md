# 21. Honour `.editorconfig` 2-space indentation in committed JSON
**Status: done — 2026-04-28**

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-07, spec-13
**Touches:** `scripts/bump.mjs`, `scripts/sync-version.mjs`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `hooks/hooks.json`, `tests/` (new test)

## Context

`.editorconfig` declares `indent_style = space` and `indent_size = 2` for all `*.json` files. However, every committed JSON file in the repository uses tab indentation:

```
.claude-plugin/plugin.json       → tabs (written by bump.mjs)
.claude-plugin/marketplace.json  → tabs (written by sync-version.mjs)
package.json                     → tabs (written by sync-version.mjs)
hooks/hooks.json                 → tabs (committed by hand)
```

The root cause is `scripts/bump.mjs:20` and `scripts/sync-version.mjs:48`, which both call `JSON.stringify(obj, null, '\t')`. Every `pnpm bump` re-writes three JSON files with tabs, defeating any editor that auto-corrects on save.

For non-developer users (Product Owners, spec authors) whose editors respect `.editorconfig`, the mismatch causes unexpected diffs and noisy history. It also contradicts the self-hosted formatting principle: Prettier (and Biome with `useEditorconfig: true`) would convert committed JSON to 2-space, but the release scripts revert that on every bump.

The fix is minimal: change two `'\t'` arguments to `2`, then do a one-shot reformat of the four committed JSON files so git history is clean from this commit forward.

## Current behaviour

- `scripts/bump.mjs:20` (`writeJson`): `JSON.stringify(obj, null, '\t')`
- `scripts/sync-version.mjs:48`: `JSON.stringify(obj, null, '\t')`
- All four committed JSON files are tab-indented.
- `.editorconfig` says 2-space.

## Target behaviour

- `scripts/bump.mjs` writes JSON with 2-space indentation.
- `scripts/sync-version.mjs` writes JSON with 2-space indentation.
- All four committed JSON files are 2-space indented.
- `pnpm test` includes a regression test: running `sync-version.mjs` against a fixture produces 2-space output.

## Implementation steps

### Step 1 — Update `scripts/bump.mjs`

In `writeJson`:
```js
function writeJson(rel, obj) {
	writeFileSync(resolve(ROOT, rel), JSON.stringify(obj, null, 2) + '\n', 'utf8')
}
```
Change `'\t'` → `2`.

### Step 2 — Update `scripts/sync-version.mjs`

Line 48:
```js
writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8')
```
Change `'\t'` → `2`.

### Step 3 — Reformat the four committed JSON files

Run the following deterministic reformatter (or apply by hand — the content is small):

```sh
node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'package.json',
  'hooks/hooks.json',
]

for (const f of files) {
  const obj = JSON.parse(readFileSync(f, 'utf8'))
  writeFileSync(f, JSON.stringify(obj, null, 2) + '\n', 'utf8')
  console.log(`reformatted: ${f}`)
}
EOF
```

Verify with:
```sh
node -e "const s=require('fs').readFileSync('.claude-plugin/plugin.json','utf8'); if(s.includes('\t')) throw new Error('tabs found')"
```

### Step 4 — Add a regression test in `tests/`

Create `tests/sync-version.test.mjs`:

```js
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/sync-version.mjs', import.meta.url))

function makeFixtureRepo(version) {
	const dir = mkdtempSync(join(tmpdir(), 'unic-sync-version-test-'))
	mkdirSync(join(dir, '.claude-plugin'))
	writeFileSync(
		join(dir, '.claude-plugin', 'plugin.json'),
		JSON.stringify({ name: 'test-plugin', version }, null, 2) + '\n',
	)
	writeFileSync(join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify({ version: '0.0.0' }, null, 2) + '\n')
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.0.0' }, null, 2) + '\n')
	return dir
}

test('sync-version writes 2-space indented JSON (no tabs)', () => {
	const dir = makeFixtureRepo('1.2.3')
	try {
		const result = spawnSync(process.execPath, [SCRIPT], {
			env: { ...process.env },
			cwd: dir,
			encoding: 'utf8',
		})
		assert.equal(result.status, 0, `sync-version failed: ${result.stderr}`)

		for (const rel of ['.claude-plugin/marketplace.json', 'package.json']) {
			const content = readFileSync(join(dir, rel), 'utf8')
			assert.ok(!content.includes('\t'), `${rel} must not contain tabs`)
			assert.ok(content.startsWith('{\n  "'), `${rel} must start with 2-space indent`)
		}
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
```

Update `package.json` `test` script if needed to pick up the new test file automatically (node:test `--test` glob already picks up `tests/*.test.mjs` if the existing script uses a glob pattern — verify and adjust if needed).

### Step 5 — Commit

```sh
git add scripts/bump.mjs scripts/sync-version.mjs \
        .claude-plugin/plugin.json .claude-plugin/marketplace.json \
        package.json hooks/hooks.json \
        tests/sync-version.test.mjs
git commit -m "fix(spec-21): switch JSON output to 2-space indentation to match .editorconfig"
```

## Acceptance criteria

- `scripts/bump.mjs` `writeJson` uses `JSON.stringify(obj, null, 2)`.
- `scripts/sync-version.mjs` `syncFile` uses `JSON.stringify(obj, null, 2)`.
- All four committed JSON files contain no tab characters.
- All four committed JSON files start with `{\n  "` (2-space indent).
- `pnpm test` passes, including the new `sync-version.test.mjs` test.
- `pnpm verify:changelog` passes (no breaking structural change).

## Verification

```sh
# 1. No tabs in committed JSON files
for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json package.json hooks/hooks.json; do
  grep -P "\t" "$f" && echo "FAIL: tabs in $f" || echo "ok: $f"
done

# 2. Scripts updated
grep "null, 2" scripts/bump.mjs scripts/sync-version.mjs

# 3. Tests pass (includes new sync-version test)
pnpm test

# 4. Changelog gate still passes
pnpm verify:changelog
```

## Out of scope

- Reformatting any other file types (`.yml`, `.yaml` — they are already tab-free via pnpm-workspace.yaml and ci.yml).
- Changing `.editorconfig` itself.
- Reformatting JSON files inside `docs/plans/` (they are Markdown containing JSON code blocks, not JSON files).
- Adding a Prettier run to the release scripts (out of scope per plugin design — no bundled formatter).

_Ralph: append findings here._
