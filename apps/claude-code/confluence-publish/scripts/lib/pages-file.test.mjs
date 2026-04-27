import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	appendAlias,
	findAliasForId,
	listAliases,
	pickAvailableAlias,
	readPagesFile,
	writePagesFile,
} from "./pages-file.mjs";

test("findAliasForId skips _comment and non-numbers", () => {
	const pages = { _comment: "x", foo: 111, bar: "not-a-number", baz: 222 };
	assert.equal(findAliasForId(pages, 222), "baz");
	assert.equal(findAliasForId(pages, 999), null);
});

test("pickAvailableAlias returns base when free", () => {
	assert.equal(pickAvailableAlias({}, "foo", 42), "foo");
});

test("pickAvailableAlias appends -2 then -3 on collision", () => {
	const pages = { foo: 1, "foo-2": 2 };
	assert.equal(pickAvailableAlias(pages, "foo", 9), "foo-3");
});

test("pickAvailableAlias falls back to page-<id> on empty slug", () => {
	assert.equal(pickAvailableAlias({}, "", 555), "page-555");
});

test("appendAlias preserves _comment-first ordering", () => {
	const pages = { _comment: "x", a: 1, b: 2 };
	const out = appendAlias(pages, "c", 3);
	assert.deepEqual(Object.keys(out), ["_comment", "a", "b", "c"]);
	assert.equal(out.c, 3);
});

test("writePagesFile produces 2-space indent with trailing newline", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "pages-"));
	const p = path.join(dir, "confluence-pages.json");
	writePagesFile(p, { foo: 1 });
	assert.equal(readFileSync(p, "utf8"), '{\n  "foo": 1\n}\n');
	rmSync(dir, { recursive: true, force: true });
});

test("readPagesFile returns existed=false when absent", () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "pages-"));
	const out = readPagesFile(dir);
	assert.equal(out.existed, false);
	assert.deepEqual(out.pages, {});
	rmSync(dir, { recursive: true, force: true });
});

test("listAliases sorts alphabetically and filters _comment and non-numbers", () => {
	const pages = { _comment: "x", zoo: 3, alpha: 1, beta: "no" };
	assert.deepEqual(listAliases(pages), [
		["alpha", 1],
		["zoo", 3],
	]);
});
