"use strict";
/* ===========================================================================
   Ebanist — app/js/account.js

   Conto Supabase e sincronizzazione. Tutto opzionale e tutto silenzioso:
   se il modulo non c'e' o la rete manca, l'app funziona lo stesso.
   =========================================================================== */
/* ================= ACCOUNT (Supabase Auth — opzionale, non blocca l'app) ================= */
const SUPABASE_URL="https://drefnfezicawljkfsqsm.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_3dDu3Pbva2V6ypxVF1yRfg_aOtyl4PM";
let sb=null;
/* lo script Supabase è `defer`: il client si crea quando quello è stato eseguito.
   Offline non arriva mai — sb resta null e l'app funziona lo stesso. */
function initSupabase(){
  if(sb) return sb;
  if(window.supabase&&SUPABASE_URL&&SUPABASE_ANON_KEY){
    try{ sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); }catch(e){ sb=null; }
  }
  return sb;
}
let acctSession=null, acctProfile=null;

function renderAccount(){
  if(!$("shAccount"))return;
  $("acctTitle").textContent=ta("acctTitle");
  $("btnAcctForgot").textContent=ta("acctForgot");
  $("acctOfflineNote").textContent=ta("acctOffline");
  $("acctEmailLbl").textContent=ta("acctEmail");
  $("acctPasswordLbl").textContent=ta("acctPassword");
  $("btnAcctLogin").textContent=ta("acctLogin");
  $("btnAcctSignup").textContent=ta("acctSignup");
  $("acctLoggedInLbl").textContent=ta("acctLoggedInAs");
  $("acctRoleLbl").textContent=ta("acctRole");
  $("btnAcctLogout").textContent=ta("acctLogout");
  const loggedIn=!!acctSession;
  $("acctLoggedOut").style.display=loggedIn?"none":"block";
  $("acctLoggedIn").style.display=loggedIn?"block":"none";
  if(loggedIn){
    $("acctEmailShow").textContent=(acctSession.user&&acctSession.user.email)||"";
    $("acctRoleShow").textContent=acctProfile?acctProfile.role:"—";
  }
}

async function loadAcctProfile(){
  if(!sb||!acctSession){ acctProfile=null; return; }
  try{
    const {data}=await sb.from("profiles").select("*").eq("id",acctSession.user.id).single();
    acctProfile=data||null;
  }catch(e){ acctProfile=null; }
}

async function initAuth(){
  if(!sb) return;
  try{
    const {data}=await sb.auth.getSession();
    acctSession=data.session;
    await loadAcctProfile();
    renderAccount();
    if(acctSession) await pullAndMergeProjects();
    sb.auth.onAuthStateChange(async(_event,newSession)=>{
      if(_event==="PASSWORD_RECOVERY"){ acctSession=newSession; renderAccount(); openPwdSheet(); return; }
      const wasLoggedIn=!!acctSession;
      acctSession=newSession;
      await loadAcctProfile();
      renderAccount();
      if(acctSession&&!wasLoggedIn) await pullAndMergeProjects();
    });
  }catch(e){ /* offline o Supabase non raggiungibile — l'app continua a funzionare in locale */ }
}

/* ================= SYNC (Supabase — opzionale, FAZA 1.3) =================
   localStorage resta la cache offline; Supabase è la fonte di verità quando
   si è connessi. Regola: vince sempre l'updated_at più recente (last-write-wins),
   con avviso visibile in caso di conflitto reale (ROADMAP 1.5). */
const SYNC_META_KEY="tagliapro_sync_meta";
const SYNC_DEL_KEY="tagliapro_sync_del";
function loadSyncMeta(){ try{return JSON.parse(localStorage.getItem(SYNC_META_KEY))||{};}catch(e){return {};} }
function saveSyncMeta(m){ try{localStorage.setItem(SYNC_META_KEY,JSON.stringify(m));}catch(e){} }
let syncMeta=loadSyncMeta();
/* Le cancellazioni sono un FATTO, non l'assenza di un fatto: senza tenerne
   nota, un progetto cancellato sul telefono restava su Supabase per sempre e
   tornava indietro al primo dispositivo nuovo. La coda sopravvive all'offline:
   si svuota alla prima sincronizzazione riuscita. */
function loadSyncDel(){ try{return JSON.parse(localStorage.getItem(SYNC_DEL_KEY))||[];}catch(e){return [];} }
function saveSyncDel(a){ try{localStorage.setItem(SYNC_DEL_KEY,JSON.stringify(a));}catch(e){} }
let syncDel=loadSyncDel();
function markDeleted(id){
  if(!id) return;
  if(syncDel.indexOf(id)<0){ syncDel.push(id); saveSyncDel(syncDel); }
  delete syncMeta[id]; saveSyncMeta(syncMeta);
  if(typeof scheduleSync==="function") scheduleSync();
}
/* Annullando una cancellazione il progetto torna a esistere: va tolto dalla
   coda, o la sincronizzazione lo ricancellerebbe dal server. */
