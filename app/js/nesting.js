"use strict";
/* ===========================================================================
   Ebanist — app/js/nesting.js

   I conti della distinta (aree, bordo, costi) e l'ottimizzazione di taglio:
   shelf / guillotine FFDH, con i ritagli di magazzino consumati per primi.
   =========================================================================== */
/* ================= CALCULATIONS ================= */
/* "2L+2C" -> millimetri di bordo per UN pezzo.
   Su un pezzo trapezoidale (parete fuori squadro) i lati non misurano piu la
   quota nominale: i due lati corti sono obliqui — lunghi hypot(larg, offset) —
   e dei due lati lunghi solo quello posteriore misura `lung`, quello anteriore
   e piu corto. Contare 2×larg su un taglio a 60° sottostima il rotolo di ABS di
   quasi 100 mm per pezzo: su un armadio in nicchia si ordina meno del dovuto.
   Su un pezzo dritto (angoli assenti) la formula ritorna esattamente ai valori
   di prima. Il conteggio per lato e limitato a 2: un pannello ha due lati lunghi
   e due corti, "3L" non esiste in officina — e bandCount lo limita gia cosi,
   quindi senza il cap i millimetri di bordo e la compensazione di taglio
   direbbero due cose diverse. */
function bandingMm(bordo,lung,larg,angL,angR,shape){
  if(!bordo) return 0;
  /* un ripiano tondo bordato lo e tutt'attorno: sono π·Ø, non 2L+2C.
     Su un Ø800 la differenza e mezzo metro di ABS per pezzo. */
  if(shape==="tondo"||shape==="ovale") return ellipsePerim(lung/2,larg/2);
  const c=bandCount(bordo);
  if(!c.nL&&!c.nC) return 0;
  const oL=angOff(angL,larg), oR=angOff(angR,larg);
  const cL=Math.hypot(larg,oL), cR=Math.hypot(larg,oR);   // lati corti, obliqui se c'e angolo
  const front=Math.max(0,lung-oL-oR);                      // lato lungo anteriore
  let mm=0;
  // con un solo lato bordato si borda quello a vista: il fronte
  mm += c.nL===2 ? (lung+front) : c.nL===1 ? front : 0;
  mm += c.nC===2 ? (cL+cR)      : c.nC===1 ? Math.max(cL,cR) : 0;
  return mm;
}
/* un pezzo può avere più decupaje: manuale ne tiene uno, il rilievo ne porta parecchi */
function scList(x){ const v=x&&x.scasso; if(!v) return []; return Array.isArray(v)?v:[v]; }
function scTxt(x,sep){ return scList(x).map(function(c){return c.l+"×"+c.w;}).join(sep||" "); }
/* quante bordature per lato: "2L+2C" -> 2 lunghe, 2 corte */
function bandCount(bordo){
  let nL=0,nC=0; if(!bordo) return {nL:0,nC:0};
  const rx=/(\d+)\s*([LC])/gi; let m;
  while((m=rx.exec(bordo))!==null){ const n=parseInt(m[1],10)||0;
    if(m[2].toUpperCase()==="L") nL+=n; else nC+=n; }
  return {nL:Math.min(nL,2),nC:Math.min(nC,2)};
}
function edgeTh(){ const v=(state&&state.settings)?state.settings.edgeTh:null; return (v==null||!isFinite(v))?0.8:+v; }
function normMat(m){return String(m||"").toLowerCase().replace(/\s+/g," ").trim();}
function computeTotals(p){
  const mats={}; let pcs=0, area=0, edge=0;
  for(const x of p.pieces){
    const a = x.lung*x.larg/1e6*x.pz;
    const e = bandingMm(x.bordo,x.lung,x.larg,x.angL,x.angR,x.shape)*x.pz/1000;
    pcs+=x.pz; area+=a; edge+=e;
    const k=normMat(x.materiale);
    if(!mats[k]) mats[k]={label:x.materiale,area:0,edge:0,pcs:0,pieces:[]};
    mats[k].area+=a; mats[k].edge+=e; mats[k].pcs+=x.pz; mats[k].pieces.push(x);
  }
  return {pcs,area,edge,mats};
}

