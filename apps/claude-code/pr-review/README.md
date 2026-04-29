# unic-pr-review

A Claude Code plugin that reviews Azure DevOps pull requests using multi-agent analysis and posts findings as threaded inline comments and a summary directly back to the PR.

## What it does

Run `/unic-pr-review:review-pr <ADO-PR-URL>` to:

1. Fetch the PR diff from Azure DevOps
2. Run parallel code analysis with specialized agents (code quality, error handling, test coverage, etc.)
3. Post each finding as an inline comment at the exact file and line in the ADO web UI
4. Post a summary comment with severity-grouped findings and positive observations

All comments are signed `🤖 *Reviewed by Claude Code*` so reviewers know they are AI-generated.

---

## Prerequisites

### 1. `pr-review-toolkit` plugin (required — soft dependency)

This plugin uses the specialized review agents from `pr-review-toolkit`. You must have it installed and enabled.

**Install:**

1. Open Claude Code settings → Plugins
2. Find `pr-review-toolkit` from `anthropics/claude-plugins-official`
3. Enable it

Or via the marketplace CLI if available.

### 2. Azure CLI with the `azure-devops` extension

```bash
# Install Azure CLI (macOS)
brew install azure-cli

# Install the DevOps extension
az extension add --name azure-devops
```

### 3. Authenticated to the ADO org

```bash
# Login (will prompt for a PAT token)
az devops login --organization https://dev.azure.com/{your-org}

# Or set a default org
az devops configure --defaults organization=https://dev.azure.com/{your-org}
```

Note: if the PR's org differs from your configured default, the command handles it automatically by passing `--org` explicitly.

### 4. Local clone of the repository

The command runs `git diff` locally, so you need the repo cloned and the PR's source branch available:

```bash
git fetch origin
git checkout {pr-source-branch}
```

The command can also check out the branch for you via `az repos pr checkout`.

---

## Install

### Option A — Local development (directory marketplace)

Add to `~/.claude/settings.json`:

```json
"extraKnownMarketplaces": {
  "unic-pr-review": {
    "source": {
      "source": "directory",
      "path": "/path/to/unic-pr-review"
    },
    "autoUpdate": true
  }
}
```

Then add to `enabledPlugins`:

```json
"unic-pr-review@unic-pr-review": true
```

Restart Claude Code for the plugin to be picked up.

### Option B — Team install from Unic git remote

Once the plugin is published to a Unic-owned git repository:

```json
"extraKnownMarketplaces": {
  "unic-pr-review": {
    "source": {
      "source": "github",
      "repo": "unic-org/unic-pr-review"
    },
    "autoUpdate": true
  }
}
```

Then enable and restart as above.

---

## Usage

```
/unic-pr-review:review-pr https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
```

**With aspect filter** (optional, default is all):

```
/unic-pr-review:review-pr https://dev.azure.com/FZAG/dxp/_git/DXP-Website/pullrequest/5472 errors
/unic-pr-review:review-pr https://dev.azure.com/FZAG/dxp/_git/DXP-Website/pullrequest/5472 code errors
```

Available aspects: `code`, `errors`, `tests`, `comments`, `types`, `all`

---

## Comment format

Every comment posted to the PR ends with:

```
---
🤖 *Reviewed by Claude Code*
```

This consistent signature lets team members immediately identify AI-generated review comments.

---

## Roadmap

- **GitHub PR support** — detect `https://github.com/...` URLs and route to `gh pr review`
- **Vote on PR** — optionally set approval/rejection after review
- **Re-review** — detect existing Claude Code threads and update rather than duplicate
- **PR description generation** — generate a PR description from the diff

---

## License

LGPL-3.0-or-later — see [LICENSE](./LICENSE)
