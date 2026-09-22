"use strict";
/* ===========================================================================
   Ebanist — app/js/project-tools.js

   Gli attrezzi attorno al progetto: annulla, backup completo, segnalazioni,
   logo aziendale, gestione dei cataloghi e le funzioni Pro (ferramenta,
   preventivo, condivisione).
   =========================================================================== */
/* ================= UNDO ================= */
let UNDO=null, undoTimer=null;
function snapUndo(){ UNDO=JSON.stringify(state); }
function undoToast(msg){
  let bar=$("undoBar");
  if(!bar){
    bar=document.createElement("div"); bar.id="undoBar";
    bar.style.cssText="position:fixed;left:14px;right:14px;bottom:84px;z-index:300;background:#2b2e29;color:#f2f2ee;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.4)";
    document.body.appendChild(bar);
  }
  bar.innerHTML=`<span style="flex:1">${esc(msg)}</span><button style="background:none;border:none;color:#9fd45f;font-weight:700;font-size:15px;padding:4px 8px">${esc(t("undoBtn"))}</button>`;
  bar.style.display="flex";
  bar.querySelector("button").addEventListener("click",()=>{
    if(UNDO){ const lang=state.lang; state=JSON.parse(UNDO); state.lang=lang;
      if(typeof unmarkDeleted==="function") unmarkDeleted();   // il progetto e tornato: non cancellarlo dal server
      persist(); render(); applyLang(); }
    bar.style.display="none"; clearTimeout(undoTimer);
  });
  clearTimeout(undoTimer); undoTimer=setTimeout(()=>{bar.style.display="none";},6000);
}

/* ================= BACKUP COMPLETO ================= */
/* Il backup completo, estratto dal bottone: adesso lo chiama anche la
   migrazione delle cote, che non deve poter scrivere senza averlo fatto.
   In modo `silent` non si apre il foglio di condivisione — si scarica e
   basta: la migrazione non e il momento di chiedere «dove lo mando?». */
async function fullBackup(opt){
  const silent=!!(opt&&opt.silent);
  const pkg={ebanist_backup:1,ver:APP_VER,date:new Date().toISOString(),
             state:{projects:state.projects,settings:state.settings}};
  const json=JSON.stringify(pkg);
  const fname=`Ebanist_Backup_${today()}.json`;
  state.lastBk=Date.now(); persist();
  if(!silent){
    try{
      const file=new File([json],fname,{type:"application/json"});
      if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:fname}); return; }
    }catch(e){}
  }
  download(fname,json,"application/json");
  if(!silent) toast("✓");
}
$("btnFullBk").addEventListener("click",()=>fullBackup());
$("geomApply").addEventListener("click",geomApply);

/* ================= FEEDBACK ================= */
/* DE CREAT ÎNAINTE DE DEPLOY: forwarding pe ebanist.com (register.it →
   pictograma EMAIL din panou). Până atunci butonul „Sugerează o funcție"
   deschide un mail către o adresă care nu există. Vechea `feedback@ebanist.app`
   era pe Namecheap; .app rămâne doar ca redirect (D-41). */
const FEEDBACK_EMAIL="feedback@ebanist.com";
$("btnFeedback").addEventListener("click",()=>{
  location.href=`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Ebanist v"+APP_VER+" — sugestie")}`;
});

/* ================= LOGO AZIENDALE ================= */
function prLogo(){ const S=state.settings;
  /* În mod atelier antetul e al atelierului, nu al utilizatorului: el e
     cel care primește comanda și el o dă mai departe clientului. */
  if(atelierMode()&&OrderRail.cfg&&OrderRail.cfg.logo)
    return `<img src="${esc(OrderRail.cfg.logo)}" style="height:34px;display:block;margin-left:auto;margin-bottom:4px">`;
  return S.logo?`<img src="${S.logo}" style="height:34px;display:block;margin-left:auto;margin-bottom:4px">`:""; }
