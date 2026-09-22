"use strict";
/* ===========================================================================
   Ebanist — app/js/survey.js

   Il rilievo in cantiere e la pianta della camera: moduli posati,
   collisioni fra poligoni convessi (SAT) e la manipolazione diretta —
   selezione, trascinamento e quote, stile SketchUp.
   =========================================================================== */
/* ================= RILIEVO (Faza 2A) =================
   Introducere manuală a cotelor, offline. Conturul se reconstruiește din
   lungimi + unghiuri reale de colț (nu se presupune 90°). */
const OBST_TYPES=["presa","interr","tubo","calorifero","vano","trave","altro"];
function obstLabel(k){ return ts("t"+k.charAt(0).toUpperCase()+k.slice(1)); }

function survey(){
  const p=proj(); if(!p) return null;
  if(!p.survey) p.survey={walls:[],heights:[null,null,null],obstacles:[]};
  if(!p.survey.heights) p.survey.heights=[null,null,null];
  return p.survey;
}

function planPoints(walls){
  const pts=[{x:0,y:0}]; let heading=0;
  for(const w of walls){
    const L=+w.len||0;
    const last=pts[pts.length-1];
    pts.push({x:last.x+L*Math.cos(heading), y:last.y+L*Math.sin(heading)});
    heading += Math.PI - (+w.angle||90)*Math.PI/180;
  }
  return pts;
}

/* ================= MOBILIER IN CAMERA (pianta + collisioni) =================
   Ogni modulo si appoggia a una parete, a X mm dall'angolo. Il resto —
   orientamento, apertura delle ante, urti — si ricava dalla geometria. */
function layout(){ const p=proj(); if(!p) return null; if(!p.layout) p.layout={}; return p.layout; }

/* sistema di riferimento della parete i: origine, direzione, normale VERSO L'INTERNO */
function wallFrames(walls){
  const pts=planPoints(walls), c={x:0,y:0};
  pts.forEach(q=>{c.x+=q.x/pts.length; c.y+=q.y/pts.length;});
  return walls.map((w,i)=>{
    const a=pts[i], b=pts[i+1], L=Math.hypot(b.x-a.x,b.y-a.y)||1;
    const d={x:(b.x-a.x)/L,y:(b.y-a.y)/L};
    let n={x:-d.y,y:d.x};
    const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if((c.x-m.x)*n.x+(c.y-m.y)*n.y<0) n={x:d.y,y:-d.x};
    return {id:w.id,i,a,b,L,d,n};
  });
}
/* locale (x lungo la larghezza, z profondità, z=0 sul muro) -> coordinate stanza */
function toRoom(fr,from,x,z,off,rot,piv){
  let xx=x, zz=z;
  if(rot){ /* gira sul proprio centro: a +15° il corpo ruota sul posto, non scappa nel vicino */
    const px=piv?piv.x:0, pz=piv?piv.z:0;
    const r=rot*Math.PI/180, c=Math.cos(r), si=Math.sin(r);
    const dx=x-px, dz=z-pz;
    xx=px+dx*c-dz*si; zz=pz+dx*si+dz*c; }
  zz+=(off||0);
  return {x:fr.a.x+fr.d.x*(from+xx)+fr.n.x*zz, y:fr.a.y+fr.d.y*(from+xx)+fr.n.y*zz};
}
/* dalla stanza al sistema della parete: quanto lungo il muro, quanto staccato */
function fromRoom(fr,pt){
  const vx=pt.x-fr.a.x, vy=pt.y-fr.a.y;
  return {along:vx*fr.d.x+vy*fr.d.y, off:vx*fr.n.x+vy*fr.n.y};
}
/* --- geometria di un modulo posato --- */
function placedModule(p,name,fr,pl){
  const cfg=p.configs&&p.configs[name]; if(!cfg||!fr) return null;
  let m; try{ m=buildModule(cfg); }catch(e){ return null; }
  const carc=m.boxes.filter(b=>b.kind==="p");
  if(!carc.length) return null;
  const pcAll=[].concat.apply([],carc.map(planPC));
  const x0=Math.min.apply(null,pcAll.map(q=>q[0])), x1=Math.max.apply(null,pcAll.map(q=>q[0]));
  const z0=Math.min.apply(null,pcAll.map(q=>q[1])), z1=Math.max.apply(null,pcAll.map(q=>q[1]));
  const from=+pl.from||0, off=+pl.off||0, lift=+pl.lift||0, rot=+pl.rot||0;
  const piv={x:(x0+x1)/2,z:(z0+z1)/2};
  const ys=[].concat.apply([],m.boxes.map(b=>[b.y0,b.y1]));
  const yLo=Math.min.apply(null,ys)+lift, yHi=Math.max.apply(null,ys)+lift;
  const foot=hull(pcAll.map(q=>toRoom(fr,from,q[0],q[1],off,rot,piv)));
  const fronts=m.boxes.filter(b=>b.kind==="f"&&b.sub);
  const swings=[];
  for(const b of fronts){
    const q=planPC(b), bx0=Math.min(q[0][0],q[1][0],q[2][0],q[3][0]), bx1=Math.max(q[0][0],q[1][0],q[2][0],q[3][0]);
    const bz=Math.max(q[0][1],q[1][1],q[2][1],q[3][1]);
    const w=bx1-bx0; if(w<50) continue;
    if(b.sub==="slide") continue;                       // scorre, non urta
    if(b.sub==="drawerIn") continue;                    // sta dietro l'anta: urta l'anta, non la stanza
    if(b.sub==="drawer"){
      const d=Math.max(250,Math.min(600,(cfg.P||500)-30));
      swings.push({kind:"drawer",yLo:b.y0+lift,yHi:b.y1+lift,
        poly:[[bx0,bz],[bx1,bz],[bx1,bz+d],[bx0,bz+d]].map(t=>toRoom(fr,from,t[0],t[1],off,rot,piv))});
      continue;
    }
    const left = (bx0+bx1)/2 < (x0+x1)/2;               // cerniere sul lato più vicino al fianco
    const hx = left?bx0:bx1, sgn = left?1:-1;
    const arc=[[hx,bz]];
    for(let a=0;a<=90;a+=15){ const r=a*Math.PI/180;
      arc.push([hx+sgn*w*Math.cos(r), bz+w*Math.sin(r)]); }
    swings.push({kind:"door",w:Math.round(w),yLo:b.y0+lift,yHi:b.y1+lift,
      poly:arc.map(t=>toRoom(fr,from,t[0],t[1],off,rot,piv)),
      leaf:[[hx,bz],[hx+sgn*w*Math.cos(Math.PI/2),bz+w]].map(t=>toRoom(fr,from,t[0],t[1],off,rot,piv))});
  }
  return {name,cfg,fr,from,off,lift,rot,piv,yLo,yHi,w:x1-x0,d:z1-z0,x0,x1,z0,z1,foot,swings};
}
/* --- test di sovrapposizione fra poligoni convessi (SAT) --- */
/* inviluppo convesso (Andrew): la sagoma reale di un corpo trapezoidale, non il rettangolo
   che lo contiene — altrimenti un angolo tagliato segnala urti che non ci sono. */
