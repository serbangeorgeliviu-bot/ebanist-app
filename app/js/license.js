"use strict";
/* ===========================================================================
   Ebanist — app/js/license.js

   Licenza Pro e cancelli: cosa e' aperto senza chiave, cosa chiede
   l'abbonamento, come si attiva una chiave gia' comprata e come si
   ricontrolla ogni tanto senza bloccare chi lavora offline.
   =========================================================================== */
/* ================= PRO: LICENZA E CANCELLI =================
   Un livello solo — Pro — e quattro cancelli. La regola generale: il
   cancello si chiude PRIMA che l'utente faccia il lavoro, mai dopo. Far
   generare una distinta e poi rifiutare di stamparla e il modo migliore
   di far disinstallare l'app.

   Quello che il gratuito NON perde mai: i progetti che ha gia, il
   calcolo, il 3D a schermo, il backup, la sincronizzazione. Un limite
   che ti tiene in ostaggio il lavoro fatto non e un limite, e un
   ricatto — e in officina si passa alla concorrenza. */

const FREE_PROJECTS=2;
const LIC_KEY="ebanist_lic";       // specchio sincrono in localStorage
const DEV_KEY="ebanist_dev";       // identita di QUESTO dispositivo, stabile
let LIC=null;                      // la licenza in cache (o null)
let PRO=false, PRO_REASON="none";

/* Lo specchio in localStorage esiste per una ragione sola: allo start
   bisogna sapere SUBITO se stampare la filigrana, e IndexedDB risponde
   troppo tardi. Chi lo modifica a mano si sblocca il Pro: e cosi in ogni
   app che decide offline, e la difesa vera e altrove (le chiavi scadono
   e si ricontrollano). Non ci si spende una riga di piu. */
function licLoadSync(){
  try{ const raw=localStorage.getItem(LIC_KEY); LIC=raw?JSON.parse(raw):null; }catch(e){ LIC=null; }
  refreshPro();
}
function licWrite(lic){
  LIC=lic;
  try{ lic?localStorage.setItem(LIC_KEY,JSON.stringify(lic)):localStorage.removeItem(LIC_KEY); }catch(e){}
  try{ EBStore.set("license",lic||null).catch(()=>{}); }catch(e){}
  refreshPro();
}
function refreshPro(){
  const st=EBLicense.proFrom(LIC);
  const was=PRO;
  PRO=st.pro; PRO_REASON=st.reason;
  if(was!==PRO){ try{ paintProBadge(); render(); }catch(e){} }
  else { try{ paintProBadge(); }catch(e){} }
}
/* În mod atelier nu clientul plătește aplicația — atelierul i-o oferă.
   Deci toate limitele cad: filigranul, zidul celor două proiecte,
   pachetul de laborator, exportul JPG. Un singur loc pentru toate patru,
   fiindcă toate patru întreabă `isPro()`. */
function atelierMode(){ return !!(window.OrderRail&&OrderRail.active()); }
function isPro(){ return PRO||atelierMode(); }
/* I progetti che contano per il limite. Quello di esempio, creato dalla
   app al primo avvio, NON conta: e materiale nostro, e occupare con esso
   meta della quota gratuita vorrebbe dire far sbattere l'utente contro
   il muro al SECONDO progetto suo, non al terzo. Appena lo tocca (lo
   rinomina, lo duplica) smette di essere un esempio e conta. */
function ownProjects(){ return state.projects.filter(p=>!p.demo).length; }

/* L'identita del dispositivo, come compare nel cruscotto Lemon Squeezy.
   Deve essere STABILE: se cambiasse a ogni avvio, un utente solo
   brucerebbe il limite di attivazioni in una settimana. */
function deviceName(){
  let id="";
  try{ id=localStorage.getItem(DEV_KEY)||""; }catch(e){}
  if(!id){
    id=uid();
    try{ localStorage.setItem(DEV_KEY,id); }catch(e){}
    try{ EBStore.set("device",id).catch(()=>{}); }catch(e){}
  }
  let kind="PC";
  try{
    const ua=navigator.userAgent||"";
    if(/iPhone|iPod/.test(ua)) kind="iPhone";
    else if(/iPad/.test(ua)||(/Macintosh/.test(ua)&&(navigator.maxTouchPoints||0)>1)) kind="iPad";
    else if(/Android/.test(ua)) kind="Android";
    else if(/Macintosh/.test(ua)) kind="Mac";
  }catch(e){}
  return "Ebanist "+kind+" "+id.slice(-6);
}

/* ---- attivazione ----
   Un solo campo, un solo bottone: l'utente incolla quello che ha e
   l'app capisce da sola quale dei due formati e. Chiedergli «che tipo di
   chiave hai?» vorrebbe dire fargli una domanda a cui non puo rispondere. */
