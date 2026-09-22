"use strict";
/* ===========================================================================
   Ebanist — app/js/ui.js

   I mattoni dell'interfaccia, quelli usati da tutto il resto: $(), tema
   chiaro/scuro, toast, il dialogo unico che sostituisce alert/confirm/prompt,
   lo schermo Pro, l'invito «aggiungi a Home» e il tasto Indietro di Android.
   =========================================================================== */
/* ================= UI HELPERS ================= */
const $ = id => document.getElementById(id);

/* ================= TEMA =================
   "auto" segue il sistema e non scrive l'attributo, cosi la media query in CSS
   resta l'unica a decidere; "light"/"dark" mettono data-theme e vincono su di
   essa. La barra di stato del PWA segue, altrimenti al buio resta una striscia
   verde sopra un'app nera. */
const THEME_KEY="ebanist_theme";
function themeGet(){try{const v=localStorage.getItem(THEME_KEY);return v==="dark"||v==="light"?v:"auto";}catch(e){return "auto";}}
function themeSet(v){
  if(v!=="dark"&&v!=="light")v="auto";
  const r=document.documentElement;
  if(v==="auto")r.removeAttribute("data-theme"); else r.setAttribute("data-theme",v);
  try{v==="auto"?localStorage.removeItem(THEME_KEY):localStorage.setItem(THEME_KEY,v);}catch(e){}
  themeMeta();
}
function themeMeta(){
  const m=document.querySelector('meta[name="theme-color"]');
  if(!m)return;
  const dark=themeGet()==="dark"||(themeGet()==="auto"&&matchMedia("(prefers-color-scheme:dark)").matches);
  m.setAttribute("content",dark?"#141812":"#0E3B2A");
}
themeMeta();
matchMedia("(prefers-color-scheme:dark)").addEventListener("change",themeMeta);

let currentView="projects";
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("on");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("on"),2200);}

/* ================= DIALOGO UNICO =================
   `alert()` e `confirm()` del browser, dentro una PWA a schermo intero,
   sono una finestra di sistema che scrive l'indirizzo del sito in cima e
   spezza il colpo d'occhio; su iOS in standalone a volte non compaiono
   proprio. E soprattutto sono BLOCCANTI: la pagina si ferma, il 3D si
   inchioda. Un solo componente al loro posto, sempre lo stesso, in tutte
   e quattro le lingue.

   Ritorna una Promise: `true` se l'utente ha confermato, `false` se ha
   annullato o ha chiuso. Chi chiama la aspetta e basta. */
function dialog(opt){
  opt=opt||{};
  return new Promise(res=>{
    let ov=$("dlgOverlay");
    if(!ov){
      ov=document.createElement("div"); ov.id="dlgOverlay"; ov.className="dlg-ov";
      ov.innerHTML='<div class="dlg" role="dialog" aria-modal="true">'+
        '<h4 id="dlgTitle"></h4><div id="dlgBody"></div>'+
        '<div class="dlg-row"><button class="btn" id="dlgNo"></button>'+
        '<button class="btn red" id="dlgYes"></button></div></div>';
      document.body.appendChild(ov);
    }
    $("dlgTitle").textContent=opt.title||"";
    $("dlgTitle").style.display=opt.title?"block":"none";
    /* Il corpo accetta HTML perche alcuni messaggi hanno un elenco. Chi
       chiama passa SOLO testo gia passato da esc() o costanti nostre:
       niente nomi di progetto crudi qui dentro. */
    $("dlgBody").innerHTML=opt.html||("<p>"+esc(opt.text||"")+"</p>");
    const yes=$("dlgYes"), no=$("dlgNo");
    yes.textContent=opt.ok||t("dlgOk");
    no.textContent=opt.cancel||t("cancel");
    no.style.display=opt.confirm?"flex":"none";
    const close=v=>{ ov.classList.remove("on"); document.removeEventListener("keydown",onKey); res(v); };
    const onKey=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(false); } };
    yes.onclick=()=>close(true);
    no.onclick=()=>close(false);
    ov.onclick=e=>{ if(e.target===ov) close(false); };
    document.addEventListener("keydown",onKey);
    ov.classList.add("on");
    setTimeout(()=>{ try{
      const inp=$("dlgInput");
      if(inp){ inp.focus(); inp.select();
        inp.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); close(true); } };
      } else yes.focus();
    }catch(e){} },40);
  });
}
const confirmDlg=(text,title)=>dialog({text:text,title:title,confirm:true});
/* `prompt()` e l'ultima finestra di sistema rimasta: su iOS in standalone
   a volte non si apre proprio, e chi rinomina un materiale resta a
   guardare un bottone che non fa niente. Stesso componente, con un campo. */
