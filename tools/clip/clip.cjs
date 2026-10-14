#!/usr/bin/env node
/* Clip de marketing din Ebanist, fara AI si fara abonament.
   Deschide aplicatia in Chromium headless, incarca un corp si il randeaza cadru cu cadru
   prin GL3D.capture() (aceleasi cote, aceleasi gauri ca in aplicatie), apoi ffmpeg pune
   textul si leaga cadrele intr-un MP4 vertical 9:16.

   node clip.js --in ../../test/golden/01-armadio/input.json --hook "Textul de pe primele secunde" --out clip.mp4

   Intrarea: fie {cfg, settings} (ca in test/golden/<nume>/input.json),
             fie un proiect exportat (.ebanist.json) sau un backup, cu --project <nume> --module <nume corp>.
   Nu scrie nimic in app/. Nu atinge motorul. */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(path.resolve(__dirname, "../../test/node_modules/playwright"))); }

const ROOT = path.resolve(__dirname, "../..");
const TXT = {
  ro: { a: "Din același desen", b: "Piesele, cu cotele lor", c: "Găurile, unde trebuie", d: "Clientul îl vede în 3D", cta: "Ebanist · link în bio", hook: "Clientul vede dulapul în 3D. Mașina primește găurile." },
  fr: { a: "Depuis le même dessin", b: "Chaque pièce, avec ses cotes", c: "Les perçages, au bon endroit", d: "Le client le voit en 3D", cta: "Ebanist · lien en bio", hook: "Le client voit le meuble en 3D. La machine reçoit les perçages." },
  it: { a: "Dallo stesso disegno", b: "Ogni pezzo, con le sue quote", c: "I fori, dove servono", d: "Il cliente lo vede in 3D", cta: "Ebanist · link in bio", hook: "Il cliente vede il mobile in 3D. La macchina riceve i fori." },
  en: { a: "From the same drawing", b: "Every part, with its dimensions", c: "Holes exactly where they go", d: "The client sees it in 3D", cta: "Ebanist · link in bio", hook: "The client sees the cabinet in 3D. The machine gets the holes." }
};

function args(argv) {
  const o = { secs: 20, fps: 24, size: "1080x1920", lang: "ro", out: "clip.mp4" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith("--")) continue;
    const k = a.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    o[k] = v;
  }
  o.secs = +o.secs; o.fps = +o.fps; return o;
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Cronologia: t in [0,1] -> starea camerei si a corpului. Totul e o functie pura de t,
   deci acelasi input da aceleasi cadre. */
function scene(t) {
  const yaw = 0.35 + 1.0 * t;                      // balans de ~57 de grade in jurul corpului, nu pe spate
  const pitch = 0.30 - 0.06 * Math.sin(t * Math.PI * 2);
  const explode = ss(.32, .50, t) - ss(.62, .80, t);
  const holes = t > .40 && t < .84;
  const open = t > .84;
  const phase = t < .32 ? "a" : t < .62 ? "b" : t < .84 ? "c" : "d";
  const close = ss(.58, .66, t) - ss(.78, .84, t);   // apropiere cand se vad gaurile
  return { yaw, pitch, explode, holes, open, zoom: (1.5 - 0.5 * explode) * (1 + 0.45 * close), phase };
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
    if (!j.configs[m]) throw new Error("corpul '" + m + "' nu exista; corpuri: " + Object.keys(j.configs).join(", "));
    return { cfg: { ...j.configs[m], name: m }, settings: j.settings || {}, name: j.name || m }; }
  const projs = j.projects || []; const p = projs.find(x => !o.project || x.name === o.project) || projs[0];
  if (!p) throw new Error("backup fara proiecte");
  const mods = Object.keys(p.configs || {}); const m = o.module || mods[0];
  if (!p.configs || !p.configs[m]) throw new Error("corpul '" + m + "' nu exista; corpuri: " + mods.join(", "));
  return { cfg: { ...p.configs[m], name: m }, settings: j.settings || {}, name: p.name + " / " + m };
}

