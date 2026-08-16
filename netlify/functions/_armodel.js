/* =====================================================================
   Ebanist — le decisioni di sicurezza della rotta /ar, isolate
   -------------------------------------------------------------------
   Stanno qui, senza nessun import, per una ragione sola: cosi si possono
   PROVARE. La funzione vera importa @netlify/blobs e non gira fuori da
   Netlify; queste due funzioni sono pure e la rete di regressione le
   chiama direttamente.

   Il buco che chiudono: prima il Content-Type arrivava dall'header della
   richiesta e tornava identico al GET. Bastava caricare `text/html` per
   farsi ospitare una pagina sulla STESSA ORIGINE dell'app — e da li si
   legge il localStorage, cioe la chiave API e tutti i clienti.
   ===================================================================== */

export const MAX = 8 * 1024 * 1024;          // un mobile sta in pochi kB
export const TTL_MS = 24 * 60 * 60 * 1000;   // un modello AR si guarda oggi

/* I DUE SOLI tipi che questa rotta serve. Il tipo lo decide l'estensione,
   che decidiamo noi — mai la richiesta. */
export const TYPES = { glb: "model/gltf-binary", usdz: "model/vnd.usdz+zip" };

const ALLOWED_UPLOAD = new Set([
  "model/gltf-binary", "model/vnd.usdz+zip", "application/octet-stream",
]);

/* Un .glb comincia per "glTF", un .usdz e uno zip ("PK"). Non e una garanzia
   crittografica, ma ferma chi carica altro mettendo l'estensione giusta. */
function magicOk(ext, bytes) {
  if (!bytes || bytes.length < 4) return false;
  const m = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return ext === "glb" ? m === "glTF" : m.slice(0, 2) === "PK";
}

/* Decide se un upload si accetta. Torna {ok:true, ext} oppure {ok:false,
   status, msg} — nessuna eccezione, cosi il chiamante resta a una riga. */
export function uploadCheck(contentType, filename, bytes) {
  const sent = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (sent && !ALLOWED_UPLOAD.has(sent)) return { ok: false, status: 415, msg: "tipo non ammesso" };
  const name = String(filename || "mobile.glb").replace(/[^a-zA-Z0-9._-]/g, "");
  const ext = name.toLowerCase().endsWith(".usdz") ? "usdz" : "glb";
  if (!bytes || !bytes.length) return { ok: false, status: 400, msg: "vuoto" };
  if (bytes.length > MAX) return { ok: false, status: 413, msg: "troppo grande" };
  if (!magicOk(ext, bytes)) return { ok: false, status: 415, msg: "non e un modello 3D" };
  return { ok: true, ext };
}

/* Gli header con cui si restituisce un modello. Il Content-Type esce
   dall'estensione registrata al caricamento, e `nosniff` impedisce al
   browser di indovinare qualcosa di eseguibile. */
export function serveHeaders(id, metadata) {
  const ext = (metadata && metadata.ext) ||
    (String(id).toLowerCase().endsWith(".usdz") ? "usdz" : "glb");
  return {
    "Content-Type": TYPES[ext] || TYPES.glb,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  };
}

export function isExpired(metadata, now) {
  const born = (metadata && metadata.born) || 0;
  return !!born && (now || Date.now()) - born > TTL_MS;
}
