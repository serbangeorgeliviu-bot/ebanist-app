"use strict";
/* ===========================================================================
   Domus / Ebanist — site.js

   La pagina di presentazione: le quattro lingue e il collegamento al
   checkout. Estratta da index.html perche la CSP del sito non concede piu
   'unsafe-inline' agli script.
   =========================================================================== */
var T={
ro:{h1:"De la măsurători, la lista de debitare. În aceeași zi.",
 lede:"Ebanist proiectează corpul, îți dă lista de debitare, eticheta fiecărei piese și fișa de asamblare — pe telefon, în șantier, fără internet.",
 ctaFree:"Încearcă gratuit", ctaPro:"Vezi prețul",
 noAccount:"Fără cont, fără instalare. Se deschide în browser și merge offline.",
 b1t:"Listă de debitare în 2 minute",
 b1d:"Alegi tipul de corp, scrii cotele, apeși „Generează”. Piese, canturi, optimizare pe colă și cantitatea de ABS — calculate, nu estimate.",
 b2t:"Etichete cu schema de cant",
 b2d:"O foaie A4 cu eticheta fiecărei piese: cotă, material și pe ce laturi merge cantul. Se lipesc pe piese la debitare și nu se mai încurcă nimic.",
 b3t:"Fișă de asamblare pentru client",
 b3d:"Desen izometric, desen 2D cotat, feronerie Blum/Häfele cu coduri și deviz. PDF-uri de dat mai departe, cu firma ta pe ele.",
 vidT:"Aici vine filmul de 15 secunde",
 vidD:"De la cotele scrise pe telefon la PDF-ul cu lista de debitare — o singură trecere, fără tăieturi de montaj.",
 priceT:"Preț", freeAmt:"0 €", freePer:"gratuit, fără limită de timp",
 f1:"2 proiecte", f2:"Toate tipurile de corpuri, 3D și calculul complet", f3:"PDF-uri cu filigran",
 freeBtn:"Începe gratuit",
 proPer:"pe lună, TVA inclus",
 p1:"Proiecte nelimitate", p2:"PDF fără filigran", p3:"Pachet JSON pentru centrul de debitare", p4:"Export JPG al randării 3D",
 proBtn:"Ia Pro", yearly:"Sau {y} pe an — două luni cadou",
 vatNote:"Plata e procesată de Lemon Squeezy, care e vânzătorul înregistrat. Anulezi când vrei; proiectele rămân ale tale.",
 lTerms:"Termeni", lPrivacy:"Confidențialitate", lRefund:"Rambursare",
 foot:"Ebanist — Domus Renov SRL, CUI RO47806657, Bacău, România."},
it:{h1:"Dalle misure alla distinta di taglio. Lo stesso giorno.",
 lede:"Ebanist disegna il mobile, ti da la distinta di taglio, l'etichetta di ogni pezzo e la scheda di montaggio — sul telefono, in cantiere, anche senza rete.",
 ctaFree:"Prova gratis", ctaPro:"Vedi il prezzo",
 noAccount:"Niente account, niente installazione. Si apre nel browser e funziona offline.",
 b1t:"Distinta di taglio in 2 minuti",
 b1d:"Scegli la tipologia, scrivi le quote, premi «Genera». Pezzi, bordi, ottimizzazione sulla lastra e metri di ABS: calcolati, non stimati.",
 b2t:"Etichette con lo schema del bordo",
 b2d:"Un A4 con l'etichetta di ogni pezzo: quota, materiale e su quali lati va il bordo. Si attaccano ai pezzi al taglio e non si sbaglia piu niente.",
 b3t:"Scheda di montaggio per il cliente",
 b3d:"Assonometria, disegno 2D quotato, ferramenta Blum/Häfele con i codici e preventivo. PDF da consegnare, con la tua azienda sopra.",
 vidT:"Qui va il filmato di 15 secondi",
 vidD:"Dalle quote scritte sul telefono al PDF della distinta — una passata sola, senza tagli di montaggio.",
 priceT:"Prezzo", freeAmt:"0 €", freePer:"gratis, senza scadenza",
 f1:"2 progetti", f2:"Tutte le tipologie, il 3D e il calcolo completo", f3:"PDF con filigrana",
 freeBtn:"Comincia gratis",
 proPer:"al mese, IVA inclusa",
 p1:"Progetti illimitati", p2:"PDF senza filigrana", p3:"Pacchetto JSON per il centro di taglio", p4:"Export JPG della resa 3D",
 proBtn:"Passa a Pro", yearly:"Oppure {y} all'anno — due mesi in regalo",
 vatNote:"Il pagamento lo gestisce Lemon Squeezy, che e il venditore registrato. Disdici quando vuoi; i progetti restano tuoi.",
 lTerms:"Termini", lPrivacy:"Privacy", lRefund:"Rimborsi",
 foot:"Ebanist — Domus Renov SRL, CUI RO47806657, Bacau, Romania."},
fr:{h1:"Des mesures à la liste de débit. Le jour même.",
 lede:"Ebanist dessine le meuble, vous donne la liste de débit, l'étiquette de chaque pièce et la fiche de montage — sur le téléphone, sur le chantier, même sans réseau.",
 ctaFree:"Essayer gratuitement", ctaPro:"Voir le prix",
 noAccount:"Pas de compte, pas d'installation. Ça s'ouvre dans le navigateur et ça marche hors ligne.",
 b1t:"Liste de débit en 2 minutes",
 b1d:"Choisissez le type de meuble, saisissez les cotes, appuyez sur « Générer ». Pièces, chants, optimisation sur panneau et mètres d'ABS : calculés, pas estimés.",
 b2t:"Étiquettes avec le schéma de chant",
 b2d:"Une A4 avec l'étiquette de chaque pièce : cote, matériau et sur quels côtés va le chant. On les colle sur les pièces à la découpe et plus rien ne se mélange.",
 b3t:"Fiche de montage pour le client",
 b3d:"Perspective, dessin 2D coté, quincaillerie Blum/Häfele avec les références et devis. Des PDF à remettre, à votre en-tête.",
 vidT:"Ici vient la vidéo de 15 secondes",
 vidD:"Des cotes saisies sur le téléphone au PDF de la liste de débit — une seule passe, sans coupe de montage.",
 priceT:"Prix", freeAmt:"0 €", freePer:"gratuit, sans limite de durée",
 f1:"2 projets", f2:"Tous les types de meubles, la 3D et le calcul complet", f3:"PDF avec filigrane",
 freeBtn:"Commencer gratuitement",
 proPer:"par mois, TVA incluse",
 p1:"Projets illimités", p2:"PDF sans filigrane", p3:"Paquet JSON pour le centre de découpe", p4:"Export JPG du rendu 3D",
 proBtn:"Passer à Pro", yearly:"Ou {y} par an — deux mois offerts",
 vatNote:"Le paiement est traité par Lemon Squeezy, vendeur enregistré. Résiliez quand vous voulez ; vos projets restent les vôtres.",
 lTerms:"Conditions", lPrivacy:"Confidentialité", lRefund:"Remboursement",
 foot:"Ebanist — Domus Renov SRL, CUI RO47806657, Bacău, Roumanie."},
en:{h1:"From the site measurements to the cutting list. Same day.",
 lede:"Ebanist designs the unit and hands you the cutting list, a label for every part and the assembly sheet — on your phone, on site, with no network.",
 ctaFree:"Try it free", ctaPro:"See the price",
 noAccount:"No account, no install. It opens in the browser and works offline.",
 b1t:"Cutting list in 2 minutes",
 b1d:"Pick the type, type the sizes, hit «Generate». Parts, edging, board nesting and metres of ABS: calculated, not guessed.",
 b2t:"Labels with the edging diagram",
 b2d:"One A4 sheet with a label for every part: size, material and which edges get banded. Stick them on at the saw and nothing gets mixed up.",
 b3t:"Assembly sheet for the client",
 b3d:"Exploded view, dimensioned 2D drawing, Blum/Häfele hardware with part numbers and a quote. PDFs to hand over, with your company on them.",
 vidT:"The 15-second clip goes here",
 vidD:"From sizes typed on the phone to the cutting-list PDF — one pass, no editing tricks.",
 priceT:"Price", freeAmt:"0 €", freePer:"free, no time limit",
 f1:"2 projects", f2:"Every unit type, the 3D view and the full costing", f3:"Watermarked PDFs",
 freeBtn:"Start free",
 proPer:"per month, VAT included",
 p1:"Unlimited projects", p2:"PDFs without watermark", p3:"JSON package for the cutting centre", p4:"JPG export of the 3D render",
 proBtn:"Get Pro", yearly:"Or {y} a year — two months free",
 vatNote:"Payment is handled by Lemon Squeezy, the registered seller. Cancel any time; your projects stay yours.",
 lTerms:"Terms", lPrivacy:"Privacy", lRefund:"Refunds",
 foot:"Ebanist — Domus Renov SRL, CUI RO47806657, Bacău, Romania."}
};

