// @ts-check

// The plugin's only hook. Claude Code caps each hook's added context at 10,000
// characters, so `hooks/hooks.json` runs this script once per part, and the
// first argument names the part:
//
// - `rules`: the Shared setup rules. On SessionStart it also warns until
//   `/terse-orwell:setup` has run, and when the unslop skill is missing.
// - `unslop`: the unslop skill's text, when installed.
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

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
const START_MARKER = '<!-- >>> terse-orwell >>> -->'
const END_MARKER = '<!-- <<< terse-orwell <<< -->'

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
	const text = readOrEmpty(join(CONFIG_DIR, 'CLAUDE.md'))
	const start = text.indexOf(START_MARKER)
	const end = text.indexOf(END_MARKER)
	if (start === -1 || end < start) return null
	return text.slice(start + START_MARKER.length, end)
}

const unslopPath = join(CONFIG_DIR, 'skills', 'unslop', 'SKILL.md')

/**
 * @param {string} hookEventName
 * @param {string} additionalContext
 * @param {string} [systemMessage]
 */
function respond(hookEventName, additionalContext, systemMessage) {
	/** @type {Record<string, unknown>} */
	const output = { hookSpecificOutput: { hookEventName, additionalContext } }
	if (systemMessage) output.systemMessage = systemMessage
	process.stdout.write(JSON.stringify(output))
}

/**
 * @param {string} hookEventName
 * @returns {string | null}
 */
function warnings(hookEventName) {
	if (hookEventName !== 'SessionStart') return null
	const lines = []
	if (readPersonalLayer() === null) lines.push('terse-orwell: no Personal layer yet. Run /terse-orwell:setup.')
	if (!existsSync(unslopPath)) {
		lines.push(`terse-orwell: unslop skill not found at ${unslopPath}. /terse-orwell:setup shows how to install it.`)
	}
	return lines.join('\n')
}

function language() {
	const layer = readPersonalLayer() ?? ''
	const chat = layer.match(/^- Chat language: *(.+?) *$/m)?.[1]
	const artefact = layer.match(/^- Artefact language: *(.+?) *$/m)?.[1]
	if (!chat || !artefact || chat.toLowerCase() === artefact.toLowerCase()) return ''
	return `Reply to the user in ${chat}; artefacts stay ${artefact}.`
}

/** @type {Record<string, () => string>} */
const PARTS = {
	rules: () => stripFrontmatter(readOrEmpty(join(PLUGIN_ROOT, 'context', 'shared-setup.md'))),
	unslop: () => stripFrontmatter(readOrEmpty(unslopPath)),
	style: () => {
		const style = stripFrontmatter(readOrEmpty(join(PLUGIN_ROOT, 'output-styles', 'terse-orwell.md')))
		return `Write every piece of prose you return in this style.\n\n${style}`
	},
	language,
}

try {
	const { hook_event_name: hookEventName } = JSON.parse(readFileSync(0, 'utf8') || '{}')
	const context = PARTS[process.argv[2]]?.() ?? ''
	const message = process.argv[2] === 'rules' ? warnings(hookEventName) : null
	if (context || message) respond(hookEventName, context, message ?? undefined)
} catch {
	// A bad payload gets no context, never a blocked session.
}
process.exit(0)
