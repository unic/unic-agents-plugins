# unic-archon-dlc

A config-driven AI development lifecycle, installable as a Claude Code plugin. It is a **Harness** —
it owns the box set below, plus isolation, gates, config and integrity — and **composes the team's
system-skills** (tracker, docs, design) for the _how_, so nothing about ADO / Jira / GitHub /
Confluence / Figma is baked in. Procedure belongs to the **Methods** it hosts
([ADR-0030](docs/adr/0030-harness-hosts-methods.md)).

Each box's **container follows its structural need**
([ADR-0017](docs/adr/0017-container-follows-structural-need.md)): **Archon workflows** for the
AFK-isolated legs (`/build`, `/qa`, `/pr-review`, `/explore`) and **Claude Code commands/skills**
for the interactive or repo-global boxes (`/setup`, `/specs`, `/tickets`, `/triage`,
`/improve-architecture`, `/cleanup`, `/archon-upgrade`) — the latter **read Matt Pocock's skill text as Methods** rather
than reimplementing them. See [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)–[ADR-0018](docs/adr/0018-generic-core-config-compose.md)
for the two-axis architecture, [ADR-0030](docs/adr/0030-harness-hosts-methods.md)–[ADR-0032](docs/adr/0032-box-method-vocabulary.md)
for the Harness/Method division, and [CONTEXT.md](CONTEXT.md) for the vocabulary.

Archon has no marketplace; this plugin rides the Claude Code plugin marketplace.
`/unic-archon-dlc:setup` installs the Archon workflow YAMLs the plugin ships and writes the
per-project config the interactive boxes read.

> **Vision diagram:** [`docs/20260703-Unic-dlc.mmd`](docs/20260703-Unic-dlc.mmd) (Mermaid; an
> Excalidraw twin sits alongside). Dated `yyyymmdd-` snapshots are kept — the newest date is
> canonical.

---

## The box set

```
MAIN LINE   /specs ──▶ /tickets ──▶ /build ──▶ /pr-review ──▶ /qa
                          ▲
ON-RAMPS    /triage ──────┤   raw bugs · requests · /qa findings · humans → agent-ready issues
            humans ───────┘
OFF-LINE    /setup · /explore · /improve-architecture · /cleanup · /archon-upgrade   (+ /handoff, /prototype — Matt's, referenced)
```

| Box                     | Container | Gate              | Role                                                                                             |
| ----------------------- | --------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `/setup`                | skill     | HITL              | Conversational config: detects the stack, writes `.archon/unic-dlc.config.yaml` (ADR-0019)       |
| `/explore`              | Archon    | `gates.explore`   | Off-line, optional research + AFK spike → `findings.md` (ADR-0029)                               |
| `/specs`                | skill     | HITL              | Branch-on-input → `PRD.md` (ADR-0020)                                                            |
| `/tickets`              | skill     | HITL              | Slice the PRD into build-ready `issues.json` with a `test_command` each (ADR-0022)               |
| `/triage`               | skill     | HITL              | Intake on-ramp: raw work → agent-ready tracker issues, DLC-config labels (ADR-0024)              |
| `/build`                | Archon    | `gates.build`     | Anti-cheat red/green loop over `issues.json` (ADR-0012 / ADR-0023)                               |
| `/pr-review`            | Archon    | `gates.pr-review` | Fan-out review of the open PR, intent-grounded; posts summary + inline (ADR-0026)                |
| `/qa`                   | Archon    | `gates.qa`        | e2e → coverage → UAT → merge; a UAT reject files agent-ready issues (ADR-0025)                   |
| `/improve-architecture` | skill     | HITL              | Arch-health + intent-drift + ADR superseding → `arch-review.md` (ADR-0027)                       |
| `/cleanup`              | command   | HITL              | Repo-global janitor: prune stale worktrees / branches / PRs / slug dirs, report-first (ADR-0028) |
| `/archon-upgrade`       | command   | —                 | Report what a new Archon release means for this Plugin; read-only, writes nothing (ADR-0035)     |

