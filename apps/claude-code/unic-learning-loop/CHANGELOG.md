# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking

- (none)

### Added

- The command `/unic-learning-loop:learn`, the Read-back. A subagent that can only read, `learned-rules-drafter`, reads the typed and `isMeta` user lines written since the Bookmark and drafts an updated `.claude/rules/learned.md`: one section of repository facts, at most 12 dated bullets. The command shows the diff with the file's absolute path and writes the file only on your yes. It moves the Bookmark on yes, on no and when there is nothing to add, and never commits. The first run reads the last 14 days. The model cannot start it on its own.

### Fixed

- (none)

## [0.0.2] — 2026-09-23

### Breaking

- (none)

### Added

- The `Stop` hook, the Cadence Gate. After 10 counted turns and 120 minutes since the last notice, on a transcript that has changed, it shows one notice naming `/unic-learning-loop:learn`. It costs no model turn and never blocks the session. `UNIC_LEARNING_LOOP_*` environment variables set the thresholds and an optional trial mode. The command it names arrives in the next version.
- A `NOTICE` that credits `continual-learning` from `cursor/plugins` at commit `ac93d26be3c3`, under the MIT License.
- A `CONTEXT.md` that defines the plugin's five terms.

### Fixed

- (none)

## [0.0.1] — 2026-09-23

### Breaking

- (none)

### Added

- The empty plugin, registered in the root marketplace and in CI. It has no hook, skill or subagent yet.

### Fixed

- (none)
