/* =====================================================================
   Ebanist Pro pe web — „Primește codul pe email” (ROADMAP U.14)
   ---------------------------------------------------------------------
     POST /api/pro-restore  { email, lang? }

   Cine a plătit, dar redirectul de după plată s-a pierdut (plată prin
   Link în alt browser, pagină închisă), nu are cum afla codul `sub_…`:
   chitanța Stripe nu-l conține. Aici clientul scrie emailul plății, iar
   codul pleacă NUMAI pe acea adresă.

   Reguli care nu se văd din semnături:

   — Răspunsul e același, există sau nu o plată pe adresa respectivă
     ({ok:true}). Altfel funcția ar spune oricui „adresa X e client”.
     Codul nu apare niciodată în răspuns, doar în emailul trimis la
     adresa tastată: cine nu are acces la căsuță nu primește nimic.
   — Limită: 3 cereri pe oră pe adresă, 10 pe oră pe IP (Netlify Blobs,
     ca Order Rail). Dacă magazia nu răspunde, cererea trece: o plată
     reală nu se refuză din cauza unei limite.
   — Se trimit numai abonamentele ACTIVE ale lui Ebanist Pro (lookup key
     din pro.js) și plățile unice Founders nerambursate. Un abonament
     scurs nu primește cod: nu ar activa nimic.
   — Cheie Stripe: aceeași STRIPE_SECRET_KEY ca la /api/pro; cheia
     restricționată are nevoie și de „Read” pe Customers.
   — Email: Resend (REST, fără dependență). Variabile în Netlify:
     RESEND_API_KEY și PRO_MAIL_FROM (ex. „Ebanist <pro@ebanist.com>”,
     domeniul verificat în Resend). Fără ele: 503 not-configured.
   ===================================================================== */

import { createHash } from "node:crypto";
import { stripe, planOf, statusOf, lifetimePlan } from "./pro.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex"
};
const reply = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: JSON_HEADERS });

const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,255}\.[A-Za-z]{2,24}$/;
const LANGS = ["it", "ro", "en", "fr", "de", "es", "pl"];
const PER_EMAIL = 3, PER_IP = 10;

const MAIL = {
  it: { subject: "Il tuo codice Ebanist Pro",
    body: c => `Ciao,\n\necco il codice per attivare Ebanist Pro su questo dispositivo:\n\n${c.join("\n")}\n\nCome si usa: apri Ebanist → Impostazioni → Abbonamento, incolla il codice (copia e incolla: maiuscole e minuscole contano) e tocca «Attiva».\n\nNon hai chiesto tu il codice? Ignora questo messaggio: senza accesso a questa casella nessuno può usarlo.\n\nEbanist · Domus Renov` },
  ro: { subject: "Codul tău Ebanist Pro",
    body: c => `Salut,\n\niată codul pentru activarea Ebanist Pro pe acest dispozitiv:\n\n${c.join("\n")}\n\nCum se folosește: deschide Ebanist → Setări → Abonament, lipește codul (copiază și lipește: contează literele mari și mici) și apasă „Activează”.\n\nNu ai cerut tu codul? Ignoră mesajul: fără acces la această căsuță nimeni nu-l poate folosi.\n\nEbanist · Domus Renov` },
  en: { subject: "Your Ebanist Pro code",
    body: c => `Hi,\n\nhere is the code to activate Ebanist Pro on this device:\n\n${c.join("\n")}\n\nHow to use it: open Ebanist → Settings → Subscription, paste the code (copy and paste it: upper and lower case matter) and tap “Activate”.\n\nDidn't ask for it? Ignore this message: nobody without access to this inbox can use it.\n\nEbanist · Domus Renov` },
  fr: { subject: "Votre code Ebanist Pro",
    body: c => `Bonjour,\n\nvoici le code pour activer Ebanist Pro sur cet appareil :\n\n${c.join("\n")}\n\nComment l'utiliser : ouvrez Ebanist → Réglages → Abonnement, collez le code (copier-coller : majuscules et minuscules comptent) et touchez « Activer ».\n\nVous n'avez rien demandé ? Ignorez ce message : sans accès à cette boîte, personne ne peut l'utiliser.\n\nEbanist · Domus Renov` },
  de: { subject: "Ihr Ebanist-Pro-Code",
    body: c => `Hallo,\n\nhier ist der Code, um Ebanist Pro auf diesem Gerät zu aktivieren:\n\n${c.join("\n")}\n\nSo geht's: Ebanist öffnen → Einstellungen → Abonnement, den Code einfügen (kopieren und einfügen: Groß- und Kleinschreibung zählt) und „Aktivieren“ tippen.\n\nNicht angefordert? Ignorieren Sie diese Nachricht: Ohne Zugang zu diesem Postfach kann niemand den Code nutzen.\n\nEbanist · Domus Renov` },
  es: { subject: "Tu código de Ebanist Pro",
    body: c => `Hola,\n\naquí tienes el código para activar Ebanist Pro en este dispositivo:\n\n${c.join("\n")}\n\nCómo usarlo: abre Ebanist → Ajustes → Suscripción, pega el código (copiar y pegar: importan las mayúsculas y minúsculas) y toca «Activar».\n\n¿No lo pediste tú? Ignora este mensaje: sin acceso a esta bandeja nadie puede usarlo.\n\nEbanist · Domus Renov` },
  pl: { subject: "Twój kod Ebanist Pro",
    body: c => `Cześć,\n\noto kod do aktywacji Ebanist Pro na tym urządzeniu:\n\n${c.join("\n")}\n\nJak go użyć: otwórz Ebanist → Ustawienia → Subskrypcja, wklej kod (kopiuj i wklej: wielkość liter ma znaczenie) i dotknij „Aktywuj”.\n\nNie prosiłeś o kod? Zignoruj tę wiadomość: bez dostępu do tej skrzynki nikt go nie użyje.\n\nEbanist · Domus Renov` }
};

