#!/usr/bin/env node
// @ts-check
// SPDX-License-Identifier: LGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Paths that trigger enforcement when changed */
const GUARDED = [
	/^scripts\/.+\.mjs$/,
	/^commands\/.+\.md$/,
	/^\.claude-plugin\/plugin\.json$/,
	/^\.claude-plugin\/marketplace\.json$/,
	/^CLAUDE\.md$/,
	/^README\.md$/,
];

/**
 * @param {string[]} args
 * @returns {{ stdout: string, status: number }}
 */
function git(...args) {
	const result = spawnSync("git", args, { encoding: "utf8", cwd: root });
	return { stdout: result.stdout ?? "", status: result.status ?? 1 };
}

/** @returns {never} */
function fail(/** @type {string} */ msg) {
	console.error(`verify:changelog: ${msg}`);
	process.exit(1);
}

// Determine diff base
const isCI = process.env.CI === "true";
let base = "origin/main";
if (!isCI) {
	const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
	base = upstream.status === 0 ? upstream.stdout.trim() : "HEAD~1";
}

// List changed files
const diff = git("diff", "--name-only", `${base}...HEAD`);
if (diff.status !== 0) {
	// If diff fails (e.g. on a shallow clone), skip silently
	console.log("verify:changelog: skipped (git diff unavailable)");
	process.exit(0);
}

const changedFiles = diff.stdout.trim().split("\n").filter(Boolean);
const triggered = changedFiles.some((f) => GUARDED.some((re) => re.test(f)));
if (!triggered) {
	console.log("verify:changelog: ok (no guarded paths changed)");
	process.exit(0);
}

// Read HEAD version
const pluginPath = path.join(root, ".claude-plugin/plugin.json");
/** @type {{ version: string }} */
let headPlugin;
try {
	headPlugin = /** @type {any} */ (JSON.parse(readFileSync(pluginPath, "utf8")));
} catch {
	fail(`cannot read ${pluginPath}`);
	process.exit(1); // unreachable — satisfies TS
}
const headVersion = headPlugin.version;

// Read base version
const basePluginRaw = git("show", `${base}:.claude-plugin/plugin.json`);
let baseVersion = "";
if (basePluginRaw.status === 0) {
	try {
		baseVersion = /** @type {{ version: string }} */ (JSON.parse(basePluginRaw.stdout)).version;
	} catch {
		// base doesn't have plugin.json yet — treat as empty
	}
}

if (headVersion === baseVersion) {
	fail(
		`version in plugin.json was not bumped\n  current: ${headVersion} (same as base)\n  Run: pnpm bump <patch|minor|major>`,
	);
}

// Check CHANGELOG has a section for headVersion with at least one real bullet
let changelog;
try {
	changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
} catch {
	fail("cannot read CHANGELOG.md");
	process.exit(1);
}

const sectionMatch = changelog.match(
	new RegExp(`## \\[${headVersion.replace(/\./g, "\\.")}\\] — \\d{4}-\\d{2}-\\d{2}([\\s\\S]*?)(?=\\n## \\[|$)`),
);
if (!sectionMatch) {
	fail(
		`CHANGELOG.md has no entry for version ${headVersion}\n  Add bullets under [Unreleased] then run: pnpm bump`,
	);
}

const sectionBody = sectionMatch[1];
const hasRealEntry = sectionBody
	.split("\n")
	.filter((l) => l.startsWith("- "))
	.some((l) => l !== "- (none)");
if (!hasRealEntry) {
	fail(
		`CHANGELOG.md section [${headVersion}] has no entries — only "(none)" placeholders found\n  Add bullets under [Unreleased] then re-run: pnpm bump`,
	);
}

console.log(`verify:changelog: ok — version ${baseVersion} → ${headVersion}`);
