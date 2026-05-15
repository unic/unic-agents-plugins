#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic
//
// CLI wrapper: node scripts/yaml-gen-cli.mjs --slug <slug> --issues <issues.json>
// Reads issues.json, builds dep-tree, generates build-<slug>.yaml

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { buildDepTree } from './lib/dep-tree.mjs'
import { generateBuildYaml } from './lib/yaml-gen.mjs'

const args = process.argv.slice(2)
const slugIdx = args.indexOf('--slug')
const issuesIdx = args.indexOf('--issues')

if (slugIdx === -1 || issuesIdx === -1) {
	process.stderr.write('Usage: node scripts/yaml-gen-cli.mjs --slug <slug> --issues <issues.json>\n')
	process.exit(1)
}

const slug = args[slugIdx + 1]
const issuesPath = args[issuesIdx + 1]

if (!slug || !issuesPath) {
	process.stderr.write('Error: --slug and --issues require values\n')
	process.exit(1)
}

let issues
try {
	issues = JSON.parse(readFileSync(issuesPath, 'utf8'))
} catch (err) {
	process.stderr.write(`Error reading issues file: ${err instanceof Error ? err.message : String(err)}\n`)
	process.exit(1)
}

const result = buildDepTree(issues)
if (!result.ok) {
	process.stderr.write(`Dependency tree error: ${result.error}\n`)
	if (result.cycle.length > 0) process.stderr.write(`Cycle: ${result.cycle.join(' → ')}\n`)
	process.exit(1)
}

const yaml = generateBuildYaml(slug, result.groups)
const outPath = join('.archon', 'workflows', `build-${slug}.yaml`)

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, yaml, 'utf8')
process.stdout.write(`Wrote ${outPath}\n`)
