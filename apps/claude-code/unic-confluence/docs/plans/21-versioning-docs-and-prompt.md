# 21. Versioning docs and Ralph integration
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Version impact:** patch
**Depends on:** spec 19 (`pnpm bump`), spec 20 (`pnpm verify:changelog`)
**Touches:** `PROMPT.md`, `docs/plans/README.md`, `CLAUDE.md`

## Context

Specs 19 and 20 add the tooling (`pnpm bump`, `pnpm verify:changelog`, `.githooks/pre-push`). This spec wires them into the human- and Ralph-facing documentation so the workflow is actually followed going forward.

The three gaps to close:
1. **`PROMPT.md`** — Ralph's brief says nothing about CHANGELOG or version bumps. Ralph completed specs 14–18 without touching either. A new Step 4.5 tells Ralph exactly what to do between "Verify" and "Commit".
2. **`docs/plans/README.md`** — The "Versioning policy" section has a stale "Bump plan" table (it was never followed). The "Release flow" code block describes a now-deleted `pnpm release`. It needs to reflect the per-spec cadence and new scripts. Each future spec should start with a `**Version impact:**` line.
3. **`CLAUDE.md`** — The "Plugin versioning" section says "Keep them in sync manually when releasing" — the opposite of what specs 19–20 enable. It needs to describe `pnpm bump` and CI enforcement.

No code changes in this spec — docs only.

## Current behaviour

### `PROMPT.md` — Step 3 ground rules (relevant excerpt)

```
- **Never hand-edit** `.claude-plugin/marketplace.json` version — use `pnpm release` (available after spec 06)
```

There is no step about CHANGELOG or version bumps anywhere in `PROMPT.md`.

### `docs/plans/README.md` — Versioning policy section (relevant excerpt)

```markdown
**Bump plan across this roadmap:**

| Spec(s) | Target version | Reason |
|---|---|---|
| `00`–`02` | `1.0.3` (optional patch) | Tooling + docs only; can skip and batch |
| `03` | **`2.0.0`** | Breaking: "no markers" now errors instead of silently appending |
| `04`, `05`, `07` | `2.1.0`, `2.2.0`, `2.3.0` (or batch into `2.1.0`) | New features |
| `06`, `08`–`18` | PATCH (or batch) | Bug fixes, refactors, tooling |

**Release flow** (post-spec `06`):

```sh
# 1. Edit version field in .claude-plugin/plugin.json
# 2. Update CHANGELOG.md: move items from [Unreleased] to new version heading with today's date
# 3. Run the sync + commit + tag script:
pnpm release
```
```

### `CLAUDE.md` — Plugin versioning section

```markdown
## Plugin versioning

Both `plugin.json` and `marketplace.json` carry a `version` field. Keep them in sync manually when releasing. There is no automated publish step.
```

## Target behaviour

### `PROMPT.md`

**Ground rule update:** Replace the line:
```
- **Never hand-edit** `.claude-plugin/marketplace.json` version — use `pnpm release` (available after spec 06)
```
with:
```
- **Never hand-edit** `.claude-plugin/marketplace.json` version — use `pnpm bump` (available after spec 19)
```

**New step inserted between Step 4 (Verify) and Step 5 (Mark done and commit):**

```markdown
## Step 4.5 — Bump version + CHANGELOG

1. Read the spec's `**Version impact:** patch|minor|major` line at the top of the spec file.
   If the line is absent, infer: breaking CLI/contract change → `major`; new flag/feature → `minor`; bug fix, refactor, docs → `patch`.

2. Append **one bullet** to the matching subsection under `## [Unreleased]` in `CHANGELOG.md`, replacing the `- (none)` placeholder on first use:
   - `### Breaking` — CLI flag renamed/removed, exit-code change, on-disk file schema change
   - `### Added` — new flag, subcommand, or user-visible feature
   - `### Fixed` — bug fix, refactor, docs, internal tooling
   Wording: one line, user-facing, present-tense description (e.g. `- \`pnpm bump\` command for atomic version bumping`).

