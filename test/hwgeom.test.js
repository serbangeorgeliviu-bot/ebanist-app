/* Ebanist — forma 3D a conectorilor = operațiile din fișa piesei (ebanist-hwgeom.js).
 *
 *   node --test test/hwgeom.test.js
 *
 * Pentru fiecare conector (Minifix, tasel, Confirmat, lamelă, Domino, Clamex), în mai multe corpuri
 * și la 18 și 19 mm: forma are diametrul, lungimea și adâncimea găurii sau canalului ei, stă pe
 * punctul conectorului și NU e niciodată mai mare decât o piesă de feronerie (garda împotriva
 * „plăcilor” uriașe în 3D).
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
for (const f of ["ebanist-ops.js", "ebanist-hwgeom.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", f), "utf8"), S, { filename: f });
const G = S.EBHwGeom, HD = S.HW_DRILL;

function gen(cfg, th, hw) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", th), MM("__k", 3)], hwProd: Object.assign({ guida: "blum_tandem" }, hw) };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full), Gd = S.deriveCarcass(S.carcassParams(full, {}));
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: Gd })));
}
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
const CFG = {
  "armadio": ARM,
  "cassettiera": { ...ARM, L: 600, H: 720, P: 560, tram: 0, shelves: 0, doors: 0, drawers: 3 },
  "sospeso": { ...ARM, L: 900, H: 600, P: 350, support: "sospeso", plinth: 0, tram: 0, shelves: 1 },
  "libreria": { ...ARM, L: 1200, H: 1800, P: 350, doors: 0, shelfType: "fisso" },
  "bagno con gradino": { ...ARM, L: 800, H: 850, P: 460, plinth: 100, tram: 0, shelves: 1, stepH: 300, stepP: 80 }
};
const KINDS = { minifix: "haf_minifix", confirmat: "gen_confirmat", dowel: "gen_dowel", biscuit: "gen_biscuit", domino: "fes_domino", clamex: "lam_clamex", clamex_p10: "lam_clamex_p10", clamex_medius: "lam_clamex_medius", clamex_flexus: "lam_clamex_flexus", clamex_cnc: "lam_clamex_cnc", tenso_p14: "lam_tenso_p14", tenso_p10: "lam_tenso_p10", bisco_p14: "lam_bisco_p14", bisco_p10: "lam_bisco_p10", dom5: "fes_domino_5x30", dom10: "fes_domino_10x50", domxl: "fes_domino_xl_14x100" };
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.05, `${m}: ${a} ≠ ${b}`);

describe("conectori: 3D = operațiile din fișa piesei", () => {
  for (const th of [18, 19]) for (const [cn, cfg] of Object.entries(CFG)) for (const [kind, id] of Object.entries(KINDS)) {
    test(`${kind} · ${cn} · ${th} mm`, () => {
      const o = gen({ ...cfg, hwSel: { conn: id } }, th);
      const by = G.opsByHw(o.pieces);
      const hws = o.hw.filter(h => G.TYPES.includes(h.type));
      assert.ok(hws.length > 0, "niciun conector generat");
      for (const h of hws) {
        const sh = G.connectorShapes(h, by[h.id], HD, { thickF: th });
        if (h.type === "reggipiano" && h.seat === null) { assert.equal(sh.length, 0, `${h.id}: fără gaură liberă nu se desenează suport`); continue; }
        assert.ok(sh.length > 0, `${h.id} ${h.type}: fără formă`);
        if (h.type !== "reggipiano") sh.forEach(s => assert.ok(s.src.length > 0, `${h.id}/${s.role}: nu leagă nicio operație`));
        /* garda „placă”: nicio formă de conector nu depășește 100 mm pe vreo axă */
        for (const s of sh) {
          const rad = s.t === "lathe" ? 2 * Math.max(...s.profile.map(p => p[0])) : s.d;
          const ext = s.t !== "box" ? [Math.abs(s.a[0] - s.b[0]) + rad, Math.abs(s.a[1] - s.b[1]) + rad, Math.abs(s.a[2] - s.b[2]) + rad] : [0, 1, 2].map(i => s.hi[i] - s.lo[i]);
          ext.forEach(e => assert.ok(e > 0 && e <= 100, `${h.id}/${s.role}: dimensiune ${e} mm`));
        }
        const op = n => { const f = (by[h.id] || []).find(x => n.test(x.op.note || "")); return f ? f.op : null; };
        if (h.type === "minifix") {
          const cam = sh.find(s => s.role === "cam"), bolt = sh.find(s => s.role === "bolt");
          near(cam.d, op(/eccentrico/).dia, "Ø corp"); near(len(cam.a, cam.b), op(/eccentrico/).depth, "adâncime corp");
          near(len(cam.a, h.w), 0, "corpul pornește de pe fața lui E");
          near(len(cam.a, cam.b), th >= 19 ? HD.minifix.cam_depth_19 : HD.minifix.cam_depth_16, "adâncimea corpului după grosime");
          near(bolt.d, HD.minifix.bolt_dia, "Ø bolț"); near(len(bolt.a, bolt.b), HD.minifix.bolt_depth + op(/gambo/).depth, "lungimea bolțului (filet în F + tija din E)");
        } else if (h.type === "tassello") {
          const d = sh[0]; near(d.d, HD.dowel.dia, "Ø tasel"); near(len(d.a, d.b), HD.dowel.len, "lungime tasel");
        } else if (h.type === "confirmat") {
          const scr = sh.find(s => s.role === "screw"), J = HD.joints.confirmat;
          near(len(scr.a, scr.b), J.head_h + J.screw_len, "lungime șurub (cap + 50 sub cap)"); near(scr.d, 7, "Ø tijă");
          near(2 * Math.max(...scr.profile.map(p => p[0])), J.head_dia, "Ø cap (cea mai mare rază a profilului)");
          near(scr.profile[scr.profile.length - 1][1], J.head_h + J.screw_len, "profilul se termină la vârf");
        } else if (h.type === "reggipiano") {
          const pin = sh.find(x => x.role === "pin"), plate = sh.find(x => x.role === "plate"), pcOps = o.pieces.find(q => String(q.pk) === String(h.piece)).operations, p0 = pcOps.find(x => x.type === "drill" && /reggipiano/.test(x.note || "") && x._w && Math.abs(x._w[1] - h.seat[1]) < 0.05 && Math.abs(x._w[2] - h.seat[2]) < 0.05);   // gaura din piesă (poate fi trecută și atribuită altui suport opus)
          near(pin.d, p0.dia, "Ø tijă"); const seatD = p0.through ? HD.pin.depth : p0.depth;     // gaură trecută (două suporturi opuse): adâncimea din catalog
          near(len(pin.a, pin.b), seatD + HD.pin.out, "lungimea tijei (adâncimea găurii + ce iese)");
          near(len(pin.a, h.seat), seatD, "tija intră cât gaura");
          assert.ok(p0, "suportul stă într-o gaură care există în fișa piesei");
          assert.ok(plate.hi[1] - plate.lo[1] > 0 && plate.hi[0] - plate.lo[0] > 0, "plăcuța are volum");
        } else {
          /* varianta din catalog (D-134): fiecare element are cotele lui din broșura producătorului */
          const K = G.jointK(HD, h), two = h.type === "clamex" || h.type === "tenso", bs = sh.filter(x => x.t === "box" && /^body/.test(x.role)), dim = (b, i) => b.hi[i] - b.lo[i];
          const bF = K.body_f || K.body, bE = K.body;
          if (two) {
            const f = bs.find(b => b.role === "bodyF"), e = bs.find(b => b.role === "bodyE");
            near(dim(f, h.sAx), bF.len, "lungimea elementului din F"); near(dim(e, h.sAx), bE.len, "lungimea elementului din E");
            near(dim(f, h.camAx), bF.thk, "grosimea elementului din F"); near(dim(e, h.camAx), bE.thk, "grosimea elementului din E");
            near(dim(f, h.eAx) + dim(e, h.eAx), (bF.h || K.depth_face) + (bE.h || K.depth) , "înălțimea celor două elemente (broșura: ex. 13,5 + 13,5 = 27)");
          } else {
            bs.forEach(b => { near(dim(b, h.sAx), K.body.len, "lungimea corpului"); near(dim(b, h.camAx), K.body.thk, "grosimea corpului"); });
            near(bs.reduce((q, b) => q + dim(b, h.eAx), 0), K.tenon_len || (K.depth + K.depth_face), "adâncimea totală (canal F + canal E) = lungimea tenonului");
          }
          assert.equal(bs.length, two ? 2 : 1, "Clamex și Tenso = două elemente, restul o singură piesă");
          assert.ok(Math.max(bE.len, bF.len) <= Math.max(K.len, K.len_face || 0) && Math.max(bE.thk, bF.thk) <= K.thk, "elementul trebuie să încapă în canal");
        }
      }
    });
  }
});

