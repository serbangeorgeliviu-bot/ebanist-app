"use strict";
/* ===========================================================================
   Ebanist — app/js/preview3d.js

   L'anteprima prospettica in SVG, con orbita al tocco e zoom. E' la rete
   di sicurezza sotto il viewer WebGL: se quello non parte, resta questa.
   =========================================================================== */
/* --- 3D perspective renderer with touch orbit + zoom --- */
function shade(hex,f){
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.round(((n>>16)&255)*f)), g=Math.min(255,Math.round(((n>>8)&255)*f)), b=Math.min(255,Math.round((n&255)*f));
  return "#"+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
const VIEW={yaw:0.46,pitch:0.30,zoom:1};
function render3D(svgEl,cfg,view,opts){
  const V=view||VIEW, real=!!(opts&&opts.real);
  const mB=matById(cfg.matBody)||{c:"#eeeee9",tx:"solid"}, mF=matById(cfg.matFront)||mB;
  const bc=mB.c||"#eeeee9", fc=mF.c||bc;
  const woodB=mB.tx==="wood", woodF=mF.tx==="wood";
  let boxes = (opts&&opts.boxes) ? opts.boxes.slice() : buildModule(cfg).boxes;
  let bX0=1e9,bX1=-1e9,bY0=1e9,bY1=-1e9,bZ0=1e9,bZ1=-1e9;
  const PC=planPC;
  for(const b of boxes){ PC(b).forEach(q=>{ bX0=Math.min(bX0,q[0]);bX1=Math.max(bX1,q[0]);bZ0=Math.min(bZ0,q[1]);bZ1=Math.max(bZ1,q[1]); });
    bY0=Math.min(bY0,b.y0);bY1=Math.max(bY1,b.y1); }
  const CX=(bX0+bX1)/2, CY=(bY0+bY1)/2, CZ=(bZ0+bZ1)/2;
  const EXT=Math.max(bX1-bX0,bY1-bY0,bZ1-bZ0);
  /* vista esplosa: ogni pannello si allontana lungo il proprio spessore */
  const EXPL=(opts&&opts.explode)||0;
  if(EXPL>0){
    const k=EXT*0.32*EXPL, sg=v=>v<-0.5?-1:1;
    /* i pezzi di uno stesso cassetto escono PRIMA tutti insieme dal mobile, e
       solo dopo si aprono fra loro: un cassetto smontato in mezzo alla carcassa
       non si legge, e una cassa esplosa attorno al centro del mobile finisce
       dentro i fianchi. Ognuna si apre attorno al proprio centro. */
    const gc={};
    for(const b of boxes){ if(!b.grp) continue;
      const g=gc[b.grp]||(gc[b.grp]={x:0,y:0,z:0,n:0});
      g.x+=(b.x0+b.x1)/2; g.y+=(b.y0+b.y1)/2; g.z+=(b.z0+b.z1)/2; g.n++; }
    for(const id in gc){ const g=gc[id]; g.x/=g.n; g.y/=g.n; g.z/=g.n; }
    boxes=boxes.map(b=>{
      const dx=b.x1-b.x0, dy=b.y1-b.y0, dz=b.z1-b.z0, mn=Math.min(dx,dy,dz);
      const g=b.grp&&gc[b.grp], kk=g?k*0.45:k;
      const rx=g?g.x:CX, ry=g?g.y:CY, rz=g?g.z:CZ;
      let ox=0,oy=0,oz=g?k*1.35:0;              // il cassetto esce in avanti
      if(mn===dx) ox=sg((b.x0+b.x1)/2-rx)*kk;
      else if(mn===dy) oy=sg((b.y0+b.y1)/2-ry)*kk;
      else oz+=sg((b.z0+b.z1)/2-rz)*kk;
      const o={...b,x0:b.x0+ox,x1:b.x1+ox,y0:b.y0+oy,y1:b.y1+oy,z0:b.z0+oz,z1:b.z1+oz};
      if(b.pc) o.pc=b.pc.map(q=>[q[0]+ox,q[1]+oz]);
      return o;
    });
  }
  const yaw=V.free?Math.min(1.45,Math.max(-1.45,V.yaw)):Math.min(1.45,Math.max(0.08,V.yaw));
  const pitch=V.free?Math.min(1.2,Math.max(-0.75,V.pitch)):Math.min(1.2,Math.max(0.05,V.pitch));
  const cy1=Math.cos(yaw),sy1=Math.sin(yaw),cp1=Math.cos(pitch),sp1=Math.sin(pitch), D=EXT*3.4;
  const pr=(x,y,z)=>{
    const cx=x-CX, cyy=y-CY, cz=z-CZ;
    const X=cx*cy1+cz*sy1;
    let Z=-cx*sy1+cz*cy1;
    const Y=cyy*cp1-Z*sp1;
    Z=cyy*sp1+Z*cp1;
    const s=D/(D-Z);
    return [X*s,-Y*s,Z];
  };
  /* Ordine di disegno (pittore). Come altezza di riferimento si prende la faccia
     rivolta verso l'osservatore — quella ALTA guardando dall'alto — invece del
     centro. Col centro, un fianco alto 2200 finiva "piu lontano" di un pezzo
     piccolo posato in alto dentro il mobile, e la cassa di un cassetto si
     disegnava SOPRA il fianco che la nasconde. */
  const bs=boxes.map(b=>{ const q=PC(b);
      if(b.kind==="w") return {...b,zc:-1e9};   // sempre dietro a tutto
      const cx=q.reduce((s2,p)=>s2+p[0],0)/q.length, cz=q.reduce((s2,p)=>s2+p[1],0)/q.length;
      const c=pr(cx,sp1>=0?b.y1:b.y0,cz); return {...b,zc:c[2]}; })
                .sort((a,b)=>a.zc-b.zc);
  let out=""; let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  const reg=p=>{ if(p[0]<mnx)mnx=p[0]; if(p[0]>mxx)mxx=p[0]; if(p[1]<mny)mny=p[1]; if(p[1]>mxy)mxy=p[1]; };
  const face=(pts,fill,extra)=>{ pts.forEach(reg);
    out+=`<polygon points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${fill}" ${extra||'stroke="#8b8b88" stroke-width="1.4" stroke-linejoin="round"'}/>`; };
  for(const b of bs){
    /* prisma a base poligonale: cilindri, ovali e angoli raccordati passano di
       qui. Il resto del motore lavora su quattro spigoli in pianta e non si
       tocca — questa e una strada in piu, non una modifica di quella vecchia.
       Le facce laterali si ordinano per profondita e le nascoste non si
       disegnano, altrimenti il retro del cilindro copre il davanti. */
    if(b.pc && b.pc.length>4){
      const P=b.pc, faces=[];
      let zmin=1e9, zmax=-1e9;
      for(let i=0;i<P.length;i++){
        const p1=P[i], p2=P[(i+1)%P.length];
        const A1=pr(p1[0],b.y0,p1[1]), A2=pr(p2[0],b.y0,p2[1]);
        const B2=pr(p2[0],b.y1,p2[1]), B1=pr(p1[0],b.y1,p1[1]);
        const z=(A1[2]+A2[2])/2;
        if(z<zmin)zmin=z; if(z>zmax)zmax=z;
        faces.push({pts:[A1,A2,B2,B1],z});
      }
      /* le facce vicine schiariscono, quelle lontane scuriscono: e il gradiente
         che fa leggere un cilindro come tondo invece che come un poligono */
      const span=(zmax-zmin)||1;
      faces.sort((u,v)=>u.z-v.z);
      faces.forEach(f=>face(f.pts,shade(bc,0.74+0.32*((f.z-zmin)/span))));
      // il piano superiore copre sempre le facce laterali
      face(P.map(p=>pr(p[0],b.y1,p[1])), real&&woodB?"url(#wgB)":shade(bc,1.08));
      continue;
    }
    /* spigoli in pianta: dietro-sx, dietro-dx, fronte-dx, fronte-sx */
    const q=PC(b), rl=q[0], rr=q[1], fr=q[2], fl=q[3];
    const A=pr(fl[0],b.y0,fl[1]), B=pr(fr[0],b.y0,fr[1]), C=pr(fr[0],b.y1,fr[1]), Dd=pr(fl[0],b.y1,fl[1]);
    const E=pr(rl[0],b.y1,rl[1]), F=pr(rr[0],b.y1,rr[1]), G=pr(rl[0],b.y0,rl[1]);
    if(b.kind==="f"){
      /* si disegna la faccia sul lato PIU LUNGO in pianta: con l'anta aperta i due
         spigoli si scambiano e prima si finiva a disegnare il bordo da 18 mm. */
      const eA=Math.hypot(rr[0]-rl[0],rr[1]-rl[1]), eB=Math.hypot(fl[0]-rl[0],fl[1]-rl[1]);
      const H2=pr(rr[0],b.y0,rr[1]);
      const pts = eA>=eB ? [G,H2,F,E] : [G,A,Dd,E];
      if(opts&&opts.solidFronts){
        face([G,A,Dd,E],shade(fc,0.72)); face([Dd,C,F,E],shade(fc,1.04)); face(pts,fc);
      }
      else if(real) face(pts,woodF?"url(#wgF)":fc,`stroke="${shade(fc,0.62)}" stroke-width="1.6" stroke-linejoin="round"`);
      else face(pts,"rgba(255,255,255,0.28)",'stroke="#5f9412" stroke-width="4" stroke-linejoin="round"');
      continue;
    }
    if(b.kind==="w"){
      /* semitrasparenti: si vede la stanza ma i mobili non spariscono dietro */
      face([G,A,Dd,E],"rgba(196,186,170,0.30)",'stroke="rgba(140,130,115,.55)" stroke-width="1.1"');
      face([A,B,C,Dd],"rgba(212,203,188,0.34)",'stroke="rgba(140,130,115,.55)" stroke-width="1.1"');
      face([Dd,C,F,E],"rgba(228,221,208,0.40)",'stroke="rgba(140,130,115,.55)" stroke-width="1.1"');
      continue;
    }
    if(b.kind==="g"){
      face([A,B,C,Dd],"rgba(150,200,235,0.35)",'stroke="#7fb2d8" stroke-width="1.5" stroke-linejoin="round"');
      continue;
    }
    if(b.kind==="m"){
      /* i fianchi metallici del sistema cassetto: comprati, non tagliati —
         quindi grigi, distinguibili a colpo d'occhio dai pannelli in distinta */
      const MC="#8d9195";
      face([G,A,Dd,E],shade(MC,0.80)); face([Dd,C,F,E],shade(MC,1.10)); face([A,B,C,Dd],MC);
      continue;
    }
    if(real){
      face([G,A,Dd,E],woodB?"url(#wgBd)":shade(bc,0.78));
      face([Dd,C,F,E],woodB?"url(#wgBl)":shade(bc,1.06));
      face([A,B,C,Dd],woodB?"url(#wgB)":bc);
    } else {
      face([G,A,Dd,E],shade(bc,0.84));
      face([Dd,C,F,E],shade(bc,1.05));
      face([A,B,C,Dd],bc);
    }
  }
  const pad=EXT*0.05;
  let w=(mxx-mnx+2*pad), hh=(mxy-mny+2*pad);
  const ccx=(mnx+mxx)/2, ccy=(mny+mxy)/2;
  w/=V.zoom; hh/=V.zoom;
  svgEl.setAttribute("viewBox",`${(ccx-w/2).toFixed(0)} ${(ccy-hh/2).toFixed(0)} ${w.toFixed(0)} ${hh.toFixed(0)}`);
  const wg=(id,base)=>`<pattern id="${id}" width="16" height="240" patternUnits="userSpaceOnUse"><rect width="16" height="240" fill="${base}"/><path d="M4 0v240M11 0v240" stroke="${shade(base,0.88)}" stroke-width="1.2" fill="none"/><path d="M7 0v240" stroke="${shade(base,0.94)}" stroke-width="2.4" fill="none"/></pattern>`;
  const defs=(real&&(woodB||woodF))?`<defs>${woodB?wg("wgB",bc)+wg("wgBl",shade(bc,1.06))+wg("wgBd",shade(bc,0.78)):""}${woodF?wg("wgF",fc):""}</defs>`:"";
  svgEl.innerHTML=defs+out;
}
let _raf=0;
/* Un solo punto di decisione fra i due motori: se il modulo WebGL e partito
   disegna lui, altrimenti l'SVG. Cosi non c'e nessun percorso in cui
   l'anteprima resta vuota. */
