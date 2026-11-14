/* =====================================================================
   Ebanist — Bucătărie: ecranul (D-142)
   ---------------------------------------------------------------------
   Se încarcă DUPĂ scriptul principal: folosește funcțiile lui (`proj`, `persist`,
   `generateInto`, `layout`, `wtApply`…) și motorul pur din `ebanist-kitchen.js`.
   Aici nu se calculează nicio cotă: ecranul adună alegerile (coloane pe pereți,
   aparate, setări), le dă motorului, apoi scrie în proiect module obișnuite —
   același lucru ca atunci când ai genera corpul din „Genera” și l-ai așeza în
   Releveu. Nimic nu se recalculează singur (ca blatul, D-73): dacă alegerile se
   schimbă, bucătăria spune „nu mai corespunde” și așteaptă „Calculează”.

   p.kitchen = { v, K:{workH,bodyH,wallBottom,wallH,tallH,depthBase,depthWall,handles,topT},
                 walls:{ [idPerete]: { cols:[{id,type,w,opts,up:{type,opts}|null}] } },
                 corners:[{through}], wtMat, wtJoint, names:[], sig }
   ===================================================================== */
(function () {
"use strict";

var KDEF = { workH: 900, bodyH: 720, wallBottom: 1450, wallH: 720, tallH: 2150, depthBase: 560, depthWall: 320, handles: "maniglia", topT: 38 };
var CATS = ["base", "niche", "corner", "tall", "wall", "fill"];
var CAT_OF = { n_dw: "niche", n_washer: "niche", n_cool: "niche", n_range: "niche", x_filler: "fill", x_end: "fill", x_gap: "fill" };
var sel = { wall: 0, col: 0, up: false };
var addOpen = false;

function kt(k, v) {
  var T = (window.KITCHEN_I18N || {});
  var s = (T[state.lang] || {})[k];
  if (s == null) s = (T.en || {})[k];
  if (s == null) s = k;
  if (v) for (var x in v) s = s.split("{" + x + "}").join(v[x]);
  return s;
}
function E(s) { return esc(String(s)); }
function uidk() { return (typeof uid === "function") ? uid() : Math.random().toString(36).slice(2, 10); }
function unitCat(id) { return CAT_OF[id] || (KITCHEN_UNITS[id] && KITCHEN_UNITS[id].cat) || "base"; }

/* ---------- starea ---------- */
function kit(p) {
  if (!p.kitchen) p.kitchen = { v: 1, K: Object.assign({}, KDEF), walls: {}, corners: [], wtMat: null, wtJoint: "butt", names: [], sig: null };
  var k = p.kitchen; k.K = Object.assign({}, KDEF, k.K || {}); k.walls = k.walls || {}; k.corners = k.corners || []; k.names = k.names || [];
  return k;
}
function surveyWalls(p) { return (p.survey && p.survey.walls) || []; }
function wallCols(k, id) { if (!k.walls[id]) k.walls[id] = { cols: [] }; return k.walls[id].cols; }
function bodyT() {
  var S = state.settings || {}, m = S.matBody ? matById(S.matBody) : null;
  return m && +m.th > 0 ? +m.th : null;
}
function Kfull(k) { var t = bodyT(); var K = Object.assign({}, k.K); if (t) K.t = t; return K; }

/* ---------- aparate: etichete ---------- */
function applLabel(id) {
  var a = kitchenApplById(id); if (!a) return String(id);
  var size = (a.id.match(/(\d+)/) || [])[1];
  var kind = kt("ka_" + a.kind), sub = a.sub && kt("kas_" + a.sub) !== "kas_" + a.sub ? kt("kas_" + a.sub) : "";
  var parts = [kind];
  if (a.kind === "sink") { if (sub) parts.push(sub); }
  else { if (size) parts.push(size + (a.kind === "fridge" || a.kind === "freezer" ? "" : "")); if (sub) parts.push(sub); }
  return parts.join(" ");
}
function applOptions(ids, cur, none) {
  return (none ? '<option value="">' + E(kt("kNone")) + "</option>" : "") +
    ids.map(function (id) { return '<option value="' + id + '"' + (id === cur ? " selected" : "") + ">" + E(applLabel(id)) + "</option>"; }).join("");
}
function idsOf(kinds) { return kitchenApplList().filter(function (a) { return kinds.indexOf(a.kind) >= 0; }).map(function (a) { return a.id; }); }
function idsFilter(kind, f) { return kitchenApplList(kind).filter(f || function () { return true; }).map(function (a) { return a.id; }); }

/* ---------- câmpurile de opțiuni, pe tip de unitate ---------- */
var DOORS = ["auto", 1, 2];
var FIELDS = {
  b_door:   [["doors", "sel", DOORS, "kDoors"], ["sh", "num", [0, 4], "kShelves"]],
  b_drawers:[["n", "sel", [2, 3, 4], "kDrawers"]],
  b_drdoor: [["doors", "sel", DOORS, "kDoors"], ["sh", "num", [0, 3], "kShelves"]],
  b_open:   [["sh", "num", [0, 4], "kShelves"]],
  b_sink:   [["sink", "appl", function () { return idsOf(["sink"]); }, "ka_sink"], ["doors", "sel", DOORS, "kDoors"]],
  b_hobdr:  [["hob", "appl", function () { return idsOf(["hob"]); }, "ka_hob"], ["n", "sel", [2, 3], "kDrawers"]],
  b_hoboven:[["hob", "appl", function () { return idsOf(["hob"]); }, "ka_hob"], ["oven", "appl", function () { return idsOf(["oven"]); }, "ka_oven"]],
  b_oven:   [["oven", "appl", function () { return idsOf(["oven"]); }, "ka_oven"]],
  n_dw:     [["appl", "appl", function () { return idsOf(["dw"]); }, "ka_dw"], ["mount", "mount"]],
  n_washer: [["appl", "appl", function () { return idsOf(["washer", "dryer", "washdry"]).filter(function (i) { return i !== "washer60_free"; }); }, "ka_washer"]],
  n_cool:   [["appl", "appl", function () { return ["fridge_uc", "freezer_uc", "wine_uc"]; }, "ka_fridge"], ["mount", "mount"]],
  c_blind:  [["side", "sel", ["left", "right"], "kSide"], ["doorW", "num", [400, 600], "kDoorW"], ["mech", "sel", ["none", "lemans", "magic"], "kMech"]],
  c_l:      [["mech", "sel", ["none", "carousel"], "kMech"]],
  w_door:   [["h", "sel", [360, 480, 600, 720, 900, 1000], "kHeight"], ["doors", "sel", DOORS, "kDoors"]],
  w_open:   [["h", "sel", [360, 480, 600, 720, 900], "kHeight"], ["sh", "num", [0, 4], "kShelves"]],
  w_glass:  [["h", "sel", [480, 600, 720, 900], "kHeight"], ["doors", "sel", DOORS, "kDoors"]],
  w_hood:   [["hood", "appl", function () { return idsFilter("hood", function (a) { return a.sub === "tele"; }); }, "ka_hood"], ["h", "sel", [320, 360, 480], "kHeight"]],
  w_hoodspace: [["hood", "appl", function () { return idsFilter("hood", function (a) { return a.sub !== "tele"; }); }, "ka_hood"], ["bottom", "num", [900, 2200], "kHeight"]],
  w_corner: [["side", "sel", ["left", "right"], "kSide"], ["h", "sel", [720, 900], "kHeight"]],
  t_pantry: [["doors", "sel", DOORS, "kDoors"], ["sh", "num", [0, 8], "kShelves"]],
  t_pull:   [["n", "sel", [3, 4, 5, 6], "kDrawers"]],
  t_oven:   [["oven", "appl", function () { return idsOf(["oven"]); }, "ka_oven"], ["micro", "appl0", function () { return ["micro38", "micro45", "coffee45", "warm14", "warm29", "oven45"]; }, "ka_micro"]],
  t_fridge: [["fridge", "appl", function () { return ["fridge178", "fridge158", "fridge122", "fridge102", "fridge88"]; }, "ka_fridge"]],
  t_fridgefz: [["freezer", "appl", function () { return ["freezer88"]; }, "ka_freezer"], ["fridge", "appl", function () { return ["fridge122", "fridge102", "fridge88"]; }, "ka_fridge"]],
  t_washer: [["washer", "appl", function () { return ["washer60_total", "washdry60_total"]; }, "ka_washer"], ["dryer", "appl0", function () { return ["dryer60_total"]; }, "ka_dryer"]]
};
var UP_TYPES = ["w_door", "w_open", "w_glass", "w_hood", "w_hoodspace", "w_corner"];

function defaultCol(type) {
  var u = KITCHEN_UNITS[type];
  var c = { id: uidk(), type: type, w: u.w0, opts: {}, up: null };
  if (u.cat === "base" && !u.nisa && type !== "b_cargo") c.up = (type === "b_hobdr" || type === "b_hoboven") ? { type: "w_hoodspace", opts: {} } : { type: "w_door", opts: {} };
  if (type === "n_dw") c.up = { type: "w_door", opts: {} };
  if (u.nisa && u.slots && u.slots.length && type !== "n_range") c.w = (kitchenBuild(type, {}).w) || u.w0;
  if (type === "n_range") c.up = { type: "w_hoodspace", opts: {} };
  return c;
}
function kitchenBuild(type, o, K) { return buildUnit(K || { t: 19 }, type, o || {}); }

/* ---------- construirea tuturor unităților dintr-un perete ---------- */
function sideOf(wi, nW, ci, nC, type) {
  /* un colț la capătul peretelui: ușa/aripa se întoarce departe de colț */
  var atEnd = ci === nC - 1 && wi < nW - 1, atStart = ci === 0 && wi > 0;
  if (type === "c_blind") return atEnd ? "left" : atStart ? "right" : null;
  if (type === "c_l") return atEnd ? "right" : atStart ? "left" : null;
  return null;
}
function buildAll(p, k) {
  var K = Kfull(k), walls = surveyWalls(p), built = {}, errs = [];
  walls.forEach(function (w, wi) {
    var cols = wallCols(k, w.id);
    cols.forEach(function (c, ci) {
      var o = Object.assign({}, c.opts || {}, { w: c.w });
      var sd = sideOf(wi, walls.length, ci, cols.length, c.type); if (sd) o.side = sd;
      var r = buildUnit(K, c.type, o); built[c.id] = r;
      if (r.errors.length) errs.push({ wall: wi + 1, col: ci + 1, errors: r.errors });
      if (c.up && c.up.type && !(KITCHEN_UNITS[c.type].cat === "tall")) {
        var ou = Object.assign({}, c.up.opts || {}, { w: r.w || c.w });
        var ru = buildUnit(K, c.up.type, ou); built[c.id + ":up"] = ru;
        if (ru.errors.length) errs.push({ wall: wi + 1, col: ci + 1, up: true, errors: ru.errors });
      }
    });
  });
  return { K: K, built: built, errs: errs };
}
function specOf(p, k, built) {
  var walls = surveyWalls(p), corners = [];
  for (var i = 0; i + 1 < walls.length; i++) {
    var A = wallCols(k, walls[i].id), B = wallCols(k, walls[i + 1].id);
    var la = A[A.length - 1], fb = B[0], saved = (k.corners || [])[i] || {};
    if (la && la.type === "c_l" && built[la.id] && built[la.id].wing) corners.push({ kind: "l", through: "first", reach: built[la.id].wing.reach });
    else if (fb && fb.type === "c_l" && built[fb.id] && built[fb.id].wing) corners.push({ kind: "l", through: "second", reach: built[fb.id].wing.reach });
    else corners.push({ kind: "butt", through: saved.through === "second" ? "second" : "first" });
  }
  return {
    walls: walls.map(function (w) { return { id: w.id, L: +w.len || 0, cols: wallCols(k, w.id).map(function (c) { return { id: c.id, type: c.type, w: c.w, opts: c.opts, up: c.up }; }) }; }),
    corners: corners, wtJoint: k.wtJoint === "mitre" ? "mitre" : "butt"
  };
}
function evaluate(p) {
  var k = kit(p), b = buildAll(p, k), spec = specOf(p, k, b.built);
  var plan = planKitchen(b.K, spec, b.built);
  return { k: k, K: b.K, built: b.built, errs: b.errs, spec: spec, plan: plan };
}
function sigOf(p, k) { return JSON.stringify([k.K, surveyWalls(p).map(function (w) { return [w.id, w.len, w.angle, k.walls[w.id] ? k.walls[w.id].cols : []]; }), k.wtJoint, k.wtMat, (k.corners || []), state.settings.matBody, state.settings.matFront]); }

/* ---------- aplicarea în proiect ---------- */
function removeKitchen(p, k) {
  (p.worktops || []).filter(function (w) { return w.kitchen; }).forEach(function (w) { wtRemoveModules(p, w.names || []); });
  p.worktops = (p.worktops || []).filter(function (w) { return !w.kitchen; });
  (k.names || []).forEach(function (n) {
    p.pieces = p.pieces.filter(function (x) { return x.modulo !== n && x.gen !== n; });
    if (p.configs) delete p.configs[n]; if (p.layout) delete p.layout[n];
  });
  k.names = []; k.sig = null;
}
function moduleName(type, wi, ci, up) { return kt("ku_" + type) + " " + (wi + 1) + "." + (ci + 1) + (up ? " ↑" : ""); }

function apply(p) {
  var ev = evaluate(p), k = ev.k, S = state.settings || {};
  var walls = surveyWalls(p), msgs = [];
  if (!walls.length) { toast(kt("kNoWalls")); return false; }
  walls.forEach(function (w, i) { if (!(+w.len > 0)) msgs.push(kt("kWallLenMissing", { n: i + 1 })); });
  ev.errs.forEach(function (e) { e.errors.forEach(function (x) { msgs.push(wtMsg(x)); }); });
  ev.plan.errors.forEach(function (x) { msgs.push(wtMsg(x)); });
  if (!S.matBody || !matById(S.matBody)) msgs.push(ts("wtNoMat"));
  if (msgs.length) { k.err = msgs; persist(); renderKitchen(); return false; }
  snapUndo();
  removeKitchen(p, k);
  var names = {}, n = 0, hoodY = {};
  (ev.plan.hoods || []).forEach(function (h) { hoodY[h.col] = h.bottom; });
  try {
    ev.plan.walls.forEach(function (wo, wi) {
      wo.items.concat(wo.upper).forEach(function (it) {
        var u = it.unit; if (!u || u.gap || !u.cfg) return;
        var up = /:up$/.test(it.id), ci = wallCols(k, wo.wall).findIndex(function (c) { return c.id === (up ? it.id.replace(/:up$/, "") : it.id); });
        var name = moduleName(up ? it.type : it.col.type, wi, ci, up);
        var cfg = Object.assign({ name: name }, JSON.parse(JSON.stringify(u.cfg)),
          { matBody: S.matBody, matFront: S.matFront || S.matBody, matBack: S.matBack || S.matBody, kitchen: true });
        generateInto(p, cfg);
        var lift = u.lift;
        if (up && u.hood && u.spaceOnly) { var cid = it.id.replace(/:up$/, ""); lift = hoodY[cid] != null ? hoodY[cid] : lift; }
        layout()[name] = { wall: wo.wall, from: it.from, off: 0, lift: lift, rot: 0 };
        names[it.id] = name; k.names.push(name); n++;
      });
    });
  } catch (e) { removeKitchen(p, k); k.err = [String(e && e.message || e)]; persist(); renderKitchen(); toast(k.err[0]); return false; }
  /* blatul: unul pe rând continuu, cu decupajele din plită și chiuvetă */
  var specs = worktopSpecs(ev.K, ev.spec, ev.plan, names), wn = 0;
  p.worktops = p.worktops || [];
  specs.forEach(function (sp) {
    wn++;
    var cuts = sp.cutouts.map(function (c) {
      var d = (typeof WORKTOP_DEFAULTS !== "undefined" ? WORKTOP_DEFAULTS.cutout[c.kind] : { y: 60 });
      return { kind: c.kind, seg: Math.max(0, sp.walls.indexOf(c.wall)), x: c.x, y: d.y, w: c.w, d: c.d, r: c.r };
    });
    var wt = { id: "wt" + uidk(), name: kt("kWtTitle") + " " + wn, mods: sp.mods, mat: k.wtMat, ovF: WORKTOP_DEFAULTS.ov_front, ovS: 0,
               through: sp.through, joint: sp.joint, cutouts: cuts, names: [], sig: null, kitchen: true };
    p.worktops.push(wt);
    if (k.wtMat) wtApply(p, wt);
  });
  k.err = null; k.sig = sigOf(p, k); persist();
  setView("kitchen"); auditBadge(); toast(kt("kApplied", { n: n }));
  return true;
}

/* ---------- desenul peretelui ---------- */
var COL = { base: "#b9a37d", niche: "#7d8a96", corner: "#c08a5a", tall: "#8aa08a", wall: "#a9a0c0", fill: "#9aa0a4" };
function elevation(ev, wi) {
  var K = ev.K, h = ev.plan.heights, wo = ev.plan.walls[wi]; if (!wo) return "";
  var W = Math.max(wo.L, wo.items.reduce(function (s, i) { return Math.max(s, i.to); }, 0), 1);
  var top = Math.max(K.tallH, K.wallBottom + K.wallH, 2300), mg = 60;
  var vw = W + 2 * mg, vh = top + 2 * mg;
  var Y = function (y) { return mg + top - y; };
  var out = ['<svg viewBox="0 0 ' + vw + " " + vh + '" style="width:100%;height:auto;display:block;max-height:46vh;touch-action:manipulation" role="img">'];
  out.push('<rect x="' + mg + '" y="' + mg + '" width="' + W + '" height="' + top + '" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="14 10"/>');
  out.push('<line x1="' + (mg - 20) + '" y1="' + Y(0) + '" x2="' + (mg + W + 20) + '" y2="' + Y(0) + '" stroke="currentColor" stroke-opacity=".6" stroke-width="6"/>');
  var cols = wallCols(ev.k, wo.wall);
  var box = function (x, w, y0, y1, cat, wi2, ci, up, label, selct) {
    var on = selct ? ' stroke="var(--red,#b3261e)" stroke-width="9"' : ' stroke="currentColor" stroke-opacity=".5" stroke-width="3"';
    out.push('<g data-k="1" data-wi="' + wi2 + '" data-ci="' + ci + '" data-up="' + (up ? 1 : 0) + '" style="cursor:pointer">' +
      '<rect x="' + (mg + x) + '" y="' + Y(y1) + '" width="' + w + '" height="' + (y1 - y0) + '" fill="' + COL[cat] + '" fill-opacity=".32"' + on + "/>" +
      '<text x="' + (mg + x + w / 2) + '" y="' + (Y(y1) + 56) + '" text-anchor="middle" font-size="46" fill="currentColor">' + E(label) + "</text></g>");
  };
  wo.items.forEach(function (it, ci) {
    var u = it.unit, c = it.col, cat = unitCat(c.type), isSel = sel.wall === wi && sel.col === ci && !sel.up;
    var H = u && u.cfg ? (u.cfg.H || K.workH) : (u && u.gap ? 0 : K.workH);
    if (u && u.gap) { out.push('<g data-k="1" data-wi="' + wi + '" data-ci="' + ci + '" data-up="0" style="cursor:pointer"><rect x="' + (mg + it.from) + '" y="' + Y(K.workH) + '" width="' + it.w + '" height="' + K.workH + '" fill="none" stroke="currentColor" stroke-dasharray="10 8" stroke-opacity=".5"/></g>'); return; }
    if (!u || !u.cfg) { box(it.from, it.w, 0, K.workH, cat, wi, ci, false, "!", isSel); return; }
    var y1 = u.cfg.type === "nisa" && u.cfg.mode === "range" ? 850 : H;
    box(it.from, it.w, 0, y1, cat, wi, ci, false, String(it.w), isSel);
    (u.appliances || []).forEach(function (a) {
      if (a.kind === "hood") return;
      out.push('<rect x="' + (mg + it.from + a.x) + '" y="' + Y(a.y + a.h) + '" width="' + a.w + '" height="' + a.h + '" fill="#4b5560" fill-opacity=".5" pointer-events="none"/>');
    });
  });
  /* blatul peste coloanele joase */
  var lo = wo.items.filter(function (i) { return i.unit && i.unit.cfg && i.unit.cfg.H <= K.workH && !(i.unit.cfg.type === "nisa" && i.unit.cfg.mode === "range"); });
  lo.forEach(function (i) { out.push('<rect x="' + (mg + i.from) + '" y="' + Y(K.workH) + '" width="' + i.w + '" height="' + K.topT + '" fill="currentColor" fill-opacity=".55" pointer-events="none"/>'); });
  wo.upper.forEach(function (it) {
    var u = it.unit; if (!u || !u.cfg) return;
    var cid = it.id.replace(/:up$/, ""), ci = cols.findIndex(function (c) { return c.id === cid; });
    var hb = (ev.plan.hoods || []).filter(function (x) { return x.col === cid; })[0];
    var lift = u.lift;
    if (u.hood && u.spaceOnly && hb && hb.bottom != null) lift = hb.bottom;
    var H = u.cfg.type === "nisa" ? (u.appliances[0] ? u.appliances[0].h : 900) : u.cfg.H;
    box(it.from, it.w, lift, lift + H, unitCat(it.type), wi, ci, true, String(it.w), sel.wall === wi && sel.col === ci && sel.up);
    (u.appliances || []).forEach(function (a) { out.push('<rect x="' + (mg + it.from + a.x) + '" y="' + Y(lift + a.y + a.h) + '" width="' + a.w + '" height="' + a.h + '" fill="#4b5560" fill-opacity=".45" pointer-events="none"/>'); });
  });
  /* rest liber */
  if (wo.rest > 0.5 && cols.length) out.push('<rect x="' + (mg + wo.floorEnd - wo.rest) + '" y="' + Y(K.workH) + '" width="' + wo.rest + '" height="' + K.workH + '" fill="var(--red,#b3261e)" fill-opacity=".12" stroke="var(--red,#b3261e)" stroke-dasharray="12 8" pointer-events="none"/>');
  out.push("</svg>");
  return out.join("");
}

/* ---------- ecranul ---------- */
function field(label, inner) { return '<div class="f"><label>' + E(label) + "</label>" + inner + "</div>"; }
function numInput(f, v, extra) { return '<input type="number" inputmode="numeric" data-kf="' + f + '" value="' + (v == null ? "" : v) + '"' + (extra || "") + ">"; }
function selOptions(vals, cur, lab) { return vals.map(function (v) { return '<option value="' + v + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + E(lab ? lab(v) : v) + "</option>"; }).join(""); }
function optField(def, o, labelOf) {
  var key = def[0], kind = def[1], cur = o[key], lab = def[3] ? kt(def[3]) : key;
  if (kind === "sel") {
    var vals = def[2], show = function (v) { return v === "auto" ? "auto" : v === "left" ? kt("kSideL") : v === "right" ? kt("kSideR") : v === "none" ? kt("kMechNone") : v === "lemans" ? kt("kMechLeMans") : v === "magic" ? kt("kMechMagic") : v === "carousel" ? kt("kMechCarousel") : v; };
    return field(lab, '<select data-ko="' + key + '">' + selOptions(vals, cur == null ? vals[0] : cur, show) + "</select>");
  }
  if (kind === "num") return field(lab, '<input type="number" inputmode="numeric" data-ko="' + key + '" min="' + def[2][0] + '" max="' + def[2][1] + '" value="' + (cur == null ? "" : cur) + '">');
  if (kind === "appl" || kind === "appl0") {
    var ids = def[2]();
    return field(lab, '<select data-ko="' + key + '">' + applOptions(ids, cur || (kind === "appl" ? ids[0] : ""), kind === "appl0") + "</select>");
  }
  if (kind === "mount") return "";
  return "";
}

function colEditor(ev, wi, ci, up) {
  var p = proj(), k = ev.k, wall = surveyWalls(p)[wi]; if (!wall) return "";
  var cols = wallCols(k, wall.id), c = cols[ci]; if (!c) return "";
  var node = up ? c.up : c, type = up ? (c.up && c.up.type) : c.type;
  var u = type ? KITCHEN_UNITS[type] : null;
  var built = ev.built[up ? c.id + ":up" : c.id];
  var html = ['<div class="kcol" data-wi="' + wi + '" data-ci="' + ci + '" data-up="' + (up ? 1 : 0) + '" style="border-top:1px solid var(--line,#e5e2d8);padding:10px 0">'];
  html.push('<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b style="flex:1">' + E(kt("kColN", { n: ci + 1 })) + (up ? " · " + E(kt("kUp")) : "") + "</b>" +
    (up ? "" : '<button class="iconbtn" data-kact="left" title="' + E(kt("kLeft")) + '">◀</button><button class="iconbtn" data-kact="right" title="' + E(kt("kRight")) + '">▶</button><button class="iconbtn" data-kact="dup" title="' + E(kt("kDup")) + '">⧉</button><button class="iconbtn" data-kact="del" title="' + E(kt("kDel")) + '">✕</button>') + "</div>");
  /* tipul */
  var types = up ? UP_TYPES : Object.keys(KITCHEN_UNITS).filter(function (t) { return KITCHEN_UNITS[t].cat !== "wall"; });
  html.push('<div class="f2">' + field(up ? kt("kUp") : kt("kCatalog"),
    '<select data-kt="1">' + (up ? '<option value="">' + E(kt("kNone")) + "</option>" : "") + types.map(function (t) { return '<option value="' + t + '"' + (t === type ? " selected" : "") + ">" + E(kt("ku_" + t)) + "</option>"; }).join("") + "</select>"));
  if (u) {
    var fixedW = built && u.nisa && u.slots && u.slots.length && type !== "n_range" && !up;
    if (fixedW) html.push(field(kt("kWidth"), '<div class="mini" style="padding:10px 0">' + E((built && built.w) || c.w) + " mm</div>"));
    else if (up) html.push(field(kt("kWidth"), '<div class="mini" style="padding:10px 0">' + E(c.w) + " mm</div>"));
    else if (u.ws && u.ws.length) html.push(field(kt("kWidth"), '<select data-kw="1">' + selOptions(u.ws.concat(u.ws.indexOf(+c.w) < 0 ? [c.w] : []).sort(function (a, b) { return a - b; }), c.w) + "</select>"));
    else html.push(field(kt("kWidth"), numInput("w", c.w, ' data-kw="1" min="20" max="2000"')));
  }
  html.push("</div>");
  if (u) {
    var o = node.opts = node.opts || {};
    var fs = (FIELDS[type] || []).map(function (d) { return optField(d, o); }).filter(Boolean);
    /* montaj pentru aparatele cu mai multe variante */
    var mf = (FIELDS[type] || []).filter(function (d) { return d[1] === "mount"; })[0];
    if (mf) {
      var ap = kitchenApplById(o.appl || (u.slotKind ? null : null)) || (built && built.appliances && built.appliances[0] ? kitchenApplById(built.appliances[0].id) : null);
      if (ap && ap.mounts.length > 1) fs.push(field(kt("kMount"), '<select data-ko="mount">' + selOptions(ap.mounts, o.mount || ap.mounts[0], function (m) { return kt("km_" + m); }) + "</select>"));
      else if (ap) fs.push(field(kt("kMount"), '<div class="mini" style="padding:10px 0">' + E(kt("km_" + ap.mounts[0])) + "</div>"));
    }
    if (fs.length) html.push('<div class="f2">' + fs.join("") + "</div>");
    if (u.cat === "tall" && !up) { /* fără rând de sus */ }
    else if (!up && u.cat !== "tall" && !u.hoodSpace) {
      html.push('<div class="f2">' + field(kt("kUp"), '<select data-ku="1"><option value="">' + E(kt("kNone")) + "</option>" + UP_TYPES.map(function (t) { return '<option value="' + t + '"' + (c.up && c.up.type === t ? " selected" : "") + ">" + E(kt("ku_" + t)) + "</option>"; }).join("") + "</select>") + "</div>");
    }
  }
  if (built) {
    built.errors.forEach(function (e) { html.push('<div class="mini" style="color:var(--danger)">⚠ ' + E(wtMsg(e)) + "</div>"); });
    built.warnings.forEach(function (e) { html.push('<div class="mini warnline">⚠ ' + E(wtMsg(e)) + "</div>"); });
    (built.notes || []).forEach(function (n) { html.push('<div class="mini">ℹ ' + E(kt(n)) + "</div>"); });
    if (built.cfg && built.appliances && built.appliances.length) html.push('<div class="mini">' + built.appliances.map(function (a) { return E(applLabel(a.id)) + " — " + E(kt("km_" + a.mount)) + " · " + a.w + "×" + a.h + "×" + a.d; }).join("<br>") + "</div>");
    if (built.mech && built.mech !== "none") html.push('<div class="mini">' + E(kt("kMech")) + ": " + E(kt(built.mech === "lemans" ? "kMechLeMans" : built.mech === "magic" ? "kMechMagic" : "kMechCarousel")) + "</div>");
  }
  html.push("</div>");
  return html.join("");
}

function renderKitchen() {
  var host = $("v-kitchen"); if (!host) return;
  var p = proj(), k;
  $("kTitle").textContent = kt("kTitle"); $("kSub").textContent = kt("kSub");
  var body = $("kBody");
  if (!p) { body.innerHTML = '<div class="empty">' + E(t("selectProject")) + "</div>"; return; }
  if (body.contains(document.activeElement) && /INPUT/.test(document.activeElement.tagName) && document.activeElement.dataset.kf) return;
  k = kit(p);
  var walls = surveyWalls(p), ev = evaluate(p), K = ev.K, h = ev.plan.heights;
  var h1 = [];
  h1.push('<p class="mini">' + E(kt("kHint")) + "</p>");
  /* setări */
  var topOpts = (window.WORKTOP_THICKS || [38]).map(function (v) { return '<option value="' + v + '"' + (+k.K.topT === v ? " selected" : "") + ">" + v + " mm</option>"; }).join("");
  var wm = k.wtMat ? matById(k.wtMat) : null;
  h1.push('<div class="card" style="padding:12px"><div class="eyebrow" style="margin:0 0 6px">' + E(kt("kSetTitle")) + "</div><div class=\"f2\">" +
    [["workH", "kWorkH"], ["bodyH", "kBodyH"], ["wallBottom", "kWallBottom"], ["wallH", "kWallH"], ["tallH", "kTallH"], ["depthBase", "kDepthBase"], ["depthWall", "kDepthWall"]]
      .map(function (a) { return field(kt(a[1]), '<input type="number" inputmode="numeric" data-ks="' + a[0] + '" value="' + k.K[a[0]] + '">'); }).join("") +
    field(kt("kHandles"), '<select data-ks="handles"><option value="maniglia"' + (k.K.handles === "maniglia" ? " selected" : "") + ">" + E(kt("kHandMan")) + '</option><option value="push"' + (k.K.handles === "push" ? " selected" : "") + ">" + E(kt("kHandPush")) + '</option><option value="gola"' + (k.K.handles === "gola" ? " selected" : "") + ">" + E(kt("kHandGola")) + "</option></select>") +
    field(kt("kTopT"), '<select data-ks="topT">' + topOpts + "</select>") +
    field(kt("kTopMat"), '<button type="button" class="matpick" data-kmat="1">' + (wm ? E(wm.label) : E(kt("kPickMat"))) + "</button>") +
    field(kt("kJoint"), '<select data-kj="1"><option value="butt"' + (k.wtJoint !== "mitre" ? " selected" : "") + ">" + E(kt("kJointButt")) + '</option><option value="mitre"' + (k.wtJoint === "mitre" ? " selected" : "") + ">" + E(kt("kJointMitre")) + "</option></select>") +
    "</div>" +
    '<div class="mini" style="margin-top:6px">' + E(kt("kPlinthInfo", { n: h.plinth })) + "</div>" +
    (wm && +wm.th !== +k.K.topT ? '<div class="mini warnline">⚠ ' + E(kt("kWtThick", { a: wm.th, b: k.K.topT })) + "</div>" : "") +
    h.warnings.concat(h.errors).map(function (e) { return '<div class="mini warnline">⚠ ' + E(wtMsg(e)) + "</div>"; }).join("") + "</div>");
  /* pereți */
  h1.push('<div class="card" style="padding:12px"><div class="eyebrow" style="margin:0 0 6px">' + E(kt("kWalls")) + "</div>");
  if (!walls.length) {
    h1.push('<p class="mini">' + E(kt("kNoWalls")) + '</p><div class="chips" id="kShapes">' +
      [["line", "kShapeLine"], ["L", "kShapeL"], ["U", "kShapeU"]].map(function (s) { return '<button class="chip" data-kshape="' + s[0] + '">' + E(kt(s[1])) + "</button>"; }).join("") + "</div>" +
      '<div class="f2" id="kShapeLens"></div>');
  } else {
    walls.forEach(function (w, wi) {
      var wo = ev.plan.walls[wi];
      h1.push('<div class="kwall" style="padding:8px 0;border-top:' + (wi ? "1px solid var(--line,#e5e2d8)" : "0") + '">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="flex:1">' + E(kt("kWallN", { n: wi + 1 })) + " · " + (+w.len > 0 ? w.len + " mm" : "—") + '</b><span class="mini">' + (wo && wo.rest != null && (k.walls[w.id] || {}).cols && k.walls[w.id].cols.length ? E(kt("kRest", { mm: Math.round(wo.rest) })) : "") + "</span>" +
        '<button class="btn sm" data-kadd="' + wi + '">+ ' + E(kt("kAdd")) + "</button></div>" +
        (wallCols(k, w.id).length ? elevation(ev, wi) : '<p class="mini">' + E(kt("kEmptyWall")) + "</p>") + "</div>");
      if (wi + 1 < walls.length) {
        var cn = ev.spec.corners[wi] || {};
        if (cn.kind !== "l") {
          var first = (k.corners[wi] || {}).through !== "second", a = wi + 1, b = wi + 2;
          h1.push('<div class="chips"><button class="chip sm on" data-kcorner="' + wi + '">' + E(kt("kCornerN", { a: a, b: b })) + ": " + E(kt("kPasses", { n: first ? a : b })) + "</button></div>");
        }
      }
    });
  }
  h1.push("</div>");
  /* editorul coloanei */
  if (walls.length && sel.wall < walls.length) {
    var cols = wallCols(k, walls[sel.wall].id);
    if (sel.col < cols.length) h1.push('<div class="card" style="padding:12px" id="kEditor">' + colEditor(ev, sel.wall, sel.col, false) + (cols[sel.col].up && KITCHEN_UNITS[cols[sel.col].type].cat !== "tall" ? colEditor(ev, sel.wall, sel.col, true) : "") + "</div>");
  }
  /* controale + aparate */
  var applied = (k.names || []).length && k.names.every(function (n) { return p.configs && p.configs[n]; });
  var stale = applied && k.sig !== sigOf(p, k);
  var all = [];
  ev.plan.warnings.forEach(function (w) { all.push(["w", wtMsg(w)]); });
  ev.plan.errors.forEach(function (w) { all.push(["e", wtMsg(w)]); });
  (ev.plan.hoods || []).forEach(function (hc) { if (hc.warn2) all.push(["w", wtMsg(hc.warn2)]); });
  (k.err || []).forEach(function (m) { all.push(["e", m]); });
  h1.push('<div class="card" style="padding:12px"><div class="eyebrow" style="margin:0 0 6px">' + E(kt("kChecks")) + "</div>" +
    (all.length ? all.map(function (m) { return '<div class="mini' + (m[0] === "e" ? "\" style=\"color:var(--danger)" : " warnline") + '">⚠ ' + E(m[1]) + "</div>"; }).join("") : '<div class="mini">' + E(kt("kNoChecks")) + "</div>") + "</div>");
  if (ev.plan.appliances.length) {
    h1.push('<div class="card" style="padding:12px"><div class="eyebrow" style="margin:0 0 6px">' + E(kt("kApplList")) + "</div>" +
      ev.plan.appliances.map(function (a) { return '<div style="display:flex;gap:8px"><span style="flex:1">' + E(applLabel(a.id)) + '</span><span class="mini">' + E(kt("km_" + a.mount)) + "</span><b>× " + a.n + "</b></div>"; }).join("") +
      '<p class="mini" style="margin-top:6px">' + E(kt("kApplNote")) + " " + E(kt("kShareNote")) + "</p></div>");
  }
  h1.push('<div class="card" style="padding:12px"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1">' + E(kt("kWtTitle")) + " · " + E(!applied ? kt("kStNew") : stale ? kt("kStStale") : kt("kStOk")) + "</b></div>" +
    ((p.worktops || []).filter(function (w) { return w.kitchen; }).map(function (w) {
      var wr = wtCompute(p, w); var segs = wr.segments.map(function (sg) { return "<div class=\"mini\">" + E(wtSegName(w, wr, sg)) + " · <b>" + sg.L + "×" + sg.P + "</b> · " + E(ts("wtEdge")) + " " + E(sg.bordo) + " · " + sg.pockets.length + " " + E(ts("wtPockets")) + (sg.mitre && (sg.mitre.start || sg.mitre.end) ? " · 45°" : "") + "</div>"; }).join("");
      return segs + (w.err || []).map(function (x) { return '<div class="mini" style="color:var(--danger)">⚠ ' + E(x) + "</div>"; }).join("");
    }).join("")) +
    (applied && !(k.wtMat) ? '<div class="mini warnline">⚠ ' + E(kt("kWtNeedMat")) + "</div>" : "") +
    '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="kApply" style="flex:1">' + E(applied ? kt("kReapply") : kt("kApply")) + '</button>' + (applied ? '<button class="btn ghost" id="kClear">' + E(kt("kClear")) + "</button>" : "") + "</div></div>");
  /* catalog (foaie) */
  if (addOpen !== false) {
    var wi = addOpen;
    h1.push('<div class="card" style="padding:12px" id="kCatalog"><div style="display:flex;align-items:center"><b style="flex:1">' + E(kt("kCatalog")) + " · " + E(kt("kWallN", { n: wi + 1 })) + '</b><button class="iconbtn" data-kclose="1" aria-label="' + E(kt("kClose")) + '">✕</button></div>' +
      CATS.filter(function (c) { return c !== "wall"; }).map(function (c) {
        var ids = Object.keys(KITCHEN_UNITS).filter(function (id) { return unitCat(id) === c; });
        return '<div class="mini" style="margin:8px 0 2px">' + E(kt("kcat_" + c)) + '</div><div class="chips">' + ids.map(function (id) { return '<button class="chip sm" data-kpick="' + id + '">' + E(kt("ku_" + id)) + "</button>"; }).join("") + "</div>";
      }).join("") + "</div>");
  }
  body.innerHTML = h1.join("");
  wireKitchen(p, k, ev);
}

function wireKitchen(p, k, ev) {
  var body = $("kBody"), walls = surveyWalls(p);
  var touch = function () { persist(); renderKitchen(); };
  body.querySelectorAll("[data-ks]").forEach(function (el) {
    el.addEventListener("change", function () {
      var f = el.dataset.ks, v = el.value;
      k.K[f] = (f === "handles") ? v : (parseFloat(v) || KDEF[f]); touch(); });
  });
  var matBtn = body.querySelector("[data-kmat]");
  if (matBtn) matBtn.addEventListener("click", function () {
    var sl = $("kWtMatSel");
    if (!sl) { sl = document.createElement("select"); sl.id = "kWtMatSel"; sl.hidden = true; document.body.appendChild(sl); }
    sl.innerHTML = matVisible().map(function (m) { return '<option value="' + m.id + '">' + E(matById(m.id).label) + "</option>"; }).join("");
    if (k.wtMat) sl.value = k.wtMat;
    matPickOpen("kWtMatSel", { minTh: 10, title: kt("kTopMat"), onPick: function (id) { k.wtMat = id; var m = matById(id); if (m && +m.th > 0) k.K.topT = +m.th; touch(); } });
    try { if (typeof MP !== "undefined" && +k.K.topT > 0 && matVisible().some(function (m) { return m.th === +k.K.topT; })) { MP.th = +k.K.topT; renderMatPick(); } } catch (e) {}
  });
  var jt = body.querySelector("[data-kj]"); if (jt) jt.addEventListener("change", function () { k.wtJoint = jt.value; touch(); });
  body.querySelectorAll("[data-kcorner]").forEach(function (b) { b.addEventListener("click", function () {
    var i = +b.dataset.kcorner; k.corners = k.corners || []; while (k.corners.length <= i) k.corners.push({});
    k.corners[i] = { through: (k.corners[i].through === "second") ? "first" : "second" }; touch(); }); });
  /* forma bucătăriei: creează pereții în Releveu */
  var shape = null;
  body.querySelectorAll("[data-kshape]").forEach(function (b) { b.addEventListener("click", function () {
    shape = b.dataset.kshape; var n = shape === "line" ? 1 : shape === "L" ? 2 : 3;
    var box = $("kShapeLens"); box.innerHTML = "";
    for (var i = 0; i < n; i++) box.insertAdjacentHTML("beforeend", field(kt("kWallN", { n: i + 1 }) + " (mm)", '<input type="number" inputmode="numeric" data-klen="' + i + '" value="' + (i === 1 && n === 3 ? 2400 : 3000) + '">'));
    box.insertAdjacentHTML("beforeend", '<div class="f"><label>&nbsp;</label><button class="btn" id="kMakeWalls">' + E(kt("kCreateWalls")) + "</button></div>");
    $("kMakeWalls").addEventListener("click", function () {
      var sv = survey(); if (!sv) return; snapUndo(); sv.walls = [];
      box.querySelectorAll("[data-klen]").forEach(function (inp, i) { sv.walls.push({ id: uidk(), len: parseFloat(inp.value) || null, angle: 90, bow: null }); });
      touch(); });
  }); });
  body.querySelectorAll("[data-kadd]").forEach(function (b) { b.addEventListener("click", function () { addOpen = +b.dataset.kadd; renderKitchen(); }); });
  var cl = body.querySelector("[data-kclose]"); if (cl) cl.addEventListener("click", function () { addOpen = false; renderKitchen(); });
  body.querySelectorAll("[data-kpick]").forEach(function (b) { b.addEventListener("click", function () {
    var w = walls[addOpen]; if (!w) return; var cols = wallCols(k, w.id), c = defaultCol(b.dataset.kpick);
    cols.push(c); sel = { wall: addOpen, col: cols.length - 1, up: false }; addOpen = false; touch(); }); });
  /* desen: selectează o coloană */
  body.querySelectorAll("g[data-k]").forEach(function (g) { g.addEventListener("click", function () {
    sel = { wall: +g.dataset.wi, col: +g.dataset.ci, up: g.dataset.up === "1" }; renderKitchen(); }); });
  /* editorul */
  var ed = body.querySelector("#kEditor");
  if (ed) ed.querySelectorAll(".kcol").forEach(function (box) {
    var wi = +box.dataset.wi, ci = +box.dataset.ci, up = box.dataset.up === "1";
    var cols = wallCols(k, walls[wi].id), c = cols[ci], node = up ? c.up : c;
    box.querySelectorAll("[data-kact]").forEach(function (b) { b.addEventListener("click", function () {
      var a = b.dataset.kact;
      if (a === "left" && ci > 0) { var t0 = cols[ci - 1]; cols[ci - 1] = c; cols[ci] = t0; sel.col = ci - 1; }
      else if (a === "right" && ci < cols.length - 1) { var t1 = cols[ci + 1]; cols[ci + 1] = c; cols[ci] = t1; sel.col = ci + 1; }
      else if (a === "dup") { var d = JSON.parse(JSON.stringify(c)); d.id = uidk(); cols.splice(ci + 1, 0, d); sel.col = ci + 1; }
      else if (a === "del") { cols.splice(ci, 1); sel.col = Math.max(0, ci - 1); }
      touch(); }); });
    var tsel = box.querySelector("[data-kt]");
    if (tsel) tsel.addEventListener("change", function () {
      if (up) { c.up = tsel.value ? { type: tsel.value, opts: {} } : null; }
      else { var d = defaultCol(tsel.value); c.type = d.type; c.w = d.w; c.opts = {}; if (!c.up && d.up) c.up = d.up; if (KITCHEN_UNITS[c.type].cat === "tall") c.up = null; }
      touch(); });
    var usel = box.querySelector("[data-ku]");
    if (usel) usel.addEventListener("change", function () { c.up = usel.value ? { type: usel.value, opts: {} } : null; touch(); });
    box.querySelectorAll("[data-kw]").forEach(function (el) { el.addEventListener("change", function () { c.w = parseFloat(el.value) || c.w; touch(); }); });
    box.querySelectorAll("[data-ko]").forEach(function (el) { el.addEventListener("change", function () {
      var key = el.dataset.ko, v = el.value; node.opts = node.opts || {};
      if (v === "" || v === "auto") delete node.opts[key];
      else node.opts[key] = /^-?\d+(\.\d+)?$/.test(v) ? +v : v;
      /* un aparat nou schimbă lățimea nișei */
      if (key === "appl" || key === "washer") { var b2 = buildUnit(Kfull(k), c.type, Object.assign({}, node.opts, { w: c.w })); if (b2.w && !up) c.w = b2.w; }
      touch(); }); });
  });
  var ap = body.querySelector("#kApply"); if (ap) ap.addEventListener("click", function () { apply(p); });
  var cr = body.querySelector("#kClear"); if (cr) cr.addEventListener("click", function () {
    if (!confirm(kt("kClearAsk"))) return; snapUndo(); removeKitchen(p, k); persist(); renderKitchen(); });
}

window.renderKitchen = renderKitchen;
window.EBKitchenUI = { evaluate: evaluate, apply: apply, kit: kit, applLabel: applLabel, defaultCol: defaultCol, FIELDS: FIELDS };
})();
