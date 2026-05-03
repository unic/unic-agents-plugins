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
A versioned, tagged snapshot of a single Plugin published to `main`. A per-Plugin event — there is no monorepo-wide release.
_Avoid_: deploy, publish, version bump

**Spec**:
A structured markdown file under `docs/plans/` that defines a unit of work with context, target behaviour, and acceptance criteria. The atomic input to the Spec Runner.
_Avoid_: ticket, task, issue, story

**Spec Runner**:
The agent automation that reads Specs and implements them one at a time. Currently backed by `ralph-orchestrator` but the concept is tool-agnostic.
_Avoid_: Ralph, Ralph Orchestrator (tool-specific, not domain terms)

**Consumer**:
A repository that installs and uses a Plugin. External to this monorepo.
_Avoid_: client, user repo, target repo, host repo

## Relationships

- A **Plugin** belongs to one agent ecosystem (e.g., Claude Code) and has zero or more **Releases**
- A **Claude Code Plugin** is a **Plugin** — the inverse is not always true
- A **Workspace Package** supports **Plugin** development but is not itself a **Plugin**
- A **Spec** drives exactly one **Spec Runner** iteration
- A **Consumer** installs one or more **Plugins**

## Example dialogue

> **Dev:** "Should we cut a Release for all Plugins when we bump a Workspace Package?"
> **Domain expert:** "No — a Release is per-Plugin. Workspace Packages don't have their own Releases."

> **Dev:** "A Consumer reported the auto-format Plugin failing on Windows."
> **Domain expert:** "That's a cross-platform gap. Plugins must use Node.js APIs — no shell commands or POSIX paths."

> **Dev:** "Can I use Ralph to implement this Spec?"
> **Domain expert:** "You mean the Spec Runner — Ralph is just the current tool backing it."
