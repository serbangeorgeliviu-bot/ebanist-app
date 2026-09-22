"use strict";
/* ===========================================================================
   Ebanist — app/js/room.js

   «In camera tua»: foto della stanza in trasparenza, fotocamera dal vivo e
   consegna del modello all'AR nativa del telefono.
   =========================================================================== */
/* ================= ROOM PHOTO OVERLAY ================= */
const ROOM={view:{yaw:0.46,pitch:0.18,zoom:1,free:1},x:40,y:40,size:340,opa:1,roll:0,hasImg:false};
function roomRender(){
  const el=$("svgRoom");
  render3D(el,buildCfg,ROOM.view,{real:true});
  el.style.transform=`rotate(${ROOM.roll}deg)`;
  el.style.left=ROOM.x+"px"; el.style.top=ROOM.y+"px";
  el.style.width=ROOM.size+"px"; el.style.height=ROOM.size+"px";
  el.style.opacity=ROOM.opa;
}
$("btnRoom").addEventListener("click",()=>{
  buildCfg=cfgFromForm();
  $("roomView").style.display="flex";
  navSync();
  const st=$("roomStage").getBoundingClientRect();
  ROOM.x=(st.width-ROOM.size)/2; ROOM.y=(st.height-ROOM.size)/2;
  roomRender();
  if(!ROOM.hasImg) $("roomFile").click();
});
$("roomClose").addEventListener("click",()=>{ roomCamStop(); $("roomView").style.display="none"; navSync(); });
$("roomLoadBtn").addEventListener("click",()=>{ roomCamStop(); $("roomFile").click(); });

/* ---- fotocamera dal vivo ----
   Il mobile resta l'SVG di render3D, non il WebGL: cosi funziona anche sui
   telefoni dove three non parte, ed e la stessa immagine che finisce nel JPG.
   La fotocamera vuole HTTPS: in locale su http non parte, e normale. */
async function roomCamStart(){
  const v=$("roomCam");
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    toast("Fotocamera non disponibile"); return;
  }
  try{
    ROOM.stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"}}, audio:false});
  }catch(e){
    toast(e&&e.name==="NotAllowedError"?"Permesso fotocamera negato":"Fotocamera non accessibile");
    return;
  }
  v.srcObject=ROOM.stream;
  try{ await v.play(); }catch(e){}
  v.style.display="block";
  $("roomImg").style.display="none";
  $("roomEmpty").style.display="none";
  ROOM.live=true; ROOM.hasImg=true;
  $("roomCamBtn").classList.add("on");
  roomRender();
}
function roomCamStop(){
  if(ROOM.stream){ try{ ROOM.stream.getTracks().forEach(t=>t.stop()); }catch(e){} ROOM.stream=null; }
  const v=$("roomCam"); v.srcObject=null; v.style.display="none";
  $("roomImg").style.display="";
  ROOM.live=false;
  $("roomCamBtn").classList.remove("on");
  if(!$("roomImg").getAttribute("src")){ ROOM.hasImg=false; $("roomEmpty").style.display="flex"; }
}
$("roomCamBtn").addEventListener("click",()=>{ ROOM.live?roomCamStop():roomCamStart(); });
$("roomFile").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const url=URL.createObjectURL(f);
  $("roomImg").src=url; ROOM.hasImg=true; $("roomEmpty").style.display="none";
});
$("roomYaw").addEventListener("input",e=>{ ROOM.view.yaw=parseInt(e.target.value,10)/100; roomRender(); });
$("roomPitch").addEventListener("input",e=>{ ROOM.view.pitch=parseInt(e.target.value,10)/100; roomRender(); });
$("roomRoll").addEventListener("input",e=>{ ROOM.roll=parseInt(e.target.value,10); roomRender(); });
$("roomOpa").addEventListener("input",e=>{ ROOM.opa=parseInt(e.target.value,10)/100; roomRender(); });
(function(){
  const el=$("svgRoom"), ptrs=new Map(); let pinchD=0,pinchS=0;
  /* Pan e pinch mandano piu eventi di quanti fotogrammi ci siano: si
     disegna una volta per fotogramma, con l'ultima posizione. */
  const roomPaint=rafCoalesce(()=>roomRender());
  el.addEventListener("pointerdown",e=>{ el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptrs.size===2){ const a=[...ptrs.values()]; pinchD=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]); pinchS=ROOM.size; }
  });
  el.addEventListener("pointermove",e=>{
    if(!ptrs.has(e.pointerId))return;
    const prev=ptrs.get(e.pointerId); ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptrs.size===1){ ROOM.x+=e.clientX-prev[0]; ROOM.y+=e.clientY-prev[1]; roomPaint(); }
    else if(ptrs.size===2){ const a=[...ptrs.values()]; const d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);
      if(pinchD>0){ const ns=Math.min(1400,Math.max(90,pinchS*d/pinchD));
        ROOM.x-=(ns-ROOM.size)/2; ROOM.y-=(ns-ROOM.size)/2; ROOM.size=ns; roomPaint(); } }
  });
  const up=e=>{ ptrs.delete(e.pointerId); pinchD=0; };
  el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
  el.addEventListener("wheel",e=>{ e.preventDefault();
    const ns=Math.min(1400,Math.max(90,ROOM.size*(e.deltaY<0?1.08:0.92)));
    ROOM.x-=(ns-ROOM.size)/2; ROOM.y-=(ns-ROOM.size)/2; ROOM.size=ns; roomRender(); },{passive:false});
})();
/* ---- AR nativa: si consegna il modello al visore del telefono ----
   Android -> Scene Viewer, iPhone -> Quick Look. Il visore e un'altra app
   e non puo leggere un blob locale, quindi il file va caricato e gli si
   passa un https vero. Senza rete si ripiega sulla condivisione del file:
   su iPhone aprirlo dai File fa partire Quick Look lo stesso.
   Il modulo si carica solo qui, alla pressione: ~100 KB di exporter che
   non ha senso pagare a ogni avvio. */
