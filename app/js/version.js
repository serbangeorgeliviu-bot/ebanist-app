"use strict";
/* ===========================================================================
   Ebanist — app/js/version.js

   Chi siamo, quale motore gira e come si prende la versione nuova.

   APP_VER e SW_CACHE non stanno piu' scritti qui: stanno in due <meta> di
   index.html, e questo file li legge. Il motivo e' l'aggiornatore. Prima
   ripescava il numero da index.html con una espressione regolare che
   cercava una RIGA DI CODICE — `const APP_VER="…"; /* APP_VER-MARKER *​/` —
   dentro l'HTML. Funzionava finche' quel codice stava inline; con gli
   script in file separati non ci sarebbe piu' stato nulla da cercare. Un
   <meta> e' il posto giusto per un numero di versione: lo si legge dal
   documento scaricato senza far finta di leggere JavaScript.
   =========================================================================== */

/* ---- chi siamo ---- */
function metaContent(name, fallback) {
  const m = document.querySelector('meta[name="' + name + '"]');
  const v = m && m.getAttribute("content");
  return v || fallback;
}
const APP_VER = metaContent("app-version", "0.0.0");
/* DEVE combaciare con CACHE in sw.js. Se restano indietro l'uno rispetto
   all'altro, «Verifica aggiornamenti» scrive la pagina nuova in una cache
   che il service worker cancella appena si attiva: l'aggiornamento sembra
   riuscito e al riavvio successivo torna la versione vecchia. La prova del
   browser controlla che i due nomi coincidano. */
const SW_CACHE = metaContent("sw-cache", "");

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
document.addEventListener("DOMContentLoaded", () => {
  verLabelPaint();
  const bu = document.getElementById("btnUpdate");
  if (bu) bu.addEventListener("click", checkForUpdate);
});

/* L'etichetta versione dice anche QUALE motore 3D e attivo. Serve a
   distinguere da lontano "l'aggiornamento non e arrivato" da "e arrivato
   ma il 3D e tornato su SVG": senza questo i due casi si vedono uguali. */
window.GL3D_MODE = "SVG";
window.GL3D_WHY = "modulo non caricato";
/* Il perche del ripiego va scritto a schermo: la console di un telefono non
   si legge da qui, e "3D SVG" da solo non dice se manca il file, se il
   browser non fa i moduli o se WebGL non parte. */
window.addEventListener("error", function (ev) {
  try {
    const f = (ev && ev.filename) || "";
    if (/viewer3d\.js|three\.module|RoomEnvironment/.test(f)) {
      window.GL3D_WHY = String((ev && ev.message) || "errore").slice(0, 70);
      verLabelPaint();
    }
  } catch (e) {}
}, true);

function verLabelPaint() {
  const vl = document.getElementById("verLabel");
  if (!vl) return;
  const why = window.GL3D_MODE === "SVG" ? ` (${window.GL3D_WHY})` : "";
  vl.textContent = `Ebanist v${APP_VER} · 3D ${window.GL3D_MODE}${why} · ebanist.com`;
}

/* ---- Il motore locale e vecchio? ----
   Un service worker con la copia vecchia in cache significa che l'utente
   continua a generare distinte col motore sbagliato DOPO il deploy. Uno
   striscione ignorabile non basta: se il motore sul server e piu avanti di
   quello caricato qui, l'esportazione si ferma finche non si ricarica. */
async function checkGeomVersion() {
  try {
    const r = await fetch("./ebanist-core.js?gv=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return 0;
    const m = (await r.text()).match(/var GEOM_VERSION = (\d+); \/\* GEOM_VERSION-MARKER/);
    const remote = m ? parseInt(m[1], 10) : 0;
    /* solo PIU AVANTI blocca. Offline, o con una risposta che non si legge,
       non succede niente: in officina senza rete si deve poter lavorare. */
    if (remote > GEOM_VERSION) { window.__geomStale = remote; geomStaleBar(); return remote; }
    window.__geomStale = 0;
    const b = document.getElementById("geomStaleBar"); if (b) b.remove();
  } catch (e) {}
  return 0;
}

/* Una barra che non se ne va da sola: l'unica via d'uscita e ricaricare. */
function geomStaleBar() {
  let bar = document.getElementById("geomStaleBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "geomStaleBar";
    bar.setAttribute("role", "alert");
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span>${esc(t("gvStale"))}</span><button type="button">${esc(t("gvReload"))}</button>`;
  bar.querySelector("button").addEventListener("click", () => location.reload());
}

/* ---- la versione nuova ----
   Due passaggi, e il secondo e quello che prima mancava. Si confronta il
   numero di versione del documento remoto col nostro; se e diverso NON
   basta riscrivere index.html in cache. Da quando gli script stanno in
   file separati, una pagina nuova con in cache i file vecchi e la
   combinazione peggiore possibile: l'HTML dice 4.29 e il codice e 4.28.
   (Il guasto c'era gia' prima, in piccolo: ebanist-core.js restava
   indietro allo stesso modo.) Quindi si svuota tutto e si ricarica: il
   service worker nuovo ricostruisce la cache dalla rete. */
async function checkForUpdate() {
  const bu = document.getElementById("btnUpdate");
  const lbl = bu && bu.querySelector("span");
  if (bu) bu.disabled = true;
  const old = lbl ? lbl.textContent : "";
  if (lbl) lbl.textContent = "…";
  try {
    const r = await fetch("./index.html?upd=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("http " + r.status);
    const txt = await r.text();
    const m = txt.match(/<meta\s+name="app-version"\s+content="([^"]+)"/i);
    const remote = m ? m[1] : null;
    if (remote && remote !== APP_VER) {
      await dropAllCaches();
      try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) {}
      toast(t("updFound") + " v" + remote);
      setTimeout(() => location.reload(), 900);
      return;
    }
    /* stessa versione dell'app, ma il motore potrebbe essere piu avanti */
    if (await checkGeomVersion()) toast(t("gvStale"));
    else toast(t("updLatest") + " (v" + APP_VER + ")");
  } catch (e) {
    toast(t("updErr"));
  }
  if (bu) bu.disabled = false;
  if (lbl) lbl.textContent = old;
}

/* Si cancella TUTTO, non solo la cache che conosciamo: un deploy che
   cambia il nome ne lascia in giro di vecchie, e sono proprio quelle che
   riportano a galla un file superato. I progetti non sono qui dentro —
   stanno in localStorage e IndexedDB, che questa funzione non tocca. */
async function dropAllCaches() {
  try {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch (e) {}
}
