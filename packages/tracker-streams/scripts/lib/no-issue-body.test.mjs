#!/usr/bin/env node
// @ts-check

/**
 * AC 7 guard: the generator reads native tracker relations only.
 *
 * Issue text is off limits. Prose dependency sections were removed from every stream
 * member, and the ones still carried by closed issues are known to be wrong — #309's
 * reads "None. #289 is merged", which a naive `#NNN` scan turns into a false edge.
 *
 * This test reads the source of every file on the fetch path and fails if either the
 * issue text field or a prose dependency heading appears in it. It is a guard, not a
 * transform test, which is why it lives in its own file.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Every file that touches the network or drives the fetch. */
const FETCH_PATH = [path.join(here, 'github-client.mjs'), path.join(here, '..', 'fetch-streams.mjs')]

/** The issue text field, however it is reached. */
const ISSUE_TEXT_FIELD = /\.body\b/

/** A prose dependency heading. The literal path segment `dependencies/blocked_by` has no space, so it is safe. */
const PROSE_DEPENDENCY_HEADING = /blocked\s+by/i

describe('the fetch path reads no issue text (AC 7)', () => {
	for (const file of FETCH_PATH) {
		const source = readFileSync(file, 'utf8')
		const name = path.basename(file)

		it(`${name} never reads an issue's text field`, () => {
			assert.doesNotMatch(source, ISSUE_TEXT_FIELD)
		})

		it(`${name} never parses a prose dependency heading`, () => {
			assert.doesNotMatch(source, PROSE_DEPENDENCY_HEADING)
		})
	}

	it('guards every file on the fetch path', () => {
		assert.equal(FETCH_PATH.length, 2)
	})
})
