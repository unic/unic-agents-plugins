# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [0.14.0] — 2026-08-04

### Breaking
- (none)

### Added
- **`/specs`, `/tickets`, `/triage` and `/improve-architecture` resolve their Methods through `resolveMethod`.** Each Box's Step 1 now returns `methods: [{name, path, tier}]` alongside its config and prints a `methods: to-spec(bundle) · grilling(bundle) · …` line, so a Method answering from an unexpected tier — a forgotten `.archon/methods.local/` override, a `methods.<name>.source` someone declared months ago — is visible instead of silent. An unresolved Method stops the Box: it cannot run a procedure it cannot read. Boxes then read the returned path; a Method's sub-files sit beside its `SKILL.md` at every tier.
- **A confirmation halt at the end of `/specs` Step 4.** v1.1.0 added "do not enact the plan until I confirm we have reached a shared understanding" to `grilling`, because grilling sessions were running straight into implementation on some models. `/specs` now carries that as an explicit halt on **every** Step 4 branch — the interview's own confirmation in `discuss` mode, agreement on the assumptions in `assumptions` mode, the synthesis review in `ingest`/`hybrid` — so the command has one shape whatever the input. It fires when the interview *reaches* shared understanding, not at a fixed question count; on "no" it returns into the interview.
- **`test/command-methods.test.mjs` — the Boxes are held to the manifest.** Five checks per Box, plus one that asserts each `const wanted = [...]` matches `providedTo` in both directions. It fails on a pre-v1.1.0 alias in the prose (`to-prd`, `to-issues`, `grill-with-docs`), a sub-file upstream deleted, a hardcoded path into a Method's directory, a missing tier line, and any surviving `matt_suite` reference. Verified by mutation: each of those four defects, injected into `commands/specs.md`, fails the suite. This closes the gap `AGENTS.md` admitted out loud — a stale Method name in command prose was caught only by reading, which is how the v1.1.0 rename wave shipped green.

### Changed
- **`specs.gate` is stated to be the single approval gate.** `/specs` has three halts — the new design confirmation, the seam check, and the PRD gate — but only `specs.gate` produces a durable artefact and puts it in front of a human, and it is where `grilling`'s "do not enact" lands: inside `/specs`, enacting the plan means writing and PR-ing the PRD. The other two settle the design; they approve nothing. `commands/specs.md` says so, and so does a dated amendment on [ADR-0020](docs/adr/0020-specs-branch-on-input.md).
- **A prefactor stays an ordinary slice; `issues.json` gains no field.** Upstream `to-tickets` added prefactoring guidance ("make the change easy, then make the easy change"). Expressing it needs no schema change: `type: tech-debt` with `blocked_by: []`, named in the `blocked_by` of every slice it unblocks, already ships first by dependency order and needs no new rule in `/build`. A `prefactor: true` flag would have been decoration until something read it, and a `prefactor` type value would have cost a new tracker label in every Consumer. `commands/tickets.md` records the shape; #280 records the reasoning. The HITL/AFK slice typing upstream dropped needed no removal — `lib/issues-schema.mjs` never carried it.
- **Every stale Method name and moved path corrected.** `to-prd` → `to-spec` and `to-issues` → `to-tickets` throughout. `/specs` reads the interview discipline from `grilling` and the ADR/CONTEXT formats from `domain-modeling`'s `ADR-FORMAT.md` / `CONTEXT-FORMAT.md`, because `grill-with-docs` is now a six-line pointer that carries neither. `/improve-architecture` points at `HTML-REPORT.md` (new at v1.1.0) and at `codebase-design` for `DEEPENING.md` and `DESIGN-IT-TWICE.md`; the dead paths to `DEEPENING.md`, `INTERFACE-DESIGN.md` and `LANGUAGE.md` under `improve-codebase-architecture` are gone. `/triage` no longer hardcodes `.agents/skills/triage/SKILL.md`. [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) and [ADR-0022](docs/adr/0022-tickets-slice-to-build.md) named the old Methods in the present tense and gain dated amendments; ADRs 0007, 0008 and the `docs/redesign/` notes keep their original wording, because there they describe what was decided at the time rather than what the Boxes read now.
- **`/triage`'s label injection re-verified against the rewritten upstream.** v1.1.0 rewrote both `SKILL.md` and `AGENT-BRIEF.md`, and the binding still holds: two category roles, five state roles, `wontfix` still splitting into already-implemented versus rejected-enhancement, `.out-of-scope/` still the knowledge base. `classification.labels` remains the single source of truth and Matt's own label docs remain unread ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md)). Three bindings the rewrite made explicit are now written down: `AGENT-BRIEF.md` names `ready-for-agent` and `wontfix` as GitHub literals and must be read as canonical roles resolved through `LABELS`; the Method hardcodes `.out-of-scope/` in its `SKILL.md` as well as in `OUT-OF-SCOPE.md` — including in the prior-rejection check that runs while gathering context, before any outcome is chosen — where the DLC uses `TRIAGE.out_of_scope_dir`; and the "run `/setup-matt-pocock-skills` if the vocabulary is missing" fallback carried by `SKILL.md`, `to-spec` and `to-tickets` never applies, because Step 1 provided it.
- **`/improve-architecture` stops on a plugin-load error instead of claiming it can continue.** Its catch block previously returned `ok: true, degraded: true` with `methods: []`, while the same step's prose said an empty `METHODS` must stop the Box — a contradiction, and one that left the operator with no message to print. A plugin-load failure is not the degradable case: leniency covers a missing or unreadable *config*, but if this Plugin's own `lib/` cannot be imported there is no resolver, no Method resolves, and Step 3 has no procedure to follow. The catch now returns `ok: false` with the cause.
- **Method paraphrases removed from `commands/triage.md` and `commands/improve-architecture.md`.** Each carried a paragraph restating what the Method does — the defect [ADR-0030](docs/adr/0030-harness-hosts-methods.md) names, and one that had already come true: both summaries described the pre-v1.1.0 text. The Box now points at the resolved path and keeps only what the Harness owns (the config binding, the ADR deferral to Step 6, the durable artefact paths). `/tickets` likewise drops the restated slice rules, keeping the DLC's own granularity litmus and noting that it does not apply to the Method's new wide-refactor expand–contract sequence.

