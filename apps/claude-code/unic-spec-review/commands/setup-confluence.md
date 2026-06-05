---
allowed-tools: Bash(node *), Bash(test *), Bash(echo *)
argument-hint: (no arguments)
description: Interactive setup wizard — writes ~/.unic-confluence.json with Confluence credentials
---

# unic-spec-review:setup-confluence

Guides you through creating `~/.unic-confluence.json` so the plugin can reach Confluence.

## Step 1 — Check for existing env-var configuration

If `CONFLUENCE_URL`, `CONFLUENCE_USER`, and `CONFLUENCE_TOKEN` are all set, the file is not required.
Tell the user and offer to exit without writing. If they want to write the file anyway, continue.

## Step 2 — Check for an existing credential file

```sh
test -f ~/.unic-confluence.json && echo "exists"
```

If the file exists, show the current values (redact the token — print only `****`):

```sh
node -e "
const c = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.unic-confluence.json', 'utf8'));
console.log(JSON.stringify({ url: c.url, username: c.username, token: '****', jiraUrl: c.jiraUrl ?? null }, null, 2));
"
```

Ask whether to overwrite. If the user chooses not to overwrite, stop.

## Step 3 — Collect credentials

Ask the user for:

1. **Confluence base URL** — e.g. `https://your-org.atlassian.net`
2. **Username** — typically the Atlassian account email address
3. **API token** — generate one at <https://id.atlassian.com/manage-profile/security/api-tokens>

## Step 4 — Write the credential file

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-confluence.mjs" --url "<url>" --username "<username>" --token "<token>"
```

## Step 5 — Confirm

Tell the user:

- `~/.unic-confluence.json` has been written with access restricted to the owner (chmod 600) on macOS/Linux
- On Windows: file permissions must be restricted manually (the wizard printed a reminder)
- They can run `/unic-spec-review:spec-doctor` to verify the full setup
