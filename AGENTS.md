# CLAUDE.md & AGENTS.md

Guidance for any AI agent working in this repository. `CLAUDE.md` is a symlink to this file.

## What this repo is

A pnpm workspace monorepo hosting AI agent plugins developed at Unic. Today it contains Claude Code plugins; the structure supports plugins for other agents (GitHub Copilot, etc.) in the future.

## Workspace layout

```tree
apps/
├── claude-code/              # Claude Code plugins — one dir per plugin
│   ├── pr-review/
│   ├── auto-format/
│   ├── unic-confluence/
│   ├── unic-archon-dlc/
│   ├── unic-pr-review/
│   └── unic-spec-review/
└── copilot/                  # GitHub Copilot plugins (future)
packages/
├── biome-config/             # @unic/biome-config
├── tsconfig/                 # @unic/tsconfig
├── release-tools/            # @unic/release-tools (bump / sync-version / tag / verify-changelog)
└── tracker-streams/          # @unic/tracker-streams (generates the published streams page)
docs/
├── adr/                      # Architectural Decision Records
├── agents/                   # Agent skill documentation
├── inbox/                    # Retired idea-capture notes (historical)
├── issues/                   # Grilled and scoped feature issues
├── process/                  # Process and workflow guides
└── research/                 # Research notes and explorations
```

## Navigation

- Plugin manifests: `apps/<agent>/<plugin>/.claude-plugin/plugin.json` and `marketplace.json`
- Shared release scripts: `packages/release-tools/scripts/`
- Architectural decisions: `docs/adr/`
- Process templates: `docs/process/`

## Commands

```sh
pnpm install                            # install all workspace deps
pnpm check                              # Biome + Prettier check (whole tree)
pnpm format                             # Biome + Prettier fix (whole tree)
pnpm ci:check                           # same as check, non-interactive (for CI)
pnpm test                               # run tests across all packages
pnpm typecheck                          # type-check across all packages

# Per-plugin operations
pnpm --filter <name> bump patch         # bump plugin version
pnpm --filter <name> verify:changelog   # check changelog
```

## Tech stack

- **Runtime**: Node.js ≥ 22. `.nvmrc` is the source of truth for local dev (currently `24.15.0`) and is consumed by `actions/setup-node` in CI.
- **Package manager**: pnpm 10 (workspace mode, catalog pinning)
- **Module system**: ESM (`"type": "module"`) throughout
- **Linter/formatter**: Biome 2 for code/JSON; Prettier for Markdown only
- **Type checking**: `tsc --checkJs --noEmit` on `.mjs` files; no compilation step
- **Test runner**: `node:test` built-in

## Cross-platform requirement

Every plugin must work on **macOS, Windows, and Linux**. Use Node.js APIs (`node:path`, `node:fs`, `node:os`) instead of shell commands. CI runs all three OSes × Node 22 and 24.

## Code conventions

- Tabs for indentation in `.mjs`/`.js`/`.ts` files; spaces (2) for `.json`/`.yml`/`.yaml`
- Single quotes, no semicolons, trailing commas ES5-style (enforced by Biome)
- Line width 120 (Biome)
- Prettier for Markdown only
- No TypeScript compilation — `// @ts-check` + JSDoc for type safety

## Versioning

Plugins are versioned independently. `plugin.json` is the source of truth. Use `pnpm --filter <name> bump <patch|minor|major>` — never hand-edit `marketplace.json`.

Tag scheme: `<plugin-name>@<version>` (e.g. `auto-format@0.5.5`).

**CHANGELOG version headers** must use the format `## [X.Y.Z] — YYYY-MM-DD` (em dash, then ISO date). `pnpm bump` writes this format and `verify:changelog` (in `packages/release-tools`) structurally enforces ` — YYYY-MM-DD` on every versioned header. Do not change the separator or the date format: CI and the release flow depend on it.

## Conventional commits

Use package scope: `feat(auto-format): …`, `fix(pr-review): …`, `chore(release-tools): …`, `chore(unic-archon-dlc): …`, `feat(unic-pr-review): …`.

## Git branching (Gitflow)

| Branch           | Purpose                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `main`           | Production. Only receives merge commits from `develop` (or `hotfix/*`). The release workflow fires here and creates tags. |
| `develop`        | Integration. Default target for all feature PRs. CI runs on every push and PR.                                            |
| `feature/<name>` | Day-to-day work. Branch from `develop`, PR back to `develop`.                                                             |
| `hotfix/<name>`  | Urgent fixes only. Branch from `main`, PR to both `main` and `develop`.                                                   |

