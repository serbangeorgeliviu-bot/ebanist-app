const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const fs=require("fs"),path=require("path");
const RAW="file://"+path.resolve("raw")+"/", FONTS="file:///home/user/ebanist-app/fonts/";
const FMT=process.argv[2]||"ig"; const W=1080,H=1350,SH=FMT==="tt"?1920:1350,OY=FMT==="tt"?285:0, N=7;
const GOLD="#f2b82e";
const css=`
@font-face{font-family:BC;font-weight:700;src:url(${FONTS}barlow-condensed-latin-700-normal.woff2)}
@font-face{font-family:BC;font-weight:600;src:url(${FONTS}barlow-condensed-latin-600-normal.woff2)}
@font-face{font-family:B;font-weight:500;src:url(${FONTS}barlow-latin-500-normal.woff2)}
@font-face{font-family:B;font-weight:600;src:url(${FONTS}barlow-latin-600-normal.woff2)}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W*N}px;height:${SH}px;background:#06120d;overflow:hidden;font-family:B;color:#fff;position:relative}
#bg{position:absolute;inset:0;background:
 radial-gradient(900px 700px at 8% 18%,rgba(30,120,80,.55),transparent 70%),
 radial-gradient(1000px 800px at 22% 95%,rgba(242,184,46,.16),transparent 70%),
 radial-gradient(900px 700px at 42% 10%,rgba(30,120,80,.45),transparent 70%),
 radial-gradient(1000px 800px at 58% 100%,rgba(30,120,80,.5),transparent 70%),
 radial-gradient(900px 700px at 75% 8%,rgba(242,184,46,.14),transparent 70%),
 radial-gradient(1100px 800px at 92% 90%,rgba(30,120,80,.55),transparent 70%),
 linear-gradient(180deg,#0a2a1d,#06120d 70%)}
#grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px;
 -webkit-mask-image:linear-gradient(180deg,transparent,#000 30%,#000 80%,transparent)}
#c{position:absolute;left:0;top:${OY}px;width:${W*N}px;height:${H}px}
.abs{position:absolute}
.k{font:600 25px/1 B;letter-spacing:.22em;text-transform:uppercase;color:${GOLD}}
.h{font:700 132px/.88 BC;text-transform:uppercase;letter-spacing:-.005em}
.h.s{font-size:112px}
.g{color:${GOLD}}
.sub{font:500 33px/1.32 B;color:rgba(255,255,255,.82)}
.chip{z-index:20;position:absolute;display:flex;align-items:center;gap:12px;padding:15px 24px;border-radius:60px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.28);backdrop-filter:blur(10px);font:600 26px/1 B;white-space:nowrap;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.chip i{width:12px;height:12px;border-radius:50%;background:${GOLD};box-shadow:0 0 14px ${GOLD}}
.chip.gold{background:${GOLD};color:#0a2a1d;border-color:${GOLD}}
.dev{position:absolute;filter:drop-shadow(0 40px 50px rgba(0,0,0,.55)) drop-shadow(0 8px 14px rgba(0,0,0,.4))}
.dev .scr{position:relative;overflow:hidden;background:#fff}
.dev .scr img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
.phone{background:linear-gradient(145deg,#2c2f2e,#0b0c0c 40%,#1d1f1e);border-radius:15% / 7%;padding:3.6%}
.phone .scr{border-radius:12.5% / 5.8%;aspect-ratio:390/844}
.phone:after{content:"";position:absolute;left:50%;top:2.6%;width:26%;height:2.1%;transform:translateX(-50%);background:#050606;border-radius:30px}
.tab{background:linear-gradient(145deg,#33373a,#0b0c0c 45%,#202324);border-radius:34px;padding:2.6%}
.tab .scr{border-radius:14px;aspect-ratio:4/3}
.mon{background:linear-gradient(180deg,#26292b,#0b0c0c);border-radius:22px;padding:1.3% 1.3% 2.4%}
.mon .scr{border-radius:8px;aspect-ratio:16/10}
.stand{position:absolute;left:50%;bottom:-0px;transform:translate(-50%,100%);width:15%;height:46px;background:linear-gradient(90deg,#1b1d1e,#4a4f52 50%,#1b1d1e);clip-path:polygon(18% 0,82% 0,100% 100%,0 100%)}
.base{position:absolute;left:50%;bottom:-46px;transform:translate(-50%,100%);width:30%;height:14px;border-radius:10px;background:linear-gradient(180deg,#5a5f62,#16181a)}
.gl:before{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.16) 0%,transparent 28%,transparent 70%,rgba(255,255,255,.05) 100%)}
.card{position:absolute;border-radius:44px;overflow:hidden;background:linear-gradient(180deg,#f3f5f1,#dfe5de);box-shadow:0 50px 90px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.12)}
.card img{position:absolute}
.ring{position:absolute;border-radius:50%;border:6px solid ${GOLD};box-shadow:0 0 0 8px rgba(242,184,46,.25),0 30px 60px rgba(0,0,0,.5);overflow:hidden;background:#dfe5de}
.ring img{position:absolute}
.num{position:absolute;font:700 520px/1 BC;color:rgba(255,255,255,.035);letter-spacing:-.02em}
.tick{position:absolute;bottom:56px;font:600 22px/1 B;letter-spacing:.22em;color:rgba(255,255,255,.55)}
.stat{font:700 250px/.8 BC;color:${GOLD};letter-spacing:-.02em}
.swipe{position:absolute;right:56px;bottom:46px;font:700 26px/1 B;letter-spacing:.2em;color:${GOLD};display:flex;align-items:center;gap:14px}
.brand{position:absolute;left:56px;top:56px;display:flex;align-items:center;gap:14px;font:700 34px/1 BC;letter-spacing:.2em}
.brand b{width:44px;height:44px;border-radius:12px;background:#0e3b2a;border:2px solid ${GOLD};display:grid;place-items:center;color:${GOLD};font:700 28px BC;letter-spacing:0}
.pin{position:absolute;display:flex;align-items:center;gap:0;font:600 24px/1.15 B}
.pin span{background:#0a2a1d;color:#fff;border:2px solid ${GOLD};border-radius:14px;padding:12px 16px;box-shadow:0 14px 30px rgba(0,0,0,.4)}
.pin small{display:block;font:500 19px/1.2 B;color:rgba(255,255,255,.7);margin-top:3px}
.dot{width:20px;height:20px;border-radius:50%;background:${GOLD};box-shadow:0 0 0 7px rgba(242,184,46,.3);flex:none}
.ln{height:3px;background:${GOLD};flex:none}
`;
const px=n=>n+"px";
function dev(type,src,x,y,w,o={}){ // x,y in slide coords; slide index added by caller via ox
  const inner = `<div class="scr gl"><img src="${src}" style="${o.img||''}"></div>`;
  let extra = type==="mon"?'<div class="stand"></div><div class="base"></div>':'';
  return `<div class="dev ${type}" style="left:${x}px;top:${y}px;width:${w}px;transform:rotate(${o.rot||0}deg);z-index:${o.z||5}">${inner}${extra}</div>`;
}
const S=(i,html)=>`<div class="abs" style="left:${i*W}px;top:0;width:${W}px;height:${H}px">${html}</div>`;
const ticks=i=>`<div class="tick" style="left:56px">0${i+1} / 07</div>`;
const brand=`<div class="brand"><b>E</b>EBANIST</div>`;
const swipe=`<div class="swipe">SWIPE <span style="font-size:40px">→</span></div>`;
const pin=(x,y,t,s,dir="r",len=70)=>`<div class="pin" style="left:${x}px;top:${y}px;${dir==="l"?"flex-direction:row-reverse":""}"><div class="dot"></div><div class="ln" style="width:${len}px"></div><span>${t}${s?`<small>${s}</small>`:""}</span></div>`;

