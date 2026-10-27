/* Ebanist — fuzz al motorului: configurații aleatoare (determinist, seed fix) pe
   toate tipologiile. Caută: excepții neașteptate, NaN/negativ în distinctă,
   gabarit care nu se închide (D-43), invarianți căzuți, aserțiuni blocante,
   găuri în afara piesei (V1), cote de piesă mai mari decât placa.
   Rulare: cd test && node fuzz.js [N=3000] [seed=1]                          */
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-ops.js"), "utf8"), S, { filename: "ebanist-ops.js" });
let PRESETS = null;
{ const h = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8"); const a = h.indexOf("\nconst PRESETS = {") + 1;
  let d = 0, j = h.indexOf("{", a); for (let k = j; k < h.length; k++) { if (h[k] === "{") d++; else if (h[k] === "}" && --d === 0) { PRESETS = vm.runInNewContext("(" + h.slice(j, k + 1) + ")"); break; } } }
const N = +process.argv[2] || 3000; let seed = +process.argv[3] || 1;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const arr = x => Array.from(x || []);
/* panou pe pantă (D-86): suprapunerea reală între profilul lui (poligon convex în planul vertical) și cutia celuilalt.
   Întoarce false când nu se ating, true când se ating, null când niciuna nu are `vp` sau ambele au (se păstrează gabaritul). */
function clipArea(poly, r) {
  let P = poly.slice();
  const cut = (inside, inter) => { const out = []; for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length], ia = inside(A), ib = inside(B);
    if (ia) out.push(A); if (ia !== ib) out.push(inter(A, B)); } P = out; };
  cut(p => p[0] >= r[0], (A, B) => { const t = (r[0] - A[0]) / (B[0] - A[0]); return [r[0], A[1] + t * (B[1] - A[1])]; });
  cut(p => p[0] <= r[1], (A, B) => { const t = (r[1] - A[0]) / (B[0] - A[0]); return [r[1], A[1] + t * (B[1] - A[1])]; });
  cut(p => p[1] >= r[2], (A, B) => { const t = (r[2] - A[1]) / (B[1] - A[1]); return [A[0] + t * (B[0] - A[0]), r[2]]; });
  cut(p => p[1] <= r[3], (A, B) => { const t = (r[3] - A[1]) / (B[1] - A[1]); return [A[0] + t * (B[0] - A[0]), r[3]]; });
  let s = 0; for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; s += A[0] * B[1] - B[0] * A[1]; } return Math.abs(s) / 2;
}
function polyPoly(A, B) {                 /* aria intersecției a două poligoane convexe */
  const sgn = (() => { let t = 0; for (let i = 0; i < B.length; i++) { const p = B[i], q = B[(i + 1) % B.length]; t += p[0] * q[1] - q[0] * p[1]; } return t >= 0 ? 1 : -1; })();
  let P = A.slice();
  for (let i = 0; i < B.length && P.length; i++) {
    const p = B[i], q = B[(i + 1) % B.length], side = pt => sgn * ((q[0] - p[0]) * (pt[1] - p[1]) - (q[1] - p[1]) * (pt[0] - p[0]));
    const out = [];
    for (let k = 0; k < P.length; k++) { const U = P[k], V = P[(k + 1) % P.length], su = side(U), sv = side(V);
      if (su >= 0) out.push(U);
      if ((su >= 0) !== (sv >= 0)) { const t = su / (su - sv); out.push([U[0] + t * (V[0] - U[0]), U[1] + t * (V[1] - U[1])]); } }
    P = out;
  }
  let s = 0; for (let i = 0; i < P.length; i++) { const U = P[i], V = P[(i + 1) % P.length]; s += U[0] * V[1] - V[0] * U[1]; } return Math.abs(s) / 2;
}
function vpOverlap(a, c) {
  if (a.vp && c.vp) return a.vp.ax !== c.vp.ax ? null : polyPoly(a.vp.pts, c.vp.pts) > .6 * .6;
  if (!!a.vp === !!c.vp) return null;
  const v = a.vp ? a : c, o = a.vp ? c : a, vx = v.vp.ax === "x";
  const r = vx ? [o.x0, o.x1, o.y0, o.y1] : [o.z0, o.z1, o.y0, o.y1];
  return clipArea(v.vp.pts, r) > .6 * .6;
}
const coll = b => { const bx = b.boxes.filter(x => x && x.kind !== "g" && x.kind !== "m" && x.role && x.role !== "accessorio" && x.role !== "profilo" && x.role !== "schienale");
  const out = {};
  for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) { const a = bx[i], c = bx[j]; if (a.pk != null && a.pk === c.pk) continue;
    const pr = [a.role, c.role].sort().join("|"); if (pr === "cassetto_fianco|cassetto_fondo") continue;
    const ox = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), oy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0), oz = Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0);
    if (ox > .6 && oy > .6 && oz > .6 && vpOverlap(a, c) === false) continue;     /* panou pe pantă: gabaritul se suprapune, piesa nu */
    if (ox > .6 && oy > .6 && oz > .6) { const k = [a.role + (a.sub ? "/" + a.sub : ""), c.role + (c.sub ? "/" + c.sub : "")].sort().join(" × "); out[k] = 1; } }
  return Object.keys(out); };