describe("balamale: cotele din fișa de găurire", () => {
  for (const th of [18, 19]) for (const [cn, cfg] of Object.entries({ armadio: ARM, "armadio cu 1 ușă": { ...ARM, doors: 1 }, "sospeso": CFG.sospeso && { ...ARM, L: 900, H: 600, P: 350, support: "sospeso", plinth: 0, tram: 0, shelves: 1 } })) {
    test(`cerniera · ${cn} · ${th} mm`, () => {
      const o = gen(cfg, th), by = G.opsByHw(o.pieces), hs = o.hw.filter(h => h.type === "cerniera");
      assert.ok(hs.length > 0, "nicio balama");
      for (const h of hs) {
        const X = G.hingeDims(h, by[h.id], HD), ops = (by[h.id] || []).map(x => x.op);
        const cup = ops.find(x => /tazza/.test(x.note)), dw = ops.filter(x => /tassello cerniera/.test(x.note)), pl = ops.filter(x => /basetta/.test(x.note));
        near(X.cupDia, cup.dia, "Ø cupă"); near(X.cupDepth, cup.depth, "adâncimea cupei (nu 13 fix)");
        assert.equal(dw.length, 2); assert.equal(pl.length > 0 ? pl.length : 2, 2);
        dw.forEach(d => { near(Math.abs(d._w[1] - h.w[1]), X.dowelHalf, "distanța tasealelor"); near(Math.abs(d._w[0] - h.w[0]), X.dowelOffset, "decalajul tasealelor"); });
        if (h.plate) pl.forEach(p => near(Math.abs(p._w[1] - h.plate[1]), X.plateHalf, "distanța găurilor plăcuței"));
        near(X.dowelHalf * 2, HD.hinge.dowel_spacing, "tasealele din date"); near(X.plateHalf * 2, HD.hinge.plate_spacing, "plăcuța din date");
      }
    });
  }
});

