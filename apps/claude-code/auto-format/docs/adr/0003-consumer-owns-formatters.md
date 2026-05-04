# 0003. The plugin orchestrates; the consumer project owns its formatters

**Status:** Accepted (2025-04)

## Context

Bundling Prettier, ESLint, or Biome inside the plugin would lock consumers to specific versions and prevent them from customising formatter config. Detecting and invoking formatters already installed in the consumer project avoids this.

## Decision

The hook script detects which formatters are available in the consumer project (`prettier`, `eslint`, `biome`) by checking `node_modules/.bin` and `package.json` scripts. It invokes whatever it finds. The plugin never bundles or installs formatters.

## Consequences

- Consumers must have their formatters installed; the hook silently skips missing tools.
- Formatter version and config are always the consumer's own.
- The plugin works with any combination of Prettier, ESLint, and Biome without code changes.
