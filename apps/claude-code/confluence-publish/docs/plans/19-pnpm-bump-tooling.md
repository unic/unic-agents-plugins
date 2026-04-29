# 19. `pnpm bump` — atomic version bump tooling
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** M
**Version impact:** minor
**Depends on:** spec 15 (`CliError` class in `scripts/lib/errors.mjs`)
**Touches:** `scripts/bump-version.mjs` (create), `scripts/tag.mjs` (create), `package.json`, `README.md`

## Context

All 18 shipped specs left `plugin.json` at `2.0.0` with `CHANGELOG.md`'s `[Unreleased]` section empty. The root cause: bumping requires three coordinated manual edits (`plugin.json`, `marketplace.json` via `pnpm sync-version`, `CHANGELOG.md`) with no script to orchestrate them. The existing `pnpm release` script stages and commits, but does not bump, does not promote `[Unreleased]`, and conflates "promote CHANGELOG" with "commit" in a way that no longer fits a per-spec cadence.

This spec adds:

- `pnpm bump <patch|minor|major>` — one command that: bumps `plugin.json`, mirrors into `marketplace.json` (via existing `sync-version.mjs`), and promotes `## [Unreleased]` → `## [X.Y.Z] — YYYY-MM-DD` with a fresh empty `[Unreleased]` above it. Refuses to promote an empty `[Unreleased]`.
- `pnpm tag` — a lightweight replacement for `pnpm release`; syncs `marketplace.json` and creates a local `git tag vX.Y.Z`. Does not commit or push (those remain manual).

After this spec, `pnpm release` is removed (its stage-and-commit behaviour is now the implementer's responsibility per the per-spec workflow, not a script's).

## Current behaviour

`package.json` scripts:

```json
"sync-version": "node scripts/sync-version.mjs",
"release": "node scripts/sync-version.mjs && git add .claude-plugin/marketplace.json CHANGELOG.md && git commit -m \"chore: release v$(node -e 'const fs=require(\"fs\");const p=JSON.parse(fs.readFileSync(\".claude-plugin/plugin.json\",\"utf8\"));process.stdout.write(p.version)')\"",
```

No `bump` or `tag` script exists. Bumping version is fully manual:
1. Hand-edit `.claude-plugin/plugin.json` `version` field.
2. Hand-edit `CHANGELOG.md` to promote `[Unreleased]`.
3. `pnpm sync-version` (mirrors to marketplace.json).
4. `pnpm release` (stages + commits).
5. `git tag vX.Y.Z && git push origin vX.Y.Z`.

`scripts/bump-version.mjs` — does not exist.
`scripts/tag.mjs` — does not exist.

## Target behaviour

### `pnpm bump <patch|minor|major>`

1. Reads current version from `.claude-plugin/plugin.json`.
2. Validates `## [Unreleased]` in `CHANGELOG.md` contains at least one non-`(none)` bullet. Exits 1 with a clear message if not.
3. Computes next version per SemVer (minor resets patch to 0; major resets minor and patch).
4. Writes updated `plugin.json` (same 2-space indent, trailing newline).
5. Calls `node scripts/sync-version.mjs` via `spawnSync` to mirror into `marketplace.json`.
6. Rewrites `CHANGELOG.md`: replaces `## [Unreleased]` and its body with a fresh empty `[Unreleased]` block followed by `## [X.Y.Z] — YYYY-MM-DD` (UTC date via `new Date().toISOString().slice(0, 10)`) and the original body.
7. Logs `bump: 2.0.0 → 2.1.0`.

### `pnpm tag`

1. Reads version from `plugin.json`.
2. Runs `sync-version.mjs` as a safety net (idempotent if already in sync).
3. Creates a local `git tag vX.Y.Z`. Fails clearly if tag already exists.
4. Logs `Tagged v2.1.0. Run: git push --follow-tags`.

### `pnpm release` — removed

The `release` script is deleted from `package.json`. Its auto-commit behaviour is replaced by the standard `git add -A && git commit -m "feat(spec-NN): ..."` workflow described in `PROMPT.md`.

## Affected files

| File | Change |
|---|---|
| `scripts/bump-version.mjs` | Create |
| `scripts/tag.mjs` | Create |
| `package.json` | Add `bump`, add `tag`, remove `release` |
| `README.md` | Replace "Releasing" section |

## Implementation steps

### Step 1 — Create `scripts/bump-version.mjs`

Create the file with exactly this content (tabs for indentation, `// @ts-check`):

