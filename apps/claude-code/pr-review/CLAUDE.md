# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code plugin (`unic-pr-review`) that adds an `/unic-pr-review:review-pr` command. When invoked with an ADO PR URL it:

1. Fetches the PR diff via `az devops` CLI + ADO REST API
2. Launches specialized review agents from the `pr-review-toolkit` plugin in parallel
3. Posts each finding as an inline thread at the exact file/line in Azure DevOps
4. Posts a severity-grouped summary comment

## Repository layout

```
.claude-plugin/
  plugin.json          # Plugin manifest (name, version, description)
  marketplace.json     # Marketplace listing metadata
commands/
  review-pr.md        # The slash command definition — this is the core logic
```

The entire behaviour of the plugin lives in `commands/review-pr.md`. There are no build steps, no transpilation, no dependencies to install.

## Plugin metadata

When bumping the version, update it in **both** files:
- `.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `plugins[0].version`

## Command conventions (`commands/review-pr.md`)

- YAML frontmatter declares `allowed-tools` — add any new tools the command needs there
- Auto-generated files are explicitly skipped in Step 6 (serialization YAMLs, `*.g.cs`, generated types output, `swagger.md`)
- All comments posted to ADO **must** end with the exact signature: `---\n🤖 *Reviewed by Claude Code*`
- Inline threads use ADO REST `pullRequestThreads` via `az devops invoke`; file paths must match ADO format (leading `/`, forward slashes)
- `iterationId=1` is always used unless there's a specific reason to target a later iteration
- If `az devops invoke` returns a `threadContext` error, fall back to posting without `threadContext` (general comment)

## External dependencies

- **`pr-review-toolkit` plugin** — soft dependency; the command checks for it at startup and aborts with instructions if missing
- **Azure CLI** with `azure-devops` extension (`az extension add --name azure-devops`)
- **`az devops login`** authenticated to the target org

## Install for local development

Add to `~/.claude/settings.json`:

```json
"extraKnownMarketplaces": {
  "unic-pr-review": {
    "source": { "source": "directory", "path": "/path/to/unic-pr-review" },
    "autoUpdate": true
  }
}
```

Then add `"unic-pr-review@unic-pr-review": true` to `enabledPlugins` and restart Claude Code.

## Roadmap (not yet implemented)

- GitHub PR support
- Vote on PR (approve/reject) after review
- Re-review: detect existing Claude Code threads and update instead of duplicating
- PR description generation from diff
