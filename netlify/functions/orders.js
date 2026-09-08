/* =====================================================================
   Ebanist Order Rail — comenzile
   ---------------------------------------------------------------------
     POST /api/orders                   depune o comandă
     GET  /api/orders?atelier=<slug>    lista, cu PIN în header
     GET  /api/orders/<id>              o comandă (publică: linkul E cheia)
     POST /api/orders/<id>/confirm      confirmă și îngheață, cu PIN
     POST /api/orders/<id>/status       schimbă starea, cu PIN

   Fără chei externe, fără serviciu plătit: Netlify Blobs, care e în free
   tier și e deja dependență în `package.json` pentru funcția AR.

   Ce e important și nu se vede din semnături:

   — O comandă CONFIRMATĂ e imutabilă. Refuzul e aici, în funcție, nu
     doar ascuns în interfață: în atelier o comandă confirmată poate fi
     deja tăiată, iar suprascrierea ei e felul în care se taie de două
     ori aceeași placă. Modificarea creează v2, cu `parent` spre v1.

   — PIN-ul din `/ateliers/<slug>.json` e PUBLIC — fișierul se poate citi
     de oricine. Deci secretul adevărat e variabila de mediu
     `INBOX_PIN_<SLUG>`. Când lipsește, se acceptă PIN-ul public și se
     spune în răspuns că inbox-ul e nesecurizat: așa se poate proba tot
     fluxul azi, iar ziua în care se pun variabilele nu cere cod nou.
     Vezi DECISIONS.md §5.3.
   ===================================================================== */

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const ok = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const bad = (msg, status = 400, extra) =>
  ok(Object.assign({ error: msg }, extra || {}), status);

/* Un slug intră într-o cheie de magazie. Orice altceva decât litere mici,
   cifre și liniuță se refuză — nu se „curăță", se refuză: o cheie
   curățată în tăcere ar scrie comanda în alt atelier. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const ORDER_ID = /^[0-9]{6}-[2-9A-HJ-NP-Z]{4}(-v[0-9]{1,3})?$/;

function store() {
  /* `getStore` aruncă dacă nu rulează în contextul Netlify (dezvoltare
     locală fără `netlify dev`). Nu e o eroare de programare — e cazul
     normal pe laptop, și clientul are un fallback pentru el. */
  return getStore({ name: "ebanist-orders", consistency: "strong" });
}

