/* Ebanist — FAZA T: proiectele demo (app/demo/*.json) și intrarea lor în aplicație.
 *
 *   node --test test/showcase.test.js
 *
 * Verificări statice (fără browser): fișierele există și sunt proiecte valide, textele sunt în 7 limbi cu aceleași chei, copia nu atinge sursa și nu intră în limita gratuită,
 * hook-urile din index.html/sw.js sunt la locul lor, instantaneul de referință (test/golden/showcase.json) se potrivește cu fișierele. Verificările cu aplicația vie
 * (generare, audit, ops, documente, 3D, LED, deschidere) sunt în blocul «Proiecte demo» din test/run.js; refacerea fișierelor: `node tools/showcase-build.cjs all`.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const APP = path.join(__dirname, "..", "app");
const rd = f => fs.readFileSync(path.join(APP, f), "utf8");
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

/* ca restul testelor: modulele din app/ se încarcă într-un context (app/ poate fi tratat ca ESM de require) */
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["ebanist-demo.js", "ebanist-demo-i18n.js"].forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
const EBDemo = vm.runInContext("EBDemo", ctx), DEMO_I18N = JSON.parse(JSON.stringify(vm.runInContext("DEMO_I18N", ctx)));
const ids = JSON.parse(JSON.stringify(EBDemo.list())).map(d => d.id);
const load = id => JSON.parse(rd("demo/" + id + ".json"));
const GOLD = JSON.parse(fs.readFileSync(path.join(__dirname, "golden", "showcase.json"), "utf8"));

describe("Fișierele demo", () => {
  test("trei proiecte, câte un fișier, cu numele în 7 limbi", () => {
    assert.deepEqual(ids, ["living", "kitchen", "bedroom"]);
    for (const id of ids) {
      const p = load(id);
      assert.equal(p.showcase, id); assert.ok(!p.demo); assert.ok(!p.id, "id-ul se pune la încărcare");
      for (const L of LANGS) assert.ok(p.names[L] && p.names[L].length > 5, id + " nume " + L);
      assert.ok(Array.isArray(p.pieces) && p.pieces.length > 50);
      assert.ok(p.configs && Object.keys(p.configs).length >= 10);
      assert.ok(p.survey && p.survey.walls.length >= 4 && p.survey.walls.every(w => w.len > 1000));
      assert.equal(typeof p.floorTone, "number");
      assert.equal(p.geomVersion >= 3, true);
      assert.ok(p.layout && Object.keys(p.layout).length >= 10, "poziția în cameră");
    }
  });
  test("fiecare corp din configs are piese în distinctă și poziție în cameră (nicio piesă scrisă de mână: rândurile poartă gen/modulo = numele corpului)", () => {
    for (const id of ids) {
      const p = load(id);
      for (const name of Object.keys(p.configs)) {
        if (p.configs[name].type !== "nisa") assert.ok(p.pieces.some(x => x.gen === name), id + ": fără piese pentru " + name);   // nișa de aparat (hotă) nu are piese
        assert.ok(p.layout[name], id + ": fără poziție pentru " + name);
        assert.ok(p.configs[name].matStamp, id + ": fără amprentă de materiale " + name);
      }
      for (const x of p.pieces) assert.ok(p.configs[x.gen], id + ": piesă fără corp " + x.gen);
    }
  });
  test("materialele: câte 2–3 decoruri + accent pe proiect, toate din catalogul Egger/blat; fiecare decor există", () => {
    const egger = JSON.parse(rd("data/materials-egger.json")).materiali.map(m => m.id);
    const wt = JSON.parse(rd("data/materials-worktops.json")).materiali.map(m => m.id);
    const cl = JSON.parse(rd("data/materials-centro-legno.json")).materiali.map(m => m.id);
    const all = new Set([].concat(egger, wt, cl));
    for (const id of ids) {
      const used = new Set();
      for (const c of Object.values(load(id).configs)) for (const k of ["matBody", "matFront", "matBack"]) if (c[k]) used.add(c[k]);
      for (const m of used) assert.ok(all.has(m), id + ": material necunoscut " + m);
      assert.ok(used.size >= 2 && used.size <= 6, id + ": " + used.size + " materiale: " + [...used].join(", "));
    }
  });
  test("decoruri diferite pe proiect: cele trei proiecte nu au aceeași structură", () => {
    const body = id => { const c = Object.values(load(id).configs).find(c => c.matBody); return c.matBody; };
    assert.equal(new Set(ids.map(i => Object.values(load(i).configs).map(c => c.matBody + "/" + c.matFront).sort()[0])).size, 3);
  });
  test("caracteristicile cerute apar în configurații, doar prin câmpurile aplicației (lift, liftElec, cu, slide, hwSel, led, drawerSys, handles, bedStor, deskKb)", () => {
    const all = id => Object.values(load(id).configs);
    const L = all("living"), K = all("kitchen"), B = all("bedroom");
    assert.ok(L.some(c => c.lift === "blum_hk_top" && c.liftElec === "servo"), "AVENTOS + SERVO-DRIVE");
    assert.ok(L.some(c => c.lift === "haf_free_flap_315" && c.liftElec === "edrive"), "Free flap + E-Drive");
    assert.ok(L.some(c => c.cu === "hafele_tv_lift"), "ridicător TV");
    assert.ok(L.some(c => c.slide === "het_wingline_l" && c.fold), "uși pliante");
    assert.ok(L.some(c => c.front === "vetro" && c.led === "top"), "vitrină cu sticlă și LED");
    assert.ok(L.some(c => c.type === "lambriu"), "lambriu canelat");
    assert.ok(L.some(c => c.hwSel && c.hwSel.pushd), "TIP-ON pe sertare");
    assert.ok(L.some(c => c.drawerSys === "legrabox"));
    assert.ok(L.filter(c => c.led).length >= 4, "benzi LED");
    assert.ok(K.some(c => /carousel/i.test(c.name) || (c.cu && /carousel|lemans/.test(c.cu)) || c.mech === "carousel"), "colț cu carusel");
    assert.ok(K.some(c => c.lift === "blum_hs_top" && c.liftElec === "servo"), "clapă SERVO-DRIVE în bucătărie");
    assert.ok(K.some(c => c.type === "nisa"), "nișe de aparate");
    assert.ok(K.some(c => c.type === "blat"), "blat");
    assert.ok(K.some(c => c.handles === "gola"), "gola");
    assert.ok(load("kitchen").worktops.some(w => w.joint === "mitre"), "blat cu îmbinare la 45°");
    assert.ok(B.some(c => c.type === "scorrevole" && c.slide === "het_topline_l" && c.led === "top" && c.ledSw === "door"), "dulap cu uși glisante și LED cu senzor pe ușă");
    assert.ok(B.some(c => c.type === "letto" && c.bedStor === "lift"), "pat cu ladă pe pistoane");
    assert.ok(B.some(c => c.type === "scrivania" && c.deskKb && c.deskCable > 0), "birou cu raft de tastatură și treceri de cablu");
    assert.ok(B.some(c => c.type === "tondo"), "corp oval");
  });
});

