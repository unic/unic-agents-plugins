# 0036. `/setup` owns a named install set; a Box workflow retires by name, never by header

**Status:** Accepted (2026-08-12); records the design after amending #294's acceptance criteria,
which replaced the header-gated implementation PR #333 shipped; amended 2026-08-14 — D1's "one
declared install set" is one shared engine rather than one declared list, and the record file the
Consequences defer to #295 is not built (#295); amended 2026-08-20 — every install function named
below is deleted while every decision it held is unchanged (#381); amended 2026-08-25 — the plugin
directory is found by a registry lookup, the header is one line on each installed Box and none on a
Method, the install set gains a sixth action, and a step is named by its job rather than its number (#383)

> **Amended (2026-08-14):** two corrections, both recorded while implementing
> [#295](https://github.com/unic/unic-agents-plugins/issues/295). Neither changes a decision; each
> narrows a sentence that claims more than the merged code does. `CONTEXT.md`'s **Install set** and
> **Generated header** entries already state both — read those first; this amendment only says which
> wording here they correct.
>
> **D1's "one declared install set" is one shared engine, not one declared list.** `installArtefacts`
> is the single tree-install function, and that much holds. What does not is the implication that some
> one place declares the whole set: two callers build entries and call it independently —
> `installMethods` (`lib/methods-bundle.mjs`) and `installBoxWorkflows` (`lib/artefact-install.mjs`) —
> and `/setup`'s config step writes `.archon/unic-dlc.config.yaml` with a bare `writeFileSync`, outside the
> engine altogether. Nothing iterates a declared set, and unifying the callers into one is not planned
> (#295's out-of-scope list). See `CONTEXT.md` § **Install set**.
>
> **The record file the Consequences above defer to #295 is not built.** Per-file provenance is the
> generated header (`renderGeneratedHeader`), whose first line names the Plugin and the version that
> wrote the file — so the "install provenance" #295 was left to carry already existed on disk when that
> issue came to be implemented. #295 therefore widens what the install already computes and discards:
> `installArtefacts` returns the `added` paths, `installBoxWorkflows` returns the `previousVersion` it
> reads from the header before the write loop, and `/setup` Step 8 prints both. No
> `.archon/unic-dlc.install.json`, no hash, no timestamp — a hash is what hand-edit detection would
> need, and that is a separate question whose baseline is `git diff` over the committed Box YAMLs (D4
> above). See `CONTEXT.md` § **Generated header**.

> **Amended (2026-08-20) — the rules stand, the module does not.**
>
> `lib/artefact-install.mjs` and `lib/methods-bundle.mjs` are deleted with the rest of `lib/`, so every
> `installArtefacts` / `installMethods` / `installBoxWorkflows` reference below names a function that no
> longer exists. **Every decision this ADR records is unchanged** — the install set is name-scoped, the
> stale sweep retires a `unic-dlc-*.yaml` whether or not it carries the generated header, a name outside
> that pattern is never read, and the set is discovered from the directory rather than listed by hand.
> `/setup`'s install step now states those rules in prose and the agent applies them with its own tools.
>
> One rule this ADR relied on the module for is now the operator's: `/setup` must locate the Plugin's own
> installed directory before it can copy anything out of it, because `$CLAUDE_PLUGIN_ROOT` is not set
> inside the Bash tool. The preflight finds the directory and stops rather than guessing. #383 settles the
> mechanism.

> **Amended (2026-08-25) — the mechanism is a registry lookup, and the header is one line (#383).**
>
> **Locating this Plugin's own directory.** Claude Code keeps `~/.claude/plugins/installed_plugins.json`,
> which records `installPath`, `version`, `scope` and — for a project-scope install — the `projectPath`
> the entry belongs to. `/setup` reads that file, picks the entry matching this repository, takes
> `installPath`, and verifies the directory before copying: the manifest there names this Plugin at the
> registry's version, `vendor/mattpocock-skills/` is present, and `.archon/workflows/` holds at least one
> `unic-dlc-*.yaml`. It stops, printing what it found, on a missing entry, a registry `version` other than
> `2`, or a failed check. The registry entry agreeing with the manifest is the whole version test: the
> command file carries no version of its own, so there is nothing else to compare it against, and a rule
> that asked for one would send an agent looking for a version to invent.
>
> The interim prose it replaces searched `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` and
> asked the operator to confirm. That directory holds **one entry per version ever installed** — nine of
> them for this Plugin on the machine where this was measured, of which one was installed — so the search
> was a guess among candidates and the confirmation existed to cover the guess. The registry names the
> answer, so no confirmation is needed on the happy path.
>
> **The generated header is one comment line on each installed Box**, naming this Plugin and the version
> that wrote it and stating that `/setup` replaces the file. `renderGeneratedHeader` is deleted, so
> `/setup` writes it, and reads it back as `PREVIOUS_VERSION` by matching a **prefix of the first line**
> — never a search over the whole body, per D3.
>
> **No Method file carries a header.** The bundle is upstream text pinned to one tag, and a line added at
> the top forks it from that tag — the same fork that a Consumer's formatter caused on `DXP-DesignSystem`.
> D3's "every installed file's header" therefore reads: every installed **Box**. The bundle's provenance is
> its tag, reported in the summary.
>
> **The install set gains a sixth action, and it is why the fork above cannot recur.** `/setup` excludes
> both installed trees, and every file whose name carries `.generated.`, from whatever this project uses to
> format or lint — found by reading the project, never from a list of tools held in the Plugin. Where that
> tool's exclusion mechanism cannot carry a comment marker, `/setup` prints the entry the operator must add
> and reports it as an open item.
>
> **Name a `/setup` step by the job it does, never by its number.** #383 reordered the command — the install
> moved ahead of the config conversation — and the two numbers swapped rather than shifted, so each stale
> reference resolved to a real but opposite step and stopped no reader. Every live reference in this ADR was
> rewritten here on 2026-08-25. The numbers that remain sit in § Context and in the dated amendments, where
> they record what was true on the day they were written; a live claim carries none.

## Context

Nothing installed the Box workflow YAMLs into a Consumer project. `commands/setup.md` wrote the
config (Step 5), the Methods bundle (Step 6) and the `CLAUDE.md` marker block (Step 7); the only
mention of `.archon/workflows/` or `.archon/commands/` was an aside. `README.md`'s own Quick start
Step 2 taught `/unic-dlc-explore my-feature`, an invocation surface that does not exist — the real
one is `archon workflow run <name> "<slug>"`.

The evidence for clean-replace was historical, not live: at commit `39080fb` (2026-08-05, pre-#298),
the repo-root `.archon/workflows/` held four Boxes hand-seeded at `8869684` and already retired —
`unic-dlc-{cleanup,plan,review,triage}.yaml` — sitting runnable for two and a half months across
three redesigns, next to `unic-dlc-pr-review.yaml`, which existed and had never once been installed.
#298 deleted all seven (this monorepo is a Consumer of nothing — [root ADR-0033](../../../../../docs/adr/0033-de-dogfood-unic-archon-dlc.md)),
so the defect is not currently observable in this repo, but the failure mode it demonstrates —
a retired Box still runnable a long time after retirement — is exactly what clean-replace exists to
close.

### The first attempt, and why it was wrong

PR #333 generalised `installMethods`'s clean-replace logic, stamped a generated header on every
installed Box YAML, and gated the stale-sweep on that header: a file was swept only if it both
matched the naming and carried the header. CI was green on nine checks; every test passed. The
criteria at the time did not say _how_ ownership was decided, so the implementation was faithful to
underspecified criteria and still produced the wrong behaviour, in both directions:

- The four Boxes hand-seeded at `8869684` carry no header — they predate this feature — so a
  header-gated sweep leaves them runnable. That is this issue's motivating case, unfixed.
- The README already commits to an escape hatch: a team wanting a variant of a bundled Box copies it
  to a name outside the `unic-dlc-*` set, where name-scoped install never reaches it. A copy made the
  documented way — by copying an _installed_ YAML — carries the header. Header-gating deletes it,
  breaking the one guarantee the escape hatch depends on.

The acceptance criteria also contradicted each other: one forbade a Box name as a literal anywhere in
`lib/`, a test fixture, `README.md` or this ADR (the discovery rule below); another required the
guarding test's set to "not shrink" and be "repointed in place," which is only satisfiable by keeping
those literals. An implementer had to violate one to satisfy the other. The 2026-08-12 amendment
replaced both with the single rule this ADR records: **ownership is decided by name, never by
contents, and the guarded set is derived from what the plugin ships, never enumerated.**

Grilled together with #295 (install provenance) and #296 (Step 7 ownership) under stream #315,
because all three answer one question — what `/setup` owns and how it replaces it.

## Decision

### D1 — One declared install set, entry-typed by directory ownership

`lib/artefact-install.mjs` exposes one tree-install function, `installArtefacts`. Every entry names a
plugin-relative source, a Consumer-relative destination, and whether it **owns its whole destination
directory**. `.archon/methods/` is the only entry that sets that flag: it is entirely
Plugin-owned, so `installMethods` (`lib/methods-bundle.mjs`) builds one directory entry and calls
`installArtefacts`, unchanged in behaviour and still covered by its own pre-existing tests.

### D2 — Box YAMLs only, discovered — never listed. The stubs move out of `.archon/`

`/setup` installs every `unic-dlc-*.yaml` this Plugin ships, discovered by reading this Plugin's own
`.archon/workflows/` **at install time** (`discoverBoxWorkflowEntry`). No Box name is a literal in
`lib/`, in a test fixture, in `README.md`, or here — the set is whatever the directory holds, so a
Box added to or retired from the Plugin changes what installs with no code change anywhere in this
path. `test/box-staging-and-repo-pinning.test.mjs`'s guarded set is derived the same way, replacing
the hand-maintained "does not shrink" literal list that PR #333's own test carried.

`/setup` writes nothing into `.archon/commands/`. Every Box command doc moves to
[`docs/boxes/`](../boxes/) as operator documentation — read in this Plugin's own repo, never
installed into a Consumer. `.archon/commands/` keeps only its `.gitkeep`. Each doc's invocation is
`archon workflow run <name> "<slug>"`; none mentions `--input`, which is not a real flag.

### D3 — Clean-replace **by name**, never by directory and never by header; overwrite silently

`.archon/workflows/` is not Plugin-owned the way `.archon/methods/` is — it is shared with the
Consumer's own workflows, so a directory-level clean-replace there would delete unrelated files on
the first `/setup` run. Install is **name-scoped** instead: only names matching the `unic-dlc-*`
naming are ever written, overwritten, or swept as stale (`BOX_WORKFLOW_NAME_PATTERN` in
`lib/artefact-install.mjs`). A name outside that pattern is never even read, whatever it contains.

The stale sweep deletes a name-scoped match the current install set no longer ships **regardless of
whether it carries the generated header** — ownership is decided by name alone. Header-gating is
the mistake this ADR retires: see Context above for why it fails in both directions. Where the header
is read at all (`hasGeneratedHeader`), it is matched as a prefix of the first line, never as a
substring search over the whole body — a Consumer file that merely mentions the marker text further
down is not the same thing as a file this engine wrote.

A file that cannot be read during the sweep is reported in a `skipped` list, never silently dropped,
and the install reports failure rather than success while a Box it meant to retire might still be on
disk (`stage: 'stale-sweep'` in `installArtefacts`'s result). One error is forgiven, precisely:
`ENOENT` **from the deletion**. A name that is absent is not "still on disk" — it is already in the
end state the sweep wanted — so it is neither a failure nor a deletion the sweep performed, and it
appears in neither list. `ENOENT` from the **read** is forgiven by nobody, because it is not proof of
absence: a dangling symlink reads `ENOENT` while its directory entry is still listed and still stale.
The deletion is therefore what concludes absence; the read stays a strict probe for every other
failure. For the same reason `rm` is called with `force: false` — `force: true` would swallow the
`ENOENT` inside `rm`, and the sweep would then report a `deleted` path it never deleted.

Overwrite silently rather than warn or refuse: refusing would break the upgrade path (`/setup`'s install
step runs even when `STATE = 'full'`, precisely so a plugin upgrade lands with no reconfigure), and
warn-then-stop leaves a half-installed tree either way. Every installed **Box** carries a header naming the
Plugin and its version and stating that `/setup` replaces it — that is what makes the overwrite
legible: an operator's edit is a tracked `git diff` after `/setup`, not a warning dialog. No Method file
carries one, per the 2026-08-25 amendment above.

**No `.archon/workflows.local/` override tier.** A Method has an override tier because a team
legitimately owns _procedure_ ([ADR-0030](0030-harness-hosts-methods.md),
[ADR-0032](0032-box-method-vocabulary.md)). A Box YAML is the Harness — isolation, gates, red/green
integrity — and "Consumer-side opt-out flags for individual Boxes" is already on this Plugin's
Do-not-add list ([ADR-0014](0014-workflow-per-box-decomposition.md)). The escape hatch that already
exists costs nothing: copy the YAML to a name outside the `unic-dlc-*` set, where name-scoped
replacement never reaches — D3's own rule is what makes that copy survive every future `/setup` run,
including one that carries the generated header.

### D4 — Committed, and ADR-0031's worktree argument does not transfer

The installed Box YAMLs are committed, generated files — but the reason is not the one
[ADR-0031](0031-methods-bundled-three-tier-resolution.md) gives for Methods. Probed, not assumed: in a
scratch repo with an untracked `.archon/workflows/probe.yaml`, `archon workflow list` discovers and
lists it. Archon reads a workflow definition from the filesystem at the dispatch `cwd`, in the main
checkout — never from inside a node's isolated worktree. ADR-0031's argument ("an Archon node runs in
a separate worktree checkout, therefore the file must be committed so the node can see it") does not
apply here: a Box YAML is read before any node or worktree exists, to decide what to run in the first
place. Methods are worktree-bound; a Box YAML is not.

The reasons that do hold:

1. **Archon's own doctrine.** `.archon/{commands,workflows,scripts}/` "should be committed"
   (`references/repo-init.md`). Only `.archon/state/` and `.archon/.env` are gitignored.
2. **Consistency inside the install set.** `.archon/unic-dlc.config.yaml` and `.archon/methods/` are
   already committed and _are_ read inside the worktree by every Box's `bootstrap` node. Committing
   some generated entries and ignoring others breaks the one rule that makes the set reviewable.
3. **The review surface.** A Plugin upgrade changes what an AFK run does to the repo. An ignored file
   gives that change no diff and no reviewer — [#295](https://github.com/unic/unic-agents-plugins/issues/295)
   (install provenance) depends on this.
4. A fresh clone can dispatch a Box without first installing this Claude Code plugin.

## Consequences

- `installMethods` keeps its exact signature and every existing test unmodified, now delegating to
  `installArtefacts`'s directory-entry path.
- Adding or retiring a Box changes what `/setup` installs and what
  `test/box-staging-and-repo-pinning.test.mjs` guards, with no edit to either file — both derive their
  set from `.archon/workflows/` on disk.
- No document in this Plugin states a Box count or a stub count: counting the set would contradict
  the reason it is discovered at install time rather than enumerated. The `CHANGELOG.md` entry for
  this change does not claim a Consumer workflow is untouched "regardless of its name" — a currently
  shipped name is always overwritten; only a name outside the `unic-dlc-*` set is untouched.
- Provenance, upgrade reporting and drift detection stay [#295](https://github.com/unic/unic-agents-plugins/issues/295)'s
  scope; the managed block's content and its ownership claim stay [#296](https://github.com/unic/unic-agents-plugins/issues/296)'s.
  This ADR covers only what and how `/setup` installs.
