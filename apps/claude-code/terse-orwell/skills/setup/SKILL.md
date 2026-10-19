---
name: setup
description: Write or update the user's Personal layer for the Terse Orwell setup in ~/.claude/CLAUDE.md, install the unslop skill on the user's yes, and show the ponytail install.
argument-hint: '[answers to the six questions, optional]'
disable-model-invocation: true
---

Write the user's Personal layer: what they want on top of the Shared setup that the
`terse-orwell` plugin ships. The layer lives in `~/.claude/CLAUDE.md` between two markers, and
`scripts/write-layer.mjs` is the only thing that writes it.

## 1. Collect the answers

If `$ARGUMENTS` already answers a question, take that answer and do not ask it again. Ask the
rest in one message, in plain prose, numbered:

1. Your name and role.
2. Your chat language, for replies to you, and your artefact language, for code, commits, PRs,
   docs and messages to other agents. They may be the same.
3. British or American spelling.
4. Do your projects use Gitflow? If yes, the layer gets the Git flow rules below.
5. Optional: your default package managers. One, several or none, as free text.
6. Install the unslop skill now? It holds the prose rules the Shared setup applies to every
   artefact. Skip this question when `~/.claude/skills/unslop/SKILL.md` already exists.

## 2. Build the block

Fill this template. Keep the two language lines exactly in the form shown, because the
plugin's language hook reads them. Leave out a section whose answer is no or empty.

```markdown
## Personal layer

Written by `/terse-orwell:setup`. Run it again to change these answers. Text outside the
terse-orwell markers is yours, and the plugin never touches it.

- Name and role: <name>, <role>
- Chat language: <chat language>
- Artefact language: <artefact language>
- Spelling: <British|American>

### Language

<Only when the two languages differ.>
Two languages out, split by destination, never by who is reading.

- **<chat language>** for chat prose addressed only to me: status, reasoning,
  recommendations, questions, corrections.
- **<artefact language>** for anything that is or will become an artefact, including when you
  quote it in chat for me to review before it ships: ticket bodies and comments, PR titles and
  descriptions, commit messages, code, documentation, `AGENTS.md` and `CLAUDE.md`, handoff
  files, memory files, and messages to other agent sessions.

Quoting an artefact in the chat language means I review a translation rather than the text
that ships. When a reply mixes both, the quoted block stays in the artefact language and the
commentary around it uses the chat language.

### Spelling

Use <British|American> spelling, consistently. Match the surrounding file or repo when it
differs.

### Git flow

<Only when the answer to question 4 is yes.>

- I use Gitflow. Read the repo's branches and follow what it does.
- Commit only after the tests run.
- Pushing a feature branch is small and reversible: do it when I ask for a PR, or when I say
  to push. Pushing to `develop` or `main` and force-pushing are neither. Ask first.

### Package managers

<Only when question 5 has an answer.>
Use <package managers> unless the project's own conventions say otherwise.
```

## 3. Write it

Save the filled block with the Write tool to a new file in the system's temporary directory,
for example `terse-orwell-layer.md`. Then pass that file to the writer. It replaces an
existing terse-orwell block and keeps the rest of the file, or appends the block when there is
none:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/write-layer.mjs" "<absolute path of the saved file>"
```

The command holds no shell syntax beyond quotes, so it runs the same in Bash and in PowerShell.

If the writer exits non-zero, show its message and stop. Never edit `~/.claude/CLAUDE.md` by any
other means.

## 4. Install unslop

Run this step only when the answer to question 6 is yes. Run the command below. The `-y` flag
keeps it from waiting on a prompt:

```sh
npx -y skills@latest add cursor/plugins -g -y -a claude-code -s unslop
```

Expect `~/.claude/skills/unslop/SKILL.md` to exist afterwards. The plugin sends its text to
every session and subagent from the next session on. If the command fails or the file is
missing, show the output and give the user the command to run later. Continue with step 5
either way.

When the answer is no, give the user the command to run later.

## 5. Offer ponytail

Show these commands and say that ponytail pushes Claude toward the smallest code change that
works. They are slash commands, so only the user can run them:
`/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail`

Finish by telling the user to select the style with `/output-style` and pick
`terse-orwell:Terse Orwell`, and that the changes apply from the next session.
