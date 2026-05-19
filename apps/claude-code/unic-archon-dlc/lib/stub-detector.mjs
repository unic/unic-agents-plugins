// @ts-check

/**
 * @typedef {{ line: number, pattern: string, text: string }} StubFinding
 */

// Patterns that match stub annotations in any source language
const COMMENT_PATTERNS = [
	{ re: /\bTODO\b/, pattern: 'TODO' },
	{ re: /\bFIXME\b/, pattern: 'FIXME' },
]

// Sentinel values that indicate an unimplemented return
const SENTINEL_RE = /^\s*return\s+(null|undefined|None)\s*;?\s*$/

// Empty return (no value at all)
const EMPTY_RETURN_RE = /^\s*return\s*;?\s*$/

// Python pass statement (only meaningful content on the line)
const PASS_RE = /^\s*pass\s*$/

/**
 * Detect stub patterns in source code text.
 * Returns one finding per detected instance.
 * @param {string} source
 * @returns {StubFinding[]}
 */
export function detectStubs(source) {
	if (!source) return []

	const lines = source.split('\n')

	/** @type {StubFinding[]} */
	const findings = []

	for (let i = 0; i < lines.length; i++) {
		const lineNo = i + 1
		const line = lines[i]

		for (const { re, pattern } of COMMENT_PATTERNS) {
			if (re.test(line)) {
				findings.push({ line: lineNo, pattern, text: line.trim() })
			}
		}

		if (PASS_RE.test(line)) {
			findings.push({ line: lineNo, pattern: 'pass', text: line.trim() })
		} else if (EMPTY_RETURN_RE.test(line)) {
			findings.push({ line: lineNo, pattern: 'empty-return', text: line.trim() })
		} else if (SENTINEL_RE.test(line)) {
			findings.push({ line: lineNo, pattern: 'sentinel', text: line.trim() })
		}
	}

	return findings
}
