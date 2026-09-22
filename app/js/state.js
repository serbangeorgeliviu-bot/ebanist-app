"use strict";
/* ===========================================================================
   Ebanist — app/js/state.js

   Il progetto di esempio, lo stato dell'applicazione e il suo magazzino:
   lettura e scrittura in localStorage, riallineamento con IndexedDB
   all'avvio, copia automatica. Qui dentro stanno anche i due cataloghi —
   ferramenta (Blum/Häfele) e materiali — perche sono dati, non codice.
   =========================================================================== */
/* ================= SEED DATA (progetto di esempio) ================= */
const MAT18 = "Truciolare Bilaminato Bianco lucido 18mm";
const MAT25 = "Truciolare Bilaminato Bianco 25mm";
const SEED_PIECES = [
["Piano Scrivania","Pannello Top/Mensola",1300,300,1,"2L+2C",MAT25],
["Piano Scrivania","Pannello Top/Mensola",1880,300,1,"2L+2C",MAT18],
["Piede laterale scrivania","Pannello Top/Mensola",775,500,1,"2L+2C",MAT18],
["Frontale scrivania","Pannello Top/Mensola",1200,600,1,"2L+2C",MAT18],
["Cassettiera Scrivania","Fianco",600,500,2,"2L+2C",MAT18],
["Cassettiera Scrivania","Base / Cielo",264,500,2,"1L",MAT18],
["Cassettiera Scrivania","Ripiano mobile",264,480,1,"1L",MAT18],
["Cassettiera Scrivania","Anta",596,296,1,"2L+2C",MAT18],
["Libreria","Fianco",775,282,2,"2L+2C",MAT18],
["Libreria","Base / Cielo",1844,282,2,"1L",MAT18],
["Libreria","Tramezzo",739,262,2,"1L",MAT18],
["Libreria","Ripiano mobile",600,262,4,"1L",MAT18],
["Libreria","Ripiano mobile",608,262,2,"1L",MAT18],
["Schienale libreria","Pannello Top/Mensola",1880,775,1,"2L+2C",MAT18]
];

/* ================= STATE & STORAGE ================= */
const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
let state = null;
/* La lingua del telefono, se e una di quelle che parliamo. Prima l'app
   partiva sempre in italiano: un falegname di Bacau o di Nizza apriva il
   link e trovava una lingua che non e la sua, con il bottone per
   cambiarla sepolto in fondo alle impostazioni. La scelta esplicita
   dell'utente resta e vince: questa funzione gira solo alla prima
   accensione. Il `?lang=` della pagina di presentazione ha la
   precedenza — l'utente l'ha appena scelto li. */
