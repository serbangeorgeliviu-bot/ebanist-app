"use strict";
/* ===========================================================================
   Ebanist — app/js/validation.js

   Il semaforo di fiducia, in ordine: migrazione geomVersion, asserzioni di
   coerenza, chiusura del gabarito, invarianti, allineamento materiali /
   distinta, il cancello d'esportazione e la foglia di chiusura.
   =========================================================================== */
/* ================= MIGRAZIONE geomVersion =================
   Il motore nuovo cambia le cote dei progetti gia salvati. Una riscrittura
   silenziosa e inaccettabile: chi ha quel progetto in mano puo aver gia
   debitato con le cote vecchie. Quindi: si mostra la differenza, si chiede,
   e solo dopo si scrive. Prima di scrivere, backup di tutto. */

/* Ricalcola i corpi di un progetto col motore corrente SENZA toccare niente.
   Torna le righe cambiate: vecchia contro nuova, solo quelle diverse. */
function geomDiff(p){
  const out=[], cfgs=(p&&p.configs)||{};
  for(const name of Object.keys(cfgs)){
    let gen;
    try{ gen=buildModule(cfgs[name]); }
    catch(e){ out.push({modulo:name,elemento:"—",err:String(e&&e.message||e)}); continue; }
    const old=(p.pieces||[]).filter(x=>x.gen===name||x.modulo===name||
                                       x.modulo===name+" A"||x.modulo===name+" B");
    /* si confronta per elemento: e la chiave che il falegname legge in
       distinta, e non cambia fra una versione e l'altra del motore. */
    const key=x=>(x.wing?x.wing+"·":"")+x.elemento;
    const byKey=new Map(); for(const x of old) byKey.set((x.modulo&&/ [AB]$/.test(x.modulo)?x.modulo.slice(-1)+"·":"")+x.elemento,x);
    const seen=new Set();
    for(const n of gen.pieces){
      const k=key(n); seen.add(k);
      const o=byKey.get(k);
      if(!o){ out.push({modulo:name,elemento:k,vecchio:null,nuovo:n}); continue; }
      if(o.lung!==n.lung||o.larg!==n.larg||o.pz!==n.pz)
        out.push({modulo:name,elemento:k,vecchio:o,nuovo:n});
    }
    for(const [k,o] of byKey) if(!seen.has(k)) out.push({modulo:name,elemento:k,vecchio:o,nuovo:null});
  }
  return out;
}

const geomFmt=x=>x?`${x.lung}×${x.larg} ×${x.pz}`:"—";

/* Lo schermo della differenza. Nessun bottone «aggiorna tutto e fidati»:
   si vede riga per riga cosa cambia, e si conferma. */
function geomDiffSheet(){
  const p=proj(); if(!p) return;
  const rows=geomDiff(p);
  const body=$("geomBody");
  if(!rows.length){
    body.innerHTML=`<div class="au-row"><div class="au-why">${esc(t("gvSame"))}</div></div>`;
    $("geomApply").hidden=true;
  }else{
    body.innerHTML=`<table class="gv"><tr><th>${esc(t("fElement"))}</th>
        <th>${esc(t("gvOld"))}</th><th>${esc(t("gvNew"))}</th></tr>`+
      rows.map(r=>`<tr><td>${esc(r.modulo)} · ${esc(r.elemento)}</td>
        <td class="n">${r.err?"—":esc(geomFmt(r.vecchio))}</td>
        <td class="n${r.err?"":" gv-new"}">${r.err?esc(r.err):esc(geomFmt(r.nuovo))}</td></tr>`).join("")+
      `</table><p class="vsub" style="margin-top:10px">${esc(t("gvWarn"))}</p>`;
    $("geomApply").hidden=false;
  }
  openSheet("geomSheet");
}

/* La scrittura. Backup di TUTTO prima di toccare qualunque cosa: la funzione
   di backup esiste gia ed e la stessa che usa il bottone in Impostazioni. */
