"use strict";
/* ===========================================================================
   Ebanist — app/js/documents.js

   I documenti che escono dall'app: disegno tecnico 2D, statistiche, scheda
   di montaggio isometrica, etichette e pacchetto di laboratorio, magazzino
   ritagli, prova «passa dalla porta?» e ordine al fornitore.
   =========================================================================== */
/* ================= DISEGNO TECNICO 2D ================= */
function techView(boxes,ax,H,cfg){ // ax: "x" fronte, "z" sezione laterale
  if(ax==="z"){
    /* SEZIONE, non vista laterale: il piano di taglio passa appena dentro il
       fianco vicino, che quindi non si disegna. Senza toglierlo il disegno era
       un rettangolo grigio pieno — il fianco copriva ripiani, tramezzi e casse
       dei cassetti, cioe' esattamente quello che la sezione deve mostrare. */
    let mx=-1e9; for(const b of boxes) mx=Math.max(mx,b.x1);
    /* il piano di taglio passa appena dentro il fianco vicino: la sua
       grossezza e quella del materiale, non 18. */
    const tSide=(cfg&&+cfg.t>0)?+cfg.t:0;
    const cut=mx-tSide-1;
    boxes=boxes.filter(b=>b.x0<cut);
  }
  let min=1e9,max=-1e9;
  for(const b of boxes){ min=Math.min(min,b[ax+"0"]); max=Math.max(max,b[ax+"1"]); }
  const W=max-min, PAD=104, s=Math.min(540/W,660/H);
  const X=v=>PAD+(v-min)*s, Y=v=>66+(H-v)*s;
  let svg="";
  /* dal fondo verso il fronte, così lo schienale non copre ripiani e tramezzi */
  const perp=ax==="x"?"z":"x";
  const order=boxes.slice().sort((a,b)=>{
    const fa=(a.kind==="f"||a.kind==="g")?1:0, fb=(b.kind==="f"||b.kind==="g")?1:0;
    if(fa!==fb) return fa-fb;
    return (a[perp+"0"]+a[perp+"1"])/2-(b[perp+"0"]+b[perp+"1"])/2;
  });
  for(const b of order){
    const x=X(b[ax+"0"]), y=Y(b.y1), w=(b[ax+"1"]-b[ax+"0"])*s, h=(b.y1-b.y0)*s;
    if(w<0.5||h<0.5) continue;
    const st=b.kind==="f"?'fill="#fff" stroke="#3e6b0a" stroke-width="1.6"':
             b.kind==="g"?'fill="rgba(160,200,230,0.4)" stroke="#7fb2d8" stroke-width="1"':
             b.kind==="m"?'fill="#9aa0a4" stroke="#4d5356" stroke-width="0.9"':
             b.sub==="dbox"?'fill="#f6f4ee" stroke="#7a6f52" stroke-width="0.9" stroke-dasharray="4 2"':
             'fill="#eceee9" stroke="#555" stroke-width="0.9"';
    svg+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" ${st}/>`;
  }
  const TX='font-size="12" font-family="Arial,Helvetica,sans-serif"';
  const tick=(x,y,vert)=>vert?`<line x1="${x-4}" y1="${y}" x2="${x+4}" y2="${y}" stroke="#000" stroke-width="0.8"/>`
                             :`<line x1="${x}" y1="${y-4}" x2="${x}" y2="${y+4}" stroke="#000" stroke-width="0.8"/>`;
  /* luci libere fra i pannelli: sono le quote che servono in officina */
  const gaps=(intervals,lo,hi)=>{
    const iv=intervals.slice().sort((a,b)=>a[0]-b[0]), out=[]; let cur=lo;
    for(const [a,b] of iv){ if(a-cur>12) out.push([cur,a]); cur=Math.max(cur,b); }
    if(hi-cur>12) out.push([cur,hi]);
    return out;
  };
  /* le casse dei cassetti non fanno parte della carcassa: se entrassero nelle
     catene di quote, l'officina leggerebbe luci che non esistono */
  const carc=boxes.filter(b=>b.kind==="p"&&b.sub!=="dbox");
  const vertIv=[], horIv=[];
  for(const b of carc){
    const dA=b[ax+"1"]-b[ax+"0"], dy=b.y1-b.y0;
    if(dA<=40&&dA<dy) vertIv.push([b[ax+"0"],b[ax+"1"]]);
    if(dy<=40&&dy<dA) horIv.push([b.y0,b.y1]);
  }
  const cols=gaps(vertIv,min,max), rows=gaps(horIv,0,H);
  if(cols.length>1) cols.forEach(g=>{
    const x1=X(g[0]), x2=X(g[1]); if(x2-x1<9) return;
    svg+=`<line x1="${x1}" y1="42" x2="${x2}" y2="42" stroke="#000" stroke-width="0.7"/>`+tick(x1,42)+tick(x2,42)
      +`<text x="${(x1+x2)/2}" y="38" ${TX} text-anchor="middle">${Math.round(g[1]-g[0])}</text>`;
  });
  if(rows.length>1){ const xx=X(max)+34; rows.forEach(g=>{
    const y1=Y(g[0]), y2=Y(g[1]); if(y1-y2<9) return;
    svg+=`<line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" stroke="#000" stroke-width="0.7"/>`+tick(xx,y1,1)+tick(xx,y2,1)
      +`<text x="${xx+4}" y="${(y1+y2)/2+4}" ${TX}>${Math.round(g[1]-g[0])}</text>`;
  }); }
  /* quote d'ingombro */
  const y0=Y(0)+40, xa=X(min), xb=X(max);
  svg+=`<line x1="${xa}" y1="${y0}" x2="${xb}" y2="${y0}" stroke="#000" stroke-width="0.9"/>`+tick(xa,y0)+tick(xb,y0)
     +`<text x="${(xa+xb)/2}" y="${y0-5}" ${TX} font-weight="bold" text-anchor="middle">${Math.round(W)} mm</text>`;
  const xl=X(min)-38, ya=Y(H), yb=Y(0);
  svg+=`<line x1="${xl}" y1="${ya}" x2="${xl}" y2="${yb}" stroke="#000" stroke-width="0.9"/>`+tick(xl,ya,1)+tick(xl,yb,1)
     +`<text x="${xl-8}" y="${(ya+yb)/2}" ${TX} font-weight="bold" text-anchor="middle" transform="rotate(-90 ${xl-8} ${(ya+yb)/2})">${Math.round(H)} mm</text>`;
  /* angoli non retti, solo sulla vista frontale */
  if(cfg&&ax==="x"){
    if(isAng(cfg.angL)) svg+=`<text x="${X(min)+6}" y="${Y(0)-6}" ${TX} font-weight="bold" fill="#b3261e">∠${cfg.angL}°</text>`;
    if(isAng(cfg.angR)) svg+=`<text x="${X(max)-6}" y="${Y(0)-6}" ${TX} font-weight="bold" fill="#b3261e" text-anchor="end">∠${cfg.angR}°</text>`;
  }
  const vbW=X(max)+72, vbH=y0+26;
  return `<svg viewBox="0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}" style="width:100%;max-width:${ax==="x"?"122":"78"}mm">${svg}</svg>`;
}