/* Numele care apare pe documente. Tot al atelierului în mod atelier. */
function prCoName(){
  if(atelierMode()&&OrderRail.cfg&&OrderRail.cfg.name) return OrderRail.cfg.name;
  return state.settings.coName;
}
function prCoInfo(){
  if(atelierMode()&&OrderRail.cfg) return OrderRail.cfg.phone||"";
  return state.settings.coInfo;
}
$("btnLogo").addEventListener("click",()=>{
  const S=state.settings;
  if(S.logo){ confirmDlg(t("logoRemove")).then(okv=>{ if(okv){ delete S.logo; persist(); toast("✓"); } }); return; }
  $("logoFile").click();
});
$("logoFile").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const img=new Image();
  img.onload=()=>{
    const h=Math.min(140,img.height||140), w=(img.width||140)*h/(img.height||140);
    const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
    cv.getContext("2d").drawImage(img,0,0,w,h);
    const data=cv.toDataURL("image/png");
    if(data.length>120000){ toast(t("logoTooBig")); return; }
    state.settings.logo=data; persist(); toast("✓");
    URL.revokeObjectURL(img.src);
  };
  img.src=URL.createObjectURL(f); e.target.value="";
});

/* ================= CATALOGO FERRAMENTA & MATERIALI ================= */
const HW_CATS=[["cern","hwCern"],["guida","hwGuida"],["man","hwMan"],["sup","hwSup"],["asta","hwAsta"],["pied","hwPied"],["bin","hwBin"],["conn","hwConn"],["push","hwPush"]];
function renderCatalog(){
  const S=state.settings;
  $("catHwWrap").innerHTML=HW_CATS.map(([cat,key])=>{
    const sel=(S.hwProd||{})[cat]||"";
    const it=hwItem(cat)||{price:"",art:""};
    return `<div class="f" style="margin-bottom:10px">
      <label>${esc(t(key))}${it.chk?` <span class="mini" style="color:#b8860b">${esc(t("artCheck"))}</span>`:""}</label>
      <select data-cat="${cat}" class="catSel">${HWDB[cat].map(x=>`<option value="${x.id}"${x.id===sel?" selected":""}>${esc(x.brand+" — "+((x.n||{})[state.lang]||(x.n||{}).it||""))}</option>`).join("")}</select>
      <div style="display:flex;gap:8px;margin-top:6px">
        <input class="catArt" data-cat="${cat}" placeholder="${esc(t("catArt"))}" value="${esc(it.art||"")}" style="flex:2">
        <input class="catPrice" data-cat="${cat}" type="number" step="0.01" inputmode="decimal" placeholder="€" value="${it.price}" style="flex:1">
      </div></div>`;
  }).join("");
  const ov=state.settings.matOvr||{};
  $("catMatWrap").innerHTML=matAll().map(m=>{
    const eff=matById(m.id), hid=matHidden(m), custom=!!m.custom;
    return `<div class="cat-mat${hid?" off":""}">
      <div class="cat-mat-h">
        ${custom?`<input class="catMatName" data-mid="${m.id}" value="${esc(eff.label)}" style="flex:1">`
                :`<span style="flex:1;font-size:13.5px">${esc(eff.label)}</span>`}
        ${eff.coloreVerificato?"":`<span class="mp-unv" title="${esc(t("colUnverified"))}"></span>`}
        ${m.noEdge?`<span class="mini" style="color:#b8860b">${esc(t("noEdgeTag"))}</span>`:""}
        ${m.sup?`<span class="mini">${esc(m.sup)}</span>`:""}
        ${matIsLegacy(m)?`<span class="mini" title="${esc(t("matOldCat"))}">${esc(t("matOldTag"))}</span>`:""}
        <button class="iconbtn ${hid?"":"danger"}" data-hide="${m.id}" title="${esc(t(hid?"matShow":"matHide"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${hid
            ?'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'
            :'<path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M9.9 4.24A9.1 9.1 0 0 1 12 4c6 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6A17 17 0 0 0 2 11s4 7 10 7a9.7 9.7 0 0 0 3.4-.6"/>'}</svg></button>
      </div>
      <div class="cat-mat-r">
        <input class="catMatCode" data-mid="${m.id}" placeholder="${esc(t("catArt"))}" value="${esc(eff.codice||"")}">
        <input class="catMatDecor" data-mid="${m.id}" placeholder="${esc(t("decorPh"))}" value="${esc(eff.decor||"")}">
        <input class="catMatPrice" data-mid="${m.id}" type="number" step="0.01" inputmode="decimal" value="${eff.price}" title="€/m²">
      </div>
      <div class="cat-mat-r3">
        <input class="catMatTh" data-mid="${m.id}" type="number" inputmode="numeric" value="${eff.th}" ${custom?"":"disabled"} title="${esc(t("fThickness"))}">
        <input class="catMatPw" data-mid="${m.id}" type="number" inputmode="numeric" value="${eff.pw||state.settings.panelL}" title="L">
        <input class="catMatPh" data-mid="${m.id}" type="number" inputmode="numeric" value="${eff.ph||state.settings.panelW}" title="l">
      </div>
    </div>`;
  }).join("")+`<button class="btn" id="btnMatAdd" style="margin-top:6px">＋ ${esc(t("matAdd"))}</button>`;
  const setOvr=(mid,k,v)=>{ const S=state.settings; S.matOvr=S.matOvr||{}; S.matOvr[mid]=S.matOvr[mid]||{}; S.matOvr[mid][k]=v; };
  $("catMatWrap").querySelectorAll("[data-hide]").forEach(b2=>b2.addEventListener("click",()=>{
    const mid=b2.dataset.hide, cur=matHidden(mid);
    setOvr(mid,"hidden",!cur); persist(); renderCatalog(); fillMatSelects();
  }));
  /* IL CODICE ARTICOLO. E' quello che il magazzino chiede al telefono, ed e
     il campo che Liviu compila leggendo il pannello campioni: si scrive
     dall'app, non si tocca il file a mano. */
  $("catMatWrap").querySelectorAll(".catMatCode").forEach(i2=>i2.addEventListener("input",()=>{
    setOvr(i2.dataset.mid,"codice",i2.value.trim()||null); persist(); }));
  $("catMatWrap").querySelectorAll(".catMatTh").forEach(i2=>i2.addEventListener("input",()=>{
    const v=parseFloat(i2.value); if(isFinite(v)&&v>0){ setOvr(i2.dataset.mid,"th",v); persist(); } }));
  $("catMatWrap").querySelectorAll(".catMatPw").forEach(i2=>i2.addEventListener("input",()=>{
    const v=parseInt(i2.value,10); if(isFinite(v)&&v>100){ setOvr(i2.dataset.mid,"pw",v); persist(); } }));
  $("catMatWrap").querySelectorAll(".catMatPh").forEach(i2=>i2.addEventListener("input",()=>{
    const v=parseInt(i2.value,10); if(isFinite(v)&&v>100){ setOvr(i2.dataset.mid,"ph",v); persist(); } }));
  $("catMatWrap").querySelectorAll(".catMatName").forEach(i2=>i2.addEventListener("input",()=>{
    const S=state.settings, m2=(S.matAdd||[]).find(x=>x.id===i2.dataset.mid);
    if(m2){ m2.l={it:i2.value,ro:i2.value,en:i2.value,fr:i2.value}; persist(); fillMatSelects(); } }));
  $("btnMatAdd").addEventListener("click",()=>{
    const S=state.settings; S.matAdd=S.matAdd||[];
    S.matAdd.push({id:"m"+uid(),custom:1,th:19,price:0,c:"#e8e8e4",tx:"solid",
      pw:S.panelL,ph:S.panelW,famiglia:"tinta_unita",finitura:"melaminico",
      codice:null,coloreVerificato:false,attivo:true,
      l:{it:"Nuovo materiale",ro:"Material nou",en:"New material",fr:"Nouveau matériau"}});
    persist(); renderCatalog(); fillMatSelects();
  });
  document.querySelectorAll(".catSel").forEach(s=>s.addEventListener("change",e=>{
    const cat=e.target.dataset.cat;
    state.settings.hwProd=state.settings.hwProd||{};
    state.settings.hwProd[cat]=e.target.value;
    renderCatalog();
  }));
}
$("btnCatalog").addEventListener("click",()=>{ renderCatalog(); closeSheets(); openSheet("shCatalog"); });

