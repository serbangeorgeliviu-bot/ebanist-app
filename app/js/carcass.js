"use strict";
/* ===========================================================================
   Ebanist — app/js/carcass.js

   Il generatore di mobili: tipologie, pezzi trapezoidali e spezzatura,
   curve e bombature, la regola che fa decidere la grossezza al materiale
   (ruolo per ruolo) e i sistemi di cassetto.
   =========================================================================== */
/* ================= FURNITURE BUILDER + 3D ================= */
const PRESETS = {
  /* L'armadio con i cassetti dentro: mezza colonna con l'asta, mezza a cassetti
     sotto e ripiani sopra. Era la configurazione piu comune del mestiere e
     l'app non la sapeva fare — «drawers:0» voleva dire nessun cassetto, in
     nessuna vista. */
  armadio:{name:"Armadio",type:"standard",L:1000,L2:900,H:2200,P:600,plinth:80,tram:1,shelves:2,drawers:3,doors:2,back:1,hang:1,
    secMode:["hang","drawerShelf"],drawerSys:"legno",drawerDist:"uguali",drawerZone:640,drawerInset:35},
  basecass:{name:"Base a cassetti",type:"standard",L:600,L2:900,H:720,P:560,plinth:100,tram:0,shelves:0,drawers:4,doors:0,back:1,hang:0,
    drawerSys:"legrabox",drawerDist:"cucina"},
  libreria:{name:"Libreria",type:"standard",L:1880,L2:900,H:775,P:282,plinth:0,tram:2,shelves:2,drawers:0,doors:0,back:1,hang:0},
  cassettiera:{name:"Cassettiera",type:"standard",L:450,L2:900,H:600,P:500,plinth:0,tram:0,shelves:0,drawers:3,doors:0,back:1,hang:0,drawerSys:"legno",drawerDist:"uguali"},
  base:{name:"Mobile base",type:"standard",L:800,L2:900,H:720,P:560,plinth:100,tram:0,shelves:1,drawers:0,doors:2,back:1,hang:0},
  angolare:{name:"Angolare",type:"angolare",L:1000,L2:900,H:2200,P:600,plinth:80,tram:0,shelves:3,drawers:0,doors:1,back:1,hang:1},
  scorrevole:{name:"Scorrevole",type:"scorrevole",L:2400,L2:900,H:2400,P:650,plinth:0,tram:2,shelves:1,drawers:0,doors:2,back:1,hang:1},
  dressing:{name:"Cabina",type:"standard",L:1800,L2:900,H:2200,P:500,plinth:80,tram:2,shelves:2,drawers:2,doors:0,back:1,hang:1},
  tv:{name:"Mobile TV",type:"standard",L:1800,L2:900,H:450,P:400,plinth:60,tram:1,shelves:0,drawers:1,doors:0,back:1,hang:0,support:"piedini"},
  pensile:{name:"Pensile",type:"standard",L:800,L2:900,H:720,P:320,plinth:0,tram:0,shelves:1,drawers:0,doors:2,back:1,hang:0,support:"sospeso"},
  colonna:{name:"Colonna",type:"standard",L:600,L2:900,H:2100,P:560,plinth:100,tram:0,shelves:4,drawers:0,doors:2,back:1,hang:0},
  bagno:{name:"Mobile bagno",type:"standard",L:900,L2:900,H:550,P:460,plinth:0,tram:0,shelves:0,drawers:2,doors:0,back:1,hang:0,support:"sospeso",handles:"push"},
  vetrina:{name:"Vetrina",type:"standard",L:900,L2:900,H:1800,P:400,plinth:80,tram:0,shelves:3,drawers:0,doors:2,back:1,hang:0,front:"vetro"},
  scrivania:{name:"Scrivania",type:"scrivania",L:1400,L2:900,H:750,P:650,plinth:0,tram:0,shelves:0,drawers:0,doors:0,back:0,hang:0,matBody:"pal25_alb"},
  tavolo:{name:"Tavolo",type:"tavolo",L:1600,L2:900,H:760,P:900,plinth:0,tram:0,shelves:0,drawers:0,doors:0,back:0,hang:0,matBody:"pal25_alb"},
  tondo:{name:"Tondo",type:"tondo",L:600,L2:900,H:1200,P:600,plinth:0,tram:0,shelves:3,drawers:0,doors:0,back:0,hang:0},
  ovale:{name:"Ovale",type:"tondo",L:900,L2:900,H:800,P:450,plinth:0,tram:0,shelves:2,drawers:0,doors:0,back:0,hang:0},
  raccordato:{name:"Raccordato",type:"raccordato",L:900,L2:900,H:1400,P:450,plinth:0,tram:0,shelves:3,drawers:0,doors:0,back:1,hang:0,rcorner:80},
  letto:{name:"Letto",type:"letto",L:1660,L2:900,H:950,P:2060,plinth:0,tram:0,shelves:0,drawers:0,doors:0,back:0,hang:0}
};
let buildCfg = {...PRESETS.armadio};
let buildObst=[];   // ostacoli portati dal rilievo nel generatore
let buildSecMode=null;  // contenuto scelto per ogni sezione
let buildFormReady=false;
const MAT_ACC="Accessorio — asta appendiabiti ovale";
const MAT_PIED="Accessorio — piedino regolabile";
const MAT_VETRO="Accessorio — vetro temperato 4mm";

