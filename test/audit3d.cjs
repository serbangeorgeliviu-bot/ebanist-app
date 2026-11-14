/* Ebanist — audit 3D dinamic (D-136): pentru fiecare tipologie și variantă, stările deschis / explodat / deschis + explodat față de starea închisă; orice suprapunere
 * NOUĂ între piese, de peste PRAG mm, e eroare (cod de ieșire 1).
 *
 *   node audit3d.cjs [tipologii separate prin virgulă] [nr. variante aleatoare] [seed]
 *   (fără argumente: toate tipologiile, 5 variante fixe; `npm run audit3d` rulează și 6 variante aleatoare pe tipologiile de bază)
 *
 * Folosește GL3D.worldBoxes() (contururile pieselor în lume, în starea cerută) și un test SAT în plan + suprapunere pe înălțime. Cere un browser (Playwright). Nu intră în
 * `test:full`, fiindcă pornește Chromium; se rulează înainte de orice versiune care atinge viewer3d.js, geo3d.js sau geometria corpurilor.
 */
const PRAG = 1.0;
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, "..");
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); } const e = path.extname(f);
  r.setHeader("content-type", { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" }[e] || "application/octet-stream"); fs.createReadStream(f).pipe(r); });
(async()=>{
 const exe=process.env.CHROME_PATH||["/opt/pw-browsers/chromium-1194/chrome-linux/chrome","/opt/pw-browsers/chromium"].find(p=>fs.existsSync(p));
 const b=await chromium.launch({executablePath:exe,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const pg=await (await b.newContext({viewport:{width:540,height:700}})).newPage(); pg.on("pageerror",e=>console.log("ERR",String(e).slice(0,160))); pg.setDefaultTimeout(120000);
 await new Promise(r=>srv.listen(0,'127.0.0.1',r)); await pg.goto(`http://127.0.0.1:${srv.address().port}/app/index.html?lang=ro`);await pg.waitForFunction(()=>window.MAT_LOADED===true);await pg.waitForTimeout(2500);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{});
 const only=process.argv[2]||"", RAND=+(process.argv[3]||0), SEED=+(process.argv[4]||1);
 const res=await pg.evaluate(async([only,RAND,SEED])=>{
  closeSheets();
  const poly=(c)=>{ /* hull xz din 8 colțuri: 4 puncte distincte */ const pts=c.map(p=>[p[0],p[2]]); const h=[]; pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lo=[]; for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=1e-9)lo.pop();lo.push(p)} const up=[]; for(const p of pts.slice().reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=1e-9)up.pop();up.push(p)} up.pop();lo.pop(); return lo.concat(up); };
  const sat=(A,B)=>{ let best=1e9; for(const P of [A,B]) for(let i=0;i<P.length;i++){ const a=P[i],b=P[(i+1)%P.length]; let nx=-(b[1]-a[1]),nz=b[0]-a[0]; const l=Math.hypot(nx,nz)||1; nx/=l;nz/=l;
      let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9; for(const p of A){const d=p[0]*nx+p[1]*nz;a0=Math.min(a0,d);a1=Math.max(a1,d)} for(const p of B){const d=p[0]*nx+p[1]*nz;b0=Math.min(b0,d);b1=Math.max(b1,d)}
      const o=Math.min(a1,b1)-Math.max(a0,b0); if(o<=0) return 0; best=Math.min(best,o);} return best; };
  const prep=(L)=>L.map(P=>P.boxes.map(c=>({P,poly:poly(c),y0:Math.min(...c.map(p=>p[1])),y1:Math.max(...c.map(p=>p[1])),xmin:Math.min(...c.map(p=>p[0])),xmax:Math.max(...c.map(p=>p[0])),zmin:Math.min(...c.map(p=>p[2])),zmax:Math.max(...c.map(p=>p[2]))}))).flat();
  const pairs=(Bx)=>{ const m=new Map(); for(let i=0;i<Bx.length;i++)for(let j=i+1;j<Bx.length;j++){ const a=Bx[i],b=Bx[j]; if(a.P.pk===b.P.pk) continue;
      if(a.xmax<b.xmin-1||b.xmax<a.xmin-1||a.zmax<b.zmin-1||b.zmax<a.zmin-1) continue; const oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0); if(oy<=0.5) continue;
      const d=sat(a.poly,b.poly); const pen=Math.min(d,oy); if(pen>0.5){ const k=a.P.pk<b.P.pk?a.P.pk+"|"+b.P.pk:b.P.pk+"|"+a.P.pk; m.set(k,Math.max(m.get(k)||0,pen)); } } return m; };
  const out=[]; const keys=Object.keys(PRESETS).filter(k=>!only||only.split(",").includes(k));
  let variants=[{},{doors:2,drawers:3},{L:600,H:1000,P:450,doors:1},{L:1400,doors:4,drawers:2},{L:900,H:2200,doors:2,drawers:0,hang:0}];
  if(RAND){ let sd=SEED*2654435761%4294967296; const rnd=()=>{sd=(sd*1664525+1013904223)%4294967296;return sd/4294967296}; const pick=(a)=>a[Math.floor(rnd()*a.length)]; const ri=(a,b)=>Math.round(a+rnd()*(b-a));
    variants=[]; for(let i=0;i<RAND;i++) variants.push({L:ri(400,1900),H:ri(500,2400),P:ri(300,700),doors:ri(0,8),drawers:ri(0,6),shelves:ri(0,6),hang:pick([0,1]),tram:pick([0,1]),drawerSys:pick(["legno","tandem","legrabox","metabox"]),handles:pick(["maniglie","push","gola"])}); }
  for(const k of keys){ for(const [vi,vr] of variants.entries()){
    const q=proj(); q.pieces=[];q.configs={};q.layout={};
    let cfg={...PRESETS[k],name:"T",...vr};
    try{ generateInto(q,cfg); GL3D.render(cfg,{explode:0}); }catch(e){ out.push({k,vi,err:String(e).slice(0,80)}); continue; }
    const info={}; const roles={};
    const base=prep(GL3D.worldBoxes({open:0,explode:0})); if(!base.length){out.push({k,vi,err:"fără piese"});continue;}
    const Bp=pairs(base);
    { const Lb=GL3D.worldBoxes({open:0,explode:0}); const ro={}; Lb.forEach(P=>ro[P.pk]=P.role+(P.sub?'/'+P.sub:'')); info.closed=[...Bp].filter(([k,v])=>v>1.5).map(([k,v])=>{const [a,b]=k.split('|');return {a:ro[a],b:ro[b],pen:Math.round(v*10)/10}}); }
    const states={open:{open:1,explode:0},ex5:{open:0,explode:.5},ex10:{open:0,explode:1},openex:{open:1,explode:.6}};
    for(const [sn,st] of Object.entries(states)){
      const L=GL3D.worldBoxes(st); const roleOf={}; L.forEach(P=>roleOf[P.pk]=P.role+(P.sub?"/"+P.sub:""));
      const M=pairs(prep(L)); const bad=[];
      for(const [pk,pen] of M){ if((Bp.get(pk)||0)>0.5) continue; const [a,b]=pk.split("|"); bad.push({a:roleOf[a]||a,b:roleOf[b]||b,pen:Math.round(pen*10)/10}); }
      info[sn]=bad;
    }
    out.push({k,vi,vr,pieces:base.length,info});
  }}
  return out;
 },[only,RAND,SEED]);
 
 const agg={};
 for(const r of res){ if(r.err){console.log(r.k,r.vi,"EROARE",r.err);continue;} for(const [sn,bad] of Object.entries(r.info)) for(const x of bad){ const key=`${r.k} · ${sn} · ${[x.a,x.b].sort().join(" × ")}`; (agg[key]=agg[key]||{n:0,max:0}); agg[key].n++; agg[key].max=Math.max(agg[key].max,x.pen);} }
 Object.entries(agg).sort((a,b)=>b[1].n-a[1].n).slice(0,60).forEach(([k,v])=>console.log(String(v.n).padStart(3),"max",v.max,k));
 const bad=res.filter(r=>r.err||(r.info&&["open","ex5","ex10","openex"].some(k=>(r.info[k]||[]).some(x=>x.pen>PRAG))));
 console.log("cfg:",res.length,"cu probleme (peste",PRAG,"mm):",bad.length); bad.forEach(r=>console.log("  ↳",r.k,JSON.stringify(r.vr||{}),r.err||JSON.stringify(["open","ex5","ex10","openex"].map(k=>(r.info[k]||[]).filter(x=>x.pen>PRAG)).flat()))); process.exitCode=bad.length?1:0;
 await b.close();srv.close();
})();