const sha = s => createHash("sha256").update(s).digest("hex").slice(0, 40);

/* Numără o cerere în fereastra orei curente. true = încă în limită. */
async function allow(kind, id, max) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const st = getStore({ name: "ebanist-pro-restore", consistency: "strong" });
    const key = kind + "-" + sha(id) + "-" + Math.floor(Date.now() / 3600000);
    const n = (await st.get(key, { type: "json" })) || 0;
    if (n >= max) return false;
    await st.setJSON(key, n + 1);
    return true;
  } catch (e) {
    return true;
  }
}

/* Codurile ACTIVE ale unei adrese: `sub_…` pentru abonamente, `cs_…`
   pentru Founders. Stripe caută emailul exact, deci se încearcă și forma
   cu litere mici. */
export async function codesFor(email, key) {
  const customers = new Map();
  for (const e of new Set([email, email.toLowerCase()])) {
    const r = await stripe("customers?limit=10&email=" + encodeURIComponent(e), key);
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.data)) throw new Error("stripe-" + r.status);
    for (const c of r.body.data) customers.set(c.id, c);
  }
  const out = [];
  for (const id of customers.keys()) {
    const subs = await stripe("subscriptions?status=all&limit=20&customer=" + encodeURIComponent(id), key);
    if (subs.status === 200 && subs.body && Array.isArray(subs.body.data))
      for (const s of subs.body.data) if (planOf(s) && statusOf(s) === "active") out.push(s.id);
    const ses = await stripe("checkout/sessions?limit=20&expand[]=data.line_items&customer=" + encodeURIComponent(id), key);
    if (ses.status === 200 && ses.body && Array.isArray(ses.body.data))
      for (const s of ses.body.data)
        if (s.mode === "payment" && s.status === "complete" && s.payment_status === "paid" && lifetimePlan(s) && !(await refunded(s, key)))
          out.push(s.id);
  }
  return [...new Set(out)];
}

async function refunded(session, key) {
  const pi = session.payment_intent;
  const id = typeof pi === "string" ? pi : pi && pi.id;
  if (!id) return false;
  const r = await stripe("payment_intents/" + encodeURIComponent(id) + "?expand[]=latest_charge", key);
  const ch = r.status === 200 && r.body && r.body.latest_charge;
  return !!(ch && typeof ch === "object" && ch.refunded === true);
}

async function send(to, lang, codes) {
  const m = MAIL[lang] || MAIL.en;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.PRO_MAIL_FROM, to: [to], subject: m.subject, text: m.body(codes) })
  });
  if (!r.ok) throw new Error("mail-" + r.status);
}

export default async (req) => {
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);
  let body;
  try { body = await req.json(); } catch (e) { return reply({ ok: false, error: "bad-json" }, 400); }
  const email = String((body && body.email) || "").trim();
  const lang = LANGS.includes(body && body.lang) ? body.lang : "en";
  if (!EMAIL.test(email)) return reply({ ok: false, error: "bad-email" }, 400);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !process.env.RESEND_API_KEY || !process.env.PRO_MAIL_FROM)
    return reply({ ok: false, error: "not-configured" }, 503);

  const ip = req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "-";
  if (!(await allow("e", email.toLowerCase(), PER_EMAIL)) || !(await allow("i", ip, PER_IP)))
    return reply({ ok: false, error: "rate" }, 429);

  try {
    const codes = await codesFor(email, key);
    if (codes.length) await send(email, lang, codes);
  } catch (e) {
    /* Nu se spune clientului dacă a căzut Stripe sau emailul: ar da
       aceeași informație ca „există / nu există”. Rămâne în jurnalul
       Netlify, iar mesajul din aplicație trimite la suport. */
    console.error("pro-restore:", e && e.message);
  }
  return reply({ ok: true });
};

export const config = { path: "/api/pro-restore" };
