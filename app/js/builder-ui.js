"use strict";
/* ===========================================================================
   Ebanist — app/js/builder-ui.js

   L'interfaccia del generatore: pannello introduttivo, gruppi a fisarmonica,
   pannello cassetti, cercatore di materiali e tipi propri dell'utente.
   =========================================================================== */
/* ================= INTRO ================= */
/* Tutto sintetizzato con WebAudio: zero file, funziona anche in officina senza rete.
   Il colpo cade a 0.62 s — la grafica è sincronizzata su quel momento. */
function irBuffer(ctx,sec,decay){
  const n=Math.floor(ctx.sampleRate*sec), b=ctx.createBuffer(2,n,ctx.sampleRate);
  for(let c=0;c<2;c++){ const d=b.getChannelData(c);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay); }
  return b;
}
function introSound(){
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  let ctx; try{ ctx=new AC(); }catch(e){ return; }
  const go=()=>{
   try{
    const t=ctx.currentTime+0.03, HIT=t+0.62;
    const master=ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
    const verb=ctx.createConvolver(); verb.buffer=irBuffer(ctx,2.6,2.4);
    const wet=ctx.createGain(); wet.gain.value=0.85; verb.connect(wet); wet.connect(master);
    const noise=(dur,decay)=>{ const n=Math.floor(ctx.sampleRate*dur), b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0);
      for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,decay);
      const src=ctx.createBufferSource(); src.buffer=b; return src; };
    const voice=(type,freq,det,st,peak,dur,pan,send)=>{
      const o=ctx.createOscillator(), g=ctx.createGain(), pn=ctx.createStereoPanner?ctx.createStereoPanner():null;
      o.type=type; o.frequency.value=freq; if(det) o.detune.value=det;
      g.gain.setValueAtTime(0.0001,st);
      g.gain.exponentialRampToValueAtTime(peak,st+Math.min(0.22,dur*0.2));
      g.gain.exponentialRampToValueAtTime(0.0001,st+dur);
      o.connect(g);
      if(pn){ pn.pan.value=pan||0; g.connect(pn); pn.connect(master); if(send) pn.connect(verb); }
      else { g.connect(master); if(send) g.connect(verb); }
      o.start(st); o.stop(st+dur+0.05);
    };
    /* 1. riser: rumore che sale di filtro e di volume fino al colpo */
    const ns=noise(0.66,0.4), bp=ctx.createBiquadFilter(), ng=ctx.createGain();
    bp.type="bandpass"; bp.Q.value=0.9;
    bp.frequency.setValueAtTime(180,t); bp.frequency.exponentialRampToValueAtTime(5200,HIT);
    ng.gain.setValueAtTime(0.0001,t); ng.gain.exponentialRampToValueAtTime(0.26,HIT-0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001,HIT+0.10);
    ns.connect(bp); bp.connect(ng); ng.connect(master); ng.connect(verb); ns.start(t);
    /* 2. sub che gonfia sotto */
    const sub=ctx.createOscillator(), sg=ctx.createGain();
    sub.type="sine"; sub.frequency.setValueAtTime(46,t); sub.frequency.linearRampToValueAtTime(58,HIT);
    sg.gain.setValueAtTime(0.0001,t); sg.gain.exponentialRampToValueAtTime(0.22,HIT-0.03);
    sg.gain.exponentialRampToValueAtTime(0.0001,HIT+0.06);
    sub.connect(sg); sg.connect(master); sub.start(t); sub.stop(HIT+0.1);
    /* 3. IL COLPO: legno + transiente brillante + caduta di sub */
    const wn=noise(0.15,2.6), wf=ctx.createBiquadFilter(), wg=ctx.createGain();
    wf.type="bandpass"; wf.frequency.value=440; wf.Q.value=1.2; wg.gain.value=0.42;
    wn.connect(wf); wf.connect(wg); wg.connect(master); wg.connect(verb); wn.start(HIT);
    const cn=noise(0.05,5), cf=ctx.createBiquadFilter(), cg=ctx.createGain();
    cf.type="highpass"; cf.frequency.value=3800; cg.gain.value=0.30;
    cn.connect(cf); cf.connect(cg); cg.connect(master); cn.start(HIT);
    const bd=ctx.createOscillator(), bg=ctx.createGain();
    bd.type="sine"; bd.frequency.setValueAtTime(180,HIT); bd.frequency.exponentialRampToValueAtTime(38,HIT+0.55);
    bg.gain.setValueAtTime(0.0001,HIT); bg.gain.exponentialRampToValueAtTime(0.60,HIT+0.015);
    bg.gain.exponentialRampToValueAtTime(0.0001,HIT+0.75);
    bd.connect(bg); bg.connect(master); bd.start(HIT); bd.stop(HIT+0.8);
    /* 4. campana d'oro: parziali inarmonici, coda lunga in riverbero */
    [[523.25,0.13,0],[787.0,0.085,-0.35],[1049.0,0.055,0.35],[1578.0,0.032,0.15]].forEach(function(pr,i){
      voice("sine",pr[0],i*4,HIT+i*0.008,pr[1],2.1-i*0.28,pr[2],true);
    });
    /* 5. accordo caldo che fiorisce, due voci per larghezza */
    [[196.00,0.16],[392.00,0.13],[587.33,0.10],[783.99,0.06]].forEach(function(pr,i){
      voice("triangle",pr[0],-7,HIT+0.10+i*0.05,pr[1],1.9,-0.30,true);
      voice("triangle",pr[0], 7,HIT+0.10+i*0.05,pr[1],1.9, 0.30,true);
    });
    /* 6. scintillio finale */
    voice("sine",2093.0,0,HIT+0.42,0.030,1.3,0.2,true);
    voice("sine",2637.0,0,HIT+0.56,0.020,1.1,-0.2,true);
    setTimeout(function(){ try{ctx.close();}catch(e){} },4200);
   }catch(e){ try{ctx.close();}catch(e2){} }
  };
  if(ctx.state==="suspended"){ ctx.resume().then(go).catch(function(){}); } else go();
}
function initSplash(){
  const el=document.getElementById("splash"); if(!el) return;
  const S=(state&&state.settings)||{};
  /* Due modi di dire di no, e tutti e due tolgono il pannello dal documento
     invece di nasconderlo: nascosto, partirebbe lo stesso il suono.
     `data-intro="off"` lo mette boot.js, che gira prima di ogni altra cosa
     e sa gia' della scelta esplicita e del movimento ridotto di sistema. */
  if(S.intro===0 || document.documentElement.getAttribute("data-intro")==="off"){ el.remove(); return; }
  /* incisione: un solo contorno, si disegna da solo */
  el.querySelectorAll(".sp-draw path").forEach(function(pt,i){
    let L=0; try{ L=pt.getTotalLength(); }catch(e){}
    if(!L) return;
    pt.style.strokeDasharray=L; pt.style.strokeDashoffset=L;
    pt.animate([{strokeDashoffset:L},{strokeDashoffset:0}],
      {duration:820,delay:620+i*60,easing:"cubic-bezier(.35,.75,.3,1)",fill:"forwards"});
  });
  if(S.introSound!==0) introSound();
  const kill=()=>{ if(!el.parentNode) return;
    el.style.transition="opacity .22s ease-in"; el.style.opacity="0";
    setTimeout(function(){ if(el.parentNode) el.remove(); },240); };
  el.addEventListener("click",kill,{once:true});
  el.addEventListener("touchstart",kill,{once:true,passive:true});
  setTimeout(function(){ if(el.parentNode) el.remove(); },3000);
}

