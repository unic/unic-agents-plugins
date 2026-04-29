# 04. Add --dry-run Flag
**Status: done — 2026-04-24**

**Priority:** P1
**Effort:** S
**Depends on:** 03 (positional-arg parsing refactor in spec 03 is a prerequisite; `--dry-run` reuses the same flags-first pattern)
**Touches:** `scripts/push-to-confluence.mjs`, `commands/unic-confluence.md`

## Context

Publishing to Confluence is a write operation against a live page. There is currently no way to preview what the script would publish without actually making the PUT request. This is particularly risky when using `--replace-all` (spec 03), where the full page body is replaced. A `--dry-run` flag lets users — and the slash command in future specs — inspect the computed final HTML before committing it to Confluence. The flag does not suppress the GET request (credentials and the current page body are still needed to compute the final output), but it skips the PUT entirely and dumps the computed body to stdout.

## Current behaviour

`scripts/push-to-confluence.mjs`, `main()` starting at line 388. After `resolvePageId`, `readFileSync`, Markdown conversion, the GET request, and `injectContent`, the code immediately makes a PUT request with no opportunity to preview the result. There is no `--dry-run` handling anywhere in the file.

Current top of `main()` (after spec 03 has landed):

```js
async function main() {
	const args = process.argv.slice(2);
	if (args[0] === "--setup") { await runSetup(); process.exit(0); }
	if (args[0] === "--ping") { ... }
	if (args[0] === "--verify") { await runVerify(); return; }
	const replaceAll = args.includes("--replace-all");
	const positionalArgs = args.filter(a => !a.startsWith("--"));
	if (positionalArgs.length < 2) {
		console.error("Usage: node scripts/push-to-confluence.mjs [--replace-all] {pageId} {file.md}");
		process.exit(1);
	}
	const [pageArg, filePath] = positionalArgs;
```

> If spec 03 has NOT yet landed, the positional-arg extraction is still the original two-liner:
> ```js
> if (args.length < 2) { console.error("Usage: npm run confluence -- {pageId} {file.md}"); process.exit(1); }
> const [pageArg, filePath] = args;
> ```
> In that case Ralph must apply the flags-first refactor from spec 03 step 4 first (or as part of this step).

The `injectContent` call site is approximately line 469:

```js
	const newBody = injectContent(existingBody, html, title, { replaceAll, pageId, version });
```

The PUT request follows immediately after this line.

## Target behaviour

### `scripts/push-to-confluence.mjs`

1. `--dry-run` is parsed alongside `--replace-all` in the flags block at the top of `main()`.
2. After `newBody` is computed by `injectContent`, a dry-run branch is evaluated:
   - If `dryRun` is `true`: print a header, the full `newBody` HTML, and a footer to stdout; exit 0. The PUT request is never made. No backup is written (even if `--replace-all` is also passed).
   - If `dryRun` is `false`: proceed as normal (make the PUT request).
3. The usage error message is updated to include both flags.

### `commands/unic-confluence.md`

Steps 3 and 4 are updated to mention `--dry-run` as an opt-in flag that users can include in `$ARGUMENTS`. The flag is NOT enabled by default in the slash command.

### Edge cases

- `--dry-run --replace-all` together: dry-run takes precedence. `injectContent` still receives `replaceAll = true` and will compute the full-body replacement (or write a backup if no markers). Wait — to avoid side effects during a dry run, `--dry-run` should suppress the backup write too. Pass `replaceAll: dryRun ? false : replaceAll` to `injectContent` so that when dry-running, no backup is created and no markers-not-found error fires from the `--replace-all` path.

  > Ralph: reconsider this. An alternative is to pass `replaceAll` as-is and let the backup write happen — the user asked for `--replace-all` and a backup is a safe side effect. However the simpler rule is: `--dry-run` is purely read-only, so suppress both the PUT and the backup write. Use `effectiveReplaceAll = dryRun ? false : replaceAll` when calling `injectContent`.

- `--dry-run` with missing markers (post-spec-03, no `--replace-all`): `injectContent` still exits 1 with the "No markers found" error because `effectiveReplaceAll` is `false`. The dry-run branch is reached only if `injectContent` returns successfully.
- `--dry-run` with missing credentials: `loadCredentials()` exits 1 before any HTML is computed.
- `--dry-run` with a network error on the GET: the catch block in `httpsRequest` rejects and the error propagates normally (exit 1).

## Implementation steps

### Step 1 — Add `--dry-run` to the flags block in `main()`

File: `scripts/push-to-confluence.mjs`, `main()` starting at line 388.

If spec 03 has already landed, the flags block looks like:

```js
	const replaceAll = args.includes("--replace-all");
	const positionalArgs = args.filter(a => !a.startsWith("--"));
	if (positionalArgs.length < 2) {
		console.error("Usage: node scripts/push-to-confluence.mjs [--replace-all] {pageId} {file.md}");
		process.exit(1);
	}
```

Update to:

```js
	const dryRun = args.includes("--dry-run");
	const replaceAll = args.includes("--replace-all");
	const positionalArgs = args.filter(a => !a.startsWith("--"));
	if (positionalArgs.length < 2) {
		console.error("Usage: node scripts/push-to-confluence.mjs [--dry-run] [--replace-all] {pageId} {file.md}");
		process.exit(1);
	}
```

If spec 03 has NOT yet landed, apply the full flags-first refactor first (per spec 03 step 4), then add `dryRun` to the same block.

### Step 2 — Pass `effectiveReplaceAll` to `injectContent`

File: `scripts/push-to-confluence.mjs`, approximately line 469 (the `injectContent` call site).

Before (after spec 03):
```js
	const newBody = injectContent(existingBody, html, title, { replaceAll, pageId, version });
```

