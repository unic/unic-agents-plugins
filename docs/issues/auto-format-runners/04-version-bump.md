# Version bump and CHANGELOG entry

**Status:** resolved
**Category:** release

## Parent

`docs/issues/auto-format-runners/PRD.md`

## What to build

Bump the auto-format plugin version and add a dated CHANGELOG entry.

```sh
pnpm --filter auto-format bump patch
```

CHANGELOG entry should describe the formatter runner extraction as an internal refactor.

## Acceptance criteria

- [ ] `pnpm --filter auto-format verify:changelog` passes
- [ ] CHANGELOG entry present for the new version
- [ ] `plugin.json` and `marketplace.json` versions are in sync

## Blocked by

03-replace-runner-functions
