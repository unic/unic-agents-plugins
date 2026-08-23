---
allowed-tools: ['Bash', 'Read', 'Glob']
description: 'Report what a new Archon release means for this Plugin: compare the installed version against the 0.7.0 floor, classify each upstream change as ADOPT / DEFER / VERIFY-ONLY / BREAKS-US against the four installed Box YAMLs, check for changed upstream defaults, re-assert ADR-0011 trap conformance, and probe that the Archon config keys this Plugin depends on are still read. Read-only in this repository — the key probe writes a throwaway repository outside every clone.'
---

# unic-archon-dlc:archon-upgrade

> Design rationale: [ADR-0035 — `/archon-upgrade` reports what a new Archon release means for this Plugin](docs/adr/0035-archon-upgrade-report.md) (container per [ADR-0017](docs/adr/0017-container-follows-structural-need.md); floor, node-schema conventions and the four silent-failure traps per [ADR-0011](docs/adr/0011-archon-schema-target.md); the two locked classification precedents per [ADR-0033](docs/adr/0033-archon-070-schema-target.md); the evidence-gate shape a future release may touch per [ADR-0034](docs/adr/0034-evidence-gate-deterministic-writer.md)).

`/archon-upgrade` answers one question: **Archon shipped a new release — what does it mean for this
Plugin?** It compares the installed `archon` against this Plugin's floor, reads the release notes for
everything in between, classifies each notable change against the four installed Box YAMLs, and
re-asserts [ADR-0011](docs/adr/0011-archon-schema-target.md)'s silent-failure traps. The output is one
decision table.

**It is read-only here, absolutely.** There is no apply mode — this is a stronger claim than
`/cleanup`'s dry-run default. In this repository it writes no file, amends no ADR, files no issue and
touches no config. Step 6's probe is the one exception, and it is contained: it builds a throwaway git
repository outside every clone and writes only inside it. Adoption is a human decision, recorded by hand
afterwards. If any step below tempts you to write in this repository, that is the defect, not the
missing feature.

Run it after `brew upgrade archon` or any Archon version bump, and before touching a Box YAML.

Follow these steps in order. Do not skip any step.

## Step 1 — Compare installed against the floor

This Plugin's floor is **Archon `0.7.0`** — the version the key-discriminated schema needs: gates,
loops, `context: fresh`, `evidence_policy` and `always_run`
([ADR-0033](docs/adr/0033-archon-070-schema-target.md)). Run:

```bash
archon --version
```

Read the output yourself and branch on what you see. Compare the three numbers, never the raw strings:
the output may carry a program name or a `v` prefix.

- **The command is not found, or fails for any other reason** → Archon is unusable at all. Print what
  the shell said and stop. Nothing else in this report would be meaningful.
- **Installed is below `0.7.0`** → print both versions, then one line: "run `/unic-archon-dlc:setup`
  first — there is no upgrade to report, only a downgrade to fix." Stop.
- **The version does not parse into three numbers** (a dev build) → say so, skip Steps 2–4, and go
  straight to Steps 5 and 6, which need no version at all.
- **Installed equals `0.7.0`** → print `installed 0.7.0 == floor 0.7.0 — no release range to assess`,
  skip Steps 2–4, and go to Steps 5 and 6. They assess what is already shipped, not the new release,
  and the floor is the version most Consumers are running.
- **Installed is strictly above `0.7.0`** → continue to Step 2. State the range you are about to
  assess: `floor 0.7.0 → installed <y>`.

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
one turn, guessing costs a wrong report. If the user declines or does not know, skip to Steps 5 and 6
and say in the final report that the classification table could not be produced.

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
is available, skip Steps 3–4 entirely, go to Steps 5 and 6, and record in the final report that the
classification table could not be produced and why. **Steps 5 and 6 still run** — they need no release
notes, and they are the half of this report that catches regressions in what is already shipped.

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
- **Archon's own repository / remote-resolution algorithm (the remote key in Step 6's table, an
  `origin`-then-sole-remote fallback, or similar) → classify VERIFY-ONLY, never BREAKS-US.** This Harness resolves no repository
  from a remote at all: `docs/agents/issue-tracker.md` § Addressing names it, so Archon's algorithm and
  this Harness answer different questions and cannot disagree
  ([ADR-0024](docs/adr/0024-triage-intake-on-ramp.md), amended 2026-08-18, which retired the derivation
  ADR-0033 § "Repository derivation" recorded as a deliberate divergence). Cite that. Classifying it as
  BREAKS-US makes every run re-raise a decision that has already been superseded once.

