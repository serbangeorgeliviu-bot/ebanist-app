const {chromium}=require("/opt/node22/lib/node_modules/playwright");const fs=require("fs");
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--no-sandbox"]});
const p=await b.newPage({viewport:{width:1680,height:1188},deviceScaleFactor:1.5});
for(let i=0;i<8;i++){const svg=fs.readFileSync(`raw/sheet-${i}.svg`,"utf8").replace(/width="420mm" height="297mm"/,'width="1680" height="1188"');
 await p.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);await p.waitForTimeout(300);await p.screenshot({path:`raw/sheet-${i}.png`});}
await b.close()})();
