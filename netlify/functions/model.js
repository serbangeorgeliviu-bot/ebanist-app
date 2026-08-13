/* Ospita il modello 3D per il visore AR del telefono.
   Scene Viewer e Quick Look sono ALTRE app: non possono leggere un blob
   dentro Ebanist, gli serve un indirizzo https vero. Questa funzione lo da.

   POST /.netlify/functions/model   corpo = i byte del .glb o .usdz
        -> { url: "https://.../ar/<id>.glb" }
   GET  /ar/<id>.glb                (riscritto qui da netlify.toml)
        -> i byte, col Content-Type giusto

   Niente account, niente login: gira sullo stesso Netlify che pubblica
   gia il sito, e si consegna con lo stesso git push. */

import { getStore } from "@netlify/blobs";

const MAX = 8 * 1024 * 1024;          // un mobile sta in pochi kB; il resto e sospetto

export default async (req) => {
  const store = getStore("ar-models");
  const url = new URL(req.url);

  if (req.method === "POST") {
    const type = req.headers.get("content-type") || "model/gltf-binary";
    const name = (req.headers.get("x-filename") || "mobile.glb").replace(/[^a-zA-Z0-9._-]/g, "");
    const ext = name.toLowerCase().endsWith(".usdz") ? "usdz" : "glb";
    const body = new Uint8Array(await req.arrayBuffer());
    if (!body.length) return new Response("vuoto", { status: 400 });
    if (body.length > MAX) return new Response("troppo grande", { status: 413 });

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    await store.set(id, body, { metadata: { type } });
    return Response.json({ url: `${url.origin}/ar/${id}` });
  }

  if (req.method === "GET") {
    const id = (url.searchParams.get("id") || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!id) return new Response("id mancante", { status: 400 });
    const hit = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!hit) return new Response("non trovato", { status: 404 });
    return new Response(hit.data, {
      headers: {
        "Content-Type": (hit.metadata && hit.metadata.type)
          || (id.endsWith(".usdz") ? "model/vnd.usdz+zip" : "model/gltf-binary"),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response("metodo non ammesso", { status: 405 });
};
