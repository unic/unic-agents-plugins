# 0008. Conditional sub-agent spawning over per-file chunking

**Status:** Accepted (2026-05); spawn-gating amended to Y-det hybrid for semantic gates (2026-06, issue #212)

## Context

A PR review needs to cover several aspects (code quality, tests, error handling, security, etc.) without losing cross-file context and without burning tokens on aspects that don't apply to the changed files. We had to choose between splitting work by file or splitting it by review lens, and between running every lens unconditionally or only when relevant.

Two alternatives were considered:

- **Per-file chunking with a single reviewer agent.** Rejected — chunking loses cross-file context (a Finding in `service.ts` often depends on a type defined in `types.ts`), and the orchestration overhead of merging per-file passes into a coherent Review Summary is large.
- **Unconditional fan-out (every aspect agent every Review).** Rejected — most PRs touch only a few aspect categories; running all six aspect agents on every Review (plus the Intent Checker, which always runs first) wastes tokens and produces empty result blocks that clutter the output. Conditional spawning is the same pattern the Anthropic `pr-review-toolkit` uses and we adopt it deliberately.

## Decision

The Plugin reviews a PR by fanning out to specialised Review Aspect sub-agents in parallel, each handling the whole diff under one lens. Spawning is conditional on what the diff contains — `code-reviewer` always runs; `pr-test-analyzer` runs only when test files changed; `silent-failure-hunter` runs when at least one non-test source file changed; etc. At acceptance (2026-05) every gate was a pure path/extension heuristic with no diff-content inspection; the 2026-06 amendment below adds deterministic content sampling for the three semantic gates. The Plugin does NOT split the diff into per-file chunks.

## Consequences

- `scripts/lib/changed-file-analyser.mjs` classifies the diff once and returns the Spawn Set before any agent runs.
- The Intent Checker is the one exception — it always runs first (regardless of file types) because its output seeds every other agent's context. Its result is broadcast to every spawned aspect agent.
- Adding a new Review Aspect is additive: define the agent in `agents/<name>.md`, add one entry to `SPAWN_TABLE` in `changed-file-analyser.mjs` — no orchestration rewrite needed.

### Spawn Table (as of PR #158; rows marked † amended by 2026-06 content-gating — see amendment section below)

| Agent                   | Spawn condition                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `code-reviewer`         | Always — any non-empty diff                                                                           |
| `silent-failure-hunter` | † At least one non-test source file (`.mjs`, `.cjs`, `.js`, `.ts`, `.tsx`, `.jsx`; excluding `.d.ts`) |
| `type-design-analyzer`  | † At least one `.d.ts`, `.ts`, `.tsx`, or file under `types/`, `schemas/`, `interfaces/`              |
| `pr-test-analyzer`      | At least one test file (`.test.*`, `.spec.*`, or under `tests/`, `__tests__/`)                        |
| `comment-analyzer`      | † At least one `.md` / `.mdx` file or file under `docs/`                                              |
| `code-simplifier`       | Three or more non-test source files (excluding `.d.ts`)                                               |

† Path classification is the fast path, not a prerequisite: for these three gates the classifier _also_ spawns when deterministic diff-content sampling detects the gate's semantic pattern even if the path heuristic does not match (e.g. a documentation comment added inside a `.tsx`). Path and content are OR-combined, never AND-narrowed. See the amendment below.

## Content-gated spawning for semantic gates (amended 2026-06, issue #212)

### Context for the amendment

A direct comparison of unic-pr-review v2.1.2 against the `pr-review-toolkit` on PR #5612 revealed that path/extension classification alone causes spawn divergences on three gates: the `comment-analyzer` missed findings when documentation comments were added inside source files (not under `docs/`); the `silent-failure-hunter` over-fired on PRs with no error-handling changes; the `type-design-analyzer` over-fired on PRs that touched `.ts` files but introduced no new types. The toolkit uses semantic (model-read) gate conditions.

Adopting model-assisted gating wholesale (Y-llm) was considered and rejected — it would break the unit-testable, pure-function classifier that is the foundation of the deterministic spawn decision.

### Decision (amendment)

For the three semantic gates — **comment-analyzer** (comments gate), **silent-failure-hunter** (errors gate), and **type-design-analyzer** (types gate) — the classifier additionally reads a small content sample from the diff using **deterministic parsing** (**Y-det**): pure functions over `+`/`-` diff hunks, unit-testable with fixtures, no model calls. Path classification remains the fast path and continues to gate `pr-test-analyzer` and `code-simplifier` without change.

Semantic gates are **biased toward spawning on ambiguity**: a false-positive spawn produces an empty result block (cheap); a false-negative miss silently omits a potentially valid finding set (as seen in the #5612 comparison). When the classifier cannot determine confidently that a gate's semantic condition is absent, it spawns.

### Y-llm promotion caveat

The **errors gate** (`silent-failure-hunter`) is the weakest of the three as a deterministic predicate — "error handling changed" is genuinely semantic and the hardest to capture reliably with regex over diff hunks. It is the **first candidate to promote to Y-llm** (model-assisted gate classification) if Y-det proves too noisy or too blind for that gate in practice.
