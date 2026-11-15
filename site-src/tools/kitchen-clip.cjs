/* Clip TikTok „Novità: la Cucina” (≤ 20 s, 9:16, voce italiană nativă Nicola, D-145).
   Aplicația reală, proiectul demo test/golden/bucatarie-U-demo.json, cu uși în două culori.
   Etape (ieșire în vid-kitchen/, ignorat de git):
     node site-src/tools/kitchen-clip.cjs frames   cadrele 3D, direct din GL3D.capture → seq/<scenă>/
                                                   (ONLY=tour,explode pentru anumite scene; fără ONLY se sar scenele deja randate)
     node site-src/tools/kitchen-clip.cjs extras   carduri, titlu, texte (PNG transparent), foaia A3 a blatului → ov/, sheet/
     node site-src/tools/kitchen-clip.cjs mux      vocea (Kokoro) + ffmpeg → ebanist-cucina-it.mp4
   Un singur cadru pe scenă, pentru verificare: `frames 1` (în seq1/).
   Scene „room” = camera 3D a bucătăriei (podea dreptunghiulară); „mod” = un singur modul din proiect (piese, găuri, ferăraie).
   Cadrele randate se întind pe durata scenei (framerate de intrare = cadre / secunde), deci durata unei scene se schimbă fără re-randare.
   Replicile se așază față de începutul scenei (nume + decalaj), nu în secunde absolute.
   Voce: KOKORO_DIR (implicit /tmp/tts/kokoro, cu kokoro-v1.0.onnx și voices-v1.0.bin), voce im_nicola. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames", ONE=process.argv[3]==="1", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-kitchen");
const FPS=24, KOKORO=process.env.KOKORO_DIR||"/tmp/tts/kokoro", VOICE=process.env.KOKORO_VOICE||"im_nicola";
const BASE="blue_avio_23196mn_19", WALL="rovere_wood_lime_classic_k2414ah_19", BODY="antracite_storm_grey_19";
const T={ hook1:"Novità",hook2:"la Cucina",
  s1:"Cucina a U · 27 moduli",s1b:"172 pezzi, tutti calcolati",
  s2:"Ogni modulo, pezzo per pezzo",s2b:"pannelli, forature, ferramenta",
  s3:"Forature sul pannello",s3b:"ferramenta in trasparenza",
  s4:"Cerniere",s4b:"disegnate nel dettaglio",
  s5:"Guide dei cassetti",s5b:"con le forature sul fianco",
  s6:"Piano con sagomatura",s6b:"foglio A3 con le quote per la dima",
  end1:"Provalo gratis",end2:"ebanist.com",
  m1:"Blue Avio",m2:"Rovere Wood Lime" };
/* modulele din galerie: numele din proiect, titlul afișat; dimensiunile vin din proiect */
const GAL=[["Colonna frigorifero integrato 1.1","Colonna frigorifero"],["Base piano cottura (cassetti) 2.2","Base piano cottura"],["Angolo a L (carosello) 1.5","Angolo a L"],["Colonna dispensa estraibile 3.4","Colonna dispensa estraibile"],["Colonna forno (+ microonde) 3.6","Colonna forno e microonde"]];
const GV=[[.3,.2,1.0,.9,.15,1.15],[-.5,.25,1.0,-.1,.2,1.15],[-.9,.25,1.0,-.4,.25,1.15],[.4,.2,1.0,-.2,.2,1.15],[.5,.2,1.0,-.2,.25,1.15]];
/* scene. room = camera 3D a bucătăriei; mod = un singur modul (cfg) cu from/to pe yaw, pitch, zoom, explode;
   spot = [tip feronerie, poziție] → camera ține ținta pe ea (rad mm); focus = pk piesă; mode "hw" = panouri transparente cu găuri și ferăraie;
   title = titlul mare peste imagine, între 0 și title secunde (apoi apare textul obișnuit) */
