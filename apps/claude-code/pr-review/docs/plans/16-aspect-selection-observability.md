# 16. Aspect-selection observability — extract to pure JS

- Priority: P2
- Effort: S
- Version impact: patch (observability addition + refactor; no aspect-selection rule change beyond adding `type-design-analyzer` extension filter)
- Depends on: 12
- Touches: `commands/review-pr.md`, new `scripts/aspect-selection.mjs`, new `tests/aspect-selection.test.mjs`, `docs/plans/README.md`, `CHANGELOG.md`

## Context

The 2026-05-14 dry-run launched only 3 review-aspect agents (`code-reviewer`, `silent-failure-hunter`, `pr-test-analyzer`) for a PR that included new C# types and new doc-comment changes. `comment-analyzer` and `type-design-analyzer` were skipped without any rationale shown to the user. Two problems:

1. **Observability gap.** The user could not tell which aspects ran or why. After the fact, reading the orchestrator source revealed the heuristics, but during the run there was no signal.
2. **Possibly missed coverage.** `type-design-analyzer` arguably should have run — the PR introduced new `AnalyticsViewModel`, `SendUserInteractionEvent` types and a swagger contract. The current heuristic ("if new types were introduced") is prose-encoded in `review-pr.md` with no concrete detection rule.

The selection logic is currently inlined in `commands/review-pr.md`'s "Aspect-filter selection" block. That makes it untested, undocumented, and indistinguishable from prompt instructions to the LLM. Extracting it to a pure-JS helper (`scripts/aspect-selection.mjs`) makes the rules testable and uniform across pre-PR / dry-run / first-review / re-review modes.

**Boundary preserved:** the selection rules in `pr-review` make only *file-pattern* claims about which `pr-review-toolkit:*` agents to invoke. They never encode semantic claims about what those agents detect. This preserves ADR 0008's soft-dependency invariant: if `pr-review-toolkit` updates an aspect to flag new behaviour, our selection layer does not need to change.

## Current behaviour

- The "Aspect-filter selection (used in Step 6 and Pre-PR Step D)" block in `commands/review-pr.md` reads: *Always run `code-reviewer` and `silent-failure-hunter`. Also run `pr-test-analyzer` if test files changed, `comment-analyzer` if docs/comments were added, and `type-design-analyzer` if new types were introduced.*
- "Test files", "docs/comments", "new types" are interpreted by the LLM. No deterministic rule. No printed rationale.
- The user sees `3 background agents launched` (or 5, etc.) but not *which* and *why*.

## Target behaviour

- `scripts/aspect-selection.mjs` exports a pure function `selectAspects({ changedFiles, aspectFilter })` returning `[{ agent, selected: boolean, reason: string }]`.
- `changedFiles` is the array shape already produced in Step 5 — newline-split entries like `edit: /src/foo.ts`.
- `aspectFilter` accepts the same values as today: `'code' | 'errors' | 'tests' | 'comments' | 'types' | 'all'` (default `'all'`).
- Rules (file-pattern only, no diff semantics):
  - `code-reviewer` → always selected. Reason: `"always-on"`.
  - `silent-failure-hunter` → always selected. Reason: `"always-on"`.
  - `pr-test-analyzer` → selected when any changed file path matches `\.(test|spec)\.(m?js|ts|tsx)$` OR contains `/tests?/` OR contains `/__tests__/` OR ends in `_test.go`. Reason: `"test files changed: <count>"`.
  - `comment-analyzer` → selected when any changed file is markdown (`.md`) OR is a JSDoc-relevant source (`.ts | .tsx | .js | .mjs | .cs | .java | .py`). Reason: `"<count> source files with potential comments/docs"`. (Heuristic: docs/comment edits happen inside any source file; we cannot detect "added a comment" without parsing diffs, but flagging source-file edits is the right file-pattern level.)
  - `type-design-analyzer` → selected when any changed file extension is in `.ts | .tsx | .cs | .py | .rs | .go`. Reason: `"<count> typed-language files changed"`. **No semantic regex** — explicitly excluded per ADR 0008 soft-dependency boundary.
- Aspect filter override: if `aspectFilter` is set to a single aspect (e.g. `'tests'`), only that aspect (plus the two always-on aspects) is selected, regardless of file patterns.
- Before launching agents in Step 6, the orchestrator prints:

  ```
  Launching review aspects:
    ✓ code-reviewer       (always-on)
    ✓ silent-failure-hunter (always-on)
    ✓ pr-test-analyzer    (test files changed: 3)
    ✗ comment-analyzer    (skipped — 0 source files with potential comments/docs)
    ✓ type-design-analyzer (2 typed-language files changed)
  ```

- Pre-PR Step D and dry-run mode also use `selectAspects` and print the same block.

## Affected files