/* disegno in scala di un singolo pezzo trapezoidale, con i due lati e l'angolo */
function angPieceSvg(p){
  const L=p.lung, Wd=p.larg, oL=angOff(p.angL,Wd), oR=angOff(p.angR,Wd);
  const s=Math.min(150/L,70/Wd), PADX=40, PADY=26;
  const x=v=>PADX+v*s, y=v=>PADY+v*s;
  const pts=[[0,Wd],[L,Wd],[L-oR,0],[oL,0]].map(q=>`${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join(" ");
  const TX='font-size="9" font-family="Arial,Helvetica,sans-serif"';
  let o=`<polygon points="${pts}" fill="#eceee9" stroke="#333" stroke-width="1"/>`;
  o+=`<text x="${x(L/2)}" y="${y(Wd)+13}" ${TX} text-anchor="middle">${Math.round(L)}</text>`;
  o+=`<text x="${x(L/2)}" y="${y(0)-5}" ${TX} text-anchor="middle">${Math.round(L-oL-oR)}</text>`;
  o+=`<text x="${x(0)-6}" y="${y(Wd/2)}" ${TX} text-anchor="end">${Math.round(Wd)}</text>`;
  if(isAng(p.angL)) o+=`<text x="${x(oL)+4}" y="${y(0)+13}" ${TX} fill="#b3261e" font-weight="bold">${p.angL}°</text>`;
  if(isAng(p.angR)) o+=`<text x="${x(L-oR)-4}" y="${y(0)+13}" ${TX} fill="#b3261e" font-weight="bold" text-anchor="end">${p.angR}°</text>`;
  return `<svg viewBox="0 0 ${(x(L)+30).toFixed(0)} ${(y(Wd)+22).toFixed(0)}" style="width:100%;max-width:52mm">${o}</svg>`;
}

$("btnDraw").addEventListener("click",()=>{
  buildCfg=cfgFromForm();
  const {boxes,pieces}=buildModule(buildCfg);
  const S=state.settings;
  const fmtD=today();
  const angPcs=pieces.filter(x=>isAng(x.angL)||isAng(x.angR));
  const angBlock=angPcs.length?`<h2>${esc(t("drawAng"))}</h2>
    <table style="width:100%;border:none"><tr>${angPcs.slice(0,4).map(x=>
      `<td style="border:none;vertical-align:top;text-align:center;width:25%">
        <div style="font-size:9pt;font-weight:bold">${esc(x.elemento)}</div>${angPieceSvg(x)}</td>`).join("")}</tr></table>`:"";
  const explSvg=(()=>{ const d=document.createElement("div"); const sv=document.createElementNS("http://www.w3.org/2000/svg","svg");
    d.appendChild(sv); render3D(sv,buildCfg,{yaw:0.62,pitch:0.34,zoom:1,free:true},{real:false,explode:1});
    sv.setAttribute("style","width:100%;max-width:120mm"); return d.innerHTML; })();
  const html=`<div class="pr-head"><div><h1>${esc(t("drawTitle"))}</h1>
    <div style="font-size:11pt;margin-top:2px"><b>${esc(buildCfg.name)}</b> — ${buildCfg.L}×${buildCfg.H}×${buildCfg.P} mm · ${esc(t("date"))}: ${fmtD}</div>
    ${prTrace(proj())}</div>
    <div class="co">${prLogo()}<b>${esc(prCoName())}</b><br>${esc(prCoInfo())}</div></div>
    <table style="width:100%;border:none"><tr>
      <td style="border:none;vertical-align:top;width:62%"><h2>${esc(t("drawFront"))}</h2>${techView(boxes,"x",buildCfg.H,buildCfg)}</td>
      <td style="border:none;vertical-align:top"><h2>${esc(t("dwSide"))}</h2>${techView(boxes,"z",buildCfg.H,buildCfg)}</td>
    </tr></table>
    ${angBlock}
    <h2 style="page-break-before:auto">${esc(t("drawExpl"))}</h2>
    <div style="text-align:center">${explSvg}</div>
    <p style="font-size:9pt;color:#333">${esc(t("mSafety"))}</p>
    <div class="pr-foot"><span>${esc(t("drawTitle"))} · ${esc(buildCfg.name)}</span><span>Ebanist · ${esc(prCoName())}</span></div>`;
  $("printArea").innerHTML=html;
  printOut();
});

/* ================= STATISTICHE ================= */
$("btnStats").addEventListener("click",()=>{
  let pcs=0,area=0,edge=0,val=0;
  const rows=state.projects.map(p=>{
    const tt=computeTotals(p), C=projectCosts(p);
    pcs+=tt.pcs; area+=tt.area; edge+=tt.edge; val+=C.prezzo+C.ivaAmt;
    return `<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
      <span class="mini">${tt.pcs} pz · ${fmt(tt.area)} m²</span>
      <b>€ ${fmt(C.prezzo+C.ivaAmt,0)}</b></div>`;
  }).join("");
  $("statsBody").innerHTML=`
    <div class="statgrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div class="stat"><b>${state.projects.length}</b><span class="mini">${esc(t("stProjects"))}</span></div>
      <div class="stat"><b>${pcs}</b><span class="mini">${esc(t("stPieces"))}</span></div>
      <div class="stat"><b>${fmt(area,1)} m²</b><span class="mini">${esc(t("stArea"))}</span></div>
      <div class="stat"><b>€ ${fmt(val,0)}</b><span class="mini">${esc(t("stQuoted"))}</span></div>
    </div>${rows}`;
  document.querySelectorAll("#statsBody .stat").forEach(d=>{d.style.cssText+="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:2px;font-size:18px";});
  closeSheets(); openSheet("shStats");
});

/* ================= SCHEDA DI MONTAGGIO ================= */
/* --- illustratore isometrico stile IKEA per la scheda di montaggio --- */
function tagBox(b,cfg){
  const t=(+cfg.t>0)?+cfg.t:0, H=cfg.H, L=cfg.L;
  const pl=(cfg.support||"zoccolo")==="sospeso"?0:(cfg.plinth||0);
  const w=b.x1-b.x0, h=b.y1-b.y0;
  if(b.kind==="g") return "anta";
  if(b.kind==="m") return "cass";                  // fianchi metallici del sistema cassetto
  if(b.sub==="dbox") return "cass";                // la cassa del cassetto
  if(b.kind==="f"){
    /* il tipo di frontale ora lo dice la geometria, non l'altezza: prima un
       cassetto alto 300 diventava un'anta e spariva dal passo di montaggio. */
    if(b.sub==="drawer"||b.sub==="drawerIn") return "cass";
    if(b.sub==="door"||b.sub==="slide") return "anta";
    if(!cfg.doors) return "cass";
    if(!cfg.drawers) return "anta";
    return h<=270?"cass":"anta";
  }
  if(b.y1<=pl+1) return "zocc";
  if(h<=40&&(b.z1-b.z0)<=60) return "asta";
  if(w<=t+2 && h>H*0.35) return (b.x0<=t+1||b.x1>=L-t-1)?"lato":"tram";
  if(h<=t+2) return (b.y0<=pl+t+1||b.y1>=H-t-1)?"box":"rip";
  return "box";
}
function isoStep(cfg,hiTags,showTags){
  const {boxes}=buildModule(cfg);
  const th=0.62, ph=0.42, ct=Math.cos(th), st=Math.sin(th), cp=Math.cos(ph), sp=Math.sin(ph);
  let cx=0,cy=0,cz=0,n=0;
  for(const b of boxes){cx+=(b.x0+b.x1)/2;cy+=(b.y0+b.y1)/2;cz+=(b.z0+b.z1)/2;n++;}
  cx/=n;cy/=n;cz/=n;
  const proj=(x,y,z)=>{
    const x1=(x-cx)*ct+(z-cz)*st, z1=-(x-cx)*st+(z-cz)*ct;
    const y1=(y-cy)*cp - z1*sp,  z2=(y-cy)*sp + z1*cp;
    return [x1,-y1,z2];
  };
  const show=new Set(showTags||[]), hi=new Set(hiTags||[]);
  const faces=[];
  for(const b of boxes){
    const tg=tagBox(b,cfg);
    const isHi=hi.has(tg), isShow=show.has(tg);
    if(!isHi&&!isShow) continue;
    const C=[[b.x0,b.y0,b.z0],[b.x1,b.y0,b.z0],[b.x1,b.y1,b.z0],[b.x0,b.y1,b.z0],
             [b.x0,b.y0,b.z1],[b.x1,b.y0,b.z1],[b.x1,b.y1,b.z1],[b.x0,b.y1,b.z1]].map(p=>proj(...p));
    const F=[[0,1,2,3,"z"],[4,5,6,7,"z"],[0,1,5,4,"y"],[3,2,6,7,"y"],[0,3,7,4,"x"],[1,2,6,5,"x"]];
    for(const [a,b2,c,d,ax] of F){
      const pts=[C[a],C[b2],C[c],C[d]];
      const zd=(pts[0][2]+pts[1][2]+pts[2][2]+pts[3][2])/4;
      faces.push({pts,zd,ax,hi:isHi,g:false});
    }
  }
  faces.sort((a,b)=>b.zd-a.zd); // lontano prima
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(const f of faces) for(const p of f.pts){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
  const s=170/Math.max(maxX-minX,maxY-minY,1);
  const SX=v=>((v-minX)*s+10).toFixed(1), SY=v=>((v-minY)*s+10).toFixed(1);
  const FILL={x:{n:"#e2e2dd",h:"#b9d59a"},y:{n:"#f4f4f0",h:"#d3e8bc"},z:{n:"#ecece7",h:"#c6dfab"}};
  let svg="";
  for(const f of faces){
    const d=f.pts.map(p=>SX(p[0])+","+SY(p[1])).join(" ");
    const fill=(FILL[f.ax]||FILL.z)[f.hi?"h":"n"];
    svg+=`<polygon points="${d}" fill="${fill}" stroke="${f.hi?"#3e6b0a":"#666"}" stroke-width="${f.hi?"1.3":"0.7"}" stroke-linejoin="round"/>`;
  }
  const W=((maxX-minX)*s+20).toFixed(0), Hh=((maxY-minY)*s+20).toFixed(0);
  return `<svg viewBox="0 0 ${W} ${Hh}" style="width:44mm;flex:0 0 auto">${svg}</svg>`;
}
/* frezarea balamalelor pentru o usa batanta: cate si unde, calculate din inaltime.
   Aceeasi regula ca la numararea feroneriei, ca sa nu se bata cap in cap. */
