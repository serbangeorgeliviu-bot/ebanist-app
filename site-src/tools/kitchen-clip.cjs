/* Clip TikTok „Novità: la Cucina” (≤ 20 s, 9:16, voce italiană nativă).
   Aplicația reală, proiectul demo test/golden/bucatarie-U-demo.json, cu uși în două culori.
     node site-src/tools/kitchen-clip.cjs stills     → un cadru pe scenă în vid-kitchen/stills (de verificat)
     node site-src/tools/kitchen-clip.cjs            → toate cadrele în vid-kitchen/seq
     node site-src/tools/kitchen-clip.cjs mux        → voce (Kokoro) + mp4 în vid-kitchen/ebanist-cucina-it.mp4
   Voce: KOKORO_DIR (implicit /tmp/tts/kokoro, cu kokoro-v1.0.onnx și voices-v1.0.bin), voce if_sara. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-kitchen");
const FPS=24, KOKORO=process.env.KOKORO_DIR||"/tmp/tts/kokoro", VOICE=process.env.KOKORO_VOICE||"if_sara";
const BASE="blue_avio_23196mn_19", WALL="rovere_wood_lime_classic_k2414ah_19", BODY="antracite_storm_grey_19";
const T={ hook1:"Novità",hook2:"la Cucina",
  s1:"Cucina a U · 27 moduli",s1b:"172 pezzi, tutti calcolati",
  s2:"Frigo, forno, lavastoviglie",s2b:"ogni nicchia su misura",
  s3:"Top a 45°",s3b:"con i tagli per lavello e piano",
  s4:"Distinta, disegni, montaggio",s4b:"tutto in un clic",
  end1:"Ebanist",end2:"Provalo gratis su ebanist.com",
  m1:"Blue Avio",m2:"Rovere Wood Lime" };
/* vocea: (secundă de început, secunde disponibile, text) */
const CUES=[
 [0.30,1.6,"Novità in Ebanist: la cucina."],
 [1.95,5.6,"Una cucina a U, ventisette moduli, centosettantadue pezzi."],
 [7.95,4.2,"Frigo, forno, lavastoviglie: ogni nicchia ha la sua misura."],
 [12.45,3.2,"Il top si taglia a quarantacinque gradi, con i fori per lavello e piano."],
 [15.95,2.0,"Distinta, disegni e montaggio."],
 [18.1,1.7,"Provalo gratis su ebanist punto com."]];
/* scene: sec, cam [yaw0,pitch0,zoom0,yaw1,pitch1,zoom1], open, overlay */
const SEGS=[
 {name:"hook",sec:1.8,card:[T.hook1,T.hook2],cam:[.5,.95,1.05,.2,.95,1.15]},
 {name:"tour",sec:6.0,cam:[-.6,1.0,1.1,.7,.75,1.25],cap:[T.s1,T.s1b],sw:true},
 {name:"front",sec:4.5,cam:[.35,.5,1.25,-.15,.4,1.5],cap:[T.s2,T.s2b]},
 {name:"top",sec:3.5,cam:[.4,1.4,1.3,-.1,1.15,1.7],cap:[T.s3,T.s3b]},
 {name:"sheet",sec:2.2,sheet:true,cap:[T.s4,T.s4b]},
 {name:"end",sec:1.8,card:[T.end1,T.end2]}];
const total=SEGS.reduce((a,s)=>a+s.sec,0);
if(total>20) throw new Error("clipul depășește 20 s: "+total);
const sm=k=>k*k*(3-2*k);

if(MODE==="mux"){
  const cues=CUES.map(([start,avail,text])=>({start,avail,text}));
  fs.writeFileSync(path.join(OUT,"cues.json"),JSON.stringify(cues));
  const wav=path.join(OUT,"voice.wav");
  cp.execFileSync(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(OUT,"cues.json"),wav,String(total),"kokoro:"+VOICE+":"+KOKORO+":it"],{stdio:"inherit"});
  const out=path.join(OUT,"ebanist-cucina-it.mp4");
  cp.execFileSync("ffmpeg",["-loglevel","error","-y","-framerate",String(FPS),"-i",path.join(OUT,"seq","s_%05d.jpg"),"-i",wav,
    "-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:a","aac","-b:a","160k","-ar","44100","-c:v","libx264","-crf","21","-preset","medium","-pix_fmt","yuv420p","-movflags","+faststart","-shortest",out],{stdio:"inherit"});
  console.log("gata",out);
  process.exit(0);
}

