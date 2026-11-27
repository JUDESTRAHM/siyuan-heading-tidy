import test from "node:test"; import assert from "node:assert/strict"; import Module from "node:module"; import path from "node:path";
const Orig = Module._load;
class Plugin { constructor(){ this.i18n={title:"t"}; this.bars=[]; } async loadData(){return {};} async saveData(){} addTopBar(o){ this.bars.push(o); } addCommand(){} }
test("plugin loads against mocked siyuan API and applies level changes through kramdown + updateBlock", async () => {
	Module._load = function (r, ...a) { return r === "siyuan" ? { Plugin, Dialog: class {}, showMessage() {}, confirm() {}, getFrontend: () => "desktop", getActiveEditor: () => ({ protyle: { block: { rootID: "root1" } } }) } : Orig.call(this, r, ...a); };
	const calls = [];
	globalThis.fetch = async (p, o) => { const b = JSON.parse(o.body); calls.push([p, b]); let data = null;
		if (p.endsWith("getDocOutline")) data = [{ id: "a", subType: "h1", name: "Intro", blocks: [{ id: "b", subType: "h3", content: "Long sentence here." }] }];
		if (p.endsWith("getBlockKramdown")) data = { kramdown: "### Long sentence here.\n{: id=\"b\"}" };
		return { json: async () => ({ code: 0, data }) }; };
	const { createRequire } = await import("node:module"); const P = createRequire(import.meta.url)(path.resolve("index.js"));
	const p = new P(); await p.onload(); assert.equal(p.bars.length, 1); assert.equal(p.licensed, false); assert.equal(p.currentDocId(), "root1");
	const heads = await p.load("root1"); assert.deepEqual(heads.map((h) => h.level), [1, 3]);
	assert.equal(await p.apply([{ id: "b", to: 0 }]), 1);
	const upd = calls.find((c) => c[0].endsWith("updateBlock"))[1]; assert.equal(upd.id, "b"); assert.equal(upd.data, "Long sentence here.\n{: id=\"b\"}");
	Module._load = Orig;
});