async function promptDlg(text,value){
  const ok=await dialog({
    html:`<p>${esc(text||"")}</p><div class="f" style="margin-top:10px">`+
         `<input id="dlgInput" autocomplete="off" spellcheck="false" value="${esc(value||"")}"></div>`,
    confirm:true, ok:t("save")
  });
  if(!ok) return null;
  const el=$("dlgInput");
  return el?el.value:null;
}

/* ================= SCHERMO PRO =================
   Non un avviso: una pagina che dice cosa si sblocca, quanto costa e
   come si attiva una chiave gia comprata. Il motivo per cui l'utente e
   finito qui sta in cima, perche e la sola cosa che gli interessa. */
const PRO_WHY={projects:"proSubProjects",pdf:"proSubPdf",lab:"proSubLab",jpg:"proSubJpg"};
function openPro(why){
  renderPro(why); closeSheets(); openSheet("shPro");
}
function renderPro(why){
  const sub=(PRO_WHY[why]?t(PRO_WHY[why]):t("proSubPlain"))
    /* Il numero del progetto non puo mai leggersi piu piccolo del limite:
       questo schermo si vede solo quando il limite e pieno, e «sarebbe il
       primo» sarebbe una frase senza senso davanti a un muro. */
    .replace("{n}",FREE_PROJECTS).replace("{m}",Math.max(FREE_PROJECTS+1,ownProjects()+1));
  const feats=["proF1","proF2","proF3","proF4","proF5"]
    .map(k=>`<li>${esc(t(k))}</li>`).join("");
  let buy="";
  if(BILLING.configured){
    buy=`<button class="btn red" id="proBuyM">${esc(t("proBuyM").replace("{p}",BILLING.PRICE_MONTHLY))}</button>`+
        `<button class="btn" id="proBuyY" style="margin-top:8px">${esc(t("proBuyY").replace("{p}",BILLING.PRICE_YEARLY))}</button>`;
  }else{
    /* Segnaposto non compilati: meglio dirlo che mandare l'utente su un
       negozio che non esiste. */
    buy=`<p class="mini" style="color:var(--warn)">${esc(t("proNotConfigured"))}</p>`;
  }
  $("proBody").innerHTML=
    `<p style="margin-bottom:12px;line-height:1.45">${esc(sub)}</p>`+
    `<ul class="pro-feats">${feats}</ul>`+
    `<div style="margin-top:16px">${buy}</div>`+
    `<div class="eyebrow" style="margin-top:20px">${esc(t("proHaveKey"))}</div>`+
    `<div class="f"><input id="proKey" autocomplete="off" spellcheck="false" placeholder="${esc(t("proKeyPh"))}"></div>`+
    `<p class="mini" style="margin:-4px 0 8px">${esc(t("proKeyHint"))}</p>`+
    `<button class="btn" id="proGo">${esc(t("proActivate"))}</button>`+
    `<p class="mini" id="proMsg" style="margin-top:10px;min-height:1.2em"></p>`+
    `<p class="mini" style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap">`+
      `<a href="/termeni.html" target="_blank" rel="noopener">${esc(t("lTerms"))}</a>`+
      `<a href="/privacy.html" target="_blank" rel="noopener">${esc(t("lPrivacy"))}</a>`+
      `<a href="/rambursare.html" target="_blank" rel="noopener">${esc(t("lRefund"))}</a></p>`;
  const bm=$("proBuyM"), by=$("proBuyY");
  if(bm) bm.onclick=()=>openCheckout("monthly");
  if(by) by.onclick=()=>openCheckout("yearly");
  $("proGo").onclick=proSubmitKey;
  $("proKey").addEventListener("keydown",e=>{ if(e.key==="Enter") proSubmitKey(); });
}
async function proSubmitKey(){
  const btn=$("proGo"), msg=$("proMsg"), inp=$("proKey");
  const raw=inp.value.trim(); if(!raw){ inp.focus(); return; }
  btn.disabled=true; const old=btn.textContent; btn.textContent=t("proActivating");
  msg.style.color=""; msg.textContent="";
  const r=await proActivate(raw);
  btn.disabled=false; btn.textContent=old;
  if(r.ok){
    msg.style.color="var(--grn)"; msg.textContent=t("proActivated");
    toast(t("proActivated"));
    setTimeout(()=>{ closeSheets(); render(); },700);
  }else{
    msg.style.color="var(--warn)"; msg.textContent=r.msg||t("proBadKey");
  }
}
function openCheckout(plan){
  const url=BILLING.buyUrl(plan,knownEmail());
  if(!url){ toast(t("proNotConfigured")); return; }
  /* Una scheda nuova, non la stessa: se il checkout aprisse sopra l'app,
     un service worker che si aggiorna nel frattempo riporterebbe
     l'utente alla home a meta pagamento. */
  try{ window.open(url,"_blank","noopener"); }catch(e){ location.href=url; }
}
/* L'email la sappiamo solo se l'utente ha gia un account Supabase. Se
   c'e, si passa al checkout: un campo in meno da compilare col telefono
   in mano e i guanti addosso. */
