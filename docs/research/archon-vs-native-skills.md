# Archon vs Native Claude Code Primitives

**Research question:** Can the `unic-archon-dlc` workflow be implemented entirely with native Claude Code primitives, dropping Archon as a runtime dependency?

**Scope:** The six-workflow DLC (explore, plan, run, qa, cleanup, triage) as specified in `docs/issues/unic-archon-dlc/PRD.md`.

**Date:** 2026-05-14

---

## Part 1 — Claude Code Native Primitives (what this repo actually has)

### Execution primitives

| Primitive                             | Mechanism                                                                                                                                | Evidence in repo                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Subagent spawning**                 | `Agent tool` with `subagent_type: general-purpose`                                                                                       | `implement-feature` SKILL.md step 4; `/tdd` AFK prompt template                               |
| **Sequential DAG (topological)**      | Skill reads `## Blocked by` edges, computes topo sort in-context, calls subagents one at a time                                          | `implement-feature` SKILL.md steps 3–6; `docs/agents/feature-runner.md`                       |
| **Loop with exit condition**          | `ralph-loop` plugin (Stop hook intercepts exit, re-feeds prompt); `LOOP_COMPLETE` signal pattern; `/loop /implement-feature` composition | `ralph/afk.sh`; `ralph/PROMPT.md`; ralph-loop plugin README                                   |
| **AFK batch runner**                  | `ralph/afk.sh` — docker sandbox, `--print --output-format stream-json`, iterates N times, stops on `<promise>LOOP_COMPLETE</promise>`    | `ralph/afk.sh`; `ralph/once.sh`                                                               |
| **Session-scoped recurring task**     | `CronCreate` tool — in-memory cron, fires while REPL is idle, auto-expires in 7 days                                                     | Deferred tool schema                                                                          |
| **Persistent remote-scheduled agent** | `RemoteTrigger` tool — creates claude.ai routines with cron schedules that survive session exit                                          | Deferred tool schema                                                                          |
| **Isolated branch per feature**       | `EnterWorktree` / `ExitWorktree` tools + `git worktree add .claude/worktrees/<slug>`                                                     | `implement-feature` SKILL.md step 2; `feature-runner.md`                                      |
| **Bash nodes**                        | `Bash tool` inside any skill/agent; hooks (PreToolUse, PostToolUse) run Node.js scripts on every file edit                               | `.claude/hooks/block-lockfile.mjs`; `.claude/hooks/test-on-edit.mjs`; `.claude/settings.json` |
| **Hook-triggered side effects**       | `PreToolUse` / `PostToolUse` hooks — run arbitrary Node.js scripts before/after any tool call                                            | `.claude/settings.json`                                                                       |

### State / persistence primitives

| Primitive                          | Mechanism                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Cross-session persistence**      | Markdown files committed to git (`docs/issues/`, `docs/workflow/`) — agents read them at start of each session |
| **Transient within-session state** | In-context memory; temp files the skill writes and reads during one run                                        |
| **Status machine**                 | 8-state vocabulary encoded in `**Status:**` frontmatter of issue `.md` files                                   |
| **Durable cron jobs**              | `CronCreate` with `durable: true` — persists to `.claude/scheduled_tasks.json`, survives restart               |

### Human interaction primitives

| Primitive                     | Mechanism                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Interactive gate (HITL)**   | Issue `**Type:** HITL` — `ralph/PROMPT.md` explicitly skips HITL issues; human resolves them manually before next AFK run |
| **HITL bash script template** | `diagnose/scripts/hitl-loop.template.sh` — structured step/capture helpers for human-in-the-loop shell sessions           |
| **Approval before PR**        | `implement-feature` runs unattended but opens a PR — GitHub/ADO PR review is the approval gate                            |

### Skills available as workflow nodes

Skills are loaded by the `Skill tool` inside any Agent call. The following are installed and relevant:

