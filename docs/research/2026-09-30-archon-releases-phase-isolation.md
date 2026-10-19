# Archon releases after 0.7.0: running one loop phase with its own settings, 2026-09-30

Research for [#632](https://github.com/unic/unic-agents-plugins/issues/632), which
[#540](https://github.com/unic/unic-agents-plugins/issues/540) is blocked by, under the map
[#538](https://github.com/unic/unic-agents-plugins/issues/538).

**Question.** What do the Archon releases after 0.7.0, up to the latest published one, offer a Box
for running one phase of one slice with its own tools, config and rules? The use case is a phase
that writes a characterisation test and should not read the application source.

**Scope.** Releases 0.7.1, 0.8.0, 0.9.0, 0.10.0, 0.10.1, 0.11.0 and 0.11.1. 0.11.1 is the latest
published release (25 September 2026). 0.10.1 is installed locally. 0.11.x is not.

## Sources

Every claim below cites one of these. The upstream repository is
[coleam00/Archon](https://github.com/coleam00/Archon), as `brew info archon` names it.

| Id    | Source                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CL    | [`CHANGELOG.md` at `v0.11.1`](https://github.com/coleam00/Archon/blob/v0.11.1/CHANGELOG.md), one section per release. The GitHub release notes for 0.7.1, 0.8.0, 0.10.0 and 0.10.1 carry only install text, so the changelog is the release record for those |
| RN    | [GitHub release notes](https://github.com/coleam00/Archon/releases) for 0.9.0 and 0.11.0, which match CL                                                                                                                                                     |
| AW    | [`guides/authoring-workflows.md` at `v0.11.1`](https://github.com/coleam00/Archon/blob/v0.11.1/packages/docs-web/src/content/docs/guides/authoring-workflows.md), the source of the archon.diy authoring guide                                               |
| LN    | [`guides/loop-nodes.md` at `v0.11.1`](https://github.com/coleam00/Archon/blob/v0.11.1/packages/docs-web/src/content/docs/guides/loop-nodes.md), the source of the archon.diy loop guide                                                                      |
| DN    | `packages/workflows/src/schemas/dag-node.ts` at `v0.7.0`, `v0.8.0`, `v0.9.0`, `v0.10.1` and `v0.11.1`                                                                                                                                                        |
| DX    | `packages/workflows/src/dag-executor.ts` at `v0.7.0` and `v0.11.1`                                                                                                                                                                                           |
| CP    | `packages/providers/src/claude/provider.ts` at `v0.11.1`                                                                                                                                                                                                     |
| DIR   | [`.archon/maintainer-standup/direction.md` at `v0.11.1`](https://github.com/coleam00/Archon/blob/v0.11.1/.archon/maintainer-standup/direction.md), recorded by [PR #2638](https://github.com/coleam00/Archon/pull/2638)                                      |
| PR    | [PR #3406](https://github.com/coleam00/Archon/pull/3406), "honor loop configuration and report ignored fields", merged 21 September 2026                                                                                                                     |
| PROBE | `archon validate workflows` on the installed 0.10.1 binary (build `9820785c`), run on a scratch workflow. It validates only; no workflow was run                                                                                                             |
| SBX   | Claude Code docs, [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)                                                                                                                                                            |
| PERM  | Claude Code docs, [Configure permissions](https://code.claude.com/docs/en/permissions)                                                                                                                                                                       |
| SDKP  | Claude Agent SDK docs, [Configure permissions](https://code.claude.com/docs/en/agent-sdk/permissions)                                                                                                                                                        |

## Answers

### 1. Can a Sub-run fan out over runtime data, or run inside a `loop:` iteration?

**Fan-out over runtime data: yes, from 0.8.0.**

- 0.7.0 shipped the `workflow:` node with dynamic fan-out, per-child worktrees, racing and `with:`
  reserved and rejected. (CL § 0.7.0 Added)
- 0.8.0 adds `fan_out: { items, max_parallel, join }`, which starts one governed child run per item
  of a runtime list. Results come back as a JSON array in item order. (CL § 0.8.0 Added, #2224)
- 0.8.0 adds `isolation: worktree` on a `workflow:` node, so each child can get its own checkout
  and branch. (CL § 0.8.0 Added, #2223)
- 0.9.0 adds `inputs:`, `returns:` and `with:` on sub-runs. (CL § 0.9.0 Added, #2523)
- 0.10.0 adds `fan_out.as`, which names the current item as `$INPUTS.<as>` in each child. It also
  keeps structured values typed across `with:`, child runs and fan-out aggregates. (AW § The four
  fields; CL § 0.10.0 Added, #2637)
- `items` must be a `$node.output` reference that resolves to a JSON array at run time, from an
  upstream node. A list of slices read from `issues.json` by a `bash:` or `script:` node fits that
  shape. (AW § The four fields)

Limits that matter for `/build` (AW § Fanning out over a list with `fan_out:`):

- A child that pauses at a gate fails the fan-out node. Gates must sit before or after the fan-out.
- Children in the parent's checkout take a path lock. The engine refuses the expansion unless the
  child declares `mutates_checkout: false`, the node sets `isolation: worktree`, or
  `max_parallel: 1` runs the children one at a time.
- An isolated child's worktree is cut from the repository's base branch, not from the parent's
  branch. It sees neither the parent's uncommitted edits nor the parent's commits, and nothing
  merges its commits back. (AW § What `isolation: worktree` gives you)
- `retry:` is not allowed on a `workflow:` node. (AW § Gates, failure, and cost)

**Inside a loop iteration: no, in every release up to 0.11.1.**

- A `loop:` node iterates one `prompt` or `command`. It has no node body, so it cannot hold a
  `workflow:` node. (LN § Configuration Fields; AW § Node Fields)
- A `workflow:` node, fanned out or not, is rejected inside a `loop_group` body at load time.
  (AW § Non-goals (this slice), citing [#2439](https://github.com/coleam00/Archon/issues/2439);
  LN § Reusing a block in the body)
- PROBE confirms it on 0.10.1: the loader refuses the file with `loop_group 'lg2' body: 'workflow'
(sub-run) is not supported inside a loop_group body`.

### 2. Do a Sub-run's nodes keep their own settings?

**Yes. The child is a separate workflow, and its nodes run on what the child's YAML declares.**

- A `workflow:` node makes no provider call. Every AI field set on the `workflow:` node itself is
  ignored, and "the child's own nodes carry theirs". This holds in 0.7.0. (DN `v0.7.0`,
  `WORKFLOW_NODE_IGNORED_FIELDS`)
- The caller may bind inputs and choose isolation. It cannot override the child's provider, model,
  reasoning, tools or capability policy. (DIR § governed-launch-ownership, recorded by #2638,
  which CL § 0.10.0 Changed lists)
- `allowed_tools`, `denied_tools`, `sandbox`, `mcp`, `hooks`, `skills` and `settingSources` are
  node fields on `command` and `prompt` nodes, so they travel with the child's nodes. (AW § Node
  Fields)
- From 0.9.0, a Claude node sees only the skills and MCP servers its YAML declares. Ambient user,
  project and plugin MCP configuration no longer reaches it. (CL § 0.9.0 Breaking, #2535)
- From 0.11.0, a `workflow:` node may not declare `output_format`. The child's `returns:` node owns
  the result. (CL § 0.11.0 Breaking, #3148)
- `context`: the child is a separate run, so its nodes' `context` settings apply inside that run.
  UNVERIFIED: no source states whether a child's first node can see the parent's session. AW
  states the rule only for `include:`, whose entry node starts a fresh session. (AW § What travels)

### 3. Is there a read restriction by path, and does it cover Read, Grep and Glob?

**No release after 0.7.0 adds a new one.** Two mechanisms that already exist in 0.7.0 together
cover both Bash and the built-in file tools, on Claude nodes only.

**`sandbox.filesystem.denyRead` covers Bash only.**

- The node `sandbox` schema has `filesystem.denyRead` in 0.7.0 and in 0.11.1. (DN `v0.7.0` and
  `v0.11.1`, `sandboxSettingsSchema`)
- Archon passes `sandbox` to the Claude Agent SDK as it is. (CP, `options.sandbox`)
- The sandbox "applies only to Bash, PowerShell, and Monitor commands and their child processes".
  Read, Edit and Write "use the permission system directly rather than running through the
  sandbox". (SBX § Permission rules, § Scope)

**`Read(path)` deny rules in `denied_tools` cover Read, and Grep and Glob on a best-effort basis.**

- Archon passes `denied_tools` to the SDK's `disallowedTools` as it is. (CP)
- A scoped entry such as `Read(./src/**)` is a deny rule. It blocks matching calls in every
  permission mode, including `bypassPermissions`, which is the mode Archon sets. (SDKP § How
  permissions are evaluated, § Allow and deny rules; CP, `permissionMode: 'bypassPermissions'`)
- Claude "makes a best-effort attempt to apply `Read` rules to all built-in tools that read files
  like Grep and Glob". Grep and Glob check the directory their `path` resolves to. (PERM § Read and
  Edit)
- Read deny rules also cover Bash file commands Claude Code recognises, such as `cat` and `head`.
  They do not cover `grep -r pattern .` or a script that opens files itself. The docs point to the
  sandbox for that case. (PERM § Read and Edit)
- PROBE: on 0.10.1 a body node with `denied_tools: ["Read(./src/**)", "Grep(./src/**)"]` and a
  `sandbox.filesystem.denyRead` validates with no warning. UNVERIFIED: that Archon enforces the
  scoped entries at run time. No run was made, and no Archon document names scoped entries in
  `denied_tools`.

A per-node `hooks.PreToolUse` hook is a third way to refuse a tool call by path. It is Claude only,
and it predates 0.7.0. (AW § Node Fields; SDKP § How permissions are evaluated)

`mutates_checkout: false`, enforced from 0.10.0, fails a node that writes to the checkout. It does
not restrict reads. (CL § 0.10.0 Added, #2789)

### 4. Other ways one phase of a loop runs with settings different from the loop's

**`loop_group` body nodes, before and after 0.7.0.** A `loop_group` body is an ordinary `nodes`
array, and each body node keeps its own node fields.

- The body may hold any node type. (DN `v0.11.1`, `loopGroupNodeConfigSchema`)
- Body nodes re-enter the normal layer runner, and a `command` or `prompt` body node resolves its
  own `allowed_tools`, `denied_tools`, `sandbox`, `mcp`, `hooks` and `skills`. This is so in
  0.7.0 and in 0.11.1. (DX `v0.7.0` and `v0.11.1`, `executeLoopGroupBody` calls `runLayers`, and
  `resolveNodeProviderAndModel` builds `nodeConfig` from the node's own fields)
- `model` and `provider` on the group become defaults for body nodes, and a body node can override
  them. (LN § Configuration fields)
- `loop_group` itself dates from 0.6.0. (CL § 0.6.0, #2032) So a test-writing phase with its own
  tool list and a separate implementing phase can run in one iteration on 0.7.0 already.
- PROBE: on 0.10.1 a body node carrying `allowed_tools`, `denied_tools` and `sandbox` produces no
  ignored-field warning.

Two limits on `loop_group` bodies (LN § What is NOT supported on loop_group nodes (v1)):

- On a failure resume the group restarts from iteration 1. There is no per-body-node resume.
- `context: { resume: <node> }` is not supported inside a body. (AW § Addressable session
  ancestry)

**`include:` inside a `loop_group` body, from 0.10.0.**

- A reusable block can be included in a body and runs on every iteration. (CL § 0.10.0 Added,
  #2641; LN § Reusing a block in the body)
- From 0.10.0, an included block runs on its own workflow-level `provider`, `model`, `effort`,
  `fallbackModel`, `betas` and `sandbox`, written onto its own nodes. So one phase can live in its
  own file with its own rules. (CL § 0.10.0 Breaking, #2604; AW § What travels)

**The `loop:` node's own tool settings, from 0.11.0.** These apply to every iteration, not to one
phase.

- Up to 0.10.1, a `loop:` node ignores `allowed_tools` and `denied_tools`. (DN `v0.8.0`, `v0.9.0`
  and `v0.10.1`, `LOOP_NODE_AI_FIELDS`) PROBE confirms it on 0.10.1: the loader logs
  `loop_node_ai_fields_ignored` for `allowed_tools`, `denied_tools`, `hooks` and `sandbox`.
- 0.11.0: "Loop nodes honor their provider, model, tool and timeout settings". (CL and RN § 0.11.0
  Fixed, #3406) A `loop:` node now passes `allowed_tools` and `denied_tools` to the provider on
  every iteration. (DN `v0.11.1`, `loopAiAuthoringSchema`; LN § What works on loop nodes; PR)
- `hooks`, `mcp`, `skills` and `sandbox` are still ignored on a `loop:` node in 0.11.1. (DN
  `v0.11.1`, `LOOP_NODE_AI_FIELDS`; LN § What is NOT supported on loop nodes)
- A `loop:` node gains `output_format` and `loop.until_field` in 0.10.0. (CL § 0.10.0 Added, #2588)

**Settings that differ per node, not per loop.**

- Per-node `settingSources`, added in 0.7.0, chooses which setting sources a Claude node loads,
  including the project's `.claude/` skills, commands and agents. (CL § 0.7.0 Added, #2216; AW §
  Claude SDK Advanced Options)
- Per-run `--config <file>` and `--model <tier>=<model>` from 0.10.0 apply to a whole run, not to
  one phase. (CL § 0.10.0 Added, #2790, #2784)

## Consequences for this repository

These are facts to carry into [#540](https://github.com/unic/unic-agents-plugins/issues/540). This
note decides nothing for `/build`.

- `.claude/skills/archon/references/parameter-matrix.md` says a `loop:` node ignores
  `allowed_tools` and `denied_tools`. That is true up to 0.10.1 and false from 0.11.0.
- `apps/claude-code/unic-archon-dlc/docs/adr/0033-archon-070-schema-target.md` names upstream
  fan-out and `with:` over a dynamic list as the trigger to revisit Sub-runs. 0.8.0 and 0.9.0
  shipped both. A Sub-run still cannot run inside a `loop:` or `loop_group` iteration.
- The per-phase shape that needs no Sub-run is a `loop_group` whose body has one node per phase,
  each with its own `allowed_tools`, `denied_tools` and `sandbox`. It is available on 0.7.0.

## Open items

- UNVERIFIED: runtime enforcement of scoped `Read(...)`, `Grep(...)` and `Glob(...)` entries in
  `denied_tools` through Archon. Settle it with one real run of a body node that tries to read a
  denied path, on the target Archon version.
- UNVERIFIED: whether a `workflow:` child's first node can see the parent's session.
- UNVERIFIED: whether `include:` with `fan_out:` is accepted inside a `loop_group` body. No source
  states it either way.
