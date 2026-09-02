# unic-ticket-specification

A portable Archon workflow that takes a tracker ticket from intake to "ready for implementation".
It is tracker-agnostic (Jira, Azure DevOps, GitHub), multi-repo, and OS-independent (Windows /
macOS): every tracker/tenant/repo/OS detail lives in a per-project config, never in the workflow.

## Language

### Inputs and routing

**Ticket reference**:
An existing-ticket pointer the workflow detects from its argument — a Jira key (`ACME-1234`), an
Azure DevOps work-item id, or a GitHub issue number (`#123`). Distinguished from a free-text
description by the `detect-input` node, using `project.key_prefixes` from config.
_Avoid_: issue id, ticket number (ambiguous across trackers)

**Mode**:
The detected input class: `existing` (groom and update a known ticket) or `create` (a new ticket
from a free-text description). Drives the `apply-create` / `apply-update` branch.
_Avoid_: action, operation

**Kind**:
The template-selection classification of a ticket: `BUG` or `CR_STORY`. Derived by the `classify`
node from the tracker issue-type name via `classification.bug_types` / `cr_story_types`, defaulting
to `CR_STORY` when undeterminable.
_Avoid_: type (collides with the tracker's own issue-type name), category

### Configuration

**Per-project config**:
`.archon/ticket-spec.config.yaml` — the single source of all tracker/tenant/repo/OS detail. The
workflow and every command read it at runtime. Shipped as `ticket-spec.config.example.yaml`; each
project copies it and fills it in.
_Avoid_: settings, options file

**Tracker access**:
How the workflow reaches the tracker: MCP-first (loaded from the fixed path
`.archon/mcp/ticket-spec-tracker.json`) with a CLI fallback (`jira` / `az` / `gh`) named in config.
_Avoid_: connection, integration

**Repos**:
The one-or-many code checkouts listed under `repos:` in config. Analysis greps across **all** of
them. Paths are relative or absolute, always forward-slash.
_Avoid_: workspace, codebase (singular implies one repo)

### Artifacts

**Analysis**:
`$ARTIFACTS_DIR/analysis.md` — the cross-repo + linked-docs investigation produced by `uts-analyze`,
including open questions and assumptions. Feeds classification, rewrite, completeness, and estimate.
_Avoid_: research, report

**Draft description**:
`$ARTIFACTS_DIR/draft-description.md` — the rewritten ticket body in the configured Bug or CR-Story
template. The unit the human reviews and that gets written to the tracker on approval.
_Avoid_: body, content

**PERT estimate**:
`$ARTIFACTS_DIR/estimate.md` — a three-point (optimistic / most-likely / pessimistic) effort
estimate with a computed expected value (E). Carries explicit caveats when completeness < high.
_Avoid_: estimate (unqualified), story points

**Completeness rating**:
A non-blocking `low` / `medium` / `high` annotation written to `$ARTIFACTS_DIR/completeness.md`. It
never stops the workflow — incomplete tickets are still estimated, with caveats.
_Avoid_: readiness score, quality gate

**Proposal**:
`$ARTIFACTS_DIR/proposal.md` — the consolidated draft + estimate + completeness shown at the
approval gate. A full local copy is also persisted under `output.dir` so it survives rejection or
failure.
_Avoid_: summary, output

### Control flow

**Approval gate**:
The mandatory interactive node (`approval-gate`) that pauses the workflow until a human approves or
rejects. Nothing is written to the tracker before it. Rejection feeds `$REJECTION_REASON` back to
revise the draft / estimate / target and re-present, up to 3 attempts.
_Avoid_: review step, confirmation

## Relationships

- `detect-input` sets **Mode**, which later selects `apply-create` vs `apply-update`
- `analyze` produces the **Analysis**, which every downstream node reads
- `classify` sets **Kind**, which selects `rewrite-bug` vs `rewrite-crstory`
- The **Per-project config** is read by the workflow and all seven `uts-*` commands; nothing
  tracker/tenant/repo/OS-specific is hardcoded in the workflow YAML
- **Tracker access** is resolved the same way in `analyze`, `apply-create`, and `apply-update`:
  MCP from `.archon/mcp/ticket-spec-tracker.json`, else the configured CLI
- The **Approval gate** is the only boundary at which the workflow writes to the tracker; the
  **Proposal** is what it presents there
