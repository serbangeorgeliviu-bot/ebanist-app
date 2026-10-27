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
const coll = b => { const bx = b.boxes.filter(x => x && x.kind !== "g" && x.kind !== "m" && x.role && x.role !== "accessorio" && x.role !== "profilo" && x.role !== "schienale" && x.role !== "rama_camp");
  const out = {};
  for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) { const a = bx[i], c = bx[j]; if (a.pk != null && a.pk === c.pk) continue;
    const pr = [a.role, c.role].sort().join("|"); if (pr === "cassetto_fianco|cassetto_fondo") continue;
    const ox = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), oy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0), oz = Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0);
    if (ox > .6 && oy > .6 && oz > .6 && vpOverlap(a, c) === false) continue;     /* panou pe pantă: gabaritul se suprapune, piesa nu */
    if (ox > .6 && oy > .6 && oz > .6) { const k = [a.role + (a.sub ? "/" + a.sub : ""), c.role + (c.sub ? "/" + c.sub : "")].sort().join(" × "); out[k] = 1; } }
  return Object.keys(out); };
const span2 = (c, horiz) => horiz ? c.L : c.H;
const base = PRESETS ? Object.values(PRESETS) : [];
console.log("preseturi:", base.length);
const bucket = {}; const ex = {};
const note = (k0, cfg, extra) => { const k = k0 + " [" + (cfg.type || "standard") + "]"; bucket[k] = (bucket[k] || 0) + 1; if (!ex[k] || ex[k].length < 2) (ex[k] = ex[k] || []).push({ cfg, extra }); };
const KNOWN = /(contErr|rfErr|lamErr|nu se combină|depășește|sub \d+ mm|lumină interioară|nu încap|non entra|nu încape|impossibile|troppo|prea|minim|maxim|deve|trebuie|must|invalid|erore|blocc|Errore|negativ|oltre|nessun materiale|fără material)/i;

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
  if (t === "lambriu") { if (rnd() < .8) cfg.lamW = ri(10, 300); if (rnd() < .8) cfg.lamGap = ri(0, 200); if (rnd() < .5) cfg.lamDir = pick(["v", "o"]);
    if (rnd() < .6) { cfg.lamCuts = []; for (let k = ri(1, 4); k > 0; k--) { const cw = ri(20, 250), ch = ri(20, 250); cfg.lamCuts.push({ x: ri(0, Math.max(0, cfg.L - cw)), y: ri(0, Math.max(0, cfg.H - ch)), w: Math.min(cw, cfg.L), h: Math.min(ch, cfg.H) }); } }
    if (rnd() < .15) cfg.H = ri(2800, 3300); }
  /* D-101: piesă cu contur liber — formă, raze, săgeată, poziție, bucăți */
  if (t === "contur") { cfg.cShape = pick(["rect", "round", "arch", "scoop"]); cfg.cR = ri(0, 300); cfg.cRise = ri(0, 400); cfg.cOri = pick(["v", "o"]); cfg.cPz = ri(1, 4); cfg.cEdge = ri(0, 1); cfg.L = ri(150, 2700); cfg.H = ri(150, 2000); }
  /* D-98: colț între doi pereți, pe jumătate din lambriuri și boiserii */
  if ((t === "lambriu" || t === "boiserie") && rnd() < .5) { cfg.wall2 = 1; cfg.L2 = ri(300, 2700); cfg.corner = pick(["sx", "dx"]); cfg.cornerKind = pick(["int", "ext"]);
    if (rnd() < .5) { cfg.lamCuts = (cfg.lamCuts || []).concat([{ x: ri(60, Math.max(60, cfg.L2 - 100)), y: ri(0, 1500), w: ri(20, 90), h: ri(20, 90), wall: "B" }]); } }
  /* D-97: boiserie — ramă, câmp dorit, rânduri, decupaje */
  if (t === "boiserie") { if (rnd() < .8) cfg.rfW = ri(20, 200); if (rnd() < .8) cfg.rfTarget = ri(100, 1500); if (rnd() < .7) cfg.rfRows = ri(1, 8);
    if (rnd() < .5) { cfg.lamCuts = []; for (let k = ri(1, 3); k > 0; k--) { const cw = ri(20, 200), ch = ri(20, 200); cfg.lamCuts.push({ x: ri(0, Math.max(0, cfg.L - cw)), y: ri(0, Math.max(0, cfg.H - ch)), w: Math.min(cw, cfg.L), h: Math.min(ch, cfg.H) }); } } 
    /* D-100: panou încastrat în ramă pe o parte din configurații, cu un panou subțire pentru fronturi */
    if (rnd() < .4) { cfg.rfInset = 1; cfg.matFront = "__p"; } }
  if (rnd() < .2) cfg.hang = ri(0, 1);
  if (rnd() < .2) cfg.back = ri(0, 1);
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
    matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5), MM("__p", 8)], hwProd: { guida: "blum_tandem" } };
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
  if ((t === "lambriu" || t === "boiserie") && cfg.wall2) {
    /* două pereți: B trebuie să iasă la fel ca un perete singur de lățime L2 (−grosimea la colț interior), în octantul pozitiv, fără suprapuneri (coliziunile le prinde `coll`) */
    const th = 19 + (cfg.back ? 3 : 0), Leff = cfg.cornerKind === "ext" ? cfg.L2 : cfg.L2 - th;
    const nB = pcs.filter(x => x.wing === "B").reduce((a2, x) => a2 + x.pz, 0), nA = pcs.filter(x => x.wing === "A").reduce((a2, x) => a2 + x.pz, 0);
    if (!nA || !nB) note("colț: un perete fără piese", cfg, [nA, nB]);
    const shift = cfg.cornerKind === "ext" ? 0 : th, cutsB = arr(cfg.lamCuts).filter(c => c.wall === "B").map(c => ({ x: c.x - shift, y: c.y, w: c.w, h: c.h }));
    let sA, sB; try { sA = S.buildModule(Object.assign({}, cfg, { wall2: 0, lamCuts: arr(cfg.lamCuts).filter(c => c.wall !== "B") })); sB = S.buildModule(Object.assign({}, cfg, { wall2: 0, L: Leff, lamCuts: cutsB })); }
    catch (e) { note("colț: perete singur pică dar cu doi nu", cfg, e.message); sA = null; }
    if (sA) {
      if (nA !== sA.pieces.reduce((a2, x) => a2 + x.pz, 0)) note("colț: piesele lui A diferă de peretele singur", cfg);
      if (nB !== sB.pieces.reduce((a2, x) => a2 + x.pz, 0)) note("colț: piesele lui B diferă de peretele singur", cfg, [nB, sB.pieces.reduce((a2, x) => a2 + x.pz, 0)]);
    }
    if (b2.boxes.some(x => x.x0 < -1e-9 || x.z0 < -1e-9 || !(x.x1 > x.x0) || !(x.z1 > x.z0))) note("colț: cutie în afara octantului", cfg);
    if (cfg.rfInset) { try { const o3 = S.generateOperations({ boxes: b2.boxes, cfg, G: undefined });
      const np = pcs.filter(x => x.role === "rama_camp").reduce((a2, x) => a2 + x.pz, 0);
      const sl3 = arr(o3.pieces).filter(p => p.role === "rama_montant" || p.role === "rama_traversa").reduce((a2, p) => a2 + arr(p.operations).filter(q => q.type === "slot").length, 0);
      if (sl3 !== 4 * np) note("colț încastrat: canale ≠ 4·panouri", cfg, [sl3, 4 * np]); } catch (e) { note("colț încastrat: EXCEPȚIE ops " + e.message.slice(0, 60), cfg); } }
    /* fiecare piesă fizică are pk-ul ei: pk distincte = suma pz a rândurilor; un pk nu poate avea două roluri */
    { const roleOf = {}; let mix = false; b2.boxes.forEach(x => { if (roleOf[x.pk] && roleOf[x.pk] !== x.role) mix = true; roleOf[x.pk] = x.role; });
      const nPk = Object.keys(roleOf).length, nRows = pcs.reduce((a2, x) => a2 + x.pz, 0);
      if (mix || nPk !== nRows) note("colț: pk-uri ≠ piese", cfg, [nPk, nRows, mix]); }
    continue;
  }
  if (t === "contur") {
    /* piesa: n triunghiuri pe copie, aria lor = aria conturului aplatizat; ops: o operație contour în dreptunghiul piesei, aria păstrată */
    const N = S.EBContour.normalize(S.EBContour.shape(cfg.cShape, cfg.L, cfg.H, { r: cfg.cR, rise: cfg.cRise }));
    if (!N.ok) { note("contur: forma gata nu se normalizează", cfg, N.reason); continue; }
    const P3 = S.EBContour.flatten(N.pts, 0.3), want = Math.abs(S.EBContour.polyArea(P3)), pk = {};
    b2.boxes.forEach(x => { const A = x.prism3.A, f = cfg.cOri === "o" ? [0, 2] : [0, 1];
      pk[x.pk] = (pk[x.pk] || 0) + Math.abs((A[1][f[0]] - A[0][f[0]]) * (A[2][f[1]] - A[0][f[1]]) - (A[1][f[1]] - A[0][f[1]]) * (A[2][f[0]] - A[0][f[0]])) / 2; });
    if (Object.keys(pk).length !== cfg.cPz) note("contur: copii ≠ cPz", cfg);
    Object.values(pk).forEach(a2 => { if (Math.abs(a2 - want) > 1e-6 * Math.max(1, want)) note("contur: aria triunghiurilor ≠ aria conturului", cfg, [a2, want]); });
    const row = pcs[0]; if (!row || row.pz !== cfg.cPz) note("contur: rândul", cfg);
    if (cfg.cEdge && !(row.perim > 0)) note("contur: cant fără perimetru", cfg);
    try { const o4 = S.generateOperations({ boxes: b2.boxes, cfg, G: undefined });
      arr(o4.pieces).forEach(p => { const op = arr(p.operations).find(q => q.type === "contour"); if (!op) { note("contur: lipsește operația", cfg); return; }
        const bb = S.EBContour.bbox(op.pts);
        if (bb.x0 < -0.3 || bb.y0 < -0.3 || bb.x1 > p.length + 0.3 || bb.y1 > p.width + 0.3) note("contur: operația iese din piesă", cfg, [bb, p.length, p.width]);
        if (Math.abs(Math.abs(S.EBContour.area(op.pts)) - N.area) > 0.01 * N.area + 20) note("contur: aria operației ≠ aria conturului", cfg, [S.EBContour.area(op.pts), N.area]); });
    } catch (e) { note("contur: EXCEPȚIE ops " + e.message.slice(0, 60), cfg); }
    continue;
  }
  if (t === "boiserie") {
    const st = b2.boxes.filter(x => x.role === "rama_montant").sort((x, y) => x.x0 - y.x0), tr = b2.boxes.filter(x => x.role === "rama_traversa");
    const rf = b2.rf, fw = Math.round(cfg.rfW || 60);
    if (!rf) note("boiserie: fără rf", cfg);
    else {
      if (st.length !== rf.n + 1) note("boiserie: montanți ≠ n+1", cfg, [st.length, rf.n]);
      if (tr.length !== rf.n * (rf.m + 1)) note("boiserie: traverse ≠ n·(m+1)", cfg, [tr.length, rf.n, rf.m]);
      if (st.length && (Math.abs(st[0].x0) > 1e-9 || Math.abs(st[st.length - 1].x1 - cfg.L) > 1e-9)) note("boiserie: montanții nu ajung la capete", cfg);
      for (let k = 1; k < st.length; k++) if (Math.abs((st[k].x0 - st[k - 1].x1) - rf.field) > 1e-9) { note("boiserie: câmpuri inegale pe lățime", cfg, [k]); break; }
      const ys = [...new Set(tr.map(x => Math.round(x.y0 * 1e6)))].sort((x, y) => x - y).map(k => tr.find(x => Math.round(x.y0 * 1e6) === k));
      if (ys.length && (Math.abs(ys[0].y0) > 1e-9 || Math.abs(ys[ys.length - 1].y1 - cfg.H) > 1e-9)) note("boiserie: traversele nu ajung la capete", cfg);
      for (let k = 1; k < ys.length; k++) if (Math.abs((ys[k].y0 - ys[k - 1].y1) - rf.fieldH) > 1e-9) { note("boiserie: câmpuri inegale pe înălțime", cfg, [k]); break; }
      const wsum = pcs.filter(x => x.role === "rama_montant").reduce((a2, x) => a2 + x.larg * x.pz, 0);
      if (wsum + rf.n * rf.field !== cfg.L) note("boiserie: rânduri montanți + câmpuri ≠ lățimea", cfg, [wsum, rf.n, rf.field, cfg.L]);
      const hsum = pcs.filter(x => x.role === "rama_traversa").reduce((a2, x) => a2 + x.larg * x.pz, 0) / rf.n;
      if (hsum + rf.m * rf.fieldH !== cfg.H) note("boiserie: rânduri traverse + câmpuri ≠ înălțimea", cfg, [hsum, rf.m, rf.fieldH, cfg.H]);
      if (pcs.some(x => (x.role === "rama_montant" || x.role === "rama_traversa") && Math.max(x.lung, x.larg) > 2800)) note("boiserie: piesă peste placă", cfg);
      if (cfg.rfInset && !cfg.wall2) {
        /* panourile: câte unul pe câmp, cu dimensiunea câmpului + 2·gd; fiecare intră în patru canale; canalele unui panou cu gaură rămân întregi */
        const pn = pcs.filter(x => x.role === "rama_camp").reduce((a2, x) => a2 + x.pz, 0);
        if (pn !== rf.n * rf.m) note("boiserie încastrat: panouri ≠ n·m", cfg, [pn, rf.n * rf.m]);
        if (pcs.filter(x => x.role === "rama_camp").some(x => x.lung !== rf.fieldH + 16 || x.larg !== rf.field + 16)) note("boiserie încastrat: panou ≠ câmp + 2·gd", cfg);
        try { const o2 = S.generateOperations({ boxes: b2.boxes, cfg, G: undefined });
          const sl = arr(o2.pieces).filter(p => p.role === "rama_montant" || p.role === "rama_traversa").reduce((a2, p) => a2 + arr(p.operations).filter(q => q.type === "slot").length, 0);
          if (sl !== 4 * rf.n * rf.m) note("boiserie încastrat: canale ≠ 4·panouri", cfg, [sl, 4 * rf.n * rf.m]);
          arr(o2.pieces).forEach(p => arr(p.preflight).forEach(x => { if (x.level === "error") note("boiserie încastrat ops-pre:" + x.rule, cfg); }));
        } catch (e) { note("boiserie încastrat: EXCEPȚIE ops " + e.message.slice(0, 60), cfg); }
      }
    }
    continue;
  }
  if (t === "lambriu") {
    /* închidere (D-43) pe piese: lamelele ocupă exact lungimea, foile de suport exact lățimea, nicio piesă peste placă */
    const horiz = cfg.lamDir === "o", span = horiz ? cfg.H : cfg.L, bks = pcs.filter(x => x.role === "schienale");
    const lam = b2.boxes.filter(x => x.role === "lamela"), lo = horiz ? "y0" : "x0", hi = horiz ? "y1" : "x1";
    const nRows = pcs.filter(x => x.role === "lamela").reduce((a2, x) => a2 + x.pz, 0);
    if (nRows !== lam.length) note("lambriu: lamele ≠ cutii 3D", cfg, [nRows, lam.length]);
    if (b2.lam && b2.lam.pieces !== nRows) note("lambriu: lam.pieces ≠ rânduri", cfg, [b2.lam.pieces, nRows]);
    const cols = [...new Set(lam.map(x => Math.round(x[lo] * 1e6)))].sort((x, y) => x - y).map(k => lam.find(x => Math.round(x[lo] * 1e6) === k));
    if (cols.length !== (b2.lam && b2.lam.n)) note("lambriu: coloane ≠ n", cfg, [cols.length, b2.lam && b2.lam.n]);
    else if (cols.length > 1 && (Math.abs(cols[0][lo]) > 1e-6 || Math.abs(cols[cols.length - 1][hi] - span) > 1e-6)) note("lambriu: lamelele nu ajung la capete", cfg, [cols[0][lo], cols[cols.length - 1][hi], span]);
    else if (cols.length > 1) { const g = cols[1][lo] - cols[0][hi]; for (let k = 1; k < cols.length; k++) if (Math.abs((cols[k][lo] - cols[k - 1][hi]) - g) > 1e-6) { note("lambriu: rosturi inegale", cfg, [k, g]); break; } }
    if (cfg.back && bks.length && bks.reduce((a2, x) => a2 + x.larg * x.pz, 0) !== cfg.L) note("lambriu: foile de suport ≠ lățimea", cfg, bks.map(x => [x.larg, x.pz]));
    /* pe fiecare lamelă: bucățile + (uniunea decupajelor care o ating) = lungimea, nicio bucată peste placă */
    { const cuts = arr(cfg.lamCuts), colK = {}; const uv = horiz ? (b) => [b.y0, b.y1, b.x0, b.x1] : (b) => [b.x0, b.x1, b.y0, b.y1];
      lam.forEach(bx => { const [v0, v1, u0, u1] = uv(bx), k = Math.round(v0 * 1000); (colK[k] = colK[k] || { v0, v1, sum: 0, n: 0 }).sum += u1 - u0; colK[k].n++; if (u1 - u0 > 2800 + 1e-6) note("lambriu: bucată peste placă", cfg, [u1 - u0]); });
      for (const k of Object.keys(colK)) { const c = colK[k], iv = [];
        cuts.forEach(q => { const q0 = horiz ? q.y : q.x, q1 = q0 + (horiz ? q.h : q.w), a0 = horiz ? q.x : q.y, a1 = a0 + (horiz ? q.w : q.h); if (Math.min(c.v1, q1) - Math.max(c.v0, q0) > 1e-9) iv.push([a0, a1]); });
        iv.sort((x, y) => x[0] - y[0]); let cov = 0, cur = -1; iv.forEach(q => { const a0 = Math.max(q[0], cur); if (q[1] > a0) { cov += q[1] - a0; cur = q[1]; } });
        if (Math.abs(c.sum + cov - span2(cfg, horiz)) > 1e-6) { note("lambriu: lamelă ≠ bucăți + decupaje", cfg, [c.sum, cov]); break; } } }
    continue;
  }
  if (t === "angolare" && b2.boxes) {
    /* D-99: ala B stă pe partea camerei. Interior: B începe la fața lui A (z ≥ zmax(A)) și se sprijină de peretele B (x=L sau x=0);
       exterior: B stă în spatele planului lui A (z ≤ 0). A nu intră niciodată în perete (z ≥ 0). */
    const A2 = b2.boxes.filter(x => x.wing !== "B"), B2 = b2.boxes.filter(x => x.wing === "B");
    const zA = Math.max(...A2.map(x => x.z1)), eps = 1e-6, L = cfg.L, dxx = cfg.corner === "dx";
    if (A2.some(x => x.z0 < -eps)) note("angolare: ala A în perete", cfg);
    if (B2.length) {
      if (cfg.cornerKind === "ext") { if (B2.some(x => x.z1 > eps)) note("angolare ext: ala B în fața planului lui A", cfg); }
      else {
        if (B2.some(x => x.z0 < zA - 1e-3)) note("angolare int: ala B nu începe la fața lui A", cfg, [Math.min(...B2.map(x => x.z0)), zA]);
        if (dxx ? B2.some(x => x.x1 > L + 1e-3) : B2.some(x => x.x0 < -1e-3)) note("angolare int: ala B în peretele B", cfg);
      }
    }
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
