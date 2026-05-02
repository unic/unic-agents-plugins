# 0017. verify:changelog runs on PR events only, not on push to main

**Status:** Accepted (2025-04)

## Context

`unic-verify-changelog` enforces that every version bump is accompanied by a dated CHANGELOG entry. Running it on push to `main` would block merges that were already validated on the originating PR.

## Decision

`verify:changelog` is a PR-only gate. It does not run on push to `develop` or `main`. The enforcement happens at review time, not at merge time.

## Consequences

- Direct pushes to `develop` (which are allowed by Gitflow for some maintainers) bypass the changelog gate.
- The gate relies on PR discipline; it cannot catch hotfixes pushed directly.
