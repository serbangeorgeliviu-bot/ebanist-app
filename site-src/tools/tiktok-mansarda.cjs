/* Film TikTok „Mansarda" (IT): dulapul sub tavanul înclinat (D-86), din aplicația reală.
   node site-src/tools/tiktok-mansarda.cjs frames   → vid-tt/mansarda/frames/f_*.jpg + timeline.json (RESUME=1 sare peste cadrele existente)
   node site-src/tools/tiktok-mansarda.cjs compose  → vid-tt/ebanist-tiktok-mansarda-it.mp4, 1080×1920, 24 fps
   Vocea: PIPER_PY=<python cu kokoro_onnx> PIPER_VOICE=kokoro:im_nicola:<dir kokoro>:it (vezi tiktok-voice.py). */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"compose", L="it", root=path.resolve(__dirname,"../.."), BASE=path.join(root,"vid-tt","mansarda"), FR=path.join(BASE,"frames");
const FPS=24, W=1080, H=1920;
const T={h1:"Armadio in mansarda?",h2:"Il soffitto scende. Il mobile lo segue.",
 c1:"Due altezze: sinistra e destra",c2:"Fianchi, cielo e schiena seguono la pendenza",c3:"Ante trapezoidali, parallele al soffitto",c4:"E si aprono anche sotto la falda",
 c5:"Cielo misurato sulla pendenza, capi tagliati ad angolo",c6:"Dossier tecnico A3 con un clic",c7:"Prospetto quotato, con la pendenza",c8:"Montaggio passo per passo",
 m1:"2400 → 1400 mm · 26,6°",e1:"Ebanist",e2:"Provalo gratis su ebanist.com",e3:"Pro: esportazioni e fogli A3"};
const VOICE={hook:"Armadio in mansarda? Il mobile segue il soffitto.",c1:"Scrivi due altezze, sinistra e destra. L'angolo lo calcola Ebanist.",
 c2:"Fianchi, cielo e schiena seguono la pendenza.",c3:"Ante trapezoidali, parallele al soffitto.",c4:"E si aprono, anche sotto la falda.",
 c5:"Il cielo segue la pendenza, tagliato ad angolo.",c6:"Dossier tecnico A3, con un clic.",c7:"Prospetto quotato, con la pendenza.",
 c8:"E il montaggio, passo per passo.",end:"Ebanist. Provalo gratis su ebanist punto com."};
const H0=2400, H1=1400;
const CFG={name:"Mansarda",L:2000,H:H0,P:600,drawers:0,doors:4,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"rovere_wood_lime_classic_k2414ah_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"},topProfile:{axis:"x",h0:H0,h1:H1}};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8798,async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:MODE==="frames"?{width:540,height:960}:{width:W,height:H},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage(); pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200))); pg.setDefaultTimeout(60000);
 await pg.goto("http://localhost:8798/app/index.html?lang="+L);await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 /* proiectul: un singur corp sub pantă, numele lui apare pe foile A3 */
 await pg.evaluate(c=>{closeSheets();const q=proj();q.pieces=[];q.configs={};q.layout={};q.name="Mansarda — armadio sotto falda";
   window.__cfg={...PRESETS.armadio,...c};generateInto(q,window.__cfg);persist();setView("build");GL3D.render(window.__cfg,{explode:0});},CFG);
 await pg.waitForTimeout(1500);
 if(MODE==="frames") await frames(pg); else await compose(pg);
 await b.close();srv.close();});

