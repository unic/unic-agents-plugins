---
argument-hint: '[<slug> | (empty = repo-wide sweep)]'
description: 'Off-line architecture health: surface technical + intent drift and deepening opportunities, write a durable arch-review.md, and consolidate ADRs (including superseding). Reads the improve-codebase-architecture Method verbatim and adds the DLC intent/artifact/ADR layers.'
---

# unic-archon-dlc:improve-architecture

> Design rationale: [ADR-0027 — `/improve-architecture` is a skill that composes Matt's method and owns ADR superseding](docs/adr/0027-improve-architecture-skill-superseding.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); earns-its-place per [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md); artifact home per [ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md); tracker/ADRs are the source of truth per [ADR-0013](docs/adr/0013-tracker-single-source-of-truth.md)).

**Arguments:** "$ARGUMENTS"

`/improve-architecture` is an **off-line, on-demand** box: it surfaces architectural drift +
deepening opportunities and **consolidates ADRs (including superseding older ones)**. It runs off the
main line — periodically or when you sense drift, **not** per-feature and **not** as an end-of-cycle
auto-hook. It is an **in-session command/skill** because design grilling needs the live conversation
(inherently HITL — [ADR-0017](docs/adr/0017-container-follows-structural-need.md)).

It is a **thin composing wrapper**: it **owns the _what_** — the DLC config binding, the durable
`arch-review.md` artifact, the intent-drift pass against the PRD, and the ADR-superseding gate — and
**delegates the procedure** for technical drift + deepening to the `improve-codebase-architecture`
Method **verbatim**, with `codebase-design` for the architecture vocabulary, `grilling` for the design
walk, and `domain-modeling` to keep `CONTEXT.md` current. All four are read by resolved path, per
Step 1.

**What the DLC adds over the raw Method (why this box earns its place — [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)):**
The Method produces an ephemeral HTML deepening report + a design grill for **technical** drift. On
top of that this box adds (a) an **intent-drift** pass comparing the PRD's stories/acceptance
criteria against what shipped, (b) a **durable `arch-review.md`** committed under the artifacts dir,
and (c) an **ADR-consolidation gate with superseding** across both ADR homes.

Follow these steps in order. Do not skip any step.

> **Shell requirement**: Step 1 uses `<<'EOJS'` heredoc syntax, which requires a POSIX-compatible
> shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not support heredocs. All
> filesystem work uses Node's `node:fs`/`node:path`, so paths are cross-platform.

## Step 1 — Load config (lenient)

`/improve-architecture` reads (never writes) `.archon/unic-dlc.config.yaml`. Unlike the tracker-bound
boxes, it is **off-line and touches no tracker**, so a missing or incomplete config is
**non-blocking** — it degrades to defaults and continues. Run:

```bash
node --input-type=module <<'EOJS'
let output
try {
  const { pathToFileURL } = await import('node:url')
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
  const mod = await import(pathToFileURL(join(pluginRoot, 'lib', 'config-schema.mjs')).href)
  const resolver = await import(pathToFileURL(join(pluginRoot, 'lib', 'methods-resolver.mjs')).href)
  const cwd = process.cwd()

  // Method resolution is fatal even when the config load degrades — see the prose below.
  const wanted = ['improve-codebase-architecture', 'codebase-design', 'grilling', 'domain-modeling']
  const resolveAll = (config) => wanted.map((name) => {
    const m = resolver.resolveMethod(name, { repoRoot: cwd, config, box: 'improve-architecture' })
    return 'error' in m ? { name, error: m.message } : { name, path: m.path, tier: m.tier }
  })

  const yamlPath = join(cwd, '.archon', 'unic-dlc.config.yaml')
  if (!existsSync(yamlPath)) {
    // Off-line box: no config is fine — fall back to defaults and continue.
    const config = mod.mergeConfig()
    output = { ok: true, degraded: true, reason: 'no-config', artifacts_dir: config.artifacts_dir, docs: config.docs, methods: resolveAll(config) }
  } else {
    const r = mod.loadConfig(yamlPath)
    if ('error' in r) {
      const config = mod.mergeConfig()
      output = { ok: true, degraded: true, reason: `config-unreadable: ${r.message}`, artifacts_dir: config.artifacts_dir, docs: config.docs, methods: resolveAll(config) }
    } else {
      const config = mod.mergeConfig(r.config)
      output = {
        ok: true,
        degraded: false,
        artifacts_dir: config.artifacts_dir,
        docs: config.docs,
        methods: resolveAll(config),
      }
    }
  }
} catch (err) {
  // Even a plugin load error should not stop an off-line review — default and warn.
  output = { ok: true, degraded: true, reason: `plugin-load: ${err?.message ?? String(err)}`, artifacts_dir: 'workflows', docs: null, methods: [] }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the JSON. Keep `ARTIFACTS_DIR` (default `workflows`), `DOCS`, and `METHODS`. If `degraded` is
`true`, print a one-line warning naming `reason` and note that `ARTIFACTS_DIR` fell back to
`workflows`, then continue.

### The Methods this Box reads

`METHODS` carries one entry per Method — `improve-codebase-architecture`, `codebase-design`,
`grilling`, `domain-modeling` — with the tier it resolved from: `config` (a `methods.<name>.source`
the team declared), `local` (`.archon/methods.local/`), or `bundle` (`.archon/methods/`, written by
`/unic-archon-dlc:setup`).

**Method resolution is fatal here, unlike the config load.** If any entry carries `error`, or
`METHODS` is empty, print it and **stop** — do not degrade. Config carries _parameters_ (which, where,
whether), and this Box can sensibly default those; a Method carries the _procedure_, and there is no
default for that. The fix is to run `/unic-archon-dlc:setup`.

Otherwise print the tier line before continuing, so a surprising result is diagnosable:

```
methods: improve-codebase-architecture(bundle) · codebase-design(bundle) · grilling(bundle) · domain-modeling(bundle)
```

Then read each entry's `path` in full. That text **is** the procedure — the steps below add only the
DLC layers named above, and never restate, summarise or improve a Method
([ADR-0030](docs/adr/0030-harness-hosts-methods.md)). A Method's sub-files sit beside its resolved
`SKILL.md`, in the same directory, at every tier: `HTML-REPORT.md` for
`improve-codebase-architecture`; `DEEPENING.md` and `DESIGN-IT-TWICE.md` for `codebase-design`.

## Step 2 — Determine mode

Read `$ARGUMENTS`:

- **Non-empty → per-slug mode.** Treat the argument as a Slug. Resolve the session dir
  `<ARTIFACTS_DIR>/<slug>/` and read, if present: `PRD.md` (intent), `report.md` (technical
  outcome + "Decisions Made"), and `issues.json` (breakdown). A missing file is **not** fatal — warn
  that the source is unavailable and degrade the passes that rely on it (e.g. no `PRD.md` → the
  intent-drift pass in Step 4 downgrades to "no PRD anchor available for `<slug>`").
- **Empty → repo-wide sweep mode.** Review the whole codebase with no PRD anchor. The intent-drift
  pass (Step 4) is **skipped** and recorded as `n/a — repo-wide sweep`.

State the resolved mode to the user before continuing.

## Step 3 — Technical drift + deepening (delegate to the Method)

Follow the resolved `improve-codebase-architecture` Method **verbatim**, including its `HTML-REPORT.md`
for the report scaffold, diagram patterns and styling. Where it calls for grilling, follow the resolved
`grilling` Method; where it keeps the domain model current, the resolved `domain-modeling` Method.

Bind that procedure to the DLC:

- Use `CONTEXT.md`/`CONTEXT-MAP.md` for the **domain** vocabulary and the resolved `codebase-design`
  Method for the **architecture** vocabulary (deep modules, interface, depth, seam, adapter, leverage,
  locality; the deletion test; "the interface is the test surface"). Use these terms exactly.
- **Per-slug mode:** focus the Explore walk on the slug's changed surface — derive it from
  `report.md` and/or the build's diff (e.g. `git diff --name-only <base>..HEAD`, adapting the range) —
  but keep the Method's procedure and still surface repo-wide friction the change touches.
- **Repo-wide mode:** the full-codebase walk the Method already performs.
- **Defer every ADR to Step 6 — do not write one here.** The Method offers to record a
  load-bearing rejection as an ADR inline (using its own template); in the DLC that offer is
  **capture-only**. Do **not** accept, number, or write any ADR during Step 3, and do not let the
  delegated procedure write one — instead record each proposed decision (the "accept as ADR" candidates
  and load-bearing rejections) as a candidate and hand it to Step 6. Step 6 is the **single place**
  ADRs are written, so the A/R/E gate, MADR-lite format, both-homes numbering, and superseding/index
  mechanics always apply and ADRs can never drift into an inconsistent format or bypass the gate.

## Step 4 — Intent drift (DLC value-add — per-slug mode only)

**Skip in repo-wide mode** (record `Intent Drift: n/a — repo-wide sweep, no PRD anchor` in Step 5).

In per-slug mode, compare the PRD's user stories + acceptance criteria against what shipped
(`report.md` + the diff). This is behaviour drift, distinct from the technical/structural drift of
Step 3:

- Delivered behaviour that **diverges** from what the PRD describes (wrong behaviour, not merely
  imperfect code).
- Acceptance criteria **silently dropped or narrowed** during build.
- Behaviour **added** during build that was not in the PRD (scope creep).

For each finding, note: the PRD section referenced, what was described vs what was delivered, and a
recommended action — **fix now**, **create a follow-up issue** (flows into `/tickets`), or **accept as
an ADR** (feeds Step 6). If no `PRD.md` was found for the slug, record `Intent Drift: no PRD anchor
available for <slug>` and continue.

## Step 5 — Write the durable arch-review report

Complement the Method's ephemeral HTML (which lands in the OS temp dir) with a durable markdown artifact
committed to the repo ([ADR-0015](docs/adr/0015-workflows-slug-artifact-home.md)). All file IO via
Node `node:fs`/`node:path`.

- **Per-slug mode** → `<ARTIFACTS_DIR>/<slug>/arch-review.md`
- **Repo-wide sweep** → `<ARTIFACTS_DIR>/arch-review-YYYY-MM-DD.md` (today's date; non-slug)

Write these sections:

```markdown
## Architecture Review — <slug | repo-wide YYYY-MM-DD>

### Technical Drift

<findings from Step 3, or "No technical drift detected.">

### Intent Drift

<findings from Step 4, or "n/a — repo-wide sweep, no PRD anchor" | "No intent drift detected.">

### Deepening Opportunities

<at least one suggestion, or "None identified.">

### Summary

CLEAN | ISSUES FOUND (<count>)
```

Print the absolute path written.

## Step 6 — ADR consolidation with superseding (per-ADR A/R/E gate)

Get explicit human approval before writing or amending any ADR.

### Collect candidates

Gather decisions from:

1. `report.md` "Decisions Made" (per-slug mode).
2. Step 3 / Step 4 findings marked "accept as ADR" and any load-bearing rejection the Method's grill
   loop surfaced (a decision a future explorer would need in order not to re-suggest the same thing).

If there are no candidates, say so and skip to Step 7.

### Gate each candidate individually

Present each candidate and wait for **A / R / E**:

```
---
ADR Candidate N of M
Proposed file: <home>/docs/adr/NNNN-<slug>.md      (home = plugin-local | repo-root)
Status: Proposed
Supersedes: ADR-NNNN  (omit if it supersedes nothing)
Context: <one paragraph — what situation prompted this decision>
Decision: <one sentence — what was decided>
Consequences: <bullet list — trade-offs accepted>
---
Accept (A) / Reject (R) / Edit (E)?
```

- **Choose the ADR home.** Infer from what the decision concerns and **confirm with the user**: a
  decision about one plugin → that plugin's `docs/adr/` (e.g.
  `apps/claude-code/<plugin>/docs/adr/`); a cross-cutting / monorepo-wide decision → the repo-root
  `docs/adr/`. Both homes use MADR-lite (`# NNNN. Title` · `**Status:** Accepted (YYYY-MM)` ·
  `## Context` / `## Decision` / `## Consequences`) and per-directory zero-padded numbering — see the
  root `docs/adr/README.md`.
