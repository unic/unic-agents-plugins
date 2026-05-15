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

## [0.1.0] — 2026-05-15

### Added

- Six Archon YAML workflows covering the full AI development lifecycle: `explore`, `plan`, `build` (template + generator), `qa`, `cleanup`, `triage`
- Idempotent install hook (`scripts/install.mjs`) with auto-detection of issue tracker from git remote, interactive prompts, and accumulative setup
- Self-contained multi-aspect code review command (`.archon/commands/review.md`) covering code quality, test coverage, silent failures, and type design — no external plugins required
- Config loader/validator module (`scripts/lib/config.mjs`) with discriminated-union `ConfigResult` and full JSDoc types
- Project state explorer module (`scripts/lib/explorer.mjs`) detecting git remote, CLAUDE.md, CONTEXT.md, CONTEXT-MAP.md, existing config, and archon installation
- Dependency tree builder (`scripts/lib/dep-tree.mjs`) using Kahn's algorithm for topological sort with cycle detection
- Issue tracker adapter (`scripts/lib/tracker.mjs`) generating correct CLI commands for GitHub Issues, Azure DevOps, Jira, and local markdown backends
- YAML generator (`scripts/lib/yaml-gen.mjs`) converting dep-tree groups into Archon build workflow YAML with per-issue red/slopcheck/green nodes and global verification gate
