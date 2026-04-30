# 14. Fix Release Workflow Tag Detection
**Status: done — 2026-04-30**

**Priority:** P0
**Effort:** S
**Version impact:** none (workflow fix only)
**Depends on:** 12
**Touches:** `.github/workflows/release.yml`

## Context

Spec 12 revealed that the release workflow (spec 10) will not create tags when multiple commits are pushed at once. The current logic fetches only the last two commits (`fetch-depth: 2`) and compares the plugin version in `HEAD` vs `HEAD~1`. If the version bump landed in an older commit, the diff is empty and no tag is created. In spec 12, all three tags had to be pushed manually.

The fix is to switch from a diff-based approach to an existence-based one: fetch all tags, then create a tag only if `<name>@<version>` does not yet exist in the remote. This is also idempotent — re-running the workflow never creates a duplicate tag.

## Current behaviour

`.github/workflows/release.yml`:
- `fetch-depth: 2` — fetches only the last two commits
- Reads `plugin.json` version from `HEAD` and `HEAD~1`
- Tags if the two versions differ
- Silently skips if the bump was more than one commit ago

## Target behaviour

`.github/workflows/release.yml`:
- `fetch-depth: 0` — fetches full history and all tags
- For each plugin: reads current version from `plugin.json`, builds the expected tag name (`<name>@<version>`), checks whether that tag already exists
- Creates and pushes the tag only if it does not exist
- Idempotent: safe to re-run on any commit

## Affected files

| File | Change |
|---|---|
| `.github/workflows/release.yml` | Replace `fetch-depth: 2` with `fetch-depth: 0`; rewrite `tag_if_changed` shell function |

## Implementation steps

1. In `.github/workflows/release.yml`, change the checkout step:

   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0  # need all tags to detect existing releases
   ```

2. Replace the `tag_if_changed` shell function body. Remove the `previous` variable and diff logic. Replace with a tag-existence check:

   ```bash
   tag_if_changed() {
     local plugin_dir="$1"
     local json_path="$plugin_dir/.claude-plugin/plugin.json"

     if [ ! -f "$json_path" ]; then return; fi

     current=$(node -p "JSON.parse(require('fs').readFileSync('$json_path','utf8')).version")
     name=$(node -p "JSON.parse(require('fs').readFileSync('$json_path','utf8')).name")
     tag="${name}@${current}"

     if git rev-parse --verify "refs/tags/$tag" >/dev/null 2>&1; then
       echo "Tag $tag already exists, skipping"
       return
     fi

     echo "Tagging $tag"
     if [ "$SIGN_TAGS" = "true" ]; then
       git tag -s "$tag" -m "Release $tag"
     else
       git tag "$tag"
     fi
     git push origin "$tag"
   }
   ```

3. Remove the inline comment `# need HEAD and HEAD~1 to diff` (no longer accurate).

4. Commit:

   ```sh
   git commit -m "fix(release-workflow): detect existing tags instead of diffing HEAD~1"
   ```

## Verification

```sh
# Locally: confirm the workflow file has fetch-depth: 0 and no HEAD~1 reference
grep "fetch-depth" .github/workflows/release.yml
# → fetch-depth: 0

grep "HEAD~1" .github/workflows/release.yml
# → (no output)

# After merging: push a version bump and confirm the workflow creates the tag automatically
# without manual intervention
```

## Acceptance criteria

- [x] `fetch-depth: 0` in the checkout step
- [x] No reference to `HEAD~1` in the workflow
- [x] `tag_if_changed` uses `git rev-parse --verify "refs/tags/$tag"` to skip existing tags
- [ ] Workflow re-runs on a commit where no version changed produce no new tags (idempotent) — verified on next push
- [ ] Next real version bump triggers a tag automatically without manual intervention — verified on next release

## Out of scope

- Adding changelog automation or GitHub Release notes
- Changing the tag name scheme (`<name>@<version>`)
- Adding GPG signing secrets (separate concern)