### Fixed
- **`CLAUDE_PLUGIN_ROOT` is named when it is missing.** Every Step 1 snippet builds its import paths with `join(pluginRoot, …)` — cross-platform, but `join(undefined, …)` throws "The \"path\" argument must be of type string", which names neither the variable nor the fix. Each snippet now checks the variable first and throws a sentence instead. Applied to all five commands that use the idiom, including `commands/setup.md`, which carried the same latent case before this release.


## [0.13.1] — 2026-08-03

### Breaking
- (none)

### Added
- **ADR-0030 — the Plugin is a Harness that hosts Methods.** Records the framing that ends the drift tranche 1 fixed mechanically: the Harness owns isolation, gates, config, red/green integrity, system-skill composition, artefact durability and posting, and a **Method** owns procedure. [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)'s "adds Unic value" test becomes structural — **a Box survives only for what no Method can supply** — which is why `handoff` and `prototype` are referenced rather than bundled, and why #281 is mostly deletion. Amends [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md) and ADR-0021; both carry a status line pointing here.
- **ADR-0031 — Methods are bundled, the plugin version is the pin, resolution is three-tier.** Why the Methods must be committed files in the Consumer repo ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5: an Archon node runs in a separate worktree and cannot rely on `$CLAUDE_PLUGIN_ROOT`), why there is no `skills.pin` key, why paths must be repo-relative, and why Methods are read by path and never registered as skills. Records **per-box mapping as a rejected alternative** with its reason — it is the pre-#279 status quo that let the v1.1.0 rename wave break `/specs` and `/tickets` with CI green — plus two more rejections (run-time fetching, a separate pin key), so none of the three is re-derived.
- **ADR-0032 — the vocabulary.** **Box**, **Method**, **Local Method**, **Bundle**, and **Harness**, with the division that makes them decidable: configuration carries _parameters_ (which, where, whether) and a Method carries _procedure_ (how). A team wanting different method text forks the Method instead of gaining a config key, which is what stops the config schema absorbing method text one key at a time.
- **A drift test for the dependency list.** `test/methods-manifest.test.mjs` parses the Method table in `README.md` and asserts it matches the manifest's `providedTo` row for row, in manifest order, and that a Method with no Box says so rather than naming one. A stale row now fails CI.

### Changed
- **One dependency list, generated from the manifest.** `README.md` listed 6 Methods under three pre-v1.1.0 names (`grill-with-docs`, which is no longer a method at all, plus `to-prd` and `to-issues`), `commands/setup.md` listed none after tranche 1b, and the boxes read 11. All three surfaces now point at one table generated from `providedTo`, delimited by `methods-table` markers and guarded by the test above. `AGENTS.md` gains two doctrines — the Harness/Method division and "do not restate the list" — and `commands/setup.md` names the manifest instead of repeating it.
- **`Harness` replaces `thin process layer` as the canonical term.** `CONTEXT.md` defines Harness and lists the old phrase under `_Avoid_`; the opening sentences of `README.md`, `AGENTS.md` and `CONTEXT.md` are rewritten. ADR-0016 keeps its original wording as the historical record. `CONTEXT.md` also gains **Box**, **Method**, **Local Method** and **Bundle** — the last was load-bearing in code from tranche 1b (`METHODS_BUNDLE`, `verifyBundle`) while appearing in no glossary.
- **`README.md` states the never-registered-as-skills rule and its reason** — a Consumer running Matt Pocock's own Claude Code plugin would otherwise get every skill twice, with no way to tell which copy answered.

### Fixed
- (none)

## [0.13.0] — 2026-08-03

### Breaking
- (none)