function hingeInfo(x){
  const el=(x.elemento||"").toLowerCase();
  if(!/^anta/.test(el)||el.indexOf("scorrevole")>=0) return null;
  const h=Math.max(x.lung,x.larg);
  const n=hingeCount(h);
  return {n,h,pos:hingePositions(h,n)};
}
function hingeTxt(x){
  const hi=hingeInfo(x); if(!hi) return "";
  return t("hingeMill").replace("{n}",hi.n).replace("{list}",hi.pos.join(" · "));
}
/* La scala del numero e le posizioni stanno in ebanist-core.js: erano scritte
   in tre punti che non erano d'accordo — la distinta, il conteggio della
   ferramenta e la scheda di montaggio. Questa resta come unico punto di
   ingresso dell'app, e l'arretramento dai capi lo dice il progetto. */
function hingeEdgeOffset(){
  const S=(typeof state!=="undefined"&&state.settings)||{};
  const g=S.geom||{};
  return (g.edge_offset!=null?g.edge_offset:CARCASS_DEFAULTS.edge_offset);
}
function hingePositions(doorH,n){
  return positionsHinges(doorH,n,hingeEdgeOffset());
}
function assemblySteps(modName,hw,cfg,items){
  const P=(k,fallback)=>{ const it=hwItem(k); return it?`${it.brand} ${it.name} (${it.art})`:t(fallback); };
  const st=[];
  const add=(txt,g)=>st.push({x:txt,g});
  const CARC=["lato","box"];
  const flat=cfg&&["scrivania","tavolo","letto"].includes(cfg.type);
  add(t("mPrep"));
  if(flat){
    add(t("mFlatAsm"));
    if(hw.hwMan>0) add(t("mHandles").replace("{q}",hw.hwMan).replace("{p}",P("man","hwMan")));
    add(t("mCheck"));
    return st;
  }
  if(hw.hwConn>0){ add(t("mDrill").replace("{q}",hw.hwConn).replace("{p}",P("conn","hwConn")));
    add(t("mSys32")); }
  if(hw.hwGuida>0) add(t("mSlides").replace("{q}",hw.hwGuida).replace("{p}",P("guida","hwGuida")));
  if(hw.hwCern>0) add(t("mPlates").replace("{q}",hw.hwCern).replace("{p}",P("cern","hwCern")));
  add(t("mBox"),{hi:CARC,show:[]});
  if(cfg&&cfg.tram>0) add(t("mTram").replace("{q}",cfg.tram),{hi:["tram"],show:CARC});
  const sup=cfg?(cfg.support||"zoccolo"):"zoccolo";
  if(sup==="piedini"||hw.hwPied>0) add(t("mFeet").replace("{q}",hw.hwPied).replace("{p}",P("pied","hwPied")),{hi:["zocc"],show:[...CARC,"tram"]});
  else if(sup==="sospeso") add(t("mWall"));
  else add(t("mPlinth"),{hi:["zocc"],show:[...CARC,"tram"]});
  add(t("mBack"));
  if(hw.hwSup>0) add(t("mShelvesA").replace("{q}",hw.hwSup).replace("{p}",P("sup","hwSup")),{hi:["rip"],show:[...CARC,"tram","zocc"]});
  if(cfg&&cfg.shelfType==="fisso"&&cfg.shelves>0) add(t("mShelvesF"),{hi:["rip"],show:[...CARC,"tram","zocc"]});
  if(hw.hwGuida>0){
    add(t("mDrawers").replace("{q}",Math.round(hw.hwGuida)),{hi:["cass"],show:[...CARC,"tram","zocc","rip"]});
    /* le quote della cassa in officina: senza queste il montatore le va a
       cercare in distinta riga per riga, e la lunghezza nominale della guida
       non e scritta da nessuna parte. */
    let dp=null; try{ dp=buildModule(cfg).draw; }catch(e){}
    if(dp&&dp.ok){
      const nm=(dp.sys.n&&(dp.sys.n[state.lang]||dp.sys.n.it))||dp.sysId;
      const box=dp.sys.none?"":(dp.sys.metal
        ? t("mDrawBoxM").replace("{bw}",dp.baseW).replace("{bl}",dp.baseL).replace("{kw}",dp.backW).replace("{kh}",dp.backH)
        : t("mDrawBoxW").replace("{bw}",dp.boxW).replace("{bh}",dp.sideH).replace("{bl}",dp.nl));
      add(t("mDrawSys").replace("{s}",nm+(dp.hcode?" "+dp.hcode:"")).replace("{nl}",dp.nl).replace("{box}",box));
      if(dp.inner) add(t("mDrawInner").replace("{i}",dp.inset));
    }
  }
  if(hw.hwCern>0){ add(t("mDoors").replace("{q}",hw.hwCern),{hi:["anta"],show:[...CARC,"tram","zocc","rip","cass"]});
    const doorPieces=(items||[]).filter(x=>/^anta(?! scorrevole)/i.test(x.elemento)||/^montante anta/i.test(x.elemento));
    const anta=doorPieces[0];
    if(anta){
      const dh=Math.max(anta.lung,anta.larg);
      const nDoors=Math.max(1,(items||[]).filter(x=>/^anta(?! scorrevole)/i.test(x.elemento)).reduce((s,x)=>s+x.pz,0)||Math.round(((items||[]).find(x=>/^vetro anta/i.test(x.elemento))||{pz:1}).pz));
      const nH=hingeCount(dh);
      add(t("mHingeAt").replace("{h}",dh).replace("{list}",hingePositions(dh,nH).join(" · ")+" mm"));
    } }
  if(hw.hwBin>0) add(t("mSliding").replace("{p}",P("bin","hwBin")),{hi:["anta"],show:[...CARC,"tram","zocc","rip"]});
  if(hw.hwMan>0) add(t("mHandles").replace("{q}",hw.hwMan).replace("{p}",P("man","hwMan")));
  if(hw.hwPush>0) add(t("mPush").replace("{q}",hw.hwPush).replace("{p}",P("push","hwPush")));
  if(hw.hwAsta>0) add(t("mRail").replace("{q}",hw.hwAsta).replace("{p}",P("asta","hwAsta")));
  add(t("mCheck"));
  return st;
}
$("btnMont").addEventListener("click",()=>{
  const p=proj(); if(!p)return;
  const S=state.settings;
  const {mods}=computeHardware(p,S,true);
  let html=`<div class="pr-head"><div><h1>${esc(t("mTitle"))}</h1>
    <div style="font-size:11pt;margin-top:2px"><b>${esc(t("printProject"))}:</b> ${esc(p.name)}<br>
    <b>${esc(t("date"))}:</b> ${today()}</div>
    ${prTrace(p)}</div>
    <div class="co">${prLogo()}<b>${esc(prCoName())}</b><br>${esc(prCoInfo())}</div></div>`;
  const modNames=Object.keys(mods);
  if(!modNames.length){ toast(t("selectProject")); return; }
  for(const mod of modNames){
    const hw=mods[mod];
    const cfg=p.configs&&(p.configs[mod]||p.configs[mod.replace(/ [AB]$/,"")]);
    const steps=assemblySteps(mod,hw,cfg,p.pieces.filter(x=>x.modulo===mod));
    html+=`<h2>${esc(mod)}${cfg?` — ${cfg.L}×${cfg.H}×${cfg.P} mm`:""}</h2><ol style="font-size:10pt;line-height:1.5;padding-left:18px">`;
    for(const s of steps){
      const txt=typeof s==="string"?s:s.x;
      const img=(typeof s==="object"&&s.g&&cfg)?isoStep(cfg,s.g.hi,s.g.show):"";
      html+=img?`<li style="page-break-inside:avoid"><div style="display:flex;gap:6mm;align-items:center">${img}<span>${esc(txt)}</span></div></li>`
               :`<li>${esc(txt)}</li>`;
    }
    html+="</ol>";
  }
  html+=`<div class="pr-foot"><span>${esc(t("mSafety"))}</span><span>Ebanist · ${esc(prCoName())}</span></div>`;
  $("printArea").innerHTML=html;
  printOut();
});