let explodeOn=0;
function redraw3D(){ if(_raf)return; _raf=requestAnimationFrame(()=>{_raf=0;draw3D();}); }
function init3DControls(){
  /* i gesti vanno sull'elemento davvero visibile: canvas se WebGL e attivo */
  const el=gl3dOn()?$("gl3d"):$("svg3d"); if(!el||el.dataset.ctl)return; el.dataset.ctl="1";
  const ptrs=new Map(); let pinchD=0,lastTap=0;
  el.addEventListener("pointerdown",e=>{
    el.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptrs.size===2){ const a=[...ptrs.values()]; pinchD=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]); }
    const now=Date.now();
    if(now-lastTap<320 && ptrs.size===1){ VIEW.yaw=0.46; VIEW.pitch=0.30; VIEW.zoom=1; redrawCam(); }
    lastTap=now;
  });
  /* L'orbita col dito: un disegno per fotogramma. I valori si aggiornano
     a ogni evento — sono quelli che l'evento dopo legge — ma ridisegnare
     piu volte fra due fotogrammi e lavoro buttato, e si sente proprio sui
     telefoni lenti dove il 3D e gia in ripiego SVG. */
  const paintCam=rafCoalesce(()=>redrawCam());
  el.addEventListener("pointermove",e=>{
    if(!ptrs.has(e.pointerId))return;
    const prev=ptrs.get(e.pointerId); ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptrs.size===1){
      VIEW.yaw=Math.min(1.45,Math.max(0.08,VIEW.yaw+(e.clientX-prev[0])*0.008));
      VIEW.pitch=Math.min(1.2,Math.max(0.05,VIEW.pitch+(e.clientY-prev[1])*0.006));
      paintCam();
    }else if(ptrs.size===2){
      const a=[...ptrs.values()]; const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);
      if(pinchD>0) VIEW.zoom=Math.min(3,Math.max(0.5,VIEW.zoom*d/pinchD));
      pinchD=d; paintCam();
    }
  });
  const up=e=>{ptrs.delete(e.pointerId);pinchD=0;};
  el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
  el.addEventListener("wheel",e=>{e.preventDefault();
    VIEW.zoom=Math.min(3,Math.max(0.5,VIEW.zoom*(e.deltaY<0?1.1:0.9))); redrawCam();},{passive:false});
}

