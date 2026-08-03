---
argument-hint: '[<#id> | free-form request | "what needs my attention"]'
description: "Intake on-ramp: turn a raw bug/request/QA-finding/external-PR into an agent-ready issue on the tracker (or reject it durably). Composes Matt Pocock's triage method, bound to the DLC config as the single source of truth for labels."
---

# unic-archon-dlc:triage

> Design rationale: [ADR-0024 — `/triage` is the intake on-ramp](docs/adr/0024-triage-intake-on-ramp.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); generic-core + config per [ADR-0018](docs/adr/0018-generic-core-config-compose.md); tracker is the single source of truth per [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md); earns-its-place per [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)).

**Arguments:** "$ARGUMENTS"

`/triage` is an **intake on-ramp**: it turns RAW incoming work (bug reports, feature requests, QA
findings, external PRs) into **agent-ready issues on the team's tracker**, feeding the `/tickets`
convergence point. It is an **in-session command/skill** (triage is a live conversation, inherently
HITL — [ADR-0017](docs/adr/0017-container-follows-structural-need.md)).

It is a **thin binding wrapper**: it **owns the _what_** — the DLC config binding and the on-ramp
contract — and **delegates the _method_** (gather → recommend → verify → grill → apply) to Matt
Pocock's `triage` skill verbatim, composing `/grilling` + `/domain-modeling` for the grill step.
Compose those skills by name — never reimplement or vendor them.

**Single source of truth (the load-bearing rule).** Matt's `triage` method normally reads its label
mapping and tracker workflow from `docs/agents/triage-labels.md` / `docs/agents/issue-tracker.md`
(written by `setup-matt-pocock-skills`). In the DLC those are **never consulted** — this wrapper
loads everything from `.archon/unic-dlc.config.yaml` and **hands the mapping to Matt's method
inline**, so labels live in exactly one place and cannot drift from what `/tickets` and `/build`
read. `setup-matt-pocock-skills` is **not** a dependency of this plugin; only Matt's skill _methods_
are. See [ADR-0024](docs/adr/0024-triage-intake-on-ramp.md).

`/triage` writes **only** to the tracker (labels + comments) and, on a rejected enhancement, to the
out-of-scope knowledge base. It produces **no** `issues.json` / PRD — a triaged `ready-for-agent`
issue enters the `/tickets` backlog (or `/build` directly if already atomic). Because a human is
present at every transition, writes go **directly**; there is no PR gate.

Follow these steps in order. Do not skip any step.

> **Shell requirement**: Step 1 uses `<<'EOJS'` heredoc syntax, which requires a POSIX-compatible
> shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not support heredocs. All
> filesystem work uses Node's `node:fs`/`node:path`, so paths are cross-platform.

## Step 1 — Load config

`/triage` reads (never writes) `.archon/unic-dlc.config.yaml`. Run:

