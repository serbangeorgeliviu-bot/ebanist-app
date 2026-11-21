/* Montajul final al clipului gamer (9:16, ≈ 22 s, RO/EN, FĂRĂ audio — sunetul în trend se alege în TikTok la postare).
   Intrare: cadrele AI (vid-gamer/ai/{hook,chaos,dream}.mp4, generate cu vidIQ/MiniMax H3, fără logo/joc real) + părțile 3D din gamer-clip.cjs (vid-gamer/part-<limbă>-<i>.mp4).
   Ieșire: vid-gamer/ebanist-gamer-final-<limbă>.mp4.  Rulează întâi `gamer-clip.cjs mux`. */
const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const fs=require("fs"),path=require("path"),cp=require("child_process");
const OUT=path.resolve(__dirname,"../../vid-gamer"),FPS=24;
const TX={it:{a:"GTA 6 è uscito.",b:"E tu giochi su QUESTO?",c:"14 cavi. 1 tazza. 0 stabilità.",d:"Il setup per GTA 6"},
          ro:{a:"GTA 6 a ieșit.",b:"Tu joci pe masa asta?",c:"14 cabluri. 1 cană. 0 stabilitate.",d:"Setup-ul de GTA 6"},
          en:{a:"GTA 6 is out.",b:"You’re gaming on THIS?",c:"14 cables. 1 mug. 0 stability.",d:"The GTA 6 setup"}};
const TXW={ro:{w1:["Perete întreg de gaming","12 corpuri · rafturi LED · vitrină · nișă pentru consolă"],w2:["Jocuri, gadgeturi, colecții","rafturi cu LED"],w3:["170 de panouri, gata de debitat","proiectat în Ebanist"]},
 en:{w1:["A full gaming wall","12 units · LED shelves · display · console niche"],w2:["Games, gadgets, collectibles","shelves with LED"],w3:["170 panels, ready to cut","designed in Ebanist"]},
 it:{w1:["Una parete gaming completa","12 moduli · mensole LED · vetrina · nicchia console"],w2:["Giochi, gadget, collezioni","mensole con LED"],w3:["170 pannelli, pronti da tagliare","progettato con Ebanist"]}};