/* ================= PEZZI TRAPEZOIDALI + SPEZZATURA AUTOMATICA ================= */
const ANG_MIN=45, ANG_MAX=135;
function angClamp(a){ a=+a; return isFinite(a)?Math.max(ANG_MIN,Math.min(ANG_MAX,a)):90; }
function isAng(a){ return a!=null && isFinite(+a) && Math.abs(+a-90)>0.05; }
/* cotangente della parete: >0 angolo interno (il corpo si stringe verso il fronte),
   <0 angolo esterno (si allarga). */
function angCot(ang){ return isAng(ang)?1/Math.tan(angClamp(ang)*Math.PI/180):0; }
/* spostamento con segno su una profondità d, e il modulo — per il taglio conta solo il modulo */
function angOffSigned(ang,d){ return d*angCot(ang); }
function angOff(ang,d){ return Math.abs(angOffSigned(ang,d)); }
function shortEdge(lung,larg,angL,angR){ return lung-angOff(angL,larg)-angOff(angR,larg); }
/* MDF grezzo si verniciа: i bordi si stuccano e si dipingono, non si mette ABS. */
/* ================= CURVE =================
   Un pannello piatto non diventa curvo tagliandolo: si piega. In officina si fa
   in tre modi — intagli a pettine sul retro, MDF flessibile, o lamellare in piu
   strati sottili su una forma. Per la distinta cambia una cosa sola ma decisiva:
   il pezzo si taglia DRITTO, alla lunghezza SVILUPPATA, e la curva arriva dopo.
   Quindi qui non si inventa una geometria curva: si calcola lo sviluppo esatto e
   il piano degli intagli, e in distinta va un rettangolo — che e esattamente
   quello che si mette sulla sezionatrice.

   I pezzi orizzontali (fondo, cielo, ripiani) invece SONO tondi davvero: si
   ricavano da un rettangolo di sbozzo e si rifilano. In distinta e a nesting
   vanno col loro ingombro, con la forma segnata a parte. */

/* Perimetro dell'ellisse per integrazione (Simpson sul primo quadrante).
   L'approssimazione di Ramanujan sbaglia 0,67 mm su un ovale 1500×300: poco in
   percentuale, ma la regola del progetto e 0,1 mm all'emissione — e quello e lo
   SVILUPPO di una fascia, dove 0,67 mm sono un giunto che non chiude. */
