/* Ebanist — sisteme de sertar dincolo de Blum/Häfele Matrix: Hettich AvanTech YOU, ArciTech; GRASS Nova Pro Scala, Vionaro V8, V13; glisiere pentru
 * sertar din lemn (Actro 5D, Dynapro; Quadro V6, Matrix UM, Accuride 3832SC fără date complete).
 *
 *   node --test test/drawers-more.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - datele generate (ebanist-drawers-more-data.js) sunt cele din tools/hw-data/drawers (nimeni nu le editează de mână), iar fiecare cotă vine din
 *    tools/hw-data/raw/cat-drawers.json: testul le CITEȘTE din nou din raw, independent de normalize.py;
 *  - formulele (fund, spate, lungime, înălțimea spatelui, adâncimea minimă, NL pe înălțime) dau cotele din sursă;
 *  - ce nu e în sursă nu se ghicește: o grosime fără rând în tabel, o înălțime fără spate, o glisiere fără deducție → avertisment, nu valoare;
 *  - un corp fără sistemele noi dă EXACT aceeași distinctă ca înainte (comparat cu motorul de la baza ramurii, nu doar cu el însuși);
 *  - găurirea: nicio gaură inventată, un avertisment cu cheie i18n; glisiera apare în planul de hardware;
 *  - 3D: cutiile au cotele rândurilor și nu intră în pereții corpului.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path"), { execFileSync } = require("child_process");
const H = require("./drawers-more.helpers.js");
const ROOT = path.resolve(__dirname, "..");
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "hw-data", "raw", "cat-drawers.json"), "utf8"));
const RS = id => RAW.systems.find(s => s.id === id);
const S1 = H.load(true), S0 = H.load(false);
const MO = vm.runInContext("EBDrawersMore", S1), DATA = vm.runInContext("EBDrawersMoreData", S1);
/* textele (7 limbi): fișier clasic, evaluat ca în browser (package.json din rădăcină e type:module, deci fără require) */
vm.runInContext(fs.readFileSync(path.join(ROOT, "app", "ebanist-drawers-more-i18n.js"), "utf8"), S1, { filename: "ebanist-drawers-more-i18n.js" });
const I = JSON.parse(vm.runInContext("JSON.stringify({DRAWMORE_I18N:DRAWMORE_I18N,DRAWMORE_I18N_RAW:DRAWMORE_I18N_RAW,DRAWMORE_LANGS:DRAWMORE_LANGS})", S1));
const J = x => JSON.stringify(x);
const arr = x => Array.from(x || []);
const num = s => parseFloat(s);
const row = (B, re) => B.pieces.filter(p => re.test(p.elemento));
const THICK = { 16: { matBody: "__b16", matFront: "__b16" }, 18: { matBody: "__b18", matFront: "__b18" }, 19: {} };
/* un corp cu grosimea laterală t; LW = lățimea liberă dintr-un corp de 600 mm (2 laterale) */
const mk = (id, t, extra, guida) => H.build(S1, Object.assign({ drawerSys: id }, THICK[t] || {}, extra || {}), guida);
const LW = t => 600 - 2 * t;

