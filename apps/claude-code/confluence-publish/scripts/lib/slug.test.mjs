import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify } from "./slug.mjs";

test("plain ASCII title", () => assert.equal(slugify("My Page Title"), "my-page-title"));
test("strips diacritics", () => assert.equal(slugify("Perfil de l'usuari"), "perfil-de-l-usuari"));
test("collapses repeated separators", () => assert.equal(slugify("a   b///c"), "a-b-c"));
test("trims leading/trailing dashes", () => assert.equal(slugify("--Hello--"), "hello"));
test("CJK only returns empty", () => assert.equal(slugify("漢字"), ""));
test("emoji only returns empty", () => assert.equal(slugify("🚀✨"), ""));
test("null returns empty", () => assert.equal(slugify(null), ""));
test("undefined returns empty", () => assert.equal(slugify(undefined), ""));
test("truncates at 60 chars", () => {
	const out = slugify("a".repeat(80));
	assert.equal(out.length, 60);
	assert.ok(!out.endsWith("-"));
});
test("no trailing dash after truncation at word boundary", () => {
	const out = slugify(`${"x".repeat(58)}    ${"y".repeat(10)}`);
	assert.ok(!out.endsWith("-"));
	assert.ok(out.length <= 60);
});
