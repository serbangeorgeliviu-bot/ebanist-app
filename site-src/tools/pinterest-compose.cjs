/* Clip „Da Pinterest a Ebanist" (it), partea 2: montajul. Fără voce, doar muzică + textele pe ecran.
   Cere: IN = dosarul cu seg-s1-camera, seg-s2-deschis, seg-s3-led (din pinterest-frames.cjs)
         HOOK = hook-ul Gemini (mp4), PHOTO = poza de referință (jpg), MUSIC = piesa (mp3), OUT = dosarul de ieșire
   node site-src/tools/pinterest-compose.cjs   (STILLS=1: numai foile A3 ca imagini, pentru alegere) */
const PW = process.env.PLAYWRIGHT_PATH || "/opt/node-tools/node_modules/playwright";
const { chromium } = require(PW);
const http = require("http"), fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.resolve(__dirname, "../.."), IN = process.env.IN, OUT = process.env.OUT || IN;
const HOOK = process.env.HOOK, PHOTO = process.env.PHOTO, MUSIC = process.env.MUSIC, STILLS = !!process.env.STILLS;
const FPS = 24, W = 1080, H = 1920;
const SC = require("./pinterest-scene.cjs");
const D = path.join(OUT, "compose"); fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(path.join(D, "ov"), { recursive: true });