let html="";
/* 1 */
html+=S(0,`${brand}
<div class="abs k" style="left:56px;top:170px">The furniture studio in your pocket</div>
<div class="abs h" style="left:50px;top:218px;font-size:150px">DESIGN IT.<br>CUT IT.<br><span class="g">BUILD IT.</span></div>
<div class="abs sub" style="left:56px;top:670px;width:700px">One app. Phone on site, tablet with the client, desktop in the workshop.</div>
${dev("mon",RAW+"desktop-explode.png",20,790,640,{rot:0,z:4})}
${dev("phone",RAW+"phone-explode.png",700,760,236,{rot:-3,z:6})}
${dev("tab",RAW+"tablet-client.png",890,950,430,{rot:-6,z:7})}
<div class="swipe" style="top:62px;bottom:auto">SWIPE <span style="font-size:40px">→</span></div>`);
/* 2 */
html+=S(1,`${ticks(1)}
<div class="abs k" style="left:250px;top:70px">Parametric 3D</div>
<div class="abs h s" style="left:250px;top:112px;width:800px">See every part<br>before you <span class="g">cut.</span></div>
<div class="card" style="left:250px;top:445px;width:780px;height:790px"><img src="${RAW}3d-explode.png" style="left:-60px;top:-30px;width:900px;height:1000px;object-fit:cover"></div>
${pin(60,560,"29 panels","each with its own ID","r",0).replace("left:60px","left:-2000px")}
<div class="chip gold" style="left:285px;top:478px">29 PARTS</div>
<div class="chip" style="left:520px;top:478px;background:#0a2a1d;border-color:#0a2a1d"><i></i>50 hardware items</div>
${pin(270,1140,"Blum CLIP top BLUMOTION","hinges counted &amp; placed","r",36)}
<div class="chip" style="left:256px;top:1260px;display:none"></div>`);
/* 3 */
html+=S(2,`${ticks(2)}
<div class="abs k" style="left:56px;top:70px">Real hardware, real motion</div>
<div class="abs h s" style="left:56px;top:112px;width:900px">Doors open.<br>Drawers glide.<br><span class="g">Hinges to the millimetre.</span></div>
<div class="card" style="left:56px;top:560px;width:640px;height:700px"><img src="${RAW}3d-open-hw.png" style="left:-120px;top:-60px;width:880px;height:978px;object-fit:cover"></div>
<div class="ring" style="left:520px;top:640px;width:500px;height:500px"><img src="${RAW}3d-open-hw.png" style="left:-833px;top:-917px;width:1500px;height:1667px;object-fit:cover"></div>
<div class="chip gold" style="left:570px;top:1156px">BLUM · HÄFELE · EGGER</div>
<div class="chip" style="left:520px;top:1226px"><i></i>Runners, dowels, cams — modelled</div>`);
/* 4 */
html+=S(3,`${ticks(3)}
<div class="abs k" style="left:56px;top:70px">Workshop-ready precision</div>
<div class="abs h s" style="left:56px;top:112px;width:900px">Every hole.<br>Every dimension.</div>
<div class="abs stat" style="left:50px;top:420px">0.1<span style="font-size:110px;margin-left:12px">mm</span></div>
<div class="abs sub" style="left:56px;top:640px;width:430px">Edge to hole axis, on every panel. Straight to the shop floor.</div>
${dev("mon",RAW+"sheet-5.png",330,800,760,{rot:0,z:3,img:"object-position:0 0;width:178%;height:178%;object-fit:fill;left:-4%;top:-3%"})}
<div class="chip gold" style="left:56px;top:880px">DRILLING SHEETS</div>
<div class="chip" style="left:56px;top:956px"><i></i>Hinge cups</div>
<div class="chip" style="left:56px;top:1032px"><i></i>Cams &amp; dowels</div>
<div class="chip" style="left:56px;top:1108px"><i></i>Edge banding</div>`);
/* 5 */
html+=S(4,`${ticks(4)}
<div class="abs k" style="left:56px;top:70px">A3 technical dossier</div>
<div class="abs h s" style="left:56px;top:112px;width:960px">Assembly manuals<br>that <span class="g">write themselves.</span></div>
<div class="dev" style="left:60px;top:480px;width:520px;transform:rotate(-7deg);z-index:2"><div class="scr" style="aspect-ratio:420/297;border-radius:6px"><img src="${RAW}sheet-0.png"></div></div>
${dev("tab",RAW+"sheet-2.png",250,560,740,{rot:3,z:5,img:"object-fit:fill"}).replace('aspect-ratio:4/3','')}
<div class="chip gold" style="left:56px;top:1210px">ONE TAP · ONE PDF</div>
<div class="chip" style="left:400px;top:1210px"><i></i>Exploded view</div>
<div class="chip" style="left:660px;top:1210px"><i></i>Numbered steps</div>`);
/* 6 */
html+=S(5,`${ticks(5)}
<div class="abs k" style="left:56px;top:70px">Client mode</div>
<div class="abs h s" style="left:56px;top:112px;width:960px">Close the deal<br><span class="g">on the spot.</span></div>
<div class="abs sub" style="left:56px;top:350px;width:620px">Client picks the finish. Price updates live. They sign on screen.</div>
${dev("tab",RAW+"tablet-client.png",40,540,740,{rot:-2,z:4})}
${dev("phone",RAW+"phone-summary.png",800,600,250,{rot:4,z:6})}
<div class="chip gold" style="left:70px;top:1190px">€ 1,371.71 · VAT INCLUDED</div>
<div class="chip" style="left:470px;top:1190px"><i></i>Accept &amp; sign</div>`);
/* 7 */
html+=S(6,`${brand}
<div class="abs k" style="left:56px;top:170px">Free to start · Pro when you scale</div>
<div class="abs h" style="left:50px;top:218px;font-size:150px">BUILD LIKE<br>THE FACTORY.<br><span class="g">START FREE.</span></div>
<div class="abs" style="left:56px;top:700px;display:flex;gap:14px;flex-wrap:wrap;width:960px">
 ${["19 parametric types","Cut lists","Cutting plans","Labels","Quotes","3D &amp; AR"].map(t=>`<div class="chip" style="position:static"><i></i>${t}</div>`).join("")}</div>
${dev("mon",RAW+"desktop-explode.png",30,850,470,{z:3})}
${dev("tab",RAW+"tablet-explode.png",440,900,330,{rot:-4,z:4})}
${dev("phone",RAW+"phone-explode.png",810,830,190,{rot:3,z:5})}
<div class="chip gold" style="left:56px;top:1236px;font-size:28px;padding:18px 30px">GET IT ON GOOGLE PLAY</div>
<div class="chip" style="left:470px;top:1236px;font-size:28px;padding:18px 30px">ebanist.com</div>`);
/* ghost numerals + seam line */
let deco="";for(let i=0;i<N;i++)deco+=`<div class="num" style="left:${i*W+560}px;top:${OY+20}px;display:${i==0||i==6?"none":"block"}">${i+1}</div>`;
const line=`<div class="abs" style="left:0;top:${OY+H-18}px;width:${W*N}px;height:3px;background:linear-gradient(90deg,transparent,${GOLD} 6%,${GOLD} 94%,transparent);opacity:.55"></div>`;
const page=`<!doctype html><meta charset=utf-8><style>${css}</style><body><div id=bg></div><div id=grid></div>${deco}${line}<div id=c>${html}</div>
${FMT==="tt"?`<div class="abs" style="left:0;top:0;width:${W*N}px;height:${OY}px"></div>`:""}</body>`;
fs.writeFileSync(`compose-${FMT}.html`,page);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--no-sandbox","--allow-file-access-from-files"]});
 const p=await b.newPage({viewport:{width:W*N,height:SH}});
 await p.goto("file://"+path.resolve(`compose-${FMT}.html`));await p.waitForTimeout(2500);
 fs.mkdirSync(`out-${FMT}`,{recursive:true});
 for(let i=0;i<N;i++) await p.screenshot({path:`out-${FMT}/ebanist-${FMT}-${i+1}.png`,clip:{x:i*W,y:0,width:W,height:SH}});
 await b.close();})();