/* ================= ETICHETTE & PACCHETTO LABORATORIO ================= */
function edgeSvg(bordo){
  // diagramma bordatura: lati lunghi = orizzontali, corti = verticali
  const b=(bordo||"").toUpperCase();
  const nL=b.includes("2L")?2:b.includes("1L")?1:0;
  const nC=b.includes("2C")?2:b.includes("1C")?1:0;
  const th="stroke='#3e6b0a' stroke-width='3'", tn="stroke='#bbb' stroke-width='0.8'";
  return `<svg width="46" height="30" viewBox="0 0 46 30">
    <line x1="3" y1="3" x2="43" y2="3" ${nL>=1?th:tn}/>
    <line x1="3" y1="27" x2="43" y2="27" ${nL>=2?th:tn}/>
    <line x1="3" y1="3" x2="3" y2="27" ${nC>=1?th:tn}/>
    <line x1="43" y1="3" x2="43" y2="27" ${nC>=2?th:tn}/>
  </svg>`;
}
/* ---------- magazzino ritagli ----------
   Il pezzo di pannello avanzato da una commessa e materiale gia pagato:
   se non lo si rimette in gioco si ricompra due volte la stessa cosa. */
function renderStock(){
  const box=$("stockList"); box.innerHTML="";
  const sel=$("stMat");
  const stamp=state.lang+":"+matVisible().length;
  if(sel.dataset.n!==stamp){
    sel.innerHTML=matVisible().map(m=>`<option>${esc(matById(m.id).label)}</option>`).join("");
    sel.dataset.n=stamp;
  }
  $("sStockMin").value=state.settings.stockMin;
  const st=state.stock||[];
  if(!st.length){ box.innerHTML=`<p class="mini">${esc(t("stockEmpty"))}</p>`; return; }
  const byMat={};
  for(const r of st) (byMat[r.mat]=byMat[r.mat]||[]).push(r);
  for(const mat of Object.keys(byMat)){
    const head=document.createElement("div"); head.className="mini"; head.style.margin="10px 0 4px";
    head.textContent=mat; box.appendChild(head);
    for(const r of byMat[mat].sort((a,b)=>b.L*b.W-a.L*a.W)){
      const row=document.createElement("div"); row.className="strow";
      row.innerHTML=`<b>${r.L}×${r.W}</b><span>×${r.n}</span>
        <button class="iconbtn" data-del="${r.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>`;
      row.querySelector("[data-del]").addEventListener("click",()=>{
        state.stock=state.stock.filter(x=>x.id!==r.id); persist(); renderStock(); renderNest();
      });
      box.appendChild(row);
    }
  }
}
function stockAdd(mat,L,W,n){
  L=Math.round(L); W=Math.round(W);
  if(!(L>0&&W>0&&n>0)) return;
  if(L<W){const s=L;L=W;W=s;}                       // lato lungo sempre per primo
  const hit=(state.stock||[]).find(x=>x.mat===mat&&x.L===L&&x.W===W);
  if(hit) hit.n+=n; else state.stock.push({id:uid(),mat,L,W,n});
}
/* ---------- passa dalla porta? ----------
   Un corpo montato in laboratorio che non entra in casa e un corpo da
   rimontare sul posto: meglio saperlo prima di incollare il bordo. */
