# 31. Version bump and CHANGELOG entry
**Status: done — 2026-05-04**

**Priority:** P2
**Effort:** XS
**Version impact:** patch
**Depends on:** spec-30
**Touches:** `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `CHANGELOG.md`

## Context

Specs 29–30 extract config loading into `lib/config.mjs`. Internal refactor; no user-visible
behaviour change. Patch bump.

## Current behaviour

Version reflects the state before specs 29–30.

## Target behaviour

Version incremented by one patch level. CHANGELOG has a dated entry for the config extraction.

## Affected files

| File | Change |
|---|---|
| `.claude-plugin/plugin.json` | Version bumped |
| `.claude-plugin/marketplace.json` | Synced by `pnpm bump` |
| `package.json` | Synced by `pnpm bump` |
| `CHANGELOG.md` | New dated entry |

## Implementation steps

### Step 1 — Add CHANGELOG entry under `[Unreleased]`

```markdown
### Changed
- Internal: extracted `DEFAULTS` and `loadConfig` from `format-hook.mjs` into `lib/config.mjs`,
  with ten unit tests covering the merge strategy — no behaviour change for consumers.
```

### Step 2 — Run bump

```sh
pnpm bump patch
```

### Step 3 — Verify and commit

```sh
pnpm verify:changelog
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json package.json CHANGELOG.md
git commit -m "chore(release): bump auto-format patch version — config extraction refactor"
```

## Acceptance criteria

- [ ] `pnpm verify:changelog` passes
- [ ] CHANGELOG entry present for the new version
- [ ] `plugin.json`, `marketplace.json`, `package.json` versions are in sync

## Out of scope

- Git tag (create with `pnpm tag` when ready to release)

_Ralph: append findings here._
