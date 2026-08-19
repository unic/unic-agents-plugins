// @ts-check

/**
 * The Canonical roles the Harness ships, one frozen literal array per tier. This is the protocol the
 * Boxes share, so it is a constant and never a computation: adding a role is a shipped behaviour
 * change and has to read as one in a diff. `test/labels-config.test.mjs` freezes the membership.
 *
 * Each role's value and the axis that carries it are named in `docs/agents/triage-labels.md`, this
 * repository's half of the tracker contract; this Plugin seeds no mapping. Nothing in `lib/` reads
 * these arrays since #389 moved the vocabulary there — they survive only as the shipped role list.
 * See ADR-0024, amended 2026-08-18.
 * @type {readonly string[]}
 */
export const STATE_LABELS = [
	'needs-triage',
	'needs-info',
	'needs-specs',
	'ready-for-agent',
	'ready-for-human',
	'resolved',
	'closed',
	'rejected',
]

/** @type {readonly string[]} */
export const TYPE_LABELS = ['feature', 'bug', 'spike', 'tech-debt', 'docs']

/** @type {readonly string[]} */
export const PRIORITY_LABELS = ['p0', 'p1', 'p2', 'p3']