/* durate (s) */
const T = { hook: 5.5, s1: 3.6, s2: 4.2, s3: 3.2, sh1: 2.6, sh2: 2.6, end: 3.4 };
const START = {}; { let t = 0; for (const k of ["hook", "s1", "s2", "s3", "sh1", "sh2", "end"]) { START[k] = t; t += T[k]; } START.total = t; }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  let f = u === "/__photo.jpg" ? PHOTO : u === "/__s1.jpg" ? path.join(D, "s1.jpg") : path.join(root, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); r.end(fs.readFileSync(f));
}).listen(8803, async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic", JSON.stringify({ kind: "stripe", key: "comp_TESTTESTTESTTESTTESTTEST", status: "active", activated: true, checkedAt: Date.now() })); } catch (e) { } });
  const pg = await ctx.newPage(); pg.on("pageerror", e => console.log("ERR", String(e).slice(0, 200))); pg.setDefaultTimeout(120000);

  /* 1. foile A3 din proiect (în italiană) */
  await pg.goto("http://localhost:8803/app/index.html?lang=it"); await pg.waitForFunction(() => window.MAT_LOADED === true); await pg.waitForTimeout(3000);
  await pg.locator("#btnIntroGo").click({ timeout: 1500 }).catch(() => { });
  const sheets = await pg.evaluate(async ([bodySrc, args]) => {
    const errs = (new Function("return " + bodySrc))()(args); if (errs.length) throw new Error(errs.join("|"));
    closeSheets();
    return packBuild(proj(), { cover: true, client: false, report: false, elev: true, asm: true, parts: true });
  }, [SC.buildInPage.toString(), [SC.CFG, SC.WALLS, SC.LAY, SC.OAK, SC.FRONT]]);
  console.log("foi A3:", sheets.length);

  const FONT = `@font-face{font-family:BC;font-weight:700;src:url(http://localhost:8803/fonts/barlow-condensed-latin-700-normal.woff2)}@font-face{font-family:BC;font-weight:600;src:url(http://localhost:8803/fonts/barlow-condensed-latin-600-normal.woff2)}`;
  const page = async (body, opaque) => { await pg.setContent(`<html><head><style>${FONT}html,body{margin:0;width:${W}px;height:${H}px;background:${opaque ? "#0e3b2a" : "transparent"};overflow:hidden;font-family:BC,sans-serif}</style></head><body>${body}</body></html>`); await pg.evaluate(async () => { await document.fonts.ready; for (const i of document.images) if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); }); };
  const shot = async (file, body, opaque) => { await page(body, opaque); await pg.screenshot({ path: file, omitBackground: !opaque }); return file; };

  const sheetHtml = (svg, ox, oy, s) => `<div style="position:absolute;inset:0;background:#2f3430;overflow:hidden"><div style="position:absolute;left:40px;top:50%;width:1000px;margin-top:-353px;background:#fff;box-shadow:0 20px 80px rgba(0,0,0,.55);transform-origin:${ox}% ${oy}%;transform:scale(${s})">${svg.replace(/width="420mm" height="297mm"/, 'style="width:100%;height:auto;display:block"')}</div></div>`;

  if (STILLS) {
    for (let i = 0; i < sheets.length; i++) await shot(path.join(D, "sheet-" + i + ".png"), sheetHtml(sheets[i], 50, 50, 1), true);
    console.log("foi salvate"); await b.close(); srv.close(); return;
  }

  const SH1 = +(process.env.SHEET1 ?? 2), SH2 = +(process.env.SHEET2 ?? 3);
  const sheetSeg = async (name, svg, sec, o0, s0, s1) => {
    const n = Math.round(sec * FPS), dir = path.join(D, "seg-" + name); fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0, e = k * k * (3 - 2 * k), s = s0 + (s1 - s0) * e;
      await page(sheetHtml(svg, o0[0], o0[1], s), true);
      await pg.screenshot({ path: path.join(dir, "f_" + String(i + 1).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92 });
    }
    return dir;
  };
  await sheetSeg("sh1", sheets[SH1], T.sh1, [88, 40], 1, 2.3);
  await sheetSeg("sh2", sheets[SH2], T.sh2, [22, 55], 1, 2.4);

  /* 2. cardul final: poza lângă 3D-ul din Ebanist */
  const last3d = path.join(IN, "seg-s1-camera", "f_00086.jpg");
  const endBody = (s) => `<div style="position:absolute;inset:0;background:#0e3b2a;overflow:hidden">
    <div style="position:absolute;left:0;right:0;top:0;height:690px;overflow:hidden"><img src="http://localhost:8803/__photo.jpg" style="width:100%;height:100%;object-fit:cover;object-position:50% 40%;transform:scale(${s});transform-origin:50% 50%"></div>
    <div style="position:absolute;left:0;right:0;top:690px;height:690px;overflow:hidden"><img src="http://localhost:8803/__s1.jpg" style="width:100%;height:100%;object-fit:cover;object-position:50% 55%;transform:scale(${s});transform-origin:50% 50%"></div>
    <div style="position:absolute;left:40px;top:40px;padding:12px 30px;border-radius:50px;background:rgba(255,255,255,.93);color:#0e3b2a;font-weight:700;font-size:46px">Foto</div>
    <div style="position:absolute;left:40px;top:730px;padding:12px 30px;border-radius:50px;background:rgba(255,255,255,.93);color:#0e3b2a;font-weight:700;font-size:46px">Ebanist</div>
    <div style="position:absolute;left:0;right:0;top:1400px;text-align:center;color:#fff"><div style="font-weight:700;font-size:92px;line-height:1.05;margin-top:46px">Dalla foto<br>al laboratorio</div><div style="font-weight:600;font-size:56px;margin-top:34px;color:#E6C46A">Provalo gratis su ebanist.com</div></div></div>`;
  fs.copyFileSync(last3d, path.join(D, "s1.jpg"));
  /* poza și un cadru 3D le servește același server prin căi fixe */
  const endDir = path.join(D, "seg-end"); fs.mkdirSync(endDir, { recursive: true });
  const nEnd = Math.round(T.end * FPS);
  for (let i = 0; i < nEnd; i++) {
    const s = 1 + 0.06 * (i / (nEnd - 1));
    await page(endBody(s), true);
    await pg.screenshot({ path: path.join(endDir, "f_" + String(i + 1).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92 });
  }

  /* 3. texte suprapuse (PNG transparent) */
  const cap = (txt, sub, top) => `<div style="position:absolute;left:54px;right:54px;top:${top || 1330}px;padding:30px 40px;border-radius:38px;background:rgba(14,59,42,.94);color:#fff;text-align:center;box-shadow:0 16px 50px rgba(0,0,0,.45);border:2px solid rgba(217,201,163,.35)"><div style="font-weight:700;font-size:70px;line-height:1.08">${txt}</div>${sub ? `<div style="font-weight:600;font-size:44px;margin-top:10px;opacity:.88">${sub}</div>` : ""}</div>`;
  const OV = {
    hook: await shot(path.join(D, "ov", "hook.png"), cap("Lo voglio.", "Ma quanto costa e come si fa?", 1330)),
    s1: await shot(path.join(D, "ov", "s1.png"), cap("Parto dalla foto…", "e la disegno in Ebanist")),
    s2: await shot(path.join(D, "ov", "s2.png"), cap("Ante, cassetti, misure reali")),
    s3: await shot(path.join(D, "ov", "s3.png"), cap("Striscia LED già nel preventivo")),
    sh: await shot(path.join(D, "ov", "sh.png"), cap("Distinta e schede di foratura", "con QR su ogni pezzo", 1450)),
  };

  await b.close(); srv.close();

  /* 4. ffmpeg: segmente → concat → overlay → audio */
  const run = (args) => { const r = cp.spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" }); if (r.status) throw new Error("ffmpeg " + args.join(" ").slice(0, 120)); };
  const segs = [];
  /* hook: Gemini 720×1280 → 1080×1920, 24 fps, primele T.hook secunde */
  const vHook = path.join(D, "v-hook.mp4");
  run(["-i", HOOK, "-t", String(T.hook), "-vf", `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`, "-an", "-c:v", "libx264", "-crf", "17", vHook]); segs.push(vHook);
  const fromFrames = (dir, name) => { const o = path.join(D, "v-" + name + ".mp4"); run(["-framerate", String(FPS), "-i", path.join(dir, "f_%05d.jpg"), "-vf", `scale=${W}:${H},format=yuv420p`, "-c:v", "libx264", "-crf", "17", o]); segs.push(o); };
  fromFrames(path.join(IN, "seg-s1-camera"), "s1"); fromFrames(path.join(IN, "seg-s2-deschis"), "s2"); fromFrames(path.join(IN, "seg-s3-led"), "s3");
  fromFrames(path.join(D, "seg-sh1"), "sh1"); fromFrames(path.join(D, "seg-sh2"), "sh2"); fromFrames(endDir, "end");
  const list = path.join(D, "list.txt"); fs.writeFileSync(list, segs.map(f => "file '" + f + "'").join("\n"));
  const vAll = path.join(D, "v-all.mp4"); run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", vAll]);

  const wins = [["hook", START.hook + 2.6, START.hook + T.hook], ["s1", START.s1 + .2, START.s1 + T.s1 - .1], ["s2", START.s2 + .2, START.s2 + T.s2 - .1], ["s3", START.s3 + .3, START.s3 + T.s3 - .1], ["sh", START.sh1 + .2, START.sh2 + T.sh2 - .1]];
  const ins = ["-i", vAll]; wins.forEach(w => ins.push("-loop", "1", "-t", String(START.total), "-i", OV[w[0]]));
  let fc = "", prev = "[0:v]";
  wins.forEach((w, i) => { const [, a, z] = w; fc += `[${i + 1}:v]format=rgba,fade=t=in:st=${a}:d=.25:alpha=1,fade=t=out:st=${z - .25}:d=.25:alpha=1[o${i}];${prev}[o${i}]overlay=enable='between(t,${a},${z})':format=auto[v${i}];`; prev = `[v${i}]`; });
  fc = fc.replace(/;$/, "");
  const vOv = path.join(D, "v-ov.mp4"); run([...ins, "-filter_complex", fc, "-map", prev, "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-t", String(START.total), vOv]);

  const fin = path.join(OUT, "ebanist-pinterest-it.mp4");
  run(["-i", vOv, "-i", MUSIC, "-i", HOOK, "-filter_complex",
    `[1:a]atrim=0:${START.total},afade=t=in:st=0:d=.4,afade=t=out:st=${START.total - 1.6}:d=1.6,volume=.85[m];[2:a]atrim=0:${T.hook},afade=t=out:st=${T.hook - 1}:d=1,volume=.55[h];[m][h]amix=inputs=2:duration=longest:normalize=0[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", fin]);
  console.log("GATA", fin, "durata", START.total);
});
