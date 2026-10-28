---
description: Run the unic-archon-dlc PR review workflow — an intent-grounded two-axis review, then a summary comment + inline comments posted/updated on the current PR, with iteration-aware re-review.
---

# /unic-dlc-pr-review

Runs the `pr-review` box: composes a shared **Intent Brief** (from the linked work items, the referenced
docs pages, the PR description, and `PRD.md`), runs **one review node** that hosts the `code-review`
Method's own **two-axis fan-out** — **Standards** (repo standards plus the twelve-item Fowler smell
baseline) and **Spec** (the diff against the originating intent) — synthesises the findings,
**reconciles them against the prior iteration**
(new / still-present / fixed / unverified / regressed). After a config-gated human confirm, it posts or
updates a single structured **summary comment** plus **inline comments** on the current PR.

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
   `docs.*`, and the whole `sdlc_needs` block). It runs `sdlc_needs.install` once
   for the whole run and reports whether it did — this Box runs no check by instruction, and it
   installs anyway, so that a sub-agent deciding it needs to run something fails on that decision
   rather than on which worktree the run drew. It resolves **no** repository: `docs/agents/issue-tracker.md`
   § Addressing names it, and `prep` and `post` read that file themselves. Missing slug or config
   cancels cleanly.

2. **prep** — identify the open PR + its description. Compute the diff from the merge-base with the
   PR's own target branch. When a query confirms there is no PR, or the tracker exposes none, use
   Archon's `$BASE_BRANCH` instead. `/unic-archon-dlc:setup` reports which branch that is. When the two
   differ, the summary carries a warning. prep fetches the diff base first. When the tracker query fails,
   or the diff base still does not resolve, `guard-no-diff-base` cancels the run. prep also
   **categorises** the changed files. The categories are reported for context and gate nothing. It
   composes **one Intent Brief** from the linked work items, the referenced docs pages, the PR body and
   `PRD.md`, and records any **contradictions across sources**. It detects the **prior review
   iteration** by its hidden marker. It records the commit this run reviews, from `git rev-parse HEAD`,
   and reads back the head the prior iteration recorded in its summary. It reports no prior head when
   the prior summary carries none, which is the case for one an older Box posted, or when the clone
   cannot reach that commit after a fetch, as after a rebase or a force push. It writes everything to
   `<artifacts_dir>/<slug>/pr-review/`.

3. **review** (one node, fresh) — hosts the `code-review` Method's own two-axis fan-out. The Method
   spawns its two sub-agents itself: **Standards** (repo standards + the twelve-item Fowler smell
   baseline, pasted in full) and **Spec** (the diff against the originating intent). Both axes read the
   shared Intent Brief, so **neither judges the diff without knowing what it was for**. Every finding is
   scored on the **confidence rubric** (90–100 Critical / 80–89 Important / 60–79 Minor / below the
   threshold dropped) and carries `aspect: "standards" | "spec"`. The two axes are aggregated, never
   merged or reranked. This replaced seven hand-written aspect nodes and their spawn gates: re-implementing
   the Method's own step 4 as Archon nodes is what [ADR-0030](../adr/0030-harness-hosts-methods.md)'s
   structural bar forbids.
   `review` first deletes the `review.json` an earlier iteration left, and every stop after that
   writes a new one. Each sub-agent ends its report with every command it ran other than reading files
   and git, and the outcome it observed. A check is a command that runs the project's toolchain to
   verify the code or starts a dev server. `review` records only the checks and drops every other
   command. Each check goes into the `reported_checks` array of `review.json` as one entry per need
   it serves, with the axis, the need and the reported outcome, which names no command or tool. `review` judges the need from what the
   command does, never by matching the command's text against a value in `sdlc_needs`, and records a
   check that serves no declared need as `undeclared`. It never records `install`. It then removes
   the commands section from both reports, so no command or result reaches the Intent Check. The
   array is empty when no sub-agent reported a check. `review.json` also carries `subagents_ran`,
   which is true when at least one review sub-agent started, on every path, a stop included. It also
   carries `blocked`, which is empty for a review that ran to the end and holds the printed sentence
   for a stop. A review is blocked when `blocked` is not empty, or when `blocked` is missing and
   `subagents_ran` is not true.

