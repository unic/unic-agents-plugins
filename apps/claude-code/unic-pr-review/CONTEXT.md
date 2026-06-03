# unic-pr-review

A Claude Code Plugin that runs AI-powered PR Reviews with intent checking against Azure Boards / Jira Work Items, emits Confidence-scored Findings, and walks the reviewer through an interactive Approval Loop before any write to the PR.

## Language

**Plugin**:
The `unic-pr-review` Claude Code Plugin itself; the subject of this context. Ships at `apps/claude-code/unic-pr-review/`.
_Avoid_: tool, app, integration

**Reviewer**:
The Unic person who runs the Plugin and is walked through the Approval Loop — the sole human persona in this context. They read the Review Summary (Notices, Intent Check, Findings) and decide what is written back to the PR. Diagnostics written to stderr are **not** addressed to the Reviewer; they are a debugging channel for a maintainer troubleshooting the Plugin.
_Avoid_: operator, user, author, approver

**Review**:
A complete run of the Plugin against either an Azure DevOps Pull Request (ADO Mode) or a local feature branch (Pre-PR Mode) — from intent gathering through aspect fan-out and Approval Loop to the optional write-back.
_Avoid_: scan, audit, check

**Finding**:
A single code observation emitted by a Review Aspect agent, carrying `{ severity, confidence, filePath, startLine, endLine, title, body, suggestion? }`.
_Avoid_: comment, issue, note

**Confidence**:
A 0-100 integer score attached to every Finding. Findings below 60 are dropped before the reviewer ever sees them (ADR-0002).
_Avoid_: score, weight, certainty

**Severity**:
The bucket derived from Confidence — Critical (90-100), Important (80-89), Minor (60-79).
_Avoid_: priority, urgency, level

**Intent Brief**:
The structured synthesis of Work Item intent (description, Acceptance Criteria or Repro Steps, plus Confluence context) produced by the Intent Checker and passed verbatim as a preamble to every Review Aspect agent.
_Avoid_: context, summary, brief

**Intent Check**:
The per-Acceptance-Criterion verdict block (`addressed` / `partially addressed` / `unaddressed`) rendered at the top of the Review Summary, produced by the Intent Assessor. A verdict reflects **coverage** — whether the diff contains changes that implement the criterion — not correctness; code quality is the Findings' concern. Omitted when no Work Items are linked (ADR-0004).
_Avoid_: gap analysis, intent diff, requirements check

**Intent Assessor**:
The agent that produces the live Intent Check verdicts by assessing each Acceptance Criterion against the diff (ADR-0011). Runs in the parallel fan-out batch alongside the Review Aspect agents, but is **not** a Review Aspect — it is spawned by intent presence, not changed-file categories, and is never added to the Spawn Set. The Intent Checker emits the unassessed AC skeleton; the Intent Assessor colours in the verdicts.
_Avoid_: intent checker, verifier, validator

**Re-review Coordinator**:
The agent (named "Arbiter") that runs in Re-review Mode after the Review Aspect fan-out completes. It receives ADO Thread state, prior Findings, and the aspect agents' new Findings with per-prior-Finding verdicts; it classifies each prior Thread (`addressed` / `disputed` / `pending` / `obsolete`) and emits a structured plan (`{ threadActions, persistentUnaddressed, freshFindings }`) that the ADO Writer executes mechanically. It never calls `az devops invoke` and never appends a Bot Signature footer — both are the ADO Writer's responsibility.
_Avoid_: arbiter, planner, classifier

**Bot Signature**:
The load-bearing footer wording `🤖 Reviewed by Claude Code — Iteration N`, owned solely by `scripts/lib/signature.mjs`. Used for Re-review detection and Iteration counting (ADR-0006).
_Avoid_: marker, tag, watermark

**Iteration**:
The review count for a single PR, stored in the Bot Signature, incremented on each Re-review.
_Avoid_: pass, round, run

**Approval Loop**:
The interactive per-Finding `accept` / `edit` / `skip` flow entered when `--post` is given. Resumable state lives under `<cwd>/.unic-pr-review/<key>/state.json` (ADR-0003).
_Avoid_: confirmation, prompt, gate

**Mode**:
One of `pre-pr`, `first-review`, `re-review`, `first-review-fallback`. Selected at runtime by URL presence and Bot Signature detection (ADR-0009).
_Avoid_: state, phase, kind

**Provider**:
A folder bundle at `providers/<name>/` implementing the Source Platform contract (`parsePrUrl`, `agents.{fetcher, writer}`, `discoverWorkItems`). v2 ships `providers/azure_devops/`; later releases may add GitHub or GitLab.
_Avoid_: adapter, backend, driver

**Work Item**:
A normalised task record `{ id, type, url, raw }` returned by `provider.discoverWorkItems(prMetadata)` — an Azure Boards Work Item, a Jira issue, or a manually pasted URL in Pre-PR Mode.
_Avoid_: ticket, story, task

**Notice**:
A prose block at the top of the Review Summary (before the Intent Check) used for warnings, escalations, and fallback conditions.
_Avoid_: alert, banner, warning

**Review Aspect**:
One specialised sub-agent lens applied to the whole diff — e.g. `code-reviewer`, `silent-failure-hunter`, `type-design-analyzer`. Each aspect runs in parallel and emits its own Findings. Which aspects spawn is decided by the Spawn Set. The Intent Assessor runs in the same fan-out batch but is **not** a Review Aspect — it emits verdicts, not Findings, and is never in the Spawn Set.
_Avoid_: dimension, pass, check

**Spawn Set**:
The `Set<string>` of Review Aspect agent names returned by `decideSpawnSet()` in `scripts/lib/changed-file-analyser.mjs`. Computed once before any agent runs, based on changed-file categories (ADR-0008).
_Avoid_: agent list, run set, active agents

## Relationships

- A **Review** runs in exactly one **Mode**, decided at startup
- A **Mode** is selected by the active **Provider**'s URL parsing plus **Bot Signature** detection
- The Intent Checker turns one or more **Work Items** into a single **Intent Brief** plus an unassessed AC skeleton
- The **Intent Assessor** receives the **Intent Brief**, the AC skeleton, and the diff, and produces the **Intent Check** verdicts
- Every Review Aspect agent receives the **Intent Brief** (when available) and emits zero or more **Findings**
- Each **Finding** carries a **Confidence** score that determines its **Severity** bucket
- The **Approval Loop** mediates between **Findings** and PR write-back
- The **Bot Signature** records the **Iteration** and lets the next Review detect prior runs
- A **Notice** can appear above the **Intent Check** when something needs the reviewer's attention

## Example dialogue

> **Dev:** "What happens if a PR links no Work Items at all?"
> **Domain expert:** "The Intent Check block is just omitted from the Review Summary. Per ADR-0004 the absence of intent is a legitimate state — we only hard-stop if a referenced source is unreachable."

> **Dev:** "Why does `doctor` verify `az devops user show --user me` and not just `az devops login`?"
> **Domain expert:** "ADR-0006 stores Iteration state in the PR's own Bot Signature. To detect our own prior comments at Review time the Plugin caches the authenticated ADO user id at startup. If `user show` can't resolve the identity, Re-review detection breaks — so we check it during doctor instead of failing mid-Review."

> **Dev:** "A Finding came back with Confidence 55. Why didn't I see it in the Summary?"
> **Domain expert:** "Anything below 60 is filtered out per ADR-0002. That's the noise floor — Minor starts at 60."