/* --- builder UI --- */
function cfgFromForm(){
  const v=(id,def)=>{const n=parseInt($(id).value,10);return isFinite(n)&&n>=0?n:def;};
  return {name:$("bName").value.trim(), type:$("bTipo").value,
    L:Math.max(100,v("bL",800)), L2:Math.max(300,v("bL2",900)),
    H:Math.max(100,v("bH",720)), P:Math.max(100,v("bP",500)),
    /* LA GROSSEZZA VIENE DAL MATERIALE. Il vecchio `||{th:18}` era la rete
       di sicurezza che teneva il calcolo a 18 quando il pannello era da 19.
       Senza materiale la grossezza resta 0 e il generatore si ferma. */
    t:(+((matById($("bMatBody").value)||{}).th)||0), plinth:v("bPlinth",0),
    matBody:$("bMatBody").value, matFront:$("bMatFront").value, matBack:$("bMatBack").value,
    /* i materiali per ruolo: solo quelli scelti davvero. Un ruolo assente
       vuol dire «eredita dalla struttura», ed e la cosa giusta da salvare —
       cosi cambiando il materiale del corpo si spostano anche loro. */
    mat:Object.assign({},(buildCfg&&buildCfg.mat)||{}),
    tram:Math.min(4,v("bTram",0)), shelves:Math.min(10,v("bShelves",0)),
    drawers:Math.min(8,v("bDrawers",0)), doors:Math.min(4,v("bDoors",0)),
    back:parseInt($("bBack").value,10)?1:0, hang:parseInt($("bHang").value,10)?1:0,
    front:$("bFront").value, support:$("bSupport").value,
    handles:$("bHandles").value, shelfType:$("bShelfT").value,
    boxes:parseInt($("bBoxes").value,10), corner:$("bCorner").value, cornerKind:$("bCornerKind").value,
    drawerSys:$("bDrawSys").value||"legno", drawerDist:$("bDrawDist").value||"uguali",
    drawerPos:$("bDrawPos").value||"auto",
    drawerFH:Math.max(60,v("bDrawFH",200)), drawerZone:v("bDrawZone",0),
    drawerH:$("bDrawH").value||null, drawerInset:v("bDrawInset",35),
    angL:fAng("bAngL"), angR:fAng("bAngR"), obstacles:buildObst,
    bow:Math.min(200,v("bBow",0)), rcorner:Math.max(10,Math.min(400,v("bRc",60))),
    hangGap:v("bHangGap",1000), shelfEven:parseInt($("bShelfEven").value,10)?1:0, shelfStep:Math.max(60,v("bShelfStep",320)),
    secMode:buildSecMode};
}
function fAng(id){ const raw=$(id).value.trim(); if(!raw) return 90; const n=parseFloat(raw.replace(",",".")); return isFinite(n)?angClamp(n):90; }
function syncBuildForm(){
  $("bFront").value=buildCfg.front||"piena"; $("bSupport").value=buildCfg.support||"zoccolo";
  $("bHandles").value=buildCfg.handles||"maniglia"; $("bShelfT").value=buildCfg.shelfType||"mobile";
  $("bBoxes").value=buildCfg.boxes===0||buildCfg.boxes==="0"?"0":"1";
  $("bCorner").value=buildCfg.corner||"sx";
  $("bCornerKind").value=buildCfg.cornerKind||"int";
  $("fCornerWrap").style.display=($("bTipo").value==="angolare")?"":"none";
  $("fCornerKindWrap").style.display=($("bTipo").value==="angolare")?"":"none";
  /* la bombatura si chiede solo quando serve: su un frontale piatto sarebbe
     un campo in piu che non fa niente, e sono gia ventinove */
  $("bBow").value=buildCfg.bow||"";
  $("rowBow").style.display=($("bFront").value==="curvo")?"":"none";
  $("bRc").value=buildCfg.rcorner||"";
  $("rowRc").style.display=($("bTipo").value==="raccordato")?"":"none";
  $("bName").value=buildCfg.name||""; $("bTipo").value=buildCfg.type||"standard";
  $("bL").value=buildCfg.L; $("bL2").value=buildCfg.L2||900;
  $("bH").value=buildCfg.H; $("bP").value=buildCfg.P;
  const S=state.settings;
  /* il materiale lo dice il corpo o il progetto — non lo spessore. */
  $("bMatBody").value=buildCfg.matBody||S.matBody||"bianco_19";
  $("bMatFront").value=buildCfg.matFront||S.matFront||"bianco_19";
  $("bMatBack").value=buildCfg.matBack||S.matBack||"pfl3";
  $("bPlinth").value=buildCfg.plinth; $("bTram").value=buildCfg.tram;
  $("bShelves").value=buildCfg.shelves; $("bDrawers").value=buildCfg.drawers; $("bDoors").value=buildCfg.doors;
  $("bDrawDist").value=buildCfg.drawerDist||"uguali";
  $("bDrawPos").value=buildCfg.drawerPos||"auto";
  $("bDrawFH").value=buildCfg.drawerFH||"";
  $("bDrawZone").value=buildCfg.drawerZone||"";
  $("bDrawInset").value=buildCfg.drawerInset!=null?buildCfg.drawerInset:"";
  renderDrawUI(buildCfg.drawerSys||"legno",buildCfg.drawerH||"");
  $("bBack").value=buildCfg.back?1:0; $("bHang").value=buildCfg.hang?1:0;
  buildObst=buildCfg.obstacles||[];
  buildSecMode=buildCfg.secMode||null;
  $("bHangGap").value=buildCfg.hangGap!=null?buildCfg.hangGap:1000;
  $("bShelfEven").value=buildCfg.shelfEven===0?"0":"1";
  $("bShelfStep").value=buildCfg.shelfStep||320;
  $("bAngL").value=isAng(buildCfg.angL)?buildCfg.angL:"";
  $("bAngR").value=isAng(buildCfg.angR)?buildCfg.angR:"";
  $("rowL2").style.display=$("bTipo").value==="angolare"?"":"none";
  /* I bottoni del cercatore mostrano quello che c'e nel <select>: se non si
     ridipingono DOPO averlo riempito, restano sulla prima voce della lista.
     Si vedeva come uno schienale in rovere da 19 al posto dell'HDF da 3 — il
     valore era giusto, l'etichetta no, e l'etichetta e quello che l'utente
     legge prima di premere «genera». */
  paintMatPicks(); renderMatRoles();
}
/* --- pannello cassetti del generatore ---
   Le opzioni che hanno senso dipendono dal sistema scelto: su LEGRABOX
   l'altezza della sponda e di listino e si sceglie da un elenco, sul legno
   la cassa segue il frontale e quel campo non vuol dire niente. */
function renderDrawUI(sysId,hcode){
  const sel=$("bDrawSys"); if(!sel) return;
  const cur=sysId||sel.value||"legno";
  sel.innerHTML=DRAWSYS_IDS.map(id=>{
    const s=DRAWSYS[id], nm=(s.n&&(s.n[state.lang]||s.n.it))||id;
    return `<option value="${id}"${id===cur?" selected":""}>${esc(nm)}${s.chk?" ·":""}</option>`;
  }).join("");
  const sys=drawSys(cur);
  const hSel=$("bDrawH");
  if(sys.metal){
    const codes=Object.keys(sys.hs);
    hSel.innerHTML=`<option value="">${esc(t("dwAuto"))}</option>`+codes.map(c=>
      `<option value="${c}"${c===hcode?" selected":""}>${c} · ${sys.hs[c]} mm</option>`).join("");
  }else hSel.innerHTML=`<option value="">—</option>`;
  const n=+($("bDrawers").value||0);
  $("drawWrap").style.display=n>0?"":"none";
  $("rowDrawH").style.display=sys.metal?"":"none";
  $("rowDrawFH").style.display=($("bDrawDist").value==="fix")?"":"none";
  $("rowDrawZone").style.display=($("bDrawDist").value==="fix")?"none":"";
  const pos=$("bDrawPos").value||"auto";
  $("rowDrawIns").style.display=(pos==="interno"||(pos==="auto"&&+($("bDoors").value||0)>0))?"":"none";
}
/* Il riassunto che serve in officina: quale guida comprare, quanto lunga,
   e quanto vengono i pezzi della cassa. Sono i numeri che altrimenti si
   scoprono solo aprendo la distinta. */
