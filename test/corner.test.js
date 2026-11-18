/* Ebanist — U.17: unități de colț, scoase pentru corpuri joase și înalte, mecanisme de mișcare (date, potrivire, texte).
 *
 *   node --test test/corner.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - datele sunt generate (nimeni nu le editează de mână) și fiecare număr din ele se găsește în înregistrarea brută din care vin (tools/hw-data/raw);
 *  - alegerea mărimii și regulile de potrivire dau exact ce spun tabelele (exemple calculate din cifrele din surse);
 *  - ce nu e citit rămâne null și nu produce verificări; nimic nu e „verificat”;
 *  - textele au toate cele 7 limbi, cu aceleași {substituții}.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["ebanist-corner-data.js", "ebanist-cornerfit.js", "ebanist-corner-i18n.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "app", f), "utf8"), ctx, { filename: f }));
const F = vm.runInContext("EBCornerFit", ctx), D = vm.runInContext("EBCornerData", ctx);
const A = x => JSON.parse(JSON.stringify(x));   // aduce valorile din contextul vm în realm-ul testului (deepEqual strict)
const I18 = A(vm.runInContext("({ CORNER_I18N, CORNER_LANGS, CORNER_I18N_RAW, CORNER_EL })", ctx));
const U = k => F.get(k);
const RAW = { ...Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, "tools/hw-data/raw/cat-corner.json"), "utf8")).products.map(p => [p.id, p])),
  ...Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, "tools/hw-data/raw/cat-motion.json"), "utf8")).products.map(p => [p.id, p])) };

describe("Date generate din surse", () => {
  test("generatorul trece și fișierul din app e la zi cu units.json", () => {
    const out = cp.execFileSync("node", [path.join(ROOT, "tools/corner-build.mjs"), "--check"], { encoding: "utf8" });
    assert.match(out, /unități/);
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/hw-data/corner/units.json"), "utf8"));
    assert.equal(JSON.stringify(j.units), JSON.stringify(D.units), "ebanist-corner-data.js nu e la zi: rulează node tools/corner-build.mjs");
  });
  test("57 de unități, toate cele 11 feluri, chei unice, nimic «verificat»", () => {
    assert.ok(D.units.length >= 57);
    assert.equal(new Set(D.units.map(u => u.key)).size, D.units.length);
    assert.deepEqual([...new Set(A(D.units).map(u => u.kind))].sort(), ["blind", "bracket", "carousel", "cdrawer", "pulldown", "pullout", "spin", "tall", "tvlift", "turntable", "wardlift"].sort());
    D.units.forEach(u => { assert.equal(u.verificat, false, u.key); assert.ok(u.src, u.key); });
  });
  test("fiecare număr (în afară de numărătoare 0–8) se găsește în înregistrarea brută a produsului", () => {
    const toks = o => { const s = JSON.stringify(o), out = new Set(); for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) out.add(parseFloat(m[0])); return out; };
    const nums = (o, p, acc) => { if (typeof o === "number") acc.push([p, o]); else if (Array.isArray(o)) o.forEach((v, i) => nums(v, p + "[" + i + "]", acc)); else if (o && typeof o === "object") for (const k in o) nums(o[k], p + "/" + k, acc); return acc; };
    const SKIP = new Set(["interp", "notes", "src", "key", "raw", "name", "brand", "codes"]), bad = [];
    for (const u of D.units) {
      const T = toks(RAW[u.raw]); assert.ok(RAW[u.raw], u.key + ": înregistrare brută lipsă");
      for (const k in u) { if (SKIP.has(k)) continue; nums(u[k], k, []).forEach(([p, n]) => { if (n >= 0 && n <= 8) return; if (!T.has(n)) bad.push(u.key + " " + p + "=" + n); }); }
    }
    assert.deepEqual(bad, []);
  });
  test("textele din `notes` și toate cheile din date au traducere", () => {
    const T = I18.CORNER_I18N_RAW;
    D.units.forEach(u => (u.notes || []).forEach(k => assert.ok(T[k], u.key + ": lipsește " + k)));
    D.units.map(u => u.kind).forEach(k => assert.ok(T["cuKind_" + k], "cuKind_" + k));
  });
});

describe("Alegerea mărimii și potrivirea (exemple calculate din tabele)", () => {
  const d = (o) => Object.assign({ L: 900, H: 720, P: 560, wi: 860, hi: 600, depth: 540, body: "base" }, o);
  test("LeMans II: cea mai lată ușă la care încape lățimea interioară (764 / 800 / 910 / 960)", () => {
    const u = U("kb_lemans2");
    assert.equal(F.pickSize(u, d({ wi: 780 })).id, "400");
    assert.equal(F.pickSize(u, d({ wi: 850 })).id, "450");
    assert.equal(F.pickSize(u, d({ wi: 950 })).id, "500");
    assert.equal(F.pickSize(u, d({ wi: 1000 })).id, "600");
    assert.equal(F.pickSize(u, d({ wi: 700 })).id, "400", "nimic nu încape: cea mai îngustă");
    assert.equal(F.pickSize(u, d({ wi: 850 }), "600").id, "600", "alegerea omului are prioritate");
  });
  test("LeMans II: limitele din tabel dau probleme, nu o alegere în tăcere", () => {
    const u = U("kb_lemans2"), r = F.fit(u, d({ wi: 700, hi: 580, depth: 480 }));
    const k = r.issues.map(i => i.k).sort();
    assert.deepEqual(A(k), ["band", "depth", "wi"]);
    assert.equal(r.issues.find(i => i.k === "wi").lo, 764);
    assert.equal(r.issues.find(i => i.k === "depth").lo, 500);
    assert.equal(r.issues.find(i => i.k === "band").lo, 600); assert.equal(r.issues.find(i => i.k === "band").hi, 900);
    assert.equal(F.fit(u, d({ wi: 850, hi: 700, depth: 520 })).issues.length, 0);
  });
  test("LeMans II: axa după înălțimea interioară (600–750, 650–800, 720–900): prima care o conține", () => {
    const u = U("kb_lemans2");
    assert.equal(F.pickBand(u, 610).code, "00 7944");
    assert.equal(F.pickBand(u, 790).code, "00 7958");
    assert.equal(F.pickBand(u, 850).code, "00 7945");
    assert.equal(F.pickBand(u, 590), null);
  });
  test("Salso: A/B din planificare, înălțime 620–820, adâncime 465", () => {
    const u = U("hettich_salso");
    assert.deepEqual(A(u.sizes.map(s => s.wi[0])), [760, 860, 960, 960]);
    assert.deepEqual(A(u.sizes.map(s => s.open[0])), [360, 410, 460, 560]);
    const r = F.fit(u, d({ wi: 850, hi: 600, depth: 460 }), { size: "450" });
    assert.deepEqual(A(r.issues.map(i => i.k)).sort(), ["depth", "hi", "wi"]);
  });
  test("Peka Magic Corner Comfort: lățimea interioară are și limită de sus (LB 862–971)", () => {
    const u = U("peka_magic_corner_comfort");
    assert.equal(F.fit(u, d({ wi: 1100 }), { size: "450/900" }).issues.find(i => i.k === "wi").hi, 971);
    assert.equal(F.fit(u, d({ wi: 900, hi: 600, depth: 520 }), { size: "450/900" }).issues.filter(i => i.k === "wi").length, 0);
  });
  test("Dispensa VVS-x: baterii de coșuri după înălțime (3/4/5/6), intervalele care se suprapun: prima potrivire", () => {
    const u = U("kb_dispensa_vvsx");
    assert.equal(F.pickBand(u, 1000).n, 3); assert.equal(F.pickBand(u, 1500).n, 4);
    assert.equal(F.pickBand(u, 1850).n, 5, "1850 e și în 1800–2200, dar prima care o conține e 1600–2000");
    assert.equal(F.pickBand(u, 2100).n, 6);
    assert.equal(F.pickBand(u, 800), null);
    assert.deepEqual(A(u.sizes.map(s => s.basketW)), [100, 150, 250, 350, 400]);
    assert.equal(u.draw.basketH, 94); assert.equal(u.draw.basketD, 462);
    assert.equal(u.load.basket, 18); assert.equal(u.load.total, 120);
  });
  test("lățimea nominală a unui scos: alegerea cea mai apropiată; altă lățime = problemă «cab»", () => {
    const u = U("kb_dispensa_vvsx");
    assert.equal(F.pickSize(u, { L: 300 }).id, "300"); assert.equal(F.pickSize(u, { L: 420 }).id, "400");
    assert.equal(F.fit(u, { L: 500, hi: 1500, depth: 560, wi: 462, body: "tall" }).issues.find(i => i.k === "cab").lo, 450);
    assert.equal(F.fit(u, { L: 450, hi: 1500, depth: 560, wi: 412, body: "tall" }).issues.length, 0);
  });
  test("Tandem: înălțimile 600/800/1100/1700 sunt praguri (cel mai mare ≤ înălțime)", () => {
    const u = U("kb_tandem_ii_side");
    assert.equal(F.pickBand(u, 900).code, "800"); assert.equal(F.pickBand(u, 1700).code, "1700"); assert.equal(F.pickBand(u, 500), null);
  });
  test("carusel: discul (diametrul din sursă) trebuie să încapă în pătratul interior", () => {
    const u = U("kb_carousel");
    assert.equal(u.sizes[0].dia, 720); assert.equal(u.sizes[1].dia, 800);
    const r = F.fit(u, { L: 800, wi: 700, depth: 700, hi: 700, body: "base" }, { size: "800" });
    assert.deepEqual(A(r.issues.filter(i => i.k === "dia").map(i => i.axis)).sort(), ["d", "w"]);
    assert.equal(F.fit(u, { L: 800, wi: 760, depth: 760, hi: 700, body: "base" }, { size: "800" }).issues.length, 0);
    assert.equal(U("hettich_carousel").sizes[0].axis, 360, "axa la 360 / 420 mm de pereți");
  });
  test("FurnSpin: caseta B, jocul de mișcare, spațiul liber și înălțimea corpului rotativ", () => {
    const u = U("hettich_furnspin");
    assert.equal(F.pickSize(u, { wi: 700, depth: 700 }).id, "XL", "cea mai mare mărime a cărei casetă (564) încape cu jocul 7");
    const r = F.fit(u, { L: 800, H: 1900, wi: 464, depth: 500, hi: 1800, body: "tall" }, { size: "M" });
    assert.ok(r.info.spin && r.info.spin.B <= 515 && r.info.spin.B >= 440, JSON.stringify(r.info.spin));
    assert.equal(r.info.spin.H, 1800 - 80, "înălțimea rotativului = interior minus cele două fitinguri de 40");
    const tight = F.fit(u, { L: 500, H: 1900, wi: 400, depth: 400, hi: 1800, body: "tall" }, { size: "XL" });
    assert.ok(tight.issues.some(i => i.k === "bbox") && tight.issues.some(i => i.k === "free"));
    const hiH = F.fit(u, { L: 800, H: 2300, wi: 600, depth: 600, hi: 2250, body: "tall" }, { size: "S" });
    assert.ok(hiH.issues.some(i => i.k === "spinH" && i.hi === 2000), "peste înălțimea recomandată din certificat");
    assert.equal(u.sizes[0].half, 169.5);
  });
  test("console: greutatea ușii față de sarcina pe pereche", () => {
    const u = U("hafele_fold_hinged_spring");
    assert.ok(F.fit(u, { L: 600, wi: 560, hi: 600, depth: 300, doorKg: 55, body: "base" }).issues.some(i => i.k === "kg" && i.hi === 40));
    assert.equal(F.fit(u, { L: 600, wi: 560, hi: 600, depth: 300, doorKg: 12, body: "base" }).issues.length, 0);
  });
  test("platou rotativ: spațiul 425 × 285 și rotația completă", () => {
    const u = U("hettich_comfortspin");
    assert.equal(F.fit(u, { wi: 400, depth: 300, hi: 500, L: 440, body: "base" }).issues.find(i => i.k === "wi").lo, 425);
    assert.ok(F.fit(u, { wi: 500, depth: 400, hi: 500, L: 540, body: "base" }).issues.some(i => i.k === "rot"));
  });
  test("tipul corpului: bază / înalt / agățat; nepotrivirea e problemă «body»", () => {
    assert.equal(F.bodyOf({ H: 720, support: "zoccolo" }), "base"); assert.equal(F.bodyOf({ H: 2000, support: "zoccolo" }), "tall"); assert.equal(F.bodyOf({ H: 720, support: "sospeso" }), "wall");
    assert.ok(F.fit(U("hafele_easy_down"), { L: 500, wi: 462, hi: 600, depth: 300, body: "base" }).issues.some(i => i.k === "body" && i.want === "wall"));
  });
  test("ce nu e citit nu produce verificări (null): SPACE CORNER nu are limită de lățime", () => {
    const r = F.fit(U("blum_space_corner"), { L: 300, wi: 262, hi: 300, depth: 600, body: "base" });
    assert.equal(r.issues.filter(i => i.k === "cab" || i.k === "wi").length, 0);
    assert.equal(U("blum_space_corner").limits.cab, undefined);
  });
  test("coduri: cele ale mărimii alese și ale variantei de înălțime", () => {
    const u = U("kb_lemans2"), c = F.codes(u, u.sizes[1], F.pickBand(u, 700)).map(x => x.code);
    assert.ok(c.includes("03 7920 / 03 7921") && c.includes("07 7920 / 07 7921") && !c.includes("03 7918 / 03 7919"));
    assert.ok(c.includes("00 7944"));
  });
});

describe("Texte în 7 limbi", () => {
  const I = I18;
  const sub = s => (String(s).match(/\{[A-Za-z]+\}/g) || []).sort().join(",");
  test("fiecare cheie are toate cele 7 limbi, nevide, cu aceleași {substituții}", () => {
    assert.deepEqual(I.CORNER_LANGS, ["it", "ro", "en", "fr", "de", "pl", "es"]);
    for (const k in I.CORNER_I18N_RAW) {
      const a = I.CORNER_I18N_RAW[k]; assert.equal(a.length, 7, k);
      a.forEach((v, i) => { assert.ok(typeof v === "string" && v.length > 0, k + "[" + i + "]"); assert.equal(sub(v), sub(a[0]), k + " (" + I.CORNER_LANGS[i] + "): {substituții} diferite"); });
    }
  });
  test("numele rândurilor din distinctă sunt traduse în cele 6 limbi non-italiene", () => {
    ["Fronte estraibile", "Piano ribaltabile"].forEach(n => ["ro", "en", "fr", "de", "pl", "es"].forEach(l => assert.ok(I.CORNER_EL[l][n] && I.CORNER_EL[l][n] !== n, n + " " + l)));
  });
  test("avertismentul de foraurare există în toate limbile", () => {
    I.CORNER_LANGS.forEach(l => assert.ok(I.CORNER_I18N[l].opsCornerNoDrill.length > 40));
  });
});
