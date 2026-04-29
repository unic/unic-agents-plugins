# 03. Format Hook Script
**Status: done — 2026-04-27**

**Priority:** P0
**Effort:** M
**Version impact:** minor
**Depends on:** spec-02
**Touches:** `scripts/format-hook.mjs`

## Context

The hook script is the core of the plugin. It receives a JSON event from Claude Code on stdin, extracts the path of the file that was just written or edited, and runs Prettier (and optionally ESLint `--fix`) on that file.

Design invariants (borrowed from `DXP-Profileservices` pattern and hardened):
1. **Always exits 0** — never blocks Claude's tool flow.
2. **Silent on success** — errors go to stderr only.
3. **Defensive skipping** — maintains its own `SKIP_PREFIXES` list in addition to relying on `.prettierignore` / `eslint.config.*` ignores; short-circuits before invoking any external tool.
4. **Path-traversal guard** — rejects any path that resolves outside the consumer project root.
5. **Pre-flight existence checks** — if `node_modules/.bin/prettier` or `node_modules/.bin/eslint` don't exist, log to stderr and return (consumer repo just hasn't installed yet).
6. **No external deps** — uses only Node built-ins.
7. **Extension filtering** — only invokes Prettier/ESLint on file extensions they support.

Note on ESLint exit codes:
- Status 0: no lint issues (or all fixed).
- Status 1: lint warnings/errors remain after `--fix`. This is NOT a hook failure — the file was still formatted. The hook treats status 1 as acceptable.
- Status >1: ESLint crashed or was misconfigured. Log to stderr.

## Current behaviour

After spec `02`: `scripts/` directory does not exist. `hooks/hooks.json` registers `node ${CLAUDE_PLUGIN_ROOT}/scripts/format-hook.mjs` but the file is missing (Claude will log an error when the hook fires).

## Target behaviour

- `scripts/format-hook.mjs` exists and is a valid Node ESM module.
- The script reads JSON from stdin, extracts `tool_input.file_path` (or `tool_input.notebook_path` for NotebookEdit), validates it, and runs Prettier + ESLint on it.
- The script exits 0 in all circumstances (including errors).
- Prettier is invoked as `node ./node_modules/.bin/prettier --write --ignore-unknown --log-level warn <file>` from `CLAUDE_PROJECT_DIR`.
- ESLint is invoked only for `ALLOWED_ESLINT_EXT` extensions as `node ./node_modules/.bin/eslint --fix --no-error-on-unmatched-pattern <file>` from `CLAUDE_PROJECT_DIR`.
- Files matching `SKIP_PREFIXES` are skipped before any tool is invoked.
- ESLint status 1 is treated as acceptable (lint warnings remain but fix ran). Status >1 logs to stderr.

## Implementation steps

### Step 1 — Create `scripts/format-hook.mjs`

Create the file at `scripts/format-hook.mjs` with this exact content:

```js
#!/usr/bin/env node
/**
 * unic-claude-code-format — PostToolUse hook
 * Runs Prettier (and ESLint --fix where applicable) on the file
 * Claude just wrote or edited in the consumer project.
 *
 * Invariants:
 *   - Always exits 0 — never blocks Claude's tool flow.
 *   - Silent on success; diagnostics go to stderr only.
 *   - Defensively skips _bmad/, BMad-installed skills, generated dirs,
 *     and any path outside the consumer project root.
 *   - Does not bundle Prettier/ESLint — uses the consumer's node_modules
 *     so each repo keeps its own pinned versions and configs.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Defensive skip list. Kept in sync with the convention in .prettierignore and
// eslint.config.js so the hook short-circuits before invoking any external tool.
// _bmad/ is intentionally excluded: BMad source is never modified by end-users.
const SKIP_PREFIXES = [
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
]

const ALLOWED_PRETTIER_EXT = new Set([
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
])

const ALLOWED_ESLINT_EXT = new Set([
	'.js',
	'.mjs',
	'.cjs',
	'.ts',
	'.mts',
	'.cts',
	'.tsx',
	'.json',
	'.jsonc',
	'.md',
])

const PRETTIER_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/prettier')
const ESLINT_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/eslint')

function shouldSkip(rel) {
	if (rel.startsWith('..')) return true
	return SKIP_PREFIXES.some((p) => rel.startsWith(p))
}

function runPrettier(filePath) {
	if (!existsSync(PRETTIER_BIN)) return
	const r = spawnSync('node', [PRETTIER_BIN, '--write', '--ignore-unknown', '--log-level', 'warn', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
	})
	if (r.status !== 0) {
		process.stderr.write(`unic-format: prettier failed: ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