**Never commit directly to `main` or `develop`.** Always go through a PR.

PRs merge with a merge commit, never a squash — the release flow reads `develop → main` merges.

### The Archon pre-push guard

The Archon worktrees under `~/.archon/workspaces/<org>/<repo>/worktrees/` are worktrees of your clone, not a separate checkout. They share its ref store, its config and its `origin`, so an autonomous run can move `develop` or `main` directly and bypass the PR gate above. `.githooks/pre-push` refuses a push of either branch when the push comes from a path under `.archon/workspaces/`. It leaves your own pushes alone, so read a refusal as "an Archon worktree tried this", never as "`develop` is protected".

`.git/hooks` is not version-controlled, so install it once per clone:

```sh
ln -sf ../../.githooks/pre-push "$(git rev-parse --git-common-dir)/hooks/pre-push"
```

Bugs are not a separate prefix: a `bug` issue that targets `develop` uses `feature/` (the prefix encodes PR topology, not change kind). Archon-dispatched branches add a scope sub-namespace: `feature/<scope>/<issue#>-<slug>`, where `<scope>` is the area label with its tier stripped (`app:unic-pr-review` → `unic-pr-review`, `repo` → `repo`). The `/archon-rollout` command owns the full derivation rule.

## Release flow

To ship a new plugin version:

1. On a feature branch, bump the version: `pnpm --filter <name> bump <patch|minor|major>`
2. Add a dated entry to the plugin's `CHANGELOG.md` under the new version.
3. Open a PR targeting `develop`. CI runs `verify:changelog` on all PRs — it will fail if the changelog entry is missing or malformed.
4. After the PR merges to `develop`, open a release PR from `develop` → `main`.
5. After the release PR merges, the release workflow on `main` detects that `<name>@<version>` has no tag yet and creates it automatically.

**CI summary:**

| Event             | Root checks | Package tests        | `verify:changelog` |
| ----------------- | ----------- | -------------------- | ------------------ |
| PR (any branch)   | ✓           | ✓ (changed packages) | ✓                  |
| Push to `develop` | ✓           | ✓ (changed packages) | —                  |
| Push to `main`    | ✓           | ✓ (changed packages) | —                  |

## Feature-driven development

New work enters through the issue tracker as Features. Plan with `/wayfinder` when the work is too big for one agent session, or `/grill-with-docs` when it fits in one; then `/to-spec` → `/to-tickets` → pre-dispatch audit → `/archon-rollout`. The audit is what makes `ready-for-agent` mean audited, and it runs against a named commit — see [`docs/process/ai-development.md`](docs/process/ai-development.md) §4. Use `/tdd` and `/implement` for individual issues.

`unic-archon-dlc` is **not** installed here — this repo builds it, it does not run it. See [ADR-0033](docs/adr/0033-de-dogfood-unic-archon-dlc.md).

## Do not add

