// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
/** @import { InjectOptions } from './types.mjs' */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Bare markers — no surrounding <p> tags
export const TEXT_START_BARE_RE = /\[AUTO_INSERT_START:\s*([^\]]+?)\s*\]/;
export const TEXT_END_BARE_RE = /\[AUTO_INSERT_END:\s*([^\]]+?)\s*\]/;
// Full <p>-wrapped markers — both opening and closing tags required, no optional groups
export const TEXT_START_P_RE = /<p>\s*\[AUTO_INSERT_START:\s*([^\]]+?)\s*\]\s*<\/p>/;
export const TEXT_END_P_RE = /<p>\s*\[AUTO_INSERT_END:\s*([^\]]+?)\s*\]\s*<\/p>/;

/**
 * Injects `newHtml` into `existingBody` using one of three strategies:
 * 1. Plain-text markers ([AUTO_INSERT_START:label] / [AUTO_INSERT_END:label])
 * 2. Confluence anchor macros (md-start / md-end)
 * 3. Append (no markers found)
 *
 * @param {string} existingBody - Current Confluence page storage-format HTML.
 * @param {string} newHtml - New HTML to inject (output of marked()).
 * @param {string} title - Page title, used in error messages only.
 * @param {InjectOptions} [opts] - Injection options (replaceAll, dryRun, pageId, version).
 * @returns {string} Updated storage-format HTML with new content injected.
 */
export function injectContent(
	existingBody,
	newHtml,
	title,
	{ replaceAll = false, dryRun = false, pageId, version } = {},
) {
	// ── Strategy 1: plain-text markers ────────────────────────────────────────

	const hasPWrappedStart = TEXT_START_P_RE.test(existingBody);
	const hasBareStart = TEXT_START_BARE_RE.test(existingBody);
	const hasPWrappedEnd = TEXT_END_P_RE.test(existingBody);
	const hasBareEnd = TEXT_END_BARE_RE.test(existingBody);

	const hasStart = hasPWrappedStart || hasBareStart;
	const hasEnd = hasPWrappedEnd || hasBareEnd;

	if (hasStart || hasEnd) {
		// Must have both or neither
		if (hasStart !== hasEnd) {
			console.error(
				`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		// Wrapping style must be consistent across START and END
		const startIsWrapped = hasPWrappedStart;
		const endIsWrapped = hasPWrappedEnd;

		if (startIsWrapped !== endIsWrapped) {
			console.error(
				`Marker wrapping mismatch on page "${title}": START is ${startIsWrapped ? "<p>-wrapped" : "bare"} but END is ${endIsWrapped ? "<p>-wrapped" : "bare"} — fix the Confluence page so both markers use the same format`,
			);
			process.exit(1);
		}

		const START_RE = startIsWrapped ? TEXT_START_P_RE : TEXT_START_BARE_RE;

		const startMatch = START_RE.exec(existingBody);
		// unreachable: hasBareStart or hasPWrappedStart is true above
		if (!startMatch) process.exit(1);
		const startLabel = startMatch[1].trim();

		// Build a label-specific END regex with the same wrapping style as START.
		const escapedLabel = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const labelEndRe = endIsWrapped
			? new RegExp(`<p>\\s*\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\]\\s*<\\/p>`)
			: new RegExp(`\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\]`);

		// Search for the END marker only in the content AFTER the START marker ends.
		const afterStart = startMatch.index + startMatch[0].length;
		const endMatch = labelEndRe.exec(existingBody.slice(afterStart));

		if (!endMatch) {
			console.error(
				`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		// Slice construction:
		//   prefix   — everything up to the start of the START marker (incl. its <p> if wrapped)
		//   suffix   — everything from the end of the END marker (incl. its </p> if wrapped)
		const prefixEnd = startMatch.index;
		const suffixStart = afterStart + endMatch.index + endMatch[0].length;

		return `${existingBody.slice(0, prefixEnd)}${startMatch[0]}\n${newHtml}\n${endMatch[0]}${existingBody.slice(suffixStart)}`;
	}

	// Strategy 2: anchor macros (legacy fallback)
	const anchorStartRe =
		/<ac:structured-macro[^>]*ac:name="anchor"[^>]*>\s*<ac:parameter[^>]*>md-start<\/ac:parameter>\s*<\/ac:structured-macro>/;
	const anchorEndRe =
		/<ac:structured-macro[^>]*ac:name="anchor"[^>]*>\s*<ac:parameter[^>]*>md-end<\/ac:parameter>\s*<\/ac:structured-macro>/;
	const hasAnchorStart = anchorStartRe.test(existingBody);
	const hasAnchorEnd = anchorEndRe.test(existingBody);

	if (hasAnchorStart || hasAnchorEnd) {
		if (hasAnchorStart !== hasAnchorEnd) {
			console.error(
				`Found md-start anchor without md-end (or vice versa) on page "${title}" — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		const startMatch = anchorStartRe.exec(existingBody);
		const endMatch = anchorEndRe.exec(existingBody);
		// unreachable: hasAnchorStart and hasAnchorEnd are both true above
		if (!startMatch || !endMatch) process.exit(1);

		return `${existingBody.slice(0, startMatch.index + startMatch[0].length)}\n${newHtml}\n${existingBody.slice(endMatch.index)}`;
	}

	// Strategy 3: no markers found
	if (replaceAll) {
		if (!dryRun) {
			const safePageId = pageId ?? "unknown-page";
			const safeVersion = version ?? "unknown-version";
			const backupDir = path.join(os.homedir(), ".unic-confluence", "backups");
			mkdirSync(backupDir, { recursive: true });
			const backupPath = path.join(backupDir, `${safePageId}-v${safeVersion}.html`);
			writeFileSync(backupPath, existingBody, "utf8");
			console.log(`Backup saved to ${backupPath}`);
		}
		return newHtml;
	}
	console.error(
		`No [AUTO_INSERT_START:label] / [AUTO_INSERT_END:label] markers found on page "${title}". Add markers to the Confluence page, or use --replace-all to overwrite the full body.`,
	);
	process.exit(1);
}
