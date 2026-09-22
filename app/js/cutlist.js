"use strict";
/* ===========================================================================
   Ebanist — app/js/cutlist.js

   Il cuore geometrico: da un corpo alla sua distinta di taglio, e lo
   smistamento fra le tipologie (dritto, scorrevole, angolare a L).
   Le cote derivate non si calcolano qui: vengono da deriveCarcass().
   =========================================================================== */
/* --- core geometry + cut list for one carcass --- */
/* Dal cfg del generatore ai parametri di deriveCarcass.
   L'adattatore legge le impostazioni; deriveCarcass no — resta pura.
   Ordine dei valori: predefiniti di serie, poi quelli del progetto, poi
   quelli del corpo. Nessuno di loro e nascosto dentro la funzione. */
function carcassParams(cfg,ctx){
  const S=(typeof state!=="undefined"&&state.settings)||{};
  ctx=ctx||{};
  const P=(ctx.P!=null)?ctx.P:cfg.P, support=ctx.support||cfg.support||"zoccolo";
  const pl=(ctx.pl!=null)?ctx.pl:(support==="sospeso"?0:(cfg.plinth||0));
  /* LE GROSSEZZE SE LE PRENDE DA SOLA se il chiamante non gliele passa.
     Un chiamante che puo DIMENTICARSELE e una seconda sorgente di verita che
     aspetta solo di nascere: e cosi che le cote si sono scollate la prima
     volta. Chi le ha gia risolte le passa e risparmia il giro; chi non le ha
     non puo sbagliare. */
  const SP=ctx.sp||carcassMaterials(cfg).sp;
  const backTh=(ctx.backTh!=null)?ctx.backTh
             :(cfg.back?Math.min(SP.schienale,Math.max(0,P-50)):0);
  /* le ante scorrevoli non sono ante a battente: si sovrappongono invece di
     accostarsi, e il loro conto sta nel ramo apposta. Qui non entrano. */
  const sliding=cfg.type==="scorrevole"&&cfg.doors>0;
  /* modo dello schienale: se il progetto non lo dice, lo dice la grossezza —
     sottile va in cava, spesso va fra i fianchi. E' la regola che l'app ha
     sempre applicato, adesso scritta invece che dedotta ogni volta. */
  const backMode=cfg.backMode||S.backMode||(!cfg.back?"incassato":(backTh<=5?"in_cava":"incassato"));
  return Object.assign({},CARCASS_DEFAULTS,S.geom||{},cfg.geom||{},{
    W:cfg.L, H:cfg.H, D:P,
    /* LE GROSSEZZE, UNA PER RUOLO. Arrivano dai materiali assegnati, non da
       `cfg.t`: un corpo puo avere struttura 19, cielo 25, fondo 3 e ante 19.
       `t_fianco`/`t_back` restano i nomi piatti, per le regole e per i
       progetti gia salvati — ma li riempie lo stesso materiale. */
    sp:Object.assign({},SP,{schienale:backTh}),
    t_fianco:SP.fianco,
    t_back:backTh,
    backMode:backMode,
    h_zoccolo:support==="zoccolo"?pl:0,
    n_ante:sliding?0:Math.max(0,cfg.doors||0),
    n_cerniere:0,          // lo decide l'altezza dell'anta, sotto
    piedini:support==="piedini"?4:0,
    h_picior:support==="piedini"?pl:0,
    /* i tramezzi: da loro esce la larghezza di una sezione, e quindi quella
       del ripiano e della cassa del cassetto. Prima si ricalcolava in
       quattro punti diversi. */
    n_divisorio:Math.max(0,Math.round(cfg.tram||0)),
    /* la guida SCELTA: `rezerva_glisiera` viene da lei, non da una costante.
       Sulla cassa in legno comanda la guida del catalogo ferramenta; su una
       cassa metallica, quella che il sistema si porta dietro. */
    glisiera:(cfg.drawers>0)?slideIdFor(cfg):null,
    cassetto_interno:cfg.drawerPos==="interno",
    inset_cassetto:Math.max(0,+(cfg.drawerInset!=null?cfg.drawerInset:35))
  });
}
/* Quale guida monta questo corpo. UNA riga, letta sia dal motore che dal
   piano dei cassetti: se fossero due, la riserva in profondita e la
   deduzione in larghezza potrebbero venire da due guide diverse. */
