/* Ebanist service worker — offline-first app shell */
const CACHE = "ebanist-v43";
const SHELL = ["./index.html","./viewer3d.js","./vendor/three.module.min.js","./vendor/RoomEnvironment.js","./arexport.js","./vendor/GLTFExporter.js","./vendor/USDZExporter.js","./vendor/TextureUtils.js","./vendor/fflate.module.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/favicon.ico"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
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
