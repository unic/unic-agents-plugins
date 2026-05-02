# 0006. Normalize Windows paths to POSIX before extension/glob matching

**Status:** Accepted (2025-04)

## Context

Claude Code passes file paths to hooks using the OS path separator. On Windows, paths use backslashes (`\`). Extension matching and glob patterns in the hook script assume POSIX separators.

## Decision

The hook script normalises all incoming file paths to POSIX format (`/`) using `path.normalize` + `.replace(/\\/g, '/')` before any extension or glob matching. Normalization is applied once at entry.

## Consequences

- Extension sets and glob patterns are written as POSIX strings throughout the script.
- The normalization step adds negligible overhead.
- Paths passed to `spawnSync` are re-normalized to the OS separator for the subprocess.