const base = PRESETS ? Object.values(PRESETS) : [];
console.log("preseturi:", base.length);
const bucket = {}; const ex = {};
const note = (k0, cfg, extra) => { const k = k0 + " [" + (cfg.type || "standard") + "]"; bucket[k] = (bucket[k] || 0) + 1; if (!ex[k] || ex[k].length < 2) (ex[k] = ex[k] || []).push({ cfg, extra }); };
const KNOWN = /(lamErr|nu se combină|depășește|sub \d+ mm|lumină interioară|nu încap|non entra|nu încape|impossibile|troppo|prea|minim|maxim|deve|trebuie|must|invalid|erore|blocc|Errore|negativ|oltre|nessun materiale|fără material)/i;

for (let i = 0; i < N; i++) {
  const b = pick(base) || {};
  const cfg = Object.assign({}, b, { name: "F" + i, matBody: "__b", matFront: "__b", matBack: "__k" });
  const t = cfg.type || "standard";
  if (rnd() < .8) cfg.L = ri(300, +process.env.LMAX || 2700);
  if (rnd() < .7) cfg.H = ri(300, 2700);
  if (rnd() < .7) cfg.P = ri(200, 800);
  if (rnd() < .5) cfg.doors = ri(0, 8);
  if (rnd() < .5) cfg.drawers = ri(0, 8);
  if (rnd() < .5) cfg.tram = ri(0, 8);
  if (rnd() < .5) cfg.shelves = ri(0, 10);
  if (rnd() < .3) cfg.handles = pick(["maniglia", "push", "gola"]);
  /* D-89: tipul de gola */
  if (cfg.handles === "gola" && rnd() < .6) cfg.golaType = pick(["L", "J", "fresata"]);
  if (rnd() < .2) cfg.top = pick(["traverse", "none"]);
  if (rnd() < .2) cfg.antiWarp = pick(["auto", "all"]);
  if (rnd() < .3) cfg.support = pick(["zoccolo", "piedini", "sospeso"]);
  if (rnd() < .3) cfg.drawerSys = pick(["legno", "tandembox", "legrabox", "matrix", "movento"]);
  /* D-86: tavan înclinat pe o parte din corpurile standard */
  if (t === "standard" && rnd() < .2) {
    const hi = cfg.H || 720, lo = ri(Math.round(hi * .35), Math.max(Math.round(hi * .35), hi - 20));
    cfg.topProfile = rnd() < .5 ? { axis: "x", h0: hi, h1: lo } : { axis: "z", h0: hi, h1: lo };
    if (rnd() < .5) { const q = cfg.topProfile.h0; cfg.topProfile.h0 = cfg.topProfile.h1; cfg.topProfile.h1 = q; }
    cfg.H = Math.max(cfg.topProfile.h0, cfg.topProfile.h1);
    if (process.env.NOSLOPE) delete cfg.topProfile;   /* aceeași succesiune de numere aleatoare, fără pantă: pentru comparație */
  }
  /* D-95: lambriu — lățime, rost și direcție aleatoare */
  if (t === "lambriu") { if (rnd() < .8) cfg.lamW = ri(10, 300); if (rnd() < .8) cfg.lamGap = ri(0, 200); if (rnd() < .5) cfg.lamDir = pick(["v", "o"]); }
  if (rnd() < .2) cfg.hang = ri(0, 1);
  if (rnd() < .2) cfg.back = ri(0, 1);
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5)], hwProd: { guida: "blum_tandem" } };
  let b2;
  try { b2 = S.buildModule(cfg); }
  catch (e) { note(KNOWN.test(e.message) ? "build:eroare-declarată" : "build:EXCEPȚIE " + e.message.slice(0, 80), cfg, e.message); continue; }
  const pcs = b2.pieces || [];
  if (!pcs.length && t !== "tondo") note("fără piese", cfg);
  for (const p of pcs) {
    if (!isFinite(p.lung) || !isFinite(p.larg) || !(p.pz >= 1) || p.lung <= 0 || p.larg <= 0) { note("piesă invalidă", cfg, p); break; }
    if (p.pz !== Math.round(p.pz)) { note("pz neîntreg", cfg, p); break; }
    if (!/^Accessorio|accessorio|Profilo/.test(String(p.mat || "")) && p.role !== "accessorio" && Math.max(p.lung, p.larg) > 2800 + .5 && !p.seg) { note("piesă > placă", cfg, [p.elemento, p.lung, p.larg]); break; }
  }
  try { if (b2.boxes) coll(b2).forEach(k => note("coliziune " + k + ((b2.draw && b2.draw.warn && b2.draw.warn.length) || (b2.warn && Object.values(b2.warn).some(v => v)) ? " (cu avertisment)" : " (FĂRĂ avertisment)"), cfg)); } catch (e) {}
  if (t === "lambriu") {
    /* închidere (D-43) pe piese: lamelele ocupă exact lungimea, foile de suport exact lățimea, nicio piesă peste placă */
    const horiz = cfg.lamDir === "o", span = horiz ? cfg.H : cfg.L, sl = pcs.find(x => x.role === "lamela"), bks = pcs.filter(x => x.role === "schienale");
    const lam = b2.boxes.filter(x => x.role === "lamela").sort((x, y) => horiz ? x.y0 - y.y0 : x.x0 - y.x0);
    const lo = horiz ? "y0" : "x0", hi = horiz ? "y1" : "x1";
    if (!sl || sl.pz !== lam.length) note("lambriu: lamele ≠ cutii 3D", cfg, [sl && sl.pz, lam.length]);
    else if (lam.length > 1 && (Math.abs(lam[0][lo]) > 1e-6 || Math.abs(lam[lam.length - 1][hi] - span) > 1e-6)) note("lambriu: lamelele nu ajung la capete", cfg, [lam[0][lo], lam[lam.length - 1][hi], span]);
    else if (lam.length > 1) { const g = lam[1][lo] - lam[0][hi]; for (let k = 1; k < lam.length; k++) if (Math.abs((lam[k][lo] - lam[k - 1][hi]) - g) > 1e-6) { note("lambriu: rosturi inegale", cfg, [k, g]); break; } }
    if (cfg.back && bks.length && bks.reduce((a2, x) => a2 + x.larg * x.pz, 0) !== cfg.L) note("lambriu: foile de suport ≠ lățimea", cfg, bks.map(x => [x.larg, x.pz]));
    if (b2.lam && b2.lam.n !== (sl && sl.pz)) note("lambriu: lam.n ≠ rând", cfg);
    continue;
  }
  if (t !== "standard" && t !== "angolare") continue;
  try {
    const pieces = pcs.map(x => Object.assign({}, x));
    const G = S.deriveCarcass(S.carcassParams(cfg, {}));
    const M = S.carcassMaterials(cfg);
    const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
    const c = arr(S.validateCarcassClosure(cfg, pieces, G)); if (c.length) note("închidere", cfg, c.slice(0, 2));
    const k = arr(S.failedInvariants(cfg, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id); if (k.length) note("invariant " + k.join(","), cfg);
    const a = arr(S.checkAssertions(G, {})).filter(x => x.blocking || x.level === "blocking"); if (a.length) note("aserțiune " + a.map(x => x.id).join(","), cfg);
    if (b2.boxes && b2.boxes.length) {
      const o = S.generateOperations({ boxes: b2.boxes, cfg, G });
      const w = {}; arr(o.warnings).forEach(x => w[x.k || x.rule || "?"] = 1);
      Object.keys(w).forEach(k2 => note("ops:" + k2, cfg));
      arr(o.pieces).forEach(p => arr(p.warnings || p.preflight).forEach(x => { if (x.level === "error") note("ops-pre:" + x.rule, cfg, [p.n, x]); }));
    }
  } catch (e) { note("EXCEPȚIE în verificări: " + e.message.slice(0, 90), cfg, e.stack.split("\n")[1]); }
}
console.log("N =", N);
Object.keys(bucket).sort((a, b) => bucket[b] - bucket[a]).forEach(k => console.log(String(bucket[k]).padStart(5), k));
fs.writeFileSync(path.join(__dirname, "fuzz-out.json"), JSON.stringify(ex, null, 1));
