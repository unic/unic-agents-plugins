// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * @typedef {{ number: number, title: string, state: string, labels: string[] }} StreamTicket
 */

/**
 * Does a dependency edge cross a stream boundary?
 *
 * Both endpoints must sit in a stream, and in different ones. An edge with an endpoint
 * outside every stream crosses nothing — there is no second boundary to cross.
 *
 * @param {number | null | undefined} laneA - owning stream number of one endpoint
 * @param {number | null | undefined} laneB - owning stream number of the other endpoint
 * @returns {boolean}
 */
export function isCrossStreamEdge(laneA, laneB) {
	if (laneA === null || laneA === undefined) return false
	if (laneB === null || laneB === undefined) return false
	return laneA !== laneB
}

/**
 * Invert a stream → members map into an issue → owning stream lookup.
 *
 * GitHub allows one parent per sub-issue, so an issue appears in at most one lane. If the
 * tracker ever disagrees, the first stream encountered wins and the result stays stable.
 *
 * @param {ReadonlyMap<number, readonly { number: number }[]>} membersByStreamNumber
 * @returns {Map<number, number>} issue number → owning stream number
 */
export function buildLaneIndex(membersByStreamNumber) {
	/** @type {Map<number, number>} */
	const index = new Map()
	for (const [streamNumber, members] of membersByStreamNumber) {
		for (const member of members) {
			if (!index.has(member.number)) index.set(member.number, streamNumber)
		}
	}
	return index
}

/**
 * Group members into lanes, one lane per stream ticket, largest lane first.
 *
 * A stream ticket with no members still gets a lane: an empty workstream is a fact about
 * the tracker, not something to hide.
 *
 * @template T
 * @param {readonly StreamTicket[]} streamTickets
 * @param {ReadonlyMap<number, T[]>} membersByStreamNumber
 * @returns {{ streamNumber: number, streamTitle: string, streamState: string, members: T[] }[]}
 */
export function groupIntoLanes(streamTickets, membersByStreamNumber) {
	return streamTickets
		.map((ticket) => ({
			streamNumber: ticket.number,
			streamTitle: ticket.title,
			streamState: ticket.state,
			members: membersByStreamNumber.get(ticket.number) ?? [],
		}))
		.sort((a, b) => b.members.length - a.members.length)
}
