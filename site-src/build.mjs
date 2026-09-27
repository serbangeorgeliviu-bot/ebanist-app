/* =====================================================================
   Ebanist — generatorul site-ului de prezentare
   ---------------------------------------------------------------------
   node site-src/build.mjs

   Citește template.html + i18n/<lang>.json + site.config.json + datele
   reale ale dulapului exemplu (data/wardrobe-pieces.json, scos din
   aplicație de tools/capture.cjs) și scrie:
       /index.html         (en, implicit)
       /ro/index.html  /it/index.html  /fr/index.html
       /sitemap.xml
   Fără dependențe: doar Node. Netlify NU rulează acest pas — fișierele
   generate se comit, iar site-ul se publică tot fără build, ca aplicația.
   Testul din test/run.js verifică că fișierele comise sunt la zi.
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SRC, "..");
const read = f => fs.readFileSync(path.join(SRC, f), "utf8");
const cfg = JSON.parse(read("site.config.json"));
const tpl = read("template.html");
const pieces = JSON.parse(read("data/wardrobe-pieces.json"));
/* CSS-ul intră în pagină: fără cerere care blochează prima randare */
const CSS = fs.readFileSync(path.join(ROOT, "site/css/site.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\n\s*/g, "\n");
/* logo-ul Ebanist: același fișier ca aplicația, o singură dată în pagină (symbol) */
const LOGO_SVG = fs.readFileSync(path.join(ROOT, "app/icons/ebanist-mark.svg"), "utf8");
const LOGO = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="ebLogo" viewBox="${LOGO_SVG.match(/viewBox="([^"]+)"/)[1]}">${LOGO_SVG.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim()}</symbol></svg>`;
const mats = JSON.parse(fs.readFileSync(path.join(ROOT, "app/data/materials-centro-legno.json"), "utf8")).materiali;

/* prețul are o singură sursă: billing.js, același fișier ca aplicația */
const billing = fs.readFileSync(path.join(ROOT, "app/config/billing.js"), "utf8");
const PRICE_M = (billing.match(/PRICE_MONTHLY:\s*"([^"]+)"/) || [])[1] || "9 €";
const PRICE_Y = (billing.match(/PRICE_YEARLY:\s*"([^"]+)"/) || [])[1] || "79 €";
const appHtml = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
const APP_VER = (appHtml.match(/const APP_VER="([^"]+)"/) || [])[1] || "0";

const I18N = {};
for (const l of cfg.LANGS) I18N[l] = JSON.parse(read(`i18n/${l}.json`));
const EN = I18N.en;

const esc = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;|nbsp;|#)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = s => String(s).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
const pageUrl = l => cfg.SITE_URL + (l === cfg.DEFAULT_LANG ? "/" : `/${l}/`);
const home = l => (l === cfg.DEFAULT_LANG ? "/" : `/${l}/`);

function t(L, key) {
  const v = key in I18N[L] ? I18N[L][key] : EN[key];
  if (v === undefined) throw new Error(`i18n: cheie lipsă «${key}»`);
  return v;
}
const pname = (L, s) => (I18N[L].pieces || {})[s] || EN.pieces[s] || s;

/* ---------- blocuri calculate ---------- */
function cutRows(L) {
  return pieces.map((p, i) => `<tr><td>${String(i + 1).padStart(2, "0")}</td><td>${esc(pname(L, p.el))}</td><td>${p.l}</td><td>${p.w}</td><td>${p.pz}</td><td>${p.edge || "—"}</td><td class="mat">${esc(pname(L, p.mat))}</td></tr>`).join("");
}

/* eticheta 70×37: marginile cu cant sunt îngroșate, ca pe foaia aplicației */
function edgeGlyph(code) {
  const c = String(code || "");
  const L = +((c.match(/(\d)L/) || [])[1] || 0), C = +((c.match(/(\d)C/) || [])[1] || 0);
  const e = (on, d) => `<path d="${d}" class="${on ? "on" : ""}"/>`;
  return `<svg class="eg" viewBox="0 0 40 24" aria-hidden="true"><rect x="4" y="4" width="32" height="16"/>${e(L >= 1, "M4 4H36")}${e(L >= 2, "M4 20H36")}${e(C >= 1, "M4 4V20")}${e(C >= 2, "M36 4V20")}</svg>`;
}
function labels(L) {
  const rows = [];
  for (const p of pieces) for (let i = 1; i <= p.pz; i++) rows.push({ ...p, i });
  const n = rows.length;
  return rows.slice(0, 24).map((p, k) => `<div class="lbl"><span class="lp">${esc(t(L, "story.lbl.proj"))} · Armadio</span><b>${esc(pname(L, p.el))}${p.pz > 1 ? ` (${p.i}/${p.pz})` : ""}</b><strong>${p.l} × ${p.w}</strong><span class="lm">${esc(pname(L, p.mat))}</span><span class="ln">#${String(k + 1).padStart(3, "0")}/${n}</span>${edgeGlyph(p.edge)}</div>`).join("");
}

/* fișa de asamblare: latura și ușa culcate pe masă, în proiecție oblică
   (lungimea pe orizontală, lățimea spre fundal); găurile sistem 32 și cele
   5 cupe de balama la cotele din distinta aplicației. */
function assembly(L) {
  const Z = 2, S = .2 * Z, KX = .55, KY = .46;   // Z: textele rămân ≥ 12 px în unități SVG                           // u → (S,0) · v → (KX·S, −KY·S)
  const P = (u, v) => [u * S + v * KX * S, -v * KY * S];
  const f = n => n.toFixed(1);
  const side = { l: 2200, w: 600 }, door = { l: 2114, w: 495 };
  const hinges = [100, 579, 1057, 1536, 2014];
  const panel = (oy, l, w, inner, cls = "") => {
    const c = [P(0, 0), P(l, 0), P(l, w), P(0, w)].map(([x, y]) => [x, y + oy]);
    const edge = `M${f(c[0][0])} ${f(c[0][1])}L${f(c[1][0])} ${f(c[1][1])}L${f(c[1][0])} ${f(c[1][1] + 19 * S * .6)}L${f(c[0][0])} ${f(c[0][1] + 19 * S * .6)}Z`;
    return `<path class="thk" d="${edge}"/><path class="pnl ${cls}" d="M${c.map(p => f(p[0]) + " " + f(p[1])).join("L")}Z" pathLength="1"/>` +
      `<g transform="matrix(${S} 0 ${KX * S} ${-KY * S} 0 ${oy})">${inner}</g>`;
  };
  let holes = "";
  for (let u = 37 + 32 * 2; u < side.l - 64; u += 32) holes += `<circle class="h" cx="${u}" cy="37" r="7"/><circle class="h" cx="${u}" cy="${side.w - 37}" r="7"/>`;
  let cups = "";
  for (const h of hinges) cups += `<circle class="cup" cx="${h}" cy="22.5" r="17.5"/>`;
  const oyS = 175 * Z, oyD = 300 * Z;
  let g = panel(oyS, side.l, side.w, holes) + panel(oyD, door.l, door.w, cups, "door");
  /* lanțul de cote al balamalelor, sub muchia ușii */
  const yd = oyD + 26 * Z;
  g += `<path class="dl" d="M0 ${yd}H${f(door.l * S)}" pathLength="1"/>`;
  let prev = 0;
  for (const h of [0, ...hinges, door.l]) {
    const x = h * S;
    g += `<path class="dl ext" d="M${f(x)} ${oyD + 6 * Z}V${yd + 4 * Z}"/>`;
    if (h && h !== door.l) g += `<text class="dt" x="${f(x)}" y="${yd + 14 * Z}" text-anchor="middle">${h}</text>`;
    prev = h;
  }
  g += `<text class="dt" x="${f(door.l * S)}" y="${yd - 4 * Z}" text-anchor="end">${door.l}</text>`;
  /* cota lungimii laturii, deasupra */
  const ys = oyS - side.w * KY * S - 14 * Z, xs0 = P(0, side.w)[0], xs1 = P(side.l, side.w)[0];
  g += `<path class="dl" d="M${f(xs0)} ${f(ys)}H${f(xs1)}M${f(xs0)} ${f(ys - 4 * Z)}v${8 * Z}M${f(xs1)} ${f(ys - 4 * Z)}v${8 * Z}" pathLength="1"/><text class="dt" x="${f((xs0 + xs1) / 2)}" y="${f(ys - 5 * Z)}" text-anchor="middle">${side.l}</text>`;
  return `<svg class="asm" viewBox="-20 140 1120 580" role="img" aria-label="${esc(strip(t(L, "story.e.t")))}">
  ${g}
  <text class="cap" x="0" y="${oyS + 18 * Z}">${esc(t(L, "story.asm.side"))} · ${esc(t(L, "story.asm.sys"))}</text>
  <text class="cap" x="0" y="${oyD + 50 * Z}">${esc(t(L, "story.asm.door"))} · ${esc(t(L, "story.asm.cup"))}</text>
</svg>`;
}

const typeGlyphs = ["M4 2h16v20H4zM12 2v20", "M2 2h20v20H2zM12 2v20M2 12h10", "M3 8h18v12H3zM3 8l2-3h14l2 3", "M3 5h18v15H3zM3 10h18M3 15h18", "M3 4h18v10H3z", "M7 1h10v22H7zM7 12h10", "M4 2h16v20H4zM4 8h16M4 14h16", "M3 4h18v16H3zM3 9h18M3 14h18", "M2 3h12v18H2zM14 11h8v10h-8", "M10 3h12v18H10zM2 11h8v10H2", "M2 4h20v16H2zM12 4v16M2 20h20", "M2 10h20v8H2zM6 18v2M18 18v2", "M2 8h20M4 8v12M20 8v12M4 13h7", "M2 9h20M5 9v11M19 9v11", "M2 12h20v6H2zM2 8h5v4"];
function types(L) {
  return t(L, "bento.types.list").map((n, i) => `<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${typeGlyphs[i] || typeGlyphs[0]}"/></svg><span>${String(i + 1).padStart(2, "0")}</span>${esc(n)}</li>`).join("");
}
function swatches() {
  const pick = mats.filter(m => m.colore_hex && m.attivo !== false).slice(0, 12);
  return pick.map(m => `<span class="sw${m.famiglia === "legno" ? " wood" : ""}" style="--c:${m.colore_hex}"><i></i><em class="mono">${esc(m.nome)}<br>${m.spessore} mm</em></span>`).join("");
}

const DOCS = [["distinta-0", "out.d1"], ["etichete-0", "out.d2"], ["montaj-0", "out.d3"], ["montaj-1", "out.d4"], ["desen-0", "out.d5"], ["oferta-0", "out.d6"]];
function sheets(L) {
  return DOCS.map(([f, k], i) => `<button type="button" class="sheet-doc" data-i="${i}" data-full="/site/docs/${L}/${f}-1500.webp" data-cap="${esc(strip(t(L, k)))}" aria-label="${esc(strip(t(L, k)))}"><picture><source type="image/avif" srcset="/site/docs/${L}/${f}-720.avif"><img src="/site/docs/${L}/${f}-720.webp" width="720" height="1019" alt="${esc(strip(t(L, k)))}" loading="lazy"></picture><span class="mono tag">${String(i + 1).padStart(2, "0")} · ${esc(strip(t(L, k)))}</span></button>`).join("");
}

function langLinks(L) {
  return cfg.LANGS.map(l => `<a href="${home(l)}" hreflang="${l}" lang="${l}"${l === L ? ' aria-current="page"' : ""}>${l.toUpperCase()}</a>`).join("");
}
function hreflang() {
  return cfg.LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${pageUrl(cfg.DEFAULT_LANG)}">`;
}
function jsonld(L) {
  const num = s => String(s).replace(/[^\d.,]/g, "").replace(",", ".");
  return JSON.stringify({
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Ebanist",
    applicationCategory: "DesignApplication", operatingSystem: "Web, Android", url: pageUrl(L), inLanguage: L,
    description: strip(t(L, "meta.desc")),
    offers: [
      { "@type": "Offer", name: strip(t(L, "price.free")), price: "0", priceCurrency: "EUR" },
      { "@type": "Offer", name: "Pro", price: num(PRICE_M), priceCurrency: "EUR", priceSpecification: { "@type": "UnitPriceSpecification", price: num(PRICE_M), priceCurrency: "EUR", unitCode: "MON" } }
    ],
    publisher: { "@type": "Organization", name: "Domus Renov SRL", email: cfg.EMAIL, sameAs: [cfg.TIKTOK_URL] }
  }).replace(/</g, "\\u003c");
}
function runtime(L) {
  const langNames = Object.fromEntries(cfg.LANGS.map(l => [l, I18N[l]._name]));
  return JSON.stringify({
    lang: L, langs: cfg.LANGS, home: Object.fromEntries(cfg.LANGS.map(l => [l, home(l)])), langNames,
    suggest: Object.fromEntries(cfg.LANGS.map(l => [l, { text: t(l, "suggest.text"), go: t(l, "suggest.go") }])),
    yearly: t(L, "price.yearly"), pieces: t(L, "intro.pieces"), app: `${cfg.APP_URL}?lang=${L}`, ver: APP_VER
  }).replace(/</g, "\\u003c");
}

/* ---------- randare ---------- */
function render(L) {
  const blocks = {
    css: CSS, logo: LOGO, lang: L, url: pageUrl(L), home: home(L), app: `${cfg.APP_URL}?lang=${L}`, ver: APP_VER,
    hreflang: hreflang(), langlinks: langLinks(L), jsonld: jsonld(L), runtime: runtime(L),
    cutrows: cutRows(L), labels: labels(L), assembly: assembly(L), types: types(L), swatches: swatches(),
    sheets: sheets(L), priceMonthly: esc(PRICE_M), yearly: esc(t(L, "price.yearly").replace("{y}", PRICE_Y))
  };
  return tpl.replace(/\{\{([@a-zA-Z0-9_.]+)\}\}/g, (m, key, off, src) => {
    let v;
    if (key.startsWith("@cfg.")) v = cfg[key.slice(5)];
    else if (key.startsWith("@")) v = blocks[key.slice(1)];
    else v = t(L, key);
    if (v === undefined) throw new Error(`template: «${key}» nedefinit`);
    /* într-un atribut: fără etichete, cu ghilimele scăpate */
    const before = src.slice(0, off), inTag = before.lastIndexOf("<") > before.lastIndexOf(">");
    const inComment = before.lastIndexOf("<!--") > before.lastIndexOf("-->");
    if (inTag && !inComment && !key.startsWith("@")) return esc(strip(v));
    return String(v);
  });
}

/* OUT_DIR: testul generează într-un dosar temporar și compară cu ce e comis */
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : ROOT;
for (const L of cfg.LANGS) {
  const out = L === cfg.DEFAULT_LANG ? path.join(OUT, "index.html") : path.join(OUT, L, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(L));
  console.log("✓", path.relative(OUT, out));
}

/* sitemap: paginile de prezentare cu alternativele lor + paginile legale */
const today = new Date().toISOString().slice(0, 10);
const alts = cfg.LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l)}"/>`).join("\n");
const urls = cfg.LANGS.map(l => `  <url><loc>${pageUrl(l)}</loc><lastmod>${today}</lastmod><priority>${l === cfg.DEFAULT_LANG ? "1.0" : "0.9"}</priority>\n${alts}\n  </url>`);
for (const [p, pr] of [["/app/", "0.8"], ["/privacy.html", "0.3"], ["/termeni.html", "0.3"], ["/rambursare.html", "0.3"]])
  urls.push(`  <url><loc>${cfg.SITE_URL}${p}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`);
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`);
console.log("✓ sitemap.xml");