async function geomApply(){
  const p=proj(); if(!p) return;
  try{ await fullBackup({silent:true}); }
  catch(e){ toast(t("gvBkFail")); return; }   // niente backup, niente migrazione
  const cfgs=p.configs||{};
  const failed=[];
  for(const name of Object.keys(cfgs)){
    const cfg=cfgs[name];
    /* UNA SOLA STRADA PER SCRIVERE UNA DISTINTA. Qui c'era una seconda
       copia della traduzione pezzi → righe, e si era gia scollata: non
       portava ne il ruolo, ne gli assi, ne la grossezza. Un progetto
       migrato da qui usciva con righe che il controllo di chiusura non
       poteva leggere — e quindi passava il cancello senza essere
       controllato. E' esattamente il guasto che tutto questo ripara, e
       stava nel codice che lo ripara. */
    try{ generateInto(p,Object.assign({},cfg,{name})); }
    catch(e){ failed.push(name); continue; }
  }
  /* Un corpo che non si e ricalcolato tiene le cote vecchie. Timbrare v2 lo
     stesso farebbe sparire lo striscione e stampare «motore v2» su un foglio
     migrato a meta — la bugia peggiore di tutte, perche sembra a posto. */
  if(failed.length){
    persist(); closeSheets(); render();
    toast(t("gvPartial").replace("{n}",failed.length));
    return;
  }
  p.geomVersion=GEOM_VERSION;
  persist(); closeSheets(); render();
  toast(t("gvDone"));
}

/* Lo striscione. Compare solo su un progetto v1 CHE HA corpi generati: uno
   con soli pezzi battuti a mano non ha niente da ricalcolare. */
function geomBanner(){
  const el=$("geomBanner"); if(!el) return;
  const p=proj();
  const show=!!p&&(p.geomVersion||1)<GEOM_VERSION&&Object.keys((p&&p.configs)||{}).length>0;
  el.hidden=!show;
  if(!show) return;
  el.innerHTML=`<span>${esc(t("gvBanner"))}</span>`+
    `<button class="btn sm red" id="geomOpen">${esc(t("gvRecalc"))}</button>`;
  el.querySelector("#geomOpen").addEventListener("click",geomDiffSheet);
}

/* ================= ASSERZIONI: IL SEMAFORO DI FIDUCIA =================
   Le regole stanno in ebanist-core.js, come dati. Qui c'e solo il giro:
   raccogliere le cote, farle passare, e FERMARE l'esportazione se una regola
   di gravita `blocking` non torna. Un avviso che si puo ignorare non serve a
   niente — la distinta sbagliata e arrivata a debitare proprio cosi. */

/* Il contesto a livello di pezzi: quello che le regole A9/A10/A11 guardano e
   che deriveCarcass non puo sapere, perche riguarda la distinta gia emessa. */
function auditCtx(cfg,pieces){
  const S=(state&&state.settings)||{};
  /* Il decoro direzionale non e un dettaglio estetico: se la venatura ha un
     verso il pezzo NON si puo ruotare per farlo entrare, e un pezzo che
     sarebbe entrato di traverso adesso non entra. */
  const dir=!!S.decor_directional;
  let piesa_max=0, piesa_L=0, piesa_W=0, panL=S.panelL||0, panW=S.panelW||0;
  let over=null;
  for(const x of pieces||[]){
    const L=Math.max(x.lung,x.larg), W2=Math.min(x.lung,x.larg);
    piesa_max=Math.max(piesa_max,L);
    /* il formato e quello della referenza del pezzo, se ce l'ha; altrimenti
       quello di progetto. Un pezzo che non entra nella SUA lastra e il caso
       che A10 deve prendere — e va confrontato con QUELLA lastra, non con
       quella di progetto, o su un materiale di formato piu piccolo passa. */
    const pf=panelFor(x.materiale)||{L:panL,W:panW};
    const fits=dir ? (x.lung<=(pf.L||0)&&x.larg<=(pf.W||0))
                   : (L<=(pf.L||0)&&W2<=(pf.W||0));
    if(!fits&&!over) over={L:dir?x.lung:L, W:dir?x.larg:W2, pf};
  }
  if(over){ piesa_L=over.L; piesa_W=over.W; panL=over.pf.L||0; panW=over.pf.W||0; }
  return {panelL:panL, panelW:panW,
          piesa_max, piesa_L, piesa_W,
          aria_per_material:1};   // computeTotals raggruppa gia per materiale
}

