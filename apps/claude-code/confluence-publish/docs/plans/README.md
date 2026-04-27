# Plugin Roadmap

This directory contains one Ralph-ready implementation spec per feature. Each file is a self-contained brief: context, affected files, step-by-step implementation, test cases, and acceptance criteria.

## How to use (for Ralph)

1. Pick the next unstarted spec in numerical order.
2. Read the spec top to bottom **before** touching any code.
3. If the "Current behaviour" section doesn't match what you find in the file, STOP and add a `## Deviations` section to the spec file documenting the discrepancy. Do NOT silently adapt.
4. After landing the change, add `**Status: done — <YYYY-MM-DD>**` at the top of the spec.
5. Read the spec's `**Version impact:** patch|minor|major` line and execute `PROMPT.md` Step 4.5 before committing.

## Ground rules

- **Package manager**: `pnpm` (workspace mode, after spec `00` lands). Before `00`: use `npm`.
- **Indentation**: tabs. Line endings: LF. (See `.editorconfig`.)
- **Commits**: conventional commits — `feat(scope): description`, `fix(scope): description`, `chore(scope): description`. No ticket numbers required.
- **Dep versioning**: all deps go through the `catalog:` section in `pnpm-workspace.yaml`, pinned exactly. Never add `^` or `~` ranges. To add/bump a dep: edit the catalog entry only.
- **Supply-chain guards**: `minimumReleaseAge: 1440` blocks packages younger than 24 hours. If a bump is urgent, add the dep to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` and document the justification in the PR description.
- **Node version**: Node 24.x (Active LTS). `useNodeVersion` in `pnpm-workspace.yaml` pins the exact patch. Bump it only when explicitly needed, not opportunistically.
- **Plugin versioning**: `.claude-plugin/plugin.json` is the single source of truth for the version number. **Never hand-edit `.claude-plugin/marketplace.json`** — use `pnpm bump` (spec `19`) which bumps, syncs, and promotes the CHANGELOG in one step.
- **Before opening a PR**: run `pnpm lint` (available after spec `10`), `pnpm test` (after spec `09`), and do one end-to-end publish to a throwaway Confluence test page.
- **Scope guard**: do NOT add MCP servers, skills, agents, image-upload support, create-page support, or multi-space support. See `CLAUDE.md` "do not add" section (added in spec `17`).

## Versioning policy

**SemVer, strictly.**

| Change type | Bump |
|---|---|
| Breaking change to slash-command interface, CLI args, or on-disk contracts (`confluence-pages.json` schema, credential file format at `~/.unic-confluence.json`) | MAJOR |
| New flag, new subcommand, new feature that doesn't break existing usage | MINOR |
| Bug fix, docs update, internal refactor, dependency bump | PATCH |

Each spec bumps per its `**Version impact:**` declaration. See `PROMPT.md` Step 4.5.

**Release flow:**

```sh
# Per change (every spec commit):
pnpm bump <patch|minor|major>   # bumps version, promotes CHANGELOG
pnpm verify:changelog            # confirm CI check passes

# Periodic: tag and push a release boundary
pnpm tag                         # creates local git tag vX.Y.Z
git push --follow-tags           # publishes tag to GitHub
```

## Execution order

| # | Spec | Priority | Status |
|---|---|---|---|
| 00 | [Convert repo tooling to pnpm](./00-convert-repo-tooling-to-pnpm.md) | P0 | — |
| 01 | [Drop --verify from slash command](./01-drop-verify-from-slash-command.md) | P0 | — |
| 02 | [Document marker syntax in README](./02-document-marker-syntax-readme.md) | P0 | — |
| 03 | [Refuse publish without markers](./03-refuse-publish-without-markers.md) | P1 | — |
| 04 | [Add --dry-run flag](./04-dry-run-flag.md) | P1 | — |
| 05 | [Confluence code-macro fidelity](./05-confluence-code-macro-fidelity.md) | P1 | — |
| 06 | [Version-sync script and CHANGELOG](./06-version-sync-script-and-changelog.md) | P1 | — |
| 07 | [HTTP timeout and --check-auth](./07-http-timeout-and-check-auth.md) | P1 | — |
| 08 | [Tighten stripFrontmatter](./08-tighten-strip-frontmatter.md) | P1 | — |
| 09 | [Tests for pure functions](./09-tests-for-pure-functions.md) | P1 | — |
| 10 | [Biome lint/format and CI](./10-biome-lint-format-and-ci.md) | P1 | — |
| 11 | [README troubleshooting section](./11-readme-troubleshooting-section.md) | P1 | — |
| 12 | [Fix handleHttpError argv leak](./12-fix-handlehttperror-argv-leak.md) | P2 | — |
| 13 | [Normalise \<p\> wrapping around markers](./13-normalise-p-wrapping-markers.md) | P2 | — |
| 14 | [JSDoc types and @ts-check](./14-jsdoc-types-ts-check.md) | P2 | — |
| 15 | [CliError class](./15-clierror-class.md) | P2 | — |
| 16 | [Plugin-level README](./16-claude-plugin-readme.md) | P2 | — |
| 17 | [CLAUDE.md do-not-add section](./17-claude-md-do-not-add-section.md) | P2 | — |
| 18 | [Parallelise runVerify](./18-parallelise-runverify.md) | P2 | — |
| 19 | [pnpm bump tooling](./19-pnpm-bump-tooling.md) | P1 | — |
| 20 | [pnpm verify:changelog enforcement](./20-pnpm-verify-changelog.md) | P1 | — |
| 21 | [Versioning docs and Ralph integration](./21-versioning-docs-and-prompt.md) | P1 | — |
| 22 | [Auto-populate confluence-pages.json aliases](./22-auto-populate-aliases.md) | P1 | — |

## Cross-cutting dependencies

- **`07` → `01`**: Spec `01` can either (a) drop the credential check entirely or (b) replace it with the new `--check-auth` subcommand from spec `07`. If you do `01` before `07`, choose option (a). If you land `07` first, choose option (b).
- **`09` → `08` + code**:  Spec `09` extracts pure functions into `scripts/lib/`. Specs that modify those functions (`08`, `13`) should land before or together with `09` to avoid merge conflicts.
- **`15` → `09`**: The `CliError` class refactor touches ~20 `process.exit(1)` sites. Land after `09` so tests catch regressions.
- **`14` → `09` + `10`**: JSDoc pass should come after `09` (lib extraction) and `10` (Biome formatting) to avoid churning JSDoc during the format pass.
- **`18` depends on `01` outcome**: If spec `01` deletes `--verify` entirely, skip spec `18`.
- **`19` → `15`**: Spec `19` (`pnpm bump`) imports `CliError` from `scripts/lib/errors.mjs`. Land spec `15` first.
- **`20` → `19`**: Spec `20` (`pnpm verify:changelog`) references `pnpm bump` in its error messages. Land spec `19` first.
- **`21` → `19` + `20`**: Spec `21` (docs) documents `pnpm bump` and `pnpm verify:changelog`. Land both first.
