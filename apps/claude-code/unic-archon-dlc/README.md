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
`/unic-archon-dlc:setup` installs the config, the Methods, and the Archon Box workflow YAMLs this
plugin ships into your project.

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

| Box                     | Container | Gate              | Role                                                                                                                           |
| ----------------------- | --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/setup`                | skill     | HITL              | Conversational config: detects the stack, writes `.archon/unic-dlc.config.yaml` (ADR-0019)                                     |
| `/explore`              | Archon    | `gates.explore`   | Off-line, optional research + AFK spike → `findings.md` (ADR-0029)                                                             |
| `/specs`                | skill     | HITL              | Branch-on-input → `PRD.md` (ADR-0020)                                                                                          |
| `/tickets`              | skill     | HITL              | Slice the PRD into build-ready `issues.json` with a `test_command` each (ADR-0022)                                             |
| `/triage`               | skill     | HITL              | Intake on-ramp: raw work → agent-ready tracker issues, DLC-config labels (ADR-0024)                                            |
| `/build`                | Archon    | `gates.build`     | Anti-cheat red/green loop over `issues.json` (ADR-0012 / ADR-0023)                                                             |
| `/pr-review`            | Archon    | `gates.pr-review` | Fan-out review of the open PR, intent-grounded; posts summary + inline (ADR-0026)                                              |
| `/qa`                   | Archon    | `gates.qa`        | e2e → coverage → UAT → merge; a UAT reject files agent-ready issues (ADR-0025)                                                 |
| `/improve-architecture` | skill     | HITL              | Arch-health + intent-drift + ADR superseding → `arch-review.md` (ADR-0027)                                                     |
| `/cleanup`              | command   | HITL              | Repo-global janitor: prune stale worktrees / branches / PRs / slug dirs, report-first (ADR-0028)                               |
| `/archon-upgrade`       | command   | —                 | Report what a new Archon release means for this Plugin; writes nothing here, probes config keys in a throwaway repo (ADR-0035) |

Archon boxes gate via config (`gates.<box>: hitl | afk`, HITL default); interactive skill boxes are
inherently HITL. `/handoff` and `/prototype` are **referenced** Matt skills, named in prose for a
human to run and deliberately not bundled (see [Dependencies](#dependencies)).

## Archon workflow pipelines

The Archon boxes ship as key-discriminated workflow YAMLs in `.archon/workflows/`
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

**This table is the dependency list.** It is the only place a Method name sits beside the Box that
reads it, and nothing generates it or checks it — so edit it by hand, in the same commit as the Box or
command that changed, and do not restate the list anywhere else. Restating is the failure this table
exists to prevent: `commands/setup.md` once named 7 Methods and this file named 6 while the plugin
composed 11, and the upstream v1.1.0 rename wave then broke `/specs` and `/tickets` with CI green.
A rename wave is now found by running a Box against a live Consumer, not by a test here.

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

`/unic-archon-dlc:setup` **verifies the bundle by reading it** — every Method directory carries its
`SKILL.md` and the companion files that Method reads, and `LICENSE` is present — and stops if either
check fails, because that means the shipped plugin is incomplete. The licence hash and the manifest
closure it used to compare against are gone with the plugin's code (#381); nothing replaces them.

> **Do _not_ run Matt's `setup-matt-pocock-skills`.** Both it and `/unic-archon-dlc:setup` write
> `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` — this repository's **tracker
> contract**, which every Box and command reads. `/unic-archon-dlc:setup` owns them. A run of Matt's
> setup writes another host's template over the first and reverts the second to a five-role `wontfix`
> vocabulary, dropping every mapping. Only Matt's skill _methods_ are a dependency — never his setup.
> See [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md).

---

## Quick start

**Step 1 — Configure**

Open Claude Code in any project and run:

```
/unic-archon-dlc:setup
```

The setup command auto-detects your tracker (GitHub, ADO, Jira, or local-markdown), deduces a
PR strategy, and writes the config, the Methods, and the Box workflow YAMLs into your project (see
[The Box workflow artefacts](#the-box-workflow-artefacts)).

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

The `/unic-archon-dlc:setup` command writes the rich `.archon/unic-dlc.config.yaml` ([ADR-0018](docs/adr/0018-generic-core-config-compose.md), [ADR-0019](docs/adr/0019-conversational-setup.md)). It is the config substrate every box reads, and `/setup` is its sole writer. The file is **tenant-owned**: `/setup` writes it on the first run, and on a later run reports what differs from what it would write and changes nothing — pass `reconfigure` to be offered the change file by file. A present-but-malformed config stops the run rather than being overwritten, and so does a legacy flat `.archon/unic-dlc.config.json`: no migration ships any more, and reading such a file as "no config" would write a second config beside it. Top-level sections:

| Path                                                     | Default                | Valid values                                  | Description                                                                                                                         |
| -------------------------------------------------------- | ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `project.name`                                           | asked                  | any string                                    | Project name                                                                                                                        |
| `project.repo_layout`                                    | auto-detected          | `single-context` · `multi-context`            | Whether `CONTEXT-MAP.md` is present                                                                                                 |
| `project.branching`                                      | asked                  | `gitflow` · `github-flow`                     | Branching model (mandatory)                                                                                                         |
| `docs.type`                                              | `markdown`             | `markdown` · docs system name · `none`        | Where the team's product specs live (drives `/specs` publishing)                                                                    |
| `docs.publish`                                           | `false`                | `true` · `false`                              | Opt-in publishing of the PRD to the docs system                                                                                     |
| `design.type`                                            | `none`                 | design system name · `none`                   | Design system source; boxes test set-versus-`none` and never compare the value to a literal — `design.access.mcp` resolves the tool |
| `templates.prd`                                          | 7-section scaffold     | template string                               | Config-driven PRD template `/specs` fills (ADR-0018); override to change PRD shape                                                  |
| `templates.{issue,bug}`                                  | `null`                 | template string                               | Config-driven artifact templates (ADR-0018)                                                                                         |
| `specs.discuss_mode`                                     | `discuss`              | `discuss` · `assumptions`                     | `/specs` grilling style: `discuss` composes `grilling` + `domain-modeling`; `assumptions` enumerates upfront (ADR-0020)             |
| `specs.gate`                                             | `open-pr`              | `open-pr` · `stage-only`                      | `/specs` PRD gate: `open-pr` commits + opens a PR to `develop` (never merged); `stage-only` stages and stops                        |
| `tickets.gate`                                           | `open-pr`              | `open-pr` · `stage-only`                      | `/tickets` gate: `open-pr` commits `issues.json` + opens a PR to `develop` (never merged); `stage-only` stages and stops (ADR-0022) |
| `triage.out_of_scope_dir`                                | `.out-of-scope`        | dir name                                      | Where `/triage` records rejected enhancements (the out-of-scope KB) (ADR-0024)                                                      |
| `triage.external_prs`                                    | `auto`                 | `auto` · `always` · `never`                   | Whether `/triage` treats external PRs as a request surface; `auto` = ask the tracker whether it carries them at all (ADR-0024)      |
| `gates.{build,qa,pr-review,explore}`                     | `hitl`                 | `hitl` · `afk`                                | Per-Archon-box gate mode (ADR-0017); interactive boxes are HITL                                                                     |
| `build.fresh_context_red_green`                          | `true`                 | `true` · `false`                              | Anti-cheat fresh-context red/green separation (ADR-0012)                                                                            |
| `build.{tdd_mode,nyquist_validation,slopsquatting_gate}` | `true`                 | `true` · `false`                              | Build discipline toggles                                                                                                            |
| `build.e2e_command`                                      | `null`                 | shell command string                          | Full e2e suite command                                                                                                              |
| `build.coverage_threshold`                               | `null`                 | number (0–100) or `null`                      | Minimum % coverage; `null` skips the check                                                                                          |
| `estimations`                                            | `off`                  | `off` · `provisional` · `definitive` · `both` | Estimation waves (ADR-0020)                                                                                                         |
| `cleanup.{stale_days,dry_run,prune_slug_dirs}`           | `7` · `true` · `false` | number · bool · bool                          | `/cleanup` thresholds; report-first, never auto-deletes (ADR-0028)                                                                  |
| `artifacts_dir`                                          | `workflows`            | dir name                                      | Session artifact home base (`<artifacts_dir>/<slug>/`)                                                                              |
| `model_profile`                                          | `balanced`             | `fast` · `balanced` · `max`                   | Model tier for workflow nodes                                                                                                       |

### The tracker contract

**No Box reads a tracker fact from that config.** Every one of them lives in two repo-local prose
files, which `/unic-archon-dlc:setup` writes and every Box and command reads:

| File                           | What it carries                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/agents/issue-tracker.md` | **Access** — which MCP server or skill serves this tracker. **Addressing** — the repository. **Work-item scope** — the one filter every search applies. **Operations** — written only where no server can supply the how. |
| `docs/agents/triage-labels.md` | **Roles** — the seventeen canonical roles. Each row names the role's value, the **axis** that carries it (a state field, a tag, a work-item type, a named field), and whether that axis **holds** one value or many.      |

