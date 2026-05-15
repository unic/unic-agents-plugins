// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/** @import { DlcConfig } from './config.mjs' */

/**
 * @typedef {Object} TrackerAdapter
 * @property {(title: string, body: string, labels: string[]) => string} createIssue
 * @property {(issueId: string, labels: string[]) => string} updateLabels
 * @property {(issueId: string) => string} closeIssue
 * @property {(prId: string) => string | null} mergePr
 */

/**
 * Resolves canonical label names to tracker-specific labels using config maps.
 *
 * @param {string[]} canonicalLabels
 * @param {DlcConfig['labels']} labelMaps
 * @returns {string[]}
 */
function resolveLabels(canonicalLabels, labelMaps) {
	const allMaps = { ...labelMaps.state, ...labelMaps.type, ...labelMaps.priority }
	return canonicalLabels.map((l) => allMaps[l] ?? l)
}

/**
 * Builds a TrackerAdapter for the GitHub Issues backend.
 *
 * @param {DlcConfig} config
 * @returns {TrackerAdapter}
 */
function githubAdapter(config) {
	return {
		createIssue(title, body, labels) {
			const resolved = resolveLabels(labels, config.labels)
			const labelFlag = resolved.length > 0 ? ` --label "${resolved.join(',')}"` : ''
			return `gh issue create --title "${title}" --body "${body}"${labelFlag}`
		},
		updateLabels(issueId, labels) {
			const resolved = resolveLabels(labels, config.labels)
			return `gh issue edit ${issueId} --add-label "${resolved.join(',')}"`
		},
		closeIssue(issueId) {
			return `gh issue close ${issueId}`
		},
		mergePr(prId) {
			return `gh pr merge ${prId} --squash`
		},
	}
}

/**
 * Builds a TrackerAdapter for the Azure DevOps backend.
 *
 * @param {DlcConfig} config
 * @returns {TrackerAdapter}
 */
function adoAdapter(config) {
	return {
		createIssue(title, body, labels) {
			const resolved = resolveLabels(labels, config.labels)
			const tags = resolved.length > 0 ? ` --fields "Tags=${resolved.join(';')}"` : ''
			return `az boards work-item create --title "${title}" --type Bug --description "${body}"${tags}`
		},
		updateLabels(issueId, labels) {
			const resolved = resolveLabels(labels, config.labels)
			return `az boards work-item update --id ${issueId} --fields "Tags=${resolved.join(';')}"`
		},
		closeIssue(issueId) {
			return `az boards work-item update --id ${issueId} --state Done`
		},
		mergePr(prId) {
			return `az repos pr update --id ${prId} --status completed --merge-strategy squash`
		},
	}
}

/**
 * Builds a TrackerAdapter for the Jira backend.
 *
 * @param {DlcConfig} config
 * @returns {TrackerAdapter}
 */
function jiraAdapter(config) {
	return {
		createIssue(title, body, labels) {
			const resolved = resolveLabels(labels, config.labels)
			const labelFlag = resolved.length > 0 ? ` --label "${resolved.join(',')}"` : ''
			return `jira issue create --summary "${title}" --description "${body}"${labelFlag}`
		},
		updateLabels(issueId, labels) {
			const resolved = resolveLabels(labels, config.labels)
			return `jira issue edit ${issueId} --label "${resolved.join(',')}"`
		},
		closeIssue(issueId) {
			return `jira issue transition ${issueId} Done`
		},
		mergePr(prId) {
			return `jira issue transition ${prId} Merged`
		},
	}
}

/**
 * Builds a TrackerAdapter for the local markdown backend.
 * Returns Node.js snippet comment strings describing the file to write.
 *
 * @param {DlcConfig} config
 * @returns {TrackerAdapter}
 */
function localAdapter(config) {
	return {
		createIssue(title, body, labels) {
			const resolved = resolveLabels(labels, config.labels)
			const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
			return `// Write docs/issues/${slug}/issue.md with title: "${title}", labels: [${resolved.map((l) => `"${l}"`).join(', ')}]\n// Body: ${body}`
		},
		updateLabels(issueId, labels) {
			const resolved = resolveLabels(labels, config.labels)
			return `// Update docs/issues/${issueId}/issue.md frontmatter labels: [${resolved.map((l) => `"${l}"`).join(', ')}]`
		},
		closeIssue(issueId) {
			return `// Update docs/issues/${issueId}/issue.md state: closed`
		},
		mergePr(_prId) {
			return null
		},
	}
}

/**
 * Creates a tracker adapter for the configured issue tracker backend.
 *
 * @param {DlcConfig} config
 * @returns {TrackerAdapter}
 */
export function createTrackerAdapter(config) {
	switch (config.issueTracker) {
		case 'github':
			return githubAdapter(config)
		case 'ado':
			return adoAdapter(config)
		case 'jira':
			return jiraAdapter(config)
		case 'local':
			return localAdapter(config)
		default: {
			const exhaustive = /** @type {never} */ (config.issueTracker)
			throw new Error(`Unknown issue tracker: ${exhaustive}`)
		}
	}
}