function detectLang(){
  try{
    const q=new URLSearchParams(location.search).get("lang");
    if(q&&["it","ro","en","fr"].indexOf(q)>=0) return q;
  }catch(e){}
  try{
    const list=navigator.languages||[navigator.language||""];
    for(const raw of list){
      const c=String(raw||"").slice(0,2).toLowerCase();
      if(["it","ro","en","fr"].indexOf(c)>=0) return c;
    }
  }catch(e){}
  return "it";
}
function defaultState(){
  const pieces = SEED_PIECES.map(r => ({id:uid(),modulo:r[0],elemento:r[1],lung:r[2],larg:r[3],pz:r[4],bordo:r[5],materiale:r[6]}));
  /* Il progetto di partenza e un ESEMPIO, e si dichiara tale: `demo:1` lo
     tiene fuori dal conto dei due progetti gratuiti (non e roba
     dell'utente) e gli fa prendere il nome nella sua lingua all'avvio.
     Il nome del cliente vero non ci sta piu: chi arriva su ebanist.com da
     un link non deve trovarsi davanti la commessa di qualcun altro. */
  const p = {id:uid(),name:"Ebanist demo",client:"",date:new Date().toISOString().slice(0,10),pieces,geomVersion:1,demo:1};
  return {lang:detectLang(),activeId:p.id,projects:[p],
    settings:{panelL:2800,panelW:2070,decor_directional:false,kerf:4,priceM2:42,priceMl:1.2,waste:15,labor:0,hourly:35,
      coName:"",coInfo:"",margin:30,iva:20,
      hwCern:1.4,hwGuida:6.5,hwMan:3.5,hwSup:0.08,hwAsta:1.2,hwPied:0.9,hwBin:45,hwConn:0.35,hwPush:2.5,
      hwProd:{cern:"blum_71b3550",guida:"blum_tandem",man:"gen_man",sup:"haf_sup",asta:"gen_asta",pied:"haf_axilo",bin:"haf_slido",conn:"haf_minifix",push:"blum_tipon_a"},
      /* IL PROGETTO NUOVO PARTE DA 19 mm. Centro Legno lavora quasi solo in
         19: partire da 18 vuol dire che la grossezza giusta e sempre una
         correzione da ricordarsi, e quella che si dimentica e la causa dei
         due incidenti. Lo schienale resta HDF da 3: non e un decoro. */
      hwOvr:{}, matOvr:{}, matBody:"bianco_19", matFront:"bianco_19", matBack:"pfl3", stockMin:250, doorW:800, doorH:2050,
      costMode:"area", presetAdd:[]},
    stock:[]};
}
/* ===== CATALOGO FERRAMENTA (Blum / Häfele) — prezzi e codici modificabili ===== */
const HWDB={
 cern:[
  {id:"blum_71b3550",brand:"Blum",n:{it:"CLIP top BLUMOTION 110° + basetta CLIP",ro:"CLIP top BLUMOTION 110° + plăcuță CLIP",en:"CLIP top BLUMOTION 110° + CLIP plate",fr:"CLIP top BLUMOTION 110° + embase CLIP"},art:"71B3550 + 173L6100",price:3.6},
  {id:"blum_71t3550",brand:"Blum",n:{it:"CLIP top 110° + basetta CLIP",ro:"CLIP top 110° + plăcuță CLIP",en:"CLIP top 110° + CLIP plate",fr:"CLIP top 110° + embase CLIP"},art:"71T3550 + 173L6100",price:2.4},
  {id:"blum_71b7550",brand:"Blum",n:{it:"CLIP top BLUMOTION 155° + basetta",ro:"CLIP top BLUMOTION 155° + plăcuță",en:"CLIP top BLUMOTION 155° + plate",fr:"CLIP top BLUMOTION 155° + embase"},art:"71B7550 + 173L6100",price:7.2},
  {id:"haf_metalla",brand:"Häfele",n:{it:"Metalla 510 A/SM 110° in applique + basetta",ro:"Metalla 510 A/SM 110° aplicată + plăcuță",en:"Metalla 510 A/SM 110° full overlay + plate",fr:"Metalla 510 A/SM 110° en applique + embase"},art:"329.17.100 + 329.73.608",price:1.7},
  {id:"haf_duomatic",brand:"Häfele",n:{it:"Metalla 510 A/SM 110° incassata + basetta",ro:"Metalla 510 A/SM 110° încastrată + plăcuță",en:"Metalla 510 A/SM 110° inset + plate",fr:"Metalla 510 A/SM 110° encloisonnée + embase"},art:"329.17.103 + 329.73.608",price:2.1}],
 guida:[
  {id:"blum_tandem",brand:"Blum",n:{it:"TANDEM BLUMOTION estr. totale (cp.)",ro:"TANDEM BLUMOTION extragere totală (per.)",en:"TANDEM BLUMOTION full ext. (pair)",fr:"TANDEM BLUMOTION sortie totale (paire)"},art:"560H___B",price:17},
  {id:"blum_movento",brand:"Blum",n:{it:"MOVENTO BLUMOTION (cp.)",ro:"MOVENTO BLUMOTION (per.)",en:"MOVENTO BLUMOTION (pair)",fr:"MOVENTO BLUMOTION (paire)"},art:"760H___B",price:25},
  {id:"blum_230m",brand:"Blum",n:{it:"Guida a rulli 230M (cp.)",ro:"Glisieră cu role 230M (per.)",en:"230M roller slide (pair)",fr:"Coulisse à galets 230M (paire)"},art:"230M____",price:4.8},
  {id:"haf_ball",brand:"Häfele",n:{it:"Guida a sfere estr. totale 45kg (cp.)",ro:"Glisieră bile extragere totală 45kg (per.)",en:"Ball-bearing slide full ext. 45kg (pair)",fr:"Coulisse à billes sortie totale 45kg (paire)"},art:"422.13.xxx",price:7.5,chk:1},
  {id:"haf_matrix",brand:"Häfele",n:{it:"Matrix Box P cassetto metallico (set)",ro:"Matrix Box P sertar metalic (set)",en:"Matrix Box P metal drawer (set)",fr:"Matrix Box P tiroir métallique (kit)"},art:"551.48.xxx",price:22,chk:1}],
 man:[
  {id:"gen_man",brand:"—",n:{it:"Maniglia generica",ro:"Mâner generic",en:"Generic handle",fr:"Poignée générique"},art:"—",price:3.5},
  {id:"haf_bar128",brand:"Häfele",n:{it:"Maniglia a barra inox 128mm",ro:"Mâner bară inox 128mm",en:"Stainless bar handle 128mm",fr:"Poignée barre inox 128mm"},art:"106.61.xxx",price:4.8,chk:1},
  {id:"haf_profil",brand:"Häfele",n:{it:"Profilo presa Gola/L",ro:"Profil prindere Gola/L",en:"Gola/L grip profile",fr:"Profil de prise Gola/L"},art:"126.36.xxx",price:6.0,chk:1},
  {id:"gen_pomo",brand:"—",n:{it:"Pomello",ro:"Buton",en:"Knob",fr:"Bouton"},art:"—",price:2.2}],
 sup:[
  {id:"haf_sup",brand:"Häfele",n:{it:"Supporto ripiano ø5 con sicura, 15,6 kg",ro:"Suport poliță ø5 cu siguranță, 15,6 kg",en:"Shelf support ø5 with safety pin, 15.6 kg",fr:"Taquet ø5 avec sécurité, 15,6 kg"},art:"282.24.720",price:0.12},
  {id:"gen_sup",brand:"—",n:{it:"Supporto ø5 semplice",ro:"Suport ø5 simplu",en:"Plain ø5 support",fr:"Taquet ø5 simple"},art:"—",price:0.05}],
 asta:[
  {id:"gen_asta",brand:"—",n:{it:"Supporto asta ovale",ro:"Suport bară ovală",en:"Oval rail support",fr:"Support tringle ovale"},art:"—",price:0.9},
  {id:"haf_asta",brand:"Häfele",n:{it:"Supporto asta ovale a vite",ro:"Suport bară ovală cu șurub",en:"Oval rail support, screw-on",fr:"Support tringle ovale à vis"},art:"801.35.xxx",price:1.4,chk:1}],
 pied:[
  {id:"haf_axilo",brand:"Häfele",n:{it:"Piedino AXILO 78 regolabile",ro:"Picior AXILO 78 reglabil",en:"AXILO 78 adjustable foot",fr:"Pied AXILO 78 réglable"},art:"637.79.xxx",price:1.3,chk:1},
  {id:"gen_pied",brand:"—",n:{it:"Piedino regolabile M10",ro:"Picior reglabil M10",en:"Adjustable foot M10",fr:"Pied réglable M10"},art:"—",price:0.6}],
 bin:[
  {id:"haf_slido",brand:"Häfele",n:{it:"Slido Classic 40 (set/anta)",ro:"Slido Classic 40 (set/ușă)",en:"Slido Classic 40 (set/door)",fr:"Slido Classic 40 (kit/porte)"},art:"400.51.xxx",price:29,chk:1},
  {id:"gen_sevroll",brand:"—",n:{it:"Sistema scorrevole tipo Sevroll (set/anta)",ro:"Sistem glisant tip Sevroll (set/ușă)",en:"Sevroll-type sliding system (set/door)",fr:"Système coulissant type Sevroll (kit/porte)"},art:"—",price:38}],
 conn:[
  {id:"haf_minifix",brand:"Häfele",n:{it:"Minifix 15 (legno ≥16mm) + perno + spina",ro:"Minifix 15 (lemn ≥16mm) + bolț + diblu",en:"Minifix 15 (wood ≥16mm) + bolt + dowel",fr:"Minifix 15 (bois ≥16mm) + boulon + tourillon"},art:"262.26.033 + boulon",price:0.48,chk:1},
  {id:"gen_confirmat",brand:"—",n:{it:"Vite Confirmat 7×50",ro:"Confirmat 7×50",en:"Confirmat screw 7×50",fr:"Vis Confirmat 7×50"},art:"—",price:0.07},
  {id:"haf_rafix",brand:"Häfele",n:{it:"Rafix 20 + perno + spina 8×35",ro:"Rafix 20 + bolț + diblu 8×35",en:"Rafix 20 + bolt + dowel 8×35",fr:"Rafix 20 + boulon + tourillon 8×35"},art:"263.10.xxx",price:0.55,chk:1}],
 push:[
  {id:"blum_tipon_a",brand:"Blum",n:{it:"TIP-ON anta, versione lunga + placchetta",ro:"TIP-ON ușă, versiune lungă + plăcuță",en:"TIP-ON for doors, long version + plate",fr:"TIP-ON porte, version longue + plaque"},art:"956A1004 + adapter",price:4.5},
  {id:"blum_tipon_t",brand:"Blum",n:{it:"TIP-ON BLUMOTION per TANDEM (set)",ro:"TIP-ON BLUMOTION pt. TANDEM (set)",en:"TIP-ON BLUMOTION for TANDEM (set)",fr:"TIP-ON BLUMOTION pour TANDEM (kit)"},art:"T60L7540",price:14},
  {id:"haf_pushlatch",brand:"Häfele",n:{it:"Push-latch magnetico",ro:"Push-latch magnetic",en:"Magnetic push latch",fr:"Loqueteau magnétique push"},art:"356.11.xxx",price:1.9,chk:1}]
};
function hwItem(cat){ const S=state.settings, id=(S.hwProd||{})[cat];
  const it=(HWDB[cat]||[]).find(x=>x.id===id)||null;
  if(!it) return null;
  const eff=Object.assign({},it,(S.hwOvr||{})[it.id]||{});
  eff.name=(it.n||{})[state.lang]||(it.n||{}).it||"";
  return eff; }