function slideIdFor(cfg){
  const sys=drawSys(cfg.drawerSys||"legno");
  if(sys.none) return "nessuno";
  return sys.metal?(sys.guida||"blum_tandem")
                  :(((state&&state.settings&&state.settings.hwProd)||{}).guida||"blum_tandem");
}
function buildCore(cfg){
  const L=cfg.L,H=cfg.H,P=cfg.P;
  const support=cfg.support||"zoccolo", front=cfg.front||"piena";
  const shelfFix=cfg.shelfType==="fisso", push=cfg.handles==="push";
  const pl=support==="sospeso"?0:(cfg.plinth||0);
  /* ---- LE GROSSEZZE VENGONO DAI MATERIALI, RUOLO PER RUOLO ----
     `cfg.matBack||"pfl3"` e `(backMat&&backMat.th)||3` erano due reti di
     sicurezza: quando il materiale non si risolveva, il corpo prendeva un
     fondo da 3 mm che nessuno aveva scelto. Adesso o il materiale c'e, o e
     un errore bloccante. */
  const MAT=carcassMaterials(cfg);
  /* uno schienale non puo essere piu profondo del corpo meno lo spazio utile */
  const backTh=cfg.back?Math.min(MAT.sp.schienale,Math.max(0,P-50)):0;
  const backMat=MAT.mats.schienale;
  /* ---- LE COTE DERIVATE VENGONO DA UN POSTO SOLO ----
     Non si ricalcola qui niente di quello che deriveCarcass sa gia dire.
     Ogni cota che questa funzione tornava a dedurre per conto suo era
     un'occasione di dire 18 dove il materiale diceva 19. */
  const G=deriveCarcass(carcassParams(cfg,{P,pl,backTh,support,sp:MAT.sp}));
  /* Da qui in giu NON esiste piu «lo spessore del corpo»: esiste lo spessore
     DI OGNI RUOLO. `t` resta la grossezza di STRUTTURA, per le parti che
     davvero si tagliano dal pannello della carcassa (la cassa del cassetto in
     legno); tutto il resto usa il suo. */
  const t=G.sp_fianco;
  const tF=G.sp_fianco, tB=G.sp_base, tC=G.sp_cielo, tR=G.sp_ripiano,
        tD=G.sp_divisorio, tA=G.sp_frontale, tZ=G.sp_zoccolo;
  const backNut=G.in.backMode==="in_cava", NUT_D=G.in.nut_d;
  const backZ0=cfg.back?G.piano_interno-backTh:0;   // faccia posteriore dello schienale
  const intZ0=cfg.back?G.piano_interno:0;           // piano interno: davanti allo schienale
  const carcZ0=cfg.back?P-G.D_bc:0;                 // base/cielo arretrano solo se lo schienale è tra i fianchi
  const S0=(typeof state!=="undefined"&&state.settings)||{}, PANL=S0.panelL||2800, PANW=S0.panelW||2070;
  const pieces=[],boxes=[];
  /* ex = {angL,angR,cuts}. `cuts` presente (anche vuoto) abilita la spezzatura:
     i frontali non lo passano mai — una giunzione a vista su un'anta non è accettabile. */
  const add=(elemento,lung,larg,pz,bordo,mat,ex)=>{
    if(!(pz>0&&lung>0&&larg>0)) return;
    ex=ex||{};
    /* IL RUOLO. Il nome del pezzo cambia con la lingua e con la sezione
       ("Ripiano mobile sez.2"); il ruolo no. E' l'unica cosa su cui il
       controllo di chiusura puo rimontare il corpo. Una riga senza ruolo
       non e un pezzo che il controllo puo ignorare: e un buco, e la Fase 2
       lo tratta come tale. */
    const role=ex.role||null;
    const axes=ex.axes||(role&&typeof axesFor==="function"?axesFor(role):null);
    /* LA GROSSEZZA VIAGGIA COL PEZZO. Senza, il controllo di chiusura
       dovrebbe SUPPORRE con che spessore e stato tagliato — ed e proprio la
       supposizione che ha fatto uscire una distinta sbagliata. Un accessorio
       (asta, piedino, vetro) non si taglia dal pannello: `sp` resta assente,
       e la chiusura lo ignora invece di contarlo per zero. */
    const spRole=role&&PIECE_MAT_ROLE[role]?PIECE_MAT_ROLE[role]:null;
    const matOwn=mat?matByLabel(mat):null;
    const sp=(ex.sp!=null)?ex.sp
            :(matOwn&&+matOwn.th>0)?+matOwn.th
            :(spRole?G.sp[spRole]:null);
    /* prima di tutto: se il materiale non si borda, il bordo sparisce — e quindi
       non si sottrae nemmeno dalla misura di taglio. */
    if(bordo&&!mat&&!takesEdge(cfg,elemento,role)) bordo="";
    const put=(el,lu,la,aL,aR,joint,scs,bd,seg)=>{
      /* LA DISTINTA PORTA LA COTA FINITA. Prima qui si sottraeva lo spessore
         del bordo dalla misura di taglio: un fianco da 2078 usciva 2076,4 e
         in distinta 2076. Era la causa di tutte le cote sbagliate della
         Rev. C — e su un'anta i due decimi di troppo si annullavano per caso,
         il che ha tenuto nascosto l'errore. La compensazione, se serve, e una
         scelta di reparto e si fa al bordatore, non nel motore.
         `edgeTh` resta: serve ai metri lineari di ABS, che sono un'altra cosa. */
      const bo=(bd===undefined?bordo:bd);
      const o={elemento:el,lung:Math.round(lu),larg:Math.round(la),pz:Math.round(pz),bordo:bo,mat};
      if(role) o.role=role;
      if(sp!=null&&role!=="accessorio") o.sp=sp;
      /* la grossezza viene dal materiale del PEZZO, non da quello del ruolo:
         il controllo di coerenza non deve confrontarla con il ruolo. */
      if(matOwn&&+matOwn.th>0&&role!=="accessorio") o.spSrc="mat";
      /* le quote a cui stanno i ripiani, dal pavimento del corpo: sono
         l'unico modo di controllare che la pila base→ripiani→cielo chiuda
         davvero l'altezza, invece di riaffermare una definizione. */
      if(ex.ys&&ex.ys.length) o.ys=ex.ys.slice();
      /* `axis_mapping`: quale cota del pezzo corre lungo L, H e P del corpo.
         Senza, 2078x398 e un fianco o un'anta a seconda di chi guarda. */
      if(axes) o.axis_mapping={lung:axes.lung,larg:axes.larg,sp:axes.sp};
      /* un taglio troppo obliquo mangerebbe l'intero pezzo: non lo falsifichiamo,
         lo emettiamo dritto e lo segnaliamo — quella sezione va risolta a mano. */
      if((isAng(aL)||isAng(aR)) && shortEdge(o.lung,o.larg,aL,aR)<20){ o.angSkip=1; }
      else {
        if(isAng(aL)) o.angL=+angClamp(aL).toFixed(1);
        if(isAng(aR)) o.angR=+angClamp(aR).toFixed(1);
      }
      if(joint) o.joint=joint;
      if(seg) o.seg=seg;
      /* forma e curvatura viaggiano col pezzo: la misura in distinta resta
         quella del rettangolo da tagliare, ma l'officina deve sapere che poi
         va rifilato tondo o piegato, e con quanti intagli. */
      if(ex.shape) o.shape=ex.shape;
      if(ex.curve) o.curve=ex.curve;
      const sc=scs||(joint?null:ex.scassi);
      if(sc&&sc.length) o.scasso=sc.length===1?sc[0]:sc;
      if(o.lung>0&&o.larg>0) pieces.push(o);
    };
    const segs = ex.cuts ? splitSegments(lung,larg,ex.cuts,PANL,PANW) : null;
    if(!segs){ put(elemento,lung,larg,ex.angL,ex.angR); return; }
    /* sul giunto nascosto non si borda: il lato tagliato resta grezzo */
    const bc0=bandCount(bordo);
    const segBordo=(i,n)=>{
      if(!bordo||!bc0.nC) return bordo;
      const lose=(n===1)?0:((i===0||i===n-1)?1:2);
      const nc=Math.max(0,bc0.nC-lose), out=[];
      if(bc0.nL) out.push(bc0.nL+"L");
      if(nc) out.push(nc+"C");
      return out.join("+");
    };
    /* i decupaje seguono il pezzo su cui cadono; se uno è a cavallo del taglio si segnala */
    let off=0, straddle=0;
    segs.forEach((s,i)=>{
      const first=i===0, last=i===segs.length-1;
      const joint = last ? (segs[i-1].hidden?"hidden":"visible") : (s.hidden?"hidden":"visible");
      const mine=(ex.scassi||[]).filter(c=>{
        if(c.x>=off && c.x+c.l<=off+s.len) return true;
        if(c.x<off+s.len && c.x+c.l>off && i<segs.length-1) straddle++;
        return false;
      }).map(c=>({...c,x:Math.round(c.x-off)}));
      /* `seg` dice che questo e un TRONCONE: la chiusura risomma i
         tronconi invece di misurare il primo e dichiarare il corpo corto. */
      put(`${elemento} (${i+1}/${segs.length})`,s.len,larg,first?ex.angL:null,last?ex.angR:null,joint,mine,segBordo(i,segs.length),{i:i+1,n:segs.length});
      off+=s.len;
    });
    if(straddle) pieces.__straddle=(pieces.__straddle||0)+straddle;
  };
  /* sxL/sxR = di quanto scorrono i bordi x passando da z0 a z1: così un pannello
     trapezoidale si vede davvero in 3D e nel disegno, non solo in distinta. */
  const bx=(x0,x1,y0,y1,z0,z1,kind,sxL,sxR,sub,grp)=>{
    const o={x0,x1,y0,y1,z0,z1,kind};
    if(sub) o.sub=sub;
    /* `grp` tiene insieme i pezzi di uno stesso cassetto: nella vista esplosa
       il cassetto esce dal mobile tutto intero e solo dopo si apre. */
    if(grp) o.grp=grp;
    // pc = i 4 spigoli in pianta (dietro-sx, dietro-dx, fronte-dx, fronte-sx).
    // Sopravvive alla rotazione dell'ala d'angolo, a differenza di due soli scorrimenti.
    o.pc=[[x0,z0],[x1,z0],[x1+(sxR||0),z1],[x0+(sxL||0),z1]];
    if(sxL||sxR){ const xs=o.pc.map(q=>q[0]); o.x0=Math.min.apply(null,xs); o.x1=Math.max.apply(null,xs); }
    boxes.push(o);
  };
  /* pareti fuori squadro: cot>0 angolo interno (si stringe), cot<0 esterno (si allarga).
     L è misurato al filo POSTERIORE — il muro di fondo. */
  const angL=cfg.angL, angR=cfg.angR;
  const cotL=angCot(angL), cotR=angCot(angR);
  const wL=z=>z*cotL, wR=z=>z*cotR;
  const frontX0=wL(P), frontW=L-P*(cotL+cotR);   // luce reale al filo anteriore
  /* struttura interna calcolata PRIMA dei pannelli grandi: le sue posizioni sono
     i punti dove una giunzione resta nascosta dietro un ripiano o un tramezzo. */
  /* NIENTE aritmetica sulle cote qui: n, secW e intH li dice il motore.
     `secW=(Wi-tram*t)/n` scritto a mano era una delle undici copie. */
  const n=G.in.n_divisorio+1, intW=G.L_int, secW=G.exact.sectiune_W;
  /* i due piani interni: sopra la base, sotto il cielo. `pl+t` e `H-t`
     scritti a mano erano `+ spessore` due volte, e con base e cielo di
     grossezza diversa avrebbero sbagliato tutti e due. */
  const intY0=G.in.h_base+G.sp_base, intY1=H-G.sp_cielo, intH=G.H_int;
  const intD=G.ripiano_D; // profondità utile: dal piano interno, meno l'arretramento del ripiano
  const y0=support==="piedini"?pl:0;
  const tramRel=[]; for(let i=1;i<=(cfg.tram||0);i++) tramRel.push(i*secW+(i-1)*tD+tD/2); // lungo L-2t
  const shelfRel=[]; if(cfg.shelves>0) for(let i=1;i<=cfg.shelves;i++) shelfRel.push(intY0+intH*i/(cfg.shelves+1)-y0); // lungo l'altezza del fianco
  const fiancoCuts=shelfRel.concat([intY0-y0,intY1-y0]).filter(v=>v>0);

  add("Fianco",G.H_fianco,G.D_fianco,2,"2L+2C",null,{cuts:fiancoCuts,role:"fianco"});
  bx(0,tF,y0,H,0,P,"p",wL(P),wL(P)); bx(L-tF,L,y0,H,0,P,"p",-wR(P),-wR(P));
  const bcSpan=G.D_bc, bcRear=G.Wi-carcZ0*(cotL+cotR);
  const bcT=trapz(bcRear,bcSpan*cotL,bcSpan*cotR);
  /* UNA RIGA = UN PEZZO, `pz` volte. Base e cielo stanno insieme finche sono
     lo STESSO pezzo; con un cielo da 25 su una base da 19 sarebbero due pezzi
     diversi in una riga sola, e in segheria ne uscirebbero due uguali — tagliati
     dalla lastra sbagliata. Quando le grossezze o i materiali si separano,
     si separano anche le righe. */
  const bcSame=(tB===tC)&&(roleMatId(cfg,"base")===roleMatId(cfg,"cielo"));
  if(bcSame){
    add("Base / Cielo",bcT.bound,bcSpan,2,"1L",null,{cuts:tramRel,angL,angR,role:"base_cielo"});
  }else{
    add("Base",bcT.bound,bcSpan,1,"1L",null,{cuts:tramRel,angL,angR,role:"base"});
    add("Cielo",bcT.bound,bcSpan,1,"1L",null,{cuts:tramRel,angL,angR,role:"cielo"});
  }
  const baseY=support==="piedini"?pl:pl;
  const bcX0=wL(carcZ0)+tF, bcX1=L-wR(carcZ0)-tF;
  bx(bcX0,bcX1,baseY,baseY+tB,carcZ0,P,"p",bcSpan*cotL,-bcSpan*cotR);
  bx(bcX0,bcX1,H-tC,H,carcZ0,P,"p",bcSpan*cotL,-bcSpan*cotR);
  if(support==="zoccolo"&&pl>=30){
    const zz=G.zoccolo_Z;
    add("Zoccolo",G.zoccolo_W-zz*(cotL+cotR),G.zoccolo_H,1,"1L",null,{cuts:tramRel,role:"zoccolo"});
    bx(wL(zz)+tF,L-wR(zz)-tF,0,pl,zz-tZ,zz,"p");
  }
  if(support==="piedini"&&pl>=30){
    add("Piedino regolabile",pl,50,4,"",MAT_PIED,{role:"accessorio"});
    for(const [fx,fz] of [[tF+20,30],[L-tF-70,30],[tF+20,P-80],[L-tF-70,P-80]]) bx(fx,fx+50,0,pl,fz,fz+50,"p");
  }
  if(cfg.tram>0){
    // i tramezzi restano perpendicolari al fondo: solo le sezioni esterne sono trapezoidali
    add("Tramezzo",intH,intD,cfg.tram,"1L",null,{cuts:shelfRel.map(v=>v+y0-intY0).filter(v=>v>0),role:"divisorio"});
    for(let i=1;i<=cfg.tram;i++){ const x=tF+i*secW+(i-1)*tD; bx(x,x+tD,intY0,intY1,intZ0,P-20,"p"); }
  }
  /* Ogni sezione ha il suo contenuto: mezzo armadio con l'asta e mezzo a ripiani
     è la configurazione normale, non un caso limite. */
  const railY=intY1-120;
  const hangGap=Math.max(0,+(cfg.hangGap!=null?cfg.hangGap:1000));
  const secMode=si=>{
    const m=cfg.secMode&&cfg.secMode[si];
    if(m==="shelf"||m==="hang"||m==="hangShelf"||m==="empty"||m==="drawers"||m==="drawerShelf") return m;
    return cfg.hang?(cfg.shelves>0?"hangShelf":"hang"):(cfg.shelves>0?"shelf":"empty");
  };
  const isDrawSec=m=>m==="drawers"||m==="drawerShelf";
  const secIdx=[]; for(let si=0;si<n;si++) secIdx.push(si);

  /* ---- il piano dei cassetti si calcola PRIMA dei ripiani ----
     I ripiani di una sezione a cassetti partono da sopra la colonna, non dal
     fondo del mobile: se non lo sapessero prima, il primo ripiano finirebbe
     dentro il terzo cassetto. */
  const frontY0=pl, frontH_all=H-pl;
  const sliding=cfg.type==="scorrevole"&&cfg.doors>0;
  const flaggedD=secIdx.filter(si=>isDrawSec(secMode(si)));
  const dSecs=(cfg.drawers>0&&!sliding)?(flaggedD.length?flaggedD:secIdx.slice()):[];
  /* A VISTA o DIETRO L'ANTA: e una scelta, non una deduzione.
     "auto" tiene la regola vecchia — sezione dichiarata a cassetti piu ante
     uguale cassetti interni — cosi i progetti gia salvati non si spostano.
     Le altre due la forzano, ed e quello che serve quando l'armadio ha la
     colonna di cassetti a vista accanto alle ante invece che dietro. */
  const dPos=cfg.drawerPos||"auto";
  const dInner=dPos==="interno"?true:dPos==="vista"?false:(flaggedD.length>0&&cfg.doors>0);
  /* i cassetti a vista in SOLO ALCUNE sezioni non stanno sotto le ante:
     stanno accanto. Le ante allora coprono le sezioni che restano. */
  const dBeside=!dInner&&flaggedD.length>0&&flaggedD.length<n;
  const doorSecs=dBeside?secIdx.filter(si=>dSecs.indexOf(si)<0):secIdx.slice();
  const dPlan=dSecs.length?drawerPlan(cfg,{y0:frontY0,frontH:frontH_all,
      fill:(cfg.doors===0&&cfg.shelves===0&&!cfg.hang),secW,depth:P-intZ0,inner:dInner,
      tFront:tA,tBox:tF}):null;
  const dTop=(dPlan&&dPlan.ok)?dPlan.top:frontY0;

  let shSqueeze=0;
  const shBot=intY0;
  /* posizioni decise PRIMA: con passo fisso può entrarne meno di quanti chiesti,
     e allora si taglia il numero invece di infilarli nella zona dell'asta. */
  const shCache={};
  const shelfYs=(mode,si)=>{
    if(cfg.shelves<=0||(mode!=="shelf"&&mode!=="hangShelf"&&mode!=="drawerShelf")) return [];
    /* la sezione a cassetti ha un fondo suo: la cache si tiene per modo,
       e il modo dei cassetti ha una sola geometria possibile. */
    if(shCache[mode]) return shCache[mode];
    let top=intY1, bot=shBot;
    if(mode==="hangShelf"){ top=railY-hangGap; if(top<intY0+120){ top=intY1; shSqueeze=1; } }
    if(mode==="drawerShelf"){ bot=Math.max(shBot,dTop+DRAW_GAP); if(top-bot<120) return (shCache[mode]=[]); }
    const even=cfg.shelfEven===0?false:true;
    const step=Math.max(60,+(cfg.shelfStep||320));
    const lim=top-tR/2-2, out=[];
    const MINCLR=60;                     // luce minima fra due ripiani: sotto non ci sta niente
    for(let i=1;i<=cfg.shelves;i++){
      const y=even?bot+(top-bot)*i/(cfg.shelves+1):bot+i*step;
      if(y>lim) break;
      const prev=out.length?out[out.length-1]:bot-tR/2;
      if(y-prev<tR+MINCLR) break;
      out.push(y);
    }
    return (shCache[mode]=out);
  };
  const shelfSecs=secIdx.filter(si=>shelfYs(secMode(si),si).length>0);
  const hangSecs=secIdx.filter(si=>{const m=secMode(si); return m==="hang"||m==="hangShelf";});
  const shYs=shelfSecs.length?shelfYs(secMode(shelfSecs[0])):[];
  const shMissing=cfg.shelves>0&&shelfSecs.length?cfg.shelves-shYs.length:0;
  if(shelfSecs.length){
    const shName=shelfFix?"Ripiano fisso":"Ripiano mobile", play=shelfFix?0:G.in.clearance_ripiano;
    const shSpan=G.ripiano_D;
    const secOL=s=>(s===0)?shSpan*cotL:0, secOR=s=>(s===n-1)?shSpan*cotR:0;
    /* si raggruppa in una riga sola solo se TUTTE le sezioni con ripiani hanno lo stesso
       contenuto: altrimenti il conteggio a moltiplicazione sarebbe sbagliato. */
    const modes={}; shelfSecs.forEach(si=>{modes[secMode(si)]=1;});
    const perSec=isAng(angL)||isAng(angR)||shelfSecs.length<n||Object.keys(modes).length>1;
    if(perSec){
      shelfSecs.forEach(si=>{
        const T=trapz(secW,secOL(si),secOR(si));
        add(shName+(n>1?` sez.${si+1}`:""),Math.floor(T.bound-play),intD,shelfYs(secMode(si)).length,"1L",null,
            {cuts:[],angL:(si===0)?angL:null,angR:(si===n-1)?angR:null,role:"ripiano",
             ys:shelfYs(secMode(si)).slice()});
      });
    } else add(shName,Math.floor(secW-play),intD,shYs.length*n,"1L",null,{cuts:[],role:"ripiano",ys:shYs.slice()});
    shelfSecs.forEach(si=>{ const sx0=tF+si*(secW+tD);
      shelfYs(secMode(si)).forEach(y=>bx(sx0,sx0+secW,y-tR/2,y+tR/2,intZ0,P-20,"p",secOL(si),-secOR(si))); });
  }
  // asta appendiabiti (accessorio, non entra nei m² dei pannelli)
  if(hangSecs.length){
    add("Asta appendiabiti",Math.floor(secW-4),25,hangSecs.length,"",MAT_ACC,{role:"accessorio"});
    hangSecs.forEach(si=>{ const sx0=tF+si*(secW+tD);
      bx(sx0+15,sx0+secW-15,railY,railY+25,(P-25)/2,(P+25)/2,"p"); });
  }
  // fronts
  let doorSkip=0, doorTight=0, doorOverlap=0;
  const bow=Math.max(0,Math.min(200,+(cfg.bow||0)));   // bombatura dell'anta curva
  /* ---- CASSETTI ----
     Le sezioni che li ricevono le ha gia decise `dSecs` piu sopra: se almeno
     una sezione dichiara un contenuto con cassetti, comandano quelle.
     Altrimenti vale la vecchia regola — `drawers` e un conteggio PER SEZIONE
     e va in tutte. Cosi i progetti gia salvati generano la stessa distinta. */
  let drawersTop=frontY0;
  {
    const inner=dInner;
    const nd=dSecs.length;
    if(dPlan&&dPlan.ok&&nd){
      const sys=dPlan.sys, N=dPlan.N;
      const inset=inner?dPlan.inset:0;
      const fW=inner?(secW-8):((frontW-4-3*(cfg.tram||0))/n);
      /* `drawersTop` e la quota da cui possono partire le ante. Sale solo se i
         cassetti stanno DAVANTI a loro: dietro l'anta, o accanto in un'altra
         sezione, l'anta resta intera. */
      drawersTop = (inner||dBeside) ? frontY0 : dPlan.top;
      /* --- distinta --- */
      const fname=(inner?"Frontale cassetto interno":(push?"Frontale cassetto push":"Frontale cassetto"));
      /* altezze diverse => righe diverse: un conteggio a moltiplicazione con
         altezze disuguali sarebbe una distinta falsa. */
      const byH={}; dPlan.fronts.forEach(f=>{ byH[Math.round(f.h)]=(byH[Math.round(f.h)]||0)+1; });
      Object.keys(byH).map(Number).sort((a,b)=>a-b).forEach(h=>{
        add(fname,h,fW,byH[h]*nd,"2L+2C",null,{role:"cassetto_frontale"}); });
      if(cfg.boxes!==0&&cfg.boxes!=="0"&&!sys.none){
        if(sys.metal){
          add("Fondo cassetto",dPlan.baseW,dPlan.baseL,N*nd,"",null,{role:"cassetto_fondo"});
          add("Retro cassetto",dPlan.backW,dPlan.backH,N*nd,"1L",null,{role:"cassetto_fianco"});
        }else{
          add("Fianco cassetto",dPlan.nl,dPlan.sideH,2*N*nd,"1L",null,{role:"cassetto_fianco"});
          add("Fronte/Retro cassetto",dPlan.boxIn,dPlan.sideH,2*N*nd,"1L",null,{role:"cassetto_fianco",axes:{lung:"L",larg:"H",sp:"P"}});
          add("Fondo cassetto",dPlan.boxIn,dPlan.nl-20,N*nd,"",matById("pfl5")?matById("pfl5").label:"HDF 5mm",{role:"cassetto_fondo"});
        }
      }
      /* --- geometria: la cassa esiste anche in 3D, non solo in distinta ---
         Prima qui si disegnava solo il frontale: il cassetto in vista esplosa
         non c'era proprio, e un armadio "montato" mostrava scaffali vuoti. */
      const drawBox=(sx0,si,i,f)=>{
        const grp=`d${si}_${i}`;
        const zF=P-inset;                       // filo anteriore del cassetto
        const yB=f.y0+sys.lift;                 // il fondo della cassa
        const cx=sx0+secW/2;
        /* il frontale a vista copre anche i fianchi del mobile: si posa sulla
           luce anteriore, non sulla sezione. Quello interno sta dentro il vano. */
        if(!inner){ const fx=frontX0+2+si*(fW+DRAW_GAP);
                    bx(fx,fx+fW,f.y0,f.y0+f.h,P,P+tA,"f",0,0,"drawer",grp); }
        else        bx(cx-fW/2,cx+fW/2,f.y0,f.y0+f.h,zF-tA,zF,"f",0,0,"drawerIn",grp);
        if(cfg.boxes===0||cfg.boxes==="0"||sys.none) return;
        const NL=dPlan.nl, z1=zF-tA-2, z0=z1-NL;
        if(sys.metal){
          const bw=dPlan.baseW, th=sys.sideTh, sh=dPlan.sideH;
          const bx0=cx-bw/2, bx1=cx+bw/2;
          bx(bx0-th,bx0,yB,yB+sh,z0,z1,"m",0,0,"dbox",grp);            // fianco metallo sx
          bx(bx1,bx1+th,yB,yB+sh,z0,z1,"m",0,0,"dbox",grp);            // fianco metallo dx
          bx(bx0,bx1,yB,yB+16,z0,z1,"p",0,0,"dbox",grp);               // fondo in pannello
          bx(cx-dPlan.backW/2,cx+dPlan.backW/2,yB+8,yB+8+dPlan.backH,z0,z0+t,"p",0,0,"dbox",grp); // retro
        }else{
          const bw=dPlan.boxW, sh=dPlan.sideH, bt=sys.bottomTh;
          const bx0=cx-bw/2, bx1=cx+bw/2;
          bx(bx0,bx0+t,yB,yB+sh,z0,z1,"p",0,0,"dbox",grp);             // fianco sx
          bx(bx1-t,bx1,yB,yB+sh,z0,z1,"p",0,0,"dbox",grp);             // fianco dx
          bx(bx0+t,bx1-t,yB,yB+sh,z1-t,z1,"p",0,0,"dbox",grp);         // fronte cassa
          bx(bx0+t,bx1-t,yB,yB+sh,z0,z0+t,"p",0,0,"dbox",grp);         // retro cassa
          bx(bx0+t,bx1-t,yB,yB+bt,z0+t,z1-t,"p",0,0,"dbox",grp);       // fondo
        }
      };
      dSecs.forEach(si=>{ const sx0=tF+si*(secW+tD);
        dPlan.fronts.forEach((f,i)=>drawBox(sx0,si,i,f)); });
    }
  }
  if(cfg.doors>0){
    if(sliding){
      const nA=Math.max(2,cfg.doors);
      const aH=H-SLIDE_GAP_TOP, aW=(frontW+(nA-1)*SLIDE_OVERLAP)/nA;
      add("Anta scorrevole",aH,aW,nA,"2L+2C",null,{role:"frontale"});
      for(let i=0;i<nA;i++){ const x=frontX0+i*(aW-SLIDE_OVERLAP); const z=(i%2===0)?P+8:P+8+tA+14; bx(x,x+aW,22,22+aH,z,z+tA,"f",0,0,"slide"); }
    }else{
      /* i cassetti INTERNI stanno dietro l'anta: non le rubano altezza.
         Senza cassetti a vista davanti, le cote di montaggio le da il motore:
         anta_y0 = zoccolo + gioco sotto, anta_H = H meno zoccolo e i due
         giochi. Con una colonna di cassetti a vista sotto, l'anta parte da
         sopra i cassetti e si accorcia di conseguenza. */
      const aY0 = drawersTop>frontY0 ? drawersTop+G.in.gap_inf : G.anta_y0;
      const aH = drawersTop>frontY0 ? (H-G.in.gap_sup-aY0) : G.anta_H;
      /* La fascia che le ante devono coprire. Normalmente e tutto il fronte;
         con una colonna di cassetti A VISTA accanto, le ante coprono solo le
         sezioni che restano — altrimenti si sovrapporrebbero ai cassetti. */
      const slotW=(frontW-4-3*(cfg.tram||0))/n;
      const slotX=si=>frontX0+2+si*(slotW+DRAW_GAP);
      let dX0=frontX0, dW=frontW;
      if(dBeside&&doorSecs.length){
        const lo=Math.min.apply(null,doorSecs), hi=Math.max.apply(null,doorSecs);
        dX0=slotX(lo)-2; dW=slotX(hi)+slotW-dX0+2;
        /* sezioni a cassetti IN MEZZO alle ante: la fascia le ingloberebbe.
           Si dice invece di disegnare un'anta sopra un cassetto. */
        if(hi-lo+1!==doorSecs.length) doorOverlap=1;
      }
      if(!(aH>60&&dW>80)) doorSkip=cfg.doors;
      if(aH>60&&dW>80){
        /* La larghezza viene dal motore quando le ante coprono tutto il
           fronte — il caso normale. Quando ne coprono solo una fascia
           (colonna di cassetti a vista accanto), si applica LA STESSA
           formula alla fascia: due reveal ai lati e un rost fra le ante.
           Prima qui c'erano 4 e 3 scritti a mano e nessun concetto di
           sovrapposizione. */
        /* `G.anta_W` vale quando le ante coprono tutto il fronte E il corpo e
           in squadro: L e misurato al muro POSTERIORE, e su una parete fuori
           squadro la luce davanti e piu stretta. Usarlo li dava ante piu
           larghe dell'apertura. Negli altri due casi si applica la STESSA
           formula alla luce vera. */
        const square=!isAng(angL)&&!isAng(angR);
        const aW=(square&&dW>=frontW-0.5&&G.anta_W!=null)
          ? G.anta_W
          : (dW-2*G.reveal-G.in.gap_ante*(cfg.doors-1))/cfg.doors;
        if(front==="vetro"&&aH>300&&aW>250){
          const fr=70; // larghezza telaio
          add(push?"Montante anta vetro push":"Montante anta vetro",aH,fr,2*cfg.doors,"2L+2C",null,{role:"frontale"});
          add("Traversa anta vetro",aW-2*fr,fr,2*cfg.doors,"2C",null,{role:"traversa"});
          add("Vetro anta",aH-2*fr+30,aW-2*fr+30,cfg.doors,"",MAT_VETRO,{role:"accessorio"});
          for(let i=0;i<cfg.doors;i++){ const x=dX0+2+i*(aW+3);
            bx(x,x+aW,aY0,aY0+aH,P,P+tA,"f",0,0,"door");
            bx(x+fr,x+aW-fr,aY0+fr,aY0+aH-fr,P+2,P+tA-2,"g"); }
        }else if(front==="curvo"&&bow>0&&aW>120){
          /* Anta bombata. Dalla corda aW e dalla freccia (bombatura) esce il
             raggio: R = (c²/4 + f²) / 2f — e da li l'angolo e lo sviluppo.
             In distinta va lo SVILUPPO: il pannello si taglia dritto e lungo
             quanto l'arco, poi si piega. Tagliarlo alla corda lo farebbe
             arrivare corto di tutta la bombatura. */
          const R=(aW*aW/4+bow*bow)/(2*bow);
          const thRad=2*Math.asin(Math.min(1,aW/(2*R))), thDeg=thRad*180/Math.PI;
          const devW=R*thRad;
          const kp=kerfPlan(tA,devW,thDeg,{w:Math.min(3,(S0.kerf||3)),radius:R});
          if(kp&&kp.tight) doorTight=1;
          add(push?"Anta curva push":"Anta curva",aH,devW,cfg.doors,"2L+2C",null,
              {role:"frontale",curve:{dev:+devW.toFixed(1),corda:Math.round(aW),
                      radius:Math.round(R),bow:Math.round(bow),
                      angle:+thDeg.toFixed(1),seg:1,kerf:kp}});
          /* 3D: l'arco si posa a sfaccettature, ognuna un quadrilatero normale.
             Cosi il disegno resta sulla strada a quattro spigoli gia collaudata —
             ed e anche quello che succede davvero: un'anta a intagli E sfaccettata. */
          const NF=14;
          for(let i=0;i<cfg.doors;i++){
            const x0=dX0+2+i*(aW+3), cxx=x0+aW/2;
            const cz=P-Math.sqrt(Math.max(0,R*R-aW*aW/4));      // centro dell'arco, dietro il fronte
            const a0=Math.atan2(P-cz,x0-cxx), a1=Math.atan2(P-cz,x0+aW-cxx);
            for(let k=0;k<NF;k++){
              const b0=a0+(a1-a0)*k/NF, b1=a0+(a1-a0)*(k+1)/NF;
              const ox0=cxx+R*Math.cos(b0), oz0=cz+R*Math.sin(b0);
              const ox1=cxx+R*Math.cos(b1), oz1=cz+R*Math.sin(b1);
              const ix0=cxx+(R-tA)*Math.cos(b0), iz0=cz+(R-tA)*Math.sin(b0);
              const ix1=cxx+(R-tA)*Math.cos(b1), iz1=cz+(R-tA)*Math.sin(b1);
              boxes.push({x0:Math.min(ix0,ix1,ox0,ox1),x1:Math.max(ix0,ix1,ox0,ox1),
                          y0:aY0,y1:aY0+aH,
                          z0:Math.min(iz0,iz1,oz0,oz1),z1:Math.max(iz0,iz1,oz0,oz1),
                          kind:"f",sub:"door",pc:[[ix0,iz0],[ix1,iz1],[ox1,oz1],[ox0,oz0]]});
            }
          }
        }else{
          add(push?"Anta push":"Anta",aH,aW,cfg.doors,"2L+2C",null,{role:"frontale"});
          for(let i=0;i<cfg.doors;i++){ const x=dX0+2+i*(aW+3); bx(x,x+aW,aY0,aY0+aH,P,P+tA,"f",0,0,"door"); }
        }
      }
    }
  }
  if(cfg.back){
    // cava fresata: lo schienale entra di NUT_D per lato — tra i fianchi: pannello pieno tra i due fianchi
    const bw=G.back_W, bh=G.back_H;
    const off=backNut?NUT_D:0;
    const bCuts=(bw>=bh)?tramRel.map(v=>v+off):shelfRel.map(v=>v+y0-(backNut?intY0-NUT_D:y0));
    const bX0=backNut?tF-NUT_D:tF, bY0=backNut?intY0-NUT_D:y0;
    const horiz=bw>=bh;
    /* ostacoli misurati in cantiere -> decupaje sullo schienale, in coordinate del pezzo */
    const scs=(cfg.obstacles||[]).map(function(o){
      const px=(+o.x||0)-bX0, py=(+o.y||0)-bY0;
      const c=horiz?{l:Math.round(+o.w||0),w:Math.round(+o.h||0),x:Math.round(px),y:Math.round(py)}
                   :{l:Math.round(+o.h||0),w:Math.round(+o.w||0),x:Math.round(py),y:Math.round(px)};
      return (c.l>0&&c.w>0&&c.x>=0&&c.y>=0&&c.x+c.l<=Math.max(bw,bh)&&c.y+c.w<=Math.min(bw,bh))?c:null;
    }).filter(Boolean);
    add("Schienale",Math.max(bw,bh),Math.min(bw,bh),1,"",null,{cuts:bCuts.filter(v=>v>0),scassi:scs,role:"schienale",
        /* lo schienale si emette con la cota maggiore per prima: quale dei
           due assi sia dipende dal corpo, e il controllo di chiusura deve
           sapere QUALE, non indovinarlo. */
        axes:horiz?{lung:"L",larg:"H",sp:"P"}:{lung:"H",larg:"L",sp:"P"}});
    /* `sub:"back"` NON e decorativo: matKeyOf() in geo3d.js sceglie il materiale
       dello schienale proprio da questo campo. Senza, il pannello posteriore
       usciva col materiale della carcassa nel 3D WebGL e nel file AR mandato
       al cliente — un fondo in rovere invece dell'HDF bianco. */
    if(backNut) bx(tF-NUT_D,L-tF+NUT_D,intY0-NUT_D,intY1+NUT_D,backZ0,backZ0+backTh,"p",0,0,"back");
    else        bx(tF,L-tF,y0,H,0,backTh,"p",0,0,"back");
  }
  return {pieces,boxes,draw:dPlan,warn:{shMissing,shSqueeze,doorSkip,doorTight,doorOverlap,
          drawWarn:(dPlan&&dPlan.warn&&dPlan.warn.length)?dPlan.warn:null}};
}