| File | Change |
|---|---|
| `scripts/aspect-selection.mjs` | New file. `// @ts-check` header, ESM. Exports `selectAspects` and the constant `ASPECT_AGENT_NAMES` (used to map agent → subagent_type when launching). |
| `tests/aspect-selection.test.mjs` | New file. `node:test` cases for: empty `changedFiles` (only always-on selected); test-file detection across patterns; comment-analyzer extension list; type-design-analyzer extension list; aspect filter override; aspect filter `'all'`; invalid filter (defaults to `'all'`). |
| `commands/review-pr.md` | Replace the "Aspect-filter selection" prose block with a call to `selectAspects(...)` (Node import via `await import`, same pattern as `mode-detection.mjs`). Print the rendered selection block before fan-out in Step 6 and pre-PR Step D. Use the returned array's `selected: true` entries as the launch list. |
| `docs/plans/README.md` | Add row 16. |
| `CHANGELOG.md` | `### Added` entry: *Review aspect selection is now printed before fan-out (which aspects ran, which were skipped, and why). Selection logic is extracted to a tested pure helper.* |

No ADR — refactor with observability addition, not a new architectural decision. The boundary-preservation rationale (no semantic claims) is a restatement of ADR 0008's existing invariant.

## Implementation steps

### 1. Create `scripts/aspect-selection.mjs`

```js
// @ts-check
/** @typedef {'code-reviewer'|'silent-failure-hunter'|'pr-test-analyzer'|'comment-analyzer'|'type-design-analyzer'} AspectAgent */
/** @typedef {{ agent: AspectAgent, selected: boolean, reason: string }} AspectDecision */

export const ASPECT_AGENT_NAMES = [
  'code-reviewer',
  'silent-failure-hunter',
  'pr-test-analyzer',
  'comment-analyzer',
  'type-design-analyzer',
]

const TEST_PATTERNS = [
  /\.(test|spec)\.(m?js|ts|tsx)$/,
  /\/__tests__\//,
  /\/tests?\//,
  /_test\.go$/,
]

const COMMENT_EXTS = ['.md', '.ts', '.tsx', '.js', '.mjs', '.cs', '.java', '.py']
const TYPED_EXTS = ['.ts', '.tsx', '.cs', '.py', '.rs', '.go']

export function selectAspects({ changedFiles, aspectFilter = 'all' }) { /* ... */ }
```

Implementation: split `changedFiles` strings on the first `: ` to extract paths; apply each rule; honour `aspectFilter` override.

### 2. Create `tests/aspect-selection.test.mjs`

Mirror `tests/parse-diff-hunks.test.mjs` style. Cases listed in "Target behaviour" above.

### 3. Update `commands/review-pr.md`

Replace the "Aspect-filter selection" block. New version:

```markdown
### Aspect-filter selection (used in Step 6 and Pre-PR Step D)

Parse `$ARGUMENTS` for an aspect filter (`code` | `errors` | `tests` | `comments` | `types` | `all`); default `all`.

Compute the selection via `scripts/aspect-selection.mjs`:

  Via `await import`, call `selectAspects({ changedFiles: CHANGED_FILES_ARRAY, aspectFilter: ASPECT_FILTER })`.

Print the rendered selection block (✓/✗ per agent with reason) to the Claude interface. Launch every agent whose `selected: true` entry corresponds to a `pr-review-toolkit:<name>` subagent.
```

### 4. Update READMEs and CHANGELOG

- `docs/plans/README.md`: add row 16.
- `CHANGELOG.md`: `### Added` entry as described.

## Verification

- Run pre-PR mode on a branch with only `.cs` changes → `type-design-analyzer` selected; `pr-test-analyzer` skipped with reason "no test files changed: 0".
- Run on a branch with `.md` changes → `comment-analyzer` selected with reason citing source-file count.
- Run with `--dry-run` flag on a PR with test files → printed selection block appears; selection deterministic across runs.
- Run with `aspects=tests` → only `code-reviewer`, `silent-failure-hunter`, `pr-test-analyzer` selected; others skipped with reason `"filtered out by aspects=tests"`.
- `pnpm --filter pr-review test`: new aspect-selection test cases pass on Linux/macOS/Windows.

## Acceptance criteria

- [ ] `scripts/aspect-selection.mjs` exists with `selectAspects` and `ASPECT_AGENT_NAMES`.
- [ ] `selectAspects` makes only file-pattern claims (no diff content parsing).
- [ ] `type-design-analyzer` is selected by extension only (no semantic regex).
- [ ] Orchestrator prints the selection block before fan-out in both Step 6 and pre-PR Step D.
- [ ] Tests cover empty input, each rule, filter override, and `'all'` filter.
- [ ] Tests skip on no-`az`-needed (pure JS, OS-independent).
- [ ] CHANGELOG `[Unreleased]` has an `Added` entry.

## Out of scope

- Adding new Review Aspect agents to `pr-review-toolkit`. The selection rules accommodate today's aspects only.
- Diff-content-based selection (e.g. "added a `class` declaration"). Explicitly out per ADR 0008 soft-dependency boundary — would encode toolkit-agent semantics in our plugin.
- A per-PR aspect override (e.g. `aspects=code,types`). Today's single-aspect filter is sufficient; comma-separated lists are a future enhancement.
