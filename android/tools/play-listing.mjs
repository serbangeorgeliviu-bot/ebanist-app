/* =====================================================================
   Ebanist — pagina din Google Play, ca fișiere în repo (Android Publisher v3)
   ---------------------------------------------------------------------
   Folosit de .github/workflows/play-listing.yml. Fără dependențe; folosește
   autentificarea din play-upload.mjs (cont de serviciu, JWT, fetch).

   Sursa adevărului pentru pagină e android/store/<limbă>/:
     title.txt  short.txt  full.txt          (30 / 80 / 4000 de caractere)
     images/<tip>/*.png|jpg                  (tip = phoneScreenshots,
        sevenInchScreenshots, tenInchScreenshots, featureGraphic, icon)
   Limba e codul Play (en-US, ro, it-IT, fr-FR).

   Comenzi (PLAY_CMD):
     status    numai citire: listările, track-urile, numărul de imagini.
     listing   scrie textele (și imaginile, dacă PLAY_IMAGES=da).
     rollout   pune userFraction pe lansarea în curs de pe production
               (PLAY_FRACTION 0.01…1; 1 = completă, cere PLAY_CONFIRM=da).
     reviews   citește recenziile recente.
     subs      numai citire: abonamentele, planurile de bază, prețurile și ofertele din Play.
     reply     răspunde la o recenzie (PLAY_REVIEW_ID, PLAY_REPLY ≤ 350).

   Ce NU face: „Data safety", declarațiile de conținut, testele A/B de pagină.
   Orice scriere = o „editare" Play validată și confirmată, sau nimic.
   ===================================================================== */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { accessToken } from "./play-upload.mjs";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";
export const LIMITS = { title: 30, short: 80, full: 4000 };
export const IMAGE_TYPES = ["phoneScreenshots", "sevenInchScreenshots", "tenInchScreenshots", "featureGraphic", "icon"];
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

async function failure(what, res) {
  let body = "";
  try { body = (await res.text()).slice(0, 600); } catch (e) { /* fără corp */ }
  return new Error(what + " → HTTP " + res.status + (body ? ": " + body : ""));
}

const exists = async (p) => { try { await stat(p); return true; } catch (e) { return false; } };

/* Citește android/store și verifică lungimile; întoarce { limbă: { title, shortDescription, fullDescription, images } }. */
export async function readStore(dir) {
  const out = {};
  for (const lang of (await readdir(dir)).sort()) {
    const ld = join(dir, lang);
    if (!(await stat(ld)).isDirectory()) continue;
    const rd = async (f) => (await exists(join(ld, f))) ? (await readFile(join(ld, f), "utf8")).replace(/\r/g, "").replace(/\n+$/, "") : null;
    const title = await rd("title.txt"), short = await rd("short.txt"), full = await rd("full.txt");
    if (title === null || short === null || full === null) throw new Error(lang + ": lipsește title.txt, short.txt sau full.txt");
    if ([...title].length > LIMITS.title) throw new Error(lang + ": titlul are " + [...title].length + " > " + LIMITS.title);
    if ([...short].length > LIMITS.short) throw new Error(lang + ": descrierea scurtă are " + [...short].length + " > " + LIMITS.short);
    if ([...full].length > LIMITS.full) throw new Error(lang + ": descrierea completă are " + [...full].length + " > " + LIMITS.full);
    const images = {};
    for (const t of IMAGE_TYPES) {
      const id = join(ld, "images", t);
      if (!(await exists(id))) continue;
      const files = (await readdir(id)).filter((f) => MIME[extname(f).toLowerCase()]).sort();
      if (files.length) images[t] = files.map((f) => join(id, f));
    }
    out[lang] = { title, shortDescription: short, fullDescription: full, images };
  }
  if (!Object.keys(out).length) throw new Error("android/store nu conține nicio limbă");
  return out;
}

