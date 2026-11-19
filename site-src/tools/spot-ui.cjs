/* Ecranul real al tabletei pentru spot: aplicația Ebanist (Genera, demo „Soggiorno”) la 1180×820, 72 de cadre → vid-spot/ui/f_0001.png.
   LANG_UI=it|en. Rotește camera 3D, alege vitrina și o deschide. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"../.."),OUT=path.join(root,"vid-spot","ui"+(process.env.LANG_UI==="en"?"en":"")),PORT=+(process.env.PORT||8831),N=72;
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);
 r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg"}[ext]||"application/octet-stream");
 fs.createReadStream(f).pipe(r)}).listen(PORT,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:1180,height:820},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(120000);
 await pg.goto("http://localhost:"+PORT+"/app/index.html?lang="+(process.env.LANG_UI||"it"));await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 await pg.evaluate(async()=>{closeSheets();await demoLoad("living")});await pg.waitForTimeout(2500);
 fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
 const chips=await pg.locator('#bldView, body').first().evaluate(()=>[...document.querySelectorAll("button.chip")].map(x=>x.textContent.trim()).slice(0,30));
 console.log(chips.join(" | "));
 for(let i=0;i<N;i++){
  if(i===36){ await pg.locator('button.chip',{hasText:/Vitrin|Display/}).first().click().catch(e=>console.log("nochip")); await pg.waitForTimeout(1800); }
  if(i===52){ await pg.locator('button:has-text("Apri"), button:has-text("Open")').first().click().catch(e=>console.log("noapri")); await pg.waitForTimeout(1800); }
  const k=i<36?i/35:(i-36)/35;
  await pg.evaluate(([k,i])=>{if(typeof VIEW==="object"){VIEW.yaw=i<36?(-.6+1.0*k):(.5-.7*k);VIEW.pitch=.42;VIEW.zoom=i<36?1+.15*k:1}GL3D.set({})},[k,i]);
  await pg.waitForTimeout(350);
  await pg.screenshot({path:path.join(OUT,"f_"+String(i+1).padStart(4,"0")+".png")});
  if(i%12===0)console.log("ui",i);
 }
 await b.close();srv.close();});
