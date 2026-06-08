// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
	decideSpawnSet,
	hasCommentChanges,
	hasErrorHandlingChanges,
	parseInput,
	parseStdin,
	shouldRunPhase2,
} from '../scripts/lib/changed-file-analyser.mjs'

const SCRIPT = path.resolve(fileURLToPath(import.meta.url), '../../scripts/lib/changed-file-analyser.mjs')

describe('decideSpawnSet', () => {
	it('returns empty Set for an empty changed-files list', () => {
		assert.deepEqual(decideSpawnSet([]), new Set())
	})

	it('throws when given a non-array', () => {
		// @ts-expect-error — intentional misuse to verify the guard
		assert.throws(() => decideSpawnSet(undefined), /must be an array/)
		// @ts-expect-error — intentional misuse to verify the guard
		assert.throws(() => decideSpawnSet(null), /must be an array/)
	})

	describe('code-reviewer', () => {
		it('is always included for a non-empty diff (source file)', () => {
			assert.ok(decideSpawnSet(['src/index.mjs']).has('code-reviewer'))
		})

		it('is always included for a non-empty diff (markdown file)', () => {
			assert.ok(decideSpawnSet(['README.md']).has('code-reviewer'))
		})
	})

	describe('silent-failure-hunter', () => {
		it('is spawned when a JS source file changed', () => {
			assert.ok(decideSpawnSet(['src/service.mjs']).has('silent-failure-hunter'))
		})

		it('is spawned when a TypeScript source file changed', () => {
			assert.ok(decideSpawnSet(['lib/handler.ts']).has('silent-failure-hunter'))
		})

		it('is NOT spawned when only test files changed', () => {
			assert.ok(!decideSpawnSet(['tests/service.test.mjs']).has('silent-failure-hunter'))
		})

		it('is NOT spawned when only markdown files changed', () => {
			assert.ok(!decideSpawnSet(['docs/guide.md']).has('silent-failure-hunter'))
		})

		it('is NOT spawned when only a .d.ts declaration file changed', () => {
			assert.ok(!decideSpawnSet(['src/types/user.d.ts']).has('silent-failure-hunter'))
		})

		it('is spawned for a literal d.ts file (no dot before d — not a declaration file)', () => {
			assert.ok(decideSpawnSet(['src/d.ts']).has('silent-failure-hunter'))
		})

		describe('content-aware gate (diff content)', () => {
			it('spawns silent-failure-hunter when try/catch is added', () => {
				const diff = `--- a/src/service.mjs\n+++ b/src/service.mjs\n@@ -1,3 +1,6 @@\n async function load() {\n+  try {\n     return await fetch('/api')\n+  } catch (err) {\n+    return null\n+  }\n }\n`
				const result = decideSpawnSet(['src/service.mjs'], diff)
				assert.ok(result.has('silent-failure-hunter'))
			})

			it('spawns silent-failure-hunter when .catch() is removed', () => {
				const diff = `--- a/src/client.mjs\n+++ b/src/client.mjs\n@@ -1,3 +1,2 @@\n fetch('/api')\n-  .catch(err => console.error(err))\n   .then(r => r.json())\n`
				const result = decideSpawnSet(['src/client.mjs'], diff)
				assert.ok(result.has('silent-failure-hunter'))
			})

			it('spawns silent-failure-hunter for a bare throw', () => {
				const diff = `--- a/src/validate.mjs\n+++ b/src/validate.mjs\n@@ -1,3 +1,4 @@\n function validate(x) {\n+  if (!x) throw new Error('required')\n   return x\n }\n`
				const result = decideSpawnSet(['src/validate.mjs'], diff)
				assert.ok(result.has('silent-failure-hunter'))
			})

			it('does NOT spawn silent-failure-hunter for a pure rename/constant change in a non-source file', () => {
				const diff = `--- a/docs/only-doc-file.md\n+++ b/docs/only-doc-file.md\n@@ -1,3 +1,3 @@\n const MAX_RETRIES = 3\n-const TIMEOUT = 5000\n+const TIMEOUT = 10000\n const BASE_URL = '/api'\n`
				const result = decideSpawnSet(['docs/only-doc-file.md'], diff)
				assert.ok(!result.has('silent-failure-hunter'))
			})

			it('spawns silent-failure-hunter via content gate even for a non-source-path file (OR-combination)', () => {
				const diff = `--- a/config/settings.json\n+++ b/config/settings.json\n@@ -1,2 +1,3 @@\n {\n+  "onError": "throw"\n }\n`
				const result = decideSpawnSet(['config/settings.json'], diff)
				assert.ok(result.has('silent-failure-hunter'))
			})

			it('still spawns silent-failure-hunter for a source-file path even with empty diff (path fast-path intact)', () => {
				assert.ok(decideSpawnSet(['src/service.mjs'], '').has('silent-failure-hunter'))
			})

			it('does NOT spawn silent-failure-hunter for a doc-only path with empty diff', () => {
				assert.ok(!decideSpawnSet(['docs/guide.md'], '').has('silent-failure-hunter'))
			})
		})
	})

	describe('type-design-analyzer', () => {
		it('is spawned when a TypeScript declaration file changed', () => {
			assert.ok(decideSpawnSet(['src/types/user.d.ts']).has('type-design-analyzer'))
		})

		it('is spawned when a TypeScript source file changed', () => {
			assert.ok(decideSpawnSet(['src/auth.ts']).has('type-design-analyzer'))
		})

		it('is spawned when a file inside a types/ directory changed', () => {
			assert.ok(decideSpawnSet(['src/types/order.mjs']).has('type-design-analyzer'))
		})

		it('is NOT spawned when only plain JS files changed', () => {
			assert.ok(!decideSpawnSet(['src/utils.mjs']).has('type-design-analyzer'))
		})

		it('is NOT spawned when only markdown files changed', () => {
			assert.ok(!decideSpawnSet(['README.md']).has('type-design-analyzer'))
		})
	})

	describe('pr-test-analyzer', () => {
		it('is spawned when a .test.mjs file changed', () => {
			assert.ok(decideSpawnSet(['tests/service.test.mjs']).has('pr-test-analyzer'))
		})

		it('is spawned when a .spec.ts file changed', () => {
			assert.ok(decideSpawnSet(['src/__tests__/util.spec.ts']).has('pr-test-analyzer'))
		})

		it('is spawned when a file inside a tests/ directory changed', () => {
			assert.ok(decideSpawnSet(['tests/helpers.mjs']).has('pr-test-analyzer'))
		})

		it('is NOT spawned when only source files changed', () => {
			assert.ok(!decideSpawnSet(['src/index.mjs']).has('pr-test-analyzer'))
		})

		it('is NOT spawned when only markdown files changed', () => {
			assert.ok(!decideSpawnSet(['README.md']).has('pr-test-analyzer'))
		})
	})

	describe('comment-analyzer', () => {
		it('is spawned when a .md file changed', () => {
			assert.ok(decideSpawnSet(['docs/guide.md']).has('comment-analyzer'))
		})

		it('is spawned when README.md changed', () => {
			assert.ok(decideSpawnSet(['README.md']).has('comment-analyzer'))
		})

		it('is spawned when a .mdx file changed', () => {
			assert.ok(decideSpawnSet(['docs/api.mdx']).has('comment-analyzer'))
		})

		it('is spawned when a file inside a docs/ directory changed', () => {
			assert.ok(decideSpawnSet(['docs/adr/0001-something.mjs']).has('comment-analyzer'))
		})

		it('is NOT spawned when only source files changed', () => {
			assert.ok(!decideSpawnSet(['src/service.mjs']).has('comment-analyzer'))
		})

		it('is NOT spawned when only test files changed', () => {
			assert.ok(!decideSpawnSet(['tests/service.test.mjs']).has('comment-analyzer'))
		})

		describe('content-aware gate (diff content)', () => {
			it('spawns comment-analyzer for a code-only diff with an added inline comment (PR #5612 case)', () => {
				const diff = `--- a/src/component.tsx\n+++ b/src/component.tsx\n@@ -1,3 +1,4 @@\n const x = 1\n+// TODO: fix this\n const y = 2\n`
				const result = decideSpawnSet(['src/component.tsx'], diff)
				assert.ok(result.has('comment-analyzer'))
			})

			it('does NOT spawn comment-analyzer for code-only diff with no comment changes', () => {
				const diff = `--- a/src/component.tsx\n+++ b/src/component.tsx\n@@ -1,3 +1,3 @@\n const x = 1\n-const y = 2\n+const y = 3\n`
				const result = decideSpawnSet(['src/component.tsx'], diff)
				assert.ok(!result.has('comment-analyzer'))
			})

			it('still spawns comment-analyzer for doc-file path even with empty diff (path fast-path intact)', () => {
				assert.ok(decideSpawnSet(['README.md'], '').has('comment-analyzer'))
			})

			it('backward-compatible: no diffContent arg keeps path-only logic unchanged', () => {
				assert.ok(decideSpawnSet(['README.md']).has('comment-analyzer'))
				assert.ok(!decideSpawnSet(['src/index.mjs']).has('comment-analyzer'))
			})

			it('other gates are unaffected by the diffContent arg', () => {
				const diff = `--- a/src/index.tsx\n+++ b/src/index.tsx\n@@ -1 +1 @@\n-const x = 1\n+// now a comment\n`
				const result = decideSpawnSet(['src/component.mjs'], diff)
				assert.ok(result.has('code-reviewer'), 'code-reviewer always present')
				assert.ok(result.has('silent-failure-hunter'), 'sfh: source file')
				assert.ok(!result.has('type-design-analyzer'), 'no tsx/ts file')
				assert.ok(!result.has('pr-test-analyzer'), 'no test file')
				assert.ok(!result.has('code-simplifier'), 'only 1 source file')
				assert.ok(result.has('comment-analyzer'), 'comment-analyzer via diff content')
			})
		})
	})

	describe('code-simplifier', () => {
		it('is never in the Phase 1 spawn set — it runs as a Phase 2 post-pass (ADR-0013)', () => {
			const three = ['src/a.mjs', 'src/b.mjs', 'src/c.mjs']
			assert.ok(!decideSpawnSet(three).has('code-simplifier'), 'not in spawn set for 3 source files')
		})

		it('is absent from the spawn set even for many source files', () => {
			const files = ['src/a.mjs', 'src/b.mjs', 'src/c.mjs', 'src/d.ts']
			assert.ok(!decideSpawnSet(files).has('code-simplifier'))
		})
	})

	describe('mixed-content diff', () => {
		it('spawns the expected subset for code + tests + docs + types', () => {
			const files = [
				'src/service.mjs',
				'src/utils.mjs',
				'src/auth.ts',
				'tests/service.test.mjs',
				'docs/guide.md',
				'src/types/user.d.ts',
			]
			const result = decideSpawnSet(files)
			assert.ok(result.has('code-reviewer'), 'code-reviewer')
			assert.ok(result.has('silent-failure-hunter'), 'silent-failure-hunter')
			assert.ok(result.has('type-design-analyzer'), 'type-design-analyzer')
			assert.ok(result.has('pr-test-analyzer'), 'pr-test-analyzer')
			assert.ok(result.has('comment-analyzer'), 'comment-analyzer')
			assert.ok(!result.has('code-simplifier'), 'code-simplifier is Phase 2 only — not in Phase 1 spawn set (ADR-0013)')
		})

		it('spawns code-reviewer and silent-failure-hunter for a single plain source file', () => {
			const result = decideSpawnSet(['src/index.mjs'])
			assert.ok(result.has('code-reviewer'))
			assert.ok(result.has('silent-failure-hunter'))
			assert.ok(!result.has('type-design-analyzer'))
			assert.ok(!result.has('pr-test-analyzer'))
			assert.ok(!result.has('comment-analyzer'))
			assert.ok(!result.has('code-simplifier'))
		})
	})

	describe('Windows backslash paths', () => {
		it('isTestFile predicate matches Windows-style test paths', () => {
			assert.ok(decideSpawnSet(['tests\\service.test.mjs']).has('pr-test-analyzer'))
		})

		it('isTestFile predicate matches Windows-style __tests__ directory', () => {
			assert.ok(decideSpawnSet(['src\\__tests__\\util.spec.ts']).has('pr-test-analyzer'))
		})

		it('isTypeFile predicate matches Windows-style types directory', () => {
			assert.ok(decideSpawnSet(['src\\types\\user.d.ts']).has('type-design-analyzer'))
		})

		it('isDocFile predicate matches Windows-style docs directory', () => {
			assert.ok(decideSpawnSet(['docs\\adr\\0001-something.mjs']).has('comment-analyzer'))
		})

		it('isSourceFile does not match Windows-style test files', () => {
			assert.ok(!decideSpawnSet(['tests\\service.test.mjs']).has('silent-failure-hunter'))
		})
	})
})