/* ===== CHIUSURA DEL GABARITO (Fase 2) ===================================
   Il giro attorno a `validateCarcassClosure`, che sta nel nucleo ed e pura.
   Qui c'e solo quello che il nucleo non puo sapere: che un corpo angolare
   sono DUE casse, e che la seconda e larga `L2`. Validare le due ali insieme
   vorrebbe dire misurare un corpo che non esiste. */
const CASSA_TYPES=["standard","scorrevole","angolare"];
/* Un corpo ANGOLARE sono DUE casse, e la seconda e larga `L2`. Ogni
   controllo geometrico va fatto ala per ala: misurarle insieme vorrebbe
   dire misurare un corpo che non esiste. Una sola funzione lo sa, e la
   chiamano sia la chiusura che gli invarianti. */
function perWing(cfg,pieces,run){
  if(cfg.type!=="angolare") return run(cfg,pieces||[]);
  const A={...cfg,__ala:"A"};
  const B={...cfg,L:Math.max(300,cfg.L2||900),__ala:"B"};
  const rowsA=(pieces||[]).filter(x=>x.wing==="A"||!x.wing);
  const rowsB=(pieces||[]).filter(x=>x.wing==="B");
  return run(A,rowsA).concat(rowsB.length?run(B,rowsB):[]);
}
function closureOf(cfg,pieces){
  if(!cfg||CASSA_TYPES.indexOf(cfg.type||"standard")<0) return [];
  if(typeof validateCarcassClosure!=="function") return [];
  try{
    return perWing(cfg,pieces,(corpo,rows)=>{
      const G=deriveCarcass(carcassParams(corpo,{}));
      return validateCarcassClosure(corpo,rows,G).map(e=>({...e,corpo:corpo.__ala||null}));
    });
  }catch(e){
    return [{axa:"—",chain:"env",valoare_nominala:null,valoare_calculata:null,
             delta:null,piese_implicate:[],why:(e&&e.message)||String(e)}];
  }
}
/* Dallo scostamento al messaggio che legge chi sta in officina: il perche,
   il numero che doveva uscire, quello che e uscito, e i pezzi in mezzo. */
function closureWhy(e){
  if(e.delta==null) return e.why;
  const seg=e.piese_implicate&&e.piese_implicate.length
    ? " · "+e.piese_implicate.slice(0,4).join(", ") : "";
  return `${e.why} ${e.axa}: ${e.valoare_nominala} mm cerut, `+
         `${e.valoare_calculata} mm din piese (${e.delta>0?"+":""}${e.delta} mm)${seg}`;
}

/* ===== GLI INVARIANTI (Fase 3) ==========================================
   Il giro attorno a `validateInvariants`, che sta nel nucleo ed e puro.
   Qui si raccolgono le due cose che il nucleo non puo sapere: QUALE
   materiale sta su ogni ruolo (per poterlo nominare quando non torna) e
   quali grossezze il progetto ha davvero — che e il modo di accorgersi di
   una grossezza rimasta scritta nel codice. */
function invariantsOf(cfg,pieces,G,MAT){
  if(typeof validateInvariants!=="function") return [];
  /* le grossezze che il progetto HA: quelle dei materiali dei ruoli, piu
     quelle dei materiali che i singoli pezzi si portano (il fondo del
     cassetto in HDF da 5). Una grossezza fuori da questa lista non viene
     da nessun materiale — viene dal codice. */
  const ths={};
  for(const k of Object.keys(MAT.sp||{})) if(MAT.sp[k]>0) ths[MAT.sp[k]]=1;
  for(const x of pieces||[]){
    const lbl=x.materiale||x.mat;
    if(!lbl) continue;
    const m=matByLabel(lbl);
    if(m&&+m.th>0) ths[+m.th]=1;
  }
  const opts={materials:MAT.mats, thicknesses:Object.keys(ths).map(Number),
    maxDim:Math.max((state.settings||{}).panelL||2800,(state.settings||{}).panelW||2070)};
  return perWing(cfg,pieces,(corpo,rows)=>{
    const Gw=(corpo.__ala==="B")?deriveCarcass(carcassParams(corpo,{})):G;
    return validateInvariants(corpo,rows,Gw,opts)
      .map(r=>corpo.__ala?{...r,corpo:corpo.__ala}:r);
  });
}

