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
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
  // Named explicitly: `join(undefined, …)` throws "path argument must be of type string",
  // which says nothing about what to do next.
  if (!pluginRoot) throw new Error('CLAUDE_PLUGIN_ROOT is not set. Run this as a /unic-archon-dlc: slash command — the snippet cannot find the Plugin on its own.')
  const mod = await import(pathToFileURL(join(pluginRoot, 'lib', 'config-schema.mjs')).href)
  const resolver = await import(pathToFileURL(join(pluginRoot, 'lib', 'methods-resolver.mjs')).href)
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
        const wanted = ['triage', 'grilling', 'domain-modeling']
        const methods = wanted.map((name) => {
          const m = resolver.resolveMethod(name, { repoRoot: cwd, config, box: 'triage' })
          return 'error' in m ? { name, error: m.message } : { name, path: m.path, tier: m.tier }
        })
        output = {
          ok: true,
          artifacts_dir: config.artifacts_dir,
          docs: config.docs,
          triage: config.triage,
          methods,
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
`ARTIFACTS_DIR`, `DOCS`, `TRIAGE` (`.out_of_scope_dir`/`.external_prs`), and `METHODS`.

### The Methods this Box reads

`METHODS` carries one entry per Method — `triage`, `grilling`, `domain-modeling` — with the tier it
resolved from: `config` (a `methods.<name>.source` the team declared), `local`
(`.archon/methods.local/`), or `bundle` (`.archon/methods/`, written by `/unic-archon-dlc:setup`).

If any entry carries `error`, print it verbatim and **stop**. A Box cannot run a procedure it cannot
read; the fix is to run `/unic-archon-dlc:setup`.

Otherwise print the tier line before continuing, so a surprising result is diagnosable:

```
methods: triage(bundle) · grilling(bundle) · domain-modeling(bundle)
```

Then read each entry's `path` in full. That text **is** the procedure — this wrapper adds only the
config binding, and never restates, summarises or improves a Method
([ADR-0030](docs/adr/0030-harness-hosts-methods.md)). The `triage` Method's `AGENT-BRIEF.md` and
`OUT-OF-SCOPE.md` sit beside its resolved `SKILL.md`, in the same directory, at every tier.

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
- **Roles** — `triage-labels.md` gives each role a value and names the axis that carries it. Resolve
  every canonical category and state role the Method names through that file. The axis belongs to the
  role, not to the tier: one role can be a state and its neighbour a tag.
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

A role whose row in `triage-labels.md` says it is not written writes nothing. Say which role you
resolved and to what value, so the resolution is auditable from the transcript.

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
  methods:  <name>(<tier>) · … (as printed in Step 1)
  next:     <run /tickets to slice it | run /specs <slug> | run /build if atomic | closed>
```
