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

## [2.0.0] — 2026-05-28

### Added

- Plugin scaffold: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `tsconfig.json`
- Domain vocabulary in `CONTEXT.md` (Plugin, Review, Finding, Confidence, Severity, Intent Brief, Intent Check, Bot Signature, Iteration, Approval Loop, Mode, Provider, Work Item, Notice)
- `/unic-pr-review:doctor` slash command (`commands/doctor.md`)
- `scripts/doctor.mjs`: six preflight checks — `az` CLI, `azure-devops` extension, `az devops` login, `az devops user show --user me` identity (for ADR-0006 caching), Confluence reachability, Jira reachability (silent when `jiraUrl` is unset per US 35)
- `scripts/lib/credentials.mjs`: shared loader for `~/.unic-confluence.json` and `~/.unic-azure.json` with env-var overrides
- `tests/doctor.test.mjs`: unit tests for all six predicates with stubbed executors and fetchers
