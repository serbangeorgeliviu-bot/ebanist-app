"use strict";
/* ===========================================================================
   Ebanist — app/js/render.js

   Il disegno delle quattro viste (progetti, distinta, taglio, riepilogo) e
   gli editor: pezzo, progetto, impostazioni e lingua.
   =========================================================================== */
/* ================= RENDER ================= */
function render(){
  const p=proj();
  $("hProject").textContent = p ? p.name + (p.client? " · "+p.client : "") : t("selectProject");
  if(currentView==="projects") renderProjects();
  if(currentView==="survey") renderSurvey();
  if(currentView==="list") renderList();
  if(currentView==="build") renderBuild();
  if(currentView==="nest") renderNest();
  if(currentView==="summary") renderSummary();
  if(typeof orRefresh==="function") orRefresh();
}

function renderProjects(){
  const box=$("projectList"); box.innerHTML="";
  if(!state.projects.length){
    box.innerHTML=`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><p>${esc(t("noProjects"))}</p></div>`;
    return;
  }
  for(const p of state.projects){
    const tot=computeTotals(p);
    const mods=new Set(p.pieces.map(x=>x.modulo)).size;
    const donePz=p.pieces.reduce((s,x)=>s+(x.done?x.pz:0),0);
    const pct=tot.pcs?Math.round(donePz/tot.pcs*100):0;
    let dl="";
    if(p.deadline){
      const days=Math.ceil((new Date(p.deadline)-Date.now())/864e5);
      const col=days<0?"var(--danger)":days<7?"var(--warn)":"var(--faint)";
      dl=` · <span style="color:${col};font-weight:600">⏳ ${days} ${esc(t("daysLeft"))}</span>`;
    }
    const div=document.createElement("div");
    div.className="card"+(p.id===state.activeId?" pj-active":"");
    div.innerHTML=`
      <div class="row">
        <div class="grow">
          <div class="pj-name">${esc(p.name)}</div>
          <div class="pj-meta">${esc(p.client||"")}${p.client?" · ":""}${esc(p.date||"")}${dl}</div>
        </div>
        ${p.id===state.activeId?`<span class="tag-active">${esc(t("active"))}</span>`:""}
        <button class="iconbtn" data-edit><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>
      </div>
      <div class="pj-stats">
        <div class="pj-stat"><b>${tot.pcs}</b><span>${esc(t("pieces"))}</span></div>
        <div class="pj-stat"><b>${mods}</b><span>${esc(t("modules"))}</span></div>
        <div class="pj-stat"><b>${fmt(tot.area)}</b><span>m²</span></div>
        <div class="pj-stat"><b>${fmt(tot.edge,1)}</b><span>ml</span></div>
      </div>
      ${tot.pcs?`<div class="prog"><i style="width:${pct}%"></i></div><div class="mini" style="margin-top:4px">${donePz}/${tot.pcs} · ${pct}%</div>`:""}
      <div class="pj-add">
        <button class="btn sm red" data-addmod>＋ ${esc(t("addFurniture"))}</button>
        <button class="btn sm ghost" data-addpiece>＋ ${esc(t("addPlainPiece"))}</button>
      </div>`;
    div.addEventListener("click",e=>{
      if(e.target.closest("[data-edit]")){openProjectEditor(p.id);return;}
      const act=()=>{ state.activeId=p.id; listQ=""; listMatF=""; $("listSearch").value=""; persist(); };
      if(e.target.closest("[data-addmod]")){ act(); buildCfg={...PRESETS.armadio,name:""}; if(buildFormReady)syncBuildForm(); setView("build"); return; }
      if(e.target.closest("[data-addpiece]")){ act(); setView("list"); openPieceEditor(null); return; }
      act(); setView("list");
    });
    box.appendChild(div);
  }
}

/* etichetta cota corta + angoli, es. "/1163 ∠84°" */
function angTag(x){
  if(!isAng(x.angL)&&!isAng(x.angR)) return "";
  const se=Math.round(shortEdge(x.lung,x.larg,x.angL,x.angR));
  const a=[isAng(x.angL)?x.angL+"°":null,isAng(x.angR)?x.angR+"°":null].filter(Boolean).join("/");
  return `<span class="pc-ang">↘${se} ∠${a}</span>`;
}
/* Un pezzo tondo o curvo si taglia come un rettangolo: la misura in distinta e
   quella giusta per la sezionatrice. Ma senza dire QUANTO e tondo, o quanti
   intagli servono, in officina quel rettangolo si monta dritto. */
