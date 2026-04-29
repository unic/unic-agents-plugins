# Smoke Test Checklist

Run these tests from a scratch Claude Code environment (a consumer repo that doesn't already have these plugins installed).

## Prerequisites

- Claude Code CLI installed and authenticated
- A test Confluence instance with credentials (for confluence-publish)
- A test Azure DevOps PR URL (for pr-review)
- A project with Prettier + ESLint configured (for auto-format)

## Marketplace setup

- [ ] `claude marketplace add <unic-agents-plugins-url>` succeeds — pending CI — requires live marketplace URL
- [ ] `claude plugins list` shows `pr-review`, `auto-format`, `confluence-publish` — pending CI — requires live marketplace URL

## auto-format

- [ ] `claude plugins install auto-format` succeeds — pending CI — requires live marketplace URL
- [ ] Open a consumer project in Claude Code — pending CI — requires live marketplace URL
- [ ] Ask Claude to edit a JavaScript file — verify Prettier runs automatically after the edit — pending CI — requires live marketplace URL
- [ ] Ask Claude to edit a file with ESLint violations — verify ESLint runs — pending CI — requires live marketplace URL
- [ ] On Windows: repeat the above (via CI matrix in `.github/workflows/ci.yml`) — pending CI — requires live marketplace URL and Windows runner

## pr-review

- [ ] `claude plugins install pr-review` succeeds — pending CI — requires live marketplace URL
- [ ] Run `/pr-review` with a valid Azure DevOps PR URL — pending CI — requires live marketplace URL and Azure DevOps
- [ ] Verify a review comment is produced — pending CI — requires live marketplace URL and Azure DevOps

## confluence-publish

- [ ] `claude plugins install confluence-publish` succeeds — pending CI — requires live marketplace URL
- [ ] Run `/confluence-publish` with a test Markdown file and a valid page ID — pending CI — requires live marketplace URL and Confluence instance
- [ ] Verify the Confluence page is updated — pending CI — requires live marketplace URL and Confluence instance

## Cleanup

- [ ] `claude plugins uninstall auto-format` succeeds — pending CI — requires live marketplace URL
- [ ] `claude plugins uninstall pr-review` succeeds — pending CI — requires live marketplace URL
- [ ] `claude plugins uninstall confluence-publish` succeeds — pending CI — requires live marketplace URL
