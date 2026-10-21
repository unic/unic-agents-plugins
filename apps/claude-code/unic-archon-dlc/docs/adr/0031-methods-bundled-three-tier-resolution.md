# 0031. Methods are bundled in the plugin; the plugin version is the pin; resolution is one path

**Status:** Accepted (2026-08-03, revised 2026-10-21)

The filename keeps the word three-tier because an ADR filename is a stable address. Resolution had three
tiers until #381 retired two of them on 2026-08-20.

## Context

[ADR-0030](0030-harness-hosts-methods.md) makes a Method the owner of procedure, which leaves one
question: how does a Box get hold of the text?

The constraint that decides it is [ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5. An
Archon node runs in a **separate git worktree checkout** and `$CLAUDE_PLUGIN_ROOT` "is not reliably
set inside Archon's `bun`/`uv` script runner". A node therefore cannot read the plugin directory, and
it cannot see uncommitted files in the main working tree either. Whatever a Box reads must be a
**committed file in the Consumer repository**.

A second constraint comes from the upstream tooling: the `skills` CLI has no version flag.
`add https://github.com/mattpocock/skills/tree/v1.1.0` does resolve the tag (38 skills), but
`add mattpocock/skills@v1.1.0` prints the ref and silently installs `main` (41 skills). Any
version-pinning scheme that routes through that CLI is unpinned in practice.

Grilled with the maintainer on 2026-07-31 (see #279); the mechanism was pinned before implementation
in #284.

The first version of this ADR resolved a Method through three tiers, in a module, `resolveMethod`: a
`config` tier (`methods.<name>.source` in the config), a `local` tier (`.archon/methods.local/<name>/SKILL.md`)
and the bundle. A Local Method declared the bundle version it forked from in `forked_from` frontmatter. Two
modules, `verifyLicence` and `verifyBundle`, checked the bundle against a pinned licence hash and a manifest
of every file. The plugin went to zero code in #381, and those modules went with it. The tiers had only ever
worked in the command half: an Archon node cannot import plugin `lib/`, so `resolveMethod` never reached
inside a Box, and the Archon Boxes read the single literal path from the day they shipped. Measured against
a live Consumer on 0.22.0, the command half could not run at all. `$CLAUDE_PLUGIN_ROOT` is unset inside the
Bash tool and an installed plugin ships no `node_modules`, so every Step 1 halted before resolving anything.

Practice Packs now stack in one Consumer beside the DLC
([ADR-0038](0038-practice-packs-stack-by-prefix.md)). That raised again whether anything other than the DLC
may write a Method.

## Decision

### 1. The Methods are vendored in the plugin, and the plugin version is the pin

`vendor/mattpocock-skills/` holds the upstream files at a pinned tag, in upstream's
`skills/<category>/<name>/` layout. `vendor/mattpocock-skills/README.md` records the upstream repository, tag
and commit.

**There is no `skills.pin` config key.** The plugin version _is_ the pin: upgrading Methods means
upgrading the plugin and re-running `/setup`. A separate pin would let a Consumer's config and the
shipped bundle disagree, with no way to detect it.

Fetch with `git clone --depth 1 --branch <tag>`, never `npx skills`. See the Context above.

### 2. A Method resolves at one path

Every Box and every command reads a Method at the literal path `.archon/methods/<name>/SKILL.md`. There is
no resolution order and no tier line to print. The `config` tier, the `local` tier and the `forked_from`
convention are retired. `/setup` reports a `.archon/methods.local/` directory or a `methods.<name>.source`
key it finds as retired, and changes neither.

A team that wants different Method text edits `.archon/methods/<name>/SKILL.md` in its own repository and
expects the next `/setup` run to overwrite it. That loses an override that used to survive upgrades. It is
accepted because no Consumer ever declared one.

### 3. The DLC alone writes `.archon/methods/`, and a Practice Pack never ships a Method

A Practice Pack ships context artefacts and config values only
([ADR-0038](0038-practice-packs-stack-by-prefix.md) §1 and §2). So `/setup`'s wholesale replace of the tree
removes nothing a pack wrote. A skill a pack installs under `.claude/skills/` is a context artefact, not a
Method, even when a node names it in `skills:` (ADR-0038 §3). The retired tiers do not come back as a way
for a pack to change a Method.

A pack that must replace a Box step uses an `include:` slot, decided and not built. ADR-0038 §7 records it,
with the rule that one slot holds one occupant and that a collision never resolves silently.

### 4. Methods are read by path and never registered as skills

A Box reads a Method as a file. The plugin never installs Methods into `.claude/skills/` or
`.agents/skills/`, and never invokes one as a skill.

Two reasons. A Consumer running Matt's own Claude Code plugin would otherwise end up with **every
skill twice**, with no way to tell which copy answered. And 7 of the 10 Methods carried
`disable-model-invocation: true` at v1.0 while `prototype` flipped back at v1.1, so invocation is a
coupling that keeps changing, and reading a path is not.

### 5. Integrity is checked by reading

`/setup`'s install step reads the bundle before it installs anything. Every Method directory must carry its
`SKILL.md` and the companion files that Method reads, and `LICENSE` must be present. Either failure stops
setup: both mean the shipped plugin is incomplete, which no Consumer action fixes. A missing `LICENSE` asks
the maintainer to restore it and is never created automatically, per the repository's LICENSE policy.

`/setup` replaces `.archon/methods/` wholesale rather than merging, so a Method dropped from a later bundle
cannot linger on disk.

The pinned licence hash and the manifest closure check were the only automated check for an upstream rename
wave, the failure §1 exists to prevent. Nothing replaces them inside this repository, because nothing here
can see upstream. A rename wave is now found by running a Box against a live Consumer, which is where every
command defect of the 0.22.0 line was found.

## Considered options

**Per-box mapping, rejected.** Each Box names its own Method path in its own prose or its own config
block. This is the pre-#279 status quo: the same name in three files with nothing tying them together,
which is what let the v1.1.0 rename wave break `/specs` and `/tickets` with CI green
([ADR-0030](0030-harness-hosts-methods.md) Context). It also makes the dependency list unanswerable:
you would have to read every Box to learn what the plugin depends on. Recorded here because it is the
obvious-looking design and will otherwise be proposed again.

**Fetching Methods at run time, rejected.** A Box could clone or download the skill at the pinned tag
on demand. That adds a network dependency to every AFK run, breaks reproducibility for a Consumer
behind a proxy, and reintroduces the CLI's silent-`main` trap if it routes through `npx skills`.

**A `skills.pin` config key, rejected.** See §1: it lets config and the shipped bundle disagree
undetectably.

**Three-tier resolution, retired on 2026-08-20 (#381).** See the Context. It existed only in the command
half, so deleting it made the commands and the Boxes agree.

## Consequences

- Upgrading Methods is a plugin upgrade plus a `/setup` re-run. `/setup`'s install step runs even for an
  already-configured project, so an upgrade lands the new bundle without a reconfigure.
- `.archon/methods/` is generated. It is committed because Archon nodes need it (see Context), and `/setup`
  replaces it wholesale, so a hand edit lasts until the next run.
- A team fork of a Method costs an edit that the next `/setup` overwrites. No override survives an upgrade.
