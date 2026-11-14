/* Ebanist — audit al foilor A3 ale pieselor (partA3Svg), pentru fiecare tipologie și variantă.
 *
 *   node audit-a3.cjs [tipologii separate prin virgulă] [nr. variante aleatoare] [seed]
 *
 * Pentru fiecare piesă a fiecărui corp generat se desenează foaia A3 (fața 5, fața 6 când există) și se verifică:
 *   X  SVG bine format (DOMParser);   T  niciun „undefined/NaN/null/Infinity/[object”, nicio cheie de traducere rămasă brută;
 *   D  cotele piesei (lungime, lățime) apar pe foaie, iar piesa e aceeași cu rândul din distinta (lung × larg);
 *   O  operațiile: în piesă (x în [0, L], y în [0, W]), adâncimea sub grosime, Ø pozitiv, fără duplicate, găuri care nu se taie între ele pe aceeași față;
 *   C  pe foaie se desenează cel puțin atâtea cercuri câte găuri are fața (cele trecute pe ambele fețe);
 *   B  tot ce se desenează (text, trasee, cercuri, după transformări) e în interiorul foii de 420 × 297 mm.
 * Cere un browser (Playwright); nu intră în `test:full`. Cod de ieșire 1 la orice abatere.
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
    const t0 = k => t(k);
    const f1 = v => String(Math.round(v * 10) / 10).replace(/\.0$/, "");
    let variants = [{}, { doors: 2, drawers: 3 }, { L: 600, H: 1000, P: 450, doors: 1 }, { L: 1400, doors: 4, drawers: 2 }, { L: 900, H: 2200, doors: 2, drawers: 0, hang: 0 }];
    if (RAND) { let sd = SEED * 2654435761 % 4294967296; const rnd = () => { sd = (sd * 1664525 + 1013904223) % 4294967296; return sd / 4294967296; }; const pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => Math.round(a + rnd() * (b - a));
      variants = []; for (let i = 0; i < RAND; i++) variants.push({ L: ri(450, 1900), H: ri(550, 2400), P: ri(300, 700), doors: ri(0, 6), drawers: ri(0, 5), shelves: ri(0, 5), hang: pick([0, 1]), tram: pick([0, 1]), drawerSys: pick(["legno", "tandem", "legrabox", "metabox"]), handles: pick(["maniglie", "push", "gola"]) }); }
    const out = [], keys = Object.keys(PRESETS).filter(k => !only || only.split(",").includes(k));
    let curVr = null; const bad = (acc, k, m) => { (acc[k] = acc[k] || []).push(m + " ⟨" + JSON.stringify(curVr) + "⟩"); };
    for (const k of keys) for (const [vi, vr] of variants.entries()) {
      const acc = {}, info = { k, vi, vr, pieces: 0, sheets: 0 }; curVr = vr;
      try {
        const q = proj(); q.pieces = []; q.configs = {}; q.layout = {};
        generateInto(q, { ...PRESETS[k], name: "T", ...vr });
        for (const [name, M] of asmModules(q)) for (const pc of M.ops.pieces) {
          info.pieces++;
          const m = M.meta[String(pc.pk)] || {}, row = m.row || {}, who = `${name}/${pc.role}#${pc.n}`;
          const has6 = pc.operations.some(o => o.face === 6);
          for (const face of (has6 ? [5, 6] : [5])) {
            info.sheets++;
            let svg; try { svg = partA3Svg(M, pc, face, 1, 1); } catch (e) { bad(acc, "X", who + ": " + String(e).slice(0, 80)); continue; }
            const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
            if (doc.querySelector("parsererror")) { bad(acc, "X", who + ": SVG prost format"); continue; }
            const texts = [...doc.querySelectorAll("text")].map(t => t.textContent);
            const all = texts.join("|");
            if (/undefined|NaN|\bnull\b|Infinity|\[object/.test(all)) bad(acc, "T", `${who}: ${(all.match(/.{0,20}(undefined|NaN|\bnull\b|Infinity|\[object).{0,20}/) || [""])[0]}`);
            texts.filter(t => /^(sh|op|hw|ops|dc|part)[A-Za-z_]{3,}$/.test(t)).forEach(t => bad(acc, "T", `${who}: cheie brută «${t}»`));
            const isGlass = pc.sub === "door" && /^Montante anta vetro/.test(String(row.elemento || ""));
            if (!texts.includes(f1(pc.length)) || !texts.includes(f1(pc.width))) bad(acc, "D", `${who}: cotele ${f1(pc.length)} × ${f1(pc.width)} nu apar pe foaie`);
            if (isGlass) { if (!texts.some(t => t.includes(t0("doorGlassAsm")))) bad(acc, "D", `${who}: ușa cu sticlă nu e numită «${t0("doorGlassAsm")}»`); }
            else if (row.seg && row.seg.n > 1) { if (!texts.some(t => / \+ /.test(t) && t.includes(f1(row.lung)))) bad(acc, "D", `${who}: piesa tăiată în ${row.seg.n} bucăți nu are nota cu tăieturile`); }
            else if (row.lung != null && face === 5 && !((Math.abs(row.lung - pc.length) < .51 && Math.abs(row.larg - pc.width) < .51) || (Math.abs(row.lung - pc.width) < .51 && Math.abs(row.larg - pc.length) < .51)))
              bad(acc, "D", `${who}: distinta ${row.lung}×${row.larg} ≠ piesa ${pc.length}×${pc.width}`);
            { /* C: câte găuri se desenează = câte găuri sunt pe fața foii (cele trecute apar pe ambele fețe) */
              const want = pc.operations.filter(o => o.type === "drill" && (o.face === face || (o.through && o.face >= 5))).length;
              const got = doc.querySelectorAll("circle").length;
              if (got < want) bad(acc, "C", `${who} fața ${face}: ${got} cercuri desenate, ${want} găuri pe față`);
            }
            if (face === 5) {
              const L = pc.length, W = pc.width, T = pc.thickness, seen = new Set(), on = pc.operations.filter(o => o.face >= 5), wk = new Set((M.ops.warnings || []).filter(w => w.piece === pc.pk).map(w => w.k));
              for (const o of pc.operations) {
                if (!(o.dia > 0) && o.type === "drill") bad(acc, "O", `${who}: Ø ${o.dia} la ${o.note}`);
                if (o.type === "drill" && o.face >= 5 && !o.through && o.depth > T + .01) bad(acc, "O", `${who}: adâncime ${o.depth} > grosime ${T} (${o.note})`);
                if (o.face >= 5 && o.x != null && o.y != null && !((o.note === "maniglia" && wk.has("opsHandleFit")) || (/cerniera/.test(o.note || "") && wk.has("opsHingeShort"))) && (o.x < -.05 || o.x > L + .05 || o.y < -.05 || o.y > W + .05)) bad(acc, "O", `${who}: ${o.note} la (${o.x}, ${o.y}) în afara piesei ${L}×${W}`);
                const key = [o.type, o.face, o.x, o.y, o.dia, o.len].join("/"); if (seen.has(key)) bad(acc, "O", `${who}: duplicat ${o.note} la (${o.x}, ${o.y})`); seen.add(key);
              }
              for (const fc of [5, 6]) { const dr = on.filter(o => o.face === fc && o.type === "drill");
                for (let i = 0; i < dr.length; i++) for (let j = i + 1; j < dr.length; j++) { const a = dr[i], c = dr[j], d = Math.hypot(a.x - c.x, a.y - c.y);
                  if (d < (a.dia + c.dia) / 2 - 0.3 && d > 0.01 && !(wk.has("opsHingeShort") && /cerniera/.test((a.note || "") + (c.note || "")))) bad(acc, "O", `${who}: găurile «${a.note}» Ø${a.dia} și «${c.note}» Ø${c.dia} se taie (${f1(d)} mm între centre) pe fața ${fc}`); } }
            }
            { const host = document.createElement("div"); host.style.cssText = "position:fixed;left:0;top:0;width:420px;height:297px;opacity:0;pointer-events:none"; host.innerHTML = svg.replace(/width="420mm" height="297mm"/, 'width="420" height="297"'); document.body.appendChild(host);
              const sv = host.querySelector("svg"), R0 = sv.getBoundingClientRect(); let out1 = null;
              for (const el of sv.querySelectorAll("text,path,circle,rect,line,polyline,polygon")) { const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
                const x0 = r.left - R0.left, y0 = r.top - R0.top, x1 = r.right - R0.left, y1 = r.bottom - R0.top;
                if (x0 < -0.6 || y0 < -0.6 || x1 > 420.6 || y1 > 297.6) { out1 = `${el.tagName}${el.tagName === "text" ? " «" + el.textContent.slice(0, 24) + "»" : ""} la (${f1(x0)}, ${f1(y0)})–(${f1(x1)}, ${f1(y1)})`; break; } }
              host.remove(); if (out1) bad(acc, "B", `${who} fața ${face}: ${out1} în afara foii`); }
          }
        }
      } catch (e) { bad(acc, "X", "generare: " + String(e).slice(0, 100)); }
      info.acc = acc; out.push(info);
    }
    return out;
  }, [only, RAND, SEED]);
  const agg = {}; let nBad = 0;
  for (const r of res) for (const [k, arr] of Object.entries(r.acc || {})) { nBad += arr.length; const key = `${r.k} · ${k}`; (agg[key] = agg[key] || { n: 0, ex: new Set() }).n += arr.length; arr.slice(0, 3).forEach(m => agg[key].ex.add(m)); }
  Object.entries(agg).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(String(v.n).padStart(4), k, "·", [...v.ex].slice(0, 2).join("  ||  ")));
  console.log("configurații:", res.length, "· piese:", res.reduce((s, r) => s + (r.pieces || 0), 0), "· foi A3:", res.reduce((s, r) => s + (r.sheets || 0), 0), "· abateri:", nBad);
  process.exitCode = nBad ? 1 : 0; await b.close(); srv.close();
})();
