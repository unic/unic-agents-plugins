# unic-archon-dlc

A config-driven AI development lifecycle, installable as a Claude Code plugin. It owns a **thin
process layer** — the box set below — and **composes the team's system-skills** (tracker, docs,
design) for the _how_, so nothing about ADO / Jira / GitHub / Confluence / Figma is baked in.

Each box's **container follows its structural need**
([ADR-0017](docs/adr/0017-container-follows-structural-need.md)): **Archon workflows** for the
AFK-isolated legs (`/build`, `/qa`, `/pr-review`, `/explore`) and **Claude Code commands/skills**
for the interactive or repo-global boxes (`/setup`, `/specs`, `/tickets`, `/triage`,
`/improve-architecture`, `/cleanup`) — the latter **compose Matt Pocock's skill _methods_** rather
than reimplementing them. See [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)–[ADR-0018](docs/adr/0018-generic-core-config-compose.md)
for the two-axis architecture and [CONTEXT.md](CONTEXT.md) for the vocabulary.

Archon has no marketplace; this plugin rides the Claude Code plugin marketplace.
`/unic-archon-dlc:setup` installs the four Archon workflow YAMLs + command stubs and writes the
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
OFF-LINE    /setup · /explore · /improve-architecture · /cleanup   (+ /handoff, /prototype — Matt's, referenced)
```

| Box                     | Container | Gate              | Role                                                                                             |
| ----------------------- | --------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `/setup`                | skill     | HITL              | Conversational config: detects the stack, writes `.archon/unic-dlc.config.yaml` (ADR-0019)       |
| `/explore`              | Archon    | `gates.explore`   | Off-line, optional research + AFK spike → `findings.md` (ADR-0029)                               |
| `/specs`                | skill     | HITL              | Branch-on-input → `PRD.md` (ADR-0020)                                                            |
| `/tickets`              | skill     | HITL              | Slice the PRD into build-ready `issues.json` with a `test_command` each (ADR-0022)               |
| `/triage`               | skill     | HITL              | Intake on-ramp: raw work → agent-ready tracker issues, DLC-config labels (ADR-0024)              |
| `/build`                | Archon    | `gates.build`     | Anti-cheat red/green/refactor loop over `issues.json` (ADR-0012 / ADR-0023)                      |
| `/pr-review`            | Archon    | `gates.pr-review` | Fan-out review of the open PR, intent-grounded; posts summary + inline (ADR-0026)                |
| `/qa`                   | Archon    | `gates.qa`        | e2e → coverage → UAT → merge; a UAT reject files agent-ready issues (ADR-0025)                   |
| `/improve-architecture` | skill     | HITL              | Arch-health + intent-drift + ADR superseding → `arch-review.md` (ADR-0027)                       |
| `/cleanup`              | command   | HITL              | Repo-global janitor: prune stale worktrees / branches / PRs / slug dirs, report-first (ADR-0028) |

Archon boxes gate via config (`gates.<box>: hitl | afk`, HITL default); interactive skill boxes are
inherently HITL. `/handoff` and `/prototype` are **referenced** Matt skills, not shipped —
`/setup` verifies the suite is present (see [Dependencies](#dependencies)).

## Archon workflow pipelines

The four Archon boxes ship as key-discriminated workflow YAMLs in `.archon/workflows/`
([ADR-0011](docs/adr/0011-archon-schema-target.md)):

| Workflow             | Node pipeline                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unic-dlc-build`     | `bootstrap → guard-not-ready → slopcheck → run-build → verification → goals-check → report → open-pr → build-pr-gate ✓`                                                                     |
| `unic-dlc-pr-review` | `bootstrap → guard-not-ready → prep → {code-quality · tests · silent-failure · type-design · comment-rot · simplifier · intent-check} → synthesize → reconcile → review-gate ✓ → post`      |
| `unic-dlc-qa`        | `bootstrap → guard-not-ready → e2e → coverage-gate → uat-prep → uat-gate ✓ → verify-pr-base → merge-gate ✓ → merge`                                                                         |
| `unic-dlc-explore`   | `bootstrap → guard-not-ready → {research-stack · research-features · research-architecture · research-pitfalls} → synthesize → spike → spike-ticket → spike-branch-gate ✓ → preserve-spike` |

> **✓** = config-gated `approval:` node — it pauses for a human when the box's gate is `hitl` and
> auto-proceeds when `afk` (ADR-0017). Parallel nodes are shown in `{…}`.

---

## Dependencies

Beyond the Archon workflow engine (see [Configuration reference](#configuration-reference)), the interactive boxes (`/specs`,
`/tickets`, `/triage`, …) **compose [Matt Pocock's engineering skill _methods_](https://github.com/mattpocock/skills)**
as a declared dependency — they don't reimplement them. Install the skill suite so the following are
available to Claude Code (typically under `.agents/skills/`):

| Skill method      | Composed by         |
| ----------------- | ------------------- |
| `grill-with-docs` | `/specs`            |
| `to-prd`          | `/specs`            |
| `to-issues`       | `/tickets`          |
| `triage`          | `/triage`           |
| `grilling`        | `/specs`, `/triage` |
| `domain-modeling` | `/specs`, `/triage` |

`/unic-archon-dlc:setup` **verifies the suite is present** and warns (non-blocking) if any method is
missing — quality degrades but the boxes still run.

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
PR strategy, and writes the config and agent docs into your project.

**Step 2 — Explore** _(optional)_

Kick off research on any new problem space:

```
/unic-dlc-explore my-feature
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

| Path                                                     | Default                | Valid values                                  | Description                                                                                                                         |
| -------------------------------------------------------- | ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `project.name`                                           | asked                  | any string                                    | Project name                                                                                                                        |
| `project.repo_layout`                                    | auto-detected          | `single-context` · `multi-context`            | Whether `CONTEXT-MAP.md` is present                                                                                                 |
| `project.branching`                                      | asked                  | `gitflow` · `github-flow`                     | Branching model (mandatory)                                                                                                         |
| `project.pr_strategy`                                    | asked                  | `squash` · `merge` · `rebase`                 | PR merge strategy (mandatory)                                                                                                       |
| `tracker.type`                                           | auto-detected          | `github` · `ado` · `jira` · `local-markdown`  | Issue tracker backend (mandatory)                                                                                                   |
| `tracker.access`                                         | discovered             | `{ mcp, cli }`                                | Capability→tool for the tracker (MCP-first, CLI-fallback)                                                                           |
| `tracker.coords`                                         | asked                  | tracker-specific map                          | e.g. `{ owner, repo }` (github) / `{ org, project, repo }` (ado)                                                                    |
| `docs.type`                                              | `markdown`             | `confluence` · `markdown` · `none`            | Where the team's product specs live (drives `/specs` publishing)                                                                    |
| `docs.publish`                                           | `false`                | `true` · `false`                              | Opt-in publishing of the PRD to the docs system                                                                                     |
| `design.type`                                            | `none`                 | `figma` · `none`                              | Design system source                                                                                                                |
| `templates.prd`                                          | 7-section scaffold     | template string                               | Config-driven PRD template `/specs` fills (ADR-0018); override to change PRD shape                                                  |
| `templates.{issue,bug}`                                  | `null`                 | template string                               | Config-driven artifact templates (ADR-0018)                                                                                         |
| `classification.labels.*`                                | canonical              | any string                                    | 3-tier label mapping (state · type · priority)                                                                                      |
| `specs.discuss_mode`                                     | `discuss`              | `discuss` · `assumptions`                     | `/specs` grilling style: `discuss` composes `/grill-with-docs`; `assumptions` enumerates upfront (ADR-0020)                         |
| `specs.gate`                                             | `open-pr`              | `open-pr` · `stage-only`                      | `/specs` PRD gate: `open-pr` commits + opens a PR to `develop` (never merged); `stage-only` stages and stops                        |
| `tickets.gate`                                           | `open-pr`              | `open-pr` · `stage-only`                      | `/tickets` gate: `open-pr` commits `issues.json` + opens a PR to `develop` (never merged); `stage-only` stages and stops (ADR-0022) |
| `triage.out_of_scope_dir`                                | `.out-of-scope`        | dir name                                      | Where `/triage` records rejected enhancements (the out-of-scope KB) (ADR-0024)                                                      |
| `triage.external_prs`                                    | `auto`                 | `auto` · `always` · `never`                   | Whether `/triage` treats external PRs as a request surface; `auto` = infer from `tracker.type` (github→yes) (ADR-0024)              |
| `gates.{build,qa,pr-review,explore}`                     | `hitl`                 | `hitl` · `afk`                                | Per-Archon-box gate mode (ADR-0017); interactive boxes are HITL                                                                     |
| `build.fresh_context_red_green`                          | `true`                 | `true` · `false`                              | Anti-cheat fresh-context red/green separation (ADR-0012)                                                                            |
| `build.{tdd_mode,nyquist_validation,slopsquatting_gate}` | `true`                 | `true` · `false`                              | Build discipline toggles                                                                                                            |
| `build.e2e_command`                                      | `null`                 | shell command string                          | Full e2e suite command                                                                                                              |
| `build.coverage_threshold`                               | `null`                 | number (0–100) or `null`                      | Minimum % coverage; `null` skips the check                                                                                          |
| `estimations`                                            | `off`                  | `off` · `provisional` · `definitive` · `both` | Estimation waves (ADR-0020)                                                                                                         |
| `cleanup.{stale_days,dry_run,prune_slug_dirs}`           | `7` · `true` · `false` | number · bool · bool                          | `/cleanup` thresholds; report-first, never auto-deletes (ADR-0028)                                                                  |
| `artifacts_dir`                                          | `workflows`            | dir name                                      | Session artifact home base (`<artifacts_dir>/<slug>/`)                                                                              |
| `model_profile`                                          | `balanced`             | `fast` · `balanced` · `max`                   | Model tier for workflow nodes                                                                                                       |
| `skills.matt_suite`                                      | discovered             | `{ present, missing }`                        | Verify-only discovery result for Matt Pocock's declared skill suite                                                                 |

Label canonical names: states `needs-triage` · `needs-info` · `needs-specs` · `ready-for-agent` ·
`ready-for-human` · `resolved` · `closed` · `rejected`; types `feature` · `bug` · `spike` ·
`tech-debt` · `docs`; priorities `p0` · `p1` · `p2` · `p3`.

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
    ├── build-state.json # /build   — per-slice red/green/refactor progress
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

- **Archon**: version ≥ 0.5.0 required — the key-discriminated node schema is the stable contract, not the release number ([ADR-0011](docs/adr/0011-archon-schema-target.md))
- **Required peer plugins**: none
- **Optional tool**: Python `slopcheck` CLI (GSD's slopsquatting gate) — if on `PATH`, the
  slopcheck node defers to it; otherwise falls back to npm registry HEAD checks
- **Tracker CLIs** (install the one matching your config):
  - GitHub: `gh` (GitHub CLI)
  - Azure DevOps: `az` (Azure CLI with `azure-devops` extension)
  - Jira: `jira` (go-jira or Atlassian CLI)
  - local-markdown: no CLI needed
