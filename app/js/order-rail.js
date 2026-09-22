"use strict";
/* ===========================================================================
   Ebanist — app/js/order-rail.js

   Order Rail dentro l'app: pacchetto d'ordine, documenti presi dai
   generatori veri, invio al laboratorio e modo atelier.
   =========================================================================== */
/* ================= ORDER RAIL — cablajul din aplicație =================
   Modulele din /order-rail/ nu știu nimic despre `state` și nu au voie să
   știe. Aici se leagă: de o parte funcțiile aplicației, de alta motorul
   de preț și pachetul de comandă. */

function orDeps(){
  return {computeTotals, computeHardware, scList, normMat, bandingMm,
          matIdByLabel, isAccessoryMat, settings: state.settings};
}
const OR_LINE_I18N={panel:null,edge:"orEdge",hole:"orHoles",cutout:"orCutouts",
                    labour:"orLabour",min_order:"orMinOrder",accessory:"orAccessories"};
function orLineLabel(l){
  if(l.kind==="panel") return l.label;
  const k=OR_LINE_I18N[l.kind];
  return k?t(k):l.kind;
}
function orMoney(n){ return OrderRail.fmtMoney(n,state.lang); }

/* Recalculează și redesenează bara. Se cheamă la fiecare `render()`:
   prețul trebuie să se miște când se mișcă o cotă, altfel clientul nu
   leagă cifra de ce a schimbat. */
function orRefresh(){
  const bar=$("orBar");
  if(!atelierMode()||!OrderRail.ready){ bar.classList.remove("on"); return; }
  bar.classList.add("on");
  const p=proj();
  $("orBarLbl").textContent=t("orBar");
  $("orSendLbl").textContent=t("orSend").replace("{a}",OrderRail.cfg.name);
  const empty=!p||!p.pieces.length;
  $("orSendBtn").disabled=empty;
  if(empty){
    $("orAmt").textContent="—";
    $("orWarn").hidden=false; $("orWarn").textContent=t("orNoPieces");
    $("orDetail").innerHTML=""; return;
  }
  const q=OrderRail.price(p,orDeps());
  if(!q){ bar.classList.remove("on"); return; }
  $("orAmt").textContent=orMoney(q.total);

  /* Un material care a căzut pe prețul implicit se SPUNE. Un preț tăcut
     pe o placă pe care atelierul n-o ține e felul în care se pierde o
     comandă — la telefon, o zi mai târziu. */
  const mats=q.warnings.filter(w=>w.code==="material_not_priced");
  if(mats.length){
    $("orWarn").hidden=false;
    $("orWarn").textContent=mats.map(w=>t("orWarnMat").replace("{m}",w.material)).join(" · ");
  } else $("orWarn").hidden=true;

  $("orToggle").textContent=($("orDetail").classList.contains("on")?"▾ ":"▸ ")+t("orDetail");
  let h='<table>';
  for(const l of q.lines){
    const qty=l.unitName==="pcs"?l.qty:fmt(l.qty,l.unitName==="m2"?3:2);
    h+=`<tr><td>${esc(orLineLabel(l))}</td><td class="n">${esc(String(qty))} ${esc(l.unitName==="pcs"?"":l.unitName)}</td><td class="n">${esc(orMoney(l.total))}</td></tr>`;
  }
  h+=`<tr class="sum"><td>${esc(t("orNet"))}</td><td></td><td class="n">${esc(orMoney(q.net))}</td></tr>`;
  h+=`<tr><td>${esc(t("orVat"))} ${q.vatPct}%</td><td></td><td class="n">${esc(orMoney(q.vat))}</td></tr>`;
  h+=`<tr class="sum"><td>${esc(t("orTotal"))}</td><td></td><td class="n">${esc(orMoney(q.total))}</td></tr></table>`;
  if(q.modules&&Object.keys(q.modules).length>1){
    h+=`<div class="mod">${esc(t("orPerModule"))}</div><table>`;
    for(const name in q.modules)
      h+=`<tr><td>${esc(name)}</td><td class="n">${esc(orMoney(q.modules[name].net))}</td></tr>`;
    h+="</table>";
  }
  h+=`<p class="mini" style="margin-top:8px">${esc(t("orPriceNote"))} · ${esc(t("orEstimate"))}</p>`;
  $("orDetail").innerHTML=h;
}

/* ---- documentele, luate de la generatoarele adevărate ----
   Se apasă butoanele, nu se rescrie conținutul: ce ajunge la atelier e
   bit cu bit ce tipărește aplicația. */
