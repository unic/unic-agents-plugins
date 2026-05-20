# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- Added `/unic-archon-dlc:setup` slash command for conversational plugin configuration

### Removed
- Removed `hooks/install.mjs` and `hooks` field from `plugin.json`

### Fixed
- Fixed shell injection in `setup` command Step 5: `{ANSWERS_JSON}` is now substituted directly inside the `<<'EOJS'` heredoc instead of being assigned to a shell variable, so single quotes in e2e commands (e.g. `pnpm test --grep 'smoke'`) no longer break the assignment
- Fixed unreachable `STATE = 'partial'` branch in `setup` command Step 2: config discovery now uses a raw `JSON.parse` instead of the strict `loadConfig`/`isConfigError` path, so partial configs (files missing one or more mandatory fields) are properly detected and users are prompted only for the missing fields

## [0.1.0] — 2026-05-15

Initial release of the unic-archon-dlc plugin. Ships the complete AI development lifecycle
as six Archon workflow DAGs with human approval gates at every decision boundary.

### Added

- **Install hook** (`/unic-dlc-install`): auto-detects tracker from git remote, deduces PR
  strategy and branching model, writes `.archon/unic-dlc.config.json`, agent skill docs under
  `docs/agents/`, and idempotent `## Agent skills` block in `CLAUDE.md`.
- **`triage` workflow** (`/unic-dlc-triage`): headless/on-demand; reads current issue states,
  reconciles `docs/workflow/ROADMAP.md`, and produces `HANDOFF.md` with phase, open issues,
  blockers, and recent decisions.
- **`explore` workflow** (`/unic-dlc-explore <slug>`): four parallel research nodes
  (stack/features/architecture/pitfalls) → synthesize → prototype + spike verdicts →
  interactive code-preserve gate → spike ticket creation.
- **`plan` workflow** (`/unic-dlc-plan <slug>`): adversarial spec interview (loop) → PRD
  synthesis → human PRD gate → issue decomposition → Nyquist test-command mapping →
  plan-checker validation loop (max 3 iterations, stall detection) → YAML generator →
  human plan gate.
- **`build` workflow** (`/unic-dlc-build <slug>`): slopcheck package gate → generated
  `build-<slug>.yaml` (red→green TDD per issue, parallel across independent issues) →
  verification (stub detector, coverage) → goals-check coverage matrix → consolidation
  report → human build PR gate.
- **`review` command** (`/unic-dlc-review`): self-contained four-aspect code review (code
  quality, test adequacy, silent failures, type design); posts structured comment via tracker
  adapter; updates prior comment on re-run. No dependency on `pr-review-toolkit`.
- **`qa` workflow** (`/unic-dlc-qa <slug>`): e2e suite → coverage gate → interactive UAT
  gate (acceptance criteria checklist) → PR base verification → merge via tracker CLI with
  branching-strategy-aware branch deletion.
- **`cleanup` workflow** (`/unic-dlc-cleanup <slug>`): architecture review (technical drift,
  intent drift, deepening opportunities) → per-ADR interactive consolidation gate → reuse of
  shared triage workflow.
- **lib modules**: `config-loader`, `setup-explorer`, `labels-config`, `agent-docs-writer`,
  `tracker-adapter`, `handoff-generator`, `findings-writer`, `prd-writer`, `spike-verdicts`,
  `issues-schema` (topological sort), `dag-builder` (YAML generator), `slopcheck`,
  `stub-detector`.
- **86 `node:test` tests** covering all lib modules.