function knownEmail(){
  try{ if(typeof authUser!=="undefined"&&authUser&&authUser.email) return authUser.email; }catch(e){}
  try{ if(LIC&&LIC.email) return LIC.email; }catch(e){}
  return "";
}

/* Il pallino sul bottone delle impostazioni: da lontano si vede subito
   se questa e la versione gratuita o quella pagata. */
function paintProBadge(){
  const b=$("btnSettings"); if(!b) return;
  b.classList.toggle("has-pro",PRO&&!atelierMode());
}

/* ================= INVITO «AGGIUNGI A HOME» (iOS) =================
   Una volta sola, e solo dove serve davvero: iPhone/iPad, dentro Safari,
   app non installata. In tutti gli altri casi non si dice niente —
   un consiglio che non riguarda chi lo legge insegna a chiudere gli
   avvisi senza leggerli. */
async function maybeIosTip(){
  if(!EBStore.atRiskOfEviction()) return;
  let meta=null;
  try{ meta=await EBStore.get("meta"); }catch(e){}
  if(meta&&meta.seenIosTip) return;
  try{ await EBStore.set("meta",Object.assign({},meta||{},{seenIosTip:Date.now()})); }catch(e){}
  await dialog({
    title:t("iosTipTitle"),
    html:`<p style="line-height:1.5">${esc(t("iosTip0"))}</p>`+
         `<ol style="margin:12px 0 0 18px;line-height:1.7">`+
         `<li>${esc(t("iosTip1"))}</li><li>${esc(t("iosTip2"))}</li><li>${esc(t("iosTip3"))}</li></ol>`,
    ok:t("iosTipGot")
  });
}

/* ================= NAVIGAZIONE HARDWARE (tasto Indietro Android) =================
   Il tasto fisico Indietro deve chiudere UNO strato per volta — mai l'app intera
   mentre c'e un pannello aperto. Lo stato non si tiene in una lista parallela (si
   disallinea al primo percorso dimenticato): si LEGGE dal DOM, che e l'unica
   verita. La history serve solo da contatore di profondita, e ogni voce porta
   scritta la profondita a cui appartiene: cosi anche un `go(-3)`, che su Chrome
   emette un solo popstate, si riallinea leggendo e.state invece di contare eventi. */
const NAV_HOME="projects";
const NAV={hist:0,silent:0,exitAt:0,on:false};
function navRoomOpen(){ const r=$("roomView"); return !!r && r.style.display!=="none"; }
function navSheets(){ return Array.from(document.querySelectorAll(".sheet.on")); }
/* profondita logica = quanti "indietro" servono per tornare alla schermata radice */
function navDepth(){
  return (currentView!==NAV_HOME?1:0) + (navRoomOpen()?1:0) + navSheets().length;
}
/* allinea la history alla profondita reale; da chiamare dopo ogni apertura/chiusura */
function navSync(){
  if(!NAV.on) return;
  const d=navDepth();
  if(d>NAV.hist){ while(NAV.hist<d){ NAV.hist++; history.pushState({eb:NAV.hist},""); } }
  else if(d<NAV.hist){ const k=NAV.hist-d; NAV.silent=1; NAV.hist=d; history.go(-k); }
}
/* chiude ESATTAMENTE uno strato, dal piu alto: roomView (z200) sta sopra i pannelli (z51) */
function navCloseTop(){
  if(navRoomOpen()){ if(typeof roomCamStop==="function") roomCamStop(); $("roomView").style.display="none"; return true; }
  const sh=navSheets();
  if(sh.length){
    sh[sh.length-1].classList.remove("on");
    if(!document.querySelectorAll(".sheet.on").length) $("scrim").classList.remove("on");
    return true;
  }
  if(currentView!==NAV_HOME){ setView(NAV_HOME,true); return true; }
  return false;
}
function navInit(){
  /* Serve una voce di scorta SOTTO quella su cui vive l'app. Senza, alla radice
     non c'e niente da estrarre: Android chiude l'app di colpo e popstate non
     scatta nemmeno — quindi "premi ancora per uscire" non si vedrebbe mai.
     Con la scorta: il 1° Indietro torna sulla scorta (popstate scatta, avvisiamo
     e risaliamo), il 2° parte dalla scorta e non trova piu niente: esce davvero. */
  try{ history.replaceState({eb:-1},""); history.pushState({eb:0},""); }catch(e){ return; }
  NAV.on=true; NAV.hist=0;
  window.addEventListener("popstate",function(e){
    /* la voce corrente dice a che profondita e tornato il browser: e piu affidabile
       che contare i popstate, perche go(-k) puo emetterne uno solo */
    const eb=(e.state&&typeof e.state.eb==="number")?e.state.eb:-1;
    NAV.hist=Math.max(0,eb);
    if(NAV.silent){ NAV.silent=0; return; }          // rientro da una chiusura fatta dalla UI
    if(navCloseTop()){ haptic(); navSync(); return; }
    /* radice: due pressioni per uscire, cosi non si perde il lavoro per un tocco distratto */
    if(Date.now()-NAV.exitAt<2200){ history.back(); return; }   // dalla scorta: esce
    NAV.exitAt=Date.now();
    NAV.hist=0; history.pushState({eb:0},"");                    // risali sulla voce dell'app
    toast(t("backExit"));
  });
  /* su desktop Esc fa lo stesso mestiere */
  document.addEventListener("keydown",function(e){
    if(e.key!=="Escape") return;
    if(navDepth()>0 && navCloseTop()){ navSync(); e.preventDefault(); }
  });
}

