// @ts-check

import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const AGENTS_DIR = join(PLUGIN_ROOT, 'agents')
const HIDDEN_AGENTS_DIR = join(PLUGIN_ROOT, '.agents')

const EXPECTED_AGENTS = [
	'ado-fetcher',
	'ado-writer',
	're-review-coordinator',
	'doc-context-orchestrator',
	'doc-context-synthesizer',
]

describe('plugin structure', () => {
	it('agents/ directory exists', () => {
		assert.ok(existsSync(AGENTS_DIR), `expected agents/ directory at ${AGENTS_DIR}`)
	})

	it('.agents/ hidden directory does not exist', () => {
		assert.ok(
			!existsSync(HIDDEN_AGENTS_DIR),
			`.agents/ must be renamed to agents/ — found stale dir at ${HIDDEN_AGENTS_DIR}`
		)
	})

	it('all expected agent files are present in agents/', () => {
		const files = readdirSync(AGENTS_DIR)
			.filter((f) => f.endsWith('.md'))
			.map((f) => f.replace(/\.md$/, ''))
		for (const agent of EXPECTED_AGENTS) {
			assert.ok(files.includes(agent), `missing agent file: agents/${agent}.md`)
		}
	})

	it('each agent file has a name: field in frontmatter matching its filename stem', () => {
		for (const agent of EXPECTED_AGENTS) {
			const content = readFileSync(join(AGENTS_DIR, `${agent}.md`), 'utf8')
			const match = content.match(/^---\n([\s\S]*?)\n---/)
			assert.ok(match, `${agent}.md: missing YAML frontmatter`)
			const frontmatter = match[1]
			assert.ok(frontmatter.includes(`name: ${agent}`), `${agent}.md: frontmatter missing "name: ${agent}"`)
		}
	})
})
