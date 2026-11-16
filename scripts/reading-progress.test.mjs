import assert from "node:assert/strict";
import test from "node:test";
import { readingProgress } from "../src/utils/reading-progress.ts";

test("reading progress follows the article rather than comments or the footer", () => {
	assert.equal(readingProgress(240, 2000, 800), 0);
	assert.equal(readingProgress(80, 2000, 800), 0);
	assert.equal(readingProgress(-560, 2000, 800), 50);
	assert.equal(readingProgress(-1200, 2000, 800), 100);
	assert.equal(readingProgress(-2400, 2000, 800), 100);
});

test("short articles finish when their bottom is visible without dividing by zero", () => {
	assert.equal(readingProgress(500, 400, 800), 0);
	assert.equal(readingProgress(300, 400, 800), 100);
	assert.equal(readingProgress(80, 720, 800), 100);
	assert.equal(readingProgress(80, 0, 800), 100);
});

test("progress adapts to resized content and mobile viewports", () => {
	assert.equal(readingProgress(-560, 3280, 800), 25);
	assert.equal(readingProgress(-720, 2000, 480), 50);
});
