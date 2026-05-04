# 0014. CI matrix: Ubuntu × macOS × Windows, Node 22 × Node 24

**Status:** Accepted (2025-04)

## Context

Plugins must run on all major operating systems (AGENTS.md cross-platform requirement) and must not break when users upgrade Node. Testing on the matrix asserts the cross-platform contract in CI rather than relying on convention.

## Decision

The per-package test job runs a 3×2 matrix: `ubuntu-latest`, `macos-latest`, `windows-latest` × Node 22 LTS, Node 24 LTS.

Windows installs run with `--ignore-scripts` because Windows postinstall scripts are unreliable in CI.

## Consequences

- CI cost and duration scale with 6 environments per changed package.
- Any script that uses OS-specific APIs will fail on at least one runner.
- Node version support policy: current LTS + next LTS.
