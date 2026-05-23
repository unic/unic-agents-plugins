# AGENTS.md — pr-review

Guidance for any AI agent working inside this Plugin directory. `CLAUDE.md` in this directory is a symlink to this file.

## What this Plugin is

`pr-review` is a Claude Code Plugin in the [`unic-agents-plugins`](../../../AGENTS.md) monorepo. It adds the `/pr-review:review-pr` slash command, which Reviews and Re-reviews Azure DevOps pull requests across multiple Review Aspects in parallel and posts Inline Comments plus a Review Summary back to ADO. See [`CONTEXT.md`](CONTEXT.md) for the domain vocabulary (Platform, Revision, Review, Re-review, Review Aspect, Inline Comment, Review Summary, Review Thread).

## Where to start

Root docs (monorepo-wide conventions live here — pnpm scripts, Gitflow, SemVer, Conventional Commits, code conventions, LICENSE policy, cross-platform requirement):

- [Root AGENTS.md](../../../AGENTS.md) — source of truth for cross-cutting rules
- [Root CONTEXT.md](../../../CONTEXT.md) — monorepo-wide vocabulary (Plugin, Workspace Package, Release, Feature, Consumer)
- [Root CONTEXT-MAP.md](../../../CONTEXT-MAP.md) — index of all bounded contexts in the repo
- [Root docs/adr/](../../../docs/adr/) — monorepo-wide architecture decisions
- [Root docs/process/](../../../docs/process/) — process and workflow guides

This Plugin's own decisions:

- [Plugin docs/adr/](docs/adr/) — Plugin-specific architecture decisions

## Commands

Plugin-specific pnpm scripts (run from this directory or with `pnpm --filter pr-review <script>` from the repo root):

```sh
pnpm test                 # run node:test suite (scripts/ + agents/ coverage)
pnpm bump <patch|minor|major>   # bump plugin.json version + promote CHANGELOG
pnpm sync-version         # mirror plugin.json version into marketplace.json + package.json
pnpm tag                  # create the pr-review@<version> git tag locally
pnpm verify:changelog     # check CHANGELOG entry for the current version
```

Monorepo-wide commands (`pnpm install`, `pnpm check`, `pnpm format`, `pnpm ci:check`) are documented in the [root AGENTS.md](../../../AGENTS.md).

## Layout

```tree
.claude-plugin/           # Plugin manifest (plugin.json) and marketplace listing
commands/                 # Slash command definitions — review-pr.md is the thin orchestrator
agents/                   # Specialised review and ADO-interaction agents
scripts/                  # Pure helpers shared by the command and the agents (ado-fetcher, ado-writer, pre-pr, re-review/*)
tests/                    # node:test suites covering scripts/ and agents/
docs/                     # Plugin-specific documentation
  adr/                    # Plugin Architecture Decision Records
```

## Plugin doctrines

Load-bearing invariants. These either originate in a Plugin ADR or are policy decisions that are not obvious from the code.

- **Canonical bot signature.** Every comment posted to a Platform ends with the exact signature `---\n🤖 *Reviewed by Claude Code* — Iteration N` (where `N` is the Revision id). This wording is load-bearing for signature-based detection. See [ADR-0001](docs/adr/0001-canonical-bot-signature.md).
- **Signature-based prior-Review detection.** The Plugin discovers prior Reviews exclusively via the canonical signature — no metadata fields, no separate state file. See [ADR-0002](docs/adr/0002-signature-based-prior-review-detection.md).
- **Target the latest Revision.** Every Review targets the latest Revision (`LATEST_ITERATION_ID`); `iterationId=1` is never used. See [ADR-0003](docs/adr/0003-target-latest-pr-iteration.md).
- **Incremental diff baseline.** A Re-review computes its baseline from the prior Review's signature, producing an incremental diff rather than re-reviewing the whole PR. See [ADR-0004](docs/adr/0004-incremental-diff-baseline.md).
- **Four-state Review Thread classification.** Each existing Review Thread is classified into one of four states (`addressed`, `disputed`, `pending`, `obsolete`) before any write. See [ADR-0005](docs/adr/0005-four-state-thread-classification.md).
- **Reply, not duplicate; auto-resolve when addressed.** Re-reviews reply to existing Review Threads rather than opening duplicates; threads classified as `addressed` are auto-resolved. See [ADR-0006](docs/adr/0006-reply-not-duplicate-auto-resolve.md).
- **Review Summary is rewritten, not appended.** The Review Summary General Comment is updated in place across Re-reviews; new findings are not appended. See [ADR-0007](docs/adr/0007-summary-rewritten-not-appended.md).
- **Soft dependency on `pr-review-toolkit`.** The command checks for the toolkit Plugin at startup and aborts with installation instructions if missing — there is no bundled copy. See [ADR-0008](docs/adr/0008-soft-dependency-pr-review-toolkit.md).
- **Orchestrator stays thin (≤ 200 lines).** `commands/review-pr.md` delegates all Platform interaction and coordination logic to the agents in `agents/`. See [ADR-0013](docs/adr/0013-orchestrator-split-for-review-pr.md).
- **ADO read/write split.** All read operations go through the ADO Fetcher agent; all write operations go through the ADO Writer agent. The orchestrator never calls `az devops invoke` directly. See [ADR-0016](docs/adr/0016-fold-thread-fetch-into-ado-fetcher.md).
- **Dry-run is a fourth peer mode.** Dry-run sits alongside `review`, `re-review`, and `summary-delta` as a peer Review mode, not a flag on another mode. See [ADR-0017](docs/adr/0017-dry-run-as-fourth-peer-mode.md).

## External dependencies

- **Azure CLI** with the `azure-devops` extension (`az extension add --name azure-devops`), authenticated against the target ADO organisation (`az devops login`). The Plugin shells out via `az devops invoke` for all Platform interaction.
- **`pr-review-toolkit`** Plugin from `anthropics/claude-plugins-official`. Soft dependency — the command checks at startup and aborts with instructions if absent.

## Do not add

- **GitHub or GitLab Platform support before an ADR locks the abstraction.** The vocabulary in [`CONTEXT.md`](CONTEXT.md) is Platform-agnostic, but the implementation today is ADO-only; broadening it without an ADR will leak ADO assumptions into shared code.
- **Vote-on-PR actions** (approve / reject after a Review). Out of scope until requested with a concrete use case.
- **PR description generation from diff.** Out of scope; the Plugin reviews PRs, it does not author them.
- **Inline `az devops invoke` calls in the orchestrator.** All Platform calls go through the ADO Fetcher / ADO Writer agents (see doctrines above).
- **Bypassing the canonical signature** in any comment the Plugin posts. Signature-based detection (ADR-0002) depends on the exact wording from ADR-0001.

## Plugin ADRs

Plugin-specific architecture decisions live in [docs/adr/](docs/adr/).

The per-plugin `docs/plans/` directory (where present) is historical — it captured pre-migration specs and is not the intake path for new work. New work enters through the [issue tracker](../../../docs/agents/issue-tracker.md).
