#!/usr/bin/env node
/* Clip de marketing din Ebanist, fara AI si fara abonament.
   Deschide aplicatia in Chromium headless, incarca un corp si il randeaza cadru cu cadru
   prin GL3D.capture() (aceleasi cote, aceleasi gauri ca in aplicatie), apoi ffmpeg pune
   textul si leaga cadrele intr-un MP4 vertical 9:16.

   node clip.cjs --in <proiect.ebanist.json> --lang it --out out/clip.mp4

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
  ro: { rev1: "Cazan, contor de gaz, tablou electric. Un singur dulap.", rev2: "Dulapul se adaptează, cazanul rămâne unde e", a: "Din același desen", b: "Piesele, cu cotele lor", c1: "Găurile, exact unde trebuie", c2: "Balamalele și șuruburile intră în găuri", d: "Clientul îl vede în 3D", cta: "Ebanist · link în bio", hook: "Clientul vede dulapul în 3D. Mașina primește găurile.", holes: "găuri", role: { fianco: "Lateral", divisorio: "Separator", base: "Bază", cielo: "Plafon", ripiano: "Raft", zoccolo: "Plintă", frontale: "Ușă" } },
  fr: { rev1: "Chaudière, compteur de gaz, tableau électrique. Un seul meuble.", rev2: "Le meuble s'adapte, la chaudière reste où elle est", a: "Depuis le même dessin", b: "Chaque pièce, avec ses cotes", c1: "Les perçages, au bon endroit", c2: "Charnières et vis entrent dans les trous", d: "Le client le voit en 3D", cta: "Ebanist · lien en bio", hook: "Le client voit le meuble en 3D. La machine reçoit les perçages.", holes: "perçages", role: { fianco: "Côté", divisorio: "Séparation", base: "Fond bas", cielo: "Dessus", ripiano: "Étagère", zoccolo: "Plinthe", frontale: "Porte" } },
  it: { rev1: "Caldaia, contatore del gas, quadro elettrico. Un solo mobile.", rev2: "Il mobile si adatta, la caldaia resta dov'è", a: "Dallo stesso disegno", b: "Ogni pezzo, con le sue quote", c1: "I fori, esattamente dove servono", c2: "Cerniere e viti entrano nei fori", d: "Il cliente lo vede in 3D", cta: "Ebanist · link in bio", hook: "Il cliente vede il mobile in 3D. La macchina riceve i fori.", holes: "forature", role: { fianco: "Fianco", divisorio: "Divisorio", base: "Base", cielo: "Cielo", ripiano: "Ripiano", zoccolo: "Zoccolo", frontale: "Anta" } },
  en: { rev1: "Boiler, gas meter, electrical panel. One single unit.", rev2: "The unit adapts, the boiler stays where it is", a: "From the same drawing", b: "Every part, with its dimensions", c1: "Holes exactly where they go", c2: "Hinges and screws drop into the holes", d: "The client sees it in 3D", cta: "Ebanist · link in bio", hook: "The client sees the cabinet in 3D. The machine gets the holes.", holes: "holes", role: { fianco: "Side", divisorio: "Divider", base: "Bottom", cielo: "Top", ripiano: "Shelf", zoccolo: "Plinth", frontale: "Door" } }
};

function args(argv) {
  const o = { secs: 28, fps: 24, size: "1080x1920", lang: "it", out: "clip.mp4", "mat-body": "rovere_chiaro_19", "mat-front": "antracite_storm_grey_19" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith("--")) continue;
    const k = a.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
    o[k] = v;
  }
  o.secs = +o.secs; o.fps = +o.fps; return o;
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Cronologia: t in [0,1] -> starea camerei si a corpului. Totul e o functie pura de t,
   deci acelasi input da aceleasi cadre.
   A .00-.12 corp inchis · B .12-.26 explodat · C .26-.88 trei piese izolate, rotindu-se:
   C1 .26-.40 gaurile · C2 .40-.70 feroneria intra in gauri · C3 .70-.88 montat · D .88-1 usile deschise */
