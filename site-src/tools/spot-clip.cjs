/* Spot Ebanist (≈42 s, 9:16, italiană) — cadrele 3D reale din aplicația Ebanist, proiectele demo (D-168).
   node site-src/tools/spot-clip.cjs frames [nume,nume]   randează cadrele în vid-spot/seq/<scenă>/f_0001.jpg…
   node site-src/tools/spot-clip.cjs probe <scenă>        un singur cadru (mijlocul scenei) în vid-spot/probe/
   Scenele „room” = camera întreagă a proiectului (LED, podea); „mod” = un corp, cu uși care se deschid animat (ceas virtual).
   Ieșirea e ignorată de git. Montajul (voce, muzică, titluri) se face cu spot-mux.sh. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const MODE=process.argv[2]||"frames", ARG=(process.argv[3]||"").split(",").filter(Boolean);
const root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-spot"), FPS=24;
/* sec = durata pe ecran; cam = [yaw0,pitch0,zoom0, yaw1,pitch1,zoom1]; ledAt = secunda la care se aprinde LED-ul (room);
   openAt = secunda la care se deschid ușile (mod); exp = explozie 0→1 */
const SEGS=[
 {name:"L1",proj:"living",kind:"room",sec:4.5,cam:[-.75,.3,1.6,.4,.22,2.3],ledAt:2.0},
 {name:"L2",proj:"living",kind:"mod",cfg:"S3 Vitrină",sec:2.4,cam:[.35,.2,1.0,-.25,.15,1.3],openAt:.5},
 {name:"L3",proj:"living",kind:"mod",cfg:"S4 Clapă sus",sec:2.3,cam:[.5,.25,1.0,-.1,.2,1.25],openAt:.4},
 {name:"L4",proj:"living",kind:"mod",cfg:"D2 Bar uși pliante",sec:2.3,cam:[-.4,.2,1.0,.2,.18,1.25],openAt:.4},
 {name:"K1",proj:"kitchen",kind:"room",sec:1.7,cam:[-.6,.3,1.6,.55,.25,2.0],ledAt:0},
 {name:"B1",proj:"bedroom",kind:"room",sec:1.7,cam:[.5,.28,1.6,-.35,.24,2.0],ledAt:0},
 {name:"L5",proj:"living",kind:"room",sec:1.2,cam:[.1,.2,1.9,-.05,.2,2.2],ledAt:0},
 {name:"X1",proj:"living",kind:"mod",cfg:"S3 Vitrină",sec:2.5,cam:[.3,.3,.95,.85,.28,1.0],exp:[0,.9]},
 {name:"H1",proj:"kitchen",kind:"mod",cfg:"Oven tall unit (+ microwave) 1.2",sec:2.2,cam:[.9,.15,1.5,1.3,.12,2.1],exp:[.9,.9],hw:true},
 {name:"D1",proj:"bedroom",kind:"mod",cfg:"W1 Sliding wardrobe",sec:1.8,cam:[.35,.2,1.0,-.2,.18,1.2],openAt:.3},
 {name:"D2",proj:"kitchen",kind:"mod",cfg:"Pull-out pantry 1.3",sec:1.6,cam:[-.4,.25,1.0,.1,.2,1.2],openAt:.3},
 {name:"D3",proj:"bedroom",kind:"mod",cfg:"B2 Bed lift-up",sec:1.6,cam:[.6,.3,1.0,.1,.28,1.15],openAt:.3}
];
const sm=k=>k*k*(3-2*k);
for(const s of SEGS) s.n=Math.round(s.sec*FPS);
fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);
 r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg"}[ext]||"application/octet-stream");
 fs.createReadStream(f).pipe(r)}).listen(+(process.env.PORT||8803),async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(600000);
 await pg.goto("http://localhost:"+(process.env.PORT||8803)+"/app/index.html?lang=it");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 let cur=null;
 const todo=SEGS.filter(s=>MODE==="probe"?ARG.includes(s.name):(!ARG.length||ARG.includes(s.name)));
 for(const s of todo){
  if(cur!==s.proj){
   await pg.evaluate(async id=>{closeSheets();await demoLoad(id)},s.proj);
   await pg.waitForTimeout(1500);
   await pg.evaluate(()=>{setView("build");document.body.classList.add("vp-full");$("bldView").classList.add("full");GL3D.resize();
    GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
    if(!window.__r0){window.__r0=GL3D.render;
     GL3D.render=function(cfg,o){ if(window.__room){const bx=roomBoxes(),RL=roomLayout(),fr=RL.frames,floor=fr.map(f=>{const q=toRoom(f,0,0,0);return [q.x,q.y]});
       const sv=proj().survey.walls,last=fr[fr.length-1],lw=+sv[sv.length-1].len; if(fr.length===sv.length&&lw>0){const e=toRoom(last,lw,0,0);floor.push([e.x,e.y])}
       return window.__r0.call(this,cfg,Object.assign({},o,{boxes:bx,room:{floor,tone:(proj()||{}).floorTone},leds:roomLeds()}))}
      return window.__r0.call(this,cfg,o)}}});
   cur=s.proj; await pg.waitForTimeout(1200);
  }
  const dir=path.join(OUT,MODE==="probe"?"probe":"seq",s.name); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const t0=Date.now(), nf=s.n, P=MODE==="probe";
  const save=(i,src)=>fs.writeFileSync(path.join(dir,"f_"+String(P?1:i+1).padStart(4,"0")+".jpg"),Buffer.from(src.split(",")[1],"base64"));
  const view=(k)=>{const c=s.cam,L=(a,bb)=>a+(bb-a)*k;return {yaw:L(c[0],c[3]),pitch:L(c[1],c[4]),zoom:L(c[2],c[5])}};
  if(s.kind==="room"){
   await pg.evaluate(()=>{window.__room=true;window.__cfg={matBody:state.settings.matBody,matFront:state.settings.matFront}});
   for(let i=0;i<nf;i++){ if(P&&i!==Math.floor(nf*.7)) continue;
    const k=nf>1?sm(i/(nf-1)):0, v=view(k), led=(i/FPS)>=s.ledAt;
    const src=await pg.evaluate(([o])=>GL3D.capture(window.__cfg,Object.assign({w:1080,h:1920,edges:false,warm:true},o)).img,[Object.assign(v,{led})]);
    save(i,src); if(i%24===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
   }
  } else {
   await pg.evaluate(cn=>{window.__room=false;window.__cfg=JSON.parse(JSON.stringify(proj().configs[cn]))},s.cfg);
   if(s.exp){ /* explozia: cadre statice, fără uși */
    for(let i=0;i<nf;i++){ if(P&&i!==Math.floor(nf*.6)) continue;
     const k=nf>1?sm(i/(nf-1)):0, v=view(k), e=s.exp[0]+(s.exp[1]-s.exp[0])*sm(Math.min(1,k/.6));
     const o=Object.assign(v,{explode:e,hw:!!s.hw,holes:!!s.hw,mode:s.hw&&k>.35?"hw":"real",led:true,warm:true});
     const src=await pg.evaluate(([o])=>GL3D.capture(window.__cfg,Object.assign({w:1080,h:1920,edges:false},o)).img,[o]);
     save(i,src); if(i%24===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
    }
   } else {
    /* uși care se deschid ANIMAT: ceas virtual (offline), montajul oprit imediat */
    await pg.evaluate(([w,h])=>{GL3D.render(window.__cfg,{explode:0});GL3D.set({mode:"real",hw:false,holes:false,dims:false,edges:false,open:false,explode:0});
      GL3D.capture(window.__cfg,{w,h,edges:false,warm:true,led:true,open:false}); /* pune camera pe corp */
      GL3D.render(window.__cfg,{explode:0});GL3D.set({mode:"real",open:false,explode:0});
      GL3D.offlineBegin({w,h,fps:24,yaw:0,ms:1200}); GL3D.stopAssemble();},[1080,1920]);
    for(let i=0;i<nf;i++){
     const k=nf>1?sm(i/(nf-1)):0, v=view(k);
     const r=await pg.evaluate(([v,open])=>{VIEW.yaw=v.yaw;VIEW.pitch=v.pitch;VIEW.zoom=v.zoom;return GL3D.offlineFrame(open).data},[v,(i/FPS)>=s.openAt]);
     if(P&&i!==Math.floor(nf*.8)) continue;
     save(i,r); if(i%24===0) console.log(s.name,i+"/"+nf,Math.round((Date.now()-t0)/1000)+"s");
    }
    await pg.evaluate(()=>GL3D.offlineEnd());
   }
  }
  console.log(s.name,"gata",nf,Math.round((Date.now()-t0)/1000)+"s");
 }
 await b.close();srv.close();
});
