# Labels

Repo-owned. Hand-maintained — no generator writes this file. See [ADR-0032](../adr/0032-label-taxonomy.md).

Four tiers on the GitHub tracker: **state**, **type**, **priority** and **area**. Canonical names are what skills speak; on this tracker they are also the literal label strings, so no mapping is needed. `docs/agents/triage-labels.md` maps a skill's canonical triage _role_ onto the state tier, which is where the two vocabularies differ.

`wayfinder:*` labels sit outside these tiers — `/wayfinder` owns their lifecycle. They do not exist on the tracker yet and are created by hand once; the commands are in [Wayfinding operations](issue-tracker.md#wayfinding-operations).

## State (8)

One per issue. `rejected` is canonical here, **not** `wontfix`.

`needs-triage` → `needs-info` → `needs-specs` → `ready-for-agent` / `ready-for-human` → `resolved` → `closed`, or `rejected` at any point.

## Type (6)

One per issue: `feature`, `bug`, `spike`, `tech-debt`, `docs`, `release`.

`release` is repo-local. It was added as an override in `.archon/unic-dlc.config.json`, which no longer exists — this file is now its only home.

## Priority (4)

One per issue: `p0`, `p1`, `p2`, `p3`.

## Area (one per app or package)

- `app:<plugin>` — one per app under `apps/claude-code/`
- `pkg:<package>` — one per workspace package under `packages/`
- `repo` — monorepo-wide or cross-cutting work

One exception: `app:unic-ticket-specification` has no directory under `apps/claude-code/` — the plugin was specified but never built. Keep the label; one issue carries it, and deleting a label strips it from every issue that has it. `app:pr-review` does have a directory, deliberately tagging the deprecated v1 plugin's 30 historical issues.

Hand-applied. The context each area label maps to is listed in [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md).

## Kept for tooling

`dependencies` and `javascript` are Dependabot's. It auto-applies and recreates them, so leave them alone.
