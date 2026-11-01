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

function gen(cfg, th) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", th), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
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
const KINDS = { minifix: "haf_minifix", confirmat: "gen_confirmat", dowel: "gen_dowel", biscuit: "gen_biscuit", domino: "fes_domino", clamex: "lam_clamex" };
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
        assert.ok(sh.length > 0, `${h.id} ${h.type}: fără formă`);
        sh.forEach(s => assert.ok(s.src.length > 0, `${h.id}/${s.role}: nu leagă nicio operație`));
        /* garda „placă”: nicio formă de conector nu depășește 100 mm pe vreo axă */
        for (const s of sh) {
          const ext = s.t === "cyl" ? [Math.abs(s.a[0] - s.b[0]) + s.d, Math.abs(s.a[1] - s.b[1]) + s.d, Math.abs(s.a[2] - s.b[2]) + s.d] : [0, 1, 2].map(i => s.hi[i] - s.lo[i]);
          ext.forEach(e => assert.ok(e > 0 && e <= 100, `${h.id}/${s.role}: dimensiune ${e} mm`));
        }
        const op = n => by[h.id].find(x => n.test(x.op.note || "")).op;
        if (h.type === "minifix") {
          const cam = sh.find(s => s.role === "cam"), bolt = sh.find(s => s.role === "bolt");
          near(cam.d, op(/eccentrico/).dia, "Ø corp"); near(len(cam.a, cam.b), op(/eccentrico/).depth, "adâncime corp");
          near(len(cam.a, h.w), 0, "corpul pornește de pe fața lui E");
          near(len(cam.a, cam.b), th >= 19 ? HD.minifix.cam_depth_19 : HD.minifix.cam_depth_16, "adâncimea corpului după grosime");
          near(bolt.d, HD.minifix.bolt_dia, "Ø bolț"); near(len(bolt.a, bolt.b), HD.minifix.bolt_depth + op(/gambo/).depth, "lungimea bolțului (filet în F + tija din E)");
        } else if (h.type === "tassello") {
          const d = sh[0]; near(d.d, HD.dowel.dia, "Ø tasel"); near(len(d.a, d.b), HD.dowel.len, "lungime tasel");
        } else if (h.type === "confirmat") {
          const shank = sh.find(s => s.role === "shank"), head = sh.find(s => s.role === "head");
          near(len(shank.a, shank.b), HD.joints.confirmat.screw_len, "lungime șurub"); near(shank.d, 7, "Ø tijă"); near(head.d, HD.joints.confirmat.head_dia, "Ø cap");
        } else {
          const K = HD.joints[h.type], b = sh[0], dim = i => b.hi[i] - b.lo[i];
          near(dim(h.sAx), K.body.len, "lungimea corpului"); near(dim(h.camAx), K.body.thk, "grosimea corpului");
          near(dim(h.eAx), K.depth + K.depth_face, "adâncimea totală (canal F + canal E)");
          assert.ok(K.body.len <= K.len && K.body.thk <= K.thk, "corpul trebuie să încapă în canal");
        }
      }
    });
  }
});
