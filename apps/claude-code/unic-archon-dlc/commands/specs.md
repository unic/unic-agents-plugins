---
argument-hint: '<slug> [spec/design/issue URL | tracker ref | design file … | free-form idea]'
description: 'Turn an idea (or an existing spec / design / UX) into one human-approved PRD: read whatever source exists, grill the human either way, approve the testing seams, write <artifacts_dir>/<slug>/PRD.md plus a design contract per component the feature names, and open the PRD gate.'
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
contract. `/specs` files nothing, so it needs only the first, and only when Step 4 reads an existing
tracker item. Read it then:

- **Access** — its § Access names the MCP server or skill that serves this tracker. Read that server's
  own current tool list and build the call from it. Name no provider and write no command, subcommand
  or flag ([ADR-0016](docs/adr/0016-dlc-thin-process-layer.md)).
- **Addressing** — its § Addressing names the repository this run acts on. Name it explicitly, and
  derive nothing from a remote URL.
- **Work-item scope** — its § Work-item scope names the filter every search applies.

When the file is present, print the repository its § Addressing names, so a surprising target is
diagnosable. When it is absent, say so, read the other sources instead, and print
`repository: unknown — no docs/agents/issue-tracker.md`. **Derive no repository from a remote URL**
to fill that gap: a repository nobody named is exactly the invented identifier this command must not
produce, and it is worse than an absent one because it looks decided.

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

**Read it whenever the design is first read**, because it says which read carries which fact — read
the design before it and you read the design the wrong way, and find out at contract time. Two
moments, each with its own test:

- **Step 4**, when the source is a design or names a component. What the whole feature names is not
  settled yet, so the test is the source in front of you.
- **Step 7**, when the feature names a component and no earlier read happened. A feature that names
  none needs neither a contract nor this doc.

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

Classify `SOURCE` into one of **two** values, and keep the one you chose as `INPUT`:

- **`source-absent`** — `SOURCE` is empty, or it is free-form prose with no URL or ref in it.
- **`source-present`** — `SOURCE` names something readable: a URL, a tracker ref, a design file.

There is no third value. A source that turns out to have gaps is still `source-present`; the gaps
change what you ask, not what you classify. Judging a source complete enough to skip the interview is
the call this command got wrong, so the classification no longer offers it.

**Both branches grill.** What differs is where the interview starts, never whether one happens.

### `source-present` — read it, synthesise it, then grill the synthesis

Read the source by **composing the configured system-skill** (MCP-first, CLI-fallback):

- docs (`DOCS.type` is set) → the team's docs skill / MCP via `DOCS.access`;
- design (`DESIGN.type` is set) → the team's design skill / MCP via `DESIGN.access`. **Read
  `DESIGN_DOC` first** (Step 1 derived its path), because it says which read carries which fact. The
  test here is the source in front of you, not the component list: read it whenever the source is a
  design, or names a component. Which components the feature names is settled later in this
  conversation and is Step 7's test, not this one;
- tracker item → the server `docs/agents/issue-tracker.md` § Access names, addressing the repository
  its § Addressing names.

Synthesise what the source says and put that synthesis in front of the human. Then **compose the
`grilling` Method over the synthesis you just produced**, per `DISCUSS_MODE` below. A source tells you
what someone already decided; it does not tell you what they left out, what they assumed, or what they
would say if asked. Reuse `to-spec`'s PRD _shaping_ as before.

### `source-absent` — grill from the idea

Nothing to synthesise, so the interview starts at the idea itself. Run it per `DISCUSS_MODE` below.

### `DISCUSS_MODE` — how the interview runs, on either branch

- `discuss` (default) → follow the resolved **`grilling`** Method, and the resolved
  **`domain-modeling`** Method for the terms and ADRs that crystallise as you go. Its
  `ADR-FORMAT.md` and `CONTEXT-FORMAT.md` — in the same directory as its `SKILL.md` — are
  the shapes any ADR or `CONTEXT.md` edit must follow.
- `assumptions` → enumerate **all** your assumptions about the feature upfront as a numbered list,
  then walk the user through confirming/correcting each. `domain-modeling` still applies as
  decisions settle.

On `source-present`, the synthesis is what the interview is about: in `discuss` the questions come
from what the synthesis does not settle, and in `assumptions` the numbered list is what you inferred
beyond what the source states.

### Halt 1 — confirm shared understanding before anything is written

Do not write the PRD until the user confirms the design is settled. In `discuss`, ask "have we reached
a shared understanding?" and wait. In `assumptions`, the walk through the assumptions reaching
agreement is the confirmation. On `source-present` the human's review of your synthesis is part of the
interview that leads here; it is not this halt, and it does not stand in for it.