async function proActivate(raw){
  const key=EBLicense.normalize(raw);
  const kind=EBLicense.keyKind(key);
  if(kind==="unknown") return {ok:false,msg:t("proBadShape")};

  if(kind==="legacy"){
    if(!EBLicense.legacyValid(key)) return {ok:false,msg:t("proBadKey")};
    licWrite({kind:"legacy",key:key,valid:true,activated:true,checkedAt:Date.now()});
    askPersist();
    return {ok:true};
  }

  let j;
  try{ j=await EBLicense.activate(key,deviceName()); }
  catch(e){ return {ok:false,msg:t("proNoNet")}; }

  if(!j||j.activated!==true){
    const err=String((j&&j.error)||"");
    if(/activation limit/i.test(err)) return {ok:false,msg:t("proLimitReached")};
    return {ok:false,msg:err||t("proBadKey")};
  }
  const lic=EBLicense.shapeFromResponse(j,null);
  lic.key=key;
  /* Un negozio puo vendere piu prodotti. Se il variant id e configurato,
     una chiave di Plaquist non deve sbloccare Ebanist. */
  if(BILLING.LS_VARIANT_ID!=null && lic.variantId!=null &&
     String(lic.variantId)!==String(BILLING.LS_VARIANT_ID)){
    return {ok:false,msg:t("proWrongProduct")};
  }
  licWrite(lic);
  askPersist();
  return {ok:true};
}

/* ---- ricontrollo periodico ----
   Ogni 7 giorni, e SOLO se c'e rete. Un errore di rete non toglie niente
   a nessuno: si riprova la volta dopo. Solo una risposta chiara del
   server («questa chiave e scaduta / revocata») cambia lo stato. */
async function licRecheck(force){
  if(!LIC||LIC.kind!=="ls"||!LIC.key) return;
  if(!force&&!EBLicense.needsRecheck(LIC)) return;
  if(navigator.onLine===false) return;
  let j;
  try{ j=await EBLicense.validate(LIC.key,LIC.instanceId||null); }
  catch(e){ return; }                       // offline o server muto: non succede niente
  if(!j||typeof j.valid!=="boolean") return;
  const lk=j.license_key||{};
  const next=Object.assign({},LIC,{
    status:lk.status||LIC.status,
    expiresAt:lk.expires_at!==undefined?lk.expires_at:LIC.expiresAt,
    checkedAt:Date.now()
  });
  /* `valid:false` con una chiave che non esiste piu (rimborso, ordine
     cancellato): il server e stato raggiunto e ha detto no. */
  if(j.valid===false&&!lk.status) next.status="disabled";
  licWrite(next);
}

async function proDeactivate(){
  if(!LIC) return {ok:true};
  if(LIC.kind==="ls"&&LIC.key&&LIC.instanceId){
    try{ await EBLicense.deactivate(LIC.key,LIC.instanceId); }catch(e){}
  }
  licWrite(null);
  return {ok:true};
}

/* ---- memoria protetta ----
   Si chiede nei due momenti in cui l'utente ha appena dimostrato che
   quei dati gli interessano: quando salva il primo progetto e quando
   paga. Chiederla all'avvio, prima che ci sia qualcosa dentro, e il modo
   sicuro di farsela negare. */
let persistAsked=false;
function askPersist(){
  if(persistAsked) return;
  persistAsked=true;
  EBStore.persist().catch(()=>{});
}

/* ---- il cancello ----
   `why` decide la frase in cima allo schermo Pro: chi arriva li deve
   leggere il motivo per cui e stato fermato, non un listino. */
function proGate(why){
  if(isPro()) return true;
  openPro(why);
  return false;
}
/* Il cancello dei progetti conta PRIMA di aprire bocca: `proGate` da solo
   mostrerebbe il listino anche a chi sta creando il suo primo progetto. */
function gateNewProject(){
  if(isPro()) return true;
  if(ownProjects()<FREE_PROJECTS) return true;
  openPro("projects");
  return false;
}
/* Una barra rossa che non se ne va da sola: il backup e l'unica via d'uscita,
   quindi il bottone la propone direttamente. */
function storageAlarm(){
  let bar=$("storageBar");
  if(!bar){
    bar=document.createElement("div"); bar.id="storageBar";
    bar.style.cssText="position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + 12px);z-index:320;"+
      "background:#8c1d1d;color:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;"+
      "gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);font-size:14px;line-height:1.35";
    document.body.appendChild(bar);
  }
  bar.innerHTML=`<span style="flex:1">${esc(t("storageFull"))}</span>`+
    `<button style="flex:none;background:#fff;color:#8c1d1d;border:none;border-radius:8px;`+
    `font-weight:700;padding:8px 12px">${esc(t("storageFullBtn"))}</button>`;
  bar.style.display="flex";
  bar.querySelector("button").addEventListener("click",()=>{ $("btnFullBk").click(); });
  haptic(60);
}
const t = k => (I18N[state.lang]||I18N.it)[k] || I18N.it[k] || k;
const proj = () => state.projects.find(p=>p.id===state.activeId) || null;
/* L'apostrofo entra nella lista: oggi nessun attributo interpolato usa le
   virgolette semplici, ma il giorno che ne comparisse uno — `style='...'` —
   un nome di progetto con un apostrofo aprirebbe un buco senza che nessuno
   colleghi le due cose. Costa un carattere. */
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (n,d=2) => n.toLocaleString(state.lang==="en"?"en-GB":state.lang==="ro"?"ro-RO":state.lang==="fr"?"fr-FR":"it-IT",{minimumFractionDigits:d,maximumFractionDigits:d});

