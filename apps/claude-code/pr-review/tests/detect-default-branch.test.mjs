// @ts-check

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectDefaultBranch } from '../scripts/pre-pr/detect-default-branch.mjs'

const noBranch = () => false
const allBranches = () => true

describe('detectDefaultBranch', () => {
	it('remoteHeadBranch set → returns it as branch with source remote-show, no notice', () => {
		const result = detectDefaultBranch({ branchExists: noBranch, remoteHeadBranch: 'main' })
		assert.equal(result.branch, 'main')
		assert.equal(result.source, 'remote-show')
		assert.equal(result.notice, undefined)
	})

	it('remoteHeadBranch = "develop" → returns develop with source remote-show, no notice', () => {
		const result = detectDefaultBranch({ branchExists: noBranch, remoteHeadBranch: 'develop' })
		assert.equal(result.branch, 'develop')
		assert.equal(result.source, 'remote-show')
		assert.equal(result.notice, undefined)
	})

	it('remoteHeadBranch empty, develop exists → develop-fallback + warning notice', () => {
		const result = detectDefaultBranch({ branchExists: (n) => n === 'develop', remoteHeadBranch: '' })
		assert.equal(result.branch, 'develop')
		assert.equal(result.source, 'develop-fallback')
		assert.equal(result.notice?.severity, 'warning')
		assert.equal(result.notice?.kind, 'default-branch')
		assert.ok(result.notice?.message.includes('develop'))
	})

	it('remoteHeadBranch empty, no develop, main exists → main-fallback + warning notice', () => {
		const result = detectDefaultBranch({ branchExists: (n) => n === 'main', remoteHeadBranch: '' })
		assert.equal(result.branch, 'main')
		assert.equal(result.source, 'main-fallback')
		assert.equal(result.notice?.kind, 'default-branch')
		assert.ok(result.notice?.message.includes('main'))
	})

	it('remoteHeadBranch empty, no develop/main, master exists → master-fallback + warning notice', () => {
		const result = detectDefaultBranch({ branchExists: (n) => n === 'master', remoteHeadBranch: '' })
		assert.equal(result.branch, 'master')
		assert.equal(result.source, 'master-fallback')
		assert.equal(result.notice?.kind, 'default-branch')
		assert.ok(result.notice?.message.includes('master'))
	})

	it('remoteHeadBranch is whitespace-only → falls through to develop fallback', () => {
		const result = detectDefaultBranch({
			branchExists: (name) => name === 'develop',
			remoteHeadBranch: '   ',
		})
		assert.equal(result.branch, 'develop')
		assert.equal(result.source, 'develop-fallback')
	})

	it('remoteHeadBranch empty, no branches → source none, branch null, notice present', () => {
		const result = detectDefaultBranch({ branchExists: noBranch, remoteHeadBranch: '' })
		assert.equal(result.branch, null)
		assert.equal(result.source, 'none')
		assert.equal(result.notice?.severity, 'warning')
		assert.equal(result.notice?.kind, 'default-branch')
		assert.ok(result.notice?.message.length > 0)
	})

	it('fallback chain prioritises develop over main over master', () => {
		const result = detectDefaultBranch({ branchExists: allBranches, remoteHeadBranch: '' })
		assert.equal(result.branch, 'develop')
		assert.equal(result.source, 'develop-fallback')
	})
})