/* --- il catalogo esce e rientra come JSON ---------------------------------
   Nello schema del FILE, non in quello interno: cosi quello che esce si puo
   rimettere in /data/ e diventare il catalogo di serie. Leggere i codici dal
   pannello campioni e un lavoro di ore: deve poter uscire dal telefono. */
function matCatalogDoc(){
  return {schema:1, fornitore:"Centro Legno", aggiornato:today(),
    _nota:"Esportato da Ebanist "+APP_VER,
    materiali:matAll().map(matToCatalog)};
}
$("btnMatExport").addEventListener("click",()=>{
  download("materiali-"+today()+".json",
           JSON.stringify(matCatalogDoc(),null,1),"application/json");
});
$("btnMatImport").addEventListener("click",()=>$("matImportFile").click());
$("matImportFile").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  e.target.value="";
  let doc=null;
  try{ doc=JSON.parse(await f.text()); }catch(err){ toast(t("importErr")); return; }
  if(!doc||!Array.isArray(doc.materiali)){ toast(t("matImportBad")); return; }
  const S=state.settings;
  S.matAdd=S.matAdd||[];
  let n=0;
  for(const m of doc.materiali){
    if(!m||!m.id||!(+m.spessore>0)) continue;
    const x=matFromCatalog(m); x.custom=1;
    /* UN ID = UNA REFERENZA. Un id che esiste gia si aggiorna, non si
       duplica: due righe con lo stesso id e la porta aperta a due
       grossezze diverse per lo stesso materiale. */
    const k=S.matAdd.findIndex(y=>y.id===x.id);
    if(k>=0) S.matAdd[k]=x; else S.matAdd.push(x);
    n++;
  }
  persist(); renderCatalog(); fillMatSelects();
  toast(t("matImported").replace("{n}",n));
});
$("btnCatalogSave").addEventListener("click",()=>{
  const S=state.settings; S.hwOvr=S.hwOvr||{}; S.matOvr=S.matOvr||{}; S.hwProd=S.hwProd||{};
  document.querySelectorAll(".catSel").forEach(s=>S.hwProd[s.dataset.cat]=s.value);
  document.querySelectorAll(".catArt").forEach(i=>{
    const id=(S.hwProd[i.dataset.cat]); if(!id)return;
    S.hwOvr[id]=S.hwOvr[id]||{}; S.hwOvr[id].art=i.value.trim();
  });
  document.querySelectorAll(".catPrice").forEach(i=>{
    const id=(S.hwProd[i.dataset.cat]); if(!id)return;
    const v=parseFloat(i.value); if(isFinite(v)){S.hwOvr[id]=S.hwOvr[id]||{};S.hwOvr[id].price=v;}
  });
  document.querySelectorAll(".catMatPrice").forEach(i=>{
    const v=parseFloat(i.value); if(isFinite(v)){S.matOvr[i.dataset.mid]=S.matOvr[i.dataset.mid]||{};S.matOvr[i.dataset.mid].price=v;}
  });
  document.querySelectorAll(".catMatDecor").forEach(i=>{
    S.matOvr[i.dataset.mid]=S.matOvr[i.dataset.mid]||{};S.matOvr[i.dataset.mid].decor=i.value.trim();
  });
  persist(); closeSheets(); toast("✓");
});

