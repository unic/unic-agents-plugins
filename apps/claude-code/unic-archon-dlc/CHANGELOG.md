# Changelog

## [Unreleased]

### Breaking
- **Deleted the legacy `.archon/workflows/unic-dlc-plan.yaml` + `.archon/commands/unic-dlc-plan.md`** (ADR-0022). The monolithic plan workflow is fully superseded by `/specs` (PRD) + `/tickets` (issues); it also used the inert `type:`-style schema (ADR-0011).
- **Dissolved `lib/tracker-adapter.mjs`** (+ `test/tracker-adapter.test.mjs`, and its entry in the `test` script) per ADR-0018. Tracker CLI-string generation is no longer a lib: `/tickets` (and other boxes) compose the configured tracker system-skill (MCP-first) or `gh`/`az`/`jira` CLI from config in prose (ADR-0016).

### Added
- **`commands/tickets.md`** — the `/tickets` box (ADR-0022, ADR-0017): an in-session command that decomposes an approved PRD into independently-grabbable **vertical tracer-bullet slices**, attaches a test seam per slice (nyquist-map), validates the set in a single conversational pass (dependency integrity, PRD-criteria coverage, mandatory fields via `issues-schema`, test-seam presence), writes a dependency-ordered `<artifacts_dir>/<slug>/issues.json`, publishes the issues to the configured tracker (intent on the issue — contract C), and opens a HITL tickets gate. Composes Matt Pocock's `/to-issues`. Runs the definitive estimation wave when `estimations` is `definitive | both`.
- **`tickets` config block** — `tickets.gate` (`open-pr` | `stage-only`, default `open-pr`), mirroring `specs.gate`. See ADR-0022.

### Changed
- **`/tickets` stops at a build-ready `issues.json`; it does NOT generate a build DAG** (ADR-0022). `/build` (step 06) will consume `issues.json` via a generic loop rather than a per-slug generated workflow — so `lib/dag-builder.mjs` is off the main path and left untouched pending the `/build` step. Contract B (fresh-context red/green, ADR-0012) is preserved; its delivery mechanism moves from codegen to a runtime loop. The step-06 redesign handoff doc is updated accordingly.

### Fixed
- (none)

## [0.3.0] — 2026-07-02

### Breaking
- **`lib/prd-writer.mjs` reshaped (ADR-0018).** The hardcoded 7-section template is gone: `writePrd(projectDir, slug, content, artifactsDir = 'workflows')` now persists an already-rendered PRD string (was `writePrd(projectDir, slug, sections)`), and `readPrd` takes the same `artifactsDir`. The PRD now lands at **`<artifacts_dir>/<slug>/PRD.md`** (default `workflows/<slug>/`), not `docs/workflow/<slug>/`. `validatePrdSections(content, requiredHeadings = DEFAULT_PRD_HEADINGS)` is now generic (headings passed in). The legacy `.archon/workflows/unic-dlc-plan.yaml` is superseded by `/specs` + `/tickets` and left untouched until step 05.

### Added
- **`commands/specs.md`** — the `/specs` box (ADR-0020, ADR-0017): an in-session command that turns an idea (or an existing spec / Figma / UX / issue) into one human-approved PRD by **branch-on-input** (converse / ingest / hybrid), composing Matt Pocock's `/grill-with-docs` + `/to-prd` and the configured docs/design/tracker system-skill (MCP-first, CLI-fallback). Adds a seam-design approval step, config-gated provisional estimation, opt-in docs publishing, and a HITL PRD gate.
- **`templates.prd` default** — the 7-section PRD scaffold now ships in config (`DEFAULT_PRD_TEMPLATE` in `config-schema.mjs`, ADR-0018); teams override it to change the PRD shape.
- **`specs` config block** — `specs.discuss_mode` (`discuss` | `assumptions`, default `discuss`) and `specs.gate` (`open-pr` | `stage-only`, default `open-pr`). See the amended ADR-0020.

### Changed
- **`README.md`** configuration reference: `templates.prd` now defaults to the scaffold; added `specs.discuss_mode` and `specs.gate` rows.

### Fixed
- (none)

## [0.2.0] — 2026-07-02

### Breaking
- **`/setup` is now conversational and writes the rich `.archon/unic-dlc.config.yaml`** (ADR-0019, supersedes ADR-0001), replacing the flat `.archon/unic-dlc.config.json`. The command detects the stack, runs verify-only skill discovery (introspect MCP/skills + CLI probes; never installs) to register a capability→tool map, verifies Matt Pocock's declared skill suite (warn + degrade, non-blocking on a missing required capability), and composes the team's system-skills for the _how_. An existing legacy `.json` is read and migrated but **left in place** (other tools may read it) — no backup file, no delete.
- **Dissolved the heavy setup libs** `lib/install-runner.mjs`, `lib/setup-explorer.mjs`, `lib/config-loader.mjs`, and `lib/agent-docs-writer.mjs` (and their tests). Their `docs/agents/` + `CLAUDE.md` marker-block behaviour is re-homed to idempotent prose steps in `commands/setup.md`. See ADR-0018.

### Added
- **`lib/config-schema.mjs`** — the one surviving tested lib (imports `yaml`): `loadConfig` (parses `.yaml`/`.json`), `validateConfig` (mandatory-path invariant), `mergeConfig` (deep, idempotent, `defaults < existing < answers`), `migrateLegacy` (flat ADR-0001 JSON → rich nested shape, preserving hand-added labels such as `release`), `toYaml`, and `detectRepoLayout`. Covered by `test/config-schema.test.mjs`.
- **`yaml`** runtime dependency (pinned via the pnpm catalog).

