const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const DEV={phone:{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true},tablet:{viewport:{width:1024,height:768},deviceScaleFactor:2,hasTouch:true},desktop:{viewport:{width:1440,height:900},deviceScaleFactor:2}};
const which=process.argv[2];
(async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const c=await b.newContext(DEV[which]);
 await c.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const p=await c.newPage(); p.on("pageerror",e=>console.log("ERR",e.message));
 await p.goto("http://localhost:8765/app/index.html?lang=en");await p.waitForFunction(()=>window.MAT_LOADED===true);await p.waitForTimeout(3000);
 await p.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 const r=await p.evaluate(()=>{closeSheets();const q=proj();q.name="Atelier Monaco — W1400";q.client="Jacquin Construction";q.pieces=[];q.configs={};q.layout={};
   state.settings.matBody="antracite_storm_grey_19";state.settings.matFront="nogal_victoria_19";
   const cfg={...PRESETS.armadio,name:"Wardrobe",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}};
   window.__cfg=cfg; generateInto(q,cfg);persist();setView("build");return q.pieces.length});
 console.log("pieces",r);
 await p.waitForTimeout(2500);
 for(const v of ["build","list","nest","summary"]){ await p.evaluate(v=>setView(v),v); await p.waitForTimeout(1800); await p.screenshot({path:`raw/${which}-${v}.png`}); }
 if(which!=="phone"){ await p.evaluate(()=>setView("build")); await p.waitForTimeout(800); await p.click("#btnClient"); await p.waitForTimeout(3500); await p.screenshot({path:`raw/${which}-client.png`}); }
 await b.close();
})();
