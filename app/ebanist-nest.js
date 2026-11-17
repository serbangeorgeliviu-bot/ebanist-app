/* ebanist-nest.js — optimizarea tăierii (guillotine, pur, fără DOM).
   Mutat din index.html (5.79.0): aceeași logică, ca să o poată folosi și site-ul și testele.
   nest(piese, L, l, lamă, stoc, cutLW): `cutLW(piesă)` dă cota de tăiat {L,W} (opțional; fără ea, cota finită). */
(function (root) {
"use strict";
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

function nest(piecesIn,PL,PW,kerf,stock,cutLW){
  const items=[];
  for(const x of piecesIn){ const c=cutLW?cutLW(x):{L:x.lung,W:x.larg}; for(let i=0;i<x.pz;i++) items.push({w:c.L,h:c.W,ref:x,norot:!!x.grain}); }
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
    bd.free=gLeaves(bd.root,[]).map(n=>({x:Math.round(n.x),y:Math.round(n.y),w:Math.round(n.w),h:Math.round(n.h)}));
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

root.EBNest = { nest: nest, gCuts: gCuts, gLeaves: gLeaves };
})(typeof globalThis !== "undefined" ? globalThis : this);
