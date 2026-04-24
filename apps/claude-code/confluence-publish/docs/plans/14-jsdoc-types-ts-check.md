# 14. JSDoc Types and `--checkJs` Type-Checking

**Priority:** P2
**Effort:** M
**Depends on:** spec 09 (lib extraction — the per-file modules must exist before annotating them), spec 10 (Biome — format pass should run before JSDoc is added so the two diffs do not tangle)
**Touches:** `scripts/push-to-confluence.mjs`, `scripts/sync-version.mjs`, `scripts/lib/inject.mjs`, `scripts/lib/frontmatter.mjs`, `scripts/lib/resolve.mjs`, `scripts/lib/types.mjs` (new), `package.json`, `pnpm-workspace.yaml`

## Context

The codebase is plain JavaScript (ESM). There is no build step and no TypeScript transpilation. Adding `// @ts-check` at the top of each source file and JSDoc type annotations on public functions gives editor-level type safety (VS Code underlines type errors in real time) and catches an entire class of bugs — wrong argument types, missing properties, `undefined` values used as strings — without introducing a TypeScript build step. The `tsc --checkJs` flag extends this to CI: type errors block merges. This is the lightest possible path to type safety in a no-build ESM project. The choice to NOT convert to `.ts` files is deliberate — it keeps the repo usable as a copy-paste snippet or a Claude plugin without a compile step.

## Current behaviour

- No `// @ts-check` directive in any `.mjs` file.
- No JSDoc annotations on any function.
- No `tsconfig.json`.
- No `typescript` dev dependency.
- `pnpm typecheck` script does not exist.
- VS Code shows no type errors (because `checkJs` is off) even when, for example, `pageData?.version?.number` is used as an `integer` parameter without a guard.

Known latent type issues in `push-to-confluence.mjs`:
- Line 456: `const version = pageData?.version?.number` — type is `number | undefined`, not `number`. Used on line 477 as `version + 1` and passed to `Number.isInteger(version)`. Requires a guard.
- Line 405: `const [pageArg, filePath] = args` where `args = process.argv.slice(2)` — type is `string[]`, so destructuring gives `string | undefined`. Passing to `resolvePageId(pageArg)` without a guard is a latent type error when `args` is empty (but `main()` checks `args.length < 2` before this line, so it is safe at runtime; tsc needs the narrowing to be explicit).
- `JSON.parse` return type is `any` — assignments like `const pageData = JSON.parse(getRes.body)` give `any` which propagates and suppresses all downstream checks.
- `process.argv[2]` is `string | undefined` — already guarded in some places, not in others.

## Target behaviour

After this spec:

1. Every `.mjs` source file starts with `// @ts-check` on the second line (after the SPDX comment or shebang).
2. `scripts/lib/types.mjs` defines shared type shapes as JSDoc `@typedef` blocks (no runtime exports).
3. Key functions are annotated with `@param` and `@returns` JSDoc tags.
4. `pnpm typecheck` runs `tsc --noEmit --allowJs --checkJs --strict --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/**/*.mjs` and exits 0.
5. VS Code (with the TypeScript language server) shows 0 errors in the Problems panel for all `.mjs` files.
6. No `.ts` files are created. No transpilation step is introduced.

## Implementation steps

### Step 1 — Add `typescript` to the catalog and devDependencies

Edit `pnpm-workspace.yaml`:

```yaml
# BEFORE:
catalog:
  marked: "17.0.5"
  "@biomejs/biome": "1.9.4"

# AFTER:
catalog:
  marked: "17.0.5"
  "@biomejs/biome": "1.9.4"
  typescript: "5.8.3"   # Ralph: replace with latest stable TypeScript 5.x from https://www.typescriptlang.org/
```

Edit `package.json` `devDependencies`:

```json
"devDependencies": {
  "@biomejs/biome": "catalog:",
  "typescript": "catalog:"
}
```

Run `pnpm install`.

### Step 2 — Add `pnpm typecheck` script to package.json

Add to the `"scripts"` block:

```json
"typecheck": "tsc --noEmit --allowJs --checkJs --strict --target ES2022 --module NodeNext --moduleResolution NodeNext scripts/**/*.mjs"
```