export function makeClient({ sa, pkg, fetchFn = fetch }) {
  const base = API + "/" + pkg;
  let tok = null;
  const hdr = async (extra = {}) => ({ Authorization: "Bearer " + (tok ||= await accessToken(sa, fetchFn)), ...extra });
  const call = async (what, url, opt = {}, raw = false) => {
    const res = await fetchFn(url, { ...opt, headers: await hdr(opt.headers) });
    if (!res.ok) throw await failure(what, res);
    if (raw) return res;
    const t = await res.text();
    return t ? JSON.parse(t) : {};
  };
  const J = { "Content-Type": "application/json" };
  return {
    base,
    open: async () => (await call("deschide editarea", base + "/edits", { method: "POST", headers: J, body: "{}" })).id,
    drop: async (id) => { try { await call("șterge editarea", base + "/edits/" + id, { method: "DELETE" }, true); } catch (e) { /* best effort */ } },
    commit: async (id) => {
      await call("validează", base + "/edits/" + id + ":validate", { method: "POST" }, true);
      await call("confirmă editarea", base + "/edits/" + id + ":commit", { method: "POST" }, true);
    },
    get: (what, path) => call(what, base + path),
    put: (what, path, body) => call(what, base + path, { method: "PUT", headers: J, body: JSON.stringify(body) }),
    post: (what, path, body) => call(what, base + path, { method: "POST", headers: J, body: JSON.stringify(body) }),
    del: (what, path) => call(what, base + path, { method: "DELETE" }, true),
    upload: (what, path, bytes, mime) => call(what, UPLOAD + "/" + pkg + path + "?uploadType=media", { method: "POST", headers: { "Content-Type": mime }, body: bytes })
  };
}

/* Numai citire. Editarea deschisă se șterge la final. */
export async function status(c) {
  const id = await c.open();
  try {
    const l = await c.get("listări", "/edits/" + id + "/listings");
    const listings = [];
    for (const it of l.listings || []) {
      const images = {};
      for (const t of IMAGE_TYPES) {
        const r = await c.get("imagini " + it.language + "/" + t, "/edits/" + id + "/listings/" + it.language + "/" + t);
        if ((r.images || []).length) images[t] = r.images.length;
      }
      listings.push({ language: it.language, title: it.title, short: it.shortDescription, fullLen: [...(it.fullDescription || "")].length, full: it.fullDescription, images });
    }
    const tr = await c.get("track-uri", "/edits/" + id + "/tracks");
    const tracks = (tr.tracks || []).map((t) => ({ track: t.track, releases: (t.releases || []).map((r) => ({ name: r.name, status: r.status, userFraction: r.userFraction, versionCodes: r.versionCodes })) }));
    let details = null;
    try { details = await c.get("detalii", "/edits/" + id + "/details"); } catch (e) { /* opțional */ }
    return { listings, tracks, details };
  } finally { await c.drop(id); }
}

/* Scrie textele (și imaginile, dacă images=true). dryRun nu confirmă nimic. */
export async function syncListing(c, store, { images = false, dryRun = false } = {}) {
  const id = await c.open();
  const done = [];
  try {
    for (const [lang, s] of Object.entries(store)) {
      await c.put("listare " + lang, "/edits/" + id + "/listings/" + lang,
        { language: lang, title: s.title, shortDescription: s.shortDescription, fullDescription: s.fullDescription });
      done.push(lang + ": texte");
      if (images) {
        for (const [type, files] of Object.entries(s.images)) {
          await c.del("șterge " + lang + "/" + type, "/edits/" + id + "/listings/" + lang + "/" + type);
          for (const f of files) {
            await c.upload("urcă " + f, "/edits/" + id + "/listings/" + lang + "/" + type, await readFile(f), MIME[extname(f).toLowerCase()]);
          }
          done.push(lang + ": " + files.length + " × " + type);
        }
      }
    }
    if (dryRun) { await c.drop(id); return { dryRun: true, done }; }
    await c.commit(id);
    return { dryRun: false, done };
  } catch (e) { await c.drop(id); throw e; }
}

export function checkRollout({ fraction, confirm }) {
  const f = Number(fraction);
  if (!(f > 0 && f <= 1)) throw new Error("PLAY_FRACTION trebuie să fie în (0, 1]: " + fraction);
  if (f === 1 && confirm !== "da") throw new Error("100% pleacă la toți utilizatorii: cere confirm=da");
  return f;
}

/* Schimbă fracția lansării în curs (inProgress) de pe production. Nu urcă niciun .aab. */
export async function setRollout(c, { fraction, confirm = "" }) {
  const f = checkRollout({ fraction, confirm });
  const id = await c.open();
  try {
    const t = await c.get("track production", "/edits/" + id + "/tracks/production");
    const rel = (t.releases || []).find((r) => r.status === "inProgress");
    if (!rel) throw new Error("production nu are nicio lansare inProgress; nimic de schimbat");
    const before = rel.userFraction;
    if (f === 1) { rel.status = "completed"; delete rel.userFraction; } else rel.userFraction = f;
    await c.put("setează fracția", "/edits/" + id + "/tracks/production", { track: "production", releases: t.releases });
    await c.commit(id);
    return { release: rel.name, before, after: f };
  } catch (e) { await c.drop(id); throw e; }
}

