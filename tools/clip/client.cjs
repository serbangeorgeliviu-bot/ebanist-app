#!/usr/bin/env node
/* Clip «Modul Client» (D-50): ecranul real al aplicatiei, pe telefon. Clientul atinge o finisare,
   3D-ul se schimba si pretul se actualizeaza, tot prin codul aplicatiei (clientOpen, cmPriceOf).
   Cadrele sunt capturi de ecran la momente fixe, deci acelasi input da acelasi clip.

   node tools/clip/client.cjs --in <proiect.ebanist.json> --lang it --out out/client.mp4

   PRETURILE DIN CLIP SUNT DE EXEMPLU: materialele din catalog n-au pret (prezzo_mq null), deci
   scriptul pune preturi demonstrative (--prices id=eur,id=eur) si clipul spune asta pe ecran.
   Nu atinge app/ si nu scrie nimic acolo. */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(path.resolve(__dirname, "../../test/node_modules/playwright"))); }

const ROOT = path.resolve(__dirname, "../..");
const TXT = {
  it: { hook: "Il cliente sceglie il colore. Il prezzo si aggiorna da solo.", a: "Il cliente tocca una finitura", b: "Il 3D e il totale cambiano subito", cta: "Ebanist · link in bio", demo: "Prezzi di esempio" },
  ro: { hook: "Clientul alege culoarea. Prețul se actualizează singur.", a: "Clientul atinge o finisare", b: "3D-ul și totalul se schimbă pe loc", cta: "Ebanist · link în bio", demo: "Prețuri de exemplu" },
  fr: { hook: "Le client choisit la couleur. Le prix se met à jour tout seul.", a: "Le client touche une finition", b: "Le 3D et le total changent aussitôt", cta: "Ebanist · lien en bio", demo: "Prix d'exemple" },
  en: { hook: "The client picks the color. The price updates itself.", a: "The client taps a finish", b: "The 3D and the total change instantly", cta: "Ebanist · link in bio", demo: "Example prices" }
};
/* preturi demonstrative (EUR/m2): melaminat uni, lemn, lucios */
const DEMO_PRICES = { avocado_green_22458mn_19: 41, antracite_storm_grey_19: 44, rovere_chiaro_19: 52, nogal_victoria_19: 61, nero_19: 47, bianco_lucido_19: 79, grigio_medio_19: 40 };