describe('parseStdin', () => {
	it('splits LF-separated input into trimmed paths', () => {
		assert.deepEqual(parseStdin('src/a.mjs\nsrc/b.ts\n'), ['src/a.mjs', 'src/b.ts'])
	})

	it('splits CRLF-separated input and strips the trailing carriage return', () => {
		assert.deepEqual(parseStdin('src/a.mjs\r\nsrc/b.ts\r\n'), ['src/a.mjs', 'src/b.ts'])
	})

	it('drops blank and whitespace-only lines', () => {
		assert.deepEqual(parseStdin('  \r\nsrc/a.mjs\r\n\r\n'), ['src/a.mjs'])
	})

	it('returns an empty array for empty input', () => {
		assert.deepEqual(parseStdin(''), [])
	})

	it('feeds clean paths into decideSpawnSet for CRLF input', () => {
		const result = decideSpawnSet(parseStdin('src/service.mjs\r\n'))
		assert.ok(result.has('silent-failure-hunter'))
	})
})

describe('hasCommentChanges', () => {
	it('returns true when a JS single-line comment line is added', () => {
		const diff = `--- a/src/index.tsx\n+++ b/src/index.tsx\n@@ -1,3 +1,4 @@\n const x = 1\n+// added this comment\n const y = 2\n`
		assert.ok(hasCommentChanges(diff))
	})

	it('returns true when a JS single-line comment line is removed', () => {
		const diff = `--- a/src/index.tsx\n+++ b/src/index.tsx\n@@ -1,4 +1,3 @@\n const x = 1\n-// removed comment\n const y = 2\n const z = 3\n`
		assert.ok(hasCommentChanges(diff))
	})

	it('returns true when a JSDoc block-comment line is added', () => {
		const diff = `--- a/src/utils.ts\n+++ b/src/utils.ts\n@@ -1,2 +1,4 @@\n+/**\n+ * Returns the answer.\n+ */\n export function answer() { return 42 }\n`
		assert.ok(hasCommentChanges(diff))
	})

	it('returns true when an HTML comment is added', () => {
		const diff = `--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,2 +1,3 @@\n export default function App() {\n+  {/* render section */}\n   return <div />\n`
		assert.ok(hasCommentChanges(diff))
	})

	it('returns false for a no-comment source edit (PR #5612 negative case)', () => {
		const diff = `--- a/src/index.tsx\n+++ b/src/index.tsx\n@@ -1,3 +1,3 @@\n const x = 1\n-const y = 2\n+const y = 3\n`
		assert.ok(!hasCommentChanges(diff))
	})

	it('returns false for a doc-file change with no comment tokens', () => {
		const diff = `--- a/README.md\n+++ b/README.md\n@@ -1,2 +1,2 @@\n # Title\n-old paragraph\n+new paragraph\n`
		assert.ok(!hasCommentChanges(diff))
	})

	it('returns false for an SPDX-only change (license boilerplate excluded)', () => {
		const diff = `--- a/src/lib.mjs\n+++ b/src/lib.mjs\n@@ -1,2 +1,2 @@\n-// SPDX-License-Identifier: MIT\n+// SPDX-License-Identifier: LGPL-3.0-or-later\n`
		assert.ok(!hasCommentChanges(diff))
	})

	it('returns false for a Copyright-only change', () => {
		const diff = `--- a/src/lib.mjs\n+++ b/src/lib.mjs\n@@ -1,2 +1,2 @@\n-// Copyright © 2025 Unic\n+// Copyright © 2026 Unic\n`
		assert.ok(!hasCommentChanges(diff))
	})

	it('returns false for empty diff', () => {
		assert.ok(!hasCommentChanges(''))
	})

	it('ignores diff header lines (+++ / ---) even when they mention comment-like paths', () => {
		const diff = `--- a/src/comments.ts\n+++ b/src/comments.ts\n@@ -1 +1 @@\n-export const x = 1\n+export const x = 2\n`
		assert.ok(!hasCommentChanges(diff))
	})

	it('returns true when a shell-style # comment line is added', () => {
		const diff = `--- a/scripts/deploy.sh\n+++ b/scripts/deploy.sh\n@@ -1,2 +1,3 @@\n set -e\n+# TODO: add rollback step\n echo done\n`
		assert.ok(hasCommentChanges(diff))
	})

	it('returns true when a shebang line is added', () => {
		const diff = `--- /dev/null\n+++ b/scripts/new.sh\n@@ -0,0 +1,2 @@\n+#!/usr/bin/env node\n+console.log('hello')\n`
		assert.ok(hasCommentChanges(diff))
	})

	it('handles CRLF-terminated diff lines correctly', () => {
		const diff = '--- a/src/index.tsx\r\n+++ b/src/index.tsx\r\n@@ -1 +1 @@\r\n-const x = 1\r\n+// added comment\r\n'
		assert.ok(hasCommentChanges(diff))
	})

	// Pinned Y-det tradeoff (ADR-0008): the token regex is anchored at line start, so a
	// trailing comment appended to a code line is NOT detected. This is deliberate — an
	// unanchored `//` matches inside URL/string literals and over-fires. If the gate is
	// ever extended to catch trailing comments, update these assertions intentionally.
	it('returns false for a trailing comment on a code line (anchored-token tradeoff)', () => {
		const diff = `--- a/src/lib.mjs\n+++ b/src/lib.mjs\n@@ -1 +1 @@\n-const x = 1\n+const x = 1 // bump the counter\n`
		assert.ok(!hasCommentChanges(diff))
	})

	it('returns false for a URL literal containing // (the false positive the anchor prevents)', () => {
		const diff = `--- a/src/lib.mjs\n+++ b/src/lib.mjs\n@@ -1 +1 @@\n-const url = 'https://old.example.com'\n+const url = 'https://new.example.com'\n`
		assert.ok(!hasCommentChanges(diff))
	})
})