This fires when the interview **reaches** shared understanding, however many turns that took — it is
not "the last question". On **no**, return into the interview; there is no cap on how often that
happens. Never count, cap or restate the interview: how many questions a Method asks is the Method's
business, not this Box's.

**Record the answer.** Whatever the human says here is written verbatim into the PRD's
**Confirmations** section (Step 7). This halt stops the run until it is answered. If the run reaches
Step 7 anyway, its entry says `unanswered` — never an answer you did not receive.

## Step 5 — Seam-design approval

### Read the Consumer's testing bar first

Before you ask anything, read what this Consumer has already written about how it tests. It is stated
in surfaces the Consumer maintains by hand, and this command reads them where they exist rather than
asking for a new one:

- its root `AGENTS.md` and `CLAUDE.md` — **read them now**; Step 3 does not, and they are the surface
  most likely to state a bar in words;
- the per-context `CONTEXT.md` files and the ADRs in `docs/adr/` that decide a testing approach —
  Step 3 read these already, so re-read nothing and use what you have;
- the tests that exist in the repository, which state the bar by example where no document does.

**Propose from that bar.** The seams you present are the ones the bar implies for this feature,
following the `to-spec` Method's seam guidance. **Ask only what the bar does not answer** — a question
whose answer is already written down spends the human's turn re-deciding a decision they made once,
and this halt has few turns to spend.

If no surface states a bar, say so, and propose from `to-spec` alone.

### Halt 2 — the seams are approved

Present the proposed seam(s) and **get the user's explicit confirmation** that they match
expectations. The approved seams become the PRD's **Testing Decisions** section. Do not proceed to
Step 7 without this confirmation.

**Record the answer.** Whatever the human says here is written verbatim into the PRD's
**Confirmations** section (Step 7). This halt stops the run until it is answered. If the run reaches
Step 7 anyway, its entry says `unanswered` — never an answer you did not receive.

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

### The Confirmations section — written on every run

**This section is not part of the template, and no override can remove it.** The heading check above
governs `PRD_TEMPLATE`'s headings only. `## Confirmations` is appended by this command after them,
whether `PRD_TEMPLATE` is unset, set to the default, or set to something a team wrote — a team that
overrides the PRD shape is choosing its sections, not choosing whether the halts are on record.

**Write exactly one `## Confirmations` section, whatever the template says.** If `PRD_TEMPLATE`
carries that heading too, the section you write takes its place and satisfies the heading check;
do not also render the template's copy, and do not stop the run over it. Print
`templates.prd names ## Confirmations — this command owns that section; the template's copy is
inert.` so the operator can drop the heading from their override. Two sections with one name would
leave Step 8 reading whichever it met first, and a gate that reads the wrong record is worse than no
gate, because it reports a check it did not make.

It carries **one entry per halt**, in order, and the halts are the two named above: Halt 1, the shared
understanding at the end of Step 4, and Halt 2, the seam approval in Step 5. The Step 8 gate is not
one of them — it is the reader of this section, not an entry in it.

Each entry carries the halt's name, the question you asked, and one of exactly two things:

- **the human's answer, quoted verbatim.** Their words, not your reading of them. Never paraphrase,
  never tidy, never summarise agreement you inferred from the conversation continuing.
- **`unanswered`**, with what you asked and what happened instead — the question was announced and
  passed over, the conversation moved on, the run resumed from somewhere later. Write this whenever no
  human turn answered the question. **An unanswered halt is an ordinary outcome to record, never a
  failure to hide**: Step 8 is built to stop on it, and a fabricated answer defeats the only check
  there is.

```markdown
## Confirmations

### Halt 1 — shared understanding (Step 4)

Asked: <the question you put to the human, or the assumptions you walked them through>
Answer: "<their words, verbatim>" | unanswered — <what happened instead>

### Halt 2 — seam approval (Step 5)

Asked: <the seams you proposed>
Answer: "<their words, verbatim>" | unanswered — <what happened instead>
```

Under `DISCUSS_MODE = assumptions`, Halt 1's `Asked:` line is the assumption walk rather than one
question, and its `Answer:` is the human's own closing words on that walk. Quote what they said;
never write agreement you inferred from the walk finishing.

**Why a run can be here with a halt unanswered at all.** Both halts stop the run, so on the path this
command describes, Step 7 is never reached with one open. That rule can be walked past — it was, on
the run this section exists because of, where three one-sentence halts went by in thirty minutes with
no human turn. So the entry has a value for it. **Reaching Step 7 with a halt open is not permission
to proceed**; it means the rule already broke, and what is left is whether the break is on the record
or papered over. Write `unanswered`, let Step 8 refuse, and the run costs a re-entry instead of a
pull request nobody can trust.

