---
description: Run the unic-archon-dlc explore workflow — parallel research + one AFK spike, synthesised into <artifacts_dir>/<slug>/findings.md (the /specs baton), with an optional spike-branch gate and a spike ticket.
---

# /unic-dlc-explore

Runs the `explore` box: four parallel research agents investigate the project (stack, features,
architecture, pitfalls), a **synthesize** node writes `<artifacts_dir>/<slug>/findings.md`, one **AFK
spike** records VALIDATED/INVALIDATED/PARTIAL verdicts, a **spike ticket** is filed on the configured
tracker, and — after a config-gated human confirm — the spike code can be preserved on a branch.

`/explore` is **off the main line** and **never required** (PLAN decision #3/#8): it is an optional
precursor to `/specs`. Its `findings.md` may seed `/specs`, but a feature can go straight to `/specs`
without it. Ported to the key-discriminated Archon node schema
([ADR-0011](../adr/0011-archon-schema-target.md)); self-contained prompt nodes with no
plugin-`lib/` import ([ADR-0023](../adr/0023-build-generic-red-green-refactor-loop.md) §5);
artefacts at `<artifacts_dir>/<slug>/` ([ADR-0015](../adr/0015-workflows-slug-artifact-home.md)).
Design in [ADR-0029](../adr/0029-explore-research-spike-onramp.md).

## Usage

```
/unic-dlc-explore <slug>
```

`<slug>` is a short kebab-case identifier for this exploration (e.g. `auth-refactor`, `v2-planning`).
It scopes the artefacts (`<artifacts_dir>/<slug>/findings.md`) and any preserved spike branch
(`spike/<slug>`). There is **no PRD precondition** — `/explore` _writes_ findings.md, it does not consume
a prior baton.

## What this workflow does

1. **bootstrap** — parse the slug from `$ARGUMENTS` and read `.archon/unic-dlc.config.yaml`
   (`artifacts_dir`, `gates.explore`, `project.branching`). It resolves **no** repository:
   `docs/agents/issue-tracker.md` § Addressing names it, and `spike-ticket` reads that file itself. A
   missing slug or config cancels cleanly.

2. **4 research nodes** (parallel, fresh, read-only) — stack · features · architecture · pitfalls. Each
   emits a concise findings body.

3. **synthesize** — writes `<artifacts_dir>/<slug>/findings.md`. Its **Integrated Brief** carries three
   explicitly-named lenses that `/specs`' load-context reads verbatim (the `/explore → /specs`
   contract): **Domain Model**, **Established Decisions** (with ADR citations), **Prior Research** (the
   cross-dimension synthesis + the open questions a spec must resolve). The four dimension sections
   (Stack / Features / Architecture / Pitfalls) follow.

4. **spike** — one AFK experiment pass. Builds/measures a throwaway experiment where AFK-feasible, else
   reasons it through; appends a **`## Spike verdicts`** section (VALIDATED / INVALIDATED / PARTIAL).
   **Interactive prototyping is NOT done here** — that is Matt's `/prototype` skill, which needs a live
   conversation and so cannot run in an Archon node ([ADR-0017](../adr/0017-container-follows-structural-need.md)).
   This node only references it.

5. **spike-ticket** — files (or idempotently updates) a `spike` ticket on the tracker, linking
   findings.md and the verdicts, with the AI disclaimer. It reads the tracker contract in
   `docs/agents/` for the server, the repository, the work-item scope its idempotency search filters
   on, and the value and axis of every role
   ([ADR-0024](../adr/0024-triage-intake-on-ramp.md), amended).
   Runs **before** the gate so the durable output survives a "discard".

6. **spike-branch-gate** — **HITL by default** (`gates.explore`); skipped in AFK. APPROVE → preserve the
   spike code on branch `spike/<slug>`; REJECT → no branch (the code stays in the isolated worktree for
   `/cleanup`).

7. **preserve-spike** — reached only on approve: creates `spike/<slug>` and commits **named paths
   only** (findings.md plus the paths the spike node recorded), then confirms with
   `git status --porcelain` that nothing else was staged.

## Workflow structure

```
research-stack ──┐
research-features ─┤
                   ├─▶ synthesize ─▶ spike ─▶ spike-ticket ─▶ spike-branch-gate ─▶ preserve-spike
research-architecture ─┤              findings.md   verdicts        (approval,          (on approve)
research-pitfalls ──┘                                                gates.explore)
```

## Gates & AFK

`gates.explore` (default `hitl`) governs the spike-branch gate. Set it to `afk` to run unattended — the
gate and `preserve-spike` are both skipped, so no branch is created and the isolated worktree is left for
`/cleanup` to prune. The spike **ticket is always filed**, in either mode.

## Handoff into /specs

`/specs <slug>` reads `<artifacts_dir>/<slug>/findings.md` during its load-context step and summarises
the **Domain Model**, **Established Decisions**, and **Prior Research** lenses as the backdrop for
grilling. Keeping those three subsection headings exact is what makes the handoff lossless.

## Prerequisites

- `.archon/unic-dlc.config.yaml` is present (from `/unic-archon-dlc:setup`).
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` are present — this repository's
  tracker contract, which names the server, the repository, the work-item scope and every role.
- The server that contract names is reachable for the spike ticket. A tracker with no item-creation
  capability prints manual steps instead of failing.
- Archon ≥ 0.7.0 ([ADR-0033](../adr/0033-archon-070-schema-target.md)).

## Configuration reference

Read from `.archon/unic-dlc.config.yaml`:

| Field               | Type         | Default     | Description                                                    |
| ------------------- | ------------ | ----------- | -------------------------------------------------------------- |
| `gates.explore`     | `hitl`/`afk` | `hitl`      | HITL pauses at the spike-branch gate; AFK skips it (no branch) |
| `artifacts_dir`     | string       | `workflows` | Session artefact home (`<artifacts_dir>/<slug>/findings.md`)   |
| `project.branching` | string       | `gitflow`   | Informs branch conventions                                     |

The tracker itself is **not** configured here. `docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md` carry the server, the repository, the work-item scope and the roles.

## Runs

```
archon workflow run unic-dlc-explore "<slug>"
```
