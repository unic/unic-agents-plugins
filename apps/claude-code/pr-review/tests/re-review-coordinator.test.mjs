// @ts-check

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const coordinatorPath = new URL('../agents/re-review-coordinator.md', import.meta.url)
const coordinator = readFileSync(coordinatorPath, 'utf8')

/**
 * Returns the line indices (0-based) of every line that begins (after optional
 * `VAR=$(` prefix and leading whitespace) with `az devops invoke \` — i.e. the
 * actual call sites, not prose backtick mentions of the command name.
 *
 * @param {readonly string[]} lines
 * @returns {number[]}
 */
function findInvokeCallSiteLines(lines) {
	const out = []
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*(?:[A-Z_]+=\$\()?az devops invoke \\$/.test(lines[i])) {
			out.push(i)
		}
	}
	return out
}

describe('Re-review Coordinator markdown — structural invariants', () => {
	const lines = coordinator.split('\n')

	describe('MODE guards around the three Step 6 posting blocks', () => {
		it('contains exactly 3 `az devops invoke` call sites (no new ADO writes)', () => {
			const callSites = findInvokeCallSiteLines(lines)
			assert.equal(
				callSites.length,
				3,
				`Expected exactly 3 az devops invoke call sites, found ${callSites.length}. ` +
					'The Coordinator must only post to ADO from the three Step 6 blocks ' +
					'(new-evidence reply, dispute acknowledgement, PATCH-to-fixed).'
			)
		})

		it('wraps each `az devops invoke` call site in `if [ "$MODE" = "re-review" ]; then … fi`', () => {
			const callSites = findInvokeCallSiteLines(lines)
			const guardPattern = /^if \[ "\$MODE" = "re-review" \]; then$/
			const fiPattern = /^\s*fi$/

			for (const callLine of callSites) {
				// Walk backwards: the nearest preceding control line must be the MODE guard,
				// not a stray `fi` from an earlier block.
				let guardLine = -1
				for (let i = callLine - 1; i >= 0; i--) {
					if (guardPattern.test(lines[i])) {
						guardLine = i
						break
					}
					if (fiPattern.test(lines[i])) {
						break
					}
				}
				assert.notEqual(
					guardLine,
					-1,
					`az devops invoke at line ${callLine + 1} is not preceded by a ` +
						'`if [ "$MODE" = "re-review" ]; then` guard before the previous `fi`. ' +
						'A regression here would silently suppress an ADO write in real re-reviews.'
				)

				// Walk forwards: there must be a closing `fi` after the call site.
				let closerLine = -1
				for (let i = callLine + 1; i < lines.length; i++) {
					if (fiPattern.test(lines[i])) {
						closerLine = i
						break
					}
				}
				assert.notEqual(closerLine, -1, `az devops invoke at line ${callLine + 1} is not followed by a closing \`fi\`.`)
			}
		})

		it('multiline regex confirms 3 `if MODE … az devops invoke … fi` envelopes', () => {
			// Cross-check the line-walking assertion with a single regex match count.
			const envelope = /if \[ "\$MODE" = "re-review" \]; then[\s\S]*?az devops invoke[\s\S]*?\n\s*fi/g
			const matches = coordinator.match(envelope) ?? []
			assert.equal(matches.length, 3, `Expected 3 MODE-guarded az devops invoke envelopes, found ${matches.length}.`)
		})
	})

	describe('Step 0 MODE-whitelist guard', () => {
		it('declares a `case "$MODE" in re-review|dry-run-rereview)` whitelist', () => {
			const whitelistPattern = /case\s+"\$MODE"\s+in\s*\n\s*re-review\|dry-run-rereview\)/
			assert.ok(
				whitelistPattern.test(coordinator),
				'Step 0 must validate MODE against a `case "$MODE" in re-review|dry-run-rereview)` ' +
					'whitelist so an empty/mistyped MODE refuses to run rather than silently skipping ADO writes.'
			)
		})
	})
})
