# 28. Version bump and CHANGELOG entry

**Status: done — 2026-05-04**

**Priority:** P2
**Effort:** XS
**Version impact:** patch
**Depends on:** spec-27
**Touches:** `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `CHANGELOG.md`

## Context

Specs 25–27 collectively extract the formatter runner into a dedicated module. This is an
internal refactor with no user-visible behaviour change. A patch bump is appropriate.

## Current behaviour

Version reflects the state before specs 25–27.

## Target behaviour

Version incremented by one patch level. CHANGELOG has a dated entry under the new version
describing the internal refactor.

## Affected files

| File | Change |
|---|---|
| `.claude-plugin/plugin.json` | Version bumped |
| `.claude-plugin/marketplace.json` | Synced by `pnpm bump` |
| `package.json` | Synced by `pnpm bump` |
| `CHANGELOG.md` | New dated entry |

## Implementation steps

### Step 1 — Add CHANGELOG entry to `[Unreleased]`

Before running `pnpm bump`, add an entry under `## [Unreleased]` in `CHANGELOG.md`:

```markdown
### Changed
- Internal: extracted shared subprocess contract from `runPrettier`/`runEslint`/`runBiome` into
  `lib/runners.mjs` — no behaviour change for consumers.
```

### Step 2 — Run bump

```sh
pnpm bump patch
```

This increments the version in `plugin.json` and syncs `marketplace.json` and `package.json`.

### Step 3 — Verify

```sh
pnpm verify:changelog
```

### Step 4 — Commit

```sh
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json package.json CHANGELOG.md
git commit -m "chore(release): bump auto-format patch version — runner extraction refactor"
```

## Verification

```sh
pnpm verify:changelog
grep -n "lib/runners" CHANGELOG.md
```

## Acceptance criteria

- [ ] `pnpm verify:changelog` passes
- [ ] CHANGELOG entry present for the new version with description of the refactor
- [ ] `plugin.json`, `marketplace.json`, `package.json` versions are in sync

## Out of scope

- Git tag (create separately with `pnpm tag` when ready to release)

_Ralph: append findings here._