4. **synthesize** — merge + dedupe this run's findings, bucket by severity, assemble the summary
   sections + Intent Check + "What's good". It states no check result as a fact in any section, except
   in the body of a finding raised from a failed check. When `review.json` is missing, it stops and
   writes no findings, and `reconcile` then stops without a summary. When the review is blocked, it
   writes an empty findings list and a callout that names the `blocked` sentence, with no severity
   section, so the reader sees that the review stopped. `reconcile` then rules no prior finding
   `fixed`: every unmatched open or unverified prior is `unverified`.

5. **reconcile** — the re-review coordinator: classify each finding against the prior iteration
   (new / still-present / fixed / unverified / regressed), compute the "since iteration N−1" delta, and
   finalise the summary comment (with the `Iteration N` marker, the head marker and the footer) and the
   inline-comment plan. A prior finding that this run's review omits is `fixed` only when its file
   changed between the prior iteration's recorded head and this one, by `git diff --name-only` between
   the two heads. Otherwise it is `unverified`. That happens when its file did not change, when it is
   scoped to the pull request, a work item or the repository, or when there is no usable prior head.
   The PR's diff against its base is never evidence for a `fixed`. When there is no usable prior head,
   the summary says why and asks the developer to check each `unverified` finding by hand. An anchored
   finding that has retired stays retired on later iterations. `prep` reads it as fixed when the prior
   summary does not show its hash and its thread is resolved or carries a `fixed` reply marker.
   Above every finding, in every iteration, the summary carries the block "Checks this review was not
   asked to run". The block states that this Box instructed none of the project's declared checks, so
   nothing in the review verifies a claim that a build, lint, type-check or test passes. It names the
   declared `sdlc_needs` keys, `install` excluded, by key and never by value, or says that the project
   declares no check. It says that a review sub-agent may still have run one of them on its own, and
   leaves that sentence out only when `review.json` says `subagents_ran: false`. It renders each
   `reported_checks` entry as that sub-agent's claim, naming the need and the outcome and never the
   command, and it ends with `bootstrap`'s install report, verbatim. When `reconcile` cannot read
   `review.json`, or the file lacks `subagents_ran` or `reported_checks`, the block keeps the sentence
   on sub-agents, renders no reported check, and says that `review` left no readable report of what its
   sub-agents ran. The block states what the Box instructed, not what ran
   ([ADR-0037](../adr/0037-config-declares-sdlc-needs.md) §8).

6. **review-gate** — **HITL by default** (`gates.pr-review`); skipped in AFK. Shows the composed summary,
   the finding counts, and any contradiction warnings; APPROVE to post, REJECT to halt without posting.

7. **post** — post/update the **summary comment** (matched by the `<!-- unic-dlc-pr-review:iteration= -->`
   marker, never author identity) and, when `inline_comments` and the tracker supports inline threads,
   reconcile **inline comments** per finding. It updates a still-present thread, resolves a fixed one,
   reopens a regressed one and opens a thread for a new finding. On an unverified thread it posts one
   reply asking the author to check the finding by hand, and leaves the status as it is. It reads each
   thread's status first. When a thread is resolved and its finding is reported again, `post` reopens
   it first and then replies, whoever resolved it. Every reply carries a hidden
   marker with the thread's finding hash and the verdict. `post` skips a reply when the thread's latest
   marker already holds both. So a rerun after a `post` that failed halfway, or another iteration on the
   same commit, repeats no reply. `post` posts nothing when `SESSION/comment.md` is missing or belongs
   to another run. A tracker whose registered skill cannot comment on a file and line
   degrades to summary-only.

   These limits apply:

   - On the first iteration after an upgrade, the prior summary carries no head marker. `post` then
     posts nothing on a thread whose finding retires, because the older Box's resolved reply carries no
     marker and a second reply could resolve a thread a person reopened on purpose.
   - A thread that an older Box resolved, and whose hash the prior summary no longer shows, reads as
     fixed, because it is resolved. It stays retired and gets no further reply. If a person reopened such a
     thread, it carries no `reply=` marker, and `prep` reads it as open.
   - A killed run can post the fixed reply and die before it resolves the thread. The rerun cannot tell
     that thread from one a person reopened on purpose, so it leaves the thread open. A false open is
     the safe direction, because it costs the author one click.
   - A killed run can reopen a thread and die before it replies. The thread is then open with no new
     reply.
   - A renamed file appears in the change between the two heads under its new path only. A finding on
     the old path is `unverified`.

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

The tracker itself is **not** configured here. `docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md` carry the server, the repository, the work-item scope and the roles.

## Runs

```
archon workflow run unic-dlc-pr-review "<slug>"
```
