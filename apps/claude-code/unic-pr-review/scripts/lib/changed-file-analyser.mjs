// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * changed-file-analyser.mjs — determine which Review Aspect agents to spawn
 * based on the changed-files list (ADR-0008: conditional sub-agent spawning).
 *
 * In this slice the analysis is minimal: code-reviewer always runs for any
 * non-empty diff. Conditional spawning of the remaining five aspect agents
 * lands in a later slice once all agent prompts are implemented.
 */

/**
 * Analyse the list of changed file paths and return the ordered set of
 * Review Aspect agent names to spawn.
 *
 * code-reviewer is always first and always present for a non-empty diff.
 * An empty changed-files list returns an empty array — the orchestrator
 * should warn the user and skip spawning.
 *
 * @param {string[]} changedFiles - relative paths of files changed in the diff
 * @returns {string[]} ordered agent names
 */
export function analyseChangedFiles(changedFiles) {
	if (changedFiles.length === 0) return []
	return ['code-reviewer']
}