(async () => {
  const o = args(process.argv);
  if (!o.in) { console.error("lipseste --in <fisier.json>. Vezi antetul din clip.js."); process.exit(2); }
  const T = TXT[o.lang]; if (!T) { console.error("limba: " + Object.keys(TXT).join(", ")); process.exit(2); }
  const [W, H] = o.size.split("x").map(Number);
  const inp = loadInput(o);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ebclip-"));
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const URL = `http://127.0.0.1:${srv.address().port}/app/index.html`;

  const cp = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const br = await chromium.launch({ executablePath: fs.existsSync(cp) ? cp : undefined, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const state = { lang: o.lang, activeId: "p1", projects: [{ id: "p1", name: inp.name, pieces: [], configs: {}, geomVersion: 2 }], settings: inp.settings, stock: [] };
  await ctx.addInitScript(s => { localStorage.clear(); localStorage.setItem("tagliapro", JSON.stringify(s)); }, state);
  const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", e => errs.push(String(e)));
  await pg.goto(URL); await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 20000 });
  await pg.waitForTimeout(3300); await pg.evaluate(() => closeSheets());
  await pg.evaluate(() => setView("build")); await pg.waitForTimeout(1500);
  const ok = await pg.waitForFunction(() => window.GL3D && window.GL3D.ok, null, { timeout: 15000 }).then(() => true, () => false);
  if (!ok) { console.error("WebGL indisponibil in Chromium headless: " + (await pg.evaluate(() => window.GL3D && window.GL3D.err))); process.exit(3); }
  await pg.evaluate(cfg => { buildCfg = cfg; if (typeof buildFormReady !== "undefined" && buildFormReady) syncBuildForm(); }, inp.cfg);

  const N = Math.round(o.secs * o.fps), fdir = path.join(tmp, "f"); fs.mkdirSync(fdir);
  console.log(`${inp.name}: ${N} cadre ${W}x${H} -> ${o.out}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const s = scene(N === 1 ? 0 : i / (N - 1));
    const x = await pg.evaluate(([cfg, p, w, h]) => {
      const r = window.GL3D.capture(cfg, { w, h, yaw: p.yaw, pitch: p.pitch, explode: p.explode, holes: p.holes, open: p.open, zoom: p.zoom, edges: true });
      return r && r.img;
    }, [inp.cfg, s, W, H]);
    if (!x) { console.error("capture() n-a returnat imagine la cadrul " + i); process.exit(4); }
    fs.writeFileSync(path.join(fdir, String(i).padStart(5, "0") + ".jpg"), Buffer.from(x.split(",")[1], "base64"));
    if (i % 24 === 0) console.log(`  ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await br.close(); srv.close();
  if (errs.length) console.log("erori pagina:", errs.slice(0, 3));

  /* text: fiecare bloc intr-un fisier, ca sa nu avem de scapat ghilimele in drawtext */
  const font = findFont(), put = (n, s) => { const f = path.join(tmp, n + ".txt"); fs.writeFileSync(f, s); return f; };
  const hookTxt = typeof o.hook === "string" ? o.hook : T.hook;
  const wrap = (s, n) => s.split(" ").reduce((L, w) => { const c = L[L.length - 1]; (c && (c + " " + w).length <= n) ? L[L.length - 1] = c + " " + w : L.push(w); return L; }, []).join("\n");
  const dt = (file, y, size, from, to, box) =>
    `drawtext=fontfile='${font}':textfile='${file}':fontcolor=white:fontsize=${size}:line_spacing=14:x=(w-text_w)/2:y=${y}:` +
    `box=1:boxcolor=black@0.55:boxborderw=26:enable='between(t,${from},${to})':alpha='if(lt(t,${from}+0.3),(t-${from})/0.3,if(gt(t,${to}-0.3),(${to}-t)/0.3,1))'`;
  const D = o.secs, cap = (k, a, b) => dt(put("c" + k, "h-360", 54, a, b), "h-360", 54, a, b);
  const vf = [
    dt(put("hook", wrap(hookTxt, 22)), "h*0.12", 72, 0.2, Math.min(3.2, D * .2)),
    cap("a", D * .17, D * .32), cap("b", D * .34, D * .60), cap("c", D * .62, D * .83), cap("d", D * .86, D - 2.4),
    dt(put("cta", T.cta), "h-360", 60, D - 2.3, D)
  ];
  // textele pe faze: a,b,c,d (fisierele c*.txt se rescriu cu continutul real)
  ["a", "b", "c", "d"].forEach(k => fs.writeFileSync(path.join(tmp, "c" + k + ".txt"), T[k]));
  const out = path.resolve(o.out);
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(o.fps), "-i", path.join(fdir, "%05d.jpg"),
    "-vf", vf.join(","), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", out], { stdio: "inherit" });
  if (r.status !== 0) { console.error("ffmpeg a esuat; cadrele sunt in " + fdir); process.exit(5); }
  if (!o["keep-frames"]) fs.rmSync(tmp, { recursive: true, force: true }); else console.log("cadre: " + fdir);
  console.log("gata: " + out);
})().catch(e => { console.error(e); process.exit(1); });
