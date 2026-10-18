/* Film TikTok, partea 1: cadrele 3D, randate determinist (GL3D.capture, câte un cadru, fără
   dependență de viteza GPU). node site-src/tools/tiktok-frames.cjs [probe]
   Ieșire: vid-tt/frames/f_00001.jpg … și vid-tt/timeline.json (segmente, durate, texte). 1080×1920, 24 fps. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"../.."), OUT=path.join(root,"vid-tt"), FR=path.join(OUT,"frames");
const PROBE=process.argv[2]==="probe", FPS=24, W=1080, H=1920;
fs.mkdirSync(FR,{recursive:true});
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8796,async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960}});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage(); pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200))); pg.setDefaultTimeout(60000);
 await pg.goto("http://localhost:8796/app/index.html?lang=ro");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 await pg.evaluate(()=>{closeSheets();const q=proj();q.pieces=[];q.configs={};q.layout={};
   window.__cfg={...PRESETS.armadio,name:"Dulap",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}};
   generateInto(q,window.__cfg);persist();setView("build");GL3D.render(window.__cfg,{explode:0});});
 await pg.waitForTimeout(1500);
 const spot=async(type,pick,dz)=>pg.evaluate(([type,pick,dz])=>{const M=GL3D.model();const hs=M.ops.hw.filter(h=>h.type===type);const h=hs[Math.min(hs.length-1,Math.floor(hs.length*pick))];const pc=M.ops.pieces.find(q=>String(q.pk)===String(h.piece));const c=[0,1,2].map(i=>(pc.min[i]+pc.max[i])/2);return {pk:pc.pk,off:[0,1,2].map(i=>h.w[i]-c[i]+(i===2?dz:0))}},[type,pick,dz||0]);
 const hg=await spot("cerniera",.4), sl=await spot("guida",0,70), hd=await spot("maniglia",0);
 const lerp=(a,b,k)=>a+(b-a)*k, sm=k=>k*k*(3-2*k);
 const DEC=[["nogal_victoria_19","#6E4B33","m1"],["rovere_wood_lime_classic_k2414ah_19","#C4A87C","m2"],["avocado_green_22458mn_19","#A8B08A","m3"],["bordeaux_19","#6B2431","m4"],["blue_avio_23196mn_19","#5C7A99","m5"]];
 const KNOB={man:"gen_pomo",cern:"haf_metalla",guida:"blum_230m",conn:"fes_domino"}, BAR={man:"haf_bar128",conn:"fes_domino"};
 /* segmente: n = secunde; cam = [yaw,pitch,zoom] la început și la sfârșit; focus = {pk,rad,off} sau null */
 const segs=[];
 DEC.forEach(([id,hex,key],i)=>segs.push({name:"decor-"+key,sec:1.3,cfg:{matFront:id},st:{open:false,hw:false},cam:i%2?[.62,.2,1.5,.22,.22,1.55]:[.22,.2,1.5,.62,.22,1.55],cap:"c1",swatch:[key,hex]}));
 segs.push({name:"open",sec:3.0,cfg:{matFront:"nogal_victoria_19"},st:{open:true,hw:false},cam:[.3,.2,1.5,-.35,.34,1.6],cap:"c2"});
 segs.push({name:"hinge",sec:3.2,cfg:{},st:{open:true,hw:true},cam:[1.1,.15,1.6,.75,.2,2.3],focus:{pk:hg.pk,rad:120,off:hg.off},cap:"c3"});
 segs.push({name:"slide",sec:3.2,cfg:{},st:{open:true,hw:true},cam:[-.6,.4,1.4,-.35,.5,1.9],focus:{pk:sl.pk,rad:230,off:sl.off},cap:"c4"});
 segs.push({name:"handle",sec:2.5,cfg:{},st:{open:false,hw:false},cam:[.4,.1,1.6,-.3,.1,2.4],focus:{pk:hd.pk,rad:170,off:hd.off},cap:"c5"});
 segs.push({name:"knob",sec:2.4,cfg:{hwSel:KNOB},st:{open:false,hw:false},cam:[.4,.1,1.7,-.3,.12,2.5],focus:{pk:hd.pk,rad:200,off:hd.off},cap:"c6"});
 segs.push({name:"joints",sec:3.5,cfg:{hwSel:BAR},st:{open:false,hw:true,explode:.6},cam:[.4,.3,1.45,.8,.28,1.65],cap:"c7"});
 const tl=[]; let idx=0, t0=Date.now();
 for(const s of segs){
  const n=Math.round(s.sec*FPS); const first=idx+1;
  for(let i=0;i<n;i++){
   const k=n>1?sm(i/(n-1)):0, c=s.cam;
   const r=await pg.evaluate(([cfgPatch,st,cam,focus,k,W,H])=>{
     const cfg={...window.__cfg,...cfgPatch};
     if(focus) GL3D.focusOn(focus.pk,focus.rad,focus.off); else GL3D.focusOn(null);
     return GL3D.capture(cfg,{w:W,h:H,yaw:cam[0]+(cam[3]-cam[0])*k,pitch:cam[1]+(cam[4]-cam[1])*k,zoom:cam[2]+(cam[5]-cam[2])*k,hw:st.hw,open:st.open,explode:st.explode||0,edges:false}).img;
   },[s.cfg,s.st,c,s.focus||null,k,W,H]);
   idx++; fs.writeFileSync(path.join(FR,"f_"+String(idx).padStart(5,"0")+".jpg"),Buffer.from(r.split(",")[1],"base64"));
   if(PROBE&&i>=2) break;
  }
  tl.push({name:s.name,first,n:idx-first+1,cap:s.cap,swatch:s.swatch||null});
  console.log(s.name,idx,Math.round((Date.now()-t0)/1000)+"s");
  if(PROBE) break;
 }
 fs.writeFileSync(path.join(OUT,"timeline.json"),JSON.stringify({fps:FPS,w:W,h:H,segs:tl}));
 await b.close();srv.close();});
