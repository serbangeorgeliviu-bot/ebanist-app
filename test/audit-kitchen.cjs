/* Ebanist — audit de browser al bucătăriei (D-143): fiecare tip de modul, la lățimea minimă / implicită / maximă, trece prin tot ce face aplicația cu un corp:
 * 3D (închis / deschis / explodat / feronerie / găuri / cote / selectare+izolare pe fiecare piesă), foile piesei, foaia de montaj, etichete, distinctă, deviz, găurire;
 * apoi bucătăria demo întreagă (camera 3D, plan, blat). Orice excepție, NaN/undefined în texte sau suprapunere nouă între piese e abatere (cod de ieșire 1).
 *   node audit-kitchen.cjs        (cere Chromium; nu intră în test:full)
 */
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); } const e = path.extname(f);
  r.setHeader("content-type", { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" }[e] || "application/octet-stream"); fs.createReadStream(f).pipe(r); });
(async () => {
  const exe = process.env.CHROME_PATH || ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(p => fs.existsSync(p));
  const b = await chromium.launch({ executablePath: exe, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const pg = await (await b.newContext({ viewport: { width: 540, height: 700 } })).newPage(); pg.setDefaultTimeout(240000);
  const errs = []; pg.on("pageerror", e => errs.push("PAGEERR " + String(e).slice(0, 160))); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text().slice(0, 160)); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); await pg.goto(`http://127.0.0.1:${srv.address().port}/app/index.html?lang=ro`);
  await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(2500); await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => {});
  const demo = fs.readFileSync(path.join(__dirname, "golden", "bucatarie-U-demo.json"), "utf8");
  const res = await pg.evaluate(async (demoTxt) => {
    closeSheets();
    const bad = []; const B = (who, what) => bad.push(who + ": " + what);
    const clean = (who, txt) => { txt = String(txt).replace(/data:[a-z\/+-]+;base64,[A-Za-z0-9+\/=]+/g, "").replace(/[A-Za-z0-9+\/=]{60,}/g, ""); if (/undefined|NaN|\[object|Infinity/.test(txt)) B(who, "text prost «" + (txt.match(/.{0,25}(undefined|NaN|\[object|Infinity).{0,25}/) || [""])[0] + "»"); };
    const poly = c => { const pts = c.map(p => [p[0], p[2]]); pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); } const up = []; for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); } lo.pop(); up.pop(); return lo.concat(up); };
    const sat = (A, Bq) => { let best = 1e9; for (const P of [A, Bq]) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; let nx = -(b[1] - a[1]), nz = b[0] - a[0]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of A) { const d = p[0] * nx + p[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const p of Bq) { const d = p[0] * nx + p[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } const o = Math.min(a1, b1) - Math.max(a0, b0); if (o <= 0) return 0; best = Math.min(best, o); } return best; };
    const prep = L => L.map(P => P.boxes.map(c => ({ P, poly: poly(c), y0: Math.min(...c.map(p => p[1])), y1: Math.max(...c.map(p => p[1])), xmin: Math.min(...c.map(p => p[0])), xmax: Math.max(...c.map(p => p[0])), zmin: Math.min(...c.map(p => p[2])), zmax: Math.max(...c.map(p => p[2])) }))).flat();
    const pairs = Bx => { const m = new Map(); for (let i = 0; i < Bx.length; i++) for (let j = i + 1; j < Bx.length; j++) { const a = Bx[i], b = Bx[j]; if (a.P.pk === b.P.pk) continue; if (a.xmax < b.xmin - 1 || b.xmax < a.xmin - 1 || a.zmax < b.zmin - 1 || b.zmax < a.zmin - 1) continue; const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (oy <= .5) continue; const d = sat(a.poly, b.poly); const pen = Math.min(d, oy); if (pen > .5) { const k = a.P.pk < b.P.pk ? a.P.pk + "|" + b.P.pk : b.P.pk + "|" + a.P.pk; m.set(k, Math.max(m.get(k) || 0, pen)); } } return m; };
    const f1 = v => String(Math.round(v * 10) / 10).replace(/\.0$/, "");
    const stat = { modules: 0, cfgs: 0, sheets: 0, picks: 0 };
    const K = { t: 19 };
    const test3d = (who, q, name) => {
      const cfg = q.configs[name];
      try { GL3D.render(cfg, { explode: 0 }); } catch (e) { B(who, "render: " + String(e).slice(0, 80)); return; }
      const base = prep(GL3D.worldBoxes({ open: 0, explode: 0 })); if (!base.length) { B(who, "fără piese 3D"); return; }
      const Bp = pairs(base);
      /* starea închisă e baza de comparație (sertarele au suprapuneri mici și la corpurile din Generator); contează doar ce apare NOU la deschis / explodat */
      for (const [sn, st] of Object.entries({ open: { open: 1, explode: 0 }, ex: { open: 0, explode: 1 }, openex: { open: 1, explode: .6 } })) {
        const L = GL3D.worldBoxes(st), roleOf = {}; L.forEach(P => roleOf[P.pk] = P.role + (P.sub ? "/" + P.sub : ""));
        for (const [pk, pen] of pairs(prep(L))) { if ((Bp.get(pk) || 0) > .5 || pen <= 1) continue; const [a, c] = pk.split("|"); B(who, sn + ": " + (roleOf[a] || a) + " × " + (roleOf[c] || c) + " " + f1(pen) + " mm"); }
      }
      try {
        for (const s of [{ mode: "hw" }, { mode: "real", holes: true }, { dims: true }, { holes: false, dims: false, mode: "real", open: true }, { open: false }]) { GL3D.set(s); }
        const mdl = GL3D.model(); const pks = mdl && mdl.pieces ? [...mdl.pieces.keys()] : [];
        const kinds = GL3D.meshKinds(); stat.picks += kinds.length;
        for (const m of kinds.slice(0, 40)) { GL3D.select(m.pk, true); GL3D.select(m.pk, false); }
        GL3D.select(null, false); GL3D.flag(["x"]); GL3D.flag(null);
      } catch (e) { B(who, "stări 3D: " + String(e).slice(0, 100)); }
    };
    const testDocs = (who, q) => {
      try {
        for (const [name, M] of asmModules(q)) for (const pc of M.ops.pieces) {
          const row = (M.meta[String(pc.pk)] || {}).row || {}; const wk = who + "/" + name + "/" + pc.role + "#" + pc.n;
          const has6 = pc.operations.some(o => o.face === 6);
          for (const face of (has6 ? [5, 6] : [5])) { stat.sheets++; let svg; try { svg = partSheetSvg(M, pc, face, 1, 1); } catch (e) { B(wk, "fișă: " + String(e).slice(0, 80)); continue; }
            const doc = new DOMParser().parseFromString(svg, "image/svg+xml"); if (doc.querySelector("parsererror")) { B(wk, "fișă SVG prost"); continue; }
            const texts = [...doc.querySelectorAll("text")].map(t => t.textContent); clean(wk, texts.join("|"));
            if (!texts.includes(f1(pc.length)) || !texts.includes(f1(pc.width))) B(wk, "cotele " + f1(pc.length) + "×" + f1(pc.width) + " nu apar pe foaie"); }
          for (const o of pc.operations) { if (o.type === "drill" && !(o.dia > 0)) B(wk, "gaură Ø " + o.dia); if (o.face >= 5 && o.x != null && (o.x < -.05 || o.x > pc.length + .05 || o.y < -.05 || o.y > pc.width + .05) && !/maniglia|cerniera/.test(o.note || "")) B(wk, "operație în afara piesei «" + o.note + "»"); }
        }
      } catch (e) { B(who, "foi fișă: " + String(e).slice(0, 100)); }
      try { const rows = cutRows(q); clean(who + " distinctă", JSON.stringify(rows)); const csv = buildCsv(q); clean(who + " CSV", csv); } catch (e) { B(who, "distinctă/CSV: " + String(e).slice(0, 100)); }
      try { const hw = computeHardware(q); clean(who + " feronerie", JSON.stringify(hw.map(h => [h.k, h.qty, h.tot]))); const pc = projectCosts(q); if (!isFinite(pc.netto)) B(who, "deviz nu e număr"); } catch (e) { B(who, "feronerie/deviz: " + String(e).slice(0, 100)); }
      try { const au = [...(q.pieces.length ? Object.keys(q.configs) : [])].flatMap(n => auditModule(q.configs[n], q.pieces.filter(x => x.gen === n || x.modulo === n)).filter(a => a.blocking || a.level === "error")); if (au.length) B(who, "audit blocant: " + au.map(a => a.k || a.id || a.msg).join(",")); } catch (e) { B(who, "auditModule: " + String(e).slice(0, 100)); }
      try { const m = montDoc(q); clean(who + " montaj", String(m).slice(0, 200000)); } catch (e) { B(who, "foaia de montaj: " + String(e).slice(0, 100)); }
    };
    /* 1) fiecare tip de modul, 3 lățimi */
    for (const id of Object.keys(KITCHEN_UNITS)) {
      const u = KITCHEN_UNITS[id]; if (u.gap) continue;
      const ws = [...new Set((u.ws && u.ws.length ? [u.ws[0], u.w0, u.ws[u.ws.length - 1]] : [u.w0]))];
      for (const w of ws) {
        stat.cfgs++; const who = id + " " + w;
        const r = buildUnit(K, id, { w }); if (r.errors.length) { if (id === "t_fridgefz") continue; B(who, "build: " + JSON.stringify(r.errors)); continue; }
        const q = proj(); q.pieces = []; q.configs = {}; q.layout = {};
        try { generateInto(q, Object.assign({ name: "T", matBody: state.settings.matBody, matFront: state.settings.matFront || state.settings.matBody, matBack: state.settings.matBack || state.settings.matBody }, JSON.parse(JSON.stringify(r.cfg)))); } catch (e) { B(who, "generateInto: " + String(e).slice(0, 100)); continue; }
        test3d(who, q, "T"); testDocs(who, q);
      }
    }
    /* 2) bucătăria demo întreagă, importată ca proiect */
    importJson(demoTxt); await new Promise(r => setTimeout(r, 300));
    const p = proj(); stat.demoPieces = p.pieces.length;
    for (const name of Object.keys(p.configs)) { if (p.configs[name].type === "blat" || p.configs[name].kitchen) { stat.modules++; test3d("demo/" + name, p, name); } }
    testDocs("demo", p);
    try { setView("survey"); await new Promise(r => setTimeout(r, 600)); const RL = roomLayout(); if (RL.issues.length) B("demo", "ciocniri în cameră: " + JSON.stringify(RL.issues)); const bx = roomBoxes(); if (!bx || !bx.length) B("demo", "camera 3D goală"); if (typeof drawRoom3D === "function") drawRoom3D(); GL3D.set({ open: true }); GL3D.set({ open: false }); stat.roomBoxes = bx && bx.length; } catch (e) { B("demo", "camera: " + String(e).slice(0, 100)); }
    try { setView("kitchen"); await new Promise(r => setTimeout(r, 500)); if (/undefined|NaN|\[object/.test(document.querySelector("#kBody").innerText)) B("demo", "ecranul Bucătărie conține text prost"); } catch (e) { B("demo", "ecran: " + String(e).slice(0, 100)); }
    return { bad, stat };
  }, demo);
  console.log(JSON.stringify(res.stat)); res.bad.slice(0, 80).forEach(x => console.log(" ✗", x)); errs.slice(0, 20).forEach(x => console.log(" !", x));
  console.log("abateri:", res.bad.length, "· erori JS:", errs.length);
  process.exitCode = (res.bad.length || errs.length) ? 1 : 0; await b.close(); srv.close();
})();