The `--strict` flag enables `strictNullChecks`, `strictFunctionTypes`, `noImplicitAny`, and others. This may surface errors in step 5 that need fixing. It is intentional — better to find them now than later.

Do NOT create a `tsconfig.json` file. The inline flags are sufficient for a repo with one directory of JS files. If the command line grows unwieldy in a follow-up, a `tsconfig.json` can be added then.

### Step 3 — Create `scripts/lib/types.mjs`

Create a new file at `scripts/lib/types.mjs`. This file has NO runtime exports — it exists only to define JSDoc types that can be imported with `@import` directives in other files.

```js
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/**
 * Shared JSDoc type definitions for push-to-confluence.mjs and its lib modules.
 * No runtime exports — import types only via JSDoc @import directives.
 */

/**
 * Credentials loaded from env vars or ~/.unic-confluence.json.
 *
 * @typedef {{ url: string, username: string, token: string }} Credentials
 */

/**
 * Raw HTTP response from httpsRequest.
 *
 * @typedef {{ status: number, body: string }} HttpResponse
 */

/**
 * Confluence page version object embedded in the page GET response.
 *
 * @typedef {{ number: number }} PageVersion
 */

/**
 * Confluence page data as returned by GET /wiki/api/v2/pages/:id?body-format=storage.
 *
 * @typedef {{
 *   title: string,
 *   version: PageVersion,
 *   body: { storage: { value: string } }
 * }} PageData
 */

/**
 * Options for injectContent.
 *
 * @typedef {{
 *   replaceAll?: boolean,
 *   pageId?: number,
 *   version?: number
 * }} InjectOptions
 */

export {};
```

The `export {}` at the end makes this a valid ESM module (required for `--moduleResolution NodeNext`). The `@typedef` blocks are visible to any file that references this module via JSDoc `@import`.

### Step 4 — Add `// @ts-check` and JSDoc to `scripts/lib/frontmatter.mjs`

This file is created by spec 09. It exports `stripFrontmatter`.

Add as line 1 (before the SPDX comment, or as line 2 after it):
```js
// @ts-check
```

Annotate `stripFrontmatter`:
```js
/**
 * Strips a YAML frontmatter block from the start of a Markdown string.
 * The opening `---` must be at byte 0; a CommonMark HR in the body is not affected.
 *
 * @param {string} content - Raw file content including optional frontmatter.
 * @returns {string} Content with the frontmatter block removed, or the original string if none.
 */
function stripFrontmatter(content) {
```

### Step 5 — Add `// @ts-check` and JSDoc to `scripts/lib/resolve.mjs`

This file is created by spec 09. It exports `resolvePageId`.

Add `// @ts-check` at the top.

Annotate `resolvePageId`:
```js
/**
 * Resolves a page argument to a numeric Confluence page ID.
 * Accepts either a bare numeric string ("987654321") or a key name looked up
 * in `confluence-pages.json` at the current working directory.
 *
 * @param {string} arg - Raw user input: numeric ID or confluence-pages.json key.
 * @returns {number} Positive integer Confluence page ID.
 */
function resolvePageId(arg) {
```

### Step 6 — Add `// @ts-check` and JSDoc to `scripts/lib/inject.mjs`

This file is created by spec 09. It exports `injectContent`.

Add at the top:
```js
// @ts-check
/** @import { InjectOptions } from './types.mjs' */
```

Annotate `injectContent`:
```js
/**
 * Injects `newHtml` into `existingBody` using one of three strategies:
 * 1. Plain-text markers ([AUTO_INSERT_START:label] / [AUTO_INSERT_END:label])
 * 2. Confluence anchor macros (md-start / md-end)
 * 3. Append (no markers found)
 *
 * @param {string} existingBody - Current Confluence page storage-format HTML.
 * @param {string} newHtml - New HTML to inject (output of marked()).
 * @param {string} title - Page title, used in error messages only.
 * @param {InjectOptions} [opts] - Reserved for future flags (unused in current implementation).
 * @returns {string} Updated storage-format HTML with new content injected.
 */
function injectContent(existingBody, newHtml, title, opts) {
```

### Step 7 — Add `// @ts-check` and JSDoc to `scripts/push-to-confluence.mjs`

Add `// @ts-check` as line 3 (after `#!/usr/bin/env node` and the SPDX comment):

```js
#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic
```