describe("glisiere: șuruburile în găurile din fișa piesei", () => {
  const CAS = { ...ARM, L: 600, H: 720, P: 560, tram: 0, shelves: 0, doors: 0, drawers: 3 };
  for (const th of [18, 19]) for (const gid of ["blum_tandem", "blum_movento"]) {
    test(`guida · ${gid} · ${th} mm`, () => {
      S.slideGuidaId = () => gid;      // seria din fișele producătorului (pozițiile de fixare diferă între TANDEM și MOVENTO)
      const o = gen(CAS, th, { guida: gid });
      const by = G.opsByHw(o.pieces), gs = o.hw.filter(h => h.type === "guida");
      assert.ok(gs.length > 0, "nicio glisieră");
      for (const h of gs) {
        const holes = (by[h.id] || []).filter(x => /guida cassetto/.test(x.op.note));
        const sc = G.slideScrews(h, by[h.id], HD, 1.8);
        if (gid === "blum_movento") assert.ok(holes.length >= 3, "MOVENTO: 18/37/69 de la față + rândul după NL");
        assert.equal(sc.filter(s => s.role === "screw").length, holes.length, "un șurub pe gaură");
        for (const x of holes) {
          const m = sc.find(s => s.role === "screw" && Math.abs(s.a[2] - x.op._w[2]) < 0.05 && Math.abs(s.a[1] - x.op._w[1]) < 0.05);
          assert.ok(m, `șurub lipsă la z=${x.op._w[2]}`);
          near(m.d, x.op.dia, "Ø șurub = Ø gaură"); near(len(m.a, m.b), x.op.depth + 1.8, "tija = adâncimea găurii + placa");
        }
        sc.forEach(s => assert.ok(s.d > 0 && len(s.a, s.b) > 0 && len(s.a, s.b) < 40, "dimensiune verosimilă"));
      }
    });
  }
});

