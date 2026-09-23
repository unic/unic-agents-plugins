// @ts-check

/**
 * The Cadence Gate: the plugin's `Stop` hook. It counts turns and time, and
 * when enough of both have passed on a transcript that has grown, it shows the
 * developer one notice naming `/unic-learning-loop:learn`. It never sets
 * `decision`, so the session always stops normally.
 *
 * Rewritten in Node from `continual-learning/hooks/continual-learning-stop.ts`
 * in `cursor/plugins` at commit `ac93d26be3c3` (MIT, see NOTICE).
 *
 * State lives in `unic-learning-loop/` beside the session's transcript. Every
 * path comes from the payload's `transcript_path`, never from the working
 * directory or `CLAUDE_PROJECT_DIR`.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

const STATE_VERSION = 1
const STATE_DIR_NAME = 'unic-learning-loop'
const STATE_FILE_NAME = 'cadence-state.json'
const NOTICE = 'Learnings are due. Run /unic-learning-loop:learn.'

const DEFAULT_MIN_TURNS = 10
const DEFAULT_MIN_MINUTES = 120
const DEFAULT_TRIAL_MIN_TURNS = 3
const DEFAULT_TRIAL_MIN_MINUTES = 15
const DEFAULT_TRIAL_DURATION_MINUTES = 24 * 60
const MS_PER_MINUTE = 60_000

/**
 * @typedef {object} StopPayload
 * @property {unknown} [transcript_path]
 * @property {unknown} [stop_hook_active]
 */

/**
 * @typedef {object} CadenceState
 * @property {typeof STATE_VERSION} version
 * @property {number} lastNoticeAtMs 0 before the first notice
 * @property {number} turnsSinceNotice
 * @property {number | null} transcriptMtimeMsAtNotice
 * @property {number | null} trialStartedAtMs
 */

/**
 * @param {string} text
 * @returns {Record<string, unknown>}
 */
function decide(text) {
	const payload = parsePayload(text)
	const transcriptPath = payload.transcript_path
	// A relative path would resolve against the working directory, which the
	// hook must never use to place state.
	if (typeof transcriptPath !== 'string' || !isAbsolute(transcriptPath)) return {}

	// A transcript that cannot be read cannot advance, so the gate stays shut.
	// Writing nothing here keeps a bad path from creating directories.
	const transcriptMtimeMs = getMtimeMs(transcriptPath)
	if (transcriptMtimeMs === null) return {}

	const statePath = join(dirname(transcriptPath), STATE_DIR_NAME, STATE_FILE_NAME)
	const state = loadState(statePath)
	const now = Date.now()
	const isCountedTurn = payload.stop_hook_active !== true
	const turnsSinceNotice = state.turnsSinceNotice + (isCountedTurn ? 1 : 0)

	const isTrialEnabled = readBoolean('UNIC_LEARNING_LOOP_TRIAL_MODE')
	if (isTrialEnabled && isCountedTurn && state.trialStartedAtMs === null) {
		state.trialStartedAtMs = now
	}
	const trialDurationMinutes = readPositiveNumber(
		'UNIC_LEARNING_LOOP_TRIAL_DURATION_MINUTES',
		DEFAULT_TRIAL_DURATION_MINUTES
	)
	const isInTrialWindow =
		isTrialEnabled &&
		state.trialStartedAtMs !== null &&
		now - state.trialStartedAtMs < trialDurationMinutes * MS_PER_MINUTE

	const minTurns = isInTrialWindow
		? readPositiveNumber('UNIC_LEARNING_LOOP_TRIAL_MIN_TURNS', DEFAULT_TRIAL_MIN_TURNS)
		: readPositiveNumber('UNIC_LEARNING_LOOP_MIN_TURNS', DEFAULT_MIN_TURNS)
	const minMinutes = isInTrialWindow
		? readPositiveNumber('UNIC_LEARNING_LOOP_TRIAL_MIN_MINUTES', DEFAULT_TRIAL_MIN_MINUTES)
		: readPositiveNumber('UNIC_LEARNING_LOOP_MIN_MINUTES', DEFAULT_MIN_MINUTES)

	const minutesSinceNotice =
		state.lastNoticeAtMs > 0 ? Math.floor((now - state.lastNoticeAtMs) / MS_PER_MINUTE) : Number.POSITIVE_INFINITY
	const hasTranscriptAdvanced =
		state.transcriptMtimeMsAtNotice === null || transcriptMtimeMs > state.transcriptMtimeMsAtNotice

	const isGateOpen =
		isCountedTurn && turnsSinceNotice >= minTurns && minutesSinceNotice >= minMinutes && hasTranscriptAdvanced

	if (isGateOpen) {
		state.lastNoticeAtMs = now
		state.turnsSinceNotice = 0
		state.transcriptMtimeMsAtNotice = transcriptMtimeMs
		saveState(statePath, state)
		return { systemMessage: NOTICE }
	}

	state.turnsSinceNotice = turnsSinceNotice
	saveState(statePath, state)
	return {}
}

/**
 * @param {string} text
 * @returns {StopPayload}
 */
function parsePayload(text) {
	const parsed = JSON.parse(text)
	if (parsed === null || typeof parsed !== 'object') return {}
	return /** @type {StopPayload} */ (parsed)
}

/**
 * @param {string} path
 * @returns {number | null}
 */
function getMtimeMs(path) {
	try {
		return statSync(path).mtimeMs
	} catch {
		return null
	}
}

/**
 * A missing, unreadable or other-version state file yields a fresh state.
 *
 * @param {string} statePath
 * @returns {CadenceState}
 */
function loadState(statePath) {
	/** @type {CadenceState} */
	const fresh = {
		version: STATE_VERSION,
		lastNoticeAtMs: 0,
		turnsSinceNotice: 0,
		transcriptMtimeMsAtNotice: null,
		trialStartedAtMs: null,
	}
	let parsed
	try {
		parsed = JSON.parse(readFileSync(statePath, 'utf8'))
	} catch {
		return fresh
	}
	if (parsed === null || typeof parsed !== 'object' || parsed.version !== STATE_VERSION) return fresh
	return {
		version: STATE_VERSION,
		lastNoticeAtMs: toFiniteNumber(parsed.lastNoticeAtMs) ?? 0,
		turnsSinceNotice: Math.max(0, toFiniteNumber(parsed.turnsSinceNotice) ?? 0),
		transcriptMtimeMsAtNotice: toFiniteNumber(parsed.transcriptMtimeMsAtNotice),
		trialStartedAtMs: toFiniteNumber(parsed.trialStartedAtMs),
	}
}

/**
 * @param {string} statePath
 * @param {CadenceState} state
 * @returns {void}
 */
function saveState(statePath, state) {
	mkdirSync(dirname(statePath), { recursive: true })
	writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * A missing, non-numeric or non-positive value falls back to the default.
 *
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readPositiveNumber(name, fallback) {
	const value = Number(process.env[name])
	return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function readBoolean(name) {
	const value = process.env[name]?.trim().toLowerCase()
	return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

/**
 * @returns {Promise<void>}
 */
async function main() {
	let output = {}
	try {
		let text = ''
		process.stdin.setEncoding('utf8')
		for await (const chunk of process.stdin) text += chunk
		output = decide(text)
	} catch (error) {
		process.stderr.write(`unic-learning-loop: cadence gate failed: ${error instanceof Error ? error.message : error}\n`)
	}
	process.stdout.write(`${JSON.stringify(output)}\n`)
	process.exitCode = 0
}

await main()