/* ================= NESTING (shelf / guillotine FFDH) ================= */
/* ---------- ottimizzazione di taglio ----------
   Il vecchio motore metteva i pezzi a fasce: il primo pezzo di una fascia
   ne fissava l'altezza e tutto lo spazio sotto i pezzi piu bassi era perso.
   Adesso e un albero di taglio a ghigliottina — ogni nodo e un rettangolo
   libero, ogni taglio lo taglia in due da bordo a bordo. E l'unico modo in
   cui taglia davvero una sezionatrice, e in piu l'albero *e* la sequenza
   dei tagli: si legge dalla radice alle foglie.
   Si provano piu ordini e piu regole di taglio e si tiene il risultato
   migliore: prima meno pannelli, poi ritaglio finale piu grande possibile
   (cosi l'avanzo resta un pezzo solo, riutilizzabile). */

function gNode(x,y,w,h){ return {x,y,w,h,ref:null,dir:null,at:0,a:null,b:null}; }

function gLeaves(n,out){ if(n.a&&n.b){gLeaves(n.a,out);gLeaves(n.b,out);} else if(!n.ref) out.push(n); return out; }

/* mette il pezzo w×h nell'angolo del nodo e taglia il resto.
   Un piazzamento = al massimo due tagli: uno stacca la striscia dal pannello,
   l'altro separa il pezzo dal resto della striscia. Se un avanzo e piu
   sottile della lama non si taglia: quel filo e gia perso nel taglio. */
function gSplit(n,w,h,kerf,rule){
  const dw=n.w-w, dh=n.h-h;
  const horiz = rule==="short" ? (dw<dh) : (dw>=dh);
  let strip=n;
  if(horiz){
    if(dh>kerf){
      n.dir="h"; n.at=n.y+h+kerf;
      n.a=gNode(n.x,n.y,n.w,h);
      n.b=gNode(n.x,n.y+h+kerf,n.w,dh-kerf);
      strip=n.a;
    }
    if(strip.w-w>kerf){
      strip.dir="v"; strip.at=strip.x+w+kerf;
      strip.a=gNode(strip.x,strip.y,w,strip.h);
      strip.b=gNode(strip.x+w+kerf,strip.y,strip.w-w-kerf,strip.h);
      strip=strip.a;
    }
  } else {
    if(dw>kerf){
      n.dir="v"; n.at=n.x+w+kerf;
      n.a=gNode(n.x,n.y,w,n.h);
      n.b=gNode(n.x+w+kerf,n.y,dw-kerf,n.h);
      strip=n.a;
    }
    if(strip.h-h>kerf){
      strip.dir="h"; strip.at=strip.y+h+kerf;
      strip.a=gNode(strip.x,strip.y,strip.w,h);
      strip.b=gNode(strip.x,strip.y+h+kerf,strip.w,strip.h-h-kerf);
      strip=strip.a;
    }
  }
  return strip;
}

function gScore(n,w,h,pick){
  if(pick==="area") return n.w*n.h-w*h;                       // best area fit
  return Math.min(n.w-w,n.h-h);                                // best short side fit
}

function gPlace(bd,it,kerf,rule,pick){
  const free=gLeaves(bd.root,[]);
  let best=null,bw=0,bh=0,bs=Infinity;
  for(const n of free){
    for(const [w,h] of (it.norot?[[it.w,it.h]]:[[it.w,it.h],[it.h,it.w]])){
      if(w>n.w||h>n.h) continue;
      const s=gScore(n,w,h,pick);
      if(s<bs){ bs=s; best=n; bw=w; bh=h; }
    }
  }
  if(!best) return false;
  const leaf=gSplit(best,bw,bh,kerf,rule);
  leaf.ref=it.ref; leaf.w=bw; leaf.h=bh;
  bd.rects.push({x:leaf.x,y:leaf.y,w:bw,h:bh,ref:it.ref});
  bd.used+=bw*bh;
  return true;
}