function unmarkDeleted(){
  if(!syncDel.length) return;
  const alive=new Set(state.projects.map(p=>p.id));
  const left=syncDel.filter(id=>!alive.has(id));
  if(left.length!==syncDel.length){ syncDel=left; saveSyncDel(syncDel); }
}
let syncTimer=null, syncing=false;

function scheduleSync(){
  if(!sb||!acctSession) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(runSync,2000);
}

async function runSync(){
  if(!sb||!acctSession||syncing) return;
  syncing=true;
  try{
    /* prima le cancellazioni: se un progetto e stato tolto qui, va tolto anche
       la. Quelle che falliscono restano in coda per il prossimo giro. */
    if(syncDel.length){
      const left=[];
      for(const id of syncDel){
        try{
          const {error}=await sb.from("projects").delete().eq("id",id);
          if(error) left.push(id);
        }catch(e){ left.push(id); }
      }
      syncDel=left; saveSyncDel(syncDel);
    }
    await syncSettings();
    for(const p of state.projects){
      const snap=JSON.stringify(p);
      const meta=syncMeta[p.id]||{};
      if(meta.lastSyncedSnapshot===snap) continue; // neschimbat local — nimic de trimis

      const {data:remote}=await sb.from("projects").select("updated_at,data").eq("id",p.id).maybeSingle();
      if(remote&&meta.lastRemoteUpdatedAt&&remote.updated_at!==meta.lastRemoteUpdatedAt&&new Date(remote.updated_at)>new Date(meta.updatedAt||0)){
        // altcineva a salvat o versiune mai nouă între timp — o preluăm, nu suprascriem
        applyRemoteProject(remote.data);
        toast(ta("syncConflict"));
        continue;
      }

      const now=new Date().toISOString();
      const {data:saved,error}=await sb.from("projects").upsert({
        id:p.id, name:p.name, client:p.client||null, data:p,
        created_by:acctSession.user.id, updated_at:now
      }).select("updated_at").single();
      if(!error&&saved) syncMeta[p.id]={lastSyncedSnapshot:snap,updatedAt:now,lastRemoteUpdatedAt:saved.updated_at};
    }
    saveSyncMeta(syncMeta);
  }catch(e){ /* offline — se reîncearcă la următoarea modificare */ }
  syncing=false;
}

/* ---- l'officina viaggia con te ----
   Fino a ieri si sincronizzavano SOLO i progetti: il catalogo coi tuoi prezzi,
   le referenze aggiunte a mano, i tipi propri e il magazzino dei ritagli
   restavano sul telefono. Un progetto aperto sul PC si prezzava con un altro
   listino. Stessa regola dei progetti: vince l'updated_at piu recente.
   Se la tabella non esiste ancora (migrazione 1.4 non lanciata) la funzione
   esce in silenzio e l'app continua a funzionare come prima. */
const SET_META_KEY="tagliapro_set_meta";
function loadSetMeta(){ try{return JSON.parse(localStorage.getItem(SET_META_KEY))||{};}catch(e){return {};} }
function saveSetMeta(m){ try{localStorage.setItem(SET_META_KEY,JSON.stringify(m));}catch(e){} }
/* la lingua e una preferenza del dispositivo, non dell'officina: chi lavora in
   cantiere in romeno non deve ritrovarsi l'app in italiano perche il PC in
   ufficio e in italiano. */
function settingsPayload(){
  const s=Object.assign({},state.settings);
  return {settings:s,stock:state.stock||[]};
}
async function syncSettings(){
  if(!sb||!acctSession) return;
  const payload=settingsPayload(), snap=JSON.stringify(payload);
  const meta=loadSetMeta();
  try{
    const {data:remote,error}=await sb.from("user_settings")
      .select("updated_at,data").eq("id",acctSession.user.id).maybeSingle();
    if(error) return;                       // tabella assente: niente da fare
    if(remote&&remote.data){
      const remoteNewer=remote.updated_at!==meta.lastRemoteUpdatedAt&&
        new Date(remote.updated_at)>new Date(meta.updatedAt||0);
      if(remoteNewer){
        const rs=JSON.stringify(remote.data);
        if(rs!==snap){
          if(meta.lastSyncedSnapshot&&meta.lastSyncedSnapshot!==snap) toast(ta("syncConflict"));
          state.settings=Object.assign({},defaultState().settings,remote.data.settings||{},{lang:state.lang});
          if(Array.isArray(remote.data.stock)) state.stock=remote.data.stock;
        }
        saveSetMeta({lastSyncedSnapshot:rs,updatedAt:remote.updated_at,lastRemoteUpdatedAt:remote.updated_at});
        try{localStorage.setItem("tagliapro",JSON.stringify(state));}catch(e){}
        render();
        return;
      }
    }
    if(meta.lastSyncedSnapshot===snap) return;    // niente di nuovo da mandare
    const now=new Date().toISOString();
    const {data:saved,error:e2}=await sb.from("user_settings")
      .upsert({id:acctSession.user.id,data:payload,updated_at:now})
      .select("updated_at").single();
    if(!e2&&saved) saveSetMeta({lastSyncedSnapshot:snap,updatedAt:now,lastRemoteUpdatedAt:saved.updated_at});
  }catch(e){ /* offline: si riprova al prossimo giro */ }
}

