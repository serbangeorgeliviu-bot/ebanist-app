const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright");
/* Registra il flusso per il clip promo (9:16, 1080x1920): tipologia → cote → genera → 3D → distinta.
   node clip-screen.js <out-dir>; poi: ffmpeg -f concat -safe 0 -i <out>/list.txt -vf fps=30 raw.mp4 */
const ROOT=path.resolve(__dirname,".."), OUT=process.argv[2];
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json"};
const srv=http.createServer((q,r)=>{const rel=decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/,"")||"index.html";const f=path.join(ROOT,rel);
 if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
 r.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(r=>srv.listen(0,"127.0.0.1",r));
 const URL=`http://127.0.0.1:${srv.address().port}/app/index.html?lang=it`;
 const br=await chromium.launch({executablePath:process.env.CHROME_PATH||"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]});
 const ctx=await br.newContext({viewport:{width:540,height:960},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const pg=await ctx.newPage(); fs.mkdirSync(OUT+"/f",{recursive:true}); const frames=[]; let cap=false; const t0=Date.now();
 const loop=(async()=>{let i=0;while(true){ if(cap===null)break; if(cap){const t=Date.now()-t0;const f=OUT+"/f/"+String(i++).padStart(5,"0")+".jpg";await pg.screenshot({path:f,type:"jpeg",quality:92});frames.push([f,t]);} else await new Promise(r=>setTimeout(r,50)); }})(); const errs=[]; pg.on("pageerror",e=>errs.push(String(e)));
 await pg.goto(URL); await pg.waitForFunction(()=>window.MAT_LOADED===true,null,{timeout:15000});
 await pg.waitForTimeout(3300); await pg.evaluate(()=>closeSheets()); await pg.evaluate(()=>setView("projects")); await pg.waitForTimeout(600); await pg.tap("#btnNewProject"); await pg.waitForTimeout(600); await pg.fill("#prName","Cucina Rossi"); await pg.tap("#btnProjectSave"); await pg.waitForTimeout(1200); await pg.evaluate(()=>setView("build")); await pg.waitForTimeout(1500); cap=true;
 console.log("chips:",await pg.$$eval("#presetChips .chip",e=>e.map(x=>x.dataset.k+":"+x.textContent.trim())));
 // 1 tipologia
 await pg.tap("#presetChips .chip[data-k=basecass]").catch(async()=>{await pg.tap("text=Base a cassetti")}); await pg.waitForTimeout(1500);
 // 2 cote (aprire sezione se serve)
 const vis=await pg.isVisible("#bL"); console.log("bL visible",vis);
 await pg.fill("#bL","500"); await pg.waitForTimeout(500); await pg.waitForTimeout(800);
 // 3 genera
 await pg.screenshot({path:OUT+"/pre-gen.png"});
 await pg.tap("#btnGenerate"); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>setView("build")); await pg.waitForTimeout(1500);
 // 4 3D drag
 const box=await pg.evaluate(()=>{const c=document.querySelector("#viewer3d canvas, canvas");const b=c.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};});
 console.log("canvas",box);
 const cx=box.x+box.w/2, cy=box.y+box.h/2;
 await pg.mouse.move(cx-100,cy); await pg.mouse.down();
 for(let i=0;i<30;i++){await pg.mouse.move(cx-100+i*7,cy+Math.sin(i/5)*8);await pg.waitForTimeout(60);} await pg.mouse.up();
 await pg.waitForTimeout(800);
 // 5 lista
 await pg.evaluate(()=>setView("list")); await pg.waitForTimeout(1500);
 for(let i=0;i<8;i++){await pg.mouse.wheel(0,260);await pg.waitForTimeout(350);}
 await pg.waitForTimeout(800);
 console.log("errs",errs);
 cap=null; await loop; let txt=""; for(let k=0;k<frames.length;k++){const d=((k+1<frames.length?frames[k+1][1]:frames[k][1]+100)-frames[k][1])/1000; txt+=`file '${frames[k][0]}'\nduration ${d}\n`;} txt+=`file '${frames[frames.length-1][0]}'\n`; fs.writeFileSync(OUT+"/list.txt",txt); console.log("frames",frames.length,"secs",(frames[frames.length-1][1]-frames[0][1])/1000); await ctx.close(); await br.close(); srv.close();
})();
