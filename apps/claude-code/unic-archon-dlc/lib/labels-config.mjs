// @ts-check

/**
 * The Canonical roles the Harness ships, one frozen literal array per tier. This is the protocol the
 * Boxes share, so it is a constant and never a computation: adding a role is a shipped behaviour
 * change and has to read as one in a diff. `test/labels-config.test.mjs` freezes the membership.
 *
 * The team names the Label string each role resolves to during `/unic-archon-dlc:setup`
 * (`classification.labels`); this Plugin seeds no mapping. See ADR-0024's 2026-08-11 amendment.
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
