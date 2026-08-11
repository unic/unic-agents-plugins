// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import { CliError } from './errors.mjs'

const API_ROOT = 'https://api.github.com'
const API_VERSION = '2022-11-28'
const PER_PAGE = 100
const CONCURRENCY = 8

/** The relation endpoints this generator depends on, named for the fail-loud message. */
const SUB_ISSUES = 'sub_issues'
const DEPENDENCIES = 'dependencies/blocked_by'

/**
 * @typedef {{ number: number, title: string, state: string, labels: string[] }} IssueSummary
 */

/**
 * Every field this client is allowed to carry out of an API response. The generator reads
 * native relations only, so nothing beyond these four leaves this module — see the
 * `no-issue-body` guard test.
 *
 * @param {Record<string, unknown>} issue
 * @returns {IssueSummary}
 */
function toSummary(issue) {
	const rawLabels = Array.isArray(issue.labels) ? issue.labels : []
	const labels = rawLabels
		.map((label) => (typeof label === 'string' ? label : /** @type {{ name?: unknown }} */ (label)?.name))
		.filter((name) => typeof name === 'string')
	return {
		number: Number(issue.number),
		title: typeof issue.title === 'string' ? issue.title : '',
		state: typeof issue.state === 'string' ? issue.state : '',
		labels,
	}
}

/** @returns {Record<string, string>} */
function headers() {
	const token = process.env.GITHUB_TOKEN
	if (!token) {
		throw new CliError('GITHUB_TOKEN is not set — the generator reads the tracker over the authenticated REST API')
	}
	return {
		accept: 'application/vnd.github+json',
		authorization: `Bearer ${token}`,
		'user-agent': 'unic-tracker-streams',
		'x-github-api-version': API_VERSION,
	}
}

/**
 * Turn a failed response into the right error.
 *
 * A 403 or 404 on one of the two relation endpoints means the token cannot read the
 * relation. That is the one failure the issue says to stop on rather than work around, so
 * it gets its own message.
 *
 * @param {number} status
 * @param {string} path
 * @param {string | undefined} relation
 * @returns {CliError}
 */
function requestFailure(status, path, relation) {
	if (relation && (status === 403 || status === 404)) {
		return new CliError(
			`GITHUB_TOKEN cannot read ${relation} (HTTP ${status} on ${path}).\n` +
				'Stop and report this on issue #327. Do not substitute a personal access token or a GitHub App — ' +
				'widening the credential is the maintainer’s decision.'
		)
	}
	return new CliError(`GitHub API request failed: HTTP ${status} on ${path}`)
}

/**
 * Read every page of a list endpoint.
 *
 * Pagination walks `page=N` until a short page arrives rather than parsing the `Link`
 * header — one fewer thing to get wrong, at the cost of one extra request on an exact
 * multiple of the page size.
 *
 * @param {string} path - API path, may already carry a query string
 * @param {string} [relation] - relation name, when this path is one of the two relation endpoints
 * @returns {Promise<Record<string, unknown>[]>}
 */
async function paginate(path, relation) {
	/** @type {Record<string, unknown>[]} */
	const collected = []
	let page = 1
	while (true) {
		const separator = path.includes('?') ? '&' : '?'
		const url = `${API_ROOT}${path}${separator}per_page=${PER_PAGE}&page=${page}`
		const response = await fetch(url, { headers: headers() })
		if (!response.ok) throw requestFailure(response.status, path, relation)
		const payload = /** @type {Record<string, unknown>[]} */ (await response.json())
		if (!Array.isArray(payload)) throw new CliError(`GitHub API returned a non-list payload for ${path}`)
		collected.push(...payload)
		if (payload.length < PER_PAGE) return collected
		page += 1
	}
}

/**
 * Run an async task per item, at most `CONCURRENCY` in flight.
 *
 * @template T, R
 * @param {readonly T[]} items
 * @param {(item: T) => Promise<R>} task
 * @returns {Promise<R[]>}
 */
async function mapBounded(items, task) {
	/** @type {R[]} */
	const results = new Array(items.length)
	let next = 0
	const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
		while (next < items.length) {
			const index = next
			next += 1
			results[index] = await task(items[index])
		}
	})
	await Promise.all(workers)
	return results
}

/**
 * Every issue labelled `stream`, open or closed — one lane each.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<IssueSummary[]>}
 */
export async function listStreamTickets(owner, repo) {
	const issues = await paginate(`/repos/${owner}/${repo}/issues?labels=stream&state=all`)
	return issues.filter((issue) => !isPullRequest(issue)).map(toSummary)
}

/**
 * Every open issue in the repository. Pull requests share the issue number space and come
 * back from this endpoint, so they are dropped here.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<IssueSummary[]>}
 */
export async function listOpenIssues(owner, repo) {
	const issues = await paginate(`/repos/${owner}/${repo}/issues?state=open`)
	return issues.filter((issue) => !isPullRequest(issue)).map(toSummary)
}

/**
 * Lane membership: the sub-issues of each stream ticket.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {readonly number[]} streamNumbers
 * @returns {Promise<Map<number, IssueSummary[]>>}
 */
export async function listMembersByStream(owner, repo, streamNumbers) {
	const lists = await mapBounded(streamNumbers, async (streamNumber) => {
		const members = await paginate(`/repos/${owner}/${repo}/issues/${streamNumber}/sub_issues`, SUB_ISSUES)
		return members.filter((issue) => !isPullRequest(issue)).map(toSummary)
	})
	return new Map(streamNumbers.map((streamNumber, index) => [streamNumber, lists[index]]))
}

/**
 * Ordering: the issues each given issue depends on, whether they are open or closed.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {readonly number[]} issueNumbers
 * @returns {Promise<Map<number, IssueSummary[]>>}
 */
export async function listBlockersFor(owner, repo, issueNumbers) {
	const lists = await mapBounded(issueNumbers, async (issueNumber) => {
		const blockers = await paginate(`/repos/${owner}/${repo}/issues/${issueNumber}/${DEPENDENCIES}`, DEPENDENCIES)
		return blockers.map(toSummary)
	})
	return new Map(issueNumbers.map((issueNumber, index) => [issueNumber, lists[index]]))
}

/**
 * @param {Record<string, unknown>} issue
 * @returns {boolean}
 */
function isPullRequest(issue) {
	return 'pull_request' in issue
}
