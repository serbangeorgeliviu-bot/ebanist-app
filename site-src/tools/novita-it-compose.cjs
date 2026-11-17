/* Clip „Novità" (it), partea 3: compune clipul. Cadrele din novita-it-frames.cjs + capturile din novita-it-ui.cjs + clipul de bucătărie
   existent; subtitrări italiene, voce (vidIQ «Marco») și muzică. 1080×1920, 24 fps.
   node site-src/tools/novita-it-compose.cjs   (IN = dosarul cu seg-… și ui, VOICE = vo.mp3, MUSIC = music.wav, OUT = dosarul de ieșire) */
const PW = process.env.PLAYWRIGHT_PATH || "/opt/node-tools/node_modules/playwright";
const { chromium } = require(PW);
const http = require("http"), fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.resolve(__dirname, "../.."), IN = process.env.IN, OUT = process.env.OUT || IN;
const VOICE = process.env.VOICE, MUSIC = process.env.MUSIC, FPS = 24, W = 1080, H = 1920;
const KITCHEN = path.join(root, "site/video/ebanist-cucina-it.mp4"), LOGO = path.join(root, "site/video/ebanist-logo-512.png");
const D = path.join(OUT, "compose"); fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(path.join(D, "ov"), { recursive: true });
const VO = [5.486, 3.788, 6.531, 7.889, 3.866, 2.847, 7.628, 2.769];