/* ===== CATALOGO MATERIALI ================================================
 * Il catalogo NON sta piu nel codice. Sta in due file JSON, in /data/, e si
 * carica all'avvio:
 *
 *   data/materials-centro-legno.json  il catalogo vivo, quello del fornitore
 *   data/materials-legacy.json        le referenze gia usate dai progetti
 *                                     salvati — non si cancellano MAI
 *
 * Perche due file e non uno: un id che sparisce dal catalogo rende
 * inesportabile ogni progetto che lo usa. Le vecchie referenze restano
 * risolvibili (`attivo:false` = non compaiono nei selettori, ma un progetto
 * che le nomina si apre e si esporta lo stesso).
 *
 * Il file porta lo schema della specifica (nome, codice, spessore, famiglia,
 * colore_hex, colore_verificato, bordo_abs, prezzo_mq…). L'app legge da anni
 * un'altra forma (th, price, c, tx, pw, ph, label). L'adattatore qui sotto e
 * l'UNICO posto dove si passa dall'una all'altra: due schemi, una conversione.
 */
const MAT_SOURCES=["./data/materials-centro-legno.json","./data/materials-legacy.json"];
/* `var` e non `let`: questi devono essere PROPRIETA del globale, perche il
   banco di prova valuta questo stesso blocco in un contesto suo e li legge
   da li. Un `let` resterebbe chiuso nello scope dello script, e la prova
   misurerebbe una copia invece del file vero. */
