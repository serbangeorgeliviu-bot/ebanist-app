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

/* --- corp cu sertare (D-118) ------------------------------------------------------------------------------- */
test("birou cu corp de sertare: stânga, dreapta, ambele; piese cu pk unic, fără erori de pre-flight", () => {
  for (const [ped, sides, pz] of [["sx", 1, 1], ["dx", 1, 1], ["both", 0, 2]]) {
    const { b, o } = genRaw({ ...DESK, deskPed: ped, deskPedW: 450, deskPedDr: 3 });
    const fi = b.pieces.find(r => r.elemento === "Fianco" && !r.wing);
    assert.equal(fi ? fi.pz : 0, sides, ped + ": laterale de birou");
    assert.equal(b.pieces.find(r => r.elemento === "Frontale cassetto").pz, 3 * pz);
    assert.equal(new Set(o.pieces.map(p => p.pk)).size, o.pieces.length, ped + ": pk unic");
    assert.ok(!o.pieces.some(p => p.preflight.some(w => w.level === "error")), ped + ": pre-flight");
    assert.equal(o.hw.filter(h => h.type === "guida").length, 6 * pz, ped + ": glisiere (2 pe sertar)");
    /* corpul stă pe pardoseală și sub blat: nimic nu iese din birou */
    const top = o.pieces.find(p => p.role === "cielo" && !p.body);
    o.pieces.filter(p => p.body).forEach(p => {
      assert.ok(p.min[0] >= -0.01 && p.max[0] <= DESK.L + 0.01 && p.max[1] <= top.min[1] + 0.01 && p.min[1] >= -0.01, ped + ": piesă în afara biroului");
    });
  }
});
test("birou cu corp: spațiul pentru genunchi minim 500 mm, lățime corp 300–800", () => {
  assert.throws(() => genRaw({ ...DESK, L: 1000, deskPed: "both", deskPedW: 450 }), /genunchi/);
  assert.throws(() => genRaw({ ...DESK, deskPed: "dx", deskPedW: 200 }), /300 și 800/);
});
test("birou cu corp + raft + trecere: tot împreună, deterministic", () => {
  const c = { ...DESK, deskPed: "sx", deskPedW: 400, deskPedDr: 4, deskKb: "ka400", deskCable: 2 };
  const a = genRaw(c), d = genRaw(c);
  assert.deepEqual(a.o, d.o);
  assert.ok(a.o.pieces.some(p => p.role === "raft_tast")); assert.ok(!a.o.pieces.some(p => p.preflight.some(w => w.level === "error")));
});

/* --- sertar sub blat și panou frontal (D-122) ---------------------------------------------------------------- */
test("sertar sub blat: corp mic atârnat sub blat, în spațiul pentru genunchi, în afara cablurilor", () => {
  const { b, o } = genRaw({ ...DESK, deskDrw: 1, deskCable: 2 });
  assert.ok(b.pieces.some(r => r.elemento === "Frontale cassetto" && r.pz === 1));
  const top = b.boxes.find(x => x.role === "cielo" && !x.body), t = top.y1 - top.y0;
  const dr = b.boxes.filter(x => x.body && x.body.id === "T1");
  const bb = a => [0, 1, 2].map(i => [Math.min(...dr.map(q => [q.x0, q.y0, q.z0][i])), Math.max(...dr.map(q => [q.x1, q.y1, q.z1][i]))]);
  const [X, Y, Z] = bb();
  assert.ok(X[0] >= t && X[1] <= DESK.L - t, "iese din laterale");
  assert.ok(Math.abs(Y[1] - top.y0) < 0.01, "nu atârnă de blat");
  assert.ok(Z[1] <= DESK.P - 20 + 0.01 && Z[0] >= 169.9, "ating spatele sau trecerile de cabluri");
  assert.ok(!o.pieces.some(p => p.preflight.some(w => w.level === "error")));
  assert.equal(o.hw.filter(h => h.type === "guida").length, 2);
});
test("panou frontal: între laterale, sub blat, fără erori; cu raft sau sertar sub blat -> eroare", () => {
  const { b, o } = genRaw({ ...DESK, deskMod: 1, deskModH: 350 });
  const f = b.pieces.find(r => r.elemento === "Pannello frontale");
  assert.equal(f.lung, DESK.L - 2 * 18); assert.equal(f.larg, 350);
  assert.ok(!o.pieces.some(p => p.preflight.some(w => w.level === "error")));
  assert.throws(() => genRaw({ ...DESK, deskMod: 1, deskKb: "ka400" }), /blochează raftul/);
  assert.throws(() => genRaw({ ...DESK, deskMod: 1, deskDrw: 1 }), /blochează sertarul/);
  assert.throws(() => genRaw({ ...DESK, deskMod: 1, deskModH: 100 }), /între 150/);
});
test("sertar sub blat + corpuri laterale + raft nu: tot împreună, deterministic", () => {
  const c = { ...DESK, deskPed: "both", deskPedW: 400, deskPedDr: 3, deskDrw: 1, deskCable: 2 };
  const a = genRaw(c), d = genRaw(c);
  assert.deepEqual(a.o, d.o); assert.equal(new Set(a.o.pieces.map(p => p.pk)).size, a.o.pieces.length);
  assert.ok(!a.o.pieces.some(p => p.preflight.some(w => w.level === "error")));
});
