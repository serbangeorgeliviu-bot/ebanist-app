/* Clip TikTok „Novità: la Cucina” (≤ 20 s, 9:16, voce italiană nativă).
   Aplicația reală, proiectul demo test/golden/bucatarie-U-demo.json, cu uși în două culori.
   Etape (ieșire în vid-kitchen/, ignorat de git):
     node site-src/tools/kitchen-clip.cjs frames   cadrele 3D, direct din GL3D.capture (≈ 2 s / cadru) → seq/<scenă>/
     node site-src/tools/kitchen-clip.cjs extras   carduri, texte (PNG transparent), foile A3 animate → ov/, sheet/
     node site-src/tools/kitchen-clip.cjs mux      vocea (Kokoro) + ffmpeg → ebanist-cucina-it.mp4
   Un singur cadru pe scenă, pentru verificare: `frames 1`.
   Cadrele randate se întind pe durata scenei (framerate de intrare = cadre / secunde), deci durata unei scene se schimbă fără re-randare.
   Voce: KOKORO_DIR (implicit /tmp/tts/kokoro, cu kokoro-v1.0.onnx și voices-v1.0.bin), voce im_nicola (D-145: vocea fixă a clipurilor Ebanist). */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames", ONE=process.argv[3]==="1", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-kitchen");
const FPS=24, KOKORO=process.env.KOKORO_DIR||"/tmp/tts/kokoro", VOICE=process.env.KOKORO_VOICE||"im_nicola";
const BASE="blue_avio_23196mn_19", WALL="rovere_wood_lime_classic_k2414ah_19", BODY="antracite_storm_grey_19";
const T={ hook1:"Novità",hook2:"la Cucina",
  s1:"Cucina a U · 27 moduli",s1b:"172 pezzi, tutti calcolati",
  s2:"Basi, pensili, cappa, lavello",s2b:"ogni modulo su misura",
  s3:"Top a 45°",s3b:"con i tagli per lavello e piano",
  s4:"Distinta, disegni, montaggio",s4b:"tutto in un clic",
  end1:"Ebanist",end2:"Provalo gratis su ebanist.com",
  m1:"Blue Avio",m2:"Rovere Wood Lime" };
/* vocea: [secundă de început, secunde disponibile, text] */
const CUES=[
 [0.10,2.2,"Novità Ebanist: la cucina."],
 [2.50,3.9,"Cucina a U, ventisette moduli, centosettantadue pezzi."],
 [6.70,3.4,"Basi, pensili, cappa e lavello, tutto su misura."],
 [10.40,3.9,"Top a quarantacinque gradi, con i tagli per lavello e piano."],
 [14.60,2.6,"Distinta, disegni e montaggio."],
 [17.25,2.7,"Provalo gratis su ebanist punto com."]];
/* scene: sec; cam = [yaw,pitch,zoom] la început și la sfârșit; card / cap / sw / sheet */
const SEGS=[
 {name:"hook",sec:2.4,card:[T.hook1,T.hook2]},
 {name:"tour",sec:4.2,cam:[-.6,1.0,1.1,.7,.75,1.25],cap:[T.s1,T.s1b],sw:true},
 {name:"front",sec:3.7,cam:[.35,.5,1.25,-.15,.4,1.5],cap:[T.s2,T.s2b]},
 {name:"top",sec:4.2,cam:[.4,1.4,1.3,-.1,1.15,1.7],cap:[T.s3,T.s3b]},
 {name:"sheet",sec:2.7,sheet:true,cap:[T.s4,T.s4b]},
 {name:"end",sec:2.75,card:[T.end1,T.end2]}];
const total=SEGS.reduce((a,s)=>a+s.sec,0);
if(total>20) throw new Error("clipul depășește 20 s: "+total);
const sm=k=>k*k*(3-2*k), nfOf=s=>Math.round(s.sec*FPS);
fs.mkdirSync(OUT,{recursive:true});
function sh(cmd,args){cp.execFileSync(cmd,args,{stdio:"inherit"})}

