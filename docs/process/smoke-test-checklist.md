# Smoke Test Checklist

Run these tests from a scratch Claude Code environment (a consumer repo that doesn't already have these plugins installed).

## Prerequisites

- Claude Code CLI installed and authenticated
- A test Confluence instance with credentials (for confluence-publish)
- A test Azure DevOps PR URL (for pr-review)
- A project with Prettier + ESLint configured (for auto-format)

## Marketplace setup

- [ ] `claude marketplace add <unic-agents-plugins-url>` succeeds
- [ ] `claude plugins list` shows `pr-review`, `auto-format`, `confluence-publish`

## auto-format

- [ ] `claude plugins install auto-format` succeeds
- [ ] Open a consumer project in Claude Code
- [ ] Ask Claude to edit a JavaScript file — verify Prettier runs automatically after the edit
- [ ] Ask Claude to edit a file with ESLint violations — verify ESLint runs
- [ ] On Windows: repeat the above (via CI matrix in `.github/workflows/ci.yml`)

## pr-review

- [ ] `claude plugins install pr-review` succeeds
- [ ] Run `/pr-review` with a valid Azure DevOps PR URL
- [ ] Verify a review comment is produced

## confluence-publish

- [ ] `claude plugins install confluence-publish` succeeds
- [ ] Run `/confluence-publish` with a test Markdown file and a valid page ID
- [ ] Verify the Confluence page is updated

## Cleanup

- [ ] `claude plugins uninstall auto-format` succeeds
- [ ] `claude plugins uninstall pr-review` succeeds
- [ ] `claude plugins uninstall confluence-publish` succeeds
