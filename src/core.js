// Pure logic for Heading Tidy. No SiYuan or DOM access here, so it can be tested in node.
const END_PUNCT = /[。.!?！？;；,，、:：]$/;
const KEEP_WINDOW = 8;
const DEFAULTS = { maxLen: 40, keep: "章,节,题,Chapter,Section,Part" };

function decode(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
function levelOf(sub) { const m = /^h([1-6])$/.exec(String(sub || "")); return m ? +m[1] : 0; }

// Flatten the tree returned by /api/outline/getDocOutline into document order.
// Each node carries subType (h1..h6) and either `name` (top level) or `content`; children live in `blocks` and/or `children`.
function flattenOutline(nodes) {
	const out = [];
	const walk = (n) => {
		if (!n || !n.id) return;
		const level = levelOf(n.subType);
		if (level) out.push({ id: n.id, level, text: decode(n.content != null && n.content !== "" ? n.content : n.name) });
		for (const k of ["blocks", "children"]) if (Array.isArray(n[k])) n[k].forEach(walk);
	};
	(nodes || []).forEach(walk);
	return out;
}

function parseKeep(s) {
	return String(s || "").split(/[,，\n]/).map((x) => x.trim()).filter(Boolean).map((x) => {
		const m = /^\/(.+)\/([a-z]*)$/.exec(x);
		if (m) { try { return new RegExp(m[1], m[2] || "i"); } catch (e) { /* fall through to plain text */ } }
		return x.toLowerCase();
	});
}
function isKept(text, keep) {
	// Plain words only count near the start (a chapter label), so a body sentence that merely contains "题" is not protected.
	const t = String(text).toLowerCase().slice(0, KEEP_WINDOW);
	return keep.some((k) => (k instanceof RegExp ? k.test(text) : t.includes(k)));
}

// Annotate headings: sentence-like (ends with punctuation or too long), kept (matches an exception), skipped level, empty.
function analyze(headings, opts) {
	const o = Object.assign({}, DEFAULTS, opts || {});
	const keep = parseKeep(o.keep);
	let prev = 0;
	return headings.map((h) => {
		const text = h.text || "";
		const len = Array.from(text).length;
		const sentence = len > 0 && (END_PUNCT.test(text) || len > o.maxLen);
		const kept = sentence && isKept(text, keep);
		const skipped = prev > 0 && h.level > prev + 1;
		prev = h.level;
		return Object.assign({}, h, { len, empty: len === 0, sentence, kept, skipped, suggest: sentence && !kept });
	});
}

// Level fixes after removing `drop` ids (converted to paragraphs): the first heading becomes h1 and none may be more than one level deeper than the one before it.
function fixLevels(headings, drop) {
	const dropSet = new Set(drop || []);
	const changes = [];
	let prev = 0;
	for (const h of headings) {
		if (dropSet.has(h.id)) continue;
		let to = h.level;
		if (prev === 0) to = 1;
		else if (to > prev + 1) to = prev + 1;
		if (to !== h.level) changes.push({ id: h.id, from: h.level, to });
		prev = to;
	}
	return changes;
}

// Shift every heading by delta (e.g. -1 promotes h2->h1). Headings that would leave 1..6 are reported, not changed.
function shift(headings, delta, drop) {
	const dropSet = new Set(drop || []);
	const changes = [], blocked = [];
	for (const h of headings) {
		if (dropSet.has(h.id)) continue;
		const to = h.level + delta;
		if (to < 1 || to > 6) blocked.push(h.id); else changes.push({ id: h.id, from: h.level, to });
	}
	return { changes, blocked };
}

// Turn a heading's kramdown into a paragraph (level 0) or another level. Keeps inline formatting and the {: id=...} attribute line.
function retitle(kramdown, level) {
	const s = String(kramdown);
	const m = /^(#{1,6})[ \t]+/.exec(s);
	if (!m) return null;
	return (level ? "#".repeat(level) + " " : "") + s.slice(m[0].length);
}

function summary(analyzed) {
	return {
		total: analyzed.length,
		suggest: analyzed.filter((h) => h.suggest).length,
		skipped: analyzed.filter((h) => h.skipped).length,
		empty: analyzed.filter((h) => h.empty).length,
	};
}

module.exports = { DEFAULTS, decode, levelOf, flattenOutline, parseKeep, isKept, analyze, fixLevels, shift, retitle, summary };
