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

A direct comparison of unic-pr-review v2.1.2 against the `pr-review-toolkit` on PR #5612 revealed **two opposite kinds** of spawn divergence, because the toolkit gates these aspects on semantic (model-read) conditions while unic gated on path/extension alone:

- **Under-fire (unic spawned _fewer_ than the toolkit):** the `comment-analyzer` missed findings when documentation comments were added inside source files (not under `docs/`) — the path trigger never saw them. This is a silent false-negative: a finding set the toolkit produced and unic did not.
- **Over-fire (unic spawned _more_ than the toolkit):** the `silent-failure-hunter` and `type-design-analyzer` spawned on PRs the toolkit skipped — a source-file edit with no error handling, or a `.ts` touch with no new types. The toolkit's semantic gate narrowed those away; unic's path trigger did not.

These are opposite problems with no common fix: closing the under-fire gap means spawning in _more_ cases, closing the over-fire gap means spawning in _fewer_. This amendment closes the **under-fire** gap only and **deliberately accepts the over-fire** divergence (see Decision). The earlier wording of this ADR implied content sampling would cure the over-firing on the errors/types gates; that was never structurally possible under an additive contract and the claim is corrected here.

Adopting model-assisted gating wholesale (Y-llm) — the mechanism by which the toolkit narrows — was considered and rejected: it would break the unit-testable, pure-function classifier that is the foundation of the deterministic spawn decision.

### Decision (amendment)

For the three semantic gates — **comment-analyzer** (comments gate), **silent-failure-hunter** (errors gate), and **type-design-analyzer** (types gate) — the classifier additionally reads a small content sample from the diff using **deterministic parsing** (**Y-det**): pure functions over `+`/`-` diff hunks, unit-testable with fixtures, no model calls. Path classification remains the fast path and continues to gate `pr-test-analyzer` and `code-simplifier` without change.

**Content sampling is purely additive — path and content are OR-combined, never AND-narrowed.** A gate spawns when its path trigger matches **or** when content sampling detects its semantic pattern; sampling can only _add_ spawns the path trigger missed, never _remove_ one. This is the direct consequence of accepting the over-fire divergence above: narrowing a path trigger would reintroduce the deterministic false-negative the initiative set out to eliminate. unic therefore spawns on a **superset** of the toolkit's cases for the errors and types gates — that over-spawn is the accepted cost, paid in cheap empty result blocks, and is _within_ the PRD's behavioural-parity contract ("approximates" / "additionally adopt"), which does not require spawn-for-spawn equivalence with the toolkit.

Because the contribution is additive, each gate's content sample only changes the outcome where the path trigger is **blind**:

| Gate     | Path trigger (fast path)                              | What content sampling _adds_ (path-blind cases)                                                                                |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| comments | `.md` / `.mdx`, files under `docs/`                   | comment lines added/removed inside **source** files                                                                            |
| errors   | non-test source file                                  | error-handling tokens in **non-source** files (config, fixtures, docs)                                                         |
| types    | `.d.ts` / `.ts` / `.tsx`, `types/schemas/interfaces/` | **JSDoc type constructs** (`@typedef`, `@type`, `@param`/`@returns` types, casts) in **non-`.ts` source** files (`.mjs`/`.js`) |

The types row is the subtle one: TypeScript type _syntax_ (`type X =`, `interface`, `as` casts) exists only in `.ts`/`.tsx`, which the path trigger already covers fully — a content gate keyed on that syntax would add nothing. This codebase writes its types as **JSDoc in `.mjs`** (`// @ts-check` + `@typedef`), which the path trigger is blind to; that is the types gate's entire additive surface (issue #215).

Semantic gates are **biased toward spawning on ambiguity**: a false-positive spawn produces an empty result block (cheap); a false-negative miss silently omits a potentially valid finding set (the #5612 under-fire). When the classifier cannot determine confidently that a gate's semantic pattern is absent, it spawns.

### Y-llm promotion caveat

The **errors gate** (`silent-failure-hunter`) is the weakest of the three as a deterministic predicate — "error handling changed" is genuinely semantic and the hardest to capture reliably with regex over diff hunks. It is the **first candidate to promote to Y-llm** (model-assisted gate classification) if Y-det proves too noisy or too blind for that gate in practice. The live implementation (`hasErrorHandlingChanges` in `changed-file-analyser.mjs`) carries a matching code comment flagging it as the Y-llm promotion candidate; its `\b(?:error|err)\b` arm intentionally over-fires on standalone `error`/`err` identifier uses in non-error-handling contexts (note: `\b` word boundaries prevent matching compound names like `errorMessage` or `errCount`) to honour the spawning bias above.

**Implementation status**: comments gate live as of v2.1.4 (PR #226, issue #213); errors gate live as of v2.1.6 (issue #214); types gate live as of v2.1.7 (PR #235, issue #215).
