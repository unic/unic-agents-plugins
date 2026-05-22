# Migration plan: docs/issues/ → GitHub Issues

**Total issues to create:** 69
**Features:** 11
**Will be closed after creation:** 52

## Order (oldest file first → GitHub issue # ascending)

| # | Date | Slug | File | Title | Status → label | Category → label | Blocked by |
|---|------|------|------|-------|----------------|------------------|------------|
| 1 | 2026-05-03 | `pr-review-rereview` | `01-normalize-bot-signature.md` | Normalize bot signature | `closed` | `enhancement` | — |
| 2 | 2026-05-03 | `pr-review-rereview` | `02-detect-prior-review.md` | Detect prior review + extract parse-signature and detect-prior-review modules | `closed` | `enhancement` | #1 |
| 3 | 2026-05-03 | `pr-review-rereview` | `03-target-latest-iteration.md` | Target latest PR iteration | `closed` | `enhancement` | #2 |
| 4 | 2026-05-03 | `pr-review-rereview` | `04-incremental-diff-baseline.md` | Incremental diff baseline | `closed` | `enhancement` | #3 |
| 5 | 2026-05-03 | `pr-review-rereview` | `05-classify-existing-threads.md` | Classify existing threads + extract classify-thread module | `closed` | `enhancement` | #2 |
| 6 | 2026-05-03 | `pr-review-rereview` | `06-reply-to-threads.md` | Reply to threads + extract match-finding module + completion marker | `closed` | `enhancement` | #4, #5 |
| 7 | 2026-05-03 | `pr-review-rereview` | `07-summary-comment-policy.md` | Summary comment policy on re-review | `closed` | `enhancement` | #6 |
| 8 | 2026-05-03 | `pr-review-rereview` | `08-test-fixture-suite.md` | Complete test fixture suite | `closed` | `enhancement` | #2, #5, #6 |
| 9 | 2026-05-03 | `pr-review-rereview` | `09-version-bump-and-release.md` | Version bump, README, CLAUDE.md, ADR 0009 | `closed` | `enhancement` | #7, #8 |
| 10 | 2026-05-03 | `auto-format-config` | `01-config-module.md` | Extract `lib/config.mjs` with `DEFAULTS`, `loadConfig`, and tests | `closed` | `refactor` | — |
| 11 | 2026-05-03 | `auto-format-config` | `02-wire-up.md` | Update `format-hook.mjs` to use `lib/config.mjs` | `closed` | `refactor` | — |
| 12 | 2026-05-03 | `auto-format-config` | `03-version-bump.md` | Version bump and CHANGELOG entry | `closed` | `release` | — |
| 13 | 2026-05-03 | `auto-format-runners` | `01-formatter-descriptor-type.md` | Add `FormatterDescriptor` typedef to `lib/types.mjs` | `closed` | `refactor` | — |
| 14 | 2026-05-03 | `auto-format-runners` | `02-runner-module.md` | Extract `lib/runners.mjs` with `runFormatter` and tests | `closed` | `refactor` | — |
| 15 | 2026-05-03 | `auto-format-runners` | `03-replace-runner-functions.md` | Replace runner functions with descriptors in `format-hook.mjs` | `closed` | `refactor` | — |
| 16 | 2026-05-03 | `auto-format-runners` | `04-version-bump.md` | Version bump and CHANGELOG entry | `closed` | `release` | — |
| 17 | 2026-05-04 | `inbox-collision-check` | `01-fix-exit-code.md` | Fix inverted exit code in `/inbox` collision check | `closed` | `bug` | — |
| 18 | 2026-05-06 | `pr-review-doc-context-enrichment` | `01-confluence-page-client.md` | Confluence page client script + tests | `closed` | `enhancement` | — |
| 19 | 2026-05-06 | `pr-review-doc-context-enrichment` | `02-work-item-doc-context-enrichment.md` | Work item Doc Context enrichment | `closed` | `enhancement` | — |
| 20 | 2026-05-06 | `pr-review-doc-context-enrichment` | `03-confluence-page-doc-context-enrichment.md` | Confluence page Doc Context enrichment | `closed` | `enhancement` | #18, #19 |
| 21 | 2026-05-06 | `pr-review-doc-context-enrichment` | `04-version-bump-and-docs.md` | Version bump + CHANGELOG + docs | `closed` | `enhancement` | #19, #20 |
| 22 | 2026-05-08 | `pr-review-doc-context-spawn-reliability` | `01-adr-and-synthesizer-agent.md` | ADR-0012 + Doc Context Synthesizer agent | `closed` | `enhancement` | — |
| 23 | 2026-05-08 | `pr-review-doc-context-spawn-reliability` | `02-orchestrator-agent.md` | Doc Context Orchestrator agent | `closed` | `enhancement` | #22 |
| 24 | 2026-05-08 | `pr-review-doc-context-spawn-reliability` | `03-wire-up-and-housekeeping.md` | Wire-up: step 4a rewrite + README + CHANGELOG | `closed` | `bug` | #22, #23 |
| 25 | 2026-05-08 | `pr-review-orchestrator-split` | `01-create-ado-fetcher-agent.md` | Create ADO Fetcher agent | `resolved` | `enhancement` | — |
| 26 | 2026-05-08 | `pr-review-orchestrator-split` | `02-create-ado-writer-agent.md` | Create ADO Writer agent | `resolved` | `enhancement` | — |
| 27 | 2026-05-08 | `pr-review-orchestrator-split` | `03-create-re-review-coordinator-agent.md` | Create Re-review Coordinator agent | `resolved` | `enhancement` | — |
| 28 | 2026-05-08 | `pr-review-orchestrator-split` | `04-refactor-orchestrator.md` | Refactor review-pr.md to thin orchestrator | `resolved` | `enhancement` | #25, #26, #27 |
| 29 | 2026-05-08 | `pr-review-orchestrator-split` | `05-add-pre-pr-mode.md` | Add Pre-PR mode | `resolved` | `enhancement` | #28 |
| 30 | 2026-05-08 | `pr-review-orchestrator-split` | `06-compact-subagent-output.md` | Add compact sub-agent output guidance to the review-agent launch step | `resolved` | `enhancement` | #28 |
| 31 | 2026-05-08 | `pr-review-orchestrator-split` | `07-version-bump-and-release.md` | Version bump and CHANGELOG | `resolved` | `enhancement` | #29, #30 |
| 32 | 2026-05-09 | `feature-runner` | `01-skill-scaffold.md` | Skill scaffold and minimal execution loop | `closed` | `enhancement` | — |
| 33 | 2026-05-09 | `feature-runner` | `02-failure-handling.md` | Failure handling | `closed` | `enhancement` | #32 |
| 34 | 2026-05-09 | `feature-runner` | `03-pr-creation.md` | PR creation and worktree cleanup | `closed` | `enhancement` | #33 |
| 35 | 2026-05-09 | `feature-runner` | `04-progress-reporting.md` | Progress reporting | `closed` | `enhancement` | #32 |
| 36 | 2026-05-09 | `feature-runner` | `05-full-context-bundle.md` | Full context bundle for /tdd sub-agent invocations | `closed` | `enhancement` | #32 |
| 37 | 2026-05-09 | `feature-runner` | `06-dependency-graph.md` | Dependency graph and topological ordering | `closed` | `enhancement` | #32 |
| 38 | 2026-05-09 | `feature-runner` | `07-auto-selection.md` | Auto-selection and LOOP_COMPLETE | `closed` | `enhancement` | #32 |
| 39 | 2026-05-09 | `feature-runner` | `08-feature-runner-docs.md` | `docs/agents/feature-runner.md` reference document | `closed` | `enhancement` | #34, #35, #36, #37, #38 |
| 40 | 2026-05-09 | `feature-runner` | `09-retry-on-tdd-failure.md` | Retry mechanism on /tdd failure | `rejected` | `enhancement` | — |
| 41 | 2026-05-09 | `feature-runner` | `10-references-split.md` | Extract protocol strings to references/runner-output-formats.md | `closed` | `enhancement` | #32 |
| 42 | 2026-05-09 | `feature-runner` | `11-quick-start.md` | Add Quick start section to SKILL.md | `closed` | `enhancement` | #32 |
| 43 | 2026-05-09 | `feature-runner` | `12-heredoc-note-in-references.md` | Add heredoc wrapping note to PR body template in runner-output-formats.md | `closed` | `enhancement` | #41 |
| 44 | 2026-05-09 | `feature-runner` | `13-tdd-prompt-template-in-references.md` | Extract /tdd prompt template to references/tdd-prompt-template.md | `closed` | `enhancement` | #41 |
| 45 | 2026-05-09 | `feature-runner` | `14-smarter-auto-select.md` | Smarter auto-select: resume partial features and reuse existing worktrees | `closed` | `enhancement` | — |
| 46 | 2026-05-09 | `feature-runner` | `15-ready-for-human-unsatisfied-dependency.md` | Halt when a ready-for-agent issue depends on a ready-for-human blocker | `closed` | `enhancement` | — |
| 47 | 2026-05-09 | `feature-runner` | `16-explicit-tdd-skill-invocation.md` | Explicit `/tdd` skill invocation and pinned `subagent_type` in step 4 | `closed` | `enhancement` | — |
| 48 | 2026-05-09 | `feature-runner` | `17-prd-title-extraction-step-1.md` | Extract PRD `title:` frontmatter in step 1 | `closed` | `bug` | — |
| 49 | 2026-05-09 | `feature-runner` | `18-failure-loop-protection.md` | Protect `/loop` from re-picking a failed Feature (flip status to `needs-info`) | `closed` | `enhancement` | — |
| 50 | 2026-05-09 | `feature-runner` | `19-skill-agents-doc-crosslink.md` | Add cross-link from SKILL.md to `docs/agents/feature-runner.md` | `closed` | `documentation` | — |
| 51 | 2026-05-09 | `feature-runner` | `20-prompt-template-and-step-cleanup.md` | Prompt-template deduplication and step-1/step-4 wording cleanup | `closed` | `documentation` | — |
| 52 | 2026-05-14 | `pr-review-pre-pr-default-branch-override` | `01-env-var-override.md` | 01-env-var-override | `needs-triage` | `enhancement` | — |
| 53 | 2026-05-15 | `unic-archon-dlc` | `01-plugin-scaffold-and-tracer-install.md` | Plugin scaffold and tracer install hook | `ready-for-agent` | `feature` | — |
| 54 | 2026-05-15 | `unic-archon-dlc` | `02-full-install-hook-and-agent-docs.md` | Full install hook with all config tiers and agent docs | `ready-for-agent` | `feature` | #53 |
| 55 | 2026-05-15 | `unic-archon-dlc` | `03-triage-workflow-and-tracker-adapter.md` | Triage workflow and tracker adapter | `ready-for-agent` | `feature` | #54 |
| 56 | 2026-05-15 | `unic-archon-dlc` | `04-explore-parallel-research-and-synthesize.md` | Explore workflow — parallel research and synthesize | `ready-for-agent` | `feature` | #54 |
| 57 | 2026-05-15 | `unic-archon-dlc` | `05-explore-prototype-and-spike-gate.md` | Explore workflow — prototype, spike verdicts, and spike-branch gate | `ready-for-agent` | `feature` | #55, #56 |
| 58 | 2026-05-15 | `unic-archon-dlc` | `06-plan-specs-and-to-prd.md` | Plan workflow — specs, to-prd, and first PR gate | `ready-for-agent` | `feature` | #54 |
| 59 | 2026-05-15 | `unic-archon-dlc` | `07-plan-to-issues-and-nyquist.md` | Plan workflow — to-issues, nyquist-map, and validation gate | `ready-for-agent` | `feature` | #55, #58 |
| 60 | 2026-05-15 | `unic-archon-dlc` | `08-plan-checker-and-yaml-gen.md` | Plan workflow — plan-checker loop, yaml-gen, and second PR gate | `ready-for-agent` | `feature` | #59 |
| 61 | 2026-05-15 | `unic-archon-dlc` | `09-build-tdd-core-and-slopcheck.md` | Build workflow — TDD core and slopcheck | `ready-for-agent` | `feature` | #60 |
| 62 | 2026-05-15 | `unic-archon-dlc` | `10-build-verification-goals-check-and-report.md` | Build workflow — verification, goals-check, report, and PR gate | `ready-for-agent` | `feature` | #61 |
| 63 | 2026-05-15 | `unic-archon-dlc` | `11-build-self-contained-review-command.md` | Build workflow — self-contained /unic-dlc-review command | `ready-for-agent` | `feature` | #55, #62 |
| 64 | 2026-05-15 | `unic-archon-dlc` | `12-qa-workflow.md` | QA workflow — e2e, coverage gate, UAT, merge | `ready-for-agent` | `feature` | #55, #62 |
| 65 | 2026-05-15 | `unic-archon-dlc` | `13-cleanup-workflow.md` | Cleanup workflow — arch-review, ADR consolidation, triage | `ready-for-agent` | `feature` | #64, #55 |
| 66 | 2026-05-15 | `unic-archon-dlc` | `14-readme-and-documentation.md` | README and complete documentation | `ready-for-agent` | `documentation` | #57, #63, #65 |
| 67 | 2026-05-15 | `unic-archon-dlc` | `15-fix-interactive-loop-fresh-context.md` | Fix interactive loop nodes: add fresh_context to prevent session expiry crashes | `ready-for-agent` | `bug` | — |
| 68 | 2026-05-15 | `unic-archon-dlc` | `16-qa-verify-pr-base.md` | QA workflow: add verify-pr-base guard after merge-pr | `ready-for-agent` | `feature` | — |
| 69 | 2026-05-19 | `pr-review-agents-not-discovered` | `01-rename-agents-dir-and-fix-frontmatter.md` | 01-rename-agents-dir-and-fix-frontmatter | `resolved` | `bug` | — |

## Labels — required state

### State labels (already seeded)

- `closed` — 43 issues
- `needs-triage` — 1 issues
- `ready-for-agent` — 16 issues
- `rejected` — 1 issues
- `resolved` — 8 issues

### Category labels (some need creating)

- `bug` — 5 issues
- `documentation` — 3 issues
- `enhancement` — 40 issues
- `feature` — 14 issues
- `refactor` — 5 issues
- `release` — 2 issues

### Per-feature labels to create (one per slug)

- `feature/auto-format-config`
- `feature/auto-format-runners`
- `feature/feature-runner`
- `feature/inbox-collision-check`
- `feature/pr-review-agents-not-discovered`
- `feature/pr-review-doc-context-enrichment`
- `feature/pr-review-doc-context-spawn-reliability`
- `feature/pr-review-orchestrator-split`
- `feature/pr-review-pre-pr-default-branch-override`
- `feature/pr-review-rereview`
- `feature/unic-archon-dlc`
