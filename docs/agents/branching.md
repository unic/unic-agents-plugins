# Branching Strategy

Configured by unic-archon-dlc.

## Strategy: Gitflow

| Branch type | Pattern                                                    | PR target          |
| ----------- | ---------------------------------------------------------- | ------------------ |
| Production  | `main`                                                     | —                  |
| Integration | `develop`                                                  | —                  |
| Feature     | `feature/<name>` or `feature/<app-or-pachage-name>/<name>` | `develop`          |
| Hotfix      | `hotfix/<name>`                                            | `main` + `develop` |
| Release     | `release/<version>`                                        | `main` + `develop` |

## Default branch names

- **Main branch:** `main`
- **Integration branch:** `develop`
- **Feature branch prefix:** `feature/`
- **Release branch prefix:** `release/`

## PR conventions

All PRs target `develop`. Merge strategy: `merge`.
