---
allowed-tools: Bash(node *), Bash(test *), Bash(echo *)
argument-hint: (no arguments)
description: Interactive setup wizard — adds jiraUrl to ~/.unic-confluence.json
---

# unic-pr-review:setup-jira

Adds an optional `jiraUrl` field to `~/.unic-confluence.json` so the plugin can check Jira work items. The Confluence and Jira credentials are shared (same Atlassian API token).

Prerequisite: `~/.unic-confluence.json` must already exist. Run `/unic-pr-review:setup-confluence` first if it does not.

## Step 1 — Check for existing env-var configuration

If `JIRA_URL` is already set, inform the user and offer to exit without writing.

## Step 2 — Verify the Confluence credential file exists

```sh
test -f ~/.unic-confluence.json && echo "exists"
```

If missing, tell the user to run `/unic-pr-review:setup-confluence` first and stop.

## Step 3 — Read the current Jira URL (if any) and collect a new value

Show the `jiraUrl` field from the existing file (if present):

```sh
node -e "
const c = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.unic-confluence.json', 'utf8'));
console.log(JSON.stringify({ url: c.url, jiraUrl: c.jiraUrl ?? null }, null, 2));
"
```

Ask for the Jira base URL, defaulting to the Confluence `url` field (same Atlassian tenant in the common case).

## Step 4 — Write the updated credential file

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-jira.mjs" --jiraUrl "<jiraUrl>"
```

## Step 5 — Confirm

Tell the user:

- `~/.unic-confluence.json` has been updated with the `jiraUrl` field (or unchanged if the value already matched)
- They can run `/unic-pr-review:doctor` to verify Jira reachability
