# Vendored Methods — `mattpocock/skills`

**This directory is generated. Do not hand-edit anything under `skills/`.**

`skills/` holds the Methods this Plugin's Boxes compose, copied verbatim from upstream at a pinned
tag. `/unic-archon-dlc:setup` installs them into a Consumer repository as `.archon/methods/<name>/`,
the one path every Box and every command reads a Method from.

## Provenance

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Source  | https://github.com/mattpocock/skills       |
| Tag     | `v1.1.0`                                   |
| Commit  | `d574778f94cf620fcc8ce741584093bc650a61d3` |
| Licence | MIT — see [`LICENSE`](LICENSE)             |

**This table is the provenance.** These four values live here alone. Update them in the same commit
that replaces the vendored files — nothing else records the tag, and nothing checks that this file
still describes what sits beside it.

## What is here, and what is not

`skills/` mirrors the upstream directory layout (`skills/<category>/<name>/`). Mirroring rather than
flattening is what makes a re-vendoring diffable against upstream by eye — which is now the only check
there is. The closure test that caught an upstream relocation went with the manifest, so
**upgrading this bundle means diffing this tree against the new upstream tag by hand**, in the commit
that moves the pin above. That diff is the only moment the check happens.

Eleven Methods and their sub-files are vendored. `handoff` and `prototype` are deliberately absent:
the Boxes name them in prose for a human to run and never read their files. Which Box reads which
Method is recorded once, in the table under [`../../README.md` § Dependencies](../../README.md#dependencies).

Keep `skills/**` out of every formatter, so the pinned text stays byte-identical to upstream. This
file is not pinned text, so a formatter may touch it.

## Licence

Upstream is MIT. [`LICENSE`](LICENSE) is the upstream licence file, verbatim; `/setup` checks that
it is present before installing anything. MIT requires only that
the copyright notice and the permission notice accompany copies, and that file carries both, so no
`NOTICE` file is needed. The `LICENSE` file is maintainer-owned: never create, copy, or delete it.

## Re-vendoring

Fetch with `git clone --depth 1 --branch <tag> https://github.com/mattpocock/skills` into a temp
directory and copy each vendored Method's directory across. Never use `npx skills` — its
`owner/repo@tag` form silently resolves `main`.

Then update this file's provenance table.
