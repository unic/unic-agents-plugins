# Step 01 — Foundations: cross-cutting ADRs + doc edits

> **Read [PLAN.md](./PLAN.md), [README.md](./README.md), and step 00's ADR first.** This step records the locked cross-cutting decisions durably in the repo so every later step builds on them. No workflow YAML changes here.

## Task

### A. Add the cross-cutting ADRs (`apps/claude-code/unic-archon-dlc/docs/adr/`)
Use the plugin's ADR format; pick next `NNNN` per ADR; mark `Status: Accepted`.
1. **Fresh-context red/green separation for anti-cheating** (keystone). Context: autonomous/AFK builds can't rely on a human catching test/impl gaming the way Matt's HITL flow does → structural isolation. Decision = contract B in PLAN.md. Reference `ralph-orchestrator` rationale; note divergence from Matt's single-session TDD.
2. **Tracker as single source of truth; HANDOFF.md/ROADMAP.md dropped.** Supersedes the doctrine that triage owns those files.
3. **Workflow-per-box decomposition.** Supersedes the bundled `plan` workflow design (splits into `/specs` + `/tickets`); records the full box set.
4. **`workflows/<slug>/` artifact home** (moved out of `docs/workflow/<slug>/`); `docs/` stays human-facing.

### B. Edit existing docs
- **`apps/claude-code/unic-archon-dlc/CLAUDE.md` (AGENTS.md symlink):** retire the doctrine "HANDOFF.md and ROADMAP.md are written exclusively by the triage workflow." Update the "Do not add" / doctrines and the dogfooding note to reflect the per-box set + tracker-as-truth. Update the one-line workflow description (six DAGs → the new box set).
- **`apps/claude-code/unic-archon-dlc/CONTEXT.md`:** drop `HANDOFF.md`/`ROADMAP.md` terms; revise `Session`, `Slug` to reference `workflows/<slug>/`; add the new workflow names and the revised meanings of **triage** (intake on-ramp) and **cleanup** (operational janitor) vs **improve-architecture**; add **red/green fresh-context** and **agent-ready issue** as terms.
- **Audit `docs/adr/`:** any existing ADR that assumes the 6-phase bundle, triage-writes-handoff, or `docs/workflow/<slug>/` → mark `Superseded by NNNN` pointing at the new ADRs. (Likely candidates: revisit ADR-0001 setup — amend for new config keys rather than supersede.)

### C. (Optional) file the redesign as a tracker Feature
PLAN.md is the PRD. If the team tracks meta-work, open a parent Feature issue linking PLAN.md and listing steps 02–13 as children. Otherwise skip — PLAN.md in-repo is sufficient.

## Done when
The 4 ADRs exist, AGENTS.md + CONTEXT.md no longer reference the dropped concepts, superseded ADRs are marked, and `pnpm --filter unic-archon-dlc typecheck`/`test` are green. PR to `develop`.

## Suggested skills
`/domain-modeling` (ADRs + CONTEXT vocabulary), `/grilling` (confirm ADR framing before writing).
