// SPDX-License-Identifier: LGPL-3.0-or-later
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEXT_START_RE = /(?:<p>\s*)?\[AUTO_INSERT_START:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;
export const TEXT_END_RE = /(?:<p>\s*)?\[AUTO_INSERT_END:\s*([^\]]+?)\s*\](?:\s*<\/p>)?/;

/**
 * Injects newHtml into existingBody using one of three strategies:
 *   1. Plain-text markers ([AUTO_INSERT_START: label] / [AUTO_INSERT_END: label])
 *   2. Anchor macros (md-start / md-end)
 *   3. Replace-all (--replace-all flag) or error if no markers
 *
 * Calls process.exit(1) on mismatched or unpaired markers.
 *
 * @param {string} existingBody — Confluence storage-format HTML
 * @param {string} newHtml — HTML to inject
 * @param {string} title — page title, used in error messages only
 * @param {{ replaceAll?: boolean, dryRun?: boolean, pageId?: number, version?: number }} [opts]
 * @returns {string}
 */
export function injectContent(
	existingBody,
	newHtml,
	title,
	{ replaceAll = false, dryRun = false, pageId, version } = {},
) {
	const hasStart = TEXT_START_RE.test(existingBody);
	const hasEnd = TEXT_END_RE.test(existingBody);

	// Strategy 1: plain-text markers
	if (hasStart || hasEnd) {
		if (hasStart !== hasEnd) {
			console.error(
				`Found [AUTO_INSERT_START] without a matching [AUTO_INSERT_END] on page "${title}" — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		const startMatch = TEXT_START_RE.exec(existingBody);
		const startLabel = startMatch[1].trim();
		const afterStart = startMatch.index + startMatch[0].length;

		const escapedLabel = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const labelEndRe = new RegExp(
			`(?:<p>\\s*)?\\[AUTO_INSERT_END:\\s*${escapedLabel}\\s*\\](?:\\s*<\\/p>)?`,
		);
		const endMatch = labelEndRe.exec(existingBody.slice(afterStart));

		if (!endMatch) {
			console.error(
				`Marker label mismatch on page "${title}": [AUTO_INSERT_START:${startLabel}] has no matching [AUTO_INSERT_END:${startLabel}] — fix the Confluence page before publishing`,
			);
			process.exit(1);
		}

		return `${existingBody.slice(0, afterStart)}\n${newHtml}\n${existingBody.slice(afterStart + endMatch.index)}`;
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