function ellipsePerim(a,b){
  if(!(a>0&&b>0)) return 0;
  if(Math.abs(a-b)<1e-9) return 2*Math.PI*a;
  const N=2000, h=(Math.PI/2)/N;
  const f=th=>Math.hypot(a*Math.sin(th),b*Math.cos(th));
  let s=f(0)+f(Math.PI/2);
  for(let i=1;i<N;i++) s+=f(i*h)*(i%2?4:2);
  return 4*(h/3)*s;
}
/* sviluppo di una fascia che gira attorno a un corpo L×P (assi ESTERNI) */
function devLen(L,P){ return ellipsePerim(L/2,P/2); }
/* archi di cerchio: lo sviluppo si misura sulla pelle non tagliata, che sta
   all'esterno — e l'unica fibra che non cambia lunghezza piegando. */
function arcLen(radius,angleDeg){ return radius*angleDeg*Math.PI/180; }

const KERF_MIN_STEP=12;   // sotto, le costole sono troppo strette: si spezzano
const KERF_TOL=0.3;       // scarto massimo fra la sfaccettatura e l'arco vero, in mm
/* Piano dei tagli per la piegatura a intagli.
   Due criteri, e vince quello che chiede piu intagli:

   1. ANGOLO — ogni intaglio largo w e profondo d si chiude ruotando di
      2·atan((w/2)/d). Serve almeno quel numero per coprire l'angolo.
   2. LISCIO — fra un intaglio e l'altro il pannello resta DRITTO: la curva e
      un poligono, non un arco. Con passo s su raggio R la faccia si scosta
      dall'arco di circa s²/(8R). Il solo criterio dell'angolo su un Ø600 dava
      57 mm di passo, cioe 1,35 mm di scarto: su un frontale a vista le
      sfaccettature si vedono e si sentono sotto la mano. Imponendo 0,3 mm il
      passo scende a ~27 mm, che e poi quello che si usa in officina.
      s ≤ √(8·R·tol) */
function kerfPlan(t,devMm,angleDeg,opt){
  opt=opt||{};
  if(!(t>0)||!(devMm>0)||!(angleDeg>0)) return null;
  const skin=Math.max(1.5,opt.skin!=null?+opt.skin:Math.min(3,t*0.15));
  const d=t-skin;
  if(d<=0.5) return null;                      // pannello gia sottile: si piega a freddo
  const w=Math.max(1.5,opt.w!=null?+opt.w:3);
  const per=2*Math.atan((w/2)/d);
  const nAng=Math.max(1,Math.ceil((angleDeg*Math.PI/180)/per));
  // raggio: dato, oppure ricavato dallo sviluppo e dall'angolo
  const R=opt.radius>0?+opt.radius:(devMm/(angleDeg*Math.PI/180));
  const tol=opt.tol>0?+opt.tol:KERF_TOL;
  const nSmooth=R>0?Math.max(1,Math.ceil(devMm/Math.sqrt(8*R*tol))):1;
  const n=Math.max(nAng,nSmooth);
  const spacing=devMm/n;
  return {n,depth:+d.toFixed(1),skin:+skin.toFixed(1),w,radius:Math.round(R),
          spacing:+spacing.toFixed(1),perKerfDeg:+(per*180/Math.PI).toFixed(2),
          flat:+(spacing*spacing/(8*R)).toFixed(2),      // scarto residuo dall'arco
          tight:spacing<KERF_MIN_STEP};
}
/* poligono in pianta di un'ellisse centrata: serve al 3D e al disegno.
   Passo angolare costante: per un cerchio i lati escono tutti uguali. */
function ellipsePC(cx,cz,rx,rz,n){
  n=Math.max(8,n||36); const out=[];
  for(let i=0;i<n;i++){ const a=2*Math.PI*i/n;
    out.push([cx+rx*Math.cos(a),cz+rz*Math.sin(a)]); }
  return out;
}
/* un pezzo tondo o ovale: in distinta resta il rettangolo di sbozzo — quello
   che si mette davvero sulla macchina — e la forma viaggia a parte. */
function isRound(x){ return !!(x&&(x.shape==="tondo"||x.shape==="ovale")); }
/* il bordo di un pezzo tondo NON e 2L+2C: e il perimetro */

