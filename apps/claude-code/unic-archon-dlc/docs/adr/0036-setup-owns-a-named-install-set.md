# 0036. `/setup` owns a named install set

**Status:** Accepted (2026-08-12)

## Context

`/setup` never wrote the Box workflow YAMLs into a Consumer project (#294). `commands/setup.md`
writes the config (Step 5), the Methods bundle (Step 6) and the `CLAUDE.md` marker block (Step 7);
nothing writes `.archon/workflows/` or `.archon/commands/`. No Consumer could run `/build`, `/qa`,
`/pr-review` or `/explore`.

Filed alongside #295 (install provenance) and #296 (Step 7's ownership claim) under stream #315 — the
three are one defect class, `/setup` misrepresenting what it owns, and settle it in one place rather
than three.

Two things the investigation ruled out:

1. **A directory-level clean-replace.** `installMethods` opens by wiping `.archon/methods/` whole
   (`lib/methods-bundle.mjs`), safe only because that tree is entirely plugin-owned. `.archon/workflows/`
   is not: Archon's own repo-init doctrine tells every Consumer to author workflows there too
   (`.claude/skills/archon/references/repo-init.md`), and a repo file at that path is the documented way
   to override a bundled Archon default. Generalising the wipe would delete a Consumer's own work on the
   first `/setup` run.
2. **Installing the four `.archon/commands/*.md` stubs.** None of the Box YAMLs has a `command:` node —
   Archon resolves `.archon/commands/*.md` only from `command:` nodes
   (`.claude/skills/archon/references/authoring-commands.md`). Installing the stubs would place four
   unreachable prompt templates where `archon validate commands` and the web UI's node palette would
   list them as though they were live.

A third finding narrows what justifies committing the artefacts. [ADR-0031](0031-methods-bundled-three-tier-resolution.md)'s
"an Archon node runs in a separate git worktree checkout, so whatever it reads must be committed" was
written for Methods, read by a node from inside its own worktree. A Box workflow YAML is not read that
way: `archon workflow list`/`archon workflow run` read it from the dispatch `cwd`. Probed in a scratch
git repo with an untracked `.archon/workflows/probe.yaml` (`git status` showed `?? .archon/`) —
`archon workflow list` discovered and listed it anyway. ADR-0031's worktree argument does not apply to a
Box YAML; §D4 below gives the reasons that do.

## Decision

### D1 — `/setup` owns one declared install set

Everything `/setup` writes is one list: the Box YAMLs, the Methods tree, the config, the install
record (#295), and the `CLAUDE.md` block (#296). Each entry names its plugin-relative source, its
Consumer-relative destination, and whether it owns its whole destination directory.
`lib/artefact-install.mjs` exposes the one function that walks that list — `installArtefacts` — used
today by both `installMethods` (whole-dir) and the Box-workflow install `commands/setup.md` Step 6 runs
(name-scoped). #295 and #296 add entries to this same list rather than inventing their own install path.

### D2 — Scope: the Box YAMLs only, discovered not listed; the stubs move out of `.archon/`

`/setup` installs every workflow YAML it finds in the plugin's own `.archon/workflows/`, discovered by
reading that directory at install time (`discoverInstallItems`). No Box name is a literal in `lib/`, in
a test fixture, or in this ADR — the box set is in flux (#276–278 and #282 each add or change one), and
naming names here is the rot #296 exists to stop elsewhere.

`/setup` writes nothing into `.archon/commands/`. The four stubs are operator documentation, not
Archon-reachable artefacts (Context §2), and move to `docs/boxes/` inside the plugin. Adding a
`command:` node to a future Box costs one install-set entry, not a redesign.

### D3 — Clean-replace by name; overwrite silently; no override tier

Because `.archon/workflows/` is not wholly plugin-owned (Context §1), the workflows entry clean-replaces
**by name**, never by directory: a destination file is deleted only when it is (a) not in the current
run's set, and (b) carries the generated header a previous `/setup` run wrote. The header, not a name
pattern, is what proves plugin ownership — a Consumer file that happens to share a name is never at
risk, and a Box retired in a later plugin version is still removed because its old file still carries
the header.

`/setup` overwrites the current set silently rather than warning or refusing. Refusing would strand
every Consumer who edited an installed YAML and then upgraded the plugin — Step 6 already reruns
unconditionally on an upgrade so the Methods bundle lands without a reconfigure, and a Box YAML follows
the same rule. Warn-then-stop is worse than either end state: it leaves a half-installed tree. The
overwrite is legible instead of silent: every installed file's header names the plugin and version and
says `/setup` replaces it, and Step 8 lists every path written and every path deleted.

There is no `.archon/workflows.local/` override tier. A Box is the Harness — isolation, gates, red/green
integrity — not procedure, and "Consumer-side opt-out flags for individual boxes" is already on this
plugin's Do-not-add list ([ADR-0014](0014-workflow-per-box-decomposition.md)). The existing escape hatch
costs nothing: copy the YAML to a name outside the `unic-dlc-*` naming, where name-scoped replacement
never reaches.

Drift **detection** — recording what `/setup` last wrote and reporting what an operator changed — is
#295's mechanism, built on the header this ADR introduces. This ADR does not duplicate it.

### D4 — The artefacts are committed, and ADR-0031's worktree argument is not why

The reasons that hold, in place of the one that doesn't (Context):

1. **Archon's own doctrine.** `.archon/{commands,workflows,scripts}/` "should be committed"
   (`repo-init.md`). Only `.archon/state/` and `.archon/.env` are gitignored.
2. **Consistency inside the install set.** `.archon/unic-dlc.config.yaml` and `.archon/methods/` are
   already committed and _are_ read inside a Box's own worktree at run time. Committing some install-set
   entries and ignoring others breaks the one rule that makes the set reviewable as a whole.
3. **The review surface.** A plugin upgrade changes what an AFK run does to the repo. An ignored
   artefact gives that change no diff and no reviewer — and #295's drift reporting depends on there
   being one.
4. A fresh clone can dispatch a Box without installing a Claude Code plugin first.

## Consequences

- `installMethods` (whole-dir) and the Box-workflow install (name-scoped) share one engine and one
  contract; #295's install record and #296's `CLAUDE.md` block pick whichever rule fits rather than
  inventing a third.
- A Consumer's own file in `.archon/workflows/` is safe regardless of its name — only the header marker
  establishes plugin ownership, so there is no name heuristic to get wrong.
- Adding or retiring a Box costs zero `lib/`, test, or doc changes beyond what ships in the plugin's own
  `.archon/workflows/`; the install set finds out at install time.
- The four Box command docs are demoted from "installed but inert" to documentation: a `docs/boxes/`
  reader gets the same content, no Archon node reads any of it, and `archon validate commands` no longer
  lists four unreachable templates in a Consumer repo.