function runEslint(filePath) {
	if (!existsSync(ESLINT_BIN)) return
	const r = spawnSync('node', [ESLINT_BIN, '--fix', '--no-error-on-unmatched-pattern', filePath], {
		cwd: PROJECT_DIR,
		stdio: ['ignore', 'ignore', 'pipe'],
	})
	// Status 1 = lint warnings/errors remain after --fix (not a hook failure).
	// Status >1 = ESLint crash or misconfiguration.
	if (r.status !== 0 && r.status !== 1) {
		process.stderr.write(`unic-format: eslint failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}

async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) return

	let event
	try {
		event = JSON.parse(buf)
	} catch {
		process.stderr.write('unic-format: could not parse hook input as JSON\n')
		return
	}

	const filePath = event?.tool_input?.file_path || event?.tool_input?.notebook_path
	if (!filePath || !existsSync(filePath)) return

	const rel = relative(PROJECT_DIR, filePath)
	if (shouldSkip(rel)) return

	const ext = extname(rel).toLowerCase()
	if (!ALLOWED_PRETTIER_EXT.has(ext)) return

	runPrettier(filePath)
	if (ALLOWED_ESLINT_EXT.has(ext)) runEslint(filePath)
}

main()
	.catch((err) => process.stderr.write(`unic-format: unexpected error: ${err?.message || err}\n`))
	.finally(() => process.exit(0))
```

### Step 2 — Commit

```sh
git add scripts/
git commit -m "feat(spec-03): implement format hook script with prettier and eslint support"
```

## Test cases

Manual smoke tests (automated tests come in spec 09):

| Scenario | Expected |
|---|---|
| Pipe `{}` (empty JSON) to the script | Exits 0, no output |
| Pipe `{"tool_input":{"file_path":"/nonexistent/file.md"}}` | Exits 0, no output (file doesn't exist guard) |
| Pipe with `file_path` pointing to `_bmad/foo.md` | Exits 0, no output (SKIP_PREFIXES guard) |
| Pipe with `file_path` pointing to a real `.md` file outside consumer node_modules | Exits 0; Prettier runs if installed |
| Pipe with `file_path` pointing to a `.toml` file | Exits 0, no output (extension not in ALLOWED_PRETTIER_EXT) |

Run these manually from a consumer repo:
```sh
CLAUDE_PROJECT_DIR="$(pwd)" CLAUDE_PLUGIN_ROOT="/path/to/plugin" \
  node /path/to/plugin/scripts/format-hook.mjs <<< '{}'
echo "exit=$?"
```

## Acceptance criteria

- `scripts/format-hook.mjs` is a valid ESM module (no `require()`, uses `import` and `import.meta`... actually `import()` is not used — it uses `import { ... } from 'node:...'` which is fine).
- Script exits 0 for all inputs (including invalid JSON, missing file, missing binaries).
- `SKIP_PREFIXES` includes `_bmad/` as first entry.
- Prettier is invoked with `--ignore-unknown` so unsupported extensions (TOML, CSV, PY) are silently skipped.
- ESLint status 1 is not treated as an error.
- Script has no external npm dependencies (only `node:` built-ins).

## Verification

```sh
# 1. Valid ESM syntax (quick parse check)
node --input-type=module <<< "import './scripts/format-hook.mjs'" && echo "OK: valid ESM"

# 2. Exits 0 with empty input
echo '{}' | CLAUDE_PROJECT_DIR="$(pwd)" node scripts/format-hook.mjs
echo "exit=$?"

# 3. Skips _bmad/ path
echo "{\"tool_input\":{\"file_path\":\"$(pwd)/_bmad/test.md\"}}" \
  | CLAUDE_PROJECT_DIR="$(pwd)" node scripts/format-hook.mjs
echo "exit=$?"

# 4. No external deps imported
grep -E "^import" scripts/format-hook.mjs | grep -v "node:" && echo "FAIL: non-built-in import found" || echo "OK: only node: imports"
```

## Out of scope

- Per-project config support (spec 04).
- Automated test suite (spec 09).
- No changes to `hooks/hooks.json` — that was done in spec 02.

_Ralph: append findings here._
