# Step 13 — Finalize: vision diagram + docs sweep

> **⚠ Two-axis update (2026-07-02):** the diagram + docs must reflect the **two-axis architecture** (ADRs 0016–0020: container per box, thin process layer, compose team system-skills, `config.yaml`), not just the box set. **[PLAN.md](./PLAN.md) is canonical.**

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** Last step — reconcile the docs with what was actually built.

## Goal

Bring the vision diagram and plugin docs in line with the shipped redesign, and confirm the whole set hangs together.

## Task

- **Update `../Unic-dlc.mmd`** (and the `.excalidraw` if kept in sync) to reflect locked decisions: research/prototype IN scope (#3); `/triage` as intake on-ramp not a specs↔tickets stage (#4); tickets as a convergence point (#5); HANDOFF/ROADMAP dropped (#6); `cleanup` split into `/improve-architecture` + `/cleanup` (#8); `/handoff` added (#7); setup + explore off-line.
- **Document the "deterministic output" stakeholder explanation** (PLAN #9): emergent from fresh-slice-reads-committed-repo; no workflow.
- **Sweep `CONTEXT.md`, `CLAUDE.md`/`AGENTS.md`, README, marketplace listing** for any lingering references to the old 7-workflow names or dropped concepts.
- **End-to-end dry-run** on this monorepo (dogfood): `/explore? → /specs → /tickets → /build → /pr-review → /qa` reaching each gate without schema errors.
- Bump version + CHANGELOG; confirm `pnpm --filter unic-archon-dlc typecheck`/`test` + root `pnpm ci:check` green.

## Done when

Diagram + docs match the implementation, a dogfood dry-run reaches the gates, CI is green. Final PR to `develop`. Optionally archive this `redesign/` directory or convert it to a short "architecture" doc.

## Suggested skills

`/domain-modeling`, `/archon`, `figma`/mermaid for the diagram.
