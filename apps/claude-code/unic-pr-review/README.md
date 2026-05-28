# unic-pr-review

A Claude Code plugin that reviews Azure DevOps pull requests, enriched with
Confluence documentation context and optional Jira work-item context.

## Requirements

- Azure CLI (`az`) with the `azure-devops` extension installed and logged in
- `~/.unic-confluence.json` with Confluence credentials (and optional `jiraUrl`)
- `~/.unic-azure.json` with Azure DevOps org URL and PAT

Run `/unic-pr-review:doctor` to verify all preconditions are met.

## Installation

```sh
claude plugins marketplace add unic https://raw.githubusercontent.com/unic/unic-agents-plugins/main/.claude-plugin/marketplace.json
claude plugins install unic-pr-review@unic
```

## Commands

| Command                  | Description                            |
| ------------------------ | -------------------------------------- |
| `/unic-pr-review:doctor` | Verify all environmental preconditions |

## Credential files

### `~/.unic-confluence.json`

```json
{
  "url": "https://yourorg.atlassian.net",
  "username": "you@example.com",
  "token": "your-api-token",
  "jiraUrl": "https://yourorg.atlassian.net"
}
```

`jiraUrl` is optional. When absent, Jira checks are silently skipped.

### `~/.unic-azure.json`

```json
{
  "orgUrl": "https://dev.azure.com/yourorg",
  "pat": "your-personal-access-token"
}
```

## Environment variable overrides

All credential fields can be overridden via environment variables:
`CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`, `JIRA_URL`,
`AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PAT`.
