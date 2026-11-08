/* Ebanist — audit de traduceri (nu e test: raportează, nu pică).
 *
 * Încarcă app/index.html în Chromium, adună toate dicționarele de text și caută:
 *   A. limbă greșită într-o valoare (ex.: română în blocul italian);
 *   B. valori identice în mai multe limbi (șir nelocalizat);
 *   C. ghilimele/diacritice care trădează altă limbă (ă ș ț în afara ro).
 * Ieșire: raport markdown pe stdout (sau în fișierul dat ca prim argument).
 *
 * Rulare:  cd test && node i18n-audit.cjs [raport.md]
 * Sursa de adevăr rămâne omul: euristica semnalează, nu decide.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
const APP = "file://" + path.resolve(__dirname, "../app/index.html");

/* ---- 1. colectare în pagină ---- */
const COLLECT = () => {
  const out = {};
  const grab = (name, get) => { try { const v = get(); if (v) out[name] = JSON.parse(JSON.stringify(v)); } catch (e) { out[name] = { __err: String(e) }; } };
  grab("I18N", () => I18N);
  grab("AUTH_I18N", () => AUTH_I18N);
  grab("SURVEY_I18N", () => SURVEY_I18N);
  grab("EL_I18N", () => EL_I18N);
  grab("AI_I18N", () => AI_I18N);
  grab("AU_I18N", () => AU_I18N);
  grab("ACC_I18N", () => ACC_I18N);
  grab("Passport.TXT", () => EBPassport.TXT);
  grab("Commerce.TXT", () => EBCommerce.TXT);
  grab("Advice.TXT", () => EBAdvice.TXT);
  grab("Help.UI", () => EBHelp.UI);
  grab("Help.TOPICS", () => EBHelp.TOPICS);
  grab("Help.FAQ", () => EBHelp.FAQ);
  grab("Atelier.I18N", () => EBAtelier.I18N);
  return out;
};

/* ---- 2. aplatizare: emite {src,key,lang,text} oriunde apar chei de limbă ---- */
const LSET = new Set(LANGS);
function isLangMap(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const ks = Object.keys(o);
  return ks.length >= 3 && ks.every((k) => LSET.has(k));
}
function strLeaves(v, p, cb) {
  if (typeof v === "string") cb(p, v);
  else if (Array.isArray(v)) v.forEach((x, i) => strLeaves(x, p + "[" + i + "]", cb));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) strLeaves(v[k], p ? p + "." + k : k, cb);
}
function flatten(src, v, p, out) {
  if (isLangMap(v)) {
    for (const l of Object.keys(v)) strLeaves(v[l], "", (sub, t) => out.push({ src, key: (p + (sub ? "." + sub : "")).replace(/^\./, ""), lang: l, text: t }));
    return;
  }
  if (Array.isArray(v)) { v.forEach((x, i) => flatten(src, x, p + "[" + i + "]", out)); return; }
  if (v && typeof v === "object") {
    // dicționar ACC_I18N: cheia e însăși textul sursă (it), valori pe limbă
    for (const k of Object.keys(v)) flatten(src, v[k], p ? p + "." + k : k, out);
  }
}