/* Verifica un corpo: le cote derivate piu la distinta che ne e uscita. */
function auditModule(cfg,pieces){
  if(typeof deriveCarcass!=="function") return [];
  /* le tipologie che non sono una cassa (tavolo, tondo, letto…) non hanno
     cote di carcassa da verificare: non si inventa un corpo che non c'e. */
  if(cfg&&cfg.type&&CASSA_TYPES.indexOf(cfg.type)<0) return [];
  try{
    const P=cfg.P, support=cfg.support||"zoccolo";
    const pl=support==="sospeso"?0:(cfg.plinth||0);
    /* le stesse grossezze che usa il generatore: se le due strade le
       calcolassero da sole, il controllo verificherebbe un corpo diverso
       da quello che e andato in distinta. */
    const MAT=carcassMaterials(cfg);
    const backTh=cfg.back?Math.min(MAT.sp.schienale,Math.max(0,P-50)):0;
    const G=deriveCarcass(carcassParams(cfg,{P,pl,backTh,support,sp:MAT.sp}));
    const failed=checkAssertions(G,auditCtx(cfg,pieces));
    /* LA CHIUSURA PRIMA DI TUTTO IL RESTO. Le asserzioni controllano regole
       che qualcuno ha scritto; la chiusura controlla il mobile. E' l'unica
       che prende un guasto di cui nessuno sospetta. */
    for(const e of closureOf(cfg,pieces))
      failed.unshift({id:"C-"+e.axa,severity:e.severity||"blocking",confidence:"alta",
        why:closureWhy(e),source:t("closureSrc"),closure:e});
    /* GLI INVARIANTI PER RUOLO. La chiusura dice che i pezzi fanno il
       mobile ordinato; questi dicono che ogni pezzo e quello giusto per il
       suo posto. Un ripiano lungo quanto la luce interna INTERA chiude il
       gabarito e non entra. */
    for(const r of invariantsOf(cfg,pieces,G,MAT)){
      if(r.ok!==false) continue;
      failed.unshift({id:r.id,severity:"blocking",confidence:"alta",
        why:r.why,source:t("invSrc")+" · "+r.regola,invariant:r,
        modulo:undefined});
    }
    return failed;
  }catch(e){
    return [{id:"ENV",severity:"blocking",why:t("auErr")+" "+(e&&e.message||e)}];
  }
}

/* ===== MATERIALI E DISTINTA: ALLINEATI O NO =============================
   Una distinta e valida solo per i materiali con cui e stata calcolata. Se
   dopo averla generata cambia un materiale, una grossezza, o la referenza
   sparisce dal catalogo, le cote in distinta non descrivono piu il mobile
   che verra tagliato. E' la stessa classe di guasto dei due incidenti, solo
   presa dall'altro capo.

   Tre stati, tre risposte diverse:
     "manca"   — il materiale non si risolve piu: si BLOCCA l'esportazione;
     "diverso" — l'impronta non torna: si BLOCCA, va rigenerata;
     "senza"   — distinta emessa prima delle impronte: si SEGNALA soltanto,
                 perche bloccare qui vorrebbe dire bloccare ogni progetto
                 gia salvato, e nessuno di quelli e sbagliato per questo. */
function moduleMatState(cfg){
  if(!cfg) return {k:"ok"};
  let r=null;
  try{ r=carcassMaterials(cfg); }
  catch(e){ return {k:"manca",why:e&&e.message||String(e)}; }
  if(r.legacy) return {k:"manca",why:t("errNoStructMat")};
  if(!cfg.matStamp) return {k:"senza"};
  return (matStamp(cfg)===cfg.matStamp)?{k:"ok"}:{k:"diverso"};
}
/* I corpi la cui distinta non e piu allineata ai materiali. */
function matDrift(p){
  const out={block:[],warn:[]};
  const cfgs=(p&&p.configs)||{};
  for(const name of Object.keys(cfgs)){
    const st=moduleMatState(cfgs[name]);
    if(st.k==="manca"||st.k==="diverso") out.block.push({modulo:name,...st});
    else if(st.k==="senza") out.warn.push({modulo:name,...st});
  }
  return out;
}

/* Verifica l'intero progetto, corpo per corpo. Torna le regole cadute con
   il nome del corpo attaccato: in officina serve sapere QUALE corpo. */
