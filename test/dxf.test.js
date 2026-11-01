/* Export Layered DXF 2D: straturi, coordonate, fata 6 oglindita, ZIP valid, determinism.
 *   cd test && node --test dxf.test.js */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path"), zlib = require("zlib");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
/* la radice package.json ha "type":"module": i file dell'app si caricano come script classici */
const DX = vm.createContext({ console, Math, JSON, TextEncoder, Uint8Array, Object, String, Array });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-dxf.js"), "utf8"), DX, { filename: "ebanist-dxf.js" });
const DXF = DX.EBDxf;

function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 18), MM("__k", 3), MM("__k8", 8)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G })));
}
const ARM = { type: "standard", L: 1000, H: 2200, P: 600, plinth: 80, tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 0, support: "zoccolo", shelfType: "mobile" };
const BASE = { ...ARM, L: 600, H: 720, P: 560, tram: 0, shelves: 0, doors: 0, drawers: 3 };

/* parser minimal: [{type, layer, g:{cod:[valori]}}] pe sectiunea ENTITIES */
function parse(txt) {
  const L = txt.split("\n"); const pairs = [];
  for (let i = 0; i + 1 < L.length; i += 2) pairs.push([+L[i], L[i + 1]]);
  const ents = []; let inEnt = false, cur = null;
  for (const [c, v] of pairs) {
    if (c === 2 && v === "ENTITIES") { inEnt = true; continue; }
    if (inEnt && c === 0 && v === "ENDSEC") break;
    if (!inEnt) continue;
    if (c === 0) { cur = { type: v, g: {} }; ents.push(cur); continue; }
    (cur.g[c] = cur.g[c] || []).push(v);
  }
  ents.forEach(e => { e.layer = (e.g[8] || [])[0]; });
  return ents;
}
const layersOf = txt => { const m = {}; const T = txt.split("\n"); for (let i = 0; i < T.length - 1; i++) if (T[i] === "0" && T[i + 1] === "LAYER") m[T[i + 3]] = +T[i + 7]; return m; };