/* ===== IL MATERIALE DECIDE LA GROSSEZZA, RUOLO PER RUOLO =================
   La seconda causa radice dei due incidenti: la grossezza era UN numero per
   corpo, e `18` stava scritto in otto punti come rete di sicurezza. Quando il
   materiale scelto era da 19, la rete teneva il calcolo a 18.

   Adesso: ogni ruolo ha un materiale, e la grossezza e `material.th`. Un ruolo
   senza materiale EREDITA da quello di struttura. Se manca anche quello, e un
   errore bloccante — NON esiste piu un valore predefinito. */
const ROLE_MAT_KEY={
  fianco:"matBody", base:"matBase", cielo:"matCielo", schienale:"matBack",
  ripiano:"matRipiano", frontale:"matFront", zoccolo:"matZoccolo",
  divisorio:"matDivisorio"
};
/* L'id del materiale di un ruolo: prima quello del corpo, poi quello di
   progetto, poi `null` = eredita dalla struttura. */
function roleMatId(cfg,role){
  const k=ROLE_MAT_KEY[role]||"matBody";
  const S=(typeof state!=="undefined"&&state.settings)||{};
  const perRole=(cfg&&cfg.mat)||{};
  return perRole[role]||cfg[k]||S[k]||null;
}
/* Materiali e grossezze di tutti i ruoli, risolti. Alza un'eccezione se un
   ruolo resta senza materiale: e esattamente il caso in cui prima usciva 18. */
/* L'ordine in cui si cerca la grossezza di struttura. NON e un dettaglio:
     1. il materiale dichiarato SUL CORPO — e la scelta esplicita;
     2. la grossezza dichiarata SUL CORPO — progetto vecchio, senza materiali
        per ruolo. Viene PRIMA del predefinito di progetto, o cambiando il
        predefinito si sposterebbero da sole le cote di un corpo gia
        debitato (D-39: un progetto vecchio non si ricalcola da solo);
     3. il materiale predefinito del progetto;
     4. errore. Mai 18. */
function carcassMaterials(cfg){
  const S=(typeof state!=="undefined"&&state.settings)||{};
  if(typeof MAT_LOADED!=="undefined"&&!MAT_LOADED&&!(S.matAdd||[]).length)
    throw new Error(t("matCatMissing"));
  let struct=(cfg&&cfg.matBody)?matById(cfg.matBody):null, legacy=false;
  if(!struct||!(+struct.th>0)){
    if(cfg&&+cfg.t>0){ struct={id:"__legacy",label:"",th:+cfg.t}; legacy=true; }
    else {
      struct=S.matBody?matById(S.matBody):null;
      if(!struct||!(+struct.th>0)) throw new Error(t("errNoStructMat"));
    }
  }
  const mats={}, sp={};
  for(const role of Object.keys(ROLE_MAT_KEY)){
    /* lo schienale che non c'e non ha materiale ne grossezza: zero, non
       "eredita". Un corpo senza fondo non perde profondita. */
    if(role==="schienale"&&!(cfg&&cfg.back)){ mats[role]=null; sp[role]=0; continue; }
    const id=roleMatId(cfg,role);
    const m=id?matById(id):null;
    /* eredita dalla struttura: e la regola, ed e dichiarata */
    const eff=(m&&+m.th>0)?m:struct;
    if(!eff||!(+eff.th>0)) throw new Error(t("errNoRoleMat").replace("{r}",role));
    mats[role]=eff; sp[role]=+eff.th;
  }
  /* lo schienale non eredita mai dalla struttura: un fondo in HDF da 3 non e
     mai spesso come un fianco. Se il corpo ha il fondo e il materiale non si
     risolve, e un errore — non 3 e non 18. */
  if(cfg&&cfg.back){
    const bid=roleMatId(cfg,"schienale"), bm=bid?matById(bid):null;
    if(!bm||!(+bm.th>0)) throw new Error(t("errNoRoleMat").replace("{r}","schienale"));
    mats.schienale=bm; sp.schienale=+bm.th;
  }
  return {mats,sp,struct,legacy};
}
/* La grossezza di STRUTTURA di un corpo che non e una cassa — scrivania,
   tavolo, letto, tondo, raccordato. Stesso principio: la decide il
   materiale; la grossezza dichiarata sul corpo e solo il ripiego per i
   progetti vecchi; se non c'e nemmeno quella, e un errore. Mai 18. */