const STILLS=MODE==="stills";
const DEMO=JSON.parse(fs.readFileSync(path.join(root,"test/golden/bucatarie-U-demo.json"),"utf8"));
fs.rmSync(path.join(OUT,STILLS?"stills":"seq"),{recursive:true,force:true});
fs.mkdirSync(path.join(OUT,STILLS?"stills":"seq"),{recursive:true});
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8802,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(120000);
 await pg.goto("http://localhost:8802/app/index.html?lang=it");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 /* proiectul demo, două culori: baza și coloanele Blue Avio, pensilele Rovere */
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
 if(!cached) fs.writeFileSync(CACHE,JSON.stringify(await pg.evaluate(()=>proj())));
 if(!info.ok) throw new Error("bucătăria nu s-a aplicat: "+info.err);
 const sheets=await pg.evaluate(()=>{closeSheets();return packBuild(proj(),{cover:true,client:false,report:false,elev:true,asm:true,parts:false})});
 console.log("foi A3:",sheets.length,JSON.stringify(sheets.map((x,i)=>i+":"+((x.match(/<text[^>]*>([^<]{3,40})</g)||[]).slice(0,3).join("|").replace(/<text[^>]*>/g,"")))).slice(0,1800));
 await pg.evaluate(()=>{
   setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");
   const st=document.createElement("style");st.textContent="#bldView .vbtns,#bldView button,#bldView .vctl,.vp-full .topbar,.vp-full header,.vp-full nav,.vp-full .tabbar,.vp-full .bnav,#buildInfo{display:none!important}";document.head.appendChild(st);
   GL3D.resize();
   const bx=roomBoxes(),RL=roomLayout(),floor=RL.frames.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
   GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
   GL3D.render({matBody:state.settings.matBody,matFront:state.settings.matFront},{boxes:bx,room:{floor}});
   /* capture() randează un singur cadru, cu camera fixată pe loc; îl învățăm să primească camera (cutii + podea) */
   const BX=bx,FL=floor,r0=GL3D.render;
   GL3D.render=function(cfg,o){return r0.call(this,cfg,Object.assign({},o,{boxes:BX,room:{floor:FL}}))};
   const im=document.createElement("img");im.id="vimg";im.style.cssText="position:fixed;inset:0;width:100vw;height:100vh;object-fit:cover;z-index:2147483000";document.body.appendChild(im);
 });
 await pg.waitForTimeout(1500);
 const CFG={matBody:BODY,matFront:BASE};
 const frame3d=async(yaw,pitch,zoom,open)=>{const src=await pg.evaluate(([cfg,yaw,pitch,zoom,open])=>GL3D.capture(cfg,{w:1080,h:1920,yaw,pitch,zoom,open,hw:false,edges:false}).img,[CFG,yaw,pitch,zoom,open]);
   await pg.evaluate(src=>new Promise(r=>{const i=document.getElementById("vimg");i.onload=r;i.src=src}),src)};
 const FF="font-family:Barlow,system-ui,sans-serif;";
 const ov=async(id,html,css)=>pg.evaluate(([id,html,css])=>{let d=document.getElementById(id);if(!d){d=document.createElement("div");d.id=id;d.style.cssText=css;document.body.appendChild(d)}d.innerHTML=html;d.style.visibility=html?"visible":"hidden"},[id,html,css]);
 const card=(a,c)=>ov("vcard",a?`<div style="font:700 26px Barlow;letter-spacing:10px;opacity:.8">EBANIST</div><div style="font:800 62px/1.05 Barlow">${a}</div><div style="font:600 34px/1.2 Barlow;opacity:.95">${c||""}</div>`:"","position:fixed;inset:0;z-index:2147483646;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:40px;"+FF);
 const cap=(a,c)=>ov("vcap",a?a+(c?`<div style="font:500 18px Barlow;opacity:.88;margin-top:4px">${c}</div>`:""):"","position:fixed;left:14px;right:14px;bottom:88px;z-index:2147483647;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.93);color:#fff;font:700 26px/1.2 Barlow,system-ui,sans-serif;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)");
 const sw=(on)=>ov("vsw",on?`<span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:50%;background:#5C7A99;border:2px solid rgba(0,0,0,.15)"></span>${T.m1}</span><span style="display:flex;align-items:center;gap:8px"><span style="width:20px;height:20px;border-radius:50%;background:#D8C39C;border:2px solid rgba(0,0,0,.15)"></span>${T.m2}</span>`:"","position:fixed;left:14px;top:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;padding:10px 16px;border-radius:22px;background:rgba(255,255,255,.93);font:700 19px Barlow,system-ui,sans-serif;color:#0e3b2a;box-shadow:0 4px 16px rgba(0,0,0,.25)");
 const sheet=(svg,k,orig)=>pg.evaluate(([svg,k,orig])=>{let d=document.getElementById("vsheet");if(!d){d=document.createElement("div");d.id="vsheet";d.style.cssText="position:fixed;inset:0;z-index:2147483645;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden";document.body.appendChild(d)}
   if(!svg){d.style.display="none";return}d.style.display="flex";
   if(d.dataset.s!==String(svg.length)){d.dataset.s=String(svg.length);d.innerHTML='<div id="vsh" style="width:96vw;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div>'}
   const s=document.getElementById("vsh");s.style.transformOrigin=orig[0]+"% "+orig[1]+"%";s.style.transform="scale("+k+")"},[svg,k,orig]);
 let n=0;
 for(const [si,s] of SEGS.entries()){
  const nf=Math.round(s.sec*FPS);
  await card(s.card?s.card[0]:"",s.card?s.card[1]:"");
  await cap(s.cap?s.cap[0]:"",s.cap?s.cap[1]:"");await sw(!!s.sw);
  if(!s.sheet) await sheet(null);
  for(let i=0;i<nf;i++){
   if(STILLS&&i!==Math.floor(nf*0.6)) continue;
   const k=nf>1?sm(i/(nf-1)):0;
   if(s.sheet){await sheet(sheets[i<nf/2?0:2],i<nf/2?1+0.7*sm(i/(nf/2)):1+0.7*sm((i-nf/2)/(nf/2)),i<nf/2?[40,35]:[45,40])}
   else if(s.cam){const c=s.cam;await frame3d(c[0]+(c[3]-c[0])*k,c[1]+(c[4]-c[1])*k,c[2]+(c[5]-c[2])*k,!!s.open&&i>=6)}
   n++;
   const f=STILLS?path.join(OUT,"stills",String(si+1).padStart(2,"0")+"-"+s.name+".jpg"):path.join(OUT,"seq","s_"+String(n).padStart(5,"0")+".jpg");
   await pg.screenshot({path:f,type:"jpeg",quality:92});
  }
  console.log(s.name,"cadre",nf,"total",n);
 }
 await b.close();srv.close();
});
