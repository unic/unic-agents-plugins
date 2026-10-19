// @ts-check

// Where the Personal layer lives and how to find it. `inject.mjs` reads the
// block and `write-layer.mjs` writes it, so both take the markers from here.

import { homedir } from 'node:os'
import { join } from 'node:path'

export const START_MARKER = '<!-- >>> terse-orwell >>> -->'
export const END_MARKER = '<!-- <<< terse-orwell <<< -->'
export const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
export const CLAUDE_MD = join(CONFIG_DIR, 'CLAUDE.md')

/**
 * @param {string} text the content of `CLAUDE.md`
 * @returns {{ start: number, end: number }} marker offsets, -1 for a missing marker
 */
export function findMarkers(text) {
	return { start: text.indexOf(START_MARKER), end: text.indexOf(END_MARKER) }
}
