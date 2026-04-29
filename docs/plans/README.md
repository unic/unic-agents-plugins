# Monorepo Spec Roadmap

This directory contains the Ralph-iterable spec set for the `unic-agents-plugins` monorepo migration and bootstrapping. Each spec is implemented by Ralph in one iteration.

Individual plugins have their own `docs/plans/` for plugin-specific development.

## Execution order

| # | Spec | What ships | Depends on |
|---|---|---|---|
| 00 | [bootstrap-validation](00-bootstrap-validation.md) | Seed verification; first commit | — |
| 01 | [tsconfig-package](01-tsconfig-package.md) | `@unic/tsconfig` package with `tsconfig.base.json` | 00 |
| 02 | [biome-config-package](02-biome-config-package.md) | `@unic/biome-config` package; root `biome.json` extends it | 01 |
| 03 | [release-tools-package](03-release-tools-package.md) | `@unic/release-tools` with bump/sync/tag/verify scripts and bin commands | 02 |
| 04 | [root-docs](04-root-docs.md) | `docs/process/` templates; finalize cross-cutting docs | 03 |
| 05 | [migrate-pr-review](05-migrate-pr-review.md) | `apps/claude-code/pr-review/` with history; plugin renamed to `pr-review` | 03 |
| 06 | [migrate-auto-format](06-migrate-auto-format.md) | `apps/claude-code/auto-format/` with history; plugin renamed to `auto-format` | 03 |
| 07 | [migrate-confluence-publish](07-migrate-confluence-publish.md) | `apps/claude-code/confluence-publish/` with history; plugin renamed to `confluence-publish` | 03 |
| 08 | [root-marketplace](08-root-marketplace.md) | `.claude-plugin/marketplace.json` listing all three plugins | 05, 06, 07 |
| 09 | [ci-workflow](09-ci-workflow.md) | `.github/workflows/ci.yml` — path-filtered matrix (3 OS × 2 Node) | 08 |
| 10 | [release-workflow](10-release-workflow.md) | `.github/workflows/release.yml` — per-plugin version-diff tagging | 09 |
| 11 | [smoke-tests](11-smoke-tests.md) | Cross-platform install and run validation | 10 |
| 12 | [first-releases](12-first-releases.md) | Cut `pr-review@0.1.1`, `auto-format@0.5.9`, `confluence-publish@2.4.2` | 11 |
| 13 | [archive-old-repos](13-archive-old-repos.md) | Final CHANGELOG entries; archive old GitHub repos | 12 |

## SemVer policy (per plugin)

| Bump | When |
|---|---|
| **major** | Breaking change to CLI flags, exit codes, or on-disk file schemas |
| **minor** | New flag, subcommand, or user-visible feature |
| **patch** | Bug fix, refactor, docs, internal tooling |

## Ground rules

- **pnpm** for all package operations.
- **Tabs** in `.mjs`/`.js`/`.ts`; **spaces (2)** in `.json`/`.yml`/`.yaml`.
- **Conventional commits** with package scope: `feat(auto-format): …`, `chore(spec-NN): …`.
- **Cross-platform**: Node.js APIs only — no shell, no POSIX path assumptions.
- **`pnpm --filter <name> bump <type>`** is the only way to change a plugin version.
- Workspace specs (00–04, 08–13) do not bump any version. Commit with `chore(spec-NN): …`.
- Plugin migration specs (05–07) bump the plugin's version. Commit with `feat(spec-NN): … (vX.Y.Z)`.
