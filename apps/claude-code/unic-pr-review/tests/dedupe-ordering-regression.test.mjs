// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2026 Unic

/**
 * Regression / eval fixture: dedupe-ordering catch (PR #5612)
 *
 * Parity guard: unic-pr-review correctly surfaced this pattern at Minor
 * severity; pr-review v1.4.0 missed it entirely (false negative). This
 * fixture pins the pattern and the expected quality bar so regressions are
 * caught by CI as the plugin evolves.
 *
 * Background: AnalyticsTracker.tsx in PR #5612 contained an unconditional
 * `lastFiredPathRef.current = null` at line 38, placed BEFORE the `cancelled`
 * early-return guard at line 46. On an SSP-redirect-back-to-same-page (e.g.
 * logo click while already on the landing page) the dedupe key is wiped and
 * the destination `routeChangeComplete` handler re-fires a duplicate
 * `page_view` for the same URL.
 *
 * unic-pr-review graded this Minor (confidence ~70) — correct, low-frequency
 * path. pr-review v1.4.0 produced a false negative on the same diff.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseFinding } from '../scripts/lib/finding-validator.mjs'
import { bucketBySeverity } from '../scripts/lib/severity-bucketer.mjs'

/**
 * Canonical diff encoding the dedupe-ordering pattern from PR #5612.
 *
 * The pattern: an unconditional ref/state reset is placed BEFORE an
 * early-return guard, so on a same-key re-entry the dedupe key is already
 * wiped when the guard is checked, allowing a duplicate emission.
 *
 * AnalyticsTracker.tsx (simplified, structure preserved):
 *
 *   38:  lastFiredPathRef.current = null   // ← unconditional reset
 *   ...
 *   46:  if (cancelled) return             // ← guard is TOO LATE
 *   47:  if (url === lastFiredPathRef.current) return
 *   48:  lastFiredPathRef.current = url
 *   49:  trackPageView(url)
 */
const DEDUPE_ORDERING_DIFF = `\
+  useEffect(() => {
     let cancelled = false
+    lastFiredPathRef.current = null

     router.events.on('routeChangeComplete', (url) => {
       if (cancelled) return
       if (url === lastFiredPathRef.current) return
       lastFiredPathRef.current = url
       trackPageView(url)
     })

     return () => {
       cancelled = true
     }
   }, [router])
`

/**
 * Reference finding: what the code-reviewer MUST surface for this pattern.
 *
 * Confidence 70 is representative of the Minor band (60–79 per ADR-0002).
 * This object is the eval ground-truth. parseFinding must accept it and derive
 * severity 'minor'. If the thresholds or validator shape change in a way that
 * breaks this finding, the regression fixture will fail.
 *
 * Note: REFERENCE_FINDING is the expected output shape for this pattern. It is
 * not derived from DEDUPE_ORDERING_DIFF by any runtime logic in this file —
 * the fixture validates the validator, not the detector.
 */
const REFERENCE_FINDING = {
	confidence: 70,
	filePath: 'src/analytics/AnalyticsTracker.tsx',
	startLine: 38,
	title: 'Dedupe-ref reset before early-return guard allows duplicate page_view emission',
	body:
		'`lastFiredPathRef.current = null` runs unconditionally before the `cancelled` guard.' +
		' On an SSP-redirect-back-to-same-page the dedupe key is wiped, so the destination' +
		' `routeChangeComplete` handler re-fires a duplicate `page_view` for the same URL.',
	suggestion:
		'Move the reset into the cleanup function after `cancelled = true`, so it only fires on unmount—not on every render cycle.',
}

describe('dedupe-ordering regression fixture (PR #5612 parity guard)', () => {
	it('fixture contains the unconditional ref reset before the guard', () => {
		const resetIdx = DEDUPE_ORDERING_DIFF.indexOf('lastFiredPathRef.current = null')
		const guardIdx = DEDUPE_ORDERING_DIFF.indexOf('if (cancelled) return')
		assert.ok(resetIdx !== -1, 'fixture must contain the unconditional ref reset')
		assert.ok(guardIdx !== -1, 'fixture must contain the early-return guard')
		assert.ok(resetIdx < guardIdx, 'reset must appear BEFORE the guard in the diff')
	})

	it('reference finding confidence (70) falls in the Minor band (60–79)', () => {
		assert.equal(bucketBySeverity(REFERENCE_FINDING.confidence), 'minor')
	})

	it('parseFinding accepts the reference finding and derives severity minor', () => {
		const result = parseFinding(REFERENCE_FINDING)
		assert.ok(result !== null, 'finding must not be dropped (confidence >= 60)')
		assert.equal(result?.severity, 'minor')
		assert.equal(result?.confidence, 70)
	})

	it('reference finding title names the ordering defect', () => {
		assert.ok(
			/dedupe|duplicate|reset|guard/i.test(REFERENCE_FINDING.title),
			'title must reference the ordering/dedupe issue'
		)
	})

	it('reference finding body mentions the duplicate emission consequence', () => {
		assert.ok(
			/duplicate|re-fires?|emiss/i.test(REFERENCE_FINDING.body),
			'body must describe the duplicate-emission consequence'
		)
	})
})
