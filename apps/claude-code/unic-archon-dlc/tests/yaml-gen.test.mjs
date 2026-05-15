// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateBuildYaml } from '../scripts/lib/yaml-gen.mjs'

/**
 * Validates basic YAML syntactic requirements:
 * - No leading tab characters (YAML forbids tabs as indentation)
 * - Contains at least one colon (key: value pairs)
 *
 * @param {string} yaml
 */
function assertValidYaml(yaml) {
	assert.ok(!yaml.includes('\t'), 'YAML must not contain tab characters')
	assert.ok(yaml.includes(':'), 'YAML must contain key: value pairs')
}

describe('generateBuildYaml', () => {
	it('workflow name contains the slug', () => {
		const yaml = generateBuildYaml('my-feature', [['A']])
		assert.ok(yaml.includes('build-my-feature'))
	})

	it('single group [[A, B]] generates code-red-A and code-red-B as sibling nodes', () => {
		const yaml = generateBuildYaml('feat', [['A', 'B']])
		assert.ok(yaml.includes('code-red-A:'))
		assert.ok(yaml.includes('code-red-B:'))
		assert.ok(yaml.includes('code-green-A:'))
		assert.ok(yaml.includes('code-green-B:'))
		assertValidYaml(yaml)
	})

	it('single group: code-red nodes have no inter-dependencies (parallel)', () => {
		const yaml = generateBuildYaml('feat', [['A', 'B']])
		// Find only the code-red-A node itself (up to the next blank line after its description)
		const redAIdx = yaml.indexOf('  code-red-A:')
		const slopAIdx = yaml.indexOf('  slopcheck-A:')
		// Slice only the code-red-A node block (before slopcheck-A starts)
		const redABlock = yaml.slice(redAIdx, slopAIdx)
		assert.ok(!redABlock.includes('depends_on'), 'code-red-A should have no depends_on in first tier')
	})

	it('two groups [[A],[B]] generates sequential nodes via depends_on', () => {
		const yaml = generateBuildYaml('feat', [['A'], ['B']])
		assert.ok(yaml.includes('code-red-A:'))
		assert.ok(yaml.includes('code-green-A:'))
		assert.ok(yaml.includes('code-red-B:'))
		assert.ok(yaml.includes('code-green-B:'))
		// code-red-B must depend on code-green-A (from the previous tier)
		const redBIdx = yaml.indexOf('code-red-B:')
		const nextNode = yaml.indexOf('\n  code-', redBIdx + 1)
		const redBBlock = yaml.slice(redBIdx, nextNode === -1 ? undefined : nextNode)
		assert.ok(redBBlock.includes('code-green-A'), 'code-red-B should depend on code-green-A')
		assertValidYaml(yaml)
	})

	it('each issue gets a slopcheck node', () => {
		const yaml = generateBuildYaml('feat', [['X', 'Y']])
		assert.ok(yaml.includes('slopcheck-X:'))
		assert.ok(yaml.includes('slopcheck-Y:'))
	})

	it('output has global verification node', () => {
		const yaml = generateBuildYaml('feat', [['A']])
		assert.ok(yaml.includes('verification:'))
	})

	it('output has goals-check node', () => {
		const yaml = generateBuildYaml('feat', [['A']])
		assert.ok(yaml.includes('goals-check:'))
	})

	it('output has report node', () => {
		const yaml = generateBuildYaml('feat', [['A']])
		assert.ok(yaml.includes('report:'))
	})

	it('output has human-review-gate with interactive: true', () => {
		const yaml = generateBuildYaml('feat', [['A']])
		assert.ok(yaml.includes('human-review-gate:'))
		assert.ok(yaml.includes('interactive: true'))
	})

	it('output is valid YAML (no tabs, has colons)', () => {
		const yaml = generateBuildYaml('test-slug', [['US-001', 'US-002'], ['US-003']])
		assertValidYaml(yaml)
	})

	it('empty groups produce workflow with only global nodes', () => {
		const yaml = generateBuildYaml('empty', [])
		assert.ok(yaml.includes('verification:'))
		assert.ok(yaml.includes('human-review-gate:'))
		assertValidYaml(yaml)
	})
})
