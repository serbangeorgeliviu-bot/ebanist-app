/* Numele corpurilor din proiectele demo se traduc în limba aplicației (ebanist-demo.js: bodyName/renameBodies).   node --test demo-names.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = {}; ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-demo.js"), "utf8"), ctx, { filename: "ebanist-demo.js" });
const D = ctx.EBDemo, LANGS = ["ro", "it", "en", "fr", "de", "pl", "es"];
const load = id => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "demo", id + ".json"), "utf8"));

for (const id of ["living", "kitchen", "bedroom"]) for (const lang of LANGS) {
  test(`demo ${id} / ${lang}: numele corpurilor sunt traduse și coerente`, () => {
    const j = load(id), p = D.prepare(j, { lang });
    const keys = Object.keys(p.configs), old = Object.keys(j.configs);
    assert.equal(keys.length, old.length);
    assert.equal(new Set(keys).size, keys.length, "nume unice");
    for (const k of keys) assert.equal(p.configs[k].name, k, "cfg.name = cheia");
    for (const x of p.pieces) { assert.ok(x.modulo in p.configs || x.modulo.replace(/ [AB]$/, "") in p.configs || (p.worktops || []).some(w => (w.names || []).includes(x.modulo)), "modulo " + x.modulo); }
    for (const w of p.worktops || []) for (const n of w.mods) assert.ok(n in p.configs, "blat: " + n);
    assert.deepEqual(Object.keys(p.layout || {}).sort(), keys.filter(k => k in p.layout).sort(), "layout pe aceleași nume");
    assert.equal(Object.keys(p.layout || {}).length, Object.keys(j.layout || {}).length);
    /* nicio piesă, cheie sau layout nu mai poartă numele vechi când limba îl schimbă */
    const chg = old.filter(k => D.bodyName(k, lang) !== k);
    for (const k of chg) assert.ok(!(k in p.configs) && !(k in (p.layout || {})) && !p.pieces.some(x => x.modulo === k) && !JSON.stringify(p).includes(JSON.stringify(k).slice(1, -1)), "a rămas: " + k);
    /* aceeași distinctă: numai numele diferă */
    const sig = q => q.pieces.map(x => [x.elemento, x.lung, x.larg, x.pz, x.materiale].join("|")).join("\n");
    assert.equal(sig(p), sig(j));
  });
}
test("demo living: fără amestec ro/en în engleză și italiană", () => {
  const en = Object.keys(D.prepare(load("living"), { lang: "en" }).configs).join("|");
  const it = Object.keys(D.prepare(load("living"), { lang: "it" }).configs).join("|");
  assert.ok(!/Clapă|Sertare|Raft|Vitrină|Lambriu|uși/.test(en), en);
  assert.ok(!/Clapă|Console|Desk|flap|Raft|Sertare\b.*Free/.test(it.replace(/Free flap/g, "")), it);
  assert.ok(/R1 Scrivania/.test(it) && /R1 Desk/.test(en));
});
test("demo: fiecare nume din JSON are traducere (sau e fără intrare, intenționat)", () => {
  for (const id of ["living", "kitchen", "bedroom"]) for (const k of Object.keys(load(id).configs))
    assert.ok(LANGS.every(l => D.bodyName(k, l) !== k || l === "en" || l === "ro") || k === "D3 Free flap", "fără traducere: " + k);
});
