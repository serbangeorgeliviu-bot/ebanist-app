/* =====================================================================
   Ebanist — service worker di SMANTELLAMENTO della radice.
   ---------------------------------------------------------------------
   L'app non sta piu in "/": sta in "/app/", e in radice c'e la pagina di
   presentazione. Ma sui telefoni gia in giro resta registrato il service
   worker VECCHIO, con scope "/", che serve l'app dalla cache in
   cache-first: senza questo file quei telefoni continuerebbero a vedere
   la vecchia applicazione a "/" per sempre — la pagina di presentazione
   non arriverebbe mai, e nemmeno gli aggiornamenti dell'app.

   Un service worker si sostituisce solo con un altro service worker allo
   STESSO indirizzo. Quindi questo file resta qui, allo stesso indirizzo
   di prima, e fa una cosa sola: si disinstalla.

   Le cache NON si toccano qui: ci pensa il service worker di /app/, che
   nell'activate cancella tutto quello che non e la sua cache corrente.
   Cancellarle anche da qui vorrebbe dire, nell'ordine sbagliato, buttare
   via la cache appena riempita da /app/ e lasciare l'officina senza
   offline per una giornata.
   ===================================================================== */

const HOME = "/app/";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    await self.clients.claim();
    /* Best-effort: su Chrome le finestre aperte si spostano da sole.
       Safari ignora navigate() — li ci pensa il redirect qui sotto al
       primo ricaricamento, che e comunque il caso normale. */
    try {
      const wins = await self.clients.matchAll({ type: "window" });
      for (const w of wins) { try { await w.navigate(HOME); } catch (err) {} }
    } catch (err) {}
    /* Ultimo atto: sparire. Da qui in poi le richieste vanno al server,
       che ha i suoi redirect. */
    try { await self.registration.unregister(); } catch (err) {}
  })());
});

/* Finche questo worker e vivo (cioe fra activate e la fine dell'ultima
   finestra che lo usa) le navigazioni le manda lui a destinazione: senza
   questo, il ricaricamento subito dopo l'attivazione passerebbe ancora
   dalla vecchia cache. Tutto il resto non lo tocca: niente cache, niente
   riscritture. */
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/app/")) return;
  /* Order Rail: /a/<slug> e il link che il laboratorio da ai clienti, e
     /api/ sono le funzioni. Mandarli a /app/ vorrebbe dire rompere il
     link dell'ordine per tutti quelli che hanno ancora il vecchio
     service worker vivo — cioe proprio i clienti di prima. */
  if (url.pathname.startsWith("/a/") || url.pathname.startsWith("/api/")) return;
  e.respondWith(Response.redirect(HOME, 302));
});
