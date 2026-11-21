/* Clip TikTok „Setup de gaming, stil Vice City” (≈ 25 s, 9:16, FĂRĂ voce, subtitrări RO / EN; ironic: masa „normală” vs. biroul făcut în Ebanist).
   Aplicația reală: masa și biroul în L sunt configurații din câmpurile aplicației (buildModule/GL3D.capture), pe proiectul demo „Living”; nicio piesă scrisă de mână.
   NEON: LED-ul din aplicație e numai cald; roz/cyan e o corecție de culoare din montaj (glow.png, ffmpeg), nu o funcție a aplicației: nu se spune „LED RGB”.
   Inspirat de estetica GTA 6 / Vice City — fără logo, font, capturi sau muzică din joc (drepturi Rockstar/Take-Two).
   Etape (ieșire în vid-gamer/, ignorat de git): frames [1] | extras | mux → ebanist-gamer-<ro|en>.mp4 (ca la demo-clip.cjs; PORT=… pentru server). */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path"),cp=require("child_process");
const MODE=process.argv[2]||"frames",ONE=process.argv[3]==="1",root=path.resolve(__dirname,"../.."),OUT=path.join(root,"vid-gamer");
const FPS=24,W=1080,H=1920,LANGS=["ro","en","it"],GRAF="egger_u961_st7_18",NUC="egger_h1714_st19_18";
const TX={
 t1:{it:["Vice City torna in GTA 6","e tu giochi sul tavolo della nonna…"],ro:["Vice City revine în GTA 6","și tu joci pe masa bunicii…"],en:["Vice City is back in GTA 6","and you’re gaming on grandma’s table…"]},
 t2:{it:["…con 14 cavi","e la tastiera sulle ginocchia"],ro:["…cu 14 cabluri","și tastatura pe genunchi"],en:["…with 14 cables","and the keyboard on your knees"]},
 d1:{it:["Nuovo setup per GTA 6","vibe Vice City · fatto con Ebanist"],ro:["Setup nou pentru GTA 6","vibe Vice City · făcut în Ebanist"],en:["New setup for GTA 6","Vice City vibes · made in Ebanist"]},
 d2:{it:["Ripiano per la tastiera","all’altezza giusta"],ro:["Raft de tastatură","la înălțimea ta"],en:["Keyboard shelf","at your height"]},
 d3:{it:["Cavi? Quali cavi.","passacavi Ø60 mm nel piano"],ro:["Cabluri? Ce cabluri.","treceri Ø60 mm prin blat"],en:["Cables? What cables.","Ø60 mm cable passes in the top"]},
 d4:{it:["Ogni pezzo, calcolato","pronto da tagliare"],ro:["Fiecare piesă, calculată","gata de debitat"],en:["Every part calculated","ready to cut"]},
 or:{it:"Oppure…",ro:"Sau…",en:"Or…"},
 end:{it:["Progetta il tuo setup","ebanist.com · link in bio"],ro:["Proiectează-ți setup-ul","ebanist.com · link în bio"],en:["Design your setup","ebanist.com · link in bio"]}};
const sm=k=>k*k*(3-2*k);
const SEGS=[
 {name:"t1",kind:"mod",cfg:"table",sec:3.5,from:{yaw:.6,pitch:.3,zoom:.95},to:{yaw:.3,pitch:.35,zoom:1.05},cap:"t1"},
 {name:"t2",kind:"mod",cfg:"table",sec:3.0,from:{yaw:-.3,pitch:.4,zoom:1.4},to:{yaw:.1,pitch:.45,zoom:1.8},cap:"t2",cables:true},
 {name:"or",sec:1.2,or:true},
 {name:"d1",kind:"mod",cfg:"desk",sec:4.0,from:{yaw:.2,pitch:.25,zoom:.9},to:{yaw:1.0,pitch:.22,zoom:1.05},cap:"d1",neon:true},
 {name:"d2",kind:"mod",cfg:"desk",sec:3.5,from:{yaw:-.6,pitch:.3,zoom:1.3},to:{yaw:-.2,pitch:.25,zoom:1.6},cap:"d2",neon:true},
 {name:"d3",kind:"mod",cfg:"desk",sec:3.0,from:{yaw:3.0,pitch:.3,zoom:1.0},to:{yaw:2.7,pitch:.28,zoom:1.3},cap:"d3",neon:true},
 {name:"d4",kind:"mod",cfg:"desk",sec:3.5,from:{yaw:.4,pitch:.3,zoom:.85,explode:0},to:{yaw:.9,pitch:.28,zoom:.95,explode:.9},cap:"d4",neon:true},
 {name:"end",sec:3.0,card:true}];
let cum=0;for(const s of SEGS){s.n=Math.round(s.sec*FPS);s.t0=cum/FPS;cum+=s.n}
const total=cum/FPS;fs.mkdirSync(OUT,{recursive:true});
const sh=(c,a)=>cp.execFileSync(c,a,{stdio:"inherit"});

