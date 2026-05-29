# unic-pr-review — Architecture Decision Records

Plugin-scoped ADRs. Monorepo-wide decisions live in `../../../../../docs/adr/`.

- [0001](0001-multi-source-intent-with-shared-atlassian-credentials.md) — Multi-source intent gathering with shared Atlassian credentials
- [0002](0002-confidence-scored-findings.md) — Confidence-scored Findings with explicit Severity thresholds
- [0003](0003-interactive-approval-as-default.md) — Interactive Approval Loop as the default write path
- [0004](0004-hard-stop-on-missing-doc-credentials.md) — Hard-stop when intent sources are unreachable
- [0005](0005-az-cli-over-rest.md) — `az` CLI for Azure DevOps, custom HTTP for Atlassian
- [0006](0006-iteration-state-in-pr.md) — Iteration state lives in the PR, not locally
- [0007](0007-delta-diff-for-re-review.md) — Re-review uses a delta diff, not a full PR diff
- [0008](0008-conditional-sub-agent-spawning.md) — Conditional sub-agent spawning over per-file chunking
- [0009](0009-pre-pr-mode-as-peer-of-pr-modes.md) — Pre-PR mode is a peer operating mode, not a flag
- [0011](0011-intent-assessor-for-live-ac-verdicts.md) — Intent Assessor as a dedicated agent for live AC verdicts

## Planned

The following ADRs are referenced from the PRD but have not landed yet. Each is scheduled to ship with the implementation slice that first exercises the decision.

- **ADR-0010 — Provider as a folder bundle.** Captures the `providers/<name>/` shape over a single-file alternative. Lands with issue [#148](https://github.com/unic/unic-agents-plugins/issues/148) (ADO first-review preview).
- **Amendment to ADR-0001 — provider-owned work-item discovery.** Adds a note that each Provider owns `discoverWorkItems(prMetadata)` and the Intent Checker consumes the normalised list. Lands with issue [#148](https://github.com/unic/unic-agents-plugins/issues/148).