function auditProject(p){
  const out=[];
  if(!p) return out;
  const cfgs=(p.configs)||{};
  for(const name of Object.keys(cfgs)){
    const pieces=(p.pieces||[]).filter(x=>x.gen===name||x.modulo===name||
                                          x.modulo===name+" A"||x.modulo===name+" B");
    for(const a of auditModule(cfgs[name],pieces)) out.push({...a,modulo:name});
  }
  return out;
}

/* Il semaforo. Verde: tutte le regole tornano. Rosso: almeno una `blocking`
   e caduta, e allora l'esportazione non parte. */
function auditBadge(){
  const el=$("auditBadge"); if(!el) return;
  const p=proj();
  const failed=auditProject(p);
  const drift=matDrift(p);
  for(const d of drift.block) failed.push({id:"MAT",severity:"blocking",modulo:d.modulo,
    why:d.why||t("matStaleOne"),source:t("matStaleTitle")});
  const bad=(typeof blocking==="function")?blocking(failed):failed;
  el.dataset.state=bad.length?"red":"green";
  el.hidden=!p||!Object.keys((p&&p.configs)||{}).length;
  el.innerHTML=bad.length
    ? `<b>${esc(t("auBlocked").replace("{n}",bad.length))}</b>`
    : `<span>${esc(t("auOk"))}</span>`;
  el.onclick=bad.length?()=>auditSheet(failed):null;
}

/* Il messaggio all'utente e il campo `why`, non un codice: chi sta in
   officina deve leggere il motivo, non cercarlo in una tabella. */
function auditSheet(failed){
  /* I bloccanti per primi: chi apre questo foglio ha appena sbattuto contro
     una porta chiusa e vuole sapere QUALE. Gli avvisi vengono dopo. */
  const ord=(failed||[]).slice().sort((a,b)=>
    (a.severity==="blocking"?0:1)-(b.severity==="blocking"?0:1));
  const rows=ord.map(a=>{
    const c=a.closure;
    /* uno scostamento di chiusura ha quattro cose da dire, e vanno dette
       separate: il corpo, la regola, di quanto, e su quali pezzi. In una
       riga sola di testo non si leggono in officina. */
    const meta=[a.modulo||"", a.source||"", a.error||""].filter(Boolean).join(" · ");
    return `<div class="au-row${a.severity==="blocking"?" bad":""}">
      <div class="au-why">${esc(c?c.why:(a.why||a.id))}</div>
      ${c&&c.delta!=null?`<div class="au-num">
        <span>${esc(c.axa)}</span>
        <b>${esc(String(c.valoare_nominala))} mm</b>
        <span>→</span>
        <b>${esc(String(c.valoare_calculata))} mm</b>
        <em>${c.delta>0?"+":""}${esc(String(c.delta))} mm</em></div>`:""}
      ${c&&c.piese_implicate&&c.piese_implicate.length
        ?`<div class="au-meta">${esc(c.piese_implicate.join(" · "))}</div>`:""}
      <div class="au-meta">${esc(meta)}</div>
    </div>`;
  }).join("");
  $("auditBody").innerHTML=rows||`<div class="au-row"><div class="au-why">${esc(t("auOk"))}</div></div>`;
  openSheet("auditSheet");
}

/* ================= STAMPA =================
   Tutte e sei le uscite su carta — distinta, preventivo, scheda di
   montaggio, disegno, etichette, ordine — passano di qui. Un punto solo,
   per una ragione precisa: la filigrana della versione gratuita non deve
   poter mancare da uno dei sei per dimenticanza. Il giorno che se ne
   aggiunge un settimo, o chiama questa funzione o non stampa.

   La filigrana si mette e si TOGLIE ogni volta: chi attiva Pro e stampa
   subito dopo, senza ricaricare, deve avere il foglio pulito. */
/* Când e pornită captura, documentele nu ies pe hârtie: se strâng.
   Pachetul de comandă cheamă exact butoanele pe care le apasă și omul,
   deci ce ajunge la atelier e bit cu bit ce tipărește aplicația. */
