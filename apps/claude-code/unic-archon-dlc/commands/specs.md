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
branch-on-input flow, the seam-approval halt, the PRD shape) while **composing the _how_**: the
`to-spec`, `grilling` and `domain-modeling` Methods for the conversation — read by resolved path, per
Step 1 — and the configured docs / design / tracker system-skill (MCP-first, CLI-fallback) to read an
existing source.

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
        const wanted = ['to-spec', 'grilling', 'domain-modeling']
        const methods = wanted.map((name) => {
          const m = resolver.resolveMethod(name, { repoRoot: cwd, config, box: 'specs' })
          return 'error' in m ? { name, error: m.message } : { name, path: m.path, tier: m.tier }
        })
        output = {
          ok: true,
          artifacts_dir: config.artifacts_dir,
          docs: config.docs,
          design: config.design,
          estimations: config.estimations,
          specs: config.specs,
          prd_template: g('templates.prd'),
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
`ARTIFACTS_DIR`, `DOCS` (`.type`/`.publish`/`.access`),
`DESIGN` (`.type`/`.access`), `ESTIMATIONS`, `DISCUSS_MODE` (`specs.discuss_mode`), `GATE`
(`specs.gate`), `PRD_TEMPLATE`, and `METHODS`.

### Read the tracker contract

`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` in this repository are the tracker
contract. `/specs` files nothing, so it needs only the first, and only when Step 3 ingests an existing
tracker item. Read it then:

- **Access** — its § Access names the MCP server or skill that serves this tracker. Read that server's
  own current tool list and build the call from it. Name no provider and write no command, subcommand
  or flag ([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)).
- **Addressing** — its § Addressing names the repository this run acts on. Name it explicitly, and
  derive nothing from a remote URL.
- **Work-item scope** — its § Work-item scope names the filter every search applies.

If the file is absent when Step 3 needs it, say so and ingest from the other sources instead. Print
the repository § Addressing names with the tier line below, so a surprising target is diagnosable.

### The Methods this Box reads

`METHODS` carries one entry per Method — `to-spec`, `grilling`, `domain-modeling` — with the tier it
resolved from: `config` (a `methods.<name>.source` the team declared), `local`
(`.archon/methods.local/`), or `bundle` (`.archon/methods/`, written by `/unic-archon-dlc:setup`).

If any entry carries `error`, print it verbatim and **stop**. A Box cannot run a procedure it cannot
read; the fix is to run `/unic-archon-dlc:setup`.

Otherwise print the tier line before continuing, so a surprising result is diagnosable:

```
methods: to-spec(bundle) · grilling(bundle) · domain-modeling(bundle)
```

Then read each entry's `path` in full. That text **is** the procedure — the steps below add only what
the Harness owns, and never restate, summarise or improve a Method
([ADR-0030](docs/adr/0030-harness-hosts-methods.md)). A Method's sub-files sit beside its resolved
`SKILL.md`, in the same directory, at every tier.

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
  - `discuss` (default) → follow the resolved **`grilling`** Method, and the resolved
    **`domain-modeling`** Method for the terms and ADRs that crystallise as you go. Its
    `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` — in the same directory as its resolved `SKILL.md` — are
    the shapes any ADR or `CONTEXT.md` edit must follow.
  - `assumptions` → enumerate **all** your assumptions about the feature upfront as a numbered list,
    then walk the user through confirming/correcting each. `domain-modeling` still applies as
    decisions settle.
- **Existing spec / Figma / UX / tracker issue** (a URL or ref) → **ingest**. Read the source by
  **composing the configured system-skill** (MCP-first, CLI-fallback):
  - docs (`DOCS.type` is set) → the team's docs skill / MCP via `DOCS.access`;
  - design (`DESIGN.type` is set) → the team's design skill / MCP via `DESIGN.access`;
  - tracker item → the server `docs/agents/issue-tracker.md` § Access names, addressing the
    repository its § Addressing names.
    Synthesise what the source says, then have the **human review** your synthesis (the #257 model).
    Reuse `to-spec`'s PRD _shaping_; there is nothing to interview, so `grilling` does not apply here.
- **Partial** (a source exists but has gaps) → **hybrid**. Ingest what exists (as above), then grill
  **only the gaps** per `DISCUSS_MODE`.

### Confirm shared understanding before anything is written

Do not write the PRD until the user confirms the design is settled. What satisfies this depends on the
branch you took:

| Branch                             | What satisfies the confirmation                            |
| ---------------------------------- | ---------------------------------------------------------- |
| converse, `DISCUSS_MODE = discuss` | ask "have we reached a shared understanding?" and wait     |
| converse, `assumptions`            | the walk through the assumptions reaches agreement         |
| ingest / hybrid                    | the human review of your synthesis (the #257 model, above) |

This fires when the interview **reaches** shared understanding, however many turns that took — it is
not "the last question". On **no**, return into the interview; there is no cap on how often that
happens. Never count, cap or restate the interview: how many questions a Method asks is the Method's
business, not this Box's.

## Step 5 — Seam-design approval

Before writing the PRD, propose the **testing seams** at which the feature will be verified, following
the resolved `to-spec` Method's seam guidance. Present the proposed seam(s) and **get the user's
explicit confirmation** that they match expectations. The approved seams become the PRD's **Testing
Decisions** section. Do not proceed to Step 7 without this confirmation.

## Step 6 — Estimation (config-gated)

If `ESTIMATIONS` is `provisional` or `both`, **compose** an estimator (never build one) to attach a
**provisional** estimate to the PRD — a coarse size, with the definitive estimate deferred to
`/tickets`. If `ESTIMATIONS` is `off` or `definitive`, skip this step.

## Step 7 — Write the PRD

Shape the agreed design into the sections of `PRD_TEMPLATE` (the config-driven template — fall back
to the built-in default if it is null), using the project's domain vocabulary and respecting the
ADRs in scope. Follow the resolved `to-spec` Method's guidance for each section, with the approved
seams from Step 5 as the Testing Decisions.

Two things in `to-spec` are **overridden** here, because the Harness owns them:

- Its final step publishes the spec to the issue tracker with a `ready-for-agent` label. In the DLC
  `/specs` writes `<ARTIFACTS_DIR>/<SLUG>/PRD.md` (below) and optionally publishes to `DOCS`. Filing
  tracker issues is `/tickets`' job — do not file any here.
- Its "the issue tracker and triage label vocabulary should have been provided to you — run
  `/setup-matt-pocock-skills` if not" fallback never applies. `docs/agents/issue-tracker.md` and
  `docs/agents/triage-labels.md` are that vocabulary, and `setup-matt-pocock-skills` must not be run
  over them: it writes another host's template over the first and reverts the second to a five-role
  `wontfix` vocabulary ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md), amended).

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
the PRD to the team's docs system by **composing the docs skill registered under `DOCS.access`** —
whichever one that is. Expect it to write through injection markers, so a human-authored source is
never overwritten; if it cannot, publish nothing and say so. The repo copy at
`<ARTIFACTS_DIR>/<SLUG>/PRD.md` is always the floor; publishing is additive.

## Step 8 — PRD gate (HITL)

`GATE` is the **single approval gate** in `/specs`: the one halt that produces a durable artefact and
puts it in front of a human. The Step 4 confirmation and the Step 5 seam check are in-method
confirmations, not gates — they settle the design, they approve nothing. This is also where
`grilling`'s "do not enact the plan until I confirm we have reached a shared understanding" lands: in
`/specs`, enacting the plan means writing and PR-ing the PRD, and that is exactly what this gate holds.

The PRD is human-approved via a PR — never merge it yourself. Behaviour follows `GATE`:

Both gates stage the **same named paths**, and nothing else:

- `<ARTIFACTS_DIR>/<SLUG>/PRD.md`
- each ADR this session created, by its own filename — `docs/adr/NNNN-<name>.md`, one `git add` per
  file. Never `git add docs/adr/`: that directory holds every ADR the project has, and a sweep of it
  commits whatever else is uncommitted there.

**Staging rule — named paths only.** Run one `git add <path>` per path above. Never `git add -A`,
`git add .`, or `git add -u`. Never stage `pr-body.md`, `*.tmp.md`, `*.scratch.md`, or anything under
`$ARTIFACTS_DIR` (Archon's per-run directory, which resolves outside the repo tree under
`~/.archon/workspaces/<name>/artifacts/`; `<ARTIFACTS_DIR>` from config is a different, repo-relative
path and is staged above). Then run `git status --porcelain` and confirm every staged entry is one of
the named paths. Unstage anything else with `git restore --staged <path>` and say what you unstaged.

- **`open-pr`** (default): create `feature/specs/<SLUG>`, stage the named paths, commit, push, and
  open a PR to `develop`, then **stop** for human review:

  ```bash
  git checkout -b feature/specs/<SLUG>
  git add <ARTIFACTS_DIR>/<SLUG>/PRD.md
  git add docs/adr/NNNN-<name>.md      # once per ADR created this session
  git status --porcelain               # confirm nothing else is staged
  git commit -m "plan(<SLUG>): PRD and ADRs"
  git push origin feature/specs/<SLUG>
  ```

  Then open the PR against the repository `docs/agents/issue-tracker.md` § Addressing names, base
  `develop`, title `plan(<SLUG>): PRD and ADRs`, body `<why + summary>`. Name that repository
  explicitly and derive nothing from a remote URL. Reach the host through the server its § Access
  names, reading that server's own current tool list to build the call: write no command, subcommand
  or flag here and name no provider — this Box owns the _what_ and none of the _how_
  ([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)). If the tracker contract is absent, or the
  server cannot target a repository explicitly, stop and say which of the two it was rather than
  opening the PR.

  On **reject**, return to Step 4 and grill the open points, then re-run from Step 7.

- **`stage-only`**: write the PRD (already done in Step 7), stage the same named paths under the same
  staging rule, print a suggested PR title/body, and **stop** — leave the commit, push, and PR to the
  user.

## Step 9 — Summary

Print a concise summary:

```
/specs complete — slug: <SLUG>
  path:     <ARTIFACTS_DIR>/<SLUG>/PRD.md
  repo:     <the repository docs/agents/issue-tracker.md § Addressing names>
  input:    <converse | ingest | hybrid>
  seams:    <the approved testing seam(s)>
  ADRs:     <NNNN-slug.md … | none>
  methods:  <name>(<tier>) · … (as printed in Step 1)
  gate:     <open-pr → PR #… | stage-only → staged>
  next:     run /tickets <SLUG> once the PRD is approved
```