function fitsThrough(L,H,P,w,h){
  return [[L,H],[L,P],[H,P]].some(([a,b])=>(a<=w&&b<=h)||(b<=w&&a<=h));
}
function renderTransp(){
  const p=proj(), box=$("transpList"); box.innerHTML="";
  const S=state.settings;
  $("trW").value=S.doorW; $("trH").value=S.doorH;
  const cfgs=(p&&p.configs)||{};
  const names=Object.keys(cfgs);
  if(!names.length){ box.innerHTML=`<p class="mini">${esc(t("transpNone"))}</p>`; return; }
  let bad=0;
  for(const nm of names){
    const c=cfgs[nm];
    // sull'angolare le due ali si trasportano separate: conta l'ala piu larga
    const L=c.type==="angolare"?Math.max(c.L||0,c.L2||0):(c.L||0);
    const ok=fitsThrough(L,c.H||0,c.P||0,S.doorW,S.doorH);
    if(!ok) bad++;
    const row=document.createElement("div"); row.className="strow";
    row.innerHTML=`<b>${esc(nm)}</b><span>${L}×${c.H}×${c.P}</span>
      <i class="tr-tag ${ok?"ok":"no"}">${ok?"✓":"✕"}</i>`;
    box.appendChild(row);
  }
  const sum=document.createElement("p"); sum.className="mini"; sum.style.marginTop="10px";
  sum.textContent=bad?t(bad===1?"transpBad1":"transpBad").replace("{n}",bad):t("transpOk");
  sum.style.color=bad?"var(--danger)":"var(--ok)";
  box.appendChild(sum);
}
$("btnTransp").addEventListener("click",()=>{ renderTransp(); openSheet("shTransp"); });
["trW","trH"].forEach(id=>$(id).addEventListener("change",()=>{
  state.settings.doorW=Math.max(100,parseInt($("trW").value,10)||800);
  state.settings.doorH=Math.max(100,parseInt($("trH").value,10)||2050);
  persist(); renderTransp();
}));