function gl3dOn(){ return !!(window.GL3D&&window.GL3D.ok); }
/* girare la camera NON deve ricostruire la geometria: in WebGL basta
   ridisegnare, i pannelli sono gia sulla scheda video */
function redrawCam(){ if(gl3dOn()) window.GL3D.touch(); else redraw3D(); }
function draw3D(){
  if(gl3dOn()){ window.GL3D.render(buildCfg,{explode:explodeOn}); }
  else render3D($("svg3d"),buildCfg,null,{explode:explodeOn});
}
/* chiamata dal modulo quando three.js e pronto: i moduli partono dopo
   lo script classico, quindi al primo drawPreview() GL3D non esiste ancora */
window.__gl3dReady=function(){
  const cv=$("gl3d"), sv=$("svg3d");
  window.GL3D_WHY="modulo ok, init non chiamata";
  if(!cv||!window.GL3D.init(cv)){             // niente WebGL: si tiene l'SVG
    window.GL3D_WHY=(cv?(window.GL3D.err||"init fallita"):"canvas assente");
    try{ verLabelPaint(); }catch(e){}
    return;
  }
  cv.style.display="block"; sv.style.display="none";
  window.GL3D_MODE="WebGL"; try{ verLabelPaint(); }catch(e){}
  window.GL3D.resize();
  if(typeof buildCfg==="object"&&buildCfg) draw3D();
  init3DControls();                            // i gesti vanno sul canvas
  if(window.ResizeObserver) new ResizeObserver(()=>window.GL3D.resize()).observe(cv);
};
