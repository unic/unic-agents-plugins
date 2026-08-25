# 0019. Conversational `/setup` + one thin tested schema lib

**Status:** Accepted (2026-07-02); amended 2026-08-20 — the one surviving lib is deleted, so the
merge and validation it held are now prose (#381); amended 2026-08-25 — `/setup` is the installer, its
idempotency is three treatments rather than one merge, and it asks no label question (#383)

**Supersedes** [ADR-0001](0001-setup-as-slash-command.md).

> **Amended (2026-08-25) — three things this ADR says about `/setup` are now false (#383).**
>
> - **It asks no label question.** The Consequence below points at [ADR-0024](0024-triage-intake-on-ramp.md)'s
>   2026-08-11 amendment for what `/setup` asks about labels. #389 moved that mapping out of the config
>   and into `docs/agents/triage-labels.md`, and #383 made `/setup` write that file — by reading what the
>   tracker already uses and proposing a value per role, never by offering a default. So the tier-grouped
>   question, the seeded-default rule and the closed key set describe a config key that no longer exists.
>   ADR-0024's own 2026-08-18 amendment already says the key is gone; this one says which Consequence
>   here goes with it.
> - **Idempotency is three treatments, not one merge.** "A re-run merges, never clobbers" held while the
>   config was the only thing `/setup` wrote. It now lands four kinds of artefact: a Plugin-owned tree is
>   **replaced** every run, a tenant-owned file is written once and thereafter **reported** on, and a
>   marked block inside a tenant file is **patched** in place. `reconfigure` is the one override that
>   rewrites a tenant-owned file, per file, after showing what would change.
> - **The legacy `.json` migration is deleted.** No project was ever on that shape, so the migration was a
>   path nothing had walked. A legacy file found now stops the run with a report.
>
> One Consequence gains a mechanism rather than losing it: `/setup` locates its own installed directory
> from Claude Code's `~/.claude/plugins/installed_plugins.json` (`installPath`, matched on `projectPath`
> for a project-scope install), verifies it, and stops rather than guessing. See
> [ADR-0036](0036-setup-owns-a-named-install-set.md)'s 2026-08-25 amendment.

> **Amended (2026-07-02):** `/setup` also **discovers and registers the team's system-skills** into config — a capability→tool mapping (tracker/docs/design → `mcp | cli | skill`, MCP-first), not a presence snapshot. Discovery is **verify-only** (introspect installed skills/MCP + bash CLI probes; never installs). A missing **required** capability (incl. Matt's suite, [ADR-0021](0021-earns-its-place-compose-verbatim.md)) → **warn + degrade, non-blocking**: setup completes, records it unavailable, and lists the blocked boxes; boxes **re-probe at runtime** (MCP-first, CLI-fallback) and fail with a clear "install X".

> **Amended (2026-08-20) — the thin lib is gone too.** The Decision below keeps "exactly one thin
> tested lib" for idempotent config read-merge-write plus schema validation. `lib/config-schema.mjs`
> is deleted with the rest of the Plugin's code, so `/setup` now merges and writes the YAML with its
> own tools ([ADR-0023](0023-build-generic-red-green-refactor-loop.md) §5, amended — a command cannot
> resolve a module or the `yaml` package where it actually runs). Every invariant that ADR asked the
> lib to hold is stated in Step 5 instead: merge `defaults < existing < answers` deeply, refuse to
> overwrite a config that is present but unreadable, and leave a legacy `.json` untouched. What the
> deletion costs is the automated proof of those invariants — a re-run that clobbers a partial config
> would now be caught by reading the file or by a Consumer run, not by a test. Validation lost its
> teeth in the same edit: no key is mandatory any more, so "schema validation" means applying stated
> defaults, and only an absent or unreadable file stops a Box.

## Context

[ADR-0001](0001-setup-as-slash-command.md) had `/setup` delegate all filesystem writes to a tested `lib/install-runner.mjs` (merge `defaults < existing < answers`, marker-delimited `CLAUDE.md` update, `docs/agents/*.md` generation). Under [ADR-0016](0016-dlc-thin-process-layer.md)/[ADR-0018](0018-generic-core-config-compose.md), setup is **tracker/tenant/OS wiring** — the archetypal _how_ — so it belongs in config + composition, not a bespoke lib. Pesche's `unic-ticket-specification` (PR #257) makes setup fully conversational (markdown + bash, no lib). But one genuinely deterministic, error-prone concern hides in setup: **idempotent config read-merge-write + schema validation** (a re-run must not clobber a partial config).

## Decision

`/setup` becomes a **conversational command**: detect tracker/OS/repo, prompt for gaps, **compose** the relevant system-skill/CLI (`az` / the `azure-devops-cli` skill, `gh`, `jira`, MCP-first) to discover and register what the team has, and write the rich **`.archon/unic-dlc.config.yaml`** ([ADR-0018](0018-generic-core-config-compose.md)).

**Exactly one thin tested lib survives** for the deterministic part: **config schema-validate + idempotent merge** (read existing `.json`/`.yaml` → merge → validate → write `.yaml`, keeping a backup). The heavy setup libs — `install-runner`, `setup-explorer`, `agent-docs-writer` — are **dissolved**.

The runtime Archon version check moves to a **behavioural min-floor check (`≥ 0.5.0`)**, replacing the fictional exact-`0.10` assertion ([ADR-0011](0011-archon-schema-target.md)).

## Consequences

- ADR-0001's "delegate all writes to `install-runner`" is reversed; setup conducts the conversation and composes tools, keeping only schema-validate/merge as tested code.
- `/setup` gains the job of **discovering/registering the team's system-skills** into config, so every downstream box knows what it can compose ([ADR-0016](0016-dlc-thin-process-layer.md)).
- New config keys (`gates.<box>: hitl|afk`, `build.fresh_context_red_green`, `templates`, `tracker.access`, `docs.type`) are written by the conversational flow, validated by the thin lib.
- Idempotency and mandatory-field invariants are preserved by the thin lib, not lost to prose.
- Implementation (dissolving the libs, JSON→YAML migration, the version-check fix) is owned by the `/setup` redesign step, not this foundations PR.
- **What `/setup` asks about labels** — the one tier-grouped question, the refusal to inspect a tracker or create a label, the absence of a seeded default, and the closed key set — is recorded in [ADR-0024](0024-triage-intake-on-ramp.md)'s 2026-08-11 amendment, which owns the `classification.labels` contract.
