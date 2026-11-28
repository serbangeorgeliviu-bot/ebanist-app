/* Două clipuri TikTok „de dezbatere”, făcute din ecranele REALE ale aplicației (nu din randarea 3D), 9:16, voce italiană (Nicola).
     «hot»   : „I bravi artigiani non hanno bisogno di app.” → un fianco fuori misura (simulat) → controlul îl prinde → corecția.
     «guess» : „Quanti pannelli interi servono per questa cucina?” → tur 3D + Riepilogo → întrebare; răspunsul merge în comentariul fixat.
   Etape (ieșire în vid-hot/, ignorat de git):
     node site-src/tools/hot-clips.cjs shots          capturile ecranelor + cardurile → shots/*.png, facts.json (numerele reale din aplicație)
     node site-src/tools/hot-clips.cjs mux hot|guess  vocea (Kokoro) + ffmpeg → ebanist-hot-it.mp4 / ebanist-guess-it.mp4
   Proiectul: vid-boom/proj.json (bucătăria U demo, creată de kitchen-boom-clip.cjs). Tur 3D: vid-boom/seq/tour (ONLY=tour la kitchen-boom-clip.cjs frames).
   Reguli de conținut: **nicio sumă în euro** (prețul materialului din demo e implicit, «prezzo da impostare»); numărul de piese e cel din Riepilogo
   (`computeTotals().panelPcs`), nu numărul de rânduri din distinctă; eroarea din «hot» e declarată «simulazione». */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"shots", WHICH=process.argv[3], root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-hot"), SH=path.join(OUT,"shots");
const FPS=24, KOKORO=process.env.KOKORO_DIR||"/tmp/tts/kokoro", VOICE=process.env.KOKORO_VOICE||"im_nicola";
const FONT="/usr/share/fonts/opentype/inter/Inter-Black.otf";
fs.mkdirSync(SH,{recursive:true});
const IT_UNITS=["zero","uno","due","tre","quattro","cinque","sei","sette","otto","nove","dieci","undici","dodici","tredici","quattordici","quindici","sedici","diciassette","diciotto","diciannove"];
const IT_TENS=["","","venti","trenta","quaranta","cinquanta","sessanta","settanta","ottanta","novanta"];
function itNum(n){if(n<20)return IT_UNITS[n];if(n<100){const t=Math.floor(n/10),u=n%10;let w=IT_TENS[t];if(u===1||u===8)w=w.slice(0,-1);return w+(u===3?"tré":u?IT_UNITS[u]:"")}
  const c=Math.floor(n/100),r=n%100;let w=(c===1?"cento":IT_UNITS[c]+"cento");if(r===0)return w;if(r>=80&&r<90)w=w.slice(0,-1);return w+itNum(r)}
/* scene: png (în shots/), sec, zoom = [de la, până la] (Ken Burns lent) */
const CLIPS={
 hot:{out:"ebanist-hot-it.mp4",segs:[
  {id:"h1",sec:4.2,video:"gemini-hook.mp4",ov:"h1t"},{id:"h2",sec:3.6,z:[1.0,1.07]},{id:"h3",sec:4.2,z:[1.0,1.06]},{id:"h4",sec:3.2,z:[1.0,1.05]},{id:"h5",sec:3.6,z:[1,1]}],
  cues:()=>[["h1",.55,"I bravi artigiani non hanno bisogno di app."],["h2",.2,"Un fianco fuori misura di tre millimetri."],["h3",.2,"Ebanist se ne accorge prima del taglio."],["h4",.2,"Corretto con un tocco."],["h5",.2,"Voi, quante volte avete tagliato un pezzo sbagliato?"]]},
 guess:{out:"ebanist-guess-it.mp4",segs:[
  {id:"g1",sec:3.0,z:[1,1]},{id:"gtour",sec:4.0,tour:true},{id:"g3",sec:4.2,z:[1.0,1.06]},{id:"g4",sec:3.6,z:[1,1]}],
  cues:f=>[["g1",.25,"Quanti pannelli interi servono per questa cucina?"],["gtour",.15,"Ventisette moduli. Una cucina a U."],
    ["g3",.15,"Più di "+itNum(Math.floor(f.sqm))+" metri quadri di pannelli. "+itNum(f.pcs)+" pezzi."],["g4",.2,"Scrivi il tuo numero nei commenti."]]}};