var MATDB=[];                      // il catalogo vivo, riempito all'avvio
var MAT_LOADED=false, MAT_LOAD_ERR=null;

/* La famiglia decide come si disegna il pannello in 3D quando il file non
   dichiara la sua texture. */
const TEX_BY_FAM={legno:"wood",lucido:"gloss",tessuto:"solid",cemento:"solid",tinta_unita:"solid"};

/* Dallo schema del file a quello che l'app legge. I campi di catalogo
   (codice, famiglia, colore_verificato…) viaggiano CON la referenza: il
   selettore li mostra senza andarseli a cercare da un'altra parte. */
function matFromCatalog(m){
  const nome=m.nome||m.id||"";
  const l=m.nome_i18n||{it:nome,ro:nome,en:nome,fr:nome};
  const f=m.formato||null;
  const bordo=m.bordo_abs||null;
  return {
    id:m.id, l:l, th:+m.spessore,
    /* prezzo non ancora rilevato = 0: il preventivo usa allora il prezzo
       generale del progetto, e non finge un costo che nessuno ha letto. */
    price:(m.prezzo_mq==null?0:+m.prezzo_mq),
    c:m.colore_hex||"#e8e8e4",
    tx:m.texture||TEX_BY_FAM[m.famiglia]||"solid",
    pw:f?f.L:null, ph:f?f.l:null,
    sup:(m.fornitore&&m.fornitore!=="—")?m.fornitore:"",
    noEdge:(bordo&&bordo.disponibile===false)?1:0,
    codice:m.codice||null,
    famiglia:m.famiglia||"tinta_unita",
    finitura:m.finitura||"melaminico",
    coloreVerificato:!!m.colore_verificato,
    bordoAbs:bordo,
    attivo:m.attivo!==false
  };
}
/* La via inversa: serve all'esportazione del catalogo, che deve uscire nello
   schema del file, non in quello interno. */