/* ---- 3. detecția limbii (euristică, cuvinte funcționale + semne) ---- */
const SW = {
  it: "il lo la le gli un uno una di del della dei delle da in con su per tra fra e ed o ma non che chi cui come più piu nel nella sul sulla sono è e' ho hai ha anta ante pezzi pezzo mobile quote quota con senza questo questa dei degli alla alle già gia prima dopo solo tutti tutto",
  ro: "și de la în cu pe pentru din dar nu că cel cea cele sunt este unei unui al ale mai doar toate tot această acest aceasta după dupa fără fara între intre când cand sau să piese piesă ușa ușă cote cotă",
  en: "the of and to in is are for with on at by from or not this that these those it as be can will your you if when then only all each more less than into out over no yes piece pieces door doors",
  fr: "le la les un une des du de et en dans avec sur pour par au aux ce cette ces est sont ne pas que qui il elle ou mais plus moins sans sous entre seulement tout toutes pièce pièces porte portes",
  de: "der die das den dem des ein eine einen einem einer und oder mit für von zu auf im in ist sind nicht wird werden bei nach aus nur alle auch wie als wenn dann über unter zwischen ohne Teil Teile Tür Türen",
  pl: "i w z na do się nie jest są dla od po przez lub oraz to że jak co tylko wszystkie który która które przed pod między bez drzwi element elementy",
  es: "el la los las un una unos unas de del y en con por para al se no es son que como más menos sin sobre entre solo todo todos pieza piezas puerta puertas o",
};
const SWM = {};
for (const l of LANGS) SWM[l] = new Set(SW[l].toLowerCase().split(/\s+/));
const SIGN = {
  ro: /[ăîâșțşţ]/i, pl: /[ąęłńśźż]/i, de: /[äöüß]/i, es: /[ñ¿¡]/, fr: /[çœ]|[éèêëàâîïôûù]/i, it: /[àèéìòù]/i,
};
function words(t) { return t.toLowerCase().replace(/\*\*|[{}][a-z0-9_]*[{}]?|\{[^}]*\}|<[^>]+>|&[a-z]+;/gi, " ").match(/[a-zàâäçéèêëîïôöùûüœñąćęłńóśźżășțşţß']+/gi) || []; }
function score(t) {
  const ws = words(t); const s = {}; for (const l of LANGS) s[l] = 0;
  for (const w of ws) for (const l of LANGS) if (SWM[l].has(w)) s[l]++;
  for (const l of ["ro", "pl", "de", "es"]) if (SIGN[l].test(t)) s[l] += 2;
  return { s, n: ws.length };
}
function detect(t) {
  const { s, n } = score(t);
  const ranked = LANGS.slice().sort((a, b) => s[b] - s[a]);
  return { best: ranked[0], top: s[ranked[0]], second: s[ranked[1]], s, n };
}

/* ---- 4. rapoarte ---- */
const NOISE = /^[\d\s.,:;()\[\]{}+\-–—×*/%°ØxX=<>#@&_'"«»|~^!?€$£✂✓✗⚠·…]*$/;
const BRAND = /^(ebanist|domus|blum|häfele|hafele|egger|pdf|csv|dxf|pro|ok|ai|3d|qr|abs|mdf|cnc|hdf|led|ml|mm|cm|m²|ral|nfc|html|json|zip|png|jpg)$/i;

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage();
  const perr = []; pg.on("pageerror", (e) => perr.push(e.message));
  await pg.goto(APP); await pg.waitForTimeout(1500);
  const raw = await pg.evaluate(COLLECT);
  await b.close();

  const rows = [];
  for (const [src, v] of Object.entries(raw)) {
    if (v && v.__err) { console.error("! " + src + ": " + v.__err); continue; }
    if (src === "ACC_I18N") { for (const [k, m] of Object.entries(v)) for (const l of Object.keys(m)) if (typeof m[l] === "string") rows.push({ src, key: k, lang: l, text: m[l] }); continue; }
    // dicționare de forma DICT[lang][key]
    const top = Object.keys(v);
    if (top.length >= 3 && top.every((k) => LSET.has(k))) { for (const l of top) strLeaves(v[l], "", (k, t) => rows.push({ src, key: k, lang: l, text: t })); continue; }
    flatten(src, v, "", rows);
  }

  const L = [];
  const per = {}; for (const r of rows) (per[r.src] = per[r.src] || {})[r.lang] = ((per[r.src] || {})[r.lang] || 0) + 1;
  L.push("# Audit traduceri Ebanist\n");
  L.push("Sursă: " + APP.replace("file://", "") + " · șiruri analizate: " + rows.length + (perr.length ? " · erori de pagină: " + perr.length : "") + "\n");
  L.push("| dicționar | " + LANGS.join(" | ") + " |\n|---|" + LANGS.map(() => "---").join("|") + "|");
  for (const [s, m] of Object.entries(per)) L.push("| " + s + " | " + LANGS.map((l) => m[l] || "").join(" | ") + " |");

  /* A. limbă greșită */
  const wrong = [];
  for (const r of rows) {
    if (NOISE.test(r.text)) continue;
    const d = detect(r.text);
    if (d.n < 3) continue;
    // ro prin diacritice într-o limbă care nu e ro
    if (r.lang !== "ro" && /[ășțşţ]/i.test(r.text)) { wrong.push({ ...r, why: "diacritice românești în " + r.lang }); continue; }
    if (d.best !== r.lang && d.top >= 3 && d.top - (d.s[r.lang] || 0) >= 2) wrong.push({ ...r, why: "pare " + d.best + " (" + d.top + " vs " + (d.s[r.lang] || 0) + ")" });
  }
  L.push("\n## A. Limbă greșită într-o valoare (" + wrong.length + ")\n");
  for (const l of LANGS) {
    const w = wrong.filter((x) => x.lang === l); if (!w.length) continue;
    L.push("\n### în `" + l + "` (" + w.length + ")\n");
    for (const x of w.slice(0, 80)) L.push("- `" + x.src + ":" + x.key + "` — " + x.why + ": «" + x.text.replace(/\s+/g, " ").slice(0, 110) + "»");
    if (w.length > 80) L.push("- … încă " + (w.length - 80));
  }

  /* A2. cuvinte care în corpus apar numai într-o ALTĂ limbă (amestec în interiorul valorii) */
  const vocab = {}; for (const l of LANGS) vocab[l] = new Map();
  const wl = (t) => words(t).filter((w) => w.length >= 4 && !/^\d/.test(w));
  for (const r of rows) for (const w of new Set(wl(r.text))) vocab[r.lang].set(w, (vocab[r.lang].get(w) || 0) + 1);
  const mixed = [];
  for (const r of rows) {
    if (NOISE.test(r.text)) continue;
    const bad = [];
    for (const w of new Set(wl(r.text))) {
      if (vocab[r.lang].get(w) !== 1) continue; // apare și în altă valoare din aceeași limbă
      const other = LANGS.filter((l) => l !== r.lang && vocab[l].has(w));
      if (other.length === 1 && vocab[other[0]].get(w) >= 2) bad.push(w + "→" + other[0]);
    }
    if (bad.length) mixed.push({ ...r, bad });
  }
  mixed.sort((x, y) => y.bad.length - x.bad.length);
  L.push("\n## A2. Cuvinte din altă limbă în interiorul valorii (" + mixed.length + ")\n");
  L.push("Cuvânt care apare doar în această valoare din limba ei și, în rest, numai într-o singură altă limbă (≥2 ori). Candidați la amestec; cognatele reale apar și ele.\n");
  for (const l of LANGS) {
    const w = mixed.filter((x) => x.lang === l); if (!w.length) continue;
    L.push("\n### în `" + l + "` (" + w.length + ")\n");
    for (const x of w.slice(0, 60)) L.push("- `" + x.src + ":" + x.key + "` [" + x.bad.slice(0, 4).join(", ") + "]: «" + x.text.replace(/\s+/g, " ").slice(0, 100) + "»");
    if (w.length > 60) L.push("- … încă " + (w.length - 60));
  }

  /* B. identice între limbi (nelocalizat) */
  const byKey = {};
  for (const r of rows) (byKey[r.src + "\u0000" + r.key] = byKey[r.src + "\u0000" + r.key] || {})[r.lang] = r.text;
  const ident = [];
  for (const [id, m] of Object.entries(byKey)) {
    const langs = Object.keys(m); if (langs.length < 3) continue;
    const g = {}; for (const l of langs) (g[m[l]] = g[m[l]] || []).push(l);
    for (const [t, ls] of Object.entries(g)) {
      if (ls.length < 2 || NOISE.test(t) || BRAND.test(t.trim())) continue;
      if (words(t).length < 2 && t.length < 8) continue;
      ident.push({ id: id.replace("\u0000", ":"), t, ls });
    }
  }
  const cls = (x) => (x.ls.length === langs7().length ? "toate" : x.ls.join("="));
  function langs7() { return LANGS; }
  L.push("\n## B. Aceeași valoare în mai multe limbi (" + ident.length + ")\n");
  L.push("Prag: ≥2 limbi, ≥2 cuvinte sau ≥8 caractere. Multe sunt legitime (nume, unități); de parcurs.\n");
  const grp = {}; for (const x of ident) (grp[cls(x)] = grp[cls(x)] || []).push(x);
  for (const [k, a] of Object.entries(grp).sort((p, q) => q[1].length - p[1].length)) {
    L.push("\n### " + k + " (" + a.length + ")\n");
    for (const x of a.slice(0, 40)) L.push("- `" + x.id + "` «" + x.t.replace(/\s+/g, " ").slice(0, 90) + "»");
    if (a.length > 40) L.push("- … încă " + (a.length - 40));
  }

  const rep = L.join("\n") + "\n";
  if (process.argv[2]) fs.writeFileSync(process.argv[2], rep); else process.stdout.write(rep);
  console.error("A2=" + mixed.length + " A=" + wrong.length + " B=" + ident.length + " rânduri=" + rows.length);
})().catch((e) => { console.error(e); process.exit(1); });