Add import directives after the copyright comment (before the `import` statements):
```js
/** @import { Credentials, HttpResponse, PageData } from './lib/types.mjs' */
```

Annotate key functions:

**`loadCredentials`:**
```js
/**
 * Loads Confluence credentials from environment variables or ~/.unic-confluence.json.
 * Exits with code 1 if credentials are not configured.
 *
 * @returns {Credentials}
 */
function loadCredentials() {
```

**`makeBasicAuth`:**
```js
/**
 * @param {string} username
 * @param {string} token
 * @returns {string} Base64-encoded Basic auth header value.
 */
function makeBasicAuth(username, token) {
```

**`httpsRequest`:**
```js
/**
 * Makes an HTTPS request and resolves with the status code and response body.
 * Rejects if the network is unreachable.
 *
 * @param {string} method - HTTP method ("GET" or "PUT").
 * @param {string} urlStr - Full HTTPS URL.
 * @param {string} authHeader - Authorization header value.
 * @param {object} [bodyObj] - Request body object, JSON-serialised if provided.
 * @returns {Promise<HttpResponse>}
 */
function httpsRequest(method, urlStr, authHeader, bodyObj) {
```

**`handleHttpError`** (after spec 12 has updated the signature):
```js
/**
 * Prints a human-readable error for a non-2xx HTTP response and exits with code 1.
 *
 * @param {number} status - HTTP status code.
 * @param {string} title - Page title, used in error messages.
 * @param {{ pageArg?: string, filePath?: string }} [opts] - Used to build the 409 retry hint.
 * @returns {never}
 */
function handleHttpError(status, title, { pageArg = "", filePath = "" } = {}) {
```

Note `@returns {never}` — `handleHttpError` always calls `process.exit(1)`, so its return type is `never`. This allows tsc to understand that code after a `handleHttpError` call is unreachable.

### Step 8 — Fix type errors surfaced by `pnpm typecheck`

Run `pnpm typecheck` and address each error. Common issues and their fixes:

**Issue 1: `JSON.parse` returns `any`**

On lines where `JSON.parse` result is assigned, add a cast comment:

```js
// BEFORE:
const pageData = JSON.parse(getRes.body);

// AFTER:
/** @type {PageData} */
const pageData = /** @type {PageData} */ (JSON.parse(getRes.body));
```

Similarly for `confluence-pages.json` parsing in `resolvePageId`:
```js
/** @type {Record<string, unknown>} */
const pages = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(pagesPath, "utf8")));
```

**Issue 2: `process.argv[n]` is `string | undefined`**

In `main()`, `process.argv.slice(2)` returns `string[]`. Destructuring:
```js
const [pageArg, filePath] = args;
```
gives `pageArg: string | undefined` and `filePath: string | undefined`. The `args.length < 2` guard before this line narrows the array length but tsc may not narrow the destructured variables. Fix by adding a post-guard assertion or using non-null assertion style:

```js
// BEFORE:
const [pageArg, filePath] = args;

// AFTER:
const pageArg  = args[0] ?? "";
const filePath = args[1] ?? "";
```

This is safe because the `args.length < 2` guard above already exits if either is missing. The `?? ""` provides a fallback that satisfies the type checker without adding a second runtime check.

**Issue 3: `pageData?.version?.number` is `number | undefined`**

```js
// BEFORE:
const version = pageData?.version?.number;
if (!Number.isInteger(version) || version <= 0) {

// AFTER — same runtime behaviour, tsc-friendly:
const version = pageData?.version?.number;
if (typeof version !== "number" || !Number.isInteger(version) || version <= 0) {
```

The `typeof version !== "number"` check narrows the type to `number` for the rest of the block, satisfying `strictNullChecks`. `Number.isInteger` alone does not narrow `number | undefined` to `number` in tsc's type system.

**Issue 4: optional chaining on typed objects**

After the `pageData` cast, `pageData.title` and `pageData.body.storage.value` may still need optional chaining guards because `PageData` is defined with all fields required but the actual Confluence response could omit them if the API changes. Keep the `?? ""` fallbacks — they are correct.

### Step 9 — Add `// @ts-check` to `scripts/sync-version.mjs`

