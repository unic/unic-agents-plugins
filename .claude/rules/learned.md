## Learned Repository Facts

- `git worktree add <dir> -b <branch> origin/develop` sets the new branch to track `origin/develop`, so a bare `git push` goes to `develop`, and the Archon pre-push guard does not refuse it. Add `--no-track`, or run `git branch --unset-upstream`, then push with `-u origin <branch>`. (2026-09-28)
- Subagent frontmatter takes `tools` and `disallowedTools`. `allowed-tools` is not a subagent field, so an agent that declares only `allowed-tools` inherits every tool. (2026-09-28)
- A skill that runs through `/loop` or the Skill tool must not set `disable-model-invocation: true`. The Skill tool refuses such a skill, which is how `afk-loop` broke under `/loop`. (2026-09-28)
- A new plugin must be added to the `tag_if_changed` list in `.github/workflows/release.yml` as well as to `ci.yml`. Without that line, the release workflow on `main` never creates the plugin's tag. (2026-09-28)
- When a repo skill depends on a plugin, such as `afk-loop` on `pr-review-toolkit`, enable that plugin under `enabledPlugins` in the committed `.claude/settings.json`, so every developer who clones the repo has it. (2026-09-28)
- Session opener comments on issues start with `**Opener`, in bold. A filter for comments that start with `Opener` finds nothing, so match the bold prefix. (2026-09-28)
- In Archify diagrams, a node's `tag` renders with `data-detail="fine"`, so it is hidden at default zoom and in exports. `mainPath` refuses any step to a lower column, and `col` is capped at 0 to 5, so a chain of more than six nodes cannot keep `mainPath`. (2026-09-28)
- `.claude/scheduled_tasks.lock` is Claude Code runtime state and is untracked on purpose, so never commit it. (2026-09-28)
