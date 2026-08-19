---
argument-hint: '[<#id> | free-form request | "what needs my attention"]'
description: "Intake on-ramp: turn a raw bug/request/QA-finding/external-PR into an agent-ready issue on the tracker (or reject it durably). Reads the triage Method, bound to this repository's tracker contract in docs/agents/."
---

# unic-archon-dlc:triage

> Design rationale: [ADR-0024 — `/triage` is the intake on-ramp](docs/adr/0024-triage-intake-on-ramp.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); generic-core + config per [ADR-0018](docs/adr/0018-generic-core-config-compose.md); tracker is the single source of truth per [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md); earns-its-place per [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)).

**Arguments:** "$ARGUMENTS"

`/triage` is an **intake on-ramp**: it turns RAW incoming work (bug reports, feature requests, QA
findings, external PRs) into **agent-ready issues on the team's tracker**, feeding the `/tickets`
convergence point. It is an **in-session command/skill** (triage is a live conversation, inherently
HITL — [ADR-0017](docs/adr/0017-container-follows-structural-need.md)).

It is a **thin binding wrapper**: it **owns the _what_** — the DLC config binding and the on-ramp
contract — and **delegates the procedure** to the `triage` Method verbatim, with `grilling` and
`domain-modeling` for the grill step. All three are read by resolved path, per Step 1.

**The tracker contract (the load-bearing rule).** The `triage` Method reads its role vocabulary and
tracker workflow from `docs/agents/triage-labels.md` and `docs/agents/issue-tracker.md`. **So does
this wrapper.** Those two files are where every host word lives — the server that serves the tracker,
the repository, the work-item scope, and the value and axis of each role. This command names a role
and a file, and never an organisation, a field or a provider.

`/unic-archon-dlc:setup` owns both files. `setup-matt-pocock-skills` is **not** a dependency of this
plugin and must not be run over them: it writes another host's template over the first and reverts the
second to a five-role `wontfix` vocabulary. See
[ADR-0024](docs/adr/0024-triage-intake-on-ramp.md), amended.

`/triage` writes **only** to the tracker (labels + comments) and, on a rejected enhancement, to the
out-of-scope knowledge base. It produces **no** `issues.json` / PRD — a triaged `ready-for-agent`
issue enters the `/tickets` backlog (or `/build` directly if already atomic). Because a human is
present at every transition, writes go **directly**; there is no PR gate.

Follow these steps in order. Do not skip any step.

## Step 1 — Load config and the Methods

`/triage` reads (never writes) `.archon/unic-dlc.config.yaml`. Read it with your own tools. Do not shell
out to Node, do not import a Plugin module, and do not read `$CLAUDE_PLUGIN_ROOT`: an installed Plugin
ships no `node_modules`, and that variable is not set inside the Bash tool
([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5). The four Archon Boxes read
their config this way already; this is the same shape.

If the file is absent or unreadable, print
`No readable .archon/unic-dlc.config.yaml. Run /unic-archon-dlc:setup first.` and **stop**. That is the
only config condition that stops this Box: **no key is mandatory**. Take each key below, and use the
default beside it whenever the key is absent or null.

| Key | Default | Keep as |
| --- | --- | --- |
| `artifacts_dir` | `workflows` | `ARTIFACTS_DIR` |
| `docs.type` · `docs.publish` · `docs.access` | `markdown` · `false` · unset | `DOCS` |
| `triage.out_of_scope_dir` | `.out-of-scope` | `TRIAGE.out_of_scope_dir` |
| `triage.external_prs` | `auto` | `TRIAGE.external_prs` |

### The Methods this Box reads

Read these three files in full, at exactly these paths:

- `.archon/methods/triage/SKILL.md`
- `.archon/methods/grilling/SKILL.md`
- `.archon/methods/domain-modeling/SKILL.md`

A Method lives at one path and this is it — the same literal path the Archon Boxes read. If any of the
three is absent, print that exact path followed by `Run /unic-archon-dlc:setup.` and **stop**: a Box
cannot run a procedure it cannot read. When all three are present, print nothing and continue.

That text **is** the procedure — this wrapper adds only the config binding, and never restates,
summarises or improves a Method ([ADR-0030](docs/adr/0030-harness-hosts-methods.md)). The `triage`
Method's `AGENT-BRIEF.md` and `OUT-OF-SCOPE.md` sit beside its `SKILL.md`, in the same directory.

## Step 2 — Read the tracker contract and build the injected context

Read `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` in full before anything else
in this step. If either is absent, print
`This repository has no tracker contract at docs/agents/. Run /unic-archon-dlc:setup.` and **stop** —
do not guess a role value and do not run `setup-matt-pocock-skills`.

- **Access** — `issue-tracker.md` § Access names the MCP server or skill that serves this tracker.
  Read that server's own current tool list and build every call from it. Name no provider and write no
  command, subcommand or flag: a flag table written down here is stale the moment the tool changes
  ([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)).
- **Addressing** — its § Addressing names the repository to act on. Name it explicitly in every call,
  and derive nothing from a remote URL.
- **Work-item scope** — its § Work-item scope names the one filter every search applies. A search that
  skips it matches a sibling repository's items, and a prior-rejection check then finds one that is
  not ours.
- **Roles** — `triage-labels.md` gives each role a value, the axis that carries it, and whether
  that axis **holds** one value or many. Name a role, resolve it there, and write no host field name
  yourself. Two rules follow from that table, and both are mandatory:
  - **A row with no axis writes nothing.** Report which role you resolved and that its row asks for
    no write.
  - **A `state`, `type` or `priority` role is single-valued.** Only one role of a tier is true of an
    item at a time. Before you write such a role, read the other rows of that tier and retract every
    one whose axis holds many values. An axis that holds one value retracts the old value itself, so
    there is nothing extra to do. Read `holds`, never the axis name: an axis name is a host word and
    the next host spells it differently.
    The axis belongs to the role, not to the tier: one role can sit on a single-value field and its
    neighbour on a multi-value one.
- **Role → DLC-state map** — the DLC taxonomy is a superset of the Method's roles. Bind them:
  - Category `bug` → type `bug`; category `enhancement` → type `feature`.
  - States `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` → same-named DLC state.
  - The Method's `wontfix` splits: a **rejected enhancement** → `rejected`; an **already-implemented**
    request → `closed` (point to where it lives; do **not** write to the out-of-scope KB).
  - The DLC adds one outcome the Method's set lacks: **`needs-specs`** — a raw-but-valid idea that needs a
    PRD before it can be sliced. Write the `needs-specs` role and tell the user to run
    `/unic-archon-dlc:specs <slug>`.
- **Out-of-scope dir** — `TRIAGE.out_of_scope_dir` (default `.out-of-scope`).
- **External-PR posture** — `TRIAGE.external_prs`: `always` / `never`, or `auto` = ask the tracker
  whether it carries pull requests from outside the repository at all. Where it does, treat an
  external PR as a request surface; where it does not, triage issues only. This governs whether PR
  discovery is in scope — an explicitly named PR is always triaged regardless.

## Step 3 — Delegate to the `triage` Method

Follow the resolved `triage` Method, including its `AGENT-BRIEF.md` and `OUT-OF-SCOPE.md`. Where it
calls for grilling, follow the resolved `grilling` and `domain-modeling` Methods.

Bind that procedure to the DLC with the Step 2 context, and enforce these overrides:

- **Roles** resolve through `docs/agents/triage-labels.md`, each row naming the axis that carries it
  ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md), amended). Write the value and the axis that file
  gives; invent neither.