/* vibrazione cortissima sulle azioni di navigazione: in officina il telefono si
   guarda poco e si tocca con le mani sporche, un colpo secco dice "preso". */
function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||12); }catch(e){} }

/* Una X in ogni pannello. Prima si chiudevano solo toccando fuori o con
   "Annulla", che meta dei pannelli non ha: chi non conosce il gesto restava
   dentro. Si iniettano da qui una volta sola, cosi non vanno ricopiate a mano
   negli undici pannelli e non se ne dimentica uno al prossimo aggiunto. */
function mountSheetClosers(){
  document.querySelectorAll(".sheet").forEach(sh=>{
    if(sh.querySelector(".sheet-x")) return;
    const row=document.createElement("div"); row.className="sheet-xrow";
    const b=document.createElement("button");
    b.type="button"; b.className="sheet-x"; b.setAttribute("aria-label","Close");
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    b.addEventListener("click",()=>{
      haptic();
      sh.classList.remove("on");
      if(!document.querySelectorAll(".sheet.on").length) $("scrim").classList.remove("on");
      navSync();
    });
    row.appendChild(b); sh.insertBefore(row,sh.firstChild);
  });
}

function openSheet(id){$("scrim").classList.add("on");$(id).classList.add("on");navSync();}
function closeSheets(){$("scrim").classList.remove("on");document.querySelectorAll(".sheet").forEach(s=>s.classList.remove("on"));navSync();}
$("scrim").addEventListener("click",closeSheets);

function setView(v,fromBack){
  currentView=v;
  document.querySelectorAll(".view").forEach(el=>el.classList.remove("on"));
  $("v-"+v).classList.add("on");
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.view===v));
  $("fab").classList.toggle("on",v==="list"&&!!proj());
  render();
  window.scrollTo({top:0});
  if(!fromBack) navSync();
}
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));

/* Un data-i puo puntare a una QUALSIASI delle quattro tabelle. Prima passava
   solo da t(), che guarda in I18N: le due etichette del rilievo vivono in
   SURVEY_I18N, quindi a schermo — in tutte e quattro le lingue — compariva
   scritto "svRoom3D" e "svOpenDoors". Si cerca in ordine, I18N per prima cosi
   le chiavi esistenti non cambiano significato; e se una chiave non esiste da
   nessuna parte si lascia il testo gia scritto nell'HTML, che e sempre meglio
   del nome della chiave davanti al cliente. */
function tAny(k){
  for(const D of [I18N,SURVEY_I18N,AUTH_I18N,AI_I18N]){
    const v=(D[state.lang]||{})[k]; if(v!==undefined) return v;
    const f=(D.it||{})[k];          if(f!==undefined) return f;
  }
  return null;
}
function applyLang(){
  document.documentElement.lang=state.lang;
  document.querySelectorAll("[data-i]").forEach(el=>{
    const v=tAny(el.dataset.i); if(v!=null) el.textContent=v;
  });
  /* i segnaposto dei campi di ricerca cambiano lingua come tutto il resto */
  document.querySelectorAll("[data-ph]").forEach(el=>{
    const v=tAny(el.dataset.ph); if(v!=null) el.placeholder=v;
  });
  const navSv=$("navSurveyLbl"); if(navSv) navSv.textContent=ts("navSurvey");
  if(typeof aiMount==="function") aiMount();
}

