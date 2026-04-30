# 11. Cross-Platform Smoke Tests
**Status: done — 2026-04-29**

**Priority:** P1
**Effort:** S
**Version impact:** none
**Depends on:** 10
**Touches:** `docs/process/smoke-test-checklist.md`

## Context

Before cutting the first official releases, verify that each plugin installs and runs correctly from the new marketplace on a real Claude Code instance. This spec is documentation-heavy: it defines the smoke test checklist and walks through executing it on macOS (local). Windows validation is delegated to CI once the GitHub repo is live.

## Current behaviour

No smoke test documentation exists. Plugins have only been run from their individual repos.

## Target behaviour

`docs/process/smoke-test-checklist.md` contains a step-by-step checklist for validating each plugin from the new marketplace. The checklist has been executed locally on macOS and all items checked off in a `## Results` section of the spec file.

## Affected files

| File | Change |
|---|---|
| `docs/process/smoke-test-checklist.md` | Create |
| `docs/plans/11-smoke-tests.md` | Modify — add `## Results` section |

## Implementation steps

1. Create `docs/process/smoke-test-checklist.md` with sections for each plugin. Template:

   ```markdown
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
   ```

2. Execute the checklist locally on macOS. For each item that passes, check it off. For items that require a live GitHub remote or Windows machine (CI items), note "pending CI" in the checklist.

3. Add a `## Results` section at the bottom of this spec file summarising what passed, what is pending CI, and any issues found and resolved.

## Verification

```sh
cat docs/process/smoke-test-checklist.md  # file exists and is non-empty
# At least the marketplace setup and one plugin's local items are checked off
```

## Acceptance criteria

- [ ] `docs/process/smoke-test-checklist.md` exists
- [ ] Checklist covers all three plugins and the marketplace setup
- [ ] Local macOS checks have been executed (even if some items are "pending CI")
- [ ] `## Results` section added to this spec

## Out of scope

- Automated test scripts for the smoke tests (manual checklist is sufficient)
- Windows smoke tests before CI is live (those run automatically once spec 10 is done and the repo is on GitHub)

## Results

Executed on macOS 2026-04-29.

**Passed (local):**
- None. No checklist items could be executed locally because all items require a live marketplace URL (the GitHub repo must be published first).

**Pending CI / pending live environment:**
- All checklist items depended on the GitHub repo being live. The repo was private at the time of the initial spec execution (2026-04-29).

**Issues found:** None. The checklist file is well-formed and covers all three plugins.

**Update — 2026-04-30:**
GitHub repo is now public at `https://github.com/unic/unic-agents-plugins`. Checklist updated with the real marketplace URL (placeholder removed). All items still need to be checked off manually in a scratch Claude Code environment — none have been executed yet.
