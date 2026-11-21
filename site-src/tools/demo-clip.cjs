/* Video „Demo Ebanist” (≈ 36 s, 16:9, FĂRĂ voce, subtitrări RO / IT / FR / EN — același montaj, patru fișiere).
   Aplicația reală, proiectul demo „Living” (app/demo/living.json, încărcat ca în aplicație: EBDemo.prepare). Nicio piesă scrisă de mână.
   Etape (ieșire în vid-demo/, ignorat de git):
     node site-src/tools/demo-clip.cjs frames   cadrele 3D, direct din GL3D.capture → seq/<scenă>/  (ONLY=tour,flap pentru anumite scene; se sar cele deja randate)
     node site-src/tools/demo-clip.cjs extras   titluri, subtitrări, cardul final (PNG transparent, pe limbă) → ov/<limbă>/, foaia A3 a unei piese → sheet/
     node site-src/tools/demo-clip.cjs mux      ffmpeg → ebanist-demo-<limbă>.mp4 (ro, it, fr, en)
   Un singur cadru pe scenă, pentru verificare: `frames 1` (în seq1/). Cadrele se întind pe durata scenei: durata se schimbă fără re-randare.
   Ce nu se spune: prețuri, termene, „verificat în fabrică”; găurirea nouă e verificat:false. Se arată numai ce se vede în aplicație. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames", ONE=process.argv[3]==="1", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-demo");
const FPS=24, W=1920, H=1080, LANGS=["ro","it","fr","en"];
/* texte: [titlu, subtitlu] pe scenă, pe limbă */
const TX={
 hook:{ro:["Mobilier proiectat în 3D","gata de fabricat"],it:["Mobili progettati in 3D","pronti da produrre"],fr:["Du mobilier conçu en 3D","prêt à fabriquer"],en:["Furniture designed in 3D","ready to build"]},
 tour:{ro:["Un perete întreg, calculat","15 corpuri · 88 de rânduri de distinctă"],it:["Una parete intera, calcolata","15 corpi · 88 righe di distinta"],fr:["Un mur entier, calculé","15 corps · 88 lignes de nomenclature"],en:["A whole wall, calculated","15 units · 88 cut-list rows"]},
 vit:{ro:["Uși, clape, sertare","se deschid în 3D"],it:["Ante, ribalte, cassetti","si aprono in 3D"],fr:["Portes, abattants, tiroirs","s’ouvrent en 3D"],en:["Doors, flaps, drawers","open in 3D"]},
 flap:{ro:["Clape cu motor","AVENTOS SERVO-DRIVE · Häfele E-Drive"],it:["Ribalte motorizzate","AVENTOS SERVO-DRIVE · Häfele E-Drive"],fr:["Abattants motorisés","AVENTOS SERVO-DRIVE · Häfele E-Drive"],en:["Motorised flaps","AVENTOS SERVO-DRIVE · Häfele E-Drive"]},
 drw:{ro:["Sertare Legrabox","cu TIP-ON"],it:["Cassetti Legrabox","con TIP-ON"],fr:["Tiroirs Legrabox","avec TIP-ON"],en:["Legrabox drawers","with TIP-ON"]},
 expl:{ro:["Fiecare piesă, la vedere","explodat, pe panouri"],it:["Ogni pezzo, in vista","esploso, pannello per pannello"],fr:["Chaque pièce, à vue","éclaté, panneau par panneau"],en:["Every part in view","exploded, panel by panel"]},
 holes:{ro:["Găuri și feronerie","în transparență, la locul lor"],it:["Fori e ferramenta","in trasparenza, al loro posto"],fr:["Perçages et quincaillerie","en transparence, à leur place"],en:["Drilling and hardware","see-through, in place"]},
 sheet:{ro:["Foaia piesei","cote și găuri pentru șablon"],it:["Scheda del pezzo","quote e fori per la dima"],fr:["La fiche de la pièce","cotes et perçages pour le gabarit"],en:["The part sheet","dimensions and holes for the jig"]},
 end:{ro:["Încearcă gratuit","ebanist.com"],it:["Provalo gratis","ebanist.com"],fr:["Essayez gratuitement","ebanist.com"],en:["Try it free","ebanist.com"]},
 endsub:{ro:"și pe Google Play",it:"e su Google Play",fr:"et sur Google Play",en:"and on Google Play"}};
