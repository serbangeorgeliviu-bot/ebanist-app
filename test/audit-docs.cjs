/* Ebanist — audit al documentelor dosarului (copertă, prezentare client, raport tehnic, elevații, montaj A3) și al fișei de montaj (montDoc),
 * pe fiecare tipologie și variantă.   node audit-docs.cjs [tipologii] [nr. variante aleatoare] [seed]
 *   X SVG/HTML bine format;  T fără „undefined/NaN/null/Infinity/[object" și fără chei de traducere brute;
 *   B tot ce se desenează e în foaia de 420 × 297 mm;  D foaia montajului: nr. piese și cotele corpului = modelul;  M fișa de montaj: titlul corpului cu cotele din model.
 * Cere un browser; nu intră în `test:full`. Cod de ieșire 1 la orice abatere.
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
  const pg = await (await b.newContext({ viewport: { width: 540, height: 700 } })).newPage(); pg.on("pageerror", e => console.log("ERR", String(e).slice(0, 160))); pg.setDefaultTimeout(240000);
  await new Promise(r => srv.listen(0, "127.0.0.1", r)); await pg.goto(`http://127.0.0.1:${srv.address().port}/app/index.html?lang=ro`);
  await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(2500); await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => {});
  const only = process.argv[2] || "", RAND = +(process.argv[3] || 0), SEED = +(process.argv[4] || 1);
  const res = await pg.evaluate(async ([only, RAND, SEED]) => {
    closeSheets();
    const f1 = v => String(Math.round(v * 10) / 10).replace(/\.0$/, "");
    let variants = [{}, { doors: 2, drawers: 3 }, { L: 600, H: 1000, P: 450, doors: 1 }, { L: 1400, doors: 4, drawers: 2 }, { L: 900, H: 2200, doors: 2, drawers: 0, hang: 0 }];
    if (RAND) { let sd = SEED * 2654435761 % 4294967296; const rnd = () => { sd = (sd * 1664525 + 1013904223) % 4294967296; return sd / 4294967296; }; const ri = (a, c) => a + Math.floor(rnd() * (c - a + 1));
      variants = []; for (let i = 0; i < RAND; i++) variants.push({ L: ri(450, 1900), H: ri(550, 2400), P: ri(300, 700), doors: ri(0, 6), drawers: ri(0, 5), shelves: ri(0, 5) }); }
    const out = [], keys = Object.keys(PRESETS).filter(k => !only || only.split(",").includes(k));
    let curVr = null; const bad = (acc, k, m) => { (acc[k] = acc[k] || []).push(m + " ⟨" + JSON.stringify(curVr) + "⟩"); };
    const clean = (acc, who, texts) => { const all = texts.join("|");
      if (/undefined|NaN|\bnull\b|Infinity|\[object/.test(all)) bad(acc, "T", `${who}: ${(all.match(/.{0,20}(undefined|NaN|\bnull\b|Infinity|\[object).{0,20}/) || [""])[0]}`);
      texts.filter(t => /^(sh|op|hw|ops|dc|rp|ea|as|cl|m)[A-Z][A-Za-z0-9_]{3,}$/.test(t.trim())).forEach(t => bad(acc, "T", `${who}: cheie brută «${t}»`)); };
    for (const k of keys) for (const [vi, vr] of variants.entries()) {
      const acc = {}, info = { k, vi, vr, sheets: 0, mods: 0 }; curVr = vr;
      try {
        const q = proj(); q.pieces = []; q.configs = {}; q.layout = {}; q.name = "Test"; q.client = "Client";
        generateInto(q, { ...PRESETS[k], name: "T", ...vr });
        const mods = asmModules(q); info.mods = mods.length;
        if (mods.length) {
          let svgs; try { svgs = packBuild(q, { cover: true, client: true, report: true, elev: true, asm: true, parts: false }); } catch (e) { bad(acc, "X", "packBuild: " + String(e).slice(0, 100)); svgs = []; }
          const per = 4;
          svgs.forEach((svg, i) => { info.sheets++;
            const kind = i === 0 ? "copertă" : ["client", "raport", "elevații", "montaj"][(i - 1) % per], who = `${kind}#${i + 1}`;
            const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
            if (doc.querySelector("parsererror")) { bad(acc, "X", who + ": SVG prost format"); return; }
            clean(acc, who, [...doc.querySelectorAll("text")].map(t => t.textContent));
            const host = document.createElement("div"); host.style.cssText = "position:fixed;left:0;top:0;width:420px;height:297px;opacity:0;pointer-events:none"; host.innerHTML = svg.replace(/width="[^"]*"/, 'width="420"').replace(/height="[^"]*"/, 'height="297"');
            const sv = host.querySelector("svg"); document.body.appendChild(host); const R0 = sv.getBoundingClientRect(); let o1 = null;
            for (const el of sv.querySelectorAll("text,path,circle,rect,line,polyline,polygon")) { const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
              const x0 = r.left - R0.left, y0 = r.top - R0.top, x1 = r.right - R0.left, y1 = r.bottom - R0.top;
              if (x0 < -0.6 || y0 < -0.6 || x1 > 420.6 || y1 > 297.6) { o1 = `${el.tagName}${el.tagName === "text" ? " «" + el.textContent.slice(0, 24) + "»" : ""} la (${f1(x0)}, ${f1(y0)})–(${f1(x1)}, ${f1(y1)})`; break; } }
            host.remove(); if (o1) bad(acc, "B", `${who}: ${o1} în afara foii`); });
          /* D: foaia de montaj a fiecărui corp poartă cotele și piesele din model */
          const {mods: hwm} = computeHardware(q, state.settings, true);
          for (const [name, M] of mods) { const svg = asmSvgFor(q, name, M, hwm, 1, 1), doc = new DOMParser().parseFromString(svg, "image/svg+xml"), tx = [...doc.querySelectorAll("text")].map(t => t.textContent).join("|");
            const cfg = M.cfg, dims = `${cfg.type === "angolare" ? cfg.L + "+" + cfg.L2 : cfg.L} × ${cfg.H} × ${cfg.P}`;
            if (!tx.includes(dims)) bad(acc, "D", `${name}: cotele ${dims} nu apar pe foaia de montaj`);
            const nums = M.ops.pieces.map(p => String(p.n)); const miss = nums.filter(n => !tx.split("|").some(s => s.trim() === n));
            const mm = tx.match(/… \+(\d+) \(/); if (miss.length && !(mm && miss.length <= +mm[1])) bad(acc, "D", `${name}: piesele ${miss.slice(0, 5).join(",")} lipsesc din tabelul foii de montaj`); }
        }
        /* M: fișa de montaj (HTML) */
        let html = ""; try { html = montDoc(q); } catch (e) { bad(acc, "X", "montDoc: " + String(e).slice(0, 100)); }
        if (html) { const d = document.createElement("div"); d.innerHTML = html; info.sheets++;
          clean(acc, "montaj-fișă", [d.textContent]);
          d.querySelectorAll("img").forEach(im => { if (!im.getAttribute("src")) bad(acc, "X", "fișă: <img> fără src"); });
          d.querySelectorAll("svg").forEach((sv, i) => { const vb = (sv.getAttribute("viewBox") || "").split(/\s+/).map(Number); if (vb.length === 4 && !(vb[2] > 0 && vb[3] > 0)) bad(acc, "X", `fișă: svg#${i} viewBox ${vb}`); });
          const h2 = [...d.querySelectorAll("h2")].map(h => h.textContent);
          for (const n of Object.keys(q.configs || {})) { const M = mModel(q, n); if (!M) continue; const cfg = M.cfg, dims = `${cfg.type === "angolare" ? cfg.L + "+" + cfg.L2 : cfg.L}×${cfg.H}×${cfg.P}`;
            if (!h2.some(h => h.includes(n) && h.includes(dims))) bad(acc, "M", `${n}: titlul fișei nu are cotele ${dims}`); } }
      } catch (e) { bad(acc, "X", "generare: " + String(e).slice(0, 100)); }
      info.acc = acc; out.push(info);
    }
    return out;
  }, [only, RAND, SEED]);
  const agg = {}; let nBad = 0;
  for (const r of res) for (const [k, arr] of Object.entries(r.acc || {})) { nBad += arr.length; const key = `${r.k} · ${k}`; (agg[key] = agg[key] || { n: 0, ex: new Set() }).n += arr.length; arr.slice(0, 3).forEach(m => agg[key].ex.add(m)); }
  Object.entries(agg).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(String(v.n).padStart(4), k, "·", [...v.ex].slice(0, 2).join("  ||  ")));
  console.log("configurații:", res.length, "· foi:", res.reduce((s, r) => s + (r.sheets || 0), 0), "· abateri:", nBad);
  process.exitCode = nBad ? 1 : 0; await b.close(); srv.close();
})();