function structTh(cfg){
  const S=(typeof state!=="undefined"&&state.settings)||{};
  if(typeof MAT_LOADED!=="undefined"&&!MAT_LOADED&&!(S.matAdd||[]).length)
    throw new Error(t("matCatMissing"));
  /* stesso ordine di carcassMaterials: corpo, poi progetto, mai un valore
     scritto nel codice */
  const own=(cfg&&cfg.matBody)?matById(cfg.matBody):null;
  if(own&&+own.th>0) return +own.th;
  if(cfg&&+cfg.t>0) return +cfg.t;
  const def=S.matBody?matById(S.matBody):null;
  if(def&&+def.th>0) return +def.th;
  throw new Error(t("errNoStructMat"));
}

/* L'impronta dei materiali di un corpo: id + grossezza, per ruolo. Se cambia,
   la distinta gia emessa NON vale piu. E' quello che il cancello di
   esportazione confronta. */
function matStamp(cfg){
  let r;
  try{ r=carcassMaterials(cfg); }catch(e){ return "ERR"; }
  const src=Object.keys(ROLE_MAT_KEY).sort()
    .map(k=>k+"="+((r.mats[k]&&r.mats[k].id)||"-")+":"+(r.sp[k]||0)).join("|");
  let h=0x811c9dc5;
  for(let i=0;i<src.length;i++){ h=(h^src.charCodeAt(i))>>>0; h=(h*0x01000193)>>>0; }
  return ("0000000"+h.toString(16)).slice(-8);
}
function isFrontEl(el){ return /^(anta|frontale|montante anta|traversa anta)/i.test(el||""); }
/* Da che RUOLO prende il materiale ogni ruolo di pezzo. Un cassetto e fatto
   del pannello di struttura, un frontale di cassetto del pannello dei
   frontali: e la stessa regola che applica il falegname. */
const PIECE_MAT_ROLE={
  fianco:"fianco", fianco_sx:"fianco", fianco_dx:"fianco",
  base:"base", cielo:"cielo", base_cielo:"base",
  schienale:"schienale", ripiano:"ripiano", divisorio:"divisorio",
  zoccolo:"zoccolo", traversa:"frontale",
  frontale:"frontale", cassetto_frontale:"frontale",
  cassetto_fianco:"fianco", cassetto_fondo:"fianco"
};
/* Il ruolo comanda. Il nome del pezzo resta come ripiego per le righe vecchie
   e per le tipologie che non passano dal generatore a cassa. */
function matForRole(cfg,role,el){
  if(role&&PIECE_MAT_ROLE[role]) return roleMatId(cfg,PIECE_MAT_ROLE[role]);
  return matForEl(cfg,el);
}
function matForEl(cfg,el){
  if(/^schienale/i.test(el||"")) return cfg.matBack;
  if(isFrontEl(el)) return cfg.matFront;
  return cfg.matBody;
}
function takesEdge(cfg,el,role){
  const m=matById(matForRole(cfg,role,el));
  return !(m&&m.noEdge);
}
/* spigoli in pianta di una scatola; i moduli non parametrici (scrivania, tavolo, letto)
   non li impostano, quindi si ricavano dal rettangolo. */
function planPC(b){ return b.pc||[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1]]; }
/* trapezio in pianta: bordo posteriore `rear`, estremità spostate di oL/oR andando verso il fronte.
   `bound` è il rettangolo di sbozzo che serve in segheria. */
