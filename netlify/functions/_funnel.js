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

export const EVENTS = ["open", "pw_shown", "pw_buy", "pro_on", "rv_ask"];
export const WHY = ["projects", "pdf", "lab", "jpg", "doc", "offer", "client", "part", "nest", "export", "room", "plain"];
export const PLAT = ["play", "web"];
export const PLAN = ["monthly", "yearly", "founders"];
export const KIND = ["play", "stripe"];
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
  if (ev.e === "pw_shown" || ev.e === "pw_buy" || ev.e === "pro_on") rec.why = has(WHY, ev.why) ? ev.why : "plain";
  if ((ev.e === "pw_buy" || ev.e === "pro_on") && has(PLAN, ev.plan)) rec.plan = ev.plan;
  if (ev.e === "pro_on" && has(KIND, ev.kind)) rec.kind = ev.kind;
  return rec;
}

export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/* d/<zi>/<eveniment>/<plat>/<motiv|->/<plan|kind|->/<sesiune>.<rand> */
export function keyOf(rec, now, rand) {
  const extra = rec.plan || rec.kind || "-";
  return ["d", dayOf(now), rec.e, rec.plat, rec.why || "-", extra, rec.s + "." + rand].join("/");
}

export function parseKey(key) {
  const p = String(key || "").split("/");
  if (p.length !== 7 || p[0] !== "d" || !DAY.test(p[1]) || !has(EVENTS, p[2])) return null;
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
  const out = { total: recs.length, platforms: {}, byWhy: {} };
  const sess = {};
  const plat = (p) => (out.platforms[p] = out.platforms[p] || { events: {}, sessions: {} });
  for (const r of recs) {
    const P = plat(r.plat);
    P.events[r.e] = (P.events[r.e] || 0) + 1;
    const k = r.plat + "|" + r.e;
    (sess[k] = sess[k] || new Set()).add(r.s);
    if (r.why) {
      const W = (out.byWhy[r.why] = out.byWhy[r.why] || {});
      W[r.e] = (W[r.e] || 0) + 1;
    }
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
      pro_per_open_sessions_pct: pct(ev.pro_on || 0, ss.open || 0)
    };
  }
  for (const w of Object.keys(out.byWhy)) {
    const W = out.byWhy[w];
    W.buy_per_shown_pct = pct(W.pw_buy || 0, W.pw_shown || 0);
    W.pro_per_shown_pct = pct(W.pro_on || 0, W.pw_shown || 0);
  }
  return out;
}
