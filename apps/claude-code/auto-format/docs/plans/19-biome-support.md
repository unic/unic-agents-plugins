# 19. Optional Biome support (auto-detected)
**Status: done — 2026-04-28**

**Priority:** P1
**Effort:** M
**Version impact:** minor
**Depends on:** spec-03, spec-04, spec-09, spec-17
**Touches:** `scripts/format-hook.mjs`, `tests/format-hook.test.mjs`, `README.md`

## Context

Biome is an increasingly common replacement for Prettier + ESLint in modern JS/TS projects. Today `format-hook.mjs` only detects Prettier and ESLint; a Biome-only project gets no auto-formatting from the hook.

The sibling plugin `../unic-claude-code-confluence` already uses Biome 2.4.0 (`pnpm catalog`). Its `biome.json` is a proven, production-ready reference configuration.

Design goals:
1. **Zero config by default.** If a consumer project has `biome.json` (or `biome.jsonc`) at its root AND `node_modules/.bin/biome`, the hook switches to Biome automatically for Biome-supported extensions.
2. **No bundled Biome.** The consumer pins their own Biome version (just like Prettier/ESLint today). The plugin ships zero Biome config.
3. **Graceful fallback.** Extensions Biome does not handle (`.md`, `.mdx`, `.yml`, `.yaml`, `.feature`) still use Prettier when available.
4. **Config escape hatch.** A `formatter` key in `.claude/unic-format.json` overrides auto-detection.
5. **Timeout guard.** The Biome `spawnSync` call uses the same `CONFIG.formatTimeoutMs` guard from spec-17.

Biome 2.x command for format + safe-fix lint on a single file:
```
node ./node_modules/.bin/biome check --write --no-errors-on-unmatched-pattern <file>
```

## Current behaviour

After spec-03 and spec-04: `format-hook.mjs` only checks for `node_modules/.bin/prettier` and `node_modules/.bin/eslint`. Biome is neither detected nor invoked.

## Target behaviour

**Auto-detect rule:**

1. Check for `node_modules/.bin/biome` and (`biome.json` or `biome.jsonc`) in `PROJECT_DIR`.
2. If both present AND `CONFIG.formatter !== 'prettier'` → Biome mode:
   - Run `node ./node_modules/.bin/biome check --write --no-errors-on-unmatched-pattern <file>` for extensions in `BIOME_EXTS`.
   - Do **not** run Prettier or ESLint for those extensions.
   - For extensions outside `BIOME_EXTS` but inside `ALLOWED_PRETTIER_EXT` (`.md`, `.mdx`, `.yml`, `.yaml`, `.feature`) — run Prettier if installed (Biome does not handle these).
3. If detection fails OR `CONFIG.formatter === 'prettier'` → legacy Prettier + ESLint path (unchanged).
4. `CONFIG.formatter === 'biome'` forces Biome mode even if auto-detection would otherwise fall back (requires binary + config to be present; logs a warning to stderr and returns if either is missing).

**`BIOME_EXTS`** (file extensions Biome 2.x handles natively):
```
.js .mjs .cjs .ts .mts .cts .tsx .jsx .json .jsonc
```

**New `DEFAULTS` key:**
```js
formatter: 'auto',   // 'auto' | 'prettier' | 'biome'
```

**`loadProjectConfig` additions:**
```js
const VALID_FORMATTERS = new Set(['auto', 'prettier', 'biome'])
formatter: VALID_FORMATTERS.has(cfg.formatter) ? cfg.formatter : DEFAULTS.formatter,
```

## Implementation steps

### Step 1 — Add Biome constants to `scripts/format-hook.mjs`

Add after the existing `ESLINT_BIN` line:

```js
const BIOME_BIN = resolve(PROJECT_DIR, 'node_modules/.bin/biome')
const BIOME_CONFIG_PATH = [resolve(PROJECT_DIR, 'biome.json'), resolve(PROJECT_DIR, 'biome.jsonc')]

const BIOME_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.json', '.jsonc'])

const VALID_FORMATTERS = new Set(['auto', 'prettier', 'biome'])
```