function drawInfoLine(cfg,built){
  const el=$("drawInfo"); if(!el) return;
  if(!(cfg.drawers>0)||!built){ el.textContent=""; return; }
  const p=built.draw;
  if(!p||!p.ok){ el.textContent=""; return; }
  const bits=[];
  const nm=(p.sys.n&&(p.sys.n[state.lang]||p.sys.n.it))||p.sysId;
  bits.push(nm);
  if(p.nl) bits.push("NL "+p.nl);
  if(p.hcode) bits.push(t("dwSide")+" "+p.hcode+" ("+p.sideH+" mm)");
  const hs=p.fronts.map(f=>Math.round(f.h));
  bits.push(t("dwFronts")+": "+hs.slice().reverse().join(" / ")+" mm");
  if(p.sys.metal) bits.push(t("dwBase")+" "+p.baseW+"×"+p.baseL+" · "+t("dwBack")+" "+p.backW+"×"+p.backH);
  else if(p.boxW) bits.push(t("dwBox")+" "+p.boxW+"×"+p.sideH+"×"+p.nl);
  bits.push(p.inner?(t("dwInner")+" −"+p.inset+" mm"):t("posVista").toLowerCase());
  if(p.sys.chk) bits.push(t("artCheck").replace(/^—\s*/,""));
  el.textContent=bits.join(" · ");
}
/* ordine utile: dal default si arriva subito a "solo asta" e poi a "solo ripiani" */
const SEC_CYCLE=["hangShelf","hang","shelf","drawerShelf","drawers","empty"];
function renderSecChips(){
  const box=$("secModeChips"); if(!box) return;
  const n=(buildCfg.tram||0)+1;
  const cur=(buildCfg.secMode||[]).slice(0,n);
  while(cur.length<n) cur.push(null);
  $("secModeHint").textContent=ts2("secHint");
  box.innerHTML=cur.map((m,i)=>{
    const eff=m||((buildCfg.hang)?(buildCfg.shelves>0?"hangShelf":"hang"):(buildCfg.shelves>0?"shelf":"empty"));
    return `<button class="chip sm" data-sec="${i}">${i+1}: ${esc(ts2("sec_"+eff))}</button>`;
  }).join("");
  box.querySelectorAll("[data-sec]").forEach(b=>b.addEventListener("click",()=>{
    const i=+b.dataset.sec, arr=(buildCfg.secMode||[]).slice();
    while(arr.length<n) arr.push(null);
    const eff=arr[i]||((buildCfg.hang)?(buildCfg.shelves>0?"hangShelf":"hang"):(buildCfg.shelves>0?"shelf":"empty"));
    arr[i]=SEC_CYCLE[(SEC_CYCLE.indexOf(eff)+1)%SEC_CYCLE.length];
    buildSecMode=arr; buildCfg.secMode=arr;
    drawPreview();
  }));
}
function ts2(k){ return t(k); }
function drawPreview(){
  buildCfg=cfgFromForm();
  $("rowL2").style.display=buildCfg.type==="angolare"?"":"none";
  $("fCornerWrap").style.display=buildCfg.type==="angolare"?"":"none";
  $("fCornerKindWrap").style.display=buildCfg.type==="angolare"?"":"none";
  draw3D();
  /* Senza materiale non c'e grossezza, e senza grossezza non c'e geometria:
     il motore si ferma. L'anteprima lo DICE, invece di rompersi in silenzio
     e lasciare a vista i numeri del corpo precedente. */
  let built;
  try{ built=buildModule(buildCfg); }
  catch(e){ toast(e&&e.message||String(e)); return; }
  const pieces=built.pieces;
  const panelPieces=pieces.filter(x=>!x.mat);
  const pcs=panelPieces.reduce((s,x)=>s+x.pz,0);
  const m2=panelPieces.reduce((s,x)=>s+x.lung*x.larg*x.pz/1e6,0);
  const ml=panelPieces.reduce((s,x)=>s+bandingMm(x.bordo,x.lung,x.larg,x.angL,x.angR,x.shape)*x.pz/1000,0);
  const dim=buildCfg.type==="angolare"?`${buildCfg.L}+${buildCfg.L2}×${buildCfg.H}×${buildCfg.P}`:`${buildCfg.L}×${buildCfg.H}×${buildCfg.P}`;
  $("buildInfo").textContent=`${dim} mm · ${pcs} ${t("pieces")} · ${fmt(m2)} m² · ${fmt(ml,1)} ml`;
  const ang=pieces.filter(x=>isAng(x.angL)||isAng(x.angR));
  const split=pieces.filter(x=>x.joint);
  const skip=pieces.filter(x=>x.angSkip);
  const notes=[];
  if(ang.length) notes.push(t("angNote").replace("{n}",ang.length));
  if(skip.length) notes.push("⚠︎ "+t("angSkipNote").replace("{n}",skip.length));
  const wn=built.warn||{};
  if(wn.shSqueeze) notes.push("⚠︎ "+t("shSqueezed"));
  if(wn.shMissing>0) notes.push("⚠︎ "+t("shNoFit").replace("{n}",wn.shMissing));
  if(wn.doorSkip>0) notes.push("⚠︎ "+t("doorNoFit").replace("{n}",wn.doorSkip));
  if(wn.doorTight) notes.push("⚠︎ "+t("doorTightW"));
  if(wn.doorOverlap) notes.push("⚠︎ "+t("wDoorOverDraw"));
  /* le verifiche del cassetto: profondità, altezza del frontale, larghezza
     utile, braccio della cerniera. Prima non ne esisteva nessuna e un cassetto
     impossibile finiva in distinta senza dire niente. */
  (wn.drawWarn||[]).forEach(w=>{
    let s=t(w.k);
    for(const k in w) if(k!=="k") s=s.replace("{"+k+"}",w[k]);
    notes.push("⚠︎ "+s);
  });
  if(split.length){
    const vis=split.some(x=>x.joint==="visible");
    notes.push(t(vis?"splitNoteVis":"splitNote").replace("{n}",split.length));
  }
  if(!notes.length&&(isAng(buildCfg.angL)||isAng(buildCfg.angR))) notes.push(t("angHintTxt"));
  renderSecChips();
  drawInfoLine(buildCfg,built);
  $("angHint").innerHTML=notes.length?notes.map(esc).join(" · "):"";
  $("angHint").style.color=(skip.length||wn.doorSkip>0||wn.doorTight||(wn.drawWarn&&wn.drawWarn.length)||split.some(x=>x.joint==="visible"))?"var(--danger)":"var(--muted)";
  updGrpSums();
}

