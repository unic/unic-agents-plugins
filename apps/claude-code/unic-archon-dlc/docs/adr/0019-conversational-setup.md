# 0019. Conversational `/setup` + one thin tested schema lib

**Status:** Accepted (2026-07-02)

**Supersedes** [ADR-0001](0001-setup-as-slash-command.md).

> **Amended (2026-07-02):** `/setup` also **discovers and registers the team's system-skills** into config — a capability→tool mapping (tracker/docs/design → `mcp | cli | skill`, MCP-first), not a presence snapshot. Discovery is **verify-only** (introspect installed skills/MCP + bash CLI probes; never installs). A missing **required** capability (incl. Matt's suite, [ADR-0021](0021-earns-its-place-compose-verbatim.md)) → **warn + degrade, non-blocking**: setup completes, records it unavailable, and lists the blocked boxes; boxes **re-probe at runtime** (MCP-first, CLI-fallback) and fail with a clear "install X".

## Context

[ADR-0001](0001-setup-as-slash-command.md) had `/setup` delegate all filesystem writes to a tested `lib/install-runner.mjs` (merge `defaults < existing < answers`, marker-delimited `CLAUDE.md` update, `docs/agents/*.md` generation). Under [ADR-0016](0016-dlc-thin-process-layer.md)/[ADR-0018](0018-generic-core-config-compose.md), setup is **tracker/tenant/OS wiring** — the archetypal _how_ — so it belongs in config + composition, not a bespoke lib. Pesche's `unic-ticket-specification` (PR #257) makes setup fully conversational (markdown + bash, no lib). But one genuinely deterministic, error-prone concern hides in setup: **idempotent config read-merge-write + schema validation** (a re-run must not clobber a partial config).

## Decision

`/setup` becomes a **conversational command**: detect tracker/OS/repo, prompt for gaps, **compose** the relevant system-skill/CLI (`az` / the `azure-devops-cli` skill, `gh`, `jira`, MCP-first) to discover and register what the team has, and write the rich **`.archon/unic-dlc.config.yaml`** ([ADR-0018](0018-generic-core-config-compose.md)).

**Exactly one thin tested lib survives** for the deterministic part: **config schema-validate + idempotent merge** (read existing `.json`/`.yaml` → merge → validate → write `.yaml`, keeping a backup). The heavy setup libs — `install-runner`, `setup-explorer`, `agent-docs-writer` — are **dissolved**.

The runtime Archon version check moves to a **behavioural min-floor check (`≥ 0.5.0`)**, replacing the fictional exact-`0.10` assertion ([ADR-0011](0011-archon-schema-target.md)).

## Consequences

- ADR-0001's "delegate all writes to `install-runner`" is reversed; setup conducts the conversation and composes tools, keeping only schema-validate/merge as tested code.
- `/setup` gains the job of **discovering/registering the team's system-skills** into config, so every downstream box knows what it can compose ([ADR-0016](0016-dlc-thin-process-layer.md)).
- New config keys (`gates.<box>: hitl|afk`, `build.fresh_context_red_green`, `templates`, `tracker.access`, `docs.type`) are written by the conversational flow, validated by the thin lib.
- Idempotency and mandatory-field invariants are preserved by the thin lib, not lost to prose.
- Implementation (dissolving the libs, JSON→YAML migration, the version-check fix) is owned by the `/setup` redesign step, not this foundations PR.
- **What `/setup` asks about labels** — the one tier-grouped question, the refusal to inspect a tracker or create a label, the absence of a seeded default, and the closed key set — is recorded in [ADR-0024](0024-triage-intake-on-ramp.md)'s 2026-08-11 amendment, which owns the `classification.labels` contract.
