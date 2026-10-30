/* Film TikTok Atelier, partea 2: din vid-ta/<lang>/seq/*.jpg + timeline.json face mp4 1080×1920, 30 fps, cu voce Piper (dacă PIPER_VOICE e setat).
   PIPER_PY=<python cu piper> PIPER_VOICE=<model.onnx> node site-src/tools/tiktok-atelier-mux.cjs <it> */
const fs=require("fs"),path=require("path"),cp=require("child_process");
const L=process.argv[2]||"it", root=path.resolve(__dirname,"../.."), D=path.join(root,"vid-ta",L);
const TL=JSON.parse(fs.readFileSync(path.join(D,"timeline.json"),"utf8"));
const SEQ=path.join(D,"seq");
if(!fs.existsSync(SEQ)) throw new Error("lipsește seq/; rulează întâi tiktok-atelier.cjs");
const VOICE={it:{hook:"Ebanist Atelier. Dal progetto alla macchina, senza sorprese.",c1:"Un progetto vero: tre corpi, ogni pezzo con le sue quote.",c2:"Dossier A3 con un clic: prospetti e sezioni.",c3:"Montaggio con posizioni numerate.",c4:"Quote dal bordo, all'asse del foro.",c5:"Un'etichetta con codice QR su ogni pezzo.",c6:"In officina vedi ogni ordine, e ogni postazione.",c7:"I ritardi in rosso. Il capo vede tutto, dall'ufficio.",end:"Ebanist. Provalo gratis su ebanist punto com."}}[L];
let voiceFile=null;
if(VOICE&&process.env.PIPER_VOICE){
  const m=TL.marks, cues=m.map((x,i)=>{const nxt=i+1<m.length?m[i+1].t:TL.total;return {start:x.t+(x.name==="hook"?.3:.15),avail:nxt-x.t-(x.name==="hook"?.5:.3),text:VOICE[x.name]}});
  fs.writeFileSync(path.join(D,"cues.json"),JSON.stringify(cues));voiceFile=path.join(D,"voice.wav");
  cp.execFileSync(process.env.PIPER_PY||"python3",[path.join(__dirname,"tiktok-voice.py"),path.join(D,"cues.json"),voiceFile,String(TL.total),process.env.PIPER_VOICE],{stdio:"inherit"});
}
const out=path.join(root,"vid-ta","ebanist-tiktok-atelier-"+L+".mp4");
const args=["-loglevel","error","-y","-framerate",String(TL.fps),"-i",path.join(SEQ,"s_%05d.jpg"),...(voiceFile?["-i",voiceFile]:[]),
  "-vf","scale=1080:1920:flags=lanczos,fps=30","-c:v","libx264","-crf","20","-preset","slow","-pix_fmt","yuv420p","-movflags","+faststart",
  ...(voiceFile?["-af","loudnorm=I=-16:TP=-1.5:LRA=9","-c:a","aac","-b:a","160k","-ar","44100","-shortest"]:[]),out];
cp.execFileSync("ffmpeg",args,{stdio:"inherit"});
console.log("gata",out);

/* ---- Varianta cu hook vidIQ + voce vidIQ (Eric): ELEVEN_DIR=<director cu hook.mp3, card.mp3, c1..c7.mp3, end.mp3> HOOK_VIDEO=<mp4 9:16>
   node site-src/tools/tiktok-atelier-mux.cjs it  (cu ELEVEN_DIR setat, înlocuiește rezultatul de mai sus)
   Fiecare scenă e prelungită (ultimul cadru repetat) ca replica să încapă; replicile lungi se accelerează cel mult 1,2×. */
if(process.env.ELEVEN_DIR&&process.env.HOOK_VIDEO){
  const ED=process.env.ELEVEN_DIR, probe=f=>parseFloat(cp.execFileSync("ffprobe",["-v","error","-show_entries","format=duration","-of","csv=p=0",f]).toString());
  const names=TL.marks.map(m=>m.name==="hook"?"card":m.name), starts=TL.marks.map(m=>Math.round(m.t*TL.fps)), totalF=Math.round(TL.total*TL.fps);
  const S2=path.join(D,"seq2"); fs.rmSync(S2,{recursive:true,force:true}); fs.mkdirSync(S2,{recursive:true});
  let k=0, tAt=probe(process.env.HOOK_VIDEO); const HOOKLEN=tAt, plan=[];
  names.forEach((nm,i)=>{
    const a0=starts[i], a1=i+1<starts.length?starts[i+1]:totalF, L=(a1-a0)/TL.fps, d=probe(path.join(ED,nm+".mp3"));
    const tempo=Math.min(1.2,Math.max(1,d/(L-0.35))), need=d/tempo+0.35, ext=Math.max(0,need-L), extF=Math.ceil(ext*TL.fps);
    for(let f=a0;f<a1;f++) fs.copyFileSync(path.join(SEQ,"s_"+String(f+1).padStart(5,"0")+".jpg"),path.join(S2,"s_"+String(++k).padStart(5,"0")+".jpg"));
    for(let e=0;e<extF;e++) fs.copyFileSync(path.join(SEQ,"s_"+String(a1).padStart(5,"0")+".jpg"),path.join(S2,"s_"+String(++k).padStart(5,"0")+".jpg"));
    plan.push({nm,at:tAt+0.15,tempo}); tAt+=(a1-a0+extF)/TL.fps;
  });
  const FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const dt=(txt,fs_,y)=>`drawtext=fontfile=${FONT}:text='${txt}':fontsize=${fs_}:fontcolor=white:box=1:boxcolor=0x0e3b2aE6:boxborderw=22:x=(w-text_w)/2:y=${y}`;
  const ins=["-i",process.env.HOOK_VIDEO,"-framerate",String(TL.fps),"-i",path.join(S2,"s_%05d.jpg"),"-i",path.join(ED,"hook.mp3")];
  plan.forEach(p=>ins.push("-i",path.join(ED,p.nm+".mp3")));
  const fcx=[`[0:v]scale=-2:1920,crop=1080:1920,fps=30,${dt("UN PEZZO TAGLIATO MALE",62,1330)},${dt("costa più di tutto il resto.",52,1440)},setsar=1,format=yuv420p[a]`,
    `[1:v]scale=1080:1920:flags=lanczos,fps=30,setsar=1,format=yuv420p[b]`,`[a][b]concat=n=2:v=1:a=0[v]`,`[0:a]volume=0.35[sfx]`,`[2:a]adelay=300|300[h]`];
  const mix=["[sfx]","[h]"];
  plan.forEach((p,i)=>{const ms=Math.round(p.at*1000);fcx.push(`[${i+3}:a]atempo=${p.tempo.toFixed(3)},adelay=${ms}|${ms}[v${i}]`);mix.push(`[v${i}]`)});
  fcx.push(`${mix.join("")}amix=inputs=${mix.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[aout]`);
  const out2=path.join(root,"vid-ta","ebanist-tiktok-atelier-"+L+"-v2.mp4");
  cp.execFileSync("ffmpeg",["-loglevel","error","-y",...ins,"-filter_complex",fcx.join(";"),"-map","[v]","-map","[aout]","-c:v","libx264","-crf","20","-preset","slow","-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-ar","44100","-movflags","+faststart","-t",String(tAt),out2],{stdio:"inherit"});
  console.log("gata v2",out2,"s",tAt.toFixed(1),"hook",HOOKLEN.toFixed(2));
}