function applyRemoteProject(data){
  if(!data||!data.id) return;
  const idx=state.projects.findIndex(x=>x.id===data.id);
  if(idx>=0) state.projects[idx]=data; else state.projects.push(data);
  persist(); render();
}

async function pullAndMergeProjects(){
  if(!sb||!acctSession) return;
  try{
    await syncSettings();
    const {data:remoteProjects}=await sb.from("projects").select("*");
    if(!remoteProjects) return;
    let changed=false;
    for(const rp of remoteProjects){
      if(!rp.data) continue;
      /* cancellato qui e non ancora sul server: non lo si ripesca, o la
         cancellazione tornerebbe indietro a ogni avvio */
      if(syncDel.indexOf(rp.id)>=0) continue;
      const local=state.projects.find(p=>p.id===rp.id);
      const meta=syncMeta[rp.id];
      const remoteNewer=!meta||new Date(rp.updated_at)>new Date(meta.lastRemoteUpdatedAt||0);
      if(!local){
        if(remoteNewer){
          state.projects.push(rp.data); changed=true;
          syncMeta[rp.id]={lastSyncedSnapshot:JSON.stringify(rp.data),updatedAt:rp.updated_at,lastRemoteUpdatedAt:rp.updated_at};
        }
        continue;
      }
      const localChangedSinceSync=!meta||JSON.stringify(local)!==meta.lastSyncedSnapshot;
      if(remoteNewer){
        if(localChangedSinceSync) toast(ta("syncConflict"));
        const idx=state.projects.findIndex(p=>p.id===rp.id);
        state.projects[idx]=rp.data; changed=true;
        syncMeta[rp.id]={lastSyncedSnapshot:JSON.stringify(rp.data),updatedAt:rp.updated_at,lastRemoteUpdatedAt:rp.updated_at};
      }
    }
    saveSyncMeta(syncMeta);
    if(changed){ persist(); render(); }
  }catch(e){ /* offline — se ritenterà al prossimo avvio/login */ }
}

$("btnAccount").addEventListener("click",()=>{ renderAccount(); closeSheets(); openSheet("shAccount"); });

$("btnAcctLogin").addEventListener("click",async()=>{
  if(!initSupabase()){ toast(ta("acctNoNet")); return; }
  const email=$("acctEmail").value.trim(), password=$("acctPassword").value;
  if(!email||!password) return;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error){ toast(error.message); return; }
  toast(ta("acctOk"));
});

$("btnAcctSignup").addEventListener("click",async()=>{
  if(!initSupabase()){ toast(ta("acctNoNet")); return; }
  const email=$("acctEmail").value.trim(), password=$("acctPassword").value;
  if(!email||!password) return;
  const {error}=await sb.auth.signUp({email,password});
  if(error){ toast(error.message); return; }
  toast(ta("acctCheckEmail"));
});

$("btnAcctForgot").addEventListener("click",async()=>{
  if(!initSupabase()){ toast(ta("acctNoNet")); return; }
  const email=$("acctEmail").value.trim();
  if(!email){ toast(ta("acctNeedEmail")); $("acctEmail").focus(); return; }
  const redirectTo=location.origin+location.pathname;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){ toast(error.message); return; }
  toast(ta("acctResetSent"));
});

/* tornando dal link dell'email Supabase emette PASSWORD_RECOVERY: si chiede subito la nuova */
function openPwdSheet(){
  $("pwdTitle").textContent=ta("acctNewPwd");
  $("pwdNote").textContent=ta("acctNewPwdNote");
  $("pwdLbl1").textContent=ta("acctNewPwd");
  $("pwdLbl2").textContent=ta("acctRepeat");
  $("btnPwdSave").textContent=ta("acctSave");
  $("pwdNew").value=""; $("pwdNew2").value="";
  closeSheets(); openSheet("shPwd");
}
$("btnPwdSave").addEventListener("click",async()=>{
  if(!initSupabase()){ toast(ta("acctNoNet")); return; }
  const p1=$("pwdNew").value, p2=$("pwdNew2").value;
  if(p1.length<8){ toast(ta("acctPwdShort")); $("pwdNew").focus(); return; }
  if(p1!==p2){ toast(ta("acctPwdMismatch")); $("pwdNew2").focus(); return; }
  const {error}=await sb.auth.updateUser({password:p1});
  if(error){ toast(error.message); return; }
  closeSheets(); toast(ta("acctPwdChanged"));
});

$("btnAcctLogout").addEventListener("click",async()=>{
  if(!initSupabase()){ toast(ta("acctNoNet")); return; }
  await sb.auth.signOut();
  toast(ta("acctOk"));
});