- `/tdd` — red-green-refactor loop, used as the implementation node in `implement-feature`
- `/grill-with-docs` — adversarial interview that writes ADRs live (maps to the `specs` node)
- `/grill-me` — general design interview (maps to early `specs` node)
- `/to-prd` — synthesise session into a PRD (maps to the `to-prd` node)
- `/to-issues` — decompose PRD into vertically-sliced issues (maps to the `to-issues` node)
- `/triage` — 8-state issue lifecycle management
- `/improve-codebase-architecture` — post-implementation arch review (maps to `arch-review`)
- `/diagnose` — systematic debugging loop
- `/implement-feature` — topological issue runner (maps to the `run` workflow)
- `/verify-spec` — check acceptance criteria against codebase

### What is NOT a native primitive

- No declarative DAG file format (no YAML runtime)
- No named node types in a schema (prompt / loop / bash / interactive are informal categories, not runtime constructs)
- No `$ARTIFACTS_DIR` convention — agents write to arbitrary paths they agree on
- No built-in parallel fan-out within a single session (true simultaneity requires multiple running `claude` processes)
- No loop node with a configurable `max_iterations` field in a config file — must be encoded in skill prose or passed as a `--max-iterations` flag to `ralph-loop`
- No interactive node schema — HITL is a convention (issue type field + manual step), not a runtime gate that pauses and waits

---

## Part 2 — Archon Primitives

Based on Archon (github.com/coleam00/Archon) documentation and the PRD's design decisions:

### Core runtime concepts

| Archon concept                  | What it does                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **YAML DAG**                    | Workflow defined as a `.yaml` file with named nodes, `depends_on` edges, `type:` field                                                 |
| **Node types**                  | `prompt` (LLM call), `loop` (repeat until condition or max iterations), `bash` (shell command), `interactive` (pause for human input)  |
| **`depends_on`**                | Explicit dependency edge between nodes — Archon resolves execution order and runs nodes in parallel when no dependency exists          |
| **Parallel execution**          | Nodes with no shared dependency run concurrently by the runtime — no extra scripting needed                                            |
| **`interactive: true` node**    | Runtime pauses, presents output to human in the Archon UI, resumes after approval — a first-class synchronous gate                     |
| **`loop` node**                 | Runs a child node repeatedly, with `condition:` (exit when true) and `max_iterations:` (hard cap) as YAML fields                       |
| **`$ARTIFACTS_DIR`**            | Runtime-managed ephemeral directory per workflow run — all nodes share it, nothing is committed                                        |
| **Command files**               | `.md` files that define an Archon slash-command; analogous to Claude Code `.claude/commands/`                                          |
| **Dynamic workflow generation** | A `bash` node can write a new `.yaml` file to `.archon/workflows/`; the runtime can then invoke it (the `yaml-gen` pattern in the PRD) |

### Key architectural property

Archon is an **external runtime** that runs workflows, not a model-side construct. The YAML DAG is parsed by the Archon process; Claude is called as a tool inside each `prompt` node. This means:

- Parallelism is real OS-level concurrency (multiple Claude calls in-flight simultaneously)
- Human gates (`interactive: true`) pause the Archon process, not the Claude context window
- `$ARTIFACTS_DIR` is a filesystem path managed by Archon, not an in-context convention
- Loop state (iteration count, last result) is tracked by the Archon process

---

## Part 3 — Gap Analysis

For each of the 8 workflow requirements:

### Req 1 — Parallel execution (4 research agents simultaneously)

**Archon:** Native. Nodes with no `depends_on` run in parallel by the runtime. The explore workflow's four research agents (stack, features, architecture, pitfalls) are simply four sibling nodes.

**Claude Code native:**

- `implement-feature` runs issues sequentially, one at a time (topological order, single agent at a time).
- True parallelism would require spawning multiple `claude` processes from a bash script (e.g., `afk.sh`-style with `&` and `wait`), or calling the Claude API directly from a Node.js orchestrator.
- The `Agent tool` inside a skill can only be called sequentially within one Claude session — there is no "call four Agents in parallel" capability natively.
- The `ralph-loop` pattern and `implement-feature` are single-threaded by design.

