# 13. Archive Old Repos

**Priority:** P2
**Effort:** XS
**Version impact:** none
**Depends on:** 12
**Touches:** Nothing in this repo

## Context

The three original repos (`unic-pr-review`, `unic-claude-code-format`, `unic-claude-code-confluence`) are superseded by the monorepo. Archiving them prevents confusion and new development from happening in the wrong place. Since you are the only user, no redirect or deprecation notice is strictly required, but a final CHANGELOG entry pointing to the new home is good practice.

## Current behaviour

All three old repos are active on GitHub. No deprecation notices exist.

## Target behaviour

Each old repo has a final commit with a deprecation note in `README.md` and `CHANGELOG.md`. All three repos are archived on GitHub (read-only).

## Affected files

These changes are made in the **old repos**, not in this monorepo.

## Implementation steps

1. For each old repo (`unic-pr-review`, `unic-claude-code-format`, `unic-claude-code-confluence`):

   a. In the repo's `README.md`, prepend:

   ```markdown
   > **Archived.** This plugin has moved to [unic/unic-agents-plugins](https://github.com/unic/unic-agents-plugins).
   > Install via the new marketplace — see the monorepo README for instructions.
   ```

   b. In `CHANGELOG.md` (create one for `unic-pr-review` if it doesn't exist), add a final entry under `## [Unreleased]`:

   ```markdown
   ## [Unreleased]

   ### Changed

   - Migrated to [unic/unic-agents-plugins](https://github.com/unic/unic-agents-plugins) monorepo.
     Plugin renamed to `<new-name>`. Install from the new marketplace going forward.
   ```

   c. Commit: `chore: deprecate — migrated to unic-agents-plugins`

   d. Push.

2. Archive each repo on GitHub:
   - Go to repo **Settings → General → Danger Zone → Archive this repository**
   - Confirm. The repo becomes read-only.

3. Back in this monorepo, mark this spec done and commit:

   ```sh
   git add docs/plans/13-archive-old-repos.md
   git commit -m "chore(spec-13): archive old repos complete"
   ```

## Verification

```sh
gh repo view unic/unic-pr-review --json isArchived --jq .isArchived          # true
gh repo view unic/unic-claude-code-format --json isArchived --jq .isArchived  # true
gh repo view unic/unic-claude-code-confluence --json isArchived --jq .isArchived  # true
```

## Acceptance criteria

- [ ] Each old repo has a deprecation note in `README.md`
- [ ] Each old repo's `CHANGELOG.md` has a final migration entry
- [ ] All three old repos are archived on GitHub (read-only)

## Out of scope

- Deleting the old repos (archive is safer — keep them for historical reference)
- Updating any external references or documentation that may link to the old repos