/* partea 1: cadrele 3D, câte unul, prin GL3D.capture (nu depind de viteza GPU) */
async function frames(pg){
 fs.mkdirSync(FR,{recursive:true});
 const lerp=(a,b,k)=>a+(b-a)*k, sm=k=>k*k*(3-2*k);
 /* segmente: sec, cfg(k) = cfg la progresul k, st = stare 3D, cam = [yaw,pitch,zoom] început → sfârșit */
 const segs=[
  {name:"slope",sec:4.5,cfg:k=>{const t=Math.min(1,Math.max(0,(k-.12)/.8)), h1=Math.round(lerp(H0,H1,sm(t)));return {topProfile:H0-h1<30?null:{axis:"x",h0:H0,h1}}}   /* sub 30 mm motorul nu primește panta: corpul drept */,st:{open:false,hw:false},cam:[.18,.1,1.5,.3,.14,1.45],cap:"c1",swatch:"m1"},
  {name:"orbit",sec:3.4,cfg:()=>({}),st:{open:false,hw:false},cam:[.3,.14,1.45,-.75,.32,1.5],cap:"c2"},
  {name:"doors",sec:3.0,cfg:()=>({}),st:{open:false,hw:false},cam:[-.35,.08,1.55,.12,.04,1.8],cap:"c3"},
  {name:"open",sec:3.4,cfg:()=>({}),st:{open:true,hw:true},cam:[.15,.12,1.35,-.55,.26,1.5],cap:"c4"},
  {name:"explode",sec:3.8,cfg:()=>({}),st:{open:false,hw:false,explode:.6},cam:[.35,.28,1.45,.75,.3,1.55],cap:"c5"}];
 const tl=[]; let idx=0, t0=Date.now();
 for(const s of segs){
  const n=Math.round(s.sec*FPS), first=idx+1;
  let warm=true;   /* prima captură după o schimbare de stare iese cu un cadru în urmă: o aruncăm */
  for(let i=0;i<n;i++){
   const fn=path.join(FR,"f_"+String(idx+1).padStart(5,"0")+".jpg");
   if(process.env.RESUME&&fs.existsSync(fn)){idx++;continue}
   const k=n>1?i/(n-1):0, e=sm(k), c=s.cam;
   const cap=()=>pg.evaluate(([patch,st,cam,W,H])=>{GL3D.focusOn(null);const cfg={...window.__cfg,...patch};
     return GL3D.capture(cfg,{w:W,h:H,yaw:cam[0],pitch:cam[1],zoom:cam[2],hw:st.hw,open:st.open,explode:st.explode||0,edges:false}).img;
   },[s.cfg(k),s.st,[lerp(c[0],c[3],e),lerp(c[1],c[4],e),lerp(c[2],c[5],e)],W,H]);
   if(warm){await cap();warm=false}
   const img=await cap();
   idx++; fs.writeFileSync(fn,Buffer.from(img.split(",")[1],"base64"));
  }
  tl.push({name:s.name,first,n:idx-first+1,cap:s.cap,swatch:s.swatch||null});
  console.log(s.name,idx,Math.round((Date.now()-t0)/1000)+"s");
 }
 fs.writeFileSync(path.join(BASE,"timeline.json"),JSON.stringify({fps:FPS,w:W,h:H,segs:tl}));
}

