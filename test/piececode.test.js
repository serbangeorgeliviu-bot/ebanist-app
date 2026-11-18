/* ebanist-piececode.js — codul QR al piesei fără comandă și fără cont (pur) */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "../app", f), "utf8");
const C = new Function(read("ebanist-piececode.js") + "\nreturn globalThis.EBPieceCode;")();
const vm = require("node:vm"), ctx = vm.createContext({}); vm.runInContext(read("ebanist-qr.js"), ctx); const Q = ctx.EBQR;
const J = x => JSON.parse(JSON.stringify(x));
const piece = { modulo: "Corp 1", elemento: "Fianco sx", materiale: "Egger H1180 19", bordo: "A2B1", pz: 2 };
const pcOf = ops => ({ role: "fianco", length: 720, width: 560, thickness: 19, operations: ops });
const drill = (x, y, d, p, note, face) => ({ type: "drill", face: face || 5, x, y, dia: d, depth: p, through: false, note });

test("dus-întors: cote, material, cant, găuri pe față și pe cant, canal, note", () => {
  const ops = [drill(9.5, 510.04, 5, 11, "perno minifix"), drill(9.5, 478, 8, 12, "tassello"), drill(37, 32, 5, 13, "perno minifix"),
    { type: "drill", face: 3, u: 100.25, z: 9.5, dia: 8, depth: 25, through: false, note: "tassello" },
    { type: "groove", face: 6, from: { x: 8, y: 10 }, to: { x: 8, y: 700 }, width: 4, depth: 8, note: "canal spate" }];
  const e = C.encode(piece, pcOf(ops), { project: "Bufet Cetinic ~ test", n: 7 });
  assert.strictEqual(e.mode, "full"); assert.strictEqual(e.omitted, 0);
  assert.ok(e.url.startsWith("https://ebanist.com/app/#p=1~"));
  const m = C.parse(e.url), pc = m.pc; assert.strictEqual(pc.fromCode, true);
  assert.strictEqual(m.project, "Bufet Cetinic ~ test"); assert.strictEqual(pc.n, 7);
  assert.deepStrictEqual([pc.length, pc.width, pc.thickness, pc.role], [720, 560, 19, "fianco"]);
  const row = m.M.meta.qr.row; assert.deepStrictEqual(J(row), { modulo: "Corp 1", elemento: "Fianco sx", role: "fianco", lung: 720, larg: 560, pz: 2, materiale: "Egger H1180 19", bordo: "A2B1" });
  assert.strictEqual(pc.operations.length, 5);
  assert.deepStrictEqual(J(pc.operations[0]), { type: "drill", face: 5, dia: 5, depth: 11, through: false, id: "op_001", x: 9.5, y: 510, note: "perno minifix" });
  assert.deepStrictEqual(J(pc.operations[3]), { type: "drill", face: 3, dia: 8, depth: 25, through: false, id: "op_004", u: 100.3, z: 9.5, note: "tassello" });
  assert.deepStrictEqual(J(pc.operations[4]), { type: "groove", face: 6, from: { x: 8, y: 10 }, to: { x: 8, y: 700 }, width: 4, depth: 8, id: "op_005", note: "canal spate" });
  assert.strictEqual(m.omitted, 0);
});
test("operațiile care nu se pot scrie compact se numără ca omise, nu se inventează", () => {
  const e = C.encode(piece, pcOf([drill(9.5, 50, 5, 11), { type: "contour", face: 5, pts: [[0, 0, 0], [1, 1, 0], [2, 0, 0]] }, { type: "slot", face: 3, u: 1 }]), {});
  const m = C.parse(e.url); assert.strictEqual(m.pc.operations.length, 1); assert.strictEqual(m.omitted, 2);
});
test("prea multe operații: cod numai cu antetul (cote, material, cant) și numărul operațiilor lăsate pe dinafară", () => {
  const many = Array.from({ length: 80 }, (_, i) => drill(9.5, 32 + i * 32, 5, 12.5, "reggipiano"));
  const e = C.encode(piece, pcOf(many), { project: "P" });
  assert.strictEqual(e.mode, "head"); assert.ok(e.url.length <= C.MAX, e.url.length);
  const m = C.parse(e.url); assert.strictEqual(m.pc.operations.length, 0); assert.strictEqual(m.omitted, 80); assert.strictEqual(m.pc.length, 720);
});
test("găurile cu același profil se grupează: sistem 32 pe un fianco de 25 de găuri → cod scurt", () => {
  const ops = []; for (let i = 0; i < 10; i++) { ops.push(drill(37, 32 + i * 32, 5, 13, "reggipiano")); ops.push(drill(523, 32 + i * 32, 5, 13, "reggipiano")); }
  ops.push(drill(9.5, 510, 5, 11, "perno minifix"), drill(9.5, 50, 5, 11, "perno minifix"), drill(9.5, 478, 8, 12, "tassello"), drill(9.5, 82, 8, 12, "tassello"), { type: "drill", face: 3, u: 100, z: 9.5, dia: 8, depth: 25, through: false, note: "tassello" });
  const e = C.encode(piece, pcOf(ops), { project: "Bucătărie Popescu", n: 3 });
  assert.strictEqual(e.mode, "full"); assert.ok(e.url.length <= C.MAX, "lungime " + e.url.length);
  const m = C.parse(e.url); assert.strictEqual(m.pc.operations.length, 25);
  assert.strictEqual(m.pc.operations.filter(o => o.note === "reggipiano").length, 20);
  const q = Q.encode(e.url, "L"); assert.ok(q.version <= 14, "versiune " + q.version);
});
test("un fianco obișnuit (25 de găuri) încape și se poate genera ca QR la un nivel scanabil", () => {
  const ops = Array.from({ length: 25 }, (_, i) => drill(9.5 + (i % 2) * 28, 32 + i * 20.5, i % 3 ? 5 : 8, 11.5, i % 2 ? "perno minifix" : "tassello"));
  const e = C.encode(piece, pcOf(ops), { project: "Bucătărie Popescu", n: 12 });
  assert.ok(e.mode === "full" || e.mode === "head");   // 25 de găuri cu note alternante pot depăși plafonul: atunci numai antetul
  const q = Q.encode(e.url, "L"); assert.ok(q.version <= 14, "versiune " + q.version + ", " + e.url.length + " caractere");
});
test("text necunoscut sau stricat → null; valori absurde sunt tăiate, nu cad", () => {
  assert.strictEqual(C.parse("https://ebanist.com/"), null); assert.strictEqual(C.parse("#p=2~x"), null); assert.strictEqual(C.parse("#p=1~a~b"), null);
  assert.strictEqual(C.parse("#p=1~P~M~E~Mat~B~1~~fianco~0~0~0~~~0"), null);
  const m = C.parse("#p=1~P~M~E~Mat~B~99999~~fianco~99999~100~19~~d5,3,4,0,:1/2;dx,1:1/2;g9,5,6,:1/2/3/4;d5,3,4,0,:NaN/2;d5,3,4,0,:7/8/9~0");
  assert.strictEqual(m.pc.length, 10000); assert.strictEqual(m.M.meta.qr.row.pz, 999); assert.strictEqual(m.pc.operations.length, 1);   // numai d5…:1/2 e valid
});
test("acceptă și fragmentul singur și `p=`", () => {
  const e = C.encode(piece, pcOf([drill(1, 2, 5, 6)]), {}); const frag = e.url.slice(e.url.indexOf("#"));
  assert.ok(C.parse(frag)); assert.ok(C.parse(frag.slice(1))); assert.ok(C.parse("\n  " + e.url + "  "));
});