/* ------------------------------------------------------------------------------------------------------------------------------ date */
describe("Datele: generate din raw, fără cote din memorie", () => {
  test("ebanist-drawers-more-data.js e cel generat de tools/drawers-more-build.mjs", () => {
    const f = path.join(ROOT, "app", "ebanist-drawers-more-data.js"), before = fs.readFileSync(f, "utf8");
    execFileSync("node", [path.join(ROOT, "tools", "drawers-more-build.mjs")], { cwd: ROOT });
    const after = fs.readFileSync(f, "utf8");
    assert.equal(after, before, "rulează node tools/drawers-more-build.mjs");
    execFileSync("node", [path.join(ROOT, "tools", "drawers-more-build.mjs"), "--check"], { cwd: ROOT });
  });
  test("5 sisteme selectabile, InnoTech Atira doar în catalog (fără deducții în sursă)", () => {
    assert.deepEqual(arr(MO.drawsysIds()).sort(), ["gr_nps", "gr_v13", "gr_v8", "het_arcitech", "het_avantech"]);
    const atira = MO.box("het_atira"); assert.equal(atira.selectable, false); assert.ok(atira.why.length);
    assert.equal(atira.baseW, null); assert.equal(atira.baseL, null);
  });
  test("verificat:false peste tot, fiecare sistem are sursă", () => {
    DATA.boxes.concat(DATA.runners).forEach(x => { assert.equal(x.verificat, false, x.key); assert.ok(x.src, x.key); });
  });
  test("AvanTech YOU: înălțimi, spate, NL pe înălțime, deducții = raw", () => {
    const a = RS("hettich-avantech-you"), b = MO.box("het_avantech");
    assert.equal(num(a.deductions.BL_bodenlaenge.match(/NL - (\d+) \(H101/)[1]), -b.baseL.const * 1);
    assert.equal(num(a.deductions.BB_bodenbreite.match(/LB - (\d+)/)[1]), -b.baseW.const);
    assert.equal(num(a.deductions.RB_rueckwandbreite.match(/LB - (\d+)/)[1]), -b.backW.const);
    ["101", "139", "187", "251"].forEach(h => {
      assert.equal(b.hs[h], num(h)); assert.equal(b.backHs[h], a.deductions.back_panel_height_RWH["H" + h]); assert.deepEqual(arr(b.nlBy[h]), a.nl_by_height[h]);
    });
    assert.equal(b.hs["77"], undefined, "H77 exclus: înălțimea spatelui nu e în sursă"); assert.ok(b.hsExcl["77"]);
    assert.equal(b.rear, 3); assert.match(a.cabinet.depth_rule, /NL \+ 3/);
  });
  test("ArciTech: EB după grosime, BL = NL − 24,5, înălțimile spatelui din desen etichetat", () => {
    const a = RS("hettich-arcitech"), b = MO.box("het_arcitech");
    const EB = {}; a.cabinet.drawer_width_rule.replace(/(\d+)->(\d+)/g, (m, k, v) => { EB[k] = +v; });
    assert.deepEqual(EB, { 16: 15, 18: 13, 19: 12 });
    Object.keys(EB).forEach(t => {
      assert.equal(b.baseW.byT[t], -(2 * EB[t] + num(a.deductions.BB.match(/- ([\d.]+)$/)[1])));
      assert.equal(b.backW.byT[t], -(2 * EB[t] + num(a.deductions.RB.match(/- ([\d.]+)$/)[1])));
    });
    assert.equal(b.baseL.const, -num(a.deductions.BL.match(/NL - ([\d.]+)/)[1]));
    assert.deepEqual(arr(b.nlBy["78"]), [500]); assert.deepEqual(arr(b.nlBy["94"]), a.nl);
    assert.deepEqual({ ...b.backHs }, { 78: 68.5, 94: 84.5, 126: 116.5 });
  });
  test("Nova Pro Scala: EB 29/30, BL = NL − 19, RWH, NL pe înălțime = raw", () => {
    const a = RS("grass-nova-pro-scala"), b = MO.box("gr_nps");
    assert.deepEqual({ ...b.backHs }, Object.fromEntries(Object.entries(a.deductions.back_panel_height_RWH_mm).map(([k, v]) => [k.slice(1), v])));
    Object.keys(a.nl_by_height).forEach(h => assert.deepEqual(arr(b.nlBy[h]), a.nl_by_height[h]));
    assert.equal(b.baseL.const, -19);
    assert.deepEqual({ ...b.baseW.byT }, { 16: -58, 18: -60, 19: -58 }); assert.match(a.cabinet.drawer_width_rule, /EB = 29 \(S16, S19\) \/ 30 \(S18\)/);
  });
  test("Vionaro V8 și V13: formulele = raw; H63 la V13 exclus (spate neetichetat)", () => {
    const v8 = RS("grass-vionaro-v8"), v13 = RS("grass-vionaro-v13"), b8 = MO.box("gr_v8"), b13 = MO.box("gr_v13");
    assert.match(v8.cabinet.drawer_width_rule, /BB = LWK - 22 ; RWB = LWK - 32/); assert.equal(b8.baseW.const, -22); assert.equal(b8.backW.const, -32);
    assert.match(v8.deductions.BL, /16 mm wooden back panel: NL - 27/); assert.equal(b8.baseL.const, -27); assert.equal(b8.minBackW, 148);
    assert.match(v13.cabinet.drawer_width_rule, /BB = LWK - 21 ; RWB = LWK - 42/); assert.equal(b13.baseW.const, -21); assert.equal(b13.backW.const, -42); assert.equal(v13.deductions.BL, "NL - 12"); assert.equal(b13.baseL.const, -12);
    assert.equal(b13.hs["63"], undefined); assert.ok(b13.hsExcl["63"]);
    assert.deepEqual({ ...b8.backHs }, Object.fromEntries(Object.entries(v8.deductions.back_panel_height_RWH).map(([k, v]) => [k.slice(1), v])));
  });
  test("glisierele pentru lemn: Actro 5D și Dynapro au deducție, Quadro V6 / Matrix UM / Actro YOU / Accuride nu (null rămâne null)", () => {
    assert.equal(MO.runner("het_actro_5d").wood.ded_lat, 42); assert.equal(MO.runner("het_actro_5d").wood.skl, 10);
    assert.equal(MO.runner("gr_dynapro").wood.ded_lat, 42); assert.equal(MO.runner("gr_dynapro").wood.minBoxW, 138);
    ["het_quadro_v6", "haf_matrix_um_a", "haf_matrix_um_a50", "het_actro_you"].forEach(k => assert.equal(MO.runner(k).wood.ded_lat, null, k));
    assert.equal(MO.runner("acc_3832sc").rear, null, "adâncimea minimă nu e în fișa Accuride");
    assert.equal(MO.runner("het_quadro_v6").rear, 13); assert.equal(MO.runner("haf_matrix_um_a").rear, 18); assert.equal(MO.runner("haf_matrix_um_a50").rear, 28);
  });
  test("nicio gaură nu e marcată utilizabilă: reperul lor nu e în text/tabel", () => {
    DATA.runners.forEach(r => assert.equal(r.holes.usable, false, r.key));
  });
});

/* ------------------------------------------------------------------------------------------------------------------------- formule */
describe("Formulele dau cotele din sursă (grosime 19, lățime 600 ⇒ LW 562)", () => {
  const cases = [
    ["het_avantech", 19, { baseW: LW(19) - 24, backW: LW(19) - 24, baseL: nl => nl - 21 }],
    ["het_arcitech", 19, { baseW: LW(19) - 76.5, backW: LW(19) - 88, baseL: nl => nl - 24.5 }],
    ["het_arcitech", 18, { baseW: LW(18) - 78.5, backW: LW(18) - 90, baseL: nl => nl - 24.5 }],
    ["het_arcitech", 16, { baseW: LW(16) - 82.5, backW: LW(16) - 94, baseL: nl => nl - 24.5 }],
    ["gr_nps", 19, { baseW: LW(19) - 58, backW: LW(19) - 58, baseL: nl => nl - 19 }],
    ["gr_nps", 18, { baseW: LW(18) - 60, backW: LW(18) - 60, baseL: nl => nl - 19 }],
    ["gr_nps", 16, { baseW: LW(16) - 58, backW: LW(16) - 58, baseL: nl => nl - 19 }],
    ["gr_v8", 19, { baseW: LW(19) - 22, backW: LW(19) - 32, baseL: nl => nl - 27 }],
    ["gr_v13", 19, { baseW: LW(19) - 21, backW: LW(19) - 42, baseL: nl => nl - 12 }]
  ];
  cases.forEach(([id, t, e]) => {
    test(`${id} · struct ${t}: fund, spate, lungime, înălțimea spatelui din tabel`, () => {
      const B = mk(id, t), p = B.b.draw, b = MO.box(id);
      assert.ok(p && p.ok, J(p && p.warn));
      assert.ok(Math.abs(p.baseW - e.baseW) < 0.05, `baseW ${p.baseW} ≠ ${e.baseW}`);
      assert.ok(Math.abs(p.backW - e.backW) < 0.05, `backW ${p.backW} ≠ ${e.backW}`);
      assert.ok(Math.abs(p.baseL - e.baseL(p.nl)) < 0.05, `baseL ${p.baseL}`);
      assert.equal(p.backH, b.backHs[p.hcode]); assert.equal(p.sideH, b.hs[p.hcode]);
      const f = row(B, /^Fondo cassetto/)[0], r = row(B, /^Retro cassetto/)[0];
      assert.equal(f.lung, Math.round(e.baseW)); assert.equal(f.larg, Math.round(e.baseL(p.nl))); assert.equal(f.pz, 3);
      assert.equal(r.lung, Math.round(e.backW)); assert.equal(r.larg, Math.round(b.backHs[p.hcode]));
      assert.equal(row(B, /^Fianco cassetto/).length, 0, "lateralele sunt cumpărate (HWDB.zarga), nu în distinctă");
    });
  });
  test("o grosime fără rând în tabel nu primește o valoare ghicită: ArciTech pe 22 mm", () => {
    S1.state = S1.state; const B = mk("het_arcitech", 19, {}); // referință
    const S = H.load(true);
    S.state.settings = H.SETTINGS(null, { matAdd: [H.MM("__b", 22), H.MM("__k", 3), H.MM("pfl5", 5)] });
    const full = Object.assign({ name: "X", matBody: "__b", matFront: "__b", matBack: "__k" }, H.BASE, { drawerSys: "het_arcitech" });
    const b = S.buildModule(full), p = b.draw;
    assert.equal(p.ok, 0); assert.ok(p.warn.some(w => w.k === "wDrawMoreKD" && w.t === 22 && /16\/18\/19/.test(w.ok)), J(p.warn));
    assert.equal(b.pieces.filter(x => /cassetto/i.test(x.elemento) && !/^Frontale/.test(x.elemento)).length, 0);
    assert.ok(B.b.draw.ok);
  });
});

describe("NL și înălțimi: NL-ul din adâncime, înălțimea din lista lui, adâncimea minimă = NL + 3", () => {
  test("NL = cea mai mare care intră (NL + 3 ≤ adâncimea utilă) și apare în lista înălțimii alese", () => {
    ["het_avantech", "het_arcitech", "gr_nps", "gr_v8", "gr_v13"].forEach(id => [350, 420, 500, 560, 650].forEach(P => {
      const B = mk(id, 19, { P, drawers: 2 }), p = B.b.draw; if (!p || !p.ok) return;
      assert.ok(p.nl + 3 <= B.G.P_int + 1e-6, `${id} P${P}: NL ${p.nl} + 3 > ${B.G.P_int}`);
      assert.ok(MO.box(id).nlBy[p.hcode].includes(p.nl), `${id} P${P}: înălțimea ${p.hcode} nu există la NL ${p.nl}`);
      assert.deepEqual(B.close(), [], id + " P" + P);
    }));
  });
  test("Nova Pro Scala: H63 există numai la NL 400–550; cerută la NL 300 → avertisment, se ia altă înălțime", () => {
    const B = mk("gr_nps", 19, { P: 340, drawers: 2, drawerH: "63" }), p = B.b.draw;
    assert.equal(p.nl, 300);
    assert.ok(p.warn.some(w => w.k === "wDrawMoreNLH" && w.h === "63" && w.nl === 300), J(p.warn));
    assert.notEqual(p.hcode, "63"); assert.ok(MO.box("gr_nps").nlBy[p.hcode].includes(300));
    const ok = mk("gr_nps", 19, { P: 560, drawers: 2, drawerH: "63" }).b.draw;
    assert.equal(ok.hcode, "63"); assert.ok(MO.box("gr_nps").nlBy["63"].includes(ok.nl));
  });
  test("AvanTech: H77 nu se poate cere (nu e în sursă cu spate): se ignoră, se alege automat", () => {
    const p = mk("het_avantech", 19, { drawerH: "77" }).b.draw; assert.notEqual(p.hcode, "77"); assert.ok(p.ok);
  });
  test("ArciTech H78 există numai la NL 500", () => {
    const b = MO.box("het_arcitech"); assert.deepEqual(arr(b.nlBy["78"]), [500]);
    const p = mk("het_arcitech", 19, { P: 560, drawers: 6, H: 720, drawerH: "78" }).b.draw;
    if (p.ok && p.hcode === "78") assert.equal(p.nl, 500);
  });
  test("adâncime prea mică: avertisment, fără distinctă de casă", () => {
    const B = mk("gr_v8", 19, { P: 260, drawers: 2 }), p = B.b.draw;
    assert.equal(p.ok, 0); assert.ok(p.warn.some(w => w.k === "wDrawDeep"), J(p.warn));
  });
});

describe("Lățime minimă: spatele Vionaro cere 148 / 120 mm", () => {
  test("V8: LWK − 32 ≥ 148 ⇒ LWK ≥ 180; sub asta planul spune de ce nu iese", () => {
    const wide = H.build(S1, { drawerSys: "gr_v8", L: 38 + 190 }).b.draw, narrow = H.build(S1, { drawerSys: "gr_v8", L: 38 + 170 }).b.draw;
    assert.ok(wide.ok, J(wide.warn)); assert.ok(wide.backW >= 148);
    assert.equal(narrow.ok, 0); assert.ok(narrow.warn.some(w => w.k === "wDrawMoreMinW" && w.min === 148), J(narrow.warn));
  });
  test("V13: minim 120", () => {
    const narrow = H.build(S1, { drawerSys: "gr_v13", L: 38 + 150 }).b.draw, ok = H.build(S1, { drawerSys: "gr_v13", L: 38 + 185 }).b.draw;
    assert.equal(narrow.ok, 0); assert.ok(narrow.warn.some(w => w.k === "wDrawMoreMinW" && w.min === 120)); assert.ok(ok.ok);
  });
});

describe("Avertismente de grosime: datele GRASS sunt pentru PAL de 16 mm", () => {
  test("pe 19 mm: wDrawMoreTh, dar planul rămâne în picioare", () => {
    const p = mk("gr_nps", 19).b.draw; assert.ok(p.ok); assert.ok(p.warn.some(w => w.k === "wDrawMoreTh" && w.ref === 16 && w.t === 19));
  });
  test("pe 16 mm: fără avertismentul de grosime", () => {
    const p = mk("gr_nps", 16).b.draw; assert.ok(p.ok); assert.ok(!p.warn.some(w => w.k === "wDrawMoreTh"), J(p.warn));
  });
  test("Hettich nu are referință de grosime pentru fund/spate (sursa nu o dă): fără avertisment", () => {
    assert.ok(!mk("het_avantech", 19).b.draw.warn.some(w => w.k === "wDrawMoreTh"));
  });
});

/* ------------------------------------------------------------------------------------------- sertar din lemn pe glisierele noi */
describe("Sertar din lemn pe glisierele din catalog", () => {
  test("Dynapro: lățime = LW − 42, lungime = NL − 10, rezerva = 3 (MET = NL + 3), lista de NL a glisierei", () => {
    const B = H.build(S1, { drawerSys: "legno", P: 560 }, "gr_dynapro"), p = B.b.draw;
    assert.ok(p.ok, J(p.warn)); assert.equal(p.ded, 42); assert.equal(p.boxW, LW(19) - 42); assert.equal(p.boxL, p.nl - 10);
    assert.ok(p.nl + 3 <= B.G.P_int + 1e-6); assert.ok(MO.runner("gr_dynapro").nl.includes(p.nl));
    assert.equal(row(B, /^Fianco cassetto/)[0].lung, p.nl - 10); assert.equal(row(B, /^Fondo cassetto/)[0].larg, p.nl - 10 - 20);
    assert.deepEqual(B.close(), [], "gabaritul se închide"); assert.deepEqual(B.ko(), []);
  });
  test("Actro 5D: lățime = LW − 42, lungime = NL − 10; lateral > 16 mm → avertisment", () => {
    const B = H.build(S1, { drawerSys: "legno", P: 560 }, "het_actro_5d"), p = B.b.draw;
    assert.equal(p.boxW, LW(19) - 42); assert.equal(p.boxL, p.nl - 10);
    assert.ok(p.warn.some(w => w.k === "wDrawMoreSideTh" && w.max === 16 && w.t === 19), J(p.warn));
    const B16 = H.build(S1, Object.assign({ drawerSys: "legno", P: 560 }, THICK[16]), "het_actro_5d");
    assert.ok(!B16.b.draw.warn.some(w => w.k === "wDrawMoreSideTh"));
  });
  test("Dynapro: cassă mai îngustă de 138 mm → avertisment, fără rânduri", () => {
    const p = H.build(S1, { drawerSys: "legno", L: 38 + 170 }, "gr_dynapro").b.draw;   // LW 170 − 42 = 128 < 138
    assert.equal(p.ok, 0); assert.ok(p.warn.some(w => w.k === "wDrawMoreMinBox" && w.min === 138), J(p.warn));
  });
  test("fără date: Quadro V6, Matrix UM, Actro YOU → wDrawMoreNoDed, Accuride → wDrawMoreNoRear; niciun rând de cassă", () => {
    [["het_quadro_v6", "wDrawMoreNoDed"], ["haf_matrix_um_a", "wDrawMoreNoDed"], ["haf_matrix_um_a50", "wDrawMoreNoDed"], ["het_actro_you", "wDrawMoreNoDed"], ["acc_3832sc", "wDrawMoreNoRear"]].forEach(([g, k]) => {
      const B = H.build(S1, { drawerSys: "legno" }, g), p = B.b.draw;
      assert.equal(p.ok, 0, g); assert.ok(p.warn.some(w => w.k === k), g + J(p.warn));
      assert.equal(row(B, /^(Fianco cassetto|Fondo cassetto|Fronte\/Retro)/).length, 0, g);
    });
  });
  test("glisierele vechi rămân cum erau (rezerva 30 a casei din lemn, deducția din tabel)", () => {
    for (const [g, d] of [["blum_tandem", 42], ["blum_movento", 42], ["blum_230m", 25], ["haf_ball", 26], ["haf_matrix", 62]]) {
      const p = H.build(S1, { drawerSys: "legno" }, g).b.draw; assert.equal(p.ded, d, g); assert.equal(p.boxL, p.nl, g); assert.equal(p.mo, undefined, g);
    }
  });
});

/* ------------------------------------------------------------------------------------------------------------------------ regresie */
describe("Un corp fără sistemele noi dă aceeași distinctă ca înainte", () => {
  const SYS = ["legno", "legrabox", "tandembox", "matrix", "nessuno"];
  const GUIDE = ["blum_tandem", "blum_movento", "blum_230m", "haf_ball", "haf_matrix", "blums_tandem19_locking"];
  const cfgs = [{}, { L: 900, drawers: 4 }, { P: 400, drawers: 2, drawerDist: "fix", drawerFH: 180 }, { drawerPos: "interno", doors: 2, drawers: 2 }, { tram: 1, L: 1200, drawers: 2 }];
  test("încărcarea drawers-more nu schimbă planul sau distincta sistemelor vechi", () => {
    for (const sys of SYS) for (const g of sys === "legno" ? GUIDE : ["blum_tandem"]) for (const c of cfgs) {
      const a = H.build(S0, Object.assign({ drawerSys: sys }, c), g), b = H.build(S1, Object.assign({ drawerSys: sys }, c), g);
      assert.equal(J(b.pieces), J(a.pieces), `${sys}/${g}/${J(c)}`);
      assert.equal(J(b.b.draw && { ...b.b.draw, sys: b.b.draw.sysId }), J(a.b.draw && { ...a.b.draw, sys: a.b.draw.sysId }), `plan ${sys}/${g}/${J(c)}`);
      assert.equal(J(b.b.boxes), J(a.b.boxes), `3D ${sys}/${g}/${J(c)}`);
    }
  });
  test("…și față de motorul de la baza ramurii (git, 5fddaa0): aceleași piese și aceleași cutii 3D", () => {
    let html; try { html = execFileSync("git", ["show", "5fddaa0:app/index.html"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"); } catch (e) { return; }   // fără istoric git: se sare
    const O = H.loadHtml(html);
    for (const sys of SYS) for (const g of sys === "legno" ? GUIDE : ["blum_tandem"]) for (const c of cfgs) {
      const a = H.build(O, Object.assign({ drawerSys: sys }, c), g), b = H.build(S1, Object.assign({ drawerSys: sys }, c), g);
      assert.equal(J(b.pieces), J(a.pieces), `${sys}/${g}/${J(c)}`);
      assert.equal(J(b.b.boxes), J(a.b.boxes), `3D ${sys}/${g}/${J(c)}`);
    }
  });
  test("slideById: glisierele vechi neschimbate, cele noi adăugate", () => {
    const cat = vm.runInContext("SLIDE_CATALOG", S1), old = vm.runInContext("SLIDE_CATALOG", S0);
    Object.keys(old).forEach(k => assert.equal(J(cat[k]), J(old[k]), k));
    assert.equal(cat.gr_dynapro.rear, 3); assert.equal(cat.gr_dynapro.ded_lat, 42); assert.equal(cat.het_actro_you.rear, 3);
    assert.equal(old.gr_dynapro, undefined);
  });
});

/* ------------------------------------------------------------------------------------------------------------------------ găurire */
describe("Găurire: nicio gaură inventată pentru glisierele noi, avertisment cu cheie i18n", () => {
  test("AvanTech YOU: fără găuri de glisieră, un avertisment, glisiera în hw cu catalogul ei", () => {
    const o = mk("het_avantech", 19).ops();
    const holes = o.pieces.flatMap(p => p.operations || []).filter(x => /guida/i.test(x.note || ""));
    assert.equal(holes.length, 0);
    const w = o.warnings.filter(x => x.k === "opsDrawMoreNoHoles"); assert.equal(w.length, 1); assert.match(w[0].g, /Actro YOU/);
    const g = o.hw.filter(h => h.type === "guida"); assert.ok(g.length >= 2); g.forEach(h => assert.equal(h.catalog, "het_actro_you"));
  });
  test("un avertisment pe corp chiar cu mai multe sertare", () => {
    assert.equal(mk("gr_nps", 19, { drawers: 5, H: 900 }).ops().warnings.filter(x => x.k === "opsDrawMoreNoHoles").length, 1);
  });
  test("sertar din lemn pe Dynapro: la fel (nu cad pozițiile Blum implicite 37/261/453)", () => {
    const o = H.build(S1, { drawerSys: "legno" }, "gr_dynapro").ops();
    assert.equal(o.pieces.flatMap(p => p.operations || []).filter(x => /guida/i.test(x.note || "")).length, 0);
    assert.ok(o.warnings.some(x => x.k === "opsDrawMoreNoHoles"));
  });
  test("sistemele vechi: găurirea neschimbată (pozițiile Blum rămân, niciun avertisment nou)", () => {
    const a = H.build(S0, { drawerSys: "tandembox" }).ops(), b = H.build(S1, { drawerSys: "tandembox" }).ops();
    assert.equal(J(b), J(a)); assert.ok(!b.warnings.some(x => x.k === "opsDrawMoreNoHoles"));
    const holes = b.pieces.flatMap(p => p.operations || []).filter(x => /guida/i.test(x.note || "")); assert.ok(holes.length > 0);
  });
  test("tabelul producătorului apare ca informație în fișa de montaj, cu avertismentul că nu e forat", () => {
    const L = arr(MO.sheetLines({ sys: MO.drawsys().het_avantech, nl: 500 }, k => I.DRAWMORE_I18N.it[k] || k));
    assert.ok(L.length >= 5, J(L)); assert.ok(L.every(l => !/\{[a-z]+\}/.test(l)), "substituții rămase: " + J(L));
    assert.ok(L.some(l => /non forati\): b1\/b2 = 256 \/ 320 mm \(NL 500\)/.test(l)), J(L));   // b1/b2 la NL 500 din tabelul Hettich (bk_279), informativ
  });
});

/* ---------------------------------------------------------------------------------------------------------------------------- 3D */
describe("3D: cutiile au cotele rândurilor și nu intră în corp", () => {
  ["het_avantech", "het_arcitech", "gr_nps", "gr_v8", "gr_v13"].forEach(id => test(id, () => {
    const B = mk(id, 19, { drawers: 3 }), p = B.b.draw, bx = B.b.boxes.filter(b => b.sub === "dbox");
    assert.ok(bx.length > 0);
    const base = bx.filter(b => b.role === "cassetto_fondo"), back = bx.filter(b => b.role === "cassetto_fianco"), side = bx.filter(b => b.role === "cassetto_metallo");
    assert.equal(base.length, 3); assert.equal(back.length, 3); assert.equal(side.length, 6);
    base.forEach(b => { assert.ok(Math.abs((b.x1 - b.x0) - p.baseW) < 0.51, `fund lat ${b.x1 - b.x0} vs ${p.baseW}`); assert.ok(Math.abs((b.z1 - b.z0) - p.baseL) < 0.51, `fund lung ${b.z1 - b.z0} vs ${p.baseL}`); });
    back.forEach(b => { assert.ok(Math.abs((b.x1 - b.x0) - p.backW) < 0.51); assert.ok(Math.abs((b.y1 - b.y0) - p.backH) < 0.51, `spate ${b.y1 - b.y0} vs ${p.backH}`); });
    /* lateralul nu intră în pereții corpului și nu iese deasupra frontului */
    const walls = B.b.boxes.filter(b => b.role === "fianco"); assert.ok(walls.length >= 2);
    side.forEach(s => walls.forEach(w => { const ox = Math.min(s.x1, w.x1) - Math.max(s.x0, w.x0), oy = Math.min(s.y1, w.y1) - Math.max(s.y0, w.y0), oz = Math.min(s.z1, w.z1) - Math.max(s.z0, w.z0);
      assert.ok(!(ox > 0.5 && oy > 0.5 && oz > 0.5), `${id}: lateralul intră în perete cu ${ox}`); }));
    side.forEach(s => assert.ok(s.y1 - s.y0 <= p.sideH + 0.01));
    /* spatele nu depășește lateralul */
    back.forEach(b => { const s = side.find(q => q.grp === b.grp); assert.ok(s && b.y1 <= s.y1 + 0.5, `${id}: spatele depășește lateralul`); });
  }));
  test("sertar din lemn pe Dynapro: cutia 3D are lungimea NL − 10 și fundul NL − 30", () => {
    const B = H.build(S1, { drawerSys: "legno", drawers: 2 }, "gr_dynapro"), p = B.b.draw, bx = B.b.boxes.filter(b => b.sub === "dbox");
    bx.filter(b => b.role === "cassetto_fianco" && b.x1 - b.x0 <= 19.5 && b.z1 - b.z0 > 100).forEach(b => assert.ok(Math.abs((b.z1 - b.z0) - (p.nl - 10)) < 0.51));
    bx.filter(b => b.role === "cassetto_fondo").forEach(b => assert.ok(Math.abs((b.z1 - b.z0) - (p.nl - 30)) < 0.51));
  });
});

/* ------------------------------------------------------------------------------------------------------------------------- catalog */
describe("Catalog: glisiere și seturi de laterale în 7 limbi", () => {
  test("fiecare glisieră și fiecare set are numele în toate cele 7 limbi, un articol, preț 0 (de completat) și chk", () => {
    const g = MO.guidaEntries([]), z = MO.zargaEntries([]);
    assert.equal(g.length, 9); assert.equal(z.length, 6);
    g.concat(z).forEach(x => { ["it", "ro", "en", "fr", "de", "pl", "es"].forEach(l => assert.ok(x.n[l] && x.n[l].length > 3, x.id + " " + l)); assert.equal(x.price, 0); assert.equal(x.chk, 1); assert.ok(x.art); });
    assert.equal(new Set(g.map(x => x.id)).size, 9);
  });
  test("ce e deja în catalog nu se dublează", () => assert.equal(MO.guidaEntries(["gr_dynapro"]).length, 8));
  test("fiecare casă selectabilă are glisiera și setul de laterale în catalog", () => {
    const g = MO.guidaEntries([]).map(x => x.id), z = MO.zargaEntries([]).map(x => x.id);
    MO.boxes().forEach(b => { assert.ok(g.includes(b.runner), b.key); assert.ok(z.includes(b.side), b.key); });
  });
  test("tipul glisierei pentru 3D: laterală (Actro, Nova Pro, Quadro, Accuride) sau ascunsă (Dynapro, Matrix UM)", () => {
    ["het_actro_you", "het_actro_arcitech", "het_actro_5d", "het_quadro_v6", "gr_nova_pro", "acc_3832sc"].forEach(k => assert.equal(MO.kind(k), "side", k));
    ["gr_dynapro", "haf_matrix_um_a", "haf_matrix_um_a50"].forEach(k => assert.equal(MO.kind(k), "concealed", k));
    assert.equal(MO.kind("blum_tandem"), null);
  });
});

describe("Textele: aceleași chei și aceleași {substituții} în toate cele 7 limbi", () => {
  const subs = s => (s.match(/\{[a-zA-Z]+\}/g) || []).sort().join(",");
  test("fiecare cheie are 7 limbi nevide și aceleași substituții", () => {
    Object.keys(I.DRAWMORE_I18N_RAW).forEach(k => {
      const v = I.DRAWMORE_I18N_RAW[k]; assert.equal(v.length, 7, k);
      v.forEach((s, i) => assert.ok(s && s.length, k + " " + I.DRAWMORE_LANGS[i]));
      v.forEach((s, i) => assert.equal(subs(s), subs(v[0]), `${k}: substituții diferite în ${I.DRAWMORE_LANGS[i]}`));
    });
  });
  test("cheile folosite de planuri și de fișă există", () => {
    const keys = Object.keys(I.DRAWMORE_I18N.it);
    ["wDrawMoreKD", "wDrawMoreMinW", "wDrawMoreMinBox", "wDrawMoreTh", "wDrawMoreNoRear", "wDrawMoreNoDed", "wDrawMoreSideTh", "wDrawMoreNLH", "opsDrawMoreNoHoles",
      "dwMoreDepth", "dwMoreSlide", "dwMoreSides", "dwMoreFront", "dwMoreJig", "dwMoreSupport", "dwMoreThRef", "dwMoreHoles", "fx_screw", "fx_knock", "fx_hook", "fx_lock"].forEach(k => assert.ok(keys.includes(k), k));
  });
  test("fiecare metodă de prindere a frontului din date are textul ei", () => {
    const keys = Object.keys(I.DRAWMORE_I18N.it);
    MO.boxes().forEach(b => { const m = b.front && b.front.method; if (m) assert.ok(keys.includes("fx_" + m), b.key + " " + m); });
  });
});

describe("Fișa de montaj: adâncime minimă, articole, prinderea frontului", () => {
  const t = k => ({ dwMoreDepth: "D {mm} NL {nl} +{k}", dwMoreSlide: "G {g} {art}", dwMoreSides: "S {g} {art}", dwMoreFront: "F {m}{jig}", dwMoreJig: "jig", dwMoreSupport: "U {s}", dwMoreThRef: "T {t}", dwMoreHoles: "H {lab} {v}", fx_screw: "screw", fx_knock: "knock", fx_hook: "hook", fx_lock: "lock" }[k] || k);
  test("AvanTech: adâncimea minimă = NL + 3, prinderea la față cu șuruburi și dima Practica 250", () => {
    const B = mk("het_avantech", 19), L = arr(MO.sheetLines(B.b.draw, t));
    assert.ok(L.some(l => l === `D ${B.b.draw.nl + 3} NL ${B.b.draw.nl} +3`), J(L));
    assert.ok(L.some(l => /F screw.*Practica 250 \(9219328\)/.test(l)), J(L));
  });
  test("sistemele vechi nu primesc rânduri", () => assert.deepEqual(arr(MO.sheetLines(H.build(S1, { drawerSys: "legrabox" }).b.draw, t)), []));
});
