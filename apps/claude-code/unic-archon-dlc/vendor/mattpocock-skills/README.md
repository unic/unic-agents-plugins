# Vendored Methods — `mattpocock/skills`

**This directory is generated. Do not hand-edit anything under `skills/`.**

`skills/` holds the Methods this Plugin's Boxes compose, copied verbatim from upstream at a pinned
tag. `/unic-archon-dlc:setup` installs them into a Consumer repository as `.archon/methods/<name>/`,
which is the `bundle` tier `resolveMethod` reads (`lib/methods-resolver.mjs`).

## Provenance

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Source  | https://github.com/mattpocock/skills       |
| Tag     | `v1.1.0`                                   |
| Commit  | `d574778f94cf620fcc8ce741584093bc650a61d3` |
| Licence | MIT — see [`LICENSE`](LICENSE)             |

The same values are the source of truth in code, as `METHODS_BUNDLE` in
[`../../lib/methods-manifest.mjs`](../../lib/methods-manifest.mjs). A test asserts this file quotes
the same tag and commit, so the two cannot drift.

## What is here, and what is not

`skills/` mirrors the upstream directory layout (`skills/<category>/<name>/`), keyed by each
`METHODS_MANIFEST` entry's `upstreamPath`. Mirroring rather than flattening keeps `upstreamPath`
load-bearing: an upstream relocation fails the closure test in
`test/methods-manifest.test.mjs` instead of silently resolving nothing.

Only the manifest's transitive closure is vendored — 11 Methods and their sub-files. `handoff` and
`prototype` are deliberately absent: the Boxes name them in prose for a human to run and never read
their files.

`skills/**` is listed in the repository's root `.prettierignore` so the pinned text stays
byte-identical to upstream. This file is not, so it is Prettier-formatted like the rest of the repo.

## Licence

Upstream is MIT. [`LICENSE`](LICENSE) is the upstream licence file, verbatim; `/setup` verifies its
SHA-256 against `METHODS_BUNDLE.licenceSha256` before installing anything. MIT requires only that
the copyright notice and the permission notice accompany copies, and that file carries both, so no
`NOTICE` file is needed. The `LICENSE` file is maintainer-owned: never create, copy, or delete it.

## Re-vendoring

Fetch with `git clone --depth 1 --branch <tag> https://github.com/mattpocock/skills` into a temp
directory and copy each manifest entry's directory across. Never use `npx skills` — its
`owner/repo@tag` form silently resolves `main`.

Then update `METHODS_BUNDLE` (tag, commit, and `licenceSha256` if upstream's `LICENSE` changed) and
this file's provenance table, and re-run `pnpm --filter unic-archon-dlc test`.
