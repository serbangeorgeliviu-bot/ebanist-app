"use strict";
/* ===========================================================================
   Ebanist — app/js/io.js

   Le vie d'ingresso e d'uscita dei dati: importazione CSV d'officina e
   backup JSON, esportazione, stampa e PDF.
   =========================================================================== */
/* ================= IMPORT (CSV workshop format / JSON backup) ================= */
$("btnImport").addEventListener("click",()=>$("fileInput").click());
$("fileInput").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    const txt=String(rd.result).replace(/^\uFEFF/,"");
    try{
      if(f.name.toLowerCase().endsWith(".json")||txt.trim().startsWith("{")) importJson(txt,f.name);
      else importCsv(txt,f.name);
    }catch(err){toast(t("invalidFile"));}
    e.target.value="";
  };
  rd.readAsText(f,"utf-8");
});
function importCsv(txt,fname){
  const lines=txt.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2) throw 0;
  const sep=lines[0].includes(";")?";":lines[0].includes("\t")?"\t":",";
  const pieces=[];
  for(let i=0;i<lines.length;i++){
    const c=lines[i].split(sep).map(s=>s.trim());
    let modulo,elemento,lung,larg,pz,bordo,materiale;
    if(c.length>=5&&parseFloat(c[2])>0&&parseFloat(c[3])>0){
      modulo=c[0];elemento=c[1];lung=parseFloat(c[2]);larg=parseFloat(c[3]);
      pz=parseInt(c[4],10)||1;bordo=c[5]||"";materiale=c[6]||"";
    } else if(c.length>=3&&parseFloat(c[0])>0&&parseFloat(c[1])>0){
      lung=parseFloat(c[0]);larg=parseFloat(c[1]);pz=parseInt(c[2],10)||1;
      modulo="Import";elemento="Pezzo";bordo=c[3]||"";materiale=c[4]||"";
    } else continue;
    pieces.push({id:uid(),modulo,elemento,lung:Math.round(lung),larg:Math.round(larg),pz,bordo,materiale:materiale||matById(state.settings.matBody||"pal18_alb").label});
  }
  if(!pieces.length) throw 0;
  /* Anche un CSV crea un progetto. Il controllo va qui e non solo sul
     bottone: «Importa» era la terza porta sul retro. */
  if(!gateNewProject()) return;
  const name=fname.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();
  const p={id:uid(),name,client:"",date:new Date().toISOString().slice(0,10),pieces};
  state.projects.unshift(p); state.activeId=p.id;
  persist(); setView("list"); toast(`${t("imported")}: ${pieces.length} ${t("importedRows")}`);
}
/* Il ripristino vero e proprio, staccato dalla domanda: lo chiamano sia
   l'import di un file di backup sia il recupero della copia automatica
   dentro IndexedDB. Una strada sola, cosi non ci sono due modi diversi di
   sovrascrivere i progetti. */
function doRestore(o){
  snapUndo();
  state.projects=o.state.projects;
  state.settings=Object.assign({},defaultState().settings,o.state.settings||{});
  state.activeId=state.projects[0]?state.projects[0].id:null;
  persist(); setView("list"); render(); undoToast(t("restored"));
}
function importJson(txt){
  const o=JSON.parse(txt);
  if(o&&o.ebanist_backup&&o.state&&Array.isArray(o.state.projects)){
    /* Il ripristino di un PROPRIO backup non passa dal cancello: sono
       progetti gia pagati o gia fatti, e rifiutarli vorrebbe dire tenere
       in ostaggio il lavoro di chi ha appena cambiato telefono. Chi torna
       sopra i due progetti gratuiti li tiene tutti; non ne puo creare di
       nuovi finche non scende sotto il limite o non passa a Pro. */
    confirmDlg(t("restoreConfirm")).then(okv=>{ if(okv) doRestore(o); });
    return;
  }
  if(o&&Array.isArray(o.pieces)&&o.name){
    if(!gateNewProject()) return;
    o.id=uid(); o.pieces.forEach(x=>x.id=uid()); delete o.demo;
    state.projects.unshift(o); state.activeId=o.id;
    persist(); setView("list"); toast(t("imported"));
  } else throw 0;
}

