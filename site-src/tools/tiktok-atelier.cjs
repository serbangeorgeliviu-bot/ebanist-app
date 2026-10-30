/* Film vertical (9:16) pentru TikTok — versiunea Atelier: proiect real (3 corpuri) → foi A3 → etichete cu QR → panoul de birou.
   node site-src/tools/tiktok-atelier.cjs <it|ro> [stills]
   „stills" salvează doar un cadru la fiecare scenă în vid-ta/<lang>/still-*.png (verificare rapidă).
   Altfel randează cadru cu cadru (nu înregistrare în timp real, care sacadează cu 3D și foi A3 mari):
   vid-ta/<lang>/seq/*.jpg la 24 fps + timeline.json; apoi tiktok-atelier-mux.cjs.
   Panoul Atelier folosește un Supabase simulat (ca în test/run.js): nicio comandă reală, titluri inventate. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const L=process.argv[2]||"it", STILLS=process.argv[3]==="stills", root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-ta",L);
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const T={
 it:{h1:"Ebanist Atelier",h2:"Dal progetto alla macchina, senza sorprese",
  c1:"Un progetto vero: 3 corpi, ogni pezzo con le sue quote",c2:"Dossier A3 con un clic: prospetti e sezioni",c3:"Montaggio con posizioni numerate",c4:"Foglio pezzo: quote dal bordo all'asse del foro",
  c5:"Un'etichetta con QR su ogni pezzo",c6:"In officina: ogni ordine, ogni postazione",c7:"I ritardi in rosso. Il capo vede tutto dall'ufficio",e1:"Ebanist",e2:"Provalo gratis su ebanist.com",e3:"Pro: fogli A3 ed etichette QR · Atelier in prova",
  jobs:["Cucina Villa Mare","Guardaroba camera","Boiserie salotto","Mobile ingresso"],lblTitle:"Etichette"},
 ro:{h1:"Ebanist Atelier",h2:"De la proiect la mașină, fără surprize",
  c1:"Un proiect real: 3 corpuri, fiecare piesă cu cotele ei",c2:"Dosar A3 dintr-un clic: prospecte și secțiuni",c3:"Montaj cu poziții numerotate",c4:"Foaia piesei: cote de la muchie la axa găurii",
  c5:"O etichetă cu QR pe fiecare piesă",c6:"În atelier: fiecare comandă, fiecare postazione",c7:"Întârzierile în roșu. Șeful vede tot din birou",e1:"Ebanist",e2:"Încearcă gratuit pe ebanist.com",e3:"Pro: foi A3 și etichete QR · Atelier în probă",
  jobs:["Bucătărie Villa Mare","Dressing dormitor","Boiserie living","Mobilă hol"],lblTitle:"Etichete"}}[L];
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"};
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}r.setHeader("content-type",MIME[path.extname(f)]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8802,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctxo={viewport:{width:540,height:960},deviceScaleFactor:1.5};
 const ctx=await b.newContext(ctxo);
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}));localStorage.setItem("ebAtelier","1")}catch(e){}});
 const pg=await ctx.newPage(); const errs=[]; pg.on("pageerror",e=>errs.push(String(e)));
 pg.setDefaultTimeout(30000); const w=ms=>pg.waitForTimeout(ms); let n=0; const marks=[];
 const FPS=24, SEQ=path.join(OUT,"seq"); fs.mkdirSync(SEQ,{recursive:true}); let fr=0;
 const mark=name=>marks.push({name,t:fr/FPS});
 const snap=async()=>{ if(STILLS) return null; const f=path.join(SEQ,"s_"+String(++fr).padStart(5,"0")+".jpg"); await pg.screenshot({path:f,type:"jpeg",quality:90}); return f; };
 const hold=async(sec)=>{ const f=await snap(); if(!f) return; const k=Math.max(0,Math.round(sec*FPS)-1); for(let i=0;i<k;i++){ fs.copyFileSync(f,path.join(SEQ,"s_"+String(++fr).padStart(5,"0")+".jpg")); } };
 const anim=async(sec,fn)=>{ if(STILLS){ await fn(1); return; } const N=Math.max(1,Math.round(sec*FPS)); for(let i=0;i<N;i++){ const k=N>1?i/(N-1):0; await fn(k*k*(3-2*k)); await snap(); } };
 const still=async(name)=>{ if(STILLS) await pg.screenshot({path:path.join(OUT,"still-"+String(++n).padStart(2,"0")+"-"+name+".png")}); };
 const cap=async(txt)=>pg.evaluate(t=>{let d=document.getElementById("vcap");if(!d){d=document.createElement("div");d.id="vcap";d.style.cssText="position:fixed;left:14px;right:14px;bottom:88px;z-index:2147483647;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.92);color:#fff;font:700 25px/1.2 Barlow,system-ui,sans-serif;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35)";document.body.appendChild(d)}d.textContent=t||"";d.style.display=t?"block":"none"},txt);
 const card=async(a,bb,c)=>pg.evaluate(([a,bb,c])=>{let d=document.getElementById("vcard");if(!d){d=document.createElement("div");d.id="vcard";d.style.cssText="position:fixed;inset:0;z-index:2147483646;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:Barlow,system-ui,sans-serif;text-align:center;padding:40px";document.body.appendChild(d)}d.innerHTML=a?`<div style="font:700 26px Barlow;letter-spacing:10px;opacity:.8">EBANIST</div><div style="font:800 54px/1.08 Barlow">${a}</div><div style="font:500 28px/1.25 Barlow;opacity:.92">${bb||""}</div>${c?`<div style="margin-top:14px;font:700 25px Barlow;color:#d9c9a3">${c}</div>`:""}`:"";d.style.display=a?"flex":"none"},[a,bb,c]);
 const sheet=async(svg,zoom)=>pg.evaluate(([svg,zoom])=>{let d=document.getElementById("vsheet");if(!d){d=document.createElement("div");d.id="vsheet";d.style.cssText="position:fixed;inset:0;z-index:2147483645;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden";document.body.appendChild(d)}
   if(!svg){d.style.display="none";return}d.style.display="flex";d.innerHTML='<div id="vsh" style="width:96vw;max-width:none;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transform-origin:'+zoom[0]+'% '+zoom[1]+'%;transform:scale(1)">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div>'},[svg,zoom]);
 const zoomTo=async(s)=>pg.evaluate(s=>{document.getElementById("vsh").style.transform="scale("+s+")"},s);
 const zoomAnim=async(sec,s1)=>anim(sec,k=>zoomTo(1+(s1-1)*k));
 await pg.goto("http://localhost:8802/app/index.html?lang="+L);await pg.waitForFunction(()=>window.MAT_LOADED===true);await w(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});await w(400);
 /* proiectul real, cu 3 corpuri (Cetinic); numele clientului nu apare în film */
 const txt=fs.readFileSync(path.join(root,"docs/Ebanist_Proiect_Cetinic-3-corpuri.json"),"utf8");
 const sheets=await pg.evaluate(async([txt,nm])=>{importJson(txt,"p.json");await new Promise(r=>setTimeout(r,900));const p=proj();p.name=nm;p.client="";persist();render();
   window.printOut=()=>{}; return packBuild(p,{cover:true,client:false,report:false,elev:true,asm:true,parts:true}).slice(0,6)},[txt,T.jobs[3]]);
 /* 0. hook */
 await card(T.h1,T.h2);mark("hook");await hold(2.8);await still("hook");await card("");
 /* 1. camera în 3D, orbită lentă */
 await pg.evaluate(()=>{ROOM_VIEW.yaw=-.5;$("btnRoom3D").click()});await w(900);
 await cap(T.c1);mark("c1");await still("room");
 await anim(4.7,k=>pg.evaluate(k=>{ROOM_VIEW.yaw=-.5+k;drawRoom3D()},k));await hold(.3);
 await cap("");await pg.evaluate(()=>closeSheets());
 /* 2. foile A3 */
 await cap(T.c2);mark("c2");await sheet(sheets[1],[26,40]);await hold(.8);await zoomAnim(2.6,2.0);await hold(1.0);await still("elev");
 await cap(T.c3);mark("c3");await sheet(sheets[2],[30,40]);await hold(.7);await zoomAnim(2.4,1.9);await hold(.9);await still("asm");
 await cap(T.c4);mark("c4");await sheet(sheets[sheets.length-1],[22,50]);await hold(.8);await zoomAnim(2.6,2.6);await hold(1.1);await still("part");
 await sheet(null);await cap("");
 /* 3. etichete cu QR (aceeași etichetă ca la tipărire, cu comanda neschimbată) */
 await pg.evaluate(()=>{const p=proj();const m={};m[p.id]={job:"3f2b8c1e-5a47-4d09-9c1a-7e6d2b41a0f5",sig:EBAtelier.rowSig(p.pieces)};localStorage.setItem("ebAtelierJobs",JSON.stringify(m));
   document.getElementById("btnLabels").click();
   const pa=document.getElementById("printArea");const html=pa.innerHTML;pa.innerHTML="";
   const css=[...document.styleSheets].flatMap(s=>{try{return[...s.cssRules]}catch(e){return[]}}).filter(r=>r.type===4&&/print/.test(r.conditionText||r.media.mediaText)).flatMap(r=>[...r.cssRules]).map(r=>r.cssText).filter(t=>/\.lbl|\.qr|\.hasqr|\.l-hinge|\.dim/.test(t)).join("\n");
   const d=document.createElement("div");d.id="vlab";d.style.cssText="position:fixed;inset:0;z-index:2147483645;background:#e7e2d6;display:flex;align-items:center;justify-content:center;overflow:hidden";
   d.innerHTML="<style>"+css+"#vlab .lbl-grid{display:grid;grid-template-columns:repeat(2,70mm);grid-auto-rows:37mm;gap:5mm;zoom:.9;transform-origin:center;background:transparent}#vlab .lbl{background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.25);border:0}</style><div class='lbl-grid' style='margin-top:-40px'>"+html.replace(/^<div class="lbl-grid">/,"").replace(/<\/div>$/,"")+"</div>";
   document.body.appendChild(d);
   /* doar primele 6 etichete */ [...d.querySelectorAll(".lbl")].slice(8).forEach(x=>x.remove());});
 await cap(T.c5);mark("c5");await hold(4.3);await still("labels");
 await pg.evaluate(()=>{const d=document.getElementById("vlab");if(d)d.remove()});await cap("");
 /* 4. panoul de birou (Supabase simulat, ca în test/run.js) */
 await pg.evaluate(async(jobs)=>{
   const iso=h=>new Date(Date.now()+h*3600e3).toISOString(), day=d=>new Date(Date.now()+d*86400e3).toISOString().slice(0,10);
   const list=[{id:"j1",title:jobs[0],client_label:null,due_date:day(-3),state:"in_progress",last_station:"cnc",last_at:iso(-5),total_pieces:42},
     {id:"j2",title:jobs[1],client_label:null,due_date:day(6),state:"in_progress",last_station:"bordatrice",last_at:iso(-2),total_pieces:28},
     {id:"j3",title:jobs[2],client_label:null,due_date:day(12),state:"confirmed",last_station:"sezionatrice",last_at:iso(-30),total_pieces:36},
     {id:"j4",title:jobs[3],client_label:null,due_date:day(20),state:"confirmed",last_station:null,last_at:null,total_pieces:20}];
   const P=(st,tot,done,iss)=>({station:st,total_pieces:tot,done_pieces:done,station_done:done>=tot,issues:iss||0,reworks:0,last_at:iso(-3)});
   const prog={j1:[P("magazzino",42,42),P("sezionatrice",42,42),P("bordatrice",42,42),P("cnc",42,26,1),P("verniciatura",42,0),P("assemblaggio",42,0)],
     j2:[P("magazzino",28,28),P("sezionatrice",28,28),P("bordatrice",28,11)],j3:[P("magazzino",36,36),P("sezionatrice",36,9)],j4:[]};
   let mine;
   window.sb={from(t){const c={select(){return c},eq(){return c},is(){return c},gt(){return c},order(){return c},then(res){res({data:t==="atelier_members"?mine:[],error:null})}};return c},
     async rpc(fn,a){return fn==="job_status_list"?{data:list,error:null}:fn==="job_progress"?{data:prog[a.p_job]||[],error:null}:{data:[],error:null}}};
   sb=window.sb; acctSession={user:{id:"u-a",email:"a@test.local"}};
   mine=[{atelier_id:"at1",role:"responsabil",stations:[],ateliers:{id:"at1",name:"Atelier",slug:"atelier"}}];
   closeSheets();atMine=[];atScreen={name:"detail",id:"at1"};openSheet("shAtelier");await atRefreshMine();await atRender();},T.jobs);
 await w(900);await cap(T.c6);mark("c6");await still("board");await hold(3.6);
 await pg.evaluate(()=>{const b=document.getElementById("atBody");const tb=b.querySelector("table");if(tb)tb.scrollIntoView({block:"center"})});
 await cap(T.c7);mark("c7");await w(200);await hold(4.2);await still("board2");
 await cap("");await pg.evaluate(()=>closeSheets());
 /* final */
 await card(T.e1,T.e2,T.e3);mark("end");await hold(3.4);
 fs.writeFileSync(path.join(OUT,"timeline.json"),JSON.stringify({fps:FPS,marks,total:fr/FPS,lang:L}));
 console.log("errs",JSON.stringify(errs.slice(0,5)),"s",fr/FPS,JSON.stringify(marks));
 await ctx.close();await b.close();srv.close();});