function gPack(items,PL,PW,kerf,rule,pick,stock){
  const boards=[];
  // i ritagli si provano dal piu piccolo: si consuma il magazzino e si
  // tengono interi i pannelli nuovi
  const pool=(stock||[]).slice().sort((a,b)=>a.L*a.W-b.L*b.W);
  const taken=new Set();
  for(const it of items){
    let done=false;
    for(const bd of boards){ if(gPlace(bd,it,kerf,rule,pick)){done=true;break;} }
    if(done) continue;
    let bd=null;
    for(let i=0;i<pool.length;i++){
      if(taken.has(i)) continue;
      const s=pool[i];
      const fits=it.norot?(it.w<=s.L&&it.h<=s.W)
                         :((it.w<=s.L&&it.h<=s.W)||(it.h<=s.L&&it.w<=s.W));
      if(fits){ taken.add(i); bd={root:gNode(0,0,s.L,s.W),rects:[],used:0,L:s.L,W:s.W,stock:s}; break; }
    }
    if(!bd) bd={root:gNode(0,0,PL,PW),rects:[],used:0,L:PL,W:PW,stock:null};
    boards.push(bd);
    if(!gPlace(bd,it,kerf,rule,pick)) return null;
  }
  return boards;
}

/* il ritaglio piu grande rimasto sull'ultimo pannello: e quello che
   torna in magazzino, quindi a parita di pannelli vince chi lo lascia grande */
function gBiggestFree(bd){
  let m=0; for(const n of gLeaves(bd.root,[])) m=Math.max(m,n.w*n.h); return m;
}

const G_ORDERS=[
  (a,b)=>b.w*b.h-a.w*a.h,
  (a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h) || b.w*b.h-a.w*a.h,
  (a,b)=>Math.min(b.w,b.h)-Math.min(a.w,a.h) || b.w*b.h-a.w*a.h,
  (a,b)=>(b.w+b.h)-(a.w+a.h),
  (a,b)=>b.h-a.h || b.w-a.w,
  (a,b)=>b.w-a.w || b.h-a.h,
];

function nest(piecesIn,PL,PW,kerf,stock){
  const items=[];
  for(const x of piecesIn) for(let i=0;i<x.pz;i++) items.push({w:x.lung,h:x.larg,ref:x,norot:!!x.grain});
  const fitsAny=(w,h)=>(w<=PL&&h<=PW)||(h<=PL&&w<=PW);
  const todo=[],skipped=[];
  for(const it of items){
    const fits=it.norot?(it.w<=PL&&it.h<=PW):fitsAny(it.w,it.h);
    (fits?todo:skipped).push(it);
  }
  // conta i pannelli NUOVI, non i ritagli: quelli sono gia pagati
  const rank=r=>({neu:r.filter(b=>!b.stock).length, st:r.filter(b=>b.stock).length,
                  free:r.length?gBiggestFree(r[r.length-1]):0});
  let best=null,bestR=null;
  for(const ord of G_ORDERS) for(const rule of ["short","long"]) for(const pick of ["short","area"]){
    const r=gPack(todo.slice().sort(ord),PL,PW,kerf,rule,pick,stock);
    if(!r) continue;
    const s=rank(r);
    if(!bestR || s.neu<bestR.neu || (s.neu===bestR.neu && s.st<bestR.st) ||
       (s.neu===bestR.neu && s.st===bestR.st && s.free>bestR.free)){ best=r; bestR=s; }
  }
  const panels=(best||[]).map(bd=>{
    bd.eff=bd.used/(bd.L*bd.W)*100;
    bd.cuts=gCuts(bd.root);
    bd.free=gLeaves(bd.root,[]).map(n=>({w:Math.round(n.w),h:Math.round(n.h)}));
    return bd;
  });
  return {panels,skipped};
}

/* sequenza dei tagli, in profondita: stacchi una striscia e la finisci
   subito, poi passi al resto. Per livelli l'ordine sarebbe equivalente
   sulla carta, ma ti farebbe posare e riprendere lo stesso pezzo dieci volte. */
function gCuts(root){
  const out=[];
  (function walk(n){
    if(!(n.a&&n.b)) return;
    if(n.dir) out.push({dir:n.dir,at:n.at,x:Math.round(n.x),y:Math.round(n.y),
                        w:Math.round(n.w),h:Math.round(n.h)});
    walk(n.a); walk(n.b);
  })(root);
  return out;
}