/* riassunto di ogni gruppo chiuso: si legge il valore senza aprirlo */
function updGrpSums(){
  const c=buildCfg||cfgFromForm(), sel=id=>{const e=$(id); return e&&e.selectedIndex>=0?e.options[e.selectedIndex].text:"";};
  const dim=c.type==="angolare"?`${c.L}+${c.L2}×${c.H}×${c.P}`:`${c.L}×${c.H}×${c.P}`;
  const put=(id,txt)=>{const e=$(id); if(e) e.textContent=txt;};
  put("sumBase",`${sel("bTipo")} · ${dim}`);
  put("sumMat",[sel("bMatBody"),sel("bMatFront")].filter(Boolean)
      .map(s=>s.length>22?s.slice(0,21)+"…":s).join(" / "));
  const inn=[], pl=(n,k)=>`${n} ${t(n===1?k+"1":k)}`;   // 1 despartitor, 2 despartitori
  if(c.tram>0) inn.push(pl(c.tram,"sumTram"));
  if(c.shelves>0) inn.push(pl(c.shelves,"sumShelf"));
  if(c.drawers>0) inn.push(pl(c.drawers,"sumDraw"));
  if(c.hang) inn.push(t("sumHang"));
  put("sumIn",inn.length?inn.join(" · "):"—");
  const fr=[];
  if(c.doors>0) fr.push(pl(c.doors,"sumDoors"));
  fr.push(sel("bSupport"));
  put("sumFr",fr.filter(Boolean).join(" · "));
}
function fillMatSelects(){
  const fill=(id,minTh)=>{ const el=$(id); if(!el) return; const cur=el.value;
    el.innerHTML=matVisible().filter(m=>m.th>=(minTh||0)).map(m=>`<option value="${m.id}">${esc(matById(m.id).label)}</option>`).join("");
    if(cur) el.value=cur; };
  fill("bMatBody",12); fill("bMatFront",3); fill("bMatBack",0);
  paintMatPicks(); renderMatRoles();
}

/* ===== IL CERCATORE DI MATERIALI ========================================
   Una tendina nativa con quaranta referenze e inservibile: non si cerca, non
   si vede il colore, e il codice — che e quello che il magazzino chiede al
   telefono — non ci sta. Qui: ricerca su NOME e CODICE insieme, filtro di
   spessore, e le referenze raggruppate per famiglia.
   Il <select> resta sotto, nascosto: e ancora lui la sorgente del valore. */
const FAMIGLIE=["tinta_unita","legno","tessuto","cemento","lucido"];
/* Uno spessore si scrive «19», non «19.0»: solo il mezzo millimetro di un
   bordo ha diritto alla virgola. */
function isTouch(){ try{ return matchMedia("(pointer:coarse)").matches; }catch(e){ return false; } }
let MP={sel:null, minTh:0, allowInherit:false, q:"", th:null, onPick:null};

function matSwatch(m,cls){
  const c=(m&&m.c)||"#e8e8e4";
  const grad=m&&m.tx==="wood"?`background:linear-gradient(135deg,${c},${shade(c,0.82)})`
           :m&&m.tx==="gloss"?`background:linear-gradient(140deg,#fff,${c} 60%)`
           :`background:${c}`;
  return `<span class="${cls||"mp-dot"}" style="${grad}"></span>`;
}
/* L'etichetta corta di una referenza: colore, nome, spessore. Quella che
   sta sul bottone quando il foglio e chiuso. */
function matPickLabel(id){
  if(!id) return `<span class="mp-dot" style="background:repeating-linear-gradient(45deg,#ccc,#ccc 3px,#eee 3px,#eee 6px)"></span><span class="mp-txt">${esc(t("matInherit"))}</span>`;
  const m=matById(id);
  if(!m) return `<span class="mp-dot" style="background:#b3261e"></span><span class="mp-txt">${esc(t("matMissing").replace("{id}",id))}</span>`;
  return matSwatch(m)+`<span class="mp-txt">${esc(m.label)}${m.codice?" · "+esc(m.codice):""}</span>`+
         `<span class="mp-th">${fmtMm(m.th)} mm</span>`;
}
function paintMatPicks(){
  document.querySelectorAll(".matpick[data-for]").forEach(b=>{
    const sel=$(b.dataset.for); if(!sel) return;
    b.innerHTML=matPickLabel(sel.value||null);
  });
}
/* Gli spessori presenti DAVVERO nel catalogo: nessuna lista fissa. 18 e 19
   stanno davanti perche sono quelli che si usano; il resto segue. */
