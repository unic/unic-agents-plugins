# 0006. Cross-platform scripting via Node.js APIs — no shell commands

**Status:** Accepted (2025-04)

## Context

CI runs on macOS, Ubuntu, and Windows. Shell-based scripts (`#!/bin/bash`, `cp`, POSIX paths) fail on Windows or require WSL.

## Decision

All release scripts, hooks, and tooling use Node.js built-in APIs (`node:fs`, `node:path`, `node:child_process`, `node:os`) exclusively. No `bash`, `sh`, `cp`, `mv`, or POSIX path separators in scripts.

## Consequences

- Scripts run identically on all three OSes without a shell layer.
- `node:path.join` + `path.sep` replace POSIX path literals.
- `child_process.spawnSync` replaces shell pipelines; arguments are passed as arrays.
- Any future contributor adding a shell-based script must propose an ADR amendment.
