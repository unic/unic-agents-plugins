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

## Step 1 — Load config

`/specs` reads (never writes) `.archon/unic-dlc.config.yaml`. Read it with your own tools. Do not shell
out to Node, do not import a Plugin module, and do not read `$CLAUDE_PLUGIN_ROOT`: an installed Plugin
ships no `node_modules`, and that variable is not set inside the Bash tool
([ADR-0023](docs/adr/0023-build-generic-red-green-refactor-loop.md) §5). The four Archon Boxes read
their config this way already; this is the same shape.

If the file is absent or unreadable, print
`No readable .archon/unic-dlc.config.yaml. Run /unic-archon-dlc:setup first.` and **stop**. That is the
only config condition that stops this Box: **no key is mandatory**. Take each key below, and use the
default beside it whenever the key is absent or null.

| Key                                          | Default                         | Keep as         |
| -------------------------------------------- | ------------------------------- | --------------- |
| `artifacts_dir`                              | `workflows`                     | `ARTIFACTS_DIR` |
| `docs.type` · `docs.publish` · `docs.access` | `markdown` · `false` · unset    | `DOCS`          |
| `design.type` · `design.access`              | `none` · unset                  | `DESIGN`        |
| `estimations`                                | `off`                           | `ESTIMATIONS`   |
| `specs.discuss_mode`                         | `discuss`                       | `DISCUSS_MODE`  |
| `specs.gate`                                 | `open-pr`                       | `GATE`          |
| `templates.prd`                              | unset — Step 7 owns the default | `PRD_TEMPLATE`  |

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
the repository § Addressing names, so a surprising target is diagnosable.

### The Methods this Box reads

Read these three files in full, at exactly these paths:

- `.archon/methods/to-spec/SKILL.md`
- `.archon/methods/grilling/SKILL.md`
- `.archon/methods/domain-modeling/SKILL.md`

A Method lives at one path and this is it — the same literal path the Archon Boxes read. If any of the
three is absent, print that exact path followed by `Run /unic-archon-dlc:setup.` and **stop**: a Box
cannot run a procedure it cannot read. When all three are present, print nothing and continue.

That text **is** the procedure — the steps below add only what the Harness owns, and never restate,
summarise or improve a Method ([ADR-0030](docs/adr/0030-harness-hosts-methods.md)). A Method's
sub-files sit beside its `SKILL.md`, in the same directory.

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

Check the rendered PRD against the active template before you write anything: every `##` heading in
`PRD_TEMPLATE` must appear in the content. When `PRD_TEMPLATE` is unset, these seven are the required
headings, and this scaffold is the default PRD shape:

```markdown
# Product Requirements Document

_Generated by unic-archon-dlc /specs._

## Problem Statement

<!-- From the user's perspective: what problem, for whom, why now. -->

## Solution

<!-- From the user's perspective: what we build and how it resolves the problem. -->

## User Stories

<!-- Extensive numbered list: As an <actor>, I want <feature>, so that <benefit>. -->

## Implementation Decisions

<!-- Modules built/modified, interfaces, schema/API contracts. No file paths or code (they rot). -->

## Testing Decisions

<!-- Approved testing seams (fewest, ideally one), what makes a good test, prior art in the repo. -->

## Out of Scope

<!-- What this PRD explicitly does not cover. -->

## Further Notes

<!-- Anything else worth recording. -->
```

A team overrides the shape in `templates.prd` ([ADR-0018](docs/adr/0018-generic-core-config-compose.md));
the default text lives here, in the one Box that writes a PRD.

If a heading is missing, fill that section and check again. Never write a partial PRD.

Then write the content to `<ARTIFACTS_DIR>/<SLUG>/PRD.md` with your own tools, creating the directory
when it does not exist, and print that path.

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
  gate:     <open-pr → PR #… | stage-only → staged>
  next:     run /tickets <SLUG> once the PRD is approved
```
