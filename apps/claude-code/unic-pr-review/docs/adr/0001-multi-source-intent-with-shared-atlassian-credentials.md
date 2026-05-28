# Multi-source intent gathering with shared Atlassian credentials

The Plugin fetches business intent from three Platforms — Azure Boards work items, Jira issues, and Confluence pages — to build the Intent Brief that seeds every Review Aspect agent. Azure Boards uses `~/.unic-azure.json` (PAT); Confluence and Jira share `~/.unic-confluence.json` because Atlassian Cloud authenticates both products with the same email plus API token on the same tenant. The Confluence Credential File gains an optional `jiraUrl` field (defaulting to the same tenant); the `JIRA_URL` env var overrides it.

## Considered options

- **Separate `~/.unic-jira.json` file mirroring the Confluence schema.** Rejected — duplicates one credential pair that always points at the same tenant in practice. Would force users to run two near-identical wizards and store the same token twice.
- **One unified `~/.unic-atlassian.json`.** Rejected for v2 — would break the existing `unic-confluence` Plugin which already ships with `~/.unic-confluence.json` and is depended on outside Claude Code. Reusing the existing file is a strict superset that preserves backward compatibility.

## Consequences

- The Confluence Setup Wizard becomes the de-facto Atlassian wizard; the Jira wizard is a thin overlay that only writes the `jiraUrl` field if absent.
- The Doctor command pings Jira only when `jiraUrl` is configured, keeping projects that don't use Jira free of noise.
- If Atlassian ever splits Cloud auth across products, the schema can be extended additively (`jiraToken`, `jiraUsername`) without breaking existing files.
