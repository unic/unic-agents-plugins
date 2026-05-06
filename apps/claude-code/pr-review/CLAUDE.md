# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code plugin (`pr-review`) that adds a `/pr-review:review-pr` command. When invoked with an ADO PR URL it:

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
- All comments posted to ADO **must** end with the exact signature: `---\n🤖 *Reviewed by Claude Code* — Iteration N` (where N = LATEST_ITERATION_ID)
- Inline threads use ADO REST `pullRequestThreads` via `az devops invoke`; file paths must match ADO format (leading `/`, forward slashes)
- Always use the latest iteration of the PR. `iterationId=1` is never used. Re-reviews additionally compute `PRIOR_ITERATION_ID` from the prior review's signature — see spec 02.
- If `az devops invoke` returns a `threadContext` error, fall back to posting without `threadContext` (general comment)

## External dependencies

- **`pr-review-toolkit` plugin** — soft dependency; the command checks for it at startup and aborts with instructions if missing
- **Azure CLI** with `azure-devops` extension (`az extension add --name azure-devops`)
- **`az devops login`** authenticated to the target org

## Install for local development

Add to `~/.claude/settings.json`:

```json
"extraKnownMarketplaces": {
  "unic": {
    "source": { "source": "directory", "path": "/path/to/unic-agents-plugins" },
    "autoUpdate": true
  }
}
```

Then add `"pr-review@unic": true` to `enabledPlugins` and restart Claude Code.

## Roadmap (not yet implemented)

- GitHub PR support
- Vote on PR (approve/reject) after review
- PR description generation from diff
