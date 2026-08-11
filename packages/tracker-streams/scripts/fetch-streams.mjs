#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Render the tracker's streams as one self-contained HTML page on stdout, and a line of
 * counts on stderr.
 *
 * Everything on the page comes from native tracker relations — the `stream` label, the
 * sub-issue parent pointer, and the `dependencies/blocked_by` endpoint. No issue text is
 * ever read: prose dependency sections were removed from every stream member and the ones
 * that remain on closed issues are known to be wrong.
 *
 * Usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/fetch-streams.mjs > index.html
 */

import { fileURLToPath } from 'node:url'
import { CliError } from './lib/errors.mjs'
import { listBlockersFor, listMembersByStream, listOpenIssues, listStreamTickets } from './lib/github-client.mjs'
import { buildLaneIndex, groupIntoLanes, isCrossStreamEdge } from './lib/graph.mjs'
import { derivePriority } from './lib/priority.mjs'
import { classifyReadiness } from './lib/readiness.mjs'
import { renderPage } from './lib/render.mjs'
import { shortenTitle } from './lib/title.mjs'

const STREAM_LABEL = 'stream'
const WAYFINDER_PREFIX = 'wayfinder:'
// "Takeable now" counts ready-for-agent only. Issue #327 names no formula for this;
// ready-for-human tickets are excluded because they need a person, not just an unblocked queue slot.
const TAKEABLE_STATE = 'ready-for-agent'

/**
 * @typedef {import('./lib/github-client.mjs').IssueSummary} IssueSummary
 * @typedef {import('./lib/render.mjs').Card} Card
 */

/**
 * @returns {{ owner: string, repo: string, slug: string }}
 */
function resolveRepository() {
	const slug = process.env.GITHUB_REPOSITORY
	if (!slug) {
		throw new CliError('GITHUB_REPOSITORY is not set — expected "owner/repo" (GitHub Actions sets this for you)')
	}
	const [owner, repo] = slug.split('/')
	if (!owner || !repo) throw new CliError(`GITHUB_REPOSITORY is malformed: "${slug}" — expected "owner/repo"`)
	return { owner, repo, slug }
}

/**
 * An issue belongs on the "outside every stream" list when it is open, is not itself a
 * stream ticket, sits in no lane, and is not a wayfinder artefact.
 *
 * @param {IssueSummary} issue
 * @param {ReadonlyMap<number, number>} laneIndex
 * @returns {boolean}
 */
export function isOutsideEveryStream(issue, laneIndex) {
	if (issue.labels.includes(STREAM_LABEL)) return false
	if (laneIndex.has(issue.number)) return false
	return !issue.labels.some((label) => label.startsWith(WAYFINDER_PREFIX))
}

/**
 * @param {IssueSummary} issue
 * @param {readonly IssueSummary[]} blockers
 * @param {ReadonlyMap<number, number>} laneIndex
 * @returns {Card}
 */
export function toCard(issue, blockers, laneIndex) {
	const lane = laneIndex.get(issue.number)
	return {
		number: issue.number,
		title: shortenTitle(issue.title),
		priority: derivePriority(issue.labels),
		readiness: classifyReadiness(issue.labels),
		issueState: issue.state,
		blockers: blockers.map((blocker) => ({
			number: blocker.number,
			state: blocker.state,
			crossesStream: isCrossStreamEdge(lane, laneIndex.get(blocker.number)),
		})),
	}
}

async function main() {
	const { owner, repo, slug } = resolveRepository()

	const streamTickets = await listStreamTickets(owner, repo)
	const membersByStream = await listMembersByStream(
		owner,
		repo,
		streamTickets.map((ticket) => ticket.number)
	)
	const laneIndex = buildLaneIndex(membersByStream)

	const openIssues = await listOpenIssues(owner, repo)
	const outsideIssues = openIssues.filter((issue) => isOutsideEveryStream(issue, laneIndex))

	const streamMembers = [...membersByStream.values()].flat()
	/** @type {IssueSummary[]} */
	const carded = [...streamMembers, ...outsideIssues]
	const blockersByIssue = await listBlockersFor(
		owner,
		repo,
		carded.map((issue) => issue.number)
	)

	/** @type {Map<number, Card>} */
	const cards = new Map(
		carded.map((issue) => [issue.number, toCard(issue, blockersByIssue.get(issue.number) ?? [], laneIndex)])
	)

	/** @type {Map<number, Card[]>} */
	const cardsByStream = new Map(
		[...membersByStream].map(([streamNumber, members]) => [
			streamNumber,
			members.flatMap((member) => {
				const card = cards.get(member.number)
				return card ? [card] : []
			}),
		])
	)
	const lanes = groupIntoLanes(streamTickets, cardsByStream)
	const outside = outsideIssues.flatMap((issue) => {
		const card = cards.get(issue.number)
		return card ? [card] : []
	})

	const everyCard = [...cards.values()]
	const everyBlocker = everyCard.flatMap((card) => card.blockers)
	const counts = {
		streams: streamTickets.length,
		members: streamMembers.length,
		edges: everyBlocker.length,
		crossingEdges: everyBlocker.filter((blocker) => blocker.crossesStream).length,
		outside: outside.length,
		takeable: everyCard.filter(
			(card) =>
				card.issueState === 'open' &&
				card.readiness.state === TAKEABLE_STATE &&
				card.blockers.every((blocker) => blocker.state !== 'open')
		).length,
	}

	const generatedAt = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`
	process.stdout.write(renderPage({ repo: slug, lanes, outside, counts, generatedAt }))
	process.stderr.write(
		`streams=${counts.streams} members=${counts.members} edges=${counts.edges} ` +
			`crossingEdges=${counts.crossingEdges} outside=${counts.outside} takeable=${counts.takeable}\n`
	)
}

// Guarded so tests can import isOutsideEveryStream/toCard without running the CLI.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		await main()
	} catch (err) {
		if (err instanceof CliError) {
			console.error(err.message)
			process.exit(err.exitCode)
		}
		throw err
	}
}