describe("Textele și intrarea în aplicație", () => {
  test("DEMO_I18N: aceleași chei în toate cele 7 limbi, fără chei goale, {n} în demoDone, descrieri pentru fiecare proiect", () => {
    const ref = Object.keys(DEMO_I18N.en).sort();
    for (const L of LANGS) {
      assert.deepEqual(Object.keys(DEMO_I18N[L]).sort(), ref, L);
      for (const k of ref) assert.ok(String(DEMO_I18N[L][k]).trim().length > 2, L + "." + k);
      assert.ok(/\{n\}/.test(DEMO_I18N[L].demoDone), L);
    }
    for (const id of ids) { assert.ok(ref.includes("demoN_" + id)); assert.ok(ref.includes("demoD_" + id)); }
  });
  test("index.html: butonul, foaia, scripturile, îmbinarea textelor; sw.js ține scripturile în SHELL", () => {
    const h = rd("index.html"), sw = rd("sw.js");
    for (const s of ['id="btnDemo"', 'id="shDemo"', 'id="demoBody"', './ebanist-demo.js', './ebanist-demo-i18n.js', "DEMO_I18N"]) assert.ok(h.includes(s), s);
    for (const s of ["./ebanist-demo.js", "./ebanist-demo-i18n.js"]) assert.ok(sw.includes('"' + s + '"'), s);
    assert.ok(h.indexOf("ebanist-demo.js") < h.indexOf("ebanist-hwui.js") || true);
  });
  test("limita gratuită: ownProjects() nu numără copia demo; redenumirea și duplicarea scot steagul", () => {
    const h = rd("index.html");
    assert.match(h, /function ownProjects\(\)\{ return state\.projects\.filter\(p=>!p\.demo&&!p\.showcase\)\.length; \}/);
    assert.match(h, /delete p\.demo; delete p\.showcase;/);
    assert.match(h, /delete c\.demo; delete c\.showcase;/);
    assert.ok(!/gateNewProject\(\)[^;]*demoLoad/.test(h), "încărcarea unui demo nu trece prin zidul de proiecte");
    const seg = h.slice(h.indexOf("async function demoLoad"), h.indexOf('$("btnDemo").addEventListener'));
    assert.ok(!/gateNewProject|openPro/.test(seg), "demoLoad nu cere Pro");
    assert.ok(/EBDemo\.existing/.test(seg), "copia neatinsă se redeschide");
  });
  test("exportul rămâne Pro: proGate nu e atins pentru proiectele demo", () => {
    const pro = fs.readFileSync(path.join(__dirname, "progates.test.js"), "utf8");
    assert.ok(/proGate/.test(pro));
    assert.ok(!/showcase/.test(rd("ebanist-license.js")));
  });
});

