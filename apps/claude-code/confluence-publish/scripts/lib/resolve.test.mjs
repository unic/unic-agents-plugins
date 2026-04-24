// @ts-check
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isNumericId, resolvePageId } from "./resolve.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testPagesPath = path.join(process.cwd(), "confluence-pages.json");
const testPagesBackup = path.join(process.cwd(), "confluence-pages.json.bak");

describe("isNumericId", () => {
	it("returns true for a numeric string", () => {
		assert.strictEqual(isNumericId("12345"), true);
	});

	it("returns false for a key name", () => {
		assert.strictEqual(isNumericId("my-page"), false);
	});

	it("returns false for empty string", () => {
		assert.strictEqual(isNumericId(""), false);
	});

	it("returns false for a string with letters", () => {
		assert.strictEqual(isNumericId("123abc"), false);
	});
});

describe("resolvePageId — numeric input", () => {
	it("returns a positive integer for a valid numeric string", () => {
		const result = resolvePageId("98765");
		assert.strictEqual(result, 98765);
	});
});

describe("resolvePageId — key lookup", () => {
	before(() => {
		if (existsSync(testPagesPath)) {
			writeFileSync(testPagesBackup, readFileSync(testPagesPath, "utf8"));
		}
		writeFileSync(
			testPagesPath,
			JSON.stringify({ _comment: "test", "my-page": 11111, other: 22222 }, null, 2),
			"utf8",
		);
	});

	after(() => {
		unlinkSync(testPagesPath);
		if (existsSync(testPagesBackup)) {
			writeFileSync(testPagesPath, readFileSync(testPagesBackup, "utf8"));
			unlinkSync(testPagesBackup);
		}
	});

	it("returns the page ID for a valid key", () => {
		const result = resolvePageId("my-page");
		assert.strictEqual(result, 11111);
	});

	it("returns the page ID for another valid key", () => {
		const result = resolvePageId("other");
		assert.strictEqual(result, 22222);
	});
});

describe("resolvePageId — error paths (via subprocess)", () => {
	// These error paths call process.exit(1). We test them by spawning a child
	// Node process with a hardcoded inline script via --input-type=module.
	// spawnSync is used (not exec) — the command is always process.execPath
	// (the Node binary) with a hardcoded argv array; there is no shell and no
	// injection surface.

	it("exits 1 for missing confluence-pages.json when using a key", () => {
		const resolvePath = path.join(__dirname, "resolve.mjs");
		const script = `import {resolvePageId} from ${JSON.stringify(resolvePath)}; resolvePageId("missing-key")`;
		const result = spawnSync(process.execPath, ["--input-type=module"], {
			input: script,
			cwd: "/tmp",
			encoding: "utf8",
		});
		assert.strictEqual(result.status, 1, `expected exit 1, got ${result.status}\n${result.stderr}`);
		assert.ok(
			result.stderr.includes("confluence-pages.json not found"),
			`expected error message in stderr:\n${result.stderr}`,
		);
	});

	it("exits 1 with available keys message for unknown key", () => {
		const tmpDir = "/tmp";
		const tmpPages = path.join(tmpDir, "confluence-pages.json");
		writeFileSync(tmpPages, JSON.stringify({ "known-page": 99999 }, null, 2));

		const resolvePath = path.join(__dirname, "resolve.mjs");
		const script = `import {resolvePageId} from ${JSON.stringify(resolvePath)}; resolvePageId("unknown-key")`;
		const result = spawnSync(process.execPath, ["--input-type=module"], {
			input: script,
			cwd: tmpDir,
			encoding: "utf8",
		});

		unlinkSync(tmpPages);

		assert.strictEqual(result.status, 1, `expected exit 1, got ${result.status}\n${result.stderr}`);
		assert.ok(
			result.stderr.includes("not found in confluence-pages.json"),
			`expected not-found message:\n${result.stderr}`,
		);
		assert.ok(
			result.stderr.includes("known-page"),
			`expected available keys listed in error message:\n${result.stderr}`,
		);
	});
});
