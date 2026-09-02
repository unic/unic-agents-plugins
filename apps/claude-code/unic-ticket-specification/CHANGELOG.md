# Changelog

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [0.1.0] — 2026-06-18

Initial release of the `unic-ticket-specification` plugin. Ships a portable Archon workflow that
takes a tracker ticket from intake to "ready for implementation" with a mandatory human approval
gate before anything is written back to the tracker.

### Added

- **`unic-ticket-specification` workflow** (`.archon/workflows/unic-ticket-specification.yaml`): an
  11-node DAG — detect-input → analyze → classify → rewrite (Bug / CR-Story branch) →
  assess-completeness (non-blocking) → estimate (PERT) → persist-local → present-draft →
  approval-gate (interactive, max 3 reject/revise attempts) → apply (create / update branch) →
  report.
- **Seven Archon command templates** (`.archon/commands/uts-*.md`): `uts-analyze`,
  `uts-rewrite-bug`, `uts-rewrite-crstory`, `uts-estimate`, `uts-persist-local`,
  `uts-apply-create`, `uts-apply-update`.
- **Tracker MCP server config** (`.archon/mcp/ticket-spec-tracker.json`): MCP-first access with a
  CLI fallback (`jira` / `az` / `gh`) selected per project.
- **Config template** (`.archon/ticket-spec.config.example.yaml`): documented per-project
  configuration covering tracker type, access, classification map, linked docs, repos, estimation,
  output, and description templates. Nothing tracker/tenant/repo/OS-specific is hardcoded in the
  workflow.
- **Bundle README** (`.archon/unic-ticket-specification.README.md`): install and per-project setup
  instructions for the copy-into-`.archon/` bundle.
- **`/unic-ticket-specification:setup` slash command** (`commands/setup.md`): zero-config,
  conversational install + configuration — auto-detects the tracker, asks a few questions, and writes
  `.archon/ticket-spec.config.yaml` and the MCP server so users never hand-edit YAML. Idempotent
  (fresh / partial / full / reconfigure / targeted-tweak). Ships no JavaScript.
- **Plugin ADRs** (`docs/adr/`): 0001 tool-agnostic config-driven workflow, 0002 MCP-first with CLI
  fallback, 0003 Markdown-only descriptions, 0004 setup as a conversational slash command with no JS
  lib.
