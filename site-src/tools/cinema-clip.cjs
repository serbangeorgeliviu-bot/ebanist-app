/* Clip „cinematic” pentru public larg (≤ 34 s, 9:16, fără voce): aplicația reală, proiectul demo app/demo/living.json («Noir & Noce»).
   Fără meserie, fără termeni tehnici. Lumină, uși care se deschid, mobila care se montează piesă cu piesă.
   Etape (ieșire în vid-cinema/, ignorat de git):
     node site-src/tools/cinema-clip.cjs frames [1]   cadrele 3D → seq/<scenă>/ (ONLY=a,b pentru anumite scene; fără ONLY se sar scenele deja randate;
                                                      `frames 1` = un singur cadru pe scenă, în seq1/)
     node site-src/tools/cinema-clip.cjs extras        textele și cardul final (PNG transparent) → ov/<limbă>/
     node site-src/tools/cinema-clip.cjs mux [limbă]   ffmpeg: grading, texte, sunet → ebanist-cinema-<limbă>.mp4  (LANGS=en,fr implicit)
   Muzică: MUSIC=/cale/piesa.mp3 (royalty-free, pusă de om); fără ea, un pat sonor generat (pad grav + respirație), fără melodie.
   Fundalul 3D se înnegrește numai în unealta asta (viewer3d.js e interceptat la încărcare); aplicația nu se schimbă.
   Scenele „room” = camera 3D a livingului; „mod” = un singur corp, animat cu ceas virtual (offlineBegin/Frame): ușile se deschid, nu apar deschise. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames", ONE=process.argv[3]==="1", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-cinema");
const FPS=24, PORT=+(process.env.PORT||8810);
const LANGS=(process.env.LANGS||"it,en,fr").split(",");
const TX={
 en:{h1:"Imagine your space.",h2:"Every piece, designed.",c1:"Glass that opens.",c2:"Lifts like silk.",c3:"Folds away.",c4:"Opens at a touch.",a1:"Every panel.",a2:"Every fitting.",f1:"Design it.",e1:"Design your furniture.",e2:"Free to try",e3:"ebanist.com"},
 it:{h1:"Immagina il tuo spazio.",h2:"Ogni pezzo, progettato.",c1:"Il vetro si apre.",c2:"Si solleva con dolcezza.",c3:"Si ripiega.",c4:"Si apre con un tocco.",a1:"Ogni pannello.",a2:"Ogni ferramenta.",f1:"Progettalo.",e1:"Progetta i tuoi mobili.",e2:"Provalo gratis",e3:"ebanist.com"},
 fr:{h1:"Imaginez votre espace.",h2:"Chaque pièce, dessinée.",c1:"Le verre s'ouvre.",c2:"Se lève en douceur.",c3:"Se replie.",c4:"S'ouvre d'un geste.",a1:"Chaque panneau.",a2:"Chaque ferrure.",f1:"Dessinez-le.",e1:"Dessinez vos meubles.",e2:"Essai gratuit",e3:"ebanist.com"}};
/* scene. kind room: cam [yaw,pitch,zoom → yaw,pitch,zoom]; led:false|true|[t0,t1] (fade între stins și aprins, în secunde din scenă)
   kind mod: cfg = numele corpului; open = secunda la care se deschide; cam la fel; kind asm: montajul animat */
const SEGS=[
 {name:"open",kind:"room",sec:4.5,cam:[.5,.2,1.25,.1,.18,1.75],led:[1.2,2.2],h:[.9,3.9,"h1"]},
 {name:"push",kind:"room",sec:3.5,cam:[.1,.18,1.75,-.1,.14,2.7],led:true,h:[.2,3.2,"h2"]},
 {name:"vitr",kind:"mod",sec:3.5,cfg:"S3 Vitrină",open:.5,cam:[.75,.2,1.0,.3,.18,1.12],cap:[.3,3.2,"c1"]},
 {name:"clapa",kind:"mod",sec:3.0,cfg:"S4 Clapă sus",open:.4,cam:[.6,.25,1.0,.2,.2,1.1],cap:[.3,2.7,"c2"]},
 {name:"plia",kind:"mod",sec:3.0,cfg:"D2 Bar uși pliante",open:.4,cam:[-.5,.2,1.0,-.1,.18,1.1],cap:[.3,2.7,"c3"]},
 {name:"sert",kind:"mod",sec:3.0,cfg:"C4 Console drawers",open:.4,cam:[.6,.25,1.0,.25,.22,1.1],cap:[.3,2.7,"c4"]},
 {name:"asm",kind:"asm",sec:7.5,cfg:"S3 Vitrină",ms:5600,cam:[-.55,.3,1.0,.75,.26,1.0],cap:[.2,6.5,"a1","a2"]},
 {name:"fin",kind:"room",sec:4.0,cam:[-.3,.2,2.3,.4,.2,1.2],led:true,h:[.3,3.2,"f1"]},
 {name:"end",sec:2.8,card:true}];
