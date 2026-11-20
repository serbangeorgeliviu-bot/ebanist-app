/* Ebanist — deschidere în față la corpurile rotund / oval / racordat (D-171, 5.94.0).
 *
 *   node --test test/open-front.test.js
 *
 * Fără `rOpen` totul e ca înainte (distinta, 3D, găurire neschimbate). Cu `rOpen` (grade la rotund/oval, mm la racordat) fâșia nu mai înconjoară tot corpul:
 *  - rotund/oval: un singur arc, cu lungimea arcului rămas; frontul nu mai are prindere, lateralele da (poziții pe lungimea arcului);
 *  - racordat: două fâșii (stânga/dreapta), fiecare de la spate în jurul unui colț până la marginea deschiderii;
 *  - valori în afara limitelor = eroare declarată, nu piese greșite.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });

function build(cfg) {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "O", L2: 900, tram: 0, drawers: 0, doors: 0, back: 0, hang: 0, matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return { b, full, ops: () => JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: undefined }))) };
}
const strips = r => r.b.boxes.filter(x => x.role === "fianco" && x.dev);
const J = x => JSON.stringify(x);
const TON = { type: "tondo", L: 600, P: 600, H: 1200, shelves: 3 };
const RAC = { type: "raccordato", L: 900, P: 450, H: 1400, shelves: 3, rcorner: 80, back: 1 };

describe("fără deschidere = ca înainte", () => {
  test("rotund: rOpen lipsă, 0 sau negativ dau aceeași distinctă și același 3D", () => {
    const a = build(TON), b = build({ ...TON, rOpen: 0 }), c = build({ ...TON, rOpen: -5 });
    assert.equal(J(a.b.pieces), J(b.b.pieces)); assert.equal(J(a.b.pieces), J(c.b.pieces));
    assert.equal(J(a.b.boxes), J(b.b.boxes));
    assert.equal(strips(a)[0].ring.open, false); assert.equal(strips(a)[0].dev.open, undefined);
  });
  test("racordat: la fel", () => {
    const a = build(RAC), b = build({ ...RAC, rOpen: 0 });
    assert.equal(J(a.b.pieces), J(b.b.pieces)); assert.equal(J(a.b.boxes), J(b.b.boxes)); assert.equal(strips(a).length, 1);
  });
  test("o valoare rOpen pe alt tip nu face nimic", () => {
    const base = { type: "standard", L: 800, H: 720, P: 350, shelves: 1, doors: 2, plinth: 0, support: "sospeso" };
    assert.equal(J(build(base).b.pieces), J(build({ ...base, rOpen: 120 }).b.pieces));
  });
});

describe("rotund / oval cu deschidere în față", () => {
  test("fâșia = arcul rămas: cerc 600, deschidere 120° → 2/3 din circumferință", () => {
    const o = build({ ...TON, rOpen: 120 }), c = build(TON), s = strips(o)[0], full = strips(c)[0].dev.len;
    assert.equal(strips(o).length, 1);
    assert.ok(Math.abs(s.dev.len - full * 240 / 360) < 0.05, s.dev.len + " vs " + full * 2 / 3);
    const row = o.b.pieces.find(p => /^Fascia/.test(p.elemento)); assert.equal(row.lung, Math.round(s.dev.len)); assert.equal(row.larg, 1200); assert.equal(row.curve.open, 120);
    assert.equal(row.curve.angle, 240);
  });
  test("ring deschis, cu capetele la marginile deschiderii (față = +z), exterior și interior cu același număr de puncte", () => {
    const s = strips(build({ ...TON, rOpen: 120 }))[0], R = s.ring;
    assert.equal(R.open, true); assert.equal(R.out.length, R.inn.length);
    const [a, z] = [R.out[0], R.out[R.out.length - 1]];
    assert.ok(Math.abs(a[1] - z[1]) < 0.01, "capetele la aceeași adâncime");
    assert.ok(a[1] > 300 && z[1] > 300, "capetele în fața centrului (z > P/2)");
    assert.ok(Math.abs((a[0] - 300) + (z[0] - 300)) < 0.01, "simetrice față de axa de mijloc");
    const gap = Math.abs(a[0] - z[0]); assert.ok(Math.abs(gap - 2 * 300 * Math.sin(Math.PI / 3)) < 0.5, "coarda deschiderii " + gap);
  });
  test("oval: arc mai scurt decât inelul, nu proporțional cu unghiul exact dar monoton", () => {
    const full = strips(build({ ...TON, L: 900, P: 500 }))[0].dev.len;
    let prev = full;
    for (const d of [40, 90, 130, 160]) { const l = strips(build({ ...TON, L: 900, P: 500, rOpen: d }))[0].dev.len; assert.ok(l < prev, d + "° " + l + " ≥ " + prev); prev = l; }
  });
  test("prinderile pe lateral: pozițiile pe arc, simetrice; frontul (în deschidere) nu mai are prindere", () => {
    const r = build({ ...TON, rOpen: 120 }).ops(), p = r.pieces.find(q => q.role === "fianco");
    const xs = [...new Set(p.operations.filter(o => o.type === "drill").map(o => Math.round(o.x)))].sort((a, b) => a - b);
    assert.ok(xs.length >= 2, J(xs)); const len = p.length;
    assert.ok(Math.abs(xs[0] + xs[xs.length - 1] - len) < 2, "simetrice " + J(xs) + " / " + len);
    const closed = build(TON).ops().pieces.find(q => q.role === "fianco");
    assert.ok(p.operations.filter(o => o.type === "drill").length < closed.operations.filter(o => o.type === "drill").length, "fără găurile din față");
  });
  test("limite: sub 20° sau peste 160° = eroare declarată", () => {
    for (const d of [5, 19, 161, 200]) assert.throws(() => build({ ...TON, rOpen: d }), /deschiderea în față trebuie să fie între 20° și 160°/, d + "°");
    for (const d of [20, 160]) build({ ...TON, rOpen: d });
  });
  test("fundul, tavanul și rafturile rămân discuri întregi, în interiorul arcului", () => {
    const b = build({ ...TON, rOpen: 120 }).b.boxes.filter(x => ["base", "cielo", "ripiano"].includes(x.role));
    assert.equal(b.length, 5); b.forEach(x => assert.ok(x.pc && x.pc.length >= 8));
  });
});

describe("racordat cu deschidere în față", () => {
  test("două fâșii, L și R, de lungime egală; distinta spune pz 2", () => {
    const r = build({ ...RAC, rOpen: 400 }), s = strips(r);
    assert.equal(s.length, 2); assert.equal(J(s.map(x => x.dev.which).sort()), J(["L", "R"]));
    const side = 450 - 80, arc = 80 * Math.PI / 2, front = (900 - 160 - 400) / 2;
    s.forEach(x => assert.ok(Math.abs(x.dev.len - (side + arc + front)) < 0.05, J(x.dev)));
    const row = r.b.pieces.find(p => /^Fascia raccordata/.test(p.elemento)); assert.equal(row.pz, 2); assert.equal(row.curve.open, 400);
  });
  test("fâșiile sunt oglindite: mijlocul deschiderii rămâne la L/2 și are lățimea cerută", () => {
    const s = strips(build({ ...RAC, rOpen: 400 })), L = s.find(x => x.dev.which === "L"), R = s.find(x => x.dev.which === "R");
    const endL = L.ring.out[L.ring.out.length - 1], endR = R.ring.out[R.ring.out.length - 1];
    assert.ok(Math.abs(endL[0] - 250) < 0.01 && Math.abs(endR[0] - 650) < 0.01, J([endL, endR]));
    assert.equal(endL[1], 450); assert.equal(endR[1], 450);
    assert.equal(L.ring.out.length, L.ring.inn.length); assert.equal(R.ring.out.length, R.ring.inn.length);
  });
  test("prinderile: pe fiecare fâșie, cele din lateral și din frontul rămas; nimic în deschidere", () => {
    const r = build({ ...RAC, rOpen: 400 }).ops(), ps = r.pieces.filter(p => p.role === "fianco");
    assert.equal(ps.length, 2); assert.equal(ps[0].operations.length, ps[1].operations.length); assert.ok(ps[0].operations.length > 10);
    ps.forEach(p => p.operations.filter(o => o.type === "drill").forEach(o => assert.ok(o.x >= 0 && o.x <= p.length + 0.01, "x " + o.x + " în fâșie")));
  });
  test("limite: sub 100 mm sau mai mare decât frontul drept = eroare declarată", () => {
    for (const w of [50, 99, 750, 900]) assert.throws(() => build({ ...RAC, rOpen: w }), /Corp racordat: deschiderea în față/, w + " mm");
    build({ ...RAC, rOpen: 100 }); build({ ...RAC, rOpen: 738 });
  });
});

describe("ușă în deschidere (B, 5.94.1)", () => {
  const door = r => r.b.boxes.find(x => x.sub === "rdoor");
  const rows = r => r.b.pieces.filter(p => p.role === "frontale");
  test("fără rDoor sau fără deschidere nu apare nicio ușă (corpul de dinainte)", () => {
    assert.equal(door(build({ ...TON, rOpen: 120 })), undefined); assert.equal(rows(build({ ...TON, rOpen: 120 })).length, 0);
    assert.equal(J(build({ ...TON, rDoor: 1 }).b.pieces), J(build(TON).b.pieces), "rDoor fără deschidere se ignoră");
    assert.equal(J(build({ ...RAC, rDoor: 1 }).b.pieces), J(build(RAC).b.pieces));
  });
  test("rotund: ușa e arcul scos din fâșie — fâșia + ușa = circumferința, cu 2 mm rost pe margine", () => {
    const o = build({ ...TON, rOpen: 120, rDoor: 1 }), full = strips(build(TON))[0].dev.len, r = rows(o);
    assert.equal(r.length, 1); assert.match(r[0].elemento, /^Anta curva/);
    const band = strips(o)[0].dev.len, d = r[0].curve.dev;
    assert.ok(Math.abs(band + d + 4 - full) < 0.2, band + " + " + d + " + 4 vs " + full);
    assert.equal(r[0].lung, Math.round(d)); assert.equal(r[0].larg, 1200 - 4); assert.equal(r[0].curve.angle, 120); assert.equal(r[0].curve.door, 1);
    assert.equal(r[0].bordo, "2L+2C"); assert.equal(r[0].pz, 1);
  });
  test("rotund: cutia 3D are inel deschis, pivot la un capăt (stânga implicit), balamaua din doorHinge", () => {
    const L = door(build({ ...TON, rOpen: 120, rDoor: 1 })), R = door(build({ ...TON, rOpen: 120, rDoor: 1, doorHinge: ["right"] }));
    assert.equal(L.ring.open, true); assert.equal(L.ring.out.length, L.ring.inn.length);
    assert.equal(L.pivotAt.left, true); assert.equal(R.pivotAt.left, false);
    assert.ok(L.pivotAt.x < 300 && R.pivotAt.x > 300, "capătul stâng / drept");
    assert.ok(Math.abs(L.pivotAt.x - 300 + (R.pivotAt.x - 300)) < 0.01, "simetrice");
    assert.ok(L.y0 === 2 && L.y1 === 1198);
  });
  test("rotund: grosimea ușii vine din materialul de front", () => {
    const d = door(build({ ...TON, rOpen: 120, rDoor: 1 })), g = d.ring.out[0], h = d.ring.inn[0];
    assert.ok(Math.abs(Math.hypot(g[0] - 300, g[1] - 300) - Math.hypot(h[0] - 300, h[1] - 300) - 19) < 0.5, "19 mm între exterior și interior");
  });
  test("racordat: ușă plată cu 2 mm rost, în planul frontului, pe lățimea deschiderii", () => {
    const o = build({ ...RAC, rOpen: 400, rDoor: 1 }), r = rows(o)[0], d = door(o);
    assert.match(r.elemento, /^Anta \(racordato\)/); assert.equal(r.lung, 1396); assert.equal(r.larg, 396);
    assert.equal(d.x0, 252); assert.equal(d.x1, 648); assert.equal(d.z1, 450); assert.equal(d.z0, 431); assert.equal(d.pivotAt.left, true); assert.equal(d.pivotAt.x, 252);
    assert.equal(door(build({ ...RAC, rOpen: 400, rDoor: 1, doorHinge: ["right"] })).pivotAt.x, 648);
  });
  test("ușa nu produce găuri (fără balamale generate) și nu strică găurirea restului", () => {
    for (const c of [{ ...TON, rOpen: 120 }, { ...RAC, rOpen: 400 }]) {
      const a = build(c).ops(), b = build({ ...c, rDoor: 1 }).ops();
      const sig = r => J(r.pieces.filter(p => p.role !== "frontale").map(p => [p.role, p.operations.length]));
      assert.equal(sig(a), sig(b)); const f = b.pieces.find(p => p.role === "frontale"); assert.ok(f && f.operations.length === 0);
    }
  });
});

describe("sertare în deschiderea racordatului (D-176, 5.95.1)", () => {
  const RD = { ...RAC, shelves: 0, rOpen: 400, rDrawers: 3 };
  const wingB = r => r.b.pieces.filter(p => p.wing === "B");
  test("fără rDrawers corpul e cel din 5.94.1 (distinctă, 3D); rDrawers pe alt tip sau fără deschidere se ignoră", () => {
    assert.equal(J(build({ ...RAC, shelves: 0, rOpen: 400 }).b.pieces), J(build({ ...RAC, shelves: 0, rOpen: 400, rDrawers: 0 }).b.pieces));
    assert.equal(J(build(RAC).b.pieces), J(build({ ...RAC, rDrawers: 3 }).b.pieces), "fără deschidere se ignoră");
    assert.equal(J(build({ ...TON, rOpen: 120 }).b.pieces), J(build({ ...TON, rOpen: 120, rDrawers: 3 }).b.pieces), "la rotund se ignoră");
  });
  test("un corp cu sertare obișnuit în deschidere: distincta are corpul (marcat B) și N fronturi de sertar; fâșiile rămân două", () => {
    const r = build(RD), b = wingB(r);
    assert.equal(strips(r).length, 2);
    const fr = b.find(p => /^Frontale cassetto/.test(p.elemento)); assert.ok(fr); assert.equal(fr.pz, 3);
    assert.ok(b.some(p => /^Fianco$/.test(p.elemento) && p.pz === 2) && b.some(p => /^Base$/.test(p.elemento)));
    assert.equal(r.b.boxes.filter(x => x.sub === "drawer").length, 3);
  });
  test("corpul cu sertare stă în deschidere: lățime = deschidere − 4, front în planul frontului, între fund și tavan, fără să atingă fâșiile", () => {
    const r = build(RD), bb = r.b.boxes.filter(x => x.body), fr = r.b.boxes.filter(x => x.sub === "drawer");
    const x0 = Math.min(...bb.map(x => x.x0)), x1 = Math.max(...bb.map(x => x.x1));
    assert.equal(x1 - x0, 396); assert.ok(Math.abs((x0 + x1) / 2 - 450) < 0.01, "centrat");
    assert.ok(x0 >= 250 + 1.9 && x1 <= 650 - 1.9, "2 mm față de capetele fâșiilor");
    fr.forEach(f => assert.ok(Math.abs(f.z1 - 450) < 0.01, "frontul în planul frontului"));
    assert.ok(Math.min(...bb.map(x => x.y0)) >= 19 - 0.01 && Math.max(...bb.map(x => x.y1)) <= 1400 - 19 + 0.01);
  });
  test("găurire și feronerie: glisiere și mânere pe sertare, îmbinările corpului; avertismentele vechi rămân", () => {
    const o = build(RD).ops(), n = t => o.hw.filter(h => h.type === t).length;
    assert.equal(n("guida"), 6); assert.equal(n("maniglia"), 3); assert.ok(n("minifix") > 0 || n("tassello") > 0);
    assert.ok(o.pieces.every(p => (p.preflight || []).every(w => w.level !== "error")), "nicio eroare de pre-flight (V1, V5)");
    const own = build(RD).ops().pieces.filter(p => p.body === "U0");
    const solo = build({ ...RAC, type: "standard", L: 396, H: 1362, P: 410, plinth: 0, tram: 0, shelves: 0, drawers: 3, doors: 0, back: 1, hang: 0, support: "zoccolo", top: "traverse", boxes: 1, rcorner: undefined }).ops().pieces;
    assert.equal(own.reduce((n, p) => n + p.operations.length, 0), solo.reduce((n, p) => n + p.operations.length, 0), "corpul din deschidere se găurește ca un corp standard de aceleași cote");
  });
  test("erori declarate: cu rafturi, cu ușă, deschidere sub 254 mm, prea multe sertare", () => {
    assert.throws(() => build({ ...RD, shelves: 3 }), /rafturi trebuie să fie 0/);
    assert.throws(() => build({ ...RD, rDoor: 1 }), /sertarele nu pot exista împreună/);
    assert.throws(() => build({ ...RD, rOpen: 200 }), /cel puțin 254 mm/);
    build({ ...RD, rDrawers: 8 });
  });
});

describe("aplicația: câmp în formular, în 7 limbi", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  test("AI: schema, textul de instrucțiuni și plafoanele cunosc rOpen și rDoor", () => {
    assert.match(html, /rOpen:\{type:"integer",minimum:0,maximum:800/); assert.match(html, /rDoor:\{type:"integer",minimum:0,maximum:1/);
    assert.match(html, /"rOpen" — a front opening on type="tondo"/); assert.match(html, /rOpen:\[0,800\],rDoor:\[0,1\]/); assert.match(html, /rOpen:t\("fRopenDeg"\),rDoor:t\("fRdoor"\)/);
  });
  test("câmpul bOpen există, intră în configurație doar la tondo/raccordato și are etichete în toate limbile", () => {
    assert.match(html, /id="bOpen"/); assert.match(html, /\["tondo","raccordato"\]\.includes\(\$\("bTipo"\)\.value\)&&v\("bOpen",0\)>0\?\{rOpen:v\("bOpen",0\)\}/);
    for (const l of ["ro", "it", "en", "fr", "de", "pl", "es"]) {
      const m = html.match(new RegExp("^" + l + ":\\{[^\\n]*", "m")); assert.ok(m, l);
      assert.match(m[0], /"?fRopenDeg"?:/, l); assert.match(m[0], /"?fRopenMm"?:/, l);
      for (const k of ["fRdoor", "rdoorNone", "rdoorYes"]) assert.match(m[0], new RegExp('"?' + k + '"?:'), l + " " + k);
    }
  });
});
