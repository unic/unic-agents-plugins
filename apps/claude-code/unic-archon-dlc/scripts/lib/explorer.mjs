// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from './config.mjs'

/** @import { DlcConfig } from './config.mjs' */

/**
 * @typedef {Object} ProjectSnapshot
 * @property {string | null} gitRemote
 * @property {boolean} hasClaudeMd
 * @property {boolean} hasContextMd
 * @property {boolean} hasContextMapMd
 * @property {DlcConfig | null} existingConfig
 * @property {boolean} archonInstalled
 * @property {boolean} isMultiContext
 */

/**
 * Detects the git remote URL for 'origin'.
 *
 * @param {string} cwd
 * @returns {string | null}
 */
function detectGitRemote(cwd) {
	const result = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8' })
	if (result.status !== 0 || result.error) return null
	const remote = result.stdout.trim()
	return remote.length > 0 ? remote : null
}

/**
 * Checks whether 'archon' is available on PATH.
 *
 * @returns {boolean}
 */
function detectArchon() {
	const result = spawnSync('archon', ['--version'], { encoding: 'utf8' })
	return result.status === 0 && !result.error
}

/**
 * Reads the existing DlcConfig from `.archon/unic-dlc.config.json` if it exists and is valid.
 *
 * @param {string} projectRoot
 * @returns {DlcConfig | null}
 */
function readExistingConfig(projectRoot) {
	const configPath = join(projectRoot, '.archon', 'unic-dlc.config.json')
	if (!existsSync(configPath)) return null
	const result = loadConfig(configPath)
	return result.ok ? result.config : null
}

/**
 * Explores the target project and returns a snapshot of its current state.
 *
 * @param {string} projectRoot - Absolute path to the project root directory.
 * @returns {ProjectSnapshot}
 */
export function exploreProject(projectRoot) {
	return {
		gitRemote: detectGitRemote(projectRoot),
		hasClaudeMd: existsSync(join(projectRoot, 'CLAUDE.md')),
		hasContextMd: existsSync(join(projectRoot, 'CONTEXT.md')),
		hasContextMapMd: existsSync(join(projectRoot, 'CONTEXT-MAP.md')),
		existingConfig: readExistingConfig(projectRoot),
		archonInstalled: detectArchon(),
		isMultiContext: existsSync(join(projectRoot, 'CONTEXT-MAP.md')),
	}
}