const sm=k=>k*k*(3-2*k);
let cum=0; for(const s of SEGS){s.n=Math.round(s.sec*FPS); s.t0=cum/FPS; cum+=s.n}
const total=cum/FPS;
fs.mkdirSync(OUT,{recursive:true});
function sh(cmd,args){cp.execFileSync(cmd,args,{stdio:"inherit"})}
const LOGO=path.join(root,"site/video/ebanist-logo-512.png");

/* ---------- mux ---------- */
if(MODE==="mux"){
 const langs=process.argv[3]?[process.argv[3]]:LANGS;
 /* grading: contrast, vignetă, grăunte fin; apoi fade din negru și spre negru */
 const GRADE="eq=contrast=1.12:brightness=-0.03:saturation=1.15:gamma=0.95,vignette=PI/4.2,noise=alls=5:allf=t,fade=t=in:st=0:d=0.5";
 const enc=["-c:v","libx264","-crf","19","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)];
 const seqDir=n=>path.join(OUT,"seq",n);
 const hasFrames=s=>fs.existsSync(seqDir(s.name));
 const base=[];
 SEGS.forEach((s,i)=>{
  if(s.card) return;
  const pf=path.join(OUT,"base-"+i+".mp4"), a=["-loglevel","error","-y"];
  const nin=fs.readdirSync(seqDir(s.name)).length, rate=nin/s.sec;
  if(Array.isArray(s.led)){
   const offDir=seqDir(s.name+"_off"), nOff=fs.readdirSync(offDir).length;
   const [t0,t1]=s.led;
   a.push("-framerate",String(FPS),"-i",path.join(offDir,"f_%04d.jpg"),"-framerate",String(FPS),"-i",path.join(seqDir(s.name),"f_%04d.jpg"));
   const k=`min(1,max(0,(T-${t0})/${t1-t0}))`;
   a.push("-filter_complex",`[0:v]tpad=stop=-1:stop_mode=clone[a];[a][1:v]blend=all_expr='A*(1-${k})+B*${k}':shortest=1[o]`,"-map","[o]");
  } else a.push("-framerate",String(rate),"-i",path.join(seqDir(s.name),"f_%04d.jpg"));
  a.push("-r",String(FPS),"-frames:v",String(s.n),"-c:v","libx264","-crf","14","-preset","fast","-pix_fmt","yuv420p",pf);
  sh("ffmpeg",a); base[i]=pf;
 });
 for(const L of langs){
  const parts=[];
  SEGS.forEach((s,i)=>{
   const pf=path.join(OUT,`part-${L}-${i}.mp4`), a=["-loglevel","error","-y"], d=s.n/FPS;
   if(s.card){
    a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",L,"card.png"),"-frames:v",String(s.n),"-vf","fade=t=in:st=0:d=0.5,fade=t=out:st="+(d-0.6)+":d=0.6",...enc,pf);
    sh("ffmpeg",a); parts.push(pf); return;
   }
   a.push("-i",base[i]);
   const fc=[]; let last="0:v", k=1;
   /* titlu (h) sus-jos, element de legendă (cap): fade 0,5 s intrare și ieșire */
   const ovs=[]; if(s.h) ovs.push({f:"h-"+s.name,a:s.h[0],b:s.h[1]});
   if(s.cap) ovs.push({f:"c-"+s.name,a:s.cap[0],b:s.cap[1]});
   ovs.forEach(o=>{a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",L,o.f+".png"));
    fc.push(`[${k}:v]format=rgba,fade=t=in:st=${o.a}:d=0.5:alpha=1,fade=t=out:st=${o.b-0.5}:d=0.5:alpha=1[f${k}]`);
    fc.push(`[${last}][f${k}]overlay=0:0:shortest=1[o${k}]`);last="o"+k;k++});
   const g=(i===0?GRADE:GRADE.replace(",fade=t=in:st=0:d=0.5",""));
   fc.push(`[${last}]${g}[fin]`);
   a.push("-filter_complex",fc.join(";"),"-map","[fin]","-frames:v",String(s.n),...enc,pf);
   sh("ffmpeg",a); parts.push(pf);
  });
  const lst=path.join(OUT,`parts-${L}.txt`); fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const silent=path.join(OUT,`silent-${L}.mp4`); sh("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",silent]);
  /* sunet: piesa omului sau un pat generat (acorduri grave, respirație lentă, fără melodie) */
  const out=path.join(OUT,`ebanist-cinema-${L}.mp4`), D=total;
  const af=process.env.MUSIC
   ?["-i",process.env.MUSIC,"-af",`atrim=0:${D},afade=t=in:d=1.5,afade=t=out:st=${D-2.5}:d=2.5,loudnorm=I=-16:TP=-1.5:LRA=9`]
   :["-f","lavfi","-i",`aevalsrc='0.18*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.11*t))+0.12*sin(2*PI*82.4*t)*(0.6+0.4*sin(2*PI*0.09*t+1))+0.07*sin(2*PI*164.8*t)*(0.5+0.5*sin(2*PI*0.13*t+2))+0.04*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.07*t+4))':d=${D}:s=44100`,
     "-af",`lowpass=f=900,aecho=0.8:0.7:420|700:0.35|0.25,afade=t=in:d=2,afade=t=out:st=${D-3}:d=3,loudnorm=I=-20:TP=-2:LRA=7`];
  sh("ffmpeg",["-loglevel","error","-y","-i",silent,...af,"-c:v","copy","-c:a","aac","-b:a","160k","-ar","44100","-movflags","+faststart","-shortest",out]);
  console.log("gata",out,total.toFixed(2)+" s");
 }
 process.exit(0);
}

