---
argument-hint: '<slug> [spec/Figma/issue URL … | free-form idea]'
description: 'Turn an idea (or an existing spec / Figma / UX) into one human-approved PRD: grill or ingest, approve the testing seams, write <artifacts_dir>/<slug>/PRD.md, and open the PRD gate.'
---

# unic-archon-dlc:specs

> Design rationale: [ADR-0020 — `/specs` reaches an aligned PRD by branch-on-input](docs/adr/0020-specs-branch-on-input.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); template-in-config per [ADR-0018](docs/adr/0018-generic-core-config-compose.md)).

**Arguments:** "$ARGUMENTS"

`/specs` is the **first main-line box**: it turns an idea into **one human-approved PRD** by the
cheapest path given what already exists, then hands off to `/tickets`. It is an **in-session
command/skill** (grilling needs the live conversation — ADR-0017), and it **owns the _what_** (the
branch-on-input flow, the seam-approval gate, the PRD shape) while **composing the team's
system-skills for the _how_**: Matt Pocock's `/grill-with-docs` + `/to-prd` for the conversation, and
the configured docs / design / tracker skill (MCP-first, CLI-fallback) to read an existing source.
Compose those skills by name — never reimplement or vendor them.

Follow these steps in order. Do not skip any step. The only files you write are the PRD
(`<artifacts_dir>/<slug>/PRD.md`) and any ADRs that crystallise during grilling; everything else is
conversation, until the gate in Step 8.

> **Shell requirement**: Steps 1 and 7 use `<<'EOJS'` heredoc syntax, which requires a
> POSIX-compatible shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not
> support heredocs. All filesystem work uses Node's `node:fs`/`node:path`, so paths are
> cross-platform.

## Step 1 — Load config

`/specs` reads (never writes) `.archon/unic-dlc.config.yaml`. Run:

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
          design: config.design,
          estimations: config.estimations,
          specs: config.specs,
          prd_template: g('templates.prd'),
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
`ARTIFACTS_DIR`, `TRACKER` (`.type`/`.access`/`.coords`), `DOCS` (`.type`/`.publish`/`.access`),
`DESIGN` (`.type`/`.access`), `ESTIMATIONS`, `DISCUSS_MODE` (`specs.discuss_mode`), `GATE`
(`specs.gate`), `PRD_TEMPLATE`, and `MATT_SUITE`.

If `MATT_SUITE.present` is `false`, warn that `/grill-with-docs` + `/to-prd` are declared
dependencies and grilling quality will degrade, then continue (non-blocking).

## Step 2 — Slug + re-entry

Parse the first whitespace-delimited token of `$ARGUMENTS` as `SLUG` (kebab-case). Everything after
it is the `SOURCE` (a URL / issue ref, or a free-form idea, or empty). If `$ARGUMENTS` is empty, ask
the user for a slug and stop until you have one.

Check whether `<ARTIFACTS_DIR>/<SLUG>/PRD.md` already exists. If it does, this is a **re-entry**
(e.g. the gate was rejected). Read it, summarise it back, and ask whether to **revise** it (continue
from where it left off) or start over — never silently clobber an existing PRD.

## Step 3 — Load context

Ground yourself before grilling. Read, if present: root `CONTEXT.md` / `CONTEXT-MAP.md`, per-context
`CONTEXT.md` files, all ADRs in `docs/adr/`, and `<ARTIFACTS_DIR>/<SLUG>/findings.md` (seeded by a
prior `/explore` run). Summarise the **Domain Model**, **Established Decisions**, and **Prior
Research** you found — this is the backdrop every question and the PRD must respect.

## Step 4 — Branch on input (ADR-0020)

Classify `SOURCE` and take the cheapest path to an aligned understanding:

- **Raw idea** (no source, or free-form prose only) → **converse**. Run the interview per
  `DISCUSS_MODE`:
  - `discuss` (default) → invoke **`/grill-with-docs`** (it runs `/grilling` + `/domain-modeling`):
    one question at a time, each with a **recommended answer**; challenge assumptions; explore the
    codebase to answer a question rather than asking when you can. Write ADRs live (via
    `/domain-modeling`) only when a decision is hard to reverse, surprising, and a real trade-off.
  - `assumptions` → enumerate **all** your assumptions about the feature upfront as a numbered list,
    then walk the user through confirming/correcting each; still write live ADRs via
    `/domain-modeling` as decisions settle.