function matToCatalog(x){
  const eff=matById(x.id)||x;
  return {
    id:x.id, nome:(x.l&&x.l.it)||x.nome||x.id,
    nome_i18n:x.l||undefined,
    codice:eff.codice||null, fornitore:eff.sup||"—",
    spessore:+eff.th, famiglia:eff.famiglia||"tinta_unita",
    finitura:eff.finitura||"melaminico",
    colore_hex:eff.c||null, colore_verificato:!!eff.coloreVerificato,
    texture_url:null,
    bordo_abs:eff.bordoAbs||{disponibile:!eff.noEdge,spessori:[0.8,2],codice:null},
    prezzo_mq:(eff.price===0?null:+eff.price),
    attivo:eff.attivo!==false,
    formato:(eff.pw&&eff.ph)?{L:eff.pw,l:eff.ph}:null,
    texture:eff.tx||"solid"
  };
}
async function loadMaterials(){
  const all=[], seen={};
  for(const url of MAT_SOURCES){
    let doc=null;
    /* un tentativo, poi un secondo: in cantiere la rete va e viene, e un
       catalogo mancante ferma tutto. Il service worker li tiene in cache. */
    for(let k=0;k<2&&!doc;k++){
      try{ const r=await fetch(url,{cache:"no-cache"}); if(r.ok) doc=await r.json(); }catch(e){}
    }
    if(!doc||!Array.isArray(doc.materiali)){ MAT_LOAD_ERR=url; continue; }
    for(const m of doc.materiali){
      if(!m||!m.id||seen[m.id]) continue;      // il primo file vince
      if(!(+m.spessore>0)) continue;           // spessore scalare e > 0, o non e una referenza
      seen[m.id]=1; all.push(matFromCatalog(m));
    }
  }
  MATDB=all; MAT_LOADED=all.length>0;
  try{
    if(typeof fillMatSelects==="function") fillMatSelects();
    if(typeof render==="function"&&state) render();
  }catch(e){}
  return MATDB;
}
/* Fuori dal browser — nelle prove golden, che valutano questo stesso file in
   un contesto senza `fetch` — il catalogo lo fornisce il banco di prova. Non
   si chiama un caricatore che non ha niente da cui caricare. */
