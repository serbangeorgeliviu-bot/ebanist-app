/* =====================================================================
   Ebanist — pâlnia de conversie
   ---------------------------------------------------------------------
     POST /api/funnel                      depune un eveniment (anonim)
     GET  /api/funnel?days=30&key=<cheie>  rezumatul, numai cu FUNNEL_KEY

   Ce se păstrează și ce nu: vezi _funnel.js. Fără IP, fără user agent,
   fără id de dispozitiv. GET e închis: dacă variabila FUNNEL_KEY nu e
   pusă în Netlify, rezumatul nu există (404), nu e public.
   ===================================================================== */

import { timingSafeEqual } from "node:crypto";
import { clean, keyOf, lastDays, summarize, MAX_BODY } from "./_funnel.js";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex"
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: HEADERS });

function sameKey(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/* `st` = un depozit cu set() și list() (Netlify Blobs în producție, unul
   de memorie în test). `env` și `now` vin de afară pentru aceeași ragiune. */
export async function handle(req, st, env, now) {
  if (req.method === "POST") {
    let text;
    try { text = await req.text(); } catch (e) { return json({ error: "bad-body" }, 400); }
    if (text.length > MAX_BODY) return json({ error: "too-big" }, 413);
    let ev;
    try { ev = JSON.parse(text); } catch (e) { return json({ error: "bad-json" }, 400); }
    const rec = clean(ev);
    if (!rec) return json({ error: "bad-event" }, 400);
    await st.set(keyOf(rec, now, Math.random().toString(36).slice(2, 8)), "1");
    return json({ ok: true });
  }

  if (req.method === "GET") {
    const want = env.FUNNEL_KEY;
    if (!want) return json({ error: "not-found" }, 404);
    const url = new URL(req.url);
    const given = req.headers.get("x-funnel-key") || url.searchParams.get("key");
    if (!sameKey(given, want)) return json({ error: "forbidden" }, 403);
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
    const keys = [];
    for (const d of lastDays(days, now)) {
      const list = await st.list({ prefix: "d/" + d + "/" });
      for (const b of (list.blobs || [])) keys.push(b.key);
    }
    return json(Object.assign({ days }, summarize(keys)));
  }

  return json({ error: "method" }, 405);
}

export default async (req) => {
  let st;
  try {
    const { getStore } = await import("@netlify/blobs");
    st = getStore({ name: "ebanist-funnel", consistency: "eventual" });
  } catch (e) { return json({ error: "blobs-unavailable" }, 503); }
  try { return await handle(req, st, process.env, Date.now()); }
  catch (e) { return json({ error: String((e && e.message) || e) }, 500); }
};

export const config = { path: "/api/funnel" };
