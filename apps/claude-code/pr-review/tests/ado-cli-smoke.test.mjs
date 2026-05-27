// @ts-check

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { findUninventoriedCommands } from '../scripts/ado/cli-completeness.mjs'
import { ADO_CLI_ALLOWLIST } from './fixtures/ado-cli-allowlist.mjs'
import { adoCliInventory } from './fixtures/ado-cli-inventory.mjs'

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIRS = ['agents', 'commands', 'scripts']
const SCANNABLE_EXT = /\.(md|mjs|js)$/
// scratchpad/ holds historical implementation notes, not active plugin code.
const SKIP_FRAGMENTS = ['/scratchpad/', '/node_modules/']

/**
 * @returns {{ path: string, content: string }[]}
 */
function loadPluginSources() {
	const out = []
	for (const dir of SCAN_DIRS) {
		const root = join(PLUGIN_ROOT, dir)
		for (const file of walk(root)) {
			if (!SCANNABLE_EXT.test(file)) continue
			// Normalise so the POSIX-style SKIP_FRAGMENTS also match on Windows paths.
			const normalised = file.replaceAll('\\', '/')
			if (SKIP_FRAGMENTS.some((f) => normalised.includes(f))) continue
			out.push({ path: relative(PLUGIN_ROOT, file), content: readFileSync(file, 'utf8') })
		}
	}
	return out
}

/**
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
	let entries
	try {
		entries = readdirSync(dir)
	} catch (err) {
		// Only swallow "directory not present" — every other read failure (permissions, FD
		// exhaustion, IO error) must surface, otherwise the smoke test reports a green
		// "no uninventoried commands" even when the scan never ran.
		if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return
		throw err
	}
	for (const name of entries) {
		const full = join(dir, name)
		const st = statSync(full)
		if (st.isDirectory()) yield* walk(full)
		else yield full
	}
}

describe('ADO CLI smoke', () => {
	// The first `az repos|devops|boards` invocation on a runner without the azure-devops extension
	// cached pays a one-time lazy-load cost that exceeds the per-test 5s budget. Warm it up here
	// so each per-entry assertion measures the actual subcommand, not the extension bootstrap.
	before(() => {
		const result = spawnSync('az', ['repos', '--help'], { timeout: 30000, encoding: 'utf8' })
		if (result.error && /** @type {NodeJS.ErrnoException} */ (result.error).code === 'ENOENT') {
			// az not installed — per-entry tests will self-skip.
			return
		}
	})

	it('every `az` invocation in agents/, commands/, scripts/ is in the inventory', () => {
		const uninventoried = findUninventoriedCommands({
			sources: loadPluginSources(),
			inventory: adoCliInventory,
			allowlist: ADO_CLI_ALLOWLIST,
		})
		assert.deepEqual(
			uninventoried,
			[],
			`Uninventoried az invocations:\n  ${uninventoried.join('\n  ')}\n\n` +
				`Add each to tests/fixtures/ado-cli-inventory.mjs, or to the allowlist if it is a preflight / error-message hint.`
		)
	})

	for (const entry of adoCliInventory) {
		const label =
			entry.kind === 'invoke'
				? `${entry.command.join(' ')} --area ${entry.area} --resource ${entry.resource}`
				: entry.command.join(' ')
		it(`\`${label} --help\` exits 0 and contains required keywords (skipped if az is absent)`, (t) => {
			const result = spawnSync(entry.command[0], [...entry.command.slice(1), '--help'], {
				timeout: 5000,
				encoding: 'utf8',
			})
			if (result.error && /** @type {NodeJS.ErrnoException} */ (result.error).code === 'ENOENT') {
				t.skip('az CLI not installed')
				return
			}
			assert.equal(result.status, 0, `Exit ${result.status} — stderr: ${result.stderr}`)
			for (const keyword of entry.helpKeywordsRequired) {
				assert.ok(
					result.stdout.includes(keyword),
					`\`${label} --help\` output is missing the required keyword: ${keyword}`
				)
			}
		})
	}
})
