// @ts-check

import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/cadence-gate.mjs', import.meta.url))
const NOTICE = 'Learnings are due. Run /unic-learning-loop:learn.'
const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** @type {string} */
let dir
/** @type {string} */
let transcriptPath

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'unic-learning-loop-test-'))
	transcriptPath = join(dir, 'session.jsonl')
	writeFileSync(transcriptPath, '{}\n')
})

afterEach(() => {
	rmSync(dir, { recursive: true, force: true })
})

/**
 * Runs the hook as Claude Code does, with the payload on stdin. The working
 * directory is the temporary directory, so a hook that wrote state relative
 * to it would show up in the no-state-directory test. Inherited
 * `UNIC_LEARNING_LOOP_*` variables are removed so a developer's own settings
 * cannot change the outcome.
 *
 * @param {string} stdin
 * @param {Record<string, string>} [env]
 * @returns {{ exitCode: number | null, stdout: string }}
 */
function run(stdin, env = {}) {
	const inherited = Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !name.startsWith('UNIC_LEARNING_LOOP_'))
	)
	const result = spawnSync(process.execPath, [SCRIPT], {
		cwd: dir,
		input: stdin,
		env: { ...inherited, ...env },
		encoding: 'utf8',
	})
	return { exitCode: result.status, stdout: result.stdout }
}

/**
 * @param {{ stop_hook_active?: boolean }} [overrides]
 * @param {Record<string, string>} [env]
 * @param {string} [path]
 * @returns {Record<string, unknown>}
 */
function stop(overrides = {}, env = {}, path = transcriptPath) {
	const payload = { session_id: 'session', transcript_path: path, stop_hook_active: false, ...overrides }
	const { exitCode, stdout } = run(JSON.stringify(payload), env)
	if (exitCode !== 0) throw new Error(`hook exited ${exitCode}`)
	return JSON.parse(stdout)
}

/** @returns {string} */
function statePath() {
	return join(dir, 'unic-learning-loop', 'cadence-state.json')
}

/**
 * @param {Record<string, unknown>} fields
 * @returns {void}
 */
function seedState(fields) {
	mkdirSync(join(dir, 'unic-learning-loop'), { recursive: true })
	const state = {
		version: 1,
		lastNoticeAtMs: 0,
		turnsSinceNotice: 0,
		transcriptMtimeMsAtNotice: null,
		trialStartedAtMs: null,
		...fields,
	}
	writeFileSync(statePath(), JSON.stringify(state))
}

/** @returns {Record<string, unknown>} */
function readState() {
	return JSON.parse(readFileSync(statePath(), 'utf8'))
}

/**
 * Seeds a state that is one counted turn short of the default gate: nine
 * turns, a notice three hours ago, and a transcript older than it is now.
 *
 * @param {Record<string, unknown>} [fields]
 * @returns {void}
 */
function seedOneTurnShort(fields = {}) {
	const now = Date.now()
	seedState({
		lastNoticeAtMs: now - 3 * HOUR,
		turnsSinceNotice: 9,
		transcriptMtimeMsAtNotice: now - 3 * HOUR,
		...fields,
	})
}

test('empty stdin exits 0', () => {
	assert.equal(run('').exitCode, 0)
})

test('malformed JSON exits 0', () => {
	assert.equal(run('{not json').exitCode, 0)
})

test('an empty payload exits 0', () => {
	assert.equal(run('{}').exitCode, 0)
})

test('malformed JSON prints an empty object', () => {
	assert.deepEqual(JSON.parse(run('{not json').stdout), {})
})

test('a payload with no transcript_path creates no state directory', () => {
	run(JSON.stringify({ session_id: 'session', stop_hook_active: false }))
	assert.equal(existsSync(join(dir, 'unic-learning-loop')), false)
})

test('a counted turn below the turn threshold prints no systemMessage', () => {
	seedState({ turnsSinceNotice: 3 })
	assert.deepEqual(stop(), {})
})

test('a counted turn below the turn threshold increments the count', () => {
	seedState({ turnsSinceNotice: 3 })
	stop()
	assert.equal(readState().turnsSinceNotice, 4)
})

test('the first counted turn in a fresh state is counted', () => {
	stop()
	assert.equal(readState().turnsSinceNotice, 1)
})

test('turns and minutes at threshold with an advanced transcript print the notice', () => {
	seedOneTurnShort()
	assert.equal(stop().systemMessage, NOTICE)
})

test('after the gate opens the turn count is zero', () => {
	seedOneTurnShort()
	stop()
	assert.equal(readState().turnsSinceNotice, 0)
})