### Mandatory sub-pass — changed upstream defaults, not just new fields

Re-read every kept release's notes a second time, looking specifically for **"changed default"**,
**"removed"**, **"deprecated"** and **"no longer"** language. Cross-check each hit against the actual
`bash:`, `script:` and `prompt:` node bodies of the four installed Box YAMLs —
`.archon/workflows/unic-dlc-*.yaml` in this repository — not against the schema surface.

This pass exists because both real 0.7.0 defects were this shape and neither was a new field: an
unpinned `gh` version assumption, and a `git add -A` pattern upstream had made unsafe. A scan that
only asks "is there a new field?" is blind to a removed default a Box still assumes.

Report each hit as its own row, marked `default-change`, in the same table.

## Step 5 — Re-assert ADR-0011's traps against the installed Boxes

This step runs **unconditionally**, even when Steps 2–4 failed. Read every
`.archon/workflows/unic-dlc-*.yaml` in this repository — the Boxes actually installed here, which is
what a run would use — and check each one against
[ADR-0011](docs/adr/0011-archon-schema-target.md)'s node-schema conventions 1–4:

1. No node carries a `type:` discriminator.
2. Every node with an `approval:` key sits in a workflow whose top level declares `interactive: true`.
3. Every `loop:` carries both `until` and `max_iterations`.
4. No node carries a node-level `fresh_context:` key. (A loop body may; a node may not.)

Print one PASS/FAIL line per file, and under each FAIL every violation as `node · trap · what is
wrong`. If you cannot read a file, that file is a FAIL naming the read error — a check that could not
run is never a silent PASS.

A FAIL here is not caused by the new Archon release: it means an installed Box has drifted from
ADR-0011. Nothing else guards these four conventions, so this read is the only place they are
re-asserted — say which file drifted and stop short of fixing it, because this command changes nothing in
this repository.

## Step 6 — Probe the config keys this Plugin depends on

This step runs **unconditionally**, like Step 5. It needs no release notes, no network and no AI.

Archon owns these key paths, and one has already moved underneath us: this repository carried a
top-level `baseBranch:` for weeks while the installed Archon read a nested path, so a committed fix did
nothing and removed the pressure to find the real one. Read every path in the table below as a **claim
under test on this release**, never as a fact — the probe is the authority, and the table only says
which claims to put under it.

### The keys — the one place the list lives

| Key path              | What depends on it                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `worktree.baseBranch` | Which branch an Archon worktree forks from. A wrong value produces work behind the integration branch; a value nothing reads leaves Archon on its own stored default — the branch that happened to be checked out on its first run in that repository. |
| `worktree.remote`     | Which remote Archon resolves that base branch against. `/setup` reports what Archon resolves and writes that file never; Step 4 classifies changes to the algorithm VERIFY-ONLY on the strength of it.                                                 |

That table is the whole list. A key discovered later joins it through its own ticket, which is what
keeps it a list and not a survey of Archon's config surface.

### The probe

Reading the binary proves a string is present, not that anything reads it, and `archon doctor` reports
nothing about config resolution. So give the key a distinctive value and watch what Archon does with
it. Build the probe outside every real clone — it writes a config file, and Archon writes a workspace
directory, a row in its own store and one worktree per run.