function hull(pts){
  if(pts.length<4) return pts.slice();
  const P=pts.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const EPS=1;   // mm² — scarta i punti quasi allineati, altrimenti un rettangolo ruotato dà 7 spigoli
  const lo=[],up=[];
  for(const q of P){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=EPS) lo.pop(); lo.push(q); }
  for(let i=P.length-1;i>=0;i--){ const q=P[i];
    while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=EPS) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  const h=lo.concat(up);
  return h.length>=3?h:pts.slice();
}
function polyHit(A,B){
  for(const poly of [A,B]){
    for(let i=0;i<poly.length;i++){
      const a=poly[i], b=poly[(i+1)%poly.length];
      const ax=-(b.y-a.y), ay=(b.x-a.x);
      let m1=Infinity,M1=-Infinity,m2=Infinity,M2=-Infinity;
      A.forEach(q=>{const v=q.x*ax+q.y*ay; m1=Math.min(m1,v); M1=Math.max(M1,v);});
      B.forEach(q=>{const v=q.x*ax+q.y*ay; m2=Math.min(m2,v); M2=Math.max(M2,v);});
      if(M1<m2+1||M2<m1+1) return false;                // 1 mm di tolleranza
    }
  }
  return true;
}
function segHitPoly(a,b,poly){
  const cross=(o,p,q)=>(p.x-o.x)*(q.y-o.y)-(p.y-o.y)*(q.x-o.x);
  for(let i=0;i<poly.length;i++){
    const c=poly[i], d=poly[(i+1)%poly.length];
    const d1=cross(a,b,c), d2=cross(a,b,d), d3=cross(c,d,a), d4=cross(c,d,b);
    if(((d1>0)!==(d2>0))&&((d3>0)!==(d4>0))) return true;
  }
  return false;
}
/* --- tutto il progetto: moduli posati + problemi trovati --- */
function roomLayout(){
  const p=proj(); if(!p) return null;
  const sv=p.survey; if(!sv||!sv.walls||!sv.walls.length) return null;
  const frames=wallFrames(sv.walls), lay=layout();
  const mods=[];
  for(const name in lay){
    const fr=frames.find(f=>f.id===lay[name].wall);
    const pm=placedModule(p,name,fr,lay[name]);
    if(pm) mods.push(pm);
  }
  const issues=[];
  mods.forEach(m=>{
    if(m.from<-1) issues.push({t:"before",a:m.name});
    if(!m.rot && m.from+m.w>m.fr.L+1) issues.push({t:"over",a:m.name,mm:Math.round(m.from+m.w-m.fr.L)});
  });
  /* due corpi si toccano solo se si sovrappongono ANCHE in altezza:
     un pensile a 1400 non urta il piano di lavoro sotto. */
  const vOver=(a,b)=>Math.min(a.yHi,b.yHi)-Math.max(a.yLo,b.yLo)>1;
  for(let i=0;i<mods.length;i++) for(let j=i+1;j<mods.length;j++)
    if(vOver(mods[i],mods[j])&&polyHit(mods[i].foot,mods[j].foot)) issues.push({t:"hit",a:mods[i].name,b:mods[j].name});
  mods.forEach(m=>m.swings.forEach(sw=>{
    mods.forEach(o=>{ if(o!==m && vOver(sw,o) && polyHit(sw.poly,o.foot)) issues.push({t:sw.kind==="door"?"door":"drawer",a:m.name,b:o.name}); });
    frames.forEach(f=>{ if(f!==m.fr && segHitPoly(f.a,f.b,sw.poly)) issues.push({t:sw.kind==="door"?"doorWall":"drawerWall",a:m.name,b:String(f.i+1)}); });
  }));
  const seen={}, uniq=issues.filter(x=>{const k=x.t+x.a+(x.b||"");if(seen[k])return false;seen[k]=1;return true;});
  return {frames,mods,issues:uniq};
}

