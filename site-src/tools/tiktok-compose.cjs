/* Film TikTok, partea 2: pentru o limbă, face cardurile, foile A3 (animate), textele suprapuse și
   scoate mp4-ul 1080×1920. node site-src/tools/tiktok-compose.cjs <ro|it|en|fr>
   Cere vid-tt/frames și vid-tt/timeline.json din tiktok-frames.cjs. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const L=process.argv[2]||"ro", root=path.resolve(__dirname,"../.."), BASE=path.join(root,"vid-tt"), D=path.join(BASE,L);
const TL=JSON.parse(fs.readFileSync(path.join(BASE,"timeline.json"),"utf8")), FPS=TL.fps, W=TL.w, H=TL.h;
fs.rmSync(D,{recursive:true,force:true});fs.mkdirSync(path.join(D,"seq"),{recursive:true});fs.mkdirSync(path.join(D,"ov"),{recursive:true});
const T={
 ro:{h1:"Ebanist",h2:"Mobilier proiectat ca la fabrică",c1:"Alegi decorul. Îl vezi pe loc.",c2:"Uși și sertare, ca în realitate",c3:"Balamale Blum, desenate la detaliu",c4:"Culisante telescopice cu clemă",c5:"Mânere și rozete",c6:"Schimbi feroneria? Se schimbă pe loc",c7:"Îmbinările se văd: Domino, Confirmat, Lamello",c8:"Dosar tehnic A3 dintr-un clic",c9:"Foaie de fabricație: cote de la muchie la axa găurii",c10:"Foaie de montaj cu poziții numerotate",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Încearcă gratuit pe ebanist.com",e3:"Pro: exporturi și foi A3"},
 it:{h1:"Ebanist",h2:"Mobili progettati come in fabbrica",c1:"Scegli il decoro. Lo vedi subito.",c2:"Ante e cassetti, come nella realtà",c3:"Cerniere Blum disegnate nel dettaglio",c4:"Guide telescopiche con clip",c5:"Maniglie e rosette",c6:"Cambi la ferramenta? Cambia subito",c7:"Le giunzioni si vedono: Domino, Confirmat, Lamello",c8:"Dossier tecnico A3 con un clic",c9:"Foglio di fabbricazione: quote dal bordo all'asse del foro",c10:"Foglio di montaggio con posizioni numerate",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Provalo gratis su ebanist.com",e3:"Pro: esportazioni e fogli A3"},
 en:{h1:"Ebanist",h2:"Furniture designed like the factory does it",c1:"Pick the decor. See it instantly.",c2:"Doors and drawers, like the real thing",c3:"Blum hinges, drawn in detail",c4:"Telescopic slides with clip",c5:"Handles and rosettes",c6:"Change the hardware? It changes live",c7:"Joints you can see: Domino, Confirmat, Lamello",c8:"A3 technical dossier in one click",c9:"Shop sheet: dimensions from the edge to the hole axis",c10:"Assembly sheet with numbered positions",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Try it free at ebanist.com",e3:"Pro: exports and A3 sheets"},
 fr:{h1:"Ebanist",h2:"Du mobilier conçu comme en usine",c1:"Choisissez le décor. Voyez-le tout de suite.",c2:"Portes et tiroirs, comme en vrai",c3:"Charnières Blum dessinées en détail",c4:"Coulisses télescopiques avec clip",c5:"Poignées et rosaces",c6:"Vous changez la quincaillerie ? Ça change en direct",c7:"Les assemblages se voient : Domino, Confirmat, Lamello",c8:"Dossier technique A3 en un clic",c9:"Fiche de fabrication : cotes du bord à l'axe du perçage",c10:"Fiche de montage avec positions numérotées",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"À essayer gratuitement sur ebanist.com",e3:"Pro : exports et fiches A3"},
 de:{h1:"Ebanist",h2:"Möbel geplant wie in der Fabrik",c1:"Dekor wählen. Sofort sehen.",c2:"Türen und Schubladen wie in echt",c3:"Blum-Scharniere im Detail",c4:"Teleskopauszüge mit Clip",c5:"Griffe und Rosetten",c6:"Beschlag ändern? Ändert sich sofort",c7:"Verbindungen sichtbar: Domino, Confirmat, Lamello",c8:"A3-Technikmappe mit einem Klick",c9:"Fertigungsblatt: Maße von der Kante bis zur Bohrachse",c10:"Montageblatt mit nummerierten Positionen",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Kostenlos testen auf ebanist.com",e3:"Pro: Exporte und A3-Blätter"},
 es:{h1:"Ebanist",h2:"Muebles diseñados como en fábrica",c1:"Elige el acabado. Velo al instante.",c2:"Puertas y cajones, como en la realidad",c3:"Bisagras Blum dibujadas al detalle",c4:"Guías telescópicas con clip",c5:"Tiradores y rosetas",c6:"¿Cambias el herraje? Cambia al instante",c7:"Las uniones se ven: Domino, Confirmat, Lamello",c8:"Dossier técnico A3 con un clic",c9:"Hoja de fabricación: cotas del canto al eje del taladro",c10:"Hoja de montaje con posiciones numeradas",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Pruébalo gratis en ebanist.com",e3:"Pro: exportaciones y hojas A3"},
 pl:{h1:"Ebanist",h2:"Meble projektowane jak w fabryce",c1:"Wybierz dekor. Zobacz od razu.",c2:"Drzwi i szuflady jak w rzeczywistości",c3:"Zawiasy Blum narysowane w szczegółach",c4:"Prowadnice teleskopowe z klipsem",c5:"Uchwyty i rozety",c6:"Zmieniasz okucia? Zmieniają się od razu",c7:"Połączenia widać: Domino, Confirmat, Lamello",c8:"Teczka techniczna A3 jednym kliknięciem",c9:"Karta produkcyjna: wymiary od krawędzi do osi otworu",c10:"Karta montażu z numerowanymi pozycjami",m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Wypróbuj za darmo na ebanist.com",e3:"Pro: eksporty i arkusze A3"}}[L];
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8797,async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH||"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,colorScheme:"light"});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage(); pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200))); pg.setDefaultTimeout(60000);
 await pg.goto("http://localhost:8797/app/index.html?lang="+L);await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 const sheets=await pg.evaluate(async()=>{
   closeSheets();setView("build");const q=proj();q.pieces=[];q.configs={};q.layout={};
   const cfg={...PRESETS.armadio,name:"Dulap",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}};
   generateInto(q,cfg);persist();
   return packBuild(proj(),{cover:true,client:false,report:false,elev:true,asm:true,parts:true});
 });
 /* curăță interfața: tot ecranul e al nostru */
 await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent"});
 const shot=async(file,html,opaque)=>{await pg.evaluate(([h,o])=>{if(!document.getElementById("noglow")){const st=document.createElement("style");st.id="noglow";st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)}document.body.innerHTML=h;document.documentElement.style.background=o?"#0e3b2a":"transparent";document.body.style.background=o?"#0e3b2a":"transparent"},[html,!!opaque]);await pg.screenshot({path:file,omitBackground:!opaque,type:"png"})};
 const F="font-family:Barlow,system-ui,sans-serif;";
 /* carduri */
 const card=(a,bb,c)=>`<div style="${F}position:fixed;inset:0;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:90px"><div style="font-weight:700;font-size:44px;letter-spacing:20px;opacity:.8">EBANIST</div><div style="font-weight:800;font-size:112px;line-height:1.05">${a}</div><div style="font-weight:500;font-size:56px;line-height:1.2;opacity:.92">${bb}</div>${c?`<div style="margin-top:30px;font-weight:700;font-size:46px;color:#d9c9a3">${c}</div>`:""}</div>`;
 await shot(path.join(D,"card-hook.png"),card(T.h1,T.h2),true);
 await shot(path.join(D,"card-end.png"),card(T.e1,T.e2,T.e3),true);
 /* texte suprapuse (PNG transparent) */
 for(const k of ["c1","c2","c3","c4","c5","c6","c7","c8","c9","c10"]) await shot(path.join(D,"ov","cap-"+k+".png"),`<div style="${F}position:fixed;left:50px;right:50px;bottom:230px;padding:30px 38px;border-radius:34px;background:rgba(14,59,42,.93);color:#fff;font-weight:700;font-size:62px;line-height:1.15;text-align:center;box-shadow:0 14px 50px rgba(0,0,0,.4)">${T[k]}</div>`);
 const SW={m1:"#6E4B33",m2:"#C4A87C",m3:"#A8B08A",m4:"#6B2431",m5:"#5C7A99"};
 for(const k of Object.keys(SW)) await shot(path.join(D,"ov","sw-"+k+".png"),`<div style="${F}position:fixed;left:50px;top:70px;display:flex;align-items:center;gap:22px;padding:18px 34px;border-radius:70px;background:rgba(255,255,255,.94);font-weight:700;font-size:50px;color:#0e3b2a;box-shadow:0 10px 36px rgba(0,0,0,.28)"><span style="width:56px;height:56px;border-radius:50%;background:${SW[k]};border:4px solid rgba(0,0,0,.15)"></span>${T[k]}</div>`);
 /* foile A3, animate; textele foilor vin din limba aplicației */
 /* packBuild a lucrat pe DOM-ul aplicației; îl golim după ce avem SVG-urile */
 const frames=[];
 const sheetSeg=async(name,svg,sec,o0,s0,s1,cap)=>{
   const n=Math.round(sec*FPS), first=frames.length;
   await pg.evaluate(([svg])=>{document.body.innerHTML='<div id="stage" style="position:fixed;inset:0;background:#2f3430;overflow:hidden"><div id="sh" style="position:absolute;left:40px;top:50%;width:1000px;margin-top:-353px;background:#fff;box-shadow:0 20px 80px rgba(0,0,0,.55)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div></div>'},[svg]);
   for(let i=0;i<n;i++){const k=n>1?i/(n-1):0,e=k*k*(3-2*k),s=s0+(s1-s0)*e;
     await pg.evaluate(([s,o0])=>{const el=document.getElementById("sh");el.style.transformOrigin=o0[0]+"% "+o0[1]+"%";el.style.transform="scale("+s+")"},[s,o0]);
     const f=path.join(D,"sheet-"+name+"-"+String(i).padStart(3,"0")+".jpg");await pg.screenshot({path:f,type:"jpeg",quality:92});frames.push({file:f});}
   return {name,first,n,cap};
 };
 const sv=sheets;
 const segS=[];
 segS.push(await sheetSeg("cover",sv[0],2.2,[30,28],1,2.1,"c8"));
 segS.push(await sheetSeg("part",sv[3],2.8,[26,52],1,2.9,"c9"));
 segS.push(await sheetSeg("asm",sv[2],2.4,[30,40],1,2.2,"c10"));
 await b.close();srv.close();
 /* secvența finală: card, cadre 3D, foi, card */
 let n=0; const add=(file,times=1)=>{for(let i=0;i<times;i++){n++;const dst=path.join(D,"seq","s_"+String(n).padStart(5,"0")+".jpg");fs.copyFileSync(file,dst)}};
 const jpg=(png)=>{const j=png.replace(/\.png$/,".jpg");cp.execFileSync("ffmpeg",["-loglevel","error","-y","-i",png,"-q:v","2",j]);return j};
 const hook=jpg(path.join(D,"card-hook.png")), end=jpg(path.join(D,"card-end.png"));
 const marks=[]; // {from,to,cap,swatch}
 add(hook,Math.round(2.0*FPS));
 const SKIP=new Set((process.env.SKIP_SEGS||"").split(",").filter(Boolean));
 for(const s of TL.segs.filter(x=>!SKIP.has(x.name))){const f0=n+1;for(let i=0;i<s.n;i++)add(path.join(BASE,"frames","f_"+String(s.first+i).padStart(5,"0")+".jpg"));marks.push({from:f0,to:n,cap:s.cap,sw:s.swatch?s.swatch[0]:null})}
 for(const s of segS){const f0=n+1;for(let i=0;i<s.n;i++)add(path.join(D,"sheet-"+s.name+"-"+String(i).padStart(3,"0")+".jpg"));marks.push({from:f0,to:n,cap:s.cap,sw:null})}
 add(end,Math.round(2.8*FPS));
 /* vocea (Piper, doar pentru limbile cu voce): replică la începutul fiecărui segment */
 const VOICE_TXT={it:{hook:"Ebanist. Mobili progettati come in fabbrica.",c1:"Scegli il decoro, e lo vedi subito.",c2:"Ante e cassetti, come nella realtà.",c3:"Cerniere Blum, disegnate nel dettaglio.",c4:"Guide telescopiche, con la loro clip.",c5:"Maniglie, con rosette.",c6:"Cambi la ferramenta? Cambia all'istante.",c7:"E le giunzioni si vedono: Domino, Confirmat, Lamello.",c8:"Dossier tecnico A3, con un clic.",c9:"Quote dal bordo, all'asse del foro.",c10:"Foglio di montaggio, con posizioni numerate.",end:"Ebanist. Provalo gratis su ebanist punto com."}}[L];
 let voiceFile=null;
 if(VOICE_TXT&&process.env.PIPER_VOICE){
   const cues=[{start:0.35,avail:3.1,text:VOICE_TXT.hook}], seen=new Set();
   marks.forEach(m=>{ if(!m.cap||seen.has(m.cap)) return; seen.add(m.cap); const same=marks.filter(x=>x.cap===m.cap); const from=Math.min(...same.map(x=>x.from)), to=Math.max(...same.map(x=>x.to));
     cues.push({start:(from-1)/FPS+(m.cap==="c1"?1.5:0.12),avail:(to-from+1)/FPS-(m.cap==="c1"?1.6:0.2),text:VOICE_TXT[m.cap]}); });
   cues.push({start:(n-Math.round(2.8*FPS))/FPS+0.3,avail:2.3,text:VOICE_TXT.end});
   fs.writeFileSync(path.join(D,"cues.json"),JSON.stringify(cues));
   voiceFile=path.join(D,"voice.wav");
   cp.execFileSync(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(D,"cues.json"),voiceFile,String(n/FPS),process.env.PIPER_VOICE],{stdio:"inherit"});
 }
 /* ffmpeg: suprapunerile cu enable pe interval de timp */
 const ins=["-framerate",String(FPS),"-i",path.join(D,"seq","s_%05d.jpg")], fc=[]; let last="0:v", ii=0;
 const ovs=[];marks.forEach(m=>{if(m.cap)ovs.push({f:path.join(D,"ov","cap-"+m.cap+".png"),a:(m.from-1)/FPS,b:m.to/FPS});if(m.sw)ovs.push({f:path.join(D,"ov","sw-"+m.sw+".png"),a:(m.from-1)/FPS,b:m.to/FPS})});
 /* același text pe segmente consecutive se contopește */
 const merged=[];ovs.forEach(o=>{const p=merged.find(x=>x.f===o.f&&Math.abs(x.b-o.a)<1e-6);if(p)p.b=o.b;else merged.push({...o})});
 merged.forEach(o=>{ins.push("-loop","1","-i",o.f);ii++;const out="v"+ii;fc.push(`[${last}][${ii}:v]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})'[${out}]`);last=out});
 const outFile=path.join(BASE,"ebanist-tiktok-"+L+".mp4");
 /* Fără voce: codare pe segmente (fiecare cu cel mult 1–2 suprapuneri), apoi concatenare. Lanțul unic cu toate
    suprapunerile rula pe fiecare cadru și dura peste o oră. Cadrul 0-based [a·FPS, b·FPS) = cadrele numerotate de la a·FPS+1. */
 if(!voiceFile){
  const bounds=new Set([0,n]);merged.forEach(o=>{bounds.add(Math.round(o.a*FPS));bounds.add(Math.round(o.b*FPS))});
  const Bd=[...bounds].filter(x=>x>=0&&x<=n).sort((x,y)=>x-y), parts=[];
  for(let i=0;i<Bd.length-1;i++){
   const st=Bd[i], en=Bd[i+1]; if(en<=st) continue;
   const act=merged.filter(o=>Math.round(o.a*FPS)<=st&&Math.round(o.b*FPS)>=en);
   const a=["-loglevel","error","-y","-framerate",String(FPS),"-start_number",String(st+1),"-i",path.join(D,"seq","s_%05d.jpg")];
   const fcs=[]; let lastS="0:v";
   act.forEach((o,k)=>{a.push("-loop","1","-framerate",String(FPS),"-i",o.f);fcs.push(`[${lastS}][${k+1}:v]overlay=0:0:shortest=1[o${k}]`);lastS="o"+k});
   if(act.length) a.push("-filter_complex",fcs.join(";"),"-map","["+lastS+"]");
   const pf=path.join(D,"part-"+String(i).padStart(3,"0")+".mp4");
   a.push("-frames:v",String(en-st),"-r",String(FPS),"-c:v","libx264","-crf",process.env.FF_CRF||"22","-preset",process.env.FF_PRESET||"medium","-pix_fmt","yuv420p","-g",String(FPS*2),pf);
   cp.execFileSync("ffmpeg",a,{stdio:"inherit"}); parts.push(pf);
  }
  const lst=path.join(D,"parts.txt"); fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  cp.execFileSync("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy","-movflags","+faststart",outFile],{stdio:"inherit"});
  console.log("gata",outFile,"cadre",n,"sec",(n/FPS).toFixed(1));
  return;
 }
 if(voiceFile){ins.push("-i",voiceFile);}
 const args=[...["-loglevel","error","-y"],...ins,"-filter_complex",fc.join(";"),"-map","["+last+"]",...(voiceFile?["-map",(ii+1)+":a","-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:a","aac","-b:a","160k","-ar","44100"]:[]),"-r",String(FPS),"-c:v","libx264","-crf",process.env.FF_CRF||"20","-preset",process.env.FF_PRESET||"slow","-pix_fmt","yuv420p","-movflags","+faststart","-shortest",outFile];
 cp.execFileSync("ffmpeg",args,{stdio:"inherit"});
 console.log("gata",outFile,"cadre",n,"sec",(n/FPS).toFixed(1));
});
