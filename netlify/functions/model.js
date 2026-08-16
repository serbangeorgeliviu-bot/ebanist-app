/* Ospita il modello 3D per il visore AR del telefono.
   Scene Viewer e Quick Look sono ALTRE app: non possono leggere un blob
   dentro Ebanist, gli serve un indirizzo https vero. Questa funzione lo da.

   POST /ar            corpo = i byte del .glb o .usdz
        -> { url: "https://.../ar/<id>.glb" }
   GET  /ar/<id>.glb   -> i byte, col Content-Type giusto

   La rotta la dichiara la funzione stessa (config.path). Con una regola di
   riscrittura in netlify.toml il :splat NON arriva alla query string della
   funzione: l'upload andava, ma il GET rispondeva sempre "id mancante".

   Niente account, niente login: gira sullo stesso Netlify che pubblica
   gia il sito, e si consegna con lo stesso git push.

   Le decisioni di sicurezza — cosa si accetta, con che Content-Type si
   restituisce, quando scade — stanno in _armodel.js: sono pure, e cosi la
   rete di regressione puo provarle senza Netlify. */

import { getStore } from "@netlify/blobs";
import { uploadCheck, serveHeaders, isExpired } from "./_armodel.js";

export const config = { path: ["/ar", "/ar/:id"] };

export default async (req, context) => {
  const store = getStore("ar-models");
  const url = new URL(req.url);

  if (req.method === "POST") {
    const body = new Uint8Array(await req.arrayBuffer());
    const chk = uploadCheck(req.headers.get("content-type"), req.headers.get("x-filename"), body);
    if (!chk.ok) return new Response(chk.msg, { status: chk.status });

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${chk.ext}`;
    await store.set(id, body, { metadata: { ext: chk.ext, born: Date.now() } });
    return Response.json({ url: `${url.origin}/ar/${id}` });
  }

  if (req.method === "GET") {
    // il parametro di rotta e la fonte buona; il resto e rete di sicurezza
    const raw = (context && context.params && context.params.id)
      || url.pathname.split("/").filter(Boolean).pop()
      || url.searchParams.get("id") || "";
    const id = raw.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!id) return new Response("id mancante", { status: 400 });
    const hit = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!hit) return new Response("non trovato", { status: 404 });

    /* scaduto = non c'e piu. Si cancella alla prima richiesta che lo trova
       vecchio: nessun job di pulizia da mantenere. */
    if (isExpired(hit.metadata)) {
      try { await store.delete(id); } catch (e) { /* riproveremo al prossimo GET */ }
      return new Response("scaduto", { status: 410 });
    }

    return new Response(hit.data, { headers: serveHeaders(id, hit.metadata) });
  }

  return new Response("metodo non ammesso", { status: 405 });
};
