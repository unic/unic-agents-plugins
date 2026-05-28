// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * credentials.mjs — load Atlassian (Confluence + optional Jira) and Azure DevOps
 * credentials from environment variables or the credential files under the
 * user's home directory. Env vars take precedence over file contents; if
 * neither source is configured the function returns null and the caller
 * surfaces the error in context.
 */

import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'

/**
 * @typedef {Object} AtlassianCreds
 * @property {string} url
 * @property {string} username
 * @property {string} token
 * @property {string|undefined} jiraUrl
 */

/**
 * @typedef {Object} AzureCreds
 * @property {string} orgUrl
 * @property {string} pat
 */

/**
 * @typedef {Object} Env
 * @property {string|undefined} [CONFLUENCE_URL]
 * @property {string|undefined} [CONFLUENCE_USER]
 * @property {string|undefined} [CONFLUENCE_TOKEN]
 * @property {string|undefined} [JIRA_URL]
 * @property {string|undefined} [AZURE_DEVOPS_ORG_URL]
 * @property {string|undefined} [AZURE_DEVOPS_PAT]
 */

/**
 * Load Atlassian credentials (Confluence + optional Jira). Env vars override
 * the credential file. Returns null when neither source is configured.
 *
 * @param {string} [homedir] - override for os.homedir(); used in tests
 * @param {Env} [env] - override for process.env; used in tests
 * @returns {AtlassianCreds|null}
 */
export function loadAtlassianCreds(homedir, env) {
	const e = env ?? /** @type {Env} */ (process.env)
	if (e.CONFLUENCE_URL && e.CONFLUENCE_USER && e.CONFLUENCE_TOKEN) {
		return {
			url: e.CONFLUENCE_URL,
			username: e.CONFLUENCE_USER,
			token: e.CONFLUENCE_TOKEN,
			jiraUrl: e.JIRA_URL || undefined,
		}
	}
	const home = homedir ?? os.homedir()
	const path = join(home, '.unic-confluence.json')
	if (!existsSync(path)) return null
	const raw = readFileSync(path, 'utf8')
	const parsed = JSON.parse(raw)
	if (!parsed.url || !parsed.username || !parsed.token) return null
	return {
		url: String(parsed.url),
		username: String(parsed.username),
		token: String(parsed.token),
		jiraUrl: parsed.jiraUrl ? String(parsed.jiraUrl) : undefined,
	}
}

/**
 * Load Azure DevOps credentials. Env vars override the credential file.
 * Returns null when neither source is configured.
 *
 * @param {string} [homedir] - override for os.homedir(); used in tests
 * @param {Env} [env] - override for process.env; used in tests
 * @returns {AzureCreds|null}
 */
export function loadAzureCreds(homedir, env) {
	const e = env ?? /** @type {Env} */ (process.env)
	if (e.AZURE_DEVOPS_ORG_URL && e.AZURE_DEVOPS_PAT) {
		return { orgUrl: e.AZURE_DEVOPS_ORG_URL, pat: e.AZURE_DEVOPS_PAT }
	}
	const home = homedir ?? os.homedir()
	const path = join(home, '.unic-azure.json')
	if (!existsSync(path)) return null
	const raw = readFileSync(path, 'utf8')
	const parsed = JSON.parse(raw)
	if (!parsed.orgUrl || !parsed.pat) return null
	return { orgUrl: String(parsed.orgUrl), pat: String(parsed.pat) }
}
