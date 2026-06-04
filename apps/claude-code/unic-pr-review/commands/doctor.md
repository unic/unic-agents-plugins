---
allowed-tools: Bash(node *), Bash(az *)
argument-hint: (no arguments)
description: Verify unic-pr-review prerequisites — az CLI, Azure DevOps extension, login state, Confluence, and Jira
---

# unic-pr-review:doctor

Runs a preflight check for all unic-pr-review prerequisites so you can diagnose setup issues before running a Review.

Checks performed:

1. `az` CLI is on `PATH`
2. `azure-devops` extension is installed
3. `az devops` session is valid (`az devops project list --detect`)
4. Confluence is reachable via `~/.unic-confluence.json` or the `CONFLUENCE_*` env vars
5. Jira is reachable — only when `jiraUrl` is configured (US 35: doctor stays silent otherwise)

## Step 1 — Run the doctor script

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

## Step 2 — Report the result

The script prints a `✓` / `✗` / `○` line per check and exits 0 when all configured checks pass or 1 if any fail.

If a check fails, relay the failure detail verbatim and suggest the corrective action:

- `az` missing → install the Azure CLI: <https://learn.microsoft.com/en-us/cli/azure/install-azure-cli>
- `azure-devops` extension missing → `az extension add --name azure-devops`
- `az devops` session invalid → `az devops login --org <your-org-url>`
- Confluence unreachable → run `/unic-pr-review:setup-confluence` to create `~/.unic-confluence.json`, or set `CONFLUENCE_URL`, `CONFLUENCE_USER`, `CONFLUENCE_TOKEN`
- Jira unreachable → run `/unic-pr-review:setup-jira` to add the `jiraUrl` field, or set `JIRA_URL`

If every line is `✓` (or `○` for unconfigured Jira), tell the user that doctor is green and they are ready for the next Plugin slice.