var MAT_READY=(typeof fetch==="function")?loadMaterials():null;
/* catalogo = referenze di serie + quelle aggiunte a mano; quelle nascoste spariscono
   dalle liste ma restano risolvibili, se un progetto vecchio le usa ancora. */
function matAll(){ return MATDB.concat((state.settings&&state.settings.matAdd)||[]); }
/* SI VEDE O NO: una domanda, una risposta, un posto solo.
   Prima ce n'erano due — il catalogo guardava solo l'override, il selettore
   guardava anche `attivo` — e il risultato era che un pannello compariva nel
   catalogo ma non nel selettore, e il bottone «mostra» aveva bisogno di due
   tocchi per fare effetto. Due sorgenti di verita su una cosa sola: lo
   stesso guasto che questo rilascio ripara, in piccolo.

   E la risposta e cambiata: NASCONDE SOLO CHI L'HA CHIESTO. `attivo:false`
   dice da quale listino viene una referenza, non che va fatta sparire.
   Nascondere di mia iniziativa un decoro che sta su un progetto aperto —
   il Rovere Sonoma della camera Petrelli — vuol dire toglierlo di mano a
   qualcuno mentre lo sta usando. L'ordine delle liste puo cambiare; quello
   che si puo scegliere, no. */
function matHidden(m){
  const ref=(m&&typeof m==="object")?m:matAll().find(x=>x.id===m);
  if(!ref) return false;
  const o=((state.settings||{}).matOvr||{})[ref.id]||{};
  return !!o.hidden;
}
function matVisible(){ return matAll().filter(m=>!matHidden(m)); }
/* Il listino vivo prima, quello di prima dopo: si vedono tutte, ma quelle
   che il fornitore tiene ancora a magazzino stanno in cima. */
function matIsLegacy(m){ return !!(m&&m.attivo===false); }
function matById(id){ const m=matAll().find(x=>x.id===id);
  if(!m) return null;
  const eff=Object.assign({},m,(state.settings.matOvr||{})[id]||{});
  eff.label=(m.l||{})[state.lang]||(m.l||{}).it||"";
  return eff; }
/* L'etichetta del materiale di struttura del progetto. Se non ce n'e uno,
   stringa vuota: si lascia scegliere, non si indovina una grossezza. */
function defaultMatLabel(){
  const S=(state&&state.settings)||{};
  const m=S.matBody?matById(S.matBody):null;
  return m?m.label:"";
}
function matRawByLabel(label){ return matAll().find(x=>x.l&&Object.values(x.l).includes(label)); }
function matByLabel(label){ const m=matRawByLabel(label); return m?matById(m.id):null; }
/* Lista de prețuri a atelierului e cheiată pe ID de material, nu pe
   eticheta tradusă: aceeași placă se numește altfel în fiecare limbă, iar
   un preț legat de text s-ar pierde la prima schimbare de limbă. */
function matIdByLabel(label){ const m=matRawByLabel(label); return m?m.id:null; }
/* Bara de umeraș, piciorușele, geamul: sunt piese în distinta, dar nu se
   taie din placă. Aplicația le marchează de mult cu prefixul
   „Accessorio —" și le scoate din m² în nesting, în costuri și în stoc.
   Prețul atelierului folosește EXACT aceeași regulă — o a doua ar
   însemna că o comandă costă altfel decât arată devizul intern. */
function isAccessoryMat(label){ return /^accessorio/i.test(String(label||"")); }
function matDecorByLabel(label){
  const m=matRawByLabel(label);
  if(!m) return "";
  const o=(state.settings.matOvr||{})[m.id];
  return o&&o.decor?o.decor:"";
}
function matPriceByLabel(label){
  const m=matRawByLabel(label);
  if(m){ const o=(state.settings.matOvr||{})[m.id]; return o&&o.price!=null?o.price:m.price; }
  return state.settings.priceM2;
}
/* formato del pannello: quello della referenza, altrimenti quello generale delle impostazioni */
function panelFor(label){
  const m=matByLabel(label), S=state.settings;
  return {L:(m&&m.pw)||S.panelL, W:(m&&m.ph)||S.panelW};
}
/* La chiave storica. NON si rinomina e NON si cancella mai: e l'unico
   posto dove stanno i progetti di chi usa l'app da prima di IndexedDB, e
   resta la copia sincrona che fa partire l'app senza aspettare niente. */
