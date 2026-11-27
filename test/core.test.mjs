import test from "node:test"; import assert from "node:assert/strict"; import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../src/core.js");
const H = (arr) => arr.map(([level, text], i) => ({ id: "h" + i, level, text }));

test("flattenOutline keeps document order across top-level blocks and children", () => {
	const tree = [
		{ id: "a", subType: "h1", name: "A&nbsp;one", blocks: [{ id: "b", subType: "h2", content: "B", children: [{ id: "c", subType: "h4", content: "C" }] }, { id: "d", subType: "h2", content: "D" }] },
		{ id: "e", subType: "h1", name: "E" },
	];
	const f = core.flattenOutline(tree);
	assert.deepEqual(f.map((x) => x.id), ["a", "b", "c", "d", "e"]);
	assert.deepEqual(f.map((x) => x.level), [1, 2, 4, 2, 1]);
	assert.equal(f[0].text, "A one"); assert.equal(core.decode("Short <span data-type=\"strong\">bold</span> title"), "Short bold title");
});
test("analyze flags sentence-like headings by ending punctuation and length, with exceptions", () => {
	const a = core.analyze(H([[1, "第一章 总则"], [2, "这是一段很长的句子。"], [2, "Short title"], [2, "x".repeat(50)], [2, "第三节 方法。"], [2, "Hello, world."]]), { maxLen: 40, keep: "章,节" });
	assert.deepEqual(a.map((h) => h.suggest), [false, true, false, true, false, true]);
	assert.equal(a[4].kept, true); assert.equal(a[4].sentence, true);
});
test("keep list supports plain words and /regex/", () => {
	const k = core.parseKeep("Chapter, /^Q\\d+/");
	assert.equal(core.isKept("chapter 2.", k), true); assert.equal(core.isKept("这是很长的正文，其实是题目的说明。", core.parseKeep("题")), false, "plain words only match near the start"); assert.equal(core.isKept("Q3 recap.", k), true); assert.equal(core.isKept("random.", k), false);
	assert.equal(core.parseKeep("/(/").length, 1, "bad regex falls back to plain text, no throw");
});
test("analyze flags skipped levels and empties", () => {
	const a = core.analyze(H([[1, "A"], [3, "B"], [2, "C"], [4, "D"]]));
	assert.deepEqual(a.map((h) => h.skipped), [false, true, false, true]);
	assert.equal(core.analyze(H([[2, ""]]))[0].empty, true);
});
test("fixLevels closes gaps, treating dropped headings as removed", () => {
	const hs = H([[1, "A"], [4, "para-ish"], [3, "B"], [6, "C"]]);
	assert.deepEqual(core.fixLevels(hs, ["h1"]), [{ id: "h2", from: 3, to: 2 }, { id: "h3", from: 6, to: 3 }]);
	assert.deepEqual(core.fixLevels(hs), [{ id: "h1", from: 4, to: 2 }, { id: "h3", from: 6, to: 4 }]);
	assert.deepEqual(core.fixLevels(H([[3, "first"], [3, "x"]])), [{ id: "h0", from: 3, to: 1 }, { id: "h1", from: 3, to: 2 }]);
	assert.deepEqual(core.fixLevels(H([[1, "A"], [2, "B"]])), []);
});
test("shift clamps to 1..6 and reports blocked", () => {
	const r = core.shift(H([[1, "A"], [2, "B"], [6, "C"]]), -1);
	assert.deepEqual(r.blocked, ["h0"]); assert.deepEqual(r.changes.map((c) => c.to), [1, 5]);
	assert.deepEqual(core.shift(H([[6, "x"]]), 1).blocked, ["h0"]);
	assert.deepEqual(core.shift(H([[1, "A"], [2, "B"]]), 1, ["h0"]).changes, [{ id: "h1", from: 2, to: 3 }]);
});
test("retitle converts level or strips to paragraph and keeps the attribute line", () => {
	const kd = "## Some **bold** text\n{: id=\"20261127053436-abc\" updated=\"1\"}";
	assert.equal(core.retitle(kd, 0), "Some **bold** text\n{: id=\"20261127053436-abc\" updated=\"1\"}");
	assert.equal(core.retitle(kd, 3), "### Some **bold** text\n{: id=\"20261127053436-abc\" updated=\"1\"}");
	assert.equal(core.retitle("plain", 2), null);
});
test("summary counts", () => {
	const s = core.summary(core.analyze(H([[1, "A"], [3, "Long one."]])));
	assert.deepEqual(s, { total: 2, suggest: 1, skipped: 1, empty: 0 });
});