function orDocs(){
  const css=OrderPkg.printCss();
  const want=[["btnPdf","distinta"],["btnMont","montaj"],["btnLabels","etichete"]];
  const out={};
  const keep=PRINT_CAPTURE;
  for(const [btn,key] of want){
    PRINT_CAPTURE=[];
    /* La foglia di chiusura e un GESTO UMANO: si apre quando qualcuno preme
       il bottone, non quando lo preme il costruttore del pacchetto. Senza
       questa riga btnPdf apriva la foglia e tornava indietro senza stampare
       niente, e all'atelier partiva un ordine SENZA distinta — proprio il
       documento da cui si taglia. Il cancello automatico non si tocca:
       `exportAllowed()` sta dentro il bottone, subito dopo, e se un corpo
       non si chiude la distinta non esce lo stesso. */
    CL_PASSED=btn;
    try{ $(btn).click(); }catch(e){}
    CL_PASSED=null;
    const html=PRINT_CAPTURE[0];
    if(html) out[key]=OrderPkg.wrapDoc(key,html,css);
  }
  PRINT_CAPTURE=keep;
  return out;
}

/* ---- pachetul ---- */
async function orBuildPackage(customer){
  const p=proj(), c=OrderRail.cfg;
  const q=OrderRail.price(p,orDeps());
  const lab={ebanist_lab:1,name:p.name,date:p.date,deadline:p.deadline||null,
    pieces:p.pieces.map(x=>({modulo:x.modulo,elemento:x.elemento,lung:x.lung,larg:x.larg,pz:x.pz,
      bordo:x.bordo,scasso:scList(x),
      materiale:x.materiale+(matDecorByLabel(x.materiale)?" ["+matDecorByLabel(x.materiale)+"]":"")}))};
  /* Snapshot-ul e DESENUL, nu evidența aplicației. Fără curățarea asta,
     `lastOrder` — care ține minte comanda dinainte — intra în hash: a
     doua trimitere ieșea cu alt hash chiar dacă nu se schimbase nicio
     cotă, iar aplicația năștea un v2 pentru o apăsare în plus. Atelierul
     ar fi primit versiuni fantomă ale unei comenzi neschimbate. */
  const cleanProject=JSON.parse(JSON.stringify(p));
  delete cleanProject.lastOrder; delete cleanProject.orSeeded; delete cleanProject.demo;
  const snapshot={project:cleanProject,settings:{panelL:state.settings.panelL,panelW:state.settings.panelW,
    kerf:state.settings.kerf,edgeTh:state.settings.edgeTh},
    appVer:APP_VER,geomVersion:GEOM_VERSION};
  const hash=await OrderPkg.sha256(OrderPkg.canonical(snapshot));

  /* Versionarea. Proiectul ține minte ultima comandă trimisă din el. A
     doua trimitere nu e o comandă nouă fără legătură: e v2, cu părinte
     și cu diferența pe piese. În atelier, v1 poate fi deja pe masa de
     debitat — cine primește v2 trebuie să vadă din prima ce s-a
     schimbat, nu să compare două liste cu ochiul. */
  const prev=p.lastOrder||null;
  let id, version=1, parent=null, diff=null;
  if(prev&&prev.id){
    if(prev.hash===hash){
      /* Nimic schimbat de la ultima trimitere: nu se creează v2 pentru
         o apăsare în plus. Se retrimite acelaşi număr. */
      id=prev.id; version=prev.version||1; parent=prev.parent||null;
    }else{
      version=(prev.version||1)+1;
      parent=prev.id;
      id=(prev.base||prev.id.split("-v")[0])+"-v"+version;
      diff=OrderPkg.diffPieces(prev.pieces||[],p.pieces);
    }
  }else{ id=OrderPkg.newId(); }

  const order={
    id:id, version:version, parent:parent, diff:diff,
    atelier:c.slug, atelierName:c.name,
    customer:{name:customer.name,phone:customer.phone},
    created_at:new Date().toISOString(),
    status:"received",
    lang:state.lang,
    modules:Object.keys(q.modules||{}).length,
    pieces:q ? p.pieces.reduce((a,x)=>a+(+x.pz||0),0) : 0,
    price:{currency:q.currency,net:q.net,vatPct:q.vatPct,vat:q.vat,total:q.total,lines:q.lines,
           warnings:q.warnings,modules:q.modules||{}},
    appVer:APP_VER, geomVersion:GEOM_VERSION, hash:hash
  };
  const docs=orDocs();
  /* Un ordine a cui manca la distinta non e un ordine a meta: e un ordine
     inutile. Meglio fermarsi qui, con un messaggio leggibile, che mandare
     all'atelier un pacchetto da cui non si puo tagliare. */
  if(!docs.distinta) throw new Error(t("orDocsFail"));
  return {order,lab,snapshot,docs};
}

function orWaText(o){
  return t("orWaText").replace("{id}",o.id).replace("{c}",o.customer.name)
    .replace("{n}",o.modules||1).replace("{p}",o.pieces)
    .replace("{t}",orMoney(o.price.total))
    + "\n" + location.origin + "/a/" + o.atelier + "/order/" + o.id;
}