function matThicknesses(minTh){
  const set={};
  matVisible().forEach(m=>{ if(m.th>=(minTh||0)) set[m.th]=1; });
  return Object.keys(set).map(Number).sort((a,b)=>a-b);
}
function matPickOpen(selId,opt){
  const sel=$(selId); if(!sel) return;
  opt=opt||{};
  MP={sel:sel, minTh:opt.minTh||0, allowInherit:!!opt.allowInherit,
      q:"", th:null, onPick:opt.onPick||null};
  $("matPickTitle").textContent=opt.title||t("matPickTitle");
  $("matPickQ").value="";
  renderMatPick();
  closeSheets(); openSheet("shMatPick");
  /* sul telefono la tastiera copre meta schermo: si apre senza fuoco, e si
     tocca il campo solo se si vuole davvero cercare */
  if(!isTouch()) setTimeout(()=>{ try{ $("matPickQ").focus(); }catch(e){} },60);
}
function renderMatPick(){
  const q=(MP.q||"").trim().toLowerCase();
  const list=matVisible().filter(m=>{
    if(m.th<MP.minTh) return false;
    if(MP.th!=null&&m.th!==MP.th) return false;
    if(!q) return true;
    const mm=matById(m.id);
    /* nome E codice insieme: in officina si cerca «22458», in cantiere
       «avocado». Due campi, un campo di ricerca. */
    return (mm.label||"").toLowerCase().includes(q)||
           String(mm.codice||"").toLowerCase().includes(q)||
           String(mm.sup||"").toLowerCase().includes(q);
  });
  const ths=matThicknesses(MP.minTh);
  $("matPickTh").innerHTML=
    `<button class="chip sm${MP.th==null?" on":""}" data-th="">${esc(t("allThick"))}</button>`+
    ths.map(x=>`<button class="chip sm${MP.th===x?" on":""}" data-th="${x}">${fmtMm(x)}</button>`).join("");
  const cur=MP.sel.value;
  let html="";
  if(MP.allowInherit)
    html+=`<button class="mp-row${!cur?" on":""}" data-pick="">`+
          `<span class="mp-dot" style="background:repeating-linear-gradient(45deg,#ccc,#ccc 3px,#eee 3px,#eee 6px)"></span>`+
          `<span class="mp-n">${esc(t("matInherit"))}</span></button>`;
  for(const fam of FAMIGLIE){
    const rows=list.filter(m=>(matById(m.id).famiglia||"tinta_unita")===fam)
      /* dentro la famiglia: prima il listino vivo, poi quello di prima.
         Nessuna sparisce — cambia solo l'ordine in cui si incontrano. */
      .sort((a,b)=>(matIsLegacy(a)?1:0)-(matIsLegacy(b)?1:0));
    if(!rows.length) continue;
    html+=`<div class="mp-fam">${esc(t("fam_"+fam))}</div>`;
    html+=rows.map(m=>{
      const mm=matById(m.id);
      return `<button class="mp-row${mm.id===cur?" on":""}" data-pick="${esc(mm.id)}">`+
        matSwatch(mm)+
        `<span class="mp-n">${esc(mm.label)}</span>`+
        (mm.coloreVerificato?"":`<span class="mp-unv" title="${esc(t("colUnverified"))}"></span>`)+
        `<span class="mp-c">${esc(mm.codice||mm.sup||"—")}</span>`+
        `<span class="mp-th">${fmtMm(mm.th)}</span></button>`;
    }).join("");
  }
  $("matPickList").innerHTML=html||`<div class="mp-none">${esc(t("matPickNone"))}</div>`;
  $("matPickTh").querySelectorAll("[data-th]").forEach(b=>b.addEventListener("click",()=>{
    MP.th=b.dataset.th?+b.dataset.th:null; renderMatPick(); }));
  $("matPickList").querySelectorAll("[data-pick]").forEach(b=>b.addEventListener("click",()=>{
    const id=b.dataset.pick||"";
    MP.sel.value=id;
    /* il `change` e quello di sempre: tutto quello che gia ascoltava il
       <select> — l\'anteprima, la grossezza, il ricalcolo — parte da solo. */
    MP.sel.dispatchEvent(new Event("change",{bubbles:true}));
    if(MP.onPick) MP.onPick(id);
    paintMatPicks(); closeSheets();
  }));
}
/* I ruoli che si possono vestire a parte. Il fianco NON c\'e: e la
   struttura, e la sceglie il selettore «Corpo» qui sopra. Gli altri
   ereditano da lui finche non li si tocca. */
const MAT_ROLE_UI=[["base","matRoleBase"],["cielo","matRoleCielo"],
  ["ripiano","matRoleRipiano"],["divisorio","matRoleDivisorio"],["zoccolo","matRoleZoccolo"]];