**Verdict:** Gap. Achievable with a custom Node.js orchestrator that spawns four `claude --print` processes in parallel and collects their outputs, but this is substantial custom infrastructure — not a native primitive.

---

### Req 2 — Sequential DAG with dependency resolution

**Archon:** Native via `depends_on` edges in YAML. Runtime resolves order automatically.

**Claude Code native:**

- `implement-feature` implements this fully in skill prose: reads `## Blocked by` from each issue file, computes topological sort in-context, executes issues in that order.
- Conflict detection, missing-blocker check, and unsatisfied-dependency check are all implemented.
- The DAG is derived from markdown files, not a YAML schema, but the behaviour is equivalent for serial execution.

**Verdict:** Covered. The `implement-feature` skill already solves this for serial execution. The gap is only parallelism (Req 1), not ordering.

---

### Req 3 — Loop nodes (repeat until condition, max iterations)

**Archon:** Native. `type: loop` with `condition:` and `max_iterations:` as YAML fields. Stall detection requires custom logic inside the loop body.

**Claude Code native:**

- `ralph-loop` plugin implements this via a Stop hook: intercepts exit, re-feeds the same prompt, stops on a completion promise string or `--max-iterations`.
- The `plan-checker` loop in the PRD (max 3 iterations, stall detection) maps cleanly onto `ralph-loop` with `--max-iterations 3` and a completion promise, plus inline stall detection logic written into the skill.
- `implement-feature` uses a `LOOP_COMPLETE` signal + `/loop` composition for the outer queue-drain loop.

**Verdict:** Covered. `ralph-loop` covers the loop primitive. Stall detection and iteration-count checks are written into skill prose — more verbose than a YAML field, but functionally equivalent.

---

### Req 4 — Interactive gates (pause, present to human, resume)

**Archon:** Native. `interactive: true` on any node suspends the Archon process and presents output in the UI. The human clicks approve/reject and the process resumes.

**Claude Code native:**

- No equivalent runtime gate exists. The closest pattern in this repo is the HITL issue type: an issue is tagged `**Type:** HITL`; the AFK runner skips it; the human resolves it manually; the next AFK iteration sees it resolved.
- This is asynchronous and session-boundary-crossing: the human approval happens between two separate `ralph` iterations, not within one.
- The `hitl-loop.template.sh` is for a human following a bash script to capture input — it does not pause a running agent.
- For synchronous interactive gates within a running session, there is no primitive. A skill could emit a question and wait for the human to type, but only in the interactive (non-AFK) mode.

**Verdict:** Partial gap. Asynchronous gates (across sessions) are handled by the HITL issue convention. Synchronous gates (pause a running AFK workflow mid-execution, wait for approval, resume) require either (a) running interactively rather than AFK, or (b) a custom orchestrator that polls for a "gate file" written by the human. This is the most significant functional gap.

---

### Req 5 — State persistence (survive session boundaries, resume AFK runs)

**Archon:** `$ARTIFACTS_DIR` for transient state; workflows can write to the project repo for persistence. Session boundary survival depends on Archon process management.

**Claude Code native:**

- This is a strength of the native approach: all state lives in git-committed markdown files (`docs/issues/<slug>/`, `docs/workflow/<slug>/`).
- `implement-feature` explicitly handles resumption: if `.claude/worktrees/<slug>` already exists, it reuses the worktree and skips already-`resolved` issues.
- `ralph/afk.sh` re-reads all issue files on every iteration — state is always read from disk, never from in-context memory.
- `CronCreate` with `durable: true` persists scheduled tasks to `.claude/scheduled_tasks.json` and survives restart.
- `RemoteTrigger` routines survive session exit entirely (server-side scheduling).

**Verdict:** Covered, and arguably stronger than Archon here. The git-based state model means state survives not just session boundaries but also machine reboots, re-clones, and context window resets. Archon's `$ARTIFACTS_DIR` is ephemeral by design.

