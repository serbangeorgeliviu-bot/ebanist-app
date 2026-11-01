const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const DEV={phone:{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true},desktop:{viewport:{width:1440,height:900},deviceScaleFactor:2},tablet:{viewport:{width:1180,height:820},deviceScaleFactor:2,hasTouch:true}};
(async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 for(const which of ["phone","desktop","tablet"]){
 const c=await b.newContext(DEV[which]);
 await c.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const p=await c.newPage(); p.on("pageerror",e=>console.log("ERR",e.message));
 await p.goto("http://localhost:8765/app/index.html?lang=en");await p.waitForFunction(()=>window.MAT_LOADED===true);await p.waitForTimeout(3000);
 await p.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 await p.evaluate(()=>{closeSheets();const q=proj();q.name="Atelier Monaco — W1400";q.client="Jacquin Construction";q.pieces=[];q.configs={};q.layout={};
   state.settings.matBody="antracite_storm_grey_19";state.settings.matFront="nogal_victoria_19";
   generateInto(q,{...PRESETS.armadio,name:"Wardrobe",L:1400,H:2300,P:620,drawers:3,doors:2,shelves:3,hang:1,matBody:"antracite_storm_grey_19",matFront:"nogal_victoria_19",matBack:"antracite_storm_grey_19",hwSel:{man:"haf_bar128"}});persist();setView("build")});
 await p.waitForTimeout(2000);
 await p.click("#btnExplode").catch(e=>console.log("noexp"));await p.waitForTimeout(2500);
 if(which!=="phone"){await p.click("#btnHw3d").catch(()=>{});await p.waitForTimeout(1500);}
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.screenshot({path:`raw/${which}-explode.png`});
 await c.close();}
 await b.close();
})();
