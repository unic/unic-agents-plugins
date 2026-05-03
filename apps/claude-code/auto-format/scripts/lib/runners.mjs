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
	const r = spawnSync('node', [descriptor.bin, ...descriptor.args(filePath)], {
		cwd,
		stdio: ['ignore', 'ignore', 'pipe'],
		timeout: timeoutMs,
		killSignal: 'SIGTERM',
	})
	if (r.signal === 'SIGTERM' || r.status === null) {
		process.stderr.write(`unic-format: ${descriptor.name} timed out after ${timeoutMs / 1000}s on ${filePath}\n`)
		return
	}
	const tolerated = descriptor.toleratedStatuses ?? []
	if (r.status !== 0 && !tolerated.includes(r.status))
		process.stderr.write(
			`unic-format: ${descriptor.name} failed (exit ${r.status}): ${r.stderr?.toString().trim() || 'unknown error'}\n`
		)
}