function curveTag(x){
  const out=[];
  if(x.shape==="tondo") out.push(t("roundShape").replace("{d}",x.lung));
  else if(x.shape==="ovale") out.push(t("ovalShape").replace("{a}",x.lung).replace("{b}",x.larg));
  else if(x.shape==="raccordo") out.push(t("filletShape").replace("{r}",x.rc));
  if(x.curve){
    const c=x.curve;
    out.push(t("curveDev")+" "+c.dev+" mm"+(c.seg>1?" · "+t("curveBandSeg").replace("{n}",c.seg):""));
    if(c.radius) out.push(t("curveRadius").replace("{r}",c.radius));
    /* dove cominciano gli archi: nei tratti dritti il pannello NON si intaglia,
       e senza queste quote gli intagli finiscono nel posto sbagliato */
    if(c.arcAt&&c.arcAt.length) out.push(t("curveArcAt").replace("{a}",c.arcAt.join(" / ")));
    if(c.kerf) out.push(t("curveKerf").replace("{n}",c.kerf.n).replace("{s}",c.kerf.spacing).replace("{d}",c.kerf.depth));
  }
  if(!out.length) return "";
  const warn=x.curve&&x.curve.kerf&&x.curve.kerf.tight;
  return `<div class="pc-joint wrap${warn?" vis":""}">◠ ${esc(out.join(" · "))}</div>`;
}
function jointTag(x){
  if(!x.joint&&!x.angSkip) return "";
  if(x.angSkip) return `<div class="pc-joint vis">⚠︎ ${esc(t("angSkipTag"))}</div>`;
  const vis=x.joint==="visible";
  return `<div class="pc-joint${vis?" vis":""}">⋈ ${esc(t(vis?"jointVisible":"jointHidden"))}</div>`;
}
let listQ="", listMatF="";
function renderList(){
  const p=proj(); const box=$("pieceList"); box.innerHTML="";
  /* il semaforo si ridipinge con la lista: cambiare un pezzo a mano puo
     rompere una coerenza tanto quanto rigenerare il corpo */
  try{ geomBanner(); auditBadge(); }catch(e){}
  if(!p){box.innerHTML=`<div class="empty"><p>${esc(t("selectProject"))}</p></div>`;$("listSub").textContent="";return;}
  const tot=computeTotals(p);
  $("listSub").textContent=`${p.name} — ${tot.pcs} ${t("pieces")} · ${fmt(tot.area)} m²`;
  $("listSearch").placeholder=t("searchPh");
  const sel=$("listMat");
  const mats=[...new Set(p.pieces.map(x=>x.materiale))];
  if(listMatF&&!mats.includes(listMatF)) listMatF="";
  sel.innerHTML=`<option value="">${esc(t("allMats"))}</option>`+mats.map(m=>`<option value="${esc(m)}"${m===listMatF?" selected":""}>${esc(m)}</option>`).join("");
  if(!p.pieces.length){
    box.innerHTML=`<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg><p>${esc(t("noPieces"))}</p></div>`;
    return;
  }
  const q=listQ.trim().toLowerCase();
  const match=x=>(!q||`${x.modulo} ${x.elemento} ${x.materiale}`.toLowerCase().includes(q))&&(!listMatF||x.materiale===listMatF);
  const groups=new Map();
  for(const x of p.pieces){ if(!match(x))continue; if(!groups.has(x.modulo))groups.set(x.modulo,[]); groups.get(x.modulo).push(x); }
  if(!groups.size){ box.innerHTML=`<div class="empty"><p>—</p></div>`; return; }
  for(const [mod,items] of groups){
    const n=items.reduce((s,x)=>s+x.pz,0);
    const done=items.reduce((s,x)=>s+(x.done?x.pz:0),0);
    const g=document.createElement("div"); g.className="mod";
    const _base=mod.replace(/ [AB]$/,"");
    const cfgKey=p.configs?(p.configs[mod]?mod:(p.configs[_base]?_base:null)):null;
    const hasCfg=!!cfgKey;
    g.innerHTML=`<div class="mod-h"><h3>${esc(mod)}</h3>${hasCfg?`<button class="iconbtn" data-cfg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7.3 12 12l8.7-4.7M12 22V12"/></svg></button>`:""}<button class="iconbtn" data-dup><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="iconbtn danger" data-delmod title="${esc(t("deleteModule"))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button><span class="cnt">${done}/${n} ${esc(t("pieces"))}</span></div>`;
    if(hasCfg)g.querySelector("[data-cfg]").addEventListener("click",e=>{e.stopPropagation();openBuilder(cfgKey);});
    g.querySelector("[data-delmod]").addEventListener("click",e=>{
      e.stopPropagation(); snapUndo();
      p.pieces=p.pieces.filter(x=>x.modulo!==mod);
      if(p.configs){ delete p.configs[mod]; delete p.configs[_base]; }
      if(p.layout){ delete p.layout[mod]; }
      persist(); render(); undoToast(t("deleted")+" · "+mod);
    });
    g.querySelector("[data-dup]").addEventListener("click",e=>{
      e.stopPropagation();
      let nn=2; const base=mod.replace(/ \(\d+\)$/,"");
      while(p.pieces.some(x=>x.modulo===`${base} (${nn})`)) nn++;
      const newMod=`${base} (${nn})`;
      const copies=p.pieces.filter(x=>x.modulo===mod).map(x=>({...x,id:uid(),modulo:newMod,done:0}));
      p.pieces.push(...copies);
      if(p.configs&&p.configs[mod]) p.configs[newMod]={...p.configs[mod],name:newMod};
      persist(); renderList(); toast("⧉ "+newMod);
    });
    for(const x of items){
      const r=document.createElement("div"); r.className="pc"+(x.done?" isdone":"");
      const shortMat=x.materiale.replace(/Truciolare Bilaminato/i,"Bilam.");
      r.innerHTML=`
        <button class="pc-check${x.done?" on":""}" data-chk><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></button>
        <div class="pc-dim">${x.lung}<i>×</i>${x.larg}${angTag(x)}</div>
        <div class="pc-info"><div class="pc-el">${esc(x.elemento)}${scList(x).length?` <span style="color:var(--red,#c33);font-size:11px">✂ ${esc(scTxt(x))}</span>`:""}</div><div class="pc-mat">${esc(shortMat)}</div>${jointTag(x)}${curveTag(x)}</div>
        <div class="pc-right"><div class="pc-pz">×${x.pz}</div><div class="pc-bordo">${x.grain?"↕ ":""}${esc(x.bordo||"—")}</div></div>`;
      r.querySelector("[data-chk]").addEventListener("click",e=>{
        e.stopPropagation(); x.done=x.done?0:1; persist(); renderList();
      });
      r.addEventListener("click",()=>openPieceEditor(x.id));
      g.appendChild(r);
    }
    box.appendChild(g);
  }
}

function renderNest(){
  const p=proj(); const out=$("nestOut"); const kp=$("nestKpis"); out.innerHTML=""; kp.innerHTML="";
  if(!p||!p.pieces.length){out.innerHTML=`<div class="empty"><p>${esc(t("noPieces"))}</p></div>`;return;}
  const S=state.settings;
  const tot=computeTotals(p);
  let panelCount=0, effSum=0, effN=0, stockUsed=0;
  const leftovers=[];
  const oversize=[];
  const frag=document.createDocumentFragment();
  for(const k of Object.keys(tot.mats)){
    const m=tot.mats[k];
    if(/^accessorio/i.test(m.label)) continue;
    const PN=panelFor(m.label);
    const stk=(state.stock||[]).filter(r=>r.mat===m.label)
      .flatMap(r=>Array.from({length:Math.max(1,r.n|0)},()=>({L:r.L,W:r.W,id:r.id})));
    const res=nest(m.pieces,PN.L,PN.W,S.kerf,stk);
    res.skipped.forEach(it=>oversize.push(`${it.ref.elemento} ${it.ref.lung}×${it.ref.larg} — ${m.label} (${PN.L}×${PN.W})`));
    panelCount+=res.panels.filter(x=>!x.stock).length;
    stockUsed+=res.panels.filter(x=>x.stock).length;
    for(const pan of res.panels) for(const f of pan.free)
      if(Math.min(f.w,f.h)>=S.stockMin) leftovers.push({mat:m.label,L:Math.max(f.w,f.h),W:Math.min(f.w,f.h)});
    res.panels.forEach((pan,i)=>{
      effSum+=pan.eff; effN++;
      const div=document.createElement("div"); div.className="panelbox";
      div.innerHTML=`<h4>${esc(m.label)}</h4>
        <div class="eff">${esc(t("panel"))} ${i+1}/${res.panels.length} · ${pan.L}×${pan.W} mm${pan.stock?` <span class="stock-tag">${esc(t("fromStock"))}</span>`:""} · <b>${fmt(pan.eff,1)}%</b> ${esc(t("efficiency"))}</div>`;
      div.insertAdjacentHTML("beforeend",panelSvg(pan,pan.L,pan.W,S.kerf));
      if(pan.cuts&&pan.cuts.length){
        const seq=pan.cuts.map((c,i)=>
          `<span class="cut-i"><b>${i+1}</b><i class="cut-g">${c.dir==="v"?"\u2502":"\u2500"}</i>${Math.round(c.at-S.kerf)}</span>`).join("");
        div.insertAdjacentHTML("beforeend",`<div class="cutseq">${seq}</div>`);
      }
      frag.appendChild(div);
    });
  }
  const avgEff=effN?effSum/effN:0;
  kp.innerHTML=`
    <div class="kpi hl"><b>${panelCount}</b><span>${esc(t("panelsNew"))}</span></div>
    <div class="kpi"><b>${stockUsed}</b><span>${esc(t("panelsStock"))}</span></div>
    <div class="kpi"><b>${fmt(avgEff,1)}<small>%</small></b><span>${esc(t("efficiency"))}</span></div>
    <div class="kpi"><b>${tot.pcs}</b><span>${esc(t("totalPieces"))}</span></div>
    <div class="kpi"><b>${fmt(tot.area)}<small> m²</small></b><span>${esc(t("totalArea"))}</span></div>`;
  if(oversize.length){
    const w=document.createElement("div"); w.className="nestwarn";
    w.innerHTML=`<b>⚠ ${esc(t("nestSkipAny").replace("{n}",oversize.length))}</b>
      <ul>${oversize.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
    out.appendChild(w);
  }
  out.appendChild(frag);
  nestLeftovers=leftovers;
  const bl=$("btnLeft");
  if(bl){ bl.style.display=leftovers.length?"":"none";
    bl.querySelector("span").textContent=t("addLeft").replace("{n}",leftovers.length); }
}
let nestLeftovers=[];
function panelSvg(pan,PL,PW,kerf){
  const rects=pan.rects.map(r=>{
    const cx=r.x+r.w/2, cy=r.y+r.h/2;
    const fs=Math.min(90, r.h*0.45, r.w/6.5);
    const label=`${r.ref.lung}×${r.ref.larg}`;
    const el=r.ref.elemento||"";
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ffffff" stroke="#0E3B2A" stroke-width="6"/>
      ${fs>26?`<text x="${cx}" y="${cy-(el&&fs>34?fs*0.34:0)}" font-size="${fs}" fill="#14181d" text-anchor="middle" dominant-baseline="middle" font-family="Barlow Condensed,Arial" font-weight="700">${label}</text>`:""}
      ${el&&fs>34?`<text x="${cx}" y="${cy+fs*0.62}" font-size="${fs*0.62}" fill="#5c6558" text-anchor="middle" dominant-baseline="middle" font-family="Barlow,Arial">${esc(el)}</text>`:""}`;
  }).join("");
  /* ordine dei tagli: numerato sul pannello, nascosto finche non lo chiedi
     (su venti pezzi sono venticinque linee e non si legge piu niente) */
  const k2=(kerf||0)/2;
  const cuts=(pan.cuts||[]).map((c,i)=>{
    const v=c.dir==="v";
    const x1=v?c.at-k2:c.x, y1=v?c.y:c.at-k2;
    const x2=v?c.at-k2:c.x+c.w, y2=v?c.y+c.h:c.at-k2;
    const bx=v?x1:x1+38, by=v?y1+38:y1;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c02f2f" stroke-width="5" stroke-dasharray="26 16"/>
      <circle cx="${bx}" cy="${by}" r="34" fill="#c02f2f"/>
      <text x="${bx}" y="${by}" font-size="42" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="Barlow Condensed,Arial" font-weight="700">${i+1}</text>`;
  }).join("");
  return `<svg viewBox="-12 -12 ${PL+24} ${PW+24}" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="wst" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="46" height="46" fill="#eceee8"/><line x1="0" y1="0" x2="0" y2="46" stroke="#c9cfc2" stroke-width="14"/>
    </pattern></defs>
    <rect x="0" y="0" width="${PL}" height="${PW}" fill="url(#wst)" stroke="#0E3B2A" stroke-width="8"/>${rects}
    <g class="cutlay">${cuts}</g></svg>`;
}

function renderSummary(){
  const p=proj(); const kp=$("sumKpis"); const mt=$("matTable"); const hwT=$("hwTable"); const ct=$("costTable");
  kp.innerHTML=""; mt.innerHTML=""; hwT.innerHTML=""; ct.innerHTML="";
  if(!p){kp.innerHTML=`<div class="empty" style="grid-column:1/-1"><p>${esc(t("selectProject"))}</p></div>`;return;}
  const S=state.settings, C=projectCosts(p), tot=C.tot;
  kp.innerHTML=`
    <div class="kpi"><b>${tot.pcs}</b><span>${esc(t("totalPieces"))}</span></div>
    <div class="kpi"><b>${fmt(tot.area)}<small> m²</small></b><span>${esc(t("totalArea"))}</span></div>
    <div class="kpi"><b>${fmt(tot.edge,1)}<small> ml</small></b><span>${esc(t("edgeBanding"))}</span></div>
    <div class="kpi hl"><b>€ ${fmt(C.netto)}</b><span>${esc(t("estCost"))}</span></div>`;
  let rows=`<tr><th>${esc(t("mat"))}</th><th class="n">${esc(t("qty"))}</th><th class="n">${esc(t("area"))}</th><th class="n">${esc(t("edge"))}</th></tr>`;
  for(const k of Object.keys(tot.mats)){
    const m=tot.mats[k];
    rows+=`<tr data-mat="${esc(k)}" style="cursor:pointer"><td>${esc(m.label)}</td><td class="n">${m.pcs}</td><td class="n">${fmt(m.area)}</td><td class="n">${fmt(m.edge,1)}</td></tr>`;
  }
  mt.innerHTML=rows;
  mt.querySelectorAll("tr[data-mat]").forEach(row=>row.addEventListener("click",async()=>{
    const key=row.dataset.mat, cur=tot.mats[key].label;
    const nv=await promptDlg(t("renameMat"),cur);
    if(!nv||!nv.trim()||nv.trim()===cur)return;
    for(const x of p.pieces) if(normMat(x.materiale)===key) x.materiale=nv.trim();
    persist(); render(); toast(t("saved"));
  }));
  const hwRows=C.hw.filter(i2=>i2.qty>0);
  if(hwRows.length){
    let hh=`<tr><th>${esc(t("item"))}</th><th class="n">${esc(t("qty"))}</th><th class="n">€/pz</th><th class="n">${esc(t("amount"))}</th></tr>`;
    for(const i2 of hwRows) hh+=`<tr><td>${esc(t(i2.k))}</td><td class="n">${i2.qty}</td><td class="n">${fmt(i2.price)}</td><td class="n">€ ${fmt(i2.tot)}</td></tr>`;
    hh+=`<tr><td><b>${esc(t("hardware"))}</b></td><td></td><td></td><td class="n"><b>€ ${fmt(C.hwTot)}</b></td></tr>`;
    hwT.innerHTML=hh;
  } else hwT.innerHTML=`<tr><td class="mini">—</td></tr>`;
  /* una riga per materiale, con la quantita e il prezzo di QUEL materiale:
     ogni riga si moltiplica da sola e la somma torna al totale. */
  const cRows=C.rows.map(r=>r.mode==="pan"
    ? `<tr><td>${esc(r.label)} — ${r.qty} × ${esc(r.size)} mm${r.stock?` <span class="mini">(+${r.stock} ${esc(t("fromStock"))})</span>`:""}</td><td class="n">€ ${fmt(r.tot)}</td></tr>`
    : `<tr><td>${esc(r.label)} — ${fmt(r.qty)} m² × €${fmt(r.unit)}</td><td class="n">€ ${fmt(r.tot)}</td></tr>`).join("");
  ct.innerHTML=`
    <tr><th>${esc(t("item"))}</th><th class="n">${esc(t("amount"))}</th></tr>
    <tr><td colspan="2" style="padding-top:8px"><b>${esc(t("cPanels"))}</b> <span class="mini">· ${esc(t(C.byPanel?"costModePan":"costModeArea"))}</span></td></tr>
    ${cRows}
    ${C.rows.length>1?`<tr><td class="mini" style="padding-left:10px">${esc(t("cSubtotal"))}</td><td class="n">€ ${fmt(C.cPanels)}</td></tr>`:""}
    ${!C.byPanel&&C.panelsNew>0?`<tr><td class="mini" style="padding-left:10px;color:var(--faint)">${esc(t("cBuyNote").replace("{n}",C.panelsNew))}</td><td class="n mini" style="color:var(--faint)">€ ${fmt(C.cWhole)}</td></tr>`:""}
    <tr><td>${esc(t("cEdge"))} — ${fmt(tot.edge,1)} ml × €${fmt(S.priceMl)}</td><td class="n">€ ${fmt(C.cEdge)}</td></tr>
    <tr><td>${esc(t("hardware"))}</td><td class="n">€ ${fmt(C.hwTot)}</td></tr>
    ${C.cLabor>0?`<tr><td>${esc(t("cLabor"))}${C.hours>0?` ${fmt(C.hours,1)}h × €${fmt(C.hourly)}`:""}${S.labor>0?` + ${S.labor}%`:""}</td><td class="n">€ ${fmt(C.cLabor)}</td></tr>`:""}
    <tr><td><b>${esc(t("cTotal"))}</b></td><td class="n"><b>€ ${fmt(C.netto)}</b></td></tr>`;
}

/* ================= PIECE EDITOR ================= */
let editingPieceId=null;
function fillDatalists(){
  const p=proj();
  $("dlElementi").innerHTML=ELEMENTI.map(e=>`<option value="${esc(e)}">`).join("");
  const mods=p?[...new Set(p.pieces.map(x=>x.modulo))]:[];
  $("dlModuli").innerHTML=mods.map(m=>`<option value="${esc(m)}">`).join("");
  /* Il materiale predefinito del pezzo aggiunto a mano e quello di
     STRUTTURA del progetto, non «il bianco lucido da 18». Un valore
     predefinito che nomina una grossezza e lo stesso equivoco che ha
     mandato a debitare cote da 18 su pannelli da 19 — qui non tocca la
     geometria, ma e il posto dove l'abitudine ricomincia. */
  const mats=p?[...new Set(p.pieces.map(x=>x.materiale))]:[];
  if(!mats.length){ const d=defaultMatLabel(); if(d) mats.push(d); }
  $("dlMateriali").innerHTML=mats.map(m=>`<option value="${esc(m)}">`).join("");
}
function buildBordoChips(sel){
  const box=$("bordoChips"); box.innerHTML="";
  for(const b of BORDI){
    const c=document.createElement("button");
    c.className="chip"+((b==="—"?"":b)===sel?" on":""); c.textContent=b;
    c.addEventListener("click",()=>{$("pBordo").value=b==="—"?"":b;buildBordoChips(b==="—"?"":b);});
    box.appendChild(c);
  }
}
function openPieceEditor(id){
  const p=proj(); if(!p)return;
  editingPieceId=id||null;
  fillDatalists();
  const x=id?p.pieces.find(q=>q.id===id):null;
  $("shPieceTitle").textContent=t(x?"editPiece":"addPiece");
  $("pModulo").value=x?x.modulo:(p.pieces.length?p.pieces[p.pieces.length-1].modulo:"");
  $("pElemento").value=x?x.elemento:"";
  $("pLung").value=x?x.lung:""; $("pLarg").value=x?x.larg:""; $("pPz").value=x?x.pz:1;
  $("pBordo").value=x?x.bordo:""; buildBordoChips(x?x.bordo:"");
  $("pMateriale").value=x?x.materiale:(p.pieces.length?p.pieces[p.pieces.length-1].materiale:defaultMatLabel());
  $("pGrain").textContent="↕ "+t("grain");
  $("pGrain").classList.toggle("on",!!(x&&x.grain));
  const sc0=x?(scList(x)[0]||null):null;
  $("scL").value=sc0?sc0.l:""; $("scW").value=sc0?sc0.w:"";
  $("scX").value=sc0?sc0.x:""; $("scY").value=sc0?sc0.y:"";
  $("scMore").textContent=x&&scList(x).length>1?("+"+(scList(x).length-1)):"";
  $("pAngL").value=x&&isAng(x.angL)?x.angL:""; $("pAngR").value=x&&isAng(x.angR)?x.angR:"";
  updAngInfo();
  $("btnPieceDup").style.display=x?"flex":"none";
  $("btnPieceDelete").style.display=x?"flex":"none";
  $("btnPieceDelTop").style.display=x?"grid":"none";
  openSheet("shPiece");
}
function updAngInfo(){
  const lu=parseInt($("pLung").value,10), la=parseInt($("pLarg").value,10);
  const aL=fAng("pAngL"), aR=fAng("pAngR");
  if(!(lu>0&&la>0)||(!isAng(aL)&&!isAng(aR))){ $("pAngInfo").textContent=""; return; }
  const se=Math.round(shortEdge(lu,la,aL,aR));
  $("pAngInfo").textContent=se>0?`${t("shortSide")} ${se}`:"⚠︎";
}
["pAngL","pAngR","pLung","pLarg"].forEach(id=>$(id).addEventListener("input",updAngInfo));
$("fab").addEventListener("click",()=>openPieceEditor(null));
$("btnAddPiece").addEventListener("click",()=>openPieceEditor(null));
$("btnAddMod").addEventListener("click",()=>{
  if(!proj()){toast(t("selectProject"));setView("projects");return;}
  buildCfg={...PRESETS.armadio,name:""}; if(buildFormReady)syncBuildForm();
  setView("build");
});
$("btnPieceCancel").addEventListener("click",closeSheets);
$("btnPieceSave").addEventListener("click",()=>{
  const p=proj(); if(!p)return;
  const lung=parseInt($("pLung").value,10), larg=parseInt($("pLarg").value,10), pz=parseInt($("pPz").value,10)||1;
  const modulo=$("pModulo").value.trim(), elemento=$("pElemento").value.trim();
  if(!modulo||!elemento||!(lung>0)||!(larg>0)){toast(t("invalidFile").replace(t("invalidFile"),"⚠︎"));$("pLung").focus();return;}
  const data={modulo,elemento,lung,larg,pz,bordo:$("pBordo").value.trim(),materiale:$("pMateriale").value.trim()||defaultMatLabel(),grain:$("pGrain").classList.contains("on")?1:0};
  const aL=fAng("pAngL"), aR=fAng("pAngR");
  data.angL=isAng(aL)?aL:undefined; data.angR=isAng(aR)?aR:undefined;
  if(shortEdge(lung,larg,data.angL,data.angR)<=0){ toast(t("angTooSteep")); $("pAngL").focus(); return; }
  const scL=parseInt($("scL").value,10)||0, scW=parseInt($("scW").value,10)||0;
  /* si modifica il primo decupaj, gli altri (dal rilievo) restano */
  const rest=editingPieceId?scList(p.pieces.find(q=>q.id===editingPieceId)||{}).slice(1):[];
  const first=(scL>0&&scW>0)?{l:scL,w:scW,x:parseInt($("scX").value,10)||0,y:parseInt($("scY").value,10)||0}:null;
  const all=(first?[first]:[]).concat(rest);
  data.scasso=all.length?(all.length===1?all[0]:all):null;
  if(editingPieceId){Object.assign(p.pieces.find(q=>q.id===editingPieceId),data);}
  else{p.pieces.push({id:uid(),...data});}
  persist(); closeSheets(); render(); toast(t("saved"));
});
$("btnPieceDelTop").addEventListener("click",()=>$("btnPieceDelete").click());
$("btnPieceDelete").addEventListener("click",()=>{
  const p=proj(); if(!p||!editingPieceId)return;
  snapUndo();
  p.pieces=p.pieces.filter(q=>q.id!==editingPieceId);
  persist(); closeSheets(); render(); undoToast(t("deleted"));
});

/* ================= PROJECT EDITOR ================= */
let editingProjectId=null;
function openProjectEditor(id){
  editingProjectId=id||null;
  const p=id?state.projects.find(q=>q.id===id):null;
  $("shProjectTitle").textContent=t(p?"editProject":"newProject");
  $("prName").value=p?p.name:""; $("prClient").value=p?p.client||"":"";
  $("prDeadline").value=p?p.deadline||"":""; $("prPhone").value=p?p.phone||"":"";
  $("prNotes").value=p?p.notes||"":"";
  $("prHours").value=p&&p.hours?p.hours:"";
  $("btnProjectDup").style.display=p?"flex":"none";
  $("btnProjectDelete").style.display=p?"flex":"none";
  openSheet("shProject");
}
/* Il cancello sta sul BOTTONE, non sul salvataggio: far scrivere nome,
   cliente e scadenza e poi rifiutare il progetto e il modo piu sicuro di
   far chiudere l'app per sempre. Il controllo al salvataggio resta lo
   stesso, piu sotto, come rete per le altre strade d'ingresso. */
$("btnNewProject").addEventListener("click",()=>{
  if(!gateNewProject()) return;
  openProjectEditor(null);
});
$("btnProjectCancel").addEventListener("click",closeSheets);
$("btnProjectSave").addEventListener("click",()=>{
  const name=$("prName").value.trim(); if(!name){$("prName").focus();return;}
  const client=$("prClient").value.trim();
  const deadline=$("prDeadline").value, phone=$("prPhone").value.trim(), notes=$("prNotes").value.trim();
  const hours=Math.max(0,parseFloat($("prHours").value)||0);
  if(editingProjectId){
    const p=state.projects.find(q=>q.id===editingProjectId);
    /* Un progetto di esempio che viene rinominato smette di essere un
       esempio: da qui in poi conta nella quota gratuita come gli altri. */
    Object.assign(p,{name,client,deadline,phone,notes,hours});
    delete p.demo;
  }
  else{
    if(!gateNewProject()) return;
    const p={id:uid(),name,client,deadline,phone,notes,hours,date:today(),pieces:[],geomVersion:GEOM_VERSION};state.projects.unshift(p);state.activeId=p.id;
    askPersist();          // primo progetto salvato: si chiede la memoria protetta
  }
  persist(); closeSheets(); render(); toast(t("saved"));
});
$("btnProjectDelete").addEventListener("click",async()=>{
  if(!editingProjectId) return;
  if(!await confirmDlg(t("confirmDelProject"))) return;
  snapUndo();
  const goneId=editingProjectId;
  state.projects=state.projects.filter(q=>q.id!==goneId);
  if(state.activeId===goneId)state.activeId=state.projects[0]?state.projects[0].id:null;
  markDeleted(goneId);            // la cancellazione deve arrivare anche sul server
  persist(); closeSheets(); render(); undoToast(t("deleted"));
});

/* ================= SETTINGS & LANGUAGE ================= */
$("btnSettings").addEventListener("click",()=>{
  const S=state.settings;
  $("sPanelL").value=S.panelL;$("sPanelW").value=S.panelW;$("sKerf").value=S.kerf;
  $("sDecorDir").value=S.decor_directional?"1":"0";
  $("sCostMode").value=S.costMode||"panels";$("sPriceM2").value=S.priceM2;$("sPriceMl").value=S.priceMl;$("sWaste").value=S.waste;$("sLabor").value=S.labor;$("sHourly").value=S.hourly!=null?S.hourly:35;
  $("sMargin").value=S.margin;$("sIva").value=S.iva;
  $("sEdgeTh").value=(S.edgeTh==null?0.8:S.edgeTh);
  $("sIntro").value=(S.intro===0?"0":"1"); $("sIntroSound").value=(S.introSound===0?"0":"1");
  /* Il tema si applica subito, non al "Salva": chi lo cambia vuole vedere se
     gli piace. Sta fuori da S perche e una preferenza del dispositivo. */
  $("sTheme").value=themeGet();
  $("sTheme").onchange=e=>themeSet(e.target.value);
  /* Il prezzo mostrato e QUELLO CHE FINISCE NEL PREVENTIVO: si legge dal
     prodotto scelto in catalogo (hwItem tiene gia conto di hwOvr). Prima questi
     campi leggevano e scrivevano S.hwCern..., che computeHardware non guarda
     mai perche il catalogo vince sempre: si poteva mettere 99 € a una balama e
     il preventivo restava a 3,60. */
  for(const [cat,key] of HW_CATS){
    const el=$("s"+key.charAt(0).toUpperCase()+key.slice(1)); if(!el) continue;
    const it=hwItem(cat);
    el.value=it?it.price:(S[key]!=null?S[key]:0);
  }
  $("sCoName").value=S.coName;$("sCoInfo").value=S.coInfo;
  /* la chiave non sta in `state`: si legge e si riscrive a parte */
  $("aiSetLbl").textContent=tia("aiSet");
  $("aiKeyLbl").textContent=tia("aiKeyLbl");
  { const k=aiKey();
    $("aiKeyHint").textContent=(k?tia("aiKeyOk").replace("{k}","…"+k.slice(-4))+" · ":"")+tia("aiKeyHint");
    /* l'avviso si mostra solo quando la chiave parte davvero dal browser:
       con un endpoint proprio la chiave non viene nemmeno letta. */
    $("aiKeyWarn").textContent=aiProxy()?"":tia("aiKeyWarn");
    $("btnAiKeyDel").style.display=k?"flex":"none";
    $("aiKeyDelLbl").textContent=tia("aiKeyDel"); }
  $("aiModelLbl").textContent=tia("aiModelLbl");
  $("aiProxyLbl").textContent=tia("aiProxyLbl"); $("aiProxyHint").textContent=tia("aiProxyHint");
  $("sAiModel").innerHTML=AI_MODELS.map(([id,n])=>`<option value="${id}">${esc(n)}</option>`).join("");
  $("sAiModel").value=aiModel(); $("sAiProxy").value=S.aiProxy||""; $("sAiKey").value=aiKey();
  renderProSettings();
  openSheet("shSettings");
});

/* ---- abbonamento e memoria, dentro le impostazioni ----
   Tre domande, tre risposte in chiaro: sono Pro? fino a quando? i miei
   progetti sono al sicuro? La terza non la sa nessun'altra parte
   dell'app, ed e quella che decide se vale la pena fare un backup oggi. */
function renderProSettings(){
  const line=$("stStateLine"), pl=$("proStateLine");
  const pro=isPro();

  if(!pro){
    pl.textContent=t("proStateFree").replace("{n}",FREE_PROJECTS);
    if(PRO_REASON==="lapsed"||PRO_REASON==="expired") pl.textContent=t("proLapsed");
    if(PRO_REASON==="disabled") pl.textContent=t("proDisabledMsg");
  }else if(LIC&&LIC.kind==="legacy"){
    pl.textContent=t("proStateLegacy");
  }else{
    let txt=t("proStatePro");
    if(LIC&&LIC.expiresAt){
      const d=new Date(LIC.expiresAt);
      if(isFinite(d.getTime())) txt+=" · "+t("proRenews").replace("{d}",d.toISOString().slice(0,10));
    }
    if(PRO_REASON==="grace"){
      const n=EBLicense.graceDaysLeft(LIC);
      txt=t("proGrace").replace("{n}",Math.max(0,n||0));
    }
    pl.textContent=txt;
  }
  $("btnGoPro").style.display=pro?"none":"flex";
  $("btnLicCheck").style.display=(pro&&LIC&&LIC.kind==="ls")?"flex":"none";
  $("btnLicOff").style.display=(LIC&&LIC.key)?"flex":"none";

  /* La memoria protetta si CHIEDE, non si ottiene per diritto: Chrome la
     concede a chi torna, Safari quasi mai. Si scrive quale delle due e,
     senza girarci intorno. */
  line.textContent="…";
  EBStore.persisted().then(okv=>{
    line.textContent=okv?t("stPersistedYes"):t("stPersistedNo");
    line.style.color=okv?"":"var(--warn)";
    $("btnPersist").style.display=okv?"none":"flex";
    return EBStore.estimate();
  }).then(est=>{
    if(!est||!est.quota) return;
    const mb=n=>Math.round(n/1048576)+" MB";
    line.textContent+="  ·  "+t("stUsed").replace("{u}",mb(est.usage||0)).replace("{q}",mb(est.quota));
  }).catch(()=>{ line.textContent=t("stPersistedNo"); });

  $("bkAutoLine").textContent=t("bkAutoNone");
  $("btnBkAuto").style.display="none";
  EBStore.allBackups().then(all=>{
    if(!all||!all.length) return;
    all.sort((a,b)=>(b.at||0)-(a.at||0));
    const last=all[0];
    $("bkAutoLine").textContent=t("bkAutoAt").replace("{d}",new Date(last.at).toLocaleString());
    $("btnBkAuto").style.display="flex";
    $("btnBkAuto").dataset.id=last.id;
  }).catch(()=>{});
}
$("btnGoPro").addEventListener("click",()=>openPro(null));
$("btnPersist").addEventListener("click",async()=>{
  const okv=await EBStore.persist();
  toast(okv?t("stPersistedYes"):t("stPersistedNo"));
  renderProSettings();
});
$("btnLicCheck").addEventListener("click",async()=>{
  const b=$("btnLicCheck"); b.disabled=true;
  await licRecheck(true);
  b.disabled=false; renderProSettings(); toast("✓");
});
$("btnLicOff").addEventListener("click",async()=>{
  if(!await confirmDlg(t("proDeactivateAsk"))) return;
  await proDeactivate();
  renderProSettings(); render(); toast(t("proDeactivated"));
});
$("btnBkAuto").addEventListener("click",async()=>{
  const id=$("btnBkAuto").dataset.id; if(!id) return;
  let rec=null;
  try{ rec=await EBStore.getBackup(id); }catch(e){}
  if(!rec||!rec.json){ toast(t("invalidFile")); return; }
  const when=new Date(rec.at).toLocaleString();
  if(!await confirmDlg(t("bkAutoAsk").replace("{d}",when))) return;
  let o=null;
  try{ o=JSON.parse(rec.json); }catch(e){}
  if(!o||!o.state||!Array.isArray(o.state.projects)){ toast(t("invalidFile")); return; }
  closeSheets(); doRestore(o);
});
$("btnSettingsSave").addEventListener("click",()=>{
  const S=state.settings;
  S.panelL=parseInt($("sPanelL").value,10)||2800; S.panelW=parseInt($("sPanelW").value,10)||2070;
  S.decor_directional=$("sDecorDir").value==="1";
  S.kerf=parseInt($("sKerf").value,10)||4;
  S.priceM2=parseFloat($("sPriceM2").value)||0; S.priceMl=parseFloat($("sPriceMl").value)||0;
  S.costMode=$("sCostMode").value; S.waste=parseFloat($("sWaste").value)||0; S.labor=parseFloat($("sLabor").value)||0; S.hourly=parseFloat($("sHourly").value)||35;
  S.margin=parseFloat($("sMargin").value)||0; S.iva=parseFloat($("sIva").value)||0;
  { const v=parseFloat(String($("sEdgeTh").value).replace(",",".")); S.edgeTh=isFinite(v)&&v>=0?Math.min(3,v):0.8; }
  S.intro=parseInt($("sIntro").value,10)?1:0; S.introSound=parseInt($("sIntroSound").value,10)?1:0;
  /* Si scrive in hwOvr, cioe' nella stessa casella che legge il preventivo.
     S[key] resta aggiornato solo come ripiego per un catalogo senza prodotto. */
  S.hwOvr=S.hwOvr||{}; S.hwProd=S.hwProd||{};
  for(const [cat,key] of HW_CATS){
    const el=$("s"+key.charAt(0).toUpperCase()+key.slice(1)); if(!el) continue;
    const v=parseFloat(el.value); if(!isFinite(v)||v<0) continue;
    S[key]=v;
    const id=S.hwProd[cat];
    if(id){ S.hwOvr[id]=S.hwOvr[id]||{}; S.hwOvr[id].price=v; }
  }
  S.coName=$("sCoName").value.trim(); S.coInfo=$("sCoInfo").value.trim();
  S.aiModel=$("sAiModel").value||"claude-opus-5"; S.aiProxy=$("sAiProxy").value.trim();
  /* Una chiave storta si accettava in silenzio e l'errore arrivava molto dopo,
     dal server, incomprensibile. Si controlla solo quando la chiave viene
     usata davvero — con un endpoint proprio il token puo avere qualunque
     forma, e non tocca a noi dire com'e fatto. */
  const rawKey=$("sAiKey").value.trim();
  if(rawKey && !S.aiProxy && !/^sk-ant-[A-Za-z0-9_-]{16,}$/.test(rawKey)){
    toast(tia("aiKeyBad")); $("sAiKey").focus(); return;
  }
  const okKey=aiSetKey(rawKey);
  persist(); closeSheets(); render();
  toast(okKey?t("saved"):tia("aiKeyFail"));
});
/* Cancellazione esplicita: se il telefono cambia mano o si perde, la chiave
   deve poter sparire in un tocco, senza svuotare un campo e ricordarsi di
   salvare. Il campo password nasconde il valore: senza questo bottone non si
   capisce nemmeno se una chiave c'e. */
$("btnAiKeyDel").addEventListener("click",async()=>{
  if(!aiKey()) return;
  if(!await confirmDlg(tia("aiKeyDelAsk"))) return;
  aiSetKey(""); $("sAiKey").value="";
  $("btnAiKeyDel").style.display="none";
  $("aiKeyHint").textContent=tia("aiKeyHint");
  haptic(); toast(tia("aiKeyGone"));
});
$("btnLang").addEventListener("click",()=>{
  const box=$("langList"); box.innerHTML="";
  for(const code of ["it","ro","en","fr"]){
    const b=document.createElement("button");
    b.className="btn"+(code===state.lang?" red":""); b.style.marginBottom="8px"; b.textContent=LANG_NAMES[code];
    b.addEventListener("click",()=>{state.lang=code;state.langChosen=1;persist();applyLang();renderAccount();closeSheets();render();});
    box.appendChild(b);
  }
  openSheet("shLang");
});