### Step 2 — Add `formatter` to `DEFAULTS` and `loadProjectConfig`

In `DEFAULTS`:
```js
formatter: 'auto',
```

In `loadProjectConfig`'s return:
```js
formatter: VALID_FORMATTERS.has(cfg.formatter) ? cfg.formatter : DEFAULTS.formatter,
```

### Step 3 — Add `useBiome` detection and `runBiome` function

Add the detection helper and runner after the existing constants block:

```js
const BIOME_AVAILABLE =
	existsSync(BIOME_BIN) && BIOME_CONFIG_PATH.some((p) => existsSync(p))

function runBiome(filePath) {
	if (!existsSync(BIOME_BIN)) {
		process.stderr.write(`unic-format: biome binary not found at ${BIOME_BIN}\n`)
		return
	}
	const r = spawnSync(
		'node',
		[BIOME_BIN, 'check', '--write', '--no-errors-on-unmatched-pattern', filePath],
		{
			cwd: PROJECT_DIR,
			stdio: ['ignore', 'ignore', 'pipe'],
			timeout: CONFIG.formatTimeoutMs,
			killSignal: 'SIGTERM',
		},
	)
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: biome timed out after ${CONFIG.formatTimeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	if (r.status !== 0) {
		process.stderr.write(`unic-format: biome failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`)
	}
}
```

### Step 4 — Update `main()` routing logic

Replace the current:
```js
	runPrettier(filePath)
	if (ESLINT_EXTS.has(ext)) runEslint(filePath)
```

with:
```js
	const usesBiome =
		CONFIG.formatter === 'biome' ||
		(CONFIG.formatter === 'auto' && BIOME_AVAILABLE && BIOME_EXTS.has(ext))

	if (usesBiome) {
		runBiome(filePath)
	} else {
		runPrettier(filePath)
		if (ESLINT_EXTS.has(ext)) runEslint(filePath)
	}
```

Note: for extensions outside `BIOME_EXTS` (`.md`, `.yml`, etc.), `usesBiome` evaluates to `false` even in a Biome project, so Prettier is still used for those extensions.

### Step 5 — Update `README.md`

Add a **Biome support** section after the existing per-project config section:

```markdown
## Biome support

If your project has `biome.json` (or `biome.jsonc`) at the root and `@biomejs/biome` installed,
the hook auto-detects Biome and uses it instead of Prettier + ESLint for JS/TS/JSON files.

Biome handles: `.js .mjs .cjs .ts .mts .cts .tsx .jsx .json .jsonc`
Prettier still runs for: `.md .mdx .yml .yaml .feature` (Biome does not support these)

### Recommended `biome.json` (based on Unic defaults)

\`\`\`json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "files": {
    "includes": [
      "**",
      "!**/node_modules",
      "!**/.history",
      "!**/pnpm-lock.yaml",
      "!**/.claude",
      "!**/.ralph",
      "!**/*.min.js"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 120,
    "useEditorconfig": true
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "es5"
    }
  },
  "json": {
    "formatter": { "indentStyle": "space", "indentWidth": 2 }
  },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
\`\`\`

### Force a specific formatter via config

\`\`\`.claude/unic-format.json
{
  "formatter": "prettier"   // or "biome" (forced) or "auto" (default)
}
\`\`\`
```

### Step 6 — Add Biome smoke tests in `tests/format-hook.test.mjs`

