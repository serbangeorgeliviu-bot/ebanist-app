/* Clip TikTok „Esplode e si rimonta” (≈ 18 s, 9:16, voce italiană nativă Nicola).
   Ideea: două module care se desfac piesă cu piesă și se reasamblează în buclă → bucătăria în U → contorul de piese → card.
   Aplicația reală, proiectul demo test/golden/bucatarie-U-demo.json, cu uși în două culori (aceeași pregătire ca `kitchen-clip.cjs`).
   Etape (ieșire în vid-boom/, ignorat de git):
     node site-src/tools/kitchen-boom-clip.cjs frames [1]   cadrele 3D (GL3D.capture) → seq/<scenă>/ ; `frames 1` = un cadru pe scenă în seq1/
     node site-src/tools/kitchen-boom-clip.cjs extras       titlu, texte, card (PNG) → ov/
     node site-src/tools/kitchen-boom-clip.cjs mux          vocea (Kokoro) + ffmpeg → ebanist-boom-it.mp4
   Numărul de piese din contor e cel al proiectului (info.json, scris la `frames`), nu o cifră scrisă de mână; replica vorbită îl rostește din același număr.
   Voce: KOKORO_DIR (implicit /tmp/tts/kokoro), voce im_nicola, python din PIPER_PY (venv cu kokoro-onnx). */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames", ONE=process.argv[3]==="1", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-boom");
const FPS=24, KOKORO=process.env.KOKORO_DIR||"/tmp/tts/kokoro", VOICE=process.env.KOKORO_VOICE||"im_nicola";
const BASE="blue_avio_23196mn_19", WALL="rovere_wood_lime_classic_k2414ah_19", BODY="antracite_storm_grey_19";
const FONT="/usr/share/fonts/opentype/inter/Inter-Black.otf";
const T={ h1:"Un mobile", h2:"pezzo per pezzo", s2:"Ogni pezzo, calcolato", s3:"Cucina a U · 27 moduli", pz:"pezzi", end1:"Provalo gratis", end2:"ebanist.com" };
/* scene. exp = bucla de explozie (0 → vârf → 0); room = camera bucătăriei; counter = contor drawtext peste cadrele camerei */
const SEGS=[
 {name:"boom1",kind:"mod",sec:4.8,cfg:"Base lavello 1.3",from:{yaw:.2,pitch:.3,zoom:.95},to:{yaw:1.0,pitch:.26,zoom:1.0},peak:.95,title:1.9,dimsCap:"Base lavello"},
 {name:"boom2",kind:"mod",sec:3.6,cfg:"Colonna forno (+ microonde) 3.6",from:{yaw:-.4,pitch:.25,zoom:1.0},to:{yaw:.5,pitch:.22,zoom:1.05},peak:.9,dimsCap:"Colonna forno e microonde"},
 {name:"tour",kind:"room",sec:4.0,cam:[-.5,1.05,1.0,.6,.8,1.1],cap:[T.s3,""]},
 {name:"count",kind:"room",sec:3.2,cam:[.6,.8,1.1,.95,.75,1.2],counter:true},
 {name:"end",sec:2.6,card:[T.end1,T.end2]}];
const sm=k=>k*k*(3-2*k), nfOf=s=>Math.round(s.sec*FPS);
let cum=0; for(const s of SEGS){s.t0=cum/FPS; s.n=nfOf(s); cum+=s.n}
const total=cum/FPS;
if(total>20) throw new Error("clipul depășește 20 s: "+total);
fs.mkdirSync(OUT,{recursive:true});
function sh(cmd,args){cp.execFileSync(cmd,args,{stdio:"inherit"})}
const segOf=n=>SEGS.find(s=>s.name===n);
const IT_UNITS=["zero","uno","due","tre","quattro","cinque","sei","sette","otto","nove","dieci","undici","dodici","tredici","quattordici","quindici","sedici","diciassette","diciotto","diciannove"];
const IT_TENS=["","","venti","trenta","quaranta","cinquanta","sessanta","settanta","ottanta","novanta"];
function itNum(n){ /* 0–999, forma parlată corectă (elisiuni: ventuno, centottanta) */
  if(n<20) return IT_UNITS[n];
  if(n<100){const t=Math.floor(n/10),u=n%10;let w=IT_TENS[t];if(u===1||u===8)w=w.slice(0,-1);return w+(u?(u===3?"tré":IT_UNITS[u]):"")}
  const c=Math.floor(n/100),r=n%100;let w=(c===1?"cento":IT_UNITS[c]+"cento");
  if(r===0) return w; if(r>=80&&r<90) w=w.slice(0,-1);
  return w+itNum(r)}

