# 0016. DLC is a thin process layer; compose team system-skills for the _how_

**Status:** Accepted (2026-07-02); amended by [ADR-0030](0030-harness-hosts-methods.md)

> ADR-0030 keeps this decision and sharpens its name: the plugin is a **Harness**, and "thin process
> layer" is retained below only as the original wording. The composition stance is unchanged.

## Context

The redesign toward config-driven genericity (grilled 2026-07-02) surfaced a sharper framing than "config + compose CLIs." Unic's clients run heterogeneous stacks — their own Confluence, Jira, Azure DevOps, GitHub, GitLab, Figma, or docs "elsewhere." Hardcoding any of these is expensive and non-portable: `unic-pr-review` is the cautionary tale (~830 lines of ADO-specific fetch/write code, per-tracker provider bundles, three separate setup commands, retrofitting a provider pattern after the fact). Pesche's `unic-ticket-specification` (PR #257) demonstrated the alternative — generic workflow/command templates that read **all** specifics from per-project config and compose the right tool for each job (MCP-first, CLI fallback).

## Decision

The DLC owns the **what** — the process/lifecycle (grill → PRD → slice → build → review → qa; the on-ramps; the off-line utilities) and the **shape** of its artefacts (what a PRD or an agent-ready issue must contain). It owns **none of the _how_** — talking to a tracker, a docs system, or a design tool.

Every system interaction is delegated to a **team-provided system-skill** (e.g. a Confluence skill, the `azure-devops-cli` skill, the Figma MCP, `gh`/`az`/`jira` CLIs), composed at run time and selected from per-project config. The plugin is a **thin process layer over composable system-skills**.

"Unic writes specs in Confluence" and similar are **not** universal assumptions — they are per-project config values pointing at whatever system-skill the team already has.

## Consequences

- The plugin's value is the **process** plus the novel deterministic IP (the anti-cheat build DAG, slopcheck, schema validation) — not integrations. See [ADR-0018](0018-generic-core-config-compose.md) for the code/compose line and [ADR-0017](0017-container-follows-structural-need.md) for containers.
- No box may hardcode a tracker/docs/design system; each reads config and composes the corresponding skill/CLI/MCP.
- `unic-pr-review` is reframed as a **donor of learnings**, not a template or dependency; whether it later converges or retires is a separate, deferred decision.
- Onboarding a new client stack = the team installs/points at the relevant system-skill and fills config; **no plugin code changes**.
- Interactive boxes compose **Matt Pocock's skills** for the process (`grill-with-docs`, `to-prd`, `to-issues`, `triage`, `improve-codebase-architecture`, `handoff`) rather than reimplementing them.
