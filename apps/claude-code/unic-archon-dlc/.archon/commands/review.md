---
description: "Multi-aspect code review: code quality, test coverage, silent failures, and type design. Self-contained — no external plugins required."
argument-hint: "<branch-name | pr-url>"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Agent
---

# Code Review: $ARGUMENTS

Perform a comprehensive multi-aspect code review of the target: **$ARGUMENTS**

If a branch name is provided, compare against the default branch. If a PR URL is provided, fetch the diff using `gh pr diff`.

---

## Section 1: Code Quality

Review the changed files for:

- **Correctness**: Logic errors, off-by-one, null dereferences, unhandled edge cases
- **Simplicity**: Functions doing too much, premature abstraction, unnecessary complexity
- **Naming**: Descriptive names, consistent terminology with domain vocabulary in CONTEXT.md
- **Error handling**: All error paths explicit, no swallowed errors, structured error returns
- **Cross-platform**: No shell assumptions, uses `node:path`/`node:fs`/`node:os` instead of bash

**Verdict**: `Pass` / `Needs Work` / `Fail`

---

## Section 2: Test Coverage

Review test files for:

- **Coverage breadth**: Happy path, error cases, edge cases, boundary conditions all tested
- **Test quality**: Tests assert behaviour, not implementation; no testing internals
- **Isolation**: Tests use temp directories, not shared state; no side effects between tests
- **Nyquist compliance**: Every acceptance criterion has at least one test asserting it

**Verdict**: `Pass` / `Needs Work` / `Fail`

---

## Section 3: Silent Failures

Review error handling for:

- **Catch blocks**: No empty catch, no `catch (e) { return false }` masking real errors
- **Fallback behaviour**: Fallbacks are intentional and documented, not accidental silencing
- **Process exits**: `process.exit` calls are at boundaries only, not inside library functions
- **SpawnSync errors**: `result.error` checked alongside `result.status !== 0`

**Verdict**: `Pass` / `Needs Work` / `Fail`

---

## Section 4: Type Design

Review type definitions and usage for:

- **Discriminated unions**: Error/success types use `ok: true/false` discriminants
- **JSDoc accuracy**: `@typedef` and `@param` types match actual runtime shapes
- **No `any`**: No use of `any` type without explicit justification
- **Invariant expression**: Types capture constraints (e.g. non-empty strings, valid enum values)

**Verdict**: `Pass` / `Needs Work` / `Fail`

---

## Summary

| Aspect | Verdict |
|--------|---------|
| Code Quality | (verdict) |
| Test Coverage | (verdict) |
| Silent Failures | (verdict) |
| Type Design | (verdict) |

**Overall**: `Pass` / `Needs Work` / `Fail`

List any blocking issues (Fail items) and recommended improvements (Needs Work items).
