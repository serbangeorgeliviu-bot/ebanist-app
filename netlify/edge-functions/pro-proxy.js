/* =====================================================================
   Ebanist — /api/pro răspunde mereu din proiectul ebanist.com
   ---------------------------------------------------------------------
   Aplicația Android (MainActivity.HOST) încarcă whimsical-wisp-61cbbf.
   netlify.app: alt proiect Netlify, construit din același repo, dar cu
   variabilele lui. Acolo lipseau STRIPE_SECRET_KEY și PRO_COMP_CODES,
   deci în aplicația Android nici `sub_…`, nici `comp_…` nu se activau.

   Pe orice altă adresă decât ebanist.com, cererea către /api/pro e
   trimisă mai departe la https://ebanist.com/api/pro, iar răspunsul se
   întoarce neschimbat. Cheile stau astfel într-un singur loc. Pe
   ebanist.com funcția nu face nimic, deci nu există buclă.

   Se scoate după ROADMAP L.10, când aplicația Android trece pe ebanist.com.
   ===================================================================== */

export const CANON = "ebanist.com";

/* Adresa la care se trimite cererea, sau null (răspunde funcția locală). */
export function target(url) {
  const u = new URL(url);
  if (u.hostname === CANON || u.hostname === "www." + CANON) return null;
  return `https://${CANON}${u.pathname}`;
}

export default async (request) => {
  const to = target(request.url);
  if (!to) return;
  const init = { method: request.method, headers: { "content-type": request.headers.get("content-type") || "application/json" } };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  try {
    const r = await fetch(to, init);
    return new Response(await r.text(), {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    /* ebanist.com de neatins: același răspuns ca un Stripe mut, aplicația
       nu schimbă nimic și reîncearcă data viitoare. */
    return new Response(JSON.stringify({ ok: false, error: "unreachable" }), {
      status: 504, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
};

export const config = { path: "/api/pro" };
