// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
/** @import { FormatterDescriptor } from './types.mjs' */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * Invokes a formatter binary as a child process, handling timeout, signal, and exit-code
 * reporting. Always returns — never throws. Diagnostics go to stderr only.
 *
 * @param {FormatterDescriptor} descriptor
 * @param {string} filePath - Absolute path of the file to format.
 * @param {string} cwd - Working directory for the child process.
 * @param {number} timeoutMs - Milliseconds before the process is sent SIGTERM.
 * @returns {void}
 */
export function runFormatter(descriptor, filePath, cwd, timeoutMs) {
	if (!existsSync(descriptor.bin)) {
		if (descriptor.warnIfMissing)
			process.stderr.write(`unic-format: ${descriptor.name} binary not found at ${descriptor.bin}\n`)
		return
	}
	let args
	try {
		args = descriptor.args(filePath)
	} catch (err) {
		process.stderr.write(
			`unic-format: ${descriptor.name} args error: ${err instanceof Error ? err.message : String(err)}\n`
		)
		return
	}
	const r = spawnSync('node', [descriptor.bin, ...args], {
		cwd,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: timeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.error?.code === 'ETIMEDOUT') {
		process.stderr.write(`unic-format: ${descriptor.name} timed out after ${timeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	if (r.signal) {
		process.stderr.write(`unic-format: ${descriptor.name} killed by signal ${r.signal} on ${filePath}\n`)
		return
	}
	if (r.error) {
		process.stderr.write(`unic-format: ${descriptor.name} spawn error: ${r.error.message}\n`)
		return
	}
	const tolerated = descriptor.toleratedStatuses ?? []
	if (r.status !== 0 && !tolerated.includes(r.status))
		process.stderr.write(
			`unic-format: ${descriptor.name} failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`
		)
}
