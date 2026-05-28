---
allowed-tools: Bash(node *), Bash(test *), Bash(echo *)
argument-hint: (no arguments)
description: Interactive setup wizard — writes ~/.unic-azure.json with Azure DevOps credentials
---

# unic-pr-review:setup-azure

Guides you through creating `~/.unic-azure.json` with your Azure DevOps organisation URL and Personal Access Token so the plugin can read and write PR data.

## Step 1 — Check for existing env-var configuration

If `AZURE_DEVOPS_ORG_URL` and `AZURE_DEVOPS_PAT` are both set, tell the user and offer to exit without writing.

## Step 2 — Check for an existing credential file

```sh
test -f ~/.unic-azure.json && echo "exists"
```

If the file exists, show current values (redact the PAT — print only `****`):

```sh
node -e "
const c = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.unic-azure.json', 'utf8'));
console.log(JSON.stringify({ orgUrl: c.orgUrl, pat: '****' }, null, 2));
"
```

Ask whether to overwrite. If the user chooses not to overwrite, stop.

## Step 3 — Collect credentials

Ask the user for:

1. **Organisation URL** — e.g. `https://dev.azure.com/your-org`
2. **Personal Access Token** — create one in Azure DevOps under User Settings → Personal access tokens; the token needs `Code (Read)` and `Work Items (Read)` scopes at minimum

## Step 4 — Write the credential file

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-azure.mjs" --orgUrl "<orgUrl>" --pat "<pat>"
```

## Step 5 — Confirm

Tell the user:

- `~/.unic-azure.json` has been written with access restricted to the owner (chmod 600) on macOS/Linux
- On Windows: file permissions must be restricted manually (the wizard printed a reminder)
- They should also run `/unic-pr-review:setup-confluence` if not done already
- They can run `/unic-pr-review:doctor` to verify the full setup