- **Existing spec / Figma / UX / tracker issue** (a URL or ref) → **ingest**. Read the source by
  **composing the configured system-skill** (MCP-first, CLI-fallback):
  - docs (`DOCS.type` = `confluence`) → the team's docs skill / MCP via `DOCS.access`;
  - design (`DESIGN.type` = `figma`) → the Figma skill / MCP via `DESIGN.access`;
  - tracker issue → the tracker skill / CLI via `TRACKER.access`.
    Synthesise what the source says, then have the **human review** your synthesis (the #257 model):
    reuse `/to-prd`'s PRD _shaping_, but not `/grill-with-docs`.
- **Partial** (a source exists but has gaps) → **hybrid**. Ingest what exists (as above), then grill
  **only the gaps** per `DISCUSS_MODE`.

Continue until the user signals the design is settled.

## Step 5 — Seam-design approval (compose `/to-prd`)

Before writing the PRD, propose the **testing seams** at which the feature will be verified —
following `/to-prd`: prefer existing seams over new ones; use the highest seam possible; the fewer
seams across the codebase the better, **ideally one**. Present the proposed seam(s) and **get the
user's explicit confirmation** that they match expectations. The approved seams become the PRD's
**Testing Decisions** section. Do not proceed to Step 7 without this confirmation.

## Step 6 — Estimation (config-gated)

If `ESTIMATIONS` is `provisional` or `both`, **compose** an estimator (never build one) to attach a
**provisional** estimate to the PRD — a coarse size, with the definitive estimate deferred to
`/tickets`. If `ESTIMATIONS` is `off` or `definitive`, skip this step.

## Step 7 — Write the PRD

Shape the agreed design into the sections of `PRD_TEMPLATE` (the config-driven template — fall back
to the built-in default if it is null), using the project's domain vocabulary and respecting the
ADRs in scope. Follow `/to-prd`'s guidance for each section (User Stories extensive; Implementation
Decisions carry interfaces/contracts but **no file paths or code snippets**, which rot; Testing
Decisions carry the approved seams from Step 5).

Substitute `{PRD_CONTENT_JSON}` with the rendered PRD markdown as a JSON string, and
`{ARTIFACTS_DIR_JSON}` / `{PRD_TEMPLATE_JSON}` with the config values (all placed directly inside the
heredoc — never via shell variables), then run:

```bash
node --input-type=module <<'EOJS'
let result
try {
  const { pathToFileURL } = await import('node:url')
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/prd-writer.mjs`).href)
  const cwd = process.cwd()
  const content = {PRD_CONTENT_JSON}
  const artifactsDir = {ARTIFACTS_DIR_JSON}
  const template = {PRD_TEMPLATE_JSON}

  // Required headings come from the active template (## lines), falling back to the canonical set.
  const fromTemplate = typeof template === 'string'
    ? [...template.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1])
    : []
  const headings = fromTemplate.length > 0 ? fromTemplate : mod.DEFAULT_PRD_HEADINGS
  const check = mod.validatePrdSections(content, headings)
  if (!check.valid) {
    result = { ok: false, message: `PRD is missing sections: ${check.missingSections.join(', ')}` }
  } else {
    mod.writePrd(cwd, {SLUG_JSON}, content, artifactsDir)
    result = { ok: true, path: `${artifactsDir}/{SLUG_RAW}/PRD.md` }
  }
} catch (err) {
  result = { ok: false, message: `PRD write error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(result) + '\n')
EOJS
```

Replace `{SLUG_JSON}` with the JSON-encoded slug and `{SLUG_RAW}` with the bare slug. Parse the
output: if `ok` is `false`, fix the missing sections and re-run; if `ok` is `true`, note `path`.

**Docs publish (opt-in):** if `DOCS.publish` is `true` and `DOCS.type` is not `none`, also publish
the PRD to the team's docs system by **composing the configured docs skill** (e.g. `unic-confluence`
for Confluence — its injection markers guarantee the human-authored source is never overwritten).
The repo copy at `<ARTIFACTS_DIR>/<SLUG>/PRD.md` is always the floor; publishing is additive.

## Step 8 — PRD gate (HITL)

The PRD is human-approved via a PR — never merge it yourself. Behaviour follows `GATE`:

- **`open-pr`** (default): create `feature/specs/<SLUG>`, stage the PRD and any new ADRs, commit, and
  open a PR to `develop`, then **stop** for human review:

  ```bash
  git checkout -b feature/specs/<SLUG>
  git add <ARTIFACTS_DIR>/<SLUG>/PRD.md docs/adr/
  git commit -m "plan(<SLUG>): PRD and ADRs"
  git push origin feature/specs/<SLUG>
  gh pr create --base develop --title "plan(<SLUG>): PRD and ADRs" --body "<why + summary>"
  ```

  (Adapt the tracker/host commands to `TRACKER` if the project is not GitHub.) On **reject**, return
  to Step 4 and grill the open points, then re-run from Step 7.

- **`stage-only`**: write the PRD (already done in Step 7) and `git add` it plus any new ADRs, print a
  suggested PR title/body, and **stop** — leave the branch, commit, push, and PR to the user.

## Step 9 — Summary

Print a concise summary:

```
/specs complete — slug: <SLUG>
  path:     <ARTIFACTS_DIR>/<SLUG>/PRD.md
  input:    <converse | ingest | hybrid>
  seams:    <the approved testing seam(s)>
  ADRs:     <NNNN-slug.md … | none>
  gate:     <open-pr → PR #… | stage-only → staged>
  next:     run /tickets <SLUG> once the PRD is approved
```
