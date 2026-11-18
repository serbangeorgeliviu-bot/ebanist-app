/* Ebanist — U.17: sisteme glisante / escamotabile / aripă — datele și partea pură (ebanist-sliding.js).
 *
 *   node --test test/slidingfit.test.js
 *
 * Păzește: (1) datele generate = sliding.json (nimic scris de mână în app/ebanist-sliding-data.js), fiecare cod de comandă și fiecare număr mare vin din raw
 * (tools/hw-data/raw/cat-sliding.json), verificat:false peste tot, null rămâne null; (2) formulele producătorilor, pe exemple calculate de mână;
 * (3) regulile fără formulă publicată (Hettich) nu inventează una; (4) textele au toate cele 7 limbi, aceleași {substituții}; (5) catalogul: câte un articol
 * pe cod, nume în 7 limbi.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const APP = path.join(__dirname, "..", "app"), TOOLS = path.join(__dirname, "..", "tools");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx;
["ebanist-sliding-data.js", "ebanist-sliding-i18n.js", "ebanist-sliding.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), ctx, { filename: f }));
const E = vm.runInContext("EBSliding", ctx), DATA = vm.runInContext("EBSlidingData", ctx), I18N = vm.runInContext("SLIDE_I18N", ctx);
const J = x => JSON.stringify(x);
const RAWTXT = fs.readFileSync(path.join(TOOLS, "hw-data", "raw", "cat-sliding.json"), "utf8"), RAWNS = RAWTXT.replace(/\s+/g, "");
const NORM = JSON.parse(fs.readFileSync(path.join(TOOLS, "hw-data", "sliding", "sliding.json"), "utf8"));
const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];

describe("Datele", () => {
  test("fișierul generat = sliding.json (nu se editează de mână)", () => {
    assert.equal(J(DATA.systems), J(NORM.systems)); assert.equal(J(DATA.codes), J(NORM.codes));
  });
  test("65 de sisteme (44 glisante, 13 escamotabile, 8 cu aripă) și 388 de coduri", () => {
    assert.equal(DATA.systems.length, 65); assert.equal(DATA.codes.length, 388);
    const by = {}; DATA.systems.forEach(s => by[s.kind] = (by[s.kind] || 0) + 1);
    assert.equal(J(by), J({ slide: 44, pocket: 13, wing: 8 }));
  });
  test("cheile sunt unice, fiecare sistem are sursă și verificat:false", () => {
    const k = new Set(); DATA.systems.forEach(s => { assert.ok(!k.has(s.key)); k.add(s.key); assert.ok(s.src, s.key); assert.equal(s.verificat, false, s.key); });
  });
  test("fiecare cod de comandă apare în raw (șirurile de verificare ale codului)", () => {
    DATA.codes.forEach(c => { assert.ok(c.ver && c.ver.length, c.code); c.ver.forEach(v => assert.ok(RAWNS.includes(v), c.code + " → " + v)); });
  });
  test("fiecare număr din limite, formule și planuri apare ca număr în raw (nimic din memorie)", () => {
    const tokens = new Set((RAWTXT.match(/\d+(?:\.\d+)?/g) || []));
    const bad = [];
    const walk = (o, where) => {
      if (typeof o === "number") { if (!tokens.has(String(o))) bad.push(where + "=" + o); }
      else if (Array.isArray(o)) o.forEach((x, i) => walk(x, where + "[" + i + "]"));
      else if (o && typeof o === "object") Object.keys(o).forEach(k => { if (k !== "bom" && k !== "info" && k !== "codes") walk(o[k], where + "." + k); });
    };
    DATA.systems.forEach(s => ["lim", "dw", "clr", "tz", "trk", "plan"].forEach(k => walk(s[k], s.key + "." + k)));
    assert.equal(J(bad), "[]", J(bad));
  });
  test("null rămâne null: nimic necitit nu devine număr (WingLine S/230/Wing 77: numai limite, fără coduri)", () => {
    ["het_wingline_s", "het_wingline_230", "het_wing_77"].forEach(k => { const s = E.get(k); assert.ok(s.lim.wingLimitsOnly); assert.equal(s.bom.length, 0); assert.equal(s.plan, null); });
    assert.equal(E.get("het_topline_xl").dw, null); assert.equal(E.get("het_topline_l").dw, null);
    assert.equal(E.get("hawa_combino_50_fs").dw, null);
  });
  test("conflictele din surse sunt păstrate: TopLine XL înălțime 2600/3000 și lățime", () => {
    const s = E.get("het_topline_xl"); assert.ok(s.conflicts.some(c => /^h:/.test(c))); assert.ok(s.conflicts.some(c => /^w:/.test(c)));
    assert.equal(s.lim.h[1], 3000); assert.equal(s.lim.wN["2"][1], 1000);
  });
  test("regulile BOM folosesc numai coduri din catalog și chei when cunoscute", () => {
    const codes = new Set(DATA.codes.map(c => c.code));
    DATA.systems.forEach(s => s.bom.forEach(l => l.opts.forEach(o => assert.ok(codes.has(o.code), s.key + " " + o.code))));
  });
});

describe("Textele în 7 limbi", () => {
  const keys = Object.keys(I18N.it);
  test("fiecare cheie există în toate limbile, nevidă, cu aceleași {substituții}", () => {
    keys.forEach(k => {
      const ph = (I18N.it[k].match(/\{\w+\}/g) || []).sort().join();
      LANGS.forEach(L => { const v = I18N[L][k]; assert.ok(typeof v === "string" && v.length > 0, L + " " + k); assert.equal((v.match(/\{\w+\}/g) || []).sort().join(), ph, L + " " + k); });
    });
  });
  test("toate limbile au aceleași chei", () => { LANGS.forEach(L => assert.equal(J(Object.keys(I18N[L]).sort()), J(keys.slice().sort()), L)); });
  test("numele de piese (SLIDE_EL) în 6 limbi", () => {
    const EL = vm.runInContext("SLIDE_EL", ctx);
    ["ro", "en", "fr", "de", "pl", "es"].forEach(L => ["Anta a scomparsa", "Sistema ante scorrevoli", "Binario scorrevole"].forEach(n => assert.ok(EL[L][n] && EL[L][n] !== n || L === "it", L + n)));
  });
  test("fiecare rol din catalog are text în toate limbile", () => {
    const roles = new Set(DATA.codes.map(c => c.role));
    roles.forEach(r => { const rk = E.ROLE_KEY[r]; assert.ok(rk, "rol fără cheie: " + r); LANGS.forEach(L => assert.ok(I18N[L]["slr_" + rk], L + " slr_" + rk)); });
  });
});

describe("Catalogul (HWDB.slide)", () => {
  const ent = E.catalogEntries();
  test("câte un articol pe cod, id-uri unice, nume în 7 limbi fără «undefined»", () => {
    assert.equal(ent.length, DATA.codes.length); assert.equal(new Set(ent.map(e => e.id)).size, ent.length);
    ent.forEach(e => LANGS.forEach(L => { assert.ok(e.n[L] && !/undefined|null/.test(e.n[L]), e.id + " " + L); }));
  });
  test("catalogEntries ocolește id-urile deja prezente", () => { assert.equal(E.catalogEntries([ent[0].id]).length, ent.length - 1); });
  test("codul de comandă e în art; cele citite cu încredere scăzută au chk", () => {
    const e = ent.find(x => x.art === "9 275 796"); assert.ok(e); assert.match(e.n.ro, /TopLine XL/); assert.match(e.n.ro, /2 uși/); assert.match(e.n.en, /2 doors/);
    assert.ok(ent.find(x => x.art === "0 026 081").chk);
    assert.ok(!ent.find(x => x.art === "9 275 796").chk);
  });
  test("fiecare cod folosit într-un BOM există ca articol", () => {
    const ids = new Set(ent.map(e => e.id));
    DATA.systems.forEach(s => s.bom.forEach(l => l.opts.forEach(o => assert.ok(ids.has(E.codeId(o.code))))));
  });
});

const BASE = { n: 2, L: 2400, H: 2400, Lint: 2362, P: 600, tA: 19, tSide: 19, sth: 19, frontX0: 0, frontW: 2400, dens: 650, ovGen: 40, y0Gen: 22, y1Gen: 2377, zEvenGen: 608, zGapGen: 14 };
const POCKET = { n: 1, L: 600, H: 2000, P: 600, Lint: 562, Hint: 1960, Pint: 580, tA: 19, tSide: 19, sth: 19, yIntBot: 99, gapSup: 3, gapInf: 3, reveal: 3, gapAnte: 4, sides: ["L"], dens: 650, plinth: true };

describe("Uși glisante: formulele producătorilor", () => {
  test("Hawa Combino 35 H FS, 2 uși: TB = (KAM + 16)/2, suprapunere 16", () => {
    const r = E.planSlide(E.get("hawa_combino_35_fs"), BASE);
    assert.equal(r.aW, (2400 + 16) / 2); assert.equal(r.ov, 16); assert.equal(r.xs[1], r.aW - 16);
  });
  test("Hawa Combino 35 H IS, 3 uși: TB = (KIM + 56)/3; ușile pleacă din fața interioară", () => {
    const r = E.planSlide(E.get("hawa_combino_35_is"), Object.assign({}, BASE, { n: 3 }));
    assert.ok(Math.abs(r.aW - (2362 + 56) / 3) < 1e-9); assert.ok(Math.abs(r.ov - 28) < 1e-9); assert.equal(r.x0, 19);
  });
  test("Hawa Combino 35 MS, 3 uși: TB = (KIM + 36)/3", () => {
    const r = E.planSlide(E.get("hawa_combino_35_ms"), Object.assign({}, BASE, { n: 3 })); assert.ok(Math.abs(r.aW - (2362 + 36) / 3) < 1e-9);
  });
  test("Hawa Combino 20 H (numai 2 uși): 3 uși cerute → 2, cu avertisment", () => {
    const r = E.planSlide(E.get("hawa_combino_20_ms"), Object.assign({}, BASE, { n: 3 })); assert.equal(r.n, 2);
    assert.ok(r.warn.some(w => w.k === "n" && w.lo === 2 && w.hi === 2 && w.n === 3 && w.m === 2));
  });
  test("Häfele F-Line31 40A: suprapunerea recomandată LT = 20", () => {
    const r = E.planSlide(E.get("haf_fline31_40a"), BASE); assert.equal(r.ov, 20); assert.equal(r.aW, (2400 + 20) / 2);
  });
  test("Hettich: nicio formulă publicată → regula generică a aplicației (SLIDE_OVERLAP) + avertisment, nu o formulă inventată", () => {
    ["het_topline_xl", "het_topline_l", "het_slideline_m_ov", "het_slideline_m_in", "het_slideline_55_ov", "het_topline_25_27"].forEach(k => {
      const r = E.planSlide(E.get(k), Object.assign({}, BASE, { n: 2, frontW: 1800, Lint: 1762 }));
      assert.equal(r.ov, 40, k); assert.equal(r.aW, (1800 + 40) / 2, k); assert.ok(r.warn.some(w => w.k === "noFormula"), k); assert.equal(r.used.formula, false, k);
    });
  });
  test("TopLine XL: jocurile din desen (sus ≥ 45, jos ≥ 65) dau y; se spune că sunt din desen", () => {
    const r = E.planSlide(E.get("het_topline_xl"), BASE); assert.equal(r.y0, 65); assert.equal(r.y1, 2400 - 45); assert.equal(r.aH, 2400 - 45 - 65);
    const w = r.warn.find(x => x.k === "drawing"); assert.equal(w.top, 45); assert.equal(w.bottom, 65);
  });
  test("fără jocuri în sursă (SlideLine M): y-urile generice ale aplicației", () => {
    const r = E.planSlide(E.get("het_slideline_m_ov"), BASE); assert.equal(r.y0, 22); assert.equal(r.y1, 2377); assert.ok(!r.warn.some(w => w.k === "drawing"));
  });
  test("TopLine XL: decalajul dintre șine 8 mm (desen) în z", () => {
    const r = E.planSlide(E.get("het_topline_xl"), BASE); assert.equal(r.zs[1] - r.zs[0], 19 + 8);
    assert.equal(E.planSlide(E.get("hawa_combino_35_fs"), BASE).zs[1] - 608, 19 + 14);   // fără decalaj în sursă: cel generic
  });
  test("ușile inset stau în corp (z < P), cele overlay în față", () => {
    const a = E.planSlide(E.get("hawa_combino_35_is"), BASE), b = E.planSlide(E.get("hawa_combino_35_fs"), BASE);
    assert.ok(a.zs.every(z => z + 19 <= 600)); assert.ok(b.zs.every(z => z >= 600));
  });
  test("lungimea șinei = lățimea interioară; peste lungimea standard → avertisment de îmbinare", () => {
    assert.equal(E.planSlide(E.get("hawa_combino_35_fs"), BASE).trackLen, 2362);
    const r = E.planSlide(E.get("het_slideline_55_ov"), Object.assign({}, BASE, { Lint: 4200, frontW: 4238, L: 4238 }));
    assert.ok(r.warn.some(w => w.k === "track" && w.std === 4000));
  });
  test("o singură ușă (TopLine 25): fără suprapunere", () => {
    const r = E.planSlide(E.get("het_topline_25_27"), Object.assign({}, BASE, { n: 1, frontW: 1000, Lint: 962 })); assert.equal(r.n, 1); assert.equal(r.ov, 0); assert.equal(r.aW, 1000);
  });
});

describe("Limite", () => {
  test("TopLine XL: greutatea după grosime (60 / 80 / 100 kg), lățimea pe număr de uși (2 uși 600–1000)", () => {
    const s = E.get("het_topline_xl");
    assert.equal(E.limitIssues(s, { kg: 65, h: 2000, w: 800, th: 19, n: 2 }).some(i => i.k === "kg"), true);      // 19 mm: set 18–30 → 60 kg
    assert.equal(E.limitIssues(s, { kg: 65, h: 2000, w: 800, th: 25, n: 2 }).some(i => i.k === "kg"), false);     // 25 mm: set 22–30 → 80 kg
    assert.equal(E.limitIssues(s, { kg: 20, h: 2000, w: 1100, th: 19, n: 2 }).some(i => i.k === "w"), true);
    assert.equal(E.limitIssues(s, { kg: 20, h: 2000, w: 1100, th: 19, n: 3 }).some(i => i.k === "w"), false);     // 3 uși: 750–1350
  });
  test("raportul înălțime/lățime: TH ≤ 3 × TB (XL), H ≤ 2 × TB (SlideLine M)", () => {
    assert.ok(E.limitIssues(E.get("het_topline_xl"), { kg: 10, h: 2000, w: 600, th: 19, n: 2 }).some(i => i.k === "ratio"));
    assert.ok(!E.limitIssues(E.get("het_topline_xl"), { kg: 10, h: 1800, w: 600, th: 19, n: 2 }).some(i => i.k === "ratio"));
    assert.ok(E.limitIssues(E.get("het_slideline_m_ov"), { kg: 10, h: 1300, w: 600, th: 19, n: 2 }).some(i => i.k === "ratio"));
  });
  test("lim cu null nu se verifică (Häfele F-Line31: înălțimea/lățimea maximă necitite)", () => {
    assert.equal(E.limitIssues(E.get("haf_fline31_40a"), { kg: 30, h: 9999, w: 9999, th: 19, n: 2 }).length, 0);
    assert.ok(E.limitIssues(E.get("haf_fline31_40a"), { kg: 41, h: 1, w: 1, th: 19, n: 2 }).some(i => i.k === "kg"));
  });
});

describe("BOM: alegerea codurilor", () => {
  const codes = r => r.bom.map(b => b.code);
  test("TopLine XL: setul după grosime și greutate, Silent după greutate, profilul 4000, un dispozitiv de reglare pe ușă", () => {
    const r = E.planSlide(E.get("het_topline_xl"), Object.assign({}, BASE, { frontW: 1800, Lint: 1762, L: 1800 }));
    assert.equal(J(codes(r)), J(["9 275 796", "9 276 735", "9 278 657", "9 252 651"]));
    assert.equal(r.bom.find(b => b.code === "9 252 651").qty, 2);
    const t3 = E.planSlide(E.get("het_topline_xl"), Object.assign({}, BASE, { n: 3 })); assert.equal(codes(t3)[0], "9 275 786");
  });
  test("Hawa Combino 35 FS: setul pe număr de uși + șina dublă după lungime (2500 / 3500 / 6000)", () => {
    const a = E.planSlide(E.get("hawa_combino_35_fs"), Object.assign({}, BASE, { frontW: 1800, Lint: 1762 }));
    assert.equal(J(codes(a)), J(["056.3182.073", "056.3010.250"]));
    const b = E.planSlide(E.get("hawa_combino_35_fs"), Object.assign({}, BASE, { n: 3 }));
    assert.equal(J(codes(b)), J(["056.3182.074", "056.3010.250"]));
    const c = E.planSlide(E.get("hawa_combino_35_fs"), Object.assign({}, BASE, { Lint: 3000 })); assert.equal(codes(c)[1], "056.3010.350");
  });
  test("SlideLine M overlay: profil după grosimea panoului (15–16 / 18–19 / 25), setul Silent după lățime", () => {
    const r = E.planSlide(E.get("het_slideline_m_ov"), Object.assign({}, BASE, { frontW: 1200, Lint: 1162, sth: 19, L: 1200 }));
    assert.ok(codes(r).includes("9 209 218")); assert.ok(codes(r).includes("9 156 338") || codes(r).includes("9 201 921"));
    const r2 = E.planSlide(E.get("het_slideline_m_ov"), Object.assign({}, BASE, { frontW: 1200, Lint: 1162, sth: 22, L: 1200 }));
    assert.ok(r2.warn.some(w => w.k === "nocode"), "22 mm nu are profil în sursă: se spune, nu se alege");
  });
  test("lățimea sub 450 mm cu Silent → varianta fără Silent (min 300)", () => {
    const r = E.planSlide(E.get("het_slideline_m_ov"), Object.assign({}, BASE, { frontW: 400, Lint: 362, sth: 19, L: 400, n: 2, ovGen: 0 }));
    assert.ok(codes(r).includes("9 156 339"), codes(r).join());
  });
  test("Häfele F-Flush52: seturile pe lățimea ușii (450→908 … 900→1808)", () => {
    const r = E.planSlide(E.get("haf_fflush52_20a"), Object.assign({}, BASE, { frontW: 1200, Lint: 1162, L: 1200 }));
    assert.ok(codes(r).includes("407.40.091"), codes(r).join());   // ușa de (1200 + 40)/2 = 620 → seria pentru uși până la 750 (track 1508)
  });
});

describe("Uși escamotabile: formulele producătorilor", () => {
  test("Blum REVEGO uno (EB = lățimea interioară 562, ET = adâncimea interioară 580): FB = EB − 2·Fs (Fs 2 mm la front 18–20), POT = ET − 2 − FD, NL = min(POT − 103, FB + 8), FU = FB − NL + 15", () => {
    const r = E.planPocket(E.get("blum_revego_uno"), POCKET), x = r.extra;
    assert.equal(x.Fs, 2); assert.equal(x.FB, 558); assert.equal(x.ET, 580); assert.equal(x.POT, 559); assert.equal(x.LWA, 462);
    assert.equal(x.NL, 456); assert.equal(x.NLnom, 500); assert.equal(x.FU, 117); assert.equal(r.ws[0], 558);
    assert.equal(r.open.E, 558 - 117); assert.equal(r.open.M, 117);
    assert.equal(r.aH, 1960 - 6); assert.equal(r.y0, 99 + 3); assert.equal(r.z1, 600); assert.equal(r.z0, 581);      // în deschidere, fața la muchia din față
  });
  test("Fs după grosimea frontului: 18–20 → 2 · 20,1–23 → 2,5 · 23,1–26 → 3", () => {
    assert.equal(E.planPocket(E.get("blum_revego_uno"), Object.assign({}, POCKET, { tA: 22 })).extra.Fs, 2.5);
    assert.equal(E.planPocket(E.get("blum_revego_uno"), Object.assign({}, POCKET, { tA: 25 })).extra.Fs, 3);
  });
  test("REVEGO duo: FB = (EB − 2·Fs − Fsm)/2 cu Fsm = 2,0 (minimul din sursă); ambele uși intră în același buzunar", () => {
    const r = E.planPocket(E.get("blum_revego_duo"), Object.assign({}, POCKET, { n: 2, L: 1200, Lint: 1162, sides: ["L", "R"] }));
    assert.equal(r.n, 2); assert.equal(r.ws[0], (1162 - 4 - 2) / 2); assert.equal(J(r.sides), J(["L", "L"]));
    assert.ok(r.xs[1] - r.xs[0] > r.ws[0]);
  });
  test("REVEGO duo: lungimea șinei X = LWA − 12, setul de șină după LWA (cel mai mic nominal ≥ LWA), latura din ușă", () => {
    const r = E.planPocket(E.get("blum_revego_duo"), Object.assign({}, POCKET, { n: 2, L: 1200, Lint: 1162, sides: ["R", "R"] }));
    assert.equal(r.trackLen, 1162 - 150 - 12); assert.ok(r.bom.some(b => b.code === "802L1050DR3"), J(r.bom));
    assert.ok(r.bom.some(b => b.code === "802M0002.R2"));
  });
  test("REVEGO: adâncimea minimă POT 553 (NL 450 + 100 + 3): sub ea avertisment de adâncime", () => {
    const r = E.planPocket(E.get("blum_revego_uno"), Object.assign({}, POCKET, { Pint: 500 }));
    assert.ok(r.warn.some(w => w.k === "depth" && w.lo === 553), J(r.warn));
  });
  test("REVEGO: nr. de uși fix (uno 1, duo 2); numele zonei buzunarului în avertismente; interpretarea EB e declarată", () => {
    const r = E.planPocket(E.get("blum_revego_uno"), Object.assign({}, POCKET, { n: 3 })); assert.equal(r.n, 1);
    assert.ok(r.warn.some(w => w.k === "n")); assert.ok(r.warn.some(w => w.k === "pocket" && w.w === 100)); assert.ok(r.warn.some(w => w.k === "interp"));
  });
  test("REVEGO: lățimea cabinetului în afara 450–900 → avertisment pe EB", () => {
    const r = E.planPocket(E.get("blum_revego_uno"), Object.assign({}, POCKET, { L: 1000, Lint: 962 }));
    assert.ok(r.warn.some(w => w.k === "range" && w.what === "eb"), J(r.warn));
  });
  test("REVEGO: setul de profile după NL, brațul balamalei «de verificat» (intervalele nu sunt în sursă)", () => {
    const r = E.planPocket(E.get("blum_revego_uno"), POCKET);
    assert.ok(r.bom.some(b => b.code === "801P500E.L3")); assert.ok(r.bom.find(b => b.label === "bracket").chk); assert.ok(r.warn.some(w => w.k === "chk" && w.what === "bracket"));
  });
  test("Hawa Concepta III 25: T1 = TB + 92 + Z3 − M, E1 = TB − M, M ≥ S + 3; adâncimea minimă 415 (Z3 = 3)", () => {
    const sys = E.get("hawa_concepta_iii_25_push"), c = Object.assign({}, POCKET, { Lint: 606, Pint: 500 });          // TB = 606 − 2·3 = 600
    const r = E.planPocket(sys, c), x = r.extra;
    assert.equal(x.M, 600 + 92 + 3 - 500 > 22 ? 195 : 22); assert.equal(x.T1, 600 + 92 + 3 - x.M); assert.equal(x.E1, 600 - x.M);
    assert.ok(x.T1 <= 500); assert.equal(r.warn.some(w => w.k === "depth"), false);
    const d = E.planPocket(sys, Object.assign({}, c, { Pint: 400 })); assert.ok(d.warn.some(w => w.k === "depth" && w.lo === 415), J(d.warn));
  });
  test("Hawa Concepta III: greutatea și înălțimea pe variantă (15: 600–1400; 25: 1200–2200; 35: 1900–2700)", () => {
    const c = Object.assign({}, POCKET, { Lint: 606, Pint: 500 });
    assert.ok(E.planPocket(E.get("hawa_concepta_iii_15_push"), c).warn.some(w => w.k === "range" && w.what === "h"));
    assert.ok(!E.planPocket(E.get("hawa_concepta_iii_25_push"), c).warn.some(w => w.k === "range" && w.what === "h"));
    assert.ok(E.planPocket(E.get("hawa_concepta_iii_35_push"), Object.assign({}, c, { Hint: 1850 })).warn.some(w => w.k === "range" && w.what === "h"));
  });
  test("Hettich KA 5740: B = LKB − 7, H = LKH − 6, Y = TD + 2, MKT = B1 + Y + Z", () => {
    const r = E.planPocket(E.get("het_ka_5740"), Object.assign({}, POCKET, { Lint: 562, Hint: 1000, Pint: 700 })), x = r.extra;
    assert.equal(x.B, 555); assert.equal(x.H, 994); assert.equal(x.Y, 21); assert.equal(x.nl, 600); assert.equal(x.B1, 602); assert.equal(x.MKT, 602 + 21 + 3); assert.equal(x.B2, 506);
    assert.equal(r.aH, 994); assert.equal(r.open.t, "slide"); assert.equal(r.open.dz, 506);
    assert.equal(r.warn.some(w => w.k === "depth"), false);
    assert.ok(E.planPocket(E.get("het_ka_5740"), Object.assign({}, POCKET, { Lint: 562, Hint: 1000, Pint: 600 })).warn.some(w => w.k === "depth" && w.lo === 626));
    assert.ok(r.bom.some(b => b.code === "0 041 377"), J(r.bom));
  });
  test("Häfele F-Park71: ghidajul cel mai lung care încape, suprapunere = lățime − retragere, balamale din tabel (3+2 la 1801–2300)", () => {
    const c = Object.assign({}, POCKET, { Lint: 606, Hint: 2006, Pint: 450 });          // ușă 600 × 2000, inset (Infront)
    const r = E.planPocket(E.get("haf_fpark71_25b"), c);
    assert.equal(r.extra.guideLen, 440); assert.equal(r.extra.retract, 326); assert.equal(r.extra.overlay, 600 - 326 - 19); assert.equal(r.hingesN, 5);
    assert.equal(E.planPocket(E.get("haf_fpark71_25b"), Object.assign({}, c, { Hint: 1706 })).hingesN, 4);
    assert.ok(E.planPocket(E.get("haf_fpark71_25b"), Object.assign({}, c, { Pint: 300 })).warn.some(w => w.k === "noguide"));
  });
  test("sisteme fără formule (Concepta 40/50, Pocket Hideaway): numai limite, cu avertisment", () => {
    const r = E.planPocket(E.get("hawa_concepta_40"), Object.assign({}, POCKET, { Lint: 506, Hint: 2006 }));
    assert.ok(r.warn.some(w => w.k === "only")); assert.equal(r.open.t, "none");
  });
});

describe("Foi pe șină (wing)", () => {
  const W = { packs: 1, leaves: 2, leafW: 450, leafH: 1689, tA: 19, Pint: 480, dens: 650, Lint: 862, side: "L" };
  test("WingLine L: balamale centrale din tabelul producătorului (≤1000/8 kg → 2 · ≤1700/14 → 3 · ≤2200/17 → 4 · ≤2400/25 → 5)", () => {
    const s = E.get("het_wingline_l");
    assert.equal(E.planWing(s, Object.assign({}, W, { leafH: 900 })).hinges, 2);
    assert.equal(E.planWing(s, W).hinges, 3);
    assert.equal(E.planWing(s, Object.assign({}, W, { leafH: 2100 })).hinges, 4);
    assert.equal(E.planWing(s, Object.assign({}, W, { leafH: 2300 })).hinges, 5);
  });
  test("WingLine L: setul 12 kg sub 12 kg, 25 kg peste; balamalele 4 = 2 seturi de 2, 5 = 2 + 3 (seturile din catalog)", () => {
    const s = E.get("het_wingline_l"), a = E.planWing(s, Object.assign({}, W, { leafH: 900, leafW: 300 })), b = E.planWing(s, Object.assign({}, W, { leafH: 2300, leafW: 600 }));
    assert.ok(a.bom.some(l => l.code === "9 277 991")); assert.ok(b.bom.some(l => l.code === "9 278 485"));
    assert.equal(b.bom.filter(l => l.label === "hinge").map(l => l.code).join(), "9 278 694,9 278 742");
    assert.ok(a.bom.find(l => l.code === "9 278 694").qty === 1);
  });
  test("WingLine L: lățimea foii 250–600, înălțimea 500–2400 → avertismente în afară", () => {
    const s = E.get("het_wingline_l");
    assert.ok(E.planWing(s, Object.assign({}, W, { leafW: 700 })).warn.some(w => w.k === "range" && w.what === "w"));
    assert.ok(E.planWing(s, Object.assign({}, W, { leafH: 2600 })).warn.some(w => w.k === "range" && w.what === "h"));
  });
  test("Folding Concepta III 25: M2 ≥ S + 75, M2 ≤ TB − 250, T2 = TB + 92 + Z3 − M2, E2 = TB − M2", () => {
    const s = E.get("hawa_folding_concepta_iii_25_push"), r = E.planWing(s, { packs: 1, leaves: 2, leafW: 600, leafH: 2000, tA: 19, Pint: 450, dens: 650, Lint: 862, side: "L" }), x = r.extra;
    assert.equal(x.M2, Math.max(19 + 75, 600 + 92 + 3 - 450)); assert.equal(x.T2, 600 + 92 + 3 - x.M2); assert.equal(x.E2, 600 - x.M2);
    assert.ok(E.planWing(s, { packs: 1, leaves: 2, leafW: 600, leafH: 2000, tA: 19, Pint: 300, dens: 650, Lint: 862, side: "L" }).warn.some(w => w.k === "depth"));
  });
  test("WingLine S / 230 / Wing 77: numai limite, cu avertisment", () => {
    const r = E.planWing(E.get("het_wingline_s"), Object.assign({}, W, { leafH: 900, leafW: 300 }));
    assert.ok(r.warn.some(w => w.k === "only")); assert.equal(r.bom.length, 0);
    assert.ok(E.planWing(E.get("het_wingline_s"), Object.assign({}, W, { leafH: 1200, leafW: 300 })).warn.some(w => w.k === "range" && w.what === "h"));
  });
});

describe("Toate sistemele rulează fără erori și dau numere finite", () => {
  const finite = o => J(o).indexOf("null") < 0 || true;
  test("planSlide / planPocket / planWing pe contexte tipice, pentru fiecare sistem", () => {
    DATA.systems.forEach(s => {
      if (s.kind === "slide") {
        const r = E.planSlide(s, BASE); assert.ok(isFinite(r.aW) && isFinite(r.aH) && isFinite(r.ov) && r.xs.every(isFinite) && r.zs.every(isFinite), s.key);
        r.bom.forEach(b => assert.ok(b.qty > 0 && E.codeOf(b.code), s.key + b.code));
      } else if (s.kind === "pocket") {
        const r = E.planPocket(s, Object.assign({}, POCKET, { n: (s.leaves || [1])[0], sides: ["L", "R"] })); assert.ok(isFinite(r.aH) && r.ws.every(isFinite) && r.xs.every(isFinite), s.key);
        r.bom.forEach(b => assert.ok(b.qty > 0 && E.codeOf(b.code), s.key + b.code));
      } else {
        const r = E.planWing(s, { packs: 2, leaves: (s.leaves || [2])[0], leafW: 400, leafH: 1500, tA: 19, Pint: 500, dens: 650, Lint: 1000, side: "L", sides: ["L", "R"] }); assert.ok(isFinite(r.kg), s.key);
        r.bom.forEach(b => assert.ok(b.qty > 0 && E.codeOf(b.code), s.key + b.code));
      }
    });
  });
  test("fiecare avertisment are text în toate limbile (noteText)", () => {
    const tf = L => k => I18N[L][k] || I18N.it[k] || k;
    const all = [];
    DATA.systems.forEach(s => {
      if (s.kind === "slide") all.push.apply(all, E.planSlide(s, BASE).warn);
      else if (s.kind === "pocket") all.push.apply(all, E.planPocket(s, Object.assign({}, POCKET, { Lint: 806, Pint: 300 })).warn);
      else all.push.apply(all, E.planWing(s, { packs: 1, leaves: 2, leafW: 800, leafH: 2600, tA: 19, Pint: 200, dens: 650, Lint: 1000, side: "L" }).warn);
    });
    all.forEach(w => LANGS.forEach(L => { const m = E.noteText(w, tf(L)); assert.ok(m && !/\{\w+\}/.test(m) && !/undefined/.test(m), L + " " + J(w) + " → " + m); }));
  });
});