if(MODE==="mux"){
  const info=JSON.parse(fs.readFileSync(path.join(OUT,"info.json"),"utf8")), N=info.pieces;
  const cues=[["boom1",0.15,"Un mobile, pezzo per pezzo."],["boom2",0.20,"Ogni pezzo, calcolato."],["tour",0.15,"Una cucina a U intera."],
    ["count",0.30,itNum(N)+" pezzi, tutti calcolati."],["end",0.15,"Provalo gratis su ebanist punto com."]]
    .map(([n,off,text])=>({start:segOf(n).t0+off,avail:segOf(n).sec-off,text}));
  fs.writeFileSync(path.join(OUT,"cues.json"),JSON.stringify(cues));
  const wav=path.join(OUT,"voice.wav");
  sh(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(OUT,"cues.json"),wav,String(total),"kokoro:"+VOICE+":"+KOKORO+":it"]);
  const enc=["-r",String(FPS),"-c:v","libx264","-crf","21","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)];
  const parts=[];
  SEGS.forEach((s,i)=>{
    const n=s.n, d=n/FPS, pf=path.join(OUT,"part-"+i+".mp4"), a=["-loglevel","error","-y"];
    const fc=[]; let last="0:v", k=1;
    if(s.card) a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov","card-"+s.name+".png"));
    else a.push("-framerate",String(fs.readdirSync(path.join(OUT,"seq",s.name)).length/s.sec),"-i",path.join(OUT,"seq",s.name,"f_%04d.jpg"));
    const ovs=[]; const tt=s.title||0;
    if(tt) ovs.push({f:"title-"+s.name,a:0,b:tt});
    if(s.cap||s.dimsCap) ovs.push({f:"cap-"+s.name,a:tt,b:d});
    ovs.forEach(o=>{a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",o.f+".png"));
      fc.push(`[${k}:v]format=rgba,fade=t=in:st=${o.a.toFixed(3)}:d=0.25:alpha=1[f${k}]`);
      fc.push(`[${last}][f${k}]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})':shortest=1[o${k}]`);last="o"+k;k++});
    if(s.counter){ /* contorul urcă de la 0 la N în ~2,2 s, apoi stă */
      const cd=2.2;
      fc.push(`[${last}]drawtext=fontfile=${FONT}:text='%{eif\\:min(${N}\\,trunc(t*${N}/${cd}))\\:d}':fontsize=250:fontcolor=white:borderw=6:bordercolor=0x082219:x=(w-text_w)/2:y=330:box=0:shadowx=0:shadowy=0[c1]`);
      fc.push(`[c1]drawtext=fontfile=${FONT}:text='${T.pz}':fontsize=84:fontcolor=0x9be7b9:borderw=4:bordercolor=0x082219:x=(w-text_w)/2:y=610[c2]`);last="c2"}
    if(fc.length) a.push("-filter_complex",fc.join(";"),"-map","["+last+"]");
    a.push("-frames:v",String(n),...enc,pf); sh("ffmpeg",a); parts.push(pf);
  });
  const lst=path.join(OUT,"parts.txt"); fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const silent=path.join(OUT,"silent.mp4"); sh("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",silent]);
  const out=path.join(OUT,"ebanist-boom-it.mp4");
  sh("ffmpeg",["-loglevel","error","-y","-i",silent,"-i",wav,"-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:v","copy","-c:a","aac","-b:a","160k","-ar","44100","-movflags","+faststart","-shortest",out]);
  console.log("gata",out,total.toFixed(2)+" s, contor "+N+" = "+itNum(N));
  process.exit(0);
}

