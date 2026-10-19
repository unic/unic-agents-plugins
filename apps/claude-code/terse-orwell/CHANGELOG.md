# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking
- (none)

### Added
- (none)

### Fixed
- (none)

## [0.1.0] — 2026-10-19

### Breaking

- (none)

### Added

- The output style `terse-orwell:Terse Orwell`: code first, short prose, Orwell's six rules for word choice, the unslop rules, and ASD-STE100 discipline for anything actionable.
- A `SessionStart` hook that sends the Shared setup rules to every session. The rules cover the blast radius of a choice, showing branches, PRs and worktrees, opinions without hedging, unslop, subagents, source accuracy, the verification loop, plan steps, parallel work, `git stash`, and self-improvement. The hook appends the unslop skill's text when `~/.claude/skills/unslop/SKILL.md` exists. It warns on every session until `/terse-orwell:setup` has run, and when unslop is missing.
- A `SubagentStart` hook that sends the output style and the same rules to every subagent.
- A `UserPromptSubmit` hook that names the chat language and the artefact language on every turn when the Personal layer sets two different languages.
- The command `/terse-orwell:setup`. It asks five questions and writes the answers between the terse-orwell markers in `~/.claude/CLAUDE.md`. A rerun replaces that block and keeps the rest of the file. It shows the install commands for unslop and ponytail and runs neither.

### Fixed

- (none)
