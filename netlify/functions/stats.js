/* =====================================================================
   Ebanist Order Rail — evenimente și cifre
   ---------------------------------------------------------------------
     POST /api/stats                    depune un eveniment
     GET  /api/stats?atelier=<slug>     cifrele atelierului

   Cinci evenimente, atât: session_start, first_pdf_time, order_started,
   order_sent, order_confirmed.

   Ce NU se scrie niciodată aici: IP, user agent, id de dispozitiv, nume,
   telefon. Singurul lucru care leagă două evenimente e un id de sesiune
   aleator care trăiește cât ține fila deschisă — destul cât să iasă rata
   de abandon, prea puțin cât să urmărească pe cineva. Fără asta ar
   trebui banner de cookie-uri, adică primul lucru pe care l-ar vedea un
   client necunoscut ar fi o casetă de închis.
   ===================================================================== */

import { getStore } from "@netlify/blobs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const ok = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: JSON_HEADERS });
const bad = (m, s = 400) => ok({ error: m }, s);

const SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const EVENTS = ["session_start", "first_pdf_time", "order_started", "order_sent", "order_confirmed"];

function mediana(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export default async (req) => {
  const url = new URL(req.url);
  let st;
  try { st = getStore({ name: "ebanist-events", consistency: "eventual" }); }
  catch (e) { return bad("blobs-unavailable", 503); }

  try {
    if (req.method === "POST") {
      let ev;
      try { ev = await req.json(); } catch (e) { return bad("bad-json"); }
      if (!ev || EVENTS.indexOf(ev.e) < 0) return bad("bad-event");
      if (!ev.a || !SLUG.test(ev.a)) return bad("bad-slug");
      const rec = {
        e: ev.e,
        a: ev.a,
        /* Sesiunea se taie la 12 caractere și nu se combină cu nimic
           altceva: nu vrem să devină un identificator persistent nici
           din greșeală. */
        s: String(ev.s || "").slice(0, 12).replace(/[^a-z0-9]/gi, ""),
        t: Date.now(),
        ms: typeof ev.ms === "number" && ev.ms >= 0 && ev.ms < 864e5 ? Math.round(ev.ms) : undefined
      };
      const key = ev.a + "/" + rec.t + "-" + Math.random().toString(36).slice(2, 8);
      await st.setJSON(key, rec);
      return ok({ ok: true });
    }

    if (req.method === "GET") {
      const slug = url.searchParams.get("atelier");
      if (!slug || !SLUG.test(slug)) return bad("bad-slug");
      const list = await st.list({ prefix: slug + "/" });
      const evs = [];
      for (const b of (list.blobs || [])) {
        const r = await st.get(b.key, { type: "json" });
        if (r) evs.push(r);
      }
      const count = {};
      for (const e of EVENTS) count[e] = 0;
      const pdfTimes = [], sessions = new Set(), sentSessions = new Set();
      for (const e of evs) {
        if (count[e.e] != null) count[e.e]++;
        if (e.e === "session_start" && e.s) sessions.add(e.s);
        if (e.e === "order_sent" && e.s) sentSessions.add(e.s);
        if (e.e === "first_pdf_time" && typeof e.ms === "number") pdfTimes.push(e.ms);
      }
      const nS = sessions.size, nSent = sentSessions.size;
      return ok({
        atelier: slug,
        events: count,
        sessions: nS,
        orders_sent: count.order_sent,
        orders_confirmed: count.order_confirmed,
        /* Timpul median până la primul PDF: cifra care spune dacă
           „sub 10 minute" e adevărat sau doar scris în plan. Median, nu
           medie — o singură sesiune lăsată deschisă peste noapte ar
           strica media și n-ar spune nimic despre nimeni. */
        first_pdf_median_s: pdfTimes.length ? Math.round(mediana(pdfTimes) / 1000) : null,
        first_pdf_samples: pdfTimes.length,
        /* Abandon: sesiuni care au început și n-au trimis nimic. */
        abandon_rate: nS ? Math.round((1 - nSent / nS) * 100) : null
      });
    }
    return bad("method", 405);
  } catch (e) {
    return bad(String((e && e.message) || e), 500);
  }
};

export const config = { path: "/api/stats" };