test('after the gate opens the transcript mtime is recorded', () => {
	seedOneTurnShort()
	stop()
	assert.equal(readState().transcriptMtimeMsAtNotice, statSync(transcriptPath).mtimeMs)
})

test('a transcript mtime that has not advanced keeps the gate shut', () => {
	const past = new Date(Date.now() - 4 * HOUR)
	utimesSync(transcriptPath, past, past)
	seedOneTurnShort({ transcriptMtimeMsAtNotice: statSync(transcriptPath).mtimeMs })
	assert.deepEqual(stop(), {})
})

test('minutes below the threshold keep the gate shut', () => {
	seedOneTurnShort({ lastNoticeAtMs: Date.now() - 60 * MINUTE })
	assert.deepEqual(stop(), {})
})

test('stop_hook_active true does not count the turn', () => {
	seedState({ turnsSinceNotice: 3 })
	stop({ stop_hook_active: true })
	assert.equal(readState().turnsSinceNotice, 3)
})

test('stop_hook_active true keeps the gate shut at threshold', () => {
	seedOneTurnShort({ turnsSinceNotice: 10 })
	assert.deepEqual(stop({ stop_hook_active: true }), {})
})

test('trial mode opens the gate at 3 turns and 15 minutes', () => {
	const now = Date.now()
	seedOneTurnShort({ turnsSinceNotice: 2, lastNoticeAtMs: now - 15 * MINUTE, trialStartedAtMs: now - HOUR })
	assert.equal(stop({}, { UNIC_LEARNING_LOOP_TRIAL_MODE: '1' }).systemMessage, NOTICE)
})

test('trial mode records the start of the trial on the first counted turn', () => {
	stop({}, { UNIC_LEARNING_LOOP_TRIAL_MODE: 'true' })
	assert.equal(typeof readState().trialStartedAtMs, 'number')
})

test('an expired trial window uses the normal thresholds', () => {
	const now = Date.now()
	seedOneTurnShort({ turnsSinceNotice: 2, lastNoticeAtMs: now - 15 * MINUTE, trialStartedAtMs: now - 25 * HOUR })
	assert.deepEqual(stop({}, { UNIC_LEARNING_LOOP_TRIAL_MODE: '1' }), {})
})

test('a numeric turn threshold variable replaces the default', () => {
	seedOneTurnShort({ turnsSinceNotice: 2 })
	assert.equal(stop({}, { UNIC_LEARNING_LOOP_MIN_TURNS: '3' }).systemMessage, NOTICE)
})

test('a numeric minute threshold variable replaces the default', () => {
	seedOneTurnShort({ lastNoticeAtMs: Date.now() - 30 * MINUTE })
	assert.equal(stop({}, { UNIC_LEARNING_LOOP_MIN_MINUTES: '30' }).systemMessage, NOTICE)
})

test('a non-numeric turn threshold variable falls back to the default', () => {
	seedOneTurnShort()
	assert.equal(stop({}, { UNIC_LEARNING_LOOP_MIN_TURNS: 'ten' }).systemMessage, NOTICE)
})

test('a non-numeric turn threshold variable keeps the gate shut below the default', () => {
	seedOneTurnShort({ turnsSinceNotice: 2 })
	assert.deepEqual(stop({}, { UNIC_LEARNING_LOOP_MIN_TURNS: 'ten' }), {})
})

test('a relative transcript_path creates no state directory', () => {
	stop({}, {}, 'session.jsonl')
	assert.equal(existsSync(join(dir, 'unic-learning-loop')), false)
})

test('a transcript_path that does not exist creates no state directory', () => {
	stop({}, {}, join(dir, 'missing.jsonl'))
	assert.equal(existsSync(join(dir, 'unic-learning-loop')), false)
})

test('a non-positive turn threshold variable falls back to the default', () => {
	seedOneTurnShort({ turnsSinceNotice: 2 })
	assert.deepEqual(stop({}, { UNIC_LEARNING_LOOP_MIN_TURNS: '0' }), {})
})

test('a state file of another version is treated as fresh', () => {
	seedState({ version: 2, turnsSinceNotice: 7 })
	stop()
	assert.equal(readState().turnsSinceNotice, 1)
})

test('an unparseable state file is treated as fresh', () => {
	mkdirSync(join(dir, 'unic-learning-loop'), { recursive: true })
	writeFileSync(statePath(), '{broken')
	stop()
	assert.equal(readState().turnsSinceNotice, 1)
})

test('the output never contains a decision field when the gate opens', () => {
	seedOneTurnShort()
	assert.equal('decision' in stop(), false)
})

test('the output never contains a decision field when the gate stays shut', () => {
	assert.equal('decision' in stop(), false)
})
