# CONTEXT · unic-spec-review

Domain vocabulary for the `unic-spec-review` plugin. This is a single bounded context inside the [monorepo context map](../../../CONTEXT-MAP.md).

> Status: S1–S8 implemented: classify → Confluence fetch → all eleven dimension/perspective agents → ranked hat-grouped report; Confluence comments read path (`fetchConfluenceComments`, `collectComments --comments`); `LandscapeBrief` detection (`landscape-detector`) and injection into Testability, Feasibility, Spec-versus-Live, and Non-functional agents; multi-Finding Approval Loop via `--post` with `dedup-matcher` Jaccard similarity against existing comments (human tiebreak for borderline matches), inline anchor + footer fallback, `attribution-footer`, `inline-anchor-resolver`, `confluence-writer`; page traversal of child pages and in-body links with a budget gate (`traversal-planner`). The vocabulary below covers the full design; remaining deferred slices: Figma (Dev Mode MCP) and live-system (Playwright MCP).

## Vocabulary

- **Spec (Specification):** the web-specification under review. Usually a Confluence parent page plus child pages, but not exclusively.
- **Source:** one of the four inputs a review reads from: Confluence (pages and comments), Figma (designs and annotations, via the Dev Mode MCP), the Live System (production, via the Playwright MCP), and the local Repo.
- **Reviewer:** the person running `/review-spec`. May be the spec author or someone else.
- **Review:** a single run of `/review-spec` over a set of Sources.
- **Dimension:** one technical aspect a review agent inspects (Gaps, Ambiguity, Spec-versus-Design, Spec-versus-Live, Internal-consistency, Testability, Feasibility, Non-functional).
- **Hat:** a Six-Thinking-Hats perspective tag carried by every Finding. Black is the critique core (the Dimensions); Green is alternatives; Yellow is value and justification; Red is user reaction; White is facts (folded into Gaps and Testability); Blue is the orchestrator and synthesiser.
- **Finding:** a single reviewed issue. Carries a Dimension, a Hat, a Confidence Score, a Severity, and (where possible) an anchor into the spec text.
- **Confidence Score:** how sure the agent is that a Finding is real, used to rank and triage.
- **Severity:** how impactful a Finding is if real, used alongside Confidence to rank.
- **Landscape Brief:** the technology landscape detected from the repo at runtime (stack, test setup, tooling, reachable-prod flag) plus declared adjacent systems. Computed once and shared with the Dimension agents that need it.
- **Adjacent System:** a system the spec depends on that lives outside the current repo (for example a .NET service or the CMS), declared by the Reviewer at intake.
- **Traversal:** the page-graph expansion from pasted seeds through child pages and in-body links, gated by a budget confirmation before a large fetch.
- **Report:** the timestamped markdown artifact written under `.spec-review/` (gitignored) for every Review, grouped by Hat.
- **Approval Loop:** the interactive selection-and-post flow, enabled only by `--post`. Cancellable at every step, including a final "post none" exit.
- **Attribution Footer:** the visible provenance line on every comment the command posts, so any later Review (by anyone) can recognise prior Findings.
- **Near-duplicate:** an existing comment (a prior run's, a colleague's, or a human's) that resembles a candidate Finding closely enough to flag for a human tiebreak in the Approval Loop.

See [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) for the locked design and [`docs/issues/unic-spec-review/PRD.md`](docs/issues/unic-spec-review/PRD.md) for the full specification.