if(MODE==="mux"){
  const C=CLIPS[WHICH]; if(!C) throw new Error("hot|guess");
  const facts=JSON.parse(fs.readFileSync(path.join(OUT,"facts.json"),"utf8"));
  let t=0; for(const s of C.segs){s.t0=t;s.n=Math.round(s.sec*FPS);t+=s.n/FPS}
  const total=t, tmp=path.join(OUT,"tmp-"+WHICH); fs.mkdirSync(tmp,{recursive:true});
  const cues=C.cues(facts).map(([id,off,text])=>{const s=C.segs.find(x=>x.id===id);return {start:s.t0+off,avail:s.sec-off,text}});
  fs.writeFileSync(path.join(tmp,"cues.json"),JSON.stringify(cues));
  const wav=path.join(tmp,"voice.wav");
  cp.execFileSync(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(tmp,"cues.json"),wav,String(total),"kokoro:"+VOICE+":"+KOKORO+":it"],{stdio:"inherit"});
  const enc=["-r",String(FPS),"-c:v","libx264","-crf","20","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)], parts=[];
  C.segs.forEach((s,i)=>{
    const pf=path.join(tmp,"p"+i+".mp4"), a=["-loglevel","error","-y"], n=s.n;
    if(s.video){ /* hook generat cu AI (Gemini/Veo), 720×1280 → 1080×1920, primele s.sec secunde, textul peste imagine */
      a.push("-i",path.join(OUT,s.video),"-loop","1","-framerate",String(FPS),"-i",path.join(SH,s.ov+".png"),"-filter_complex",
        `[0:v]scale=1080:1920:flags=lanczos,fps=${FPS}[v];[1:v]format=rgba,fade=t=in:st=0.3:d=0.3:alpha=1[t];[v][t]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.15[o]`,"-map","[o]");}
    else if(s.tour){a.push("-framerate",String(fs.readdirSync(path.join(root,"vid-boom/seq/tour")).length/s.sec),"-i",path.join(root,"vid-boom/seq/tour/f_%04d.jpg"),"-vf","fade=t=in:st=0:d=0.2");}
    else{const z=s.z; /* zoom lent pe imaginea fixă: zoompan la 1080×1920, ieșire pe n cadre */
      a.push("-loop","1","-framerate",String(FPS),"-i",path.join(SH,s.id+".png"),"-vf",
        `scale=2160:3840,zoompan=z='${z[0]}+(${z[1]}-${z[0]})*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=${FPS},fade=t=in:st=0:d=0.2`)}
    a.push("-frames:v",String(n),...enc,pf); cp.execFileSync("ffmpeg",a,{stdio:"inherit"}); parts.push(pf);
  });
  const lst=path.join(tmp,"parts.txt"); fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const silent=path.join(tmp,"silent.mp4"); cp.execFileSync("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",silent]);
  const out=path.join(OUT,C.out);
  cp.execFileSync("ffmpeg",["-loglevel","error","-y","-i",silent,"-i",wav,"-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:v","copy","-c:a","aac","-b:a","160k","-ar","44100","-movflags","+faststart","-shortest",out],{stdio:"inherit"});
  console.log("gata",out,total.toFixed(1)+" s"); process.exit(0);
}