function trapz(rear,oL,oR){
  const front=rear-oL-oR;
  const xs=[0,rear,oL,rear-oR];
  return {rear,front,bound:Math.max.apply(null,xs)-Math.min.apply(null,xs)};
}

/* Divide un pezzo troppo grande per il pannello, preferendo i tagli che cadono
   dietro un ripiano o un tramezzo (giunzione nascosta). cands = posizioni lungo `lung`. */
function splitSegments(lung,larg,cands,PL,PW){
  const fits=(a,b)=>(a<=PL&&b<=PW)||(b<=PL&&a<=PW);
  if(fits(lung,larg)) return null;
  const maxLen = larg<=PW ? PL : (larg<=PL ? PW : 0);
  if(!maxLen||maxLen<80) return null;           // largo comunque: lo segnala l'avviso di nesting
  const sorted=(cands||[]).filter(c=>c>1&&c<lung-1).sort((a,b)=>a-b);
  const cuts=[]; let start=0, guard=0;
  while(lung-start>maxLen && guard++<24){
    const reach=start+maxLen;
    let best=null;
    for(const c of sorted) if(c>start+80&&c<=reach) best=c;
    if(best==null) cuts.push({at:reach,hidden:false}); else cuts.push({at:best,hidden:true});
    start=cuts[cuts.length-1].at;
  }
  if(!cuts.length) return null;
  const segs=[]; let prev=0;
  cuts.forEach(c=>{ segs.push({len:c.at-prev,hidden:c.hidden}); prev=c.at; });
  segs.push({len:lung-prev,hidden:cuts[cuts.length-1].hidden});
  return segs;
}

/* ================= SISTEMI CASSETTO =================
   Un cassetto non e "un frontale piu quattro pezzi": e un sistema. Il sistema
   decide quanto stretta va la cassa dentro il vano, quanto lunga puo essere,
   quanto alto DEVE essere il frontale e cosa entra davvero in distinta —
   su LEGRABOX i fianchi sono metallo comprato e in distinta ci vanno solo
   fondo e retro, tagliati con le formule del manuale.

   LW = luce interna del vano, NL = lunghezza nominale della guida.
   Le formule di taglio vengono dai manuali tecnici Blum. Come per i codici
   articolo, chi ha `chk` va riconfermato sul catalogo in corso prima di
   mandare in produzione: qui non si tira a indovinare in silenzio. */
const DRAWSYS={
  legno:{id:"legno",metal:0,
    n:{it:"Cassetto in legno",ro:"Sertar din lemn",en:"Wooden drawer box",fr:"Tiroir bois"},
    nl:[250,300,350,400,450,500,550,600],
    rear:30,        // gioco fra il fondo della cassa e il piano interno del mobile
    lift:22,        // di quanto il frontale scende sotto il fondo della cassa
    minFront:80,
    bottomTh:5},    // fondo in HDF
  legrabox:{id:"legrabox",metal:1,brand:"Blum",guida:"blum_movento",
    n:{it:"Blum LEGRABOX",ro:"Blum LEGRABOX",en:"Blum LEGRABOX",fr:"Blum LEGRABOX"},
    hs:{N:66.5,M:90.5,K:128.5,C:177,F:241},
    baseW:-35, baseL:-10, backW:-38, backOff:27.5, sideTh:13,
    nl:[270,300,350,400,450,500,550,600],
    rear:12, lift:13, headroom:24, chk:1},
  tandembox:{id:"tandembox",metal:1,brand:"Blum",guida:"blum_tandem",
    n:{it:"Blum TANDEMBOX antaro",ro:"Blum TANDEMBOX antaro",en:"Blum TANDEMBOX antaro",fr:"Blum TANDEMBOX antaro"},
    hs:{N:68,M:83,K:115,C:193,D:203},
    baseW:-75, baseL:-24, backW:-87, backOff:26, sideTh:16,
    nl:[270,300,350,400,450,500,550,600],
    rear:12, lift:13, headroom:24, chk:1},
  nessuno:{id:"nessuno",metal:0,none:1,
    n:{it:"Solo frontale",ro:"Doar frontul",en:"Front only",fr:"Façade seule"},
    nl:[], rear:0, lift:0, minFront:60}
};
const DRAWSYS_IDS=["legno","legrabox","tandembox","nessuno"];
function drawSys(id){ return DRAWSYS[id]||DRAWSYS.legno; }
/* la cassa in legno si stringe di quanto vuole la guida scelta in catalogo:
   sotto-montata Blum 21 mm per lato, a sfere 13, a rulli 12,5. */