const DEMO=JSON.parse(fs.readFileSync(path.join(root,"test/golden/bucatarie-U-demo.json"),"utf8"));
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8803,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(300000);
 await pg.goto("http://localhost:8803/app/index.html?lang=it");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 /* proiectul demo, două culori (ca la kitchen-clip.cjs); apply durează ~2 min, de aceea cache în proj.json */
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
 fs.writeFileSync(path.join(OUT,"info.json"),JSON.stringify({pieces:info.pieces,modules:Object.keys(PROJ.configs).filter(n=>!/worktop|Top della/i.test(n)).length}));

 if(MODE==="frames"){
  await pg.evaluate(()=>{
   setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();
   window.__room=null;
   const bx=roomBoxes(),RL=roomLayout(),fr=RL.frames,floor=fr.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
   const sv=proj().survey.walls, last=fr[fr.length-1], lw=+sv[sv.length-1].len;
   if(fr.length===sv.length&&lw>0){const e=toRoom(last,lw,0,0);floor.push([e.x,e.y])}
   GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
   const r0=GL3D.render;GL3D.render=function(cfg,o){return r0.call(this,cfg,window.__room?Object.assign({},o,{boxes:bx,room:{floor}}):o)};
  });
  await pg.waitForTimeout(1500);
  const only=(process.env.ONLY||"").split(",").filter(Boolean);
  for(const s of SEGS.filter(x=>x.kind)){
   const dir=path.join(OUT,ONE?"seq1":"seq",s.name), nf=s.n;
   const have=!ONE&&fs.existsSync(dir)?fs.readdirSync(dir).length:0;
   if(only.length?!only.includes(s.name):(have>=nf)) {console.log(s.name,"există ("+have+" cadre), sar peste");continue}
   fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
   const t0=Date.now();
   if(s.kind==="mod") await pg.evaluate(cn=>{window.__room=null;window.__cfg=JSON.parse(JSON.stringify(proj().configs[cn]))},s.cfg);
   else await pg.evaluate(()=>{window.__room=true;window.__cfg={matBody:state.settings.matBody,matFront:state.settings.matFront}});
   for(let i=0;i<nf;i++){
    if(ONE&&i!==Math.floor(nf*.5)) continue;
    const u=nf>1?i/(nf-1):0, k=sm(u);
    let o;
    if(s.kind==="room"){const c=s.cam,L=(a,b)=>a+(b-a)*k;o={yaw:L(c[0],c[3]),pitch:L(c[1],c[4]),zoom:L(c[2],c[5])}}
    else{const L=key=>s.from[key]+(s.to[key]-s.from[key])*u;
      /* buclă: 0 → vârf (prima jumătate) → 0 (a doua) — se desface și se reface în aceeași scenă */
      const ex=u<.5?sm(u/.5):sm((1-u)/.5);
      o={yaw:L("yaw"),pitch:L("pitch"),zoom:L("zoom"),explode:s.peak*ex,hw:false,holes:false,open:false,mode:"real"}}
    const src=await pg.evaluate(([o])=>GL3D.capture(window.__cfg,Object.assign({w:1080,h:1920,edges:false},o)).img,[o]);
    fs.writeFileSync(path.join(dir,"f_"+String(ONE?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
    if(i%12===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
   }
   console.log(s.name,"gata",nf);
  }
 } else if(MODE==="extras"){
  const logo="data:image/png;base64,"+fs.readFileSync(path.join(root,"site/video/ebanist-logo-512.png")).toString("base64");
  await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent";
   const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)});
  const FF="font-family:Barlow,system-ui,sans-serif;";
  fs.mkdirSync(path.join(OUT,"ov"),{recursive:true});
  const shot=async(file,html,opaque)=>{await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.body.style.background=o?"#0e3b2a":"transparent";document.documentElement.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);
   await pg.waitForFunction(()=>[...document.images].every(i=>i.complete));
   await pg.screenshot({path:file,omitBackground:!opaque})};
  const capHtml=(a,c)=>`<div style="${FF}position:fixed;left:14px;right:14px;bottom:88px;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.93);color:#fff;font-weight:700;font-size:26px;line-height:1.2;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)">${a}${c?`<div style="font-weight:500;font-size:18px;opacity:.88;margin-top:4px">${c}</div>`:""}</div>`;
  for(const s of SEGS){
   if(s.card) await shot(path.join(OUT,"ov","card-"+s.name+".png"),`<div style="${FF}position:fixed;inset:0;background:linear-gradient(#0e3b2a,#082219);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:40px"><img src="${logo}" style="width:150px;height:150px;border-radius:34px;box-shadow:0 10px 40px rgba(0,0,0,.4)"><div style="font-weight:700;font-size:26px;letter-spacing:12px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:56px;line-height:1.05">${s.card[0]}</div><div style="font-weight:700;font-size:44px;color:#9be7b9">${s.card[1]}</div></div>`,true);
   if(s.title) await shot(path.join(OUT,"ov","title-"+s.name+".png"),`<div style="${FF}position:fixed;left:0;right:0;top:0;height:480px;background:linear-gradient(rgba(8,34,25,.97) 0%,rgba(8,34,25,.93) 62%,rgba(8,34,25,0));color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;padding-top:44px;gap:10px"><img src="${logo}" style="width:84px;height:84px;border-radius:20px;box-shadow:0 6px 24px rgba(0,0,0,.4)"><div style="font-weight:700;font-size:20px;letter-spacing:10px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:76px;line-height:1">${T.h1}</div><div style="font-weight:700;font-size:44px;color:#9be7b9">${T.h2}</div></div>`);
   if(s.cap) await shot(path.join(OUT,"ov","cap-"+s.name+".png"),capHtml(s.cap[0],s.cap[1]));
   if(s.dimsCap){const c=PROJ.configs[s.cfg];await shot(path.join(OUT,"ov","cap-"+s.name+".png"),capHtml(s.dimsCap,`${c.L} × ${c.H} × ${c.P} mm`))}
  }
  console.log("extras gata");
 }
 await b.close();srv.close();
});
