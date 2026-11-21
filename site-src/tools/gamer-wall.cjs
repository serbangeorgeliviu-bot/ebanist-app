/* „Gaming wall”: peretele de gaming din clipul GTA 6 — birou în L, rafturi cu LED pentru jocuri, vitrină pentru gadgeturi, nișă pentru consolă, clape SERVO-DRIVE, lambriu.
   Construit numai prin aplicație (tools/showcase/inpage.js: SC.build → generateInto + layout + autoFix); nicio piesă scrisă de mână.
     node site-src/tools/gamer-wall.cjs build    construiește + controalele aplicației → vid-gamer/wall.proj.json
     node site-src/tools/gamer-wall.cjs frames   cadrele 3D (camera, LED aprins) → vid-gamer/wseq/<scenă>/   (1 = un cadru pe scenă, în wseq1/; ONLY=a,b)
   LED-ul din aplicație e cald; neonul roz/cyan se adaugă în montaj (gamer-mix.cjs), nu e funcție a aplicației. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const MODE=process.argv[2]||"build",ONE=process.argv[3]==="1",root=path.resolve(__dirname,"../.."),OUT=path.join(root,"vid-gamer");
const GRAF="egger_u961_st7_18",NUC="egger_h1714_st19_18",FPS=24,W=1080,H=1920,sm=k=>k*k*(3-2*k);
const D={type:"standard",matBody:GRAF,matFront:GRAF,matBack:NUC,tram:0,drawers:0,doors:0,shelves:0,back:1,hang:0,plinth:0,support:"sospeso",handles:"push",shelfType:"fisso"};
const mat={ripiano:NUC},LED={led:"top",ledSw:"hidden"},FL={support:"zoccolo",plinth:60},OFF={off:40};
const spec={name:"Gaming wall",survey:{walls:[{id:"w1",len:5200,angle:90,bow:null},{id:"w2",len:3800,angle:90,bow:null},{id:"w3",len:5200,angle:90,bow:null},{id:"w4",len:3800,angle:90,bow:null}],heights:[2700,2700,2700,2700],obstacles:[]},
 settings:{matBody:GRAF,matFront:GRAF,matBack:NUC},defaults:D,floorTone:4866102,
 bodies:[
  {cfg:Object.assign({name:"G1 Games tower",L:500,H:2700,P:320,shelves:8,mat},FL,LED),at:{from:0}},
  {cfg:{name:"G0 Desk",type:"scrivania",L:2100,H:740,P:750,back:0,support:"zoccolo",plinth:0,deskKb:"ka500",deskCable:2,deskPed:"dx",deskPedDr:3,deskShelf:1,matBody:GRAF,matFront:GRAF,matBack:GRAF},at:{from:600}},
  {cfg:{name:"G0 Wall paneling",type:"lambriu",L:2100,H:1900,P:34,matBody:NUC,matBack:GRAF,lamW:40,lamGap:20,lamDir:"v",back:1,support:"zoccolo"},at:{from:600,lift:760}},
  {cfg:Object.assign({name:"G2 Open shelf",L:700,H:700,P:300,shelves:3,mat},LED),at:{from:600,lift:1400,off:40}},
  {cfg:Object.assign({name:"G3 Display cabinet",L:700,H:700,P:300,doors:2,shelves:2,front:"vetro",mat},LED),at:{from:1300,lift:1400,off:40}},
  {cfg:Object.assign({name:"G4 Open shelf",L:700,H:700,P:300,shelves:3,mat},LED),at:{from:2000,lift:1400,off:40}},
  {cfg:{name:"G5 Flap left",L:1050,H:500,P:300,doors:1,lift:"blum_hk_top",liftElec:"servo"},at:{from:600,lift:2150,off:40}},
  {cfg:{name:"G6 Flap right",L:1050,H:500,P:300,doors:1,lift:"blum_hk_top",liftElec:"servo"},at:{from:1650,lift:2150,off:40}},
  {cfg:Object.assign({name:"G7 Console niche",L:1100,H:600,P:450,shelves:1,mat},LED),at:{from:2800,lift:150}},
  {cfg:Object.assign({name:"G8 Gadget shelves",L:1100,H:900,P:300,shelves:3,mat},LED),at:{from:2800,lift:900}},
  {cfg:Object.assign({name:"G9 Collector cabinet",L:700,H:2200,P:380,doors:2,shelves:5,front:"vetro",mat},FL,LED),at:{from:3900}},
  {cfg:Object.assign({name:"G10 Games tower",L:600,H:2700,P:320,shelves:8,mat},FL,LED),at:{from:4600}}]};
/* scene (frames): cam = [yaw,pitch,zoom → yaw,pitch,zoom]; led = [de la, până la] din scenă */
const SEGS=[
 {name:"w1",sec:4.0,cam:[.2,.45,1.0,.5,.2,1.9],led:[0,1]},
 {name:"w2",sec:3.5,cam:[.15,.15,2.2,-.15,.12,3.0],led:[0,1]},
 {name:"w3",sec:3.5,cam:[.45,.12,3.0,.1,.1,3.6],led:[0,1]}];