---

### Req 6 — Bash nodes (git, gh, az, slopcheck as first-class steps)

**Archon:** Native. `type: bash` node runs a shell command. Output is captured and available to subsequent nodes as a named artifact.

**Claude Code native:**

- The `Bash tool` is available inside any skill or agent invocation. Agents routinely call `git`, `gh`, `pnpm`, etc.
- `test-on-edit.mjs` and `block-lockfile.mjs` hooks show that bash-equivalent logic (Node.js scripts) can be triggered automatically on tool use events.
- `PreToolUse` / `PostToolUse` hooks can run any shell command before or after any tool call.
- The `slopcheck` pattern (check package names before install) can be implemented as a `PreToolUse` hook on `Bash(npm install:*)` / `Bash(pnpm add:*)`.

**Verdict:** Covered. Every Archon `bash` node maps to a `Bash tool` call inside a skill. Hooks provide the "always-on" bash node equivalent for cross-cutting concerns.

---

### Req 7 — Dynamic workflow generation (`issues.json` → `run-<slug>.yaml`)

**Archon:** The `yaml-gen` bash node writes a new `.yaml` workflow file at runtime. Archon can then invoke it.

**Claude Code native:**

- The `implement-feature` skill already does the dynamic equivalent: it reads `## Blocked by` edges from issue markdown files, builds a topological execution queue at runtime, and runs it.
- There is no YAML file generated — the DAG is computed in-context and executed directly.
- For the specific `yaml-gen` → `run-<slug>.yaml` pattern (generating a file that a runtime then reads), this would be unnecessary in the native model: the orchestrator skill reads the dependency tree directly and drives execution without an intermediate file.
- If a YAML representation is desired for auditability (e.g., to commit `run-<slug>.yaml` to the repo as a record), a bash node/skill could write it — but nothing would "read and execute" it; it would just be a documentation artifact.

**Verdict:** Covered differently. Archon needs the YAML because the runtime is separate from the LLM. Native Claude Code collapses the orchestrator and the executor into the same agent — there is no separate runtime to hand the YAML to. The dynamic parallelisation logic lives in skill prose rather than a generated file. This is simpler but less auditable.

---

### Req 8 — Subagent spawning (each node spawns specialized subagents)

**Archon:** Each node is an isolated LLM call with its own system prompt, context, and tool access. "Subagent" is implicit — every node is effectively a fresh agent call.

**Claude Code native:**

- The `Agent tool` with `subagent_type: general-purpose` spawns a subagent that has access to all tools including the `Skill tool`.
- `implement-feature` uses this explicitly: each issue is handed to a subagent via `Agent tool`, which then loads `/tdd` via the `Skill tool` and runs it.
- Skills can be composed: the subagent prompt tells it to load `/tdd`, `/grill-with-docs`, `/to-issues`, etc.
- The subagent receives a constructed prompt (the tdd-prompt-template) rather than sharing the parent's context window, which is equivalent to Archon's per-node isolation.

**Verdict:** Covered. The `Agent tool` is the native subagent primitive. It is already used for this purpose in `implement-feature`. The main difference is that Claude Code subagents are serial (Req 1 gap), while Archon nodes can run in parallel.

---

## Part 4 — Trade-off Summary

### What you gain by being Archon-free

**1. No runtime dependency to install and maintain**
Archon must be on PATH in every target project. The install hook must verify it. Version drift between Archon and the plugin's YAML schema creates upgrade friction. Going native means `claude` is the only dependency — already required.

**2. Git is the state machine**
Archon's `$ARTIFACTS_DIR` is ephemeral. The native model stores everything in committed markdown, making state inspectable, diffable, and recoverable from any git checkout. This is a genuine advantage for long AFK runs.

**3. Simpler mental model for contributors**
The YAML DAG schema is an additional layer contributors must learn: node types, `depends_on` semantics, `interactive:` flags, `$ARTIFACTS_DIR` naming conventions. Native skills are just markdown with prose instructions — the same format contributors already use for everything else in this repo.

