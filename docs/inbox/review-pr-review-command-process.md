---
title: review pr-review command process
created: 2026-05-03
---

review pr-review command process

Check Prompt I use for GitHub PRs:
```prompt
/pr-review-toolkit:review-pr Perform the following:

1. Check the failing checks in <GitHub | DevOps>.
2. Fix them, commit (conventional commits), push and wait to see checks. If not pass, reiterate till all checks green.
3. When all checks pass, perform a full PR review.
4. For each found issues, fix them, run `pnpm format`. If the affected files are from any `apps` path, then run `pnpm test` and  `pnpm --filter <name> verify:changelog` too. If all fine, then commit. If not fix issues and re-iterate.
5. Push and wait to see the checks. If not pass, reiterate till all checks green.
```

1. Improve it, convert it to plugin/command/etc
2. Ensure it spawns sub-agents to prevent context-rot (it quickly surpasses 100k tokens)
3. I usually do the following workflow:
   1. Open PR, wait for checks to finish
   2. Request PR-review (or custom ADO PR review, should be united)
   3. Request copilot review if repo remote is GitHub
   4. Request PR-review again focussing on comments from Copilot (in clear context), but it should use a similar approach as in custom prompt, whereas now not.