- External runtime deps to plugins unless truly essential (`auto-format` has zero; that's the bar)
- Turborepo or other build orchestrators — plain pnpm workspaces is the current choice
- Features not tracked in the issue tracker — open a Feature first
- Per-plugin `pnpm-lock.yaml` files — the root lockfile is canonical; sub-package lockfiles should never be committed

## LICENSE files

**Never create, copy, or delete `LICENSE` files.** The maintainer manages these manually in every package and plugin directory. If an acceptance criterion requires a `LICENSE` file to exist, warn the maintainer to add it themselves before continuing.

## Skill summary

### Issue tracker

Issues live in GitHub Issues at `unic/unic-agents-plugins` (planned migration to Azure DevOps). See `docs/agents/issue-tracker.md`.

### Triage labels

8-state vocabulary: `needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed` (or `rejected`). See `docs/agents/triage-labels.md`.

### Type & area labels

**Type** (kind of issue): `feature`, `bug`, `spike`, `tech-debt`, `docs`, `release`. See `docs/agents/labels.md`, which is now the only home for the repo-local `release` type.

**Area** (which app/package): `app:<plugin>` one per app, `pkg:<package>` one per workspace package, and `repo` for monorepo-wide / cross-cutting work. Hand-applied. See [`CONTEXT-MAP.md`](CONTEXT-MAP.md) and [ADR-0032](docs/adr/0032-label-taxonomy.md).

### Domain docs

Multi-context repo: Per-plugin `CONTEXT.md` files live under `apps/claude-code/<plugin>/`. Root `CONTEXT-MAP.md` at repo root. See `docs/agents/domain.md`.

## Agent skills

Matt Pocock's skills ([`mattpocock/skills`](https://github.com/mattpocock/skills)) are the agent-skill driver for this repo, installed via `npx skills` and pinned in `skills-lock.json`. See [ADR-0033](docs/adr/0033-de-dogfood-unic-archon-dlc.md).

- [issue-tracker.md](docs/agents/issue-tracker.md) — `gh` conventions, PR triage surface, wayfinding operations
- [triage-labels.md](docs/agents/triage-labels.md) — canonical triage role → this repo's state label
- [labels.md](docs/agents/labels.md) — four-tier label taxonomy: state, type, priority, area
- [domain.md](docs/agents/domain.md) — multi-context layout, `CONTEXT.md` and ADR locations
- [feature-runner.md](docs/agents/feature-runner.md) — AFK invocation of the feature runner

### Who owns which files

| Path                                             | Owner                        | Rule                                                                                                                                         |
| ------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/skills/**`                              | Upstream `mattpocock/skills` | **Never hand-edit.** Every `npx skills add` overwrites it; edits die silently                                                                |
| `.claude/skills/<name>` symlinks                 | `npx skills`                 | Managed. `skills remove` leaves the `.agents/skills/` source directory behind, so pair it with `git rm -r`                                   |
| `.claude/skills/{archon,new-plugin,verify-spec}` | This repo                    | Real directories, repo-authored. `npx skills` does not manage them — never remove them while pruning vendored skills                         |
| `skills-lock.json`                               | `npx skills`                 | Never hand-edit — the hashes are computed                                                                                                    |
| `docs/agents/*.md`                               | This repo                    | Hand-maintained, no generator. Do **not** run `/setup-matt-pocock-skills`: it reverts `triage-labels.md` to a five-role `wontfix` vocabulary |

### Upgrading

Selection policy: all of `skills/engineering/` and `skills/productivity/`, `skills/misc/` by explicit justification, never `skills/in-progress/`.

Two entries the policy needs to name explicitly:

- **`misc/git-guardrails-claude-code`** is the one `misc/` entry installed. Justification: it is the only vendored skill that installs a repo-local safety hook, so it belongs where the repo is. Read the caveat below before wiring it up.
- **`setup-matt-pocock-skills` stays installed but must never run.** It is the reference `docs/agents/*.md` was hand-authored from, which is why it is kept. A run reverts `docs/agents/triage-labels.md` to the five-role `wontfix` vocabulary. Four installed skills tell an agent to invoke it when a tracker or label mapping looks missing — `triage`, `wayfinder`, `to-spec`, `to-tickets`. Those files exist and are correct here, so that condition is never met: if a skill asks for them, read `docs/agents/`, do not run the setup skill.

```sh
npx skills@latest add mattpocock/skills -a claude-code -y -s <name> -s <name> …
npx skills@latest remove -s <name> -s <name> … -a claude-code -y
```

Three traps the CLI sets:

- **Target `-a claude-code`, never `-a '*'`.** The wildcard installs a second, frontmatter-rewritten copy of every skill into a top-level `agent/skills/` tree for foreign agents, which then drifts from `.agents/skills/`. `remove` rejects `-a '*'` outright.
- **`-s` takes repeated flags, not a comma list.** `-s a,b,c` reports "no matching skills found" and exits 0.
- **`remove` is 2-for-3.** It cleans the `.claude/skills/<name>` symlink and the lockfile entry but leaves `.agents/skills/<name>/` behind. Pair every removal with `git rm -r .agents/skills/<name>`.

Upstream renames and deletes skills between releases, and nothing prunes. After upgrading, diff the installed set against the upstream tree and remove what no longer exists there.

### Vendored hook caveat: `git-guardrails-claude-code` needs `jq`

`.agents/skills/git-guardrails-claude-code/scripts/block-dangerous-git.sh` reads its `PreToolUse` payload with `jq` and does not check that the read worked. Without `jq` on the hook runner's `PATH` it exits 0 — which the hook protocol means as **allow** — so a `git push --force` passes while the transcript looks identical to a successful block. Its own verification step tests only the matching-command path, so installing it appears to confirm protection that is conditional on `jq`.

Before wiring this hook into `.claude/settings.json`, confirm `jq` resolves for the hook runner, then test the negative path: pipe a payload in with `jq` off the `PATH` and expect a **non-zero** exit. The fix belongs upstream — `.agents/skills/**` is never hand-edited here, so a local patch dies on the next `npx skills add`.
