/* TikTok Ebanist (it, 9:16): armadio con ante sopra e cassetti sotto, zoom sui dettagli, voce italiana.
   node tiktok.cjs [outDir]   — richiede playwright, ffmpeg, piper-tts (+ it_IT-paola-medium.onnx accanto allo script o in PIPER_MODEL).
   Frame per frame: la camera e le animazioni sono guidate dalla linea del tempo (non dal tempo reale), quindi il movimento
   e fluido anche con WebGL software. L'app non si tocca: il server aggiunge a viewer3d.js un gancio (__R, __adv, __FB).
   Env: FPS (30), DPR (2), ONLY=<scena> per provare una scena sola. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const root=process.env.EBANIST_APP||"/home/user/ebanist-app";
const OUT=path.resolve(process.argv[2]||path.join(__dirname,"out"));
const MODEL=process.env.PIPER_MODEL||path.join(__dirname,"it_IT-paola-medium.onnx");
const FPS=+process.env.FPS||30, DPR=+process.env.DPR||2, ONLY=process.env.ONLY||"";
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(path.join(OUT,"frames"),{recursive:true});

const CFG={name:"Armadio",type:"standard",L:900,L2:900,H:2000,P:580,plinth:80,tram:1,shelves:2,drawers:3,doors:2,back:1,hang:0,
  drawerPos:"vista",secMode:["shelves"],drawerZone:700,drawerSys:"legrabox",drawerDist:"uguali"};
const FULL=[0.45,0.78,0.3];

/* cam: chiavi [u, cx,cy,cz, rad, yaw, pitch, zoom]; u = 0..1 dentro la scena */
const K=(u,c,rad,yaw,pitch,zoom)=>({u,c,rad,yaw,pitch,zoom:zoom||1});
const S=[
 {id:"hook",v:"Armadio su misura: ante sopra, cassetti sotto. Progettato sul telefono, in cinque minuti.",c:"Armadio su misura<br>progettato sul telefono",
  keys:[K(0,FULL,1.14,0.95,0.2,1.2),K(1,FULL,1.14,0.2,0.18,1.3)]},
 {id:"open",v:"Apri ante e cassetti direttamente nel modello tre di.",c:"Ante e cassetti si aprono nel 3D",
  keys:[K(0,FULL,1.14,0.4,0.2,1.3),K(1,[0.45,0.95,0.4],1.0,0.3,0.14,1.45)]},
 {id:"hinge",v:"Rendi tutto trasparente e vedi la ferramenta. La cerniera, con tazza e piastra di montaggio.",c:"Cerniera con tazza e piastra",
  keys:[K(0,[0.45,0.95,0.4],1.0,0.3,0.14,1.45),K(0.55,[0.03,1.88,0.58],0.22,0.8,0.12,1),K(1,[0.03,1.88,0.58],0.2,0.9,0.1,1.1)]},
 {id:"slide",v:"La guida del cassetto si telescopa insieme al cassetto, come nella realtà.",c:"La guida si telescopa col cassetto",
  keys:[K(0,[0.03,1.88,0.58],0.22,0.9,0.1,1),K(0.5,[0.88,0.3,0.42],0.32,-0.55,0.3,1),K(1,[0.88,0.3,0.42],0.26,-0.8,0.35,1)]},
 {id:"holes",v:"Ogni pezzo ha i suoi fori: ripiani, guide, giunzioni. Selezioni il fianco e li vedi, uno per uno.",c:"Ogni pezzo con i suoi fori",
  keys:[K(0,[0.01,0.9,0.29],1.1,1.2,0.15,1.15),K(0.3,[0.01,0.4,0.29],0.5,1.0,0.2,1.1),K(1,[0.01,1.55,0.29],0.5,0.9,0.2,1.1)]},
 {id:"sheet",v:"E per ogni pezzo, un foglio A tre con le quote dal bordo all'asse del foro.",c:"Foglio A3 per ogni pezzo<br>quote dal bordo all'asse del foro",sheet:true},
 {id:"asm",v:"Vista esplosa con le posizioni numerate, e giunzioni a tua scelta: confirmat, lamello, Domino, Clamex. Il foglio di montaggio è già pronto.",c:"Montaggio con posizioni numerate<br>confirmat · lamello · Domino · Clamex",
  keys:[K(0,FULL,1.4,0.55,0.25,1.3),K(0.55,FULL,1.4,0.35,0.2,1.35)],sheet2:true},
 {id:"cta",v:"Ebanist. Provalo gratis su ebanist punto com, e su Google Play.",c:"Provalo gratis<br>ebanist.com · Google Play",card:true}
];
const GAP=0.55; /* pausa dopo ogni frase */
const todo=ONLY?S.filter(s=>s.id===ONLY):S;