for(const s of SEGS) s.n=Math.round(s.sec*FPS);
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(+(process.env.PORT||8851),async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(600000);
 await pg.goto("http://localhost:"+(process.env.PORT||8851)+"/app/index.html?lang=en");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 await pg.addScriptTag({path:path.join(root,"tools/showcase/inpage.js")});
 const CACHE=path.join(OUT,"wall.proj.json");fs.mkdirSync(OUT,{recursive:true});
 if(MODE==="build"||!fs.existsSync(CACHE)){
  const res=await pg.evaluate(async spec=>{const rep=await SC.build(spec);const p=proj();const info=await SC.check(p);delete info.cutSig;return {rep,info,project:p}},spec);
  console.log(JSON.stringify(res.rep));console.log(JSON.stringify(res.info));(res.info.bad||[]).forEach(x=>console.log("✗",x));
  fs.writeFileSync(CACHE,JSON.stringify(res.project));
  if(MODE==="build"){await b.close();srv.close();return}
 } else {
  const cached=JSON.parse(fs.readFileSync(CACHE,"utf8"));
  await pg.evaluate(c=>{closeSheets();state.projects.unshift(c);state.activeId=c.id;persist()},cached);
 }
 await pg.evaluate(()=>{setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();
  const bx=roomBoxes(),RL=roomLayout(),fr=RL.frames,floor=fr.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
  const sv=proj().survey.walls,last=fr[fr.length-1],lw=+sv[sv.length-1].len;if(fr.length===sv.length&&lw>0){const e=toRoom(last,lw,0,0);floor.push([e.x,e.y])}
  GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
  const r0=GL3D.render;GL3D.render=function(cfg,o){return r0.call(this,cfg,Object.assign({},o,{boxes:bx,room:{floor,tone:(proj()||{}).floorTone},leds:roomLeds()}))};
  window.__cfg={matBody:state.settings.matBody,matFront:state.settings.matFront}});
 await pg.waitForTimeout(1500);
 const only=(process.env.ONLY||"").split(",").filter(Boolean);
 for(const s of SEGS){
  const dir=path.join(OUT,ONE?"wseq1":"wseq",s.name),have=!ONE&&fs.existsSync(dir)?fs.readdirSync(dir).length:0;
  if(only.length?!only.includes(s.name):have>=s.n){console.log(s.name,"există");continue}
  fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});const t0=Date.now();
  for(let i=0;i<s.n;i++){if(ONE&&i!==Math.floor(s.n*.6))continue;
   const f=s.n>1?i/(s.n-1):0,k=sm(f),c=s.cam,L=(a,b2)=>a+(b2-a)*k;
   const o={yaw:L(c[0],c[3]),pitch:L(c[1],c[4]),zoom:L(c[2],c[5]),warm:true,led:f>=s.led[0]&&f<=s.led[1]};
   const src=await pg.evaluate(([o,w,h])=>GL3D.capture(window.__cfg,Object.assign({w,h,edges:false},o)).img,[o,W,H]);
   fs.writeFileSync(path.join(dir,"f_"+String(ONE?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
   if(i%12===0)console.log(s.name,i+"/"+s.n,Math.round((Date.now()-t0)/1000)+"s");}
  console.log(s.name,"gata");
 }
 await b.close();srv.close();
});