/* partea 2: carduri, foile A3 animate, textele suprapuse, vocea, mp4-ul */
async function compose(pg){
 const TL=JSON.parse(fs.readFileSync(path.join(BASE,"timeline.json"),"utf8")), D=path.join(BASE,L);
 fs.rmSync(D,{recursive:true,force:true});fs.mkdirSync(path.join(D,"seq"),{recursive:true});fs.mkdirSync(path.join(D,"ov"),{recursive:true});
 const sheets=await pg.evaluate(()=>{closeSheets();return packBuild(proj(),{cover:true,client:false,report:false,elev:true,asm:true,parts:true})});
 await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent"});
 const shot=async(file,html,opaque)=>{await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.documentElement.style.background=o?"#0e3b2a":"transparent";document.body.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);await pg.screenshot({path:file,omitBackground:!opaque,type:"png"})};
 const F="font-family:Barlow,system-ui,sans-serif;";
 const card=(a,bb,c)=>`<div style="${F}position:fixed;inset:0;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:90px"><div style="font-weight:700;font-size:44px;letter-spacing:20px;opacity:.8">EBANIST</div><div style="font-weight:800;font-size:112px;line-height:1.05">${a}</div><div style="font-weight:500;font-size:56px;line-height:1.2;opacity:.92">${bb}</div>${c?`<div style="margin-top:30px;font-weight:700;font-size:46px;color:#d9c9a3">${c}</div>`:""}</div>`;
 await shot(path.join(D,"card-hook.png"),card(T.h1,T.h2),true);
 await shot(path.join(D,"card-end.png"),card(T.e1,T.e2,T.e3),true);
 for(const k of ["c1","c2","c3","c4","c5","c6","c7","c8"]) await shot(path.join(D,"ov","cap-"+k+".png"),`<div style="${F}position:fixed;left:50px;right:50px;bottom:230px;padding:30px 38px;border-radius:34px;background:rgba(14,59,42,.93);color:#fff;font-weight:700;font-size:62px;line-height:1.15;text-align:center;box-shadow:0 14px 50px rgba(0,0,0,.4)">${T[k]}</div>`);
 await shot(path.join(D,"ov","sw-m1.png"),`<div style="${F}position:fixed;left:50px;top:70px;display:flex;align-items:center;gap:22px;padding:18px 34px;border-radius:70px;background:rgba(255,255,255,.94);font-weight:700;font-size:50px;color:#0e3b2a;box-shadow:0 10px 36px rgba(0,0,0,.28)">${T.m1}</div>`);
 /* foile A3, animate: coperta, prospectul (ușile trapezoidale, cotate), montajul explodat */
 const sheetSeg=async(name,svg,sec,o0,s0,s1,cap)=>{
   const n=Math.round(sec*FPS);
   await pg.evaluate(([svg])=>{document.body.innerHTML='<div id="stage" style="position:fixed;inset:0;background:#2f3430;overflow:hidden"><div id="sh" style="position:absolute;left:40px;top:50%;width:1000px;margin-top:-353px;background:#fff;box-shadow:0 20px 80px rgba(0,0,0,.55)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div></div>'},[svg]);
   for(let i=0;i<n;i++){const k=n>1?i/(n-1):0,e=k*k*(3-2*k),s=s0+(s1-s0)*e;
     await pg.evaluate(([s,o0])=>{const el=document.getElementById("sh");el.style.transformOrigin=o0[0]+"% "+o0[1]+"%";el.style.transform="scale("+s+")"},[s,o0]);
     await pg.screenshot({path:path.join(D,"sheet-"+name+"-"+String(i).padStart(3,"0")+".jpg"),type:"jpeg",quality:92});}
   return {name,n,cap};
 };
 const segS=[];
 segS.push(await sheetSeg("cover",sheets[0],2.6,[30,30],1,2.0,"c6"));
 segS.push(await sheetSeg("elev",sheets[1],3.0,[22,45],1,2.4,"c7"));
 segS.push(await sheetSeg("asm",sheets[2],2.6,[30,40],1,2.0,"c8"));
 /* secvența: card, cadre 3D, foi, card */
 let n=0; const add=(file,times=1)=>{for(let i=0;i<times;i++){n++;fs.copyFileSync(file,path.join(D,"seq","s_"+String(n).padStart(5,"0")+".jpg"))}};
 const jpg=(png)=>{const j=png.replace(/\.png$/,".jpg");cp.execFileSync("ffmpeg",["-loglevel","error","-y","-i",png,"-q:v","2",j]);return j};
 const hook=jpg(path.join(D,"card-hook.png")), end=jpg(path.join(D,"card-end.png")), HOOK=3.4, END=3.4;
 const marks=[];
 add(hook,Math.round(HOOK*FPS));
 for(const s of TL.segs){const f0=n+1;for(let i=0;i<s.n;i++)add(path.join(FR,"f_"+String(s.first+i).padStart(5,"0")+".jpg"));marks.push({from:f0,to:n,cap:s.cap,sw:s.swatch})}
 for(const s of segS){const f0=n+1;for(let i=0;i<s.n;i++)add(path.join(D,"sheet-"+s.name+"-"+String(i).padStart(3,"0")+".jpg"));marks.push({from:f0,to:n,cap:s.cap,sw:null})}
 add(end,Math.round(END*FPS));
 /* vocea: o replică la începutul fiecărui segment */
 let voiceFile=null;
 if(process.env.PIPER_VOICE){
   const cues=[{start:0.3,avail:HOOK-0.4,text:VOICE.hook}];
   marks.forEach(m=>cues.push({start:(m.from-1)/FPS+0.12,avail:(m.to-m.from+1)/FPS-0.2,text:VOICE[m.cap]}));
   cues.push({start:(n-Math.round(END*FPS))/FPS+0.3,avail:END-0.4,text:VOICE.end});
   fs.writeFileSync(path.join(D,"cues.json"),JSON.stringify(cues));
   voiceFile=path.join(D,"voice.wav");
   cp.execFileSync(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(D,"cues.json"),voiceFile,String(n/FPS),process.env.PIPER_VOICE],{stdio:"inherit"});
 }
 const ins=["-framerate",String(FPS),"-i",path.join(D,"seq","s_%05d.jpg")], fc=[]; let last="0:v", ii=0;
 const ovs=[];marks.forEach(m=>{if(m.cap)ovs.push({f:path.join(D,"ov","cap-"+m.cap+".png"),a:(m.from-1)/FPS,b:m.to/FPS});if(m.sw)ovs.push({f:path.join(D,"ov","sw-"+m.sw+".png"),a:(m.from-1)/FPS,b:m.to/FPS})});
 ovs.forEach(o=>{ins.push("-loop","1","-i",o.f);ii++;const out="v"+ii;fc.push(`[${last}][${ii}:v]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})'[${out}]`);last=out});
 const outFile=path.join(root,"vid-tt","ebanist-tiktok-mansarda-"+L+".mp4");
 if(voiceFile) ins.push("-i",voiceFile);
 cp.execFileSync("ffmpeg",["-loglevel","error","-y",...ins,"-filter_complex",fc.join(";"),"-map","["+last+"]",...(voiceFile?["-map",(ii+1)+":a","-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:a","aac","-b:a","160k","-ar","44100"]:[]),"-r",String(FPS),"-c:v","libx264","-crf","20","-preset","slow","-pix_fmt","yuv420p","-movflags","+faststart","-shortest",outFile],{stdio:"inherit"});
 console.log("gata",outFile,"cadre",n,"sec",(n/FPS).toFixed(1));
}