let PRINT_CAPTURE=null;
function printOut(){
  /* IL CANCELLO STA QUI, non nei sei bottoni. Un controllo scritto in sei
     posti e un controllo che il settimo documento non avra: e la ragione per
     cui questa funzione esiste da prima, per la filigrana. Adesso regge
     anche la coerenza delle cote. Chi aggiunge un'uscita nuova o chiama
     questa funzione, o non stampa. */
  if(!exportAllowed()) return;
  const pa=$("printArea");
  pa.querySelectorAll(".wm-diag,.wm-foot").forEach(n=>n.remove());
  if(PRINT_CAPTURE){ PRINT_CAPTURE.push(pa.innerHTML); return; }
  if(typeof orFirstPdf==="function") orFirstPdf();
  if(!isPro()){
    const d=document.createElement("div");
    d.className="wm-diag"; d.textContent=t("wmDiag");
    const f=document.createElement("div");
    f.className="wm-foot"; f.textContent=t("wmFoot");
    pa.appendChild(d); pa.appendChild(f);
  }
  setTimeout(()=>{
    window.print();
    /* La proposta arriva DOPO che il documento e uscito, una volta sola
       per sessione. Prima della stampa sarebbe un pedaggio; dopo e la
       risposta alla domanda che l'utente si e appena fatto guardando la
       filigrana: «e come lo tolgo?». */
    if(!isPro()&&!printOut._offered){
      printOut._offered=1;
      setTimeout(()=>{ if(!isPro()) openPro("pdf"); },900);
    }
  },80);
}

/* ===== IL CANCELLO (Fase 4) =============================================
   `assertExportable(project)` e l'unico posto che decide se una distinta puo
   uscire. Non torna un booleano: torna il VERDETTO, con dentro tutto quello
   che serve a spiegarlo — quale corpo, quale regola, di quanto, quali pezzi.
   Chi deve solo sapere se si puo stampare guarda `.ok`.

   NON ESISTE UNA VIA D'USCITA. Niente flag di forzatura, niente "continua
   lo stesso", niente scorciatoia per l'utente esperto. Una distinta
   incoerente e arrivata al debitatore proprio perche da qualche parte
   c'era un avviso che si poteva ignorare. */
function assertExportable(project){
  const p=project||proj();
  const out={ok:false, blocking:[], warn:[], project:p};
  if(!p){ out.blocking.push({id:"NOPROJ",severity:"blocking",why:t("selectProject")}); return out; }

  /* 1. il motore locale e piu vecchio di quello sul server. Una distinta
        calcolata da un motore superato e il guasto che questo rilascio
        ripara, e dopo il deploy il service worker puo tenerlo in vita per
        giorni. */
  if(window.__geomStale)
    out.blocking.push({id:"GEOMVER",severity:"blocking",why:t("gvStale"),source:t("gvTitle")});

  /* 2. i materiali. Una distinta calcolata con un materiale ed esportata
        dopo averlo cambiato e lo stesso guasto, da un'altra porta. */
  const drift=matDrift(p);
  for(const d of drift.block)
    out.blocking.push({id:"MAT",severity:"blocking",modulo:d.modulo,
      why:d.why||t("matStaleOne"),source:t("matStaleTitle")});
  for(const d of drift.warn)
    out.warn.push({id:"MAT?",severity:"warn",modulo:d.modulo,
      why:t("matStaleOne"),source:t("matStaleTitle")});

  /* 3. corpo per corpo: la chiusura del gabarito (Fase 2) e le regole di
        coerenza (Fase 3), che `auditProject` gia mette insieme. */
  const failed=auditProject(p);
  const bad=(typeof blocking==="function")?blocking(failed):failed;
  for(const a of bad) out.blocking.push(a);
  for(const a of failed) if(bad.indexOf(a)<0) out.warn.push(a);

  out.ok=out.blocking.length===0;
  return out;
}

/* ===== LA FOGLIA DI CHIUSURA (Fase 5) ===================================
   Il cancello di Fase 4 e una macchina: dice di no quando i numeri non
   tornano. Questa e l'ultimo occhio UMANO. Serve per il caso che nessuna
   regola prende: le cote si chiudono, ma il corpo e stato calcolato con la
   grossezza sbagliata perche qualcuno ha scelto il materiale sbagliato.
   Nessun controllo automatico puo saperlo. Il falegname si.

   Percio qui non c'e la lista dei pezzi: c'e la SINTESI. Il gabarito
   ordinato accanto a quello che esce dai pezzi, e con che grossezze. */