**4. Cross-platform by construction**
The monorepo's cross-platform requirement (macOS, Windows, Linux) is already met by Node.js hooks and pnpm. Archon's platform compatibility is a separate concern outside this repo's control.

**5. Composable with existing skills**
Native skills are already installed and working: `/grill-with-docs`, `/to-issues`, `/triage`, `/implement-feature`. A native DLC orchestrator would call these directly without re-implementing their logic in YAML nodes. Archon workflows would re-implement equivalent behaviour in isolation.

**6. No `$ARTIFACTS_DIR` coordination overhead**
Archon workflows that need to pass data between nodes must write to `$ARTIFACTS_DIR` with agreed filenames. Native agents pass data through the prompt context or git-committed files — no cross-node artifact naming convention required.

---

### What you lose or must build

**1. True parallel execution — must build**
Archon runs sibling nodes concurrently at the OS level. Native Claude Code has no equivalent. To run four research agents simultaneously, a custom orchestrator must spawn four `claude --print` subprocesses in parallel and collect their outputs. This is a ~50–100 line Node.js script (or bash with `&`/`wait`), but it is not a primitive — it must be built, tested, and maintained. Without it, the four explore agents run sequentially, making the explore workflow 4x slower.

**2. Synchronous interactive gates — must build or redesign**
Archon's `interactive: true` pauses a running workflow and waits for human approval inline. Native Claude Code has no synchronous pause primitive in AFK mode. Options:

- **Redesign as async gates:** split the workflow at each gate boundary into two separate runs. The first run writes a "gate file" or sets an issue to `ready-for-human`; the human approves and sets it to `ready-for-agent`; the second run picks up. This is the existing HITL convention and works well for planned gates, but requires the human to actively restart the run rather than clicking "approve" in a UI.
- **Run interactively at gate points:** the `ralph-loop` can be configured to not re-loop past a certain prompt, forcing the session to go interactive at gate boundaries. This is less clean than Archon's UI but functional.
- **Custom gate polling:** a bash node writes a gate file; a cron job or loop polls until a human edits the file; execution resumes. This is fragile and not recommended.

For the PRD's five explicit PR gates (after PRD, after plan-checker, after report, after UAT, per-ADR in cleanup), the async redesign is the right answer — these are naturally session-boundary events anyway.

**3. Declarative workflow schema — must decide if needed**
Archon provides a YAML file per workflow that is auditable, shareable, and human-readable as a process spec. Native skills encode the same logic in prose inside `SKILL.md`. This is a documentation trade-off, not a capability gap. If workflow auditability is important (e.g., for compliance or onboarding), a custom YAML schema for documentation purposes could be written separately from the execution layer, but nothing would "run" it — it would be a companion spec, not a DAG executor.

**4. Explicit artifact hand-off between phases — must define convention**
Archon's `$ARTIFACTS_DIR` is a named, scoped, automatically cleaned-up directory shared between nodes in one run. Native agents writing to `docs/workflow/<slug>/` achieve the same persistence but without automatic scoping or cleanup. The convention must be defined and enforced by skill prose (already done in the PRD's "Persistent artifact layout" section).

**5. `slopcheck` integration — must build**
The `slopcheck` bash node in the PRD calls an external Python tool. Native implementation requires either (a) a `PreToolUse` hook on `Bash(pnpm add:*)` that runs `slopcheck`, or (b) a skill step that explicitly calls `slopcheck` before any install command. Option (a) is more robust and is the natural hook-based pattern for this repo.

---

### Recommendation matrix