if(MODE==="mux"){
 const enc=["-r",String(FPS),"-c:v","libx264","-crf","20","-preset","medium","-pix_fmt","yuv420p","-g",String(FPS*2)];
 for(const L of LANGS){
  const parts=[];
  SEGS.forEach((s,i)=>{
   const n=s.n,d=n/FPS,pf=path.join(OUT,"part-"+L+"-"+i+".mp4"),a=["-loglevel","error","-y"],fc=[];let last="0:v",k=1;
   if(s.card||s.or) a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",L,s.card?"card.png":"or.png"));
   else a.push("-framerate",String(fs.readdirSync(path.join(OUT,"seq",s.name)).length/s.sec),"-i",path.join(OUT,"seq",s.name,"f_%04d.jpg"));
   if(s.neon){a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"glow.png"));
    fc.push(`[0:v]format=rgb24[v];[${k}:v]format=rgb24[g];[v][g]blend=all_mode=screen:all_opacity=0.26[b]`);last="b";k++}
   const ovs=[];
   if(s.cables) ovs.push({f:"cables",a:.8,b:d});
   if(s.cap) ovs.push({f:"cap-"+s.name,a:.15,b:d});
   ovs.forEach(o=>{a.push("-loop","1","-framerate",String(FPS),"-i",path.join(OUT,"ov",o.f==="cables"?"":L,o.f+".png"));
    fc.push(`[${k}:v]format=rgba,fade=t=in:st=${o.a.toFixed(3)}:d=0.25:alpha=1[f${k}]`);
    fc.push(`[${last}][f${k}]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})':shortest=1[o${k}]`);last="o"+k;k++});
   if(fc.length) a.push("-filter_complex",fc.join(";"),"-map","["+last+"]");
   a.push("-frames:v",String(n),...enc,pf);sh("ffmpeg",a);parts.push(pf);
  });
  const lst=path.join(OUT,"parts-"+L+".txt");fs.writeFileSync(lst,parts.map(x=>"file '"+x+"'").join("\n"));
  const out=path.join(OUT,"ebanist-gamer-"+L+".mp4");
  sh("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy","-movflags","+faststart",out]);
  console.log("gata",out,total.toFixed(2)+" s");
 }
 process.exit(0);
}

