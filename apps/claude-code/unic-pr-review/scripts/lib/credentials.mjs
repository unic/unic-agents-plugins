#!/usr/bin/env node
// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * @typedef {{ url: string, username: string, token: string, jiraUrl?: string }} ConfluenceCredentials
 * @typedef {{ orgUrl: string, pat: string }} AzureCredentials
 * @typedef {{ confluence: ConfluenceCredentials | null, azure: AzureCredentials | null, jira: { url: string } | null }} AllCredentials
 */

/**
 * Loads Confluence credentials. Env vars take priority over the file.
 * Returns null if neither source provides all required fields.
 *
 * @returns {ConfluenceCredentials | null}
 */
export function loadConfluenceCredentials() {
	const { CONFLUENCE_URL, CONFLUENCE_USER, CONFLUENCE_TOKEN, JIRA_URL } = process.env
	if (CONFLUENCE_URL && CONFLUENCE_USER && CONFLUENCE_TOKEN) {
		return {
			url: CONFLUENCE_URL,
			username: CONFLUENCE_USER,
			token: CONFLUENCE_TOKEN,
			...(JIRA_URL ? { jiraUrl: JIRA_URL } : {}),
		}
	}
	const credFile = join(homedir(), '.unic-confluence.json')
	if (existsSync(credFile)) {
		try {
			const raw = /** @type {ConfluenceCredentials} */ (JSON.parse(readFileSync(credFile, 'utf8')))
			if (raw.url && raw.username && raw.token) {
				if (JIRA_URL) raw.jiraUrl = JIRA_URL
				return raw
			}
		} catch {
			// unparseable file — fall through
		}
	}
	return null
}

/**
 * Loads Azure DevOps credentials. Env vars take priority over the file.
 * Returns null if neither source provides all required fields.
 *
 * @returns {AzureCredentials | null}
 */
export function loadAzureCredentials() {
	const { AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PAT } = process.env
	if (AZURE_DEVOPS_ORG_URL && AZURE_DEVOPS_PAT) {
		return { orgUrl: AZURE_DEVOPS_ORG_URL, pat: AZURE_DEVOPS_PAT }
	}
	const credFile = join(homedir(), '.unic-azure.json')
	if (existsSync(credFile)) {
		try {
			const raw = /** @type {AzureCredentials} */ (JSON.parse(readFileSync(credFile, 'utf8')))
			if (raw.orgUrl && raw.pat) return raw
		} catch {
			// unparseable file — fall through
		}
	}
	return null
}

/**
 * Loads all credentials and derives Jira config from the Confluence credentials.
 *
 * @returns {AllCredentials}
 */
export function loadAllCredentials() {
	const confluence = loadConfluenceCredentials()
	const azure = loadAzureCredentials()
	const jiraUrl = confluence?.jiraUrl ?? null
	return {
		confluence,
		azure,
		jira: jiraUrl ? { url: jiraUrl } : null,
	}
}