/* --- dispatch: standard / scorrevole / angolare (due ali a L) --- */
function buildModule(cfg){
  if(cfg.type==="scrivania"){
    const L=cfg.L,H=cfg.H,P=cfg.P,t=structTh(cfg);
    const pieces=[],boxes=[];
    const add=(el,lu,la,pz,bo,mat,role)=>{ if(!(pz>0&&lu>0&&la>0)) return;
      if(bo&&!mat&&!takesEdge(cfg,el,role)) bo="";          // materiale che non si borda
      /* cota FINITA, come nella carcassa: una distinta sola non puo portare
         due convenzioni diverse a seconda della riga */
      const o={elemento:el,lung:Math.round(lu),larg:Math.round(la),pz,bordo:bo,mat};
      if(role){ o.role=role;
        const ax=typeof axesFor==="function"?axesFor(role):null;
        if(ax) o.axis_mapping={lung:ax.lung,larg:ax.larg,sp:ax.sp}; }
      pieces.push(o); };
    add("Piano scrivania",L,P,1,"2L+2C",null,"cielo");
    add("Fianco",H-t,P-50,2,"2L+2C",null,"fianco");
    const mh=Math.round(H*0.45);
    add("Pannello posteriore",L-2*t,mh,1,"1L",null,"schienale");
    boxes.push({x0:0,x1:L,y0:H-t,y1:H,z0:0,z1:P,kind:"p"});
    boxes.push({x0:0,x1:t,y0:0,y1:H-t,z0:30,z1:P-20,kind:"p"});
    boxes.push({x0:L-t,x1:L,y0:0,y1:H-t,z0:30,z1:P-20,kind:"p"});
    boxes.push({x0:t,x1:L-t,y0:H-t-mh,y1:H-t,z0:40,z1:40+t,kind:"p"});
    return {pieces,boxes};
  }
  if(cfg.type==="tavolo"){
    const L=cfg.L,H=cfg.H,P=cfg.P,t=structTh(cfg), g=70, ins=60;
    const pieces=[],boxes=[];
    const add=(el,lu,la,pz,bo,mat,role)=>{ if(!(pz>0&&lu>0&&la>0)) return;
      if(bo&&!mat&&!takesEdge(cfg,el,role)) bo="";          // materiale che non si borda
      /* cota FINITA, come nella carcassa: una distinta sola non puo portare
         due convenzioni diverse a seconda della riga */
      const o={elemento:el,lung:Math.round(lu),larg:Math.round(la),pz,bordo:bo,mat};
      if(role){ o.role=role;
        const ax=typeof axesFor==="function"?axesFor(role):null;
        if(ax) o.axis_mapping={lung:ax.lung,larg:ax.larg,sp:ax.sp}; }
      pieces.push(o); };
    add("Piano tavolo",L,P,1,"2L+2C",null,"cielo");
    add("Traversa telaio",L-2*(ins+g)-20,80,2,"1L",null,"traversa");
    add("Traversa telaio corta",P-2*(ins+g)-20,80,2,"1L",null,"traversa");
    add("Gamba legno 70×70",H-t,70,4,"","Accessorio — gamba legno massello 70×70","accessorio");
    boxes.push({x0:0,x1:L,y0:H-t,y1:H,z0:0,z1:P,kind:"p"});
    for(const [gx,gz] of [[ins,ins],[L-ins-g,ins],[ins,P-ins-g],[L-ins-g,P-ins-g]])
      boxes.push({x0:gx,x1:gx+g,y0:0,y1:H-t,z0:gz,z1:gz+g,kind:"p"});
    boxes.push({x0:ins+g,x1:L-ins-g,y0:H-t-80,y1:H-t,z0:ins+g/2,z1:ins+g/2+20,kind:"p"});
    boxes.push({x0:ins+g,x1:L-ins-g,y0:H-t-80,y1:H-t,z0:P-ins-g/2-20,z1:P-ins-g/2,kind:"p"});
    return {pieces,boxes};
  }
  if(cfg.type==="letto"){
    const L=cfg.L,H=cfg.H,P=cfg.P,t=structTh(cfg), sh=300, sy=150;
    const pieces=[],boxes=[];
    const add=(el,lu,la,pz,bo,mat,role)=>{ if(!(pz>0&&lu>0&&la>0)) return;
      if(bo&&!mat&&!takesEdge(cfg,el,role)) bo="";          // materiale che non si borda
      /* cota FINITA, come nella carcassa: una distinta sola non puo portare
         due convenzioni diverse a seconda della riga */
      const o={elemento:el,lung:Math.round(lu),larg:Math.round(la),pz,bordo:bo,mat};
      if(role){ o.role=role;
        const ax=typeof axesFor==="function"?axesFor(role):null;
        if(ax) o.axis_mapping={lung:ax.lung,larg:ax.larg,sp:ax.sp}; }
      pieces.push(o); };
    add("Testiera",L,H,1,"2L+2C",null,"frontale");
    add("Pediera",L,400,1,"2L+2C",null,"frontale");
    add("Sponda laterale",P-2*t,sh,2,"1L",null,"fianco");
    add("Traversa centrale",P-2*t,120,1,"",null,"traversa");
    add("Doga faggio 68mm",L-2*t-10,68,14,"","Accessorio — doga faggio curvata 68mm","accessorio");
    boxes.push({x0:0,x1:L,y0:0,y1:H,z0:0,z1:t,kind:"p"});
    boxes.push({x0:0,x1:L,y0:0,y1:400,z0:P-t,z1:P,kind:"p"});
    boxes.push({x0:0,x1:t,y0:sy,y1:sy+sh,z0:t,z1:P-t,kind:"p"});
    boxes.push({x0:L-t,x1:L,y0:sy,y1:sy+sh,z0:t,z1:P-t,kind:"p"});
    boxes.push({x0:L/2-10,x1:L/2+10,y0:sy,y1:sy+sh,z0:t,z1:P-t,kind:"p"});
    /* 14 doghe come in distinta; l'ultima deve CHIUDERE a 40mm dalla pediera, non sporgere */
    const NDO=14, doW=68, doA=t+40, doB=P-t-40-doW, doStep=NDO>1?(doB-doA)/(NDO-1):0;
    for(let i=0;i<NDO;i++){ const z=doA+i*doStep;
      boxes.push({x0:t+5,x1:L-t-5,y0:sy+sh-20,y1:sy+sh,z0:z,z1:z+doW,kind:"p"}); }
    return {pieces,boxes};
  }
  /* ---------- corpo tondo / ovale ----------
     Fondo, cielo e ripiani SONO tondi: si sbozzano da un rettangolo e si
     rifilano, quindi in distinta vanno col loro ingombro e la forma segnata.
     La fascia invece si taglia DRITTA, alla lunghezza sviluppata, e si piega
     dopo: e questo il pezzo che si sbaglia se lo sviluppo non e esatto.
     Gli assi L e P sono ESTERNI — e la misura che prendi col metro. */
  if(cfg.type==="tondo"){
    const L=cfg.L, H=cfg.H, P=cfg.P, t=structTh(cfg);
    const pieces=[],boxes=[];
    const warn={};
    const S0=(typeof state!=="undefined"&&state.settings)||{};
    const PANL=S0.panelL||2800, PANW=S0.panelW||2070;
    const add=o=>{ if(!(o.lung>0&&o.larg>0&&o.pz>0)) return;
      if(o.role){ const ax=typeof axesFor==="function"?axesFor(o.role):null;
        if(ax) o.axis_mapping={lung:ax.lung,larg:ax.larg,sp:ax.sp}; }
      pieces.push(o); };

    const oval=Math.abs(L-P)>1;
    const shape=oval?"ovale":"tondo";
    const dev=devLen(L,P);                      // sviluppo sulla pelle esterna
    const inL=L-2*t, inP=P-2*t;                 // luce interna: i piani stanno DENTRO la fascia

    /* --- fascia: uno o piu tratti, secondo quanto entra nel pannello --- */
    const bandH=H-2*t;                          // la fascia sta fra fondo e cielo
    const segMax=(bandH<=PANW)?PANL:(bandH<=PANL?PANW:0);
    let nSeg=1;
    if(!segMax) warn.bandTooTall=1;
    else nSeg=Math.max(1,Math.ceil(dev/segMax));
    const segLen=dev/nSeg;
    /* su un ovale il raggio non e costante: si prende il PIU PICCOLO (ai due
       vertici dell'asse maggiore), dove la curva stringe di piu — se il passo
       va bene li, va bene ovunque. Per il cerchio i due assi coincidono. */
    const aSemi=Math.max(L,P)/2, bSemi=Math.min(L,P)/2;
    const rMin=bSemi*bSemi/aSemi;
    const kp=kerfPlan(t,segLen,360/nSeg,{w:Math.min(3,S0.kerf||3),radius:rMin});
    if(kp&&kp.tight) warn.kerfTight=1;
    add({elemento:nSeg>1?`Fascia (1/${nSeg})`:"Fascia",role:"fianco",lung:Math.round(segLen),larg:Math.round(bandH),
         pz:nSeg,bordo:"",mat:null,curve:{dev:+dev.toFixed(1),seg:nSeg,angle:+(360/nSeg).toFixed(1),kerf:kp}});

    /* --- piani tondi: fondo, cielo, ripiani --- */
    const shelves=Math.max(0,Math.min(10,cfg.shelves|0));
    add({elemento:"Fondo / Cielo tondo",role:"base_cielo",lung:Math.round(inL),larg:Math.round(inP),pz:2,
         bordo:"",mat:null,shape});
    if(shelves>0)
      add({elemento:"Ripiano tondo",role:"ripiano",lung:Math.round(inL),larg:Math.round(inP),pz:shelves,
           bordo:cfg.shelfEdge===0?"":"1L",mat:null,shape});

    /* --- 3D: la fascia e un prisma a base ellittica, i piani sono dischi --- */
    const NP=48, cx=L/2, cz=P/2;
    boxes.push({x0:0,x1:L,y0:t,y1:H-t,z0:0,z1:P,kind:"p",pc:ellipsePC(cx,cz,L/2,P/2,NP)});
    const disc=(y0,y1)=>boxes.push({x0:t,x1:L-t,y0,y1,z0:t,z1:P-t,kind:"p",
                                    pc:ellipsePC(cx,cz,inL/2,inP/2,NP)});
    disc(0,t); disc(H-t,H);
    for(let i=1;i<=shelves;i++){ const y=t+(H-2*t)*i/(shelves+1); disc(y-t/2,y+t/2); }
    return {pieces,boxes,warn};
  }
  /* ---------- corpo con angoli raccordati ----------
     Rettangolo con i due spigoli ANTERIORI arrotondati. Si fa come si fa in
     officina: una fascia sola che gira — fianco, raccordo, fronte, raccordo,
     fianco — tagliata dritta alla lunghezza sviluppata e piegata solo nei due
     archi. Gli intagli servono li e SOLO li: nei tratti dritti il pannello
     resta intero, ed e per questo che le posizioni vanno dette.
     Piani e ripiani restano rettangoli di sbozzo con due angoli da rifilare. */
  if(cfg.type==="raccordato"){
    const L=cfg.L, H=cfg.H, P=cfg.P, t=structTh(cfg);
    const pieces=[],boxes=[],warn={};
    const S0=(typeof state!=="undefined"&&state.settings)||{};
    const PANL=S0.panelL||2800, PANW=S0.panelW||2070;
    const add=o=>{ if(!(o.lung>0&&o.larg>0&&o.pz>0)) return;
      if(o.role){ const ax=typeof axesFor==="function"?axesFor(o.role):null;
        if(ax) o.axis_mapping={lung:ax.lung,larg:ax.larg,sp:ax.sp}; }
      pieces.push(o); };
    /* raggio: non piu di meta larghezza ne della profondita, o il raccordo si
       mangia il corpo e i due archi si toccano */
    const r=Math.max(10,Math.min(+(cfg.rcorner||60),L/2-1,P-1));
    const straightSide=P-r, straightFront=L-2*r;
    const arc=arcLen(r,90);
    const dev=2*straightSide+2*arc+straightFront;      // = L + 2P + r(π−4)
    const bandH=H-2*t;
    const segMax=(bandH<=PANW)?PANL:(bandH<=PANL?PANW:0);
    if(!segMax) warn.bandTooTall=1;
    const nSeg=segMax?Math.max(1,Math.ceil(dev/segMax)):1;
    const kp=kerfPlan(t,arc,90,{w:Math.min(3,S0.kerf||3),radius:r});
    if(kp&&kp.tight) warn.kerfTight=1;
    add({elemento:nSeg>1?`Fascia raccordata (1/${nSeg})`:"Fascia raccordata",role:"fianco",
         lung:Math.round(dev/nSeg),larg:Math.round(bandH),pz:nSeg,bordo:"",mat:null,
         curve:{dev:+dev.toFixed(1),seg:nSeg,angle:90,radius:Math.round(r),kerf:kp,
                /* dove cominciano i due archi, misurati dall'inizio della fascia:
                   senza queste due quote gli intagli finiscono nel posto sbagliato */
                arcAt:[Math.round(straightSide),Math.round(straightSide+arc+straightFront)]}});

    const shelves=Math.max(0,Math.min(10,cfg.shelves|0));
    const inL=L-2*t, inP=P-t;
    add({elemento:"Fondo / Cielo raccordato",role:"base_cielo",lung:Math.round(inL),larg:Math.round(inP),pz:2,
         bordo:"",mat:null,shape:"raccordo",rc:Math.round(Math.max(0,r-t))});
    if(shelves>0)
      add({elemento:"Ripiano raccordato",role:"ripiano",lung:Math.round(inL),larg:Math.round(inP),pz:shelves,
           bordo:cfg.shelfEdge===0?"":"1L",mat:null,shape:"raccordo",rc:Math.round(Math.max(0,r-t))});
    if(cfg.back){
      const bm=matById(cfg.matBack||S0.matBack||"pfl3");
      add({elemento:"Schienale",role:"schienale",lung:Math.round(inL),larg:Math.round(H-2*t),pz:1,bordo:"",
           mat:bm?bm.label:null});
    }
    /* 3D: pianta = rettangolo con due angoli anteriori in arco. Convessa, quindi
       il ventaglio di buildPrism la chiude bene. */
    /* Ordine come nella convenzione a quattro spigoli: dietro-sx, dietro-dx,
       poi il fianco destro sale nell'arco fino al fronte, il fronte, e l'arco
       sinistro torna sul fianco. Il raccordo destro ha centro (x1−r, z1−r):
       parte a 0° sul FIANCO (x1, z1−r) e arriva a 90° sul FRONTE (x1−r, z1). */
    const rcPC=(x0,x1,z0,z1,rr)=>{
      const out=[[x0,z0],[x1,z0]], N=10, cz=z1-rr;
      for(let i=0;i<=N;i++){ const a=Math.PI/2*i/N;                 // 0°→90°: raccordo destro
        out.push([(x1-rr)+rr*Math.cos(a),cz+rr*Math.sin(a)]); }
      for(let i=0;i<=N;i++){ const a=Math.PI/2+Math.PI/2*i/N;       // 90°→180°: sinistro
        out.push([(x0+rr)+rr*Math.cos(a),cz+rr*Math.sin(a)]); }
      return out;
    };
    boxes.push({x0:0,x1:L,y0:t,y1:H-t,z0:0,z1:P,kind:"p",pc:rcPC(0,L,0,P,r)});
    const plate=(y0,y1)=>boxes.push({x0:t,x1:L-t,y0,y1,z0:0,z1:P-t,kind:"p",
                                     pc:rcPC(t,L-t,0,P-t,Math.max(1,r-t))});
    plate(0,t); plate(H-t,H);
    for(let i=1;i<=shelves;i++){ const y=t+(H-2*t)*i/(shelves+1); plate(y-t/2,y+t/2); }
    return {pieces,boxes,warn};
  }
  if(cfg.type==="angolare"){
    const A=buildCore(cfg);
    const B=buildCore({...cfg,L:Math.max(300,cfg.L2||900)});
    const pieces=A.pieces.map(p=>({...p,wing:"A"})).concat(B.pieces.map(p=>({...p,wing:"B"})));
    /* Ala B ruotata di 90°. Interno: si infila accanto all'ala A e i due schienali
       formano l'angolo concavo della stanza. Esterno: esce oltre l'ala A e i due
       schienali abbracciano uno spigolo che sporge (camino, pilastro). */
    const dx=cfg.corner==="dx", ext=cfg.cornerKind==="ext";
    const rot = ext ? (dx ? (x,z)=>[cfg.L+z,-x] : (x,z)=>[-z,-x])
                    : (dx ? (x,z)=>[cfg.L-z,-x] : (x,z)=>[z,-x]);
    const mapB=o=>{
      const pc=planPC(o).map(q=>rot(q[0],q[1]));
      const xs=pc.map(q=>q[0]), zs=pc.map(q=>q[1]);
      return {x0:Math.min.apply(null,xs),x1:Math.max.apply(null,xs),
              y0:o.y0,y1:o.y1,
              z0:Math.min.apply(null,zs),z1:Math.max.apply(null,zs),
              kind:o.kind,pc};
    };
    const boxes=A.boxes.concat(B.boxes.map(mapB));
    return {pieces,boxes};
  }
  return buildCore(cfg);
}

