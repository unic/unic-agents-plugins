---
argument-hint: '<slug>'
description: 'Decompose an approved PRD into independently-grabbable vertical-slice issues: slice, map tests, validate, publish to the tracker, and open the tickets gate. Produces a build-ready <artifacts_dir>/<slug>/issues.json for /build.'
---

# unic-archon-dlc:tickets

> Design rationale: [ADR-0022 — `/tickets` slices a PRD into build-ready issues](docs/adr/0022-tickets-slice-to-build.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); generic-core + config per [ADR-0018](docs/adr/0018-generic-core-config-compose.md); red/green contract per [ADR-0012](docs/adr/0012-fresh-context-red-green-separation.md)).

**Arguments:** "$ARGUMENTS"

`/tickets` is the **second main-line box**: it turns one approved PRD into a set of
**independently-grabbable vertical tracer-bullet slices**, makes each slice build-ready (a test seam
per slice), validates the whole set, publishes the issues to the team's tracker, and stops at the
tickets gate. It is an **in-session command/skill** (slicing is a live conversation — ADR-0017), and
it **owns the _what_** (the slicing flow, the build-ready checks, the DAG of `blocked_by` edges)
while **composing the _how_**: the `to-tickets` Method for slicing — read by resolved path, per
Step 1 — and the configured **tracker system-skill** (MCP-first, CLI-fallback) for publishing.

`/tickets` **stops at a build-ready `issues.json`** (dependency-ordered, each slice carrying its
acceptance criteria + test command) plus the published tracker issues. It does **not** generate a
build workflow: `/build` (step 06) consumes `issues.json` directly via a generic loop
([ADR-0022](docs/adr/0022-tickets-slice-to-build.md)). Intent lives on the tracker issue (contract C)
**and** in `issues.json` (the durable baton `/build` reads).

Follow these steps in order. Do not skip any step. The only files you write are `issues.json`
(`<artifacts_dir>/<slug>/issues.json`) and the tracker issues; everything else is conversation until
the gate in Step 10.

> **Shell requirement**: Steps 1 and 8 use `<<'EOJS'` heredoc syntax, which requires a
> POSIX-compatible shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not
> support heredocs. All filesystem work uses Node's `node:fs`/`node:path`, so paths are
> cross-platform.

## Step 1 — Load config