$("btnAR").addEventListener("click",async()=>{
  const btn=$("btnAR");
  if(btn.dataset.busy) return;
  btn.dataset.busy="1"; const old=btn.textContent; btn.textContent="…";
  try{
    buildCfg=cfgFromForm();
    const boxes=buildModule(buildCfg).boxes;
    const M=await import("./arexport.js");
    const scene=M.buildExportScene(boxes,buildCfg);
    const ios=M.isIOS();
    let blob;
    try{ blob=ios?await M.toUSDZ(scene):await M.toGLB(scene); }
    finally{ M.disposeExportScene(scene); }
    const p=proj();
    const nice=(p&&p.name)||buildCfg.name||"Mobile";
    const fname=slug(nice)+(ios?".usdz":".glb");
    try{
      const url=await M.uploadModel(blob,fname);
      if(M.openAR(url,nice)) return;
      await M.shareModel(blob,fname);            // desktop: niente visore AR
    }catch(e){
      console.warn("AR upload:",e);
      toast("Niente rete per l'AR — condivido il file");
      await M.shareModel(blob,fname);
    }
  }catch(e){
    console.warn("AR:",e);
    /* un toast sparisce prima che si riesca a leggerlo, e la console di un
       telefono da qui non si legge: il motivo vero va messo in una finestra
       che resta, insieme allo stato del motore 3D — le due cose cascano
       quasi sempre insieme, perche arexport importa da viewer3d. */
    dialog({title:t("arFailTitle"),
      html:`<p>${esc(t("arFailWhy"))}: ${esc(String((e&&(e.message||e.name))||e))}</p>`+
           `<p class="mini" style="margin-top:8px">3D: ${esc(window.GL3D_MODE||"?")} `+
           `(${esc(window.GL3D_WHY||"-")}) · v${esc(APP_VER)}</p>`});
  }finally{ btn.dataset.busy=""; btn.textContent=old; }
});

/* Export con fotocamera dal vivo. Percorso separato da quello della foto,
   che funziona e non si tocca: li si esporta alla risoluzione dello scatto,
   qui non c'e uno scatto, c'e un fotogramma ritagliato come si vede. */