const MIME = { ".html": "text/html", ".woff2": "font/woff2", ".png": "image/png", ".css": "text/css" };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); } r.setHeader("Access-Control-Allow-Origin", "*"); r.setHeader("content-type", MIME[path.extname(f)] || "application/octet-stream"); r.end(fs.readFileSync(f)); }).listen(8802, async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const pg = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const FONT = `@font-face{font-family:BC;font-weight:700;src:url(http://localhost:8802/fonts/barlow-condensed-latin-700-normal.woff2)}@font-face{font-family:BC;font-weight:600;src:url(http://localhost:8802/fonts/barlow-condensed-latin-600-normal.woff2)}@font-face{font-family:BR;font-weight:600;src:url(http://localhost:8802/fonts/barlow-latin-600-normal.woff2)}`;
  const shot = async (name, body, opaque) => { await pg.setContent(`<html><head><style>${FONT}html,body{margin:0;width:${W}px;height:${H}px;background:${opaque ? "#0e3b2a" : "transparent"};overflow:hidden;font-family:BC,sans-serif}</style></head><body>${body}</body></html>`); await pg.evaluate(async () => { await Promise.all([document.fonts.load('700 80px BC'), document.fonts.load('600 40px BC'), document.fonts.load('600 40px BR')]); await document.fonts.ready; }); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(D, "ov", name + ".png"), omitBackground: !opaque }); return path.join(D, "ov", name + ".png"); };
  const cap = (txt, sub, top) => `<div style="position:absolute;left:54px;right:54px;top:${top || 1290}px;padding:30px 40px;border-radius:38px;background:rgba(14,59,42,.94);color:#fff;text-align:center;box-shadow:0 16px 50px rgba(0,0,0,.45);border:2px solid rgba(217,201,163,.35)"><div style="font-weight:700;font-size:84px;line-height:1.02;letter-spacing:.5px">${txt}</div>${sub ? `<div style="font-family:BR;font-weight:600;font-size:40px;margin-top:12px;color:#d9c9a3;letter-spacing:.3px">${sub}</div>` : ""}</div>`;
  const hook = `<div style="position:absolute;left:40px;right:40px;top:250px;text-align:center;color:#fff;font-weight:700;font-size:150px;line-height:.98;text-transform:uppercase;text-shadow:0 6px 0 rgba(0,0,0,.45),0 0 60px rgba(0,0,0,.65)">Un mobile<br><span style="color:#E6C46A">che si monta</span><br>da solo</div>`;
  const badge = `<div style="position:absolute;left:0;right:0;top:92px;display:flex;justify-content:center"><div style="padding:12px 34px;border-radius:60px;background:rgba(14,59,42,.9);color:#fff;font-weight:700;font-size:46px;letter-spacing:18px;padding-left:52px;border:2px solid rgba(217,201,163,.4)">EBANIST</div></div>`;
  const chip = (c, t, x) => `<div style="position:absolute;left:${x}px;top:150px;display:flex;align-items:center;gap:16px;padding:14px 30px;border-radius:60px;background:rgba(255,255,255,.95);color:#0e3b2a;font-weight:700;font-size:50px"><span style="width:44px;height:44px;border-radius:50%;background:${c};border:3px solid rgba(0,0,0,.18)"></span>${t}</div>`;
  const O = {
    hook: await shot("hook", hook + badge),
    capA: await shot("capA", cap("Ogni pezzo, nell'ordine giusto", "come in laboratorio")),
    capB1: await shot("capB1", cap("Cerniere Blum", "disegnate sui dati del produttore")),
    capB2: await shot("capB2", cap("Guide per cassetti", "con la loro clip di fissaggio")),
    capB3: await shot("capB3", cap("Lamello · Festool · Domino", "le giunzioni si vedono")),
    capC1: await shot("capC1", cap("E adesso… la luce", "")),
    capC2: await shot("capC2", cap("Striscia LED già nel preventivo", "con trasformatore e dimmer")),
    capC3: await shot("capC3", cap("Dimmer o sensore sull'anta", "scegli tu come si accende")),
    capD: await shot("capD", cap("Venatura vera del legno", "il colore del tuo campione")),
    chip1: await shot("chip1", chip("#C4A87C", "Rovere", 54)), chip2: await shot("chip2", chip("#6E4B33", "Noce", 54)), chip3: await shot("chip3", chip("#A8B08A", "Avocado", 54)),
    capE: await shot("capE", cap("Cucine con nicchie", "per gli elettrodomestici")),
    capF1: await shot("capF1", cap("Un errore nel progetto?", "Ebanist ti propone la soluzione")),
    capF2: await shot("capF2", cap("Scegli e applichi", "il controllo si chiude da solo")),
    capF3: await shot("capF3", cap("QR su ogni etichetta", "il pezzo si apre in laboratorio", 1500)),
    end: await shot("end", `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;color:#fff;text-align:center"><img src="http://localhost:8802/site/video/ebanist-logo-512.png" style="width:280px;height:280px;border-radius:60px"><div style="font-weight:700;font-size:56px;letter-spacing:26px;padding-left:26px;opacity:.85">EBANIST</div><div style="font-weight:700;font-size:130px;line-height:1">Provalo gratis</div><div style="font-family:BR;font-weight:600;font-size:62px;color:#E6C46A">ebanist.com</div><div style="font-weight:600;font-size:46px;opacity:.8;margin-top:20px">Link in bio</div></div>`, true),
  };
  await b.close(); srv.close();

  /* părți: fiecare cu cadrele, opțional suprapuneri (png, de la, până la, fade) */
  const x264 = ["-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", String(FPS * 2)];
  const parts = []; let pi = 0;
  const run = a => cp.execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
  const part = (inputArgs, ovs, frames, vf) => {
    const f = path.join(D, "part-" + String(pi++).padStart(2, "0") + ".mp4");
    const a = [...inputArgs]; let fc = [], last = "0:v";
    if (vf) { fc.push(`[0:v]${vf}[b]`); last = "b"; }
    ovs.forEach((o, i) => { a.push("-loop", "1", "-framerate", String(FPS), "-i", o.png); fc.push(`[${i + 1}:v]format=rgba,fade=t=in:st=${o.from}:d=0.22:alpha=1[ov${i}]`); fc.push(`[${last}][ov${i}]overlay=0:0:enable='between(t,${o.from},${o.to == null ? 999 : o.to})'[o${i}]`); last = "o" + i; });
    a.push("-filter_complex", fc.length ? fc.join(";") : "null", ...(fc.length ? ["-map", "[" + last + "]"] : []), "-frames:v", String(frames), ...x264, f);
    run(a); parts.push(f); return f;
  };
  const seg = (name, n, ovs) => part(["-framerate", String(FPS), "-i", path.join(IN, "seg-" + name, "f_%05d.jpg")], ovs, n);
  const N = name => fs.readdirSync(path.join(IN, "seg-" + name)).filter(x => x.endsWith(".jpg")).length;
  /* A: hook 0–2.6 s, apoi legenda */
  seg("a-montaj", N("a-montaj"), [{ png: O.hook, from: 0.0, to: 3.0 }, { png: O.capA, from: 3.1 }]);
  /* B */
  seg("b-balama", N("b-balama"), [{ png: O.capB1, from: 0.15 }]); seg("b-glisiera", N("b-glisiera"), [{ png: O.capB2, from: 0.15 }]); seg("b-imbinari", N("b-imbinari"), [{ png: O.capB3, from: 0.15 }]);
  /* C */
  seg("c-led-stins", N("c-led-stins"), [{ png: O.capC1, from: 0.2 }]); seg("c-led-aprins", N("c-led-aprins"), [{ png: O.capC2, from: 0.3 }]); seg("c-led-dimmer", N("c-led-dimmer"), [{ png: O.capC3, from: 0.2 }]);
  /* D */
  seg("d-lemn-1", N("d-lemn-1"), [{ png: O.capD, from: 0.1 }, { png: O.chip1, from: 0.1 }]); seg("d-lemn-2", N("d-lemn-2"), [{ png: O.capD, from: 0 }, { png: O.chip2, from: 0.05 }]); seg("d-lemn-3", N("d-lemn-3"), [{ png: O.capD, from: 0 }, { png: O.chip3, from: 0.05 }]);
  /* E: clipul de bucătărie (2,1–4,95 s), mărit 1,2× ca să iasă legenda lui, cu legenda noastră */
  const nE = Math.round(VO[5] * FPS);
  part(["-ss", "2.1", "-t", "3.2", "-i", KITCHEN], [{ png: O.capE, from: 0.1 }], nE, `crop=765:1360:157:200,scale=${W}:${H}:flags=lanczos,setsar=1,fps=${FPS}`);
  /* F: capturi de interfață, cu zoom lent */
  const still = (png, sec, ov, z0, z1) => { const n = Math.round(sec * FPS); part(["-loop", "1", "-framerate", String(FPS), "-i", png], ov ? [{ png: ov, from: 0.15 }] : [], n, `scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='${z0}+(${z1}-${z0})*on/${n}':x='iw/2-(iw/zoom/2)':y='ih*0.35-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},setsar=1`); return n; };
  const fN = Math.round(VO[6] * FPS), f1 = Math.round(2.4 * FPS), f2 = Math.round(2.4 * FPS), f3 = fN - f1 - f2;
  still(path.join(IN, "ui/audit.png"), f1 / FPS, O.capF1, 1.0, 1.1); still(path.join(IN, "ui/fix.png"), f2 / FPS, O.capF2, 1.0, 1.08); still(path.join(IN, "ui/label.png"), f3 / FPS, O.capF3, 1.12, 1.0);
  /* G: cardul final */
  const nG = Math.round(VO[7] * FPS);
  part(["-loop", "1", "-framerate", String(FPS), "-i", O.end], [], nG, `fade=t=in:st=0:d=0.4`);

  const lst = path.join(D, "parts.txt"); fs.writeFileSync(lst, parts.map(x => "file '" + x + "'").join("\n"));
  const vid = path.join(D, "video.mp4"); run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vid]);
  const dur = parseFloat(cp.execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vid]).toString());
  console.log("video", dur.toFixed(2), "s");
  /* audio: voce în față (−16 LUFS), muzică în spate (−28 LUFS, ducking), fade-out la sfârșit */
  const final = path.join(OUT, "ebanist-novita-it.mp4");
  run(["-i", vid, "-i", VOICE, "-i", MUSIC, "-filter_complex",
    `[1:a]loudnorm=I=-16:TP=-1.5:LRA=9,asplit=2[vo][vosc];[2:a]atrim=0:${dur.toFixed(2)},volume=0.55,loudnorm=I=-27:TP=-3:LRA=7,afade=t=out:st=${(dur - 1.8).toFixed(2)}:d=1.8[mu];[mu][vosc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[duck];[vo][duck]amix=inputs=2:duration=longest:normalize=0,aresample=44100,apad=whole_dur=${dur.toFixed(2)},atrim=0:${dur.toFixed(2)}[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", dur.toFixed(2), final]);
  console.log("gata", final);
});