const LS_KEY="tagliapro";
const LS_AT_KEY="tagliapro_at";      // quando e stata scritta, per il confronto con IndexedDB
let bootFromLS=false;                // l'avvio ha trovato qualcosa in localStorage?

function loadState(){
  try{const raw=localStorage.getItem(LS_KEY);if(raw){const s=JSON.parse(raw);if(s&&s.projects){s.settings=Object.assign({},defaultState().settings,s.settings||{});if(!Array.isArray(s.stock))s.stock=[];stampGeomVersion(s);bootFromLS=true;return s;}}}catch(e){}
  return defaultState();
}
function lsSavedAt(){ try{ return parseInt(localStorage.getItem(LS_AT_KEY),10)||0; }catch(e){ return 0; } }
/* Un progetto senza `geomVersion` e stato calcolato col motore v1 — tutto
   quello che arriva dalla chiave storica `tagliapro` lo e. Si marca e basta:
   NON si ricalcola niente. Chi ha in mano quel progetto puo aver gia debitato
   con quelle cote, e riscriverle in silenzio sarebbe un danno peggiore di
   quello che questo rilascio ripara. */
function stampGeomVersion(st){
  for(const p of (st&&st.projects)||[]) if(p.geomVersion==null) p.geomVersion=1;
  return st;
}
/* La scrittura durevole NON puo fallire in silenzio. In cantiere, offline,
   localStorage e l'unico posto dove esiste il lavoro della giornata: con un
   `catch{}` vuoto il telefono pieno rispondeva "Salvato" e la sera si perdeva
   tutto. Adesso lo dice, e resta scritto finche non si fa il backup. */
let storageBroken=false;
let lsOk=true;                 // l'ultima scrittura in localStorage e riuscita?
let idbOk=EBStore.available(); // ...e quella in IndexedDB?
let idbTimer=null, bkTimer=null;
/* Finche il riallineamento non ha finito di leggere, non si scrive: lo
   stato in memoria adesso e solo un'ipotesi, e IndexedDB potrebbe avere
   la verita. Una scrittura qui cancellerebbe i progetti di chi ha appena
   perso localStorage. */
let idbReady=false, idbPending=false;

function persist(){
  const now=Date.now();
  let json=null;
  try{ json=JSON.stringify(state); }catch(e){ json=null; }
  try{
    if(json==null) throw new Error("serialize");
    localStorage.setItem(LS_KEY,json);
    localStorage.setItem(LS_AT_KEY,String(now));
    lsOk=true;
  }catch(e){ lsOk=false; }

  /* IndexedDB e la copia DUREVOLE: localStorage sta stretto in 5 MB e su
     un telefono pieno smette di accettare scritture a meta giornata. La
     scrittura si accumula (debounce): `persist()` viene chiamata a ogni
     tasto premuto in un modulo, e una transazione per tasto e sprecata. */
  if(!idbReady){ idbPending=true; }
  else{
    if(idbTimer) clearTimeout(idbTimer);
    idbTimer=setTimeout(idbFlush,400);
  }

  /* Se localStorage ha detto no ma IndexedDB era buono fino a un attimo
     fa, NON si urla: si aspetta l'esito della scrittura vera. L'allarme
     rosso vuol dire «il lavoro di oggi non esiste da nessuna parte», e
     mostrarlo quando invece i dati sono al sicuro insegna a ignorarlo. */
  if(!lsOk&&!idbOk) storageMaybeAlarm();

  scheduleAutoBackup();
  if(typeof scheduleSync==="function") scheduleSync();
}
function idbFlush(){
  idbTimer=null; idbPending=false;
  return EBStore.set("state",{savedAt:Date.now(),state:state}).then(()=>{
    idbOk=true; storageOkAgain();
  },()=>{
    idbOk=false; storageMaybeAlarm();
  });
}
function storageMaybeAlarm(){
  if(lsOk||idbOk) return;
  if(storageBroken) return;
  storageBroken=true; try{ storageAlarm(); }catch(e){}
}
function storageOkAgain(){
  if(!storageBroken) return;
  storageBroken=false;
  const bar=$("storageBar"); if(bar) bar.style.display="none";
}

