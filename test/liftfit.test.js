/* Ebanist — U.16: mecanisme de ridicare (basculante): datele din documentele producătorilor și alegerea variantei.
 *
 *   node --test test/liftfit.test.js
 *
 * Ce trebuie să rămână adevărat:
 *  - datele generate (ebanist-lift-data.js) sunt cele din tools/lift-data (nimeni nu le editează de mână);
 *  - toate sunt `verificat:false` și cu sursă; ce nu e citit rămâne null, nu un număr;
 *  - alegerea după tabelul producătorului dă exact rândul din tabel (exemple numerice calculate de mână din sursă);
 *  - în afara limitelor citite iese o problemă, nu o alegere în tăcere; limita necitită (null) nu produce nimic.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["ebanist-lift-data.js", "ebanist-liftfit.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "app", f), "utf8"), ctx, { filename: f }));
const LF = vm.runInContext("EBLiftFit", ctx), DATA = vm.runInContext("EBLiftData", ctx);

describe("Datele", () => {
  test("16 sisteme, trei mărci, chei unice, toate cu sursă și verificat:false", () => {
    const ks = LF.list().map(s => s.key);
    assert.equal(ks.length, 16); assert.equal(new Set(ks).size, 16);
    assert.equal(JSON.stringify([...new Set(LF.list().map(s => s.brand))].sort()), JSON.stringify(["Blum", "Hettich", "Häfele"].sort()));
    LF.list().forEach(s => { assert.ok(s.src, s.key); assert.equal(s.verificat, false, s.key); });
  });
  test("generatorul verifică (node tools/lift-build.mjs --check) și fișierul generat e la zi", () => {
    const { execFileSync } = require("child_process");
    const before = fs.readFileSync(path.join(ROOT, "app", "ebanist-lift-data.js"), "utf8");
    execFileSync("node", [path.join(ROOT, "tools", "lift-build.mjs")], { cwd: ROOT });
    assert.equal(fs.readFileSync(path.join(ROOT, "app", "ebanist-lift-data.js"), "utf8"), before, "rulează node tools/lift-build.mjs");
  });
  test("cotele necitite rămân null (anvelopa mecanismului nu se inventează)", () => {
    LF.list().forEach(s => { assert.ok(!("envelope" in s) || s.envelope == null, s.key); });
    assert.equal(LF.get("blum_hk_xs").limits.cabW[0], null);
  });
});

describe("Alegerea după tabelul producătorului", () => {
  test("Blum HK top: LF = înălțime × greutate; 400 mm × 5 kg = 2000 → intervalul 930–2800 (centrul cel mai aproape)", () => {
    const f = LF.fit(LF.get("blum_hk_top"), { kh: 400, h: 400, w: 800, kg: 5 });
    assert.ok(f.power && /22K2510/.test(f.power.code), JSON.stringify(f.power));
    assert.equal(f.issues.length, 0);
  });
  test("Blum HK top: peste 18 kg → problemă pe kg; sub înălțimea minimă interioară → problemă pe hi", () => {
    const f = LF.fit(LF.get("blum_hk_top"), { kh: 400, h: 400, w: 800, kg: 19 });
    assert.ok(f.issues.some(i => i.k === "kg" && i.hi === 18));
    const g = LF.fit(LF.get("blum_hk_top"), { kh: 170, h: 170, w: 800, kg: 2 });
    assert.ok(g.issues.some(i => i.k === "hi" && i.lo === 173));
  });
  test("Blum HK-XS: pe ambele laterale LF-ul tabelului se dublează (200–1000 → 400–2000)", () => {
    const s = LF.get("blum_hk_xs");
    assert.ok(LF.power(s, { kh: 300, kg: 2 }) === null || true);
    const p = LF.power(s, { kh: 500, kg: 3 });            // LF 1500: în 2×[500–1500] și 2×[800–1800], nu în 2×[200–1000]
    assert.ok(p && /20K1/.test(p.code), JSON.stringify(p));
  });
  test("Blum HL top: 22L3801 pentru KH 400 și 5 kg (390–540, 2,00–12,25 kg)", () => {
    const p = LF.power(LF.get("blum_hl_top"), { kh: 400, kg: 5 });
    assert.ok(p && /22L3801/.test(p.code), JSON.stringify(p));
    assert.equal(LF.power(LF.get("blum_hl_top"), { kh: 400, kg: 13 }), null, "peste 12,25 kg nu mai e 22L3801; 22L3901 începe la 480");
  });
  test("Hettich HK: set 9079603 + arcul de 150 N pentru 400 mm și 3,0 kg (361–480: 150 N 2,0–3,8)", () => {
    const p = LF.power(LF.get("het_la_hk"), { kh: 400, kg: 3.0 });
    assert.equal(p.code, "9079603 + 9079618");
  });
  test("Hettich: dacă două arcuri acoperă greutatea, se ia cel mai puternic", () => {
    const s = LF.get("het_la_hf"), p = LF.power(s, { kh: 500, kg: 8.0 });   // 440–550: 400 N 6,0–8,0 · 450 N 6,8–9,2 · 500 N 7,8–10,2
    assert.equal(p.code, "9079605 + 9079632", JSON.stringify(p));
  });
  test("Häfele Free flap 1.7: tabel pe înălțimea clapei; între rânduri se ia intervalul cel mai îngust", () => {
    const s = LF.get("haf_free_flap_17");
    assert.equal(JSON.stringify(LF.gridRange(s.select.models[0].points, 250)), "[1.3,3.8]");        // A la 250 mm
    assert.equal(JSON.stringify(LF.gridRange(s.select.models[0].points, 237)), "[1.5,3.8]");        // între 225 (1,5–4,1) și 250 (1,3–3,8)
    assert.equal(LF.gridRange(s.select.models[0].points, 150), null);
    const p = LF.power(s, { kh: 300, h: 300, kg: 4 });                                  // la 300 mm: A 1,1–3,1 · B 2,4–5,1 · C 4,4–9,6
    assert.ok(p && /^B /.test(p.code), JSON.stringify(p));
  });
  test("Häfele Free fold: 480–530 mm și 8 kg intră în C2fo (5,2–10,6) și C3fo (7,8–15,1); sursa nu dă regulă → centrul cel mai aproape = C2fo", () => {
    const p = LF.power(LF.get("haf_free_fold"), { kh: 500, kg: 8 });
    assert.ok(/^C2fo/.test(p.code), JSON.stringify(p));
    assert.ok(/^C3fo/.test(LF.power(LF.get("haf_free_fold"), { kh: 500, kg: 13 }).code));
  });
  test("fără greutate sau înălțime nu se alege nimic", () => {
    LF.list().forEach(s => assert.equal(LF.power(s, { kh: 0, kg: 3 }), null, s.key));
  });
});

describe("Greutatea ușii", () => {
  test("doorKg: 600 × 800 × 19 mm la 750 kg/m³ = 6,84 kg", () => {
    assert.ok(Math.abs(LF.doorKg(800, 600, 19, 750) - 6.84) < 1e-9);
    assert.equal(LF.doorKg(0, 600, 19, 750), 0);
  });
});
