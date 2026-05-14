# README and complete documentation

**Status:** ready-for-agent
**Category:** docs

## Parent

`docs/issues/unic-archon-dlc/PRD.md`

## What to build

The plugin README — the only user-facing entry point for adopters. Final slice because it documents the shipped behaviour, not the intended behaviour.

In scope (`apps/claude-code/unic-archon-dlc/README.md`):

1. **Mermaid flowchart** showing all six workflows (`explore`, `plan`, `build`, `qa`, `cleanup`, `triage`), every node, and human gate markers (✓ on interactive nodes).
2. **Node reference table** — one row per node:
   - Workflow · Node · Type (`prompt` / `loop` / `bash` / `interactive`) · Human gate (✓ / —)
3. **Quick-start** — install + first run in three steps. Example commands use the `unic-dlc-` prefix.
4. **Configuration reference** — every key in `.archon/unic-dlc.config.json` with default and valid values: `tracker`, `pr_strategy`, `branching`, `e2e_command`, `model_profile`, `tdd_mode`, `nyquist_validation`, `slopsquatting_gate`, label tier mappings, `repo_layout`, `workflow.discuss_mode`, coverage thresholds.
5. **`docs/workflow/` layout diagram** — visual of what gets created where and who owns each artifact. State the three-layer separation explicitly: transient (`$ARTIFACTS_DIR`) vs persistent (`docs/workflow/<slug>/`) vs tracker.
6. **Dependency map:** Archon version requirement, no required peer plugins, optional `slopcheck` Python tool.
7. **Distribution note:** Archon has no marketplace; this plugin fills the gap by riding the Claude Code plugin marketplace and scaffolding workflows into the target project.

Also in scope:

- The plugin's `CHANGELOG.md` carries a dated `0.1.0` entry summarising the lifecycle (CI's `verify:changelog` will fail without it).
- The marketplace listing description matches the README's one-line summary.

Out of scope: per-workflow deep-dive docs (those live in `.archon/commands/*.md` shipped by each workflow slice).

## Acceptance criteria

- [ ] README renders correctly (Mermaid block parses; tables render).
- [ ] Mermaid flowchart shows all 6 workflows, every node from slices 03–13, and human gates marked with ✓.
- [ ] Node reference table includes every node in the shipped workflows.
- [ ] Quick-start gets a developer from zero to a successful `/unic-dlc-triage` run in three steps.
- [ ] Every key written by the install hook (slices 01 and 02) appears in the configuration reference with default and valid values.
- [ ] `docs/workflow/` layout diagram names the three persistence layers explicitly.
- [ ] `CHANGELOG.md` has a dated `0.1.0` entry and `pnpm --filter unic-archon-dlc verify:changelog` passes.

## Blocked by

- `docs/issues/unic-archon-dlc/05-explore-prototype-and-spike-gate.md`
- `docs/issues/unic-archon-dlc/11-build-self-contained-review-command.md`
- `docs/issues/unic-archon-dlc/13-cleanup-workflow.md`
