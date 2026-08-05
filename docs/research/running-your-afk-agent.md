---
source: https://www.aihero.dev/running-your-afk-agent-a9l1u
author: Matt Pocock
---

# Running Your AFK Agent

An autonomous agent can work through your issue backlog, but you need to understand how it behaves first. The key is running it human-in-the-loop (HITL) to observe its decision-making and identify weaknesses in your prompts or issue descriptions.

In this lesson, you're going to run an agent HITL on your issues using the `/tdd` skill. You'll watch it pick tasks, write tests, implement code, and commit changes. By observing where it struggles, you'll learn how to write better prompts and issues.

## Steps To Complete

### Understanding the Agent Setup

- [ ] Review the `ralph/prompt.md` file

This is the agent's instruction set. It tells the agent:

- Which issues to work on (AFK vs HITL)
- How to prioritize tasks (bugfixes, infrastructure, features, polish, refactors)
- What feedback loops to run (tests, type checking)
- How to commit with meaningful messages

Notice the prioritization order - development infrastructure like tests and types come before features. This matters because good tests and types make feature work faster and safer.

- [ ] Review the `ralph/once.sh` script

The script:

1. Reads your open issues from the `issues/` directory
2. Reads the last 5 commits to understand what's been done
3. Loads the prompt
4. Passes everything to Claude with permission to make edits

Note that `--permission-mode acceptEdits` is included, which means Claude can write and commit code directly. But you'll still be watching and can intervene at any point - that's what makes this HITL.

### Setting Up Your First Agent Run

- [ ] Make sure you have issues in your `issues/` directory

You should have at least 2-5 issues written as markdown files. Each issue should have a clear description of what needs to be done.

- [ ] Review the agent prompt structure

The prompt provided in `ralph/prompt.md` is the agent's instruction set. It defines:

- Task selection priorities (bugfixes, infrastructure, tracer bullets, polish, refactors)
- The workflow to follow (explore, implement with `/tdd`, run feedback loops, commit)
- How to handle completed vs incomplete issues
- The rule to only work on a single task per run

This structure keeps the agent focused and prevents it from trying to do too much at once.

- [ ] Review the `/tdd` skill in `.claude/skills/tdd/`

The agent uses the `/tdd` skill to implement features. Take a moment to look at the skill files to understand the workflow:

- `SKILL.md` defines the test-driven development process
- Supporting files like `tests.md` and `mocking.md` provide guidance on writing good tests

The skill emphasizes vertical slices (one test, one implementation) over horizontal slices (all tests, then all implementation).

### Running the Agent Human-in-the-Loop

- [ ] Run the `ralph/once.sh` script

```bash
bash ralph/once.sh
```

- [ ] Watch the agent work through one complete task

The agent will:

1. Read your issues
2. Pick the highest-priority AFK task
3. Explore the repo
4. Use `/tdd` to write tests and implement code
5. Run feedback loops (`npm run test`, `npm run typecheck`)
6. Make a git commit

Pay attention to where it struggles. Does it pick the right task? Does it understand the requirements? Does it write good tests?

- [ ] Approve permission requests as they come up

The agent will ask for permission to run bash scripts. You'll need to approve these requests as usual.

- [ ] Let the agent finish before intervening

Let it complete the full cycle, even if you see issues. You want to observe its natural workflow before making adjustments.

### Observing the Results

- [ ] Check your git log

```bash
git log --oneline -10
```

You should see new commits with messages that describe what was done, what files changed, and any notes for the next iteration.

- [ ] Check your `issues/` directory

Issues the agent completed should have moved to `issues/done/`. Incomplete issues should have notes added describing what was done.

- [ ] Review the code the agent wrote

Look at the actual implementation. Does it make sense? Is it testable? Did it follow the TDD approach (test first, minimal implementation)? Did it produce good or bad tests?

### Refining the Agent

- [ ] Identify where the agent struggled

Did it:

- Pick the wrong task?
- Misunderstand the requirements?
- Write poor tests?
- Skip feedback loops?
- Make unclear commits?

- [ ] If you have time, run the agent again to watch it pick up the next task

```bash
bash ralph/once.sh
```

Watch how it selects and works through the next issue.