Archon boxes gate via config (`gates.<box>: hitl | afk`, HITL default); interactive skill boxes are
inherently HITL. `/handoff` and `/prototype` are **referenced** Matt skills, named in prose for a
human to run and deliberately not bundled (see [Dependencies](#dependencies)).

## Archon workflow pipelines

The four Archon boxes ship as key-discriminated workflow YAMLs in `.archon/workflows/`
([ADR-0011](docs/adr/0011-archon-schema-target.md)):

| Workflow             | Node pipeline                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unic-dlc-build`     | `bootstrap → guard-not-ready → slopcheck → run-build → implement-review-precheck → verification → goals-check → evidence → report → open-pr → build-pr-gate ✓`                              |
| `unic-dlc-pr-review` | `bootstrap → guard-not-ready → prep → review → synthesize → reconcile → review-gate ✓ → post`                                                                                               |
| `unic-dlc-qa`        | `bootstrap → guard-not-ready → e2e → coverage-gate → uat-prep → uat-gate ✓ → verify-pr-base → merge-gate ✓ → merge`                                                                         |
| `unic-dlc-explore`   | `bootstrap → guard-not-ready → {research-stack · research-features · research-architecture · research-pitfalls} → synthesize → spike → spike-ticket → spike-branch-gate ✓ → preserve-spike` |

> **✓** = config-gated `approval:` node — it pauses for a human when the box's gate is `hitl` and
> auto-proceeds when `afk` (ADR-0017). Parallel nodes are shown in `{…}`.
>
> `/pr-review`'s `review` and `/build`'s `implement-review-precheck` each run the `code-review` Method's
> own two parallel sub-agents (Standards · Spec) **inside one node**, so their parallelism does not appear
> in the DAG (ADR-0026 §8).
>
> `evidence` writes `$ARTIFACTS_DIR/evidence.json` only when `verification` and `goals-check` both report
> `passed: true` — the workflow-level `evidence_policy: { required: true }` fails the run closed otherwise
> (ADR-0034).

---

## Dependencies

Beyond the Archon workflow engine (see [Configuration reference](#configuration-reference)), the boxes read
[Matt Pocock's engineering skill text](https://github.com/mattpocock/skills) as **Methods** — they don't
reimplement it. The Methods ship inside this plugin and `/unic-archon-dlc:setup` installs them, so there
is nothing to install separately (see [The Method bundle](#the-method-bundle)).

**This table is the single dependency list, and `providedTo` in
[`lib/methods-manifest.mjs`](lib/methods-manifest.mjs) is its source of truth.** A test in
`test/methods-manifest.test.mjs` parses the table and fails if the two disagree, so edit the manifest
first and bring the table into line with it — and do not restate the list anywhere else. Before the
manifest existed, `commands/setup.md` named 7 Methods and this file named 6, while the plugin composed
11; the upstream v1.1.0 rename wave then broke `/specs` and `/tickets` with CI green.

<!-- methods-table:begin -->

| Method                          | Read by                                      |
| ------------------------------- | -------------------------------------------- |
| `to-spec`                       | `/specs`                                     |
| `to-tickets`                    | `/tickets`                                   |
| `triage`                        | `/triage`                                    |
| `code-review`                   | `/pr-review`, `/build`                       |
| `improve-codebase-architecture` | `/improve-architecture`                      |
| `implement`                     | `/build`                                     |
| `tdd`                           | `/build`                                     |
| `research`                      | `/explore`                                   |
| `grilling`                      | `/specs`, `/triage`, `/improve-architecture` |
| `domain-modeling`               | `/specs`, `/triage`, `/improve-architecture` |
| `codebase-design`               | `/improve-architecture`                      |

<!-- methods-table:end -->

`/unic-archon-dlc:setup` **verifies the bundle's integrity** — the vendored licence hash and the
manifest closure — and stops if either fails, because that means the shipped plugin is incomplete.

> **Do _not_ run Matt's `setup-matt-pocock-skills`.** That skill writes its own tracker/label config
> (`docs/agents/triage-labels.md`, `docs/agents/issue-tracker.md`). The DLC deliberately does not use
> it: `/unic-archon-dlc:setup` is the **single** config source, and each box injects that config into
> Matt's methods at invocation. Running both setups would create a second label file that can drift
> from `.archon/unic-dlc.config.yaml` (what `/tickets` and `/build` read). Only Matt's skill
> _methods_ are a dependency — never his setup. See [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md).

---

## Quick start

**Step 1 — Configure**

Open Claude Code in any project and run:

```
/unic-archon-dlc:setup
```

The setup command auto-detects your tracker (GitHub, ADO, Jira, or local-markdown), deduces a
PR strategy, and writes the config, installs the Methods, and installs the Box workflow YAMLs
into your project.

**Step 2 — Explore** _(optional)_

Kick off research on any new problem space:

```
archon workflow run unic-dlc-explore "my-feature"
```

**Step 3 — Triage**

Turn raw incoming work (a bug report, feature request, QA finding, or external PR) into an
agent-ready issue on your tracker — the intake on-ramp into the backlog:

```
/unic-archon-dlc:triage 42
/unic-archon-dlc:triage "what needs my attention"
```

`/triage` is a thin wrapper over Matt Pocock's `triage` method, bound to your DLC config as the
single source of truth for labels (see [Dependencies](#dependencies)). A `ready-for-agent` issue
flows into `/tickets` next.

---

## Configuration reference

The `/unic-archon-dlc:setup` command writes the rich `.archon/unic-dlc.config.yaml` ([ADR-0018](docs/adr/0018-generic-core-config-compose.md), [ADR-0019](docs/adr/0019-conversational-setup.md)). It is the config substrate every box reads; setup is its sole writer, is idempotent (a re-run merges, never clobbers — a present-but-malformed config fails fast rather than being overwritten), and reads any legacy `.archon/unic-dlc.config.json` to migrate it (the old file is left in place). Top-level sections:

| Path                                                     | Default                | Valid values                                  | Description                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ---------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.name`                                           | asked                  | any string                                    | Project name                                                                                                                                                                                                                                        |
| `project.repo_layout`                                    | auto-detected          | `single-context` · `multi-context`            | Whether `CONTEXT-MAP.md` is present                                                                                                                                                                                                                 |
| `project.branching`                                      | asked                  | `gitflow` · `github-flow`                     | Branching model (mandatory)                                                                                                                                                                                                                         |
| `project.pr_strategy`                                    | asked                  | `squash` · `merge` · `rebase`                 | PR merge strategy (mandatory)                                                                                                                                                                                                                       |
| `project.repo_ref`                                       | absent                 | any repository reference                      | **Optional override.** Every box derives the target repository from the worktree's `origin` remote; set this only when `origin` is not the repository to act on (a fork checkout), which is also the one case a box cancels for an ambiguous target |
| `tracker.type`                                           | auto-detected          | `github` · `ado` · `jira` · `local-markdown`  | Issue tracker backend (mandatory)                                                                                                                                                                                                                   |
| `tracker.access`                                         | discovered             | `{ mcp, cli }`                                | Capability→tool for the tracker (MCP-first, CLI-fallback)                                                                                                                                                                                           |
| `tracker.coords`                                         | asked                  | tracker-specific map                          | e.g. `{ owner, repo }` (github) / `{ org, project, repo }` (ado)                                                                                                                                                                                    |
| `docs.type`                                              | `markdown`             | `confluence` · `markdown` · `none`            | Where the team's product specs live (drives `/specs` publishing)                                                                                                                                                                                    |
| `docs.publish`                                           | `false`                | `true` · `false`                              | Opt-in publishing of the PRD to the docs system                                                                                                                                                                                                     |
| `design.type`                                            | `none`                 | `figma` · `none`                              | Design system source                                                                                                                                                                                                                                |
| `templates.prd`                                          | 7-section scaffold     | template string                               | Config-driven PRD template `/specs` fills (ADR-0018); override to change PRD shape                                                                                                                                                                  |
| `templates.{issue,bug}`                                  | `null`                 | template string                               | Config-driven artifact templates (ADR-0018)                                                                                                                                                                                                         |
| `classification.labels.*`                                | canonical              | any string                                    | 3-tier label mapping (state · type · priority)                                                                                                                                                                                                      |
| `specs.discuss_mode`                                     | `discuss`              | `discuss` · `assumptions`                     | `/specs` grilling style: `discuss` composes `grilling` + `domain-modeling`; `assumptions` enumerates upfront (ADR-0020)                                                                                                                             |
| `specs.gate`                                             | `open-pr`              | `open-pr` · `stage-only`                      | `/specs` PRD gate: `open-pr` commits + opens a PR to `develop` (never merged); `stage-only` stages and stops                                                                                                                                        |
| `tickets.gate`                                           | `open-pr`              | `open-pr` · `stage-only`                      | `/tickets` gate: `open-pr` commits `issues.json` + opens a PR to `develop` (never merged); `stage-only` stages and stops (ADR-0022)                                                                                                                 |
| `triage.out_of_scope_dir`                                | `.out-of-scope`        | dir name                                      | Where `/triage` records rejected enhancements (the out-of-scope KB) (ADR-0024)                                                                                                                                                                      |
| `triage.external_prs`                                    | `auto`                 | `auto` · `always` · `never`                   | Whether `/triage` treats external PRs as a request surface; `auto` = infer from `tracker.type` (github→yes) (ADR-0024)                                                                                                                              |
| `gates.{build,qa,pr-review,explore}`                     | `hitl`                 | `hitl` · `afk`                                | Per-Archon-box gate mode (ADR-0017); interactive boxes are HITL                                                                                                                                                                                     |
| `build.fresh_context_red_green`                          | `true`                 | `true` · `false`                              | Anti-cheat fresh-context red/green separation (ADR-0012)                                                                                                                                                                                            |
| `build.{tdd_mode,nyquist_validation,slopsquatting_gate}` | `true`                 | `true` · `false`                              | Build discipline toggles                                                                                                                                                                                                                            |
| `build.e2e_command`                                      | `null`                 | shell command string                          | Full e2e suite command                                                                                                                                                                                                                              |
| `build.coverage_threshold`                               | `null`                 | number (0–100) or `null`                      | Minimum % coverage; `null` skips the check                                                                                                                                                                                                          |
| `estimations`                                            | `off`                  | `off` · `provisional` · `definitive` · `both` | Estimation waves (ADR-0020)                                                                                                                                                                                                                         |
| `cleanup.{stale_days,dry_run,prune_slug_dirs}`           | `7` · `true` · `false` | number · bool · bool                          | `/cleanup` thresholds; report-first, never auto-deletes (ADR-0028)                                                                                                                                                                                  |
| `artifacts_dir`                                          | `workflows`            | dir name                                      | Session artifact home base (`<artifacts_dir>/<slug>/`)                                                                                                                                                                                              |
| `model_profile`                                          | `balanced`             | `fast` · `balanced` · `max`                   | Model tier for workflow nodes                                                                                                                                                                                                                       |
| `methods.<name>.source`                                  | unset                  | repo-relative path                            | Team fork of a Method; the top tier of Method resolution, above `.archon/methods.local/` and the Bundle                                                                                                                                             |

Label canonical names: states `needs-triage` · `needs-info` · `needs-specs` · `ready-for-agent` ·
`ready-for-human` · `resolved` · `closed` · `rejected`; types `feature` · `bug` · `spike` ·
`tech-debt` · `docs`; priorities `p0` · `p1` · `p2` · `p3`.

### The Method bundle

The Methods the boxes compose ship inside this plugin, at `vendor/mattpocock-skills/` — the upstream
`mattpocock/skills` files at a pinned tag, recorded as `METHODS_BUNDLE` in
[`lib/methods-manifest.mjs`](lib/methods-manifest.mjs). `/setup` Step 6 installs them into the
consumer's `.archon/methods/`, overwriting that directory on every upgrade and never touching
`.archon/methods.local/`.

**Bundle integrity is not a config key.** It is verified on every `/setup` run by
[`lib/methods-bundle.mjs`](lib/methods-bundle.mjs): `verifyLicence` hashes the vendored `LICENSE`
against the pinned tag's, and `verifyBundle` checks the manifest closure against the files on disk.
Either failure stops setup, because both mean the shipped plugin is incomplete or altered — nothing a
consumer can configure around. This replaced the old `skills.matt_suite` discovery key, which
`mergeConfig` now strips from any config that still carries it.

A Method resolves from the first of three tiers that answers
([`lib/methods-resolver.mjs`](lib/methods-resolver.mjs)): `methods.<name>.source` in config, then
`.archon/methods.local/<name>/SKILL.md`, then the installed bundle. A Local override should record
the bundle tag it forked from in its own frontmatter (`forked_from: v1.1.0`); `/setup` flags any
override whose value differs from the bundled tag, or is absent.

**Methods are read by path and never registered as skills.** `/setup` writes them to
`.archon/methods/`, not to `.claude/skills/` or `.agents/skills/`, and no box invokes one as a skill.
If it did, a consumer who also runs Matt Pocock's own Claude Code plugin would end up with **every
skill twice**, with no way to tell which copy answered — and skill invocation is a churning coupling
surface besides (7 of the 10 Methods carried `disable-model-invocation: true` at v1.0; `prototype`
flipped back at v1.1). Reading a file has neither problem. See
[ADR-0031](docs/adr/0031-methods-bundled-three-tier-resolution.md) §4.

The plugin version **is** the Method pin — there is no `skills.pin` key. Upgrading Methods means
upgrading the plugin and re-running `/setup`, which is idempotent and installs the new bundle even for
an already-configured project.

### The Box artefacts

The Archon workflow YAMLs ship inside this plugin's own `.archon/workflows/`, and `/setup` installs
whatever it finds there into the Consumer's `.archon/workflows/` — discovered by reading that directory
at install time, never a fixed list, because the box set is in flux. Every installed file is
**committed** and carries a **generated header** naming the plugin and its version; re-running `/setup`
**replaces** it and any hand edit is lost. Installation is **name-scoped**, not directory-scoped: unlike
`.archon/methods/`, `.archon/workflows/` also holds a Consumer's own workflows, so `/setup` deletes only
the files it generated on a previous run that the current version no longer ships, and never touches a
Consumer's own file at any other name ([ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md)).

A team wanting a variant Box copies the YAML to a name outside the `unic-dlc-*` naming, where `/setup`'s
name-scoped replacement never reaches.

---

## Session artifacts

Each Session is keyed by a **Slug** and writes its artifacts under `<artifacts_dir>/<slug>/`
(`artifacts_dir` defaults to `workflows/`; [ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)):

```
workflows/
└── <slug>/
    ├── findings.md      # /explore — research + Integrated Brief (the /specs baton)
    ├── PRD.md           # /specs   — product requirements
    ├── issues.json      # /tickets — build-ready vertical slices + test commands
    ├── build-state.json # /build   — per-slice red/green progress
    ├── evidence.json    # /build   — evidence set; present only when the build gate passed
    ├── report.md        # /build   — build outcomes
    └── arch-review.md   # /improve-architecture — drift analysis
```

The **issue tracker is the single source of truth** for "where are we"
([ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md)) — there is **no `ROADMAP.md` or
`HANDOFF.md`**, and no workflow writes durable repo-state snapshots. Per-thread continuity is the
`/handoff` skill's job (a throwaway compaction file, not a durable snapshot). `/cleanup` prunes a
stale `<slug>/` dir only once its PR/branch is merged or closed (report-first, never auto-deletes).

---

## Dependency map

- **Archon**: version ≥ 0.7.0 required, in a project with at least one git remote configured — the key-discriminated node schema plus `evidence_policy`/`always_run` is the stable contract, not the release number ([ADR-0011](docs/adr/0011-archon-schema-target.md), [ADR-0033](docs/adr/0033-archon-070-schema-target.md)); every Archon Box derives its target repository from the worktree's `origin` remote, so a remote-less checkout cannot run one
- **Required peer plugins**: none
- **Optional tool**: Python `slopcheck` CLI (GSD's slopsquatting gate) — if on `PATH`, the
  slopcheck node defers to it; otherwise falls back to npm registry HEAD checks
- **Tracker CLIs** (install the one matching your config):
  - GitHub: `gh` (GitHub CLI)
  - Azure DevOps: `az` (Azure CLI with `azure-devops` extension)
  - Jira: `jira` (go-jira or Atlassian CLI)
  - local-markdown: no CLI needed
