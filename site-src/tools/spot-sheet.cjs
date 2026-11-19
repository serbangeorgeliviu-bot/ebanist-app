/* Scena „A3” a spotului: foaia pieselor (partA3Svg) din proiectul demo, zoom lent. node site-src/tools/spot-sheet.cjs → vid-spot/seq/A3/ */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"../.."),OUT=path.join(root,"vid-spot","seq",process.env.SHEET_DIR||"A3"),N=Math.round(2.3*24),PORT=+(process.env.PORT||8821);
const sm=k=>k*k*(3-2*k);
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);
 r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg"}[ext]||"application/octet-stream");
 fs.createReadStream(f).pipe(r)}).listen(PORT,async()=>{
 const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage();pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,200)));pg.setDefaultTimeout(600000);
 await pg.goto("http://localhost:"+PORT+"/app/index.html?lang="+(process.env.LANG_UI||"it")+"");await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(3000);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 await pg.evaluate(async()=>{closeSheets();await demoLoad("bedroom")});await pg.waitForTimeout(1500);
 const svg=await pg.evaluate(()=>{const c=JSON.parse(JSON.stringify(proj().configs["W1 Sliding wardrobe"]));GL3D.render(c,{explode:0});const M=GL3D.model();
  const ops=new Map();(M.ops.ops||[]).forEach(o=>ops.set(o.pk,(ops.get(o.pk)||0)+1));
  const cand=M.ops.pieces.filter(p=>p.role!=="blat").sort((a,b)=>(ops.get(b.pk)||0)-(ops.get(a.pk)||0))[0];
  return {svg:partSheetSvg(M,cand,5,1,1,"A4"),role:cand.role,ops:ops.get(cand.pk)||0}});
 console.log("piesa",svg.role,svg.ops);
 fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
 for(let i=0;i<N;i++){
  const k=sm(i/(N-1)),z=1.0+0.7*k;
  await pg.evaluate(([svg,z])=>{document.body.innerHTML='<div style="position:fixed;inset:0;background:#2f3430;display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="width:96vw;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transform:scale('+z+')"><style>.shw svg{width:100%;height:auto;display:block}</style><div class="shw">'+svg+'</div></div></div>'},[svg.svg,z]);
  await pg.screenshot({path:path.join(OUT,"f_"+String(i+1).padStart(4,"0")+".jpg"),type:"jpeg",quality:92});
 }
 console.log("A3 gata");await b.close();srv.close();
});
