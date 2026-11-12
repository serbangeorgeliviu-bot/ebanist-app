/* Film TikTok / Play „Gratuit vs Pro", 9:16, fără voce.
   node site-src/tools/tiktok-pro.cjs [ro|it|en|fr] [compose]
   „compose" nu mai filmează: refolosește cadrele din vid-pro/<lang>/body (state.json) și refă doar
   cardurile, suprapunerile și mp4-ul (texte, preț).
   Aplicația rulează ca utilizator GRATUIT (fără licență): 3D-ul randat determinist (GL3D.capture),
   ecranul Pro real (openPro) cu tabelul Gratuit/Pro, foile A3 din packBuild, apoi carduri și ffmpeg.
   Ieșire: vid-pro/ebanist-pro-<lang>.mp4, 1080×1920, 24 fps. Prețurile sunt cele din billing.js. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const L=process.argv[2]||"ro", root=path.resolve(__dirname,"../.."), BASE=path.join(root,"vid-pro"), D=path.join(BASE,L), SEQ=path.join(D,"seq"), OV=path.join(D,"ov");
const FPS=24, W=1080, H=1920, COMPOSE=process.argv[3]==="compose", BODY=path.join(D,"body");
if(!COMPOSE) fs.rmSync(D,{recursive:true,force:true});
fs.rmSync(SEQ,{recursive:true,force:true});fs.rmSync(OV,{recursive:true,force:true});
fs.mkdirSync(SEQ,{recursive:true});fs.mkdirSync(OV,{recursive:true});fs.mkdirSync(BODY,{recursive:true});
const T={
 ro:{h1:"Proiectezi gratis.",h2:"Fabrici cu Pro.",h3:"Distinta, fișa de montaj, foile A3",
  free:"GRATUIT",pro:"PRO",c1:"Tot proiectul, în 3D",c2:"Uși, sertare, feronerie ca în realitate",c3:"Pentru atelier, documentele sunt Pro",
  c4:"Dosar tehnic A3, dintr-un clic",c5:"Foaie de fabricație: cote la axa găurii",c6:"Foaie de montaj cu poziții numerotate",
  p1:"Ebanist Pro",p2:"9 €/lună · 79 €/an",p3:"Anulezi oricând",e1:"Ebanist",e2:"Gratuit pe Google Play și pe ebanist.com",e3:"Caută „Ebanist”",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio"},
 it:{h1:"Progetti gratis.",h2:"Produci con Pro.",h3:"Distinta, foglio di montaggio, fogli A3",
  free:"GRATIS",pro:"PRO",c1:"Tutto il progetto, in 3D",c2:"Ante, cassetti, ferramenta come nella realtà",c3:"Per il laboratorio, i documenti sono Pro",
  c4:"Dossier tecnico A3, con un clic",c5:"Foglio di fabbricazione: quote all'asse del foro",c6:"Foglio di montaggio con posizioni numerate",
  p1:"Ebanist Pro",p2:"9 €/mese · 79 €/anno",p3:"Disdici quando vuoi",e1:"Ebanist",e2:"Gratis su Google Play e su ebanist.com",e3:"Cerca «Ebanist»",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio"},
 en:{h1:"Design for free.",h2:"Build with Pro.",h3:"Cut list, assembly sheet, A3 drawings",
  free:"FREE",pro:"PRO",c1:"The whole project, in 3D",c2:"Doors, drawers, hardware like the real thing",c3:"For the workshop, documents are Pro",
  c4:"A3 technical dossier in one click",c5:"Shop sheet: dimensions to the hole axis",c6:"Assembly sheet with numbered positions",
  p1:"Ebanist Pro",p2:"€9/month · €79/year",p3:"Cancel anytime",e1:"Ebanist",e2:"Free on Google Play and at ebanist.com",e3:"Search “Ebanist”",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio"},
 fr:{h1:"Concevez gratuitement.",h2:"Fabriquez avec Pro.",h3:"Débit, fiche de montage, planches A3",
  free:"GRATUIT",pro:"PRO",c1:"Tout le projet, en 3D",c2:"Portes, tiroirs, quincaillerie comme en vrai",c3:"Pour l'atelier, les documents sont Pro",
  c4:"Dossier technique A3 en un clic",c5:"Fiche de fabrication : cotes à l'axe du perçage",c6:"Fiche de montage avec positions numérotées",
  p1:"Ebanist Pro",p2:"9 €/mois · 79 €/an",p3:"Résiliable à tout moment",e1:"Ebanist",e2:"Gratuit sur Google Play et sur ebanist.com",e3:"Cherchez « Ebanist »",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio"}}[L];
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}r.setHeader("content-type",MIME[path.extname(f)]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8802,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
 let n=0; const marks=[]; const swatches={};
 if(COMPOSE){ const st=JSON.parse(fs.readFileSync(path.join(D,"state.json"),"utf8")); n=st.n; st.marks.forEach(m=>marks.push(m)); Object.assign(swatches,st.swatches); }
 else {
 const pg=await ctx.newPage(); pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200))); pg.setDefaultTimeout(60000);
 await pg.goto("http://localhost:8802/app/index.html?lang="+L);await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 if(await pg.evaluate(()=>isPro())) throw new Error("clipul se filmează ca utilizator gratuit");
 await pg.evaluate(()=>{closeSheets();const q=proj();q.pieces=[];q.configs={};q.layout={};
   window.__cfg={...PRESETS.armadio,name:"Dulap",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}};
   generateInto(q,window.__cfg);persist();setView("build");GL3D.render(window.__cfg,{explode:0});});
 await pg.waitForTimeout(1500);
 /* foile A3 se construiesc acum, cât aplicația e încă întreagă (packBuild nu cere Pro, doar butonul îl cere) */
 const sheets=await pg.evaluate(()=>packBuild(proj(),{cover:true,client:false,report:false,elev:true,asm:true,parts:true}));
 const nf=()=>path.join(BODY,"s_"+String(++n).padStart(5,"0")+".jpg");
 const seg=(cap,badge,sw)=>{const m={from:n+1,to:n,cap,badge,sw};marks.push(m);return m};
 const lerp=(a,b,k)=>a+(b-a)*k, sm=k=>k*k*(3-2*k);
 /* ---- 3D: decoruri + uși deschise (GRATUIT) ---- */
 const DEC=[["nogal_victoria_19","#6E4B33","m1"],["rovere_wood_lime_classic_k2414ah_19","#C4A87C","m2"],["avocado_green_22458mn_19","#A8B08A","m3"],["bordeaux_19","#6B2431","m4"],["blue_avio_23196mn_19","#5C7A99","m5"]];
 const g3=async(cfgPatch,st,cam,k)=>{const r=await pg.evaluate(([p,s,c,k,W,H])=>{const cfg={...window.__cfg,...p};GL3D.focusOn(null);
   return GL3D.capture(cfg,{w:W,h:H,yaw:c[0]+(c[3]-c[0])*k,pitch:c[1]+(c[4]-c[1])*k,zoom:c[2]+(c[5]-c[2])*k,hw:s.hw,open:s.open,explode:0,edges:false}).img},[cfgPatch,st,cam,k,W,H]);
   fs.writeFileSync(nf(),Buffer.from(r.split(",")[1],"base64"))};
 for(let i=0;i<DEC.length;i++){const [id,hex,key]=DEC[i];swatches[key]=hex;const m=seg("c1","free",key);const N=Math.round(1.0*FPS);
   const cam=i%2?[.62,.2,1.5,.22,.22,1.55]:[.22,.2,1.5,.62,.22,1.55];
   for(let j=0;j<N;j++) await g3({matFront:id},{open:false,hw:false},cam,sm(j/(N-1))); m.to=n;}
 {const m=seg("c2","free");const N=Math.round(3.0*FPS);for(let j=0;j<N;j++) await g3({matFront:"nogal_victoria_19"},{open:true,hw:true},[.3,.2,1.5,-.35,.34,1.6],sm(j/(N-1)));m.to=n;}
 /* ---- ecranul Pro real, defilat de sus în jos ---- */
 await pg.evaluate(()=>{closeSheets();openPro("doc")});await pg.waitForTimeout(900);
 const scrollMax=await pg.evaluate(()=>{const els=[...document.querySelectorAll("#shPro, #shPro *")].filter(e=>e.scrollHeight>e.clientHeight+50&&/auto|scroll/.test(getComputedStyle(e).overflowY));
   const e=els[els.length-1]; window.__sc=e; return e?e.scrollHeight-e.clientHeight:0});
 console.log("scrollMax",scrollMax);
 {const m=seg("c3",null);const hold=Math.round(1.2*FPS),pan=Math.round(3.2*FPS);
  for(let j=0;j<hold+pan;j++){const k=j<hold?0:sm((j-hold)/(pan-1));await pg.evaluate(y=>{if(window.__sc)window.__sc.scrollTop=y},k*scrollMax);
   await pg.screenshot({path:nf(),type:"jpeg",quality:92});}
  for(let j=0;j<Math.round(.8*FPS);j++) fs.copyFileSync(path.join(BODY,"s_"+String(n).padStart(5,"0")+".jpg"),nf());
  m.to=n;}
 /* ---- foile A3 (PRO), curățăm interfața, restul e al nostru ---- */
 await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:#2f3430;overflow:hidden"});
 const sheetSeg=async(svg,sec,o0,s0,s1,cap)=>{const N=Math.round(sec*FPS),m=seg(cap,"pro");
   await pg.evaluate(([svg])=>{document.body.innerHTML='<div style="position:fixed;inset:0;background:#2f3430;overflow:hidden"><div id="sh" style="position:absolute;left:20px;top:50%;width:500px;margin-top:-176px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.55)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div></div>'},[svg]);
   for(let j=0;j<N;j++){const k=sm(j/(N-1)),s=s0+(s1-s0)*k;
     await pg.evaluate(([s,o0])=>{const el=document.getElementById("sh");el.style.transformOrigin=o0[0]+"% "+o0[1]+"%";el.style.transform="scale("+s+")"},[s,o0]);
     await pg.screenshot({path:nf(),type:"jpeg",quality:92});}
   m.to=n};
 await sheetSeg(sheets[0],2.4,[30,28],1,2.1,"c4");
 await sheetSeg(sheets[3],3.0,[26,52],1,2.9,"c5");
 await sheetSeg(sheets[2],2.6,[30,40],1,2.2,"c6");
 fs.writeFileSync(path.join(D,"state.json"),JSON.stringify({n,marks,swatches}));
 }
 /* ---- carduri și suprapuneri (PNG transparent, fontul aplicației rămâne încărcat) ---- */
 const F="font-family:Barlow,system-ui,sans-serif;";
 /* suprapunerile se fac la 1080×1920, DPR 1: context nou, același font al aplicației */
 await ctx.close();
 const ctx2=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
 const pg2=await ctx2.newPage();await pg2.goto("http://localhost:8802/app/index.html?lang="+L);await pg2.waitForFunction(()=>window.MAT_LOADED===true);await pg2.waitForTimeout(2000);
 await pg2.addStyleTag({content:"body::before{display:none!important}"});
 const shot=async(file,html,opaque)=>{await pg2.evaluate(([h,o])=>{document.body.innerHTML=h;document.documentElement.style.background=o?"#0e3b2a":"transparent";document.body.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);await pg2.screenshot({path:file,omitBackground:!opaque,type:"png"})};
 const card=(a,bb,c,eyebrow)=>`<div style="${F}position:fixed;inset:0;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:90px"><div style="font-weight:700;font-size:44px;letter-spacing:20px;opacity:.8">${eyebrow||"EBANIST"}</div><div style="font-weight:800;font-size:112px;line-height:1.05">${a}</div>${bb?`<div style="font-weight:700;font-size:78px;line-height:1.1;color:#d9c9a3">${bb}</div>`:""}${c?`<div style="margin-top:20px;font-weight:500;font-size:52px;line-height:1.2;opacity:.92">${c}</div>`:""}</div>`;
 const jpg=async(name,html)=>{const png=path.join(D,name+".png");await shot(png,html,true);const j=path.join(D,name+".jpg");cp.execFileSync("ffmpeg",["-loglevel","error","-y","-i",png,"-q:v","2",j]);return j};
 const hook=await jpg("card-hook",card(T.h1,T.h2,T.h3));
 const price=await jpg("card-price",card(T.p1,T.p2,T.p3,"PRO"));
 const end=await jpg("card-end",card(T.e1,"",T.e2).replace('</div></div>',`</div><div style="margin-top:24px;font-weight:700;font-size:60px;color:#d9c9a3">${T.e3}</div></div>`));
 await shot(path.join(OV,"hook-text.png"),`<div style="${F}position:fixed;left:0;right:0;bottom:0;height:900px;background:linear-gradient(to top,rgba(14,59,42,.92),rgba(14,59,42,0));display:flex;flex-direction:column;justify-content:flex-end;gap:18px;padding:0 70px 230px;text-align:center;color:#fff"><div style="font-weight:800;font-size:104px;line-height:1.05;text-shadow:0 4px 24px rgba(0,0,0,.45)">${T.h1}</div><div style="font-weight:800;font-size:84px;line-height:1.1;color:#d9c9a3;text-shadow:0 4px 24px rgba(0,0,0,.45)">${T.h2}</div><div style="font-weight:500;font-size:48px;opacity:.95;margin-top:10px">${T.h3}</div></div>`);
 for(const k of ["c1","c2","c3","c4","c5","c6"]) await shot(path.join(OV,"cap-"+k+".png"),`<div style="${F}position:fixed;left:50px;right:50px;${k==="c3"?"top:150px":"bottom:200px"};padding:30px 38px;border-radius:34px;background:rgba(14,59,42,.93);color:#fff;font-weight:700;font-size:62px;line-height:1.15;text-align:center;box-shadow:0 14px 50px rgba(0,0,0,.4)">${T[k]}</div>`);
 for(const [k,bg,fg] of [["free","#ffffff","#0e3b2a"],["pro","#d9c9a3","#0e3b2a"]]) await shot(path.join(OV,"badge-"+k+".png"),`<div style="${F}position:fixed;right:50px;top:70px;padding:16px 40px;border-radius:70px;background:${bg};color:${fg};font-weight:800;font-size:54px;letter-spacing:6px;box-shadow:0 10px 36px rgba(0,0,0,.28)">${T[k]}</div>`);
 for(const k of Object.keys(swatches)) await shot(path.join(OV,"sw-"+k+".png"),`<div style="${F}position:fixed;left:50px;top:70px;display:flex;align-items:center;gap:22px;padding:18px 34px;border-radius:70px;background:rgba(255,255,255,.94);font-weight:700;font-size:50px;color:#0e3b2a;box-shadow:0 10px 36px rgba(0,0,0,.28)"><span style="width:56px;height:56px;border-radius:50%;background:${swatches[k]};border:4px solid rgba(0,0,0,.15)"></span>${T[k]}</div>`);
 await b.close();srv.close();
 /* ---- secvența finală: hook + corp + preț + final; marcajele se mută după hook ---- */
 /* hook video opțional: vid-pro/hook-<lang>.mp4 (fără text în el); primele 4 s, textul se pune deasupra */
 const HOOKV=path.join(BASE,"hook-"+L+".mp4"), HS=path.join(D,"hookseq"); let hookN=0;
 if(fs.existsSync(HOOKV)){ fs.rmSync(HS,{recursive:true,force:true});fs.mkdirSync(HS);
   cp.execFileSync("ffmpeg",["-loglevel","error","-y","-t","4","-i",HOOKV,"-an","-vf",`scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},fps=${FPS}`,"-q:v","2",path.join(HS,"h_%05d.jpg")]);
   hookN=fs.readdirSync(HS).length; }
 const pre=hookN||Math.round(2.4*FPS), post=[[price,Math.round(3.0*FPS)],[end,Math.round(2.8*FPS)]];
 const tmp=BODY;
 let k2=0;const put=src=>fs.copyFileSync(src,path.join(SEQ,"s_"+String(++k2).padStart(5,"0")+".jpg"));
 if(hookN) for(let i=1;i<=hookN;i++) put(path.join(HS,"h_"+String(i).padStart(5,"0")+".jpg")); else for(let i=0;i<pre;i++) put(hook);
 for(let i=1;i<=n;i++) put(path.join(tmp,"s_"+String(i).padStart(5,"0")+".jpg"));
 for(const [f,c] of post) for(let i=0;i<c;i++) put(f);
 const ovs=[];
 if(hookN){ ovs.push({f:path.join(OV,"hook-text.png"),a:0.15,b:hookN/FPS}); }
 marks.forEach(m=>{const a=(m.from-1+pre)/FPS,bb=(m.to+pre)/FPS;
   if(m.cap)ovs.push({f:path.join(OV,"cap-"+m.cap+".png"),a,b:bb});
   if(m.badge)ovs.push({f:path.join(OV,"badge-"+m.badge+".png"),a,b:bb});
   if(m.sw)ovs.push({f:path.join(OV,"sw-"+m.sw+".png"),a,b:bb});});
 const merged=[];ovs.forEach(o=>{const p=merged.find(x=>x.f===o.f&&Math.abs(x.b-o.a)<1e-6);if(p)p.b=o.b;else merged.push({...o})});
 const ins=["-framerate",String(FPS),"-i",path.join(SEQ,"s_%05d.jpg")],fc=[];let last="0:v",ii=0;
 merged.forEach(o=>{ins.push("-loop","1","-i",o.f);ii++;const out="v"+ii;fc.push(`[${last}][${ii}:v]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})'[${out}]`);last=out});
 const outFile=path.join(BASE,"ebanist-pro-"+L+".mp4");
 cp.execFileSync("ffmpeg",[...["-loglevel","error","-y"],...ins,"-filter_complex",fc.join(";"),"-map","["+last+"]","-r",String(FPS),"-c:v","libx264","-crf","20","-preset","slow","-pix_fmt","yuv420p","-movflags","+faststart","-frames:v",String(k2),outFile],{stdio:"inherit"});
 console.log("gata",outFile,"cadre",k2,"sec",(k2/FPS).toFixed(1));
});
