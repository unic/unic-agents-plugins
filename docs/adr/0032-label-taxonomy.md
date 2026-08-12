# 0032. Issue label taxonomy: state, type, priority, and a repo-owned area tier

**Status:** Accepted (2026-06); ownership amended 2026-08, see [Amendment](#amendment-2026-08)

## Context

The GitHub issue tracker had accreted ~38 labels with no coherent scheme. The
largest source of noise was a per-feature label family (`feature/<slug>`, 15
labels) minted ad-hoc by Matt's issue skills, alongside GitHub's default labels
and Dependabot's. Two label-setup systems also coexist in this repo and collide
on `docs/agents/` and the `## Agent skills` block:

- **`unic-archon-dlc`** (installed here via dogfooding) deterministically
  generates `docs/agents/labels.md` from `.archon/unic-dlc.config.json`. Its
  canonical taxonomy is three tiers: **state** (8: `needs-triage` to
  `rejected`), **type** (`feature`, `bug`, `spike`, `tech-debt`, `docs`),
  **priority** (`p0`-`p3`). This is the tool that stays.
- **`setup-matt-pocock-skills`** (manual-invocation-only) seeds a narrower,
  divergent **state** vocabulary (5 roles, using `wontfix` not `rejected`) and
  is being phased out.

We needed fewer labels, a stable scheme, and a way to group issues by which
app/package they belong to, without breaking the surviving tool.

## Decision

A four-tier taxonomy. The first three tiers are owned by `unic-archon-dlc`; the
fourth (area) is a repo convention.

1. **State (8)**: unchanged, archon-canonical: `needs-triage`, `needs-info`,
   `needs-specs`, `ready-for-agent`, `ready-for-human`, `resolved`, `closed`,
   `rejected`. `rejected` is canonical, **not** `wontfix`.
2. **Type (6)**: `feature`, `bug`, `spike`, `tech-debt`, `docs`, `release`.
   - `documentation` became `docs` and `refactor` became `tech-debt` (renamed to
     the canonical names; assignments preserved).
   - `enhancement` (48 issues) merged into `feature`, then deleted, leaving one
     canonical "new capability" type.
   - `release` added as a **repo-local** entry in `.archon/unic-dlc.config.json`
     `labels.type`, not in the plugin's shipped `TYPE_LABELS`. The plugin's
     `install-runner` shallow-merges `{ ...DEFAULTS, ...existing }` and only
     falls back to defaults when `labels` is absent, so this edit survives every
     `/unic-archon-dlc:setup` re-run and does not propagate to other consumers.
3. **Priority (4)**: `p0`-`p3` created empty to realize the canonical tier.
4. **Area (new tier)**: one label per app and per package, plus a repo-wide
   catch-all:

   - `app:<plugin>` for each plugin (`app:auto-format`, `app:pr-review`, ...)
   - `pkg:<package>` for each workspace package (`pkg:biome-config`, ...)
   - `repo` for monorepo-wide / cross-cutting work

   The 15 `feature/<slug>` labels were migrated onto these area labels (issues
   **and** PRs, all states) and then deleted. `pr-review` and `unic-archon-dlc`
   (which already existed as bare labels) were renamed to the `app:` prefix.

GitHub's unused default labels (`duplicate`, `good first issue`, `help wanted`,
`invalid`, `question`) were deleted. Dependabot's (`dependencies`, `javascript`)
were kept, since Dependabot auto-applies and recreates them.

## Consequences

- Label count dropped from ~38 to 29 with a predictable scheme.
- **The area tier is owned by neither tool.** It is hand-applied and documented
  in [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md); `docs/agents/labels.md` stays
  consumer-generic and three-tier (its "three-tier" wording is auto-generated,
  so do not hand-edit it). Teaching `unic-archon-dlc` an area/component tier is a
  natural future enhancement that would let it own this tier too.
- **`feature/<slug>` grouping is retired with no replacement generator.** Going
  forward, per-feature grouping comes from archon's Slug/Session plus the area
  label. If Matt's skills are still live and create a new feature, they may mint
  a fresh `feature/<slug>` label that needs periodic re-migration until they are
  fully retired.
- `app:pr-review` deliberately tags the **deprecated v1** plugin's historical
  issues; it remains valid for that frozen context.
