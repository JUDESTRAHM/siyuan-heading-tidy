const { Plugin, Dialog, showMessage, confirm, getFrontend, getActiveEditor, getAllEditor } = require("siyuan");
const core = require("./core.js");
const { verifyLicense } = require("./license.js");
const PLUGIN_ID = "siyuan-heading-tidy";
const PRO_ENABLED = false; // free plugin; Pro code path kept off and unfunded
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function api(path, body) {
	const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
	const j = await r.json();
	if (j.code !== 0) throw new Error(j.msg || "SiYuan API error " + j.code);
	return j.data;
}

module.exports = class HeadingTidy extends Plugin {
	async onload() {
		const d = (await this.loadData("settings.json")) || {};
		this.cfg = Object.assign({ license: "", maxLen: core.DEFAULTS.maxLen, keep: core.DEFAULTS.keep }, d);
		this.licensed = PRO_ENABLED && !!verifyLicense(this.cfg.license, PLUGIN_ID);
		this.addTopBar({ icon: "iconList", title: this.i18n.title, position: "right", callback: () => this.openDialog() });
		this.addCommand({ langKey: "open", hotkey: "", callback: () => this.openDialog() });
	}

	currentDocId() {
		try {
			const ed = (typeof getActiveEditor === "function" && getActiveEditor()) || (typeof getAllEditor === "function" && getAllEditor()[0]);
			return ed && ed.protyle && ed.protyle.block && ed.protyle.block.rootID;
		} catch (e) { return null; }
	}

	// Headings of one document in document order, with clean text from the SQL index.
	async load(rootId) {
		const tree = (await api("/api/outline/getDocOutline", { id: rootId })) || [];
		const flat = core.flattenOutline(tree);
		return flat;
	}
	async setLevel(id, level) {
		const k = await api("/api/block/getBlockKramdown", { id });
		const kd = core.retitle(k.kramdown, level);
		if (kd == null) return false;
		await api("/api/block/updateBlock", { dataType: "markdown", data: kd, id });
		return true;
	}
	async apply(changes) {
		let n = 0;
		for (const c of changes) { if (await this.setLevel(c.id, c.to)) n++; }
		return n;
	}

	async openDialog() {
		const t = this.i18n;
		const rootId = this.currentDocId();
		if (!rootId) { showMessage(t.noDoc, 5000, "error"); return; }
		const d = new Dialog({ title: t.title, width: /mobile/.test(getFrontend()) ? "96vw" : "760px", content: `<div class="b3-dialog__content" id="ht-body" style="max-height:74vh;overflow:auto">${esc(t.scanning)}</div>` });
		const body = d.element.querySelector("#ht-body");
		try {
			const heads = await this.load(rootId);
			let opts = { maxLen: +this.cfg.maxLen || core.DEFAULTS.maxLen, keep: this.cfg.keep };
			const picked = new Set();
			let seeded = false;
			const render = () => {
				const a = core.analyze(heads, opts);
				if (!seeded) { a.forEach((h) => h.suggest && picked.add(h.id)); seeded = true; }
				const s = core.summary(a);
				let h = `<div style="opacity:.85">${esc(t.summary.replace("{t}", s.total).replace("{s}", s.suggest).replace("{k}", s.skipped))}</div><div style="opacity:.6;font-size:12px;margin:2px 0 8px">${esc(t.help)}</div>`;
				h += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><label>${esc(t.maxLen)} <input id="ht-max" class="b3-text-field" type="number" min="5" max="500" style="width:70px" value="${opts.maxLen}"></label>` +
					`<label class="fn__flex-1">${esc(t.keep)} <input id="ht-keep" class="b3-text-field" style="width:60%" value="${esc(opts.keep)}"></label></div>`;
				h += a.map((x) => {
					const tag = x.suggest ? t.tagSentence : x.kept ? t.tagKept : x.skipped ? t.tagSkipped : x.empty ? t.tagEmpty : "";
					return `<div class="b3-list-item" style="display:flex;gap:8px;align-items:center;padding:3px 4px;padding-left:${4 + (x.level - 1) * 14}px"><input type="checkbox" class="b3-switch" data-pick="${esc(x.id)}"${picked.has(x.id) ? " checked" : ""}><span style="opacity:.55;min-width:22px">h${x.level}</span><span class="fn__flex-1" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.text)}">${esc(x.text) || "&nbsp;"}</span>${tag ? `<span style="font-size:12px;opacity:.75">${esc(tag)}</span>` : ""}</div>`;
				}).join("");
				h += `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="b3-button b3-button--outline" id="ht-para">${esc(t.toPara.replace("{n}", picked.size))}</button>` +
					`<button class="b3-button b3-button--outline" id="ht-fix"${s.skipped || picked.size ? "" : " disabled"}>${esc(t.fixLevels)}</button>` +
					`<button class="b3-button b3-button--outline" id="ht-up">${esc(t.promote)}</button><button class="b3-button b3-button--outline" id="ht-down">${esc(t.demote)}</button></div>` +
					`<div style="font-size:12px;opacity:.6;margin-top:6px">${esc(t.undoNote)}</div>`;
				body.innerHTML = h;
				body.querySelector("#ht-max").addEventListener("change", async (e) => { opts.maxLen = Math.max(5, +e.target.value || core.DEFAULTS.maxLen); this.cfg.maxLen = opts.maxLen; await this.saveData("settings.json", this.cfg); seeded = false; picked.clear(); render(); });
				body.querySelector("#ht-keep").addEventListener("change", async (e) => { opts.keep = e.target.value; this.cfg.keep = opts.keep; await this.saveData("settings.json", this.cfg); seeded = false; picked.clear(); render(); });
			};
			const run = (msg, plan) => confirm(t.title, msg, async () => {
				try { const n = await this.apply(plan); showMessage(t.done.replace("{n}", n)); d.destroy(); setTimeout(() => this.openDialog(), 1200); }
				catch (err) { showMessage(String(err.message || err), 6000, "error"); }
			});
			body.addEventListener("change", (e) => { const c = e.target.closest && e.target.closest("[data-pick]"); if (!c) return; c.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick); body.querySelector("#ht-para").textContent = t.toPara.replace("{n}", picked.size); });
			body.addEventListener("click", (e) => {
				const b = e.target.closest && e.target.closest("button"); if (!b) return;
				const drop = [...picked];
				if (b.id === "ht-para") {
					if (!drop.length) return;
					run(t.confirmPara.replace("{n}", drop.length), drop.map((id) => ({ id, to: 0 })));
				} else if (b.id === "ht-fix") {
					const plan = core.fixLevels(heads.filter((x) => x), drop);
					const paras = drop.map((id) => ({ id, to: 0 }));
					run(t.confirmFix.replace("{n}", plan.length).replace("{p}", paras.length), paras.concat(plan));
				} else if (b.id === "ht-up" || b.id === "ht-down") {
					const r = core.shift(heads, b.id === "ht-up" ? -1 : 1);
					if (r.blocked.length) { showMessage(t.blocked.replace("{n}", r.blocked.length), 6000, "error"); return; }
					run(t.confirmShift.replace("{n}", r.changes.length), r.changes);
				}
			});
			render();
		} catch (e) { body.textContent = String(e.message || e); }
	}
};
