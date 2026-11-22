/* =====================================================================
   Ebanist — pâlnia de conversie, partea pură (fără import, ca să se poată
   PROBA; funcția adevărată, funnel.js, aduce @netlify/blobs).

   Oglinda serverului pentru app/ebanist-funnel.js: aceleași liste închise.
   Testul funnel.test.js verifică că cele două nu se despart.

   Nimic nu se scrie în CORPUL înregistrării: tot ce se știe despre un
   eveniment stă în CHEIE — zi/eveniment/platformă/motiv/plan/sesiune —,
   așa că rezumatul se face numai din `list()`, fără o citire pe eveniment.
   Sesiunea e un id aleator de 8 caractere, născut la deschiderea
   aplicației; nu se combină cu nimic altceva.
   ===================================================================== */

export const EVENTS = ["open", "pw_shown", "pw_buy", "pro_on", "rv_ask", "pw_unavail", "pw_fail", "hw_use", "doc_sample"];
export const WHY = ["projects", "pdf", "lab", "jpg", "doc", "offer", "client", "part", "nest", "export", "room", "plain"];
export const PLAT = ["play", "web"];
export const PLAN = ["monthly", "yearly", "founders"];
export const KIND = ["play", "stripe"];
export const CODE = ["unavailable", "error", "empty"];
export const FAILCODE = ["canceled", "error", "unavailable"];     // pw_fail (D-179)
export const RC = ["m3", "m2", "m1", "1", "2", "3", "4", "5", "6", "7", "8", "12"];   // codul numeric Play (m = minus)
export const BRAND = ["blum", "hafele", "hettich", "lamello", "festool", "grass", "salice", "wurth", "emuca", "fav", "other"];   // hw_use (D-170)
const SLUG = /^[a-z0-9_]{2,40}$/;
export const MAX_BODY = 400;                 // un eveniment are sub 120 de octeți

const has = (list, v) => list.indexOf(v) >= 0;
const SID = /^[a-z0-9]{1,12}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/* Eveniment primit → înregistrare curată, sau null. Orice câmp din afara
   listei se aruncă, nu se „repară". */
export function clean(ev) {
  if (!ev || typeof ev !== "object" || !has(EVENTS, ev.e)) return null;
  const s = String(ev.s || "").toLowerCase();
  if (!SID.test(s)) return null;
  const rec = { e: ev.e, plat: has(PLAT, ev.plat) ? ev.plat : "web", s };
  if (ev.e === "pw_shown" || ev.e === "pw_buy" || ev.e === "pro_on" || ev.e === "doc_sample") rec.why = has(WHY, ev.why) ? ev.why : "plain";
  if ((ev.e === "pw_buy" || ev.e === "pro_on") && has(PLAN, ev.plan)) rec.plan = ev.plan;
  if (ev.e === "pro_on" && has(KIND, ev.kind)) rec.kind = ev.kind;
  if (ev.e === "pw_unavail") rec.code = has(CODE, ev.code) ? ev.code : "empty";
  if (ev.e === "pw_fail") rec.code = has(FAILCODE, ev.code) ? ev.code : "error";
  if ((ev.e === "pw_unavail" || ev.e === "pw_fail") && has(RC, ev.rc)) rec.rc = ev.rc;
  if (ev.e === "hw_use") {
    if (!has(BRAND, ev.brand) || typeof ev.fam !== "string" || !SLUG.test(ev.fam) || typeof ev.art !== "string" || !SLUG.test(ev.art)) return null;
    rec.brand = ev.brand; rec.fam = ev.fam; rec.art = ev.art;
  }
  return rec;
}

export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/* d/<zi>/<eveniment>/<plat>/<motiv|->/<plan|kind|->/<sesiune>.<rand> */
export function keyOf(rec, now, rand) {
  if (rec.e === "hw_use") return ["d", dayOf(now), rec.e, rec.plat, rec.brand, rec.fam + "~" + rec.art, rec.s + "." + rand].join("/");   // marca în locul motivului
  const extra = rec.plan || rec.kind || (rec.code ? rec.code + (rec.rc ? "_" + rec.rc : "") : "-");   // D-179: codul Play după „_"
  return ["d", dayOf(now), rec.e, rec.plat, rec.why || "-", extra, rec.s + "." + rand].join("/");
}

export function parseKey(key) {
  const p = String(key || "").split("/");
  if (p.length !== 7 || p[0] !== "d" || !DAY.test(p[1]) || !has(EVENTS, p[2])) return null;
  if (p[2] === "hw_use") {
    const fa = p[5].split("~");
    if (!has(BRAND, p[4]) || fa.length !== 2 || !SLUG.test(fa[0]) || !SLUG.test(fa[1])) return null;
    return { day: p[1], e: p[2], plat: p[3], why: null, extra: null, brand: p[4], fam: fa[0], art: fa[1], s: p[6].split(".")[0] };
  }
  return { day: p[1], e: p[2], plat: p[3], why: p[4] === "-" ? null : p[4], extra: p[5] === "-" ? null : p[5], s: p[6].split(".")[0] };
}

