# unic-claude-code-format

A Claude Code plugin for UNIC repositories. Auto-formats and lints files whenever Claude Code writes or edits them — using the consumer repo's own Prettier and ESLint installations.

Designed for repositories used by non-dev users (Product Owners, BMad agents) who won't run `pnpm format` manually.

## What it does

After every `Write`, `Edit`, `MultiEdit`, or `NotebookEdit` tool call, the plugin:

1. Extracts the file path from the Claude Code hook event.
2. Checks the path against a skip list (see below).
3. Runs `prettier --write --ignore-unknown` on the file (if Prettier is installed in the consumer repo).
4. Runs `eslint --fix` on the file (if ESLint is installed and the extension is `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.tsx`, `.json`, `.jsonc`, or `.md`).

The hook always exits 0 — it never blocks a Claude edit even if formatting fails.

## Requirements

The consumer repo must have Prettier and/or ESLint installed in its `node_modules`. The plugin discovers them at runtime via `$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier` and `$CLAUDE_PROJECT_DIR/node_modules/.bin/eslint`. If neither is found, the hook is a no-op.

## Installation

```sh
# In Claude Code, install from the UNIC GitHub org:
/plugin install github:unic/unic-claude-code-format
```

Or add it to `.claude/settings.json` in a consumer repo:

```
{
  "enabledPlugins": {
    "unic-claude-code-format": true
  }
}
```

## Files skipped by default

The following paths are skipped before any tool is invoked:

| Prefix | Reason |
|---|---|
| `_bmad/` | BMad source — never user-modified |
| `.claude/skills/bmad-` | BMad-installed skills |
| `.claude/worktrees/` | Git worktrees |
| `.history/` | VS Code local history |
| `.git/` | Git internals |
| `node_modules/` | Dependency installs |
| `dist/`, `build/`, `.next/`, `coverage/` | Generated output |

Files matched by the consumer repo's `.prettierignore` are also skipped (Prettier handles this natively via `--ignore-unknown`).

## Per-project configuration

Create `.claude/unic-format.json` in the consumer repo root to override defaults:

```json
{
  "skipPrefixes": ["_bmad/", "_internal/", "vendor/"],
  "prettierExtensions": [".md", ".json", ".yml", ".yaml"],
  "eslintExtensions": [".js", ".ts", ".md"]
}
```

Each key overrides the full default list for that key. Omit a key to keep the default. Config is loaded once per hook invocation.

| Key | Type | Description |
|-----|------|-------------|
| `skipPrefixes` | `string[]` | Full replacement of the default skip-prefix list. |
| `additionalSkipPrefixes` | `string[]` | Extra path prefixes to skip, **merged with the defaults**. Prefer this over `skipPrefixes` unless you need full replacement. Example: `["my-generated/", ".tmp/"]` |
| `prettierExtensions` | `string[]` | File extensions to pass through Prettier (full replacement). |
| `eslintExtensions` | `string[]` | File extensions to pass through ESLint `--fix` (full replacement). |
| `formatTimeoutMs` | `number` | Per-formatter timeout in ms (1 000–120 000, default 30 000). |
| `formatter` | `"auto"` \| `"prettier"` \| `"biome"` | Force a specific formatter. Default `"auto"` auto-detects Biome. |

> **Precedence note:** If both `skipPrefixes` and `additionalSkipPrefixes` are present, `skipPrefixes` takes full precedence (full replacement). `additionalSkipPrefixes` is ignored when `skipPrefixes` is set.

## Biome support

If your project has `biome.json` (or `biome.jsonc`) at the root and `@biomejs/biome` installed,
the hook auto-detects Biome and uses it instead of Prettier + ESLint for JS/TS/JSON files.

Biome handles: `.js .mjs .cjs .ts .mts .cts .tsx .jsx .json .jsonc`
Prettier still runs for: `.md .mdx .yml .yaml .feature` (Biome does not support these)

### Recommended `biome.json` (based on Unic defaults)

```json
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
```

### Force a specific formatter via config

`.claude/unic-format.json`
```json
{
  "formatter": "prettier"
}
```

Valid values: `"auto"` (default), `"prettier"`, `"biome"`.

## How to disable

To disable the hook for a Claude Code session:
- In the Claude Code `/hooks` UI: toggle off `unic-claude-code-format`.

To disable permanently for a repo: remove the plugin from `.claude/settings.json`.

## Invariants

- **Always exits 0.** The hook never blocks a Claude edit, even if Prettier/ESLint fails.
- **Silent on success.** Output only appears on stderr when something goes wrong.
- **No bundled tools.** The plugin does not bundle Prettier or ESLint — your repo's pinned versions and configs are used, so formatting is always deterministic.

## Contributing

See `docs/plans/README.md` for the ralph-orchestrated implementation roadmap and ground rules.

### Developer commands

| Command | Description |
|---|---|
| `pnpm install` | Install dev dependencies |
| `pnpm test` | Run smoke tests |
| `pnpm typecheck` | Type-check plugin source (`tsc --checkJs`, dev-only) |
| `pnpm bump <patch\|minor\|major>` | Bump version + promote CHANGELOG |
