# Context — spec-01: Normalize Claude Code signature

## Source

Spec file: `docs/plans/01-normalize-signature.md`
Version impact: **patch**
Effort: **XS**
Depends on: spec-00 (done)

## Original request summary

Normalize the signature emitted by the `review-pr` command so that:

1. All runtime-emitted signatures use asterisk italics (`*…*`), not underscore italics (`_…_`)
2. Every runtime-emitted signature includes `— Iteration {LATEST_ITERATION_ID}` suffix
3. The Notes section documents both the detection prefix and the full form

## File to change

`commands/review-pr.md` — total 317 lines

## Signature occurrences (pre-change)

| Line | Current value                                            | Action                                                   |
| ---- | -------------------------------------------------------- | -------------------------------------------------------- |
| 201  | `🤖 *Reviewed by Claude Code*` (in JSON inline comment)  | Add `— Iteration {LATEST_ITERATION_ID}`                  |
| 245  | `🤖 *Reviewed by Claude Code*` (in JSON summary comment) | Add `— Iteration {LATEST_ITERATION_ID}`                  |
| 286  | `🤖 _Reviewed by Claude Code_` (doc example, underscore) | Change to `🤖 *Reviewed by Claude Code* — Iteration {N}` |
| 305  | `🤖 *Reviewed by Claude Code*` (Notes/spec reference)    | Keep as-is (this is the prefix reference)                |

## Constants to define

Near the top of the command, define:

- `SIGNATURE_PREFIX` = `🤖 *Reviewed by Claude Code*`
- `SIGNATURE` = `🤖 *Reviewed by Claude Code* — Iteration {LATEST_ITERATION_ID}` (resolved at post time)

Note: `LATEST_ITERATION_ID` is NOT currently defined in the file — it references `iterationId=1` hardcoded in API calls. The spec says the constant should be resolved "at post time". The command is a markdown instruction file for Claude; constants are defined as markdown variables or in a setup section. We need to look at how the file structures its constants and follow that pattern.

## Acceptance criteria (from spec)

- All runtime-emitted signatures are byte-identical in structure
- The Notes section documents both the prefix and the full form
- No underscore-italics signature remains anywhere in the file

## Verification commands (from spec)

```sh
grep -nF '🤖 *Reviewed by Claude Code*' commands/review-pr.md   # must match every signature location
grep -nF '🤖 _Reviewed by Claude Code_' commands/review-pr.md   # must print 0 matches
```

After change, all runtime locations must include `— Iteration`.

## Repo patterns

- This is a Claude Code skill/command file (markdown), not runnable code
- Variables are referenced as `{VARIABLE_NAME}` in the markdown
- No build step — edit the markdown directly
- Verification: pnpm -w check (Biome + Prettier at workspace root)
- Commit: `feat(spec-01): normalize Claude Code signature (vX.Y.Z)`