const SEGS=[
 {name:"tour",kind:"room",sec:4.0,cam:[-.5,1.05,1.3,.6,.8,1.4],title:1.9,cap:[T.s1,T.s1b],sw:true},
 {name:"explode",kind:"mod",sec:3.0,cfg:"Base lavello 1.3",from:{yaw:.3,pitch:.3,zoom:.95,explode:0},to:{yaw:.85,pitch:.28,zoom:1.0,explode:.9},hwAt:.55,cap:[T.s2,T.s2b]},
 ...GAL.map(([cfg,title],i)=>({name:"gal"+(i+1),kind:"mod",sec:.68,cfg,from:{yaw:GV[i][0],pitch:GV[i][1],zoom:GV[i][2]},to:{yaw:GV[i][3],pitch:GV[i][4],zoom:GV[i][5]},open:i<4,dimsCap:title})),
 {name:"holes",kind:"mod",sec:1.1,cfg:"Base lavello 1.3",from:{yaw:.9,pitch:.15,zoom:1.5,explode:.9},to:{yaw:1.3,pitch:.12,zoom:2.3,explode:.9},focus:1,mode:"hw",cap:[T.s3,T.s3b]},
 {name:"hinge",kind:"mod",sec:1.1,cfg:"Base con ante 2.4",from:{yaw:1.0,pitch:.2,zoom:1.0},to:{yaw:.55,pitch:.15,zoom:1.3},spot:["cerniera",.3],rad:110,open:true,cap:[T.s4,T.s4b]},
 {name:"slide",kind:"mod",sec:1.1,cfg:"Base con cassetti 2.1",from:{yaw:-.5,pitch:.3,zoom:1.0},to:{yaw:-.15,pitch:.25,zoom:1.25},spot:["guida",0],rad:220,open:true,cap:[T.s5,T.s5b]},
 {name:"sheet",sec:3.4,sheet:true,cap:[T.s6,T.s6b]},
 {name:"end",sec:2.8,card:[T.end1,T.end2]}];
/* vocea: [scenă, decalaj în secunde față de începutul scenei, text] */
const CUES=[
 ["tour",0.10,"Novità Ebanist: la cucina."],
 ["tour",2.10,"Ventisette moduli, tutti calcolati."],
 ["explode",0.80,"Ogni modulo si apre, pezzo per pezzo."],
 ["gal1",0.45,"Basi, colonne, angoli e pensili."],
 ["holes",0.10,"Forature, cerniere, guide: tutto nel dettaglio."],
 ["sheet",0.25,"Il piano ha già la sagomatura, con le quote per la dima."],
 ["end",0.15,"Provalo gratis su ebanist punto com."]];
const sm=k=>k*k*(3-2*k), nfOf=s=>Math.round(s.sec*FPS);
let cum=0; for(const s of SEGS){s.t0=cum/FPS; s.n=nfOf(s); cum+=s.n}
const total=cum/FPS;
if(total>20) throw new Error("clipul depășește 20 s: "+total);
fs.mkdirSync(OUT,{recursive:true});
function sh(cmd,args){cp.execFileSync(cmd,args,{stdio:"inherit"})}
const segOf=n=>SEGS.find(s=>s.name===n);