/* ================= PRO: FERRAMENTA / PREVENTIVO / SHARE ================= */
function computeHardware(p,S,byModule){
  const KEYS=["hwCern","hwGuida","hwMan","hwSup","hwAsta","hwPied","hwBin","hwConn","hwPush"];
  const mk=()=>{const o={};KEYS.forEach(k=>o[k]=0);return o;};
  const q=mk(), mods={}, binMods=new Set(), piedMods=new Set();
  const bump=(mod,k,n)=>{ q[k]+=n; if(byModule){ (mods[mod]=mods[mod]||mk())[k]+=n; } };
  for(const x of p.pieces){
    const el=(x.elemento||"").toLowerCase(), mod=x.modulo||"—";
    const push=el.includes("push");
    if(el.includes("anta scorrevole")){ binMods.add(mod); }
    else if(el.startsWith("anta")){ const hgt=Math.max(x.lung,x.larg);
      bump(mod,"hwCern",x.pz*hingeCount(hgt));
      bump(mod,push?"hwPush":"hwMan",x.pz); }
    else if(el.startsWith("montante anta vetro")){ const hgt=x.lung, nA=x.pz/2;
      bump(mod,"hwCern",nA*hingeCount(hgt));
      bump(mod,push?"hwPush":"hwMan",nA); }
    else if(el.startsWith("piedino")){ bump(mod,"hwPied",x.pz); }
    else if(el.startsWith("frontale cassetto")){ bump(mod,"hwGuida",x.pz);
      /* il cassetto interno sta dietro l'anta: si tira per il frontale,
         una maniglia li dentro urterebbe l'anta chiusa. */
      if(!el.includes("interno")) bump(mod,push?"hwPush":"hwMan",x.pz); }
    else if(el.includes("ripiano mobile")||el.includes("ripiano regolabile")){ bump(mod,"hwSup",4*x.pz); }
    else if(el.includes("asta appendiabiti")){ bump(mod,"hwAsta",2*x.pz); }
    else if(el.startsWith("zoccolo")){ piedMods.add(mod); }
    if(/^(base \/ cielo|tramezzo|ripiano fisso)/.test(el)) bump(mod,"hwConn",4*x.pz);
  }
  for(const m of binMods) bump(m,"hwBin",1);
  for(const m of piedMods) bump(m,"hwPied",4);
  const CAT={hwCern:"cern",hwGuida:"guida",hwMan:"man",hwSup:"sup",hwAsta:"asta",hwPied:"pied",hwBin:"bin",hwConn:"conn",hwPush:"push"};
  const items=KEYS.map(k=>{ const prod=hwItem(CAT[k]);
    const price=prod?prod.price:(S[k]||0);
    return {k,qty:q[k],price,tot:q[k]*price,prod}; });
  return byModule?{items,mods}:items;
}
/* ---------- quanti pannelli si comprano davvero ----------
   Una percentuale di sfrido a occhio e una stima; l'ottimizzazione di taglio,
   che questa app fa gia, e il numero vero. Un armadio da 7,4 m² di pezzi non si
   paga 7,4 m²+12%: si pagano 3 pannelli interi, perche il fornitore vende
   pannelli, non metri quadri. Sotto i due modi convivono. Il DEFAULT resta
   "area", perche i preventivi gia fatti non devono cambiare da soli; "pannelli"
   e il modo piu vicino alla spesa reale e si sceglie dalle Impostazioni.
   Il nesting e caro (24 impacchettamenti per materiale): il risultato si tiene
   in cache finche pezzi, formato, lama e magazzino non cambiano, cosi il
   Riepilogo non lo rifà a ogni ridisegno. */
