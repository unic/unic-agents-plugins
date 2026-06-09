# AGENTS.md · unic-spec-review

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`unic-spec-review` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It runs an adversarial review of web specifications across four sources (Confluence pages & comments, Figma designs via the Dev Mode MCP, the live production system via the Playwright MCP, and the local repo) and emits Confidence-scored, Six-Hats-tagged Findings. An interactive Approval Loop, gated behind `--post`, publishes selected Findings as Confluence comments.

> Status: S1–S9 implemented (URL classify of all pasted Confluence/Figma/live links → Confluence fetch → Figma gathering via the Dev Mode MCP → live-system gathering via the Playwright MCP → all eleven review agents, with Spec-versus-Design fed real Figma context and Spec-versus-Live fed real live observations → ranked hat-grouped report; Confluence comments read path; `LandscapeBrief` detection and injection into Testability, Feasibility, Spec-versus-Live, and Non-functional agents; multi-Finding write path via `--post`: `dedup-matcher` Jaccard similarity against existing comments with human tiebreak for borderline matches, inline-anchor resolution, Markdown-to-storage conversion (`md-to-storage.mjs`), attribution footer; page traversal of child pages and in-body `/wiki/` links with a budget-gated confirmation; fail-loud MCP checks for Figma and live sources). All slices complete.

## Where to start

Root docs (monorepo-wide conventions: pnpm scripts, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement):

- [Root AGENTS.md](../../../AGENTS.md) is the source of truth for cross-cutting rules
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) indexes all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) holds monorepo-wide architecture decisions

This Plugin's own decisions:

- [Plugin docs/adr/](docs/adr/): ADRs 0001 to 0004 (vendoring/self-containment, similarity dedup, Six-Hats lens, inline-anchored comments) and a README index
- [CONTEXT.md](CONTEXT.md): domain vocabulary for this bounded context

## Design (locked via grilling; see [PRD](docs/issues/unic-spec-review/PRD.md))

- **Home:** standalone plugin. Commands `/review-spec` (main), `/spec-doctor` (preflight), `/setup-confluence` (credential wizard).
- **Self-containment (hard requirement):** installable and usable on its own, with no runtime or setup dependency on `unic-pr-review` or `unic-confluence`. Ships its own `/setup-confluence` wizard and vendored credential handling. Duplication across plugins is accepted as the price of self-containment.
- **Reuse by vendoring:** copy `atlassian-fetch.mjs`, `credentials.mjs`, and the `setup-confluence` wizard from `unic-pr-review` (plugins ship independently, so copy rather than cross-import). Extend `atlassian-fetch` with Confluence comment read + write. Credentials use the shared `~/.unic-confluence.json` convention (or `CONFLUENCE_*` env vars): a shared credential store, not a plugin coupling, so a user with both plugins configures Confluence once.
- **Sources:** Confluence (pages + comments), Figma (Dev Mode MCP), live prod (Playwright MCP), local repo. MCPs are runtime-discovered; fail loud if absent.
- **Review engine:** parallel multi-agent. Black-hat core = 8 dimension agents (Gaps, Ambiguity, Spec↔Design, Spec↔Live, Internal-consistency, Testability, Feasibility, NFR); plus Green (alternatives), Yellow (value), Red (UX reaction); White folded into Gaps+Testability; Blue = orchestrator/synthesis. Every Finding is hat-tagged + Confidence-scored.
- **Landscape Brief:** the tech landscape is detected from the repo at runtime (never hardcoded) plus user-declared out-of-repo systems; computed once and injected into Testability, Feasibility, Spec↔Live, NFR.
- **Output:** timestamped markdown report (`.spec-review/`, gitignored) + conversational ranked triage.
- **Posting:** inline-anchored Confluence comment (v2 API), footer fallback; visible attribution footer (no hidden marker). De-dup by content-similarity vs all existing comments (own + other users' + human) + human tiebreak in the loop.
- **Write safety:** bare run = read-only. `--post` enables the Approval Loop. Invariant: `--post` makes posting _possible_, never automatic, and stays cancellable at every step, including a final "post none" exit.

## Commands

```sh
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version               # mirror plugin.json version into marketplace.json + package.json
pnpm tag                        # create the unic-spec-review@<version> git tag locally
pnpm verify:changelog           # check CHANGELOG entry for the current version
pnpm test                       # run node:test suite
pnpm typecheck                  # tsc --noEmit type check
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).
