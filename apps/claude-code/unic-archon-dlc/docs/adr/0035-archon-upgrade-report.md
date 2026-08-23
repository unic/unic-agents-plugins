# 0035. `/archon-upgrade` reports what a new Archon release means for this Plugin

**Status:** Accepted (2026-08-10); amended 2026-08-20 — the trap pass is a read, not a module, and it
reads the installed Boxes rather than the bundled ones (#381); amended 2026-08-24 — a config-key probe
is Step 6, and "writes nothing" now carries one contained exception (#396)

> **Amended (2026-08-24) — the report gained a config-key probe, and with it the one write this ADR
> said the command would never make.** This ADR argues the command "writes no file, amends no ADR,
> files no issue and touches no config", stated as an absolute. That claim now reads _in this
> repository_. Step 6 probes whether the installed Archon still reads the config keys this Plugin
> depends on, and the only method that answers it honestly is behavioural: give the key a distinctive
> value and watch what Archon does with it. Grepping the binary proves a string is present, not that
> anything reads it. So the step builds a throwaway git repository outside every clone, writes a config
> and a one-node workflow inside it, and runs Archon there. Nothing in the repository under assessment
> is touched, and the read-only claim about _this_ repository stands unweakened.
>
> Why the step exists at all: [#396](https://github.com/unic/unic-agents-plugins/issues/396) measured a
> committed `.archon/config.yaml` fix that had been inert for weeks — a top-level `baseBranch:` against
> an Archon that reads a nested path — believed and cited in prose the whole time. A config key this
> Plugin depends on is a claim to re-verify on every upgrade, which is what this command is for. The
> keys live in exactly one table, in Step 6, and the prose says the path is Archon's to change.

> **Amended (2026-08-20) — the trap check is prose now, and its own reasoning is what changed.** This
> ADR argues the pass belongs in `lib/schema-traps.mjs` because "an assertion that only exists as a
> regex inside a Markdown prompt is untested and fails open, which is the exact class of defect
> ADR-0011's traps describe". That argument was right about a regex and wrong about the alternative.
> #381 deleted the Plugin's code, so Step 5 now **reads** each installed `.archon/workflows/unic-dlc-*.yaml`
> and checks the four conventions itself, and a file it cannot read is a FAIL rather than a silent PASS
> — which is the fail-open hole closed by a different means, not left open. Three further statements
> below no longer hold: the pass runs over the **installed** Boxes in the repository the command runs
> in, not the bundled ones under `$CLAUDE_PLUGIN_ROOT` (that variable is unset inside the Bash tool);
> `allowed-tools` carries `Read` and `Glob` beside `Bash`, because a command that reads files needs
> them, and still no `Write`; and there is no `lib/methods-manifest.mjs` for this command to be absent
> from — the dependency list is the table in `README.md`.
>
> What the amendment costs is worth stating plainly: `test/schema-traps.test.mjs` re-asserted these
> four conventions in CI on every pull request. Nothing does that now. Step 5 is the only place they
> are re-asserted, in a command a human has to remember to run. Nobody chose that replacement — it
> fell out of the deletion, and it is recorded as an open question on #373.

## Context

[ADR-0011](0011-archon-schema-target.md) tells authors to "re-validate behaviourally on each bump" and warns that `archon validate workflows` passes clean on semantically broken YAML — gates that never pause, loops that never iterate, fresh-context isolation silently ignored. It ships no mechanism for doing that check. [ADR-0033](0033-archon-070-schema-target.md) supplied the re-validation once, by hand.

The cost of doing it by hand is measured. Assessing Archon 0.7.0 meant reading a 210-file release against all four Box YAMLs, `lib/archon-check.mjs`, `lib/config-schema.mjs` and six command files. It surfaced two live defects and three adoptable features, none of which any automated check flagged. Both defects were the same shape: upstream **removed a default this Plugin's own YAMLs still assumed** — an unpinned `gh` version, and a `git add -A` pattern now independently forbidden by `test/box-staging-and-repo-pinning.test.mjs`. A check that only looks for new schema fields is blind to that shape.

The 0.x line moves in weeks (0.3.12 → 0.5.0 → 0.7.0), so the cost recurs on 0.8.0 and every release after it. A repeatable procedure belongs in an invocable Box, not in an ADR nobody re-runs.

## Decision

### Container: a command, not an Archon workflow

`/archon-upgrade` is a Claude Code command. It needs the live conversation twice — to ask which repository to read release notes from when auto-discovery fails, and to present a decision table a human acts on — which is [ADR-0017](0017-container-follows-structural-need.md)'s container test. An Archon node has no live conversation, so a workflow could only guess or halt.

### Repository discovery is best-effort and never hardcoded

The command derives Archon's own upstream repository at run time from `brew info archon --json=v2`, reading `owner/repo` out of the formula's `homepage`. On any failure — no `brew` (expected on Windows), Archon installed another way, or a changed JSON shape — it **asks the user in the conversation** rather than guessing. No Archon repository URL is written into a `commands/*.md` or `lib/*.mjs` file, so nothing here goes stale when the upstream project moves.

This is the one fixed external dependency this Plugin already declares ([ADR-0011](0011-archon-schema-target.md)), not a swappable tracker or docs system, so [ADR-0016](0016-dlc-thin-process-layer.md)'s "compose the configured system-skill, never hardcode a provider" rule is not in play. `brew` and `gh` here read Archon's own release notes; they never touch the Consumer's tracker.

### Release-note retrieval degrades, and says so

Tags come from `gh release list` against the discovered repository; bodies from `gh release view <tag> --json body,tagName`, for every tag strictly above `MIN_ARCHON_VERSION` up to and including the installed version. When `gh` is missing or unauthenticated, the command offers the human the one fallback a live conversation affords — paste or point at the notes — and, failing that, states plainly that the classification table could not be produced. Steps that need no external data still run and are still reported.

### Classification is a live-agent reasoning step, constrained by precedent

Release notes are free text; there is no schema to diff. Classification is therefore judgement, not code, and each row is one notable change: `Version | Change | Classification | Affected file:node | Suggested next step`, where the classification is ADOPT, DEFER, VERIFY-ONLY or BREAKS-US and the next step is file an issue, amend an ADR, or nothing.

Two cases this repository has already settled are locked, so a run cites them rather than re-deriving them:

- **`workflow:` sub-runs → DEFER**, citing [ADR-0033 § "Sub-runs (`workflow:` nodes): deferred, with the trigger to revisit"](0033-archon-070-schema-target.md). That section records the trigger to revisit. The command quotes it; it must not paraphrase it into a new trigger or invent a second one. Only the recorded trigger reclassifies the row.
- **Archon's own repository/remote resolution → VERIFY-ONLY, never BREAKS-US**, citing [ADR-0033 § "Repository derivation: settled by #289, not reopened here"](0033-archon-070-schema-target.md). The divergence recorded there is deliberate. Classifying a recorded, deliberate divergence as BREAKS-US would make every run re-raise a settled decision.

Neither bullet is restated anywhere else, here included. Link, do not repeat: a second paraphrase in a second document is the drift these rules exist to prevent.

### The changed-defaults lens is its own pass

A dedicated pass re-reads every kept release's notes for "changed default", "removed", "deprecated" and "no longer" language, and cross-checks each hit against the actual `bash`/`script`/`prompt` node bodies of the four bundled Box YAMLs — not against the schema surface. Both real 0.7.0 defects were this shape. A new-field scan is not a substitute.

### The ADR-0011 trap re-assertion is a tested lib, not a prompt regex

[`lib/schema-traps.mjs`](../../lib/schema-traps.mjs) checks one workflow source against ADR-0011's conventions 1–4: no `type:` discriminator on any node; every `approval:` node paired with workflow-level `interactive: true`; every `loop:` carrying both `until` and `max_iterations`; no node-level `fresh_context:` key. It returns violations rather than throwing, so a caller printing a PASS/FAIL grid cannot mistake a crash for a pass.

It is a `lib/` module because it is deterministic, tracker-agnostic, reusable IP — [ADR-0018](0018-generic-core-config-compose.md)'s bar — and because an assertion that only exists as a regex inside a Markdown prompt is untested and fails open, which is the exact class of defect ADR-0011's traps describe. `test/schema-traps.test.mjs` proves each trap fires and runs the checker over the four bundled Boxes, so a regression fails CI here instead of silently at run time in a Consumer.

The command runs this pass unconditionally, over the **bundled** YAMLs under `$CLAUDE_PLUGIN_ROOT/.archon/workflows/`, even when every earlier step failed.

### Read-only, absolutely

`allowed-tools` is `Bash` alone — no `Write`, no `Edit`. The command writes no file, amends no ADR, touches no config and files no issue. Its only output is the decision table in the conversation. Adoption is a human decision, recorded by hand in a later, separate change. `test/archon-upgrade-command.test.mjs` asserts the frontmatter structurally, so a later edit cannot quietly grant the command a write tool.

## Consequences

- The box set gains a tenth Box, off-line and on-demand, listed in `README.md`, `AGENTS.md` and `CONTEXT.md`. It has no gate: nothing it does is destructive.
- `parseVersion` in `lib/archon-check.mjs` becomes public API, so the command compares version triples rather than strings, and is locked by a test.
- `/archon-upgrade` reads no Method — no Method covers "assess an external tool's release notes" — so it appears in no dependency table and adds nothing to `lib/methods-manifest.mjs`.
- The four bundled Boxes now have a CI-enforced ADR-0011 conformance guard, which they did not have before. That guard is a side effect of AC 5's machinery, and it is the more durable half: it fires on every push, not only when someone runs the command.
- The command's classification judgement is not verifiable today — the installed Archon (0.7.0) equals the floor, so there is no version delta to classify. What ships verified is its structure, its citation discipline and its trap re-assertion. The judgement is provable the next time Archon ships above the floor.
- Nothing here revisits [ADR-0033](0033-archon-070-schema-target.md)'s two locked decisions. The command reports them; it does not reopen them.
