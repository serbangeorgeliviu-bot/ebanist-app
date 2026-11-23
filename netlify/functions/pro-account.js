/* =====================================================================
   Ebanist Pro pe web — Pro legat de cont (D-185)
   ---------------------------------------------------------------------
     POST /api/pro-account  { token: "<access token Supabase>" }

   Cine se autentifică în aplicație cu e-mail și parolă nu mai are de
   copiat codul `sub_…` pe fiecare dispozitiv: aplicația trimite aici
   jetonul sesiunii, funcția află de la Supabase CINE este (adresa
   contului) și caută la Stripe abonamentele ACTIVE ale lui Ebanist Pro
   plătite cu aceeași adresă (aceeași căutare ca „Primește codul pe
   e-mail”, `codesFor`). Răspuns: { ok:true, codes:[…] } — lista poate fi
   goală. Aplicația reverifică fiecare cod prin /api/pro, ca la un cod
   lipit de mână, deci forma licenței e aceeași.

   Reguli care nu se văd din semnături:

   — Numai adresa CONFIRMATĂ a contului. Fără confirmare, oricine ar
     putea crea un cont cu adresa altuia și ar primi codul lui. Un cont
     neconfirmat primește { ok:false, error:"unconfirmed" }.
   — Adresa nu vine niciodată din cerere, ci de la Supabase, din jeton.
   — Nu există tabel nou și nu se păstrează nimic: abonamentul rămâne la
     Stripe; contul doar îl găsește după adresă. Dacă adresa contului e
     alta decât cea a plății, nu se găsește nimic și rămâne codul lipit.
   — Limită: 6 cereri pe oră pe cont (Netlify Blobs, ca /api/pro-restore).
   — Cheia Stripe: aceeași STRIPE_SECRET_KEY (citire pe Customers,
     Subscriptions, Checkout Sessions). URL-ul și cheia publică Supabase
     pot veni din SUPABASE_URL / SUPABASE_ANON_KEY; fără ele se folosesc
     cele din index.html (publice, oricum în pagină).
   ===================================================================== */

import { codesFor, allow } from "./pro-restore.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex"
};
const reply = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: JSON_HEADERS });

const SB_URL = "https://drefnfezicawljkfsqsm.supabase.co";
const SB_ANON = "sb_publishable_3dDu3Pbva2V6ypxVF1yRfg_aOtyl4PM";
const JWT = /^[A-Za-z0-9_-]{10,4000}\.[A-Za-z0-9_-]{10,4000}\.[A-Za-z0-9_-]{5,4000}$/;
const PER_USER = 6;

/* Utilizatorul jetonului, așa cum îl vede Supabase (verifică semnătura
   și expirarea). null = jeton respins. Aruncă dacă Supabase nu răspunde. */
async function whoIs(token) {
  const base = process.env.SUPABASE_URL || SB_URL;
  const anon = process.env.SUPABASE_ANON_KEY || SB_ANON;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(base + "/auth/v1/user", {
      headers: { apikey: anon, Authorization: "Bearer " + token },
      signal: ctl.signal
    });
    if (r.status === 401 || r.status === 403) return null;
    if (r.status !== 200) throw new Error("supabase-" + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

export default async (req) => {
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);
  let body;
  try { body = await req.json(); } catch (e) { return reply({ ok: false, error: "bad-json" }, 400); }
  const token = String((body && body.token) || "");
  if (!JWT.test(token)) return reply({ ok: false, error: "bad-token" }, 400);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return reply({ ok: false, error: "not-configured" }, 503);

  let user;
  try { user = await whoIs(token); }
  catch (e) { return reply({ ok: false, error: "unreachable" }, 504); }
  if (!user || !user.id) return reply({ ok: false, error: "bad-token" }, 401);

  const email = String(user.email || "").trim();
  if (!email) return reply({ ok: false, error: "no-email" }, 400);
  if (!(user.email_confirmed_at || user.confirmed_at)) return reply({ ok: false, error: "unconfirmed" }, 403);

  if (!(await allow("a", String(user.id), PER_USER))) return reply({ ok: false, error: "rate" }, 429);

  try {
    return reply({ ok: true, codes: await codesFor(email, key) });
  } catch (e) {
    return reply({ ok: false, error: "unreachable" }, 504);
  }
};

export const config = { path: "/api/pro-account" };