if(MODE==="mux"){
  const cues=CUES.map(([n,off,text])=>({start:segOf(n).t0+off,avail:9,text}));
  fs.writeFileSync(path.join(OUT,"cues.json"),JSON.stringify(cues));
  const wav=path.join(OUT,"voice.wav");
  sh(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(OUT,"cues.json"),wav,String(total),"kokoro:"+VOICE+":"+KOKORO+":it"]);
  const enc=["-r",String(FPS),"-c:v","libx264","-crf","21","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)];
  const parts=[];
  SEGS.forEach((s,i)=>{
    const n=s.n, d=n/FPS, pf=path.join(OUT,"part-"+i+".mp4"), a=["-loglevel","error","-y"];
    const fc=[]; let last="0:v", k=1;
    if(s.card) a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov","card-"+s.name+".png"));
    else if(s.sheet) a.push("-framerate",String(Math.min(FPS*2,fs.readdirSync(path.join(OUT,"sheet")).length/s.sec)),"-i",path.join(OUT,"sheet","f_%04d.jpg"));
    else a.push("-framerate",String(fs.readdirSync(path.join(OUT,"seq",s.name)).length/s.sec),"-i",path.join(OUT,"seq",s.name,"f_%04d.jpg"));
    /* suprapuneri cu intrare fină (fade 0,25 s); {f, de la, până la} în secunde din scenă */
    const ovs=[]; const tt=s.title||0;
    if(tt) ovs.push({f:"title-"+s.name,a:0,b:tt});
    if(s.cap||s.dimsCap) ovs.push({f:"cap-"+s.name,a:tt,b:d});
    if(s.sw) ovs.push({f:"sw",a:tt,b:d});
    ovs.forEach(o=>{a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",o.f+".png"));
      fc.push(`[${k}:v]format=rgba,fade=t=in:st=${o.a.toFixed(3)}:d=0.25:alpha=1[f${k}]`);
      fc.push(`[${last}][f${k}]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})':shortest=1[o${k}]`);last="o"+k;k++});
    if(fc.length) a.push("-filter_complex",fc.join(";"),"-map","["+last+"]");
    a.push("-frames:v",String(n),...enc,pf); sh("ffmpeg",a); parts.push(pf);
  });
  const lst=path.join(OUT,"parts.txt"); fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const silent=path.join(OUT,"silent.mp4"); sh("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",silent]);
  const out=path.join(OUT,"ebanist-cucina-it.mp4");
  sh("ffmpeg",["-loglevel","error","-y","-i",silent,"-i",wav,"-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:v","copy","-c:a","aac","-b:a","160k","-ar","44100","-movflags","+faststart","-shortest",out]);
  console.log("gata",out,total.toFixed(2)+" s");
  process.exit(0);
}

