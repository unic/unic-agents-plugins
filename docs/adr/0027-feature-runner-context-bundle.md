# 0027. Feature Runner injects a scoped context bundle into every `/tdd` sub-agent invocation

**Status:** Accepted (2026-05)

## Context

The Feature Runner invokes `/tdd` as a non-interactive sub-agent (via the Agent tool) for each issue in a feature. The first draft of the Feature Runner PRD specified "the issue file content as context" as the sole input to each `/tdd` invocation.

This is insufficient. `/tdd` is designed to be interactive: its planning phase asks the user to confirm interface changes and approve which behaviours to test before writing any code. In AFK mode there is no user to ask. Without additional context, `/tdd` reasons from a single vertical slice with no access to the "why" behind the feature, the architectural constraints that apply, or the vocabulary the codebase uses. This creates a risk of a correct-but-wrong implementation — code that satisfies the issue's literal description but diverges from the intent established during the grilling and PRD sessions.

Matt Pocock's reference AFK loop (`afk.sh`) injects all issue files plus recent commits as a single prompt string before invoking `/tdd`, establishing the precedent that the agent needs broader context than a single work item.

## Decision

The Feature Runner assembles a **context bundle** for each `/tdd` sub-agent invocation:

1. **Issue file** — `## What to build` and `## Acceptance criteria` serve as the pre-answered planning conversation (see ADR-0029).
2. **PRD** — resolved from the issue's `## Parent` link. Carries the shared vision from the grilling session and the "why" behind the feature. Without it, the agent lacks the context needed to judge correctness beyond the literal issue description.
3. **Sibling issue files** — all other `NN-*.md` files in the feature directory. Provides dependency awareness and a "what is already resolved" signal without requiring the runner to summarise prior work.
4. **Scoped CONTEXT.md** — the domain glossary for the feature's domain (see scoping rule below). Ensures test names and interface vocabulary match the project's language.
5. **Scoped ADRs** — the architectural decisions constraining the implementation (see scoping rule below).
6. **Recent commits** — the last 5 git commits. The grilling and PRD process typically produces changes to CONTEXT.md and ADRs that land in commits before the Feature Runner runs. These commits carry the ideation trail that informed the PRD.

### ADR scoping rule

ADRs and CONTEXT.md are scoped to the domain of the feature, not the monorepo:

- **Plugin feature** (PRD references paths under `apps/claude-code/<plugin>/`) → inject that plugin's `docs/adr/` and `CONTEXT.md`.
- **Repo/tooling feature** (PRD references paths outside `apps/`, e.g. `.claude/`, `docs/`, `packages/`) → inject the root `docs/adr/` and root `CONTEXT.md`.

Scope is inferred by scanning the PRD for `apps/claude-code/<plugin>` path references. Root ADRs cover versioning, tagging, and CI tooling — they are noise for plugin implementation work and must not be injected into plugin feature runs.

## Considered options

- **Lazy discovery** — let `/tdd` explore the codebase and find ADRs and CONTEXT.md on its own. Rejected: `/tdd` does instruct the agent to use the domain glossary and respect ADRs, but in non-interactive sub-agent mode this exploration is unreliable. Injection is guaranteed; discovery is not.
- **Issue file only** — the minimal approach from the first PRD draft. Rejected: `/tdd` loses the PRD's "why", the sibling issues' dependency signal, and the architectural constraints, all of which are needed to produce implementations that match the grilled intent.
- **Inject everything** — all ADRs from all directories. Rejected: root ADRs are irrelevant to plugin work and add context noise without signal.

## Consequences

- The Feature Runner skill must resolve the `## Parent` link in each issue file to obtain the PRD path before building the bundle.
- The Feature Runner skill must scan the PRD for `apps/claude-code/<plugin>` references to determine which CONTEXT.md and ADR directory to inject.
- Issue files that omit `## Parent` (i.e. are not linked to a PRD) cannot be run by the Feature Runner without manual intervention.
- The context bundle grows with the number of sibling issues; for features with many issues, later invocations carry more sibling context than earlier ones. This is acceptable — it mirrors the growing "what is done" signal available in real commits.
