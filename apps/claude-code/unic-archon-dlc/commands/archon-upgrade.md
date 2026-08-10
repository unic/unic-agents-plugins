---
allowed-tools: ['Bash']
description: 'Report what a new Archon release means for this Plugin: compare the installed version against MIN_ARCHON_VERSION, classify each upstream change as ADOPT / DEFER / VERIFY-ONLY / BREAKS-US against the four bundled Box YAMLs, check for changed upstream defaults, and re-assert ADR-0011 trap conformance. Read-only — it writes nothing.'
---

# unic-archon-dlc:archon-upgrade

> Design rationale: [ADR-0035 — `/archon-upgrade` reports what a new Archon release means for this Plugin](docs/adr/0035-archon-upgrade-report.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); floor, node-schema conventions and the four silent-failure traps per [ADR-0011](docs/adr/0011-archon-schema-target.md); the two locked classification precedents per [ADR-0033](docs/adr/0033-archon-070-schema-target.md); the evidence-gate shape a future release may touch per [ADR-0034](docs/adr/0034-evidence-gate-deterministic-writer.md)).

`/archon-upgrade` answers one question: **Archon shipped a new release — what does it mean for this
Plugin?** It compares the installed `archon` against this Plugin's floor, reads the release notes for
everything in between, classifies each notable change against the four bundled Box YAMLs, and
re-asserts [ADR-0011](docs/adr/0011-archon-schema-target.md)'s silent-failure traps. The output is one
decision table.

**It is read-only, absolutely.** There is no apply mode — this is a stronger claim than `/cleanup`'s
dry-run default. It writes no file, amends no ADR, files no issue and touches no config. Adoption is a
human decision, recorded by hand afterwards. If any step below tempts you to write something, that is
the defect, not the missing feature.

Run it after `brew upgrade archon` or any Archon version bump, and before touching a Box YAML.

Follow these steps in order. Do not skip any step.

> **Shell requirement**: Steps 1 and 5 use `<<'EOJS'` heredoc syntax, which requires a POSIX-compatible
> shell. On Windows, run inside WSL2 or Git Bash; cmd.exe and PowerShell do not support heredocs. All
> filesystem work uses Node's `node:fs`/`node:path`, so paths are cross-platform.

## Step 1 — Compare installed against the floor

Run:

```bash
node --input-type=module <<'EOJS'
let output
try {
  const { pathToFileURL } = await import('node:url')
  const mod = await import(pathToFileURL(`${process.env.CLAUDE_PLUGIN_ROOT}/lib/archon-check.mjs`).href)
  const result = mod.checkArchon()
  output = {
    ...result,
    floor: mod.MIN_ARCHON_VERSION,
    installedTriple: result.ok ? mod.parseVersion(result.version) : null,
    floorTriple: mod.parseVersion(mod.MIN_ARCHON_VERSION),
  }
} catch (err) {
  output = { ok: false, code: 'other', message: `Plugin load error: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the JSON. **Do not stop on `ok: false` the way `/setup` does** — branch on `code`:

- **`enoent` or `other`** → Archon is unusable at all. Print `message` verbatim and stop. Nothing else
  in this report would be meaningful.
- **`incompatible`** → the installed Archon is _below_ the floor. `message` already names both
  versions — print it verbatim, then add one line: "run `/unic-archon-dlc:setup` first — there is
  no upgrade to report, only a downgrade to fix." Stop.
- **`ok: true` and `installedTriple` is `null`** → the version string did not parse (a dev build).
  Say so, skip Steps 2–4, and go straight to Step 5, which needs no version at all.
- **`ok: true` and `installedTriple` equals `floorTriple`** → print
  `installed <v> == floor <v> — nothing to do` and stop. Compare the parsed triples, never the raw
  strings: the installed string may carry a program-name or `v` prefix.
- **`ok: true` and installed is strictly above the floor** → continue to Step 2. State the range you
  are about to assess: `floor <x> → installed <y>`.

## Step 2 — Discover Archon's own upstream repository

Never hardcode or guess a URL. Ask the local environment where Archon came from:

```bash
brew info archon --json=v2
```

Read `.formulae[0].homepage` (fall back to `.casks[0].homepage`) and take the `owner/repo` out of the
GitHub URL.

If this fails for any reason — no `brew` on `PATH` (expected on Windows), Archon installed another way,
a non-zero exit, or a changed JSON shape — **do not guess**. Print one line explaining what failed and
**ask the user, in this conversation, for the `owner/repo` to read release notes from.** This command
runs with a human present ([ADR-0017](docs/adr/0017-container-follows-structural-need.md)); asking costs
one turn, guessing costs a wrong report. If the user declines or does not know, skip to Step 5 and say
in the final report that the classification table could not be produced.

## Step 3 — Fetch the release notes for the range

Enumerate the tags:

```bash
gh release list --repo <owner>/<repo> --limit 50
```

Keep exactly the tags **strictly above the floor** and **up to and including the installed version**,
comparing parsed triples (the same `parseVersion` Step 1 used), not strings. Then read each kept tag:

```bash
gh release view <tag> --repo <owner>/<repo> --json body,tagName
```

If `gh` is missing, unauthenticated, or rate-limited, say so plainly and offer the human the one
fallback a live conversation affords: paste the release notes, or name a local path to them. If neither
is available, skip Steps 3–4 entirely, go to Step 5, and record in the final report that the
classification table could not be produced and why. **Step 5 still runs** — it needs no external data,
and it is the half of this report that catches regressions in what is already shipped.

## Step 4 — Classify each notable change