A Box names a role and a file. It never names an organisation, a field, a provider, a command or a
flag — a server describes its own current interface, and a flag table frozen in a prompt is stale the
day the tool changes. Nothing derives a repository from a remote URL, either: one remote has several
spellings and a fork clone names two repositories.

**A section earns its place in those files only if it states a fact about this tenant.** A server
discovers its own API; it cannot discover that a role means one particular tag on this board.

The canonical roles: states `needs-triage` · `needs-info` · `needs-specs` · `ready-for-agent` ·
`ready-for-human` · `resolved` · `closed` · `rejected`; types `feature` · `bug` · `spike` ·
`tech-debt` · `docs`; priorities `p0` · `p1` · `p2` · `p3`.

A team owns each role's value, its axis and its cardinality. It never owns the role set: a Box names
its roles literally, so **an extra row changes no Box**. A team that wants a Box to behave differently
forks the Method — a transition is procedure, not a parameter.

Two rules the `holds` column drives, both stated inline in every Box that writes a role:

- **A row with no axis writes nothing.** Some tenants have a role no surface should carry; that row
  writes nothing, and a Box reports that its row said so rather than inventing a value.
- **A `state`, `type` or `priority` role is single-valued.** Before a Box writes one it retracts every
  other role of that tier whose axis holds many values; a single-value axis retracts itself. So merging
  a pull request writes `resolved` **and** clears `ready-for-agent`, whichever surfaces this tenant puts
  them on.

