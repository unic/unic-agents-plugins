# 0031. Methods are bundled in the plugin; the plugin version is the pin; resolution is three-tier

**Status:** Accepted (2026-08-03); amended 2026-08-20. The amendment at the end of § Decision
retires two of the three tiers and the integrity mechanism named in §5. The title keeps the word
three-tier because an ADR filename is a stable address, not a description.

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

## Decision

### 1. The Methods are vendored in the plugin, and the plugin version is the pin

`vendor/mattpocock-skills/` holds the upstream files at a pinned tag, mirroring upstream's
`skills/<category>/<name>/` layout so each manifest entry's `upstreamPath` is load-bearing — an
upstream relocation fails a test instead of silently resolving nothing. Only the manifest's transitive
closure is vendored, sub-files included.

Provenance is the frozen `METHODS_BUNDLE` constant in `lib/methods-manifest.mjs` (repo, tag, commit,
licence, licence sha256), not a file inside the bundle: `/setup` needs the tag and hash
programmatically, a constant typechecks and has no parse-failure branch, and keeping it beside the
manifest forces a re-vendor to touch the file that defines the closure. `vendor/mattpocock-skills/README.md`
is its human mirror and a test asserts the two agree.

**There is no `skills.pin` config key.** The plugin version _is_ the pin: upgrading Methods means
upgrading the plugin and re-running `/setup`. A separate pin would let a Consumer's config and the
shipped bundle disagree, with no way to detect it.

Fetch with `git clone --depth 1 --branch <tag>`, never `npx skills` — see the Context above.

### 2. Three-tier resolution, first hit wins

`resolveMethod(name, …)` in `lib/methods-resolver.mjs` answers with the `SKILL.md` to read and the
tier that answered:

1. **`config`** — `methods.<name>.source` in `.archon/unic-dlc.config.yaml`: the team's own fork.
2. **`local`** — `.archon/methods.local/<name>/SKILL.md`: an uncommitted working override.
3. **`bundle`** — `.archon/methods/<name>/SKILL.md`: the vendored default, written by `/setup`.

The config tier is authoritative **on declaration alone**. If an operator names a path and the file is
missing, resolution fails rather than falling through to the bundle — silently ignoring a declared
override is the failure class this whole design exists to remove.

A Local Method declares which Bundle version it forked from in its own frontmatter
(`forked_from: v1.1.0`), not in config: committed metadata describing an uncommitted file drifts the
moment someone edits the override. A missing `forked_from` is flagged, not skipped.

### 3. Repo-relative paths only

