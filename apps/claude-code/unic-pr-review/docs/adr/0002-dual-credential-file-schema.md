# 0002. Dual credential file schema

**Status:** Accepted (2026-05)

## Context

The Plugin needs credentials for two independent external systems: Confluence (and optionally Jira) and Azure DevOps. Reusing `~/.unic-confluence.json` (already defined by the `unic-confluence` plugin) avoids duplicating Confluence configuration for Consumers who use both plugins.

## Decision

- `~/.unic-confluence.json` stores `{ url, username, token, jiraUrl? }`.
- `~/.unic-azure.json` stores `{ orgUrl, pat }`.

The credential loader reads both files independently; missing one is an error only if the corresponding subsystem is required.

## Consequences

- Consumers who use `unic-confluence` and `unic-pr-review` share a single Confluence credential file.
- Two separate files are managed (a small maintenance burden).
- Adding new credential fields to either subsystem is a patch to that file only, not a combined schema migration.