function renderMatRoles(){
  const wrap=$("matRoleWrap"); if(!wrap) return;
  const per=(buildCfg&&buildCfg.mat)||{};
  wrap.innerHTML=MAT_ROLE_UI.map(([role,key])=>
    `<div class="f"><label>${esc(t(key))}</label>`+
    `<button type="button" class="matpick" data-role="${role}"></button>`+
    `<select id="bMatRole_${role}" hidden></select></div>`).join("");
  for(const [role] of MAT_ROLE_UI){
    const sel=$("bMatRole_"+role);
    sel.innerHTML=`<option value=""></option>`+matVisible()
      .map(m=>`<option value="${m.id}">${esc(matById(m.id).label)}</option>`).join("");
    sel.value=per[role]||"";
  }
  wrap.querySelectorAll(".matpick[data-role]").forEach(b=>{
    const role=b.dataset.role, sel=$("bMatRole_"+role);
    b.dataset.for="bMatRole_"+role;
    b.innerHTML=matPickLabel(sel.value||null);
    b.addEventListener("click",()=>matPickOpen("bMatRole_"+role,{
      allowInherit:true, minTh:1, title:t(MAT_ROLE_UI.find(r=>r[0]===role)[1]),
      onPick:id=>{
        buildCfg.mat=Object.assign({},buildCfg.mat||{});
        if(id) buildCfg.mat[role]=id; else delete buildCfg.mat[role];
        b.innerHTML=matPickLabel(id||null);
        drawPreview(); renderMatRolesSummary();
      }}));
  });
  renderMatRolesSummary();
}
function renderMatRolesSummary(){
  const el=$("sumMatRoles"); if(!el) return;
  const per=(buildCfg&&buildCfg.mat)||{};
  const n=Object.keys(per).filter(k=>per[k]).length;
  el.textContent=n?t("matRolesN").replace("{n}",n):t("matInherit");
}
function renderBuild(){
  fillMatSelects();
  if(!buildFormReady){
    syncBuildForm();
    ["bName","bTipo","bL","bL2","bH","bP","bAngL","bAngR","bMatBody","bMatFront","bMatBack","bPlinth","bTram","bShelves","bDrawers","bDoors","bBack","bHang","bFront","bSupport","bHandles","bShelfT","bBoxes","bCorner","bCornerKind","bHangGap","bShelfEven","bShelfStep","bBow","bRc",
     "bDrawSys","bDrawDist","bDrawFH","bDrawZone","bDrawH","bDrawInset","bDrawPos"]
      .forEach(id=>{ $(id).addEventListener("input",drawPreview); $(id).addEventListener("change",drawPreview); });
    /* il pannello cassetti si ridisegna prima dell'anteprima: cambiando sistema
       cambiano le opzioni, e un campo che non esiste piu non deve restare a
       schermo con dentro un valore che il motore non guarda. */
    /* i tre selettori principali passano per il cercatore; il <select>
       nascosto resta la sorgente del valore e degli eventi */
    [["pickBody","bMatBody",12,"matBody"],["pickFront","bMatFront",3,"matFront"],
     ["pickBack","bMatBack",0,"matBack"]].forEach(([btn,sel,minTh,key])=>{
      const b=$(btn); if(!b) return;
      b.addEventListener("click",()=>matPickOpen(sel,{minTh,title:t(key)}));
    });
    $("matPickQ").addEventListener("input",()=>{ MP.q=$("matPickQ").value; renderMatPick(); });
    ["bMatBody","bMatFront","bMatBack"].forEach(id=>
      $(id).addEventListener("change",()=>{ paintMatPicks(); renderMatRoles(); }));
    ["bDrawSys","bDrawDist","bDrawers","bDoors","bDrawPos"].forEach(id=>
      $(id).addEventListener("change",()=>renderDrawUI($("bDrawSys").value,$("bDrawH").value)));
    $("bDrawers").addEventListener("input",()=>renderDrawUI($("bDrawSys").value,$("bDrawH").value));
    $("bTipo").addEventListener("change",()=>{
      $("rowRc").style.display=($("bTipo").value==="raccordato")?"":"none";
      if($("bTipo").value==="raccordato"&&!$("bRc").value) $("bRc").value=80;
    });
    $("bFront").addEventListener("change",()=>{
      $("rowBow").style.display=($("bFront").value==="curvo")?"":"none";
      if($("bFront").value==="curvo"&&!$("bBow").value) $("bBow").value=40;
      drawPreview();
    });
    $("btnExplode").addEventListener("click",()=>{
      explodeOn=explodeOn?0:1;
      $("btnExplode").classList.toggle("on",!!explodeOn);
      drawPreview();
    });
    /* l'anteprima sta appiccicata in alto ed e piccola per lasciare spazio ai campi:
       questo la ingrandisce quando vuoi guardarla davvero */
    $("btnPrevBig").addEventListener("click",()=>{
      const s=$("svg3d"), big=s.style.maxHeight==="60vh";
      s.style.maxHeight=big?"17vh":"60vh";
      const cv=$("gl3d"); if(cv){ cv.style.height=big?"17vh":"60vh";
        if(gl3dOn()) window.GL3D.resize(); }
      $("btnPrevBig").classList.toggle("on",!big);
      $("btnPrevBig").textContent=big?"⤢":"⤡";
    });
    init3DControls();
    buildFormReady=true;
  }
  renderPresetChips();
  drawPreview();
}

/* ================= TIPI PROPRI =================
   I quindici tipi di serie sono punti di partenza, non un recinto: quello che
   il motore sa costruire e molto piu di quindici combinazioni, ma finora una
   configurazione trovata a mano (o dettata all'AI) si perdeva alla chip
   successiva. Un tipo proprio e esattamente la stessa cosa di uno di serie —
   un cfg con un nome — quindi vive accanto a loro e non in una lista a parte.
   Sta in `settings`, cosi il backup e la sincronizzazione se lo portano dietro
   senza codice in piu. */
function presetUser(){ const a=(state.settings||{}).presetAdd; return Array.isArray(a)?a:[]; }
function presetAll(){
  const out=Object.keys(PRESETS).map(k=>({k,name:t("preset_"+k),cfg:PRESETS[k],user:0}));
  presetUser().forEach(p=>out.push({k:p.id,name:p.name,cfg:p.cfg,user:1}));
  return out;
}
function presetApply(p){
  buildObst=[]; buildSecMode=p.cfg.secMode||null;
  buildCfg={...p.cfg,name:p.name};
  syncBuildForm(); drawPreview();
}
function renderPresetChips(){
  const chips=$("presetChips"); if(!chips) return;
  chips.innerHTML="";
  for(const p of presetAll()){
    const c=document.createElement("button");
    c.className="chip"+(p.user?" chip-user":""); c.dataset.k=p.k;
    c.textContent=p.name;
    c.addEventListener("click",()=>{ presetApply(p);
      chips.querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x===c)); });
    if(p.user){
      /* la X solo sui tipi propri: quelli di serie non si cancellano, e un
         tipo salvato per sbaglio non deve costringere a svuotare le impostazioni */
      const del=document.createElement("span");
      del.className="chip-x"; del.textContent="×"; del.title=t("presetDel");
      del.addEventListener("click",async ev=>{
        ev.stopPropagation();
        if(!await confirmDlg(t("presetDelAsk").replace("{n}",p.name))) return;
        state.settings.presetAdd=presetUser().filter(x=>x.id!==p.k);
        persist(); renderPresetChips(); haptic(); toast(t("presetGone"));
      });
      c.appendChild(del);
    }
    chips.appendChild(c);
  }
  const add=document.createElement("button");
  add.className="chip chip-add"; add.textContent="+ "+t("presetNew");
  add.addEventListener("click",presetSaveCurrent);
  chips.appendChild(add);
}
async function presetSaveCurrent(){
  const cfg=cfgFromForm();
  const suggested=cfg.name||"";
  const name=(await promptDlg(t("presetName"),suggested)||"").trim();
  if(!name) return;
  /* gli ostacoli sono del cantiere, non del tipo: un decupaj per la presa di
     QUESTA stanza non ha senso in un tipo che riuserai altrove */
  const keep={...cfg}; delete keep.obstacles; keep.name=name;
  const list=presetUser();
  const dup=list.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(dup){
    if(!await confirmDlg(t("presetOver").replace("{n}",name))) return;
    dup.cfg=keep;
  } else list.push({id:"u_"+uid(),name,cfg:keep});
  state.settings.presetAdd=list;
  persist(); renderPresetChips(); haptic(); toast(t("presetSaved").replace("{n}",name));
}
function openBuilder(mod){
  const p=proj();
  if(p&&p.configs&&p.configs[mod]){ buildCfg={...p.configs[mod],name:mod}; if(buildFormReady)syncBuildForm(); }
  setView("build");
}
/* La traducerea cfg → rânduri de distinta, scoasă din handler ca să o
   poată chema și modul atelier, care generează corpul implicit la
   deschiderea linkului. O singură cale: dacă s-ar dubla, corpul de
   pornire ar putea ajunge cu alt material decât cel din generator. */