/* ---- trimiterea ---- */
$("orSendBtn").addEventListener("click",()=>{
  const p=proj(); if(!p||!p.pieces.length){ toast(t("orNoPieces")); return; }
  orEvent("order_started");
  const q=OrderRail.price(p,orDeps());
  $("orRecap").textContent=`${p.pieces.reduce((a,x)=>a+(+x.pz||0),0)} ${t("pieces")} · ${orMoney(q.total)}`;
  $("orFormMsg").textContent="";
  closeSheets(); openSheet("shOrder");
  setTimeout(()=>{ try{ $("orName").focus(); }catch(e){} },250);
});
$("orToggle").addEventListener("click",()=>{ $("orDetail").classList.toggle("on"); orRefresh(); });

$("orConfirmBtn").addEventListener("click",async()=>{
  const name=$("orName").value.trim(), phone=$("orPhone").value.trim();
  const msg=$("orFormMsg"); msg.style.color="var(--warn)";
  if(!name){ msg.textContent=t("orNameReq"); $("orName").focus(); return; }
  if(!phone){ msg.textContent=t("orPhoneReq"); $("orPhone").focus(); return; }
  const btn=$("orConfirmBtn"); btn.disabled=true;
  const old=btn.querySelector("span").textContent;
  btn.querySelector("span").textContent=t("orSending");
  msg.style.color=""; msg.textContent="";
  let pkg=null, sent=false;
  try{ pkg=await orBuildPackage({name,phone}); }
  catch(e){ btn.disabled=false; btn.querySelector("span").textContent=old;
            msg.style.color="var(--warn)"; msg.textContent=String((e&&e.message)||e); return; }
  try{
    const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({order:pkg.order,lab:pkg.lab,snapshot:pkg.snapshot,docs:pkg.docs})});
    if(r.ok){ sent=true; }
  }catch(e){}
  /* Reușit sau nu, comanda NU se pierde: rămâne pe dispozitiv și în
     pachetul descărcat. Zece minute de proiectare nu au voie să dispară
     fiindcă a picat o funcție. */
  try{ await EBStore.putBackup({id:"order-"+pkg.order.id,at:Date.now(),ver:APP_VER,
        json:JSON.stringify({order:pkg.order,lab:pkg.lab,snapshot:pkg.snapshot})}); }catch(e){}
  /* Se ține minte DOAR după ce pachetul a fost construit cu succes:
     altfel o eroare pe drum ar face ca următoarea trimitere să pretindă
     că e v2 a unei comenzi care n-a existat niciodată. */
  const pr=proj();
  if(pr){
    pr.lastOrder={id:pkg.order.id, base:pkg.order.id.split("-v")[0],
                  version:pkg.order.version, parent:pkg.order.parent,
                  hash:pkg.order.hash, at:Date.now(),
                  pieces:JSON.parse(JSON.stringify(pr.pieces))};
    persist();
  }
  btn.disabled=false; btn.querySelector("span").textContent=old;
  orEvent("order_sent");
  orShowDone(pkg,sent);
});

function orShowDone(pkg,sent){
  const o=pkg.order;
  $("orDoneTitle").textContent=sent?t("orSentTitle"):t("orFailTitle");
  const wa=OrderRail.waLink(orWaText(o));
  let h="";
  if(!sent) h+=`<p class="mini" style="color:var(--warn);line-height:1.45;margin-bottom:10px">${esc(t("orLocalOnly"))}</p>`;
  h+=`<div class="f"><label>${esc(t("orIdIs"))}</label>`+
     `<div style="font-family:var(--font-disp);font-size:26px;font-weight:700;letter-spacing:1px">${esc(o.id)}</div></div>`+
     `<div class="f"><label>${esc(t("orTotal"))}</label>`+
     `<div style="font-family:var(--font-disp);font-size:22px;font-weight:700">${esc(orMoney(o.price.total))}</div></div>`;
  if(wa) h+=`<a class="btn red" href="${esc(wa)}" target="_blank" rel="noopener" style="margin-top:8px"><span>${esc(t("orShareWa"))}</span></a>`;
  h+=`<button class="btn" id="orDl" style="margin-top:8px"><span>${esc(t("orDownload"))}</span></button>`;
  if(sent) h+=`<a class="btn" href="/a/${esc(o.atelier)}/order/${esc(o.id)}" target="_blank" rel="noopener" style="margin-top:8px"><span>${esc(t("orOpenOrder"))}</span></a>`;
  $("orDoneBody").innerHTML=h;
  $("orDl").addEventListener("click",()=>orDownloadZip(pkg));
  closeSheets(); openSheet("shOrderDone");
}

