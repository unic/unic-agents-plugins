// SPDX-License-Identifier: LGPL-3.0-or-later
// @ts-check
// Copyright © 2026 Unic

/**
 * mode-detector.mjs — derive the review Mode from the invocation context.
 *
 * The four Modes are defined in ADR-0009 (Pre-PR as a peer operating mode)
 * and ADR-0006 (iteration state in the PR Bot Signature).
 *
 * Decision table (first matching row wins):
 *
 * | hasUrl | hasPriorSignature | revisionsAvailable | Mode                  |
 * |--------|-------------------|--------------------|-----------------------|
 * | false  | (any)             | (any)              | pre-pr                |
 * | true   | false             | (any)              | first-review          |
 * | true   | true              | true               | re-review             |
 * | true   | true              | false              | first-review-fallback |
 */

/**
 * @typedef {'pre-pr' | 'first-review' | 're-review' | 'first-review-fallback'} Mode
 */

/**
 * Discriminated by `hasUrl`, then by `hasPriorSignature`. Fields that the
 * decision table marks `(any)` are simply absent from the variant where they
 * are irrelevant — making nonsense inputs unrepresentable.
 *
 * @typedef {{ hasUrl: false }
 *         | { hasUrl: true, hasPriorSignature: false }
 *         | { hasUrl: true, hasPriorSignature: true, revisionsAvailable: boolean }} ModeContext
 */

/**
 * Detect the review Mode from the invocation context.
 *
 * @param {ModeContext} ctx
 * @returns {Mode}
 */
export function detectMode(ctx) {
	if (!ctx.hasUrl) return 'pre-pr'
	if (!ctx.hasPriorSignature) return 'first-review'
	if (ctx.revisionsAvailable) return 're-review'
	return 'first-review-fallback'
}