3. Run:
   ```sh
   pnpm bump <patch|minor|major>
   ```
   This atomically: increments `plugin.json` version, mirrors into `marketplace.json`, and promotes `[Unreleased]` → a new dated section.

4. Run `pnpm verify:changelog` to confirm the check passes.
```

**Step 5 commit message format update:** In Step 5, change the commit message example to include the version:

Before:
```sh
git commit -m "feat(spec-NN): <short description of what was implemented>"
```

After:
```sh
git commit -m "feat(spec-NN): <short description of what was implemented> (vX.Y.Z)"
```

Replace `X.Y.Z` with the actual new version that `pnpm bump` produced.

### `docs/plans/README.md`

**Intro paragraph** — Append to the first paragraph in "How to use (for Ralph)":
```
Each spec starts with a `**Version impact:** patch|minor|major` line just under the title. Use it in Step 4.5.
```

**"Bump plan" table** — Remove the entire table (it was never followed and is now stale). Replace with a single sentence:
```
Each spec bumps per its `**Version impact:**` declaration. See `PROMPT.md` Step 4.5.
```

**"Release flow" code block** — Replace with:

```markdown
**Release flow:**

```sh
# Per change (every spec commit):
pnpm bump <patch|minor|major>   # bumps version, promotes CHANGELOG
pnpm verify:changelog            # confirm CI check passes

# Periodic: tag and push a release boundary
pnpm tag                         # creates local git tag vX.Y.Z
git push --follow-tags           # publishes tag to GitHub
```
```

**Ground rules** — Update the "Plugin versioning" bullet:

Before:
```
- **Plugin versioning**: `.claude-plugin/plugin.json` is the single source of truth for the version number. **Never hand-edit `.claude-plugin/marketplace.json`** — the `pnpm release` script (introduced in spec `06`) syncs it.
```

After:
```
- **Plugin versioning**: `.claude-plugin/plugin.json` is the single source of truth for the version number. **Never hand-edit `.claude-plugin/marketplace.json`** — use `pnpm bump` (spec `19`) which bumps, syncs, and promotes the CHANGELOG in one step.
```

### `CLAUDE.md`

Replace the entire "Plugin versioning" section. Current text:

```markdown
## Plugin versioning

Both `plugin.json` and `marketplace.json` carry a `version` field. Keep them in sync manually when releasing. There is no automated publish step.
```

Replace with:

```markdown
## Plugin versioning

`.claude-plugin/plugin.json` is the single source of truth. Every `feat(spec-NN)` / `fix(spec-NN)` commit includes a version bump and a dated `CHANGELOG.md` entry, via `pnpm bump <patch|minor|major>`. Never hand-edit `.claude-plugin/marketplace.json` — `pnpm bump` mirrors into it automatically.

**SemVer policy:**
- **major**: breaking change to CLI flags, exit codes, or on-disk contracts (`confluence-pages.json` schema, `~/.unic-confluence.json` format).
- **minor**: new flag, subcommand, or user-visible feature.
- **patch**: bug fix, refactor, docs, internal tooling.

`pnpm verify:changelog` (and CI on PRs) rejects changes that modify source or user-facing docs without a version bump and CHANGELOG entry.
```

## Affected files

| File | Change |
|---|---|
| `PROMPT.md` | Update ground rule; add Step 4.5; update Step 5 commit example |
| `docs/plans/README.md` | Intro note; remove stale bump table; update release-flow block; update ground rule bullet |
| `CLAUDE.md` | Replace "Plugin versioning" section |

## Implementation steps

### Step 1 — Update `PROMPT.md`

1a. Find the line:
```
- **Never hand-edit** `.claude-plugin/marketplace.json` version — use `pnpm release` (available after spec 06)
```
Replace `pnpm release` with `pnpm bump` and `spec 06` with `spec 19`.

1b. After the `## Step 4 — Verify` section (ends with "Fix any failures before proceeding.") and before `## Step 5 — Mark done and commit`, insert the full Step 4.5 block described in "Target behaviour" above.

