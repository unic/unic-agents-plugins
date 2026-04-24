import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripFrontmatter } from "./frontmatter.mjs";

describe("stripFrontmatter", () => {
	it("returns content unchanged when no frontmatter", () => {
		const input = "# Hello\n\nSome content.\n";
		assert.strictEqual(stripFrontmatter(input), input);
	});

	it("strips a minimal 1-field frontmatter block", () => {
		const input = "---\ntitle: Foo\n---\nBody\n";
		assert.strictEqual(stripFrontmatter(input), "Body\n");
	});

	it("strips a 2-field frontmatter block", () => {
		const input = "---\ntitle: My Doc\ndate: 2026-01-01\n---\n# Hello\n\nContent.\n";
		assert.strictEqual(stripFrontmatter(input), "# Hello\n\nContent.\n");
	});

	it("strips CRLF frontmatter", () => {
		const input = "---\r\ntitle: Doc\r\ndate: 2026\r\n---\r\nBody\n";
		assert.strictEqual(stripFrontmatter(input), "Body\n");
	});

	it("preserves --- HR in body after valid frontmatter", () => {
		const input = "---\ntitle: Doc\n---\n# Section 1\n\nText.\n\n---\n\n# Section 2\n";
		assert.strictEqual(stripFrontmatter(input), "# Section 1\n\nText.\n\n---\n\n# Section 2\n");
	});

	it("does not strip when frontmatter has no closing ---", () => {
		const input = "---\ntitle: Doc\ndate: 2026\n\n# Body\n\nContent here.\n";
		assert.strictEqual(stripFrontmatter(input), input);
	});

	it("does not strip when frontmatter exceeds 50 fields (cap exceeded)", () => {
		const fields = Array.from({ length: 51 }, (_, i) => `key${i}: value${i}`).join("\n");
		const input = `---\n${fields}\n---\nBody\n`;
		assert.strictEqual(stripFrontmatter(input), input);
	});

	it("strips frontmatter with exactly 50 fields", () => {
		const fields = Array.from({ length: 50 }, (_, i) => `key${i}: value${i}`).join("\n");
		const input = `---\n${fields}\n---\nBody\n`;
		assert.strictEqual(stripFrontmatter(input), "Body\n");
	});

	it("returns empty string when frontmatter covers whole content", () => {
		const input = "---\ntitle: Only Frontmatter\n---\n";
		assert.strictEqual(stripFrontmatter(input), "");
	});
});
