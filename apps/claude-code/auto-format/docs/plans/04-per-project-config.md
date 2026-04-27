# 04. Per-Project Config Support
**Status: done — 2026-04-27**

**Priority:** P1
**Effort:** S
**Version impact:** minor
**Depends on:** spec-03
**Touches:** `scripts/format-hook.mjs`

## Context

Different consumer repos have different skip requirements. `agentic-delivery-model` needs `_bmad/` skipped; another UNIC repo might have a `_legacy/` directory to exclude, or might only want Prettier on `.md` files and not `.json`. Rather than forking the plugin per repo, support a lightweight per-project config file: `.claude/unic-format.json` in the consumer project root.

If the config file is absent, the plugin uses its built-in defaults (spec 03 values). If present, it merges on a key-by-key basis — a consumer can override `skipPrefixes` without touching `eslintExtensions`, etc.

## Current behaviour

After spec `03`: `scripts/format-hook.mjs` has hardcoded `SKIP_PREFIXES`, `ALLOWED_PRETTIER_EXT`, and `ALLOWED_ESLINT_EXT` constants. No config file is read.

## Target behaviour

- The hook script reads `$CLAUDE_PROJECT_DIR/.claude/unic-format.json` if it exists.
- The config file may override any of: `skipPrefixes` (array of strings), `prettierExtensions` (array of strings), `eslintExtensions` (array of strings).
- Omitting a key in the config means "use plugin default for that key" (not "empty array").
- If the config file is present but malformed JSON, log a warning to stderr and fall back to defaults.
- If the config file is absent, behaviour is identical to spec 03 (pure defaults).

## Implementation steps

### Step 1 — Update `scripts/format-hook.mjs`

Add `readFileSync` to the import from `node:fs`:

Before:
```js
import { existsSync } from 'node:fs'
```

After:
```js
import { existsSync, readFileSync } from 'node:fs'
```

### Step 2 — Extract defaults and add `loadProjectConfig`

After the `PROJECT_DIR` line and before `SKIP_PREFIXES`, insert:

```js
const DEFAULTS = {
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
}

function loadProjectConfig() {
	const configPath = resolve(PROJECT_DIR, '.claude/unic-format.json')
	if (!existsSync(configPath)) return DEFAULTS
	try {
		const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
		return {
			skipPrefixes: Array.isArray(cfg.skipPrefixes) ? cfg.skipPrefixes : DEFAULTS.skipPrefixes,
			prettierExtensions: Array.isArray(cfg.prettierExtensions) ? cfg.prettierExtensions : DEFAULTS.prettierExtensions,
			eslintExtensions: Array.isArray(cfg.eslintExtensions) ? cfg.eslintExtensions : DEFAULTS.eslintExtensions,
		}
	} catch (err) {
		process.stderr.write(`unic-format: ignoring malformed .claude/unic-format.json: ${err.message}\n`)
		return DEFAULTS
	}
}

const CONFIG = loadProjectConfig()
```

### Step 3 — Replace hardcoded constants with CONFIG references

Remove the old standalone `SKIP_PREFIXES`, `ALLOWED_PRETTIER_EXT`, `ALLOWED_ESLINT_EXT` constants.

Update `shouldSkip`:
```js
function shouldSkip(rel) {
	if (rel.startsWith('..')) return true
	return CONFIG.skipPrefixes.some((p) => rel.startsWith(p))
}
```

Update the extension checks in `main()`:
```js
const ext = extname(rel).toLowerCase()
if (!new Set(CONFIG.prettierExtensions).has(ext)) return

runPrettier(filePath)
if (new Set(CONFIG.eslintExtensions).has(ext)) runEslint(filePath)
```

### Step 4 — Commit

```sh
git add scripts/format-hook.mjs
git commit -m "feat(spec-04): add per-project config support via .claude/unic-format.json"
```

## Test cases

| Scenario | Expected |
|---|---|
| No `.claude/unic-format.json` in consumer | Uses defaults; `_bmad/` is skipped |
| Config with `{"skipPrefixes": ["_legacy/"]}` | `_legacy/` is skipped; `_bmad/` is NOT in defaults since config replaced `skipPrefixes` entirely |
| Config with `{"prettierExtensions": [".md"]}` only | Only `.md` runs Prettier; other keys use defaults |
| Config file is invalid JSON | Warning to stderr; falls back to defaults |
| Config file has `skipPrefixes` as a non-array | Warning implied? No — uses `Array.isArray` check → falls back to default for that key |

## Acceptance criteria

- When `.claude/unic-format.json` is absent, behaviour is identical to spec 03.
- When present and valid, config values override defaults on a per-key basis.
- When present but malformed, a warning is written to stderr and defaults are used.
- `DEFAULTS` object is defined and accurately reflects the spec 03 hardcoded values.

## Verification

```sh
# 1. Exits 0 without config
echo '{}' | CLAUDE_PROJECT_DIR="$(pwd)" node scripts/format-hook.mjs
echo "exit=$?"

# 2. Reads config override (create temp config)
mkdir -p /tmp/test-consumer/.claude
echo '{"prettierExtensions":[".md"]}' > /tmp/test-consumer/.claude/unic-format.json
echo '{"tool_input":{"file_path":"/tmp/test-consumer/README.md"}}' \
  | CLAUDE_PROJECT_DIR="/tmp/test-consumer" node scripts/format-hook.mjs
echo "exit=$?"
rm -rf /tmp/test-consumer

# 3. Malformed config logs warning but exits 0
mkdir -p /tmp/bad-config/.claude
echo 'NOT JSON' > /tmp/bad-config/.claude/unic-format.json
echo '{}' | CLAUDE_PROJECT_DIR="/tmp/bad-config" node scripts/format-hook.mjs 2>&1 | grep "malformed" && echo "OK: warning shown"
rm -rf /tmp/bad-config
```

## Out of scope

- No UI for editing the config (consumers edit `.claude/unic-format.json` manually).
- No JSON Schema validation (array-type check is sufficient for v1).
- No nested config merging (all or nothing per key).

_Ralph: append findings here._