const PH = { b: .12, c: .26, c2: .40, c3: .70, d: .88 };
function scene(t) {
  const explode = ss(PH.b, .20, t) - ss(.21, PH.c, t);
  const trio = t >= PH.c && t < PH.d;
  const u = trio ? (t - PH.c) / (PH.d - PH.c) : 0;
  const yaw = t < PH.c ? 0.35 + 0.9 * t : 0.50 + 0.25 * ss(PH.d, 1, t);
  const pitch = 0.30 - 0.06 * Math.sin(t * Math.PI * 2);
  const holes = (t > .19 && t < PH.c);
  const open = t >= PH.d + .02;
  const fly = ss(PH.c2, PH.c3, t);
  return { yaw, pitch, explode, holes, open, trio, u, fly, zoom: 1.5 - 0.5 * explode };
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
  if (!o.in) { console.error("lipseste --in <fisier.json>. Vezi antetul din clip.cjs."); process.exit(2); }
  const T = TXT[o.lang]; if (!T) { console.error("limba: " + Object.keys(TXT).join(", ")); process.exit(2); }
  const [W, H] = o.size.split("x").map(Number), S = W / 1080;
  const inp = loadInput(o);
  /* culoare si textura: implicit stejar (fibra procedurala din viewer) pe corp, antracit pe fronturi;
     --keep-materials pastreaza materialele proiectului */
  if (!o["keep-materials"]) Object.assign(inp.cfg, { matBody: o["mat-body"], matFront: o["mat-front"], matBack: o["mat-body"] });
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

  /* cele trei piese: o usa (cupele de balama), un fianco/divizor (minifix, tasseli) si un cer/baza,
     alese dupa gaurile din modelul de operatii; --pieces 13,1,5 le alege dupa numarul din distinta */
  const info = await pg.evaluate(([cfg, want]) => {
    window.GL3D.render(cfg, { explode: 0 });
    const P = window.GL3D.model().ops.pieces.filter(p => p.thickness);
    const area = q => (q.operations || []).reduce((a, op) => a + (op.type === "drill" ? op.dia * op.dia : 0), 0);
    const best = roles => P.filter(q => roles.includes(q.role) && (q.operations || []).length).sort((a, b) => area(b) - area(a))[0];
    let sel = want.length ? want.map(n => P.find(x => x.n === n)).filter(Boolean)
      : [best(["frontale"]), best(["fianco", "divisorio"]), best(["cielo", "base", "ripiano"])].filter(Boolean);
    return sel.map(p => {
      const byDia = {}; let nx = 0, ny = 0, nz = 0;
      (p.operations || []).forEach(op => { if (op.type !== "drill") return; byDia[op.dia] = (byDia[op.dia] || 0) + 1;
        if (op._ax != null) { const w = op.dia * op.dia * (op._side || 1); if (op._ax === 0) nx += w; else if (op._ax === 1) ny += w; else nz += w; } });
      const sp = [0, 1, 2].map(i => p.max[i] - p.min[i]);
      return { pk: p.pk, n: p.n, role: p.role, L: p.length, W: p.width, T: p.thickness, nops: (p.operations || []).length, byDia, span: sp, nrm: [nx, ny, nz] };
    });
  }, [inp.cfg, o.pieces ? String(o.pieces).split(",").map(Number) : []]);
  if (!info.length) { console.error("nicio piesa cu operatii in model"); process.exit(6); }

  /* geometria celor 3 casete (un card mare sus, doua jos) si, pentru fiecare piesa,
     zoom-ul care o incadreaza, fata cu gauri spre camera si inclinarea */
  const R = v => Math.round(v * S), gap = R(14);
  const layout = [{ x: R(24), y: R(190), w: R(1032), h: R(690) }, { x: R(24), y: R(970), w: R(509), h: R(690) }, { x: R(547), y: R(970), w: R(509), h: R(690) }];
  const tv = Math.tan(17 * Math.PI / 180);
  const tiles = info.map((p, i) => {
    const L = layout[i], a = L.w / L.h, th = tv * a, X = p.span[0], Y = p.span[1], Z = p.span[2];
    const big = [Math.abs(p.nrm[0]), Math.abs(p.nrm[1]), Math.abs(p.nrm[2])], ax = big.indexOf(Math.max(...big));
    const sg = p.nrm[ax] < 0 ? -1 : 1;
    const horiz = ax !== 1;
    const yawC = horiz ? Math.atan2(ax === 0 ? sg : 0, ax === 2 ? sg : 0) : 0.6;
    const pitch = horiz ? 0.16 : sg * 0.95;
    const Hx = Math.hypot(X, Z), Vx = Y * Math.cos(pitch) + Hx * Math.abs(Math.sin(pitch));
    const d = Math.max(Vx / (1.56 * tv), Hx / (1.56 * th));
    const sinMin = Math.min(Math.sin(17 * Math.PI / 180), th / Math.sqrt(1 + th * th));
    const zoom = Math.min(8, Math.max(0.35, 0.5 * Math.hypot(X, Y, Z) * 1.04 / (sinMin * d)));
    return { ...L, pk: p.pk, yawC, pitch, zoom, ph: i * 2.1 };
  });
  info.forEach((p, i) => console.log(`piesa ${i + 1}: n.${p.n} ${p.role} ${p.L}x${p.W}x${p.T}, ${p.nops} operatii, zoom ${tiles[i].zoom.toFixed(2)}, yaw ${tiles[i].yawC.toFixed(2)}`));

  const N = Math.round(o.secs * o.fps), fdir = path.join(tmp, "f"); fs.mkdirSync(fdir);
  console.log(`${inp.name}: ${N} cadre ${W}x${H} -> ${o.out}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0 : i / (N - 1), s = scene(t);
    if (s.trio) {
      /* fiecare piesa se roteste pe cont propriu: balans in jurul fetei cu gauri + o rotatie lenta */
      const bump = ss(.40, .48, t) * (1 - ss(.62, .70, t));   // apropiere pe cupa balamalei cat intra feroneria
      const zooms = tiles.map((tl, k) => tl.zoom * (1 + (k === 0 ? 1.7 : 0.6) * bump));
      const yaws = tiles.map(tl => tl.yawC + 1.1 * Math.sin(2 * Math.PI * (1.5 * s.u) + tl.ph) + 1.2 * Math.PI * s.u);
      var x = await pg.evaluate(async ([cfg, s, tl, yaws, zooms, W, H, S]) => {
        const bms = [];
        for (let k = 0; k < tl.length; k++) {
          const r = window.GL3D.capture(cfg, { w: tl[k].w, h: tl[k].h, yaw: yaws[k], pitch: tl[k].pitch, explode: 0, holes: true, zoom: zooms[k], edges: true, sel: tl[k].pk, iso: true, fly: s.fly });
          bms.push(await createImageBitmap(await (await fetch(r.img)).blob()));
        }
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
        g.fillStyle = "#e9ebe5"; g.fillRect(0, 0, W, H);
        const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
        tl.forEach((q, k) => { g.save(); g.shadowColor = "rgba(0,0,0,.18)"; g.shadowBlur = 24 * S; g.shadowOffsetY = 6 * S; rr(q.x, q.y, q.w, q.h, 30 * S); g.fillStyle = "#fff"; g.fill(); g.restore();
          g.save(); rr(q.x, q.y, q.w, q.h, 30 * S); g.clip(); g.drawImage(bms[k], q.x, q.y); g.restore(); });
        return cv.toDataURL("image/jpeg", 0.92);
      }, [inp.cfg, s, tiles, yaws, zooms, W, H, S]);
    } else {
      var x = await pg.evaluate(([cfg, p, w, h]) => {
        const r = window.GL3D.capture(cfg, { w, h, yaw: p.yaw, pitch: p.pitch, explode: p.explode, holes: p.holes, open: p.open, zoom: p.zoom, edges: true });
        return r && r.img;
      }, [inp.cfg, s, W, H]);
    }
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
  const fade = (from, to) => `alpha='if(lt(t,${from}+0.3),(t-${from})/0.3,if(gt(t,${to}-0.3),(${to}-t)/0.3,1))'`;
  const dt = (file, y, size, from, to, xc) =>
    `drawtext=fontfile='${font}':textfile='${file}':fontcolor=white:fontsize=${Math.round(size * S)}:line_spacing=${Math.round(14 * S)}:x=${xc == null ? "(w-text_w)/2" : `${xc}-text_w/2`}:y=${y}:` +
    `box=1:boxcolor=black@0.55:boxborderw=${Math.round(22 * S)}:enable='between(t,${from},${to})':${fade(from, to)}`;
  const D = o.secs, at = f => D * f;
  const nr = (n) => String(n).replace(".", ",");
  const low = "h-250";
  const vf = [
    ...(o.reveal ? [] : [dt(put("hook", wrap(hookTxt, 22)), "h*0.12", 72, 0.2, Math.min(3.2, at(PH.b)))]),
    dt(put("ca", T.a), low, 54, Math.max(3.4, at(PH.b) - 0.6), at(PH.b) + 0.6),
    dt(put("cb", T.b), low, 54, at(PH.b) + 0.8, at(PH.c)),
    dt(put("cc1", T.c1), R(60), 54, at(PH.c) + 0.1, at(PH.c2)),
    dt(put("cc2", T.c2), R(60), 54, at(PH.c2) + 0.1, at(PH.d) - 0.1),
    dt(put("cd", T.d), low, 54, at(PH.d) + 0.2, D - 2.5),
    dt(put("cta", T.cta), low, 60, D - 2.4, D)
  ];
  /* etichetele pieselor, sub fiecare card, cat timp sunt pe ecran */
  info.forEach((p, k) => {
    const dias = Object.keys(p.byDia).map(Number).sort((a, b) => b - a).slice(0, k === 0 ? 4 : 0).map(d => `Ø${nr(d)} ×${p.byDia[d]}`).join(" · ");
    const L = layout[k], txt = `${T.role[p.role] || p.role} n.${p.n} · ${nr(p.L)} × ${nr(p.W)} × ${nr(p.T)}\n${p.nops} ${T.holes}${dias ? " · " + dias : ""}`;
    vf.push(dt(put("lab" + k, txt), L.y + L.h + R(22), k === 0 ? 34 : 24, at(PH.c) + 0.3, at(PH.d) - 0.2, L.x + L.w / 2));
  });
  const out = path.resolve(o.out), main = o.reveal ? path.join(tmp, "main.mp4") : out;
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(o.fps), "-i", path.join(fdir, "%05d.jpg"),
    "-vf", vf.join(","), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", main], { stdio: "inherit" });
  if (r.status !== 0) { console.error("ffmpeg a esuat; cadrele sunt in " + fdir); process.exit(5); }
  if (o.reveal) {
    /* introducere: poza «inainte» (cu hook-ul), apoi «dupa», cu zoom lent si fundal estompat; apoi 3D-ul */
    const [bf, af] = String(o.reveal).split(",").map(p => path.resolve(p));
    const FPS = o.fps, d1 = 3.6, d2 = 3.6, xf = 0.6;
    const layer = i => `[${i}:v]split[bg${i}][fg${i}];[bg${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=40:4[b${i}];` +
      `[fg${i}]scale=${W}:-2,zoompan=z='min(1+0.0009*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${Math.round(W * 4 / 3)}:fps=${FPS}[z${i}];[b${i}][z${i}]overlay=(W-w)/2:(H-h)/2[v${i}]`;
    const tx = (f, t0, t1) => dt(f, "h*0.1", 66, t0, t1);
    const intro = path.join(tmp, "intro.mp4");
    const rr = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-framerate", String(FPS), "-t", String(d1 + xf), "-i", bf, "-loop", "1", "-framerate", String(FPS), "-t", String(d2 + xf), "-i", af,
      "-filter_complex", `${layer(0)};${layer(1)};[v0][v1]xfade=transition=wipeleft:duration=${xf}:offset=${d1}[x];[x]${tx(put("rv1", wrap(T.rev1, 22)), 0.2, d1 - 0.2)},${tx(put("rv2", wrap(T.rev2, 22)), d1 + xf + 0.2, d1 + d2 - 0.2)}[o]`,
      "-map", "[o]", "-r", String(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", intro], { stdio: "inherit" });
    if (rr.status !== 0) { console.error("intro (ffmpeg) a esuat"); process.exit(7); }
    const rc = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", intro, "-i", main, "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", out], { stdio: "inherit" });
    if (rc.status !== 0) { console.error("concat (ffmpeg) a esuat"); process.exit(8); }
  }
  if (!o["keep-frames"]) fs.rmSync(tmp, { recursive: true, force: true }); else console.log("cadre: " + fdir);
  console.log("gata: " + out);
})().catch(e => { console.error(e); process.exit(1); });
