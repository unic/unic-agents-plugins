// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * exec.mjs — shared synchronous subprocess executor and result shape.
 *
 * `ExecResult` and `Exec` are the unit-test seam used by every module that
 * shells out to git, az, or any other CLI. The single declaration here prevents
 * drift between doctor.mjs and base-branch-resolver.mjs.
 */

import { spawnSync } from 'node:child_process'

/**
 * @typedef {Object} ExecResult
 * @property {boolean} ok
 * @property {string} stdout
 * @property {string} stderr
 */

/**
 * @typedef {(cmd: string, args: string[]) => ExecResult} Exec
 */

/** @type {Exec} */
export function realExec(cmd, args) {
	const r = spawnSync(cmd, args, { encoding: 'utf8' })
	return {
		ok: r.status === 0 && r.error == null,
		stdout: r.stdout ?? '',
		stderr: r.stderr ?? '',
	}
}
