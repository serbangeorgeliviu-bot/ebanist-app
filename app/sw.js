/* Ebanist service worker — offline-first app shell */
const CACHE = "ebanist-v68";
const SHELL = ["./index.html","./ebanist-core.js","./ebanist-ops.js","/order-rail/price.js","/order-rail/atelier.js","/order-rail/order.js","./ebanist-store.js","./config/billing.js","./ebanist-license.js","./viewer3d.js","./geo3d.js","./vendor/three.module.min.js","./vendor/RoomEnvironment.js","./arexport.js","./vendor/GLTFExporter.js","./vendor/USDZExporter.js","./vendor/TextureUtils.js","./vendor/fflate.module.js","./vendor/supabase.js","./data/materials-centro-legno.json","./data/materials-legacy.json","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/favicon.ico"];

self.addEventListener("install", e => {
  /* `cache:"reload"`: il guscio si scarica DAL SERVER, non dalla cache HTTP del
     browser. Senza, un aggiornamento poteva mettere insieme l'index.html nuovo
     e un ebanist-core.js vecchio rimasto nella cache del browser — ed e quello
     che e successo con la 4.29.0 («reading 'back_y0'»). */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  // la cache accetta solo GET: l'upload del modello AR e un POST e qui non entra
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  /* Le due domande «sono aggiornato?» — la versione dell'app (?upd=) e quella
     del motore geometrico (?gv=) — devono arrivare al SERVER, sempre, e non
     devono lasciare traccia: ogni controllo ha un timestamp diverso, quindi
     ogni risposta messa in cache sarebbe una voce nuova che non serve piu a
     nessuno. Rete diretta, niente cache, in nessuna delle due direzioni. */
  if (url.searchParams.has("upd") || url.searchParams.has("gv")) return;
  if (e.request.mode === "navigate") {
    // app shell: cache-first, refresh in background
    e.respondWith(
      caches.match("./index.html").then(hit => {
        const net = fetch(e.request).then(r => {
          if (r.ok) caches.open(CACHE).then(c => c.put("./index.html", r.clone()));
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }
  // static + fonts: cache-first with runtime fill
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok && (url.origin === location.origin || url.hostname.includes("gstatic") || url.hostname.includes("googleapis"))) {
        const cl = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cl));
      }
      return r;
    }).catch(() => hit))
  );
});
