/* =====================================================================
   Ebanist Pro pe web — verificarea abonamentului Stripe (D-58)
   ---------------------------------------------------------------------
     POST /api/pro  { session: "cs_…" }   după plată: sesiunea de checkout
     POST /api/pro  { sub: "sub_…" }      reverificare / alt dispozitiv
     POST /api/pro  { ebp: "EBP-…" }      cheie istorică, la activare

   Răspuns: { ok:true, sub, status, periodEnd, plan, email? }
            { ok:false, error }   cu 4xx când Stripe a răspuns „nu”,
                                  cu 5xx când nu s-a putut întreba.

   Plata trece prin Stripe Managed Payments (Stripe e merchant of
   record); aici doar se CITEȘTE ce s-a plătit. Cheia stă numai în
   variabila de mediu STRIPE_SECRET_KEY din Netlify — de preferat o cheie
   restricționată, cu drept de citire pe Checkout Sessions și
   Subscriptions, nimic altceva. Nu scrie nimic, nu păstrează nimic.

   Codul de activare al clientului e ID-ul abonamentului (`sub_…`): nu se
   ghicește (24 de caractere aleatoare) și nu dă acces la nimic altceva
   decât la răspunsul „e activ / nu e activ” de aici.

   Cheile istorice EBP-XXXX-XXXX-XXXX: checksum-ul lor stă în JS-ul public,
   deci oricine poate face una care trece de el. O cheie NOUĂ se activează
   numai dacă e în lista EBP_KEYS din Netlify (cheile emise, separate prin
   virgulă sau spațiu). Fără variabilă nu se activează niciuna. Cheile deja
   activate pe un dispozitiv nu trec pe aici și rămân valabile.
   ===================================================================== */

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const reply = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: JSON_HEADERS });

/* Numai prețurile lui Ebanist Pro deblochează Ebanist: pe același cont
   Stripe pot apărea mâine și alte produse (Plaquist, Voltist). Cheia de
   căutare (lookup key) e pusă pe preț în cruscotto. */
const PLANS = { ebanist_pro_monthly: "monthly", ebanist_pro_yearly: "yearly" };

const SESSION = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
const SUB = /^sub_[A-Za-z0-9]{8,64}$/;
const EBP = /^EBP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

/* Aceeași normalizare ca în app/ebanist-license.js: majuscule, trattini
   la locul lor, fie că cheia vine din aplicație, fie din lista din Netlify. */
function ebpNorm(raw) {
  let s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.indexOf("EBP") === 0) s = s.slice(3);
  if (s.length !== 12) return "";
  return "EBP-" + s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12);
}
function ebpIssued(key) {
  const list = String(process.env.EBP_KEYS || "").split(/[\s,;]+/).map(ebpNorm).filter(Boolean);
  return list.includes(key);
}

async function stripe(path, key) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch("https://api.stripe.com/v1/" + path, {
      headers: { Authorization: "Bearer " + key },
      signal: ctl.signal
    });
    const j = await r.json().catch(() => null);
    return { status: r.status, body: j };
  } finally {
    clearTimeout(timer);
  }
}

/* Din aprilie 2025 (API „basil”) sfârșitul perioadei stă pe fiecare
   element al abonamentului, nu pe abonament. Se citesc amândouă locurile,
   ca funcția să nu depindă de versiunea API a contului. */
function periodEnd(sub) {
  const items = (sub.items && sub.items.data) || [];
  const ends = items.map(i => i.current_period_end).filter(n => typeof n === "number");
  if (typeof sub.current_period_end === "number") ends.push(sub.current_period_end);
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

function planOf(sub) {
  const items = (sub.items && sub.items.data) || [];
  for (const i of items) {
    const lk = i.price && i.price.lookup_key;
    if (lk && PLANS[lk]) return PLANS[lk];
  }
  return null;
}

/* Stările Stripe, reduse la cele trei pe care le înțelege aplicația.
   `past_due`: plata de reînnoire a eșuat și Stripe o reîncearcă — clientul
   rămâne Pro cât timp Stripe încă încearcă. */
function statusOf(sub) {
  switch (sub.status) {
    case "active":
    case "trialing":
    case "past_due":
      return "active";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    default:                       // incomplete, paused
      return "inactive";
  }
}

function shape(sub, email) {
  const out = { ok: true, sub: sub.id, status: statusOf(sub), periodEnd: periodEnd(sub), plan: planOf(sub) };
  if (email) out.email = email;
  return out;
}

export default async (req) => {
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);

  let body;
  try { body = await req.json(); } catch (e) { return reply({ ok: false, error: "bad-json" }, 400); }

  /* Cheia istorică nu are nevoie de Stripe. */
  if (body && body.ebp != null) {
    const k = ebpNorm(body.ebp);
    if (!EBP.test(k)) return reply({ ok: false, error: "bad-ebp" }, 400);
    return ebpIssued(k) ? reply({ ok: true, ebp: k }) : reply({ ok: false, error: "unknown-key" }, 403);
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return reply({ ok: false, error: "not-configured" }, 503);
  const session = String((body && body.session) || "");
  const subId = String((body && body.sub) || "");

  try {
    let sub, email = "";
    if (session) {
      if (!SESSION.test(session)) return reply({ ok: false, error: "bad-session" }, 400);
      const s = await stripe("checkout/sessions/" + encodeURIComponent(session) + "?expand[]=subscription", key);
      if (s.status === 404) return reply({ ok: false, error: "not-found" }, 404);
      if (s.status !== 200 || !s.body) return reply({ ok: false, error: "stripe-" + s.status }, 502);
      if (s.body.status !== "complete") return reply({ ok: false, error: "not-paid" }, 402);
      sub = s.body.subscription;
      if (!sub || typeof sub !== "object") return reply({ ok: false, error: "no-subscription" }, 400);
      email = (s.body.customer_details && s.body.customer_details.email) || "";
    } else if (subId) {
      if (!SUB.test(subId)) return reply({ ok: false, error: "bad-sub" }, 400);
      const s = await stripe("subscriptions/" + encodeURIComponent(subId), key);
      if (s.status === 404) return reply({ ok: false, error: "not-found" }, 404);
      if (s.status !== 200 || !s.body) return reply({ ok: false, error: "stripe-" + s.status }, 502);
      sub = s.body;
    } else {
      return reply({ ok: false, error: "missing" }, 400);
    }

    if (!planOf(sub)) return reply({ ok: false, error: "wrong-product" }, 403);
    return reply(shape(sub, email));
  } catch (e) {
    return reply({ ok: false, error: "unreachable" }, 504);
  }
};

export const config = { path: "/api/pro" };