function closureSummary(p){
  const out=[];
  const cfgs=(p&&p.configs)||{};
  for(const name of Object.keys(cfgs)){
    const cfg=cfgs[name];
    const rows=(p.pieces||[]).filter(x=>x.gen===name||x.modulo===name||
                                        x.modulo===name+" A"||x.modulo===name+" B");
    const r={nume:name, tip:cfg.type||"standard",
             nom:{L:cfg.L,H:cfg.H,P:cfg.P},
             calc:{}, sp:null, mats:null, back:"", front:"",
             nPz:rows.reduce((a,x)=>a+(+x.pz||0),0),
             nRow:rows.length, errs:[], ok:false};
    try{
      const G=deriveCarcass(carcassParams(cfg,{}));
      r.calc=(typeof reconstructedBBox==="function")
        ? reconstructedBBox(cfg,rows,G) : {};
      const M=carcassMaterials(cfg);
      r.sp=M.sp; r.mats=M.mats;
      r.back=cfg.back?(G.tip_schienale||""):"—";
      r.front=(cfg.type==="scorrevole"&&cfg.doors>0)?"scorrevole"
             :(cfg.doors>0?(cfg.front||"piena"):"—");
    }catch(e){ r.errs.push({why:(e&&e.message)||String(e)}); }
    /* lo stesso verdetto del cancello, corpo per corpo: due giudizi diversi
       sullo stesso corpo sarebbero il guasto che tutto questo ripara. */
    const bad=(typeof blocking==="function")?blocking(auditModule(cfg,rows)):auditModule(cfg,rows);
    for(const a of bad) r.errs.push(a);
    r.ok=r.errs.length===0;
    out.push(r);
  }
  /* i corpi che non tornano PRIMI: chi apre questa foglia deve vederli
     senza scorrere. */
  out.sort((a,b)=>(a.ok?1:0)-(b.ok?1:0)||a.nume.localeCompare(b.nume));
  return out;
}

/* Le grossezze, raggruppate per materiale: un corpo tutto dello stesso
   pannello fa una riga sola, uno con il cielo da 25 le fa vedere tutte.
   Non si nasconde una grossezza perche la riga diventa lunga — e proprio
   quella che bisogna vedere. */
const CL_ROLE_LBL={fianco:"matBody",base:"matRoleBase",cielo:"matRoleCielo",
  ripiano:"matRoleRipiano",divisorio:"matRoleDivisorio",zoccolo:"matRoleZoccolo",
  frontale:"matFront",schienale:"matBack"};
function closureSpText(r){
  if(!r.sp) return "";
  const byMat={};
  for(const role of Object.keys(CL_ROLE_LBL)){
    const th=r.sp[role]; if(!(th>0)) continue;
    const m=r.mats&&r.mats[role];
    const k=((m&&m.id)||"?")+"|"+th;
    (byMat[k]=byMat[k]||{lbl:(m&&m.label)||"—",th,roles:[]}).roles.push(t(CL_ROLE_LBL[role]));
  }
  return Object.keys(byMat).map(k=>{
    const g=byMat[k];
    /* molte referenze vecchie portano la grossezza nel nome: «MDF grezzo
       25mm». Scriverla due volte di fila in una riga densa la rende
       illeggibile — si toglie dal nome, non dalla cota. */
    const lbl=g.lbl.replace(new RegExp("\\s*"+fmtMm(g.th)+"\\s*mm\\s*$","i"),"").trim()||g.lbl;
    return `${esc(lbl)} <b>${esc(fmtMm(g.th))} mm</b> — ${esc(g.roles.join(", ").toLowerCase())}`;
  }).join(" · ");
}
/* `t()` torna la chiave quando la traduzione non c'e: qui servirebbe a
   stampare «back_—» accanto a un corpo senza schienale. Se non c'e, si
   stampa il valore. */