describe("mânere: picioarele stau în găurile din fișa piesei", () => {
  for (const th of [18, 19]) test(`maniglia · armadio + cassettiera · ${th} mm`, () => {
    let n = 0;
    for (const cfg of [ARM, { ...ARM, L: 600, H: 720, P: 560, tram: 0, shelves: 0, doors: 0, drawers: 3 }]) {
      const o = gen({ ...cfg, handles: "maniglia" }, th), by = G.opsByHw(o.pieces);
      for (const h of o.hw.filter(x => x.type === "maniglia" && !x.knob && x.hm && !["flush", "flushR", "edge"].includes(x.hm.t))) {
        const holes = (by[h.id] || []).map(x => x.op).filter(x => /maniglia/.test(x.note) && x._w);
        if (!holes.length) continue;
        n++;
        const ax = h.vertical ? 1 : 0, ia = h.ia || h.hm.ia;
        assert.equal(holes.length, 2, `${h.id}: două găuri`);
        near(Math.abs(holes[0]._w[ax] - holes[1]._w[ax]), ia, "distanța dintre picioare = distanța dintre găuri");
        near((holes[0]._w[ax] + holes[1]._w[ax]) / 2, h.w[ax], "mânerul e centrat pe găuri");
        near(holes[0]._w[1 - ax], h.w[1 - ax], "pe aceeași linie");
        holes.forEach(x => near(x.dia, HD.handle.dia, "Ø gaură mâner"));
      }
    }
    assert.ok(n > 0, "niciun mâner cu două găuri în configurațiile de test");
  });
});

