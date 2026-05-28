# pr-review

> ⚠️ **Deprecated.** Superseded by [`unic-pr-review`](../unic-pr-review/), a ground-up v2 rewrite. This plugin is frozen — no new features. Use `unic-pr-review` for all new work.

A Claude Code plugin that reviews Azure DevOps pull requests using multi-agent analysis and posts findings as threaded inline comments and a summary directly back to the PR.

## What it does

Run `/pr-review:review-pr <ADO-PR-URL>` to:

1. Fetch the PR diff from Azure DevOps
2. Run parallel code analysis with specialized agents (code quality, error handling, test coverage, etc.)
3. Post each finding as an inline comment at the exact file and line in the ADO web UI
4. Post a summary comment with severity-grouped findings and positive observations

All comments are signed `🤖 *Reviewed by Claude Code* — Iteration N` so reviewers know they are AI-generated and can track which review iteration produced each finding.

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
  "unic": {
    "source": {
      "source": "directory",
      "path": "/path/to/unic-agents-plugins"
    },
    "autoUpdate": true
  }
}
```

Then add to `enabledPlugins`:

```json
"pr-review@unic": true
```

Restart Claude Code for the plugin to be picked up.

### Option B — Team install from Unic marketplace

Once published to the Unic plugin marketplace:

```sh
# Register the Unic plugin marketplace (once per machine)
claude plugins marketplace add unic https://raw.githubusercontent.com/unic/unic-agents-plugins/main/.claude-plugin/marketplace.json

# Install the plugin
claude plugins install pr-review@unic
```

---

## Usage

```
/pr-review:review-pr https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
```

**With aspect filter** (optional, default is all):

```
/pr-review:review-pr https://dev.azure.com/FZAG/dxp/_git/DXP-Website/pullrequest/5472 errors
/pr-review:review-pr https://dev.azure.com/FZAG/dxp/_git/DXP-Website/pullrequest/5472 code errors
```

Available aspects: `code`, `errors`, `tests`, `comments`, `types`, `all`

---

## Comment format

Every comment posted to the PR ends with:

```
---
🤖 *Reviewed by Claude Code* — Iteration N
```

This consistent signature lets team members immediately identify AI-generated review comments and track which review iteration produced each finding.

---

## Re-review

Running `/pr-review:review-pr <url>` on a PR that already has Claude Code review threads triggers re-review mode automatically.

**What changes in re-review mode:**

- **Detection** — Step 3.5 scans all existing PR threads for the bot signature and extracts their file paths, line ranges, and classification metadata.
- **Thread reuse** — New findings are posted as replies to the matching prior thread (matched by file path and line-range overlap ±3 lines) rather than creating duplicate threads.
- **Classification** — Each prior thread is classified as `addressed` (resolved), `disputed` (active disagreement), `pending` (still open), or `obsolete` (file deleted or lines moved far).
- **Incremental diff** — The diff is computed between the prior review's commit and the latest commit, so only new changes are analysed.
- **Delta summary** — Instead of a full summary, a short reply is posted to the existing summary thread listing new findings and counts. If nothing changed, no summary is posted.
- **Completion marker** — Every successful run appends a completion marker to the summary thread so subsequent runs can detect partial-run failures.

**Signature format:** `🤖 *Reviewed by Claude Code* — Iteration N` (N = ADO PR iteration number).

**Known limitations:**

- Force-push that rewrites history falls back to a full diff (prior commit no longer exists in the remote).
- If a run was interrupted before posting the completion marker, the next run treats it as a partial run and skips to a recovery path.

---

## Roadmap

- **GitHub PR support** — detect `https://github.com/...` URLs and route to `gh pr review`
- **Vote on PR** — optionally set approval/rejection after review
- **PR description generation** — generate a PR description from the diff

---

## License

LGPL-3.0-or-later — see [LICENSE](./LICENSE)
