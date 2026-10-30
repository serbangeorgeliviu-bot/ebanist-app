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