1. Make a throwaway git repository under the operating system's temp directory, so the probe works
   the same on macOS, Windows and Linux: `git init`, one commit, and two remotes whose URLs carry
   distinctive owner and repository names — for example `origin` →
   `https://github.com/probe-origin-org/probe-origin-repo.git` and `mirror` →
   `https://github.com/probe-mirror-org/probe-mirror-repo.git`. `allowed-tools` grants no `Write`, so
   make the repository and its two files through `Bash`.
2. Write one workflow at `.archon/workflows/probe.yaml`: a single node carrying an `id:` and a `bash:`
   body that echoes `pwd`. Commit it. Archon resolves the config before the first node, so the body
   never has to run for the probe to answer.
3. Run it once per key in the table with that key set alone, plus the two control runs below — so the
   two keys above are four runs. Rewrite `.archon/config.yaml` between runs and pass a fresh branch
   each time:

   ```bash
   archon workflow run probe --branch probe-<n>
   ```

   | Run                                                | Shows                                                    |
   | -------------------------------------------------- | -------------------------------------------------------- |
   | One nested key set to a distinctive value          | Whether Archon reads that path on this release           |
   | Control: the nested keys absent                    | What Archon says with nothing configured                 |
   | Inert control: the same names at the **top level** | Whether the probe can tell a read key from an unread one |

4. Read each run's own output for the distinctive value: Archon's log lines and its startup error name
   the branch and the remote it used.

The inert control carries the weight. It is the shape that hid the defect this step exists for, so a
report showing only READ rows has not yet shown that a row could have come out the other way.

Give each key one verdict:

- **READ — value `<x>`.** The distinctive value appears in Archon's own output.
- **NOT READ.** The output matches the control that omitted the key. This is the silent failure the
  step exists for.
- **INCONCLUSIVE — `<reason>`.** A probe run could not complete, **or** no run produced a line you can
  read a branch or a remote out of — a reworded message is not evidence that nothing read the key.
  Name the run and the reason; an unfinished probe never counts as READ.

Read Archon's wording literally and no further. On 0.7.0 the message says `Configured base branch
'<x>'` even when nothing is configured and `<x>` is Archon's own stored default, so the word
`Configured` is not evidence of a read — only the **distinctive value** is.

Name the Archon version the verdicts were measured on. They belong to that release and to no other.

Then clear what the probe left behind: delete the throwaway repository and the
`~/.archon/workspaces/<owner>/<repo>/` directory Archon created for it, so a probe stops showing in
`archon isolation list` next to real work. One residue has no cleanup path: the first run registers the
probe as a codebase row in `~/.archon/archon.db`. That row is one machine's junk — leave it, and say in
the report that the probe name will appear in Archon's own listings.

## Step 7 — Print the report

One block, in this order:

```
/archon-upgrade report — read-only in this repository
  Archon:      installed <x> · floor <y> · <up-to-date | N releases to assess | below floor>
  Repository:  <owner>/<repo>   (discovered via brew | supplied by you | unavailable)
  Releases:    <tags assessed>  (or: classification table not produced — <reason>)

  Decisions
    | Version | Change | Classification | Affected file:node | Suggested next step |
    | ------- | ------ | -------------- | ------------------ | ------------------- |
    ...one row per notable change, default-change rows included...

  ADR-0011 traps (installed Boxes)
    unic-dlc-build.yaml      PASS
    unic-dlc-explore.yaml    PASS
    unic-dlc-pr-review.yaml  PASS
    unic-dlc-qa.yaml         PASS

  Config keys (probed on Archon <x>)
    <key from Step 6's table>        <READ — value '<x>' | NOT READ | INCONCLUSIVE — <reason>>
    ...one row per key in that table...
    inert control (the same names at top level)   <verdict>

  Summary:     ADOPT <n> · DEFER <n> · VERIFY-ONLY <n> · BREAKS-US <n>
  next:        act on the BREAKS-US rows first, then the ADOPT rows.
```

Close with this line, verbatim:

> This command wrote nothing in this repository — only the throwaway repository Step 6 built, now
> deleted. Adoption is a human decision — file an issue or amend an ADR by hand.
