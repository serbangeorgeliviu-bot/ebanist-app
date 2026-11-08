/* Birou (D-117): îmbinările blatului și ale spatelui intră în modelul de operații.
 *   node --test desk-ops.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
function gen(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null })));
}
test("birou: blatul, laterale și spatele au găuri, fiecare în interiorul piesei", () => {
  const o = gen({ type: "scrivania", L: 1400, H: 750, P: 700 });
  assert.equal(o.pieces.length, 4);
  for (const p of o.pieces) {
    const d = p.operations.filter(x => x.type === "drill");
    assert.ok(d.length > 0, p.role + " fără găuri");
    assert.ok(!p.preflight.some(w => w.level === "error"), p.role + " are eroare de pre-flight");
  }
  assert.ok(o.hw.some(h => h.type === "minifix"));
});
test("birou: deterministic", () => {
  const c = { type: "scrivania", L: 1200, H: 740, P: 600 };
  assert.deepEqual(gen(c), gen(c));
});

/* --- 5.29.0: raft culisant pentru tastatură și trecere de cabluri (D-118) ---------------------------------- */
const DESK = { type: "scrivania", L: 1400, H: 750, P: 650 };
function genRaw(cfg) {
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {},
    matAdd: [MM("__b", 18), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  const b = S.buildModule(full);
  return { b, o: JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G: null }))) };
}
test("raft tastatură: piesă în distinctă, accesoriu, găuri sub blat și pe muchia raftului", () => {
  for (const id of ["ka300", "ka350", "ka400", "ka500"]) {
    const { b, o } = genRaw({ ...DESK, deskKb: id });
    const nl = +id.slice(2);
    assert.ok(b.pieces.some(r => r.role === "raft_tast" && r.lung === 560 && r.larg === nl - 40), id + ": rândul raftului");
    assert.ok(b.pieces.some(r => r.role === "accessorio" && /KA 3434 NL/.test(r.elemento) && r.pz === 2));
    const tray = o.pieces.find(p => p.role === "raft_tast");
    assert.equal(tray.operations.filter(x => x.type === "drill").length, 4);
    assert.ok(!o.pieces.some(p => p.preflight.some(w => w.level === "error")), id + ": pre-flight");
    assert.equal(o.hw.filter(h => h.type === "guida_tast").length, 2);
  }
});
test("raft tastatură: lățimea nu are loc între laterale -> eroare, nu piesă mutată", () => {
  assert.throws(() => genRaw({ ...DESK, L: 600, deskKb: "ka400", deskKbW: 560 }), /nu are loc/);
  assert.throws(() => genRaw({ ...DESK, P: 330, deskKb: "ka500" }), /prea lungi/);
});
test("trecere cabluri: găuri Ø60 trecute prin blat, în număr cerut", () => {
  for (const n of [1, 2, 3]) {
    const { b, o } = genRaw({ ...DESK, deskCable: n });
    const top = o.pieces.find(p => p.role === "cielo");
    const g = top.operations.filter(x => x.type === "drill" && x.dia === 60);
    assert.equal(g.length, n); g.forEach(x => assert.ok(x.through && x.face === 5));
    assert.equal(b.pieces.find(r => /Passacavi/.test(r.elemento)).pz, n);
  }
  assert.throws(() => genRaw({ ...DESK, L: 300, deskCable: 3 }), /nu au loc/);
});
test("fără opțiuni noi = distinta de dinainte", () => {
  const a = genRaw(DESK), c = genRaw({ ...DESK, deskKb: null, deskCable: 0 });
  assert.deepEqual(a.b.pieces, c.b.pieces); assert.deepEqual(a.o, c.o);
  assert.equal(a.b.pieces.length, 3);
});
