/* Ebanist — proiecte demo (FAZA T): bibliotecă care rulează ÎN pagina aplicației (nu în Node).
 * Un proiect demo se construiește numai pe căile aplicației: generateInto (corpuri), wtApply (blat), EBKitchenUI.apply (bucătăria),
 * layout() (poziția în cameră). Nicio piesă nu e scrisă de mână.
 *   window.SC.build(spec)      → proiectul (adăugat la state.projects, activ) + raportul construirii
 *   window.SC.check(p)         → controalele aplicației pe proiect: audit, ops, distinctă, deviz, foi A4, montaj, cameră → obiect cu numere și abateri
 * Folosit de tools/showcase-build.cjs (generează app/demo/*.json) și de blocul e2e din test/run.js.
 */
(function () {
  "use strict";
  const w = ms => new Promise(r => setTimeout(r, ms));
  const SC = {};

  function newProject(name, survey) {
    const p = { id: uid(), name, client: "Demo", date: "2026-11-19", pieces: [], configs: {}, layout: {}, geomVersion: GEOM_VERSION };
    if (survey) p.survey = JSON.parse(JSON.stringify(survey));
    state.projects.unshift(p); state.activeId = p.id;
    return p;
  }

  /* spec = { name, survey, settings:{matBody,matFront,matBack}, defaults:{…cfg}, bodies:[{cfg, at:{wall,from,off,lift,rot}}],
              worktops:[{name,mods,mat,ovF,ovS,joint,…}], kitchen:{K,walls,corners,wtMat,wtJoint} } */
  SC.build = async function (spec) {
    closeSheets();
    const p = newProject(spec.name, spec.survey);
    Object.assign(state.settings, spec.settings || {});
    if (spec.floorTone != null) p.floorTone = spec.floorTone;
    const rep = { bodies: [], errors: [] };
    if (spec.kitchen) {
      const k = EBKitchenUI.kit(p);
      Object.assign(k.K, spec.kitchen.K || {});
      if (spec.kitchen.wtMat) k.wtMat = spec.kitchen.wtMat;
      if (spec.kitchen.wtJoint) k.wtJoint = spec.kitchen.wtJoint;
      k.walls = JSON.parse(JSON.stringify(spec.kitchen.walls));
      k.corners = (spec.kitchen.corners || []).slice();
      for (const id of Object.keys(k.walls)) k.walls[id].cols.forEach(c => { if (!c.id) c.id = uid(); });
      const ok = EBKitchenUI.apply(p);
      if (!ok) rep.errors.push("kitchen: " + (EBKitchenUI.kit(p).err || []).join(" | "));
      /* culoarea ușilor pe module: după apply, pe cfg, regenerat prin aceeași cale */
      for (const [pat, ov] of (spec.kitchen.recolor || [])) {
        const re = new RegExp(pat);
        for (const name of Object.keys(p.configs)) if (re.test(name)) generateInto(p, Object.assign({}, JSON.parse(JSON.stringify(p.configs[name])), ov));
      }
    }
    for (const b of spec.bodies || []) {
      const cfg = Object.assign({}, spec.defaults || {}, b.cfg);
      try { generateInto(p, cfg); layout()[cfg.name] = Object.assign({ wall: "w1", from: 0, off: 0, lift: 0, rot: 0 }, b.at || {}); rep.bodies.push(cfg.name); }
      catch (e) { rep.errors.push(cfg.name + ": " + String(e && e.message || e)); }
    }
    for (const wt of spec.worktops || []) {
      p.worktops = p.worktops || [];
      const o = Object.assign({ id: "wt" + uid(), ovF: WORKTOP_DEFAULTS.ov_front, ovS: 0, through: [], cutouts: [], names: [], sig: null }, JSON.parse(JSON.stringify(wt)));
      p.worktops.push(o);
      if (!wtApply(p, o)) rep.errors.push("worktop " + o.name + ": " + (o.err || []).join(" | "));
    }
    rep.fixes = SC.autoFix(p);
    persist();
    rep.pieces = p.pieces.length;
    return rep;
  };

  /* un raft care lovește o balama (H-SHELF) se mută la cota cea mai apropiată, exact ca în foaia „Mută raftul” a aplicației (shelfFixOptions / shelfFixCfg → generateInto);
     fiecare corectură se raportează, nu se ascunde */
  SC.autoFix = function (p) {
    const done = [];
    for (const name of Object.keys(p.configs)) {
      for (let k = 0; k < 6; k++) {
        const cfg = p.configs[name];
        const pieces = p.pieces.filter(x => x.gen === name || x.modulo === name || x.modulo === name + " A" || x.modulo === name + " B");
        const fx = auditModule(cfg, pieces).find(a => a.shelfFix); if (!fx) break;
        const sf = fx.shelfFix, opts = shelfFixOptions(cfg, sf);
        let nc = null;
        if (opts.length) { const o = opts.slice().sort((a, b) => Math.abs(a.y - sf.y) - Math.abs(b.y - sf.y))[0]; nc = shelfFixCfg(cfg, sf, o.y); if (nc) done.push(name + ": raft " + sf.y + " → " + o.y); }
        else { nc = shelvesAbsCfg(cfg); if (nc) done.push(name + ": rafturi la cote absolute"); }
        if (!nc) break;
        generateInto(p, Object.assign({}, nc, { name }));
      }
    }
    return done;
  };

  /* poligon convex și SAT: ca în audit-kitchen.cjs */
  SC.check = async function (p, opt) {
    opt = opt || {};
    const bad = [], info = {}; const B = (who, what) => bad.push(who + ": " + what);
    const clean = (who, txt) => { txt = String(txt).replace(/data:[a-z\/+-]+;base64,[A-Za-z0-9+\/=]+/g, "").replace(/[A-Za-z0-9+\/=]{60,}/g, ""); if (/undefined|NaN|\[object|Infinity/.test(txt)) B(who, "text prost «" + (txt.match(/.{0,25}(undefined|NaN|\[object|Infinity).{0,25}/) || [""])[0] + "»"); };
    state.activeId = p.id;
    const names = Object.keys(p.configs);
    info.bodies = names.length; info.pieces = p.pieces.length;
    info.panelPieces = (typeof panelTotals === "function") ? panelTotals(p.pieces).pcs : null;
    /* 1. controalele de coerență */
    const au = auditProject(p); const blk = blocking(au);
    info.auditBlocking = blk.length; info.auditWarn = au.length - blk.length;
    blk.forEach(a => B(a.modulo || "?", "audit blocant " + a.id));
    const wc = {}; au.filter(a => !blk.includes(a)).forEach(a => { wc[a.id] = (wc[a.id] || 0) + 1; }); info.auditWarnIds = wc;
    try { if (typeof matDrift === "function") { const d = matDrift(p); if (d.block.length) B("proiect", "matDrift blocant " + d.block.length); } } catch (e) { B("proiect", "matDrift: " + String(e).slice(0, 80)); }
    try { if (typeof exportAllowed === "function") info.exportAllowed = !!exportAllowed(); } catch (e) {}
    /* 2. ops + foi A4 + montaj */
    let sheets = 0, holes = 0, hwRows = 0; const opsWarn = {}; const hwTypes = {};
    try {
      for (const [name, M] of asmModules(p)) {
        for (const pc of M.ops.pieces) {
          holes += pc.operations.length;
          const has6 = pc.operations.some(o => o.face === 6);
          for (const face of (has6 ? [5, 6] : [5])) { sheets++; let svg; try { svg = partSheetSvg(M, pc, face, 1, 1); } catch (e) { B(name + "/" + pc.role, "fișă: " + String(e).slice(0, 80)); continue; }
            const doc = new DOMParser().parseFromString(svg, "image/svg+xml"); if (doc.querySelector("parsererror")) { B(name + "/" + pc.role, "fișă SVG prost"); continue; }
            clean(name + "/" + pc.role, [...doc.querySelectorAll("text")].map(t => t.textContent).join("|")); }
        }
        (M.ops.hw || []).forEach(h => { hwTypes[h.type] = (hwTypes[h.type] || 0) + 1; });
        (M.ops.warnings || []).forEach(x => { const k = x.k || x.id || x.code || String(x).slice(0, 30); opsWarn[k] = (opsWarn[k] || 0) + 1; });
      }
    } catch (e) { B("ops", String(e).slice(0, 120)); }
    info.sheets = sheets; info.operations = holes; info.hwTypes = hwTypes; info.opsWarn = opsWarn;
    /* avertismentele generatorului (limite ale mecanismelor, uși glisante, unități de colț, deschidere, sertare): se numără pe familie și tip; `range` = o limită depășită → se repară în proiect */
    const bw = {}, ranges = [];
    for (const name of names) {
      let m; try { m = buildModule(p.configs[name]); } catch (e) { B(name, "buildModule: " + String(e).slice(0, 80)); continue; }
      const W = m.warn || {};
      for (const key of Object.keys(W)) {
        const v = W[key];
        if (Array.isArray(v)) v.forEach(x => { const k = key + ":" + (x.k || "?"); bw[k] = (bw[k] || 0) + 1; if (x.k === "range") ranges.push(name + " " + key + " " + JSON.stringify(x)); });
        else if (v && typeof v === "object") { const k = key; bw[k] = (bw[k] || 0) + 1; }
        else if (v) { bw[key] = (bw[key] || 0) + 1; }
      }
    }
    info.buildWarn = bw; info.buildRanges = ranges;
    /* 3. distinctă, CSV, feronerie, deviz, montaj */
    try { const rows = cutRows(p); info.cutRows = rows.length; clean("distinctă", JSON.stringify(rows)); const csv = buildCsv(p); clean("CSV", csv); info.csvLines = csv.split("\n").length;
      info.cutSig = rows.map(r => [r.modulo, r.elemento, r.lung, r.larg, r.pz, r.materiale].join("|")); } catch (e) { B("distinctă", String(e).slice(0, 120)); }
    try { const hw = computeHardware(p); clean("feronerie", JSON.stringify(hw.map(h => [h.k, h.qty, h.tot]))); info.hwLines = hw.length; info.hwQty = hw.reduce((s, h) => s + (+h.qty || 0), 0);
      info.hwFree = hw.filter(h => !(+h.tot > 0) && +h.qty > 0).length;
      const pc = projectCosts(p); info.netto = Math.round(pc.netto * 100) / 100; if (!isFinite(pc.netto)) B("deviz", "nu e număr"); } catch (e) { B("feronerie/deviz", String(e).slice(0, 120)); }
    try { const m = montDoc(p); clean("montaj", String(m).slice(0, 300000)); info.montLen = String(m).length; } catch (e) { B("foaia de montaj", String(e).slice(0, 120)); }
    /* 4. camera: ciocniri */
    try { const RL = roomLayout(); if (RL) { info.roomMods = RL.mods.length; info.roomIssues = RL.issues.map(i => i.t + ":" + i.a + (i.b ? "/" + i.b : "")); } } catch (e) { B("cameră", String(e).slice(0, 120)); }
    info.bad = bad; return info;
  };
  window.SC = SC;
})();
