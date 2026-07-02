# 0018. Generic core + per-project config; tested lib only for tracker-agnostic deterministic IP

**Status:** Accepted (2026-07-02)

> **Amended (2026-07-02):** `dag-builder` is **removed from the KEEP list** — it was dissolved by
> [ADR-0023](0023-build-generic-red-green-refactor-loop.md). `/build` consumes `issues.json` via a
> generic runtime loop instead of generated per-slug DAG code, so the codegen lib no longer exists.
> The tested-lib ⟺ tracker-agnostic-deterministic-IP line is unchanged; the KEEP set is now
> slopcheck · stub-detector · issues+PRD schema-validation · thin config validate/merge · archon guard.

## Context

[ADR-0016](0016-dlc-thin-process-layer.md) establishes that the DLC composes team system-skills for the _how_. This ADR draws the concrete line **inside the plugin**: where does bespoke tested code stop and config + composition start? The two reference points pull opposite ways — Pesche's `unic-ticket-specification` (PR #257) has **no lib at all** (pure markdown + bash + config), while the DLC's anti-cheat `/build` DAG is exactly the deterministic logic that _must_ be tested code. `unic-archon-dlc` already proves the config-driven half: `lib/tracker-adapter.mjs` keeps canonical names in code and generates tracker CLI strings from config, tested across four trackers.

## Decision

**Tested lib survives only for novel, deterministic, tracker-agnostic IP** that has no existing tool to compose:

```
KEEP as tested lib:  slopcheck · stub-detector · issues+PRD schema-validation
                     · thin config validate/merge · tiny archon version-guard
DISSOLVE into config + prose composition:
                     tracker-adapter · labels-config · prd-writer(templates) · install-runner
                     · setup-explorer · agent-docs-writer · handoff-generator · findings-writer
                     · spike-verdicts · config-loader (absorbed into the thin config lib)
```

> `dag-builder` was originally in the KEEP list here; it was later dissolved by
> [ADR-0023](0023-build-generic-red-green-refactor-loop.md) (see the amendment note above) once
> `/build` moved from per-slug DAG codegen to a generic runtime loop.

**The config substrate** becomes a rich per-project **`.archon/unic-dlc.config.yaml`** (replacing the thin `.archon/unic-dlc.config.json`), deliberately **converged with `unic-ticket-specification`'s schema** so the two plugins share a config philosophy. It carries: `project`, `tracker` (`type`, `access:{mcp,cli}`, per-tracker coords), `docs` (`type`), `repos`, **`templates`** (PRD/issue/bug — dissolving `prd-writer`'s hardcoded sections into a generic, config-driven validator), `classification`, plus the DLC's own `gates` and `build` keys.

**Access convention: MCP-first, CLI-fallback.** Boxes prefer a configured MCP server for a system; fall back to its CLI (`gh`/`az`/`jira`, or the `azure-devops-cli` skill). Even `tracker-adapter`'s CLI-string generation is dissolved: command templates read config and compose the tool in prose (#257-style), rather than a lib building CLI strings.

## Consequences

- **The Axis-2 line is crisp:** tested lib ⟺ _tracker-agnostic_ deterministic IP. Tracker-_specific_ translation is prose composition driven by config, not lib.
- `prd-writer`'s template _content_ moves to config; only a generic structure _validator_ remains in lib (shared with issue-schema validation).
- Config migrates JSON → YAML; the conversational `/setup` ([ADR-0019](0019-conversational-setup.md)) reads any existing `.json` and writes the rich `.yaml` (keeping a backup) on next run.
- The `lib/` test surface shrinks to the deterministic core; every dissolved module's behaviour re-homes to config + a composed skill/CLI, validated behaviourally per box.
- This ADR states the target; the actual module removals and path/prose migration are owned by the per-box redesign steps, not this foundations PR.
