# 0012. LICENSE files are maintained manually by the repo owner

**Status:** Accepted (2025-04)

## Context

LICENSE files are legal artefacts. Automated tooling (Ralph, Claude) creating, copying, or deleting them could accidentally relicense packages or create inconsistencies that require legal review.

## Decision

LICENSE files in every package and plugin directory are managed manually by the maintainer. Ralph specs and Claude must never create, copy, or delete LICENSE files. If a spec step requires a LICENSE file to exist, the spec must include a note directing the maintainer to add it manually.

## Consequences

- `AGENTS.md` explicitly prohibits automated LICENSE file changes.
- Reviewers should reject PRs that add or remove LICENSE files via automation.
