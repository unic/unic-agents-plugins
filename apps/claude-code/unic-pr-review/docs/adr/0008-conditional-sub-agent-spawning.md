# 0008. Conditional sub-agent spawning over per-file chunking

**Status:** Accepted (2026-05)

## Context

A PR review needs to cover several aspects (code quality, tests, error handling, security, etc.) without losing cross-file context and without burning tokens on aspects that don't apply to the changed files. We had to choose between splitting work by file or splitting it by review lens, and between running every lens unconditionally or only when relevant.

Two alternatives were considered:

- **Per-file chunking with a single reviewer agent.** Rejected — chunking loses cross-file context (a Finding in `service.ts` often depends on a type defined in `types.ts`), and the orchestration overhead of merging per-file passes into a coherent Review Summary is large.
- **Unconditional fan-out (every aspect agent every Review).** Rejected — most PRs touch only a few aspect categories; running all six aspect agents on every Review (plus the Intent Checker, which always runs first) wastes tokens and produces empty result blocks that clutter the output. Conditional spawning is the same pattern the Anthropic `pr-review-toolkit` uses and we adopt it deliberately.

## Decision

The Plugin reviews a PR by fanning out to specialised Review Aspect sub-agents in parallel, each handling the whole diff under one lens. Spawning is conditional on what the diff contains — `code-reviewer` always runs; `pr-test-analyzer` runs only when test files changed; `silent-failure-hunter` only when error handling changed; etc. The Plugin does NOT split the diff into per-file chunks.

## Consequences

- The Plugin needs a changed-file analyser that classifies the diff once and decides which aspect agents to spawn. This decision is made before any agent runs.
- The Intent Checker is the one exception — it always runs first (regardless of file types) because its output seeds every other agent's context. Its result is broadcast to every spawned aspect agent.
- Adding a new Review Aspect is additive: define the agent, write its spawn predicate, no orchestration rewrite needed.
