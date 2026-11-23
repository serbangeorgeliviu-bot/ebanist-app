/* verificare completă a proiectului: JSON, distinctă (tăieturi), operații (găuri/canale), închidere/invarianți */
const fs=require("fs"),vm=require("vm"),path=require("path");
const E=require(__dirname+"/engine.js");const S=E.appEngine(),MM=E.MM;
vm.runInContext(fs.readFileSync(""+__dirname+"/../app/ebanist-ops.js","utf8"),S);
const P=JSON.parse(fs.readFileSync(__dirname+"/../Dressing-Toaletta-Noce-Grigio.json","utf8"));
const TH={nogal_victoria_19:19,grigio_medio_19:19,pfl3:3,specchio_4:4};
S.handleIsProfile=()=>false;
S.state.settings={panelL:2800,panelW:2070,kerf:4,matBody:"nogal_victoria_19",matFront:"nogal_victoria_19",matBack:"pfl3",matOvr:{},matAdd:Object.entries(TH).map(([k,v])=>MM(k,v)),hwProd:{guida:"blum_tandem"}};
const J=x=>JSON.stringify(x), bad=[], info=[]; const R=(c,m)=>bad.push(c+": "+m);
const PL=2800,PW=2070;
let totPieces=0,totDrill=0,totGroove=0,totMill=0,area=0;
for(const [name,cfg0] of Object.entries(P.configs)){
  const cfg=JSON.parse(J(cfg0)); let b;
  try{b=S.buildModule(cfg)}catch(e){R(name,"buildModule: "+e.message);continue}
  // 1. rândurile din JSON == ce generează motorul acum
  const rows=P.pieces.filter(x=>x.gen===name);
  const cur=b.pieces.map(x=>[x.elemento,x.lung,x.larg,x.pz].join("|")).sort(), old=rows.map(x=>[x.elemento,x.lung,x.larg,x.pz].join("|")).sort();
  if(J(cur)!==J(old)) R(name,"distinta din JSON ≠ motor\n  JSON:"+old.join(" ; ")+"\n  motor:"+cur.join(" ; "));
  // 2. tăieturi: încap pe placă (oglinda: la sticlar); suma ariilor
  for(const x of b.pieces){ totPieces+=x.pz; if(x.role==="accessorio") continue;
    const l=Math.max(x.lung,x.larg), w=Math.min(x.lung,x.larg);
    if(cfg.matBody==="specchio_4"){ if(l>3210||w>2250) R(name,x.elemento+" mai mare decât sticla 3210×2250"); }
    else if(l>PL||w>PW) R(name,x.elemento+" "+x.lung+"×"+x.larg+" nu încape pe placă "+PL+"×"+PW);
    area+=x.lung*x.larg*x.pz/1e6; }
  if(cfg.type!=="standard") { info.push(name+": "+b.pieces.length+" rânduri (contur/altă tipologie, fără închidere de carcasă)"); }
  let G=null,pcs=b.pieces.map(x=>Object.assign({},x));
  // 3. închidere + invarianți (corpurile standard)
  if(cfg.type==="standard"){ try{ G=S.deriveCarcass(S.carcassParams(cfg,{}));
    const cl=Array.from(S.validateCarcassClosure(cfg,pcs,G)); if(cl.length) R(name,"închidere: "+J(cl).slice(0,300));
    const inv=Array.from(S.failedInvariants(cfg,pcs,G,{})); if(inv.length) R(name,"invarianți: "+J(inv.map(x=>x.id||x)).slice(0,300)); }catch(e){R(name,"închidere/invarianți: "+e.message)} 
    // 4. operații
    let o; try{ o=JSON.parse(J(S.generateOperations({boxes:b.boxes,cfg,G}))) }catch(e){ R(name,"ops: "+e.message); continue }
    for(const w of (o.warnings||[])) { if(!/NoHingePanel/.test(w.k)) R(name,"avertisment ops: "+w.k); else info.push(name+": avertisment "+w.k+" (plăcuța balamalei pe despărțitor lipsă lângă ușa din margine)"); }
    for(const p of o.pieces){
      const ids=p.operations.map(x=>x.id); if(new Set(ids).size!==ids.length) R(name,p.role+" id-uri duble");
      for(const f of p.preflight||[]) if(f.level==="error") R(name,p.role+" preflight "+f.rule+" "+f.op);
      const dr=p.operations.filter(x=>x.type==="drill");
      for(const x of dr){ totDrill++;
        if(x.face>=5){ if(!(x.x>=0&&x.x<=p.length&&x.y>=0&&x.y<=p.width)) R(name,p.role+" gaura "+x.id+" în afara piesei ("+x.x+","+x.y+")");
          if(!x.through&&x.depth>p.thickness-2+0.05) R(name,p.role+" gaura "+x.id+" prea adâncă"); }
        if(x.dia>0&&x.face>=5&&(x.x-x.dia/2<-0.01||x.x+x.dia/2>p.length+0.01||x.y-x.dia/2<-0.01||x.y+x.dia/2>p.width+0.01)) R(name,p.role+" gaura "+x.id+" ⌀"+x.dia+" iese din piesă");
      }
      // două găuri pe aceeași față nu se mănâncă (distanță ≥ razele), exceptând găurile din același articol
      for(let i=0;i<dr.length;i++)for(let k=i+1;k<dr.length;k++){ const a=dr[i],c=dr[k]; if(a.face!==c.face||a.face<5) continue;
        const d=Math.hypot(a.x-c.x,a.y-c.y); if(d<(a.dia+c.dia)/2-0.01 && !(a.hw&&a.hw===c.hw)) R(name,p.role+" găurile "+a.id+" și "+c.id+" se suprapun (d="+d.toFixed(1)+")"); }
      for(const g of p.operations.filter(x=>x.type==="groove")){ totGroove++;
        if(g._lo&&g._hi) for(let k=0;k<3;k++) if(g._lo[k]<p.min[k]-1e-6||g._hi[k]>p.max[k]+1e-6) R(name,p.role+" canal "+g.id+" iese din piesă"); }
      totMill+=p.operations.filter(x=>x.type!=="drill"&&x.type!=="groove").length;
    }
    // 5. uși / balamale / mânere consecvente
    const doors=o.pieces.filter(p=>p.role==="frontale"&&!/cassetto/i.test(p.sub||""));
    const cups=o.pieces.flatMap(p=>p.operations.filter(x=>x.note==="tazza cerniera")).length, hinges=o.hw.filter(h=>h.type==="cerniera").length;
    if(cups!==hinges) R(name,"căni de balama "+cups+" ≠ balamale "+hinges);
    const plates=o.pieces.flatMap(p=>p.operations.filter(x=>x.note==="basetta cerniera")).length;
    if(plates!==2*hinges) info.push(name+": plăcuțe de balama găurite "+plates+"/"+(2*hinges)+" (restul: fără despărțitor lângă ușă)");
    const nofr=(cfg.fronts||[]).filter(f=>f.handle==="none").length, nfr=(cfg.fronts||[]).length;
    if(nfr){ const doorsN=cfg.fronts.length, expected=doorsN-nofr, mn=o.hw.filter(h=>h.type==="maniglia"&&!/cassetto|drawer/i.test(h.piece+"")).length;
      info.push(name+": uși "+doorsN+" (fără mâner "+nofr+"), mânere totale "+o.hw.filter(h=>h.type==="maniglia").length); }
    const leds=o.hw.filter(h=>h.type==="ledv"||h.type==="led"); if(cfg.ledRuns&&cfg.ledRuns.length!==leds.filter(h=>h.type==="ledv").length) R(name,"benzi LED verticale cerute "+cfg.ledRuns.length+", emise "+leds.filter(h=>h.type==="ledv").length);
  }
}
console.log("corpuri:",Object.keys(P.configs).length,"· rânduri JSON:",P.pieces.length,"· piese fizice:",totPieces,"· suprafață panouri ≈",area.toFixed(2),"m²");
console.log("găuri:",totDrill,"· canale:",totGroove,"· alte operații (frezări etc.):",totMill);
info.forEach(x=>console.log("  i",x));
console.log(bad.length?("PROBLEME ("+bad.length+"):\n  "+bad.join("\n  ")):"OK: nicio problemă de tăiere, gaură, canal, închidere sau invariant");
process.exit(bad.length?1:0);
