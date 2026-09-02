# Markdown-only ticket descriptions

**Status:** Accepted (2026-06)

The rewritten ticket descriptions the workflow produces (Bug and CR-Story templates, and the body
written back to the tracker) are **plain Markdown**. No tracker-specific markup — notably Jira's
Atlassian Document Format (ADF) and its `Expand` macro — is used.

## Considered options

- **Tracker-native rich markup (e.g. Jira ADF with collapsible `Expand` sections)** — rejected. ADF
  renders nicely in Jira but is meaningless in Azure DevOps and GitHub, and authoring it couples the
  command templates to one tracker, which directly contradicts the tool-agnostic design in
  [ADR-0001](0001-tool-agnostic-config-driven.md). The user explicitly rejected a Jira-only `Expand`
  element for this reason.

- **Per-tracker description renderers** — rejected. Maintaining one body format per tracker multiplies
  the template surface for marginal visual gain and reintroduces the drift the bundle exists to avoid.

- **Markdown everywhere** — chosen. Markdown renders acceptably across Jira, Azure DevOps, and GitHub,
  keeps the templates in config (`templates.bug`, `templates.cr_story`) tracker-neutral, and lets a
  client override the shapes without touching tracker-specific code.

## Consequences

- The CR-Story template deliberately splits the old single "ToDo" into two audiences: `### ToDo` is a
  plain-language scope list for product owners (no file paths or code), and `### Suggested Technical
Tasks` is the detailed, repo-grouped developer guide. Both are Markdown headings, not tracker macros.
- If a tracker mangles a given Markdown construct, the fix is to adjust the Markdown in the config
  template — never to emit tracker-specific markup from a command.
- Trackers that ingest Markdown differently (e.g. Jira wiki vs. ADF on create) are handled at the
  `apply-*` boundary by the tracker's own MCP/CLI conversion, keeping the authored content uniform.
