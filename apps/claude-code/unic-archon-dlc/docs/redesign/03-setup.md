# Step 03 — `/setup` (config foundation)

> **⚠ Two-axis update (2026-07-02):** `/setup` is a **conversational command/skill** (ADR-0019, supersedes 0001) — it composes team system-skills to detect/register the stack and writes rich `.archon/unic-dlc.config.yaml`; only a thin tested lib does schema-validate + idempotent merge (install-runner/setup-explorer/agent-docs-writer dissolved). **[PLAN.md](./PLAN.md) + ADRs 0016–0020 win** where the body below differs.

> **Read [PLAN.md](./PLAN.md) + [README.md](./README.md).** Do this before the main-line workflows — they read this config.

## Goal

Extend the existing `/unic-archon-dlc:setup` command + `lib/install-runner.mjs` + `lib/config-loader.mjs` to carry the new config the redesigned workflows depend on. Keep it idempotent and the sole config entry point (ADR-0001).

## Task — add config keys

- `gates.<workflow>: hitl | afk` — per-workflow gate mode (default `hitl`). Workflows read this to decide whether a gate blocks for a human or runs autonomously (contract A).
- `build.fresh_context_red_green: true` (default on) — toggles contract B's strict separation.
- slice-granularity guidance / threshold consumed by `/tickets`.
- confirm `model_profile: fast|balanced|max` exists and is wired.
- Update the `workflows/<slug>/` vs old `docs/workflow/<slug>/` path constant (contract C) — coordinate with step 06's lib changes; setup may own the path default.
- Add "re-run after plugin update" guidance to the command doc.

## Open questions to grill first

- Exact config schema shape for `gates` (flat map vs nested per-workflow object). Migration of existing `.archon/unic-dlc.config.json` in already-configured consumers (this repo is one).
- Should `gates` defaults differ per workflow, or uniformly `hitl`?

## Done when

Setup writes + round-trips the new keys, remains idempotent (fresh/partial/full states), migrates an existing config without data loss, and `lib/` tests cover the new fields. PR to `develop`.

## Suggested skills

`/archon`, `/tdd` (config-loader/install-runner are pure modules — test-first), `/domain-modeling`.
