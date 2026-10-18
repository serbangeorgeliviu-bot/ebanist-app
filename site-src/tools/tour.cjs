/* turul video al noutăților Ebanist: aplicația reală, înregistrată cu Playwright. node site-src/tools/tour.cjs <en|ro|it|fr>; apoi webm → mp4 cu ffmpeg (vezi site/video/, crf 29, 1280×720, 24 fps). Calea din __dirname cere camera-L-test.dxf lângă script. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const http=require("http"),fs=require("fs"),path=require("path");
const L=process.argv[2]||"en", root="/home/user/ebanist-app", OUT=path.join(__dirname,"vid",L);
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const CAP={
 en:{t:"What's new in Ebanist",s:"From the site survey to workshop-ready drawings",
  c1:"Design the unit and see it in 3D",c2:"Light dimensions on the 3D model",c3:"Every part with its holes",
  c4:"Choose the joint: minifix, confirmat, dowel, biscuit, Domino, Clamex",c5:"The part sheet shows the slots and holes",
  c6:"A3 fabrication sheet for every part: dimensions from the edge to the hole axis",c7:"A3 elevations and sections with material hatching",
  c8:"Site survey: wall lengths and angles, closing check",c9:"The room in 3D, with your units placed",c10:"Import the room outline from a DXF",
  c11:"Complete technical dossier in one click: cover, report, elevations, assembly, parts",c12:"Assembly sheet: exploded view with numbered positions and steps",e:"Free to try at ebanist.com",e2:"Exports and A3 sheets are in Pro"},
 ro:{t:"Noutăți în Ebanist",s:"De la releveu la desene gata pentru atelier",
  c1:"Proiectezi corpul și îl vezi în 3D",c2:"Cote de lumină pe modelul 3D",c3:"Fiecare piesă, cu găurile ei",
  c4:"Alegi îmbinarea: minifix, confirmat, tasel, lamelă, Domino, Clamex",c5:"Fișa piesei arată canalele și găurile",
  c6:"Foaie A3 de fabricație pentru fiecare piesă: cote de la muchie la axa găurii",c7:"Prospecte și secțiuni A3, cu hașuri pe material",
  c8:"Releveu: lungimi și unghiuri de pereți, verificarea închiderii",c9:"Camera în 3D, cu corpurile tale așezate",c10:"Importi conturul camerei dintr-un DXF",
  c11:"Dosar tehnic complet dintr-un clic: copertă, raport, prospecte, montaj, piese",c12:"Foaia de montaj: vedere explodată cu poziții numerotate și pași",e:"Încearcă gratuit pe ebanist.com",e2:"Exporturile și foile A3 sunt în Pro"},
 it:{t:"Novità in Ebanist",s:"Dal rilievo ai disegni pronti per il laboratorio",
  c1:"Progetti il mobile e lo vedi in 3D",c2:"Quote di luce sul modello 3D",c3:"Ogni pezzo, con i suoi fori",
  c4:"Scegli la giunzione: minifix, confirmat, spinotto, lamello, Domino, Clamex",c5:"La scheda del pezzo mostra cave e fori",
  c6:"Foglio A3 di fabbricazione per ogni pezzo: quote dal bordo all'asse del foro",c7:"Prospetti e sezioni A3 con tratteggio del materiale",
  c8:"Rilievo: lunghezze e angoli dei muri, controllo della chiusura",c9:"La stanza in 3D, con i tuoi mobili posizionati",c10:"Importi il contorno della stanza da un DXF",
  c11:"Dossier tecnico completo in un clic: copertina, relazione, prospetti, montaggio, pezzi",c12:"Foglio di montaggio: vista esplosa con posizioni numerate e fasi",e:"Provalo gratis su ebanist.com",e2:"Esportazioni e fogli A3 sono in Pro"},
 fr:{t:"Nouveautés d'Ebanist",s:"Du relevé aux plans prêts pour l'atelier",
  c1:"Vous dessinez le meuble et le voyez en 3D",c2:"Cotes de passage sur le modèle 3D",c3:"Chaque pièce, avec ses perçages",
  c4:"Choisissez l'assemblage : minifix, confirmat, tourillon, lamelle, Domino, Clamex",c5:"La fiche de la pièce montre rainures et perçages",
  c6:"Fiche de fabrication A3 pour chaque pièce : cotes du bord à l'axe du perçage",c7:"Élévations et coupes A3 avec hachures de matériau",
  c8:"Relevé : longueurs et angles des murs, contrôle de fermeture",c9:"La pièce en 3D, avec vos meubles placés",c10:"Importez le contour de la pièce depuis un DXF",
  c11:"Dossier technique complet en un clic : couverture, rapport, élévations, montage, pièces",c12:"Fiche de montage : vue éclatée avec positions numérotées et étapes",e:"À essayer gratuitement sur ebanist.com",e2:"Exports et fiches A3 sont dans Pro"}
}[L];
const srv=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!fs.existsSync(f)){r.statusCode=404;return r.end()}const ext=path.extname(f);r.setHeader("content-type",{".html":"text/html",".js":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2",".webp":"image/webp",".png":"image/png"}[ext]||"application/octet-stream");r.end(fs.readFileSync(f))}).listen(8793,async()=>{
 const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"]});
 const ctx=await b.newContext({viewport:{width:1440,height:810},recordVideo:{dir:OUT,size:{width:1440,height:810}}});
 await ctx.addInitScript(()=>{try{localStorage.setItem("ebanist_lic",JSON.stringify({kind:"stripe",key:"comp_TESTTESTTESTTESTTESTTEST",status:"active",activated:true,checkedAt:Date.now()}))}catch(e){}});
 const pg=await ctx.newPage(); const errs=[]; pg.on("pageerror",e=>errs.push(String(e)));
 pg.setDefaultTimeout(30000); const w=ms=>pg.waitForTimeout(ms); const t0=Date.now(); let cutAt=0;
 const cap=async(txt)=>pg.evaluate(t=>{let d=document.getElementById("vcap");if(!d){d=document.createElement("div");d.id="vcap";d.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:16px 28px;background:rgba(14,59,42,.94);color:#fff;font:600 24px/1.25 Barlow,system-ui,sans-serif;text-align:center;letter-spacing:.2px";document.body.appendChild(d)}d.textContent=t;d.style.display=t?"block":"none"},txt);
 const card=async(a,bb)=>pg.evaluate(([a,bb])=>{let d=document.getElementById("vcard");if(!d){d=document.createElement("div");d.id="vcard";d.style.cssText="position:fixed;inset:0;z-index:2147483646;background:#0e3b2a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:Barlow,system-ui,sans-serif;text-align:center;padding:40px";document.body.appendChild(d)}d.innerHTML=a?`<div style="font:700 22px Barlow;letter-spacing:6px;opacity:.8">EBANIST</div><div style="font:700 56px/1.1 Barlow">${a}</div><div style="font:400 28px Barlow;opacity:.9">${bb||""}</div>`:"";d.style.display=a?"flex":"none"},[a,bb]);
 const sheet=async(svg,zoom)=>pg.evaluate(([svg,zoom])=>{let d=document.getElementById("vsheet");if(!d){d=document.createElement("div");d.id="vsheet";d.style.cssText="position:fixed;inset:0 0 62px 0;z-index:2147483645;background:#3b403c;display:flex;align-items:center;justify-content:center;overflow:hidden";document.body.appendChild(d)}
   if(!svg){d.style.display="none";return}d.style.display="flex";d.innerHTML='<div id="vsh" style="width:min(calc((100vh - 76px)*1.4142),96vw);background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.5);transition:transform 3.2s ease-in-out;transform-origin:'+(zoom?zoom[0]+'% '+zoom[1]+'%':'50% 50%')+'">'+svg.replace(/width="420mm" height="297mm"/,'style="width:100%;height:auto;display:block"')+'</div>'},[svg,zoom]);
 const zoomTo=async(s)=>pg.evaluate(s=>{document.getElementById("vsh").style.transform="scale("+s+")"},s);
 await pg.goto("http://localhost:8793/app/index.html?lang="+L);await pg.waitForFunction(()=>window.MAT_LOADED===true);await w(3500);
 await pg.locator('#btnIntroGo').click({timeout:1500}).catch(()=>{}); await pg.getByText('Start',{exact:true}).click({timeout:1500}).catch(()=>{}); await w(600);
 await pg.evaluate(()=>{closeSheets();const p=proj();p.pieces=[];p.configs={};p.layout={};generateInto(p,{...PRESETS.armadio,name:"Wardrobe W1000"});persist();setView("build")});await w(1500);
 /* 0. card */ pg.setDefaultTimeout(4000); await card(CAP.t,CAP.s);cutAt=Date.now()-t0;await w(3200);await card("");
 /* 1. builder + 3D */ await cap(CAP.c1);await w(2500);
 await pg.locator("#btnOpen3d").click();await w(800);await pg.locator('#btnPrevBig').click().catch(()=>{});await w(1500);
 await cap(CAP.c2);await pg.locator("#btnDims3d").click();await w(3500);await pg.locator("#btnDims3d").click();
 await cap(CAP.c3);await pg.locator("#btnHoles3d").click();await w(1200);
 await pg.evaluate(()=>{const M=GL3D.model();const pc=M.ops.pieces.find(q=>q.role==="fianco");GL3D.select(pc.pk,true)});await w(3800);
 await pg.evaluate(()=>{GL3D.select(null);GL3D.set({holes:false})});await w(400);
 await pg.locator("#btnPrevBig").click().catch(()=>{});await w(600);await pg.locator("#btnOpen3d").click().catch(()=>{});await w(600);
 await pg.evaluate(()=>setView("build"));await w(800);
 /* 2. îmbinări */ await cap(CAP.c4);
 await pg.evaluate(()=>{const s=document.querySelector('#hwSelBox select[data-cat="conn"]'); const d=s&&s.closest('details'); if(d) d.open=true; s&&s.scrollIntoView({block:"center"})});await w(1500);
 for(const id of ["gen_confirmat","gen_biscuit","fes_domino"]){ await pg.locator('#hwSelBox select[data-cat="conn"]').selectOption(id,{timeout:3000}).catch(()=>{});await w(1300);}
 await pg.locator("#btnGenerate").click({timeout:3000}).catch(()=>{});await w(1200);await pg.evaluate(()=>setView('build'));await w(2800);
 /* fișa piesei cu canale */
 await cap(CAP.c5);
 await pg.evaluate(()=>{ setView("build"); const M=GL3D.model(); const pc=M.ops.pieces.find(q=>q.operations.some(o=>o.type==="slot")&&q.role!=="fianco")||M.ops.pieces[0]; openPartSheet(M,pc); window.__pc=pc; });await w(3200);
 await pg.evaluate(()=>closeSheets());
 /* 3. foaia A3 a piesei */
 await cap(CAP.c6);
 const a3=await pg.evaluate(()=>{const M=GL3D.model(); const pc=M.ops.pieces.find(q=>q.role==="fianco")||M.ops.pieces[0], m=M.meta[String(pc.pk)]||{}, row=m.row||{}, p=proj();
   return EBSheet.partSheetSVG(pc,{face:5,tr:t,opName,sheetNo:1,sheetTot:1,meta:{company:"Domus Renov",project:p.name,client:"",name:partName(M,pc),n:m.n,material:row.materiale||row.mat||"",qty:row.pz,edge:row.bordo,date:new Date().toISOString().slice(0,10),ver:APP_VER}});});
 await sheet(a3,[28,52]);await w(2500);await zoomTo(2.3);await w(4200);await sheet(null);
 /* 4. prospecte */
 await cap(CAP.c7);
 const el=await pg.evaluate(()=>{const cfg=Object.assign({},PRESETS.armadio,{name:"Wardrobe W1000"});const {boxes}=buildModule(cfg);const mt=id=>{const m=id?matById(id):null;return m?{n:m.label,t:m.spessore}:{n:"",t:""}};const S=state.settings,b=mt(S.matBody),bk=mt(S.matBack),fr=mt(S.matFront);
   return EBElab.elevationsSheetSVG(boxes,{tr:t,sheetNo:1,sheetTot:1,meta:{company:"Domus Renov",project:proj().name,client:"",name:cfg.name,matBody:b.n,matFront:fr.n,matBack:bk.n,tBody:b.t,tBack:bk.t,date:new Date().toISOString().slice(0,10),ver:APP_VER}});});
 await sheet(el,[35,35]);await w(2500);await zoomTo(1.9);await w(4200);await sheet(null);

 /* 4b. dosarul tehnic: fereastra pachetului, apoi coperta, raportul și foaia de montaj */
 await pg.evaluate(()=>{closeSheets();setView("build");packOpen()});await cap(CAP.c11);await w(2400);
 const pack=await pg.evaluate(()=>{closeSheets();const p=proj();return packBuild(p,{cover:true,client:false,report:true,elev:false,asm:true,parts:false}).map(x=>x)});
 await sheet(pack[0],[50,40]);await w(1200);await zoomTo(1.6);await w(2200);
 await sheet(pack[1],[30,30]);await w(1200);await zoomTo(1.7);await w(2000);
 await cap(CAP.c12);await sheet(pack[2],[30,40]);await w(1500);await zoomTo(1.7);await w(3200);await sheet(null);
 /* 5. releveu + camera */
 await pg.evaluate(()=>{closeSheets();const p=proj();p.pieces=[];p.configs={};p.layout={};
  p.survey={walls:[{id:"a",len:5200,angle:90},{id:"b",len:2600,angle:90},{id:"c",len:1800,angle:270},{id:"d",len:1800,angle:90},{id:"e",len:3400,angle:90},{id:"f",len:4400,angle:90}],heights:[2584,2596,2571],obstacles:[],wallH:2600};
  generateInto(p,{...PRESETS.armadio,name:"Armadio"});generateInto(p,{...PRESETS.base,name:"Base 1"});
  p.layout={"Armadio":{wall:"a",from:300,off:0,lift:0,rot:0},"Base 1":{wall:"a",from:1500,off:0,lift:0,rot:0}};persist();setView("survey")});await w(1200);
 await cap(CAP.c8);await w(3200);
 await cap(CAP.c9);await pg.locator("#btnRoom3D").click();await w(3500);
 await pg.evaluate(()=>{VIEW.yaw=2.3;VIEW.pitch=0.7;redrawCam()});await w(3200);await pg.evaluate(()=>closeSheets());await w(600);
 await cap(CAP.c10);
 const [fc]=await Promise.all([pg.waitForEvent("filechooser"),pg.locator("#btnSvDxf").click()]);await fc.setFiles(path.join(__dirname,"camera-L-test.dxf"));await w(1500);await pg.getByRole('button',{name:'OK',exact:true}).click().catch(()=>{});await w(3000);
 /* final */ await cap("");await card(CAP.e,CAP.e2);await w(3500);
 fs.writeFileSync(path.join(OUT,"cut.txt"),String(cutAt));
 console.log("errs",JSON.stringify(errs.slice(0,5)));
 await ctx.close();await b.close();srv.close();});