/* ---------- pagina aplicației (frames, extras) ---------- */
const DEMO=JSON.parse(fs.readFileSync(path.join(root,"app/demo/living.json"),"utf8"));
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");
 let b=fs.readFileSync(f);
 /* fundal de studio, aproape negru (numai pentru clip) */
 if(/viewer3d\.js$/.test(f)) b=Buffer.from(b.toString().replace('"#1f4535"','"#0a0c10"').replace('"#10281d"','"#06070a"').replace('"#08150f"','"#020203"'));
 r.end(b)}).listen(PORT,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2,colorScheme:"dark"});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(600000);
 await pg.goto(`http://localhost:${PORT}/app/index.html?lang=en`);await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 await pg.evaluate(D=>{closeSheets();D=JSON.parse(JSON.stringify(D));D.id="demo_living";state.projects.push(D);state.activeId=D.id;
  setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();
  window.__room=null;
  const bx=roomBoxes(),RL=roomLayout(),fr=RL.frames,floor=fr.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
  const sv=proj().survey.walls,last=fr[fr.length-1],lw=+sv[sv.length-1].len;if(fr.length===sv.length&&lw>0){const e=toRoom(last,lw,0,0);floor.push([e.x,e.y])}
  window.__roomOpts={boxes:bx,room:{floor,tone:proj().floorTone},leds:roomLeds()};
  GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
  const r0=GL3D.render;GL3D.render=function(cfg,o){return r0.call(this,cfg,window.__room?Object.assign({},o,window.__roomOpts):o)};
 },DEMO);
 await pg.waitForTimeout(1500);

 if(MODE==="frames"){
  const only=(process.env.ONLY||"").split(",").filter(Boolean);
  const save=(dir,i,src)=>fs.writeFileSync(path.join(dir,"f_"+String(i).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
  const lerp=(c,k)=>[c[0]+(c[3]-c[0])*k,c[1]+(c[4]-c[1])*k,c[2]+(c[5]-c[2])*k];
  for(const s of SEGS.filter(x=>x.kind)){
   const dirs=[path.join(OUT,ONE?"seq1":"seq",s.name)]; if(Array.isArray(s.led)) dirs.push(path.join(OUT,ONE?"seq1":"seq",s.name+"_off"));
   const have=!ONE&&fs.existsSync(dirs[0])?fs.readdirSync(dirs[0]).length:0;
   if(only.length?!only.includes(s.name):(have>=s.n)){console.log(s.name,"există ("+have+" cadre), sar peste");continue}
   dirs.forEach(d=>{fs.rmSync(d,{recursive:true,force:true});fs.mkdirSync(d,{recursive:true})});
   const t0=Date.now(), nf=s.n;
   if(s.kind==="room"){
    await pg.evaluate(()=>{window.__room=true;window.__cfg={matBody:state.settings.matBody,matFront:state.settings.matFront}});
    const nOff=Array.isArray(s.led)?Math.ceil(s.led[1]*FPS):0;
    for(let i=0;i<nf;i++){
     if(ONE&&i!==Math.floor(nf*.6)) continue;
     const [yaw,pitch,zoom]=lerp(s.cam,nf>1?sm(i/(nf-1)):0);
     for(const pass of (Array.isArray(s.led)&&i<nOff?[false,true]:[null])){
      const led=pass===null?(s.led===true||Array.isArray(s.led)):pass;
      const src=await pg.evaluate(([o])=>GL3D.capture(window.__cfg,Object.assign({w:1080,h:1920,edges:false,warm:true},o)).img,[{yaw,pitch,zoom,led}]);
      save(pass===false?dirs[1]:dirs[0],ONE?1:i+1,src);
     }
     if(i%12===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
    }
   } else {
    /* mod / asm: ceas virtual, animații reale (uși, clape, sertare, montaj) */
    await pg.evaluate(([cn,asm,ms])=>{
     window.__room=null;GL3D.leaveRoom&&GL3D.leaveRoom();
     const cfg=JSON.parse(JSON.stringify(proj().configs[cn]));
     GL3D.render(cfg,{explode:0});
     GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0,warm:true,ledOn:true});
     GL3D.offlineBegin({w:1080,h:1920,fps:24,ms:ms||1200,bg:"dark"});
     if(!asm) GL3D.stopAssemble();
    },[s.cfg,s.kind==="asm",s.ms]);
    for(let i=0;i<nf;i++){
     const [yaw,pitch,zoom]=lerp(s.cam,nf>1?sm(i/(nf-1)):0), tt=i/FPS;
     const isAsm=s.kind==="asm";
     const r=await pg.evaluate(([yaw,pitch,zoom,openNow])=>{VIEW.yaw=yaw;VIEW.pitch=pitch;VIEW.zoom=zoom;return GL3D.offlineFrame(openNow)},[yaw,pitch,zoom,!isAsm&&tt>=s.open]);
     if(ONE&&i!==Math.floor(nf*.75)) continue;
     save(dirs[0],ONE?1:i+1,r.data);
     if(i%12===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
    }
    await pg.evaluate(()=>GL3D.offlineEnd());
   }
   console.log(s.name,"gata",nf);
  }
 } else if(MODE==="extras"){
  const logo="data:image/png;base64,"+fs.readFileSync(LOGO).toString("base64");
  await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent";
   const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)});
  const FF="font-family:'Barlow Condensed','Barlow',system-ui,sans-serif;";
  const shot=async(file,html,opaque)=>{await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.body.style.background=o?"#050608":"transparent";document.documentElement.style.background=o?"#050608":"transparent"},[html,!!opaque]);
   await pg.waitForFunction(()=>[...document.images].every(i=>i.complete));await pg.waitForTimeout(150);
   await pg.screenshot({path:file,omitBackground:!opaque})};
  /* titlu mare, centrat jos, literă fină cu spațiere; legenda mică, sub el */
  const big=t=>`<div style="${FF}position:fixed;left:0;right:0;bottom:190px;text-align:center;color:#fff;font-weight:300;font-size:58px;letter-spacing:6px;text-shadow:0 2px 24px rgba(0,0,0,.7);padding:0 30px">${t}</div>`;
  const small=(t,t2)=>`<div style="${FF}position:fixed;left:0;right:0;bottom:170px;text-align:center;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.8)"><div style="font-weight:300;font-size:46px;letter-spacing:5px">${t}</div>${t2?`<div style="font-weight:600;font-size:46px;letter-spacing:5px;margin-top:4px;color:#ffd7a1">${t2}</div>`:""}</div>`;
  for(const L of LANGS){
   const T=TX[L]; fs.mkdirSync(path.join(OUT,"ov",L),{recursive:true});
   for(const s of SEGS){
    if(s.h) await shot(path.join(OUT,"ov",L,"h-"+s.name+".png"),big(T[s.h[2]]));
    if(s.cap) await shot(path.join(OUT,"ov",L,"c-"+s.name+".png"),small(T[s.cap[2]],s.cap[3]?T[s.cap[3]]:""));
   }
   await shot(path.join(OUT,"ov",L,"card.png"),`<div style="${FF}position:fixed;inset:0;background:radial-gradient(circle at 50% 42%,#14161c 0%,#050608 70%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center;padding:40px"><img src="${logo}" style="width:170px;height:170px;border-radius:38px;box-shadow:0 12px 50px rgba(255,190,120,.25)"><div style="font-weight:600;font-size:34px;letter-spacing:16px;opacity:.85">EBANIST</div><div style="font-weight:300;font-size:60px;letter-spacing:4px;line-height:1.1;margin-top:10px">${T.e1}</div><div style="font-weight:600;font-size:44px;letter-spacing:5px;color:#ffd7a1">${T.e2}</div><div style="font-weight:400;font-size:40px;letter-spacing:6px;opacity:.9;margin-top:18px">${T.e3}</div></div>`,true);
  }
  console.log("extras gata");
 }
 await b.close();srv.close();
});