const PROJ=JSON.parse(fs.readFileSync(path.join(root,"vid-boom/proj.json"),"utf8"));
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8805,async()=>{
 const b=await chromium.launch({args:["--no-sandbox"]});
 /* 432×768 la scara 2,5 = exact 1080×1920 */
 const ctx=await b.newContext({viewport:{width:432,height:768},deviceScaleFactor:2.5});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(120000);
 await pg.goto("http://localhost:8805/app/index.html?lang=it");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(2500);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 const FF="font-family:Barlow,system-ui,sans-serif;";
 const cap=async(a,c,bot)=>pg.evaluate(([a,c,FF,bot])=>{document.getElementById("__cap")?.remove();if(!a)return;const d=document.createElement("div");d.id="__cap";
   d.style.cssText=FF+"position:fixed;left:14px;right:14px;"+(bot?"bottom:104px":"top:96px")+";z-index:99999;padding:12px 16px;border-radius:14px;background:rgba(14,59,42,.95);color:#fff;font-weight:800;font-size:25px;line-height:1.2;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.4)";
   d.innerHTML=a+(c?`<div style="font-weight:500;font-size:16px;opacity:.88;margin-top:4px">${c}</div>`:"");document.body.appendChild(d)},[a,c,FF,bot]);
 const shot=async n=>{await pg.waitForTimeout(700);await pg.screenshot({path:path.join(SH,n+".png")})};
 /* proiectul demo + numerele reale */
 const facts=await pg.evaluate(([P])=>{closeSheets();const S=state.settings;S.matBody="antracite_storm_grey_19";S.matFront="blue_avio_23196mn_19";S.matBack="antracite_storm_grey_19";
   state.projects.push(P);state.activeId=P.id;persist();const p=proj(),tot=computeTotals(p),PU=panelUsage(p);
   const fmts=Object.keys(PU).filter(k=>!PU[k].acc).map(k=>({mat:tot.mats[k].label,pannelli:PU[k].neu,formato:PU[k].PN.L+"×"+PU[k].PN.W}));
   return {pcs:tot.panelPcs,sqm:tot.panelArea,edge:tot.edge,rows:p.pieces.length,interi:fmts.reduce((s,x)=>s+x.pannelli,0),fmts,waste:S.waste}},[PROJ]);
 fs.writeFileSync(path.join(OUT,"facts.json"),JSON.stringify(facts,null,1)); console.log(JSON.stringify(facts));
 /* ---- guess: Riepilogo fără suma în euro ---- */
 await pg.evaluate(()=>{setView("summary");render();document.querySelectorAll("#sumKpis .kpi.hl").forEach(e=>e.style.visibility="hidden");["matTable","hwTable","costTable"].forEach(i=>{const e=document.getElementById(i);if(e)e.style.display="none"});window.scrollTo(0,0)});
 await cap("Cucina a U · 27 moduli","Riepilogo calcolato da Ebanist",true); await shot("g3");
 /* ---- hot: un fianco +3 mm (simulazione) ---- */
 const N="Base lavello 1.3";
 await pg.evaluate(n=>{closeSheets();document.getElementById("__cap")?.remove();const p=proj(),r=p.pieces.find(x=>x.modulo===n&&/fianc/i.test(x.elemento));r.lung=(+r.lung)+3;persist();setView("list");render();auditBadge&&auditBadge()},N);
 await pg.waitForTimeout(600);await cap("Un fianco fuori misura di 3 mm","simulazione"); await shot("h2");
 await pg.evaluate(n=>{fixSheet(n)},N); await cap(""); await pg.waitForTimeout(400); await shot("h3");
 await pg.getByRole("button",{name:/Applica le soluzioni/i}).click(); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{closeSheets()}); await cap("Corretto con un tocco","i controlli sono di nuovo verdi"); await shot("h4");
 const green=await pg.evaluate(n=>{const p=proj();return auditModule(p.configs[n],p.pieces.filter(x=>x.modulo===n)).filter(a=>a.severity==="blocking").length},N);
 facts.blockingAfterFix=green; fs.writeFileSync(path.join(OUT,"facts.json"),JSON.stringify(facts,null,1)); console.log("controale blocante după corecție:",green);
 /* ---- carduri (pagina e golită) ---- */
 const logo="data:image/png;base64,"+fs.readFileSync(path.join(root,"site/video/ebanist-logo-512.png")).toString("base64");
 await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;overflow:hidden";const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background:#0e3b2a!important;background-image:none!important}";document.head.appendChild(st)});
 const card=async(n,big,small,sub)=>{await pg.evaluate(([h])=>{document.body.innerHTML=h},[`<div style="${FF}position:fixed;inset:0;background:linear-gradient(#0e3b2a,#082219);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:34px"><img src="${logo}" style="width:96px;height:96px;border-radius:24px"><div style="font-weight:700;font-size:18px;letter-spacing:10px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:44px;line-height:1.12">${big}</div>${small?`<div style="font-weight:700;font-size:30px;color:#9be7b9;line-height:1.15">${small}</div>`:""}${sub?`<div style="font-weight:600;font-size:20px;opacity:.7;margin-top:18px">${sub}</div>`:""}</div>`]);
   await pg.waitForFunction(()=>[...document.images].every(i=>i.complete));await shot(n)};
 await pg.evaluate(([h])=>{document.body.innerHTML=h;const st=document.createElement("style");st.id="__tr";st.textContent="html,body{background:transparent!important}";document.head.appendChild(st)},[`<div style="${FF}position:fixed;left:0;right:0;bottom:0;height:430px;background:linear-gradient(rgba(8,34,25,0),rgba(8,34,25,.88) 55%);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 26px 120px;text-align:center"><div style="font-weight:800;font-size:46px;line-height:1.1;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)">I bravi artigiani non hanno bisogno di app.</div></div>`]);
 await pg.waitForTimeout(500);await pg.screenshot({path:path.join(SH,"h1t.png"),omitBackground:true});
 await pg.evaluate(()=>{document.getElementById("__tr").remove()});
 await card("h5","Voi, quante volte avete tagliato un pezzo sbagliato?","Scrivetelo nei commenti","ebanist.com");
 await card("g1","Quanti pannelli interi servono per questa cucina?","");
 await card("g4","Scrivi il tuo numero nei commenti","Risposta nel commento fissato","ebanist.com");
 await b.close();srv.close();console.log("shots gata");
});