- **A (Accept):** compute the next `NNNN` = highest existing number in the **chosen home** + 1 (scan
  that dir's files). Write the ADR. Print `ADR written: <home>/docs/adr/NNNN-<slug>.md`.
- **R (Reject):** skip. Print `ADR skipped: <title>`.
- **E (Edit):** re-show the draft, let the user revise Context / Decision / Consequences / home /
  Supersedes, then re-present for A/R.

### Superseding mechanics (never delete an ADR)

When an accepted ADR supersedes an existing one:

1. In the **old** ADR file, change its status line to `**Status:** Superseded by ADR-NNNN`.
2. In the **new** ADR, add a `Supersedes ADR-NNNN` reference (in the status area or Context).
3. Update the **matching home's** `README.md` index: set the **old** row's Status cell to
   `Superseded by ADR-NNNN`, and add a **new** row for `NNNN`. (Each home has its own index —
   plugin-local `docs/adr/README.md` and repo-root `docs/adr/README.md`.)

An ADR in one home may supersede an ADR in the other; amend whichever home(s) the two files live in.

## Step 7 — Summary

Print a concise summary:

```
/improve-architecture complete — mode: <per-slug <slug> | repo-wide sweep>
  report:     <path to arch-review.md>
  summary:    <CLEAN | ISSUES FOUND (count)>
  html:       <the Method's temp HTML path, if produced>
  methods:    <name>(<tier>) · … (as printed in Step 1)
  ADRs:       accepted N | rejected M | edited-then-accepted K
  written:    <NNNN-*.md paths, or none>
  superseded: <ADR-NNNN → by ADR-MMMM, or none>
  next:       run /tickets to file follow-up issues · /build for a fix slice
  cadence:    off-line / on-demand — run every few build cycles or when you sense drift;
              there is no end-of-cycle auto-hook.
```
