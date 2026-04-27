# 00. Bootstrap Plugin Tooling

**Priority:** P0
**Effort:** S
**Version impact:** patch
**Depends on:** none
**Touches:** `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.editorconfig`

## Context

The repo contains only scaffolding files (`README.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`, `PROMPT.md`, `ralph.yml`). Before implementing any plugin features, we need a proper pnpm workspace with catalog-pinned deps, a Node version pin, engine strictness, and EditorConfig so all files follow the UNIC indentation convention (tabs for code, spaces for JSON/YAML/Markdown).

The plugin's hook script (`scripts/format-hook.mjs`) uses **only Node built-ins** (`node:child_process`, `node:fs`, `node:path`) — no external runtime deps. The `package.json` will have no `dependencies` entry. `devDependencies` (for future test/lint/bump tooling) will use the `catalog:` protocol.

## Current behaviour

The repo root contains:
- `README.md` — stub
- `CHANGELOG.md` — skeleton
- `LICENSE` — LGPL-3.0
- `.gitignore` — basic
- `PROMPT.md` — Ralph orchestrator prompt
- `ralph.yml` — Ralph config
- `docs/plans/` — this spec and siblings

No `package.json`, no `pnpm-workspace.yaml`, no `.npmrc`, no `.editorconfig`.

## Target behaviour

- `package.json` exists with `name`, `version`, `license`, `type: module`, `packageManager`, `engines`, `private: true`, and a `scripts` section with at least `{"test": "echo 'No tests yet'"}`.
- `pnpm-workspace.yaml` exists with `catalog:` (empty for now), `useNodeVersion`, `engineStrict: true`, `minimumReleaseAge: 1440`, `preferWorkspacePackages: true`, `strictDepBuilds: true`, `trustPolicy: no-downgrade`.
- `.npmrc` enforces `engine-strict=true`, `save-exact=true`, `auto-install-peers=true`, `save-prefix=""`.
- `.editorconfig` exists matching UNIC standard.
- `pnpm install` succeeds (no deps yet, just generates a minimal lockfile).

## Implementation steps

### Step 1 — Fetch exact pnpm version

Run:
```sh
pnpm --version
```

Record the output (e.g. `10.33.0`). You will use it in `packageManager`.

### Step 2 — Fetch latest Node 24.x LTS patch

Fetch the current Node 24.x LTS version from https://nodejs.org/en/download — look for the "LTS" row with major version 24. Record the full patch version string (e.g. `24.15.0`).

### Step 3 — Create `package.json`

Create `/Users/oriol.torrent/Sites/UNIC/unic-claude-code-format/package.json` with this content, substituting the real pnpm version and Node version from steps 1 and 2:

```json
{
	"name": "unic-claude-code-format",
	"version": "0.1.0",
	"private": true,
	"license": "LGPL-3.0-or-later",
	"type": "module",
	"packageManager": "pnpm@PNPM_VERSION",
	"engines": {
		"node": ">=24",
		"pnpm": ">=10"
	},
	"scripts": {
		"test": "echo 'No tests yet'"
	}
}
```

Replace `PNPM_VERSION` with the output of step 1 (e.g. `10.33.0`).

### Step 4 — Create `pnpm-workspace.yaml`

Create `/Users/oriol.torrent/Sites/UNIC/unic-claude-code-format/pnpm-workspace.yaml` with this content, substituting the real Node version:

```yaml
catalog: {}

catalogMode: prefer
engineStrict: true
minimumReleaseAge: 1440
preferWorkspacePackages: true
strictDepBuilds: true
trustPolicy: no-downgrade
useNodeVersion: "NODE_VERSION"
```

Replace `NODE_VERSION` with the string from step 2 (e.g. `24.15.0`).

### Step 5 — Create `.npmrc`

```
engine-strict=true
save-exact=true
auto-install-peers=true
save-prefix=""
```

### Step 6 — Create `.editorconfig`

```
root = true

[*]
indent_style = tab
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
indent_style = space
indent_size = 2

[{*.json,*.yml,*.yaml}]
indent_style = space
indent_size = 2
```

### Step 7 — Run pnpm install

```sh
pnpm install
```

Confirm `pnpm-lock.yaml` is generated (no errors).

### Step 8 — Commit

```sh
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .editorconfig
git commit -m "chore(spec-00): bootstrap pnpm workspace and tooling"
```

## Test cases

| Command | Expected | Exit code |
|---|---|---|
| `pnpm install --frozen-lockfile` on a fresh clone | No error; no deps to install | 0 |
| `node -e "require('./package.json')"` | (Should fail — ESM. Try `import()` or just verify file is valid JSON.) | — |
| `cat package.json \| python3 -m json.tool` | Valid JSON output | 0 |

## Acceptance criteria

- `package.json` is valid JSON with `name`, `version`, `type: module`, `packageManager`, and `engines` fields.
- `pnpm-workspace.yaml` exists with `useNodeVersion`, `engineStrict: true`, and an empty `catalog:`.
- `.npmrc` has `engine-strict=true` and `save-exact=true`.
- `.editorconfig` has `root = true` and tab indentation for `[*]`, space indentation for JSON/YAML/Markdown.
- `pnpm install --frozen-lockfile` exits 0.

## Verification

```sh
# 1. Valid package.json
cat package.json | python3 -m json.tool > /dev/null && echo "OK: valid JSON"

# 2. pnpm install is clean
pnpm install --frozen-lockfile && echo "OK: frozen install"

# 3. .editorconfig has root=true
grep "^root = true" .editorconfig && echo "OK: editorconfig root"
```

## Out of scope

- No devDependencies yet (added in later specs as tooling is introduced).
- No test runner setup (spec 09).
- No CI (spec 10).
- No `.claude-plugin/` manifest (spec 01).

_Ralph: append findings here._