const sm=k=>k*k*(3-2*k);
/* scene. room = camera 3D a camerei (toată mobila); mod = un singur corp (cfg = începutul numelui, în engleză, din proiectul încărcat cu lang=en) */
const SEGS=[
 {name:"tour",kind:"room",sec:6.0,cam:[0,.75,1.3,.35,.6,1.55],title:2.4,led:[.4,1],cap:"tour"},
 {name:"wall",kind:"room",sec:3.0,cam:[.35,.6,1.9,.2,.55,2.5],led:[0,1],cap:"tour",nocap:true},
 {name:"vit",kind:"mod",sec:4.0,cfg:/Display cabinet/,from:{yaw:.5,pitch:.12,zoom:.8},to:{yaw:.15,pitch:.1,zoom:.95},open:true,led:true,cap:"vit"},
 {name:"flap",kind:"mod",sec:4.0,cfg:/Top flap/,from:{yaw:.6,pitch:.18,zoom:1.0},to:{yaw:.2,pitch:.14,zoom:1.15},open:true,led:true,cap:"flap"},
 {name:"drw",kind:"mod",sec:3.0,cfg:/^S2 Drawers/,from:{yaw:-.5,pitch:.28,zoom:1.0},to:{yaw:-.15,pitch:.22,zoom:1.2},open:true,led:false,cap:"drw"},
 {name:"expl",kind:"mod",sec:4.0,cfg:/Display cabinet/,from:{yaw:.3,pitch:.3,zoom:.95,explode:0},to:{yaw:.85,pitch:.28,zoom:1.0,explode:.9},led:false,cap:"expl"},
 {name:"holes",kind:"mod",sec:4.0,cfg:/Display cabinet/,from:{yaw:.7,pitch:.2,zoom:.9,explode:.7},to:{yaw:1.25,pitch:.15,zoom:1.1,explode:.7},mode:"hw",led:false,cap:"holes"},
 {name:"sheet",sec:4.0,sheet:true,cap:"sheet"},
 {name:"end",sec:3.0,card:true}];
let cum=0; for(const s of SEGS){s.n=Math.round(s.sec*FPS);s.t0=cum/FPS;cum+=s.n}
const total=cum/FPS;
fs.mkdirSync(OUT,{recursive:true});
const sh=(c,a)=>cp.execFileSync(c,a,{stdio:"inherit"});

if(MODE==="mux"){
 const enc=["-r",String(FPS),"-c:v","libx264","-crf","20","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)];
 for(const L of LANGS){
  const parts=[];
  SEGS.forEach((s,i)=>{
   const n=s.n,d=n/FPS,pf=path.join(OUT,"part-"+L+"-"+i+".mp4"),a=["-loglevel","error","-y"],fc=[];let last="0:v",k=1;
   if(s.card) a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",L,"card.png"));
   else if(s.sheet) a.push("-framerate",String(fs.readdirSync(path.join(OUT,"sheet")).length/s.sec),"-i",path.join(OUT,"sheet","f_%04d.jpg"));
   else a.push("-framerate",String(fs.readdirSync(path.join(OUT,"seq",s.name)).length/s.sec),"-i",path.join(OUT,"seq",s.name,"f_%04d.jpg"));
   const ovs=[];const tt=s.title||0;
   if(tt) ovs.push({f:"title",a:0,b:tt});
   if(s.cap&&!s.nocap) ovs.push({f:"cap-"+s.name,a:tt,b:d});
   ovs.forEach(o=>{a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",L,o.f+".png"));
    fc.push(`[${k}:v]format=rgba,fade=t=in:st=${o.a.toFixed(3)}:d=0.25:alpha=1[f${k}]`);
    fc.push(`[${last}][f${k}]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})':shortest=1[o${k}]`);last="o"+k;k++});
   if(fc.length) a.push("-filter_complex",fc.join(";"),"-map","["+last+"]");
   a.push("-vf","scale="+W+":"+H+":flags=lanczos","-frames:v",String(n),...enc,pf);
   /* -vf cu -filter_complex nu merg împreună: scalarea se face înainte, în pasul final */
   if(fc.length){a.splice(a.indexOf("-vf"),2)}
   sh("ffmpeg",a);parts.push(pf);
  });
  const lst=path.join(OUT,"parts-"+L+".txt");fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const out=path.join(OUT,"ebanist-demo-"+L+".mp4");
  sh("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy","-movflags","+faststart",out]);
  console.log("gata",out,total.toFixed(2)+" s");
 }
 process.exit(0);
}

