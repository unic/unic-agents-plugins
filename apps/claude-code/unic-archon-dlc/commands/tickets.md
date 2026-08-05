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
while **composing the _how_**: Matt Pocock's `/to-issues` for slicing and the configured **tracker
system-skill** (MCP-first, CLI-fallback) for publishing. Compose those by name — never reimplement or
vendor them.

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
          repo_ref: g('project.repo_ref'),
          estimations: config.estimations,
          tickets: config.tickets,
          issue_template: g('templates.issue'),
          bug_template: g('templates.bug'),
          labels: g('classification.labels'),
          matt_suite: g('skills.matt_suite'),
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
`ARTIFACTS_DIR`, `TRACKER` (`.type`/`.access`/`.coords`), `REPO_REF` (`project.repo_ref`),
`ESTIMATIONS`, `GATE` (`tickets.gate`), `ISSUE_TEMPLATE`, `BUG_TEMPLATE`, `LABELS`, and `MATT_SUITE`.

`REPO_REF` is the repository every host CLI call is pinned to — `<owner>/<repo>` (or
`<host>/<owner>/<repo>`) for GitHub, the repository name or ID for Azure DevOps. It is an optional
config key, so it may be `null`; Step 10 handles that case. Take it from config only — never from
`git remote get-url origin` or `gh repo view`, which follow the host's own remote precedence
(`upstream` > `github` > `origin`) and resolve to the upstream parent on a fork clone.

If `MATT_SUITE.present` is `false`, warn that `/to-issues` is a declared dependency and slicing
quality will degrade, then continue (non-blocking).

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

## Step 4 — Slice into vertical tracer bullets (compose `/to-issues`)

Decompose the PRD by **composing Matt's `/to-issues`** — do not reimplement it. Each slice is a thin
**vertical tracer bullet**: a narrow but COMPLETE path through ALL layers (schema, API, UI, tests),
demoable or verifiable on its own, ordered by a `blocked_by` DAG (no cycles). Do any prefactoring
first ("make the change easy, then make the easy change").

**Granularity heuristic (the litmus for "thin enough"):** one slice = **one demoable behaviour** —
thin enough that a single failing test can capture it and a minimal implementation can satisfy it, so
strict red/green (contract B) is safe. If a slice needs more than one failing test to express its
behaviour, or bundles two independently-demoable behaviours, split it. If a slice can't be
demonstrated without another, wire the dependency instead of merging.

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
read `TRACKER.type` / `TRACKER.coords` from config; never hardcode a tracker. Pin every host CLI call
to `REPO_REF` — `gh issue create --repo "<REPO_REF>" …` for GitHub, `--repository "<REPO_REF>"` for
Azure DevOps — so the issues land on the configured repository rather than the one the CLI infers
from the checkout. Publish in the dependency `order` from Step 8 (**blockers first**) so each issue
can reference the real tracker IDs of its blockers.

For each slice, build the issue body from `ISSUE_TEMPLATE` (use `BUG_TEMPLATE` for `type: bug`;
fall back to Matt's `/to-issues` body template if the config template is null). The body MUST carry
the slice's **acceptance criteria** (contract C — intent lives on the tracker issue) and its
**Blocked by** references (real tracker IDs, or "None — can start immediately"). Apply the
ready-for-agent triage label from `LABELS` unless the user says otherwise. Do NOT close or modify any
parent issue.

## Step 10 — Tickets gate (HITL)

The plan is human-approved via a PR — never merge it yourself. Behaviour follows `GATE`:

**Staging rule (both gates).** Stage paths you have named — here, `issues.json` alone. Never
`git add -A`, `git add .`, `git add -u`, or a bare directory. Never stage `pr-body.md` (or
`.pr-body.md`), `*.tmp.md`, `*.scratch.md`, `*-report.md` at the repo root, or anything under
Archon's per-run artifacts dir (the `$ARTIFACTS_DIR` environment variable, which resolves outside the
repo under `~/.archon/workspaces/<name>/artifacts/` — not the in-repo `ARTIFACTS_DIR` config value,
whose `issues.json` you do commit). After staging, run `git status --porcelain` and confirm every
staged entry is a path you named; `git restore --staged "<path>"` anything else before you commit.

**Repository pinning rule (`open-pr` gate).** Pass `REPO_REF` explicitly: `--repo "<REPO_REF>"` for
GitHub, `--repository "<REPO_REF>"` for Azure DevOps. If `REPO_REF` is null or empty, do **not** open
the PR: print

```
project.repo_ref is not set in .archon/unic-dlc.config.yaml. Without it the host CLI infers the
repository from the checkout and opens the PR against the upstream parent on a fork clone. Set
project.repo_ref (run /unic-archon-dlc:setup, or add the key by hand), then re-run this gate.
```

then fall back to `stage-only` behaviour below and **stop**. This mirrors the Archon boxes, which
cancel on the same missing key rather than failing.

- **`open-pr`** (default): create `feature/tickets/<SLUG>`, stage `issues.json`, commit, and open a
  PR to `develop`, then **stop** for human review:

  ```bash
  git checkout -b feature/tickets/<SLUG>
  git add <ARTIFACTS_DIR>/<SLUG>/issues.json
  git status --porcelain                      # confirm nothing else is staged
  git commit -m "tickets(<SLUG>): vertical-slice issues"
  git push origin feature/tickets/<SLUG>
  gh pr create --repo "<REPO_REF>" --base develop --title "tickets(<SLUG>): vertical-slice issues" --body "<why + slice summary + tracker links>"
  ```

  For Azure DevOps the last line becomes
  `az repos pr create --repository "<REPO_REF>" --target-branch develop --title "…" --description "…"`.
  (Adapt the host commands to `TRACKER` if the project is not GitHub; the repository is always pinned,
  whichever host.) On **reject**, return to Step 4 and revise the breakdown, then re-run from Step 8.

- **`stage-only`**: write `issues.json` (already done in Step 8) and `git add` it **by name** (same
  staging rule), print a suggested PR title/body, and **stop** — leave the branch, commit, push, and
  PR to the user.

## Step 11 — Summary

Print a concise summary:

```
/tickets complete — slug: <SLUG>
  issues:   <ARTIFACTS_DIR>/<SLUG>/issues.json (<count> slices)
  order:    <id → id → …>  (dependency order)
  tracker:  <published issue refs>
  gate:     <open-pr → PR #… | stage-only → staged>
  next:     run /build <SLUG> once the tickets are approved
```
