// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

describe('ado-cli inventory', () => {
	it('every az devops invoke call in ado-fetcher.md is in ado-cli-inventory.json', () => {
		const fetcherMd = readFileSync(resolve(root, 'agents/ado-fetcher.md'), 'utf8')
		const inventory = JSON.parse(
			readFileSync(resolve(root, 'providers/azure_devops/fixtures/ado-cli-inventory.json'), 'utf8')
		)
		const inventoried = new Set(
			inventory.invokeCommands.map((/** @type {{ area: string, resource: string }} */ c) => `${c.area}/${c.resource}`)
		)

		// Convention: `az devops invoke --area X --resource Y` always opens the command
		// (same logical line in each shell block in ado-fetcher.md). \s+ tolerates future wrapping.
		const singleLinePattern = /az devops invoke\s+--area\s+(\S+)\s+--resource\s+(\S+)/g

		/** @type {string[]} */
		const found = [...fetcherMd.matchAll(singleLinePattern)].map((m) => `${m[1]}/${m[2]}`)

		assert.ok(found.length > 0, 'Expected at least one az devops invoke call in ado-fetcher.md')
		for (const key of found) {
			assert.ok(
				inventoried.has(key),
				`az devops invoke --area/--resource "${key}" in ado-fetcher.md is NOT in ado-cli-inventory.json`
			)
		}

		// Reverse direction (invokeCommands only): every inventoried invoke call must
		// actually appear in ado-fetcher.md, so the inventory cannot advertise a call
		// the agent never makes (e.g. a deferred `diffs` fetch). `otherCommands` stays
		// directional by design — it documents non-invoke CLI calls.
		const foundSet = new Set(found)
		for (const key of inventoried) {
			assert.ok(
				foundSet.has(key),
				`ado-cli-inventory.json lists az devops invoke "${key}" but ado-fetcher.md never makes that call`
			)
		}
	})
})
