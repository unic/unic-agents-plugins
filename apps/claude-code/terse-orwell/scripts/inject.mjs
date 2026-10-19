// @ts-check

// The plugin's only hook. Claude Code caps each hook's added context at 10,000
// characters, so `hooks/hooks.json` runs this script once per part, and the
// first argument names the part:
//
// - `rules`: the Shared setup rules. On SessionStart it also warns until
//   `/terse-orwell:setup` has run, and when the unslop skill is missing.
// - `unslop`, `unslop-2`: the unslop skill's text, when installed, split at
//   paragraph breaks into parts under the cap.
// - `style`: the output style, for SubagentStart, because a subagent never sees
//   the output style or a plugin's SessionStart context.
// - `language`: one line naming the chat and artefact languages from the
//   Personal layer, for UserPromptSubmit, because long runs of artefacts make
//   the chat drift.
//
// The event name comes from the payload on stdin. It exits 0 on every path. A
// hook that fails must not block a session, a prompt or a subagent spawn.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CLAUDE_MD, CONFIG_DIR, findMarkers, START_MARKER } from './personal-layer.mjs'

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CONTEXT_CAP = 10_000

/** @param {string} path */
function readOrEmpty(path) {
	try {
		return readFileSync(path, 'utf8')
	} catch {
		return ''
	}
}

/** @param {string} text */
function stripFrontmatter(text) {
	return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

/** @returns {string | null} the Personal layer, or null when `/setup` has not run */
function readPersonalLayer() {
	const text = readOrEmpty(CLAUDE_MD)
	const { start, end } = findMarkers(text)
	if (start === -1 || end < start) return null
	return text.slice(start + START_MARKER.length, end)
}

// `npx skills add -g` installs to `~/.claude` even when `CLAUDE_CONFIG_DIR` points elsewhere.
const unslopPaths = [...new Set([CONFIG_DIR, join(homedir(), '.claude')])].map((dir) =>
	join(dir, 'skills', 'unslop', 'SKILL.md')
)
const unslopPath = unslopPaths.find((path) => existsSync(path))

const UNSLOP_PARTS = 2

/**
 * Splits the unslop text at paragraph breaks into chunks under the context
 * cap. `hooks/hooks.json` sends the first UNSLOP_PARTS chunks, one per entry.
 *
 * @returns {string[]}
 */
function splitUnslop() {
	const text = unslopPath ? stripFrontmatter(readOrEmpty(unslopPath)) : ''
	/** @type {string[]} */
	const chunks = []
	let chunk = ''
	for (const paragraph of text.split('\n\n')) {
		const joined = chunk ? `${chunk}\n\n${paragraph}` : paragraph
		if (joined.length < CONTEXT_CAP) {
			chunk = joined
			continue
		}
		if (chunk) chunks.push(chunk)
		chunk = paragraph
		// A single paragraph over the cap is cut hard rather than sent as a preview.
		while (chunk.length >= CONTEXT_CAP) {
			chunks.push(chunk.slice(0, CONTEXT_CAP - 1))
			chunk = chunk.slice(CONTEXT_CAP - 1)
		}
	}
	if (chunk) chunks.push(chunk)
	return chunks
}

function buildSetupWarnings() {
	const lines = []
	if (readPersonalLayer() === null) lines.push('terse-orwell: no Personal layer yet. Run /terse-orwell:setup.')
	if (!unslopPath) {
		lines.push(`terse-orwell: unslop skill not found at ${unslopPaths[0]}. /terse-orwell:setup can install it.`)
	} else if (splitUnslop().length > UNSLOP_PARTS) {
		lines.push(
			`terse-orwell: ${unslopPath} needs more than ${UNSLOP_PARTS} parts of ${CONTEXT_CAP} characters, so its end is not sent.`
		)
	}
	return lines.join('\n')
}

function buildLanguageReminder() {
	const layer = readPersonalLayer() ?? ''
	const chat = layer.match(/^- Chat language: *(.+?) *$/m)?.[1]
	const artefact = layer.match(/^- Artefact language: *(.+?) *$/m)?.[1]
	if (!chat || !artefact || chat.toLowerCase() === artefact.toLowerCase()) return ''
	return `Reply to the user in ${chat}; artefacts stay ${artefact}.`
}

/** @type {Record<string, () => string>} */
const PARTS = {
	rules: () => readOrEmpty(join(PLUGIN_ROOT, 'context', 'shared-setup.md')).trim(),
	unslop: () => splitUnslop()[0] ?? '',
	'unslop-2': () => splitUnslop()[1] ?? '',
	style: () => {
		const style = stripFrontmatter(readOrEmpty(join(PLUGIN_ROOT, 'output-styles', 'terse-orwell.md')))
		return `Write every piece of prose you return in this style.\n\n${style}`
	},
	language: buildLanguageReminder,
}

try {
	const { hook_event_name: hookEventName } = JSON.parse(readFileSync(0, 'utf8') || '{}')
	const context = PARTS[process.argv[2]]?.() ?? ''
	const message = process.argv[2] === 'rules' && hookEventName === 'SessionStart' ? buildSetupWarnings() : ''
	/** @type {Record<string, unknown>} */
	const output = { hookSpecificOutput: { hookEventName, additionalContext: context } }
	if (message) output.systemMessage = message
	if (context || message) process.stdout.write(JSON.stringify(output))
} catch {
	// A bad payload gets no context, never a blocked session.
}
process.exit(0)