Every resolved path must sit inside the Consumer repository. Absolute paths, Windows drive letters,
UNC prefixes, `~` home references, and `../` or `..\` escapes are all rejected — the last two after
normalising backslashes, so a Windows-style escape is caught on POSIX too. A Method is content the
repository vouches for; reading procedure from outside it would make a Box's behaviour depend on the
operator's home directory.

### 4. Methods are read by path and never registered as skills

A Box reads a Method as a file. The plugin never installs Methods into `.claude/skills/` or
`.agents/skills/`, and never invokes one as a skill.

Two reasons. A Consumer running Matt's own Claude Code plugin would otherwise end up with **every
skill twice**, with no way to tell which copy answered. And 7 of the 10 Methods carried
`disable-model-invocation: true` at v1.0 while `prototype` flipped back at v1.1 — invocation is a
churning coupling surface, path-reading is not.

### 5. Integrity is checked, not assumed

`/setup` runs `verifyLicence` (the vendored `LICENSE` hashed against the pinned tag's) and
`verifyBundle` (every file each manifest entry declares — its `SKILL.md` **and** its `subFiles`)
before installing anything, and stops on either failure: both mean the shipped plugin is incomplete or
altered, which no Consumer action fixes. A missing `LICENSE` asks the maintainer to restore it and is
never auto-created, per the repository's LICENSE policy.

`installMethods` clean-replaces `.archon/methods/` rather than merging, so a Method dropped from a
later manifest cannot linger on disk where the bundle tier would keep resolving it. It never reads or
writes `.archon/methods.local/`.

### Amendment, 2026-08-20 (#381): one tier, and integrity is checked by reading

The plugin went to zero code, so the two mechanisms this ADR named as modules went with it.

**Resolution is one tier.** Every Box and every command reads a Method at the literal path
`.archon/methods/<name>/SKILL.md`. The `config` tier (`methods.<name>.source`) and the `local` tier
(`.archon/methods.local/<name>/SKILL.md`) are retired, with them the resolution order, the tier line a
command printed, and the `forked_from` frontmatter convention. §2 and §3 record what was, not what is.

The reason is the one §2 gave for having tiers at all, read back: an Archon node cannot import plugin
`lib/`, so `resolveMethod` never reached inside a Box, and the Archon Boxes had been reading the single
literal path since they shipped. The tiers therefore existed only in the command half — a resolution
order two of the seven surfaces could not honour. Measured against a live Consumer on 0.22.0, the
command half could not run at all: `$CLAUDE_PLUGIN_ROOT` is unset inside the Bash tool and an installed
plugin ships no `node_modules`, so every Step 1 halted before resolving anything. Deleting the tiers
made the two halves agree, which is what §2's own constraint had been asking for.

A team that wants different Method text edits `.archon/methods/<name>/SKILL.md` in its own repository
and expects the next `/setup` run to overwrite it. That is a real loss of an override that survived
upgrades; it is accepted because nothing ever declared one.

**Integrity is checked by reading, not by hashing.** §5's `verifyLicence` and `verifyBundle` are gone
with `lib/methods-bundle.mjs`, and so is the manifest they compared against. `/setup` Step 6 now reads
the bundle: every Method directory must carry its `SKILL.md` and the companion files that Method reads,
and `LICENSE` must be present. Either failure still stops setup.

What this trades away is worth naming plainly. The pinned licence hash and the `upstreamPath` closure
check were the only automated tripwire for an upstream rename wave — the failure this ADR's §1 exists
to prevent. Nothing replaces it inside this repository, because nothing here can see upstream. A rename
wave is now found by running a Box against a live Consumer, which is where every command defect of the
0.22.0 line was found. The upstream repository, tag and commit stay recorded in
`vendor/mattpocock-skills/README.md`.

## Considered options

**Per-box mapping — rejected.** Each Box names its own Method path in its own prose or its own config
block. This is the pre-#279 status quo: the same name in three files with nothing tying them together,
which is precisely what let the v1.1.0 rename wave break `/specs` and `/tickets` with CI green
([ADR-0030](0030-harness-hosts-methods.md) Context). It also makes the dependency list unanswerable —
you would have to read every Box to learn what the plugin depends on. Recorded here because it is the
obvious-looking design and will otherwise be proposed again.

**Fetching Methods at run time — rejected.** A Box could clone or download the skill at the pinned tag
on demand. That adds a network dependency to every AFK run, breaks reproducibility for a Consumer
behind a proxy, and reintroduces the CLI's silent-`main` trap if it routes through `npx skills`.

**A `skills.pin` config key — rejected.** See §1: it lets config and the shipped bundle disagree
undetectably.

## Consequences

- Upgrading Methods is a plugin upgrade plus a `/setup` re-run. `/setup` Step 6 is idempotent and runs
  even for an already-configured project, so an upgrade lands the new bundle without a reconfigure.
- A team fork costs one config line (`methods.<name>.source`) or one uncommitted directory. Neither
  requires a plugin change.
- `.archon/methods/` is generated. It is committed because Archon nodes need it (see Context), but it
  must never be hand-edited — `/setup` clean-replaces it.
- The closure test reads the real bundle rather than a pinned test copy. Two copies of the same
  upstream text would let a bumped bundle keep passing against stale fixtures, which is the drift the
  test exists to catch.
