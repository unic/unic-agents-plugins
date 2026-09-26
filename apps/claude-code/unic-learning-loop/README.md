# unic-learning-loop

A Claude Code plugin that collects what a team learns about its own repository. A `Stop` hook counts turns and time, and when learnings are due it shows one line naming `/unic-learning-loop:learn`. That command has a read-only subagent read the transcripts since the last run and draft an updated `.claude/rules/learned.md`. You see the diff and say yes or no. Nothing is written without your yes, and you commit the file and open the pull request yourself, so the team reviews every learning. It is a port of `continual-learning` from [`cursor/plugins`](https://github.com/cursor/plugins).

> Status: v1 is complete but not yet run in a Consumer. The first run and read is [#530](https://github.com/unic/unic-agents-plugins/issues/530). The design is the v1 spec, [#526](https://github.com/unic/unic-agents-plugins/issues/526).

## Running a Read-back

Type `/unic-learning-loop:learn` inside a git repository. The model cannot start it on its own.

1. A subagent reads the lines you typed, and messages from other sessions, written since the last Read-back. The first run reads the last 14 days. The subagent has only `Read`, `Glob` and `Grep`, so nothing it reads can make it write a file or run a command.
2. It drafts `.claude/rules/learned.md` at the repository root: one section of repository facts, at most 12 bullets, each ending with the date it was created. Personal preferences, secrets and names of other clients or projects are left out.
3. You see the change as a diff with the file's absolute path in its header, and answer yes or no.
4. On yes, the file is written. On no, nothing is written. Either way, the next Read-back starts from this one.
5. You commit the file and open the pull request yourself.

To remove the plugin from a repository, delete `.claude/rules/learned.md` and uninstall the plugin.

## When the notice appears

The hook shows the notice when all of these hold:

- at least 10 turns have passed since the last notice;
- at least 120 minutes have passed since the last notice, or there has been no notice yet;
- the session's transcript has changed since the last notice.

A turn in which a `Stop` hook made Claude continue does not count. The notice costs no model turn, and the session stops normally.

## Settings

Set these environment variables to change the thresholds. A missing, non-numeric or non-positive value falls back to the default.

| Variable                                    | Default | Meaning                                                |
| ------------------------------------------- | ------- | ------------------------------------------------------ |
| `UNIC_LEARNING_LOOP_MIN_TURNS`              | `10`    | Turns between two notices                              |
| `UNIC_LEARNING_LOOP_MIN_MINUTES`            | `120`   | Minutes between two notices                            |
| `UNIC_LEARNING_LOOP_TRIAL_MODE`             | off     | `1`, `true`, `yes` or `on` turns on trial mode         |
| `UNIC_LEARNING_LOOP_TRIAL_MIN_TURNS`        | `3`     | Turns between two notices in trial mode                |
| `UNIC_LEARNING_LOOP_TRIAL_MIN_MINUTES`      | `15`    | Minutes between two notices in trial mode              |
| `UNIC_LEARNING_LOOP_TRIAL_DURATION_MINUTES` | `1440`  | How long trial mode lasts, from the first counted turn |

Trial mode lets you see the notice on the first day. It ends by itself when its duration has passed, and the normal thresholds apply again.

The hook keeps its state in a `unic-learning-loop/` directory beside the session's transcript, under `~/.claude/projects/`. Every session started in the same directory shares that state, so their turns add up. Nothing is written to your repository.