### Changed
- **`lib/archon-check.mjs`** now enforces a behavioural min-floor (`checkArchon` rejects Archon `< 0.5.0` via `MIN_ARCHON_VERSION`) instead of an exact-version match — the key-discriminated schema (gates/loops/fresh-context) requires `≥ 0.5.0` (ADR-0011/0019). Unparseable versions are non-blocking. The `incompatibleVersions` override is preserved (bare-array and options-object forms both accepted).
- **`README.md`** configuration reference rewritten to the rich YAML schema.

### Fixed
- (none)

## [0.1.2] — 2026-05-23

### Breaking
- (none)

### Added
- Updated `buildDomainDoc` multi-context branch in `lib/agent-docs-writer.mjs` so the generated `docs/agents/domain.md` notes that each context may keep its own `docs/adr/` for context-scoped decisions, and branches the trailing "How agents use this" paragraph by `isMulti` so the multi-context form points readers via `CONTEXT-MAP.md` and acknowledges both root and context-scoped `docs/adr/`. The wording is portable — no hardcoded path leaks into Consumer output. A node:test assertion in `test/install-agent-docs.test.mjs` guards the phrases in multi-context mode and confirms they are absent in single-context mode.

### Fixed
- (none)

## [0.1.1] — 2026-05-23

### Added
- Added `/unic-archon-dlc:setup` slash command for conversational plugin configuration
- New `lib/dogfood-banner.mjs` module: exports `AGENT_DOC_BANNER`, `SKILLS_BLOCK_BANNER`, and `prependBanner()` — all banner strings in one place.
- Every `docs/agents/*.md` file generated by `agent-docs-writer.mjs` now begins with `AGENT_DOC_BANNER`, signalling it is auto-generated and explaining how to regenerate it.
- The `<!-- unic-archon-dlc:begin/end -->` block in `CLAUDE.md` now includes `SKILLS_BLOCK_BANNER` as its first line, making the auto-managed region visible in plain text (not only via HTML-comment markers).
- Dogfood state in this repo updated: `docs/agents/*.md` and the `AGENTS.md` block now carry the banner.

### Removed
- Removed `hooks/install.mjs` and `hooks` field from `plugin.json`

### Fixed
- Build `run-build` node prompt now invokes the generated per-slug workflow by name (`archon workflow run unic-dlc-build-<slug>`) instead of the no-longer-supported `archon run <path>`
- Cleanup workflow `run-triage` error message now says `archon workflow run failed` (matches the actual command); cleanup command doc references the by-name invocation instead of `archon run`
- `docs/agents/workflow.md` (and the `agent-docs-writer.mjs` generator) now list all seven workflow DAGs — the missing `review` phase has been added alongside the six lifecycle phases. The `review` row's artifact column now covers both PR-comment trackers (github/ado/jira) and the `local-markdown` tracker (which writes `docs/workflow/<slug>/review-comment.md`); the install-agent-docs test anchors on the unique `/unic-dlc-review` command string so the row can't silently regress
- Fixed stale reference in `CONTEXT.md`: Relationships section now credits the **Setup** slash command (not the deleted install hook) for writing config/docs into the target project
- Fixed `repo_layout` default and valid-values columns in `README.md` configuration reference table to use `single-context` (as produced by `detectRepoLayout()`) instead of `single`
- Fixed shell injection in `setup` command Step 5: `{ANSWERS_JSON}` is now substituted directly inside the `<<'EOJS'` heredoc instead of being assigned to a shell variable, so single quotes in e2e commands (e.g. `pnpm test --grep 'smoke'`) no longer break the assignment
- Fixed unreachable `STATE = 'partial'` branch in `setup` command Step 2: config discovery now uses a raw `JSON.parse` instead of the strict `loadConfig`/`isConfigError` path, so partial configs (files missing one or more mandatory fields) are properly detected and users are prompted only for the missing fields
- `runInstall`: optional fields (`e2e_command`, `model_profile`, etc.) from a partial config file (one missing mandatory fields) are no longer silently dropped during merge
- `runInstall`: partial-write error messages now clarify which earlier stages succeeded ("Config written to …" for docs-stage failures; "Config and docs written." for CLAUDE.md-stage failures)
- Wrapped all three `node --input-type=module` heredocs in `setup` command (Steps 1, 2, 5) in try/catch so that import failures (e.g. `ERR_INVALID_URL`, `ERR_MODULE_NOT_FOUND` when `CLAUDE_PLUGIN_ROOT` is unset or wrong) always produce JSON output instead of crashing with no output
- Fixed silent discard of corrupt config in Step 2: an invalid-JSON config file now surfaces an `error` field in the output and stops setup with an actionable message, instead of silently mapping the `SyntaxError` to `STATE = 'fresh'` and overwriting the user's config
- `runInstall`: corrupt config files (invalid JSON) now return a `stage: 'config'` error with an actionable message instead of silently discarding the existing config and overwriting it; file read errors (e.g. `EACCES`) are also surfaced as early returns
- Added missing test for `stage: 'claude-md'` failure branch, test for corrupt-config parse error; removed always-passing placeholder test
- Corrected dogfood banner regenerate hint from `/unic-archon-dlc-setup` to `/unic-archon-dlc:setup` (the actual slash-command name uses a colon, not a dash). Tightened `dogfood-banner.test.mjs` to assert the exact command string. Regenerated `docs/agents/*.md` carry the corrected banner.
- `AGENT_DOC_BANNER` no longer references a non-existent "setup-runner"; it now points to the real entry point `runInstall()` in `lib/install-runner.mjs`. `SKILLS_BLOCK_BANNER` now names the slash command (`/unic-archon-dlc:setup`) explicitly so readers who land inside the marker block via search have unambiguous regenerate instructions. Regenerated `docs/agents/*.md` and the `AGENTS.md` block carry the updated wording; PRD canonical wording updated to match.

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