Walk every kept release's notes. Emit one row per notable change:

| Version | Change | Classification | Affected file:node | Suggested next step |
| ------- | ------ | -------------- | ------------------ | ------------------- |

The four classifications:

- **ADOPT** — a new capability this Plugin should take on. Name the file and node that would change.
- **DEFER** — recognised as valuable, blocked on a condition already recorded in an ADR. Cite the
  recorded condition; never invent one.
- **VERIFY-ONLY** — a deliberate, already-documented divergence or an area we track but do not follow.
  Confirm it still holds. Do not re-litigate it.
- **BREAKS-US** — something this Plugin currently relies on has changed behaviour or been removed.

Every row names an **affected file and node** (for example `.archon/workflows/unic-dlc-build.yaml:evidence`)
and one suggested next step: **file an issue**, **amend an ADR**, or **nothing**.

### Two locked precedents — cite them, never re-derive them

- **`workflow:` sub-runs (dynamic fan-out, `with:` parameter mapping over a dynamic list) →
  classify DEFER.** The rationale in that row is a citation and nothing else: _see ADR-0033 § Sub-runs
  (`workflow:` nodes): deferred, with the trigger to revisit_. Do not restate the trigger, do not
  paraphrase it, and do not invent a second one. Reclassify the row as ADOPT **only** when the release
  notes show upstream has shipped what that section already records as the trigger — nothing else
  moves it.
- **Archon's own repository / remote-resolution algorithm (`worktree.remote`, an `origin`-then-sole-remote
  fallback, or similar) → classify VERIFY-ONLY, never BREAKS-US.** This Harness's derivation diverges
  from Archon's own algorithm on purpose, and the divergence is recorded in _ADR-0033 § "Repository
  derivation: settled by #289, not reopened here"_. Cite it. Classifying a recorded, deliberate
  divergence as BREAKS-US makes every run re-raise a settled decision.

### Mandatory sub-pass — changed upstream defaults, not just new fields

Re-read every kept release's notes a second time, looking specifically for **"changed default"**,
**"removed"**, **"deprecated"** and **"no longer"** language. Cross-check each hit against the actual
`bash:`, `script:` and `prompt:` node bodies of the four bundled Box YAMLs under
`$CLAUDE_PLUGIN_ROOT/.archon/workflows/` — not against the schema surface.

This pass exists because both real 0.7.0 defects were this shape and neither was a new field: an
unpinned `gh` version assumption, and a `git add -A` pattern upstream had made unsafe (now
independently guarded by `test/box-staging-and-repo-pinning.test.mjs`). A scan that only asks "is there
a new field?" is blind to a removed default a Box still assumes.

Report each hit as its own row, marked `default-change`, in the same table.

## Step 5 — Re-assert ADR-0011's traps against the bundled Boxes

This step runs **unconditionally**, even when Steps 2–4 failed. It reads the bundled Box YAMLs and
checks them against [ADR-0011](docs/adr/0011-archon-schema-target.md)'s node-schema conventions 1–4 —
no `type:` discriminator, every `approval:` node paired with workflow-level `interactive: true`, every
`loop:` carrying both `until` and `max_iterations`, and no node-level `fresh_context:` key.

```bash
node --input-type=module <<'EOJS'
let output
try {
  const { pathToFileURL } = await import('node:url')
  const { readdirSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const root = process.env.CLAUDE_PLUGIN_ROOT
  const { checkSchemaTraps } = await import(pathToFileURL(`${root}/lib/schema-traps.mjs`).href)
  const dir = join(root, '.archon', 'workflows')
  const files = readdirSync(dir).filter((name) => name.endsWith('.yaml')).sort()
  output = {
    ok: true,
    dir,
    files: files.map((file) => ({ file, ...checkSchemaTraps(readFileSync(join(dir, file), 'utf8')) })),
  }
} catch (err) {
  output = { ok: false, message: `Trap check could not run: ${err?.message ?? String(err)}` }
}
process.stdout.write(JSON.stringify(output) + '\n')
EOJS
```

Parse the JSON. If `ok` is `false`, print `message` — a check that could not run is a FAIL to report,
never a silent PASS. Otherwise print one PASS/FAIL line per file, and every violation's node, trap and
message underneath its file.

A FAIL here is not caused by the new Archon release: it means a bundled Box has drifted from ADR-0011.
`test/schema-traps.test.mjs` guards the same four files in CI, so a FAIL in this command with CI green
means the installed Plugin build is older than the repository — say so.

## Step 6 — Print the report

One block, in this order:

```
/archon-upgrade report — read-only
  Archon:      installed <x> · floor <y> · <up-to-date | N releases to assess | below floor>
  Repository:  <owner>/<repo>   (discovered via brew | supplied by you | unavailable)
  Releases:    <tags assessed>  (or: classification table not produced — <reason>)

  Decisions
    | Version | Change | Classification | Affected file:node | Suggested next step |
    | ------- | ------ | -------------- | ------------------ | ------------------- |
    ...one row per notable change, default-change rows included...

  ADR-0011 traps (bundled Boxes)
    unic-dlc-build.yaml      PASS
    unic-dlc-explore.yaml    PASS
    unic-dlc-pr-review.yaml  PASS
    unic-dlc-qa.yaml         PASS

  Summary:     ADOPT <n> · DEFER <n> · VERIFY-ONLY <n> · BREAKS-US <n>
  next:        act on the BREAKS-US rows first, then the ADOPT rows.
```

Close with this line, verbatim:

> This command wrote nothing. Adoption is a human decision — file an issue or amend an ADR by hand.