let _puCache={k:"",v:null};
function panelUsage(p){
  const S=state.settings;
  /* Nella chiave entra anche il catalogo: `panelFor()` legge il formato del
     pannello da matOvr/matAdd, quindi cambiare il formato di una referenza
     cambia il numero di pannelli. Senza, il Riepilogo restava sul conto vecchio
     — in silenzio — finche non si toccava un pezzo. */
  const key=JSON.stringify([p.id,p.pieces.map(x=>[x.lung,x.larg,x.pz,x.materiale,x.grain||0]),
                            S.kerf,S.panelL,S.panelW,state.stock||[],S.matOvr||{},S.matAdd||[]]);
  if(_puCache.k===key) return _puCache.v;
  const tot=computeTotals(p), out={};
  for(const k of Object.keys(tot.mats)){
    const m=tot.mats[k];
    if(/^accessorio/i.test(m.label)){ out[k]={acc:1,neu:0,stock:0,area:m.area}; continue; }
    const PN=panelFor(m.label);
    const stk=(state.stock||[]).filter(r=>r.mat===m.label)
      .flatMap(r=>Array.from({length:Math.max(1,r.n|0)},()=>({L:r.L,W:r.W,id:r.id})));
    const res=nest(m.pieces,PN.L,PN.W,S.kerf,stk);
    out[k]={acc:0,neu:res.panels.filter(x=>!x.stock).length,
            stock:res.panels.filter(x=>x.stock).length,
            skipped:res.skipped.length,PN,area:m.area};
  }
  return (_puCache={k:key,v:out}).v;
}
function projectCosts(p){
  const S=state.settings, tot=computeTotals(p);
  const hw=computeHardware(p,S), hwTot=hw.reduce((s,i)=>s+i.tot,0);
  const areaWaste=tot.area*(1+S.waste/100);
  const byPanel=S.costMode==="panels";
  /* ogni riga porta con se la propria quantita e il proprio prezzo: cosi la
     tabella dei costi si legge e TORNA — prima mostrava "m² totali × prezzo
     generico" mentre il totale era calcolato coi prezzi di ogni materiale,
     e le due cose non si moltiplicavano fra loro. */
  const rows=[]; let cPanels=0, panelsNew=0, panelsStock=0, oversize=0, cWhole=0;
  /* il conto a pannelli interi si calcola SEMPRE, anche quando non e il modo
     scelto: e l'esborso reale dal fornitore e va mostrato accanto alla stima,
     perche i due numeri rispondono a due domande diverse — "quanto materiale
     entra nel mobile" e "quanto ne devo comprare oggi". */
  const PU=panelUsage(p);
  for(const k in tot.mats){
    const m=tot.mats[k], price=matPriceByLabel(m.label), u=PU&&PU[k];
    if(u&&!u.acc){ cWhole+=u.neu*(u.PN.L*u.PN.W/1e6)*price;
                   if(!byPanel){ panelsNew+=u.neu; panelsStock+=u.stock; oversize+=u.skipped||0; } }
    if(byPanel&&u&&!u.acc){
      const pa=u.PN.L*u.PN.W/1e6, unit=pa*price, c=u.neu*unit;
      cPanels+=c; panelsNew+=u.neu; panelsStock+=u.stock; oversize+=u.skipped||0;
      rows.push({label:m.label,mode:"pan",qty:u.neu,size:`${u.PN.L}×${u.PN.W}`,
                 unit,tot:c,stock:u.stock,area:m.area});
    }else{
      const a=m.area*(1+S.waste/100), c=a*price;
      cPanels+=c;
      rows.push({label:m.label,mode:"m2",qty:a,unit:price,tot:c,area:m.area});
    }
  }
  const cEdge=tot.edge*S.priceMl;
  const hours=p.hours||0, hourly=S.hourly!=null?S.hourly:35;
  const sub=cPanels+cEdge+hwTot, cLabor=sub*S.labor/100+hours*hourly, netto=sub+cLabor;
  const prezzo=netto*(1+(S.margin||0)/100), ivaAmt=prezzo*(S.iva||0)/100;
  return {tot,hw,hwTot,areaWaste,cPanels,cEdge,cLabor,hours,hourly,netto,prezzo,ivaAmt,
          rows,byPanel,panelsNew,panelsStock,oversize,cWhole};
}
function buildCsv(p){
  let csv="\uFEFFRif. Modulo;Elemento;Lunghezza (mm);Larghezza (mm);Pz.;Bordatura (ABS);Materiale;Lavorazioni\r\n";
  for(const x of p.pieces){
    const lav=[];
    scList(x).forEach(c=>lav.push("scasso "+c.l+"x"+c.w+" @X"+c.x+"/Y"+c.y));
    const hi=hingeInfo(x);
    if(hi) lav.push("cerniere "+hi.n+"x d35 @ "+hi.pos.join("/"));
    csv+=[x.modulo,x.elemento,x.lung,x.larg,x.pz,x.bordo,x.materiale,lav.join(" | ")].join(";")+"\r\n";
  }
  return csv;
}
$("btnShare").addEventListener("click",async()=>{
  const p=proj(); if(!p)return;
  const csv=buildCsv(p), fname=`Taglio_${slug(p.name)}.csv`;
  try{
    const file=new File([csv],fname,{type:"text/csv"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:fname}); return;
    }
  }catch(e){}
  download(fname,csv,"text/csv;charset=utf-8"); toast(t("csvDone"));
});
$("btnQuote").addEventListener("click",()=>{
  const p=proj(); if(!p)return;
  const S=state.settings, C=projectCosts(p);
  const byMod=new Map();
  for(const x of p.pieces){ const a=x.lung*x.larg*x.pz/1e6; byMod.set(x.modulo,(byMod.get(x.modulo)||0)+a); }
  let rows="";
  /* il prezzo si ripartisce sui moduli in proporzione all'area. Se l'area totale
     e zero (progetto di soli accessori) la divisione dava NaN stampato sul
     preventivo del cliente: in quel caso si ripartisce in parti uguali. */
  const A=C.tot.area, nMod=byMod.size||1;
  for(const [mod,a] of byMod){
    const cfg=p.configs&&(p.configs[mod]||p.configs[mod.replace(/ [AB]$/,"")]);
    const desc=cfg?`${cfg.L}×${cfg.H}×${cfg.P} mm`:`${fmt(a)} m²`;
    const share=A>0?C.prezzo*a/A:C.prezzo/nMod;
    rows+=`<tr><td>${esc(mod)}</td><td>${esc(desc)}</td><td class="n">€ ${fmt(share)}</td></tr>`;
  }
  $("printArea").innerHTML=`<div class="pr-head"><div><h1>${esc(t("quoteTitle"))}</h1>
    <div style="font-size:11pt;margin-top:2px"><b>${esc(t("printProject"))}:</b> ${esc(p.name)}<br>
    <b>${esc(t("client"))}:</b> ${esc(p.client||"—")}${p.phone?` · ${esc(p.phone)}`:""}<br>
    <b>${esc(t("date"))}:</b> ${today()}</div></div>
    <div class="co">${prLogo()}<b>${esc(prCoName())}</b><br>${esc(prCoInfo())}</div></div>
    <table><tr><th>${esc(t("fModule"))}</th><th>${esc(t("qDesc"))}</th><th style="text-align:right">${esc(t("amount"))}</th></tr>${rows}</table>
    <div class="pr-sum" style="text-align:right">${C.hours>0?`${esc(t("cLabor"))}: ${fmt(C.hours,1)}h × € ${fmt(C.hourly)} = € ${fmt(C.hours*C.hourly)} <span style="font-size:8pt">(${esc(t("qIncl"))})</span><br>`:""}${esc(t("qNet"))}: <b>€ ${fmt(C.prezzo)}</b><br>
    ${esc(t("qVat"))} ${S.iva||0}%: <b>€ ${fmt(C.ivaAmt)}</b><br>
    <span style="font-size:13pt">${esc(t("qTotal"))}: <b>€ ${fmt(C.prezzo+C.ivaAmt)}</b></span></div>
    ${p.notes?`<div style="margin-top:10px;font-size:9.5pt">${esc(p.notes)}</div>`:""}
    <div class="pr-foot"><span>${esc(t("qValidity"))}</span><span>Ebanist · ${esc(prCoName())}</span></div>`;
  printOut();
});
$("listSearch").addEventListener("input",e=>{listQ=e.target.value;renderList();});
$("listMat").addEventListener("change",e=>{listMatF=e.target.value;renderList();});
$("pGrain").addEventListener("click",()=>$("pGrain").classList.toggle("on"));
$("btnPieceDup").addEventListener("click",()=>{
  const p=proj(); if(!p||!editingPieceId)return;
  const i=p.pieces.findIndex(q=>q.id===editingPieceId);
  if(i<0)return;
  const c={...p.pieces[i],id:uid(),done:0};
  p.pieces.splice(i+1,0,c);
  persist(); closeSheets(); render(); toast(t("saved"));
});
$("btnProjectDup").addEventListener("click",()=>{
  if(!editingProjectId)return;
  const src=state.projects.find(q=>q.id===editingProjectId); if(!src)return;
  /* Duplicare e creare: stesso muro. Senza questo controllo il limite si
     aggirava aprendo un progetto e premendo «Duplica». */
  if(!gateNewProject()) return;
  const c=JSON.parse(JSON.stringify(src));
  delete c.demo;
  c.id=uid(); c.name=src.name+" "+t("copySuffix"); c.date=today();
  c.pieces.forEach(x=>{x.id=uid();x.done=0;});
  state.projects.unshift(c); state.activeId=c.id;
  persist(); closeSheets(); setView("list"); toast(t("saved"));
});

