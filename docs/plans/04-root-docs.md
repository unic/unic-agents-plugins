# 04. Root Documentation and Process Templates

**Priority:** P2
**Effort:** S
**Version impact:** none
**Depends on:** 03
**Touches:** `docs/process/`, `CLAUDE.md`, `CONTRIBUTING.md`, `AGENTS.md`

## Context

`docs/process/` templates don't exist yet — new plugin authors have no canonical reference for the spec format or the Ralph loop pattern. This spec creates them. Root docs (`AGENTS.md`, `CONTRIBUTING.md`) are already accurate after the seed was manually consolidated; only the `docs/process/` reference in `CONTRIBUTING.md` needs a minor fix.

Note: `CLAUDE.md` is a symlink to `AGENTS.md` (created manually before this spec ran). Do not edit `CLAUDE.md` directly — edit `AGENTS.md`.

## Current behaviour

- `docs/process/` does not exist
- `CONTRIBUTING.md` contains a stale reference to "coming in spec 05" for `docs/process/`
- `AGENTS.md` (and its symlink `CLAUDE.md`) is accurate and requires no changes

## Target behaviour

- `docs/process/spec-template.md` — canonical empty spec template with all required sections
- `docs/process/ralph-loop-guide.md` — concise guide explaining the Ralph loop pattern
- `CONTRIBUTING.md` reference to `docs/process/` updated (remove "coming in spec 05")

## Affected files

| File | Change |
|---|---|
| `docs/process/spec-template.md` | Create |
| `docs/process/ralph-loop-guide.md` | Create |
| `CONTRIBUTING.md` | Modify — remove stale "coming in spec 05" note |

## Implementation steps

1. Create `docs/process/spec-template.md`:

   ```markdown
   # NN. Title

   **Priority:** P0 | P1 | P2
   **Effort:** XS | S | M | L
   **Version impact:** none | patch (plugin: <name>) | minor (plugin: <name>) | major (plugin: <name>)
   **Depends on:** (spec numbers, or "none")
   **Touches:** (comma-separated list of files/dirs)

   ## Context

   _Why this change is needed._

   ## Current behaviour

   _Exact code snapshots or behaviour **before** the change. Ralph uses this to verify the starting state._

   ## Target behaviour

   _What the code/behaviour should look like **after**._

   ## Affected files

   | File | Change |
   |---|---|
   | `path/to/file` | Create / Modify / Delete |

   ## Implementation steps

   1. _Numbered steps with exact before → after diffs or code to write. No ambiguity._

   ## Verification

   _Shell commands to run and their expected output._

   ## Acceptance criteria

   - [ ] _Checkbox item_

   ## Out of scope

   - _Explicit list of things NOT to change in this spec._
   ```

2. Create `docs/process/ralph-loop-guide.md` — a concise guide (under 300 words) explaining:
   - What `ralph.yml` and `PROMPT.md` do in each plugin/package
   - How to start a loop: `pnpm ralph` from the relevant directory
   - How to stop and resume
   - How a paused loop (`## Questions` + `LOOP_COMPLETE`) is handled
   - The single-spec-per-iteration discipline

3. In `CONTRIBUTING.md`, find the line referencing `docs/process/` with "(coming in spec 05)" and remove that parenthetical — the directory now exists.

4. Run `pnpm check` to verify all new `.md` files are Prettier-compliant.

## Verification

```sh
pnpm check                  # exits 0
ls docs/process/             # lists spec-template.md and ralph-loop-guide.md
ls -la CLAUDE.md             # shows symlink → AGENTS.md
```

## Acceptance criteria

- [ ] `docs/process/spec-template.md` exists with all required section headers
- [ ] `docs/process/ralph-loop-guide.md` exists and is under 300 words
- [ ] `CONTRIBUTING.md` no longer has the "coming in spec 05" note
- [ ] `CLAUDE.md` is a symlink to `AGENTS.md` (pre-existing; verify, do not recreate)
- [ ] `pnpm check` passes

## Out of scope

- Editing `CLAUDE.md` directly (it is a symlink — edit `AGENTS.md` instead)
- Changing any functional code
- Adding process docs for individual plugins (they inherit from this)
