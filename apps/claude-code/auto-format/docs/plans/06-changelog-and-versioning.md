# 06. CHANGELOG and Versioning Docs

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec-01
**Touches:** `CHANGELOG.md`, `docs/plans/README.md`

## Context

`CHANGELOG.md` exists as a skeleton (from the initial scaffold). Now that specs 00–05 have landed, we need to backfill the CHANGELOG with entries for all the changes made so far. We also add versioning policy documentation to `docs/plans/README.md` (it already has it, but the `CHANGELOG.md` backfill needs to reflect the real history).

This spec does NOT introduce `pnpm bump` (spec 07) or `pnpm verify:changelog` (spec 08) — those come next. For now, CHANGELOG is maintained manually.

## Current behaviour

After specs 00–05:

`CHANGELOG.md` contains the skeleton:
```md
## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)
```

## Target behaviour

`CHANGELOG.md` has a proper `## [0.1.0] - YYYY-MM-DD` section (use today's date) with bullets for the core features landed in specs 00–05.

## Implementation steps

### Step 1 — Update `CHANGELOG.md`

Replace the `## [Unreleased]` section's body with a dated release section, keeping `[Unreleased]` empty at the top for future changes.

Target content (substitute today's date for YYYY-MM-DD):

```md
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [0.1.0] - YYYY-MM-DD

### Added
- PostToolUse hook for `Write|Edit|MultiEdit|NotebookEdit` Claude Code events.
- Prettier (`--write --ignore-unknown`) applied to all supported extensions after each edit.
- ESLint (`--fix`) applied to `.js/.mjs/.cjs/.ts/.mts/.cts/.tsx/.json/.jsonc/.md` after each edit.
- Defensive `SKIP_PREFIXES` list (incl. `_bmad/`, BMad skills, generated dirs).
- Path-traversal guard: paths resolving outside consumer project root are skipped.
- Pre-flight binary existence checks: hook is a no-op if Prettier/ESLint is not installed.
- Per-project config: `.claude/unic-format.json` in consumer root overrides `skipPrefixes`, `prettierExtensions`, `eslintExtensions`.
- Plugin manifest: `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`.
```

### Step 2 — Commit

```sh
git add CHANGELOG.md
git commit -m "docs(spec-06): backfill CHANGELOG for v0.1.0 release"
```

## Acceptance criteria

- `CHANGELOG.md` has an `## [Unreleased]` section at top (empty).
- `CHANGELOG.md` has `## [0.1.0] - YYYY-MM-DD` section with bullets covering all specs 00–05.
- The file follows Keep a Changelog format.

## Verification

```sh
# 1. Unreleased section is present
grep "## \[Unreleased\]" CHANGELOG.md && echo "OK: Unreleased present"

# 2. 0.1.0 release section is present
grep "## \[0.1.0\]" CHANGELOG.md && echo "OK: 0.1.0 section present"
```

## Out of scope

- `pnpm bump` tooling (spec 07).
- `pnpm verify:changelog` (spec 08).

_Ralph: append findings here._