/* camera intreaga in 3D: aceleasi cutii, mutate din coordonatele modulului in cele ale camerei */
let roomOpen=0;
function roomBoxes(){
  const RL=roomLayout(); if(!RL||!RL.mods.length) return null;
  const p=proj(), out=[];
  const put=(fr,from,off,lift,rot,piv,b)=>{
    const pc=planPC(b).map(q=>toRoom(fr,from,q[0],q[1],off,rot,piv));
    out.push({x0:Math.min.apply(null,pc.map(q=>q.x)),x1:Math.max.apply(null,pc.map(q=>q.x)),
              y0:b.y0+lift,y1:b.y1+lift,
              z0:Math.min.apply(null,pc.map(q=>q.y)),z1:Math.max.apply(null,pc.map(q=>q.y)),
              kind:b.kind, pc:pc.map(q=>[q.x,q.y])});
  };
  RL.mods.forEach(m=>{
    let mm; try{ mm=buildModule(m.cfg); }catch(e){ return; }
    const carc=mm.boxes.filter(b=>b.kind==="p");
    const pcAll=[].concat.apply([],carc.map(planPC));
    const cx0=Math.min.apply(null,pcAll.map(q=>q[0])), cx1=Math.max.apply(null,pcAll.map(q=>q[0]));
    mm.boxes.forEach(b=>{
      if(roomOpen && b.kind==="f" && b.sub==="door"){
        const q=planPC(b);
        const bx0=Math.min(q[0][0],q[1][0],q[2][0],q[3][0]), bx1=Math.max(q[0][0],q[1][0],q[2][0],q[3][0]);
        const bz=Math.max(q[0][1],q[1][1],q[2][1],q[3][1]);
        const w=bx1-bx0, left=(bx0+bx1)/2<(cx0+cx1)/2, hx=left?bx0:bx1, sgn=left?1:-1, th=b.z1-b.z0;
        const rotp=[[0,0],[0,w],[th,w],[th,0]].map(t=>[hx+sgn*t[0], bz+t[1]]);   // 90° deschisa
        const pc=rotp.map(t=>toRoom(m.fr,m.from,t[0],t[1],m.off,m.rot,m.piv));
        out.push({x0:Math.min.apply(null,pc.map(q=>q.x)),x1:Math.max.apply(null,pc.map(q=>q.x)),
                  y0:b.y0+m.lift,y1:b.y1+m.lift,
                  z0:Math.min.apply(null,pc.map(q=>q.y)),z1:Math.max.apply(null,pc.map(q=>q.y)),
                  kind:"f", pc:pc.map(q=>[q.x,q.y])});
        return;
      }
      put(m.fr,m.from,m.off,m.lift,m.rot,m.piv,b);
    });
  });
  // pareti veri, con altezza propria e colore diverso ("w")
  const sv=p&&p.survey, hs=(sv&&sv.heights||[]).filter(v=>v!=null&&isFinite(v));
  const wallH=Math.max(200,+((sv&&sv.wallH))||(hs.length?Math.min.apply(null,hs):2500));
  RL.frames.forEach(f=>{
    const th=80, pc=[[0,0],[f.L,0],[f.L,-th],[0,-th]].map(t=>toRoom(f,0,t[0],t[1]));
    out.push({x0:Math.min.apply(null,pc.map(q=>q.x)),x1:Math.max.apply(null,pc.map(q=>q.x)),
              y0:0,y1:wallH,z0:Math.min.apply(null,pc.map(q=>q.y)),z1:Math.max.apply(null,pc.map(q=>q.y)),
              kind:"w", pc:pc.map(q=>[q.x,q.y])});
  });
  return out;
}

