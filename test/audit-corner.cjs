/* Ebanist — audit 3D pentru unitățile de colț / scoase / mecanisme de mișcare (U.17), în stilul audit3d.cjs (D-136): pentru fiecare unitate și mărime, stările
 * deschis / explodat / deschis + explodat față de starea închisă; orice suprapunere NOUĂ între piese, de peste PRAG mm, e eroare (cod de ieșire 1).
 *
 *   node audit-corner.cjs [chei de unități separate prin virgulă]
 *
 * Cere un browser (Playwright). Nu intră în `test:full`. Corpul de probă e ales din datele unității (lățimea nominală, înălțimea din interval, adâncimea minimă),
 * ca unitatea să fie în limitele ei; un corp de colț (angolare) se încearcă pentru unitățile de colț.
 */
const PRAG = 1.0;
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); } const e = path.extname(f);
  r.setHeader("content-type", { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" }[e] || "application/octet-stream"); fs.createReadStream(f).pipe(r); });
(async () => {
  const exe = process.env.CHROME_PATH || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(p => fs.existsSync(p));
  const b = await chromium.launch({ executablePath: exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const pg = await (await b.newContext({ viewport: { width: 540, height: 700 } })).newPage(); pg.on("pageerror", e => console.log("ERR", String(e).slice(0, 160))); pg.setDefaultTimeout(240000);
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); await pg.goto(`http://127.0.0.1:${srv.address().port}/app/index.html?lang=ro`); await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(2500);
  await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => {});
  const only = process.argv[2] || "";
  const res = await pg.evaluate(async ([only, PRAG]) => {
    closeSheets();
    const poly = (c) => { const pts = c.map(p => [p[0], p[2]]); pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); } const up = []; for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); } up.pop(); lo.pop(); return lo.concat(up); };
    const sat = (A, B) => { let best = 1e9; for (const P of [A, B]) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of A) { const d = p[0] * nx + p[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const p of B) { const d = p[0] * nx + p[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const o = Math.min(a1, b1) - Math.max(a0, b0); if (o <= 0) return 0; best = Math.min(best, o); } return best; };
    const prep = (L) => L.map(P => P.boxes.map(c => ({ P, poly: poly(c), y0: Math.min(...c.map(p => p[1])), y1: Math.max(...c.map(p => p[1])), xmin: Math.min(...c.map(p => p[0])), xmax: Math.max(...c.map(p => p[0])), zmin: Math.min(...c.map(p => p[2])), zmax: Math.max(...c.map(p => p[2])) }))).flat();
    const pairs = (Bx) => { const m = new Map(); for (let i = 0; i < Bx.length; i++) for (let j = i + 1; j < Bx.length; j++) { const a = Bx[i], b = Bx[j]; if (a.P.pk === b.P.pk) continue;
      if (a.xmax < b.xmin - 1 || b.xmax < a.xmin - 1 || a.zmax < b.zmin - 1 || b.zmax < a.zmin - 1) continue; const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (oy <= 0.5) continue;
      const d = sat(a.poly, b.poly); const pen = Math.min(d, oy); if (pen > 0.5) { const k = a.P.pk < b.P.pk ? a.P.pk + "|" + b.P.pk : b.P.pk + "|" + a.P.pk; m.set(k, Math.max(m.get(k) || 0, pen)); } } return m; };
    const F = EBCornerFit, out = [], keys = only ? only.split(",") : F.list().map(u => u.key);
    for (const key of keys) {
      const u = F.get(key); if (!u) continue;
      const variants = [];
      (u.sizes.length ? u.sizes.slice(0, 3) : [null]).forEach(s => {
        const cab = s && typeof s.cab === "number" ? s.cab : (s && Array.isArray(s.cab) && s.cab[0] ? s.cab[0] : null);
        const wiMin = s && s.wi && s.wi[0] ? s.wi[0] : null, hiR = (s && s.hi) || (u.limits && u.limits.hi) || (u.bands[0] && u.bands[0].hi);
        let H = u.body === "tall" ? 1900 : 720; if (hiR && hiR[0]) H = Math.max(H, hiR[0] + 38 + 100 + 20);
        const L = cab || (wiMin ? wiMin + 38 : 900), Pd = Math.max(560, ((s && s.depth) || (u.limits && u.limits.depth) || 0) + 40 + 19);
        const base = { name: "T", type: "standard", L, H, P: Pd, plinth: 100, support: u.body === "wall" ? "sospeso" : "zoccolo", shelves: 1, drawers: 0, doors: 1, hang: 0, back: 1, cu: key, cuSize: s ? String(s.id) : null };
        if (u.body === "wall") { base.plinth = 0; base.H = 720; }
        variants.push({ ...base }, { ...base, cuHand: "dx" });
        if (u.kind === "blind" || u.kind === "cdrawer") variants.push({ ...base, type: "angolare", L2: 900, corner: "dx", P: 600 });
      });
      for (const [vi, cfg] of variants.entries()) {
        const q = proj(); q.pieces = []; q.configs = {}; q.layout = {};
        try { generateInto(q, cfg); GL3D.render(cfg, { explode: 0 }); } catch (e) { out.push({ k: key, vi, err: String(e).slice(0, 100) }); continue; }
        const base = prep(GL3D.worldBoxes({ open: 0, explode: 0 })); if (!base.length) { out.push({ k: key, vi, err: "fără piese" }); continue; }
        const Bp = pairs(base), info = {}; const ro = {}; GL3D.worldBoxes({ open: 0, explode: 0 }).forEach(P => ro[P.pk] = P.role + (P.sub ? "/" + P.sub : ""));
        for (const [sn, st] of Object.entries({ open: { open: 1, explode: 0 }, ex5: { open: 0, explode: .5 }, ex10: { open: 0, explode: 1 }, openex: { open: 1, explode: .6 } })) {
          const L = GL3D.worldBoxes(st), roleOf = {}; L.forEach(P => roleOf[P.pk] = P.role + (P.sub ? "/" + P.sub : ""));
          const M = pairs(prep(L)), bad = [];
          for (const [pk, pen] of M) { if ((Bp.get(pk) || 0) > 0.5) continue; const [a, b] = pk.split("|"); bad.push({ a: roleOf[a] || a, b: roleOf[b] || b, pen: Math.round(pen * 10) / 10 }); }
          info[sn] = bad;
        }
        out.push({ k: key, vi, size: cfg.cuSize, type: cfg.type, hand: cfg.cuHand || "", info });
      }
    }
    return out;
  }, [only, PRAG]);
  const agg = {};
  for (const r of res) { if (r.err) { console.log(r.k, r.vi, "EROARE", r.err); continue; } for (const [sn, bad] of Object.entries(r.info)) for (const x of bad) { const key = `${r.k} · ${sn} · ${[x.a, x.b].sort().join(" × ")}`; (agg[key] = agg[key] || { n: 0, max: 0 }); agg[key].n++; agg[key].max = Math.max(agg[key].max, x.pen); } }
  Object.entries(agg).sort((a, b) => b[1].n - a[1].n).slice(0, 80).forEach(([k, v]) => console.log(String(v.n).padStart(3), "max", v.max, k));
  const bad = res.filter(r => r.err || (r.info && ["open", "ex5", "ex10", "openex"].some(k => (r.info[k] || []).some(x => x.pen > PRAG))));
  console.log("cfg:", res.length, "cu probleme (peste", PRAG, "mm):", bad.length); bad.slice(0, 30).forEach(r => console.log("  ↳", r.k, r.type, r.size || "", r.hand, r.err || JSON.stringify(["open", "ex5", "ex10", "openex"].map(k => (r.info[k] || []).filter(x => x.pen > PRAG)).flat())));
  await b.close(); srv.close(); process.exit(bad.length ? 1 : 0);
})();
