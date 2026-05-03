# 17. Fix inbox command ls collision check for cross-platform support

**Priority:** P2
**Effort:** XS
**Version impact:** none
**Depends on:** —
**Touches:** `.claude/commands/inbox.md`

## Context

The repo mandates that all tooling works on macOS, Windows, and Linux. Step 2 of the inbox capture command uses `ls <path> 2>/dev/null` to detect slug collisions. Both `ls` and the `2>/dev/null` redirect are POSIX-only and break on Windows. The `$(git rev-parse --show-toplevel)` shell substitution inside the same snippet also relies on bash syntax, which is unavailable in cmd.exe environments.

## Current behaviour

Step 2 of `.claude/commands/inbox.md` reads:

```bash
ls "$(git rev-parse --show-toplevel)/docs/inbox/<slug>.md" 2>/dev/null
```

This fails on Windows because:
- `ls` is not a native Windows command
- `2>/dev/null` is POSIX-only redirect syntax
- `$(…)` command substitution is not valid in cmd.exe

## Target behaviour

Step 2 uses a cross-platform Node.js snippet. Node resolves the git root internally (no shell substitution), uses `path.join` for OS-correct separators, and checks existence with `fs.existsSync`. Exit code semantics are preserved: `0` = file exists (collision), non-zero = free.

The `allowed-tools` header stays `[Write, Bash]` — no new tool permissions are needed.

## Affected files

| File                           | Change                                      |
| ------------------------------ | ------------------------------------------- |
| `.claude/commands/inbox.md`    | Modify — replace Step 2 code block only     |

## Implementation steps

1. In `.claude/commands/inbox.md`, replace the code block in **Step 2** (lines 31–33):

   **Before:**
   ```bash
   ls "$(git rev-parse --show-toplevel)/docs/inbox/<slug>.md" 2>/dev/null
   ```

   **After:**
   ```bash
   node -e "
     const root = require('child_process').execSync('git rev-parse --show-toplevel').toString().trim();
     const p = require('path').join(root, 'docs', 'inbox', '<slug>.md');
     process.exit(require('fs').existsSync(p) ? 0 : 1);
   "
   ```

   No other changes to the file.

2. Commit:

   ```sh
   git commit -m "fix(inbox): replace shell ls collision check with cross-platform Node.js"
   ```

## Verification

- Open `.claude/commands/inbox.md` and confirm the Step 2 code block contains `node -e` with no `ls`, no `2>/dev/null`, and no `$(…)` shell substitution.
- Run `/inbox test cross-platform fix` in a Claude Code session and confirm it creates `docs/inbox/test-cross-platform-fix.md` without errors.
- Run `/inbox test cross-platform fix` a second time and confirm the file is created as `docs/inbox/test-cross-platform-fix-2.md` (collision handling works).
- Clean up: delete both test files.

## Acceptance criteria

- [ ] `.claude/commands/inbox.md` Step 2 uses `node -e` with `execSync`, `path.join`, and `fs.existsSync`
- [ ] No `ls`, `2>/dev/null`, or `$(…)` in the file
- [ ] `allowed-tools` remains `[Write, Bash]`
- [ ] Collision detection still appends `-2`, `-3`, etc. when a slug already exists

## Out of scope

- Updating the inbox skill or any other command files
- Changing how Step 3 resolves the repo root (standalone `git rev-parse` is cross-platform)
