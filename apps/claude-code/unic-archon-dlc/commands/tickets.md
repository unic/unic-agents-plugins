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
          repo_ref: g('project.repo_ref') ?? null,
          tracker: config.tracker,
          estimations: config.estimations,
          tickets: config.tickets,
          issue_template: g('templates.issue'),
          bug_template: g('templates.bug'),
          labels: g('classification.labels'),
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
`ARTIFACTS_DIR`, `REPO_REF` (`project.repo_ref`, may be `null`), `TRACKER`
(`.type`/`.access`/`.coords`), `ESTIMATIONS`, `GATE` (`tickets.gate`), `ISSUE_TEMPLATE`,
`BUG_TEMPLATE`, `LABELS`, and `METHODS`.

### Repository pin — check this now, before any tracker or PR write

`REPO_REF` pins every `gh`/`az` write this command makes. If it is `null` or empty, print this line
before doing anything else and ask the human to confirm or set the key:

```
project.repo_ref is not set in .archon/unic-dlc.config.yaml — gh/az will infer the repository from
the checkout, which is the upstream parent in a fork clone. Set it under project:, or confirm you
want the inferred repository.
```

On **set the key**: stop, let the human edit `.archon/unic-dlc.config.yaml`, and start again. On
**confirm the inferred repository**: print what the CLI actually resolves to
(`gh repo view --json nameWithOwner -q .nameWithOwner`), repeat it in the question, and only then run
the writes with no `--repo` flag. Never pass `--repo "null"` or `--repo ""` — both fail at the CLI.

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
  tracker issues (Step 9). Its closing "work the frontier one ticket at a time with `/implement`" maps
  to `/unic-archon-dlc:build`. And its "run `/setup-matt-pocock-skills` if not" fallback never
  applies — Step 1 provided that config, and running that skill would create a second label file that
  drifts from `.archon/unic-dlc.config.yaml` ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md)).

Draft each slice with these fields (the `issues-schema` shape):

- `id` — short kebab-case identifier unique within this file (e.g. `issue-01`)
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

## Step 9 — Publish issues to the tracker (dependency order)

Publish each slice to the team's tracker by **composing the configured tracker system-skill**
(MCP-first) or its CLI (`gh` / `az` / `jira` per `TRACKER.access`; or the `azure-devops-cli` skill) —
read `TRACKER.type` / `TRACKER.coords` from config; never hardcode a tracker. Publish in the
dependency `order` from Step 8 (**blockers first**) so each issue can reference the real tracker IDs
of its blockers.

**Pin every write in this step to `REPO_REF`** — this is the first tracker write the command makes, and
an unpinned `gh`/`az` files the issue against whatever repository the checkout infers, which in a fork
clone is someone else's tracker. `gh issue create --repo "<REPO_REF>" …` for GitHub; for ado, the flag
the subcommand takes (`az boards work-item create` takes none — it takes `--organization` / `--project`
from `TRACKER.coords`). If a pinned call fails, stop and report it; never retry it unpinned. If the
human confirmed the inferred repository back in Step 1, say which repository you are filing into before
the first `create` call.

For each slice, build the issue body from `ISSUE_TEMPLATE` (use `BUG_TEMPLATE` for `type: bug`;
fall back to the resolved `to-tickets` Method's issue template if the config template is null). The body MUST carry
the slice's **acceptance criteria** (contract C — intent lives on the tracker issue) and its
**Blocked by** references (real tracker IDs, or "None — can start immediately"). Apply the
ready-for-agent triage label from `LABELS` unless the user says otherwise. Do NOT close or modify any
parent issue.

## Step 10 — Tickets gate (HITL)

The plan is human-approved via a PR — never merge it yourself. Both gate paths stage the same way.

**Staging rule (both paths).** Stage by NAME — only `<ARTIFACTS_DIR>/<SLUG>/issues.json`. Never run
`git add -A`, `git add --all`, `git add .`, `git add -u`, `git commit -a`/`-am`, or `git add` on a
directory. Never stage `pr-body.md`, any
`*.tmp.md` / `*.scratch.md`, or anything under Archon's per-run artifacts directory (which resolves
outside the repo tree, and is not the config's `artifacts_dir`). After staging, run
`git status --porcelain` and confirm every staged path is one you named.

**Repo-pinning rule (both paths).** Pin the PR command to `REPO_REF`. An unpinned `gh`/`az` infers
the repository from the checkout, which in a fork clone is the upstream parent — the PR then opens
against the wrong repository. The reference is host-agnostic and only the flag differs: `gh pr create
--repo "<REPO_REF>"` for GitHub, `az repos pr create --repository "<REPO_REF>"` plus the
`--organization` / `--project` coords for Azure DevOps. Never hardcode a host. The same rule covers
Step 9's issue publishing: pin every `gh issue` call with `--repo "<REPO_REF>"`, and every `az` call
with the flag its subcommand takes.

The null-`REPO_REF` check already ran at the end of Step 1 — before any tracker write — so by
here the human has either set the key or explicitly confirmed the inferred repository.

Behaviour follows `GATE`:

- **`open-pr`** (default): create `feature/tickets/<SLUG>`, stage `issues.json`, commit, and open a
  PR to `develop`, then **stop** for human review:

  ```bash
  git checkout -b feature/tickets/<SLUG>
  git add -- "<ARTIFACTS_DIR>/<SLUG>/issues.json"
  git status --porcelain                              # confirm nothing else is staged
  git commit -m "tickets(<SLUG>): vertical-slice issues"
  git push origin feature/tickets/<SLUG>
  gh pr create --repo "<REPO_REF>" --base develop --title "tickets(<SLUG>): vertical-slice issues" --body "<why + slice summary + tracker links>"
  ```

  (Adapt the host commands to `TRACKER` if the project is not GitHub.) On **reject**, return to
  Step 4 and revise the breakdown, then re-run from Step 8.

- **`stage-only`**: write `issues.json` (already done in Step 8), then stage it by name — the same
  `git add -- "<path>"` plus `git status --porcelain` check as above. Print a suggested PR title/body
  (including the `--repo "<REPO_REF>"` flag) and **stop** — leave the branch, commit, push, and PR to
  the user.

## Step 11 — Summary

Print a concise summary:

```
/tickets complete — slug: <SLUG>
  issues:   <ARTIFACTS_DIR>/<SLUG>/issues.json (<count> slices)
  order:    <id → id → …>  (dependency order)
  tracker:  <published issue refs>
  methods:  <name>(<tier>) (as printed in Step 1)
  gate:     <open-pr → PR #… | stage-only → staged>
  next:     run /build <SLUG> once the tickets are approved
```