function tOr(k,f){ const v=t(k); return (v===k)?f:v; }
function closureRender(){
  const p=proj(), list=closureSummary(p);
  const dim=(d)=>[d.L,d.H,d.P].map(v=>v==null?"?":Math.round(v)).join("×");
  const off=(a,b)=>(a!=null&&b!=null&&Math.round(a)!==Math.round(b));
  $("clBody").innerHTML=list.map(r=>{
    const bad=!r.ok;
    const dC=[["L",r.nom.L,r.calc.L],["H",r.nom.H,r.calc.H],["P",r.nom.P,r.calc.P]];
    const calcTxt=dC.map(([,n,c])=>
      c==null?`<span class="off">?</span>`
      :off(n,c)?`<span class="off">${Math.round(c)}</span>`:String(Math.round(c))).join("×");
    return `<div class="cl-row${bad?" bad":""}">
      <div class="cl-h"><span class="cl-mark">${bad?"✗":"✓"}</span>
        <b>${esc(r.nume)}</b><span class="cl-t">${esc(tOr("preset_"+r.tip,r.tip))}</span>
        <span class="cl-n">${r.nPz} ${esc(t("clPieces"))}</span></div>
      <div class="cl-dim"><span>${esc(dim(r.nom))}</span>
        <span class="arw">→</span><span>${calcTxt}</span></div>
      ${r.sp?`<div class="cl-sp">${closureSpText(r)}</div>`:""}
      <div class="cl-kind">${esc(t("matBack"))}: ${esc(tOr("back_"+r.back,r.back))} · ${esc(t("fFront"))}: ${esc(tOr("front_"+r.front,r.front))}</div>
      ${bad?`<div class="cl-kind" style="color:var(--danger)">${esc(r.errs.map(e=>e.why||e.id).join(" · ").slice(0,220))}</div>`:""}
    </div>`;
  }).join("")||`<div class="cl-row"><div class="cl-h"><b>${esc(t("transpNone"))}</b></div></div>`;
  return list;
}
/* Il giro completo. La foglia si apre SEMPRE, anche — soprattutto — quando
   un corpo non torna: e qui che si vede QUALE. Far scattare prima il
   cancello automatico avrebbe mostrato un elenco di errori senza il corpo
   accanto, e la colonna ✗ non l'avrebbe vista nessuno.
   Il bottone resta spento finche c'e un ✗, e la spunta non lo accende: la
   spunta non e un permesso, e una lettura. */
let CL_ACTION=null;
/* Le tre uscite che vanno in FABBRICA passano di qui: il PDF della distinta,
   il CSV e il pacchetto di laboratorio. Le altre (preventivo, scheda di
   montaggio, disegno, ordine) hanno gia il cancello automatico: chiedere
   quattro conferme di fila trasformerebbe la spunta in un riflesso, e una
   spunta riflessa non e un controllo. */
let CL_PASSED=null;
function closureFirst(id){
  if(CL_PASSED===id){ CL_PASSED=null; return false; }   // gia confermata
  closureGate(()=>{ CL_PASSED=id; const b=$(id); if(b) b.click(); });
  return true;                                           // ci si ferma qui
}
function closureGate(fn){
  const p=proj();
  if(!p){ toast(t("selectProject")); return; }
  CL_ACTION=fn;
  const list=closureRender();
  const rotti=list.filter(r=>!r.ok);
  CL_BAD=rotti.length;
  const ck=$("clOk"), go=$("btnClGo");
  ck.checked=false; ck.disabled=CL_BAD>0;
  go.disabled=true;
  /* la riga che spiega perche il bottone e spento, col modo di vedere i
     dettagli senza cercarli */
  $("clBlocked").hidden=!CL_BAD;
  if(CL_BAD) $("clBlockedTxt").textContent=t("clBlocked").replace("{n}",CL_BAD);
  closeSheets(); openSheet("shClosure");
  return list;
}
let CL_BAD=0;
$("clOk").addEventListener("change",()=>{
  $("btnClGo").disabled=!$("clOk").checked||CL_BAD>0; });
$("clDetails").addEventListener("click",()=>{ exportAllowed(); });
$("btnClGo").addEventListener("click",()=>{
  if(!$("clOk").checked) return;
  const fn=CL_ACTION; CL_ACTION=null;
  closeSheets();
  if(typeof fn==="function") setTimeout(fn,60);
});

/* Il cancello, con la voce: lo stesso verdetto, detto all'utente. Ogni
   esportazione passa di qui — e quelle su carta passano anche da printOut(),
   che lo richiama: due giri sulla stessa porta, non due porte. */
function exportAllowed(project){
  const v=assertExportable(project);
  if(v.ok) return true;
  if(v.blocking.some(a=>a.id==="GEOMVER")) geomStaleBar();
  auditSheet(v.blocking.concat(v.warn));
  toast(t("auBlocked").replace("{n}",v.blocking.length));
  return false;
}