/* Zilele care intră într-un rezumat: ultimele `n`, azi inclusiv. */
export function lastDays(n, now) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(dayOf(now - i * 864e5));
  return out;
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

/* Chei → cifre. Două feluri de număr, cu motiv:
     events    — de câte ori s-a întâmplat
     sessions  — câte sesiuni distincte
   Pe web plata se face în altă filă și aplicația se redeschide la
   întoarcere (sesiune nouă), deci pro_on nu se potrivește cu pw_shown
   pe sesiune: pentru web se citesc rata pe evenimente, nu pe sesiuni. */
export function summarize(keys) {
  const recs = keys.map(parseKey).filter(Boolean);
  const out = { total: recs.length, platforms: {}, byWhy: {}, byCode: {}, byRc: {}, byFail: {}, byBrand: {} };
  const rcSess = {};
  const brandSess = {};
  const codeSess = {};
  const sess = {};
  const plat = (p) => (out.platforms[p] = out.platforms[p] || { events: {}, sessions: {} });
  for (const r of recs) {
    const P = plat(r.plat);
    P.events[r.e] = (P.events[r.e] || 0) + 1;
    if (r.e === "pw_unavail") {                    // D-133: de ce n-a avut ecranul Pro ce vinde (codul stă în cheie)
      const [cd, rc] = String(r.extra || "empty").split("_");
      const ck = r.plat + "/" + cd;
      (out.byCode[ck] = out.byCode[ck] || { events: 0, sessions: 0 }).events++;
      (codeSess[ck] = codeSess[ck] || new Set()).add(r.s);
      const rk = ck + "/" + (rc || "na");           // D-179: codul numeric Play; „na" = trimis de o versiune fără el
      (out.byRc[rk] = out.byRc[rk] || { events: 0, sessions: 0 }).events++;
      (rcSess[rk] = rcSess[rk] || new Set()).add(r.s);
    }
    if (r.e === "pw_fail") {                       // D-179: „cumpără" fără plată: renunțare / eroare / Play indisponibil + cod
      const [cd, rc] = String(r.extra || "error").split("_");
      const fk = r.plat + "/" + cd + "/" + (rc || "na");
      (out.byFail[fk] = out.byFail[fk] || { events: 0, sessions: 0 }).events++;
      (rcSess[fk] = rcSess[fk] || new Set()).add(r.s);
    }
    if (r.e === "hw_use") {                        // D-170: câte sesiuni au folosit articolul (nu de câte ori)
      const B = (out.byBrand[r.brand] = out.byBrand[r.brand] || { sessions: 0, families: {}, articles: {} });
      const F2 = (B.families[r.fam] = B.families[r.fam] || { sessions: 0 }), A = (B.articles[r.art] = B.articles[r.art] || { fam: r.fam, sessions: 0 });
      const bs = (brandSess[r.brand] = brandSess[r.brand] || { b: new Set(), f: {}, a: {} });
      bs.b.add(r.s); (bs.f[r.fam] = bs.f[r.fam] || new Set()).add(r.s); (bs.a[r.art] = bs.a[r.art] || new Set()).add(r.s);
    }
    const k = r.plat + "|" + r.e;
    (sess[k] = sess[k] || new Set()).add(r.s);
    if (r.why) {
      const W = (out.byWhy[r.why] = out.byWhy[r.why] || {});
      W[r.e] = (W[r.e] || 0) + 1;
    }
  }
  for (const k of Object.keys(codeSess)) out.byCode[k].sessions = codeSess[k].size;
  for (const k of Object.keys(rcSess)) (out.byRc[k] || out.byFail[k]).sessions = rcSess[k].size;
  for (const b of Object.keys(brandSess)) {
    out.byBrand[b].sessions = brandSess[b].b.size;
    for (const f of Object.keys(brandSess[b].f)) out.byBrand[b].families[f].sessions = brandSess[b].f[f].size;
    for (const a of Object.keys(brandSess[b].a)) out.byBrand[b].articles[a].sessions = brandSess[b].a[a].size;
  }
  for (const k of Object.keys(sess)) {
    const [p, e] = k.split("|");
    plat(p).sessions[e] = sess[k].size;
  }
  for (const p of Object.keys(out.platforms)) {
    const ev = out.platforms[p].events, ss = out.platforms[p].sessions;
    out.platforms[p].rates = {
      shown_per_open_sessions_pct: pct(ss.pw_shown || 0, ss.open || 0),
      buy_per_shown_events_pct: pct(ev.pw_buy || 0, ev.pw_shown || 0),
      pro_per_buy_events_pct: pct(ev.pro_on || 0, ev.pw_buy || 0),
      pro_per_open_sessions_pct: pct(ev.pro_on || 0, ss.open || 0),
      unavail_per_shown_sessions_pct: pct(ss.pw_unavail || 0, ss.pw_shown || 0)
    };
  }
  for (const w of Object.keys(out.byWhy)) {
    const W = out.byWhy[w];
    W.buy_per_shown_pct = pct(W.pw_buy || 0, W.pw_shown || 0);
    W.pro_per_shown_pct = pct(W.pro_on || 0, W.pw_shown || 0);
  }
  return out;
}