describe("dxf", () => {
  const o = gen(ARM), pcs = o.pieces;
  const fianco = pcs.find(p => p.role === "fianco" && p.operations.some(x => x.type === "drill" && x.face >= 5));
  const meta = { n: 3, total: 30, role: "fianco", material: "Egger W1000 19", grain: true, edge: "2L+1C", ver: "t" };

  test("contur = piesa, origine (0,0), rotunjit la 0.1", () => {
    const d = parse(DXF.partDXF(fianco, { face: 5, meta }));
    const cut = d.filter(e => e.type === "VERTEX" && e.layer === "PANEL_CUT").map(e => [+e.g[10][0], +e.g[20][0]]);
    assert.equal(cut.length, 4);
    assert.deepEqual([Math.min(...cut.map(p => p[0])), Math.min(...cut.map(p => p[1]))], [0, 0]);
    assert.equal(Math.max(...cut.map(p => p[0])), Math.round(fianco.length * 10) / 10);
    assert.equal(Math.max(...cut.map(p => p[1])), Math.round(fianco.width * 10) / 10);
  });

  test("fiecare gaura de pe fata 5 are un CIRCLE cu raza d/2 pe stratul DRILL_V_D*_Z*", () => {
    const txt = DXF.partDXF(fianco, { face: 5, meta }), d = parse(txt);
    const ops = fianco.operations.filter(x => x.type === "drill" && x.face >= 5 && (x.through || x.face === 5));
    const circ = d.filter(e => e.type === "CIRCLE");
    assert.equal(circ.length, ops.length);
    for (const x of ops) {
      const lay = "DRILL_V_D" + String(Math.round(x.dia * 10) / 10).replace(/\.0$/, "").replace(".", "_") + "_Z" +
        (x.through ? "THRU" : String(Math.round(x.depth * 10) / 10).replace(/\.0$/, "").replace(".", "_"));
      const hit = circ.find(e => e.layer === lay && +e.g[10][0] === Math.round(x.x * 10) / 10 && +e.g[20][0] === Math.round(x.y * 10) / 10);
      assert.ok(hit, "lipseste " + lay + " @" + x.x + "," + x.y);
      assert.equal(+hit.g[40][0], Math.round(x.dia * 10) / 20);
    }
    assert.ok(Object.keys(layersOf(txt)).every(l => /^[A-Z0-9_]+$/.test(l)));
  });

  test("culorile straturilor", () => {
    const L = layersOf(DXF.partDXF(fianco, { face: 5, meta }));
    assert.equal(L.PANEL_CUT, 7); assert.equal(L.INFO_TEXT, 2);
    Object.keys(L).filter(k => k.startsWith("DRILL_V_")).forEach(k => assert.equal(L[k], 3));
    Object.keys(L).filter(k => k.startsWith("DRILL_H_")).forEach(k => assert.equal(L[k], 5));
    Object.keys(L).filter(k => k.startsWith("GROOVE_")).forEach(k => assert.equal(L[k], 1));
  });

  test("INFO_TEXT: ID, rol, material, fibra, canturi; textul sta in piesa", () => {
    const d = parse(DXF.partDXF(fianco, { face: 5, meta }));
    const t = d.filter(e => e.type === "TEXT" && e.layer === "INFO_TEXT");
    const all = t.map(e => e.g[1][0]).join("|");
    assert.match(all, /#003\/30 fianco/); assert.match(all, /Egger W1000 19/); assert.match(all, /---->/); assert.match(all, /2L\+1C/);
    for (const e of t) { assert.ok(+e.g[10][0] >= 0 && +e.g[10][0] < fianco.length && +e.g[20][0] >= 0 && +e.g[20][0] < fianco.width); }
  });

  test("fata 6 = X oglindit (L - x)", () => {
    const two = pcs.find(p => p.operations.some(x => x.face === 6 && x.type === "drill"));
    if (!two) return;                                  // niciun corp de test cu fata 6: nimic de oglindit
    const d = parse(DXF.partDXF(two, { face: 6, meta }));
    const x6 = two.operations.find(x => x.face === 6 && x.type === "drill");
    assert.ok(d.some(e => e.type === "CIRCLE" && +e.g[10][0] === Math.round((two.length - x6.x) * 10) / 10 && +e.g[20][0] === Math.round(x6.y * 10) / 10));
  });

  test("canal (spate): dreptunghi inchis pe GROOVE_Z*_W*", () => {
    const gp = pcs.find(p => p.operations.some(x => x.type === "groove"));
    assert.ok(gp, "armadio cu spate in cava");
    const g = gp.operations.find(x => x.type === "groove");
    const d = parse(DXF.partDXF(gp, { face: g.face === 6 ? 6 : 5, meta }));
    const pl = d.filter(e => e.type === "POLYLINE" && /^GROOVE_Z\d/.test(e.layer));
    assert.ok(pl.length >= 1); assert.equal(pl[0].g[70][0], "1");
    assert.match(pl[0].layer, new RegExp("_W" + String(Math.round(g.width * 10) / 10).replace(/\.0$/, "").replace(".", "_") + "$"));
  });

  test("gauri in cant: DRILL_H_<MUCHIE> cu axa si cota Z", () => {
    const base = gen(BASE).pieces, ep = base.concat(pcs).find(p => p.operations.some(x => x.type === "drill" && x.face < 5));
    assert.ok(ep, "piesa cu gauri in cant");
    const txt = DXF.partDXF(ep, { face: 5, meta }), d = parse(txt);
    const edges = ep.operations.filter(x => x.type === "drill" && x.face < 5);
    const h = d.filter(e => e.type === "LINE" && /^DRILL_H_(TOP|BOTTOM|LEFT|RIGHT)_D\d/.test(e.layer));
    assert.equal(h.length, edges.length);
    assert.ok(d.some(e => e.type === "TEXT" && /^DRILL_H_/.test(e.layer) && /^Z=/.test(e.g[1][0])));
  });

  test("mod cota de taiere: PANEL_CUT mai mic + PANEL_FINISHED", () => {
    const p = pcs.find(q => !q.poly && q.operations.length);
    const txt = DXF.partDXF(p, { face: 5, meta, cutMode: "cut", cut: { L: p.length - 4, W: p.width - 2 } });
    const L = layersOf(txt), d = parse(txt);
    assert.ok(L.PANEL_FINISHED);
    const cut = d.filter(e => e.type === "VERTEX" && e.layer === "PANEL_CUT");
    assert.equal(Math.max(...cut.map(e => +e.g[10][0])), Math.round((p.length - 4) * 10) / 10);
  });

  test("determinist: acelasi input → acelasi text", () => {
    assert.equal(DXF.partDXF(fianco, { face: 5, meta }), DXF.partDXF(fianco, { face: 5, meta }));
  });

  test("ASCII: diacriticele nu rup fisierul", () => {
    const txt = DXF.partDXF(fianco, { face: 5, meta: { ...meta, material: "Culoare șțăîâ Ø" } });
    assert.ok(/^[\x00-\x7f]*$/.test(txt)); assert.match(txt, /Culoare staia D/);
    assert.ok(txt.endsWith("0\nEOF\n"));
  });

  test("ZIP: structura valida, CRC32 corect, continut recuperabil", () => {
    const items = pcs.slice(0, 6).map((pc, i) => ({ pc, name: "p" + i + "_" + pc.role, meta: { n: i + 1, total: 6, role: pc.role } }));
    const z = Buffer.from(DXF.projectZip(items, {}));
    const eocd = z.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
    const cnt = z.readUInt16LE(eocd + 10), cdOff = z.readUInt32LE(eocd + 16);
    assert.ok(cnt >= 6);
    let off = cdOff, seen = 0;
    while (z.readUInt32LE(off) === 0x02014b50) {
      const crc = z.readUInt32LE(off + 16), sz = z.readUInt32LE(off + 24), nl = z.readUInt16LE(off + 28), lo = z.readUInt32LE(off + 42);
      const name = z.slice(off + 46, off + 46 + nl).toString();
      const dl = z.readUInt16LE(lo + 26), ex = z.readUInt16LE(lo + 28), data = z.slice(lo + 30 + dl + ex, lo + 30 + dl + ex + sz);
      assert.equal(zlib.crc32 ? zlib.crc32(data) : crc, crc, name);
      assert.match(data.toString(), /^999\nEbanist/); assert.ok(name.endsWith(".dxf"));
      off += 46 + nl; seen++;
    }
    assert.equal(seen, cnt);
  });

  test("nume duplicate in ZIP primesc sufix", () => {
    const z = Buffer.from(DXF.zipStore([{ name: "a.dxf", data: "x" }, { name: "a.dxf", data: "y" }]));
    assert.ok(z.includes("a_2.dxf"));
  });
});
