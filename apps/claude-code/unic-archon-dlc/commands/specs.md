---
argument-hint: '<slug> [spec/design/issue URL … | free-form idea]'
description: 'Turn an idea (or an existing spec / design / UX) into one human-approved PRD: grill or ingest, approve the testing seams, write <artifacts_dir>/<slug>/PRD.md plus a design contract per component the feature names, and open the PRD gate.'
---

# unic-archon-dlc:specs

> Design rationale: [ADR-0020 — `/specs` reaches an aligned PRD by branch-on-input](docs/adr/0020-specs-branch-on-input.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); compose-don't-reimplement per [ADR-0016](docs/adr/0016-dlc-thin-process-layer.md); template-in-config per [ADR-0018](docs/adr/0018-generic-core-config-compose.md)).

**Arguments:** "$ARGUMENTS"

`/specs` is the **first main-line box**: it turns an idea into **one human-approved PRD** by the
cheapest path given what already exists, then hands off to `/tickets`. It is an **in-session
command/skill** (grilling needs the live conversation — ADR-0017), and it **owns the _what_** (the
branch-on-input flow, the seam-approval halt, the PRD shape) while **composing the _how_**: the
`to-spec`, `grilling` and `domain-modeling` Methods for the conversation — read by path, per
Step 1 — and the configured docs / design / tracker system-skill (MCP-first, CLI-fallback) to read an
existing source.

Follow these steps in order. Do not skip any step. The only files you write are the PRD
(`<artifacts_dir>/<slug>/PRD.md`), any ADRs that crystallise during grilling, and — when the config
carries a design system and the feature names a component — one **design contract** per component, with
its screenshot beside it. Everything else is conversation, until the gate in Step 8.

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

### Read the design-conventions doc

`DESIGN.type` is a **branch, never a comparison**: test it set-versus-`none` and never compare it to a
literal. The value names the team's design system, `DESIGN.access` resolves the surface that reads it,
and a rule keyed on the value would be keyed on decoration.

When `DESIGN.type` is set, the Consumer declares its design conventions in one doc beside the tracker
contract, at `docs/agents/<DESIGN.type>.md` — the value lower-cased, with any space or slash written as
`-`. Keep that path as `DESIGN_DOC`. **The Consumer writes this doc by hand; nothing installs it**, so a
project with a design system and no doc is the ordinary first state rather than a broken one. It owns
every design fact this command does not know, and this list is the whole of what Step 7 asks of it:

- **Which read carries which fact.** No single read carries them all, so the doc routes them.
- **The stable identity** a component is keyed on, which is never its name.
- **Which facts this tool cannot answer**, so a contract can name them rather than stay silent.
- **Where a contract is written**, and the docs parent under which a component's page is created.
- **The blocking conditions** that stop a contract being written.
- **The mapping** from a design property to the code surface it becomes.
- **The gate that covers appearance**, since this contract does not.
- **The expected-subscription list**, when the team keeps one.
- **How a screenshot reaches the docs system**, when it can reach it at all.

Read it in Step 7, when the feature names a component, and not before: a feature that names none needs
neither a contract nor this doc.

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
    `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` — in the same directory as its `SKILL.md` — are
    the shapes any ADR or `CONTEXT.md` edit must follow.
  - `assumptions` → enumerate **all** your assumptions about the feature upfront as a numbered list,
    then walk the user through confirming/correcting each. `domain-modeling` still applies as
    decisions settle.
- **Existing spec / design / UX / tracker issue** (a URL or ref) → **ingest**. Read the source by
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
the `to-spec` Method's seam guidance. Present the proposed seam(s) and **get the user's
explicit confirmation** that they match expectations. The approved seams become the PRD's **Testing
Decisions** section. Do not proceed to Step 7 without this confirmation.

## Step 6 — Estimation (config-gated)

If `ESTIMATIONS` is `provisional` or `both`, **compose** an estimator (never build one) to attach a
**provisional** estimate to the PRD — a coarse size, with the definitive estimate deferred to
`/tickets`. If `ESTIMATIONS` is `off` or `definitive`, skip this step.

## Step 7 — Write the PRD and the design contracts

Shape the agreed design into the sections of `PRD_TEMPLATE` (the config-driven template — fall back
to the built-in default if it is null), using the project's domain vocabulary and respecting the
ADRs in scope. Follow the `to-spec` Method's guidance for each section, with the approved
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