/* ---------- ordine al fornitore ----------
   Il piano di taglio sa gia quanti pannelli servono DAVVERO (tolti i
   ritagli di magazzino); qui diventa una lista da mandare al fornitore. */
function orderRows(p){
  const S=state.settings, tot=computeTotals(p);
  const panels=[], edges={};
  for(const k of Object.keys(tot.mats)){
    const m=tot.mats[k];
    if(/^accessorio/i.test(m.label)) continue;
    const PN=panelFor(m.label);
    const stk=(state.stock||[]).filter(r=>r.mat===m.label)
      .flatMap(r=>Array.from({length:Math.max(1,r.n|0)},()=>({L:r.L,W:r.W})));
    const res=nest(m.pieces,PN.L,PN.W,S.kerf,stk);
    const neu=res.panels.filter(x=>!x.stock).length;
    const fromStock=res.panels.filter(x=>x.stock).length;
    const dec=matDecorByLabel(m.label);
    if(neu||fromStock) panels.push({label:m.label,dec,L:PN.L,W:PN.W,n:neu,stock:fromStock});
    const ml=m.pieces.reduce((s,x)=>s+bandingMm(x.bordo,x.lung,x.larg,x.angL,x.angR,x.shape)*x.pz/1000,0);
    if(ml>0.01) edges[m.label]=(edges[m.label]||0)+ml;
  }
  return {panels,edges,hw:computeHardware(p)};
}
$("btnOrder").addEventListener("click",()=>{
  const p=proj(); if(!p){toast(t("selectProject"));return;}
  const S=state.settings, o=orderRows(p);
  let html=`<div class="pr-head">
    <div><h1>${esc(t("orderTitle"))}</h1>
      <div style="font-size:11pt;margin-top:2px"><b>${esc(t("printProject"))}:</b> ${esc(p.name)}<br>
      <b>${esc(t("date"))}:</b> ${esc(today())}</div></div>
    <div class="co">${prLogo()}<b>${esc(prCoName())}</b><br>${esc(prCoInfo())}</div></div>`;
  html+=`<h2>${esc(t("orderPanels"))}</h2><table><tr>
    <th>${esc(t("fMaterial"))}</th><th>${esc(t("orderSize"))}</th>
    <th style="text-align:right">${esc(t("orderQty"))}</th><th style="text-align:right">${esc(t("panelsStock"))}</th></tr>`;
  for(const r of o.panels)
    html+=`<tr><td>${esc(r.label)}${r.dec?` <b>[${esc(r.dec)}]</b>`:""}</td>
      <td>${r.L}×${r.W}</td><td class="n"><b>${r.n}</b></td><td class="n">${r.stock||"—"}</td></tr>`;
  html+=`</table>`;
  const ek=Object.keys(o.edges);
  if(ek.length){
    html+=`<h2>${esc(t("orderEdge"))}</h2><table><tr><th>${esc(t("fMaterial"))}</th>
      <th style="text-align:right">${esc(t("orderMl"))}</th></tr>`;
    for(const k of ek) html+=`<tr><td>${esc(k)}</td><td class="n">${fmt(o.edges[k]*1.1,1)}</td></tr>`;
    html+=`</table><p class="pr-sum">${esc(t("orderEdgeNote"))}</p>`;
  }
  const hw=o.hw.filter(x=>x.qty>0);
  if(hw.length){
    html+=`<h2>${esc(t("hardware"))}</h2><table><tr><th>${esc(t("catProd"))}</th>
      <th>${esc(t("catArt"))}</th><th style="text-align:right">${esc(t("orderQty"))}</th></tr>`;
    for(const x of hw)
      html+=`<tr><td>${esc(x.prod?x.prod.name:t("hw"+x.k.slice(2,3).toUpperCase()+x.k.slice(3)))}</td>
        <td>${esc(x.prod&&x.prod.art?x.prod.art:"—")}</td><td class="n"><b>${x.qty}</b></td></tr>`;
    html+=`</table>`;
  }
  html+=`<div class="pr-foot"><span>${esc(prCoName())}</span><span>${esc(t("orderCheck"))}</span></div>`;
  $("printArea").innerHTML=html;
  printOut();
});

