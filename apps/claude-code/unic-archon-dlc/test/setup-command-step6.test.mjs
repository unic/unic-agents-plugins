// @ts-check

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

/**
 * Runs `/setup` Step 6's embedded heredoc for real, the same way
 * `archon-upgrade-command.test.mjs` runs Step 5 — a typo in a property name or a broken import path
 * fails CI here rather than only on a human's first real `/setup` run.
 */

const PLUGIN_ROOT = resolve(import.meta.dirname, '..')

/** Line endings normalised: the Windows CI runner checks out CRLF, and the heredoc regex does not match it. */
const COMMAND = readFileSync(join(PLUGIN_ROOT, 'commands', 'setup.md'), 'utf8').replace(/\r\n/g, '\n')

function scratchRepo() {
	const dir = join(tmpdir(), `unic-dlc-setup-step6-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	mkdirSync(dir, { recursive: true })
	return dir
}

test('the Step 6 heredoc installs the shipped workflows and reports the fields Step 8 reads', () => {
	const body = COMMAND.match(/## Step 6[\s\S]*?<<'EOJS'\n([\s\S]*?)\nEOJS/)?.[1]
	assert.ok(body, 'Step 6 heredoc body must be extractable')

	const cwd = scratchRepo() // no .archon/workflows/ yet, mirroring a fresh Consumer
	try {
		const stdout = execFileSync('node', ['--input-type=module'], {
			input: body.replace('{MERGED_CONFIG_JSON}', '{}'),
			cwd,
			env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
			encoding: 'utf8',
		})
		const result = JSON.parse(stdout)
		assert.equal(result.ok, true, `expected Step 6 to succeed: ${stdout}`)
		assert.ok(Array.isArray(result.workflowsInstalled))
		assert.deepEqual(result.workflowsDeleted, [])

		const shipped = readdirSync(join(PLUGIN_ROOT, '.archon', 'workflows')).filter((name) => !name.startsWith('.'))
		assert.deepEqual(result.workflowsInstalled.sort(), shipped.sort())
		assert.deepEqual(readdirSync(join(cwd, '.archon', 'workflows')).sort(), shipped.sort())
	} finally {
		rmSync(cwd, { recursive: true, force: true })
	}
})