const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(+(process.env.PORT||8803),async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(300000);
 await pg.goto("http://localhost:"+(process.env.PORT||8803)+"/app/index.html?lang=en");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 /* demo-ul se încarcă exact ca în aplicație (demoLoad), în engleză: numele corpurilor sunt cele din JSON tradus */
 const names=await pg.evaluate(async()=>{
  closeSheets();const d=EBDemo.get("living");const json=await (await fetch(d.file)).json();
  const p=EBDemo.prepare(json,{lang:"en",uid,names:[],today:new Date().toISOString().slice(0,10)});
  state.projects.unshift(p);state.activeId=p.id;persist();return Object.keys(proj().configs)});
 console.log("corpuri:",names.join(" | "));
 const find=re=>{const n=names.find(x=>re.test(x));if(!n)throw new Error("nu găsesc corpul "+re);return n};
 for(const s of SEGS) if(s.kind==="mod") s.cfgName=find(s.cfg);

 if(MODE==="frames"){
  await pg.evaluate(()=>{
   setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();window.__room=null;
   const bx=roomBoxes(),RL=roomLayout(),fr=RL.frames,floor=fr.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
   const sv=proj().survey.walls,last=fr[fr.length-1],lw=+sv[sv.length-1].len;
   if(fr.length===sv.length&&lw>0){const e=toRoom(last,lw,0,0);floor.push([e.x,e.y])}
   GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
   const r0=GL3D.render;GL3D.render=function(cfg,o){return r0.call(this,cfg,window.__room?Object.assign({},o,{boxes:bx,room:{floor,tone:(proj()||{}).floorTone},leds:roomLeds()}):o)};
  });
  await pg.waitForTimeout(1500);
  const only=(process.env.ONLY||"").split(",").filter(Boolean);
  for(const s of SEGS.filter(x=>x.kind)){
   const dir=path.join(OUT,ONE?"seq1":"seq",s.name),nf=s.n;
   const have=!ONE&&fs.existsSync(dir)?fs.readdirSync(dir).length:0;
   if(only.length?!only.includes(s.name):have>=nf){console.log(s.name,"există ("+have+"), sar peste");continue}
   fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
   const t0=Date.now();
   if(s.kind==="mod") await pg.evaluate(cn=>{window.__room=null;window.__cfg=JSON.parse(JSON.stringify(proj().configs[cn]))},s.cfgName);
   else await pg.evaluate(()=>{window.__room=true;window.__cfg={matBody:state.settings.matBody,matFront:state.settings.matFront}});
   for(let i=0;i<nf;i++){
    if(ONE&&i!==Math.floor(nf*.7)) continue;
    const k=nf>1?sm(i/(nf-1)):0,f=nf>1?i/(nf-1):0;let o;
    if(s.kind==="room"){const c=s.cam,L=(a,b)=>a+(b-a)*k;o={yaw:L(c[0],c[3]),pitch:L(c[1],c[4]),zoom:L(c[2],c[5]),warm:true,led:f>=s.led[0]&&f<=s.led[1]}}
    else{const L=key=>s.from[key]+(s.to[key]-s.from[key])*k;
     const ek=s.from.explode!=null?Math.min(1,k/0.55):0;
     o={yaw:L("yaw"),pitch:L("pitch"),zoom:L("zoom"),explode:s.from.explode!=null?s.from.explode+(s.to.explode-s.from.explode)*sm(ek):0,hw:s.mode==="hw",holes:s.mode==="hw",open:!!s.open,mode:s.mode||"real",warm:true,led:!!s.led};
     if(s.focus!=null) o.focus=s.focus}
    const src=await pg.evaluate(([o,w,h])=>GL3D.capture(window.__cfg,Object.assign({w,h,edges:false},o)).img,[o,W,H]);
    fs.writeFileSync(path.join(dir,"f_"+String(ONE?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
    if(i%12===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
   }
   console.log(s.name,"gata",nf);
  }
 } else if(MODE==="extras"){
  /* foaia A3 a unei piese (cu găuri) din corpul „holes”: prima piesă cu operații */
  const sheetSvg=await pg.evaluate(cn=>{closeSheets();const c=JSON.parse(JSON.stringify(proj().configs[cn]));GL3D.render(c,{explode:0});const M=GL3D.model();
   const pc=M.ops.pieces.find(p=>(p.operations||[]).some(x=>x.face>=5))||M.ops.pieces[0];return pc?partSheetSvg(M,pc,5,1,1,"A4"):null},SEGS.find(x=>x.name==="holes").cfgName);
  if(!sheetSvg) throw new Error("nu găsesc piesă pentru foaia A3");
  const logo="data:image/png;base64,"+fs.readFileSync(path.join(root,"site/video/ebanist-logo-512.png")).toString("base64");
  await pg.setViewportSize({width:W,height:H});
  await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent";
   const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)});
  const FF="font-family:Barlow,system-ui,sans-serif;";
  const shot=async(file,html,opaque)=>{fs.mkdirSync(path.dirname(file),{recursive:true});
   await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.body.style.background=o?"#0e3b2a":"transparent";document.documentElement.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);
   await pg.waitForFunction(()=>[...document.images].every(i=>i.complete));await pg.screenshot({path:file,omitBackground:!opaque})};
  const cap=(a,c)=>`<div style="${FF}position:fixed;left:50%;transform:translateX(-50%);bottom:60px;max-width:1500px;text-align:center;padding:20px 40px;border-radius:20px;background:rgba(14,59,42,.93);color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.35)"><div style="font-weight:800;font-size:54px;line-height:1.1">${a}</div><div style="font-weight:500;font-size:32px;opacity:.9;margin-top:8px">${c}</div></div>`;
  for(const L of LANGS){
   const dir=path.join(OUT,"ov",L);
   for(const s of SEGS) if(s.cap&&!s.nocap) await shot(path.join(dir,"cap-"+s.name+".png"),cap(...TX[s.cap][L]));
   await shot(path.join(dir,"title.png"),`<div style="${FF}position:fixed;left:0;right:0;top:0;height:560px;background:linear-gradient(rgba(8,34,25,.96) 0%,rgba(8,34,25,.9) 58%,rgba(8,34,25,0));color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;padding-top:64px;gap:14px"><img src="${logo}" style="width:120px;height:120px;border-radius:28px;box-shadow:0 8px 30px rgba(0,0,0,.4)"><div style="font-weight:700;font-size:28px;letter-spacing:16px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:96px;line-height:1.05">${TX.hook[L][0]}</div><div style="font-weight:700;font-size:56px;color:#9be7b9">${TX.hook[L][1]}</div></div>`);
   await shot(path.join(dir,"card.png"),`<div style="${FF}position:fixed;inset:0;background:linear-gradient(#0e3b2a,#082219);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center"><img src="${logo}" style="width:200px;height:200px;border-radius:44px;box-shadow:0 12px 50px rgba(0,0,0,.4)"><div style="font-weight:700;font-size:34px;letter-spacing:18px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:96px">${TX.end[L][0]}</div><div style="font-weight:700;font-size:72px;color:#9be7b9">${TX.end[L][1]}</div><div style="font-weight:500;font-size:36px;opacity:.85">${TX.endsub[L]}</div></div>`,true);
  }
  /* foaia piesei: zoom lent pe desen */
  const sg=SEGS.find(x=>x.sheet),nf=sg.n;
  fs.rmSync(path.join(OUT,"sheet"),{recursive:true,force:true});fs.mkdirSync(path.join(OUT,"sheet"),{recursive:true});
  for(let i=0;i<nf;i++){const k=sm(i/(nf-1)),z=1+.55*k;
   await pg.evaluate(([svg,z])=>{document.body.innerHTML='<div style="position:fixed;inset:0;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="height:92vh;aspect-ratio:420/297;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transform-origin:30% 55%;transform:scale('+z+')">'+svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/,'style="width:100%;height:100%;display:block"')+'</div></div>';document.body.style.background="#2f3430"},[sheetSvg,z]);
   await pg.screenshot({path:path.join(OUT,"sheet","f_"+String(i+1).padStart(4,"0")+".jpg"),type:"jpeg",quality:92})}
  console.log("extras gata");
 }
 await b.close();srv.close();
});
