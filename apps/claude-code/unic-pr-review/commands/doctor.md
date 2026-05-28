---
allowed-tools: Bash(node *)
argument-hint: ''
description: Verify unic-pr-review environmental preconditions
---

# unic-pr-review doctor

Checks that all tools and credentials needed to run a Review are properly configured.

## Steps

### 0. Run the doctor script

Execute the preflight check from the plugin root:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

### 1. Report the result

If the script exits 0, all checks passed. Report success to the user.

If the script exits non-zero, relay the failure messages from stderr to the user and suggest remediation:

- **az not found**: Install Azure CLI — https://learn.microsoft.com/cli/azure/install-azure-cli
- **azure-devops extension missing**: Run `az extension add --name azure-devops`
- **az devops login invalid**: Run `az login` then `az devops configure --defaults organization=<orgUrl>`
- **az devops user show failed**: Run `az devops user show --user me` manually to see the error
- **Confluence unreachable**: Check `url` in `~/.unic-confluence.json` or `CONFLUENCE_URL` env var
- **Jira unreachable**: Check `jiraUrl` in `~/.unic-confluence.json` or `JIRA_URL` env var