function generateInto(p,cfg){
  const {pieces}=buildModule(cfg);
  const mB=matById(cfg.matBody), mF=matById(cfg.matFront), mK=matById(cfg.matBack);
  /* il materiale di struttura c'e sempre: `carcassMaterials` si ferma prima
     se manca. Il vecchio ripiego «se lo spessore e 25 allora e il bianco da
     25, altrimenti quello da 18» inventava un materiale dallo spessore. */
  const defMat=mB?mB.label:"";
  const frontMat=mF?mF.label:defMat, backMat=mK?mK.label:(defMat||"");
  const isFront=isFrontEl;
  /* l'etichetta del materiale di un pezzo, dal suo RUOLO */
  const labelFor=x=>{
    const id=matForRole(cfg,x.role,x.elemento);
    const m=id?matById(id):null;
    if(m) return m.label;
    return isFront(x.elemento)?frontMat:/^schienale/i.test(x.elemento)?backMat:defMat;
  };
  /* L'IMPRONTA DEI MATERIALI, al momento in cui la distinta e stata emessa.
     Se domani cambia un materiale, una grossezza o il catalogo, l'impronta
     non torna e la distinta risulta non piu allineata: il cancello di
     esportazione la ferma invece di mandare a debitare cote vecchie. */
  const stamp=matStamp(cfg);
  const rows=pieces.map(x=>({id:uid(),gen:cfg.name,
    modulo:x.wing?`${cfg.name} ${x.wing}`:cfg.name,
    elemento:x.elemento,lung:x.lung,larg:x.larg,pz:x.pz,bordo:x.bordo,
    /* ruolo, assi E GROSSEZZA viaggiano CON la riga salvata: il controllo di
       chiusura gira sul progetto, non sull'oggetto appena uscito dal
       generatore. Senza `sp` qui, il controllo leggeva zero come grossezza
       della base e del cielo e dichiarava rotto ogni corpo sano — e, peggio,
       avrebbe potuto dichiarare sano un corpo rotto.
       `seg` dice che la riga e un troncone, e va risommata con i suoi. */
    role:x.role||null, axis_mapping:x.axis_mapping||null,
    sp:(x.sp!=null?x.sp:null), spSrc:x.spSrc||null, seg:x.seg||null, ys:x.ys||null,
    angL:x.angL,angR:x.angR,joint:x.joint,scasso:x.scasso||null,
    curve:x.curve||null,
    materiale:x.mat||labelFor(x)}));
  p.pieces=p.pieces.filter(q=>q.gen!==cfg.name&&q.modulo!==cfg.name).concat(rows);
  p.configs=p.configs||{}; p.configs[cfg.name]=Object.assign({},cfg,{matStamp:stamp});
  return {pieces,rows};
}
$("btnGenerate").addEventListener("click",()=>{
  const p=proj(); if(!p){toast(t("selectProject"));setView("projects");return;}
  const cfg=cfgFromForm();
  if(!cfg.name){$("bName").focus();return;}
  /* niente materiale = niente distinta. Meglio nessuna riga che righe
     calcolate su una grossezza che nessuno ha scelto. */
  let gen;
  try{ gen=generateInto(p,cfg); }
  catch(e){ toast(e&&e.message||String(e)); return; }
  const {pieces,rows}=gen;
  persist(); setView("list");
  /* le regole girano a OGNI generazione, prima di qualunque esportazione */
  auditBadge();
  const bad=blocking(auditModule(cfg,pieces));
  if(bad.length){ auditSheet(bad.map(a=>({...a,modulo:cfg.name}))); return; }
  toast(`${cfg.name}: ${rows.reduce((s,x)=>s+x.pz,0)} ${t("pieces")}`);
});

/* La riga di tracciabilita, stampata su ogni documento che porta delle cote.
   Da qui si risale a COME e stata calcolata quella distinta: con quale
   versione dell'app, con quale motore geometrico, e con quale set di regole.
   Senza, una distinta stampata e un foglio senza padre: se domani salta fuori
   un'altra cota sbagliata, non si sa nemmeno da che motore e uscita. */
function prTrace(p){
  const gv=(p&&p.geomVersion)||1;
  const h=(typeof assertionsHash==="function")?assertionsHash():"—";
  return `<div class="pr-trace">Ebanist v${esc(APP_VER)} · ${esc(t("prGeom"))} v${gv} · ${esc(t("prRules"))} ${esc(h)}</div>`;
}

