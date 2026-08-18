# 0022. SemVer per plugin, not per monorepo

**Status:** Accepted (2025-04); amended 2026-08-19 — the table below governs a plugin at `1.0.0` or
above, and the `0.x` rule was never stated. See the amendment before the table.

> **Amended (2026-08-19): what a `0.x` version means (#391).** Three of the six plugins here are on a
> `0.x` line — `auto-format`, `unic-archon-dlc`, `unic-spec-review`. Read literally, the table below
> makes the next breaking change to any of them a `1.0.0`. That is neither what has happened nor what
> should: ten breaking releases of `unic-archon-dlc` shipped as minor bumps (0.2.0, 0.3.0, 0.4.0,
> 0.5.0, 0.6.0, 0.11.0, 0.15.0, 0.16.0, 0.19.0, 0.22.0).
>
> Those ten are conformant, because SemVer exempts the line:
>
> > Major version zero (0.y.z) is for initial development. Anything MAY change at any time. The public
> > API SHOULD NOT be considered stable. — semver.org §4
>
> **So the table below governs a plugin at `1.0.0` or above.** Below it:
>
> - **minor** — a breaking change, **or** a backwards-compatible feature. Both, because a consumer who
>   has been told the API is unstable cannot act on the difference.
> - **patch** — unchanged: a bug fix, a documentation change, or an internal refactor with no
>   behaviour change.
> - **major** — reserved for the `1.0.0` release itself. Nothing else produces it.
>
> **A breaking change never produces `1.0.0`.** A plugin reaches `1.0.0` by meeting its own release
> bar, which is a judgement about the product. For `unic-archon-dlc` that bar is decision 1 of
> [#373](https://github.com/unic/unic-agents-plugins/issues/373) — _one other Unic repo installs the
> plugin and runs it end to end_ — and a diff cannot satisfy it.
>
> **On a `0.x` plugin the `### Breaking` changelog entry is what warns a consumer, not the version
> number.** So write that entry, and read a minor bump on a `0.x` line as "look at the changelog",
> never as "nothing broke".
>
> The table is right above `1.0.0`, and there is evidence for it rather than only intent:
> `unic-confluence` 3.0.0 is the one post-1.0 release in this repo carrying a `### Breaking` entry, and
> it took a major bump.
>
> Surfaced while shipping [#389](https://github.com/unic/unic-agents-plugins/issues/389), where the ten
> minor breaking releases read as an oversight. The silence here is what produced that reading.

## Context

Plugins are independently released and consumed. A monorepo-level version would conflate unrelated changes across plugins.

## Decision

Each plugin maintains its own SemVer version in `.claude-plugin/plugin.json`. The versioning contract,
**for a plugin at `1.0.0` or above** — see the amendment above for a `0.x` plugin:

- **major**: breaking change to the plugin's CLI interface, exit codes, or file schema
- **minor**: new feature that is backwards-compatible
- **patch**: bug fix, documentation update, or internal refactor with no behaviour change

Shared packages (`@unic/*`) are internal and unversioned for external consumers.

## Consequences

- A breaking change in `unic-confluence` does not affect `auto-format` or `pr-review` versioning.
- A plugin may sit on `0.x` indefinitely. That is a statement about its release bar, not about how much
  it has changed: `unic-archon-dlc` reached 0.22.0 with ten breaking releases behind it.
- Changelogs are per-plugin (`CHANGELOG.md` inside each plugin directory).
- There is no monorepo-wide version or combined release notes.