/* 1. voce */
todo.forEach((s,i)=>{const wav=path.join(OUT,`v${i}.wav`);
  cp.execFileSync("python3",["-m","piper","-m",MODEL,"-f",wav],{input:s.v});
  s.wav=wav;s.dur=parseFloat(cp.execFileSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",wav]).toString())+GAP;});
let acc=0;todo.forEach(s=>{s.t0=acc;acc+=s.dur;s.n=Math.round(s.dur*FPS)});
const TOTAL=acc;console.log("voce",todo.map(s=>s.id+":"+s.dur.toFixed(1)).join(" "),"tot",TOTAL.toFixed(1)+"s",Math.round(TOTAL*FPS)+" cadri");

const ease=x=>x*x*(3-2*x);
function camAt(keys,u){let a=keys[0],b=keys[keys.length-1];for(let i=0;i<keys.length-1;i++)if(u>=keys[i].u&&u<=keys[i+1].u){a=keys[i];b=keys[i+1];break}
  const e=b.u>a.u?ease(Math.min(1,Math.max(0,(u-a.u)/(b.u-a.u)))):1,L=(p,q)=>p+(q-p)*e;
  return{c:[L(a.c[0],b.c[0]),L(a.c[1],b.c[1]),L(a.c[2],b.c[2])],rad:L(a.rad,b.rad),yaw:L(a.yaw,b.yaw),pitch:L(a.pitch,b.pitch),zoom:L(a.zoom,b.zoom)}}

const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");
 r.end(f.endsWith("viewer3d.js")?fs.readFileSync(f,"utf8")+`
window.__R=()=>R;
const __fb=focusBounds; focusBounds=function(){return window.__FB||__fb()};
kick=function(){};
window.__adv=(n)=>{ if(R.raf){cancelAnimationFrame(R.raf);R.raf=0} for(let i=0;i<n;i++)step(); stepCamera(); R.renderer.render(R.scene,R.camera); };`:fs.readFileSync(f))}).listen(8796,async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:DPR,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();const errs=[];pg.on("pageerror",e=>errs.push(String(e)));
 pg.setDefaultTimeout(60000);const w=ms=>pg.waitForTimeout(ms);
 const cap=h=>pg.evaluate(h=>{let d=document.getElementById("vcap");if(!d){d=document.createElement("div");d.id="vcap";d.style.cssText="position:fixed;left:18px;right:18px;bottom:150px;z-index:2147483647;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.92);color:#fff;font:700 23px/1.25 Barlow,system-ui,sans-serif;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.3)";document.body.appendChild(d)}d.innerHTML=h;d.style.display=h?"block":"none"},h);
 const card=(a,bb)=>pg.evaluate(([a,bb])=>{let d=document.getElementById("vcard");if(!d){d=document.createElement("div");d.id="vcard";d.style.cssText="position:fixed;inset:0;z-index:2147483646;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:Barlow,system-ui,sans-serif;text-align:center;padding:30px";document.body.appendChild(d)}d.innerHTML=a?`<div style="font:700 20px Barlow;letter-spacing:7px;opacity:.8">EBANIST</div><div style="font:700 46px/1.1 Barlow">${a}</div><div style="font:400 22px/1.3 Barlow;opacity:.9">${bb||""}</div>`:"";d.style.display=a?"flex":"none"},[a,bb]);
 const sheet=(svg)=>pg.evaluate(svg=>{let d=document.getElementById("vsheet");if(!d){d=document.createElement("div");d.id="vsheet";d.style.cssText="position:fixed;inset:0;z-index:2147483645;background:#3b403c;display:flex;align-items:center;justify-content:center;overflow:hidden";document.body.appendChild(d)}
   if(!svg){d.style.display="none";return}d.style.display="flex";d.innerHTML='<div id="vsh" style="width:100vw;flex:none;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div>'},svg);
 const sheetXf=(s,ox,oy)=>pg.evaluate(([s,ox,oy])=>{const e=document.getElementById("vsh");e.style.transformOrigin=ox+"% "+oy+"%";e.style.transform="scale("+s+")"},[s,ox,oy]);

 await pg.goto("http://localhost:8796/app/index.html?lang=it");await pg.waitForFunction(()=>window.MAT_LOADED===true);await w(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});await pg.getByText('Start',{exact:true}).click({timeout:1500}).catch(()=>{});await w(500);
 await pg.evaluate(cfg=>{closeSheets();const p=proj();p.pieces=[];p.configs={};p.layout={};generateInto(p,Object.assign({},cfg));buildCfg=Object.assign({},cfg);if(buildFormReady)syncBuildForm();persist();setView("build");draw3D()},CFG);await w(1500);
 await pg.locator("#btnPrevBig").click();await w(1200);
 await pg.evaluate(()=>{GL3D.set({open:false,mode:"real",hw:false,holes:false})});await w(500);
 /* fogli pronti prima di girare (la cattura WebGL e lenta) */
 const a3=await pg.evaluate(()=>{const M=GL3D.model();const pc=M.ops.pieces.find(q=>q.role==="fianco")||M.ops.pieces[0],m=M.meta[String(pc.pk)]||{},row=m.row||{},p=proj();
   return EBSheet.partSheetSVG(pc,{face:5,tr:t,opName,sheetNo:1,sheetTot:1,meta:{company:"Domus Renov",project:p.name,client:"",name:partName(M,pc),n:m.n,material:row.materiale||row.mat||"",qty:row.pz,edge:row.bordo,date:new Date().toISOString().slice(0,10),ver:APP_VER}});});
 const pack=await pg.evaluate(()=>{closeSheets();return packBuild(proj(),{cover:false,client:false,report:false,elev:false,asm:true,parts:false})});
 const asm=pack&&pack[0]||null;console.log("fogli",a3.length,asm?asm.length:"nessun foglio montaggio");
 await pg.evaluate(()=>{closeSheets();setView("build");draw3D()});await w(1500);
 if(!await pg.locator("#btnPrevBig.on").count())await pg.locator("#btnPrevBig").click();await w(800);
 await pg.evaluate(()=>{window.__FB=null;const R=__R();R.full0=Object.assign({},R.full);R.cam.rad=R.full.rad});

 await pg.evaluate(()=>__adv(80));
 let fr=0,tStart=Date.now();
 for(const s of todo){
  /* entrata nella scena: stato discreto */
  await cap(s.c);
  if(s.id==="hook")await pg.evaluate(()=>GL3D.set({open:false,mode:"real",hw:false,holes:false}));
  if(s.id==="open")await pg.evaluate(()=>GL3D.set({open:true}));
  if(s.id==="hinge")await pg.evaluate(()=>GL3D.set({mode:"hw",hw:true}));
  if(s.id==="holes")await pg.evaluate(()=>{GL3D.set({open:false,mode:"real",hw:false,holes:true});const M=GL3D.model();const pc=M.ops.pieces.find(q=>q.role==="fianco");GL3D.select(pc.pk,true)});
  if(s.id==="sheet"){await sheet(a3)}
  const joint=async id=>{await pg.evaluate(id=>{const sel=document.querySelector('#hwSelBox select[data-cat="conn"]');if(!sel)return;sel.value=id;sel.dispatchEvent(new Event("change",{bubbles:true}));buildCfg=cfgFromForm();drawPreview();const M=GL3D.model();const pc=M.ops.pieces.find(q=>q.role==="fianco");GL3D.select(pc.pk,true)},id)};
  const jmarks=s.id==="holes"?[]:[];
  if(s.id==="asm"){await sheet(null);await pg.evaluate(()=>{GL3D.select(null);GL3D.set({holes:false,open:false,mode:"real",hw:false});explodeOn=1;drawPreview()})}
  if(s.id==="cta"){await sheet(null);await cap("");await card("Ebanist",s.c)}
  for(let i=0;i<s.n;i++,fr++){
   const u=i/(s.n-1||1);
   for(const jm of jmarks)if(!jm.done&&u>=jm[0]){jm.done=1;await joint(jm[1])}
   if(s.sheet){const e=ease(Math.min(1,Math.max(0,(u-0.2)/0.8)));await sheetXf(1+2.4*e,22,40)}
   else if(s.id==="asm"&&asm&&u>=0.45){ if(!s.shown){s.shown=1;await sheet(asm)}; const e=ease(Math.min(1,(u-0.5)/0.5));await sheetXf(1+1.3*Math.max(0,e),22,34)}
   else if(s.keys){const c=camAt(s.keys,u);await pg.evaluate(c=>{const R=__R();window.__FB={cx:c.c[0],cy:c.c[1],cz:c.c[2],rad:c.rad,size:R.full0.size,floor:0};
      Object.assign(VIEW,{yaw:c.yaw,pitch:c.pitch,zoom:c.zoom});Object.assign(R.cam,{cx:c.c[0],cy:c.c[1],cz:c.c[2],rad:c.rad,yaw:c.yaw,pitch:c.pitch,zoom:c.zoom});__adv(1)},c)}
   await pg.screenshot({path:path.join(OUT,"frames",`f${String(fr).padStart(5,"0")}.jpg`),type:"jpeg",quality:92});
   if(fr%30===0)console.log(s.id,fr,((Date.now()-tStart)/1000/(fr+1)).toFixed(2)+"s/cadru");
  }
 }
 console.log("cadri",fr,"errs",JSON.stringify(errs.slice(0,3)));
 await b.close();srv.close();
 /* 2. montaggio: cadri + voce sincronizzata */
 const ins=todo.flatMap(s=>["-i",s.wav]);
 const filt=todo.map((s,i)=>`[${i+1}:a]adelay=${Math.round(s.t0*1000)}|${Math.round(s.t0*1000)}[a${i}]`).join(";")+";"+todo.map((s,i)=>`[a${i}]`).join("")+`amix=inputs=${todo.length}:normalize=0,loudnorm=I=-16:TP=-1.5[aout]`;
 cp.execFileSync("ffmpeg",["-y","-framerate",String(FPS),"-i",path.join(OUT,"frames","f%05d.jpg"),...ins,"-filter_complex",filt,"-map","0:v","-map","[aout]","-vf","scale=1080:1920,format=yuv420p","-r",String(FPS),"-c:v","libx264","-crf","19","-preset","medium","-c:a","aac","-b:a","160k","-shortest",path.join(OUT,"ebanist-tiktok-it.mp4")],{stdio:"ignore"});
 console.log("mp4 gata:",path.join(OUT,"ebanist-tiktok-it.mp4"));
});