- **`AGENT-BRIEF.md` is written for GitHub** and names `ready-for-agent` and `wontfix` as literal
  labels. Read those as canonical roles too, resolve them through `triage-labels.md`, and apply the
  Step 2 `wontfix` split (rejected enhancement → `rejected`; already implemented → `closed`).
- **The "run `/setup-matt-pocock-skills` if not" fallback never applies.** The Method's `SKILL.md`
  offers it when the role vocabulary is absent. Step 2 read it from `docs/agents/triage-labels.md`,
  which is the file that skill would overwrite — with a five-role `wontfix` vocabulary that drops every
  mapping. If Step 2 could not read it, stop; never repair it by running that skill.
- **The out-of-scope KB lives at `TRIAGE.out_of_scope_dir`.** The Method hardcodes `.out-of-scope/` in
  both its `SKILL.md` (the prior-rejection check, and again when recording a rejected enhancement) and
  its `OUT-OF-SCOPE.md`. Substitute the configured directory at every one of those points, including
  the read that happens while gathering context — before any outcome is chosen.
- **External PRs** are in scope per the injected external-PR posture, not per the Method's own
  tracker-config lookup.
- **Every comment or item posted during triage** must start with the mandated disclaimer:
  `> *This was generated by AI during triage.*`
- Reach the tracker through the server `issue-tracker.md` § Access names, reading its current tool
  list. Assume no CLI and name no provider.

## Step 4 — Enforce the on-ramp contract

Apply the agreed outcome (a human is present — write directly, no PR gate):

- **`ready-for-agent`** — post the agent brief comment and write the `ready-for-agent` state role.
  The brief is the durable intent baton (contract C — intent lives on the tracker item).
- **`ready-for-human`** — agent-brief structure, plus a note on why it can't be delegated.
- **`needs-info`** — post the Triage Notes (established / still-needed), write `needs-info`.
- **`needs-specs`** — write `needs-specs`; the item needs a PRD before slicing. Point the user to
  `/unic-archon-dlc:specs <slug>`.
- **`rejected`** (rejected enhancement) — write `<TRIAGE.out_of_scope_dir>/<concept>.md`, link it in
  a comment, write `rejected`, and close.
- **`closed`** (already implemented) — comment pointing to where the behaviour already lives, write
  `closed`, and close. Do **not** write to the out-of-scope KB.

Apply the two Step 2 role rules at every outcome above: a row with no axis writes nothing, and
writing a state role retracts every other state role whose axis holds many values. Report which role
you resolved, to what value, and what you retracted — so the resolution is auditable from the
transcript.

`/triage` produces no `issues.json` / PRD. A `ready-for-agent` item flows into `/tickets` (the
convergence point — it will be sliced there) or, if already atomic and build-ready, into `/build`.

## Step 5 — Summary

Print a concise summary:

```
/triage complete — item: <#id | title>
  category: <bug | feature>
  state:    <ready-for-agent | ready-for-human | needs-info | needs-specs | rejected | closed>
  brief:    <link to the agent-brief comment | out-of-scope file | —>
  verify:   <reproduced | PR checked | insufficient — needs-info | n/a>
  next:     <run /tickets to slice it | run /specs <slug> | run /build if atomic | closed>
```