/* Numai citire: abonamentele din Play (monetizare). Fără token de cumpărător, fără date personale. */
export async function listSubs(c) {
  const r = await c.get("abonamente", "/subscriptions?pageSize=50");
  return (r.subscriptions || []).map((x) => ({
    productId: x.productId,
    archived: !!x.archived,
    listings: (x.listings || []).map((l) => l.languageCode + ": " + l.title),
    basePlans: (x.basePlans || []).map((b) => ({
      id: b.basePlanId, state: b.state, period: (b.autoRenewingBasePlanType || {}).billingPeriodDuration || (b.prepaidBasePlanType || {}).billingPeriodDuration || null,
      prepaid: !!b.prepaidBasePlanType, regions: (b.regionalConfigs || []).length,
      prices: (b.regionalConfigs || []).filter((g) => ["RO", "IT", "FR", "DE", "ES", "PL", "GB", "US"].includes(g.regionCode)).map((g) => g.regionCode + " " + (g.price ? (g.price.units || "0") + "." + String(Math.round((g.price.nanos || 0) / 1e7)).padStart(2, "0") + " " + g.price.currencyCode : "?")),
      offerTags: (b.offerTags || []).map((t) => t.tag)
    }))
  }));
}

export async function listOffers(c, productId, basePlanId) {
  const r = await c.get("oferte", "/subscriptions/" + productId + "/basePlans/" + basePlanId + "/offers?pageSize=50");
  return (r.subscriptionOffers || []).map((o) => ({
    id: o.offerId, state: o.state,
    phases: (o.phases || []).map((ph) => ({ duration: ph.duration, recurrences: ph.recurrenceCount, free: !!(ph.regionalConfigs || []).some((g) => g.free) })),
    targeting: o.targeting ? Object.keys(o.targeting) : []
  }));
}

export async function listReviews(c, max = 50) {
  const r = await c.get("recenzii", "/reviews?maxResults=" + max + "&translationLanguage=ro");
  return (r.reviews || []).map((x) => {
    const u = x.comments?.[0]?.userComment || {};
    const dev = x.comments?.find((k) => k.developerComment)?.developerComment;
    return { id: x.reviewId, stars: u.starRating, lang: u.reviewerLanguage, version: u.appVersionName, text: u.text, replied: !!dev };
  });
}

export async function replyReview(c, { reviewId, text }) {
  if (!reviewId) throw new Error("PLAY_REVIEW_ID lipsește");
  const t = String(text || "").trim();
  if (!t) throw new Error("PLAY_REPLY lipsește");
  if ([...t].length > 350) throw new Error("răspunsul are " + [...t].length + " > 350 de caractere");
  await c.post("răspunde", "/reviews/" + encodeURIComponent(reviewId) + ":reply", { replyText: t });
  return { reviewId };
}

async function main() {
  const e = process.env;
  const sa = JSON.parse(await readFile(e.PLAY_SA_FILE, "utf8"));
  if (!sa.client_email || !sa.private_key) throw new Error("JSON-ul contului de serviciu nu are client_email / private_key");
  const c = makeClient({ sa, pkg: e.PLAY_PACKAGE || "com.domusrenov.ebanist" });
  const dir = e.PLAY_STORE_DIR || "android/store";
  const cmd = e.PLAY_CMD || "status";
  let out;
  if (cmd === "status") out = await status(c);
  else if (cmd === "listing") out = await syncListing(c, await readStore(dir), { images: e.PLAY_IMAGES === "da", dryRun: e.PLAY_DRY === "da" });
  else if (cmd === "rollout") out = await setRollout(c, { fraction: e.PLAY_FRACTION, confirm: e.PLAY_CONFIRM || "" });
  else if (cmd === "reviews") out = await listReviews(c);
  else if (cmd === "subs") {
    const subs = await listSubs(c);
    for (const sb of subs) for (const b of sb.basePlans) { try { b.offers = await listOffers(c, sb.productId, b.id); } catch (e) { b.offers = "eroare: " + e.message.slice(0, 160); } }
    out = subs;
  }
  else if (cmd === "reply") out = await replyReview(c, { reviewId: e.PLAY_REVIEW_ID, text: e.PLAY_REPLY });
  else throw new Error("comandă necunoscută: " + cmd);
  console.log(JSON.stringify(out, null, 2));
}

if (import.meta.url === "file://" + process.argv[1]) {
  main().catch((err) => { console.error("::error::" + err.message); process.exit(1); });
}
