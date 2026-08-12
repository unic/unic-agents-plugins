# Unic Agents Plugins — Monorepo Context

A pnpm workspace monorepo for developing and releasing AI agent extensions built at Unic. This context covers vocabulary that cuts across all plugins in the repo.

## Language

**Plugin**:
An agent extension that ships as a bundle of commands, hooks, agents, and/or skills. Agent-agnostic — a Plugin may target Claude Code, GitHub Copilot, or any other agent runtime.
_Avoid_: extension, add-on, integration

**Claude Code Plugin**:
A Plugin that targets the Claude Code runtime and ships as a `.claude-plugin` bundle.
_Avoid_: Claude plugin (ambiguous), Claude extension

**Workspace Package**:
An internal shared library under `packages/` that supports Plugin development. Not user-facing; never installed by a Consumer.
_Avoid_: package (too generic), library, module

**Release**:
A versioned, tagged snapshot of a single Plugin, published when a Release Train reaches `main`. Per-Plugin — each Plugin carries its own version and its own `<plugin>@<version>` tag.
_Avoid_: deploy, publish, version bump

**Release Train**:
The monorepo-wide event that cuts zero or more Releases together, carried on a dated `release/YYYY-MM-DD` branch. Identified by its date and never by a version, because the Plugins aboard bump to different ones.
_Avoid_: release (a Release is per-Plugin), release cut, batch, train

**Change Note**:
A file recording one change and how it should be released, written by the pull request that makes the change and consumed by the next Release Train. A Plugin's Change Note declares a semver level; a repository-level one declares none, because nothing there is versioned.
_Avoid_: changeset, changelog entry, news fragment

**Feature**:
A self-contained unit of work, tracked as a spec Issue on the GitHub tracker with one child Issue per ticket. A Feature that keeps a durable markdown artefact set also has a `docs/issues/<slug>/` directory, created by hand — no skill generates one. The atomic input to the Feature Runner.
_Avoid_: ticket (a ticket is one Issue within a Feature), epic, story

**Feature Runner**:
Whatever implements a Feature's Issues end-to-end in one worktree, branch, and pull request. Two run here: a developer driving `/tdd` or `/implement`, and `/archon-rollout` dispatching the native `archon-fix-github-issue` workflow per Issue. Not `unic-dlc-build` — that Box ships to Consumers and does not run against this monorepo ([ADR-0033](docs/adr/0033-de-dogfood-unic-archon-dlc.md)).
_Avoid_: issue runner, queue runner

**Consumer**:
A repository that installs and uses a Plugin. External to this monorepo.
_Avoid_: client, user repo, target repo, host repo

## Relationships

- A **Plugin** belongs to one agent ecosystem (e.g., Claude Code) and has zero or more **Releases**
- A **Release Train** carries zero or more **Releases** and consumes every pending **Change Note**
- A **Change Note** belongs to exactly one **Plugin**, or to the repository as a whole
- A **Claude Code Plugin** is a **Plugin** — the inverse is not always true
- A **Workspace Package** supports **Plugin** development but is not itself a **Plugin**
- A **Feature** drives one **Feature Runner** execution
- A **Consumer** installs one or more **Plugins**

## Example dialogue

> **Dev:** "Should we cut a Release for all Plugins when we bump a Workspace Package?"
> **Domain expert:** "No — a Release is per-Plugin, and Workspace Packages have none. The Release Train still runs; it just carries the repository's Change Notes and no Releases."

> **Dev:** "My PR touches two Plugins. One Change Note or two?"
> **Domain expert:** "Two. They are two release decisions — the same change can be a patch in one Plugin and a minor in the other."

> **Dev:** "A Consumer reported the auto-format Plugin failing on Windows."
> **Domain expert:** "That's a cross-platform gap. Plugins must use Node.js APIs — no shell commands or POSIX paths."
