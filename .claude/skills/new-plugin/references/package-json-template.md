# package.json Template

Use this as the starting shape for a new plugin's `package.json`. Copy `packageManager` from the root `package.json` at creation time — do not hardcode the version.

## Hook-based / script-based plugin (full template)

```json
{
  "name": "<plugin-name>",
  "version": "0.1.0",
  "private": true,
  "license": "LGPL-3.0-or-later",
  "type": "module",
  "packageManager": "<copy from root package.json>",
  "engines": { "node": ">=24", "pnpm": ">=10" },
  "scripts": {
    "test": "node --test",
    "typecheck": "tsc --noEmit --project tsconfig.json",
    "bump": "unic-bump",
    "sync-version": "unic-sync-version",
    "tag": "unic-tag",
    "verify:changelog": "unic-verify-changelog",
    "ralph": "ralph run -c ralph.yml -H builtin:code-assist"
  },
  "devDependencies": {
    "@ralph-orchestrator/ralph-cli": "catalog:",
    "@types/node": "catalog:",
    "@unic/release-tools": "workspace:*",
    "@unic/tsconfig": "workspace:*",
    "typescript": "catalog:"
  }
}
```

`node --test` with no path argument uses Node's built-in test file discovery. It exits 0 with zero tests in Node >=22 — safe here because this repo requires `node >=24`.

## Command-only plugin (no scripts or tests)

Omit `test`, `typecheck`, and the `@types/node`/`@unic/tsconfig`/`typescript` devDependencies:

```json
{
  "name": "<plugin-name>",
  "version": "0.1.0",
  "private": true,
  "license": "LGPL-3.0-or-later",
  "type": "module",
  "packageManager": "<copy from root package.json>",
  "engines": { "node": ">=24", "pnpm": ">=10" },
  "scripts": {
    "bump": "unic-bump",
    "sync-version": "unic-sync-version",
    "tag": "unic-tag",
    "verify:changelog": "unic-verify-changelog",
    "ralph": "ralph run -c ralph.yml -H builtin:code-assist"
  },
  "devDependencies": {
    "@ralph-orchestrator/ralph-cli": "catalog:",
    "@unic/release-tools": "workspace:*"
  }
}
```