1c. In `## Step 5 — Mark done and commit`, locate the `git commit` command and update it:
- Before: `git commit -m "feat(spec-NN): <short description of what was implemented>"`
- After: `git commit -m "feat(spec-NN): <short description of what was implemented> (vX.Y.Z)"`

Add a note on the line below:
```
Replace `X.Y.Z` with the version output by `pnpm bump`.
```

### Step 2 — Update `docs/plans/README.md`

2a. In the intro list under "How to use (for Ralph)", append as item 5:
```
5. Read the spec's `**Version impact:** patch|minor|major` line and execute `PROMPT.md` Step 4.5 before committing.
```

2b. In the "Versioning policy" section, find the "Bump plan" table (starts with `| Spec(s) | Target version | Reason |`). Remove the entire table including its header and all rows. Replace with the sentence: `Each spec bumps per its \`**Version impact:**\` declaration. See \`PROMPT.md\` Step 4.5.`

2c. In the "Versioning policy" section, find the `**Release flow** (post-spec \`06\`):` block and replace it with the new "Release flow" block described in "Target behaviour" above.

2d. In the "Ground rules" list, update the "Plugin versioning" bullet as described above.

### Step 3 — Update `CLAUDE.md`

Find the `## Plugin versioning` section. Replace its body (everything after the `## Plugin versioning` heading down to the next `##` heading, exclusive) with the new text described in "Target behaviour" above.

## Acceptance criteria

- [ ] `PROMPT.md` has a Step 4.5 section between Step 4 and Step 5 with instructions to add a CHANGELOG bullet, run `pnpm bump`, and run `pnpm verify:changelog`.
- [ ] `PROMPT.md` ground rule references `pnpm bump` not `pnpm release`.
- [ ] `PROMPT.md` Step 5 commit message example includes `(vX.Y.Z)`.
- [ ] `docs/plans/README.md` has no "Bump plan" table.
- [ ] `docs/plans/README.md` "Release flow" block references `pnpm bump` and `pnpm tag` (not `pnpm release`).
- [ ] `docs/plans/README.md` ground rule for plugin versioning references `pnpm bump`.
- [ ] `CLAUDE.md` "Plugin versioning" section describes the per-commit flow, SemVer policy, and CI enforcement.
- [ ] `CLAUDE.md` does not reference `pnpm release` anywhere in "Plugin versioning".
- [ ] No code files are modified — docs only.

## Verification

```sh
# 1. Confirm Step 4.5 exists in PROMPT.md
grep "Step 4.5" PROMPT.md
# Expected: at least one match

# 2. Confirm pnpm bump referenced in PROMPT.md
grep "pnpm bump" PROMPT.md
# Expected: matches in Step 3 and Step 4.5

# 3. Confirm pnpm release not referenced in PROMPT.md
grep "pnpm release" PROMPT.md
# Expected: no matches

# 4. Confirm stale bump plan table removed from docs/plans/README.md
grep "Target version" docs/plans/README.md
# Expected: no matches

# 5. Confirm pnpm bump in README.md
grep "pnpm bump" docs/plans/README.md
# Expected: at least one match

# 6. Confirm CLAUDE.md plugin versioning section updated
grep "pnpm bump" CLAUDE.md
# Expected: at least one match

grep "pnpm release" CLAUDE.md
# Expected: no matches in "Plugin versioning" section
```

## Out of scope

- Backfilling `**Version impact:**` lines into specs 00–18 (completed, history).
- Modifying any script files (`scripts/push-to-confluence.mjs`, `scripts/sync-version.mjs`, etc.).
- Adding `**Version impact:**` lines to this spec file (spec 21) from within itself — Ralph should add the `**Version impact:**` line to future specs as part of the normal spec-writing process, not retroactively.

_Ralph: append findings here._