/* La lingua: prima quella scelta a mano (resta nel browser), poi quella del
   telefono, poi il romeno. Nessun cookie: localStorage, e se il browser lo
   rifiuta si riparte dalla lingua del sistema — non si rompe niente. */
var LS_KEY="ebanist_landing_lang";
function pick(){
  try{
    var q=new URLSearchParams(location.search).get("lang");
    if(q&&T[q]) return q;
    var saved=localStorage.getItem(LS_KEY);
    if(saved&&T[saved]) return saved;
  }catch(e){}
  var list=navigator.languages||[navigator.language||""];
  for(var i=0;i<list.length;i++){
    var c=String(list[i]||"").slice(0,2).toLowerCase();
    if(T[c]) return c;
  }
  return "ro";
}
var LANG=pick();

function euros(s){ return String(s||"").replace(/\s*€$/,"") + " €"; }

function paint(){
  var d=T[LANG]||T.ro;
  document.documentElement.lang=LANG;
  var nodes=document.querySelectorAll("[data-t]");
  for(var i=0;i<nodes.length;i++){
    var k=nodes[i].getAttribute("data-t");
    if(d[k]!=null) nodes[i].textContent=d[k];
  }
  /* Il prezzo lo dice billing.js, non questa pagina: due listini che
     divergono sono il modo piu rapido di litigare con un cliente. */
  document.getElementById("proAmt").textContent=euros(BILLING.PRICE_MONTHLY);
  var y=document.getElementById("buyY");
  y.textContent=(d.yearly||"").replace("{y}",euros(BILLING.PRICE_YEARLY));

  var btns=document.querySelectorAll("#langs button");
  for(var j=0;j<btns.length;j++) btns[j].className=(btns[j].getAttribute("data-l")===LANG?"on":"");

  /* La lingua viaggia fino all'app: chi ha appena scelto «RO» qui non deve
     ritrovarsi l'app in italiano. */
  var q="?lang="+encodeURIComponent(LANG);
  var free=document.querySelectorAll('a[href="/app/"]');
  for(var k2=0;k2<free.length;k2++) free[k2].setAttribute("href","/app/"+q);

  /* I due bottoni d'acquisto: se il negozio non e ancora configurato,
     invece di un link rotto si manda l'utente all'app, che sa spiegare la
     situazione e accetta comunque una chiave. */
  var m=document.getElementById("buyM");
  if(BILLING.configured){
    m.setAttribute("href",BILLING.buyUrl("monthly",""));
    y.setAttribute("href",BILLING.buyUrl("yearly",""));
    m.setAttribute("rel","noopener");
    y.setAttribute("rel","noopener");
  }else{
    m.setAttribute("href","/app/"+q);
    y.setAttribute("href","/app/"+q);
  }
}
document.getElementById("langs").addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b) return;
  LANG=b.getAttribute("data-l");
  try{ localStorage.setItem(LS_KEY,LANG); }catch(err){}
  paint();
});
paint();

/* Chi ha gia usato l'app arriva qui solo per sbaglio (un preferito vecchio,
   il redirect del service worker): lo si porta dentro invece di fargli
   leggere una pagina di presentazione che non gli serve. Si guarda la
   chiave storica: se ci sono progetti, questa persona non e un visitatore. */
try{
  if(localStorage.getItem("tagliapro")&&!location.search){
    location.replace("/app/");
  }
}catch(e){}
