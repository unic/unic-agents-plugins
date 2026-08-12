# 0035. Change Notes and the Release Train

**Status:** Accepted (2026-08)

## Context

Every guarded pull request bumped its Plugin's version and promoted `## [Unreleased]` in the same
commit. `bump` writes four files — `.claude-plugin/plugin.json`, `package.json`,
`.claude-plugin/marketplace.json` and `CHANGELOG.md` — so two concurrent pull requests against one
Plugin conflict on all four, three of them on the same line. The result is that work on a single
Plugin serialises on the release machinery rather than on anything real.

Those per-pull-request versions were never reaching anyone.
`.github/workflows/release.yml:36-41` tags only the version standing in `plugin.json` when `main` is
pushed, so intermediate versions merged in the same push are never tagged. Between the last two
releases to `main`, `unic-archon-dlc` gained **eleven version headers and one tag**; of twenty-one
released versions in its CHANGELOG, two are tagged. `origin/main` sits at `0.12.0` while `develop`
carries seven more that no tag names.

A second problem sits alongside it. The level was chosen in advance — the dispatch prompt told the
agent to run `bump patch` before the work existed. PR #333 shipped `0.17.0 → 0.17.1` for a new
install behaviour plus a file relocation, where `minor` fits.

## Decision

A pull request writes a **Change Note** and touches no shared file: one new file under `.changes/`,
named `<issue#>-<slug>.md`, carrying a semver level, a CHANGELOG section, and the prose that becomes
the bullet. Plugin work writes into `apps/claude-code/<plugin>/.changes/`; repository-scoped work
writes into the root `.changes/` and declares no level, because nothing there is versioned. A change
touching two Plugins writes two notes, because it is two release decisions.

A **Release Train**, cut on a dated `release/YYYY-MM-DD` branch, consumes every pending Change Note.
Per Plugin it takes the maximum level across that Plugin's notes, bumps once, and writes one
CHANGELOG section. Repository notes become a Repository section in the GitHub Release body and a
dated entry in a root `CHANGELOG.md`. Consumed notes are deleted. The branch merges to `main` first,
so the release workflow fires, then to `develop`.

The level is declared by the author, in the note, after the work exists.

### Alternatives rejected

**Changesets.** About a third of it applies. The authoring CLI targets a human at a prompt rather
than an agent; `changeset publish` is meaningless for Plugins that are not npm artefacts; and linked
package groups and dependency-aware bumping have nothing to act on, because the Plugins do not depend
on one another. The rest fights a load-bearing assumption — Changesets treats `package.json` as
canonical, while [ADR-0009](0009-plugin-json-version-source-of-truth.md) makes `plugin.json` the
source of truth, and `marketplace.json` is invisible to it. `packages/release-tools` already owns
this job, has tests, and carries no dependencies. Two things are taken from Changesets anyway: the
frontmatter format, and the idea of a release pull request that maintains itself.

**Bumping on merge to `develop`.** Keeps per-pull-request versions, so the collision moves to the
merge queue rather than disappearing.

**Inferring the level from the CHANGELOG subsection or the conventional-commit type.**
`Added`/`Changed`/`Fixed` does not map onto semver — a `Changed` may be breaking or trivial, and only
the author knows which.

## Consequences

- **`Release` keeps its per-Plugin meaning.** [ADR-0022](0022-semver-per-plugin.md) and
  [ADR-0008](0008-tag-scheme-plugin-at-version.md) are unaffected. `Release Train` is the new
  monorepo-wide event. The root `CONTEXT.md` asserted that no monorepo-wide release existed; that
  sentence is now wrong and has been replaced.
- **[ADR-0017](0017-verify-changelog-pr-only.md) is superseded in part.** `verify:changelog` gives
  way to a Change Note gate, which also inverts from an allow-list of guarded paths to a deny-list.
  The current allow-list (`packages/release-tools/scripts/lib/changelog-gate.mjs:5-12`) omits
  `lib/**`, so a change confined there — where `unic-archon-dlc` keeps its implementation — is
  ungated today. An allow-list fails silently every time a Plugin grows a directory.
- **[ADR-0010](0010-pnpm-filter-bump-only-version-path.md) is amended, not replaced.** `bump` remains
  the only path that writes a version. Only its caller moves, from a feature pull request to
  `/release` on a release branch.
- **`## [Unreleased]` leaves every Plugin CHANGELOG.** Change Notes hold what it used to, so it would
  be a permanently empty skeleton. Removing it also dissolves a latent trap:
  `bump-version.mjs:70-72` aborts when `[Unreleased]` is the file's last section, because the
  promotion regex requires a following `## [` to match.
- **Gitflow gains `release/*`.** `AGENTS.md`'s branch table and `/archon-rollout`'s prefix derivation
  both need to know it is not a `feature/`.
- **Repository-scoped work becomes recordable.** A new package, a workflow and an ADR that touch no
  Plugin leave no trace anywhere today.
- **A Release Train carrying no Plugin Change Notes still ships**, producing a dated root entry and
  no tags.
- **This does not make the current backlog parallel.** Of the six open `unic-archon-dlc` tickets,
  most still serialise on genuine overlap — three rewrite `commands/setup.md` — or on real
  dependencies. The constraint removed here scales with the number of Plugins and concurrent
  streams; it is not the one binding today.