```js
test('uses Biome when biome.json and biome binary are present', () => {
	let biomeInvoked = false
	const dir = makeConsumer((d) => {
		// Stub biome binary that writes a sentinel to a file
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const stubScript = `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs'\nwriteFileSync('${join(d, '.biome-called')}', '1')\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'biome'), stubScript, { mode: 0o755 })
		writeFileSync(join(d, 'biome.json'), '{"$schema":"https://biomejs.dev/schemas/2.4.0/schema.json"}\n')
		writeFileSync(join(d, 'test.ts'), 'const x = 1\n')
	})
	try {
		const { exitCode } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'test.ts') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		// Stub wrote sentinel file when invoked
		assert.ok(existsSync(join(dir, '.biome-called')), 'biome should have been called for .ts')
	} finally {
		cleanup(dir)
	}
})

test('does not use Biome for .md even when Biome is detected', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const biomeStub = `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs'\nwriteFileSync('${join(d, '.biome-called')}', '1')\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'biome'), biomeStub, { mode: 0o755 })
		writeFileSync(join(d, 'biome.json'), '{}')
		writeFileSync(join(d, 'README.md'), '# hello\n')
	})
	try {
		const { exitCode } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'README.md') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		// Biome stub must NOT have been called for .md
		const { existsSync: exists } = await import('node:fs')
		assert.ok(!existsSync(join(dir, '.biome-called')), 'biome should NOT be called for .md')
	} finally {
		cleanup(dir)
	}
})

test('respects formatter: "prettier" override even when Biome is detected', () => {
	const dir = makeConsumer((d) => {
		mkdirSync(join(d, 'node_modules', '.bin'), { recursive: true })
		const biomeStub = `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs'\nwriteFileSync('${join(d, '.biome-called')}', '1')\n`
		writeFileSync(join(d, 'node_modules', '.bin', 'biome'), biomeStub, { mode: 0o755 })
		writeFileSync(join(d, 'biome.json'), '{}')
		mkdirSync(join(d, '.claude'))
		writeFileSync(join(d, '.claude', 'unic-format.json'), JSON.stringify({ formatter: 'prettier' }))
		writeFileSync(join(d, 'test.ts'), 'const x = 1\n')
	})
	try {
		const { exitCode } = run(
			JSON.stringify({ tool_input: { file_path: join(dir, 'test.ts') } }),
			dir,
		)
		assert.equal(exitCode, 0)
		assert.ok(!existsSync(join(dir, '.biome-called')), 'biome should NOT be called when formatter is "prettier"')
	} finally {
		cleanup(dir)
	}
})
```

### Step 7 — Commit

```sh
git add scripts/format-hook.mjs tests/format-hook.test.mjs README.md
git commit -m "feat(spec-19): add auto-detected Biome support as alternative to Prettier+ESLint"
```

## Acceptance criteria

- `BIOME_AVAILABLE` is evaluated once at module scope.
- `runBiome` uses `biome check --write --no-errors-on-unmatched-pattern`.
- `runBiome` includes timeout + killSignal (consistent with spec-17 pattern for `runPrettier`/`runEslint`).
- For `.ts` in a Biome project: Biome is called, Prettier is not.
- For `.md` in a Biome project: Prettier is called (or skipped if not installed), Biome is not.
- `formatter: "prettier"` in config overrides Biome detection.
- `pnpm test` passes (15+ tests green including 3 new Biome tests).
- README documents auto-detect rule, extension lists, recommended `biome.json`, and the `formatter` config key.
- No external deps added to `dependencies` in `package.json`.

## Verification

```sh
# 1. BIOME_AVAILABLE and runBiome exist
grep -n "BIOME_AVAILABLE\|runBiome\|BIOME_EXTS" scripts/format-hook.mjs

# 2. Only node: imports in hook script
grep "^import" scripts/format-hook.mjs | grep -v "node:"

# 3. Tests pass
pnpm test
```

## Out of scope

- Biome version enforcement (consumer pins their own version).
- Running `biome migrate` or modifying the consumer's `biome.json`.
- Supporting the legacy `biome lint --apply` path (spec targets Biome 2.x `check --write`).
- `biomeExtensions` config override (BIOME_EXTS is dictated by Biome itself, not by the plugin).
- Lint-only mode without formatting.

_Ralph: append findings here._