/* ---- riallineamento con IndexedDB, all'avvio ----
   L'app parte SINCRONA da localStorage — deve disegnarsi subito, e
   IndexedDB e asincrono. Subito dopo si guarda cosa c'e nel magazzino
   durevole e si decide chi ha ragione:

     localStorage vuoto, IndexedDB pieno  → localStorage e stato
       cancellato (iOS, pulizia del browser, «svuota i dati»): si
       recupera tutto da IndexedDB. E' IL CASO PER CUI ESISTE QUESTO
       CODICE.
     tutti e due pieni  → vince il piu recente. Non si fondono: due
       versioni dello stesso progetto non si sommano, e inventare una
       fusione qui vorrebbe dire duplicare pezzi in una distinta.
     IndexedDB vuoto  → prima accensione dopo l'aggiornamento: si migra
       quello che c'e, senza toccare la chiave storica.  */
async function hydrateFromIDB(){
  try{ await hydrateRead(); }
  finally{
    /* Da qui in poi si puo scrivere. Il `finally` non e prudenza
       generica: se la lettura fallisce e le scritture restassero chiuse,
       l'app lavorerebbe tutto il giorno senza salvare niente in IndexedDB
       e nessuno se ne accorgerebbe. */
    idbReady=true;
    if(idbPending) idbFlush();
  }
}
async function hydrateRead(){
  let rec=null;
  try{ rec=await EBStore.get("state"); }catch(e){ idbOk=false; return; }
  idbOk=true;
  if(!rec||!rec.state||!Array.isArray(rec.state.projects)){
    /* migrazione: quello che c'e adesso in memoria va messo al sicuro. */
    idbPending=true;
    return;
  }
  const mine=bootFromLS?lsSavedAt():0;
  if(mine && mine>=(rec.savedAt||0)) return;      // localStorage e piu fresco: si tiene
  const s=rec.state;
  s.settings=Object.assign({},defaultState().settings,s.settings||{});
  if(!Array.isArray(s.stock))s.stock=[];
  stampGeomVersion(s);
  /* la lingua e una preferenza del dispositivo, non del backup */
  s.lang=state.lang;
  state=s;
  try{ localStorage.setItem(LS_KEY,JSON.stringify(state)); localStorage.setItem(LS_AT_KEY,String(rec.savedAt||Date.now())); }catch(e){}
  applyLang(); render();
}

/* ---- copia automatica ----
   Uno slot a parte dentro IndexedDB, che NON e lo stato: se lo stato si
   corrompe o qualcuno cancella il progetto sbagliato, questa resta. Si
   scrive al massimo una volta ogni cinque minuti e solo se i progetti
   sono davvero cambiati — altrimenti a ogni tasto premuto si riscrive
   mezzo megabyte e il telefono si riempie di copie identiche. */
const AUTO_BK_EVERY=5*60000;
let lastAutoBk=0, lastAutoBkSig="";
function scheduleAutoBackup(){
  if(bkTimer) return;
  bkTimer=setTimeout(()=>{
    bkTimer=null;
    if(Date.now()-lastAutoBk<AUTO_BK_EVERY) return;
    let json;
    try{ json=JSON.stringify({ebanist_backup:1,ver:APP_VER,date:new Date().toISOString(),
      state:{projects:state.projects,settings:state.settings}}); }catch(e){ return; }
    const sig=json.length+":"+state.projects.length;
    if(sig===lastAutoBkSig) return;
    lastAutoBk=Date.now(); lastAutoBkSig=sig;
    EBStore.putBackup({id:"auto-"+lastAutoBk,at:lastAutoBk,ver:APP_VER,json:json})
      .then(()=>EBStore.pruneBackups(5)).catch(()=>{});
  },30000);
}

