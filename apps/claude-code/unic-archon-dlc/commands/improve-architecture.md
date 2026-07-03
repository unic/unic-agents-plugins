---
argument-hint: '[<slug> | (empty = repo-wide sweep)]'
description: "Off-line architecture health: surface technical + intent drift and deepening opportunities, write a durable arch-review.md, and consolidate ADRs (including superseding). Composes Matt Pocock's improve-codebase-architecture verbatim and adds the DLC intent/artifact/ADR layers."
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
**delegates the _method_** for technical drift + deepening to Matt Pocock's
`improve-codebase-architecture` skill **verbatim**, composing `/codebase-design` for the architecture
vocabulary, `/grilling` for the design walk, and `/domain-modeling` to keep `CONTEXT.md` current.
Compose those skills by name — never reimplement or vendor them.

**What the DLC adds over the raw skill (why this box earns its place — [ADR-0021](docs/adr/0021-earns-its-place-compose-verbatim.md)):**
Matt's skill produces an ephemeral HTML deepening report + a design grill for **technical** drift. On
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
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/config-schema.mjs`).href)
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')
  const cwd = process.cwd()

  const yamlPath = join(cwd, '.archon', 'unic-dlc.config.yaml')
  if (!existsSync(yamlPath)) {
    // Off-line box: no config is fine — fall back to defaults and continue.
    const config = mod.mergeConfig()
    const g = (p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config)
    output = { ok: true, degraded: true, reason: 'no-config', artifacts_dir: config.artifacts_dir, docs: config.docs, matt_suite: g('skills.matt_suite') }
  } else {
    const r = mod.loadConfig(yamlPath)
    if ('error' in r) {
      const config = mod.mergeConfig()
      const g = (p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config)
      output = { ok: true, degraded: true, reason: `config-unreadable: ${r.message}`, artifacts_dir: config.artifacts_dir, docs: config.docs, matt_suite: g('skills.matt_suite') }
    } else {
      const config = mod.mergeConfig(r.config)
      const g = (p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config)
      output = {
        ok: true,
        degraded: false,
        artifacts_dir: config.artifacts_dir,
        docs: config.docs,
        matt_suite: g('skills.matt_suite'),
      }
    }
  }
} catch (err) {
  // Even a plugin load error should not stop an off-line review — default and warn.
  output = { ok: true, degraded: true, reason: `plugin-load: ${err?.message ?? String(err)}`, artifacts_dir: 'workflows', docs: null, matt_suite: null }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the JSON. Keep `ARTIFACTS_DIR` (default `workflows`), `DOCS`, and `MATT_SUITE`. If `degraded`
is `true`, print a one-line warning naming `reason` and note that `ARTIFACTS_DIR` fell back to
`workflows`, then continue. If `MATT_SUITE` is present and `MATT_SUITE.present` is `false`, warn that
`improve-codebase-architecture` + `/codebase-design` + `/grilling` + `/domain-modeling` are declared
dependencies and review quality will degrade, then continue (non-blocking).

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

## Step 3 — Technical drift + deepening (delegate to Matt's method)

Run the `improve-codebase-architecture` skill (`.agents/skills/improve-codebase-architecture/SKILL.md`)
**verbatim** — do not restate or reimplement its steps here. In summary it: reads `CONTEXT.md` +
relevant `docs/adr/` for grounding; uses an `Explore` agent to walk the codebase noting friction
(shallow modules, tight coupling, leaky abstractions, poor **locality**, hard-to-test seams); applies
the **deletion test**; presents candidates as a self-contained **HTML report** in the OS temp dir with
before/after diagrams and a top recommendation; then runs a **grilling loop** (via `/grilling`) on the
candidate the user picks, keeping the domain model current inline (via `/domain-modeling`) and offering
ADRs for load-bearing rejections.

Bind that method to the DLC:

- Use `CONTEXT.md`/`CONTEXT-MAP.md` for the **domain** vocabulary and the `/codebase-design` skill for
  the **architecture** vocabulary (deep modules, interface, depth, seam, adapter, leverage, locality;
  the deletion test; "the interface is the test surface"). Use these terms exactly.
- **Per-slug mode:** focus the Explore walk on the slug's changed surface — derive it from
  `report.md` and/or the build's diff (e.g. `git diff --name-only <base>..HEAD`, adapting the range) —
  but keep Matt's method and still surface repo-wide friction the change touches.
- **Repo-wide mode:** the full-codebase walk Matt's skill already performs.
- Note any candidate the grill loop marks "accept as ADR" or any load-bearing rejection worth
  recording — these feed Step 6.

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

Complement Matt's ephemeral HTML (which lands in the OS temp dir) with a durable markdown artifact
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
2. Step 3 / Step 4 findings marked "accept as ADR" and any load-bearing rejection Matt's grill loop
   surfaced (a decision a future explorer would need in order not to re-suggest the same thing).

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
  html:       <Matt's temp HTML path, if produced>
  ADRs:       accepted N | rejected M | edited-then-accepted K
  written:    <NNNN-*.md paths, or none>
  superseded: <ADR-NNNN → by ADR-MMMM, or none>
  next:       run /tickets to file follow-up issues · /build for a fix slice
  cadence:    off-line / on-demand — run every few build cycles or when you sense drift;
              there is no end-of-cycle auto-hook.
```