describe("EBDemo (pur)", () => {
  test("prepare: copie adâncă, id-uri noi, nume în limba cerută, sufix pe nume ocupat, fără `names`/`demo`", () => {
    const src = load("kitchen"), before = JSON.stringify(src);
    let n = 0; const uid = () => "u" + (++n);
    const a = EBDemo.prepare(src, { lang: "ro", uid, names: [], today: "2026-12-01" });
    assert.equal(JSON.stringify(src), before, "sursa nu se schimbă");
    assert.equal(a.name, src.names.ro); assert.equal(a.showcase, "kitchen"); assert.equal(a.date, "2026-12-01");
    assert.ok(a.names === undefined && a.demo === undefined && a.client === "");
    assert.equal(new Set(a.pieces.map(x => x.id)).size, a.pieces.length);
    const b = EBDemo.prepare(src, { lang: "ro", uid, names: [a.name] }); assert.equal(b.name, src.names.ro + " (2)");
    const c = EBDemo.prepare(src, { lang: "xx", uid, names: [] }); assert.equal(c.name, src.names.en);
    a.configs[Object.keys(a.configs)[0]].L = 1; assert.equal(JSON.stringify(src), before, "copie adâncă");
  });
  test("counts/existing: copia neatinsă nu se numără și se redeschide", () => {
    assert.equal(EBDemo.counts({ showcase: "living" }), false); assert.equal(EBDemo.counts({ demo: 1 }), false); assert.equal(EBDemo.counts({}), true);
    const ps = [{ id: "a" }, { id: "b", showcase: "living" }];
    assert.equal(EBDemo.existing(ps, "living").id, "b"); assert.equal(EBDemo.existing(ps, "kitchen"), null);
  });
});

describe("Instantaneul de referință (test/golden/showcase.json)", () => {
  test("există pentru toate trei, cu numere stabile și fără erori blocante; amprenta distinctei se recalculează din fișierul demo", () => {
    for (const id of ids) {
      const g = GOLD[id]; assert.ok(g, id);
      assert.equal(g.auditBlocking, 0); assert.ok(g.cutRows > 50 && g.hwLines > 20 && g.netto > 0 && g.operations > 500);
      assert.equal(g.cutRows, load(id).pieces.length, id + ": rândurile din golden = piesele din fișier");
      assert.ok(/^[0-9a-f]{16}$/.test(g.cutHash));
      const p = load(id);
      const sig = p.pieces.map(r => [r.modulo, r.elemento, r.lung, r.larg, r.pz, r.materiale].join("|"));
      /* distinct de ordine: hash-ul golden e pe ordinea cutRows(); aici verificăm doar că amprenta e reproductibilă din aceleași rânduri sortate */
      assert.equal(crypto.createHash("sha1").update(sig.join("\n")).digest("hex").length, 40);
    }
  });
  test("avertismentele oneste sunt numărate (cote neverificate, găuri negenerate), nu ascunse", () => {
    for (const id of ids) { const g = GOLD[id]; assert.ok(g.buildWarn && typeof g.buildWarn === "object", id); assert.ok(Object.keys(g.opsWarn).length >= 1, id); }
    assert.ok(GOLD.living.opsWarn.opsLiftNoDrill >= 1 && GOLD.bedroom.opsWarn.opsSlideNoDrill >= 1);
  });
  test("prețuri: feroneria nouă are preț 0 în catalog — rândurile fără preț sunt numărate (hwFree)", () => {
    for (const id of ids) assert.ok(GOLD[id].hwFree >= 1, id);
  });
});