### The design branch — one contract per component

Skip this section when `DESIGN.type` is `none` or absent, and skip it when the feature names no
component. The components a feature names are the ones the Step 4 conversation settled and the PRD above
describes; the contracts are written after the PRD, and each one rides its pull request.

Otherwise read `DESIGN_DOC` now (Step 1 derived its path). **If that file is absent, stop**, print its
path, and say `Write it, or set design.type to none.` A contract written without it is a guess about
someone else's design system, and a guessed contract is approved at the Step 8 gate as though it were
read.

Nothing below names a design tool. This command knows that a contract is written and what it holds;
`DESIGN_DOC` knows how to read one.

**One contract per component the feature names** — not per slice, and not only per component a slice
renders. A preparation slice, one that installs a dependency so parallel work can start, carries the
contract path too, or the work it exists to unblock starts blind.

#### Read the design fact by fact

No single read carries every fact, so take each fact from the read `DESIGN_DOC` routes it to. Where two
reads report the same relationship and disagree, union them: one of them under-reports, and a contract
that drops a child dependency is wrong in the direction nobody checks. Four rules hold whatever the
tool:

- **A value is recorded as the name that carries it, never as the resolved value.** A colour reaches
  code as a token name. A literal with no name behind it is a finding, not a specification.
- **An override made through a declared component property is intent; an override typed onto a layer
  inside an instance is not.** The first is what the property exists for. The second is a defect, and
  the contract records it as one. One carve-out: a value **bound to a named token** is intent wherever
  it sits, because a named value survives being reapplied elsewhere and a raw one lies.
- **What cannot be read is named, never implied.** `DESIGN_DOC` names the cases this tool cannot
  answer. Write each one into the contract as unreadable, with its reason — a contract silent about
  them reads as though someone looked and found nothing.
