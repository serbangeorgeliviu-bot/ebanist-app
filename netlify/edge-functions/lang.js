/* =====================================================================
   Ebanist — la radice «/» nella lingua del visitatore (D-60)
   ---------------------------------------------------------------------
   Gira SOLO su «/» e decide, a ogni richiesta, se rimandare a /ro/ /it/
   /fr/ o lasciare la pagina inglese.

   Perche una edge function e non le regole `Language` di netlify.toml:
   provate sul deploy preview, la CDN memorizza il redirect per lingua del
   browser (`netlify-vary: language=…`) ma NON per il cookie nf_lang. Chi
   aveva scelto l'inglese da un browser romeno riceveva a volte il 302
   memorizzato per un altro: la scelta a mano non vinceva sempre. Una edge
   function gira prima della cache, a ogni richiesta, e legge tutti e due.

   Le regole, nell'ordine:
   1. «/?lang=xx» (link vecchi) non si tocca: lo gestisce netlify.toml.
   2. Il cookie eb_lang (messo SOLO da un clic su una lingua, site/js/main.js)
      vince su tutto. eb_lang=en → resta la pagina inglese.
   3. Altrimenti Accept-Language, in ordine di preferenza (q): la prima
      lingua che il sito ha decide. Se e l'inglese, o nessuna, resta «/».
   Googlebot non manda Accept-Language: vede sempre «/» in inglese.
   ===================================================================== */

export const LANGS = ["en", "ro", "it", "fr"];
export const DEFAULT = "en";

/* Accept-Language → lingue in ordine di preferenza (codice di 2 lettere).
   "ro-RO,ro;q=0.9,en;q=0.8" → ["ro", "ro", "en"]. q=0 vuol dire «no». */
export function preferred(header) {
  return String(header || "").split(",").map((part, i) => {
    const [tag, ...params] = part.trim().split(";");
    const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
    const qv = q ? Number(q.slice(2)) : 1;
    return { l: tag.trim().slice(0, 2).toLowerCase(), q: Number.isFinite(qv) ? qv : 0, i };
  }).filter(x => /^[a-z]{2}$/.test(x.l) && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i).map(x => x.l);
}

/* La lingua della radice: il cookie, se valido; poi il browser; poi l'inglese. */
export function chooseLang(cookie, acceptLanguage) {
  if (LANGS.includes(cookie)) return cookie;
  return preferred(acceptLanguage).find(l => LANGS.includes(l)) || DEFAULT;
}

/* La risposta: un 302 verso la pagina della lingua, oppure null (la pagina
   inglese statica prosegue). Il 302 non si memorizza da nessuna parte. */
export function decide(url, cookie, acceptLanguage) {
  const u = new URL(url);
  if (u.pathname !== "/" || u.searchParams.has("lang")) return null;
  const l = chooseLang(cookie, acceptLanguage);
  if (l === DEFAULT) return null;
  return { status: 302, location: `/${l}/${u.search}` };
}

export default async (request, context) => {
  let cookie;
  try { cookie = context.cookies.get("eb_lang"); } catch (e) {}
  const d = decide(request.url, cookie, request.headers.get("accept-language"));
  if (!d) return;
  return new Response(null, {
    status: d.status,
    headers: { location: d.location, "cache-control": "private, no-store", vary: "Accept-Language, Cookie" },
  });
};

export const config = { path: "/" };
