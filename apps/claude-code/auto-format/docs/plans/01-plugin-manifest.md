# 01. Plugin Manifest
**Status: done — 2026-04-27**

**Priority:** P0
**Effort:** S
**Version impact:** minor
**Depends on:** spec-00
**Touches:** `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`

## Context

Claude Code plugins are identified by their `.claude-plugin/plugin.json` manifest. This is the contract that `claude` reads when a user installs or enables the plugin. We also need `marketplace.json` for marketplace listing metadata. Both files must be present before the plugin is installable.

Ref: Claude Code plugin spec (verify exact schema via `/plugin-dev:plugin-structure` skill if in doubt).

## Current behaviour

After spec `00`: `package.json` exists with `"version": "0.1.0"`. No `.claude-plugin/` directory exists.

## Target behaviour

- `.claude-plugin/plugin.json` exists with name, version, description, author, homepage, license, keywords.
- `.claude-plugin/marketplace.json` exists with display metadata for the Claude Code marketplace.
- Both files have version `0.1.0` matching `package.json`.
- The `.claude-plugin/` directory is committed.

## Implementation steps

### Step 1 — Create `.claude-plugin/plugin.json`

Read the current version from `package.json` first (`"version": "0.1.0"`).

Create `.claude-plugin/plugin.json`:

```json
{
	"name": "unic-claude-code-format",
	"version": "0.1.0",
	"description": "Auto-format and lint files when Claude Code edits them. Runs Prettier + ESLint --fix after Write/Edit/MultiEdit/NotebookEdit.",
	"author": {
		"name": "Unic AG",
		"url": "https://www.unic.com"
	},
	"homepage": "https://github.com/unic/unic-claude-code-format",
	"license": "LGPL-3.0-or-later",
	"keywords": ["formatter", "prettier", "eslint", "hook", "unic"]
}
```

### Step 2 — Create `.claude-plugin/marketplace.json`

```json
{
	"name": "unic-claude-code-format",
	"version": "0.1.0",
	"displayName": "Unic Auto-Format",
	"description": "Auto-format and lint files when Claude Code edits them. Uses the consumer repo's Prettier and ESLint — no bundled formatters.",
	"author": "Unic AG",
	"homepage": "https://github.com/unic/unic-claude-code-format",
	"license": "LGPL-3.0-or-later",
	"keywords": ["formatter", "prettier", "eslint", "hook", "unic"],
	"tags": ["productivity", "code-quality"]
}
```

### Step 3 — Commit

```sh
git add .claude-plugin/
git commit -m "feat(spec-01): add plugin manifest and marketplace metadata (v0.1.0)"
```

## Acceptance criteria

- `.claude-plugin/plugin.json` is valid JSON with `name`, `version`, `description`, `author`, `homepage`, `license`, `keywords`.
- `.claude-plugin/marketplace.json` is valid JSON with display metadata.
- Both files have version `0.1.0`.
- Both files use 2-space indentation (JSON convention per `.editorconfig`).

## Verification

```sh
# 1. Both files are valid JSON
cat .claude-plugin/plugin.json | python3 -m json.tool > /dev/null && echo "OK: plugin.json valid"
cat .claude-plugin/marketplace.json | python3 -m json.tool > /dev/null && echo "OK: marketplace.json valid"

# 2. Versions match package.json
node -e "
  import('./package.json', {assert:{type:'json'}}).then(p => {
    import('./.claude-plugin/plugin.json', {assert:{type:'json'}}).then(pl => {
      console.assert(p.default.version === pl.default.version, 'version mismatch');
      console.log('OK: versions match');
    });
  });
"
```

## Out of scope

- No hooks registration yet (spec 02).
- No version bump tooling (spec 07).
- The `marketplace.json` format may vary by Claude Code release; the schema here is based on `unic-claude-code-confluence`. If the `/plugin-dev:plugin-structure` skill reveals a different required schema, document in `## Deviations`.

_Ralph: append findings here._
