# Branching Strategy

Configured by unic-archon-dlc.

## Strategy: Gitflow

| Branch type | Pattern          | PR target          |
| ----------- | ---------------- | ------------------ |
| Production  | `main`           | —                  |
| Integration | `develop`        | —                  |
| Feature     | `feature/<name>` | `develop`          |
| Hotfix      | `hotfix/<name>`  | `main` + `develop` |

## Default branch names

- **Main branch:** `main`
- **Integration branch:** `develop`
- **Feature branch prefix:** `feature/`

## PR conventions

All PRs target `develop`. Merge strategy: `merge`.