const DEMO=JSON.parse(fs.readFileSync(path.join(root,"test/golden/bucatarie-U-demo.json"),"utf8"));
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8802,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(300000);
 await pg.goto("http://localhost:8802/app/index.html?lang=it");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 /* proiectul demo, două culori: baza și coloanele Blue Avio, pensilele Rovere (salvat în proj.json; apply durează ~2 min) */
 const CACHE=path.join(OUT,"proj.json"), cached=fs.existsSync(CACHE)?JSON.parse(fs.readFileSync(CACHE,"utf8")):null;
 const info=await pg.evaluate(([D,BASE,WALL,BODY,cached])=>{
  closeSheets();const S=state.settings;S.matBody=BODY;S.matFront=BASE;S.matBack=BODY;
  if(cached){state.projects.push(cached);state.activeId=cached.id;return {ok:true,err:"",pieces:proj().pieces.length,cached:true}}
  state.projects.push(D);state.activeId=D.id;const p=proj();
  const ok=EBKitchenUI.apply(p);
  for(const name of Object.keys(p.configs)) if(/↑$/.test(name)){const c=JSON.parse(JSON.stringify(p.configs[name]));c.matFront=WALL;generateInto(p,c)}
  persist();return {ok,err:(EBKitchenUI.kit(p).err||[]).join("|"),pieces:p.pieces.length};
 },[DEMO,BASE,WALL,BODY,cached]);
 console.log("proiect",JSON.stringify(info));
 if(!info.ok) throw new Error("bucătăria nu s-a aplicat: "+info.err);
 const PROJ=cached||await pg.evaluate(()=>proj());
 if(!cached) fs.writeFileSync(CACHE,JSON.stringify(PROJ));

 if(MODE==="frames"){
  await pg.evaluate(()=>{
   setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();
   window.__room=null;
   const bx=roomBoxes(),RL=roomLayout(),fr=RL.frames,floor=fr.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
   /* viewerul primește doar colțurile de început ale pereților: la 3 pereți podeaua ieșea triunghi. Adăugăm capătul ultimului perete. */
   const sv=proj().survey.walls, last=fr[fr.length-1], lw=+sv[sv.length-1].len;
   if(fr.length===sv.length&&lw>0){const e=toRoom(last,lw,0,0);floor.push([e.x,e.y])}
   GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
   /* capture() randează un singur cadru, cu camera fixată pe loc; scenele „room” îl învață să primească camera (cutii + podea) */
   const r0=GL3D.render;GL3D.render=function(cfg,o){return r0.call(this,cfg,window.__room?Object.assign({},o,{boxes:bx,room:{floor}}):o)};
  });
  await pg.waitForTimeout(1500);
  const only=(process.env.ONLY||"").split(",").filter(Boolean);
  for(const s of SEGS.filter(x=>x.kind)){
   const dir=path.join(OUT,ONE?"seq1":"seq",s.name), nf=s.n;
   const have=!ONE&&fs.existsSync(dir)?fs.readdirSync(dir).length:0;
   if(only.length?!only.includes(s.name):(have>=nf)) {console.log(s.name,"există ("+have+" cadre), sar peste");continue}
   fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
   const t0=Date.now(); let target=null;
   if(s.kind==="mod"){
     await pg.evaluate(cn=>{window.__room=null;window.__cfg=JSON.parse(JSON.stringify(proj().configs[cn]))},s.cfg);
     if(s.spot){target=await pg.evaluate(([type,pick])=>{GL3D.render(window.__cfg,{explode:0});const M=GL3D.model();const hs=M.ops.hw.filter(h=>h.type===type);const h=hs[Math.min(hs.length-1,Math.floor(hs.length*pick))];return h.w},s.spot)}
   } else await pg.evaluate(()=>{window.__room=true;window.__cfg={matBody:state.settings.matBody,matFront:state.settings.matFront}});
   for(let i=0;i<nf;i++){
    if(ONE&&i!==Math.floor(nf*.6)) continue;
    const k=nf>1?sm(i/(nf-1)):0;
    let o;
    if(s.kind==="room"){const c=s.cam,L=(a,b)=>a+(b-a)*k;o={yaw:L(c[0],c[3]),pitch:L(c[1],c[4]),zoom:L(c[2],c[5])}}
    else{const L=(key)=>s.from[key]+(s.to[key]-s.from[key])*k;
      const ek=s.from.explode!=null?Math.min(1,k/0.55):0;
      o={yaw:L("yaw"),pitch:L("pitch"),zoom:L("zoom"),explode:s.from.explode!=null?s.from.explode+(s.to.explode-s.from.explode)*sm(ek):0,hw:true,holes:true,open:!!s.open};
      o.mode=s.mode||(s.hwAt!=null&&k>=s.hwAt?"hw":"real");
      if(s.focus!=null) o.focus=s.focus;
      if(target){o.target=target;o.rad=s.rad}}
    const src=await pg.evaluate(([o])=>GL3D.capture(window.__cfg,Object.assign({w:1080,h:1920,edges:false},o)).img,[o]);
    fs.writeFileSync(path.join(dir,"f_"+String(ONE?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
    if(i%12===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
   }
   console.log(s.name,"gata",nf);
  }
 } else if(MODE==="extras"){
  /* foaia A3 a blatului (piesa „Top della cucina 1 A”): sagomatura pentru lavoar, locașurile Ø35, cotele */
  const blat=await pg.evaluate(()=>{closeSheets();const c=JSON.parse(JSON.stringify(proj().configs["Top della cucina 1 A"]));GL3D.render(c,{explode:0});const M=GL3D.model();const pc=M.ops.pieces.find(p=>p.role==="blat");return pc?partA3Svg(M,pc,5,1,1):null});
  if(!blat) throw new Error("nu găsesc piesa blat pentru foaia A3");
  const logo="data:image/png;base64,"+fs.readFileSync(path.join(root,"site/video/ebanist-logo-512.png")).toString("base64");
  /* pagina e golită: de aici e HTML simplu, deci capturile sunt rapide */
  await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent";
   const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)});
  const FF="font-family:Barlow,system-ui,sans-serif;";
  fs.mkdirSync(path.join(OUT,"ov"),{recursive:true});fs.mkdirSync(path.join(OUT,"sheet"),{recursive:true});
  const shot=async(file,html,opaque)=>{await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.body.style.background=o?"#0e3b2a":"transparent";document.documentElement.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);
   await pg.waitForFunction(()=>[...document.images].every(i=>i.complete));
   await pg.screenshot({path:file,omitBackground:!opaque})};
  const capHtml=(a,c)=>`<div style="${FF}position:fixed;left:14px;right:14px;bottom:88px;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.93);color:#fff;font-weight:700;font-size:26px;line-height:1.2;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)">${a}<div style="font-weight:500;font-size:18px;opacity:.88;margin-top:4px">${c}</div></div>`;
  for(const s of SEGS){
   if(s.card) await shot(path.join(OUT,"ov","card-"+s.name+".png"),`<div style="${FF}position:fixed;inset:0;background:linear-gradient(#0e3b2a,#082219);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:40px"><img src="${logo}" style="width:150px;height:150px;border-radius:34px;box-shadow:0 10px 40px rgba(0,0,0,.4)"><div style="font-weight:700;font-size:26px;letter-spacing:12px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:56px;line-height:1.05">${s.card[0]}</div><div style="font-weight:700;font-size:44px;color:#9be7b9">${s.card[1]}</div></div>`,true);
   if(s.title) await shot(path.join(OUT,"ov","title-"+s.name+".png"),`<div style="${FF}position:fixed;left:0;right:0;top:0;height:430px;background:linear-gradient(rgba(8,34,25,.92),rgba(8,34,25,0));color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;padding-top:44px;gap:10px"><img src="${logo}" style="width:84px;height:84px;border-radius:20px;box-shadow:0 6px 24px rgba(0,0,0,.4)"><div style="font-weight:700;font-size:20px;letter-spacing:10px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:76px;line-height:1">${T.hook1}</div><div style="font-weight:700;font-size:44px;color:#9be7b9">${T.hook2}</div></div>`);
   if(s.cap) await shot(path.join(OUT,"ov","cap-"+s.name+".png"),capHtml(s.cap[0],s.cap[1]));
   if(s.dimsCap){const c=PROJ.configs[s.cfg];await shot(path.join(OUT,"ov","cap-"+s.name+".png"),capHtml(s.dimsCap,`${c.L} × ${c.H} × ${c.P} mm`))}
  }
  await shot(path.join(OUT,"ov","sw.png"),`<div style="${FF}position:fixed;left:14px;top:16px;display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-radius:22px;background:rgba(255,255,255,.93);font-weight:700;font-size:19px;color:#0e3b2a;box-shadow:0 4px 16px rgba(0,0,0,.25)"><span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:50%;background:#5C7A99;border:2px solid rgba(0,0,0,.15)"></span>${T.m1}</span><span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:50%;background:#D8C39C;border:2px solid rgba(0,0,0,.15)"></span>${T.m2}</span></div>`);
  /* foaia blatului: zoom pe sagomatura pentru lavoar, apoi pe locașul Ø35 din detaliu */
  const sh2=SEGS.find(x=>x.sheet), nf=sh2.n;
  fs.rmSync(path.join(OUT,"sheet"),{recursive:true,force:true});fs.mkdirSync(path.join(OUT,"sheet"),{recursive:true});
  for(let i=0;i<nf;i++){
   const half=nf*0.55, first=i<half, kk=first?sm(i/half):sm((i-half)/(nf-half)), z=first?1+2.4*kk:3.4-0.4*kk, o=first?[24,17]:[24+4*kk,17+31*kk];
   await pg.evaluate(([svg,z,o])=>{document.body.innerHTML='<div style="position:fixed;inset:0;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="width:96vw;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transform-origin:'+o[0]+'% '+o[1]+'%;transform:scale('+z+')">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div></div>';document.body.style.background="#2f3430"},[blat,z,o]);
   await pg.screenshot({path:path.join(OUT,"sheet","f_"+String(i+1).padStart(4,"0")+".jpg"),type:"jpeg",quality:92});
  }
  console.log("extras gata");
 }
 await b.close();srv.close();
});