if(MODE==="mux"){
  const cues=CUES.map(([start,avail,text])=>({start,avail,text}));
  fs.writeFileSync(path.join(OUT,"cues.json"),JSON.stringify(cues));
  const wav=path.join(OUT,"voice.wav");
  sh(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(OUT,"cues.json"),wav,String(total),"kokoro:"+VOICE+":"+KOKORO+":it"]);
  const enc=["-r",String(FPS),"-c:v","libx264","-crf","21","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)];
  const parts=[];
  SEGS.forEach((s,i)=>{
    const n=nfOf(s), pf=path.join(OUT,"part-"+i+".mp4"), a=["-loglevel","error","-y"];
    const fc=[]; let last="0:v", k=1;
    if(s.card) a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov","card-"+s.name+".png"));
    else if(s.sheet) a.push("-framerate",String(Math.min(FPS*2,fs.readdirSync(path.join(OUT,"sheet")).length/s.sec)),"-i",path.join(OUT,"sheet","f_%04d.jpg"));
    else a.push("-framerate",String(fs.readdirSync(path.join(OUT,"seq",s.name)).length/s.sec),"-i",path.join(OUT,"seq",s.name,"f_%04d.jpg"));
    const ovs=[]; if(s.cap) ovs.push("cap-"+s.name); if(s.sw) ovs.push("sw");
    ovs.forEach(o=>{a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",o+".png"));fc.push(`[${last}][${k}:v]overlay=0:0:shortest=1[o${k}]`);last="o"+k;k++});
    if(fc.length) a.push("-filter_complex",fc.join(";"),"-map","["+last+"]");
    a.push("-frames:v",String(n),...enc,pf); sh("ffmpeg",a); parts.push(pf);
  });
  const lst=path.join(OUT,"parts.txt"); fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const silent=path.join(OUT,"silent.mp4"); sh("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",silent]);
  const out=path.join(OUT,"ebanist-cucina-it.mp4");
  sh("ffmpeg",["-loglevel","error","-y","-i",silent,"-i",wav,"-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:v","copy","-c:a","aac","-b:a","160k","-ar","44100","-movflags","+faststart","-shortest",out]);
  console.log("gata",out,total.toFixed(1)+" s");
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
 if(!cached) fs.writeFileSync(CACHE,JSON.stringify(await pg.evaluate(()=>proj())));

 if(MODE==="frames"){
  await pg.evaluate(()=>{
   setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();
   const bx=roomBoxes(),RL=roomLayout(),floor=RL.frames.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
   GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
   /* capture() randează un singur cadru, cu camera fixată pe loc; îl învățăm să primească camera (cutii + podea) */
   const r0=GL3D.render;GL3D.render=function(cfg,o){return r0.call(this,cfg,Object.assign({},o,{boxes:bx,room:{floor}}))};
  });
  await pg.waitForTimeout(1500);
  const CFG={matBody:BODY,matFront:BASE};
  for(const s of SEGS.filter(x=>x.cam)){
   const dir=path.join(OUT,"seq",s.name); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
   const nf=nfOf(s), t0=Date.now();
   for(let i=0;i<nf;i++){
    if(ONE&&i!==Math.floor(nf*.6)) continue;
    const k=nf>1?sm(i/(nf-1)):0, c=s.cam, L=(a,b)=>a+(b-a)*k;
    const src=await pg.evaluate(([cfg,y,p,z])=>GL3D.capture(cfg,{w:1080,h:1920,yaw:y,pitch:p,zoom:z,hw:false,edges:false}).img,[CFG,L(c[0],c[3]),L(c[1],c[4]),L(c[2],c[5])]);
    fs.writeFileSync(path.join(dir,"f_"+String(ONE?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
    if(i%24===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
   }
   console.log(s.name,"gata",nf);
  }
 } else if(MODE==="extras"){
  const sheets=await pg.evaluate(()=>{closeSheets();return packBuild(proj(),{cover:true,client:false,report:false,elev:true,asm:true,parts:false})});
  /* pagina e golită: de aici e HTML simplu, deci capturile sunt rapide */
  await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent";
   const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)});
  const FF="font-family:Barlow,system-ui,sans-serif;";
  fs.mkdirSync(path.join(OUT,"ov"),{recursive:true});fs.mkdirSync(path.join(OUT,"sheet"),{recursive:true});
  const shot=async(file,html,opaque)=>{await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.body.style.background=o?"#0e3b2a":"transparent";document.documentElement.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);
   await pg.screenshot({path:file,omitBackground:!opaque})};
  const card=(a,c)=>`<div style="${FF}position:fixed;inset:0;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:40px"><div style="font-weight:700;font-size:26px;letter-spacing:10px;opacity:.8">EBANIST</div><div style="font-weight:800;font-size:62px;line-height:1.05">${a}</div><div style="font-weight:600;font-size:34px;line-height:1.2;opacity:.95">${c||""}</div></div>`;
  for(const s of SEGS){
   if(s.card) await shot(path.join(OUT,"ov","card-"+s.name+".png"),card(s.card[0],s.card[1]),true);
   if(s.cap) await shot(path.join(OUT,"ov","cap-"+s.name+".png"),`<div style="${FF}position:fixed;left:14px;right:14px;bottom:88px;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.93);color:#fff;font-weight:700;font-size:26px;line-height:1.2;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)">${s.cap[0]}<div style="font-weight:500;font-size:18px;opacity:.88;margin-top:4px">${s.cap[1]}</div></div>`);
  }
  await shot(path.join(OUT,"ov","sw.png"),`<div style="${FF}position:fixed;left:14px;top:16px;display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-radius:22px;background:rgba(255,255,255,.93);font-weight:700;font-size:19px;color:#0e3b2a;box-shadow:0 4px 16px rgba(0,0,0,.25)"><span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:50%;background:#5C7A99;border:2px solid rgba(0,0,0,.15)"></span>${T.m1}</span><span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:50%;background:#D8C39C;border:2px solid rgba(0,0,0,.15)"></span>${T.m2}</span></div>`);
  /* foile A3: coperta, apoi vederea explodată, cu zoom lent */
  const sh2=SEGS.find(x=>x.sheet), nf=nfOf(sh2);
  for(let i=0;i<nf;i++){
   const half=nf/2, first=i<half, kk=first?sm(i/half):sm((i-half)/half), svg=sheets[first?0:2], z=1+0.7*kk, o=first?[40,35]:[45,40];
   await pg.evaluate(([svg,z,o])=>{document.body.innerHTML='<div style="position:fixed;inset:0;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="width:96vw;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transform-origin:'+o[0]+'% '+o[1]+'%;transform:scale('+z+')">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div></div>';document.body.style.background="#2f3430"},[svg,z,o]);
   await pg.screenshot({path:path.join(OUT,"sheet","f_"+String(i+1).padStart(4,"0")+".jpg"),type:"jpeg",quality:92});
  }
  console.log("extras gata, foi:",sheets.length);
 }
 await b.close();srv.close();
});