describe("balamaua CLIP după desenul Blum: braț masiv și gât îndoit (5.48.0)", () => {
  const near = (a, b, m, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} ≠ ${b}`);
  test("brațul: profil închis, 66,5 mm de la fața ușii, 21 mm lat, mai înalt la balamaua pentru ușă încastrată", () => {
    for (const inset of [false, true]) {
      const A = G.hingeArm(584, inset, 1.3);
      assert.equal(A.outer.length, 6); assert.equal(A.skin.length, 8);
      near(A.zFar, 584 - 50.5, "zFar: 66,5 mm de la fața ușii (zNear e la 16 mm de ea)"); near(A.width, 21, "lățimea brațului");
      const top = Math.max(...A.outer.map(q => q[1])); near(top, inset ? 27 : 23, "înălțime");
      for (const q of A.outer) assert.ok(q[0] >= A.zFar - 1e-9 && q[0] <= 584 + 1e-9 && q[1] >= 3 - 1e-9, "punct în afara brațului");
      /* capacul: fața de sus = marginea de sus a pereților, fața de jos cu t mai jos */
      near(A.skin[0][1] - A.skin[7][1], 1.3, "grosimea capacului");
      near(A.skin[3][1] - A.skin[4][1], 1.3, "grosimea capacului la capăt");
    }
  });
  test("gâtul îndoit: o piesă groasă, cu capetele în cupă (a) și în braț (b); niciuna nu are lungime zero; ușa închisă le ține în față", () => {
    for (const sd of [1, -1]) {
      const L = G.hingeLinks([24.5, 183, 600], sd, 584, 19, 600);
      assert.equal(L.a.length, 1); assert.equal(L.b.length, 1); near(L.h, 17, "înălțimea gâtului"); near(L.th, 8, "grosimea gâtului");
      L.a.forEach((a, i) => {
        const b = L.b[i], len = Math.hypot(a[0] - b[0], a[2] - b[2]);
        assert.ok(len > 8 && len < 40, `legătura ${i}: ${len} mm`);
        near(a[1], 183, "y cupă"); near(b[1], 183, "y braț");
        assert.ok(a[2] < 600 && a[2] > 584, "articulația cupei stă între ușă și braț");
        assert.ok(b[2] < 584, "articulația brațului stă în braț");
      });
      /* pe partea balamalei (sd) articulațiile brațului sunt în interiorul corpului, nu în lateral */
      L.b.forEach(b => assert.ok((b[0] - 19) * sd > 3, "articulația brațului intră în corp"));
    }
  });
});

describe("Festool KV/MSV D8: piesele din STEP-ul oficial (D-139)", () => {
  for (const id of ["fes_kv_d8_50", "fes_msv_d8_25"]) test(`${id}: cinci piese, baza ortonormată, legate de operații`, () => {
    const o = gen({ ...ARM, hwSel: { conn: id } }, 19), by = G.opsByHw(o.pieces), hs = o.hw.filter(h => h.type === "kv");
    assert.ok(hs.length > 0);
    for (const h of hs) {
      const sh = G.connectorShapes(h, by[h.id], HD, { thickF: 19 });
      assert.equal(JSON.stringify(sh.map(x => x.part).sort()), JSON.stringify(["anchor", "bolt", "cap", "cross", "tray"]));
      sh.forEach(x => { assert.equal(x.t, "mesh"); assert.ok(x.src.length > 0, "nu leagă nicio operație");
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        assert.ok(Math.abs(dot(x.ex, x.ey)) < 1e-9 && Math.abs(dot(x.ex, x.ez)) < 1e-9 && Math.abs(dot(x.ey, x.ez)) < 1e-9, "axe neortogonale");
        [x.ex, x.ey, x.ez].forEach(v => assert.ok(Math.abs(dot(v, v) - 1) < 1e-9)); });
      /* ancora transversală și capacul: capul la fața lui E (grosime 19 → +9,5; în STEP capul e la +9,1) */
      assert.ok(Math.abs(sh.find(x => x.part === "cross").dz - (19 / 2 - 9.1)) < 1e-9);
      assert.equal(sh.find(x => x.part === "bolt").dz, 0);
    }
  });
  test("datele STEP: cinci piese, indici valizi, cotele din fișier (bolț ~42 lung, tavă 26 × 21,6 × 8,2, ancoră Ø15,2, capac Ø19)", () => {
    const SD = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-festool-d8.js"), "utf8"), SD);
    const P = vm.runInContext("EBFestoolD8", SD).parts;
    const bb = n => { const v = P[n].v, m = [1e9, 1e9, 1e9], M = [-1e9, -1e9, -1e9]; for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { m[k] = Math.min(m[k], v[i + k] / 100); M[k] = Math.max(M[k], v[i + k] / 100); } return M.map((x, k) => x - m[k]); };
    for (const n of Object.keys(P)) { const nv = P[n].v.length / 3; assert.ok(P[n].t.every(i => i >= 0 && i < nv), n + ": indice în afara vârfurilor"); assert.equal(P[n].t.length % 3, 0); }
    const near = (a, b, e, m) => assert.ok(Math.abs(a - b) <= e, `${m}: ${a} ≠ ${b}`);
    near(bb("bolt")[0], 41.8, 0.3, "bolț"); near(bb("tray")[0], 26, 0.8, "tavă x"); near(bb("tray")[1], 21.6, 0.8, "tavă y"); near(bb("tray")[2], 8.2, 0.6, "tavă z");
    near(Math.max(bb("cross")[0], bb("cross")[1]), 15.2, 0.4, "ancoră Ø (cea mai mare latură în plan)"); near(bb("cap")[0], 19, 0.3, "capac Ø"); near(bb("anchor")[0], 41.8, 0.6, "ancora despicată (manșonul) pe toată lungimea bolțului");
  });
});

describe("Lamello Cabineo și Invis Mx2: forme legate de operații (D-140)", () => {
  for (const [id, type, roles] of [["lam_cabineo_8", "cabineo", ["body", "screw"]], ["lam_cabineo_12", "cabineo", ["body", "screw"]], ["lam_invis_mx2_30", "invis", ["connector", "stud"]], ["lam_invis_mx2_14", "invis", ["connector", "stud"]]])
    test(`${id}: ${roles.join(" + ")}, legate de operațiile din fișă`, () => {
      const o = gen({ ...ARM, hwSel: { conn: id } }, 19), by = G.opsByHw(o.pieces), hs = o.hw.filter(h => h.type === type);
      assert.ok(hs.length > 0);
      for (const h of hs) {
        const sh = G.connectorShapes(h, by[h.id], HD, { thickF: 19 });
        assert.equal(JSON.stringify(sh.map(x => x.role).sort()), JSON.stringify(roles.slice().sort()));
        sh.forEach(x => assert.ok(x.src.length > 0, "nu leagă nicio operație"));
      }
    });
});

test("Divario P-18: elementul din canal și cei doi știfturi, legate de operații (D-141)", () => {
  const o = gen({ ...ARM, hwSel: { conn: "lam_divario_p18" } }, 19), by = G.opsByHw(o.pieces), hs = o.hw.filter(h => h.type === "divario");
  assert.ok(hs.length > 0);
  for (const h of hs) {
    const sh = G.connectorShapes(h, by[h.id], HD, { thickF: 19 });
    assert.equal(JSON.stringify(sh.map(x => x.role).sort()), JSON.stringify(["grooveEl", "peg", "peg"]));
    sh.forEach(x => assert.ok(x.src.length > 0));
  }
});
