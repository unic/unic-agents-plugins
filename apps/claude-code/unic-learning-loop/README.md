# unic-learning-loop

A Claude Code plugin that collects what a team learns about its own repository. A `Stop` hook counts turns and time, and when learnings are due it shows one line naming `/unic-learning-loop:learn`. That command has a read-only subagent read the transcripts since the last run and draft an updated `.claude/rules/learned.md`. You see the diff and say yes or no. Nothing is written without your yes, and you commit the file and open the pull request yourself, so the team reviews every learning. It is a port of `continual-learning` from [`cursor/plugins`](https://github.com/cursor/plugins).

> Status: this version is the empty plugin. The hook, the command and the subagent are not built yet. The design is the v1 spec, [#526](https://github.com/unic/unic-agents-plugins/issues/526).