/* ================= SELEZIONE, TRASCINAMENTO E QUOTE (stile SketchUp) ================= */
let selMod=null, dragState=null, moveStep=10, rotStep=15, snapGuides=[];
function selectMod(n){ selMod=n; renderPlan(); }
/* aggancio: bordi degli altri corpi, estremi della parete, filo muro */
function snapAlong(v,cands,tol){
  let best=v, bd=tol;
  cands.forEach(c=>{ const d=Math.abs(v-c); if(d<bd){bd=d;best=c;} });
  return {v:best,hit:bd<tol};
}
function dragTargets(RL,me){
  const along=[0], off=[0];
  if(me&&me.fr) along.push(me.fr.L, me.fr.L-me.w);
  RL.mods.forEach(o=>{ if(!me||o.name===me.name||o.fr.id!==me.fr.id) return;
    along.push(o.from+o.w, o.from-(me?me.w:0), o.from);
    off.push(o.off, o.off+o.d);
  });
  return {along:along.filter(v=>isFinite(v)),off:off.filter(v=>isFinite(v))};
}
function planPointToRoom(el,ev){
  const m=el.getScreenCTM(); if(!m) return null;
  const pt=el.ownerSVGElement?null:null;
  const inv=m.inverse();
  const p=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(inv);
  return {x:p.x,y:p.y};
}
function wirePlanDrag(){
  const el=$("svgPlan"); if(!el||el.dataset.drag) return; el.dataset.drag="1";
  el.style.touchAction="none";
  el.addEventListener("pointerdown",e=>{
    const RL=roomLayout(); if(!RL) return;
    const pt=planPointToRoom(el,e); if(!pt) return;
    const hit=RL.mods.slice().reverse().find(m=>polyHit(m.foot,[
      {x:pt.x-1,y:pt.y-1},{x:pt.x+1,y:pt.y-1},{x:pt.x+1,y:pt.y+1},{x:pt.x-1,y:pt.y+1}]));
    if(!hit){ if(selMod){ selMod=null; renderPlan(); } return; }
    selMod=hit.name;
    const L=layout()[hit.name];
    dragState={name:hit.name,startFrom:+L.from||0,startOff:+L.off||0,origin:pt,moved:false};
    el.setPointerCapture(e.pointerId);
    renderPlan();
  });
  el.addEventListener("pointermove",e=>{
    if(!dragState) return;
    const pt=planPointToRoom(el,e); if(!pt) return;
    const RL=roomLayout(); const me=RL&&RL.mods.find(m=>m.name===dragState.name); if(!me) return;
    const o=fromRoom(me.fr,dragState.origin), n=fromRoom(me.fr,pt);
    if(Math.hypot(pt.x-dragState.origin.x,pt.y-dragState.origin.y)>12) dragState.moved=true;
    const tg=dragTargets(RL,me), tol=Math.max(15,me.fr.L/60);
    const a=snapAlong(dragState.startFrom+(n.along-o.along),tg.along,tol);
    const b=snapAlong(dragState.startOff +(n.off  -o.off  ),tg.off  ,tol);
    const L=layout()[dragState.name];
    L.from=Math.round(a.v); L.off=Math.max(0,Math.round(b.v));
    snapGuides=[]; if(a.hit) snapGuides.push("along"); if(b.hit) snapGuides.push("off");
    /* Lo stato si aggiorna subito — l'evento dopo lo rilegge — ma il
       DISEGNO va una volta per fotogramma e la SCRITTURA aspetta che il
       dito si fermi. Prima erano tutti e due a ogni evento: con dodici
       commesse aperte voleva dire riscrivere 130 KB in localStorage, in
       modo sincrono, cento volte al secondo, mentre si trascina. */
    planPersistSoon(); planPaint();
  });
  const up=e=>{ if(!dragState) return; dragState=null; snapGuides=[];
    planPersistSoon.flush();   // chi molla il dito non aspetta il freno
    renderPlan(); };
  el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
}
/* pannello del corpo selezionato: tre assi, frecce e casella per la quota esatta */
function renderSelBar(){
  const bar=$("svSelBar"); if(!bar) return;
  const p=proj(), L=p?layout():null;
  if(!selMod||!L||!L[selMod]){ bar.style.display="none"; return; }
  bar.style.display="";
  const pl=L[selMod];
  const RL=roomLayout(), me=RL&&RL.mods.find(m=>m.name===selMod);
  const rows=[["X","from",ts("svAxisX")],["Y","off",ts("svAxisY")],["Z","lift",ts("svAxisZ")],["R","rot",ts("svAxisR")]];
  bar.innerHTML=`<div class="sel-head"><b>${esc(selMod)}</b>${me?`<span class="mini">${Math.round(me.w)}×${Math.round(me.d)}×${Math.round(me.yHi-me.yLo)}</span>`:""}</div>`
    +rows.map(r=>`<div class="sel-row" data-k="${r[1]}">
        <span class="sel-ax ax-${r[0]}">${r[0]}</span><span class="sel-lbl">${esc(r[2])}</span>
        <button class="sel-btn" data-d="-1">−</button>
        <input class="sel-in" type="number" inputmode="numeric" value="${Math.round(+pl[r[1]]||0)}">
        <button class="sel-btn" data-d="1">+</button></div>`).join("")
    +`<div class="sel-steps">${[1,10,100].map(v=>`<button class="chip sm${v===moveStep?" on":""}" data-s="${v}">${v} mm</button>`).join("")}`
    +`${[1,15,45].map(v=>`<button class="chip sm${v===rotStep?" on":""}" data-r="${v}">${v}°</button>`).join("")}</div>`;
  bar.querySelectorAll(".sel-row").forEach(row=>{
    const k=row.dataset.k, inp=row.querySelector(".sel-in");
    const stepFor=()=>k==="rot"?rotStep:moveStep;
    const clamp=v=>k==="from"?Math.round(v):k==="rot"?((Math.round(v)%360)+360)%360:Math.max(0,Math.round(v));
    row.querySelectorAll(".sel-btn").forEach(b=>b.addEventListener("click",()=>{
      pl[k]=clamp((+pl[k]||0)+(+b.dataset.d)*stepFor());
      persist(); renderPlan();
    }));
    inp.addEventListener("input",()=>{
      const v=parseInt(inp.value,10);
      if(!isFinite(v)) return;
      pl[k]=k==="from"?v:clamp(v);
      persist(); renderPlan();
    });
  });
  bar.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click",()=>{
    moveStep=+b.dataset.s; renderSelBar();
  }));
  bar.querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click",()=>{
    rotStep=+b.dataset.r; renderSelBar();
  }));
}

/* Un disegno per fotogramma e una scrittura quando il dito si ferma.
   Si costruiscono qui, una volta sola: crearli dentro il gestore darebbe
   un freno nuovo a ogni evento, cioe nessun freno. */