describe('hasErrorHandlingChanges', () => {
	it('returns true when a try block is added', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  try {\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns true when a catch clause is added', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  } catch (err) {\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns true when a finally block is added', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  } finally {\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns true when a throw statement is added', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  throw new Error('oops')\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns true when a .catch() Promise handler is added', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  .catch(e => log(e))\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns true when a Promise.reject() is added', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  return Promise.reject(new Error('no'))\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns true when an error identifier is added (broad arm, ADR-0008 spawning bias)', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  const error = result.failure\n const x = 1\n`
		assert.ok(hasErrorHandlingChanges(diff))
	})

	it('returns false for a pure numeric-constant change (no error-handling tokens)', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1 @@\n-const TIMEOUT = 5000\n+const TIMEOUT = 10000\n`
		assert.ok(!hasErrorHandlingChanges(diff))
	})

	it('returns false for compound identifiers errorMessage / errCount (\\b boundary guard)', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1 +1,2 @@\n+  const errorMessage = response.data\n+  let errCount = 0\n`
		assert.ok(!hasErrorHandlingChanges(diff))
	})

	it('returns false when an error token appears only on an unchanged context line', () => {
		const diff = `--- a/src/a.mjs\n+++ b/src/a.mjs\n@@ -1,3 +1,3 @@\n   throw new Error('untouched')\n-const x = 1\n+const x = 2\n`
		assert.ok(!hasErrorHandlingChanges(diff))
	})

	it('returns false for empty diff', () => {
		assert.ok(!hasErrorHandlingChanges(''))
	})

	it('ignores diff header lines (+++ / ---) even when the path mentions error', () => {
		const diff = `--- a/src/error-utils.mjs\n+++ b/src/error-utils.mjs\n@@ -1 +1 @@\n-export const x = 1\n+export const x = 2\n`
		assert.ok(!hasErrorHandlingChanges(diff))
	})

	it('handles CRLF-terminated diff lines correctly', () => {
		const diff = '--- a/src/a.mjs\r\n+++ b/src/a.mjs\r\n@@ -1 +1,2 @@\r\n+  } catch (err) {\r\n const x = 1\r\n'
		assert.ok(hasErrorHandlingChanges(diff))
	})
})

describe('parseInput', () => {
	it('parses plain-text lines as files with empty diff (backward compat)', () => {
		const result = parseInput('src/a.mjs\nsrc/b.ts\n')
		assert.deepEqual(result.files, ['src/a.mjs', 'src/b.ts'])
		assert.equal(result.diff, '')
	})

	it('parses JSON input and returns files + diff', () => {
		const input = JSON.stringify({ files: ['src/a.mjs'], diff: '--- a\n+++ b\n+// comment\n' })
		const result = parseInput(input)
		assert.deepEqual(result.files, ['src/a.mjs'])
		assert.ok(result.diff.includes('+// comment'))
	})

	it('parses JSON with missing diff field as empty diff', () => {
		const input = JSON.stringify({ files: ['src/a.mjs'] })
		const result = parseInput(input)
		assert.equal(result.diff, '')
	})

	it('parses JSON with missing files field as empty files', () => {
		const input = JSON.stringify({ diff: '--- a\n+++ b\n' })
		const result = parseInput(input)
		assert.deepEqual(result.files, [])
	})

	it('round-trips: JSON input flows into decideSpawnSet correctly', () => {
		const diff = `--- a/src/c.tsx\n+++ b/src/c.tsx\n@@ -1 +1 @@\n-const x = 1\n+// now a comment\n`
		const { files, diff: d } = parseInput(JSON.stringify({ files: ['src/c.tsx'], diff }))
		assert.ok(decideSpawnSet(files, d).has('comment-analyzer'))
	})

	it('throws SyntaxError for malformed JSON input starting with {', () => {
		assert.throws(
			() => parseInput('{bad json}'),
			(err) => err instanceof SyntaxError
		)
	})
})

