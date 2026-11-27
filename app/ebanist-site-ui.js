/* =====================================================================
   Ebanist — modul Șantier: ecranul (D-192)
   ---------------------------------------------------------------------
   Se încarcă DUPĂ scriptul principal: folosește `proj`, `persist`, `uid`,
   `t`, `toast`, `esc`, `setView`, `printOut`, `proGateSample` și logica pură
   din `ebanist-site.js`. Aici nu se calculează nicio cotă și nu se atinge
   distinta: ecranul adună releveul (tab-ul existent), poza (`survey.photos`),
   bifatul montajului și recepția, și scrie numai în `p.site`.
   Toate butoanele ≥ 56 px, contrast mare, fără animații; merge fără semnal.
   ===================================================================== */
(function () {
"use strict";

var L = ["en", "ro", "it", "fr", "de", "pl", "es"];
var S18 = {
  siteBtn:      { en: "Site", ro: "Șantier", it: "Cantiere", fr: "Chantier", de: "Baustelle", pl: "Budowa", es: "Obra" },
  siteBtnSub:   { en: "Survey, photos, fitting, handover", ro: "Releveu, poze, montaj, recepție", it: "Rilievo, foto, montaggio, consegna", fr: "Relevé, photos, montage, réception", de: "Aufmaß, Fotos, Montage, Abnahme", pl: "Pomiar, zdjęcia, montaż, odbiór", es: "Medición, fotos, montaje, entrega" },
  siteTitle:    { en: "Site mode", ro: "Mod Șantier", it: "Modo cantiere", fr: "Mode chantier", de: "Baustellen-Modus", pl: "Tryb budowy", es: "Modo obra" },
  siteClose:    { en: "Close", ro: "Închide", it: "Chiudi", fr: "Fermer", de: "Schließen", pl: "Zamknij", es: "Cerrar" },
  siteBack:     { en: "Back", ro: "Înapoi", it: "Indietro", fr: "Retour", de: "Zurück", pl: "Wstecz", es: "Atrás" },
  siteNoProj:   { en: "Open or create a project first.", ro: "Deschide sau creează întâi un proiect.", it: "Apri o crea prima un progetto.", fr: "Ouvrez ou créez d'abord un projet.", de: "Öffne oder erstelle zuerst ein Projekt.", pl: "Najpierw otwórz lub utwórz projekt.", es: "Abre o crea primero un proyecto." },
  siteSurvey:   { en: "Survey", ro: "Releveu", it: "Rilievo", fr: "Relevé", de: "Aufmaß", pl: "Pomiar", es: "Medición" },
  siteSurveyS:  { en: "Walls, heights, obstacles", ro: "Pereți, înălțimi, obstacole", it: "Pareti, altezze, ostacoli", fr: "Murs, hauteurs, obstacles", de: "Wände, Höhen, Hindernisse", pl: "Ściany, wysokości, przeszkody", es: "Paredes, alturas, obstáculos" },
  sitePhoto:    { en: "Photo", ro: "Poză", it: "Foto", fr: "Photo", de: "Foto", pl: "Zdjęcie", es: "Foto" },
  sitePhotoS:   { en: "{n} on site", ro: "{n} de pe șantier", it: "{n} dal cantiere", fr: "{n} du chantier", de: "{n} von der Baustelle", pl: "{n} z budowy", es: "{n} de la obra" },
  sitePhotoNo:  { en: "Take a photo", ro: "Fă o poză", it: "Scatta una foto", fr: "Prendre une photo", de: "Foto aufnehmen", pl: "Zrób zdjęcie", es: "Haz una foto" },
  siteMount:    { en: "Fitting", ro: "Montaj", it: "Montaggio", fr: "Montage", de: "Montage", pl: "Montaż", es: "Montaje" },
  siteMountS:   { en: "{n} of {m} fitted", ro: "{n} din {m} montate", it: "{n} di {m} montati", fr: "{n} sur {m} montés", de: "{n} von {m} montiert", pl: "{n} z {m} zamontowanych", es: "{n} de {m} montados" },
  siteReceipt:  { en: "Handover", ro: "Recepție", it: "Consegna", fr: "Réception", de: "Abnahme", pl: "Odbiór", es: "Entrega" },
  siteReceiptS: { en: "{n} of 7 checks · client signature", ro: "{n} din 7 verificări · semnătura clientului", it: "{n} di 7 controlli · firma del cliente", fr: "{n} sur 7 contrôles · signature du client", de: "{n} von 7 Prüfungen · Unterschrift des Kunden", pl: "{n} z 7 kontroli · podpis klienta", es: "{n} de 7 controles · firma del cliente" },
  siteFitted:   { en: "Fitted", ro: "Montat", it: "Montato", fr: "Monté", de: "Montiert", pl: "Zamontowane", es: "Montado" },
  siteToFit:    { en: "To fit", ro: "De montat", it: "Da montare", fr: "À monter", de: "Zu montieren", pl: "Do montażu", es: "Por montar" },
  sitePcs:      { en: "{n} pcs", ro: "{n} buc.", it: "{n} pz", fr: "{n} pcs", de: "{n} Stk.", pl: "{n} szt.", es: "{n} uds." },
  siteNoUnits:  { en: "The project has no units to fit yet.", ro: "Proiectul nu are încă corpuri de montat.", it: "Il progetto non ha ancora mobili da montare.", fr: "Le projet n'a pas encore de meubles à monter.", de: "Das Projekt hat noch keine Möbel zu montieren.", pl: "Projekt nie ma jeszcze mebli do montażu.", es: "El proyecto aún no tiene muebles por montar." },
  siteTapUndo:  { en: "Tap again to undo", ro: "Atinge din nou ca să anulezi", it: "Tocca ancora per annullare", fr: "Touchez encore pour annuler", de: "Erneut tippen zum Rückgängig", pl: "Dotknij ponownie, aby cofnąć", es: "Toca de nuevo para deshacer" },
  siteChecks:   { en: "Checks", ro: "Verificări", it: "Controlli", fr: "Contrôles", de: "Prüfungen", pl: "Kontrole", es: "Controles" },
  siteDefects:  { en: "Defects", ro: "Defecte", it: "Difetti", fr: "Défauts", de: "Mängel", pl: "Wady", es: "Defectos" },
  siteDefectPh: { en: "Describe the defect", ro: "Descrie defectul", it: "Descrivi il difetto", fr: "Décrivez le défaut", de: "Mangel beschreiben", pl: "Opisz wadę", es: "Describe el defecto" },
  siteAdd:      { en: "Add", ro: "Adaugă", it: "Aggiungi", fr: "Ajouter", de: "Hinzufügen", pl: "Dodaj", es: "Añadir" },
  siteRemove:   { en: "Remove", ro: "Șterge", it: "Elimina", fr: "Supprimer", de: "Entfernen", pl: "Usuń", es: "Quitar" },
  siteName:     { en: "Client's name", ro: "Numele clientului", it: "Nome del cliente", fr: "Nom du client", de: "Name des Kunden", pl: "Imię klienta", es: "Nombre del cliente" },
  siteSignHere: { en: "Client's signature", ro: "Semnătura clientului", it: "Firma del cliente", fr: "Signature du client", de: "Unterschrift des Kunden", pl: "Podpis klienta", es: "Firma del cliente" },
  siteClear:    { en: "Clear", ro: "Șterge", it: "Cancella", fr: "Effacer", de: "Löschen", pl: "Wyczyść", es: "Borrar" },
  siteSign:     { en: "Sign the handover", ro: "Semnează recepția", it: "Firma la consegna", fr: "Signer la réception", de: "Abnahme unterschreiben", pl: "Podpisz odbiór", es: "Firmar la entrega" },
  siteSignedBy: { en: "Handover signed by {name}", ro: "Recepție semnată de {name}", it: "Consegna firmata da {name}", fr: "Réception signée par {name}", de: "Abnahme unterschrieben von {name}", pl: "Odbiór podpisał(a) {name}", es: "Entrega firmada por {name}" },
  sitePartial:  { en: "Partial handover: {n} of {m} units fitted.", ro: "Recepție parțială: {n} din {m} corpuri montate.", it: "Consegna parziale: {n} di {m} mobili montati.", fr: "Réception partielle : {n} meubles montés sur {m}.", de: "Teilabnahme: {n} von {m} Möbeln montiert.", pl: "Odbiór częściowy: zamontowano {n} z {m} mebli.", es: "Entrega parcial: {n} de {m} muebles montados." },
  siteWarnPart: { en: "{k} units are not fitted yet. You can still sign: the handover will say it is partial.", ro: "{k} corpuri nu sunt încă montate. Poți semna oricum: recepția va spune că e parțială.", it: "{k} mobili non sono ancora montati. Puoi firmare comunque: la consegna dirà che è parziale.", fr: "{k} meubles ne sont pas encore montés. Vous pouvez signer quand même : la réception sera indiquée comme partielle.", de: "{k} Möbel sind noch nicht montiert. Du kannst trotzdem unterschreiben: Die Abnahme wird als Teilabnahme vermerkt.", pl: "{k} mebli nie jest jeszcze zamontowanych. Możesz mimo to podpisać: odbiór zostanie oznaczony jako częściowy.", es: "{k} muebles aún no están montados. Puedes firmar igualmente: la entrega constará como parcial." },
  siteNeedName: { en: "Type the client's name first.", ro: "Scrie întâi numele clientului.", it: "Scrivi prima il nome del cliente.", fr: "Saisissez d'abord le nom du client.", de: "Gib zuerst den Namen des Kunden ein.", pl: "Najpierw wpisz imię klienta.", es: "Escribe primero el nombre del cliente." },
  siteNeedSig:  { en: "The client must sign in the box.", ro: "Clientul trebuie să semneze în casetă.", it: "Il cliente deve firmare nel riquadro.", fr: "Le client doit signer dans le cadre.", de: "Der Kunde muss im Feld unterschreiben.", pl: "Klient musi podpisać się w ramce.", es: "El cliente debe firmar en el recuadro." },
  siteUnsign:   { en: "Cancel signature", ro: "Anulează semnătura", it: "Annulla la firma", fr: "Annuler la signature", de: "Unterschrift widerrufen", pl: "Anuluj podpis", es: "Anular la firma" },
  siteUnsignQ:  { en: "Cancel the signature? Checks and defects stay.", ro: "Anulezi semnătura? Verificările și defectele rămân.", it: "Annullare la firma? Controlli e difetti restano.", fr: "Annuler la signature ? Contrôles et défauts restent.", de: "Unterschrift widerrufen? Prüfungen und Mängel bleiben.", pl: "Anulować podpis? Kontrole i wady zostają.", es: "¿Anular la firma? Los controles y defectos se quedan." },
  sitePv:       { en: "Print the handover record", ro: "Tipărește procesul-verbal", it: "Stampa il verbale", fr: "Imprimer le procès-verbal", de: "Abnahmeprotokoll drucken", pl: "Drukuj protokół", es: "Imprimir el acta" },
  sitePvUnits:  { en: "Units fitted", ro: "Corpuri montate", it: "Mobili montati", fr: "Meubles montés", de: "Montierte Möbel", pl: "Zamontowane meble", es: "Muebles montados" },
  sitePvNone:   { en: "none", ro: "niciunul", it: "nessuno", fr: "aucun", de: "keine", pl: "brak", es: "ninguno" },
  sitePvNoDef:  { en: "No defects noted.", ro: "Niciun defect notat.", it: "Nessun difetto annotato.", fr: "Aucun défaut noté.", de: "Keine Mängel vermerkt.", pl: "Nie odnotowano wad.", es: "Sin defectos anotados." },
  sitePvSigned: { en: "Signed by the client on site", ro: "Semnat de client pe șantier", it: "Firmato dal cliente in cantiere", fr: "Signé par le client sur le chantier", de: "Vom Kunden auf der Baustelle unterschrieben", pl: "Podpisane przez klienta na budowie", es: "Firmado por el cliente en la obra" }
};

function st(k, v) {
  var o = S18[k] || {}, s = o[(window.state && state.lang) || "en"];
  if (s == null) s = o.en;
  if (s == null) s = k;
  if (v) for (var x in v) s = s.split("{" + x + "}").join(v[x]);
  return s;
}
function E(s) { return (typeof esc === "function") ? esc(String(s)) : String(s); }
function P() { return (typeof proj === "function") ? proj() : null; }
function site(p) { return EBSite.norm(p && p.site); }
function units(p) { return EBSite.units(p, (typeof isAccPiece === "function") ? isAccPiece : null); }
function save(p, s) { p.site = s; persist(); render(); }
function photoCount(p) { return ((p.survey && p.survey.photos) || []).filter(function (x) { return x.kind === "site"; }).length; }
function ck(i) { return (typeof t === "function" && t("mk" + i) !== "mk" + i) ? t("mk" + i) : "#" + i; }
function dateStr(ts) { try { return new Date(ts).toISOString().slice(0, 10); } catch (e) { return ""; } }

var page = "home", pad = { drawn: false, last: null };

/* ---------- ecranul ---------- */
function css() {
  if (document.getElementById("smCss")) return;
  var s = document.createElement("style"); s.id = "smCss";
  s.textContent =
    "#siteMode{position:fixed;inset:0;z-index:120;background:var(--bg,#0b1a14);color:var(--text,#f2f4ef);display:flex;flex-direction:column;overflow:hidden}" +
    "#siteMode[hidden]{display:none}" +
    ".sm-top{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;border-bottom:1px solid var(--line,#2a3a32)}" +
    ".sm-top h2{flex:1;margin:0;font-size:20px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".sm-top .sm-x{min-height:56px;min-width:56px;border-radius:14px;border:1px solid var(--line,#2a3a32);background:var(--raised,#14261d);color:inherit;font-size:16px;font-weight:700;padding:0 16px}" +
    ".sm-body{flex:1;overflow-y:auto;padding:14px 14px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}" +
    ".sm-proj{font-size:15px;color:var(--muted,#9fb0a6)}" +
    ".sm-tile{display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;min-height:88px;width:100%;padding:14px 16px;border-radius:18px;border:2px solid var(--line,#2a3a32);background:var(--raised,#14261d);color:inherit;font:inherit}" +
    ".sm-tile b{font-size:22px}.sm-tile span{font-size:15px;color:var(--muted,#9fb0a6)}" +
    ".sm-tile:active{border-color:var(--gold,#d4af37)}" +
    ".sm-bar{height:10px;border-radius:6px;background:var(--line,#2a3a32);overflow:hidden}.sm-bar i{display:block;height:100%;background:var(--gold,#d4af37)}" +
    ".sm-unit{display:flex;align-items:center;gap:12px;min-height:72px;width:100%;padding:12px 16px;border-radius:16px;border:2px solid var(--line,#2a3a32);background:var(--raised,#14261d);color:inherit;font:inherit;text-align:left}" +
    ".sm-unit .sm-n{flex:1;min-width:0;font-size:19px;font-weight:700;overflow:hidden;text-overflow:ellipsis}.sm-unit small{display:block;font-weight:400;font-size:14px;color:var(--muted,#9fb0a6)}" +
    ".sm-unit .sm-tick{flex:none;min-width:112px;min-height:44px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:16px;border:2px solid var(--line,#2a3a32)}" +
    ".sm-unit.on{border-color:var(--gold,#d4af37)}.sm-unit.on .sm-tick{background:var(--gold,#d4af37);color:#0b1a14;border-color:var(--gold,#d4af37)}" +
    ".sm-in{width:100%;min-height:56px;border-radius:14px;border:2px solid var(--line,#2a3a32);background:var(--bg,#0b1a14);color:inherit;font-size:18px;padding:0 14px}" +
    ".sm-btn{min-height:60px;width:100%;border-radius:16px;border:2px solid var(--gold,#d4af37);background:var(--gold,#d4af37);color:#0b1a14;font-size:19px;font-weight:700}" +
    ".sm-btn.alt{background:transparent;color:inherit;border-color:var(--line,#2a3a32)}.sm-btn[disabled]{opacity:.45}" +
    ".sm-h{font-size:17px;font-weight:700;margin:6px 0 0}" +
    ".sm-def{display:flex;gap:10px;align-items:center;border:1px solid var(--line,#2a3a32);border-radius:12px;padding:10px 12px}.sm-def span{flex:1;font-size:16px}" +
    ".sm-def button{min-height:44px;min-width:44px;border-radius:10px;border:1px solid var(--line,#2a3a32);background:transparent;color:inherit}" +
    ".sm-row{display:flex;gap:10px}.sm-row>.sm-in{flex:1}.sm-row>.sm-btn{width:auto;padding:0 20px}" +
    ".sm-pad{position:relative;border:2px solid var(--line,#2a3a32);border-radius:14px;background:#fff}.sm-pad canvas{display:block;width:100%;height:190px;touch-action:none}" +
    ".sm-pad button{position:absolute;right:8px;top:8px;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #bbb;background:#fff;color:#222;font-weight:600}" +
    ".sm-msg{font-size:15px;padding:10px 12px;border-radius:12px;border:1px solid var(--gold,#d4af37)}" +
    "@media (prefers-reduced-motion:no-preference){.sm-tile,.sm-unit{transition:none}}";
  document.head.appendChild(s);
}
function root() {
  var el = document.getElementById("siteMode");
  if (!el) { el = document.createElement("div"); el.id = "siteMode"; el.hidden = true; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}

function head(p, title, back) {
  return '<div class="sm-top">' + (back ? '<button class="sm-x" data-sm="home" aria-label="' + E(st("siteBack")) + '">‹</button>' : "") +
    "<h2>" + E(title) + '</h2><button class="sm-x" data-sm="close">' + E(st("siteClose")) + "</button></div>";
}
function pageHome(p) {
  var s = site(p), U = units(p), pr = EBSite.progress(s, U), n = photoCount(p);
  return head(p, st("siteTitle")) + '<div class="sm-body"><div class="sm-proj">' + E(p.name || "") + (p.client ? " · " + E(p.client) : "") + "</div>" +
    '<button class="sm-tile" data-sm="survey"><b>' + E(st("siteSurvey")) + "</b><span>" + E(st("siteSurveyS")) + "</span></button>" +
    '<button class="sm-tile" data-sm="photo"><b>' + E(st("sitePhoto")) + "</b><span>" + E(n ? st("sitePhotoS", { n: n }) : st("sitePhotoNo")) + "</span></button>" +
    '<button class="sm-tile" data-sm="mount"><b>' + E(st("siteMount")) + "</b><span>" + E(st("siteMountS", { n: pr.done, m: pr.total })) + '</span><div class="sm-bar" style="width:100%"><i style="width:' + pr.pct + '%"></i></div></button>' +
    '<button class="sm-tile" data-sm="receipt"><b>' + E(st("siteReceipt")) + (s.receipt ? " ✓" : "") + "</b><span>" + E(s.receipt ? st("siteSignedBy", { name: s.receipt.name }) : st("siteReceiptS", { n: EBSite.checksDone(s) })) + "</span></button></div>";
}
function pageMount(p) {
  var s = site(p), U = units(p), pr = EBSite.progress(s, U);
  var h = head(p, st("siteMount"), true) + '<div class="sm-body"><div class="sm-proj">' + E(st("siteMountS", { n: pr.done, m: pr.total })) + '</div><div class="sm-bar"><i style="width:' + pr.pct + '%"></i></div>';
  if (!U.length) h += '<div class="sm-msg">' + E(st("siteNoUnits")) + "</div>";
  U.forEach(function (u) {
    var on = !!s.mounted[u.id];
    h += '<button class="sm-unit' + (on ? " on" : "") + '" data-mount="' + E(u.id) + '" aria-pressed="' + on + '"><span class="sm-n">' + E(u.name) + "<small>" + E(st("sitePcs", { n: u.pcs })) + "</small></span>" +
      '<span class="sm-tick">' + E(on ? "✓ " + st("siteFitted") : st("siteToFit")) + "</span></button>";
  });
  if (U.length) h += '<div class="sm-proj">' + E(st("siteTapUndo")) + "</div>";
  return h + "</div>";
}
function pageReceipt(p) {
  var s = site(p), U = units(p), pr = EBSite.progress(s, U), r = s.receipt;
  var h = head(p, st("siteReceipt"), true) + '<div class="sm-body"><div class="sm-h">' + E(st("siteChecks")) + "</div>";
  for (var i = 1; i <= EBSite.CHECKS; i++) {
    var on = !!s.check[i];
    h += '<button class="sm-unit' + (on ? " on" : "") + '" data-check="' + i + '" aria-pressed="' + on + '"><span class="sm-n">' + E(ck(i)) + '</span><span class="sm-tick" style="min-width:56px">' + (on ? "✓" : "") + "</span></button>";
  }
  h += '<div class="sm-h">' + E(st("siteDefects")) + "</div>";
  s.defects.forEach(function (d) { h += '<div class="sm-def"><span>' + E(d.text) + '</span><button data-defdel="' + E(d.id) + '" aria-label="' + E(st("siteRemove")) + '">✕</button></div>'; });
  h += '<div class="sm-row"><input class="sm-in" id="smDef" placeholder="' + E(st("siteDefectPh")) + '" maxlength="' + EBSite.TEXT_MAX + '"><button class="sm-btn alt" data-sm="defadd">' + E(st("siteAdd")) + "</button></div>";
  if (r) {
    h += '<div class="sm-msg"><b>' + E(st("siteSignedBy", { name: r.name })) + "</b> · " + E(dateStr(r.at)) + (r.partial ? "<br>" + E(st("sitePartial", { n: r.mounted, m: r.total })) : "") + '</div>' +
      '<img alt="" src="' + E(r.sig) + '" style="background:#fff;border-radius:12px;max-height:140px;object-fit:contain">' +
      '<button class="sm-btn" data-sm="print">' + E(st("sitePv")) + '</button><button class="sm-btn alt" data-sm="unsign">' + E(st("siteUnsign")) + "</button>";
  } else {
    h += '<div class="sm-h">' + E(st("siteName")) + '</div><input class="sm-in" id="smName" autocomplete="name" value="' + E(p.client || "") + '">' +
      '<div class="sm-h">' + E(st("siteSignHere")) + '</div><div class="sm-pad"><canvas id="smPad"></canvas><button data-sm="padclear">' + E(st("siteClear")) + "</button></div>" +
      (pr.done < pr.total ? '<div class="sm-msg">' + E(st("siteWarnPart", { k: pr.total - pr.done })) + "</div>" : "") +
      '<button class="sm-btn" data-sm="sign">' + E(st("siteSign")) + "</button>";
  }
  return h + "</div>";
}

function render() {
  var p = P(), el = root();
  if (!p) { el.innerHTML = head(null, st("siteTitle")) + '<div class="sm-body"><div class="sm-msg">' + E(st("siteNoProj")) + "</div></div>"; return; }
  var keepDef = document.getElementById("smDef") ? document.getElementById("smDef").value : "";
  var keepName = document.getElementById("smName") ? document.getElementById("smName").value : null;
  el.innerHTML = page === "mount" ? pageMount(p) : page === "receipt" ? pageReceipt(p) : pageHome(p);
  if (page === "receipt") {
    var d = document.getElementById("smDef"); if (d) d.value = keepDef;
    var n = document.getElementById("smName"); if (n && keepName != null) n.value = keepName;
    padInit();
  }
}

/* ---------- semnătura pe ecran ---------- */
function padClear() {
  var c = document.getElementById("smPad"); if (!c) return;
  var r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  c.width = Math.max(10, r.width * dpr); c.height = Math.max(10, r.height * dpr);
  var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  g.lineWidth = 2.6; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#15241c";
  pad.drawn = false; pad.last = null;
}
function padInit() {
  var c = document.getElementById("smPad"); if (!c) return;
  padClear();
  var pt = function (e) { var r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener("pointerdown", function (e) { c.setPointerCapture(e.pointerId); pad.last = pt(e); e.preventDefault(); });
  c.addEventListener("pointermove", function (e) {
    if (!pad.last) return; var q = pt(e), g = c.getContext("2d");
    g.beginPath(); g.moveTo(pad.last[0], pad.last[1]); g.lineTo(q[0], q[1]); g.stroke(); pad.last = q; pad.drawn = true;
  });
  var up = function () { pad.last = null; };
  c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
}
function padData() {
  var c = document.getElementById("smPad"); if (!c || !pad.drawn) return null;
  var w = 560, h = Math.round(w * c.height / c.width), o = document.createElement("canvas");
  o.width = w; o.height = h; var g = o.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(c, 0, 0, w, h);
  return o.toDataURL("image/png");
}

/* ---------- procesul-verbal tipărit ---------- */
function pvHtml(p) {
  var s = site(p), r = s.receipt, U = units(p);
  var T = function (k) { return (window.EBCommerce && EBCommerce.t) ? EBCommerce.t(state.lang, k) : k; };
  var mounted = U.filter(function (u) { return s.mounted[u.id]; }).map(function (u) { return u.name; });
  var h = '<div class="pr-head"><div><h1>' + E(T("hoTitle")) + '</h1><div style="font-size:9pt">' + E(T("hoSub")) + "</div>" +
    '<div style="font-size:11pt;margin-top:4px"><b>' + E(T("hoWork")) + ":</b> " + E(p.name) + "<br><b>" + E(t("client")) + ":</b> " + E(r.name) +
    "<br><b>" + E(T("hoDate")) + ":</b> " + E(dateStr(r.at)) + '</div></div><div class="co">' + (typeof prLogo === "function" ? prLogo() : "") + "<b>" + E(typeof prCoName === "function" ? prCoName() : "") + "</b><br>" + E(typeof prCoInfo === "function" ? prCoInfo() : "") + "</div></div>";
  h += '<h2 style="font-size:11pt;margin:12px 0 4px">' + E(st("sitePvUnits")) + " (" + r.mounted + "/" + r.total + ")</h2><div style=\"font-size:10.5pt\">" + E(mounted.length ? mounted.join(", ") : st("sitePvNone")) + "</div>";
  if (r.partial) h += '<p style="font-size:10.5pt"><b>' + E(st("sitePartial", { n: r.mounted, m: r.total })) + "</b></p>";
  h += '<h2 style="font-size:11pt;margin:12px 0 4px">' + E(T("hoChecks")) + "</h2>";
  for (var i = 1; i <= EBSite.CHECKS; i++) h += '<div style="margin:2.2mm 0;font-size:10.5pt">' + (s.check[i] ? "☑" : "☐") + " " + E(T("hoC" + i)) + "</div>";
  h += '<h2 style="font-size:11pt;margin:12px 0 4px">' + E(T("hoDefects")) + "</h2>";
  h += s.defects.length ? s.defects.map(function (d) { return '<div style="font-size:10.5pt;margin:1.5mm 0">• ' + E(d.text) + "</div>"; }).join("") : '<div style="font-size:10.5pt">' + E(st("sitePvNoDef")) + "</div>";
  h += '<div style="display:flex;gap:14mm;margin-top:12mm;font-size:9.5pt"><div style="flex:1"><img alt="" src="' + E(r.sig) + '" style="height:22mm;display:block"><div style="border-top:0.3mm solid #000;padding-top:1mm">' +
    E(T("hoClient")) + " — " + E(r.name) + " · " + E(st("sitePvSigned")) + '</div></div><div style="flex:1"><div style="height:22mm"></div><div style="border-top:0.3mm solid #000;padding-top:1mm">' + E(T("hoCompany")) + " — " + E(T("hoSign")) +
    '</div></div></div><div class="pr-foot"><span>' + E(T("hoNote")) + "</span><span>Ebanist · " + E(typeof prCoName === "function" ? prCoName() : "") + "</span></div>";
  return h;
}

/* ---------- acțiuni ---------- */
function open() {
  var p = P(); if (!p) { toast(st("siteNoProj")); return; }
  css(); page = "home"; var el = root(); el.hidden = false; render();
}
function close() { var el = document.getElementById("siteMode"); if (el) el.hidden = true; }

function onClick(e) {
  var el = e.target.closest("[data-sm],[data-mount],[data-check],[data-defdel]");
  if (!el) return;
  var p = P(); if (!p) { close(); return; }
  var a = el.dataset.sm;
  if (el.dataset.mount != null) { save(p, EBSite.toggleMounted(p.site, el.dataset.mount, Date.now())); return; }
  if (el.dataset.check != null) { save(p, EBSite.toggleCheck(p.site, +el.dataset.check)); return; }
  if (el.dataset.defdel != null) { save(p, EBSite.removeDefect(p.site, el.dataset.defdel)); return; }
  if (a === "close") { close(); return; }
  if (a === "home") { page = "home"; render(); return; }
  if (a === "mount" || a === "receipt") { page = a; render(); return; }
  if (a === "survey") { close(); if (typeof setView === "function") setView("survey"); return; }
  if (a === "photo") {
    if (typeof survey === "function") survey();
    try { svPhTarget = { kind: "site", ref: "general" }; } catch (x) {}
    var inp = document.getElementById("svPhotoIn"); if (inp) inp.click();
    return;
  }
  if (a === "defadd") {
    var d = document.getElementById("smDef"); if (!d || !d.value.trim()) return;
    save(p, EBSite.addDefect(p.site, d.value, (typeof uid === "function" ? uid() : String(Date.now())), Date.now())); return;
  }
  if (a === "padclear") { padClear(); return; }
  if (a === "sign") {
    var nm = document.getElementById("smName") ? document.getElementById("smName").value : "";
    var c = EBSite.canSign(nm, padData() ? "x" : "");
    if (!c.ok) { toast(c.why === "name" ? st("siteNeedName") : st("siteNeedSig")); return; }
    var r = EBSite.sign(p.site, units(p), nm, padData(), Date.now());
    if (r.ok) save(p, r.site);
    return;
  }
  if (a === "unsign") { if (window.confirm(st("siteUnsignQ"))) save(p, EBSite.unsign(p.site)); return; }
  if (a === "print") {
    if (!site(p).receipt) return;
    if (typeof proGateSample === "function" && !proGateSample("doc")) return;
    close();
    document.getElementById("printArea").innerHTML = pvHtml(p);
    printOut();
  }
}

function boot() {
  var proj = document.getElementById("v-projects"); if (!proj) return;
  css();
  /* intrarea: un card sus în Proiecte */
  var anchor = proj.querySelector(".btnrow");
  if (anchor && !document.getElementById("btnSiteMode")) {
    var b = document.createElement("button");
    b.className = "btn"; b.id = "btnSiteMode"; b.type = "button"; b.style.cssText = "width:100%;margin-top:8px;min-height:56px;justify-content:flex-start;gap:12px;text-align:left";
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M3 21h18M5 21V10l7-6 7 6v11M10 21v-6h4v6"/></svg><span><b id="btnSiteModeT"></b><br><small id="btnSiteModeS" style="opacity:.75"></small></span>';
    anchor.insertAdjacentElement("afterend", b);
    b.addEventListener("click", open);
  }
  paintLabels();
  document.addEventListener("click", function (e) { var r = document.getElementById("siteMode"); if (r && !r.hidden && r.contains(e.target)) onClick(e); });
  var inp = document.getElementById("svPhotoIn");
  if (inp) inp.addEventListener("change", function () { setTimeout(function () { var r = document.getElementById("siteMode"); if (r && !r.hidden) render(); }, 1200); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
}
function paintLabels() {
  var a = document.getElementById("btnSiteModeT"), b = document.getElementById("btnSiteModeS");
  if (a) a.textContent = st("siteBtn"); if (b) b.textContent = st("siteBtnSub");
}
/* limba se schimbă din Setări: eticheta cardului și ecranul deschis o urmează */
document.addEventListener("click", function () { setTimeout(function () { paintLabels(); var r = document.getElementById("siteMode"); if (r && !r.hidden && page !== "receipt") render(); }, 60); }, true);

window.EBSiteUI = { open: open, close: close, pvHtml: pvHtml, S18: S18, st: st };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
