---
description: Run the unic-archon-dlc PR review workflow — an intent-grounded two-axis review, then a summary comment + inline comments posted/updated on the current PR, with iteration-aware re-review.
---

# /unic-dlc-pr-review

Runs the `pr-review` box: composes a shared **Intent Brief** (from the linked work items, the referenced
docs pages, the PR description, and `PRD.md`), runs **one review node** that hosts the `code-review`
Method's own **two-axis fan-out** — **Standards** (repo standards plus the twelve-item Fowler smell
baseline) and **Spec** (the diff against the originating intent) — synthesises the findings,
**reconciles them against the prior iteration**
(new / still-present / fixed / regressed), and — after a config-gated human confirm — posts or updates a
single structured **summary comment** plus **inline comments** on the current PR.

Generic and **self-contained**: it harvests `unic-pr-review`'s review learnings (confidence rubric,
structured summary, hidden-marker idempotency, conditional spawn table, two-surface posting) **without
its host-specific code and without any runtime dependency** ([ADR-0016](../adr/0016-dlc-thin-process-layer.md)/
[ADR-0017](../adr/0017-container-follows-structural-need.md)). Ported to the key-discriminated
Archon node schema ([ADR-0011](../adr/0011-archon-schema-target.md)); design in
[ADR-0026](../adr/0026-pr-review-generic-archon-harvest.md).

## Usage

```
/unic-dlc-pr-review <slug>
```

`<slug>` is the session identifier from `/unic-archon-dlc:specs` / `tickets` / `build`. It scopes the
review artefacts (`<artifacts_dir>/<slug>/pr-review/`) and locates `PRD.md`. There is **no PRD
precondition** — intent is composed from whatever sources resolve.

## What this workflow does

1. **bootstrap** — parse the slug from `$ARGUMENTS`, read `.archon/unic-dlc.config.yaml`
   (`artifacts_dir`, `gates.pr-review`, `pr-review.confidence_threshold`, `pr-review.inline_comments`,
   `docs.*`, `project.branching`, and the whole `sdlc_needs` block). It runs `sdlc_needs.install` once
   for the whole run and reports whether it did — this Box runs no check by instruction, and it
   installs anyway, so that a sub-agent deciding it needs to run something fails on that decision
   rather than on which worktree the run drew. It resolves **no** repository: `docs/agents/issue-tracker.md`
   § Addressing names it, and `prep` and `post` read that file themselves. Missing slug or config
   cancels cleanly.

2. **prep** — identify the open PR + its description; compute the diff and **categorise** the changed
   files (reported for context; the categories gate nothing); compose **one Intent Brief** from the linked work items, the referenced
   docs pages, the PR body, and `PRD.md` (recording any **contradictions across sources**); and detect the
   **prior review iteration** by its hidden marker. Writes everything to `<artifacts_dir>/<slug>/pr-review/`.

3. **review** (one node, fresh) — hosts the `code-review` Method's own two-axis fan-out. The Method
   spawns its two sub-agents itself: **Standards** (repo standards + the twelve-item Fowler smell
   baseline, pasted in full) and **Spec** (the diff against the originating intent). Both axes read the
   shared Intent Brief, so **neither judges the diff without knowing what it was for**. Every finding is
   scored on the **confidence rubric** (90–100 Critical / 80–89 Important / 60–79 Minor / below the
   threshold dropped) and carries `aspect: "standards" | "spec"`. The two axes are aggregated, never
   merged or reranked. This replaced seven hand-written aspect nodes and their spawn gates: re-implementing
   the Method's own step 4 as Archon nodes is what [ADR-0030](../adr/0030-harness-hosts-methods.md)'s
   structural bar forbids.

4. **synthesize** — merge + dedupe this run's findings, bucket by severity, assemble the summary
   sections + Intent Check + "What's good".

5. **reconcile** — the re-review coordinator: classify each finding against the prior iteration
   (new / still-present / fixed / regressed), compute the "since iteration N−1" delta, and finalise the
   summary comment (with the `Iteration N` marker + footer) and the inline-comment plan.

6. **review-gate** — **HITL by default** (`gates.pr-review`); skipped in AFK. Shows the composed summary,
   the finding counts, and any contradiction warnings; APPROVE to post, REJECT to halt without posting.

7. **post** — post/update the **summary comment** (matched by the `<!-- unic-dlc-pr-review:iteration= -->`
   marker, never author identity) and, when `inline_comments` and the tracker supports inline threads,
   reconcile **inline comments** per finding (still-present → update, fixed → resolve, regressed →
   reopen, new → create). A tracker whose registered skill cannot comment on a file and line degrades
   to summary-only.

## Gates & AFK

`gates.pr-review` (default `hitl`) governs the review-gate. Set it to `afk` to run unattended — the gate
is skipped and both surfaces post directly. Posting is **advisory / non-blocking**: unlike `/qa`,
`/pr-review` never merges anything, so there is no fail-closed merge guard here — the real merge
checkpoint is `/qa`.

## Prerequisites

- The current branch has an open PR (for the summary + inline comments).
- `.archon/unic-dlc.config.yaml` is present (from `/unic-archon-dlc:setup`).
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` are present — this repository's
  tracker contract, which names the server, the repository, the work-item scope and every role.
- The server that contract names is reachable.
- Archon ≥ 0.7.0 ([ADR-0033](../adr/0033-archon-070-schema-target.md)).

## Configuration reference

Read from `.archon/unic-dlc.config.yaml`:

| Field                            | Type         | Default     | Description                                                                   |
| -------------------------------- | ------------ | ----------- | ----------------------------------------------------------------------------- |
| `gates.pr-review`                | `hitl`/`afk` | `hitl`      | HITL pauses at the review-gate before posting; AFK posts directly             |
| `pr-review.confidence_threshold` | number       | `60`        | Findings below this confidence are dropped before posting                     |
| `pr-review.inline_comments`      | boolean      | `true`      | Post inline per-finding comments in addition to the summary (where supported) |
| `artifacts_dir`                  | string       | `workflows` | Session artefact home (`<artifacts_dir>/<slug>/pr-review/`)                   |
| `docs.*`                         | object       | —           | Composed to fetch the docs pages an intent source cites                       |
| `project.branching`              | string       | `gitflow`   | `gitflow` → base `develop`; else `main` (for the merge-base diff)             |

The tracker itself is **not** configured here. `docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md` carry the server, the repository, the work-item scope and the roles.

## Runs

```
archon workflow run unic-dlc-pr-review "<slug>"
```
