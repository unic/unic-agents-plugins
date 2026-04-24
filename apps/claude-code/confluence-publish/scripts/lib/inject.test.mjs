import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { injectContent } from "./inject.mjs";

describe("injectContent — strategy 1: plain-text markers", () => {
	it("replaces content between matching markers", () => {
		const body =
			"<p>[AUTO_INSERT_START: docs]</p>\n<p>old content</p>\n<p>[AUTO_INSERT_END: docs]</p>";
		const result = injectContent(body, "<p>new content</p>", "Test Page");
		assert.ok(result.includes("<p>new content</p>"), "new content present");
		assert.ok(!result.includes("old content"), "old content removed");
		assert.ok(result.includes("[AUTO_INSERT_START: docs]"), "start marker preserved");
		assert.ok(result.includes("[AUTO_INSERT_END: docs]"), "end marker preserved");
	});

	it("preserves content outside the markers", () => {
		const body =
			"<p>before</p>\n<p>[AUTO_INSERT_START: docs]</p>\n<p>old</p>\n<p>[AUTO_INSERT_END: docs]</p>\n<p>after</p>";
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("<p>before</p>"), "content before marker preserved");
		assert.ok(result.includes("<p>after</p>"), "content after marker preserved");
	});

	it("handles markers without surrounding <p> tags", () => {
		const body = "[AUTO_INSERT_START: raw]\nold\n[AUTO_INSERT_END: raw]";
		const result = injectContent(body, "new", "Test");
		assert.ok(result.includes("new"), "new content present");
		assert.ok(!result.includes("old"), "old content removed");
	});

	// Mismatched label test is skipped until spec 15 replaces process.exit with CliError.
	// Once CliError is in place, rewrite as:
	//   assert.throws(() => injectContent(body, html, title), /label mismatch/);
	it.skip("exits 1 on mismatched marker labels — enable after spec 15 CliError", () => {});
});

describe("injectContent — strategy 2: anchor macros", () => {
	const anchorStart =
		'<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-start</ac:parameter></ac:structured-macro>';
	const anchorEnd =
		'<ac:structured-macro ac:name="anchor"><ac:parameter ac:name="">md-end</ac:parameter></ac:structured-macro>';

	it("replaces content between anchor macros", () => {
		const body = `<p>before</p>${anchorStart}<p>old</p>${anchorEnd}<p>after</p>`;
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("<p>new</p>"), "new content present");
		assert.ok(!result.includes("<p>old</p>"), "old content removed");
		assert.ok(result.includes("<p>before</p>"), "before preserved");
		assert.ok(result.includes("<p>after</p>"), "after preserved");
	});

	it("preserves the anchor macros themselves", () => {
		const body = `${anchorStart}<p>old</p>${anchorEnd}`;
		const result = injectContent(body, "<p>new</p>", "Test");
		assert.ok(result.includes("md-start"), "start anchor macro preserved");
		assert.ok(result.includes("md-end"), "end anchor macro preserved");
	});
});

describe("injectContent — strategy 3: replace-all", () => {
	it("replaces full body when replaceAll=true (dryRun=true skips backup)", () => {
		const result = injectContent("<p>existing</p>", "<p>new</p>", "Test", { replaceAll: true, dryRun: true });
		assert.strictEqual(result, "<p>new</p>");
	});

	it("replaces full body even when existing body is empty", () => {
		const result = injectContent("", "<p>only</p>", "Test", { replaceAll: true, dryRun: true });
		assert.strictEqual(result, "<p>only</p>");
	});
});