- **Do not re-run `/setup-matt-pocock-skills` without re-reconciling.** Only this
  skill's reference doc (`.agents/skills/setup-matt-pocock-skills/triage-labels.md`)
  was reconciled to the 8-state vocabulary. The skill's executable prompt
  (`SKILL.md`) still declares the original five canonical roles (using `wontfix`,
  not `rejected`), so a re-run remains destructive: it would present the 5-role
  vocabulary and revert `docs/agents/triage-labels.md` to the 5-role/`wontfix`
  set. Re-aligning `SKILL.md` was left out of scope because it is a vendored skill
  an upstream update could overwrite; reconcile it by hand if you re-run the skill.

## Amendment (2026-08)

The four-tier taxonomy above stands unchanged. Its **ownership** does not.

[ADR-0033](0033-de-dogfood-unic-archon-dlc.md) uninstalls `unic-archon-dlc` from this
monorepo, which reverses the Context above on one point: `unic-archon-dlc` is **not** "the
tool that stays" here, and `setup-matt-pocock-skills` is **not** being phased out — it is
the surviving driver. The collision the Context describes is resolved by removing a
generator, not by picking a winner between two.

Four amendments follow:

1. **Tiers 1-3 are repo-owned.** State, type and priority were owned by
   `unic-archon-dlc` and generated into `docs/agents/labels.md`. That file is now
   hand-maintained, so all four tiers sit on the same footing: the repo owns them, and
   `docs/agents/labels.md` is the record. Its "three-tier" wording — flagged above as
   auto-generated and not to be hand-edited — is corrected to four.
2. **`release` has one home.** The type was a repo-local override in
   `.archon/unic-dlc.config.json`, which is deleted. `docs/agents/labels.md` is now its only
   record.
3. **`wayfinder:*` is a fifth, tool-scoped namespace, outside the four tiers.**
   `wayfinder:map` marks a map issue; `wayfinder:{research,prototype,grilling,task}` type a
   child ticket. `/wayfinder` owns their lifecycle, so they are excluded from the
   one-per-tier discipline the four tiers follow and from any future generator's remit.
   Documented under
   [`docs/agents/issue-tracker.md` § Wayfinding operations](../agents/issue-tracker.md#wayfinding-operations).
4. **The "do not re-run `/setup-matt-pocock-skills`" warning is resolved by never
   re-running it.** Upstream v1.1 still declares five canonical roles using `wontfix`, so
   the destructive behaviour described above is unchanged. `docs/agents/*.md` is instead
   authored by hand from that skill's templates. The reconciled reference doc the warning
   points at, `.agents/skills/setup-matt-pocock-skills/triage-labels.md`, is no longer
   maintained: `.agents/skills/**` is upstream-owned and every `npx skills add` overwrites
   it — which is how that reconciliation was silently lost in 2026-08. The 8-state mapping
   lives in `docs/agents/triage-labels.md` only.

## Amendment 2 (2026-08-10)

The four tiers stand. Two changes to what they contain, both from the
[Regroup the tracker into streams](https://github.com/unic/unic-agents-plugins/issues/312)
wayfinder map.

The map introduces a **stream ticket**: an issue whose sub-issues are one workstream. Streams
are the grouping the tracker was missing — the area label answers "which app", not "which
effort", and one area can hold several unrelated efforts at once. Two of the three chains of
blocked-by edges in `app:unic-archon-dlc` belong to different streams.

1. **`stream` is a seventh type.** Type (6) becomes Type (7). The one-per-issue discipline is
   unchanged: a stream ticket carries `stream` and no other type. It carries no state label
   and no priority either — a stream is not triageable, and a state on it would distort the
   readiness counts that the state tier exists to produce.

2. **The area tier is one-per-issue for members, several for stream tickets.** A stream can
   span apps and packages, so a stream ticket may carry more than one area label. Every other
   issue keeps exactly one, because `/archon-rollout` derives the branch name
   `feature/<scope>/<issue#>-<slug>` from it and stops when an issue has none; a second label
   would leave that derivation with no single answer. Stream tickets are never dispatched, so
   the exception is safe.

Both are recorded in [`docs/agents/labels.md`](../agents/labels.md), which remains the record
for every tier.

Two adjacent decisions from the same map are **not** ADR material and live on the map instead:
sub-issue links express stream membership while native GitHub dependencies express ordering,
and a stream ticket closes only after its children close.