async function atelierCfg(slug, origin) {
  try {
    const r = await fetch(new URL("/ateliers/" + slug + ".json", origin));
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

/* Comparație în timp constant: un PIN de patru cifre se ghicește oricum
   prin încercări, dar nu trebuie să se ghicească din durata răspunsului. */
function pinMatches(given, expected) {
  const a = Buffer.from(String(given || ""), "utf8");
  const b = Buffer.from(String(expected || ""), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function envPinHash(slug) {
  const key = "INBOX_PIN_" + slug.toUpperCase().replace(/-/g, "_");
  return process.env[key] || null;
}

async function checkPin(slug, given, cfg) {
  const hash = envPinHash(slug);
  if (hash) {
    const h = crypto.createHash("sha256").update("ebanist-inbox|" + slug + "|" + String(given || "")).digest("hex");
    return { ok: pinMatches(h, hash), insecure: false };
  }
  /* Nicio variabilă de mediu: mod nesecurizat, declarat. */
  const pub = cfg && cfg.pin;
  if (!pub) return { ok: false, insecure: true };
  return { ok: pinMatches(String(given || ""), String(pub)), insecure: true };
}

export default async (req, context) => {
  const url = new URL(req.url);
  const origin = url.origin;
  /* Calea ajunge fie ca /api/orders/..., fie ca /.netlify/functions/orders/...
     după rescriere. Se normalizează ca funcția să nu depindă de care. */
  const path = url.pathname
    .replace(/^\/\.netlify\/functions\/orders/, "")
    .replace(/^\/api\/orders/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = path ? path.split("/") : [];

  let st;
  try { st = store(); }
  catch (e) {
    /* Fără Blobs nu se poate face nimic — dar se spune LIMPEDE, ca
       aplicația să treacă pe fallback-ul local în loc să pară că a
       trimis comanda. */
    return bad("blobs-unavailable", 503, { fallback: true });
  }

  try {
    /* ---------- POST /api/orders : depunere ---------- */
    if (req.method === "POST" && parts.length === 0) {
      let body;
      try { body = await req.json(); } catch (e) { return bad("bad-json"); }
      const o = body && body.order;
      if (!o || !o.id || !o.atelier) return bad("missing-order");
      if (!SLUG.test(o.atelier)) return bad("bad-slug");
      if (!ORDER_ID.test(o.id)) return bad("bad-id");
      if (!o.customer || !o.customer.name || !o.customer.phone) return bad("missing-customer");

      /* Id-ul se generează în client, deci poate să se ciocnească — rar,
         dar o comandă suprascrisă de alta e cel mai urât mod de a pierde
         una. Se refuză, iar clientul reîncearcă cu alt id. */
      const key = o.atelier + "/" + o.id;
      const existing = await st.get(key, { type: "json" });
      if (existing) return bad("id-exists", 409);

      const rec = {
        order: o,
        lab: body.lab || null,
        snapshot: body.snapshot || null,
        docs: body.docs || {},
        received_at: new Date().toISOString(),
        status: "received",
        history: [{ at: new Date().toISOString(), status: "received" }]
      };
      await st.setJSON(key, rec);
      return ok({ id: o.id, status: "received",
                  url: origin + "/a/" + o.atelier + "/order/" + o.id });
    }

    /* ---------- GET /api/orders?atelier=slug : inbox ---------- */
    if (req.method === "GET" && parts.length === 0) {
      const slug = url.searchParams.get("atelier");
      if (!slug || !SLUG.test(slug)) return bad("bad-slug");
      const cfg = await atelierCfg(slug, origin);
      const given = req.headers.get("x-inbox-pin") || url.searchParams.get("pin");
      const chk = await checkPin(slug, given, cfg);
      if (!chk.ok) return bad("bad-pin", 401, { insecure: chk.insecure });

      const list = await st.list({ prefix: slug + "/" });
      const out = [];
      for (const b of (list.blobs || [])) {
        const rec = await st.get(b.key, { type: "json" });
        if (!rec || !rec.order) continue;
        /* Lista NU întoarce documentele și nici snapshot-ul: sunt sute de
           kilobytes fiecare, iar inbox-ul are nevoie doar de antet. */
        out.push({
          id: rec.order.id, version: rec.order.version || 1, parent: rec.order.parent || null,
          customer: rec.order.customer, created_at: rec.order.created_at,
          received_at: rec.received_at, status: rec.status,
          confirmed_at: rec.confirmed_at || null, hash: rec.order.hash,
          pieces: rec.order.pieces, modules: rec.order.modules,
          price: rec.order.price ? { total: rec.order.price.total, currency: rec.order.price.currency } : null
        });
      }
      out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return ok({ atelier: slug, count: out.length, insecure: chk.insecure, orders: out });
    }

    /* ---------- GET /api/orders/<id> : o comandă ----------
       Publică pe id: linkul E cheia, și e linkul pe care clientul îl
       primește pe WhatsApp. Id-ul are patru simboli aleatori — destul
       cât să nu se nimerească, nu un secret criptografic. */
    if (req.method === "GET" && parts.length >= 1) {
      const id = parts[0];
      if (!ORDER_ID.test(id)) return bad("bad-id");
      const slug = url.searchParams.get("atelier");
      if (!slug || !SLUG.test(slug)) return bad("bad-slug");
      const rec = await st.get(slug + "/" + id, { type: "json" });
      if (!rec) return bad("not-found", 404);
      return ok(rec);
    }

    /* ---------- POST /api/orders/<id>/confirm | /status ---------- */
    if (req.method === "POST" && parts.length === 2) {
      const [id, action] = parts;
      if (!ORDER_ID.test(id)) return bad("bad-id");
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const slug = body.atelier || url.searchParams.get("atelier");
      if (!slug || !SLUG.test(slug)) return bad("bad-slug");
      const cfg = await atelierCfg(slug, origin);
      const chk = await checkPin(slug, req.headers.get("x-inbox-pin") || body.pin, cfg);
      if (!chk.ok) return bad("bad-pin", 401, { insecure: chk.insecure });

      const key = slug + "/" + id;
      const rec = await st.get(key, { type: "json" });
      if (!rec) return bad("not-found", 404);

      if (action === "confirm") {
        if (rec.confirmed_at) return ok({ id, status: rec.status, confirmed_at: rec.confirmed_at, already: true });
        rec.confirmed_at = new Date().toISOString();
        rec.status = "confirmed";
        rec.frozen_hash = rec.order.hash;
        rec.history = (rec.history || []).concat([{ at: rec.confirmed_at, status: "confirmed" }]);
        await st.setJSON(key, rec);
        return ok({ id, status: rec.status, confirmed_at: rec.confirmed_at, frozen_hash: rec.frozen_hash });
      }

      if (action === "status") {
        const ALLOWED = ["received", "confirmed", "cut", "collected"];
        const next = String(body.status || "");
        if (ALLOWED.indexOf(next) < 0) return bad("bad-status");
        /* O comandă confirmată nu se mai poate întoarce la „primită":
           starea merge într-o singură direcție, altfel „confirmat"
           nu mai înseamnă nimic. */
        if (rec.confirmed_at && ALLOWED.indexOf(next) < ALLOWED.indexOf("confirmed"))
          return bad("frozen", 409);
        rec.status = next;
        rec.history = (rec.history || []).concat([{ at: new Date().toISOString(), status: next }]);
        await st.setJSON(key, rec);
        return ok({ id, status: rec.status });
      }
      return bad("unknown-action", 404);
    }

    return bad("not-found", 404);
  } catch (e) {
    return bad(String((e && e.message) || e), 500);
  }
};

export const config = { path: ["/api/orders", "/api/orders/*"] };
