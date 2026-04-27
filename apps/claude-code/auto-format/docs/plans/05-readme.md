# 05. Plugin README
**Status: done — 2026-04-27**

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-03, spec-04
**Touches:** `README.md`

## Context

The `README.md` currently contains only a stub. We need full install + usage documentation so users know how to install the plugin, what it does, and how to configure it per-project.

## Current behaviour

After spec `04`:

```md
# unic-claude-code-format

A Claude Code plugin that auto-formats and lints files whenever Claude Code writes or edits them. Designed for UNIC repositories used by non-dev users (Product Owners, BMad agents) who won't run `pnpm format` manually.

> **Status:** in development. See `docs/plans/` for the ralph-orchestrated implementation roadmap.
```

## Target behaviour

A complete README covering:
1. What it does
2. Requirements (consumer repo must have Prettier and/or ESLint installed locally)
3. Install instructions
4. Which events trigger the hook (Write/Edit/MultiEdit/NotebookEdit)
5. What is skipped by default (SKIP_PREFIXES)
6. Per-project configuration (`.claude/unic-format.json`)
7. How to disable per-session
8. Invariants (always exits 0, silent on success)
9. Contributing pointer

## Implementation steps

### Step 1 — Overwrite `README.md`

Replace the full content with:

```md
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

```json
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
```

### Step 2 — Commit

```sh
git add README.md
git commit -m "docs(spec-05): write full plugin README with install, config, and invariants"
```

## Acceptance criteria

- README covers: what, requirements, install, skip list, per-project config, disable, invariants.
- The install command matches the actual plugin name.
- The `.claude/unic-format.json` example is valid JSON.
- The skip list table matches `SKIP_PREFIXES` in `scripts/format-hook.mjs` (from spec 04).

## Verification

```sh
# 1. Confirm README has install section
grep -q "plugin install" README.md && echo "OK: install section present"

# 2. Confirm skip list table is present
grep -q "_bmad/" README.md && echo "OK: _bmad skip mentioned"

# 3. Confirm unic-format.json example is valid JSON
node -e "JSON.parse(require('fs').readFileSync('README.md','utf8').match(/\`\`\`json\n({[\s\S]*?skipPrefixes[\s\S]*?})\n\`\`\`/)[1])" && echo "OK: config example is valid JSON"
```

## Out of scope

- No CHANGELOG section in README (CHANGELOG.md covers that).
- No API documentation (no API exists).

_Ralph: append findings here._

## Deviations

- The `enabledPlugins` settings block uses a plain ` ``` ` fence instead of ` ```json `. The spec shows `json` but the verification regex `/```json\n({[\s\S]*?skipPrefixes[\s\S]*?})\n```/` starts matching from the first ` ```json ` block, spans both code fences, and produces non-parseable content. Using a plain fence for the first block ensures the regex matches only the intended `skipPrefixes` example.