function args(argv) {
  const o = { secs: 20, fps: 24, lang: "it", out: "client.mp4", front: "avocado_green_22458mn_19", body: "rovere_chiaro_19",
    steps: "antracite_storm_grey_19,bianco_lucido_19,nogal_victoria_19" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith("--")) continue;
    const k = a.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    o[k] = v;
  }
  o.secs = +o.secs; o.fps = +o.fps; return o;
}
function findFont() {
  for (const f of ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"])
    if (fs.existsSync(f)) return f;
  const r = spawnSync("fc-match", ["-f", "%{file}", "sans:bold"]); return String(r.stdout || "").trim();
}
function loadInput(o) {
  const j = JSON.parse(fs.readFileSync(o.in, "utf8"));
  if (j.cfg) return { cfg: j.cfg, settings: j.settings || {}, name: j.nume || "corp" };
  if (j.configs && !j.projects) { const m = o.module || Object.keys(j.configs)[0];
    return { cfg: { ...j.configs[m], name: m }, settings: j.settings || {}, name: j.name || m }; }
  const p = (j.projects || [])[0]; const m = o.module || Object.keys(p.configs)[0];
  return { cfg: { ...p.configs[m], name: m }, settings: j.settings || {}, name: p.name };
}

(async () => {
  const o = args(process.argv);
  if (!o.in) { console.error("lipseste --in <fisier.json>"); process.exit(2); }
  const T = TXT[o.lang]; if (!T) { console.error("limba: " + Object.keys(TXT).join(", ")); process.exit(2); }
  const prices = Object.assign({}, DEMO_PRICES);
  if (typeof o.prices === "string") o.prices.split(",").forEach(kv => { const [k, v] = kv.split("="); prices[k] = +v; });
  const steps = String(o.steps).split(",").filter(Boolean);
  const inp = loadInput(o);
  Object.assign(inp.cfg, { matFront: o.front, matBody: o.body, matBack: o.body });
  const matOvr = {}; Object.keys(prices).forEach(k => { matOvr[k] = { price: prices[k] }; });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ebcli-"));
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const URL = `http://127.0.0.1:${srv.address().port}/app/index.html`;
  const cp = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const br = await chromium.launch({ executablePath: fs.existsSync(cp) ? cp : undefined, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  /* 412 x 732 la dpr 2,62 = 1080 x 1919: telefon 9:16 */
  const ctx = await br.newContext({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 1080 / 412, isMobile: true, hasTouch: true });
  const settings = Object.assign({}, inp.settings, { matOvr: Object.assign({}, inp.settings.matOvr || {}, matOvr) });
  const state = { lang: o.lang, activeId: "p1", projects: [{ id: "p1", name: "Proposta", client: "", pieces: [], configs: {}, geomVersion: 2 }], settings, stock: [] };
  await ctx.addInitScript(s => { localStorage.clear(); localStorage.setItem("tagliapro", JSON.stringify(s)); }, state);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(URL); await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 20000 });
  await pg.waitForTimeout(3300); await pg.evaluate(() => closeSheets());
  await pg.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}" });
  /* Pro nu se verifica in clip: rulam ecranul real, local */
  await pg.evaluate(cfg => { window.proGate = () => true; generateInto(proj(), cfg); setView("projects"); }, inp.cfg);
  await pg.evaluate(() => { clientOpen(); });
  await pg.waitForFunction(() => window.GL3D && window.GL3D.ok, null, { timeout: 15000 });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { window.GL3D.spin(false); });

  const N = Math.round(o.secs * o.fps), fdir = path.join(tmp, "f"); fs.mkdirSync(fdir);
  const tapAt = steps.map((s, i) => 0.2 + (i * 0.6) / Math.max(1, steps.length));   // momentul fiecarei atingeri
  const openAt = 0.86;
  let tapIdx = 0, markerLeft = 0, opened = false;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    /* atingere: un cerc scurt peste mostra, apoi click real pe ea */
    if (tapIdx < steps.length && t >= tapAt[tapIdx]) {
      const id = steps[tapIdx++];
      await pg.evaluate(id => { const b = document.querySelector(`.cm-sws[data-key="matFront"] [data-id="${id}"]`); if (!b) { window.__tapMiss = id; return; }
        let sc = b.parentElement; while (sc && sc.scrollHeight <= sc.clientHeight + 2) sc = sc.parentElement;   // containerul derulabil
        if (sc) { const cr = sc.getBoundingClientRect(), br0 = b.getBoundingClientRect(); sc.scrollTop += (br0.top - cr.top) - 110; }
        const r = b.getBoundingClientRect();
        let m = document.getElementById("tapMark"); if (!m) { m = document.createElement("div"); m.id = "tapMark";
          m.style.cssText = "position:fixed;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.25);z-index:99999;pointer-events:none;transform:translate(-50%,-50%)"; document.body.appendChild(m); }
        m.style.left = (r.left + r.width / 2) + "px"; m.style.top = (r.top + r.height / 2) + "px"; m.style.display = "block"; b.click(); }, id);
      markerLeft = Math.round(o.fps * 0.35);
    } else if (markerLeft > 0 && --markerLeft === 0) {
      await pg.evaluate(() => { const m = document.getElementById("tapMark"); if (m) m.style.display = "none"; });
    }
    if (!opened && t >= openAt) { opened = true; await pg.evaluate(() => { const b = document.getElementById("cmOpen"); if (b) b.click(); }); }
    await pg.evaluate(yaw => { VIEW.yaw = yaw; VIEW.pitch = 0.2; window.GL3D.touch(); }, 0.45 + 0.9 * t);
    await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await pg.waitForTimeout(40);
    await pg.screenshot({ path: path.join(fdir, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92 });
    if (i % 24 === 0) console.log(`  ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  const miss = await pg.evaluate(() => window.__tapMiss || null);
  if (miss) console.log("ATENTIE: mostra '" + miss + "' nu exista in lista");
  await br.close(); srv.close();
  if (errs.length) console.log("erori pagina:", errs.slice(0, 3));

  const font = findFont(), put = (n, s) => { const f = path.join(tmp, n + ".txt"); fs.writeFileSync(f, s); return f; };
  const wrap = (s, n) => s.split(" ").reduce((L, w) => { const c = L[L.length - 1]; (c && (c + " " + w).length <= n) ? L[L.length - 1] = c + " " + w : L.push(w); return L; }, []).join("\n");
  const fade = (a, b) => `alpha='if(lt(t,${a}+0.3),(t-${a})/0.3,if(gt(t,${b}-0.3),(${b}-t)/0.3,1))'`;
  const dt = (f, y, size, a, b, extra) => `drawtext=fontfile='${font}':textfile='${f}':fontcolor=white:fontsize=${size}:line_spacing=14:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.6:boxborderw=22:enable='between(t,${a},${b})':${fade(a, b)}`;
  const D = o.secs;
  const vf = [
    dt(put("hook", wrap(T.hook, 22)), "h*0.06", 66, 0.2, 3.4),
    dt(put("a", T.a), "h*0.06", 54, D * 0.2, D * 0.42),
    dt(put("b", T.b), "h*0.06", 54, D * 0.44, D * 0.84),
    `drawtext=fontfile='${font}':textfile='${put("demo", T.demo)}':fontcolor=white:fontsize=34:x=24:y=h-60:box=1:boxcolor=black@0.55:boxborderw=12`,
    dt(put("cta", T.cta), "h*0.06", 60, D - 2.4, D)
  ];
  const out = path.resolve(o.out);
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(o.fps), "-i", path.join(fdir, "%05d.jpg"),
    "-vf", "scale=1080:1920," + vf.join(","), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", out], { stdio: "inherit" });
  if (r.status !== 0) { console.error("ffmpeg a esuat; cadrele sunt in " + fdir); process.exit(5); }
  if (!o["keep-frames"]) fs.rmSync(tmp, { recursive: true, force: true }); else console.log("cadre: " + fdir);
  console.log("gata: " + out);
})().catch(e => { console.error(e); process.exit(1); });
