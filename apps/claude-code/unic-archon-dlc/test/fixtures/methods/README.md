# Method fixtures — pinned upstream snapshots

Point-in-time copies of `SKILL.md` files from **[mattpocock/skills](https://github.com/mattpocock/skills)** at tag **v1.1.0**, used by `test/methods-manifest.test.mjs` so the closure test runs deterministically and offline.

**Do not edit these files.** They must stay byte-identical to their source tag, which is why `.prettierignore` excludes this directory. To change a fixture, re-copy it from the upstream tag.

## Licence

Copyright (c) 2026 Matt Pocock, MIT. The full licence text ships with the vendored bundle at [`../../../vendor/mattpocock-skills/LICENSE`](../../../vendor/mattpocock-skills/LICENSE) and applies to these copies too.

## Temporary

These fixtures are a stand-in for the real vendored bundle, which lands in **issue #284**. When it does, the closure test reads `vendor/mattpocock-skills/` and this directory is deleted — two pinned copies of the same text would let the fixtures keep asserting v1.1.0 while the bundle moves on, which is the exact drift the closure test exists to catch.
