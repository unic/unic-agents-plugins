# unic-pr-review

AI-powered PR review with intent checking against Azure Boards and Jira Work Items, Confidence-scored Findings, and an interactive Approval Loop.

This plugin is the v2 successor to `pr-review`. It is built from scratch against its own PRD and ADRs; it does not share code, prompts, or fixtures with the v1 plugin.

## Prerequisites

- Node.js ≥ 22 (the Plugin uses built-in `node:https` / global `fetch`)
- Azure CLI (`az`) on `PATH` — <https://learn.microsoft.com/en-us/cli/azure/install-azure-cli>
- The `azure-devops` Azure CLI extension: `az extension add --name azure-devops`
- A valid Azure DevOps session: `az devops login --org <your-org-url>`
- An Atlassian Cloud API token for Confluence (and optionally Jira) — <https://id.atlassian.com/manage-profile/security/api-tokens>

## Installation

Add the plugin to your `enabledPlugins` in `settings.json`:

```json
{
  "enabledPlugins": {
    "unic-pr-review@unic": true
  }
}
```

Then reinstall plugins from the Claude Code command palette.

## Quick start

1. Run the doctor command first to verify your environment:

   ```text
   /unic-pr-review:doctor
   ```

   It runs six checks and tells you exactly what is missing before any Review is attempted.

2. Once doctor is green, run a review of your local branch (Pre-PR mode):

   ```text
   /unic-pr-review:review-pr
   ```

   With no argument the command reviews your local branch against its resolved upstream base branch and prints the Review Summary in the terminal. Passing an ADO PR URL is coming soon — it is not yet supported in this release.

## Commands

| Command                            | Description                                                                                      | Argument hint    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| `/unic-pr-review:doctor`           | Verify all unic-pr-review prerequisites are in place                                             | _(no arguments)_ |
| `/unic-pr-review:review-pr`        | Review your local branch against its upstream base (Pre-PR mode); ADO PR URL support coming soon | _(no arguments)_ |
| `/unic-pr-review:setup-confluence` | Interactive wizard — writes `~/.unic-confluence.json`                                            | _(no arguments)_ |
| `/unic-pr-review:setup-jira`       | Interactive wizard — adds `jiraUrl` to `~/.unic-confluence.json`                                 | _(no arguments)_ |
| `/unic-pr-review:setup-azure`      | Interactive wizard — writes `~/.unic-azure.json`                                                 | _(no arguments)_ |

## Credential files

The Plugin reads two optional JSON files from your home directory. Both must be chmod 600 on Unix.

### `~/.unic-confluence.json`

Shared by Confluence and Jira (ADR-0001):

```json
{
  "url": "https://uniccom.atlassian.net",
  "username": "you@unic.com",
  "token": "ATATT-...your-API-token...",
  "jiraUrl": "https://uniccom.atlassian.net"
}
```

The `jiraUrl` field is optional. If absent, doctor stays silent about Jira (US 35) and Reviews skip Jira fetching.

### `~/.unic-azure.json`

Used by future review commands for Azure DevOps reads/writes. The doctor in v2.0.0 relies on the cached `az devops login` session rather than this file, but you can pre-populate it now via `/unic-pr-review:setup-azure` so it is ready when the review commands land:

```json
{
  "orgUrl": "https://dev.azure.com/your-org",
  "pat": "your-personal-access-token"
}
```

## Environment variable overrides

Every credential field can be overridden at run time, which is useful in CI where writing to `$HOME` is undesirable. Env vars take precedence over the credential files.

| Variable               | Overrides                               |
| ---------------------- | --------------------------------------- |
| `CONFLUENCE_URL`       | `url` in `~/.unic-confluence.json`      |
| `CONFLUENCE_USER`      | `username` in `~/.unic-confluence.json` |
| `CONFLUENCE_TOKEN`     | `token` in `~/.unic-confluence.json`    |
| `JIRA_URL`             | `jiraUrl` in `~/.unic-confluence.json`  |
| `AZURE_DEVOPS_ORG_URL` | `orgUrl` in `~/.unic-azure.json`        |
| `AZURE_DEVOPS_PAT`     | `pat` in `~/.unic-azure.json`           |

If `CONFLUENCE_URL`, `CONFLUENCE_USER`, and `CONFLUENCE_TOKEN` are all set, the credential file is not read at all.

## Version history

See [CHANGELOG.md](./CHANGELOG.md).