```js
#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./lib/errors.mjs";

const TYPES = /** @type {const} */ (["patch", "minor", "major"]);
const type = process.argv[2];

try {
	if (!TYPES.includes(/** @type {any} */ (type))) {
		throw new CliError(`Usage: pnpm bump <patch|minor|major>`);
	}

	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const pluginPath = path.join(root, ".claude-plugin/plugin.json");
	const changelogPath = path.join(root, "CHANGELOG.md");

	/** @type {{ version: string, [key: string]: unknown }} */
	let pluginJson;
	try {
		pluginJson = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, "utf8")));
	} catch (err) {
		throw new CliError(`bump: cannot read ${pluginPath}: ${/** @type {Error} */ (err).message}`);
	}

	const version = pluginJson.version;
	if (!version || typeof version !== "string") {
		throw new CliError(`bump: .version is missing or not a string in ${pluginPath}`);
	}

	const parts = version.split(".");
	if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
		throw new CliError(`bump: cannot parse version "${version}" — expected X.Y.Z`);
	}
	let [major, minor, patch] = parts.map(Number);
	if (type === "major") {
		major++;
		minor = 0;
		patch = 0;
	} else if (type === "minor") {
		minor++;
		patch = 0;
	} else {
		patch++;
	}
	const nextVersion = `${major}.${minor}.${patch}`;

	let changelog;
	try {
		changelog = readFileSync(changelogPath, "utf8");
	} catch (err) {
		throw new CliError(`bump: cannot read ${changelogPath}: ${/** @type {Error} */ (err).message}`);
	}

	const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[)/);
	if (!unreleasedMatch) {
		throw new CliError(`bump: no ## [Unreleased] section found in CHANGELOG.md`);
	}

	const unreleasedBody = unreleasedMatch[1];
	const hasRealEntry = unreleasedBody
		.split("\n")
		.filter((l) => l.startsWith("- "))
		.some((l) => l !== "- (none)");
	if (!hasRealEntry) {
		throw new CliError(
			`bump: [Unreleased] has no entries — add a CHANGELOG entry before bumping`,
		);
	}

	pluginJson.version = nextVersion;
	writeFileSync(pluginPath, `${JSON.stringify(pluginJson, null, 2)}\n`, "utf8");

	const today = new Date().toISOString().slice(0, 10);
	const emptyUnreleased =
		`## [Unreleased]\n\n### Breaking\n- (none)\n\n### Added\n- (none)\n\n### Fixed\n- (none)`;
	const newChangelog = changelog.replace(
		/## \[Unreleased\]([\s\S]*?)(?=\n## \[)/,
		`${emptyUnreleased}\n\n## [${nextVersion}] — ${today}$1`,
	);
	writeFileSync(changelogPath, newChangelog, "utf8");

	const syncResult = spawnSync("node", [path.join(root, "scripts/sync-version.mjs")], {
		stdio: "inherit",
	});
	if (syncResult.status !== 0) {
		throw new CliError(`bump: sync-version failed (exit ${syncResult.status ?? "unknown"})`);
	}

	console.log(`bump: ${version} → ${nextVersion}`);
} catch (err) {
	if (err instanceof CliError) {
		console.error(err.message);
		process.exit(err.exitCode);
	}
	throw err;
}
```

### Step 2 — Create `scripts/tag.mjs`

```js
#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./lib/errors.mjs";

try {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const pluginPath = path.join(root, ".claude-plugin/plugin.json");

	/** @type {{ version: string }} */
	const pluginJson = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, "utf8")));
	const version = pluginJson.version;
	if (!version || typeof version !== "string") {
		throw new CliError(`tag: .version missing in ${pluginPath}`);
	}

	// Safety sync before tagging (idempotent)
	spawnSync("node", [path.join(root, "scripts/sync-version.mjs")], { stdio: "inherit" });

	const tagResult = spawnSync("git", ["tag", `v${version}`], { stdio: "inherit" });
	if (tagResult.status !== 0) {
		throw new CliError(`tag: git tag failed — v${version} may already exist`);
	}

	console.log(`Tagged v${version}. Run: git push --follow-tags`);
} catch (err) {
	if (err instanceof CliError) {
		console.error(err.message);
		process.exit(/** @type {CliError} */ (err).exitCode);
	}
	throw err;
}
```

### Step 3 — Update `package.json` scripts

In `package.json`, locate the `"scripts"` block.

**Remove** the `"release"` entry entirely.

**Add** two new entries after `"sync-version"`:

```json
"bump": "node scripts/bump-version.mjs",
"tag": "node scripts/tag.mjs",
```

The scripts block should look like:

```json
"scripts": {
    "confluence": "node scripts/push-to-confluence.mjs",
    "sync-version": "node scripts/sync-version.mjs",
    "bump": "node scripts/bump-version.mjs",
    "tag": "node scripts/tag.mjs",
    "test": "node --test scripts/lib/frontmatter.test.mjs scripts/lib/inject.test.mjs scripts/lib/resolve.test.mjs",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check .",
    "ci:check": "biome ci ."
},
```

Note: `"typecheck"` is kept if it exists (it lives outside the block shown above — do not remove it).

### Step 4 — Replace README "Releasing" section

Locate the "Releasing" section in `README.md` (currently lines 223–228). Replace the entire section (from `## Releasing` through the final numbered step) with:

```markdown
## Releasing

Every `feat(spec-NN)` / `fix(spec-NN)` commit includes its own version bump and CHANGELOG entry via `pnpm bump`. No separate "release commit" is needed.

**Per change (every commit):**
1. Add one bullet under the matching subsection of `## [Unreleased]` in `CHANGELOG.md` (`### Breaking`, `### Added`, or `### Fixed`).
2. `pnpm bump <patch|minor|major>` — bumps `plugin.json`, mirrors into `marketplace.json`, promotes `[Unreleased]` → a dated version section.
3. `git add -A && git commit -m "feat(spec-NN): <description> (vX.Y.Z)"`.