const WS=[["w1",3.4],["w2",2.8],["w3",2.6]];
const sh=(a)=>cp.execFileSync("ffmpeg",["-loglevel","error","-y",...a],{stdio:"inherit"});
(async()=>{
 const b=await chromium.launch({args:["--no-sandbox"]});const pg=await b.newPage({viewport:{width:1080,height:1920}});
 const big=(t,y)=>`<div style="position:fixed;left:40px;right:40px;top:${y}px;text-align:center;font:900 112px/1.02 'Inter',system-ui,sans-serif;color:#fff;-webkit-text-stroke:10px #000;paint-order:stroke fill;text-shadow:0 6px 30px rgba(0,0,0,.7);letter-spacing:-2px">${t}</div>`;
 const mid=(t,y)=>`<div style="position:fixed;left:40px;right:40px;top:${y}px;text-align:center;font:900 92px/1.05 'Inter',system-ui,sans-serif;color:#7ef0ff;-webkit-text-stroke:9px #000;paint-order:stroke fill;text-shadow:0 0 40px #ff4fa3,0 6px 24px rgba(0,0,0,.7)">${t}</div>`;
 for(const L of ["ro","en","it"]){
  const dir=path.join(OUT,"mix",L);fs.mkdirSync(dir,{recursive:true});
  for(const [k,html] of Object.entries({a:big(TX[L].a,300),b:big(TX[L].b,300),c:mid(TX[L].c,300),d:mid(TX[L].d,300)})){
   await pg.setContent(`<body style="margin:0;background:transparent">${html}</body>`);await pg.screenshot({path:path.join(dir,k+".png"),omitBackground:true});
  }
  for(const [k,[a,c]] of Object.entries(TXW[L])){
   await pg.setContent(`<body style="margin:0;background:transparent"><div style="position:fixed;left:50px;right:50px;bottom:330px;text-align:center;padding:26px 30px;border-radius:30px;background:rgba(10,10,30,.82);border:3px solid #ff4fa3;box-shadow:0 0 36px rgba(255,79,163,.55),0 0 60px rgba(0,229,255,.25);color:#fff;font-family:Inter,system-ui,sans-serif"><div style="font-weight:800;font-size:64px;line-height:1.08">${a}</div><div style="font-weight:600;font-size:36px;color:#7ef0ff;margin-top:10px">${c}</div></div></body>`);
   await pg.screenshot({path:path.join(dir,"cap-"+k+".png"),omitBackground:true});
  }
 }
 await b.close();
 const enc=["-r",String(FPS),"-c:v","libx264","-crf","19","-preset","medium","-pix_fmt","yuv420p","-an"];
 const fit="scale=-2:1920,crop=1080:1920,eq=contrast=1.12:saturation=1.2,noise=alls=7:allf=t,vignette=PI/5";
 for(const L of ["ro","en","it"]){
  const dir=path.join(OUT,"mix",L),ai=n=>path.join(OUT,"ai",n+".mp4"),ov=k=>path.join(dir,k+".png"),part=i=>path.join(OUT,"part-"+L+"-"+i+".mp4"),seg=[];
  const mk=(name,args)=>{const f=path.join(dir,name+".mp4");sh([...args,...enc,f]);seg.push(f)};
  const over=(k,a,b)=>`overlay=0:0:enable='between(t,${a},${b})'`;
  /* 1 hook: 0–3.6, textul A apoi B, zoom-punch ușor spre final */
  mk("s1",["-t","3.6","-i",ai("hook"),"-loop","1","-framerate","24","-i",ov("a"),"-loop","1","-framerate","24","-i",ov("b"),"-filter_complex",
   `[0:v]${fit}[v];[v][1:v]${over("a",0.1,1.9)}[x];[x][2:v]${over("b",1.9,3.6)}[o]`,"-map","[o]","-t","3.6"]);
  /* 2 haos: shake + text C */
  mk("s2",["-t","3.0","-i",ai("chaos"),"-loop","1","-framerate","24","-i",ov("c"),"-filter_complex",
   `[0:v]scale=-2:2080,crop=1080:1920:x='(iw-1080)/2+sin(t*38)*14':y='(ih-1920)/2+cos(t*45)*14',eq=contrast=1.12:saturation=1.2,noise=alls=7:allf=t,vignette=PI/5[v];[v][1:v]${over("c",0.2,3.0)}[o]`,"-map","[o]","-t","3.0"]);
  /* 3 „Sau…” */
  mk("s3",["-t","0.8","-i",part(2),"-t","0.8"]);
  /* 4 setup-ul de vis: flash alb la intrare, text D */
  mk("s4",["-ss","0.3","-t","4.0","-i",ai("dream"),"-loop","1","-framerate","24","-i",ov("d"),"-filter_complex",
   `[0:v]${fit},fade=t=in:st=0:d=0.15:color=white[v];[v][1:v]${over("d",0.3,4.0)}[o]`,"-map","[o]","-t","4.0"]);
  /* 5–8 partea 3D din Ebanist + card */
  for(const [k,dur] of WS){const nf=fs.readdirSync(path.join(OUT,"wseq",k)).length;
   mk(k,["-framerate",String(nf/dur),"-i",path.join(OUT,"wseq",k,"f_%04d.jpg"),"-loop","1","-framerate","24","-i",path.join(OUT,"glow.png"),"-loop","1","-framerate","24","-i",path.join(dir,"cap-"+k+".png"),"-filter_complex",
    `[0:v]eq=brightness=-0.24:contrast=1.3:saturation=1.1,vignette=PI/4,format=rgb24[v];[1:v]format=rgb24[g];[v][g]blend=all_mode=screen:all_opacity=0.32[b];[b][2:v]overlay=0:0:enable='between(t,0.2,${dur})'[o]`,"-map","[o]","-t",String(dur)]);}
  mk("s8",["-t","3.0","-i",part(7)]);
  const lst=path.join(dir,"list.txt");fs.writeFileSync(lst,seg.map(x=>"file '"+x+"'").join("\n"));
  sh(["-f","concat","-safe","0","-i",lst,"-c","copy","-movflags","+faststart",path.join(OUT,"ebanist-gamer-final-"+L+".mp4")]);
  console.log("gata",L);
 }
})();