describe('CLI entry point', () => {
	it('emits a JSON array of agent names to stdout for a source file', () => {
		const result = spawnSync('node', [SCRIPT], {
			input: 'src/service.mjs\n',
			encoding: 'utf8',
		})
		assert.equal(result.status, 0)
		const agents = JSON.parse(result.stdout.trim())
		assert.ok(Array.isArray(agents))
		assert.ok(agents.includes('code-reviewer'))
		assert.ok(agents.includes('silent-failure-hunter'))
	})

	it('handles CRLF-separated stdin (no trailing \\r breaks classification)', () => {
		const result = spawnSync('node', [SCRIPT], {
			input: 'src/service.mjs\r\nsrc/auth.ts\r\n',
			encoding: 'utf8',
		})
		assert.equal(result.status, 0)
		const agents = JSON.parse(result.stdout.trim())
		assert.ok(agents.includes('silent-failure-hunter'))
		assert.ok(agents.includes('type-design-analyzer'))
	})

	it('emits an empty JSON array for empty stdin', () => {
		const result = spawnSync('node', [SCRIPT], { input: '', encoding: 'utf8' })
		assert.equal(result.status, 0)
		assert.deepEqual(JSON.parse(result.stdout.trim()), [])
	})

	it('emits an empty JSON array for whitespace-only stdin', () => {
		const result = spawnSync('node', [SCRIPT], { input: '   \n\n  \n', encoding: 'utf8' })
		assert.equal(result.status, 0)
		assert.deepEqual(JSON.parse(result.stdout.trim()), [])
	})

	it('produces valid JSON with a trailing newline', () => {
		const result = spawnSync('node', [SCRIPT], { input: 'src/a.mjs\n', encoding: 'utf8' })
		assert.ok(result.stdout.endsWith('\n'), 'stdout must end with newline')
		assert.doesNotThrow(() => JSON.parse(result.stdout.trim()))
	})

	it('spawns five Phase 1 agents for a mixed-content diff via stdin (code-simplifier is Phase 2 only)', () => {
		const input = `${[
			'src/service.mjs',
			'src/utils.mjs',
			'src/auth.ts',
			'tests/service.test.mjs',
			'docs/guide.md',
			'src/types/user.d.ts',
		].join('\n')}\n`
		const result = spawnSync('node', [SCRIPT], { input, encoding: 'utf8' })
		assert.equal(result.status, 0)
		const agents = JSON.parse(result.stdout.trim())
		assert.ok(Array.isArray(agents))
		assert.ok(agents.includes('code-reviewer'))
		assert.ok(agents.includes('silent-failure-hunter'))
		assert.ok(agents.includes('type-design-analyzer'))
		assert.ok(agents.includes('pr-test-analyzer'))
		assert.ok(agents.includes('comment-analyzer'))
		assert.ok(!agents.includes('code-simplifier'), 'code-simplifier absent from Phase 1 spawn set (ADR-0013)')
	})
})

