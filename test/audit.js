/* Audit complet: toate tipologiile × limbi × telefon/tabletă/PC. Caută erori JS,
   „undefined”/„NaN”, conținut ieșit din ecran, documente goale sau blocate.
   Rulare: cd test && DOCS=1 node audit.js   (server local pe :8765, din rădăcina repo-ului).
   Notă: pe telefon/tabletă, „mesaj piese greșit” la tondo/ovale/raccordato/scrivania
   e fals: panoul de piese e închis și textul lui nu e vizibil. */
const { chromium } = require("playwright");
const VP = { phone:{width:412,height:915,isMobile:true,hasTouch:true}, tablet:{width:1024,height:1366,hasTouch:true}, desktop:{width:1440,height:900} };
const LANGS = (process.env.LANGS || "it,ro,en,fr").split(",");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const report = [];
  for (const [vn, v] of Object.entries(VP)) for (const L of LANGS) {
    const ctx = await b.newContext({ viewport: { width: v.width, height: v.height }, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch });
    await ctx.addInitScript(() => { try { localStorage.setItem("ebanist_lic", JSON.stringify({ kind:"legacy", key:"EBP-TEST", valid:true, activated:true, checkedAt:Date.now() })); } catch(e){} });
    const pg = await ctx.newPage();
    const errs = []; pg.on("pageerror", e => errs.push(String(e).slice(0,200)));
    pg.on("console", m => { if (m.type()==="error" && !/ERR_CERT|net::|Failed to load resource/.test(m.text())) errs.push("console: "+m.text().slice(0,200)); });
    await pg.goto("http://127.0.0.1:8765/app/index.html");
    await pg.waitForFunction(() => window.MAT_LOADED === true, null, { timeout: 30000 });
    await pg.waitForTimeout(3000);
    const r = await pg.evaluate(async ([L, DOCS]) => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      const issues = [];
      const BAD = /\bundefined\b|\bNaN\b|\[object |\{[a-zA-Z]{1,12}\}|Infinity/;
      const scan = (where, root) => {
        root = root || document.body;
        const txt = root.innerText || "";
        const m = txt.match(BAD); if (m) { const i = txt.indexOf(m[0]); issues.push(where + ": «" + txt.slice(Math.max(0,i-50), i+40).replace(/\s+/g," ") + "»"); }
        const sw = document.documentElement.scrollWidth, iw = innerWidth;
        if (sw > iw + 2) {
          const wide = [...document.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(); return r.width>0 && r.right > iw + 2 && getComputedStyle(e).position !== "fixed" && !e.closest(".sheet") && !e.closest("[style*='overflow']") && !e.closest(".card-tbl") && !e.closest(".tbl-wrap") && !e.closest(".typestrip"); }).slice(0,3).map(e => (e.id||e.className||e.tagName)+":"+Math.round(e.getBoundingClientRect().right));
          if (wide.length) issues.push(where + ": overflow " + sw + ">" + iw + " " + wide.join(","));
        }
      };
      window.print = () => {}; 
      state.lang = L; state.langChosen = 1; applyLang(); closeSheets();
      const confirmClosure = async () => { const sh = $("shClosure"); if (sh && sh.classList.contains("on")) { const ck = $("clOk"); if (ck.disabled) { issues.push("closure blocat: " + (document.getElementById("clBody")||sh).innerText.slice(0,160).replace(/\s+/g," ")); closeSheets(); return; } ck.checked = true; ck.dispatchEvent(new Event("change")); $("btnClGo").click(); await w(250);} };
      for (const k of Object.keys(PRESETS)) {
        try {
          const p = proj(); p.pieces = []; p.configs = {}; p.geomVersion = GEOM_VERSION;
          generateInto(p, { ...PRESETS[k], name: "T-" + k });
          persist();
          for (const vw of ["projects","list","nest","summary","survey"]) { closeSheets(); setView(vw); await w(60); scan(k + "/" + vw); }
          closeSheets(); setView("build"); buildCfg = { ...PRESETS[k], name: "T-" + k }; syncBuildForm(); drawPreview(); await w(250); scan(k + "/build");
          if (gl3dOn()) {
            for (const st of [{open:true},{mode:"hw"},{holes:true,mode:"real",open:false},{explode:true}]) { GL3D.set(st); studioSync(); await w(80); }
            GL3D.set({open:false,holes:false,mode:"real",explode:false});
            const M = GL3D.model();
            if (M && M.ops && M.ops.pieces.length) { const pc = M.ops.pieces.slice().sort((a,b)=>nDrill(b)-nDrill(a))[0]; GL3D.select(pc.pk, true); await w(60); scan(k + "/sel"); openPartSheet(M, pc); await w(80); scan(k + "/partsheet", $("shPart")); closeSheets(); GL3D.select(null); }
            else if (CASSA_TYPES.indexOf(PRESETS[k].type||"standard")>=0) issues.push(k + ": 3D fără piese/ops"); else if (!/încă|ancora|yet|encore/.test($("pcsList").innerText)) issues.push(k + ": mesaj piese greșit");
          }
          if (DOCS) {
            for (const btn of ["btnPdf","btnQuote","btnMont","btnLabels","btnOrder","btnDraw"]) {
              $("printArea").innerHTML = ""; closeSheets();
              if (btn === "btnDraw") setView("build"); else setView("list");
              const el = $(btn); if (!el) { issues.push("lipsă buton " + btn); continue; }
              el.click(); await w(200); await confirmClosure(); await w(100);
              const pa = $("printArea");
              if (!pa.innerHTML.trim()) { issues.push(k + "/" + btn + ": document gol"); continue; }
              const t = pa.innerText; const m = t.match(BAD);
              if (m) { const i = t.indexOf(m[0]); issues.push(k + "/" + btn + ": «" + t.slice(Math.max(0,i-60), i+40).replace(/\s+/g," ") + "»"); }
            }
            closeSheets(); clientOpen(); await w(250); scan(k + "/client", $("clientMode")); try { clientClose(); } catch (e) { issues.push("clientClose: " + e); }
          }
        } catch (e) { issues.push(k + ": EXC " + String(e && e.stack || e).slice(0,200)); }
      }
      // foile
      for (const id of ["btnSettings","btnAccount","btnCatalog","btnStats","btnLang","btnGoPro","btnCuts","btnStock","btnNewProject"]) {
        const el = $(id); if (!el) continue; closeSheets(); try { el.click(); await w(150); const on = document.querySelector(".sheet.on"); scan("sheet " + id, on || document.body); } catch (e) { issues.push("sheet " + id + ": " + e); }
      }
      closeSheets();
      return issues;
    }, [L, !!process.env.DOCS]);
    report.push({ vn, L, issues: r, errs: [...new Set(errs)] });
    await ctx.close();
    console.log(`== ${vn}/${L}: ${r.length} probleme, ${new Set(errs).size} erori JS`);
    [...new Set(r)].slice(0, 25).forEach(x => console.log("   - " + x));
    [...new Set(errs)].slice(0, 10).forEach(x => console.log("   ! " + x));
  }
  await b.close();
})();
