#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process'

const log = spawnSync('git', ['log', '--reverse', '--format=%H'], { encoding: 'utf8' })
if (log.status !== 0) {
	process.stderr.write('backfill-tags: git log failed\n')
	process.exit(1)
}

const commits = log.stdout.trim().split('\n').filter(Boolean)
let lastVersion = null

for (const hash of commits) {
	const show = spawnSync('git', ['show', `${hash}:.claude-plugin/plugin.json`], { encoding: 'utf8' })
	if (show.status !== 0) continue

	let version
	try {
		version = JSON.parse(show.stdout).version
	} catch {
		continue
	}

	if (!version || version === lastVersion) {
		lastVersion = version
		continue
	}

	lastVersion = version
	const tagName = `v${version}`

	const existing = spawnSync('git', ['tag', '-l', tagName], { encoding: 'utf8' })
	if (existing.stdout.trim()) {
		process.stdout.write(`  skip  ${tagName} (already exists)\n`)
		continue
	}

	const result = spawnSync('git', ['tag', tagName, hash], { stdio: 'inherit' })
	if (result.status === 0) {
		process.stdout.write(`tagged  ${tagName} → ${hash.slice(0, 7)}\n`)
	} else {
		process.stderr.write(`  FAIL  ${tagName} → ${hash.slice(0, 7)}\n`)
		process.exit(1)
	}
}

process.stdout.write('Done. Run: git push --tags\n')
