# 0031. Methods are bundled in the plugin; the plugin version is the pin; resolution is three-tier

**Status:** Accepted (2026-08-03)

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