| Requirement                 | Archon                              | Native                               | Build cost if native                               |
| --------------------------- | ----------------------------------- | ------------------------------------ | -------------------------------------------------- |
| Parallel execution          | Native, zero cost                   | Gap — must build                     | Medium (parallel subprocess orchestrator ~100 LOC) |
| Sequential DAG              | Native                              | Covered (`implement-feature`)        | None                                               |
| Loop nodes                  | Native                              | Covered (`ralph-loop`)               | None                                               |
| Interactive gates (sync)    | Native                              | Partial gap — redesign as async      | Low (async HITL convention already exists)         |
| State persistence           | Native (ephemeral `$ARTIFACTS_DIR`) | Better (git-committed markdown)      | None — advantage                                   |
| Bash nodes                  | Native                              | Covered (`Bash tool`, hooks)         | None                                               |
| Dynamic workflow generation | Native                              | Covered differently (in-context DAG) | None — no YAML file needed                         |
| Subagent spawning           | Native                              | Covered (`Agent tool`)               | None                                               |

**Net verdict:** 6 of 8 requirements are covered natively with zero build cost. The two gaps are:

1. **Parallel execution** — medium build cost, real performance difference (4× slower explore phase without it).
2. **Synchronous interactive gates** — low redesign cost; the async HITL convention already in this repo is a viable substitute and arguably more appropriate for long AFK workflows.

---

### Recommended path

**Drop Archon. Build one thin parallel orchestrator.**

The native approach covers everything except true parallelism. For the explore workflow's four-agent fan-out, build a `parallel-agents.mjs` helper (a thin Node.js wrapper that spawns N `claude --print` subprocesses, waits for all to complete, and concatenates their outputs into a single artifact file). This becomes one reusable utility that can be called from any skill via the `Bash tool`.

All five interactive gates should be redesigned as async HITL checkpoints using the existing issue-status convention. Each gate becomes an issue with `**Type:** HITL` that the human resolves before the next run phase begins. This is already the model used everywhere else in this repo.

The result is a plugin that:

- Ships no external runtime dependency
- Stores all state in git (inspectable, resumable, diffable)
- Uses the same skill/hook/worktree primitives contributors already know
- Requires one new ~100 LOC Node.js utility for parallel fan-out
- Trades Archon's synchronous UI gate for the repo's established async HITL convention

---

## Appendix — Primitive inventory used in this analysis

| File / location                                                                                                                                       | Primitive demonstrated                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/.claude/skills/implement-feature/SKILL.md`                                                       | Sequential DAG, topo sort, subagent spawning via Agent tool, worktree creation, LOOP_COMPLETE signal |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/docs/agents/feature-runner.md`                                                                   | Feature runner lifecycle, HITL convention, resumption model                                          |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/ralph/afk.sh`                                                                                    | AFK loop runner, docker sandbox, LOOP_COMPLETE detection                                             |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/ralph/once.sh`                                                                                   | Single-iteration interactive runner                                                                  |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/ralph/PROMPT.md`                                                                                 | Orchestrator prompt: task selection, AFK vs HITL split, topo execution                               |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/.claude/settings.json`                                                                           | PreToolUse / PostToolUse hook configuration                                                          |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/.claude/hooks/test-on-edit.mjs`                                                                  | PostToolUse bash node pattern (run tests on file edit)                                               |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/.claude/hooks/block-lockfile.mjs`                                                                | PreToolUse guard node pattern                                                                        |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/.claude/worktrees/agent-a1096a15cf10bf77b/.agents/skills/diagnose/scripts/hitl-loop.template.sh` | HITL bash script template                                                                            |
| `/Users/oriol.torrent/.claude/plugins/cache/claude-plugins-official/ralph-loop/1.0.0/README.md`                                                       | ralph-loop plugin: Stop hook loop, completion promise, max-iterations                                |
| `CronCreate` deferred tool                                                                                                                            | Session-scoped and durable cron scheduling                                                           |
| `RemoteTrigger` deferred tool                                                                                                                         | Server-side persistent routine scheduling                                                            |
| `EnterWorktree` / `ExitWorktree` deferred tools                                                                                                       | Worktree session management                                                                          |
| `/Users/oriol.torrent/Sites/UNIC/unic-agents-plugins/docs/issues/unic-archon-dlc/PRD.md`                                                              | Full plugin specification, Archon concepts, design decisions                                         |
