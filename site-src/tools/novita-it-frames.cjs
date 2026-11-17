/* Clip „Novità" (it), partea 1: cadrele. Scene reale din aplicație (GL3D offline, ceas virtual, determinist) + capturi de interfață.
   Ieșire în OUT (implicit vid-novita/): seg-<nume>/f_00001.jpg … și timeline.json.
   node site-src/tools/novita-it-frames.cjs [probe]   (RESUME=1 sare peste cadrele deja scrise; ONLY=a,b limitează segmentele)
   Durata fiecărui segment vine din narațiunea vidIQ (liniile 0–7, vezi VO mai jos). */
const PW = process.env.PLAYWRIGHT_PATH || "/opt/node-tools/node_modules/playwright";
const { chromium } = require(PW);
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "../.."), OUT = process.env.OUT || path.join(root, "vid-novita");
const PROBE = process.argv[2] === "probe", FPS = 24, W = 1080, H = 1920;
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

/* secunde de început ale liniilor de voce (vidIQ, vocea italiană «Marco»): 0, 5.49, 9.27, 15.80, 23.69, 27.56, 30.41, 38.03; total 40.80 */
const VO = [5.486, 3.788, 6.531, 7.889, 3.866, 2.847, 7.628, 2.769];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); r.end(fs.readFileSync(f));
}).listen(8798, async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) { } });
  const pg = await ctx.newPage(); pg.on("pageerror", e => console.log("ERR", String(e).slice(0, 200))); pg.setDefaultTimeout(90000);
  await pg.goto("http://localhost:8798/app/index.html?lang=it"); await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(3000);
  await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => { });

  const sm = k => k * k * (3 - 2 * k), lerp = (a, c, k) => a + (c - a) * k;
  const save = (dir, i, dataUrl) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "f_" + String(i).padStart(5, "0") + ".jpg"), Buffer.from(dataUrl.split(",")[1], "base64")); };
  const tl = [];
  const want = n => !ONLY.length || ONLY.includes(n);

  /* pregătește un corp în GL3D (proiect gol + generateInto) */
  const setup = cfg => pg.evaluate(async cfg => {
    closeSheets(); const q = proj(); q.pieces = []; q.configs = {}; q.layout = {};
    window.__cfg = cfg; generateInto(q, cfg); persist(); setView("build"); buildCfg = { ...cfg }; syncBuildForm(); draw3D(); GL3D.focusOn(null);
    GL3D.set({ hw: false, holes: false, open: false, explode: 0, ledOn: true });
    await new Promise(r => setTimeout(r, 900));
  }, cfg);

  /* un segment offline: cam(k) → {yaw,pitch,zoom,focus?,open?,hw?,explode?,ledOn?}; asm = true: montajul pornește (ms) */
  const segment = async (name, sec, o) => {
    if (!want(name)) return;
    const n = Math.round(sec * FPS), dir = path.join(OUT, "seg-" + name); let wrote = 0;
    await pg.evaluate(([o, W, H]) => {
      GL3D.offlineBegin({ w: W, h: H, fps: 24, ms: o.asmMs || 1200, bg: o.bg || "dark", yaw: o.yaw0 != null ? o.yaw0 : -0.3 });
      if (!o.asmMs) GL3D.stopAssemble();
    }, [{ asmMs: o.asmMs || 0, bg: o.bg, yaw0: o.yaw0 }, W, H]);
    for (let i = 0; i < n; i++) {
      const fn = path.join(dir, "f_" + String(i + 1).padStart(5, "0") + ".jpg");
      if (process.env.RESUME && fs.existsSync(fn)) continue;
      const k = n > 1 ? i / (n - 1) : 0, c = o.cam ? o.cam(k, i / FPS) : {};
      const r = await pg.evaluate(([c, auto]) => {
        if (c.focus !== undefined) { if (c.focus) GL3D.focusOn(c.focus.pk, c.focus.rad, c.focus.off); else GL3D.focusOn(null); }
        const st = {}; for (const key of ["hw", "explode", "ledOn", "holes"]) if (c[key] !== undefined) st[key] = c[key];
        if (Object.keys(st).length) GL3D.set(st);
        if (!auto && typeof VIEW === "object") { if (c.yaw !== undefined) VIEW.yaw = c.yaw; if (c.pitch !== undefined) VIEW.pitch = c.pitch; if (c.zoom !== undefined) VIEW.zoom = c.zoom; }
        return GL3D.offlineFrame(!!c.open).data;
      }, [c, !!o.asmMs && (c.auto !== false)]);
      save(dir, i + 1, r); wrote++;
      if (PROBE && i >= 1) break;
    }
    await pg.evaluate(() => GL3D.offlineEnd());
    tl.push({ name, n, sec });
    console.log("seg", name, n, "cadre");
  };
  const spot = (type, pick, dz) => pg.evaluate(([type, pick, dz]) => { const M = GL3D.model(); const hs = M.ops.hw.filter(h => h.type === type); const h = hs[Math.min(hs.length - 1, Math.floor(hs.length * pick))]; const pc = M.ops.pieces.find(q => String(q.pk) === String(h.piece)); const c = [0, 1, 2].map(i => (pc.min[i] + pc.max[i]) / 2); return { pk: pc.pk, off: [0, 1, 2].map(i => h.w[i] - c[i] + (i === 2 ? dz : 0)) }; }, [type, pick, dz || 0]);

  const BASE = { ...(await pg.evaluate(() => PRESETS.armadio)), name: "Dulap", L: 1400, H: 2300, P: 620, drawers: 3, doors: 2, shelves: 3, hang: 1, matBody: "antracite_storm_grey_19", matFront: "nogal_victoria_19", matBack: "antracite_storm_grey_19", hwSel: { man: "haf_bar128" } };

  /* A. montaj (hook + «ogni pezzo nell'ordine giusto»): 9.27 s */
  await setup(BASE);
  await segment("a-montaj", VO[0] + VO[1], { asmMs: 7200, bg: "dark", yaw0: -0.55, cam: (k, t) => ({ open: t > 7.6 }) });

  /* B. feronerie: balama, glisieră, îmbinări explodate (6.53 s) */
  await setup(BASE);
  const hg = await spot("cerniera", .4), sl = await spot("guida", 0, 70);
  const bs = VO[2] / 3;
  await segment("b-balama", bs, { bg: "dark", cam: k => ({ yaw: lerp(1.1, .75, sm(k)), pitch: lerp(.15, .2, sm(k)), zoom: lerp(1.6, 2.3, sm(k)), focus: { pk: hg.pk, rad: 120, off: hg.off }, hw: true, open: true }) });
  await segment("b-glisiera", bs, { bg: "dark", cam: k => ({ yaw: lerp(-.6, -.35, sm(k)), pitch: lerp(.4, .5, sm(k)), zoom: lerp(1.4, 1.9, sm(k)), focus: { pk: sl.pk, rad: 230, off: sl.off }, hw: true, open: true }) });
  await pg.evaluate(async () => { window.__cfg = { ...window.__cfg, hwSel: { man: "haf_bar128", conn: "fes_domino" } }; buildCfg = { ...window.__cfg }; syncBuildForm(); draw3D(); await new Promise(r => setTimeout(r, 700)); });
  await segment("b-imbinari", VO[2] - 2 * bs, { bg: "dark", cam: k => ({ yaw: lerp(.4, .8, sm(k)), pitch: lerp(.3, .28, sm(k)), zoom: lerp(1.45, 1.65, sm(k)), focus: null, hw: true, explode: lerp(.1, .7, sm(k)), open: false }) });

  /* C. LED: nișă suspendată, întunecat, aprinde-te: 7.89 s */
  const LED = { ...BASE, name: "Nisa", L: 1200, H: 700, P: 360, doors: 0, drawers: 0, hang: 0, tram: 0, shelves: 1, support: "sospeso", plinth: 0, secMode: ["shelf"], led: "top", ledSw: "visible", matBody: "nogal_victoria_19", matFront: "nogal_victoria_19", matBack: "nogal_victoria_19" };
  await setup(LED); await pg.evaluate(() => GL3D.set({ ledOn: false }));
  const dim = await pg.evaluate(() => { const M = GL3D.model(), h = M.ops.hw.find(x => x.type === "leddim"); if (!h) return null; const pc = M.ops.pieces.find(p => String(p.pk) === String(h.piece)); const c = [0, 1, 2].map(i => (pc.min[i] + pc.max[i]) / 2); return { pk: pc.pk, off: [0, 1, 2].map(i => h.w[i] - c[i]) }; });
  const c1 = 2.0, c2 = 3.4, c3 = VO[3] - c1 - c2;
  await segment("c-led-stins", c1, { bg: "dark", cam: k => ({ yaw: lerp(.55, .4, sm(k)), pitch: lerp(.18, .14, sm(k)), zoom: lerp(1.5, 1.7, sm(k)), focus: null, ledOn: false }) });
  await segment("c-led-aprins", c2, { bg: "dark", cam: k => ({ yaw: lerp(.4, -.15, sm(k)), pitch: lerp(.14, .1, sm(k)), zoom: lerp(1.7, 2.0, sm(k)), focus: null, ledOn: true }) });
  await segment("c-led-dimmer", c3, { bg: "dark", cam: k => ({ yaw: lerp(-.55, -1.0, sm(k)), pitch: .1, zoom: lerp(1.8, 2.6, sm(k)), focus: dim ? { pk: dim.pk, rad: 160, off: dim.off } : null, ledOn: true }) });

  /* D. lemn din poze: trei decoruri, zoom apropiat pe front (3.87 s) */
  const WOODS = ["rovere_wood_lime_classic_k2414ah_19", "nogal_victoria_19", "avocado_green_22458mn_19"];
  const ws = VO[4] / 3;
  for (let w = 0; w < 3; w++) {
    await setup({ ...BASE, matFront: WOODS[w], matBody: WOODS[w], doors: 2, drawers: 0, shelves: 2, H: 1800 });
    await segment("d-lemn-" + (w + 1), ws, { bg: "dark", cam: k => ({ yaw: lerp(.25, .05, sm(k)), pitch: .12, zoom: lerp(2.4, 2.9, sm(k)), focus: null, open: false }) });
  }
  tl.forEach(s => { }); fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ fps: FPS, w: W, h: H, VO, segs: tl }));
  await b.close(); srv.close();
});