**SemVer policy:**
| Change type | Bump |
|---|---|
| Breaking change to CLI flags, exit codes, or on-disk contracts | `major` |
| New flag, subcommand, or user-visible feature | `minor` |
| Bug fix, refactor, docs, internal tooling | `patch` |

**To tag and push a release boundary (optional, periodic):**
```sh
pnpm tag                  # creates local git tag vX.Y.Z
git push --follow-tags    # pushes tag to GitHub
```

**Optional — enable the local pre-push changelog check:**
```sh
git config core.hooksPath .githooks
```
```

## Test cases

| Scenario | Action | Expected outcome |
|---|---|---|
| Normal minor bump | Add `- foo` under `### Added`, run `pnpm bump minor` | `plugin.json` version incremented (patch reset to 0), `marketplace.json` matches, `CHANGELOG.md` has new dated section |
| Bump with empty `[Unreleased]` | Run `pnpm bump patch` without editing CHANGELOG | Exits 1: `bump: [Unreleased] has no entries` |
| Invalid bump type | `pnpm bump hotfix` | Exits 1: `Usage: pnpm bump <patch|minor|major>` |
| Major bump resets minor + patch | `plugin.json` at `2.3.1`, `pnpm bump major` | Next version is `3.0.0` |
| Minor bump resets patch | `plugin.json` at `2.3.1`, `pnpm bump minor` | Next version is `2.4.0` |
| `pnpm tag` creates tag | After a bump, run `pnpm tag` | `git tag -l` shows `v<version>`; log says "Tagged vX.Y.Z" |
| `pnpm tag` on already-tagged | Run `pnpm tag` twice | Exits 1: "git tag failed — may already exist" |

## Verification

```sh
# 1. Syntax check
pnpm typecheck
# Expected: no errors in new scripts

# 2. Lint
pnpm lint
# Expected: passes

# 3. Simulate a bump (undo after)
# First add a dummy CHANGELOG entry
ORIG_CHANGELOG=$(cat CHANGELOG.md)
ORIG_PLUGIN=$(cat .claude-plugin/plugin.json)
ORIG_MARKET=$(cat .claude-plugin/marketplace.json)

# Add an entry to [Unreleased]
node -e "
const fs = require('fs');
let c = fs.readFileSync('CHANGELOG.md', 'utf8');
c = c.replace('- (none)\n\n## [2', '- Test entry for spec-19\n\n## [2');
fs.writeFileSync('CHANGELOG.md', c);
"

# Run bump
node scripts/bump-version.mjs minor

# Check plugin.json bumped
node -e "const p=JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); console.log('plugin.json version:', p.version)"
# Expected: 2.1.0 (or whatever is next)

# Check marketplace.json matches
node -e "const m=JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('marketplace.json version:', m.plugins[0].version)"
# Expected: same as plugin.json

# Check CHANGELOG has dated section
grep "## \[2\." CHANGELOG.md
# Expected: new dated line e.g. "## [2.1.0] — 2026-04-24"

# Check [Unreleased] is fresh and empty
grep -A6 "## \[Unreleased\]" CHANGELOG.md
# Expected: empty Breaking/Added/Fixed all "(none)"

# 4. Verify bump rejects empty [Unreleased]
node scripts/bump-version.mjs patch; echo "Exit: $?"
# Expected: Exit: 1 with "no entries" message

# 5. Restore original files (UNDO)
echo "$ORIG_CHANGELOG" > CHANGELOG.md
echo "$ORIG_PLUGIN" > .claude-plugin/plugin.json
echo "$ORIG_MARKET" > .claude-plugin/marketplace.json
```

## Acceptance criteria

- [ ] `pnpm bump minor` on a CHANGELOG with at least one non-`(none)` bullet: bumps `plugin.json`, syncs `marketplace.json`, promotes `[Unreleased]` → `[X.Y.Z] — today`, inserts fresh empty `[Unreleased]`.
- [ ] `pnpm bump patch` with empty `[Unreleased]` (all `- (none)`): exits 1 with a message pointing at adding a CHANGELOG entry.
- [ ] `pnpm bump hotfix`: exits 1 with usage message.
- [ ] Major bump resets minor and patch to 0; minor bump resets patch to 0.
- [ ] `pnpm tag`: creates local `git tag vX.Y.Z`; exits 1 if tag already exists.
- [ ] `pnpm release` is removed from `package.json`.
- [ ] `pnpm typecheck` passes on new scripts.
- [ ] `pnpm lint` passes.
- [ ] README "Releasing" section reflects the new per-spec flow.

## Out of scope

- Pushing the tag — remains a manual `git push --follow-tags`.
- Auto-creating a GitHub Release.
- `pnpm verify:changelog` (enforcement CI check) — that is spec 20.
- Updating `PROMPT.md` or `CLAUDE.md` — that is spec 21.
- Backfilling version bumps for specs 00–18 — history is shipped.

_Ralph: append findings here._
