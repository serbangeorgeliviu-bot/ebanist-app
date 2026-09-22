"use strict";
/* ===========================================================================
   Ebanist — app/js/init.js

   L'avvio, in ordine e senza fretta: quello che deve esserci prima del
   primo disegno, e quello che puo' aspettare il secondo respiro.
   =========================================================================== */
/* ================= INIT ================= */
state=loadState();
/* La licenza si legge SUBITO e in modo sincrono, dallo specchio in
   localStorage: la prima stampa puo partire prima che IndexedDB abbia
   risposto, e stampare la filigrana addosso a chi ha pagato e peggio che
   non stamparla a chi non ha pagato. */
licLoadSync();
/* La lettura di IndexedDB parte adesso, non fra un secondo: e la sola
   cosa che sta fra un telefono ripulito e la giornata di lavoro di
   qualcuno. Tutto il resto dell'avvio la aspetta. */
const HYDRATED=hydrateFromIDB().catch(()=>{});
function bootAuth(){ initSupabase(); initAuth(); initSplash(); }
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bootAuth); else bootAuth();

/* ---- il resto dell'avvio, in ordine e senza fretta ----
   Prima si riallinea la memoria (puo SOSTITUIRE `state`), e solo dopo si
   guarda cosa mostrare: fare il contrario vorrebbe dire aprire l'intro a
   qualcuno che ha vent'anni di progetti dentro IndexedDB. */
async function bootDurable(){
  await HYDRATED;
  await licHydrate();
  /* IL CATALOGO PRIMA DI TUTTO IL RESTO. Da qui in giu si genera: il corpo
     di esempio, quello del modulo atelier. Senza materiali non c\'e
     grossezza, e senza grossezza non si deve produrre nessuna distinta. */
  await MAT_READY;
  if(!MAT_LOADED) toast(t("matCatMissing"));
  else { fillMatSelects(); render(); }

  /* Il progetto di esempio prende il nome nella lingua giusta. Appena
     l'utente lo tocca perde il marchio `demo` e questa riga smette di
     riguardarlo. */
  const d=state.projects.find(q=>q.demo);
  if(d&&d.name!==t("demoName")){ d.name=t("demoName"); persist(); render(); }

  /* Modul atelier pornește ÎNAINTE de intro și de invitațiile de backup:
     el decide limba, identitatea din header și corpul implicit, iar un
     panou deschis peste toate astea ar fi primul lucru pe care îl vede
     un client necunoscut. */
  if(OrderRail.active()){
    await orBoot();
    return;                       // în mod atelier nu se arată nici intro, nici Pro
  }

  /* Ritorno dal pagamento: `?activate=1` e l'indirizzo che si configura
     in Lemon Squeezy. Chi torna qui ha appena pagato e ha la chiave
     nell'email — il modulo si apre da solo, senza fargliela cercare. */
  let activate=false;
  try{ activate=new URLSearchParams(location.search).get("activate")==="1"; }catch(e){}
  if(activate&&!isPro()){
    openPro(null);
    try{ history.replaceState({},"",location.pathname); }catch(e){}
  }else if(!state.seenIntro){
    state.seenIntro=1; persist(); openSheet("shIntro");
  }else{
    await maybeIosTip();
    backupReminder();
  }

  /* Il ricontrollo dell'abbonamento non blocca niente e non parla:
     se non c'e rete, non succede nulla. */
  setTimeout(()=>{ licRecheck(false).catch(()=>{}); },3000);
}
setTimeout(()=>{ bootDurable().catch(()=>{}); },900);

/* La licenza sta anche in IndexedDB, per la stessa ragione dei progetti:
   quando localStorage viene svuotato, chi ha pagato non deve ritrovarsi
   in versione gratuita con la chiave da ricercare nell'email. */
async function licHydrate(){
  if(LIC&&LIC.key) return;                       // lo specchio bastava
  let rec=null;
  try{ rec=await EBStore.get("license"); }catch(e){ return; }
  if(!rec||!rec.key) return;
  licWrite(rec);                                  // riscrive anche lo specchio
}

/* ---- il promemoria del backup ----
   Prima suonava ogni 7 giorni. Adesso la domanda giusta e un'altra:
   «esiste una copia FUORI da questo telefono?» La copia automatica in
   IndexedDB non conta — se il telefono si perde, si perde con lei. Quindi
   il promemoria guarda l'ultimo export su FILE, e sotto i 30 giorni tace;
   passati quelli, insiste al massimo una volta a settimana. */
function backupReminder(){
  if(!state.projects.filter(q=>!q.demo).length) return;
  const now=Date.now();
  if(state.lastBk&&now-state.lastBk<30*864e5) return;
  if(state.lastBkNag&&now-state.lastBkNag<7*864e5) return;
  state.lastBkNag=now; persist();
  toast(state.lastBk?t("bkManualOld"):t("bkRemind"));
}
document.addEventListener("click",e=>{ if(e.target&&e.target.id==="btnIntroGo") closeSheets(); });
applyLang();
aiMount();
mountSheetClosers();
setView("projects");
navInit();
persist();
/* all'avvio, appena l'app e in piedi: se il motore sul server e piu avanti,
   meglio saperlo prima di generare una distinta che non si potra esportare. */
setTimeout(()=>{ try{ checkGeomVersion(); }catch(e){} },1200);
