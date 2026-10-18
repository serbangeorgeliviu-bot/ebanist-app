/* Film vertical (9:16) pentru TikTok: aplicația reală, înregistrată cu Playwright.
   node site-src/tools/tiktok.cjs <ro|it|en|fr> [stills]
   „stills" nu filmează: salvează un cadru la fiecare marcaj în vid-tt/<lang>/still-*.png
   Ieșire: vid-tt/<lang>/*.webm (+ cut.txt); apoi ffmpeg → mp4 1080×1920, 30 fps. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const L=process.argv[2]||"ro", STILLS=process.argv[3]==="stills", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-tt",L);
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const T={
 ro:{h1:"Ebanist",h2:"Mobilier proiectat ca la fabrică",
  c1:"Alegi decorul. Îl vezi pe loc.",c2:"Uși și sertare, ca în realitate",c3:"Balamale Blum, desenate la detaliu",c4:"Culisante telescopice cu clemă",
  c5:"Mânere și rozete",c6:"Schimbi feroneria? Se schimbă pe loc",c7:"Îmbinările se văd: Domino, Confirmat, Lamello",c8:"Dosar tehnic A3 dintr-un clic",c9:"Foaie de fabricație: cote de la muchie la axa găurii",c10:"Foaie de montaj cu poziții numerotate",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Încearcă gratuit pe ebanist.com"},
 it:{h1:"Ebanist",h2:"Mobili progettati come in fabbrica",
  c1:"Scegli il decoro. Lo vedi subito.",c2:"Ante e cassetti, come nella realtà",c3:"Cerniere Blum disegnate nel dettaglio",c4:"Guide telescopiche con clip",
  c5:"Maniglie e rosette",c6:"Cambi la ferramenta? Cambia subito",c7:"Le giunzioni si vedono: Domino, Confirmat, Lamello",c8:"Dossier tecnico A3 con un clic",c9:"Foglio di fabbricazione: quote dal bordo all'asse del foro",c10:"Foglio di montaggio con posizioni numerate",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Provalo gratis su ebanist.com"},
 en:{h1:"Ebanist",h2:"Furniture designed like the factory does it",
  c1:"Pick the decor. See it instantly.",c2:"Doors and drawers, like the real thing",c3:"Blum hinges, drawn in detail",c4:"Telescopic slides with clip",
  c5:"Handles and rosettes",c6:"Change the hardware? It changes live",c7:"Joints you can see: Domino, Confirmat, Lamello",c8:"A3 technical dossier in one click",c9:"Shop sheet: dimensions from the edge to the hole axis",c10:"Assembly sheet with numbered positions",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"Try it free at ebanist.com"},
 fr:{h1:"Ebanist",h2:"Du mobilier conçu comme en usine",
  c1:"Choisissez le décor. Voyez-le tout de suite.",c2:"Portes et tiroirs, comme en vrai",c3:"Charnières Blum dessinées en détail",c4:"Coulisses télescopiques avec clip",
  c5:"Poignées et rosaces",c6:"Vous changez la quincaillerie ? Ça change en direct",c7:"Les assemblages se voient : Domino, Confirmat, Lamello",c8:"Dossier technique A3 en un clic",c9:"Fiche de fabrication : cotes du bord à l'axe du perçage",c10:"Fiche de montage avec positions numérotées",
  m1:"Nogal Victoria",m2:"Rovere Wood Lime",m3:"Avocado Green",m4:"Bordeaux",m5:"Blue Avio",e1:"Ebanist",e2:"À essayer gratuitement sur ebanist.com"}}[L];
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8794,async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctxo={viewport:{width:540,height:960},deviceScaleFactor:1.5};
 if(!STILLS) ctxo.recordVideo={dir:OUT,size:{width:810,height:1440}};
 const ctx=await b.newContext(ctxo);
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage(); const errs=[]; pg.on("pageerror",e=>errs.push(String(e)));
 pg.setDefaultTimeout(20000); const w=ms=>pg.waitForTimeout(ms); const t0=Date.now(); let cutAt=0, n=0;
 const still=async(name)=>{ if(STILLS) await pg.screenshot({path:path.join(OUT,"still-"+String(++n).padStart(2,"0")+"-"+name+".png")}); };
 const cap=async(txt,sub)=>pg.evaluate(([t,s])=>{let d=document.getElementById("vcap");if(!d){d=document.createElement("div");d.id="vcap";d.style.cssText="position:fixed;left:14px;right:14px;bottom:88px;z-index:2147483647;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.92);color:#fff;font:700 25px/1.2 Barlow,system-ui,sans-serif;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)";document.body.appendChild(d)}d.innerHTML=t?(t+(s?'<div style="font:500 17px Barlow;opacity:.85;margin-top:4px">'+s+'</div>':'')):"";d.style.display=t?"block":"none"},[txt,sub||""]);
 const swatch=async(name,hex)=>pg.evaluate(([n,h])=>{let d=document.getElementById("vsw");if(!d){d=document.createElement("div");d.id="vsw";d.style.cssText="position:fixed;left:14px;top:16px;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:30px;background:rgba(255,255,255,.92);font:700 20px Barlow,system-ui,sans-serif;color:#0e3b2a;box-shadow:0 4px 16px rgba(0,0,0,.25)";document.body.appendChild(d)}d.innerHTML=n?'<span style="width:22px;height:22px;border-radius:50%;background:'+h+';border:2px solid rgba(0,0,0,.15)"></span>'+n:"";d.style.display=n?"flex":"none"},[name,hex||""]);
 const card=async(a,bb)=>pg.evaluate(([a,bb])=>{let d=document.getElementById("vcard");if(!d){d=document.createElement("div");d.id="vcard";d.style.cssText="position:fixed;inset:0;z-index:2147483646;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Barlow,system-ui,sans-serif;text-align:center;padding:40px";document.body.appendChild(d)}d.innerHTML=a?`<div style="font:700 26px Barlow;letter-spacing:10px;opacity:.8">EBANIST</div><div style="font:800 54px/1.08 Barlow">${a}</div><div style="font:500 28px/1.25 Barlow;opacity:.92">${bb||""}</div>`:"";d.style.display=a?"flex":"none"},[a,bb]);
 const sheet=async(svg,zoom)=>pg.evaluate(([svg,zoom])=>{let d=document.getElementById("vsheet");if(!d){d=document.createElement("div");d.id="vsheet";d.style.cssText="position:fixed;inset:0;z-index:2147483645;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden";document.body.appendChild(d)}
   if(!svg){d.style.display="none";return}d.style.display="flex";d.innerHTML='<div id="vsh" style="width:96vw;max-width:none;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transition:transform 2.6s ease-in-out;transform-origin:'+(zoom?zoom[0]+'% '+zoom[1]+'%':'50% 50%')+';transform:scale(1)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div>'},[svg,zoom]);
 const zoomTo=async(s)=>pg.evaluate(s=>{document.getElementById("vsh").style.transform="scale("+s+")"},s);
 await pg.goto("http://localhost:8794/app/index.html?lang="+L);await pg.waitForFunction(()=>window.MAT_LOADED===true);await w(3500);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{}); await w(400);
 /* corpul-vitrină: dulap complex, uși + sertare + raft + bară, mâner inox */
 await pg.evaluate(()=>{closeSheets();const q=proj();q.pieces=[];q.configs={};q.layout={};
   state.settings.matBody="antracite_storm_grey_19";state.settings.matFront="nogal_victoria_19";
   window.__cfg={...PRESETS.armadio,name:"Dulap",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}};
   generateInto(q,window.__cfg);persist();setView("build");
   document.body.classList.add("vp-full");$("bldView").classList.add("full");
   const st=document.createElement("style");st.textContent="#bldView .vbtns,#bldView button,#bldView .vctl,.vp-full .topbar,.vp-full header{display:none!important} .vp-full nav,.vp-full .tabbar,.vp-full .bnav,#buildInfo{display:none!important}";document.head.appendChild(st);
   window.GL3D.resize();});
 await w(1500);
 const R=async(cfgPatch,st)=>pg.evaluate(([p,s])=>{const c={...window.__cfg,...p};window.__cur=c;GL3D.render(c,{explode:0});if(s)GL3D.set(s);},[cfgPatch||{},st||null]);
 const V=async(yaw,pitch,zoom)=>pg.evaluate(([a,b,c])=>{VIEW.yaw=a;VIEW.pitch=b;VIEW.zoom=c;GL3D.touch()},[yaw,pitch,zoom]);
 const orbit=async(y0,y1,p0,p1,z0,z1,ms)=>{const steps=Math.round(ms/90);for(let i=0;i<=steps;i++){const k=i/steps,e=k*k*(3-2*k);await V(y0+(y1-y0)*e,p0+(p1-p0)*e,z0+(z1-z0)*e);await w(ms/steps)}};
 const pkOf=async(sel)=>pg.evaluate(sel=>{const M=GL3D.model();const pc=M.ops.pieces.find(new Function("q","return "+sel));return pc?pc.pk:null},sel);
 const spot=async(type,pick,dz)=>pg.evaluate(([type,pick,dz])=>{const M=GL3D.model();const hs=M.ops.hw.filter(h=>h.type===type);const h=hs[Math.min(hs.length-1,Math.floor(hs.length*pick))];const pc=M.ops.pieces.find(q=>String(q.pk)===String(h.piece));const c=[0,1,2].map(i=>(pc.min[i]+pc.max[i])/2);return {pk:pc.pk,off:[0,1,2].map(i=>h.w[i]-c[i]+(i===2?dz:0)),against:h.against}},[type,pick,dz||0]);
 const focus=async(pk,rad,off)=>pg.evaluate(([a,b,c])=>GL3D.focusOn(a,b,c),[pk,rad,off||[0,0,0]]);
 /* 0. hook */
 const Z=1.5;
 await R({},{open:false,hw:false,holes:false,dims:false,edges:false});await V(.35,.2,Z);await card(T.h1,T.h2);cutAt=Date.now()-t0;await w(2200);await card("");await still("hook");
 /* 1. decoruri */
 await cap(T.c1);
 const decors=[["nogal_victoria_19","#6E4B33",T.m1],["rovere_wood_lime_classic_k2414ah_19","#C4A87C",T.m2],["avocado_green_22458mn_19","#A8B08A",T.m3],["bordeaux_19","#6B2431",T.m4],["blue_avio_23196mn_19","#5C7A99",T.m5]];
 let k=0;
 for(const [id,hex,nm] of decors){ await R({matFront:id},{open:false,hw:false}); await swatch(nm,hex); await still("decor-"+id.split("_")[0]); const y0=k%2?.62:.22; await orbit(y0,k%2?.22:.62,.2,.22,Z,Z+.05,1500); k++; }
 await swatch("");
 /* 2. uși și sertare deschise */
 await R({matFront:"nogal_victoria_19"},{open:true,hw:false});await cap(T.c2);await orbit(.3,-.35,.2,.34,Z,Z+.1,3200);await still("open");
 /* 3. balama: din interior, ușa deschisă */
 await R({matFront:"nogal_victoria_19"},{open:true,hw:true});
 const hg=await spot("cerniera",.4);
 await cap(T.c3);await focus(hg.pk,120,hg.off);await V(-1.05,.15,1.6);await w(1400);await orbit(-1.05,-.45,.15,.3,1.6,2.4,2600);await still("hinge");
 /* 4. culisantă telescopică */
 const sl=await spot("guida",0,70);
 await cap(T.c4);await focus(sl.pk,260,sl.off);await V(-.5,.45,1.4);await w(1200);await orbit(-.5,.7,.45,.25,1.4,2.2,3000);await still("slide");
 /* 5. mâner */
 await R({matFront:"nogal_victoria_19"},{open:false,hw:false});
 const hd=await spot("maniglia",0);
 await cap(T.c5);await focus(hd.pk,170,hd.off);await V(.5,.1,1.6);await w(1000);await orbit(.5,-.55,.1,.2,1.6,3,2600);await still("handle");
 /* 6. feronerie schimbată live */
 await cap(T.c6);await R({hwSel:{man:"gen_pomo",cern:"haf_metalla",guida:"blum_230m",conn:"fes_domino"}},{open:false,hw:false});
 const hk=await spot("maniglia",0);await focus(hk.pk,200,hk.off);await V(.4,.1,1.8);await w(1100);await still("knob");await orbit(.4,-.4,.1,.2,1.8,2.6,1800);
 /* 7. îmbinări (vedere explodată) */
 await cap(T.c7);await pg.evaluate(()=>GL3D.focusOn(null));await R({hwSel:{man:"haf_bar128",conn:"fes_domino"}},{open:false,hw:true});await pg.evaluate(()=>GL3D.set({explode:.6,hw:true}));
 await orbit(.4,.75,.3,.28,Z-.1,Z+.15,3400);await still("joints");
 await pg.evaluate(()=>GL3D.set({explode:0}));
 /* 8. dosar */
 await cap("");
 const sheets=await pg.evaluate(()=>{closeSheets();const p=proj();return packBuild(p,{cover:true,client:false,report:false,elev:true,asm:true,parts:true}).slice(0,6)});
 await cap(T.c8);await sheet(sheets[0],[28,30]);await w(900);await zoomTo(1.9);await w(2200);
 await cap(T.c9);const part=sheets[sheets.length-1];await sheet(part,[22,50]);await w(900);await zoomTo(2.6);await w(2400);await still("sheet");
 await cap(T.c10);await sheet(sheets[2]||sheets[1],[30,40]);await w(900);await zoomTo(1.9);await w(2400);await sheet(null);
 /* final */
 await cap("");await card(T.e1,T.e2);await w(3000);
 fs.writeFileSync(path.join(OUT,"cut.txt"),String(cutAt));
 console.log("errs",JSON.stringify(errs.slice(0,5)),"sec",Math.round((Date.now()-t0)/1000));
 await ctx.close();await b.close();srv.close();});