function woodDed(){
  const gid=((state.settings||{}).hwProd||{}).guida||"blum_tandem";
  return /tandem|movento/.test(gid)?42:/ball/.test(gid)?26:25;
}
const DRAW_GAP=3;          // luce fra due frontali di cassetto
/* Ante scorrevoli: non sono ante a battente e non passano da deriveCarcass
   (si sovrappongono invece di accostarsi). Le due cote di montaggio che
   servono stanno QUI, con un nome, invece di 45 e 40 dentro il generatore. */
const SLIDE_GAP_TOP=45;    // gioco sopra l'anta scorrevole, per il binario
const SLIDE_OVERLAP=40;    // quanto due ante scorrevoli si sovrappongono
const DRAW_KITCHEN=140;    // il cassettino alto della base da cucina
/* Fra il frontale del cassetto interno e l'anta chiusa deve passare il braccio
   della cerniera: lo spessore dell'anta piu la basetta. Sotto questa quota il
   cassetto non si apre con l'anta aperta a 110°. */
function innerMin(tAnta){ return Math.round(tAnta+14); }

/* --- Come si dividono in altezza i frontali di una colonna di cassetti ---
   `zone` e l'altezza totale che i cassetti hanno diritto di occupare.
   Torna le altezze dal BASSO verso l'alto, come le disegna il motore. */
function drawerHeights(N,zone,dist,fixH){
  if(!(N>0)) return [];
  const avail=zone-4-DRAW_GAP*(N-1);
  if(avail<=0) return [];
  if(dist==="fix"){ const h=Math.max(1,fixH||200); return new Array(N).fill(h); }
  if(dist==="cucina"&&N>=2){
    /* il cassettino delle posate sta in alto e non cresce col mobile:
       il resto si spartisce quello che avanza, in parti uguali. */
    const top=Math.min(DRAW_KITCHEN,avail/N);
    const rest=(avail-top)/(N-1);
    const out=new Array(N-1).fill(rest); out.push(top);
    return out;
  }
  return new Array(N).fill(avail/N);
}

/* --- Il piano completo di una colonna di cassetti ---
   Funzione pura: la usano il motore geometrico, le verifiche del generatore,
   la scheda di montaggio e il conto della ferramenta. Un unico posto dove
   sta scritto quanto e alto un cassetto — prima erano tre, e non erano d'accordo. */