```bash
node --input-type=module <<'EOJS'
let output
try {
  const { pathToFileURL } = await import('node:url')
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/config-schema.mjs`).href)
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const cwd = process.cwd()

  const yamlPath = join(cwd, '.archon', 'unic-dlc.config.yaml')
  if (!existsSync(yamlPath)) {
    output = { ok: false, message: 'No .archon/unic-dlc.config.yaml found. Run /unic-archon-dlc:setup first.' }
  } else {
    const r = mod.loadConfig(yamlPath)
    if ('error' in r) {
      output = { ok: false, message: `Config present but unreadable: ${r.message}` }
    } else {
      const config = mod.mergeConfig(r.config)
      const validation = mod.validateConfig(config)
      if ('error' in validation) {
        output = { ok: false, message: `Config incomplete (${validation.missing.join(', ')}). Run /unic-archon-dlc:setup.` }
      } else {
        const g = (p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config)
        output = {
          ok: true,
          artifacts_dir: config.artifacts_dir,
          tracker: config.tracker,
          docs: config.docs,
          triage: config.triage,
          labels: g('classification.labels'),
        }
      }
    }
  }
} catch (err) {
  output = { ok: false, message: `Plugin load error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the JSON. If `ok` is `false`, print `message` verbatim and **stop**. Otherwise keep:
`ARTIFACTS_DIR`, `TRACKER` (`.type`/`.access`/`.coords`), `DOCS`, `TRIAGE`
(`.out_of_scope_dir`/`.external_prs`), and `LABELS` (`classification.labels`).

Method availability is guaranteed by the Bundle (`vendor/mattpocock-skills/`, installed by
`/unic-archon-dlc:setup`); per-Box `resolveMethod` wiring arrives with #280.

## Step 2 — Build the injected context (single-source binding)

Assemble the binding this wrapper hands to Matt's method. **Everything comes from config — do not
read `docs/agents/triage-labels.md` or `docs/agents/issue-tracker.md`.**

- **Label mapping** — from `LABELS` (canonical role → the tracker's actual label string). Matt's
  method speaks five canonical state roles and two category roles; resolve each to its tracker string
  through this map.
- **Role → DLC-state map** — the DLC taxonomy is a superset of Matt's five roles. Bind them:
  - Category `bug` → type `bug`; category `enhancement` → type `feature`.
  - States `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` → same-named DLC state.
  - Matt's `wontfix` splits: a **rejected enhancement** → `rejected`; an **already-implemented**
    request → `closed` (point to where it lives; do **not** write to the out-of-scope KB).
  - The DLC adds one outcome Matt's set lacks: **`needs-specs`** — a raw-but-valid idea that needs a
    PRD before it can be sliced. Apply the `needs-specs` label and tell the user to run
    `/unic-archon-dlc:specs <slug>`.
- **Tracker access** — `TRACKER.access` (MCP-first, CLI-fallback: `gh` / `az` / `jira`, or the
  `azure-devops-cli` skill) and `TRACKER.coords`. Never hardcode a tracker.
- **Out-of-scope dir** — `TRIAGE.out_of_scope_dir` (default `.out-of-scope`).
- **External-PR posture** — `TRIAGE.external_prs`: `always` / `never`, or `auto` = infer from
  `TRACKER.type` (`github` → treat external PRs as a request surface; any other tracker →
  issues-only). This governs whether PR discovery is in scope (an explicitly named PR is always
  triaged regardless).

## Step 3 — Delegate to Matt's `triage` method

Follow the method defined in the `triage` skill (`.agents/skills/triage/SKILL.md`) — do not restate
or reimplement its steps here. In summary, it: interprets the request ("what needs attention" →
three buckets; `#id` → triage that issue/PR; "move #id to `<state>`" → quick override); gathers
context (issue/PR body, comments, prior triage notes, and the diff for a PR) grounded in the repo's
`CONTEXT.md`/`CONTEXT-MAP.md` + `docs/adr/`; runs the **redundancy** and **prior-rejection** checks;
recommends a category + state and waits for direction; **verifies the claim best-effort** (reproduce
a bug from the reporter's steps, or check out a PR and run the relevant tests) — when it cannot
reproduce or no runner exists, it downgrades to `needs-info` with specific questions rather than
guessing; **grills** via `/grilling` + `/domain-modeling` when the request needs shaping (sharpening
`CONTEXT.md`/ADRs inline); and applies the outcome with an agent brief (its `AGENT-BRIEF.md`
guidance) or an out-of-scope record (its `OUT-OF-SCOPE.md` knowledge-base doc).

Bind that method to the DLC with the Step 2 context, and enforce these overrides:

- **Labels & states** come from the injected map, not Matt's `docs/agents/*`. Read the out-of-scope
  KB from `TRIAGE.out_of_scope_dir`, and include external PRs per the injected external-PR posture.
- **Every comment or issue posted during triage** must start with the mandated disclaimer:
  `> *This was generated by AI during triage.*`
- Access the tracker by **composing `TRACKER.access`** (MCP-first, CLI-fallback) — never assume `gh`.

## Step 4 — Enforce the on-ramp contract

Apply the agreed outcome (a human is present — write directly, no PR gate):

- **`ready-for-agent`** — post the agent brief comment and apply the `ready-for-agent` state label.
  The brief is the durable intent baton (contract C — intent lives on the tracker issue).
- **`ready-for-human`** — agent-brief structure, plus a note on why it can't be delegated.
- **`needs-info`** — post the Triage Notes (established / still-needed), apply `needs-info`.
- **`needs-specs`** — apply `needs-specs`; the item needs a PRD before slicing. Point the user to
  `/unic-archon-dlc:specs <slug>`.
- **`rejected`** (rejected enhancement) — write `<TRIAGE.out_of_scope_dir>/<concept>.md`, link it in
  a comment, apply `rejected`, and close.
- **`closed`** (already implemented) — comment pointing to where the behaviour already lives, apply
  `closed`, and close. Do **not** write to the out-of-scope KB.

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
