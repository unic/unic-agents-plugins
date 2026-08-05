# Welcome to Unic Agent Plugins

## How We Use Claude

Based on Oriol Torrent Florensa's usage over the last 30 days (178 sessions):

Work Type Breakdown:

- Improve Quality ████████░░░░░░░░░░░░ 41%
- Build Feature ██████░░░░░░░░░░░░░░ 28%
- Plan & Design ███░░░░░░░░░░░░░░░░░ 13%
- Debug Fix ██░░░░░░░░░░░░░░░░░░ 10%
- Write Docs ██░░░░░░░░░░░░░░░░░░ 8%

Top Skills & Commands:

- `/grill-with-docs` ████████████████████ 22x/month
- `/triage` ██████████████░░░░░░ 15x/month
- `/archon` ████████████░░░░░░░░ 13x/month
- `/to-tickets` ████████░░░░░░░░░░░░ 9x/month
- `/tdd` ██████░░░░░░░░░░░░░░ 7x/month
- `/plugin-dev:skill-development` █████░░░░░░░░░░░░░░░ 6x/month
- `/skills` █████░░░░░░░░░░░░░░░ 6x/month
- `/archon-rollout` ████░░░░░░░░░░░░░░░░ 5x/month
- `/to-spec` ████░░░░░░░░░░░░░░░░ 5x/month

Counts are historical. `/to-tickets` and `/to-spec` carry the counts of `/to-issues` and `/to-prd`, which upstream renamed at v1.1.

Top MCP Servers:

- Context7 ████████████████████ 4 calls

## Your Setup Checklist

### Codebases

- [ ] unic-agents-plugins — <https://github.com/unic/unic-agents-plugins>

### MCP Servers to Activate

- [ ] Context7 — fetches current docs for libraries, frameworks, SDKs and CLI tools (so answers reflect recent API changes, not stale training data). It ships via the `context7` plugin; set `CONTEXT7_API_KEY` (or run `npx ctx7@latest login`) for higher rate limits.
- [ ] Figma Dev Mode MCP — optional, only needed when using `unic-spec-review` to review Figma designs; the `/unic-spec-review:spec-doctor` command fails loud if a pasted Figma link needs it and it is not connected.
- [ ] Playwright MCP — optional, only needed when using `unic-spec-review` to inspect a live production system; likewise checked by `/unic-spec-review:spec-doctor`.

### Skills to Know About

- [ ] /grill-with-docs — adversarial grilling of a plan against the project's domain model and ADRs, updating CONTEXT.md/ADRs inline as decisions firm up. The team's most-used skill: it stress-tests PR findings and locks designs before any code is written. At upstream v1.1 it thinned to a composition of `/grilling` + `/domain-modeling`, and hands the bigger jobs to `/wayfinder`.
- [ ] /wayfinder — the other half of that split, and where upstream moved the planning weight. Charts work too big for one agent session as a `wayfinder:map` issue with child decision tickets, blocked by GitHub's native issue dependencies, and works the frontier one ticket at a time. Reach for it when `/grill-with-docs` would run out of context.
- [ ] /triage — moves issues through the 8-state triage workflow; the default for "where do I stand" on open issues and the on-ramp for raw work. It is no longer a gate after `/to-tickets` — that approval happens inside the skill.
- [ ] /archon — runs AI workflows in isolated git worktrees for parallel development; the basis of the team's custom delivery harness.
- [ ] /archon-rollout — dispatches `archon-fix-github-issue` per issue respecting the dependency tree, with standing guardrails and a deduped monitor; the team's way of shipping a chain of ready-for-agent issues.
- [ ] /to-tickets — breaks a spec into independently-grabbable issues using tracer-bullet vertical slices. Replaced `/to-issues` at upstream v1.1.
- [ ] /to-spec — turns the current conversation into a spec and publishes it to the issue tracker. Replaced `/to-prd` at upstream v1.1.
- [ ] /tdd — test-first red-green-refactor loop for building features and fixing bugs.
- [ ] /implement — takes a ticket from spec to working code.
- [ ] /plugin-dev:skill-development — guidance for authoring and improving Claude Code skills.
- [ ] /unic-pr-review:review-pr — multi-agent Azure DevOps PR review (intent checking, Confidence-scored Findings, interactive Approval Loop); the v2 successor to the deprecated `pr-review` plugin.
- [ ] /unic-spec-review:review-spec — adversarial eleven-agent review of Confluence web specs (plus Figma and live-system sources), posting selected Findings back as Confluence comments.

## Team Tips

- **Gitflow, always via PR.** Branch from `develop`, PR back to `develop`; `main` only takes release merges. Use `feature/<name>` for all develop-targeting work (features _and_ bugs); `hotfix/` is reserved for fixes branched off `main`. Small doc/housekeeping changes can go straight to `develop`.
- **Run the verification loop before pushing.** `pnpm ci:check` (not just `pnpm format` — Biome's import sorting is not auto-fixed by `format`), then `pnpm test` and `pnpm typecheck`. CI runs all three OSes × Node 22/24, so check cross-platform assumptions (use `node:path`/`node:fs`, not shell commands).
- **Versioning is scripted.** Bump with `pnpm --filter <plugin> bump <patch|minor|major>` — never hand-edit `marketplace.json`. CHANGELOG headers must be `## [X.Y.Z] — YYYY-MM-DD`, and `verify:changelog` gates any PR that touches guarded files (commands, scripts, `plugin.json`, plugin `README.md`).
- **Never create or delete `LICENSE` files** — the maintainer manages those by hand in every package.
- **Spec-first delivery.** Work flows `/wayfinder` (or `/grill-with-docs` when it fits in one session) → `/to-spec` → `/to-tickets` → `/archon-rollout`. `/to-tickets` publishes `ready-for-agent` tickets only after you approve its breakdown in-session — that approval is the only gate before an agent picks the work up, so read the acceptance criteria there. `/to-spec` labels the spec issue the same way, and that one is not implementable: check an Issue has `## What to build` before dispatching it.
- **Trust CI on GitHub, not an agent's self-report.** When an Archon run reports "all green / mergeable," confirm with `gh pr checks <n>` before merging — the run summary and its exit code can both mislead.

## Get Started

A good first task is getting the workspace green locally:

1. `pnpm install`
2. `pnpm ci:check && pnpm test && pnpm typecheck` — all should pass on a clean `develop`.
3. Skim [`CONTEXT-MAP.md`](CONTEXT-MAP.md) at the repo root to see the bounded contexts, then read one plugin's `CONTEXT.md` and its `docs/adr/` to learn how decisions are recorded.

From there, run `/triage` to see where open issues stand, and pick up a `ready-for-agent` issue or pair on a triage pass.

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
