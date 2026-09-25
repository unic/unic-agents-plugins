# CLAUDE.md & AGENTS.md

Guidance for any AI agent working in this repository. `CLAUDE.md` is a symlink to this file.

## What this repo is

A pnpm workspace monorepo hosting AI agent plugins developed at Unic. Today it contains Claude Code plugins; the structure supports plugins for other agents (GitHub Copilot, etc.) in the future.

## Commands

Root scripts are in `package.json`. Per-plugin operations:

```sh
pnpm --filter <name> bump patch         # bump plugin version
pnpm --filter <name> verify:changelog   # check changelog
```

## Cross-platform requirement

Every plugin must work on **macOS, Windows, and Linux**. Use Node.js APIs (`node:path`, `node:fs`, `node:os`) instead of shell commands. CI runs all three OSes × Node 22 and 24.

## Code conventions

Formatting is enforced by Biome and Prettier; read `biome.json` for the values.

- No TypeScript compilation — `// @ts-check` + JSDoc for type safety

## Versioning

Plugins are versioned independently. `plugin.json` is the source of truth. Use `pnpm --filter <name> bump <patch|minor|major>` — never hand-edit `marketplace.json`.

**On a `0.x` plugin a breaking change is a `minor` bump, and `major` is reserved for the `1.0.0` release itself.** SemVer §4 makes the `0.x` API unstable by definition, and `1.0.0` is reached by meeting that plugin's own release bar — never by making a breaking change. So the `### Breaking` changelog entry is what warns a consumer there, not the version number: write the entry, and never reach for `bump major` to signal it. Read the plugin's current version off its `plugin.json` to know which rule applies. Above `1.0.0` the ordinary contract holds. See [ADR-0022](docs/adr/0022-semver-per-plugin.md).

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

Archon also keeps a `default_branch` of its own per repository, set from whatever was checked out on its first run there and never re-read from the host. `worktree.baseBranch` in `.archon/config.yaml` overrides it, and `--from <branch>` overrides that. A bare top-level `baseBranch:` has no reader — the nesting is the whole setting. So fix a wrong fork point in that file, never in `~/.archon/archon.db`, which is one machine's row.

Run `pnpm install` once in every clone, including one that still has symlinks in `.git/hooks`. It points `core.hooksPath` at the main work tree's `.githooks`, as an absolute path, so every worktree of the clone runs the hooks the main work tree has checked out. Git then ignores the old symlinks, so they may stay or go.