const planPaint = rafCoalesce(() => renderPlan());
const planPersistSoon = debounce(() => persist(), 250);
function renderPlan(){
  const sv=survey(); const el=$("svgPlan"); if(!el) return;
  const walls=sv?sv.walls:[];
  $("svPlanCard").style.display=walls.length?"":"none";
  if(!walls.length){ el.innerHTML=""; $("svPlanInfo").textContent=""; return; }
  const pts=planPoints(walls);
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  // viewBox pătrat: păstrează proporțiile textului constante și când conturul e foarte alungit
  const side=Math.max(maxX-minX,maxY-minY)*1.3+600;
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  el.setAttribute("viewBox",`${cx-side/2} ${cy-side/2} ${side} ${side}`);
  const u=side/100;
  let out="";
  for(let i=0;i<walls.length;i++){
    const a=pts[i], b=pts[i+1];
    out+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#5f9412" stroke-width="${u*0.9}" stroke-linecap="round"/>`;
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    out+=`<text x="${mx}" y="${my-u*2}" font-size="${u*4.4}" text-anchor="middle" fill="#4b5563">${walls[i].len||0}</text>`;
    out+=`<text x="${mx}" y="${my+u*5.4}" font-size="${u*3.2}" text-anchor="middle" fill="#9ca3af">${ts("svWall")} ${i+1}</text>`;
  }
  for(let i=0;i<pts.length-1;i++){
    const ang=+walls[i>0?i-1:walls.length-1].angle||90;
    const off=Math.abs(ang-90)>0.5;
    out+=`<circle cx="${pts[i].x}" cy="${pts[i].y}" r="${u*1.4}" fill="${off?"#d97706":"#5f9412"}"/>`;
  }
  const first=pts[0], last=pts[pts.length-1];
  const gap=Math.hypot(last.x-first.x,last.y-first.y);
  if(gap>50) out+=`<line x1="${last.x}" y1="${last.y}" x2="${first.x}" y2="${first.y}" stroke="#d97706" stroke-width="${u*0.6}" stroke-dasharray="${u*3} ${u*2.4}"/>`;
  /* mobilierul asezat peste contur */
  const RL=roomLayout();
  if(RL){
    const bad={};
    RL.issues.forEach(x=>{ bad[x.a]=1; if(x.b) bad[x.b]=1; });
    const P2=q=>q.map(t=>t.x.toFixed(0)+","+t.y.toFixed(0)).join(" ");
    RL.mods.forEach(m=>{
      m.swings.forEach(sw=>{
        const dash=sw.kind==="drawer"?`stroke-dasharray="${u*2} ${u*1.6}"`:"";
        out+=`<polygon points="${P2(sw.poly)}" fill="rgba(212,175,55,.16)" stroke="#b08d1f" stroke-width="${u*0.35}" ${dash}/>`;
        if(sw.leaf) out+=`<line x1="${sw.leaf[0].x}" y1="${sw.leaf[0].y}" x2="${sw.leaf[1].x}" y2="${sw.leaf[1].y}" stroke="#b08d1f" stroke-width="${u*0.6}"/>`;
      });
    });
    /* prima quelli a terra, poi i sospesi: sopra e tratteggiati, così si distinguono */
    RL.mods.slice().sort((a2,b2)=>(a2.lift||0)-(b2.lift||0)).forEach(m=>{
      const hit=!!bad[m.name], sel=m.name===selMod, up=m.lift>0;
      const dash=up?` stroke-dasharray="${u*2.2} ${u*1.6}"`:"";
      out+=`<polygon points="${P2(m.foot)}" fill="${hit?"rgba(217,70,70,.30)":sel?"rgba(212,175,55,.30)":up?"rgba(95,148,18,.10)":"rgba(95,148,18,.22)"}" stroke="${hit?"#b3261e":sel?"#b08d1f":"#3e6b0a"}" stroke-width="${u*(sel?1.2:0.7)}"${dash}/>`;
      /* baricentro sul NUMERO REALE di spigoli: il contorno di un corpo tondo
         ne ha 48, non 4. Dividendo per 4 l'etichetta finiva a nove metri dal
         mobile, fuori dalla pianta. */
      const c={x:0,y:0}, nf=m.foot.length||1; m.foot.forEach(q=>{c.x+=q.x/nf;c.y+=q.y/nf;});
      out+=`<text x="${c.x}" y="${c.y}" font-size="${u*3.4}" text-anchor="middle" dominant-baseline="middle" fill="#1d221b">${esc(m.name.slice(0,14))}</text>`;
      if(m.lift>0) out+=`<text x="${c.x}" y="${c.y+u*4}" font-size="${u*2.8}" text-anchor="middle" fill="#7a5c00">↑${Math.round(m.lift)}</text>`;
      if(sel){
        /* quote vive: dall'angolo e dal muro, come la casella valori di SketchUp */
        const p0=toRoom(m.fr,0,0,0,0), p1=toRoom(m.fr,m.from,0,0,0);
        out+=`<line x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" stroke="#b08d1f" stroke-width="${u*0.5}" stroke-dasharray="${u*2} ${u*1.5}"/>`;
        const mid={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
        out+=`<text x="${mid.x}" y="${mid.y-u*1.6}" font-size="${u*3.4}" text-anchor="middle" fill="#7a5c00" font-weight="700">${Math.round(m.from)}</text>`;
        if(m.off>0.5){
          const q0=toRoom(m.fr,m.from+m.w/2,0,0,0), q1=toRoom(m.fr,m.from+m.w/2,0,0,m.off);
          out+=`<line x1="${q0.x}" y1="${q0.y}" x2="${q1.x}" y2="${q1.y}" stroke="#b08d1f" stroke-width="${u*0.5}" stroke-dasharray="${u*2} ${u*1.5}"/>`;
          out+=`<text x="${(q0.x+q1.x)/2+u*2}" y="${(q0.y+q1.y)/2}" font-size="${u*3.2}" fill="#7a5c00" font-weight="700">${Math.round(m.off)}</text>`;
        }
        if(snapGuides.length){
          out+=`<polygon points="${P2(m.foot)}" fill="none" stroke="#d94b4b" stroke-width="${u*0.5}" stroke-dasharray="${u*1.6} ${u*1.2}"/>`;
        }
      }
    });
  }
  el.innerHTML=out;
  const perim=walls.reduce((s,x)=>s+(+x.len||0),0);
  $("svPlanInfo").textContent=`${ts("svPerimeter")}: ${(perim/1000).toFixed(2)} m · ${gap>50?ts("svNotClosed"):ts("svClosed")}`;
  renderRoomList(RL);
  renderSelBar();
  wirePlanDrag();
}

/* lista de amplasare: fiecare modul pe ce perete si la ce cota, plus problemele */
function renderRoomList(RL){
  const box=$("svRoomList"); if(!box) return;
  if($("btnRoom3D")){ $("btnRoom3D").textContent=ts("svRoom3D"); $("btnRoomOpen").textContent=ts("svOpenDoors"); }
  $("svRoomLbl").textContent=ts("svRoomLbl"); $("svRoomHint").textContent=ts("svRoomHint")+" "+ts("svTapDrag");
  $("btnRoom3D").textContent=ts("svRoom3D"); $("btnRoomOpen").textContent=ts("svOpenDoors");
  const p=proj(); const sv=p&&p.survey;
  const names=p&&p.configs?Object.keys(p.configs):[];
  $("svRoomCard").style.display=(names.length&&sv&&sv.walls.length)?"":"none";
  if(!names.length||!sv||!sv.walls.length){ box.innerHTML=""; return; }
  const lay=layout();
  let h="";
  names.forEach(function(n){
    const pl=lay[n]||{wall:"",from:0};
    h+=`<div class="rm-row" data-n="${esc(n)}">
      <div class="rm-name">${esc(n)}</div>
      <select class="rm-wall"><option value="">—</option>${
        sv.walls.map((w,i)=>`<option value="${w.id}"${pl.wall===w.id?" selected":""}>${esc(ts("svWall"))} ${i+1}</option>`).join("")}</select>
      <input class="rm-from" type="number" inputmode="numeric" value="${pl.wall?Math.round(+pl.from||0):""}" placeholder="mm">
    </div>`;
  });
  const RL2=RL||roomLayout();
  if(RL2&&RL2.issues.length){
    h+=`<div class="nestwarn" style="margin-top:10px"><b>⚠ ${esc(ts("svIssues"))}</b><ul>`+
      RL2.issues.map(function(x){
        const k={before:"svIssBefore",over:"svIssOver",hit:"svIssHit",door:"svIssDoor",drawer:"svIssDrawer",doorWall:"svIssDoorWall",drawerWall:"svIssDrawerWall"}[x.t];
        return "<li>"+esc(ts(k).replace("{a}",x.a).replace("{b}",x.b||"").replace("{mm}",x.mm||""))+"</li>";
      }).join("")+`</ul></div>`;
  } else if(RL2&&RL2.mods.length){
    h+=`<p class="mini" style="margin-top:10px;color:var(--ok);font-weight:600">✓ ${esc(ts("svNoIssues"))}</p>`;
  }
  box.innerHTML=h;
  box.querySelectorAll(".rm-row").forEach(function(row){
    const n=row.dataset.n, L=layout();
    row.querySelector(".rm-name").addEventListener("click",function(){ if(L[n]) selectMod(n); });
    row.querySelector(".rm-wall").addEventListener("change",function(e){
      if(!e.target.value){ delete L[n]; } else { L[n]=L[n]||{from:0}; L[n].wall=e.target.value; }
      persist(); renderPlan();
    });
    row.querySelector(".rm-from").addEventListener("input",function(e){
      if(!L[n]) return; L[n].from=parseInt(e.target.value,10)||0; persist(); renderPlan();
    });
  });
}

function renderSurveyWalls(){
  const sv=survey(); const box=$("svWalls"); if(!box) return;
  box.innerHTML="";
  if(!sv||!sv.walls.length){ box.innerHTML=`<p class="mini" style="padding:10px 2px">${ts("svEmpty")}</p>`; return; }
  sv.walls.forEach((w,i)=>{
    const c=document.createElement("div");
    c.className="card"; c.style.padding="10px"; c.style.marginBottom="8px";
    c.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <b style="font-family:var(--font-disp);letter-spacing:.5px">${ts("svWall")} ${i+1}</b>
        <button class="iconbtn danger" data-del="${w.id}" aria-label="x">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
      <div class="f3">
        <div class="f"><label>${ts("svLen")}</label><input type="number" inputmode="numeric" data-k="len" data-id="${w.id}" value="${w.len!=null?w.len:""}"></div>
        <div class="f"><label>${ts("svAngle")}</label>
          <div style="display:flex;gap:6px"><input type="number" inputmode="decimal" step="0.5" data-k="angle" data-id="${w.id}" value="${w.angle!=null?w.angle:""}" style="min-width:0;flex:1">
          <button class="sel-btn" data-flip="${w.id}" title="${esc(ts("svFlipHint"))}" style="flex:none;width:40px">⟲</button></div></div>
        <div class="f"><label>${ts("svBow")}</label><input type="number" inputmode="numeric" data-k="bow" data-id="${w.id}" value="${w.bow!=null?w.bow:""}"></div>
      </div>`;
    box.appendChild(c);
  });
  box.querySelectorAll("input[data-k]").forEach(inp=>{
    inp.addEventListener("input",()=>{
      const sv2=survey(); const w=sv2.walls.find(x=>x.id===inp.dataset.id); if(!w) return;
      const v=parseFloat(inp.value);
      w[inp.dataset.k]=isFinite(v)?v:null;
      persist(); renderPlan();
    });
  });
  /* inverte il verso dello spigolo: 90 <-> 270. Con soli angoli sotto 180 il contorno
     gira sempre dalla stessa parte e una stanza a L non si chiude mai. */
  box.querySelectorAll("button[data-flip]").forEach(b=>{
    b.addEventListener("click",()=>{
      const sv2=survey(); const w=sv2.walls.find(x=>x.id===b.dataset.flip); if(!w) return;
      const a2=+w.angle; w.angle=isFinite(a2)?Math.round((360-a2)*10)/10:270;
      persist(); renderSurvey();
    });
  });
  box.querySelectorAll("button[data-del]").forEach(b=>{
    b.addEventListener("click",()=>{
      const sv2=survey();
      sv2.walls=sv2.walls.filter(x=>x.id!==b.dataset.del);
      sv2.obstacles.forEach(o=>{ if(o.wall===b.dataset.del) o.wall=null; });
      persist(); renderSurvey();
    });
  });
}

function renderSurveyObstacles(){
  const sv=survey(); const box=$("svObstacles"); if(!box) return;
  box.innerHTML="";
  if(!sv) return;
  const wallOpts=sv.walls.map((w,i)=>({id:w.id,label:`${ts("svWall")} ${i+1}`}));
  sv.obstacles.forEach(o=>{
    const c=document.createElement("div");
    c.className="card"; c.style.padding="10px"; c.style.marginBottom="8px";
    c.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <select data-k="type" data-id="${o.id}" style="flex:1;margin-right:8px">
          ${OBST_TYPES.map(tk=>`<option value="${tk}"${o.type===tk?" selected":""}>${obstLabel(tk)}</option>`).join("")}
        </select>
        <button class="iconbtn danger" data-del="${o.id}" aria-label="x">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
      <div class="f2">
        <div class="f"><label>${ts("svOnWall")}</label><select data-k="wall" data-id="${o.id}">
          <option value="">—</option>
          ${wallOpts.map(w=>`<option value="${w.id}"${o.wall===w.id?" selected":""}>${w.label}</option>`).join("")}
        </select></div>
        <div class="f"><label>${ts("svFromCorner")}</label><input type="number" inputmode="numeric" data-k="fromCorner" data-id="${o.id}" value="${o.fromCorner!=null?o.fromCorner:""}"></div>
      </div>
      <div class="f3">
        <div class="f"><label>${ts("svFromFloor")}</label><input type="number" inputmode="numeric" data-k="fromFloor" data-id="${o.id}" value="${o.fromFloor!=null?o.fromFloor:""}"></div>
        <div class="f"><label>${ts("svW")}</label><input type="number" inputmode="numeric" data-k="w" data-id="${o.id}" value="${o.w!=null?o.w:""}"></div>
        <div class="f"><label>${ts("svH")}</label><input type="number" inputmode="numeric" data-k="h" data-id="${o.id}" value="${o.h!=null?o.h:""}"></div>
      </div>`;
    box.appendChild(c);
  });
  box.querySelectorAll("[data-k]").forEach(inp=>{
    inp.addEventListener(inp.tagName==="SELECT"?"change":"input",()=>{
      const sv2=survey(); const o=sv2.obstacles.find(x=>x.id===inp.dataset.id); if(!o) return;
      const k=inp.dataset.k;
      if(k==="type"||k==="wall") o[k]=inp.value||null;
      else { const v=parseFloat(inp.value); o[k]=isFinite(v)?v:null; }
      persist();
    });
  });
  box.querySelectorAll("button[data-del]").forEach(b=>{
    b.addEventListener("click",()=>{
      const sv2=survey();
      sv2.obstacles=sv2.obstacles.filter(x=>x.id!==b.dataset.del);
      persist(); renderSurveyObstacles();
    });
  });
}

function renderSurveyHeights(){
  const sv=survey(); if(!sv) return;
  [0,1,2].forEach(i=>{
    const el=$("svH"+(i+1)); if(!el) return;
    if(document.activeElement!==el) el.value=sv.heights[i]!=null?sv.heights[i]:"";
    $("svH"+(i+1)+"Lbl").textContent=ts("svPoint")+" "+(i+1);
  });
  const vals=sv.heights.filter(x=>x!=null&&isFinite(x));
  const sum=$("svHeightSummary");
  if(!vals.length){ sum.innerHTML=`<span class="mini">—</span>`; return; }
  const min=Math.min(...vals), max=Math.max(...vals);
  const delta=max-min;
  sum.innerHTML=`<span class="mini">${ts("svMinH")}: <b>${min} mm</b>${vals.length>1?` · ${ts("svDelta")}: <b class="${delta>10?"danger":""}">${delta} mm</b>`:""}</span>`;
}

function renderSurvey(){
  const p=proj();
  $("svTitle").textContent=ts("svTitle");
  $("svSub").textContent=p?ts("svSub"):ts("svNoProject");
  $("svWallsLbl").textContent=ts("svWalls");
  $("svWallsHint").textContent=ts("svWallsHint");
  $("svAddWallLbl").textContent=ts("svAddWall");
  $("svHeightsLbl").textContent=ts("svHeights");
  $("svWallHLbl").textContent=ts("svWallH");
  { const sv3=survey(); if(sv3&&$("svWallH")!==document.activeElement) $("svWallH").value=sv3.wallH!=null?sv3.wallH:""; }
  $("svHeightsHint").textContent=ts("svHeightsHint");
  $("svObstLbl").textContent=ts("svObst");
  $("svAddObstLbl").textContent=ts("svAddObst");
  $("svExportLbl").textContent=ts("svExport");
  $("svApplyLbl").textContent=ts("svApply");
  $("svApplyHint").textContent=ts("svApplyHint");
  const navLbl=$("navSurveyLbl"); if(navLbl) navLbl.textContent=ts("navSurvey");
  if(!p) return;
  renderSurveyWalls(); renderSurveyHeights(); renderSurveyObstacles(); renderPlan();
}

$("btnSvAddWall").addEventListener("click",()=>{
  const sv=survey(); if(!sv){ toast(ts("svNoProject")); return; }
  sv.walls.push({id:uid(),len:null,angle:90,bow:null});
  persist(); renderSurvey();
});

$("btnSvAddObst").addEventListener("click",()=>{
  const sv=survey(); if(!sv){ toast(ts("svNoProject")); return; }
  sv.obstacles.push({id:uid(),type:"presa",wall:sv.walls.length?sv.walls[0].id:null,fromCorner:null,fromFloor:null,w:null,h:null});
  persist(); renderSurveyObstacles();
});

[1,2,3].forEach(i=>{
  $("svH"+i).addEventListener("input",()=>{
    const sv=survey(); if(!sv) return;
    const v=parseFloat($("svH"+i).value);
    sv.heights[i-1]=isFinite(v)?v:null;
    persist(); renderSurveyHeights();
  });
});

const SC_TYPES=["presa","interr","tubo","altro"];   // questi si risolvono con un decupaj nello schienale
$("svWallH").addEventListener("input",()=>{
  const sv2=survey(); if(!sv2) return;
  const v=parseInt($("svWallH").value,10);
  sv2.wallH=isFinite(v)&&v>0?v:null;
  persist(); if($("shRoom3D").classList.contains("open")) drawRoom3D();
});
$("btnRoomOpen").addEventListener("click",()=>{
  roomOpen=roomOpen?0:1;
  $("btnRoomOpen").classList.toggle("on",!!roomOpen);
  renderPlan();
  if($("shRoom3D").classList.contains("open")) drawRoom3D();
});
const ROOM_VIEW={yaw:0.62,pitch:0.62,zoom:1,free:true};
function drawRoom3D(){
  const bx=roomBoxes();
  const el=$("svgRoom3D");
  if(!bx||!bx.length){ el.innerHTML=""; $("room3dInfo").textContent=ts("svNoPlaced"); return; }
  render3D(el,{matBody:(state.settings||{}).matBody||"pal18_alb",matFront:(state.settings||{}).matFront||"pal18_alb"},ROOM_VIEW,{boxes:bx,real:true,solidFronts:true});
  const RL=roomLayout();
  $("room3dInfo").textContent=RL.mods.length+" "+ts("svModsPlaced")+(RL.issues.length?" · ⚠ "+RL.issues.length:"");
}
$("btnRoom3D").addEventListener("click",()=>{
  $("room3dTitle").textContent=ts("svRoom3D");
  closeSheets(); openSheet("shRoom3D"); drawRoom3D();
  const el=$("svgRoom3D"); if(el.dataset.wired) return; el.dataset.wired="1";
  let px=0,py=0,down=false;
  el.addEventListener("pointerdown",e=>{down=true;px=e.clientX;py=e.clientY;el.setPointerCapture(e.pointerId);});
  el.addEventListener("pointermove",e=>{ if(!down)return;
    ROOM_VIEW.yaw+=(e.clientX-px)*0.008; ROOM_VIEW.pitch=Math.max(-0.2,Math.min(1.35,ROOM_VIEW.pitch+(e.clientY-py)*0.006));
    px=e.clientX;py=e.clientY; drawRoom3D(); });
  const up=()=>{down=false;}; el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
});
$("btnSvApply").addEventListener("click",()=>{
  const sv=survey(); if(!sv){ toast(ts("svNoProject")); return; }
  const lens=sv.walls.map(w=>+w.len).filter(x=>isFinite(x)&&x>0);
  if(!lens.length){ toast(ts("svNeedWall")); return; }
  const heights=sv.heights.filter(x=>x!=null&&isFinite(x));
  /* il corpo va sulla parete più lunga: l'angolo a sinistra è il vertice prima,
     quello a destra il vertice dopo. Sono già misurati — prima si buttavano via. */
  let iMax=0, best=-1;
  sv.walls.forEach(function(w,i){ const L=+w.len; if(isFinite(L)&&L>best){best=L;iMax=i;} });
  const aOf=w=>{ const v=w?+w.angle:90; return isFinite(v)?angClamp(v):90; };
  const aL=iMax>0?aOf(sv.walls[iMax-1]):90, aR=aOf(sv.walls[iMax]);
  const wallId=sv.walls[iMax].id;
  const onWall=(sv.obstacles||[]).filter(o=>o.wall===wallId);
  const cut=onWall.filter(o=>SC_TYPES.indexOf(o.type)>=0
      && +o.w>0 && +o.h>0 && o.fromCorner!=null && o.fromFloor!=null);
  const other=onWall.length-cut.length;
  setView("build");
  $("bL").value=Math.round(best);
  if(heights.length) $("bH").value=Math.max(100,Math.round(Math.min(...heights))-20);
  $("bAngL").value=isAng(aL)?aL:"";
  $("bAngR").value=isAng(aR)?aR:"";
  buildObst=cut.map(o=>({x:+o.fromCorner,y:+o.fromFloor,w:+o.w,h:+o.h,type:o.type}));
  drawPreview();
  const bits=[Math.round(best)+"×"+$("bH").value];
  if(isAng(aL)||isAng(aR)) bits.push("∠"+aL+"/"+aR);
  if(cut.length) bits.push(cut.length+" "+ts("svCutouts"));
  toast(ts("svApplied")+" — "+bits.join(" · "));
  if(other) setTimeout(function(){ toast(ts("svObstSkip").replace("{n}",other)); },2600);
});

