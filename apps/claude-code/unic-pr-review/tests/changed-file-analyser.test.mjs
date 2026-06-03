// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decideSpawnSet, parseStdin } from '../scripts/lib/changed-file-analyser.mjs'

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
	})

	describe('code-simplifier', () => {
		it('is spawned when 3 or more source files changed (complexity heuristic)', () => {
			assert.ok(decideSpawnSet(['src/a.mjs', 'src/b.mjs', 'src/c.mjs']).has('code-simplifier'))
		})

		it('is spawned when more than 3 source files changed', () => {
			const files = ['src/a.mjs', 'src/b.mjs', 'src/c.mjs', 'src/d.ts']
			assert.ok(decideSpawnSet(files).has('code-simplifier'))
		})

		it('is NOT spawned when only 2 source files changed', () => {
			assert.ok(!decideSpawnSet(['src/a.mjs', 'src/b.mjs']).has('code-simplifier'))
		})

		it('is NOT spawned when only 1 source file changed', () => {
			assert.ok(!decideSpawnSet(['src/a.mjs']).has('code-simplifier'))
		})

		it('test files do not count toward the source-file threshold', () => {
			const files = ['src/a.mjs', 'tests/a.test.mjs', 'tests/b.test.mjs']
			assert.ok(!decideSpawnSet(files).has('code-simplifier'))
		})

		it('.d.ts declaration files do not count toward the source-file threshold', () => {
			const files = ['src/types/a.d.ts', 'src/types/b.d.ts', 'src/types/c.d.ts']
			const result = decideSpawnSet(files)
			assert.ok(!result.has('code-simplifier'), 'code-simplifier not spawned')
			assert.ok(result.has('type-design-analyzer'), 'type-design-analyzer still spawned')
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
			assert.ok(result.has('code-simplifier'), 'code-simplifier (3+ source files)')
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

	it('spawns all six agents for a mixed-content diff via stdin', () => {
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
		assert.ok(agents.includes('code-simplifier'))
	})
})
