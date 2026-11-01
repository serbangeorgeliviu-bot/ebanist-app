const {chromium}=require("/opt/node22/lib/node_modules/playwright");
(async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const c=await b.newContext({viewport:{width:900,height:1000},deviceScaleFactor:2});
 await c.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const p=await c.newPage(); p.on("pageerror",e=>console.log("ERR",e.message));
 const w=ms=>p.waitForTimeout(ms);
 await p.goto("http://localhost:8765/app/index.html?lang=en");await p.waitForFunction(()=>window.MAT_LOADED===true);await w(3000);
 await p.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});await w(400);
 await p.evaluate(()=>{closeSheets();const q=proj();q.name="Atelier Monaco — W1400";q.pieces=[];q.configs={};q.layout={};
   state.settings.matBody="antracite_storm_grey_19";state.settings.matFront="nogal_victoria_19";
   window.__cfg={...PRESETS.armadio,name:"Dulap",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}};
   generateInto(q,window.__cfg);persist();setView("build");
   document.body.classList.add("vp-full");$("bldView").classList.add("full");
   const st=document.createElement("style");st.textContent="#bldView .vbtns,#bldView button,#bldView .vctl,.vp-full .topbar,.vp-full header{display:none!important} .vp-full nav,.vp-full .tabbar,.vp-full .bnav,#buildInfo{display:none!important}";document.head.appendChild(st);
   window.GL3D.resize();});
 await w(1500);
 const R=(cfgPatch,st)=>p.evaluate(([cp,s])=>{const c={...window.__cfg,...cp};GL3D.render(c,{explode:0});if(s)GL3D.set(s);},[cfgPatch||{},st||null]);
 const V=(y,pt,z)=>p.evaluate(([a,b,c])=>{VIEW.yaw=a;VIEW.pitch=b;VIEW.zoom=c;GL3D.touch()},[y,pt,z]);
 const spot=(type,pick,dz)=>p.evaluate(([type,pick,dz])=>{const M=GL3D.model();const hs=M.ops.hw.filter(h=>h.type===type);const h=hs[Math.min(hs.length-1,Math.floor(hs.length*pick))];const pc=M.ops.pieces.find(q=>String(q.pk)===String(h.piece));const c=[0,1,2].map(i=>(pc.min[i]+pc.max[i])/2);return {pk:pc.pk,off:[0,1,2].map(i=>h.w[i]-c[i]+(i===2?dz:0))}},[type,pick,dz||0]);
 const shot=async n=>{await w(900);await p.screenshot({path:`raw/3d-${n}.png`})};
 // hero: closed
 await R({},{open:false,hw:false,holes:false,dims:false,edges:false});await V(.45,.18,.95);await shot("closed");
 // open with hw
 await R({},{open:true,hw:true});await V(.55,.15,.95);await shot("open-hw");
 // exploded
 await R({},{open:false,hw:true});await p.evaluate(()=>GL3D.set({explode:.7,hw:true}));await V(.5,.3,.8);await shot("explode");
 await p.evaluate(()=>GL3D.set({explode:1,hw:true}));await V(-.55,.38,.72);await shot("explode2");
 // holes
 await R({},{open:false,hw:false,holes:true,explode:0});await p.evaluate(()=>GL3D.set({explode:.5,holes:true,hw:false}));await V(.3,.5,.85);await shot("holes");
 // dims
 await R({},{open:false,hw:false,holes:false,dims:true});await p.evaluate(()=>GL3D.set({explode:0,dims:true}));await V(.4,.2,.95);await shot("dims");
 // hinge close
 await R({},{open:true,hw:true,holes:false,dims:false});await p.evaluate(()=>GL3D.set({explode:0}));
 const hg=await spot("cerniera",.4);await p.evaluate(([a,b,c])=>GL3D.focusOn(a,b,c),[hg.pk,120,hg.off]);await w(1500);await V(-1.05,.15,1.6);await w(800);await shot("hinge");
 const sl=await spot("guida",0,70);await p.evaluate(([a,b,c])=>GL3D.focusOn(a,b,c),[sl.pk,260,sl.off]);await w(1500);await V(-.5,.45,1.4);await w(800);await shot("slide");
 // sheets
 await p.evaluate(()=>GL3D.focusOn(null));
 const sheets=await p.evaluate(()=>{closeSheets();const q=proj();return packBuild(q,{cover:true,client:false,report:false,elev:true,asm:true,parts:true}).slice(0,8)});
 console.log("sheets",sheets.length);
 const fs=require("fs");sheets.forEach((s,i)=>fs.writeFileSync(`raw/sheet-${i}.svg`,s));
 await b.close();
})();
