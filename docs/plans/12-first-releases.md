# 12. First Releases
**Status: done — 2026-04-30**

**Priority:** P0
**Effort:** S
**Version impact:** none (versions were already bumped in specs 05–07)
**Depends on:** 11
**Touches:** Nothing new — this spec creates tags

## Context

Specs 05–07 bumped each plugin to its first monorepo version (`pr-review@0.1.1`, `auto-format@0.5.9`, `confluence-publish@2.4.2`). This spec pushes those commits to the GitHub remote and confirms that the release workflow (spec 10) fires and creates the correct tags.

## Current behaviour

The monorepo exists locally with all commits. No GitHub remote has been pushed to yet.

## Target behaviour

- `origin` points to `https://github.com/unic/unic-agents-plugins`
- All commits pushed to `main`
- Release workflow fires and creates tags: `pr-review@0.1.1`, `auto-format@0.5.9`, `confluence-publish@2.4.2`
- Tags are visible in the GitHub Releases / Tags page

## Affected files

No file changes. This spec is a sequence of git/GitHub operations.

## Implementation steps

1. Create the GitHub repository `unic/unic-agents-plugins` (private initially if preferred, can be made public later). Do this via the GitHub web UI or `gh repo create`.

2. Add the remote:

   ```sh
   git remote add origin https://github.com/unic/unic-agents-plugins.git
   ```

3. Push:

   ```sh
   git push -u origin main
   ```

4. Confirm the CI workflow (spec 09) runs and passes on the push to `main`.

5. Confirm the release workflow (spec 10) runs and creates the three tags.

6. Verify locally:

   ```sh
   git ls-remote origin 'refs/tags/*'
   # should list pr-review@0.1.1, auto-format@0.5.9, confluence-publish@2.4.2
   ```

## Verification

```sh
gh run list --repo unic/unic-agents-plugins --limit 5  # shows CI + Release runs
git ls-remote origin 'refs/tags/*'                     # shows all 3 release tags
```

## Acceptance criteria

- [x] GitHub repo `unic/unic-agents-plugins` exists
- [x] `main` branch is pushed
- [x] CI workflow passes (Windows fixed via optionalDependencies)
- [x] Three release tags created: `pr-review@0.1.1`, `auto-format@0.5.5`, `confluence-publish@2.1.6` (versions differ from spec — see Deviations)
- [x] Tags visible on GitHub

## Out of scope

- Making the repo public
- Setting up branch protection rules
- Adding GitHub Actions secrets for GPG signing (can be done separately)

## Deviations

- **Actual plugin versions differ from spec**: This spec doc stated `auto-format@0.5.9` and `confluence-publish@2.4.2`, but the actual versions after migration (specs 05–07) are `auto-format@0.5.5` and `confluence-publish@2.1.6`. The tags created are `pr-review@0.1.1`, `auto-format@0.5.5`, and `confluence-publish@2.1.6`.
- **Release workflow did not auto-create tags**: The release workflow uses `fetch-depth: 2` and compared HEAD vs HEAD~1. Since all commits were pushed at once, the version bumps were in older commits and were not detected. Tags were created manually and pushed directly.
- **Windows CI fix required**: `@ralph-orchestrator/ralph-cli` postinstall fails on Windows (no Windows binary). Moved from `devDependencies` to `optionalDependencies` so postinstall failure is non-fatal on Windows.
- **Old-repo annotated tags on remote**: Tags `v0.1.0`–`v0.5.4` and `v2.3.5` (from the original plugin repos) were pushed automatically via `push.followTags=true`. These are expected migration artifacts.
