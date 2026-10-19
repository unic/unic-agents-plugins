# terse-orwell

A Claude Code Plugin that keeps Claude concise, with an output style and generic behaviour rules that are the same for every user.

## Language

**Shared setup**:
What the plugin ships, the same for every user: the output style, the generic behaviour rules, and the handover of both to subagents.
_Avoid_: base, template, kit

**Personal layer**:
What one user writes for themselves on top of the Shared setup, through `/terse-orwell:setup`: who they are, which languages they write in, their spelling, their Git flow and their package managers. It lives between the terse-orwell markers in `~/.claude/CLAUDE.md`, and the plugin never overwrites anything outside them.
_Avoid_: override, customisation, local config