$("btnStock").addEventListener("click",()=>{ renderStock(); openSheet("shStock"); });
$("btnStockAdd").addEventListener("click",()=>{
  stockAdd($("stMat").value, parseInt($("stL").value,10)||0, parseInt($("stW").value,10)||0,
           Math.max(1,parseInt($("stN").value,10)||1));
  persist(); renderStock(); renderNest(); toast(t("stockSaved"));
});
$("sStockMin").addEventListener("change",()=>{
  state.settings.stockMin=Math.max(0,parseInt($("sStockMin").value,10)||0);
  persist(); renderNest();
});
$("btnLeft").addEventListener("click",()=>{
  if(!nestLeftovers.length) return;
  for(const f of nestLeftovers) stockAdd(f.mat,f.L,f.W,1);
  persist(); renderStock(); renderNest(); toast(t("stockSaved"));
});
$("btnCuts").addEventListener("click",()=>{
  const on=$("nestOut").classList.toggle("showcuts");
  $("btnCuts").classList.toggle("on",on);
});
$("btnLabels").addEventListener("click",()=>{
  const p=proj(); if(!p){toast(t("selectProject"));return;}
  // ordina come la distinta e espandi pz → un'etichetta per pezzo fisico
  const rows=[];
  for(const x of p.pieces) for(let i=1;i<=x.pz;i++) rows.push({...x,nOf:i,nTot:x.pz});
  const N=rows.length;
  let html=`<div class="lbl-grid">`;
  rows.forEach((x,i)=>{
    const dec=matDecorByLabel(x.materiale);
    const matShort=((x.materiale||"").replace(/Truciolare Bilaminato/i,"PAL")+(dec?" · "+dec:"")).slice(0,38);
    html+=`<div class="lbl">
      <div class="l1">${esc(p.name)} · ${esc(x.modulo)}</div>
      <div class="l2">${esc(x.elemento)}${x.nTot>1?` (${x.nOf}/${x.nTot})`:""}${scList(x).length?` <span style="font-weight:700">✂ ${esc(scTxt(x))}</span>`:""}</div>
      <div class="dim">${x.lung} × ${x.larg}</div>
      ${hingeInfo(x)?`<div class="l-hinge">⌀35: ${hingeInfo(x).pos.join(" · ")}</div>`:""}
      <div class="l3"><span>${esc(matShort)}<br>#${String(i+1).padStart(3,"0")}/${N}</span>${edgeSvg(x.bordo)}</div>
    </div>`;
  });
  html+=`</div>`;
  $("printArea").innerHTML=html;
  printOut();
});
$("btnLab").addEventListener("click",async()=>{
  const p=proj(); if(!p){toast(t("selectProject"));return;}
  if(!proGate("lab")) return;
  if(closureFirst("btnLab")) return;
  if(!exportAllowed()) return;
  // pacchetto pulito per il laboratorio: pezzi + note tecniche, SENZA prezzi/cliente
  const pkg={ebanist_lab:1,name:p.name,date:p.date,deadline:p.deadline||null,
    pieces:p.pieces.map(x=>({modulo:x.modulo,elemento:x.elemento,lung:x.lung,larg:x.larg,pz:x.pz,bordo:x.bordo,scasso:scList(x),materiale:x.materiale+(matDecorByLabel(x.materiale)?" ["+matDecorByLabel(x.materiale)+"]":"")}))};
  const json=JSON.stringify(pkg,null,1);
  const fname=`Lab_${slug(p.name)}.json`;
  try{
    const file=new File([json],fname,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:fname}); return;
    }
  }catch(e){}
  download(fname,json,"application/json"); toast("✓");
});