function orDownloadZip(pkg){
  const files={"order.json":JSON.stringify(pkg.order,null,1),
               "lab.json":JSON.stringify(pkg.lab,null,1),
               "snapshot.json":JSON.stringify(pkg.snapshot,null,1)};
  for(const k in pkg.docs) files[k+".html"]=pkg.docs[k];
  downloadBlob("Comanda_"+pkg.order.id+".zip",OrderPkg.zip(files));
}

/* ---- evenimente: cinci, fără nimic care identifică persoana ---- */
let OR_SESSION=null, OR_T0=Date.now(), OR_FIRST_PDF=false;
function orEvent(name,extra){
  if(!atelierMode()) return;
  if(!OR_SESSION){ try{ OR_SESSION=Math.random().toString(36).slice(2,10); }catch(e){ OR_SESSION="x"; } }
  const ev=Object.assign({e:name,s:OR_SESSION,a:OrderRail.slug,t:Date.now()},extra||{});
  try{
    const body=JSON.stringify(ev);
    if(navigator.sendBeacon) navigator.sendBeacon("/api/stats",new Blob([body],{type:"application/json"}));
    else fetch("/api/stats",{method:"POST",headers:{"Content-Type":"application/json"},body:body,keepalive:true}).catch(()=>{});
  }catch(e){}
  try{
    const k="ebanist_ev";
    const arr=JSON.parse(localStorage.getItem(k)||"[]");
    arr.push(ev); localStorage.setItem(k,JSON.stringify(arr.slice(-200)));
  }catch(e){}
}
/* Primul PDF: se măsoară o dată, de la deschiderea linkului. E cifra care
   spune dacă „sub 10 minute" e adevărat sau doar scris în plan. */
function orFirstPdf(){
  if(OR_FIRST_PDF||!atelierMode()) return;
  OR_FIRST_PDF=true;
  orEvent("first_pdf_time",{ms:Date.now()-OR_T0});
}

/* ---- pornirea modului atelier ---- */
async function orBoot(){
  if(!OrderRail.active()) return;
  await OrderRail.load();
  if(!OrderRail.slug){ toast("atelier?"); return; }
  const c=OrderRail.cfg;

  /* Limba atelierului, dar numai dacă utilizatorul n-a ales una: alegerea
     lui e a lui, pe orice link ar intra. */
  let urlLang=null;
  try{ urlLang=new URLSearchParams(location.search).get("lang"); }catch(e){}
  if(!state.langChosen&&!urlLang&&c.language&&I18N[c.language]){ state.lang=c.language; }

  /* Identitatea în header. Numele aplicației lasă locul numelui
     atelierului: clientul comandă de la el, nu de la noi. */
  const bt=document.querySelector(".brand-txt h1");
  if(bt) bt.textContent=c.name;
  if(c.logo){
    const mark=document.querySelector(".brand-mark");
    if(mark){ mark.innerHTML=`<img class="at-logo" src="${esc(c.logo)}" alt="${esc(c.name)}">`; }
  }
  /* Abonamentul nu-l privește pe clientul atelierului. */
  ["btnGoPro","btnLicCheck","btnLicOff"].forEach(id=>{ const e=$(id); if(e) e.style.display="none"; });
  const pl=$("proStateLine"); if(pl) pl.textContent=c.name;

  /* Corpul implicit: la deschiderea linkului trebuie să existe deja ceva,
     ca butonul de comandă să aibă ce număra și clientul să MODIFICE, nu
     să înceapă de la pagina albă. */
  orSeedBody();

  applyLang(); render(); orRefresh();
  orEvent("session_start");
}

function orSeedBody(){
  const p=proj(); if(!p||p.orSeeded) return;
  /* Proiectul de pornire al aplicației e un exemplu cu piese vechi. Pe
     linkul unui atelier el nu are ce căuta: clientul trebuie să vadă UN
     corp, pe care să-l modifice. Se înlocuiesc doar piesele exemplului
     (`demo`) — un proiect al utilizatorului nu se atinge niciodată. */
  if(p.pieces.length && !p.demo) return;
  p.pieces=[]; p.configs={};
  const cfg=Object.assign({},PRESETS.armadio,{
    /* nessun `t:` qui: la grossezza la da il materiale, come per ogni
       altro corpo. Scritta a mano sarebbe stata la ventesima copia di 18. */
    name:t("demoName"), L:800, H:2000, P:600,
    tram:0, shelves:3, drawers:0, doors:2, hang:1, plinth:80, back:1,
    matBody:"bianco_19", matFront:"bianco_19", matBack:"pfl3",
    secMode:[], drawerZone:0
  });
  try{
    generateInto(p,cfg);
    p.orSeeded=1; p.demo=1;
    persist();
  }catch(e){ /* niciodată blocant: se poate comanda și de la zero */ }
}