This file is created by spec 06 (version sync). Add `// @ts-check` at the top and annotate its functions following the same pattern. The exact annotations depend on spec 06's implementation. At minimum:
- Any function that reads JSON files should cast the `JSON.parse` result.
- Any function that writes files should have `@param` annotations.

### Step 10 — Verify zero type errors

```sh
pnpm typecheck
# Expected: exit 0, no output
```

If errors remain after step 8, address them one by one. Do NOT disable `@ts-check` or add `@ts-ignore` directives to work around errors — fix the underlying type issue. The only acceptable suppression is `// @ts-expect-error` with a comment explaining why, on a line where tsc is provably wrong.

## Test cases

### TC-01: `pnpm typecheck` exits 0 on clean codebase
```sh
pnpm typecheck
# Expected: exit 0
```

### TC-02: Introducing a type error causes `pnpm typecheck` to exit 1
Temporarily add to `push-to-confluence.mjs`:
```js
const x = loadCredentials();
const bad = x.nonExistentField; // 'nonExistentField' does not exist on type 'Credentials'
```
```sh
pnpm typecheck
# Expected: exit 1, output mentions 'nonExistentField' and 'Credentials'
```
Remove the line afterward.

### TC-03: `handleHttpError` return type is `never`
After annotating `@returns {never}`, tsc should not complain about unreachable code after a call to `handleHttpError`. Verify by adding code after a `handleHttpError` call and checking that tsc reports it as unreachable (not as an error, but as a warning, depending on tsc flags).

### TC-04: `JSON.parse` casts suppress `any` propagation
After adding `/** @type {PageData} */` casts, `pageData.title` should be typed as `string` (not `any`) in the IDE. Verify in VS Code by hovering over `title`.

### TC-05: No `.ts` files created
```sh
find scripts -name "*.ts" | wc -l
# Expected: 0
```

### TC-06: `pnpm test` still passes
```sh
pnpm test
# Expected: exit 0 — JSDoc annotations must not break any existing tests
```

## Acceptance criteria

- `// @ts-check` appears at the top of all `.mjs` files in `scripts/` (including lib files from spec 09)
- `scripts/lib/types.mjs` exists with `Credentials`, `HttpResponse`, `PageVersion`, `PageData`, and `InjectOptions` typedefs
- `loadCredentials`, `httpsRequest`, `handleHttpError`, `stripFrontmatter`, `injectContent`, and `resolvePageId` all have `@param` and `@returns` JSDoc annotations
- `pnpm typecheck` exits 0 with zero errors
- No `@ts-ignore` directives (only `@ts-expect-error` with comments if truly needed)
- No `.ts` files created
- No `tsconfig.json` created (inline tsc flags are sufficient)
- `pnpm test` still passes
- `pnpm ci:check` still passes (Biome does not lint JSDoc beyond basic formatting)

## Verification

```sh
# Confirm @ts-check in all .mjs source files
grep -rL "@ts-check" scripts/
# Expected: empty output (all files have it)

# Confirm types.mjs exists
ls scripts/lib/types.mjs

# Run type check
pnpm typecheck

# Confirm no .ts files
find scripts -name "*.ts"
# Expected: empty

# Confirm no @ts-ignore
grep -rn "@ts-ignore" scripts/
# Expected: 0 results

# Run tests
pnpm test
```

## Out of scope

- Do not convert any `.mjs` file to `.ts`.
- Do not create a `tsconfig.json` (inline flags are sufficient for this repo size).
- Do not add `strict: false` to work around errors — fix the underlying issues.
- Do not add `@ts-ignore` directives.
- Do not annotate test files (`*.test.mjs`) — they are not type-checked by the command in step 2.
- Do not annotate the Biome config (`biome.json`) or GitHub Actions workflow — they are not JS files.

## Follow-ups

- Create a `tsconfig.json` if the inline `tsc` flags line grows longer than ~120 chars or if a second `checkJs` target (e.g. test files) is added.
- Add `typecheck` to the CI workflow (`.github/workflows/ci.yml`) as a fourth step after `pnpm test` — deferred because spec 10 (CI) ships before spec 14, so this requires updating the workflow file.
- Once all type errors are resolved and the codebase is stable under `--strict`, consider tightening further with `--noUncheckedIndexedAccess` to catch array index access (`args[0]` returning `string | undefined`).
