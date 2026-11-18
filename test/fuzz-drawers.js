/* Ebanist — fuzz al sistemelor de sertar din ebanist-drawers-more.js (determinist, seed fix).
 *   cd test && node fuzz-drawers.js [N=1500] [seed=1]
 * Pentru fiecare configurație aleatoare (dimensiuni, număr de sertare, grosime laterală 16/18/19, sistem Hettich/GRASS sau sertar din lemn pe
 * glisierele noi, înălțime cerută sau automată, sertar interior sau în vedere) caută: excepții, NaN/negativ în distinctă, gabarit care nu se închide
 * (D-43), invarianți căzuți, cutii 3D ale sertarului care ies din corp sau se lovesc de pereți, NL care nu există în lista înălțimii alese, înălțime
 * de spate care nu e din tabel. Un plan care nu iese (ok=0) trebuie să spună de ce (avertisment) și să nu lase rânduri de sertar în distinctă.
 * Nu intră în `test:all`. Ieșire 1 dacă găsește ceva. */
const H = require("./drawers-more.helpers.js");
const vm = require("vm");
const S = H.load(true), MO = vm.runInContext("EBDrawersMore", S);
const N = +process.argv[2] || 1500; let seed = +process.argv[3] || 1;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const arr = x => Array.from(x || []);
const SYS = ["het_avantech", "het_arcitech", "gr_nps", "gr_v8", "gr_v13", "legno", "legno"];
const GUIDE = ["gr_dynapro", "het_actro_5d", "het_quadro_v6", "haf_matrix_um_a", "acc_3832sc", "het_actro_you"];
const THS = { 16: { matBody: "__b16", matFront: "__b16" }, 18: { matBody: "__b18", matFront: "__b18" }, 19: {} };
const bad = {}, seen = { ok: 0, blocked: 0, bySys: {} };
const note = (k, c) => { (bad[k] = bad[k] || []).push(c); };
for (let i = 0; i < N; i++) {
  const sys = pick(SYS), t = pick([16, 18, 19]);
  const cfg = Object.assign({ drawerSys: sys, L: ri(180, 1500), H: ri(300, 2400), P: ri(220, 780), drawers: ri(1, 8), tram: pick([0, 0, 0, 1, 2]), doors: pick([0, 0, 1, 2]),
    drawerDist: pick(["uguali", "fix", "cucina"]), drawerFH: ri(80, 400), drawerPos: pick(["auto", "vista", "interno"]), plinth: pick([0, 100]), support: pick(["zoccolo", "sospeso"]) }, THS[t]);
  if (rnd() < .4 && sys !== "legno") cfg.drawerH = pick(Object.keys(MO.box(sys).hs));
  const guida = sys === "legno" ? pick(GUIDE.concat(["blum_tandem", "blum_movento"])) : null;
  let B;
  try { B = H.build(S, cfg, guida); } catch (e) { note("exceptie: " + String(e.message).slice(0, 90), { sys, t, cfg, guida }); continue; }
  const tag = { sys, t, guida, L: cfg.L, P: cfg.P, H: cfg.H, n: cfg.drawers, dH: cfg.drawerH };
  const draws = arr(B.b.draws).map(g => g.plan).filter(Boolean);
  const dRows = B.pieces.filter(p => /cassetto/i.test(p.elemento) && !/^Frontale/.test(p.elemento));
  B.pieces.forEach(p => { if (![p.lung, p.larg, p.pz].every(v => isFinite(v) && v > 0)) note("NaN/negativ în distinctă: " + p.elemento, tag); });
  let anyOk = false;
  draws.forEach(p => {
    seen.bySys[p.sysId] = (seen.bySys[p.sysId] || 0) + 1;
    if (!p.ok) { seen.blocked++; if (!(p.warn && p.warn.length)) note("plan blocat fără avertisment", tag); return; }
    anyOk = true; seen.ok++;
    const box = MO.box(p.sysId);
    if (box) {
      if (!box.nlBy[p.hcode] || box.nlBy[p.hcode].indexOf(p.nl) < 0) note("înălțimea " + p.hcode + " nu există la NL " + p.nl, tag);
      if (p.backH !== box.backHs[p.hcode]) note("înălțimea spatelui nu e din tabel", tag);
      if (p.nl + box.rear > B.G.P_int + 1e-6) note("NL + adâncimea minimă depășește adâncimea utilă", tag);
      (p.fronts || []).forEach(f => { if (f.hcode && box.nlBy[f.hcode].indexOf(p.nl) < 0) note("înălțimea per sertar " + f.hcode + " nu există la NL " + p.nl, tag); });
    }
  });
  if (!anyOk && draws.length && dRows.length) note("plan neok dar cu rânduri de cutie în distinctă", tag);
  if (anyOk) {
    if (B.close().length) note("gabarit: " + JSON.stringify(B.close()).slice(0, 100), tag);
    const ko = B.ko().filter(id => !/^(A3|A4)/.test(id)); if (ko.length) note("invariant: " + ko.join(","), tag);
    /* cutiile 3D ale sertarului în interiorul corpului (între pereți, fără să-i intersecteze) */
    const walls = B.b.boxes.filter(b => b.role === "fianco");
    B.b.boxes.filter(b => b.sub === "dbox").forEach(d => walls.forEach(w => { const ox = Math.min(d.x1, w.x1) - Math.max(d.x0, w.x0), oy = Math.min(d.y1, w.y1) - Math.max(d.y0, w.y0), oz = Math.min(d.z1, w.z1) - Math.max(d.z0, w.z0);
      if (ox > 0.6 && oy > 0.6 && oz > 0.6) note("cutie de sertar în perete (" + d.role + ")", tag); }));
    /* găurire: nicio gaură de glisieră pentru glisierele noi, un avertisment */
    try { const o = B.ops(); const holes = o.pieces.reduce((a, p) => a + (p.operations || []).filter(x => /guida/i.test(x.note || "")).length, 0);
      const isMore = (sys !== "legno") || MO.runner(guida); if (isMore && holes) note("găuri de glisieră generate pentru un sistem fără reper", tag);
      if (isMore && !o.warnings.some(w => w.k === "opsDrawMoreNoHoles")) note("lipsește avertismentul de găurire", tag); } catch (e) { note("găurire: " + String(e.message).slice(0, 80), tag); }
  }
}
const keys = Object.keys(bad);
console.log("configurații:", N, "· planuri ok:", seen.ok, "· blocate cu avertisment:", seen.blocked, "· pe sisteme:", JSON.stringify(seen.bySys));
keys.forEach(k => console.log(String(bad[k].length).padStart(4), k, JSON.stringify(bad[k][0])));
console.log(keys.length ? "PROBLEME: " + keys.length + " feluri" : "ok: nicio problemă");
process.exit(keys.length ? 1 : 0);