async function roomShare(cv){
  const jpg=cv.toDataURL("image/jpeg",0.9);
  const p=proj();
  const fname=`Ambiente_${slug((p&&p.name)||buildCfg.name||"mobile")}.jpg`;
  try{
    const rb=await (await fetch(jpg)).blob();
    const file=new File([rb],fname,{type:"image/jpeg"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:fname}); return; }
  }catch(e){}
  const a=document.createElement("a"); a.href=jpg; a.download=fname; a.click();
  toast("JPG ✓");
}
async function roomExportLive(){
  const v=$("roomCam");
  if(!v.videoWidth){ toast("Fotocamera non pronta"); return; }
  const stage=$("roomStage").getBoundingClientRect();
  /* scena a zero (pannello non ancora disegnato): senza questo si finisce
     a costruire un canvas 0x0 e toDataURL esplode */
  if(stage.width<8||stage.height<8){ toast("Fotocamera non pronta"); return; }
  const SC=2;                                   // doppia risoluzione: resta leggibile su WhatsApp
  const W=Math.round(stage.width*SC), H=Math.round(stage.height*SC);
  const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  const cx=cv.getContext("2d");
  /* il video sta in object-fit: cover, quindi si ritaglia esattamente come
     lo vede lui a schermo — altrimenti il JPG non corrisponde all'anteprima */
  const rV=v.videoWidth/v.videoHeight, rS=stage.width/stage.height;
  let sw,sh,sx,sy;
  if(rV>rS){ sh=v.videoHeight; sw=sh*rS; sx=(v.videoWidth-sw)/2; sy=0; }
  else{ sw=v.videoWidth; sh=sw/rS; sx=0; sy=(v.videoHeight-sh)/2; }
  cx.drawImage(v,sx,sy,sw,sh,0,0,W,H);
  const svg=$("svgRoom").cloneNode(true);
  svg.removeAttribute("style");
  const EXP=1600;
  svg.setAttribute("width",EXP); svg.setAttribute("height",EXP);
  svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const ser=new XMLSerializer().serializeToString(svg);
  const url=URL.createObjectURL(new Blob([ser],{type:"image/svg+xml;charset=utf-8"}));
  await new Promise(res=>{
    const im=new Image();
    im.onload=()=>{
      cx.globalAlpha=ROOM.opa;
      const ps=ROOM.size*SC, px=ROOM.x*SC, py=ROOM.y*SC;
      cx.save();
      cx.translate(px+ps/2,py+ps/2);
      cx.rotate(ROOM.roll*Math.PI/180);
      cx.drawImage(im,-ps/2,-ps/2,ps,ps);
      cx.restore();
      cx.globalAlpha=1; URL.revokeObjectURL(url); res();
    };
    im.onerror=()=>{ URL.revokeObjectURL(url); res(); };
    im.src=url;
  });
  await roomShare(cv);
}
$("roomExport").addEventListener("click",async()=>{
  if(!proGate("jpg")) return;
  if(ROOM.live){ await roomExportLive(); return; }
  const img=$("roomImg");
  if(!ROOM.hasImg||!img.naturalWidth){ toast(t("roomEmpty")); return; }
  const stage=$("roomStage").getBoundingClientRect();
  // rettangolo effettivo dell'immagine (object-fit: contain)
  const rIm=img.naturalWidth/img.naturalHeight, rSt=stage.width/stage.height;
  let dw,dh,dx,dy;
  if(rIm>rSt){ dw=stage.width; dh=dw/rIm; dx=0; dy=(stage.height-dh)/2; }
  else{ dh=stage.height; dw=dh*rIm; dy=0; dx=(stage.width-dw)/2; }
  const k=img.naturalWidth/dw;
  const cv=document.createElement("canvas");
  cv.width=img.naturalWidth; cv.height=img.naturalHeight;
  const cx=cv.getContext("2d");
  cx.drawImage(img,0,0);
  const svg=$("svgRoom").cloneNode(true);
  svg.removeAttribute("style");
  const EXP=1600;
  svg.setAttribute("width",EXP); svg.setAttribute("height",EXP);
  svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const ser=new XMLSerializer().serializeToString(svg);
  const blob=new Blob([ser],{type:"image/svg+xml;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  await new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{ cx.globalAlpha=ROOM.opa;
      const px=(ROOM.x-dx)*k, py=(ROOM.y-dy)*k, ps=ROOM.size*k;
      cx.save();
      cx.translate(px+ps/2,py+ps/2);
      cx.rotate(ROOM.roll*Math.PI/180);
      cx.drawImage(im,-ps/2,-ps/2,ps,ps);
      cx.restore();
      cx.globalAlpha=1; URL.revokeObjectURL(url); res(); };
    im.onerror=rej; im.src=url;
  }).catch(()=>{});
  const jpg=cv.toDataURL("image/jpeg",0.9);
  const p=proj();
  const fname=`Ambiente_${slug((p&&p.name)||buildCfg.name||"mobile")}.jpg`;
  try{
    const rb=await (await fetch(jpg)).blob();
    const file=new File([rb],fname,{type:"image/jpeg"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:fname}); return; }
  }catch(e){}
  const a=document.createElement("a"); a.href=jpg; a.download=fname; a.click();
  toast("JPG ✓");
});

