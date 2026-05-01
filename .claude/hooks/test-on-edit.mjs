#!/usr/bin/env node
// @ts-check
import { spawnSync } from 'node:child_process'
import { relative } from 'node:path'

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()

/** @type {Array<{ prefix: string; filter: string }>} */
const PACKAGES = [
	{ prefix: 'apps/claude-code/auto-format/', filter: 'auto-format' },
	{ prefix: 'packages/release-tools/', filter: '@unic/release-tools' },
]

async function main() {
	let buf = ''
	for await (const chunk of process.stdin) buf += chunk
	if (!buf.trim()) return

	let event
	try {
		event = JSON.parse(buf)
	} catch {
		return
	}

	const filePath = event?.tool_input?.file_path
	if (!filePath) return

	const rel = relative(PROJECT_DIR, filePath).replace(/\\/g, '/')
	const pkg = PACKAGES.find((p) => rel.startsWith(p.prefix))
	if (!pkg) return

	const r = spawnSync('pnpm', ['--filter', pkg.filter, 'test'], {
		cwd: PROJECT_DIR,
		stdio: 'inherit',
		timeout: 60_000,
	})

	if (r.status !== 0) process.exit(1)
}

main().catch((err) => {
	process.stderr.write(`test-on-edit: ${err instanceof Error ? err.message : String(err)}\n`)
})