const TABLE=JSON.parse(fs.readFileSync(path.join(root,"test/golden/14-tavolo/input.json"),"utf8")).cfg;
const PORT=+(process.env.PORT||8821);
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(PORT,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(300000);
 await pg.goto("http://localhost:"+PORT+"/app/index.html?lang=en");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 /* demo „Living” încărcat ca în aplicație; din el se iau materialele și biroul de pornire; masa și biroul gamer sunt configurații noi */
 const cfgs=await pg.evaluate(async([TABLE,GRAF,NUC])=>{
  closeSheets();const d=EBDemo.get("living");const json=await (await fetch(d.file)).json();
  const p=EBDemo.prepare(json,{lang:"en",uid,names:[],today:new Date().toISOString().slice(0,10)});state.projects.unshift(p);state.activeId=p.id;persist();
  const table=Object.assign({},TABLE,{name:"Table",type:"tavolo",L:1200,L2:700,P:700,H:760,matBody:NUC,matFront:NUC,matBack:NUC});
  const desk=JSON.parse(JSON.stringify(proj().configs["R1 Desk"]));
  Object.assign(desk,{name:"Gamer desk",L:1800,P:800,H:740,deskRet:"sx",deskRetL:1100,deskRetW:600,deskPed:"dx",deskPedDr:3,deskKb:"ka500",deskCable:2,deskShelf:1,matBody:GRAF,matFront:GRAF,matBack:GRAF});
  return {table,desk}},[TABLE,GRAF,NUC]);
 if(MODE==="frames"){
  await pg.evaluate(()=>{setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0})});
  await pg.waitForTimeout(1500);
  const only=(process.env.ONLY||"").split(",").filter(Boolean);
  for(const s of SEGS.filter(x=>x.kind)){
   const dir=path.join(OUT,ONE?"seq1":"seq",s.name),nf=s.n,have=!ONE&&fs.existsSync(dir)?fs.readdirSync(dir).length:0;
   if(only.length?!only.includes(s.name):have>=nf){console.log(s.name,"există, sar peste");continue}
   fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});const t0=Date.now();
   for(let i=0;i<nf;i++){
    if(ONE&&i!==Math.floor(nf*.7))continue;
    const k=nf>1?sm(i/(nf-1)):0,L=key=>s.from[key]+(s.to[key]-s.from[key])*k,ek=s.from.explode!=null?Math.min(1,k/.55):0;
    const o={yaw:L("yaw"),pitch:L("pitch"),zoom:L("zoom"),explode:s.from.explode!=null?s.from.explode+(s.to.explode-s.from.explode)*sm(ek):0,warm:!!s.neon,led:false,mode:"real",open:false};
    const src=await pg.evaluate(([c,o,w,h])=>GL3D.capture(c,Object.assign({w,h,edges:false},o)).img,[cfgs[s.cfg],o,W,H]);
    fs.writeFileSync(path.join(dir,"f_"+String(ONE?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
    if(i%12===0)console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
   }
   console.log(s.name,"gata",nf);
  }
 } else if(MODE==="extras"){
  const logo="data:image/png;base64,"+fs.readFileSync(path.join(root,"site/video/ebanist-logo-512.png")).toString("base64");
  await pg.setViewportSize({width:W,height:H});
  await pg.evaluate(()=>{document.body.innerHTML="";document.body.style.cssText="margin:0;background:transparent;overflow:hidden";document.documentElement.style.background="transparent";
   const st=document.createElement("style");st.textContent="html::before,html::after,body::before,body::after{display:none!important;content:none!important}html,body{background-image:none!important}";document.head.appendChild(st)});
  const FF="font-family:Barlow,system-ui,sans-serif;";
  const shot=async(file,html,bg)=>{fs.mkdirSync(path.dirname(file),{recursive:true});
   await pg.evaluate(([h,o])=>{document.body.innerHTML=h;document.body.style.background=o||"transparent";document.documentElement.style.background=o||"transparent"},[html,bg||null]);
   await pg.waitForFunction(()=>[...document.images].every(i=>i.complete));await pg.screenshot({path:file,omitBackground:!bg})};
  const cap=(a,c)=>`<div style="${FF}position:fixed;left:50px;right:50px;bottom:330px;text-align:center;padding:26px 30px;border-radius:30px;background:rgba(10,10,30,.82);border:3px solid #ff4fa3;box-shadow:0 0 36px rgba(255,79,163,.55),0 0 60px rgba(0,229,255,.25);color:#fff"><div style="font-weight:800;font-size:70px;line-height:1.08">${a}</div><div style="font-weight:600;font-size:40px;color:#7ef0ff;margin-top:10px">${c}</div></div>`;
  for(const L of LANGS){
   const dir=path.join(OUT,"ov",L);
   for(const s of SEGS) if(s.cap) await shot(path.join(dir,"cap-"+s.name+".png"),cap(...TX[s.cap][L]));
   await shot(path.join(dir,"or.png"),`<div style="${FF}position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:150px;color:#ff4fa3;text-shadow:0 0 40px #ff4fa3">${TX.or[L]}</div>`,"#0a0a1e");
   await shot(path.join(dir,"card.png"),`<div style="${FF}position:fixed;inset:0;background:linear-gradient(160deg,#1b0b3a,#0a0a1e 55%,#07323f);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:60px"><img src="${logo}" style="width:230px;height:230px;border-radius:50px;box-shadow:0 0 60px rgba(255,79,163,.6)"><div style="font-weight:700;font-size:38px;letter-spacing:20px;opacity:.85">EBANIST</div><div style="font-weight:800;font-size:88px;line-height:1.05">${TX.end[L][0]}</div><div style="font-weight:700;font-size:54px;color:#7ef0ff">${TX.end[L][1]}</div></div>`,"#0a0a1e");
  }
  /* „spaghetti”: 14 cabluri încâlcite (limbă neutră), desen cu curbe seedate, jos în cadru */
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const cols=["#111","#222","#eee","#d33","#2a6","#fa0","#27c"];let paths="";
  for(let i=0;i<14;i++){const x0=140+rnd()*800,y0=1000+rnd()*300;
   paths+=`<path d="M${x0} ${y0} C${100+rnd()*880} ${900+rnd()*500},${100+rnd()*880} ${900+rnd()*500},${100+rnd()*880} ${1150+rnd()*250} S${100+rnd()*880} ${1100+rnd()*300},${100+rnd()*880} ${1250+rnd()*150}" stroke="${cols[i%cols.length]}" stroke-width="${5+rnd()*5}" fill="none" stroke-linecap="round"/>`}
  await shot(path.join(OUT,"ov","cables.png"),`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:fixed;inset:0">${paths}</svg>`);
  /* glow roz (jos-stânga) + cyan (sus-dreapta) pe negru, pentru blend „screen” */
  await shot(path.join(OUT,"glow.png"),`<div style="position:fixed;inset:0;background:radial-gradient(ellipse 900px 900px at 0% 100%,rgba(255,40,150,.85),transparent 70%),radial-gradient(ellipse 900px 900px at 100% 15%,rgba(0,220,255,.7),transparent 70%),#000"></div>`,"#000");
  console.log("extras gata");
 }
 await b.close();srv.close();
});
