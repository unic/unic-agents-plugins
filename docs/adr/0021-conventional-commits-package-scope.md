# 0021. Conventional Commits with package or spec scope

**Status:** Accepted (2025-04)

## Context

With multiple plugins and shared packages in one repo, commit messages without scope make changelogs and `git log` noisy. Conventional Commits with a scope field allow per-package filtering.

## Decision

Commit messages follow Conventional Commits with a mandatory scope:

- Plugin work: `feat(auto-format): …`, `fix(pr-review): …`, `chore(unic-confluence): …`
- Spec progress: `chore(spec-NN): …`
- Shared packages: `chore(release-tools): …`, `chore(biome-config): …`
- Workspace-level: `chore(workspace): …`

## Consequences

- `git log --grep="(auto-format)"` filters to one plugin's history.
- Release notes can be generated per-plugin by filtering on the scope.
- Reviewers should reject commits without a scope.