A worktree on a branch without hooks is guarded too, but only while the main work tree is on a branch that carries them. Today `main` carries only `pre-push`, so with the main work tree on `main` no worktree runs the NDA commit hooks, and `prepare` warns. That gap closes once [#576](https://github.com/unic/unic-agents-plugins/pull/576) and [#577](https://github.com/unic/unic-agents-plugins/pull/577) reach `main`.

Two cases leave the hooks off without a message. One is a moved clone, where the absolute path is stale. The other is an install with `--ignore-scripts`, or with `ignore-scripts=true` in any npmrc, where `prepare` never runs. In both, run `pnpm install` again without that setting, or set the path by hand with `git config core.hooksPath <absolute path to the main work tree>/.githooks`.

### The NDA publish guard

**This repository is public, and one client of the DLC work is under an NDA**: its name, its repository name, and anything that would identify it must never reach GitHub. Two guards enforce that, the Claude hook and the git hooks, and neither of them names a protected term, which is why both can live here.

The terms are read from a file **outside every repository** — `$UNIC_NDA_DENYLIST`, else `~/.config/unic/nda-denylist.txt`, one term per line, `#` for comments. A denylist that names the client is itself the leak, so it is never committed anywhere.

| Guard                                          | Covers                                                                                                                                                                                   | Wired by                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `.claude/hooks/block-nda-terms.mjs`            | What an agent session runs here: `gh`, `glab`, `git push`, `git commit`, `git tag`. It reads the command string, **every file the command names** and, for a commit, **the staged diff** | `.claude/settings.json`, `PreToolUse` on `Bash` — already committed, nothing to install |
| `.githooks/pre-commit`, `.githooks/commit-msg` | Any commit in this clone, whoever makes it: the staged diff, then the message                                                                                                            | `core.hooksPath`, which `pnpm install` sets (see above)                                 |

Two leak paths make the file and diff reads compulsory rather than thorough: `gh issue create --body-file <path>` carries no term in the command at all, and `git commit -m "<clean message>"` puts it in the diff rather than the message. A guard that scans only the command line waves both through.

**When you commit through `git -C`, `cd` or another directory, write the path literally.** The Claude hook reads the staged diff of the session's directory and of every directory the command names: `cd <path>` or `pushd <path>`, `git -C <path>`, `--work-tree` or `--git-dir`, and `GIT_DIR=` or `GIT_WORK_TREE=`. A path may be quoted. The hook refuses a commit when one of those diffs cannot be read, so a path in a shell variable such as `-C $WT` is refused. A form missing from that list is not read at all, so add it to `commitDirs` in the hook before you rely on it.

**Both guards apply one matching rule, from `.githooks/nda-match.mjs`.** The git hooks run it with `node`, and the Claude hook imports it. Change the rule there and nowhere else. It works in two steps:

1. It removes base64 data: every `data:…;base64,` URI, and every run of 80 or more base64 characters that holds a digit, which a sha512 hash fills. A short term inside embedded font data identifies nobody, and every Archify diagram embeds a font.
2. It matches a term, ignoring case, only on a word boundary at both ends. A boundary is the edge of the text, any character that is not a letter or digit, a change between letter and digit, or a camelCase change. So `acme`, `acme-site`, `acme_site`, `acme2026`, `acmeSite`, `myAcme` and `ACMESite` all match `acme`.

The rule lets two shapes through, so check a text for them yourself before it goes public. The first is a term inside a longer word with no case change, such as `acmesite` or `Acmesite`. The second is a term inside a run of 80 or more base64 characters that holds a digit, with no `.`, `-`, `_`, `?` or space in it.

**Describe no client in public, whether or not it is under an NDA.** Write no word that tells a reader which client a piece of work is for: no sector, city, site or product name, and no example drawn from one. That also applies when the example appears in a warning about identifying a client, where it is easiest to write. The term list carries such descriptors as well as names, so the guards refuse them. A paraphrase the list does not hold still passes, so read every public text for it before you send.

**Both fail closed.** With no readable term list, a publishing command is refused and the message names the file to create. `touch` that file to opt out deliberately — an empty list allows everything. The git hooks also refuse a commit when `node` is not on `PATH`. This is the opposite of the `git-guardrails` defect described below, where a missing `jq` makes the hook exit 0 and read as a successful block.

What neither guard covers: `--no-verify` skips the git hooks; the Claude hook sees `Bash` only, so a publish through an MCP tool is unguarded; and an Archon workflow node inherits no ambient settings, so a Box almost certainly runs without it. Measure that before dispatching a Box that could publish.

Bugs are not a separate prefix: a `bug` issue that targets `develop` uses `feature/` (the prefix encodes PR topology, not change kind). Archon-dispatched branches add a scope sub-namespace: `feature/<scope>/<issue#>-<slug>`, where `<scope>` is the area label with its tier stripped (`app:unic-pr-review` → `unic-pr-review`, `repo` → `repo`). The `/archon-rollout` command owns the full derivation rule.

## Release flow

To ship a new plugin version:

1. On a feature branch, add the change to the plugin's `CHANGELOG.md` under `## [Unreleased]`, and commit it with the change. `pnpm bump` refuses an `[Unreleased]` section that holds only `- (none)`, and it refuses a working tree with uncommitted changes.
2. Bump the version: `pnpm --filter <name> bump <patch|minor|major>`. The bump turns the `[Unreleased]` entries into a dated `## [X.Y.Z] — YYYY-MM-DD` section and does not commit. Commit its result on its own, as `chore(<name>): release X.Y.Z`.
3. Open a PR targeting `develop`. CI runs `verify:changelog` on all PRs — it will fail if the changelog entry is missing or malformed.
4. After the PR merges to `develop`, open a release PR from `develop` → `main`.
5. After the release PR merges, the release workflow on `main` detects that `<name>@<version>` has no tag yet and creates it automatically.

**CI summary:**

| Event             | Root checks | Package tests        | `verify:changelog` |
| ----------------- | ----------- | -------------------- | ------------------ |
| PR (any branch)   | ✓           | ✓ (changed packages) | ✓                  |
| Push to `develop` | ✓           | ✓ (changed packages) | —                  |
| Push to `main`    | ✓           | ✓ (changed packages) | —                  |

## Marketplace ingest

Every push to `main` publishes a card for every plugin in the root `.claude-plugin/marketplace.json` to the Unic AI Artefact Marketplace, source `unic-agents-plugins`. `.github/workflows/marketplace-ingest.yml` maps the catalogue with `ci/map-to-envelope.mjs` and posts it to the public ingest sidecar. The mapper kind is `unic-agents`, because this is a Claude-plugin monorepo. The full documentation is [Push your catalog](https://vp.unic.com/docs/#/marketplace/), which needs a VP login. Run it by hand to see the envelope:

```sh
node ci/map-to-envelope.mjs unic-agents . > body.json
```

**Read that output, never POST it.** Off CI the mapper resolves `commit`, `ref` and `author` to empty strings, because it reads them from the CI environment. Posting such an envelope is how this repository's six cards got a version history with a blank author in the first place, and VP cannot repair one afterwards. The local Python tool now refuses a push it cannot attribute ([UNICGRAPH-572](https://uniccom.atlassian.net/browse/UNICGRAPH-572)), but that guard lives in that tool: neither this mapper nor the ingest endpoint will stop you. Only the workflow may push.

A push sends the **full set**. VP diffs it and soft-removes any artefact the push omits, so never narrow the set to the plugins that changed.

**Both files are upstream templates, copied verbatim.** Never hand-edit them and never reformat them. To update either one, re-copy it from its VP URL — [`map-to-envelope.mjs`](https://vp.unic.com/docs/marketplace/templates/map-to-envelope.mjs) and [`pipeline-github-action.yml`](https://vp.unic.com/docs/marketplace/templates/pipeline-github-action.yml). Both answer `401` without a signed-in VP session, so a person must fetch them; an agent cannot. The documentation warns twice that a hand-built envelope is how `provenance.author` goes missing, and this repository's six cards already carry an empty author from one such push on 10 June 2026. The same warning covers the artefact `content` block, which does not apply here: `mapUnicAgents` emits no `content` for any plugin, because plugins are `pointer` artefacts obtainable via `/plugin install`.

`biome.json` excludes `ci/map-to-envelope.mjs` so that rule can hold: Biome reports two errors on the vendored mapper and reformats it. Keep the exclusion, and keep it scoped to that one path. A mapper reformatted to repo style makes the next re-copy read as a diff, and a directory-wide `!ci` would silently un-check any file added to `ci/` later.

The mapper resolves `provenance.author` to `GITHUB_ACTOR`, the person who triggered the run, not the commit author. That is wrong on a merge-commit repository like this one, and it is filed upstream as [UNICGRAPH-575](https://uniccom.atlassian.net/browse/UNICGRAPH-575). **Do not patch it here.** A local fix would hide the defect instead of surfacing it.

The ingest token lives only as the repository secret `MARKETPLACE_INGEST_TOKEN` (Settings → Secrets and variables → Actions). It never goes into a file, a commit or an agent conversation. The token also decides which marketplace the push lands in — the request body cannot name another source.

## Feature-driven development

New work enters through the issue tracker as Features. Plan with `/wayfinder` when the work is too big for one agent session, or `/grill-with-docs` when it fits in one; then `/to-spec` → `/to-tickets` → `/archon-rollout`. `/to-tickets` iterates the breakdown with you and applies `ready-for-agent` once you approve it — that in-session approval is the checkpoint, and nothing re-checks it before dispatch. So keep the ready queue short: grill late, dispatch soon, and re-grill a ticket that has sat for more than a few days rather than trusting it. Use `/tdd` and `/implement` for individual issues. See [`docs/process/ai-development.md`](docs/process/ai-development.md) for the mental model.

`unic-archon-dlc` is **not** installed here — this repo builds it, it does not run it. See [ADR-0033](docs/adr/0033-de-dogfood-unic-archon-dlc.md).

### Acceptance criteria are prose

**This repo's product is prose** — commands, skills, `AGENTS.md` files, ADRs. So a criterion names an **observable outcome**: what a document must state, checked by reading it. It does not name a command carrying its pasted output, and no `file:line` citation inside a criterion is binding — the next merge moves the line, so a criterion written around one rots on a schedule nobody controls.

**Adding a module plus a test so that prose becomes testable is a defect**, not rigour. `unic-archon-dlc`'s `lib/slopcheck.mjs` was the worked example: it existed only to be tested, while `apps/claude-code/unic-archon-dlc/.archon/workflows/unic-dlc-build.yaml` inlines its own copy and imports nothing. #381 deleted it with the whole of that plugin's `lib/` and `test/`, which is what the next passage is the bar for.

Four reads catch what a criterion-by-criterion pass cannot. Run them while writing the criteria, inside `/to-tickets`, because nothing downstream runs them for you:

- **Read the criteria as one set.** Individually reasonable criteria can be collectively impossible, and the dangerous shape is a **gap** between two of them that an implementer fills with a defensible-sounding decision — a green PR that faithfully implements the wrong thing. Amend the ticket and re-dispatch; do not merge it, because it becomes the precedent the next agent reads.
- **Turn the diagnosis on the cure.** When a ticket says a thing rots because it is written by hand, read the fix back and ask what is still written by hand.
- **Ask which criteria an implementer satisfies by changing nothing.** A vacuous criterion is a finding. It reads as coverage, buys none, and costs an audit round to discover after the code exists.
- **Close a grilling by listing what it did not decide.** "Either is acceptable" and "whichever fits" are where an unanswered question hides. Write each one down as an open question, or decide it there.

## Do not add

- External runtime deps to plugins unless truly essential (`auto-format` has zero; that's the bar)
- Turborepo or other build orchestrators — plain pnpm workspaces is the current choice
- Features not tracked in the issue tracker — open a Feature first
- Per-plugin `pnpm-lock.yaml` files — the root lockfile is canonical; sub-package lockfiles should never be committed

## LICENSE files

**Never create, copy, or delete `LICENSE` files.** The maintainer manages these manually in every package and plugin directory. If an acceptance criterion requires a `LICENSE` file to exist, warn the maintainer to add it themselves before continuing.

## Skill summary

#### The quality bar for a prose Box

A Box is prose, so its bar is **a run and a read**, never a test. Three parts:

1. **It runs where it ships.** Install the plugin into a Consumer through the marketplace — no `node_modules`, no hand-set environment variable — and run the Box far enough to see the step under review succeed. This is the only check that sees what this repository cannot: every command defect of `unic-archon-dlc` 0.22.0 was invisible to `pnpm test` and to `archon workflow list` here, and visible on the first command run in `DXP-DesignSystem`.
2. **Its rules are stated where they are needed.** A rule that lives only in an `AGENTS.md` is invisible at run time, so every prompt that must honour a rule carries it inline. Read for those rules when you touch a Box, and again in review.
3. **What it depends on is written once.** One list, in prose, with no mirror and no generator — because a mirror is what drifts, and a generator is the module this bar exists to avoid.

What the bar gives up, plainly:

- **A `git add -A`, or a repository derived from a remote URL, now merges green if nobody reads the diff.** `test/box-staging-and-repo-pinning.test.mjs` grepped every Box YAML for both patterns; #381 deleted it and **nothing replaces it**. Both patterns are visible on the page, and both rules are stated inline in every prompt that stages a path or names a repository. That is the whole guard, and an unread diff defeats it.
- **An upstream rename is not caught in this repository.** `test/command-methods.test.mjs` was the tripwire for a Method upstream had renamed; it compared two hand-written surfaces here and never watched upstream, so it could not have caught the rename wave it was written for. Nothing replaces it either, but the moment of the check is now named rather than left to chance: **upgrading a vendored Method Bundle means diffing the vendored tree against the new upstream tag by hand, in the same commit that moves the pin.** The plugin version is the pin. Between two upgrades, a rename surfaces on the next Consumer run.

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
- [orchestrator-and-wayfinder.md](docs/agents/orchestrator-and-wayfinder.md) — who plans and who dispatches; why the orchestrator is a session, not an agent
- [agent-tool-traps.md](docs/agents/agent-tool-traps.md) — measured traps in the tools this repo uses, and the shapes in which a session's claims go wrong
- [dispatching-and-learning.md](docs/agents/dispatching-and-learning.md) — writing a session opener, when to rewrite it, and where a worker's learnings go. **Read its § Route each learning by its lifetime before writing project memory.** Project memory stays on one machine, so every entry names a `destination:` in git and moves there at the next handoff

### Who owns which files

| Path                                                                                        | Owner        | Rule                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/<vendored name>`, and the `.agents/skills/<name>` a symlink there points to | `npx skills` | **Never hand-edit.** Every `npx skills add` overwrites the directory; edits die silently. `skills-lock.json` says which names are vendored   |
| `.claude/skills/{archon,new-plugin,verify-spec}`                                            | This repo    | Real directories, repo-authored. `npx skills` does not manage them — never remove them while pruning vendored skills                         |
| `skills-lock.json`                                                                          | `npx skills` | Never hand-edit — the hashes are computed                                                                                                    |
| `docs/agents/*.md`                                                                          | This repo    | Hand-maintained, no generator. Do **not** run `/setup-matt-pocock-skills`: it reverts `triage-labels.md` to a five-role `wontfix` vocabulary |

### Upgrading

This repo vendors skills from the sources in the table below. Every one goes through `npx skills` and is tracked in `skills-lock.json`.

| Source              | What comes from it                                 | Selection policy                                                                                                               |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `mattpocock/skills` | The agent-skill driver — most of `.claude/skills/` | All of `skills/engineering/` and `skills/productivity/`, `skills/misc/` by explicit justification, never `skills/in-progress/` |
| `cursor/plugins`    | `unslop` only                                      | By name, one skill at a time. Nothing is taken from this source wholesale                                                      |
| `tt-a1i/archify`    | `archify` and `archify-review`                     | By name. Nothing else is taken from this source                                                                                |

`unslop` cuts AI tells from prose. It is vendored here because this repo's product is prose, and because the maintainer's output style and user `CLAUDE.md` both tell a session to read it. Its frontmatter sets `disable-model-invocation: true`, so an agent reads the file rather than invoking the skill. Take nothing else from `cursor/plugins` without deciding it the same way.

`archify` renders the diagrams under `apps/<agent>/<plugin>/docs/architecture/` from their source JSON, and `archify-review` is its maintenance companion. They are vendored so every session and worktree can regenerate a diagram without a per-machine install ([#569](https://github.com/unic/unic-agents-plugins/issues/569)).

**The same skill name can exist at user scope and at project scope, and the user copy wins.** Claude Code resolves a name clash enterprise over personal, and personal over project, so a session in this repo runs the maintainer's `~/.claude/skills/unslop/`, not the copy vendored here. The vendored copy is what a teammate without it reads. The two can drift, and nothing reports it. When you upgrade one, diff the other. A plugin skill never enters this clash: it is namespaced as `/plugin-name:skill-name` and loads alongside.

Two `mattpocock/skills` entries the policy needs to name explicitly:

- **`misc/git-guardrails-claude-code`** is the one `misc/` entry installed. Justification: it is the only vendored skill that installs a repo-local safety hook, so it belongs where the repo is. Read the caveat below before wiring it up.
- **`setup-matt-pocock-skills` stays installed but must never run.** It is the reference `docs/agents/*.md` was hand-authored from, which is why it is kept. A run reverts `docs/agents/triage-labels.md` to the five-role `wontfix` vocabulary. Four installed skills tell an agent to invoke it when a tracker or label mapping looks missing — `triage`, `wayfinder`, `to-spec`, `to-tickets`. Those files exist and are correct here, so that condition is never met: if a skill asks for them, read `docs/agents/`, do not run the setup skill.

```sh
npx skills@latest add mattpocock/skills -a claude-code -y -s <name> -s <name> …
npx skills@latest add cursor/plugins -a claude-code -y -s unslop
npx skills@latest add tt-a1i/archify -a claude-code -y -s archify -s archify-review
npx skills@latest remove -s <name> -s <name> … -a claude-code -y
```

Add `-l` to any `add` command to list the source's catalogue and install nothing. Use it to check a source before you take from it.

#### Two vendoring shapes, and how they arose

Most vendored skills are a plain `.claude/skills/<name>/` directory. `archify` and `archify-review` are a `.agents/skills/<name>/` directory plus a `.claude/skills/<name>` symlink to it, because that is what `npx skills` wrote when they were added on 2026-09-25. `skills-lock.json` carries a hash for every vendored skill in either shape.

**Claude Code discovers project skills only under `.claude/skills/`** ([skills documentation](https://code.claude.com/docs/en/skills)), so in the second shape the symlink is what loads the skill. Commit the directory and the symlink together. A checkout that writes symlinks as plain files gets a short text file in place of the skill, and the skill does not load there. On Windows that is the default unless the clone was made with symlinks enabled; [CONTRIBUTING.md § Cloning on Windows](CONTRIBUTING.md#cloning-on-windows) says how. CI does not catch a broken link, because its Windows job runs plugin logic, not the vendored skills.

The shape has changed before. Until 2026-09-21 the `mattpocock/skills` entries were a `.agents/skills/<name>/` directory plus a `.claude/skills/<name>` symlink, while `unslop` was already a plain directory. An ordinary `npx skills add` of the 26 tracked names rewrote all of them as plain directories in one run, reported each as `copied`, and left the whole `.agents/skills/` tree orphaned. **The CLI picks the shape, not you**, and it can change the shape of skills already installed. So read the installed tree after an upgrade rather than before, and never convert a shape by hand.

Three traps the CLI sets:

- **Target `-a claude-code`, never `-a '*'`.** The wildcard installs a second, frontmatter-rewritten copy of every skill into a top-level `agent/skills/` tree for foreign agents, which then drifts from the one under `.claude/skills/`. `remove` rejects `-a '*'` outright.
- **`-s` takes repeated flags, not a comma list.** `-s a,b,c` reports "no matching skills found" and exits 0. In zsh, `for n in $names` does not split on newlines either, so a list built that way collapses into one bogus name and the CLI prints its catalogue instead of installing.
- **`remove` left the source directory behind under the old shape.** Whether it now cleans the plain `.claude/skills/<name>/` directory is unverified here. Run `git status` after a removal and delete what it leaves.

Upstream renames and deletes skills between releases, and nothing prunes. After upgrading, diff the installed set against the upstream tree (`add -l`) and remove what no longer exists there. Do this per source: a `cursor/plugins` listing says nothing about what `mattpocock/skills` still ships.

`docs/adr/0032-label-taxonomy.md` and `docs/adr/0033-de-dogfood-unic-archon-dlc.md` still name `.agents/skills/**` as the upstream-owned tree. They record the decision as it was taken and are left as written; the path they cite is now `.claude/skills/<name>/`, and the rule that upstream owns it is unchanged.

### Vendored hook caveat: `git-guardrails-claude-code` needs `jq`

`.agents/skills/git-guardrails-claude-code/scripts/block-dangerous-git.sh` reads its `PreToolUse` payload with `jq` and does not check that the read worked. Without `jq` on the hook runner's `PATH` it exits 0 — which the hook protocol means as **allow** — so a `git push --force` passes while the transcript looks identical to a successful block. Its own verification step tests only the matching-command path, so installing it appears to confirm protection that is conditional on `jq`.

Before wiring this hook into `.claude/settings.json`, confirm `jq` resolves for the hook runner, then test the negative path: pipe a payload in with `jq` off the `PATH` and expect a **non-zero** exit. The fix belongs upstream — `.agents/skills/**` is never hand-edited here, so a local patch dies on the next `npx skills add`.