**The ceiling on this, stated rather than discovered.** The record is written by the same agent that
would skip the halt, so Step 8 reading it detects an honest omission and cannot detect a fabricated
quote. The one person who can tell is the human at the gate, who wrote the words. This section exists
so they have something to check against, not so nobody has to.

### Every absence claim carries how it was established

Anywhere this run writes that something is absent, empty, none, or clean — in the PRD, in a design
contract, in the Step 9 summary — **that claim carries the method that established it, in the same
sentence.** Where no method established it, write that it was not checked.

`none` on its own is two different statements wearing one word: "I ran the check and it found
nothing" and "no check ran". A reader cannot tell them apart, and the second one reads as the first.
This reaches a design contract's **findings line**, which is the place it was got wrong: a contract
saying `Findings: none` after no override test ran is a false statement about work, not a terse one
about design. Write `Findings: none — this run performed the override test <DESIGN_DOC> declares,
against every instance` or `Findings: not checked — <why>`, and never the bare word.

**Keep this run as the subject of the performing verb.** A claim whose grammar lets the doc, the
tool, or the convention do the checking says an act happened without saying who acted, and that is
the same ambiguity in a new place. Write `this run performed`, `this run read`, `this run compared`.
Never a phrasing in which what the doc **declares** could be read as what somebody **did**.

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

Otherwise read `DESIGN_DOC` now, unless Step 4 already read it (Step 1 derived its path). **If that
file is absent, stop**, print its path, and say `Write it, or set design.type to none.` A contract written without it is a guess about
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
puts it in front of a human. Halt 1 and Halt 2 are in-method confirmations, not gates — they settle
the design, they approve nothing, and this gate is where their records are read. This is also where
`grilling`'s "do not enact the plan until I confirm we have reached a shared understanding" lands: in
`/specs`, enacting the plan means writing and PR-ing the PRD, and that is exactly what this gate holds.

### Read the Confirmations section before either mode runs

Open `<ARTIFACTS_DIR>/<SLUG>/PRD.md` and read its `## Confirmations` section. **Both gate modes refuse
to proceed when any halt's record is absent, or states that the halt went unanswered.** Absent covers
the whole range: no section, a section with no entry for that halt, or an entry with no answer in it.

Refusing means this, per mode:

- **`open-pr`** — create no branch, stage nothing, commit nothing, push nothing, and **open no pull
  request**.
- **`stage-only`** — **stage nothing**, and print no suggested PR title or body.

Then print which halt stopped it, by name, and what its record said:

```
/specs stopped at the gate — <SLUG>
  halt:   Halt 2 — seam approval (Step 5)
  record: unanswered — the seams were proposed and the run ended with no reply
  fix:    answer it, then run /specs <SLUG> again — Step 2 picks the PRD up as a re-entry
```

The PRD and any contracts stay on disk, unstaged. Clear the halt and run `/specs` again: Step 2 reads
the existing PRD as a re-entry, and Step 7 rewrites the Confirmations section from the halts as they
actually went this time.

**This is fail-closed on purpose, and it costs a re-run.** A gate that proceeds on a missing record is
a gate that approves the run that skipped the halt, which is the one thing it exists to catch.

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
  repo:      <the repository docs/agents/issue-tracker.md § Addressing names | unknown — no docs/agents/issue-tracker.md>
  input:     <source-present | source-absent>
  seams:     <the approved testing seam(s)>
  halts:     <Halt 1 answered · Halt 2 answered | the halt(s) with no answer on record>
  ADRs:      <NNNN-slug.md … | none>
  contracts: <N written, one path each, marking any a block left unstaged | none — design.type is none | none — the feature names no component>
  blocked:   <component — the condition that stopped it, one per line | none>
  gate:      <open-pr → PR #… | stage-only → staged | not opened — a design blocking condition stopped the run | not opened — <halt> has no answer on record | nothing staged — <halt> has no answer on record>
  next:      review what this run produced — the PRD, and each contract — then run /tickets <SLUG> once the PRD is approved
```

The `gate:` line says what did not happen in the mode's own words: `open-pr` reports `not opened`,
`stage-only` reports `nothing staged`. A `stage-only` run had no pull request to open, so reporting
one as unopened describes a mode it was never in.

The `input:` line carries one of those two values and no other.

**The `next:` line names the review first, and it names it as a step rather than an option.** What
this run produced is a PRD and, on the design branch, one contract per component — the artefacts a
later Box treats as settled fact. The gate's human reviewer is the only reader between writing them
and using them, so the summary sends them there before it sends anyone to `/tickets`.

Print this summary on a refused gate too, with `gate:` carrying the halt that refused it. A run that
stops has more to report than one that finishes, not less.
