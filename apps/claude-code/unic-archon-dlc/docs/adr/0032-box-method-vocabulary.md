# 0032. Vocabulary: Box, Method, Local Method, Bundle — config carries parameters, a Method carries procedure

**Status:** Accepted (2026-08-03)

## Context

[ADR-0030](0030-harness-hosts-methods.md) and [ADR-0031](0031-methods-bundled-three-tier-resolution.md)
introduce four words that now appear in code (`METHODS_MANIFEST`, `resolveMethod`, `verifyBundle`,
`.archon/methods.local/`), in command prose, and in every later session's reading. None of them was
defined anywhere, and the plugin already had a competing word for the same object: `CONTEXT.md` defined
**thin process layer** for what [ADR-0030](0030-harness-hosts-methods.md) calls the Harness.

Undefined vocabulary is not a documentation problem here, it is the same problem the manifest was built
to fix. The 6-versus-7-versus-11 dependency divergence happened because "the skills we depend on" had
no single meaning, so three files each answered it differently and no test could disagree.

## Decision

### 1. The four terms

**Box** — a DLC lifecycle step: `/specs`, `/tickets`, `/build`, `/pr-review`, `/qa`, `/triage`,
`/setup`, `/explore`, `/improve-architecture`, `/cleanup`. A Box is a Harness concern
([ADR-0030](0030-harness-hosts-methods.md)); its container follows structural need
([ADR-0017](0017-container-follows-structural-need.md)). "Workflow" is not a synonym — that is one of
the two containers a Box can have.

**Method** — the Matt Pocock skill text a Box reads for procedure. Read by path, never registered as a
skill ([ADR-0031](0031-methods-bundled-three-tier-resolution.md) §4).

**Local Method** — a team override of a Method, at `.archon/methods.local/<name>/SKILL.md`,
uncommitted, declaring the Bundle version it forked from in its own frontmatter.

**Bundle** — the tag-pinned set of Methods vendored inside the plugin at `vendor/mattpocock-skills/`.
Its installed copy in a Consumer repository is `.archon/methods/`, which `/setup` writes.

**Harness** — what the DLC is to a Method: the owner of isolation, gates, config, integrity,
composition, durability and posting. Replaces "thin process layer" as the canonical term.

### 2. Config carries parameters; a Method carries procedure

The division that makes the other four terms decidable:

- **Configuration** answers _which, where, how many, and whether_ — tracker type and coordinates, docs
  system, gate mode per Box, thresholds, label vocabulary, templates. Values a team sets and the
  Harness reads.
- **A Method** answers _how_ — how to conduct the interview, how to slice a spec, what makes a good
  review comment, when to stop grilling. Procedure a team runs.

So a Box that wants different behaviour reaches for config. A Box that wants different _method_ forks
the Method ([ADR-0031](0031-methods-bundled-three-tier-resolution.md) §2) and does not add a config
key. This is what stops the config schema absorbing method text one key at a time, and it is why
`/triage` injects `classification.labels` into Matt's triage Method rather than restating the labels in
prose ([ADR-0024](0024-triage-intake-on-ramp.md)).

### 3. `CONTEXT.md` is the glossary; this ADR is the rationale

The terms live in [`CONTEXT.md`](../../CONTEXT.md) as a glossary — definitions only, no
implementation detail. This ADR records why the words were chosen and what they replace. When the two
disagree, `CONTEXT.md` is the definition and this ADR is the history.

## Consequences

- "Thin process layer" is listed under `_Avoid_` in the glossary. ADR-0016 keeps its original wording
  as the historical record; the opening sentences of `README.md`, `AGENTS.md` and `CONTEXT.md` are
  rewritten to say Harness.
- A dependency list in prose is now a defect by definition, because "Method" has a single referent:
  the manifest. `README.md`'s table is generated from `providedTo` and a test asserts they agree.
- New vocabulary needs an entry here and in `CONTEXT.md` before it appears in a third file. That is the
  cheap version of the check that would have caught the original divergence.