describe('shouldRunPhase2', () => {
	const THREE_SOURCE = ['src/a.mjs', 'src/b.mjs', 'src/c.mjs']
	const TWO_SOURCE = ['src/a.mjs', 'src/b.mjs']

	it('throws when changedFiles is not an array', () => {
		// @ts-expect-error — intentional misuse
		assert.throws(() => shouldRunPhase2(null, []), /changedFiles must be an array/)
	})

	it('throws when findings is not an array', () => {
		// @ts-expect-error — intentional misuse
		assert.throws(() => shouldRunPhase2(THREE_SOURCE, null), /findings must be an array/)
	})

	it('returns true when Phase 1 passes and ≥3 source files changed (canonical AC scenario)', () => {
		const findings = [{ severity: 'minor' }, { severity: 'minor' }]
		assert.ok(shouldRunPhase2(THREE_SOURCE, findings))
	})

	it('returns true when Phase 1 has zero findings and ≥3 source files changed', () => {
		assert.ok(shouldRunPhase2(THREE_SOURCE, []))
	})

	it('returns false when Phase 1 passes but <3 source files changed (canonical AC scenario)', () => {
		assert.ok(!shouldRunPhase2(TWO_SOURCE, []))
	})

	it('returns false when Phase 1 passes but only 1 source file changed', () => {
		assert.ok(!shouldRunPhase2(['src/a.mjs'], []))
	})

	it('returns false when Phase 1 has an Important finding — even with ≥3 source files (canonical AC scenario)', () => {
		const findings = [{ severity: 'important' }]
		assert.ok(!shouldRunPhase2(THREE_SOURCE, findings))
	})

	it('returns false when Phase 1 has a Critical finding — even with ≥3 source files', () => {
		const findings = [{ severity: 'critical' }]
		assert.ok(!shouldRunPhase2(THREE_SOURCE, findings))
	})

	it('returns false when Phase 1 has mixed Critical and Minor findings', () => {
		const findings = [{ severity: 'critical' }, { severity: 'minor' }]
		assert.ok(!shouldRunPhase2(THREE_SOURCE, findings))
	})

	it('test files do not count toward the ≥3 source-file threshold', () => {
		const files = ['src/a.mjs', 'tests/a.test.mjs', 'tests/b.test.mjs']
		assert.ok(!shouldRunPhase2(files, []))
	})

	it('.d.ts declaration files do not count toward the ≥3 source-file threshold', () => {
		const files = ['src/types/a.d.ts', 'src/types/b.d.ts', 'src/types/c.d.ts']
		assert.ok(!shouldRunPhase2(files, []))
	})

	it('returns true for exactly 3 source files with only Minor findings', () => {
		const findings = [{ severity: 'minor' }]
		assert.ok(shouldRunPhase2(['src/x.mjs', 'src/y.mjs', 'src/z.ts'], findings))
	})

	it('returns false for an empty changed-files list', () => {
		assert.ok(!shouldRunPhase2([], []))
	})

	it('accepts JSON stdin and applies content-aware comment gate', () => {
		const diff = `--- a/src/c.tsx\n+++ b/src/c.tsx\n@@ -1 +1 @@\n-const x = 1\n+// now a comment\n`
		const input = JSON.stringify({ files: ['src/component.tsx'], diff })
		const result = spawnSync('node', [SCRIPT], { input, encoding: 'utf8' })
		assert.equal(result.status, 0)
		const agents = JSON.parse(result.stdout.trim())
		assert.ok(agents.includes('comment-analyzer'), 'comment-analyzer spawned via content gate')
	})

	it('exits non-zero and writes to stderr for malformed JSON stdin', () => {
		const result = spawnSync('node', [SCRIPT], {
			input: '{invalid json}',
			encoding: 'utf8',
		})
		assert.notEqual(result.status, 0)
		assert.ok(result.stderr.includes('changed-file-analyser:'))
	})
})