function drawerPlan(cfg,g){
  const N=Math.max(0,Math.min(8,+(cfg.drawers||0)));
  const sys=drawSys(cfg.drawerSys||"legno");
  /* la cassa in legno si taglia dal pannello di STRUTTURA: la grossezza
     arriva da chi ha gia risolto i materiali, non da `cfg.t`. */
  const t=(g&&+g.tBox>0)?+g.tBox:structTh(cfg), warn=[];
  const out={N,sys,sysId:sys.id,warn,fronts:[],inner:!!g.inner,ok:N>0};
  if(!N){ out.ok=0; return out; }

  /* 1. la zona: quanta altezza del fronte spetta ai cassetti */
  let zone=Math.max(0,+(cfg.drawerZone||0));
  const dist=cfg.drawerDist||"uguali";
  const fixH=Math.max(60,+(cfg.drawerFH||200));
  if(!zone) zone = g.fill ? g.frontH : (N*fixH+DRAW_GAP*(N-1)+4);
  zone=Math.min(zone,g.frontH);
  out.zone=zone;

  /* 2. le altezze dei frontali, dal basso in su */
  const hs=drawerHeights(N,zone,dist,fixH);
  if(!hs.length||hs.some(h=>h<20)){ out.ok=0; warn.push({k:"wDrawRoom"}); return out; }
  let y=g.y0+2;
  hs.forEach(h=>{ out.fronts.push({y0:y,h}); y+=h+DRAW_GAP; });
  out.top=y-DRAW_GAP;
  out.minH=Math.min.apply(null,hs);
  out.maxH=Math.max.apply(null,hs);
  if(out.top>g.y0+g.frontH+1) warn.push({k:"wDrawOver",mm:Math.round(out.top-g.y0-g.frontH)});

  /* 3. la lunghezza nominale: la piu lunga che entra nella profondita utile */
  const usable=g.depth-sys.rear-(out.inner?(+cfg.drawerInset||35):0);
  const nls=(sys.nl||[]).filter(x=>x<=usable);
  out.nl=nls.length?nls[nls.length-1]:0;
  if(!sys.none&&!out.nl){ warn.push({k:"wDrawDeep",mm:Math.round(usable),min:(sys.nl||[0])[0]}); out.ok=0; return out; }

  /* 4. la larghezza: quanto si stringe la cassa dentro il vano */
  const clear=g.secW-(out.inner?8:0);   // il cassetto interno lascia gioco all'anta
  out.clear=clear;
  if(sys.metal){
    out.baseW=Math.round(clear+sys.baseW);
    out.baseL=Math.round(out.nl+sys.baseL);
    out.backW=Math.round(clear+sys.backW);
  }else if(!sys.none){
    out.ded=woodDed();
    out.boxW=Math.round(clear-out.ded);
    out.boxIn=out.boxW-2*t;             // fra i due fianchi della cassa
  }
  const minW=sys.metal?150:(2*t+60);
  const w=sys.metal?out.baseW:out.boxW;
  if(!sys.none&&!(w>minW)){ warn.push({k:"wDrawNarrow"}); out.ok=0; return out; }

  /* 5. l'altezza della cassa. Sul sistema metallico si sceglie un'altezza di
        listino: la piu alta che il frontale copre ancora. Sul legno la cassa
        segue il frontale. */
  if(sys.metal){
    const codes=Object.keys(sys.hs);
    const want=cfg.drawerH&&sys.hs[cfg.drawerH]?cfg.drawerH:null;
    const fits=codes.filter(c=>sys.hs[c]<=out.minH-sys.headroom);
    const auto=fits.length?fits[fits.length-1]:null;
    out.hcode=want||auto;
    if(want&&sys.hs[want]>out.minH-sys.headroom) warn.push({k:"wDrawFront",h:want,need:Math.ceil(sys.hs[want]+sys.headroom)});
    if(!out.hcode){ warn.push({k:"wDrawFront",h:codes[0],need:Math.ceil(sys.hs[codes[0]]+sys.headroom)}); out.ok=0; return out; }
    out.sideH=sys.hs[out.hcode];
    out.backH=Math.round(sys.hs[out.hcode]-sys.backOff);
  }else if(!sys.none){
    out.sideH=Math.max(70,Math.round(out.minH-45));
    out.boxL=out.nl;
  }
  if(!sys.none&&out.minH<(sys.minFront||0)) warn.push({k:"wDrawFront",h:"",need:sys.minFront});

  /* 6. il cassetto interno deve lasciar passare il braccio della cerniera */
  if(out.inner){
    out.inset=Math.max(0,+(cfg.drawerInset!=null?cfg.drawerInset:35));
    /* passa il braccio della cerniera: conta lo spessore dell'ANTA, non
       quello della struttura. Su un'anta da 19 su carcassa da 16 il vecchio
       conto lasciava 3 mm di troppo poco. */
    const tAnta=(g&&+g.tFront>0)?+g.tFront:t;
    if(out.inset<innerMin(tAnta)) warn.push({k:"wDrawHinge",need:innerMin(tAnta)});
  }
  return out;
}

