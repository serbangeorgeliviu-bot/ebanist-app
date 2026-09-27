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
       Safari ignora navigate() — li ci pensa il 301 del server al
       primo ricaricamento, che e comunque il caso normale. */
    try {
      const wins = await self.clients.matchAll({ type: "window" });
      for (const w of wins) {
        /* Solo il vecchio /index.html va all'app; tutto il resto (la radice e
           le pagine /ro/ /it/ /fr/ della presentazione) si ricarica dov'e. */
        const dest = new URL(w.url).pathname === "/index.html" ? HOME : w.url;
        try { await w.navigate(dest); } catch (err) {}
      }
    } catch (err) {}
    /* Ultimo atto: sparire. Da qui in poi le richieste vanno al server,
       che ha i suoi redirect. */
    try { await self.registration.unregister(); } catch (err) {}
  })());
});

/* Nessun gestore «fetch»: da quando la radice e il sito di presentazione
   (/, /ro/, /it/, /fr/, /site/…) non c'e piu niente da rimandare all'app.
   Le vecchie scorciatoie verso /index.html le sistema il server (301 a
   /app/), le finestre aperte le sposta l'activate qui sopra. Un worker
   senza «fetch» non intercetta nulla: le richieste vanno dritte in rete. */
