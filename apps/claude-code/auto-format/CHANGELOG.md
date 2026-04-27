# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking
- (none)

### Added
- Implement `scripts/format-hook.mjs`: PostToolUse hook that runs Prettier and ESLint `--fix` on written/edited files (spec 03)
- Register `PostToolUse` hook for `Write|Edit|MultiEdit|NotebookEdit` via `hooks/hooks.json` (spec 02)
- Add `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` manifest files at v0.1.0 (spec 01)

### Fixed
- Bootstrap pnpm workspace: add `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.editorconfig` (spec 00)