A shape that satisfies the contract:

```md
| Role              | Axis           | Holds | Value                    |
| ----------------- | -------------- | ----- | ------------------------ |
| `needs-specs`     | tag            | many  | `Specification`          |
| `ready-for-agent` | tag            | many  | `readyForImplementation` |
| `resolved`        | state field    | one   | `Resolved`               |
| `feature`         | work-item type | one   | `User Story`             |
| `needs-triage`    | —              | —     | Not written.             |
```

See [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md), amended 2026-08-18.

### The Method bundle

The Methods the boxes compose ship inside this plugin, at `vendor/mattpocock-skills/` — the upstream
`mattpocock/skills` files at a pinned tag, recorded in `vendor/mattpocock-skills/README.md`, which names
the repository, the tag and the commit. `/setup` Step 6 installs them into the consumer's
`.archon/methods/`, overwriting that directory on every upgrade.

**Bundle integrity is not a config key.** `/setup` Step 6 verifies it by reading: every Method
directory carries its `SKILL.md` and the companion files that Method reads, and `LICENSE` is present.
Either failure stops setup, because both mean the shipped plugin is incomplete or altered — nothing a
consumer can configure around. This replaced the old `skills.matt_suite` discovery key.

**A Method resolves from one path**: `.archon/methods/<name>/SKILL.md`. Every Box and every command
reads it there and nowhere else, so there is no resolution order to report and no tier line to print.
The two override tiers this plugin used to offer — `methods.<name>.source` in config, and
`.archon/methods.local/<name>/SKILL.md` — are retired: to change a Method, edit the installed file and
expect the next `/setup` run to overwrite it. See
[ADR-0031](docs/adr/0031-methods-bundled-three-tier-resolution.md), amended.

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

### The Box workflow artefacts

See [ADR-0036](docs/adr/0036-setup-owns-a-named-install-set.md) for the full design. `/setup` Step 6
also installs every `unic-dlc-*.yaml` this plugin ships into your project's
`.archon/workflows/`, discovered by reading the plugin's own copy at install time — the set is
whatever this plugin currently ships, never a fixed count. Each installed file is **generated and
committed**: it opens with a header naming the plugin and its version and stating that `/setup`
replaces the file on every run, so a local edit is lost on the next run. Because it is committed,
an edit shows up as a tracked `git diff` after `/setup` — that diff is the review surface and the
recovery path, not a warning dialog.

Install is **name-scoped, not directory-scoped**: `.archon/workflows/` is shared with your own
workflows, so only files matching the `unic-dlc-*` naming are ever written, overwritten, or swept as
stale. A Box retired from a later plugin version is deleted on the next `/setup` run **regardless of
whether it carries the generated header** — a file outside the `unic-dlc-*` naming is never touched,
whatever it contains.

**Wanting a variant of a bundled Box is the one supported escape hatch: copy it to a name outside
the `unic-dlc-*` set.** Name-scoped install never reaches a name outside that pattern, so your copy
survives every future `/setup` run untouched — there is no per-Box opt-out config key.

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

- **Archon**: version ≥ 0.7.0 required — the key-discriminated node schema plus `evidence_policy`/`always_run` is the stable contract, not the release number ([ADR-0011](docs/adr/0011-archon-schema-target.md), [ADR-0033](docs/adr/0033-archon-070-schema-target.md))
- **Required peer plugins**: none
- **Optional tool**: Python `slopcheck` CLI (GSD's slopsquatting gate) — if on `PATH`, the
  slopcheck node defers to it; otherwise falls back to npm registry HEAD checks
- **Tracker CLIs** (install the one matching your config):
  - GitHub: `gh` (GitHub CLI)
  - Azure DevOps: `az` (Azure CLI with `azure-devops` extension)
  - Jira: `jira` (go-jira or Atlassian CLI)
  - local-markdown: no CLI needed
