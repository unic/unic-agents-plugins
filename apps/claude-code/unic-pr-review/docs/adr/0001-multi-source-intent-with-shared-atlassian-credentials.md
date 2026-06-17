# 0001. Multi-source intent gathering with shared Atlassian credentials

**Status:** Accepted (2026-05)

## Context

The Plugin fetches business intent from three Platforms — Azure Boards work items, Jira issues, and Confluence pages — to build the Intent Brief that seeds every Review Aspect agent. Azure Boards uses `~/.unic-azure.json` (PAT); Confluence and Jira share `~/.unic-confluence.json` because Atlassian Cloud authenticates both products with the same email plus API token on the same tenant.

Two alternatives were considered:

- **Separate `~/.unic-jira.json` file mirroring the Confluence schema.** Rejected — duplicates one credential pair that always points at the same tenant in practice. Would force users to run two near-identical wizards and store the same token twice.
- **One unified `~/.unic-atlassian.json`.** Rejected for v2 — would break the existing `unic-confluence` Plugin which already ships with `~/.unic-confluence.json` and is depended on outside Claude Code. Reusing the existing file is a strict superset that preserves backward compatibility.

## Decision

Reuse `~/.unic-confluence.json` as the shared Atlassian Credential File for both Confluence and Jira. The file gains an optional `jiraUrl` field (defaulting to the same tenant); the `JIRA_URL` env var overrides it. Azure Boards keeps its own `~/.unic-azure.json` file because its auth model (PAT against an ADO organisation) is unrelated to Atlassian Cloud.

## Consequences

- The Confluence Setup Wizard becomes the de-facto Atlassian wizard; the Jira wizard is a thin overlay that only writes the `jiraUrl` field if absent.
- The Doctor command pings Jira only when `jiraUrl` is configured, keeping projects that don't use Jira free of noise.
- If Atlassian ever splits Cloud auth across products, the schema can be extended additively (`jiraToken`, `jiraUsername`) without breaking existing files.

## Amendment (2026-06)

Work-item discovery is a **Provider contract**. Each Source Platform Provider exposes
`discoverWorkItems(workItemRefs) → [{ id, type, url, raw }]` — takes the refs array
directly (hoisted to `FETCHER_OUTPUT.workItemRefs` top-level, not nested in `prMetadata`).
For ADO, the Fetcher fetches `workItemRefs` from the `pullrequestworkitems` endpoint
(Step 1.5) and emits them as a top-level field; `discoverWorkItems` receives that array
and never regex-scrapes the description. See ADR-0010 amendment (2026-06) for the full
rationale behind the signature change.
For future GitHub/GitLab Providers it will use their respective native linkage endpoints.
The Intent Checker stays Source-Platform-agnostic: it consumes the normalised list
regardless of origin. This separates "where did the Work Items come from?" (Provider
contract) from "what intent do they express?" (Intent Checker responsibility).