### Added
- **`lib/methods-manifest.mjs` — the Method manifest.** One entry per Matt Pocock skill the Boxes compose (`name`, `upstreamPath` pinned to upstream tag `v1.1.0`, `subFiles`, legacy `aliases`, `providedTo`, `knownExternalRefs`), plus `resolveAlias` and `findMethod`. Until now a Method name was a hardcoded string in `commands/setup.md`, `commands/specs.md` and `commands/tickets.md` at once, with nothing tying the three together — which is why the upstream v1.1.0 rename wave (8 skills renamed; `to-prd` → `to-spec`, `to-issues` → `to-tickets`, `review` → `code-review`) broke those commands without a single failing test. A closure test walks the real v1.1.0 `SKILL.md` content for all 11 Methods and asserts every `` `/cross-reference` `` resolves to a manifest name, a manifest alias, or an audited external exception, so the next rename or content relocation fails the suite instead of shipping silently.
- **`lib/methods-resolver.mjs` — three-tier Method resolution.** `resolveMethod(name, { repoRoot, config, box, existsFn })` returns `{ name, path, tier }` for the first tier that answers — `config` (`methods.<name>.source`) → `local` (`.archon/methods.local/<name>/SKILL.md`) → `bundle` (`.archon/methods/<name>/SKILL.md`) — and an error value, never a throw, otherwise. Resolved paths must stay inside `repoRoot`: absolute paths, Windows drive letters, `~` prefixes, and `../` or `..\` escapes are all rejected, the last two normalised so a Windows-style escape is caught on POSIX too. The unresolved-Method error names both the Method and the requesting Box, so an operator reading a log knows which command to fix.
- **`vendor/mattpocock-skills/` — the Methods, bundled.** The 11 Methods the Boxes compose, copied verbatim from `mattpocock/skills` at tag `v1.1.0` (commit `d574778f`), mirroring the upstream `skills/<category>/<name>/` layout so each manifest entry's `upstreamPath` is load-bearing: an upstream relocation now fails the closure test instead of silently resolving nothing. Only the manifest's transitive closure is vendored — `handoff` and `prototype` are named in prose for a human to run and are deliberately absent. Provenance is a frozen `METHODS_BUNDLE` constant in `lib/methods-manifest.mjs` (repo, tag, commit, licence, licence sha256), with `vendor/mattpocock-skills/README.md` as its human mirror; a test asserts the two quote the same tag and commit.
- **`lib/methods-bundle.mjs` — verify, install, and inspect the bundle.** `verifyLicence` hashes the vendored `LICENSE` against the pinned tag's; `verifyBundle` checks every file each manifest entry declares — its `SKILL.md` **and** its `subFiles` — against the files on disk, because several Methods read their own companion files (`tdd` reads `tests.md`, `triage` reads `AGENT-BRIEF.md`) and a bundle holding only the `SKILL.md` files would pass every closure test while shipping Methods that point at nothing; a companion test asserts each entry's `subFiles` matches the vendored directory exactly, so an added upstream file cannot go unrecorded either; `installMethods` clean-replaces `.archon/methods/` so a Method dropped from a later manifest cannot linger; `inspectLocalOverrides` reports each `.archon/methods.local/<name>/` override's `forked_from` frontmatter. Error-as-value throughout, `node:fs`/`node:path`/`node:crypto` only — no shell, so it works on macOS, Windows and Linux. `installMethods` never reads or writes the Local-override tier.
- **`/setup` Step 6 — installs the Methods.** `verifyLicence` → `verifyBundle` → `installMethods` → `inspectLocalOverrides`, then the summary lists every Method with the tier it resolved from and flags any Local override whose `forked_from` differs from the bundled tag (a missing value is flagged too — an unversioned override is the case the check exists for). Either integrity failure stops the run: both mean the shipped Plugin is incomplete or altered, which no Consumer action fixes. A missing `LICENSE` asks the maintainer to restore it and is never auto-created.

This release completes tranche 1 of the upstream v1.1.0 migration: the manifest and resolver (slice 1a) plus the Bundle and the install path (slice 1b). Rewiring each Box onto `resolveMethod` is a separate slice, so no `commands/` box behaviour changes beyond `/setup`.

### Changed
- **Retired the `skills.matt_suite` config key.** It recorded a verify-only probe of whether the Consumer had separately installed Matt's skill suite — a question the Bundle now answers by construction. `defaultConfig()` drops it and gains `methods: {}` (the config tier `resolveMethod` reads); `mergeConfig` strips it from an existing on-disk config, so a re-run of `/setup` cleans it up with no manual migration. `/setup` Step 3 no longer probes for the suite, and `/specs`, `/tickets`, `/triage` and `/improve-architecture` drop the passthrough and the degrade warning. Per-Box `resolveMethod` wiring is a later slice, so no Box behaviour changes here.
- **Repointed the manifest closure test at the real bundle** and extended it from `SKILL.md` to every Markdown file a Method ships, which brings `improve-codebase-architecture/HTML-REPORT.md` and `triage/AGENT-BRIEF.md` into the scan. The 11 pinned `test/fixtures/methods/` copies are deleted: two pinned copies of the same upstream text is a drift trap — bump the bundle and the fixtures keep asserting the old tag, so the test passes while the bundle diverges. `.prettierignore` swaps the fixtures entry for `**/vendor/mattpocock-skills/skills/**`, scoped to the subtree so the vendor `README.md` stays Prettier-checked.

### Fixed
- (none)

## [0.12.0] — 2026-07-03

### Added
- **Regenerated the vision diagram** to the two-axis target architecture (redesign step 13, final). The new canonical pair is `docs/20260703-Unic-dlc.{mmd,excalidraw}`, hand-authored to show the main line (`/specs → /tickets → /build → /pr-review → /qa`), `/triage` + `/qa` findings + humans as on-ramps into `/tickets`, and the off-line boxes (`/setup`, `/explore`, `/improve-architecture`, `/cleanup`; `/handoff` + `/prototype` referenced), with the container (Archon vs command/skill) and HITL/AFK gate axes encoded. The superseded draft is archived as `docs/20260703-Unic-dlc-draft.{mmd,excalidraw}`; a dated `yyyymmdd-` snapshot scheme replaces the single canonical filename (newest date wins).
- **Documented the "deterministic output" property** in `CONTEXT.md` as an _emergent_ consequence of the fresh-slice-reads-committed-repo discipline ([ADR-0012](docs/adr/0012-fresh-context-red-green-separation.md) / [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md) / [ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)) — it needs no workflow.

### Changed
- **Swept the plugin docs to the shipped model** (redesign step 13). Rewrote the stale `README.md` — the old six-workflow diagram + node table, the `ROADMAP.md`/`HANDOFF.md` `docs/workflow/` layout, `yaml-gen`/`build-<slug>.yaml`, and the `Archon ≥ 0.10` requirement were all pre-redesign — into the two-axis box set, the four actual Archon workflow pipelines, a `<artifacts_dir>/<slug>/` session-artifact layout (no `ROADMAP.md`/`HANDOFF.md`), and `Archon ≥ 0.5.0`. Fixed `CONTEXT.md` (stale `unic-dlc-plan.md` example → `unic-dlc-build.md`; dropped the dissolved `yaml-gen`/`build-<slug>.yaml` relationships per [ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md)). Tidied the `plugin.json` / `marketplace.json` descriptions so only `build`/`qa`/`pr-review`/`explore` are called Archon workflows and `improve-architecture` is listed.
- **Marked the redesign complete** in `docs/redesign/README.md` (step 13 → done); the directory is kept as the historical record.

## [0.11.0] — 2026-07-03

### Breaking
- **Dissolved `lib/findings-writer.mjs` and `lib/spike-verdicts.mjs`** (and their tests) — completing [ADR-0018](docs/adr/0018-generic-core-config-compose.md) #3 for the explore-only libs. The `/explore` nodes now write `findings.md` and the spike verdicts with their own tools ([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5), so these modules have no remaining consumer. `labels-config.mjs` is untouched (`config-schema.mjs` still imports `getDefaultLabels`).

### Added
- **Ported the `unic-dlc-explore` Archon workflow to the key-discriminated node schema** ([ADR-0011](docs/adr/0011-archon-schema-target.md); [ADR-0029](docs/adr/0029-explore-research-spike-onramp.md)). The shipped workflow was **doubly dead** — a `type:`-style spike gate that never paused, and an import of the already-deleted `lib/config-loader.mjs`. The off-line, optional research + AFK-spike pipeline (`bootstrap → guard → four parallel research nodes → synthesize → spike → spike-ticket → spike-branch-gate → preserve-spike`) now: writes `findings.md` to `<artifacts_dir>/<slug>/` ([ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)) instead of `docs/workflow/<slug>/`; frames the **Integrated Brief** as three explicitly-named lenses — **Domain Model / Established Decisions / Prior Research** — that `/specs`' load-context reads verbatim (the tightened `/explore → /specs` contract); runs the `spike` node **AFK** (build/measure where feasible, else reason → VALIDATED/INVALIDATED/PARTIAL) and **references** Matt's `/prototype` skill for the interactive case (never invokes it — nodes have no live conversation); files the spike ticket **before** a config-gated `approval:` spike-branch gate (`gates.explore`, HITL default) so the durable output survives a "discard", composing the tracker + `classification.labels` ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md)); and preserves the spike on `spike/<slug>` only on approve (AFK skips → worktree left for `/cleanup`). Nodes are self-contained prompt nodes with no plugin-`lib/` import. No new config key (`gates.explore` + `artifacts_dir` already exist) → no `/setup` change.

### Fixed
- (none)

## [0.10.0] — 2026-07-03

### Breaking
- (none)

### Added
- **`/cleanup` repo-global operational janitor command** (ADR-0028) — reports (and, on explicit opt-in, prunes) the debris an Archon-driven lifecycle accumulates: **merged/stale worktrees**, **stale branches/PRs**, and **stale `<artifacts_dir>/<slug>/` dirs**. It is a **Claude Code command, not an Archon workflow** (it mutates sibling worktrees/branches/PRs, so it cannot run inside an isolated worktree — ADR-0017), **composing** Archon's own `archon isolation list` / `archon isolation cleanup [days] [--merged] [--include-closed]` / `archon complete <branch>` for worktree/branch lifecycle and the configured tracker (`tracker.access`, MCP-first/CLI-fallback) for PR/branch state — no `tracker-adapter` lib. **Report-first and never auto-deletes:** pruning requires `--apply` **plus** an explicit **per-category** confirmation, and `cleanup.dry_run: true` (the shipped default) keeps even `--apply` in report mode until overridden. A slug dir is prunable **only if** its PR/branch is merged or closed (`cleanup.prune_slug_dirs` defaults `false`); slug-dir pruning skips any dir containing a `LICENSE` (repo policy). Config load is lenient (off-line); degrades to defaults when config or the tracker is absent.
- **`cleanup` config block** in `.archon/unic-dlc.config.yaml` — `stale_days` (default 7), `dry_run` (default true), `prune_slug_dirs` (default false). Added to `defaultConfig()` with merge/validate test coverage; **not** a mandatory path, so existing configs stay valid and auto-fill the block on next merge.

### Removed
- **Retired the legacy `unic-dlc-cleanup` Archon workflow + command stub** (`.archon/workflows/unic-dlc-cleanup.yaml`, `.archon/commands/unic-dlc-cleanup.md`). Its arch-review + ADR-consolidation content was harvested into `/improve-architecture` in v0.9.0 (ADR-0027); the `cleanup` name now belongs to the operational janitor (ADR-0028).

### Fixed
- (none)

## [0.9.0] — 2026-07-03

### Breaking
- (none)

### Added
- **`/improve-architecture` off-line arch-health command/skill** (ADR-0027) — surfaces technical + intent drift and deepening opportunities, writes a durable `arch-review.md`, and consolidates ADRs **including superseding**. It **composes Matt Pocock's `improve-codebase-architecture` verbatim** (technical drift + deepening HTML report + `/grilling` loop, with `/codebase-design` vocabulary + `/domain-modeling`) and **earns its place** (ADR-0021) by adding three DLC layers the raw skill lacks: an **intent-drift** pass (PRD stories/ACs vs shipped), a **durable artifact** under `<artifacts_dir>/` (ADR-0015), and an **ADR-consolidation gate with superseding**. Two modes: `/improve-architecture <slug>` → intent-grounded against that build session; `/improve-architecture` (no arg) → repo-wide sweep (dated artifact, intent-drift skipped). Superseding spans **both ADR homes** (plugin-local + repo-root), never deletes an ADR (old status → `Superseded by ADR-NNNN`, matching `README.md` index updated). Config load is **lenient** (off-line, touches no tracker); no new config key, no `lib/` change, no auto-hook. Harvests the legacy `unic-dlc-cleanup` `arch-review` + `adr-consolidation` content; does **not** touch that workflow (step 11's scope).

### Fixed
- (none)

## [0.8.0] — 2026-07-03

### Breaking
- (none)

### Added
- **`/pr-review` generic fan-out Archon workflow** (ADR-0026) — reviews the open PR by composing **one Intent Brief** (linked work items + Confluence/MD docs + PR description + `PRD.md`) in `prep` and **injecting it into every aspect**, then fanning out **seven parallel fresh aspect nodes** (code-quality, test-coverage, silent-failure, type-design, comment-rot, code-simplification, intent/AC-coverage) — conditionally spawned by the changed-file categories and scored on a confidence→severity rubric. Findings are synthesised, **reconciled against the prior iteration** (new / still-present / fixed / regressed) in a dedicated `reconcile` node keyed on a hidden `<!-- unic-dlc-pr-review:iteration=N -->` marker (never author identity), then — after a `gates.pr-review` confirm (AFK posts directly) — posted as a **summary comment + inline comments** via the configured tracker (MCP-first, CLI-fallback). It **harvests `unic-pr-review`'s review learnings with no ADO code and no runtime dependency** on that plugin; posting is advisory (the real merge gate is `/qa`). **Not** via `lib/tracker-adapter.mjs` (dissolved).
- **`pr-review` config block** in `defaultConfig()` — `{ confidence_threshold: 60, inline_comments: true }`. `mergeConfig` auto-fills it for existing configs (no `/setup` change). The `gates.pr-review` key already existed.
- **New ADR-0026** recording the self-contained harvest-not-depend decision, the fan-out schema, intent-composed-once-injected-everywhere, the confidence rubric + spawn gates, first-class re-review, and the confirm-before-post gate.

### Fixed
- (none)

### Changed
- **Renamed + ported the `unic-dlc-review` workflow to `unic-dlc-pr-review`** on the key-discriminated node schema (ADR-0011) — the shipped single monolithic `type: prompt` node ran inert. `git mv`'d the workflow YAML + command stub, moved config reads to `.archon/unic-dlc.config.yaml`, artefact paths to `<artifacts_dir>/<slug>/pr-review/` (ADR-0015), replaced the four-aspect single-comment node with the seven-aspect fan-out DAG, and dropped the stale `lib/tracker-adapter.mjs` + `apps/claude-code/pr-review/` references. Updated the plugin/marketplace descriptions to enumerate the current boxes (added `pr-review`, dropped the retired `plan`).

## [0.7.0] — 2026-07-02

### Breaking
- (none)

### Added
- **`/qa` issue-producing on-ramp** (ADR-0025) — a UAT rejection now files each defect **directly** as a `ready-for-agent` tracker issue (composing the configured tracker + `classification.labels` as the single source of truth, Matt's `qa` brief shape with blocked-by honesty and no file paths, and the `> *This was generated by AI during QA.*` disclaimer), feeding `/tickets`. Previously QA could only halt. Findings are filed `ready-for-agent` (not `needs-triage`) because the human at the UAT gate already vetted them. **Not** via `lib/tracker-adapter.mjs` (dissolved) — QA composes the tracker (MCP-first, CLI-fallback).
- **`qa` config block** in `defaultConfig()` — `{ e2e_command: null, coverage_threshold: null }`, resolved as `qa.e2e_command ?? build.e2e_command` (and likewise coverage) so a team can run a heavier QA suite than `/build`. `mergeConfig` auto-fills it for existing configs (no `/setup` change).
- **New ADR-0025** recording the port, the two-gate model, the AFK-safe `trigger_rule: all_done` + fail-closed merge `when`, the finding-capture on-ramp, and the `/tickets` routing (reconciling the step doc's "feed `/build`" with PLAN #8).

### Fixed
- (none)

### Changed
- **Ported the `unic-dlc-qa` Archon workflow to the key-discriminated node schema** (ADR-0011) — the shipped `type: interactive` UAT gate never paused. The pipeline (`e2e → coverage-gate → uat-prep → uat-gate → verify-pr-base → merge-gate → merge`) now has **two real `approval:` gates** (UAT + merge), both governed by `gates.qa` (HITL default, AFK opt-in). Downstream nodes use `trigger_rule: all_done` so AFK skips the gates and **auto-merges a clean build**; the merge node **fail-closes** (`when` on e2e/coverage results + verified PR base) so a red build or wrong base never auto-merges. Config reads move to `.archon/unic-dlc.config.yaml`; artefact paths move to `<artifacts_dir>/<slug>/` (ADR-0015). Nodes are self-contained prompt nodes — no plugin-`lib/` import (ADR-0023 §5). A missing `e2e_command`/`coverage_threshold` now **skips with a warning** instead of hard-failing.

## [0.6.0] — 2026-07-02

### Breaking
- **Retired the old `unic-dlc-triage` Archon workflow + command stub** (`.archon/workflows/unic-dlc-triage.yaml`, `.archon/commands/unic-dlc-triage.md`). Its state-snapshot role (writing `HANDOFF.md` / `ROADMAP.md`) was already retired by ADR-0013, and it used the inert `type:`-style schema (ADR-0011). `/triage` now means the intake on-ramp (ADR-0024).

### Added
- **`/triage` intake on-ramp command** (`commands/triage.md`, ADR-0024) — a thin wrapper that turns raw work (bugs, requests, QA findings, external PRs) into agent-ready tracker issues feeding `/tickets`. It **composes Matt Pocock's `triage` method but injects `classification.labels` from `.archon/unic-dlc.config.yaml` as the single source of truth** for labels (forbidding Matt's `docs/agents/triage-labels.md` / `issue-tracker.md`), so labels can't drift from what `/tickets` + `/build` read. Consequently `setup-matt-pocock-skills` is not a plugin dependency — only Matt's skill _methods_ are. Best-effort verification, no config knob; inherently HITL (writes directly, no PR gate); produces no `issues.json`/PRD.
- **`triage` config block** in `defaultConfig()` — `{ out_of_scope_dir: '.out-of-scope', external_prs: 'auto' }`, the DLC-config home for the two knobs Matt's setup would otherwise write to `docs/agents/*`. `mergeConfig` auto-fills them for existing configs (no `/setup` change).
- **New ADR-0024** recording the intake-on-ramp meaning, the thin-wrapper delegation, the single-source compose rule, the 8-state↔Matt-5-role mapping (`needs-specs`→`/specs`), and the retirement.
- **README `## Dependencies` section** documenting how to install Matt's skill-method suite and why `setup-matt-pocock-skills` must not be run.

### Fixed
- **De-referenced the retired triage workflow from `unic-dlc-cleanup`** — removed cleanup's dangling terminal `run-triage` node (which invoked `archon workflow run unic-dlc-triage`) and its `HANDOFF.md` / `ROADMAP.md` output rows. Surgical reference cleanup only; the full `/cleanup` redesign is step 11.
- **Added the missing ADR-0023 + ADR-0024 rows** to `docs/adr/README.md` index.

## [0.5.0] — 2026-07-02

### Breaking
- **Dissolved `lib/dag-builder.mjs`** (+ `test/dag-builder.test.mjs`, and its entry in the `test` script) per ADR-0023. `/build` no longer executes a generated per-slug `.archon/workflows/build-<slug>.yaml`; it consumes the dependency-ordered `issues.json` from `/tickets` directly via one generic loop. Codegen was the least-generic artefact in a generic-core plugin (ADR-0018).

### Added
- **`/build` ported to the key-discriminated Archon schema (ADR-0011) as one generic red/green/refactor loop** (ADR-0023). A single `loop:` node (`fresh_context: true`) advances every slice through three SEPARATE fresh-context phases — RED (write a provably-failing test, committed only when `test_command` exits non-zero), GREEN (minimum impl reading only the committed test, never RED's session), REFACTOR (clean up under a green suite) — serially in dependency order, with on-disk `build-state.json` as the baton. Preserves the anti-cheat contract (ADR-0012); retires the nested-`archon workflow run` risk (the loop runs inline).
- **New ADR-0023** recording the loop shape, the RED exit-code proof, refactor-as-third-fresh-phase, the dag-builder dissolution, gate honoring, and the self-contained-script convention for shipped Archon workflow nodes (no plugin-`lib/` import, since `/setup` installs only YAMLs + command stubs).

### Fixed
- (none)

## [0.4.0] — 2026-07-02

### Breaking
- **Deleted the legacy `.archon/workflows/unic-dlc-plan.yaml` + `.archon/commands/unic-dlc-plan.md`** (ADR-0022). The monolithic plan workflow is fully superseded by `/specs` (PRD) + `/tickets` (issues); it also used the inert `type:`-style schema (ADR-0011).
- **Dissolved `lib/tracker-adapter.mjs`** (+ `test/tracker-adapter.test.mjs`, and its entry in the `test` script) per ADR-0018. Tracker CLI-string generation is no longer a lib: `/tickets` (and other boxes) compose the configured tracker system-skill (MCP-first) or `gh`/`az`/`jira` CLI from config in prose (ADR-0016).

### Added
- **`commands/tickets.md`** — the `/tickets` box (ADR-0022, ADR-0017): an in-session command that decomposes an approved PRD into independently-grabbable **vertical tracer-bullet slices**, attaches a test seam per slice (nyquist-map), validates the set in a single conversational pass (dependency integrity, PRD-criteria coverage, mandatory fields via `issues-schema`, test-seam presence), writes a dependency-ordered `<artifacts_dir>/<slug>/issues.json`, publishes the issues to the configured tracker (intent on the issue — contract C), and opens a HITL tickets gate. Composes Matt Pocock's `/to-issues`. Runs the definitive estimation wave when `estimations` is `definitive | both`.
- **`tickets` config block** — `tickets.gate` (`open-pr` | `stage-only`, default `open-pr`), mirroring `specs.gate`. See ADR-0022.

### Changed
- **`/tickets` stops at a build-ready `issues.json`; it does NOT generate a build DAG** (ADR-0022). `/build` (step 06) will consume `issues.json` via a generic loop rather than a per-slug generated workflow — so `lib/dag-builder.mjs` is off the main path and left untouched pending the `/build` step. Contract B (fresh-context red/green, ADR-0012) is preserved; its delivery mechanism moves from codegen to a runtime loop. The step-06 redesign handoff doc is updated accordingly.

### Fixed
- (none)

## [0.3.0] — 2026-07-02

### Breaking
- **`lib/prd-writer.mjs` reshaped (ADR-0018).** The hardcoded 7-section template is gone: `writePrd(projectDir, slug, content, artifactsDir = 'workflows')` now persists an already-rendered PRD string (was `writePrd(projectDir, slug, sections)`), and `readPrd` takes the same `artifactsDir`. The PRD now lands at **`<artifacts_dir>/<slug>/PRD.md`** (default `workflows/<slug>/`), not `docs/workflow/<slug>/`. `validatePrdSections(content, requiredHeadings = DEFAULT_PRD_HEADINGS)` is now generic (headings passed in). The legacy `.archon/workflows/unic-dlc-plan.yaml` is superseded by `/specs` + `/tickets` and left untouched until step 05.

### Added
- **`commands/specs.md`** — the `/specs` box (ADR-0020, ADR-0017): an in-session command that turns an idea (or an existing spec / Figma / UX / issue) into one human-approved PRD by **branch-on-input** (converse / ingest / hybrid), composing Matt Pocock's `/grill-with-docs` + `/to-prd` and the configured docs/design/tracker system-skill (MCP-first, CLI-fallback). Adds a seam-design approval step, config-gated provisional estimation, opt-in docs publishing, and a HITL PRD gate.
- **`templates.prd` default** — the 7-section PRD scaffold now ships in config (`DEFAULT_PRD_TEMPLATE` in `config-schema.mjs`, ADR-0018); teams override it to change the PRD shape.
- **`specs` config block** — `specs.discuss_mode` (`discuss` | `assumptions`, default `discuss`) and `specs.gate` (`open-pr` | `stage-only`, default `open-pr`). See the amended ADR-0020.

### Changed
- **`README.md`** configuration reference: `templates.prd` now defaults to the scaffold; added `specs.discuss_mode` and `specs.gate` rows.

### Fixed
- (none)

## [0.2.0] — 2026-07-02

### Breaking
- **`/setup` is now conversational and writes the rich `.archon/unic-dlc.config.yaml`** (ADR-0019, supersedes ADR-0001), replacing the flat `.archon/unic-dlc.config.json`. The command detects the stack, runs verify-only skill discovery (introspect MCP/skills + CLI probes; never installs) to register a capability→tool map, verifies Matt Pocock's declared skill suite (warn + degrade, non-blocking on a missing required capability), and composes the team's system-skills for the _how_. An existing legacy `.json` is read and migrated but **left in place** (other tools may read it) — no backup file, no delete.
- **Dissolved the heavy setup libs** `lib/install-runner.mjs`, `lib/setup-explorer.mjs`, `lib/config-loader.mjs`, and `lib/agent-docs-writer.mjs` (and their tests). Their `docs/agents/` + `CLAUDE.md` marker-block behaviour is re-homed to idempotent prose steps in `commands/setup.md`. See ADR-0018.

### Added
- **`lib/config-schema.mjs`** — the one surviving tested lib (imports `yaml`): `loadConfig` (parses `.yaml`/`.json`), `validateConfig` (mandatory-path invariant), `mergeConfig` (deep, idempotent, `defaults < existing < answers`), `migrateLegacy` (flat ADR-0001 JSON → rich nested shape, preserving hand-added labels such as `release`), `toYaml`, and `detectRepoLayout`. Covered by `test/config-schema.test.mjs`.
- **`yaml`** runtime dependency (pinned via the pnpm catalog).

### Changed
- **`lib/archon-check.mjs`** now enforces a behavioural min-floor (`checkArchon` rejects Archon `< 0.5.0` via `MIN_ARCHON_VERSION`) instead of an exact-version match — the key-discriminated schema (gates/loops/fresh-context) requires `≥ 0.5.0` (ADR-0011/0019). Unparseable versions are non-blocking. The `incompatibleVersions` override is preserved (bare-array and options-object forms both accepted).
- **`README.md`** configuration reference rewritten to the rich YAML schema.

### Fixed
- (none)

## [0.1.2] — 2026-05-23

### Breaking
- (none)

### Added
- Updated `buildDomainDoc` multi-context branch in `lib/agent-docs-writer.mjs` so the generated `docs/agents/domain.md` notes that each context may keep its own `docs/adr/` for context-scoped decisions, and branches the trailing "How agents use this" paragraph by `isMulti` so the multi-context form points readers via `CONTEXT-MAP.md` and acknowledges both root and context-scoped `docs/adr/`. The wording is portable — no hardcoded path leaks into Consumer output. A node:test assertion in `test/install-agent-docs.test.mjs` guards the phrases in multi-context mode and confirms they are absent in single-context mode.

### Fixed
- (none)

## [0.1.1] — 2026-05-23

### Added
- Added `/unic-archon-dlc:setup` slash command for conversational plugin configuration
- New `lib/dogfood-banner.mjs` module: exports `AGENT_DOC_BANNER`, `SKILLS_BLOCK_BANNER`, and `prependBanner()` — all banner strings in one place.
- Every `docs/agents/*.md` file generated by `agent-docs-writer.mjs` now begins with `AGENT_DOC_BANNER`, signalling it is auto-generated and explaining how to regenerate it.
- The `<!-- unic-archon-dlc:begin/end -->` block in `CLAUDE.md` now includes `SKILLS_BLOCK_BANNER` as its first line, making the auto-managed region visible in plain text (not only via HTML-comment markers).
- Dogfood state in this repo updated: `docs/agents/*.md` and the `AGENTS.md` block now carry the banner.

### Removed
- Removed `hooks/install.mjs` and `hooks` field from `plugin.json`

### Fixed
- Build `run-build` node prompt now invokes the generated per-slug workflow by name (`archon workflow run unic-dlc-build-<slug>`) instead of the no-longer-supported `archon run <path>`
- Cleanup workflow `run-triage` error message now says `archon workflow run failed` (matches the actual command); cleanup command doc references the by-name invocation instead of `archon run`
- `docs/agents/workflow.md` (and the `agent-docs-writer.mjs` generator) now list all seven workflow DAGs — the missing `review` phase has been added alongside the six lifecycle phases. The `review` row's artifact column now covers both PR-comment trackers (github/ado/jira) and the `local-markdown` tracker (which writes `docs/workflow/<slug>/review-comment.md`); the install-agent-docs test anchors on the unique `/unic-dlc-review` command string so the row can't silently regress
- Fixed stale reference in `CONTEXT.md`: Relationships section now credits the **Setup** slash command (not the deleted install hook) for writing config/docs into the target project
- Fixed `repo_layout` default and valid-values columns in `README.md` configuration reference table to use `single-context` (as produced by `detectRepoLayout()`) instead of `single`
- Fixed shell injection in `setup` command Step 5: `{ANSWERS_JSON}` is now substituted directly inside the `<<'EOJS'` heredoc instead of being assigned to a shell variable, so single quotes in e2e commands (e.g. `pnpm test --grep 'smoke'`) no longer break the assignment
- Fixed unreachable `STATE = 'partial'` branch in `setup` command Step 2: config discovery now uses a raw `JSON.parse` instead of the strict `loadConfig`/`isConfigError` path, so partial configs (files missing one or more mandatory fields) are properly detected and users are prompted only for the missing fields
- `runInstall`: optional fields (`e2e_command`, `model_profile`, etc.) from a partial config file (one missing mandatory fields) are no longer silently dropped during merge
- `runInstall`: partial-write error messages now clarify which earlier stages succeeded ("Config written to …" for docs-stage failures; "Config and docs written." for CLAUDE.md-stage failures)
- Wrapped all three `node --input-type=module` heredocs in `setup` command (Steps 1, 2, 5) in try/catch so that import failures (e.g. `ERR_INVALID_URL`, `ERR_MODULE_NOT_FOUND` when `CLAUDE_PLUGIN_ROOT` is unset or wrong) always produce JSON output instead of crashing with no output
- Fixed silent discard of corrupt config in Step 2: an invalid-JSON config file now surfaces an `error` field in the output and stops setup with an actionable message, instead of silently mapping the `SyntaxError` to `STATE = 'fresh'` and overwriting the user's config
- `runInstall`: corrupt config files (invalid JSON) now return a `stage: 'config'` error with an actionable message instead of silently discarding the existing config and overwriting it; file read errors (e.g. `EACCES`) are also surfaced as early returns
- Added missing test for `stage: 'claude-md'` failure branch, test for corrupt-config parse error; removed always-passing placeholder test
- Corrected dogfood banner regenerate hint from `/unic-archon-dlc-setup` to `/unic-archon-dlc:setup` (the actual slash-command name uses a colon, not a dash). Tightened `dogfood-banner.test.mjs` to assert the exact command string. Regenerated `docs/agents/*.md` carry the corrected banner.
- `AGENT_DOC_BANNER` no longer references a non-existent "setup-runner"; it now points to the real entry point `runInstall()` in `lib/install-runner.mjs`. `SKILLS_BLOCK_BANNER` now names the slash command (`/unic-archon-dlc:setup`) explicitly so readers who land inside the marker block via search have unambiguous regenerate instructions. Regenerated `docs/agents/*.md` and the `AGENTS.md` block carry the updated wording; PRD canonical wording updated to match.

## [0.1.0] — 2026-05-15

Initial release of the unic-archon-dlc plugin. Ships the complete AI development lifecycle
as six Archon workflow DAGs with human approval gates at every decision boundary.

### Added

- **Install hook** (`/unic-dlc-install`): auto-detects tracker from git remote, deduces PR
  strategy and branching model, writes `.archon/unic-dlc.config.json`, agent skill docs under
  `docs/agents/`, and idempotent `## Agent skills` block in `CLAUDE.md`.
- **`triage` workflow** (`/unic-dlc-triage`): headless/on-demand; reads current issue states,
  reconciles `docs/workflow/ROADMAP.md`, and produces `HANDOFF.md` with phase, open issues,
  blockers, and recent decisions.
- **`explore` workflow** (`/unic-dlc-explore <slug>`): four parallel research nodes
  (stack/features/architecture/pitfalls) → synthesize → prototype + spike verdicts →
  interactive code-preserve gate → spike ticket creation.
- **`plan` workflow** (`/unic-dlc-plan <slug>`): adversarial spec interview (loop) → PRD
  synthesis → human PRD gate → issue decomposition → Nyquist test-command mapping →
  plan-checker validation loop (max 3 iterations, stall detection) → YAML generator →
  human plan gate.
- **`build` workflow** (`/unic-dlc-build <slug>`): slopcheck package gate → generated
  `build-<slug>.yaml` (red→green TDD per issue, parallel across independent issues) →
  verification (stub detector, coverage) → goals-check coverage matrix → consolidation
  report → human build PR gate.
- **`review` command** (`/unic-dlc-review`): self-contained four-aspect code review (code
  quality, test adequacy, silent failures, type design); posts structured comment via tracker
  adapter; updates prior comment on re-run. No dependency on `pr-review-toolkit`.
- **`qa` workflow** (`/unic-dlc-qa <slug>`): e2e suite → coverage gate → interactive UAT
  gate (acceptance criteria checklist) → PR base verification → merge via tracker CLI with
  branching-strategy-aware branch deletion.
- **`cleanup` workflow** (`/unic-dlc-cleanup <slug>`): architecture review (technical drift,
  intent drift, deepening opportunities) → per-ADR interactive consolidation gate → reuse of
  shared triage workflow.
- **lib modules**: `config-loader`, `setup-explorer`, `labels-config`, `agent-docs-writer`,
  `tracker-adapter`, `handoff-generator`, `findings-writer`, `prd-writer`, `spike-verdicts`,
  `issues-schema` (topological sort), `dag-builder` (YAML generator), `slopcheck`,
  `stub-detector`.
- **86 `node:test` tests** covering all lib modules.
