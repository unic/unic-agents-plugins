# 0020. `/specs` reaches an aligned PRD by branch-on-input

**Status:** Accepted (2026-07-02, revised 2026-09-02)

## Context

Two spec-building philosophies were in tension for `/specs`:

- **Matt Pocock** (the grilling and PRD-shaping Methods) — a _shared conversation_ co-builds
  understanding; alignment happens _during_ creation; needs the human present; doesn't run AFK.
- **Pesche `unic-ticket-specification`** (PR #257) — _autonomous_ draft (+ estimations); the human
  then _reads every ticket and decides_ if it is what they want; alignment happens _at review_;
  scales/AFK; risk of rubber-stamping a plausible-but-wrong spec.

They looked opposed, but they are the **same job on different inputs**. Unic features arrive with
heterogeneous starting material: sometimes just a raw idea; sometimes an existing spec in the team's
docs system; sometimes UX specs and Figma links (design isn't always involved).

**What a source is worth was measured, and it is less than this ADR first assumed.** The original
decision let a sufficient source stand in for the interview. Run 2 on the Consumer
([#441](https://github.com/unic/unic-agents-plugins/issues/441), 2026-08-31) ran thirty minutes with
zero maintainer turns and wrote four artefacts asserting acts that never occurred — three design
contracts reading `Findings: none` where no override test ran, a PRD naming approved seams for a
question nobody answered, a report counting halts in a leg with no human turn. The maintainer has
never been grilled by `/specs`, in either run. A source records what someone decided; it is silent on
what they left out and what they assumed, and nothing between writing an artefact and approving it
noticed the difference.

## Decision

`/specs` is an in-session **command/skill** ([ADR-0017](0017-container-follows-structural-need.md))
whose job is to **reach one human-approved PRD by the cheapest path given what already exists** —
cheapest in reading, never in interviewing.

**Input is classified two ways, and both grill.**

```
source-absent   (no source, or free-form prose)  → grill from the idea
source-present  (a URL, ref or design file)      → read it, synthesise it, grill the synthesis
```

A source narrows what is asked. It never decides that nothing is asked, and a source with gaps is
still `source-present` — the gaps change the questions, not the classification. The retired values
made the opposite call: `ingest` said in as many words that a source meant there was nothing to
interview, and `hybrid` graded how much of the interview a source bought. Grading it is the judgement
the command got wrong, so the classification no longer offers the grade.

**`specs.discuss_mode` picks how the interview runs, on either branch** — `discuss` (default) follows
the `grilling` Method, `assumptions` enumerates every assumption upfront and walks the human through
them. It is orthogonal to the input branch. The third value `interview` is dropped as redundant:
`grilling` _is_ the one-at-a-time interview.

**Three halts, and `specs.gate` is the only approval gate.** Halt 1 is the shared understanding at
the end of the interview, fired on both branches so the command has one shape whatever the input.
Halt 2 is the seam approval, which reads the Consumer's stated testing bar before it asks anything
and asks only what that bar does not answer. Halt 3 is `specs.gate` — the one halt that produces a
durable artefact and puts it in front of a human, and where the `grilling` Method's "do not enact the
plan until I confirm" lands, because in `/specs` enacting the plan means writing and PR-ing the PRD.

**A halt is not an interview turn.** How many questions a Method asks is the Method's business; the
Box never counts, caps or restates the interview. If upstream adds questions, `/specs` asks more
questions and still has three halts.

**Halts 1 and 2 are on the record, and the gate is fail-closed on that record.** Each writes an entry
into a `## Confirmations` section of the PRD carrying the human's answer verbatim, or the word
`unanswered`. The section is written on every run and is outside `templates.prd`, so no template
override removes it. Both gate modes refuse when an entry is absent or unanswered — `open-pr` opens
no pull request, `stage-only` stages nothing — and each names the halt that stopped it. This detects
the honest omission and cannot detect a fabricated quote; the human at the gate is the only reader
who can, which is what the record gives them something to check against.

**Every absence claim carries how it was established**, or states that it was not checked. `none` on
its own means both "the check found nothing" and "no check ran", and a reader cannot tell which. This
reaches a design contract's findings line, the place it was got wrong.

Invariants regardless of path:

- Ends at **one PRD approval gate** before `/tickets` (HITL by default), configurable as
  `specs.gate = open-pr | stage-only`.
- **Composes team system-skills** to read whatever source exists (docs, tracker and design systems via
  MCP-first / CLI-fallback) — `/specs` owns the _what_, not the _how_
  ([ADR-0016](0016-dlc-thin-process-layer.md)). It composes an estimator too, config-gated in two
  waves: provisional here, definitive at `/tickets` ([ADR-0021](0021-earns-its-place-compose-verbatim.md)).
- **Composes three Methods, read at the one bundled path** `.archon/methods/<name>/SKILL.md`
  ([ADR-0031](0031-methods-bundled-three-tier-resolution.md), as amended): `to-spec` for PRD shaping,
  `grilling` for the interview, `domain-modeling` for the terms and ADRs that crystallise. Reading
  replaced invoking because most of these skills carry `disable-model-invocation: true` and are
  absent from the model's skill list even on a healthy install.
- The PRD is written to `<artifacts_dir>/<slug>/PRD.md`
  ([ADR-0015](0015-workflows-slug-artifact-home.md)) — the repo floor, always. Publishing it to the
  team's docs system is **opt-in** (`docs.publish`, default off) and composes the configured docs
  skill, whose injection markers keep the human-authored source from being overwritten.
- The PRD's shape comes from `templates.prd` ([ADR-0018](0018-generic-core-config-compose.md)), with
  the default scaffold stated in the one Box that writes a PRD.

**`/specs` writes a second durable artefact on the design branch.** When `design.type` is set, it also
writes one **design contract** per component the feature names — what the design file says, read
mechanically, plus the code shape that follows. It is idempotent by replacement, its name carries
`.generated.`, and it rides the PRD's pull request as a named staged path. Four rules govern the read
([#404](https://github.com/unic/unic-agents-plugins/issues/404),
[#405](https://github.com/unic/unic-agents-plugins/issues/405), measured): a value is recorded as the
name that carries it and never as its resolved value; an override made through a declared property is
intent while one typed onto a layer is a defect, with a token-bound value the carve-out; what cannot
be read is written in as unreadable; a component is keyed on a stable identity, never its name. A
declared blocking condition stops the contract, and `docs.publish` governs the contracts as well as
the PRD — one page per component, the generated block replaced whole through injection markers and
the authored half never touched.

**The design branch is set-versus-`none`, never a comparison to a value.** `design.access` resolves
the tool, so the value is decoration. Everything tool-specific is declared by the Consumer in a
hand-written doc at `docs/agents/<design.type>.md`, read whenever the design is first read, and
`commands/specs.md` enumerates what that doc owns while naming no design tool itself. That doc also
reaches the `/pr-review` Box's intent brief, so a review can tell a claimed check from a performed one.

## Consequences

- `/specs` has two branches, and the interview is on both. The seam approval and the shared
  understanding are recorded rather than assumed.
- Reading a source is cheap and skipping the human is not the saving it looked like: `source-present`
  costs a synthesis _and_ an interview.
- The Confirmations record is authored by the same agent that would skip a halt, so the gate reading
  it is a detector, not a preventer. Asking the human at the gate whether the quoted words are theirs
  is the missing half, and it belongs to
  [#437](https://github.com/unic/unic-agents-plugins/issues/437).
- Input classification depends on the team's system-skills being registered at `/setup` time
  ([ADR-0019](0019-conversational-setup.md)).
- `/prototype` is a referenced Method, not a `/specs` sub-step; the AFK spike lives in `/explore`.