After:
```js
	const effectiveReplaceAll = dryRun ? false : replaceAll;
	const newBody = injectContent(existingBody, html, title, { replaceAll: effectiveReplaceAll, pageId, version });
```

### Step 3 — Insert the dry-run branch after `newBody` is computed

File: `scripts/push-to-confluence.mjs`, immediately after the `injectContent` call and before the PUT request (approximately line 471+).

Insert:

```js
	if (dryRun) {
		console.log("=== DRY RUN — Page would be updated to: ===\n");
		console.log(newBody);
		console.log("\n=== END DRY RUN ===");
		process.exit(0);
	}
```

The PUT request code that follows is not modified — it is simply never reached when `dryRun` is true.

### Step 4 — Update `commands/unic-confluence.md` step 3

File: `commands/unic-confluence.md`.

Locate step 3 (the publish step). Before (representative text):

```markdown
### 3. Run the publish script
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" <page-key-or-id> <markdown-file>
```

After:

```markdown
### 3. Run the publish script
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-to-confluence.mjs" <page-key-or-id> <markdown-file>

Optional flags (pass as part of $ARGUMENTS):
- `--dry-run` — compute the final HTML and print it to stdout without making the PUT request
- `--replace-all` — overwrite the full page body (creates a local backup; requires no markers on the page)
```

### Step 5 — Update `commands/unic-confluence.md` step 4

File: `commands/unic-confluence.md`.

Locate step 4 ("Report result"). Append a note:

```markdown
### 4. Report result
If --dry-run was passed, the computed page HTML is printed above. No changes were made to Confluence.
Otherwise, report success or relay any error message to the user.
```

## Test cases

| Scenario | Command | Expected stdout (partial) | Expected stderr | Exit code |
|---|---|---|---|---|
| `--dry-run` with valid markers | `node scripts/push-to-confluence.mjs --dry-run <id> file.md` | `=== DRY RUN ===` followed by HTML, then `=== END DRY RUN ===` | (none) | 0 |
| `--dry-run` — no PUT made | Same as above | (check: no Confluence page version bump after the run) | (none) | 0 |
| `--dry-run --replace-all` | `node scripts/push-to-confluence.mjs --dry-run --replace-all <id> file.md` | Full replacement HTML between DRY RUN markers | (none) | 0 |
| `--dry-run --replace-all` — no backup | Same as above | No `Backup saved to` line in stdout | (none) | 0 |
| `--dry-run` with missing markers (post-spec-03) | `node scripts/push-to-confluence.mjs --dry-run <id> file.md` | (none) | `No [AUTO_INSERT_START:label] / [AUTO_INSERT_END:label] markers found…` | 1 |
| `--dry-run` with no credentials | `node scripts/push-to-confluence.mjs --dry-run <id> file.md` | (none) | `Run \`npm run confluence -- --setup\`…` | 1 |
| No flags (normal publish) | `node scripts/push-to-confluence.mjs <id> file.md` | Success message | (none) | 0 |

## Acceptance criteria

- `--dry-run` is parsed in `main()` from `process.argv` using `args.includes("--dry-run")`.
- When `--dry-run` is set, the PUT request is never made (verify by checking the Confluence page version is unchanged after the run).
- When `--dry-run` is set, no backup file is written even if `--replace-all` is also passed.
- The dry-run output includes the literal strings `=== DRY RUN — Page would be updated to: ===` and `=== END DRY RUN ===` as delimiters.
- `--dry-run` with missing markers (no `--replace-all`) still exits 1 with the markers error (spec 03 behaviour is preserved).
- The usage error message lists `[--dry-run]` and `[--replace-all]`.
- `commands/unic-confluence.md` mentions `--dry-run` as an opt-in flag in step 3.
- Lint passes.
- Slash command `/unic-confluence` still works end-to-end for a normal publish (no `--dry-run`).

## Verification

```sh
# 1. Confirm --dry-run is parsed
grep -n "dry-run\|dryRun" scripts/push-to-confluence.mjs

# 2. Confirm dry-run branch exists after injectContent call
grep -n "DRY RUN" scripts/push-to-confluence.mjs

# 3. Confirm effectiveReplaceAll guards the backup
grep -n "effectiveReplaceAll" scripts/push-to-confluence.mjs

# 4. Confirm updated usage message
grep -n "Usage:" scripts/push-to-confluence.mjs
# Expected: includes [--dry-run] and [--replace-all]

# 5. Confirm commands file mentions --dry-run
grep "dry-run" commands/unic-confluence.md

# 6. Manual smoke test (requires a mapped page and valid credentials):
# node scripts/push-to-confluence.mjs --dry-run <page-id> path/to/file.md
# Expected: HTML output to stdout, exit 0, page version unchanged in Confluence
```

## Out of scope

- No HTML diff output (e.g. showing what changed between the current body and the new body). A full HTML dump is sufficient for this spec. Diffing would require an additional dependency.
- No colour-coded terminal output for the dry-run dump.
- Do not suppress the GET request during dry-run — the GET is needed to compute the final body.
- No changes to `--verify`, `--setup`, or `--ping`.
- No version bump (this is a non-breaking additive change).
- No changes to `confluence-pages.json` parsing or credential loading.

## Follow-ups

- A future spec could pipe `--dry-run` output through a HTML-to-terminal renderer for readability.
- Consider exposing `--dry-run` as a named option in the slash command arguments documentation so users can pass it naturally as `$ARGUMENTS`.
- If `injectContent` is ever made async (e.g. for spec 03's backup write), confirm the dry-run branch placement is still correct relative to the `await`.

_Ralph: append findings here._
