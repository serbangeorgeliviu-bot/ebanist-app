/* Clip „Da Pinterest a Ebanist" (it), partea 1: cadrele. Dulapul din poză (două coloane + birou + raft cu LED), în „Camera în 3D".
   Scene reale din aplicație (GL3D offline, ceas virtual, determinist). Fără voce.
   node site-src/tools/pinterest-frames.cjs [probe]
   OUT = dosarul de ieșire (implicit vid-pinterest/); ONLY=a,b limitează segmentele; RESUME=1 sare peste cadrele scrise.
   Ieșire: OUT/seg-<nume>/f_00001.jpg … și OUT/timeline.json */
const PW = process.env.PLAYWRIGHT_PATH || "/opt/node-tools/node_modules/playwright";
const { chromium } = require(PW);
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "../.."), OUT = process.env.OUT || path.join(root, "vid-pinterest");
const PROBE = process.argv[2] === "probe", FPS = 24, SCALE = +(process.env.SCALE || 1), W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); r.end(fs.readFileSync(f));
}).listen(8799, async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) { } });
  const pg = await ctx.newPage(); pg.on("pageerror", e => console.log("ERR", String(e).slice(0, 300))); pg.on("console", m => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 200)); }); pg.setDefaultTimeout(120000);
  await pg.goto("http://localhost:8799/app/index.html?lang=it"); await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(3000);
  await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => { });

  const sm = k => k * k * (3 - 2 * k), lerp = (a, c, k) => a + (c - a) * k;
  const save = (dir, i, dataUrl) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "f_" + String(i).padStart(5, "0") + ".jpg"), Buffer.from(dataUrl.split(",")[1], "base64")); };
  const tl = [];
  const want = n => !ONLY.length || ONLY.includes(n);

  /* ---- proiectul: o cameră cu peretele din fund de 3,7 m (scena comună) ---- */
  const SC = require("./pinterest-scene.cjs");
  const info = await pg.evaluate(([bodySrc, args]) => {
    const errs = (new Function("return " + bodySrc))()(args);
    document.body.classList.add("vp-full"); $("bldView").classList.add("full"); GL3D.resize();
    const RL = roomLayout(), p = proj();
    return { errs, mods: RL ? RL.mods.map(m => m.name + "@" + Math.round(m.from) + "w" + Math.round(m.w)) : null, issues: RL ? RL.issues : null, pieces: p.pieces.length };
  }, [SC.buildInPage.toString(), [SC.CFG, SC.WALLS, SC.LAY, SC.OAK, SC.FRONT]]);
  console.log("proiect", JSON.stringify(info));
  if (info.errs.length) throw new Error("cfg: " + info.errs.join(" | "));

  /* scena „room": viewerul primește cutiile camerei + podeaua + benzile LED */
  await pg.evaluate(() => {
    const bx = roomBoxes(), RL = roomLayout(), fr = RL.frames, floor = fr.map(f => { const q = toRoom(f, 0, 0, 0); return [q.x, q.y]; });
    const sv = proj().survey.walls, last = fr[fr.length - 1], lw = +sv[sv.length - 1].len;
    if (fr.length === sv.length && lw > 0) { const e = toRoom(last, lw, 0, 0); floor.push([e.x, e.y]); }
    window.__room = { bx, floor, leds: roomLeds(), tone: proj().floorTone };
    /* cutia mobilei (fără pereți/podea): ancore pentru mișcările de cameră */
    const fb = bx.filter(q => q.kind !== "w" && q.kind !== "g");
    window.__bb = { x0: Math.min(...fb.map(q => q.x0)), x1: Math.max(...fb.map(q => q.x1)), y1: Math.max(...fb.map(q => q.y1)), z0: Math.min(...fb.map(q => q.z0)), z1: Math.max(...fb.map(q => q.z1)) };
    GL3D.set({ mode: "real", hw: false, holes: false, dims: false, edges: false, open: false, explode: 0 });
    window.__cfgRoom = { matBody: state.settings.matBody, matFront: state.settings.matFront };
    window.__dw = 0;
    window.__setDrawers = (on) => { if (!!on === !!window.__dw) return; window.__dw = on ? 1 : 0; roomOpen = window.__dw; window.__room.bx = roomBoxes(); window.__room.leds = roomLeds(); window.__render(false); };
    window.__render = (open) => { GL3D.render(window.__cfgRoom, { boxes: window.__room.bx, room: { floor: window.__room.floor, tone: window.__room.tone }, leds: window.__room.leds }); };
    window.__render(false);
  });
  await pg.waitForTimeout(1500);

  /* un cadru la camera `c` (aceeași cale pentru pre-roll și pentru cadrele salvate) */
  const frameAt = (c) => pg.evaluate(([c]) => {
    if (c.drawers !== undefined) window.__setDrawers(c.drawers);
    if (c.at !== undefined) { const B = window.__bb; if (c.at) GL3D.focusAt(B.x0 + c.at.x, c.at.y, (B.z0 + B.z1) / 2 + (c.at.z || 0), c.at.rad); else GL3D.focusAt(null); }
    if (c.focus !== undefined) { if (c.focus) GL3D.focusOn(c.focus.pk, c.focus.rad, c.focus.off); else GL3D.focusOn(null); }
    const st = {}; for (const key of ["hw", "explode", "ledOn", "holes", "open", "warm", "dim"]) if (c[key] !== undefined) st[key] = c[key];
    if (Object.keys(st).length) GL3D.set(st);
    if (typeof VIEW === "object") { if (c.yaw !== undefined) VIEW.yaw = c.yaw; if (c.pitch !== undefined) VIEW.pitch = c.pitch; if (c.zoom !== undefined) VIEW.zoom = c.zoom; }
    return GL3D.offlineFrame(!!c.open).data;
  }, [c]);

  const segment = async (name, sec, o) => {
    if (!want(name)) return;
    const n = Math.round(sec * FPS), dir = path.join(OUT, "seg-" + name);
    await pg.evaluate(([o, W, H]) => {
      GL3D.offlineBegin({ w: W, h: H, fps: 24, ms: 1000, bg: o.bg || "light", yaw: o.yaw0 != null ? o.yaw0 : 0 });
      GL3D.stopAssemble();
    }, [{ bg: o.bg, yaw0: o.yaw0 }, W, H]);
    /* pre-roll (nesalvat): ușile se resetează pe loc (ease 1), camera ajunge la cadrul de start; apoi mișcarea lentă (ease .07) */
    const c0 = o.cam ? o.cam(0, 0) : {};
    await pg.evaluate(() => GL3D.ease(1));
    for (let i = 0; i < 16; i++) await frameAt({ ...c0, drawers: 0, open: false });
    await pg.evaluate(() => GL3D.ease(.05));   /* cinematic: uși și sertare se mișcă lent */
    for (let i = 0; i < n; i++) {
      const fn = path.join(dir, "f_" + String(i + 1).padStart(5, "0") + ".jpg");
      if (process.env.RESUME && fs.existsSync(fn)) continue;
      const k = n > 1 ? i / (n - 1) : 0, c = o.cam ? o.cam(k, i / FPS) : {};
      save(dir, i + 1, await frameAt(c));
      if (PROBE && i >= 1) break;
    }
    await pg.evaluate(() => GL3D.offlineEnd());
    tl.push({ name, n, sec });
    console.log("seg", name, n, "cadre");
  };

  /* ---- probă: câteva unghiuri, un cadru fiecare ---- */
  if (PROBE) {
    const views = [["a", .25, .1, 1.7, false], ["b", .35, .12, 2.2, true], ["c", -.3, .1, 2.0, false], ["d", .1, .05, 2.6, true]];
    for (const [nm, yaw, pitch, zoom, open] of views) await segment("probe-" + nm, 0.1, { bg: "light", cam: () => ({ yaw, pitch, zoom, focus: null, ledOn: true, hw: true, drawers: open }) });
  }
  if (process.env.STILLS) {
    /* cadre statice pentru reglarea încadrărilor: STILLS='[{"bg":"light","warm":1,"yaw":.5,"pitch":.1,"zoom":2,"at":{"x":500,"y":1200,"rad":1500},"drawers":0}, …]' */
    const L = JSON.parse(process.env.STILLS);
    for (let i = 0; i < L.length; i++) { const c = L[i]; await segment("still-" + i, 1.5, { bg: c.bg || "light", cam: () => ({ ...c, hw: true, open: false }) }); }
  } else if (!PROBE) {
    /* mișcări cinematice: ease-out la sosire, dolly lateral cu paralaxă, tremur de cameră foarte fin.
       Ancorele (mm) sunt față de colțul stâng al mobilei: dulap stâng 0–1000, birou 1000–2300, dulap drept 2300–3300 */
    const eo = k => 1 - Math.pow(1 - k, 3), ei = k => k * k * k, sh = (t, a) => Math.sin(t * 5.3) * a + Math.sin(t * 11.7 + 1.3) * a * .45;
    /* S1: dezvăluire — de la camera întreagă, rapid, cu aterizare lină pe birou */
    await segment("s1-camera", 3.4, { bg: "light", cam: (k, t) => ({ warm: 1, dim: 1, yaw: lerp(.85, .14, eo(k)) + sh(t, .003), pitch: lerp(.26, .07, eo(k)) + sh(t + 3, .002), zoom: lerp(1.15, 1.95, eo(k)),
      at: { x: 1650, y: lerp(900, 1250, eo(k)), rad: lerp(2600, 1900, eo(k)) }, ledOn: false, hw: true, drawers: 0 }) });
    /* S2: dolly lateral peste dulap, ușile și sertarele se deschid în cadru */
    await segment("s2-deschis", 4.2, { bg: "light", cam: (k, t) => ({ warm: 1, dim: 1, yaw: lerp(.55, -.5, sm(k)) + sh(t, .003), pitch: lerp(.1, .16, sm(k)) + sh(t + 2, .002), zoom: lerp(1.7, 2.0, sm(k)),
      at: { x: lerp(500, 2800, sm(k)), y: 1180, rad: 1700 }, ledOn: false, hw: true, drawers: t > .5 ? 1 : 0 }) });
    /* S3: macro pe striații, lumină razantă, alunecare lentă de-a lungul ușii */
    await segment("s3-macro", 2.6, { bg: "light", cam: (k, t) => ({ warm: 1, dim: 1, yaw: lerp(.95, .6, sm(k)) + sh(t, .002), pitch: lerp(.04, .09, sm(k)), zoom: lerp(1.3, 1.5, sm(k)),
      at: { x: lerp(150, 650, sm(k)), y: lerp(1500, 1250, sm(k)), z: 0, rad: 380 }, ledOn: false, hw: true, drawers: 0 }) });
    /* S4: LED-ul de sub raft, aprinde-te, travelling lateral */
    await segment("s4-led", 3.2, { bg: "light", cam: (k, t) => ({ warm: 1, dim: t > .5 ? Math.max(.16, 1 - (t - .5) * .9) : 1, yaw: lerp(.62, -.28, sm(k)) + sh(t, .002), pitch: lerp(.1, .05, sm(k)), zoom: lerp(1.7, 2.1, eo(k)),
      at: { x: lerp(1100, 1900, sm(k)), y: 1480, rad: 900 }, ledOn: t > .5, hw: true, drawers: 0 }) });
  }
  fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ fps: FPS, w: W, h: H, segs: tl }));
  await b.close(); srv.close();
});