/* ================= EXPORT ================= */
function download(name,content,mime){
  const blob=new Blob([content],{type:mime});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);
}
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
$("btnCsv").addEventListener("click",()=>{
  const p=proj(); if(!p)return;
  /* il CSV va al debitatore come il PDF: stesse cote, stesso cancello,
     stessa foglia di chiusura */
  if(closureFirst("btnCsv")) return;
  if(!exportAllowed()) return;
  download(`Taglio_${slug(p.name)}.csv`,buildCsv(p),"text/csv;charset=utf-8");
  toast(t("csvDone"));
});
$("btnJson").addEventListener("click",()=>{
  const p=proj(); if(!p)return;
  /* QUESTA NON SI BLOCCA, ed e una scelta. Non e un documento di
     produzione: e la copia del progetto, quella con cui si passa da un
     telefono a un PC o si ripara un guasto. Bloccarla vorrebbe dire tenere
     in ostaggio il lavoro di qualcuno proprio nel momento in cui qualcosa
     non torna. Nessuno taglia da un backup. */
  download(`${slug(p.name)}.json`,JSON.stringify(p,null,2),"application/json");
  toast(t("jsonDone"));
});

/* ================= PRINT / PDF ================= */
$("btnPdf").addEventListener("click",()=>{
  const p=proj(); if(!p)return;
  /* Una regola bloccante caduta ferma QUI. Un avviso ignorabile non basta:
     e cosi che una distinta sbagliata e arrivata al debitatore. */
  /* PRIMA l'occhio umano. La foglia mostra QUALE corpo non torna; il
     cancello automatico scatta dopo, ed e comunque dentro printOut(). */
  if(closureFirst("btnPdf")) return;
  if(!exportAllowed()) return;
  const S=state.settings, tot=computeTotals(p);
  const groups=new Map();
  for(const x of p.pieces){if(!groups.has(x.modulo))groups.set(x.modulo,[]);groups.get(x.modulo).push(x);}
  let html=`<div class="pr-head">
    <div><h1>${esc(t("printTitle"))}</h1>
      <div style="font-size:11pt;margin-top:2px"><b>${esc(t("printProject"))}:</b> ${esc(p.name)}
      ${p.client?` — <b>${esc(t("client"))}:</b> ${esc(p.client)}`:""}<br>
      <b>${esc(t("date"))}:</b> ${esc(p.date||new Date().toISOString().slice(0,10))}</div>
      ${prTrace(p)}</div>
    <div class="co">${prLogo()}<b>${esc(prCoName())}</b><br>${esc(prCoInfo())}</div></div>`;
  for(const [mod,items] of groups){
    html+=`<h2>${esc(mod)}</h2><table><tr>
      <th>${esc(t("fElement"))}</th><th style="text-align:right">${esc(t("fLength"))}</th>
      <th style="text-align:right">${esc(t("fWidth"))}</th><th style="text-align:right">${esc(t("fQty"))}</th>
      <th>${esc(t("fBanding"))}</th><th>${esc(t("fMaterial"))}</th></tr>`;
    for(const x of items)
      html+=`<tr><td>${esc(x.elemento)}${scList(x).length?` <b style="font-size:8pt">✂ ${esc(scList(x).map(function(c){return c.l+"×"+c.w+" @ X"+c.x+"/Y"+c.y;}).join(" · "))}</b>`:""}${hingeTxt(x)?`<br><b style="font-size:8pt;color:#7a1c1c">⌀35 ${esc(hingeTxt(x))}</b>`:""}</td><td class="n">${x.lung}</td><td class="n">${x.larg}</td>
        <td class="n">${x.pz}</td><td>${esc(x.bordo||"—")}</td><td>${esc(x.materiale)}</td></tr>`;
    html+="</table>";
  }
  const hwP=computeHardware(p,S).filter(i2=>i2.qty>0);
  if(hwP.length){
    html+=`<h2>${esc(t("hardware"))}</h2><table><tr><th>${esc(t("item"))}</th><th>${esc(t("catProd"))}</th><th>${esc(t("catArt"))}</th><th style="text-align:right">${esc(t("qty"))}</th></tr>`;
    for(const i2 of hwP) html+=`<tr><td>${esc(t(i2.k))}</td><td>${i2.prod?esc(i2.prod.brand+" "+i2.prod.name):"—"}</td><td>${i2.prod?esc(i2.prod.art):"—"}</td><td class="n">${i2.qty}</td></tr>`;
    html+="</table>";
  }
  html+=`<div class="pr-sum"><b>${esc(t("totalPieces"))}:</b> ${tot.pcs} ·
    <b>${esc(t("totalArea"))}:</b> ${fmt(tot.area)} m² ·
    <b>${esc(t("edgeBanding"))}:</b> ${fmt(tot.edge,1)} ml</div>
    <div class="pr-foot"><span>${esc(t("printNotes"))}</span><span>Ebanist · ${esc(prCoName())}</span></div>`;
  $("printArea").innerHTML=html;
  printOut();
});

