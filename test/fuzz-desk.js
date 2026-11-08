/* Fuzz pe Birou (D-118): combinații aleatoare de dimensiuni, corp cu sertare, raft de tastatură, treceri de cabluri.
 *   node fuzz-desk.js [n] [seed]
 * Acceptat: eroarea documentată (nu are loc / genunchi / prea lungi / 300 și 800). Orice altceva, sau o piesă cu eroare de
 * pre-flight, sau pk dublu, e cădere. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
const N = +process.argv[2] || 500; let seed = +process.argv[3] || 1;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => Math.round(a + rnd() * (b - a));
const OK = /nu are loc|nu au loc|genunchi|prea lungi|300 și 800|mai scund|blochează|puțin adânc|minimum 380|între 150|nu poate sta corp|între 400/;
let ok = 0, refused = 0; const bad = [];
for (let i = 0; i < N; i++) {
  const cfg = { type: "scrivania", L: ri(900, 2400), H: ri(680, 780), P: ri(450, 900), deskPed: pick([null, "sx", "dx", "both"]), deskPedW: ri(300, 700),
    deskPedDr: ri(1, 6), deskKb: pick([null, "ka300", "ka350", "ka400", "ka500"]), deskKbW: pick([null, 400, 560, 700]), deskCable: ri(0, 3), deskDrw: pick([0, 0, 1]), deskMod: pick([0, 0, 1]), deskModH: pick([null, 300, 450]), deskRet: pick([null, null, "sx", "dx"]), deskRetL: ri(400, 2000), deskRetW: ri(400, 800) };
  S.handleIsProfile = () => false;
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k", matOvr: {}, matAdd: [MM("__b", pick([18, 19, 25])), MM("__k", 3)], hwProd: { guida: "blum_tandem" } };
  const full = Object.assign({ name: "M", matBody: "__b", matFront: "__b", matBack: "__k" }, cfg);
  try {
    const b = S.buildModule(full), o = S.generateOperations({ boxes: b.boxes, cfg: full, G: null });
    const errs = o.pieces.filter(p => p.preflight.some(w => w.level === "error")).map(p => p.role + ":" + p.preflight.filter(w => w.level === "error").map(w => w.rule + (w.op || "")).join(","));
    const dup = new Set(o.pieces.map(p => p.pk)).size !== o.pieces.length;
    if (errs.length || dup) bad.push({ cfg, errs, dup }); else ok++;
  } catch (e) { if (OK.test(e.message)) refused++; else bad.push({ cfg, throw: e.message }); }
}
console.log(`birou: ${ok} ok, ${refused} refuzate (eroare documentată), ${bad.length} căzute`);
bad.slice(0, 5).forEach(x => console.log(JSON.stringify(x)));
process.exit(bad.length ? 1 : 0);