`/tickets` reads (never writes) `.archon/unic-dlc.config.yaml`. Run:

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
        const wanted = ['to-tickets']
        const methods = wanted.map((name) => {
          const m = resolver.resolveMethod(name, { repoRoot: cwd, config, box: 'tickets' })
          return 'error' in m ? { name, error: m.message } : { name, path: m.path, tier: m.tier }
        })
        output = {
          ok: true,
          artifacts_dir: config.artifacts_dir,
          estimations: config.estimations,
          tickets: config.tickets,
          issue_template: g('templates.issue'),
          bug_template: g('templates.bug'),
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
`ARTIFACTS_DIR`, `ESTIMATIONS`, `GATE` (`tickets.gate`), `ISSUE_TEMPLATE`, `BUG_TEMPLATE`, and
`METHODS`.

### Read the tracker contract

`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` in this repository are the tracker
contract. This Box publishes items and writes a role on each, so read both now. If either is absent,
print `This repository has no tracker contract at docs/agents/. Run /unic-archon-dlc:setup.` and
**stop**.

- **Access** — `issue-tracker.md` § Access names the MCP server or skill that serves this tracker.
  Read that server's own current tool list and build every call from it. Name no provider and write no
  command, subcommand or flag ([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)).
- **Addressing** — its § Addressing names the repository this run publishes to and opens its PR
  against. Name it explicitly in every call, and derive nothing from a remote URL.
- **Work-item scope** — its § Work-item scope names the one filter every search applies, and the scope
  every item you create carries.
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

Print the repository § Addressing names with the tier line below, so a surprising target is
diagnosable.

### The Method this Box reads

`METHODS` carries one entry — `to-tickets` — with the tier it resolved from: `config` (a
`methods.to-tickets.source` the team declared), `local` (`.archon/methods.local/`), or `bundle`
(`.archon/methods/`, written by `/unic-archon-dlc:setup`).

If the entry carries `error`, print it verbatim and **stop**. A Box cannot run a procedure it cannot
read; the fix is to run `/unic-archon-dlc:setup`.

Otherwise print the tier line before continuing, so a surprising result is diagnosable:

```
methods: to-tickets(bundle)
```

Then read the entry's `path` in full. That text **is** the slicing procedure — the steps below add
only what the Harness owns, and never restate, summarise or improve a Method
([ADR-0030](docs/adr/0030-harness-hosts-methods.md)).

## Step 2 — Slug + re-entry

Parse the first whitespace-delimited token of `$ARGUMENTS` as `SLUG` (kebab-case). If `$ARGUMENTS` is
empty, ask the user for a slug and stop until you have one.

Require `<ARTIFACTS_DIR>/<SLUG>/PRD.md`. If it does **not** exist, print
`No PRD at <ARTIFACTS_DIR>/<SLUG>/PRD.md — run /unic-archon-dlc:specs <SLUG> first.` and **stop**.

Check whether `<ARTIFACTS_DIR>/<SLUG>/issues.json` already exists. If it does, this is a **re-entry**
(e.g. the gate was rejected). Read it, summarise the current breakdown back, and ask whether to
**revise** it (continue from where it left off) or start over — never silently clobber an existing
`issues.json`.

## Step 3 — Read PRD + ground context

Read `<ARTIFACTS_DIR>/<SLUG>/PRD.md` in full. Then ground yourself before slicing. Read, if present:
root `CONTEXT.md` / `CONTEXT-MAP.md`, per-context `CONTEXT.md` files, all ADRs in `docs/adr/`, and
`<ARTIFACTS_DIR>/<SLUG>/findings.md`. Note the **Domain Model**, **Established Decisions**, and the
PRD's **User Stories** + **Acceptance criteria** — every slice must trace back to them and use the
project's domain vocabulary.

## Step 4 — Slice into vertical tracer bullets

Decompose the PRD by following the resolved `to-tickets` Method — its slice rules, its blocking edges,
its prefactoring guidance, and its wide-refactor exception all govern here.

Three things the Harness adds or overrides on top of it:

- **Granularity litmus (the DLC's "thin enough" test):** one slice = **one demoable behaviour** — thin
  enough that a single failing test can capture it and a minimal implementation can satisfy it, so
  strict red/green (contract B) is safe. If a slice needs more than one failing test to express its
  behaviour, or bundles two independently-demoable behaviours, split it. If a slice can't be
  demonstrated without another, wire the dependency instead of merging. The litmus does **not** apply
  to the Method's **wide-refactor** exception: an expand–contract sequence is not a tracer bullet by
  design, and green is promised where the Method says it is.
- **A prefactor is an ordinary slice.** `issues.json` has no prefactor field and needs none: give the
  prefactor `type: tech-debt` and `blocked_by: []`, then name it in the `blocked_by` of every slice it
  unblocks. The dependency order from Step 8 then ships it first, and `/build` needs no extra rule.
- **Publish to the tracker, never to a file in the repo root.** The Method offers a local `tickets.md`
  as one of its two publishing shapes; in the DLC the durable baton is `issues.json` (Step 8) plus the
  tracker items (Step 9). Its closing "work the frontier one ticket at a time with `/implement`" maps
  to `/unic-archon-dlc:build`. And its "run `/setup-matt-pocock-skills` if not" fallback never
  applies — Step 1 read the vocabulary from `docs/agents/triage-labels.md`, which is the file that
  skill would overwrite, with a five-role `wontfix` vocabulary that drops every mapping
  ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md), amended).

Draft each slice with these fields (the `issues-schema` shape):

- `id` — short kebab-case identifier unique within this file (e.g. `issue-01`). It addresses nothing
  outside the file — `tracker_id` does that, and Step 9 writes it
- `title` — one-line description of the deliverable
- `type` — one of `feature | bug | spike | tech-debt | docs`
- `priority` — one of `p0 | p1 | p2 | p3`
- `blocked_by` — array of IDs in _this_ file that must ship first (empty array if independent)
- `acceptance_criteria` — non-empty array of independently-demonstrable statements
- `summary` — one short paragraph describing the end-to-end behaviour (not layer-by-layer)

Present the breakdown as a numbered list:

```
<number>. [<type>/<priority>] <title>   (id: <id>)
   blocked_by: <comma-separated IDs, or "none">
   summary: <summary>
   acceptance_criteria:
     - <criterion 1>
     - …
```

Then ask: **"Does the granularity feel right? Are the dependencies correct? Split, merge, or
relabel anything?"** Iterate — apply changes and re-present — until the user approves explicitly.

## Step 5 — nyquist-map (attach a test seam per slice)

For every approved slice, decide the exact verification command — the seam that "samples" the
slice's behaviour so `/build`'s red/green loop can assert it. Set exactly one of:

- `test_command` — the most specific runnable command that exercises **only** this slice's
  acceptance criteria (e.g. `pnpm --filter <name> test`, a specific test file, an integration check).
- `test_command_planned: true` — when no runner exists yet or the test is itself the deliverable.
  This is not a failure; it signals the test must be written while implementing the slice.

Never set both. For `docs`/`spike` slices, prefer `test_command_planned: true` unless a lint/build
check is meaningful. Present a compact `id → test command / [planned]` table.

## Step 6 — plan-checker (single validation pass)

Before writing `issues.json`, validate the whole set in **one conversational pass** (no loop — you
drive the iterations with the user). Check four dimensions:

1. **Dependency integrity** — every `blocked_by` ID exists in the set; the graph is acyclic
   (`sortByDependency` in Step 8 will hard-fail on a cycle — surface it here first).
2. **PRD coverage** — every acceptance criterion of every PRD user story is covered by at least one
   slice's `acceptance_criteria`; list any uncovered PRD criteria.
3. **Completeness** — every slice has all mandatory fields non-empty (this is `validateIssue`);
   `acceptance_criteria` is a non-empty array.
4. **Test-seam presence** — every slice has `test_command` or `test_command_planned: true`.

Also check **decision coverage**: every binding decision in `CONTEXT.md` / the ADRs is addressed by
some slice. Present a short report (`✓` per clean dimension, else the specific gaps). If anything
fails, propose fixes and re-present; iterate until the user approves (or explicitly accepts a gap).

## Step 7 — Definitive estimation (config-gated)

If `ESTIMATIONS` is `definitive` or `both`, **compose** an estimator (never build one — ADR-0021) to
attach a **definitive** per-slice estimate, refining any provisional estimate from `/specs`. If
`ESTIMATIONS` is `off` or `provisional`, skip this step.

## Step 8 — Write issues.json

Substitute `{ISSUES_JSON}` with the approved issues array as a JSON string, `{SLUG_JSON}` with the
JSON-encoded slug, `{SLUG_RAW}` with the bare slug, and `{ARTIFACTS_DIR_JSON}` with the config value
(all placed directly inside the heredoc — never via shell variables), then run:

```bash
node --input-type=module <<'EOJS'
let result
try {
  const { pathToFileURL } = await import('node:url')
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/issues-schema.mjs`).href)
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const cwd = process.cwd()
  const issues = {ISSUES_JSON}
  const slug = {SLUG_JSON}
  const artifactsDir = {ARTIFACTS_DIR_JSON}

  const errors = []
  for (const issue of issues) {
    const check = mod.validateIssue(issue)
    if (!check.valid) errors.push(`${issue.id ?? '(no id)'}: ${check.errors.join('; ')}`)
  }
  if (errors.length > 0) {
    result = { ok: false, message: `Issue schema errors:\n  - ${errors.join('\n  - ')}` }
  } else {
    let sorted
    try {
      sorted = mod.sortByDependency(issues)
    } catch (err) {
      result = { ok: false, message: `Dependency error: ${err?.message ?? String(err)}` }
    }
    if (!result) {
      const dir = join(cwd, artifactsDir, slug)
      mkdirSync(dir, { recursive: true })
      const outPath = join(dir, 'issues.json')
      writeFileSync(outPath, mod.buildIssuesJson(sorted) + '\n')
      result = { ok: true, path: `${artifactsDir}/${slug}/issues.json`, count: sorted.length, order: sorted.map((i) => i.id) }
    }
  }
} catch (err) {
  result = { ok: false, message: `issues.json write error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Parse the output: if `ok` is `false`, fix the reported issues and re-run; if `ok` is `true`, note
`path`, `count`, and the dependency `order` (blockers first). `issues.json` is the durable,
dependency-ordered baton `/build` consumes — it carries each slice's `acceptance_criteria` +
`test_command`.

## Step 9 — Publish items to the tracker (dependency order)

Publish each slice through the tracker contract read in Step 1, to the repository § Addressing names
and inside the work-item scope. Publish in the dependency `order` from Step 8 (**blockers first**) so
each item can reference the real tracker ids of its blockers.

For each slice, build the body from `ISSUE_TEMPLATE` (use `BUG_TEMPLATE` for `type: bug`; fall back to
the resolved `to-tickets` Method's issue template if the config template is null). The body MUST carry
the slice's **acceptance criteria** (contract C — intent lives on the tracker item) and its
**Blocked by** references (real tracker ids, or "None — can start immediately"). Write the
`ready-for-agent` state role unless the user says otherwise. Do NOT close or modify any parent item.

### Write each tracker id back into `issues.json`

**This is mandatory, and it is what makes the baton usable.** As each item is published, write the id
the tracker returned into that slice's `tracker_id` in `<ARTIFACTS_DIR>/<SLUG>/issues.json`, then
re-run the Step 8 validation over the updated file. `id` is the slice's identifier **inside the file**
and addresses nothing outside it, so without `tracker_id` nothing downstream can reach the tracker
item at all: `/build`'s code-review pre-check cannot read the item's intent, and `open-pr` cannot link
it to the PR.

That gap is **host-agnostic**, not one host's quirk. No host closes its tracker item from a PR body
this command never writes an id into, so the id has to come from here on every host. A slice whose
publish failed keeps `tracker_id` absent and is reported as unpublished — never given a placeholder.

## Step 10 — Tickets gate (HITL)

The plan is human-approved via a PR — never merge it yourself. Behaviour follows `GATE`:

Both gates stage the **same named path**, and nothing else: `<ARTIFACTS_DIR>/<SLUG>/issues.json`.

**Staging rule — named paths only.** Run one `git add <path>` per path above. Never `git add -A`,
`git add .`, or `git add -u`. Never stage `pr-body.md`, `*.tmp.md`, `*.scratch.md`, or anything under
`$ARTIFACTS_DIR` (Archon's per-run directory, which resolves outside the repo tree under
`~/.archon/workspaces/<name>/artifacts/`; `<ARTIFACTS_DIR>` from config is a different, repo-relative
path and is staged above). Then run `git status --porcelain` and confirm every staged entry is one of
the named paths. Unstage anything else with `git restore --staged <path>` and say what you unstaged.

- **`open-pr`** (default): create `feature/tickets/<SLUG>`, stage the named path, commit, push, and
  open a PR to `develop`, then **stop** for human review:

  ```bash
  git checkout -b feature/tickets/<SLUG>
  git add <ARTIFACTS_DIR>/<SLUG>/issues.json
  git status --porcelain               # confirm nothing else is staged
  git commit -m "tickets(<SLUG>): vertical-slice issues"
  git push origin feature/tickets/<SLUG>
  ```

  Then open the PR against the repository `docs/agents/issue-tracker.md` § Addressing names, base
  `develop`, title `tickets(<SLUG>): vertical-slice issues`, body
  `<why + slice summary + the published tracker ids>`, through the same server Step 9 used. On
  **reject**, return to Step 4 and revise the breakdown, then re-run from Step 8.

- **`stage-only`**: write `issues.json` (already done in Step 8), stage the same named path under the
  same staging rule, print a suggested PR title/body, and **stop** — leave the commit, push, and PR
  to the user.

## Step 11 — Summary

Print a concise summary:

```
/tickets complete — slug: <SLUG>
  issues:   <ARTIFACTS_DIR>/<SLUG>/issues.json (<count> slices)
  order:    <id → id → …>  (dependency order)
  repo:     <the repository docs/agents/issue-tracker.md § Addressing names>
  tracker:  <slice id → tracker_id, one per slice | unpublished: <slice ids>>
  methods:  <name>(<tier>) (as printed in Step 1)
  gate:     <open-pr → PR #… | stage-only → staged>
  next:     run /build <SLUG> once the tickets are approved
```