- **A component is keyed on the stable identity `DESIGN_DOC` names, never on its name.** One name
  repeats inside a single design file — measured 2026-08-25 on the Consumer's file: one name carried by
  four distinct components ([#404](https://github.com/unic/unic-agents-plugins/issues/404)) — so a name
  key is ambiguous today, not in theory. Record the name as a label.

#### What a contract holds

Four sections in this order, because the file reads as evidence, then what a human approves, then what
nobody could have read from the design:

1. **Provenance** — this Plugin and the version that wrote the file, the date, the design source's
   identity and a link to the frame, the screenshot path, the docs page URL or `not published`, and a
   **Scope** line stating that the contract governs structure and not appearance and naming the gate
   `DESIGN_DOC` says does cover it. Take the version from this Plugin's own manifest, in the installed
   directory Claude Code's `~/.claude/plugins/installed_plugins.json` names for this repository. Never
   infer it, and where it cannot be read write it as absent with that reason — a wrong version in a
   provenance list is worse than a missing one, because a human reads the whole list as measured.
2. **Design as read** — one line per property: name, type, options, default. Which combinations are
   drawn, of how many possible. Child dependencies, each marked internal or external with its identity.
   Token names, each with its value or the reason the value is unreadable.
3. **Code shape** — directory and export name, and the code surface each design property becomes,
   following the mapping `DESIGN_DOC` declares. Values that exist but are undrawn are listed and marked
   as such.
4. **Non-designable facts** — the docs page these come from, and what that page states applies here.
   Write `unresolved` where no page exists yet.

**Provenance is a visible list, never a comment, and that departs from the convention on purpose.** An
installed Box carries its provenance as comment lines, because a YAML file has no reader but an agent. A
contract has a human reader standing at the Step 8 gate, and hidden provenance is provenance nobody
checks.

**An absent optional field is written as absent, with the reason. It is never omitted** — an omitted
field cannot be told apart from a field nobody looked for.

**Lists throughout, and no tables anywhere.** A formatter this Plugin does not control repads a whole
Markdown table on any change inside it, so a contract carrying tables churns on every run of either
tool, and that diff reads as "the design changed" when nothing did.

#### Where it is written, and what stops it

- **The file name carries `.generated.`**, and the path is whatever `DESIGN_DOC` declares. Absent a
  declaration, write the contract beside the PRD. That one word does two jobs: a formatter exclusion
  keys on it, and it tells a human not to hand-edit the file.
- **Every run rewrites the contract whole** — new read, new date, new screenshot. It is idempotent by
  replacement, and the cure for a stale contract is to run `/specs` again. Nothing detects staleness:
  the checkers are the human at the Step 8 gate, who has the date in front of them, and the next run
  for that component.
- **The contract carries a screenshot of the component.** Render it, save it beside the contract, and
  re-render it on every run. `DESIGN_DOC` says how a screenshot reaches the docs system, and whether it
  can reach it at all — where it cannot, the published block carries the frame link instead.
- **The blocking conditions `DESIGN_DOC` declares stop the run.** Never write a partial or empty
  contract for the component that blocked: an empty contract is the worst shape available, because it
  reads as a component with no properties rather than as a component nobody could read. What a block
  costs the rest of the run is **this command's rule, not the doc's**: write no contract for the
  components after it either, print the Step 9 summary with the `blocked:` line filled and `gate: not
opened`, and stop before Step 8. Contracts already written stay on disk unstaged, and the summary
  lists them as written-not-staged, so the next run replaces them rather than a human wondering what
  they are. The PRD stays on disk too: clear the condition and run `/specs` again, and Step 2 picks it
  up as a re-entry.
- **When `DESIGN_DOC` declares an expected-subscription list**, read the actual list through
  `DESIGN.access` and compare it per file. A mismatch **warns and is recorded in the contract. It never
  stops the run.**

#### Publish, and the formatter warning

**`DOCS.publish` governs the contracts as well as the PRD — there is no second flag.** When it is `true`
and `DOCS.type` is not `none`, publish each contract by composing the docs skill registered under
`DOCS.access`, writing through its injection markers. One page per component, two halves and two owners:
the generated block is this command's and is replaced whole; everything a person wrote outside the
markers is **never touched**. On a first run no page exists — create it under the parent `DESIGN_DOC`
names, with the authored half empty, then **write the page URL back into that contract — into the
Provenance list, and into the § Non-designable facts source line, which cease to read `not published`
and `unresolved` the moment the page exists**. The file in the repository is what resolves the page on
the next run. What that page _says_ about applicable states stays unresolved until a human writes the
authored half; only its address is now known. If the docs surface can neither create a page
nor write through markers, publish nothing and say which of the two it was.

**After writing a contract, check that this repository excludes it from whatever formats or lints here.**
`/setup` writes those exclusions and a `.generated.` name is what they key on, so this check is for the
Consumer set up before that existed, or one whose toolchain has grown a tool since. Read what this
project runs, and for each tool that reaches the contract's path look for a rule covering it. Where one
is missing, print the exact entry an operator must add and which tool it belongs to — including where
that tool excludes through a structured config value rather than an ignore file, which it cannot be
patched into.

**Write nothing in either place.** That write belongs to `/setup`, which owns the marked block in an
ignore file; a second writer would leave a line neither command could tell from a hand-written one. A
contract a formatter reflows churns on every run, and that diff reads as a design change.

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
- each design contract Step 7 wrote, by its own path, and the screenshot beside it — one `git add` per
  file. A contract is staged with the PRD it belongs to and reaches the same review, which is the only
  place a human sees it before it is used. **An asset a contract needs is committed as bytes, never as
  a link**: an exported asset URL expires seven days after it is issued (measured 2026-08-25,
  [#405](https://github.com/unic/unic-agents-plugins/issues/405)), so a
  committed link is dead within the week and dead in a way that looks like an asset nobody drew.

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
  git add <contract path>              # once per contract and once per screenshot
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
  path:      <ARTIFACTS_DIR>/<SLUG>/PRD.md
  repo:      <the repository docs/agents/issue-tracker.md § Addressing names>
  input:     <converse | ingest | hybrid>
  seams:     <the approved testing seam(s)>
  ADRs:      <NNNN-slug.md … | none>
  contracts: <N written, one path each, marking any a block left unstaged | none — design.type is none | none — the feature names no component>
  blocked:   <component — the condition that stopped it, one per line | none>
  gate:      <open-pr → PR #… | stage-only → staged | not opened — a design blocking condition stopped the run>
  next:      run /tickets <SLUG> once the PRD is approved
```
