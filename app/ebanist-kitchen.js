/* =====================================================================
   Ebanist — Bucătărie: unități, rânduri, aparate, blat (D-142)
   ---------------------------------------------------------------------
   Funcții PURE. Intră setările bucătăriei (`K`), tipul unității și opțiunile ei;
   ies configurații `cfg` pentru motorul EXISTENT (`generateInto` / `buildModule`),
   plus ce motorul nu știe: aparatele din nișe (pentru 3D și listă), decupajele de
   blat, golurile de hotă. Nimic nu citește DOM-ul și nu scrie în proiect.

   NU e un al doilea motor. Un corp de bucătărie e un corp `standard` cu cote
   absolute (D-56: `partitions`, `fronts`, `drawerBlocks`), calculat de
   `deriveCarcass` ca oricare altul; aici se calculează numai CE cote se dau.
   Ce nu e corp (nișa mașinii de spălat vase: n-are bază, vecinii îi sunt pereții;
   panoul de completare; locul aragazului; golul hotei) e tipul `nisa`, un modul
   ca `blat` și `cadru`, emis în `buildModule`.

   Convenții (ca în tot programul): milimetri, precizie deplină, rotunjire la
   0,1 mm doar la ieșire; determinism (aceeași intrare → aceeași ieșire);
   grosimea vine din materialul ales (D-41): `K.t` o dă apelantul, niciodată
   o valoare scrisă aici. Cotele de aparat sunt DATE (`ebanist-kitchen-data.js`).

   Cotele verticale: blatul FINIT stă la `workH` (900 implicit). Corpul de bază
   are înălțimea `bodyH` (720), blatul `topT`, iar soclul iese din diferență:
   soclu = workH − topT − bodyH (142 la 900 / 38 / 720). Un soclu în afara
   100–150 mm e avertisment, nu eroare.
   ===================================================================== */
(function (root) {
"use strict";

var K_DEFAULTS = {
  workH: 900, topT: 38, bodyH: 720,
  wallBottom: 1450, wallH: 720,
  depthBase: 560, depthWall: 320, depthTall: 560, tallH: 2150,
  plinthMin: 100, plinthMax: 150,
  t: 19,                 // grosimea corpului — o dă apelantul din materialul ales
  gapOut: 2, gapIn: 3,   // rosturile fronturilor, ca la ușile obișnuite (2 la margine, 3 între ele)
  railW: 100,            // lățimea traversei de blat
  handles: "maniglia", drawerSys: "legrabox",
  ceiling: null          // înălțimea camerei, dacă se știe: verifică pensilele și coloanele
};

function num(v, d) { if (v === null || v === undefined || v === "") return d; var n = +v; return isFinite(n) ? n : d; }
function r1(v) { return Math.round(v * 10) / 10; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function mergeK(K) { var o = {}, k; for (k in K_DEFAULTS) o[k] = K_DEFAULTS[k]; if (K) for (k in K) if (K[k] !== undefined && K[k] !== null && K[k] !== "") o[k] = K[k]; return o; }

function applById(id) {
  var L = root.KITCHEN_APPL || [];
  for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
  return null;
}
function applList(kind) { return (root.KITCHEN_APPL || []).filter(function (x) { return !kind || x.kind === kind; }); }

/* ---------- înălțimile verticale ---------- */
function heights(Kin) {
  var K = mergeK(Kin), w = [], e = [];
  var plinth = r1(K.workH - K.topT - K.bodyH);
  if (plinth < 0) e.push({ k: "khPlinthNeg", plinth: plinth });
  else if (plinth < K.plinthMin - 0.01 || plinth > K.plinthMax + 0.01) w.push({ k: "khPlinth", plinth: plinth });
  var baseH = r1(K.workH - K.topT);              // de la pardoseală la fața de sus a corpului
  var out = { plinth: plinth, baseH: baseH, topT: K.topT, workH: K.workH,
              wallBottom: K.wallBottom, wallTop: K.wallBottom + K.wallH, tallH: K.tallH,
              errors: e, warnings: w };
  if (K.wallBottom - K.workH < 450) w.push({ k: "khWallLow", mm: r1(K.wallBottom - K.workH) });
  if (K.ceiling) {
    if (out.wallTop > K.ceiling + 0.01) e.push({ k: "khWallHigh", mm: r1(out.wallTop - K.ceiling) });
    if (K.tallH > K.ceiling + 0.01) e.push({ k: "khTallHigh", mm: r1(K.tallH - K.ceiling) });
  }
  return out;
}

function bay0Doors(b, W) { return b.n === "auto" || b.n == null ? (W <= 480 ? 1 : 2) : +b.n; }

/* =====================================================================
   COMPOZITORUL DE GOLURI (bays) — unica funcție care dă cote unui corp
   `bays`: lista de jos în sus. Fiecare gol: { k, h?, grow?, ... }
     doors   { n:1|2|"auto", sh }       uși + sh rafturi egal distanțate
     drawers { n }                      bloc de sertare (drawerBlocks)
     niche   { appl, mount, align }     gol pentru aparat (front dacă `scomparsa`/`semi`)
     open    { sh }                     rafturi la vedere
   Un singur gol poate fi flex (fără `h`): primește restul. Între goluri: un raft
   fix de grosimea `t`. Rezultatul: partitions + fronts + drawerBlocks și harta
   golurilor (`bays`) pentru desen, aparate, listă.
   ===================================================================== */
function compose(Kin, o) {
  var K = mergeK(Kin), t = K.t, errors = [], warnings = [];
  var W = +o.W, H = +o.H, P = +o.P;
  var support = o.support === "sospeso" ? "sospeso" : "zoccolo";
  var plinth = support === "zoccolo" ? num(o.plinth, 0) : 0;
  var yIn0 = plinth + t, yIn1 = H - t;
  var bays = (o.bays || []).map(clone);
  var n = bays.length;
  var gO = K.gapOut, gI = K.gapIn;
  if (!(W > 0 && H > 0 && P > 0)) { errors.push({ k: "kuBadDims" }); return { errors: errors, warnings: warnings }; }
  if (!n) { errors.push({ k: "kuNoBays" }); return { errors: errors, warnings: warnings }; }

  /* înălțimile: cele fixe, restul împărțit între goluri flex */
  var fixed = 0, flex = [];
  bays.forEach(function (b, i) {
    if (b.k === "niche") {
      var ap = b.appl ? applById(b.appl) : null;
      if (b.appl && !ap) { errors.push({ k: "kuApplUnknown", id: b.appl }); return; }
      b.ap = ap;
      if (b.h == null && ap && ap.niche && !b.grow) b.h = ap.niche.h;
      if (ap && ap.niche && ap.niche.w > W - 2 * t + 0.01) errors.push({ k: "kuNicheWide", id: ap.id, need: ap.niche.w, have: r1(W - 2 * t) });
    }
    if (b.h == null) flex.push(i); else fixed += +b.h;
  });
  var gaps = (n - 1) * t, rest = (yIn1 - yIn0) - fixed - gaps;
  if (errors.length) return { errors: errors, warnings: warnings };
  if (rest < -0.01) { errors.push({ k: "kuNoRoom", need: r1(fixed + gaps), have: r1(yIn1 - yIn0) }); return { errors: errors, warnings: warnings }; }
  if (flex.length) {
    var each = rest / flex.length;
    flex.forEach(function (i) { bays[i].h = each; });
  } else if (rest > 0.01) {
    /* nimeni nu primește restul: ultimul gol îl ia (aparatul rămâne lipit sus) */
    var last = bays[n - 1]; last.h += rest; last.extra = rest;
  }

  var y = yIn0, parts = [], fronts = [], blocks = [], out = [], app = [];
  bays.forEach(function (b, i) {
    var y0 = y, y1 = y + b.h;
    if (i > 0) { parts.push({ type: "ripiano", y: y0 - t, span: "full" }); }
    /* zona frontului: de la mijlocul raftului de jos la mijlocul celui de sus */
    var z0 = i === 0 ? (plinth) : (y0 - t / 2), z1 = i === n - 1 ? H : (y1 + t / 2);
    var bay = { i: i, k: b.k, y0: r1(y0), y1: r1(y1), h: r1(b.h), z0: r1(z0), z1: r1(z1) };
    var fy = z0 + gI / 2, fh = z1 - z0 - gI;
    if (i === 0) { fy = z0 + gI; fh = z1 - fy - gI / 2; }
    if (i === n - 1 && n > 1) { fh = z1 - fy - gO; }
    if (i === 0 && n === 1) { fy = z0 + gI; fh = H - fy - gO; }
    if (b.k === "doors") {
      var nd = b.n === "auto" || b.n == null ? (W <= 480 ? 1 : 2) : +b.n;
      var fw = nd === 1 ? W - 2 * gO : (W - 2 * gO - gI) / 2;
      for (var d = 0; d < nd; d++) {
        var hg = nd === 1 ? (b.hinge === "right" ? "right" : "left") : (d === 0 ? "left" : "right");
        fronts.push({ x: gO + d * (fw + gI), y: fy, w: fw, h: fh, hinge: hg });
      }
      var sh = Math.max(0, Math.round(num(b.sh, 0)));
      for (var s = 1; s <= sh; s++) parts.push({ type: "ripiano", y: y0 + (b.h - t) * s / (sh + 1) - t / 2 + t / 2, span: "full", inner: true });
      bay.doors = nd; bay.sh = sh;
    } else if (b.k === "drawers") {
      var nn = Math.max(1, Math.round(num(b.n, 1)));
      blocks.push({ col: 1, yStart: y0, yEnd: y1, n: nn });
      bay.drawers = nn;
    } else if (b.k === "niche") {
      var ap2 = b.ap, mount = b.mount || (ap2 && ap2.mounts[0]) || "incasso";
      bay.appl = ap2 ? ap2.id : null; bay.mount = mount;
      if (ap2 && ap2.mounts.indexOf(mount) < 0) errors.push({ k: "kuMount", id: ap2.id, mount: mount });
      if (ap2 && ap2.niche) {
        var nh = ap2.niche.h, hMax = ap2.hMax || nh;
        if (b.h < nh - 0.01) errors.push({ k: "kuNicheLow", id: ap2.id, need: nh, have: r1(b.h) });
        else if (b.h > hMax + 0.01 && !b.grow && !b.extra && b.h - nh > 80) warnings.push({ k: "kuNicheTall", id: ap2.id, have: r1(b.h), max: hMax });
        var top = (b.align === "bottom") ? y0 + ap2.h : y1;
        var bot = (b.align === "bottom") ? y0 : y1 - ap2.h;
        var ax0 = (W - ap2.w) / 2;
        app.push({ id: ap2.id, kind: ap2.kind, mount: mount, bay: i, x: r1(ax0), y: r1(bot), z: 0, w: ap2.w, h: r1(top - bot), d: ap2.d });
      }
      if (mount === "scomparsa" || mount === "semi") {
        fronts.push({ x: gO, y: fy, w: W - 2 * gO, h: fh, hinge: b.hinge === "right" ? "right" : "left", appl: true });
        bay.front = true;
      }
    } else if (b.k === "open") {
      var so = Math.max(0, Math.round(num(b.sh, 0)));
      for (var s2 = 1; s2 <= so; s2++) parts.push({ type: "ripiano", y: y0 + (b.h - t) * s2 / (so + 1), span: "full", inner: true });
      bay.sh = so;
    } else { errors.push({ k: "kuBayKind", kind: b.k }); }
    out.push(bay);
    y = y1 + t;
  });
  if (errors.length) return { errors: errors, warnings: warnings };

  var cfg = { type: "standard", L: W, H: H, P: P, plinth: plinth, support: support,
    tram: 0, shelves: 0, drawers: 0, doors: 0, back: o.back === 0 ? 0 : 1, hang: 0,
    handles: o.handles || K.handles, drawerSys: K.drawerSys, drawerDist: "cucina",
    top: o.top === "plin" ? "plin" : "traverse",
    shelfType: parts.some(function (q) { return !q.inner; }) ? "fisso" : "mobile" };
  if (o.top === "plin") cfg.top = "plin";
  /* un singur gol simplu (uși / sertare / rafturi): parametrii obișnuiți ai motorului, nu cote absolute —
     aceleași uși, aceleași sertare ca la orice corp făcut din Generator */
  var b0 = bays[0];
  if (n === 1 && (b0.k === "doors" || b0.k === "open" || b0.k === "drawers")) {
    if (b0.k === "doors") { cfg.doors = bay0Doors(b0, W); cfg.shelves = Math.max(0, Math.round(num(b0.sh, 0))); }
    else if (b0.k === "open") cfg.shelves = Math.max(0, Math.round(num(b0.sh, 0)));
    else cfg.drawers = Math.max(1, Math.round(num(b0.n, 1)));
    if (o.front === "vetro") cfg.front = "vetro";
    return { cfg: cfg, bays: out, appliances: app, errors: errors, warnings: warnings, yIn0: yIn0, yIn1: yIn1 };
  }
  if (parts.length) {
    /* rafturile interioare (inner) sunt reglabile ca bază, dar motorul are un singur tip de raft pe corp: aici toate fixe */
    cfg.partitions = parts.map(function (q) { return { type: "ripiano", y: r1(q.y), span: "full" }; });
  }
  if (fronts.length) cfg.fronts = fronts.map(function (f) {
    var q = { x: r1(f.x), y: r1(f.y), w: r1(f.w), h: r1(f.h) }; if (f.hinge) q.hinge = f.hinge; return q; });
  if (blocks.length) cfg.drawerBlocks = blocks.map(function (b) { return { col: 1, yStart: r1(b.yStart), yEnd: r1(b.yEnd), n: b.n }; });
  if (o.front === "vetro") cfg.front = "vetro";
  return { cfg: cfg, bays: out, appliances: app, errors: errors, warnings: warnings, yIn0: yIn0, yIn1: yIn1 };
}

/* =====================================================================
   CATALOGUL DE UNITĂȚI
   ===================================================================== */
var UNITS = {};
function def(id, cat, ws, w0, build, extra) {
  var u = { id: id, cat: cat, ws: ws, w0: w0, build: build, slots: [] };
  if (extra) for (var k in extra) u[k] = extra[k];
  UNITS[id] = u;
}

var W_BASE = [300, 400, 450, 500, 600, 700, 800, 900, 1000, 1200];
var W_WIDE = [600, 800, 900, 1000, 1200];

function geomBase(K, h) { return { W: 0, H: h.baseH, P: K.depthBase, support: "zoccolo", plinth: h.plinth, top: "traverse" }; }
function geomWall(K, o) { return { W: 0, H: num(o.h, K.wallH), P: K.depthWall, support: "sospeso", plinth: 0, top: "plin" }; }
function geomTall(K, h) { return { W: 0, H: K.tallH, P: K.depthTall, support: "zoccolo", plinth: h.plinth, top: "plin" }; }
function mk(g, w, bays, extra) { var o = {}, k; for (k in g) o[k] = g[k]; o.W = w; o.bays = bays; if (extra) for (k in extra) o[k] = extra[k]; return o; }

/* --- BAZE --- */
def("b_door", "base", W_BASE, 600, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "doors", n: o.doors || "auto", sh: num(o.sh, 1) }]) };
});
def("b_drawers", "base", W_BASE, 600, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "drawers", n: num(o.n, 3) }]) };
}, { opts: { n: [2, 3, 4] } });
def("b_drdoor", "base", W_BASE.slice(2), 600, function (K, h, o) {
  /* sertar sus (front ~180) + uși dedesubt */
  var dh = num(o.dh, 170);
  return { c: mk(geomBase(K, h), o.w, [{ k: "doors", n: o.doors || "auto", sh: num(o.sh, 1) }, { k: "drawers", n: 1, h: dh }]) };
});
def("b_bin", "base", [300, 400, 450, 500, 600], 450, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "drawers", n: 1 }]), notes: ["kuBinNote"] };
});
def("b_cargo", "base", [250, 300], 300, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "drawers", n: 1 }]), notes: ["kuCargoNote"] };
});
def("b_open", "base", W_BASE, 600, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "open", sh: num(o.sh, 1) }]) };
});

/* chiuvetă: uși, fără raft (sifon), blatul decupat pentru castron */
def("b_sink", "base", W_WIDE, 800, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "doors", n: o.doors || "auto", sh: 0 }]), slots: { sink: o.sink || "sink1" } };
}, { slots: ["sink"] });

/* plită: sertare dedesubt, sau cuptor sub plită */
def("b_hobdr", "base", [600, 800, 900, 1000], 600, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "drawers", n: num(o.n, 3) }]), slots: { hob: o.hob || "hob_ind60" } };
}, { slots: ["hob"] });
def("b_hoboven", "base", [600, 800, 900], 600, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "niche", appl: o.oven || "oven60", mount: "incasso", grow: true, align: "top" }]),
           slots: { hob: o.hob || "hob_ind60", oven: o.oven || "oven60" } };
}, { slots: ["hob", "oven"] });
def("b_oven", "base", [600], 600, function (K, h, o) {
  return { c: mk(geomBase(K, h), o.w, [{ k: "niche", appl: o.oven || "oven60", mount: "incasso", grow: true, align: "top" }]), slots: { oven: o.oven || "oven60" } };
}, { slots: ["oven"] });

/* --- NIȘE: fără corp, vecinii sunt pereții (mașină de spălat vase, rufe, frigider sub blat, aragaz) --- */
function nisaOf(K, h, o, mode, applId, extra) {
  var ap = applId ? applById(applId) : null;
  var c = { type: "nisa", mode: mode, L: o.w, H: h.baseH, P: K.depthBase, plinth: h.plinth, support: "zoccolo",
            railW: K.railW, gapOut: K.gapOut, gapIn: K.gapIn };
  if (ap) { c.appl = ap.id; c.mount = o.mount || ap.mounts[0]; if (ap.ctrl) c.ctrlH = ap.ctrl; }
  if (extra) for (var k in extra) c[k] = extra[k];
  return c;
}
function nisaUnit(id, kinds, w0) {
  def(id, "base", null, w0, function (K, h, o) {
    var ap = applById(o.appl || kinds.def);
    var e = [];
    if (!ap || kinds.list.indexOf(ap.id) < 0) e.push({ k: "kuApplUnknown", id: o.appl });
    return { c: nisaOf(K, h, Object.assign({}, o, { w: ap ? ap.niche.w : o.w }), "app", ap && ap.id, { nicheH: ap && ap.niche.h }), errors: e,
             slots: (function () { var s = {}; s[kinds.slot] = ap && ap.id; return s; })() };
  }, { slots: [kinds.slot], nisa: true, list: kinds.list, slotKind: kinds.slot });
}
nisaUnit("n_dw", { slot: "dw", def: "dw60_total", list: ["dw60_total", "dw60_semi", "dw60_inox", "dw45_total", "dw45_inox"] }, 600);
nisaUnit("n_washer", { slot: "washer", def: "washer60_total", list: ["washer60_total", "dryer60_total", "washdry60_total", "washer60_free"] }, 600);
nisaUnit("n_cool", { slot: "cool", def: "fridge_uc", list: ["fridge_uc", "freezer_uc", "wine_uc"] }, 600);
def("n_range", "base", [600, 900, 1000, 1200], 600, function (K, h, o) {
  var ap = applById(o.appl || (o.w === 900 ? "range90" : o.w === 1000 ? "range100" : o.w === 1200 ? "range120" : "range60"));
  return { c: nisaOf(K, h, o, "range", ap && ap.id), slots: { range: ap && ap.id } };
}, { slots: ["range"], nisa: true, free: true });
def("x_filler", "base", null, 100, function (K, h, o) {
  return { c: nisaOf(K, h, o, "filler", null) };
}, { nisa: true, free: false });
def("x_end", "base", null, 19, function (K, h, o) {
  return { c: nisaOf(K, h, Object.assign({}, o, { w: K.t }), "end", null) };
}, { nisa: true });
def("x_gap", "base", null, 600, function (K, h, o) { return { c: null, gap: true }; }, { gap: true });

/* --- COLȚ --- */
def("c_blind", "corner", [900, 1000, 1100, 1200], 1000, function (K, h, o) {
  var W = o.w, dw = Math.min(num(o.doorW, 500), W - 300), side = o.side === "right" ? "right" : "left";
  /* ușa pe partea liberă; partea orbă e acoperită de primul corp al peretelui vecin */
  var left = side === "left";
  var c = mk(geomBase(K, h), W, [{ k: "open", sh: 1 }]);
  var comp = { c: c, blind: { side: side, doorW: dw }, notes: ["kuBlindNote"], mech: o.mech || "none" };
  return comp;
}, { opts: { mech: ["none", "lemans", "magic"], side: ["left", "right"] }, slots: [] });
def("c_l", "corner", [900, 1000], 900, function (K, h, o) {
  var W = o.w;
  var c = { type: "angolare", L: W, L2: W, H: h.baseH, P: K.depthBase, plinth: h.plinth, support: "zoccolo",
            tram: 0, shelves: o.mech === "carousel" ? 0 : 1, drawers: 0, doors: 1, back: 1, hang: 0,
            corner: o.side === "left" ? "sx" : "dx", cornerKind: "int", handles: K.handles };
  return { c: c, wing: { reach: K.depthBase + K.t + W }, notes: ["kuLNote"], mech: o.mech || "none" };
}, { opts: { mech: ["none", "carousel"], side: ["left", "right"] }, wingB: true });

/* --- PENSILE --- */
function wallBays(K, o, kind) {
  var hh = num(o.h, K.wallH), sh = hh >= 900 ? 3 : hh >= 600 ? 2 : hh >= 400 ? 1 : 0;
  return [{ k: kind, n: o.doors || "auto", sh: o.sh != null ? o.sh : sh }];
}
def("w_door", "wall", [300, 400, 450, 500, 600, 700, 800, 900, 1000, 1200], 600, function (K, h, o) {
  return { c: mk(geomWall(K, o), o.w, wallBays(K, o, "doors")) };
}, { opts: { h: [360, 480, 600, 720, 900, 1000] } });
def("w_open", "wall", W_BASE, 600, function (K, h, o) {
  return { c: mk(geomWall(K, o), o.w, [{ k: "open", sh: num(o.sh, 1) }]) };
}, { opts: { h: [360, 480, 600, 720, 900] } });
def("w_glass", "wall", [400, 450, 500, 600, 800, 900], 600, function (K, h, o) {
  return { c: mk(geomWall(K, o), o.w, [{ k: "doors", n: o.doors || "auto", sh: num(o.sh, 1) }], { front: "vetro" }), glass: true };
}, { opts: { h: [480, 600, 720, 900] } });
def("w_hood", "wall", [600, 900], 600, function (K, h, o) {
  /* pensilă pentru hotă telescopică: corp scund, hota intră în partea de jos, front rabatabil */
  var ap = applById(o.hood || (o.w >= 900 ? "hood_tele90" : "hood_tele60"));
  var hh = num(o.h, 360);
  var c = mk(geomWall(K, { h: hh }), o.w, [{ k: "doors", n: 1, sh: 0 }]);
  return { c: c, slots: { hood: ap && ap.id }, hood: { ap: ap && ap.id, y: 0 } };
}, { slots: ["hood"], opts: { h: [320, 360, 480] }, hoodUnit: true });
def("w_hoodspace", "wall", [600, 900], 600, function (K, h, o) {
  var ap = applById(o.hood || (o.w >= 900 ? "hood_chim90" : "hood_chim60"));
  return { c: { type: "nisa", mode: "hood", L: o.w, H: ap ? ap.h : 900, P: ap ? ap.d : 500, plinth: 0, support: "sospeso",
                appl: ap && ap.id, mount: "incasso", bottom: o.bottom != null ? +o.bottom : null },
           slots: { hood: ap && ap.id }, hood: { ap: ap && ap.id }, spaceOnly: true };
}, { slots: ["hood"], hoodSpace: true, nisa: true });
def("w_corner", "wall", [600, 700], 600, function (K, h, o) {
  /* pensilă de colț cu ușă pe o singură parte (cealaltă e orbă); lățimea e a peretelui, adâncimea = a pensilelor */
  return { c: mk(geomWall(K, o), o.w, [{ k: "doors", n: 1, sh: 2, hinge: o.side === "right" ? "right" : "left" }]), notes: ["kuWallCornerNote"] };
}, { opts: { side: ["left", "right"], h: [720, 900] } });

/* --- COLOANE --- */
def("t_pantry", "tall", [300, 400, 450, 500, 600, 800], 600, function (K, h, o) {
  return { c: mk(geomTall(K, h), o.w, [{ k: "doors", n: o.doors || "auto", sh: num(o.sh, 4) }]) };
});
def("t_pull", "tall", [300, 400, 450, 500, 600], 450, function (K, h, o) {
  return { c: mk(geomTall(K, h), o.w, [{ k: "drawers", n: num(o.n, 5) }]), notes: ["kuPullNote"] };
});
def("t_oven", "tall", [600], 600, function (K, h, o) {
  var ov = o.oven || "oven60", mic = o.micro || null;
  var bays = [{ k: "drawers", n: 2, h: num(o.drH, 440) }, { k: "niche", appl: ov, mount: "incasso" }];
  if (mic) bays.push({ k: "niche", appl: mic, mount: "incasso" });
  bays.push({ k: "doors", n: "auto", sh: 1 });
  return { c: mk(geomTall(K, h), o.w, bays), slots: mic ? { oven: ov, micro: mic } : { oven: ov } };
}, { slots: ["oven", "micro"] });
def("t_fridge", "tall", [600], 600, function (K, h, o) {
  var fr = o.fridge || "fridge178";
  return { c: mk(geomTall(K, h), o.w, [{ k: "niche", appl: fr, mount: "scomparsa" }, { k: "doors", n: "auto", sh: 0 }]), slots: { fridge: fr } };
}, { slots: ["fridge"] });
def("t_fridgefz", "tall", [600], 600, function (K, h, o) {
  var f1 = o.freezer || "freezer88", f2 = o.fridge || "fridge122";
  return { c: mk(geomTall(K, h), o.w, [{ k: "niche", appl: f1, mount: "scomparsa" }, { k: "niche", appl: f2, mount: "scomparsa" }, { k: "doors", n: "auto", sh: 0 }]),
           slots: { freezer: f1, fridge: f2 } };
}, { slots: ["freezer", "fridge"] });
def("t_washer", "tall", [640, 650], 640, function (K, h, o) {
  var wa = o.washer || "washer60_total", dr = o.dryer || null;
  var bays = [{ k: "niche", appl: wa, mount: "scomparsa" }];
  if (dr) bays.push({ k: "niche", appl: dr, mount: "scomparsa" });
  bays.push({ k: "doors", n: "auto", sh: 1 });
  return { c: mk(geomTall(K, h), o.w, bays), slots: dr ? { washer: wa, dryer: dr } : { washer: wa } };
}, { slots: ["washer", "dryer"] });

/* =====================================================================
   buildUnit — o unitate → cfg pentru motor + ce știe doar bucătăria
   ===================================================================== */
function buildUnit(Kin, type, opts) {
  var K = mergeK(Kin), h = heights(K), u = UNITS[type], o = opts || {};
  var errors = h.errors.slice(), warnings = h.warnings.slice();
  if (!u) { errors.push({ k: "kuUnknown", id: type }); return { errors: errors, warnings: warnings }; }
  var w = num(o.w, u.w0);
  if (u.ws && u.ws.indexOf(w) < 0 && !o.freeWidth) warnings.push({ k: "kuOddWidth", w: w });
  if (!(w > 0)) { errors.push({ k: "kuBadDims" }); return { errors: errors, warnings: warnings }; }
  var oo = {}; for (var k in o) oo[k] = o[k]; oo.w = w;
  var r = u.build(K, h, oo);
  if (r.errors) errors = errors.concat(r.errors);
  /* nișa își ia lățimea din aparat (golul cerut), nu din rând */
  if (r.c && r.c.type === "nisa" && r.c.L && u.nisa && u.slots.length && r.c.mode === "app") w = r.c.L;
  var res = { type: type, cat: u.cat, w: w, errors: errors, warnings: warnings, notes: r.notes || [], slots: r.slots || {}, mech: r.mech || null,
              gap: !!r.gap, nisa: !!u.nisa, hood: r.hood || null, blind: r.blind || null, wing: r.wing || null, spaceOnly: !!r.spaceOnly,
              lift: 0, row: u.cat === "wall" ? "upper" : "floor", appliances: [], cfg: null };
  if (u.cat === "wall") res.lift = K.wallBottom;
  if (r.gap || errors.length) return res;
  var c = r.c;
  if (c.type === "nisa") {
    c.appliances = nisaAppliances(K, h, c);
    res.cfg = c; res.appliances = c.appliances;
    res.depthOut = c.P;
    return res;
  }
  if (c.type === "angolare") { res.cfg = c; res.depthOut = c.P + K.t; return res; }
  var comp = compose(K, c);
  if (comp.errors && comp.errors.length) { res.errors = errors.concat(comp.errors); return res; }
  res.warnings = warnings.concat(comp.warnings || []);
  res.cfg = comp.cfg; res.bays = comp.bays; res.appliances = comp.appliances;
  res.cfg.appliances = comp.appliances;
  res.depthOut = c.P + K.t;
  /* hota telescopică stă în partea de jos a pensilei */
  if (res.hood && res.hood.ap) {
    var ap = applById(res.hood.ap);
    if (ap) res.cfg.appliances = res.appliances = [{ id: ap.id, kind: "hood", mount: "scomparsa", bay: 0, x: r1((c.W - ap.w) / 2), y: K.t, z: 0, w: ap.w, h: ap.h, d: ap.d }];
  }
  /* decupaje pentru blat, din aparatele-slot */
  res.cutouts = cutoutsOf(u, res.slots);
  /* mecanism de colț: nu se desenează, se listează */
  if (r.blind) {
    var W = c.W, dw = r.blind.doorW, left = r.blind.side === "left";
    /* ușa pe partea liberă: înlocuim golul orb cu o ușă de lățime dw */
    var gO = K.gapOut, y0 = c.plinth + gO, hh = c.H - y0 - gO;
    var x0 = left ? gO : W - gO - (dw - 2 * gO);
    res.cfg.fronts = [{ x: r1(left ? gO : W - dw + gO), y: r1(c.plinth + K.gapIn), w: r1(dw - 2 * gO), h: r1(c.H - c.plinth - K.gapIn - gO), hinge: left ? "right" : "left" }];
  }
  return res;
}

function cutoutsOf(u, slots) {
  var out = [];
  ["hob", "sink"].forEach(function (kind) {
    var ap = slots && slots[kind] ? applById(slots[kind]) : null;
    if (ap && ap.cut) out.push({ kind: kind, id: ap.id, w: ap.cut.w, d: ap.cut.d, r: ap.cut.r });
  });
  return out;
}

/* aparatele modulului `nisa`, în coordonate locale (x lățime, y de la pardoseală, z de la perete) */
function nisaAppliances(K, h, c) {
  var ap = c.appl ? applById(c.appl) : null; if (!ap) return [];
  if (c.mode === "hood") {
    var yb = c.bottom != null ? c.bottom : 0;
    return [{ id: ap.id, kind: "hood", mount: "incasso", bay: 0, x: r1((c.L - ap.w) / 2), y: 0, z: 0, w: ap.w, h: ap.h, d: ap.d }];
  }
  var yTop = c.mode === "range" ? ap.h : Math.min(ap.h, c.H);
  var y0 = c.mode === "range" ? 0 : (c.plinth > 0 && ap.kind !== "range" ? c.plinth - 0 : 0);
  /* aparatul sub blat: stă pe pardoseală (soclul e al mobilei, nu al aparatului) */
  return [{ id: ap.id, kind: ap.kind, mount: c.mount || ap.mounts[0], bay: 0, x: r1((c.L - ap.w) / 2), y: 0, z: 0, w: ap.w, h: r1(Math.min(ap.h, c.H)), d: ap.d }];
}

/* =====================================================================
   RÂNDURI: coloane pe pereți (jos + sus), poziții, rest, colțuri, blat
   ---------------------------------------------------------------------
   spec: { walls:[{ id, L, cols:[{ id, type, w, opts, up:{ type, opts } }] }],
           corners:[{ through:"first"|"second", kind:"butt"|"l" }]  // între perete k și k+1
           wtJoint:"butt"|"mitre" }
   ===================================================================== */
function planKitchen(Kin, spec, built) {
  var K = mergeK(Kin), h = heights(K), errors = h.errors.slice(), warnings = h.warnings.slice();
  var walls = (spec && spec.walls) || [], corners = (spec && spec.corners) || [];
  var out = { walls: [], errors: errors, warnings: warnings, heights: h };
  var depthFloor = K.depthBase + K.t, depthUp = K.depthWall + K.t;
  /* adâncimea reală a fiecărui rând, ca să știm cât ocupă pe peretele vecin */
  walls.forEach(function (w, i) {
    var prev = i > 0 ? corners[i - 1] || {} : null, next = i + 1 < walls.length ? corners[i] || {} : null;
    var L = num(w.L, 0);
    var reachNext = 0, reachPrev = 0;
    var cols = (w.cols || []);
    var floorStart = 0, floorEnd = L, upStart = 0, upEnd = L;
    /* colț drept: peretele care „trece” ajunge în colț, celălalt începe/se termină la adâncimea lui.
       colț în L (`kind:"l"`): unitatea în L e a peretelui `through` și își sprijină aripa B pe celălalt perete,
       pe `reach` mm (adâncime + t + L2) — acolo începe (sau se termină) rândul vecin. */
    if (prev) {
      var thp = prev.through || "first";
      if (prev.kind === "l") { if (thp === "first") { floorStart = num(prev.reach, depthFloor); upStart = depthUp; } }
      else if (thp === "first") { floorStart = depthFloor; upStart = depthUp; }
    }
    if (next) {
      var thn = next.through || "first";
      if (next.kind === "l") { if (thn === "second") { floorEnd = L - num(next.reach, depthFloor); upEnd = L - depthUp; } }
      else if (thn === "second") { floorEnd = L - depthFloor; upEnd = L - depthUp; }
    }
    var x = floorStart, xu = upStart, items = [], upItems = [];
    cols.forEach(function (c, k) {
      var b = built && built[c.id] ? built[c.id] : null;
      var wd = num(c.w, b ? b.w : 0);
      items.push({ col: c, id: c.id, from: r1(x), w: wd, to: r1(x + wd), unit: b });
      x += wd;
    });
    /* rândul de sus urmează aceleași coloane, dar în coordonatele lui (poate începe mai târziu) */
    var xx = floorStart;
    cols.forEach(function (c) {
      var wd = num(c.w, 0);
      if (c.up && c.up.type) {
        var ub = built && built[c.id + ":up"] ? built[c.id + ":up"] : null;
        upItems.push({ col: c, id: c.id + ":up", from: r1(xx), w: wd, to: r1(xx + wd), unit: ub, type: c.up.type });
      }
      xx += wd;
    });
    var rest = r1(floorEnd - x);
    var item = { wall: w.id, L: L, floorStart: r1(floorStart), floorEnd: r1(floorEnd), items: items, upper: upItems, rest: rest };
    if (rest < -0.5) errors.push({ k: "kpOver", wall: i + 1, mm: r1(-rest) });
    else if (rest > 0.5 && cols.length) warnings.push({ k: "kpRest", wall: i + 1, mm: rest });
    /* sus: nu trece peste capătul de sus al peretelui */
    upItems.forEach(function (u) {
      if (u.to > upEnd + 0.5 && u.from < upEnd) warnings.push({ k: "kpUpOver", wall: i + 1, mm: r1(u.to - upEnd) });
      if (u.from < upStart - 0.5) warnings.push({ k: "kpUpCorner", wall: i + 1, mm: r1(upStart - u.from) });
    });
    out.walls.push(item);
  });
  /* hotă / plită: distanța și poziția */
  out.hoods = hoodChecks(K, out.walls);
  out.hoods.forEach(function (c) { if (c.warn) warnings.push(c.warn); });
  /* aparate: lista pentru deviz/comandă */
  out.appliances = applianceList(out.walls);
  return out;
}

function hoodChecks(K, wallsOut) {
  var res = [];
  wallsOut.forEach(function (wo, wi) {
    wo.items.forEach(function (it) {
      var u = it.unit; if (!u || !u.slots || !u.slots.hob) return;
      var hobAp = applById(u.slots.hob); if (!hobAp) return;
      var need = (root.HOOD_CLEAR || { elec: 650, gas: 750 })[hobAp.fuel === "gas" ? "gas" : "elec"];
      var up = wo.upper.filter(function (x) { return x.col === it.col; })[0];
      var hoodAp = up && up.unit && up.unit.slots && up.unit.slots.hood ? applById(up.unit.slots.hood) : null;
      var r = { wall: wi + 1, col: it.id, need: need, hob: hobAp.id, hood: hoodAp ? hoodAp.id : null };
      if (!up || !up.unit) { r.warn = { k: "khNoHood", wall: wi + 1 }; res.push(r); return; }
      if (!hoodAp) {
        /* pensilă fără hotă deasupra plitei: distanța până la pensilă */
        var gapUp = K.wallBottom - K.workH;
        r.dist = r1(gapUp);
        if (gapUp < need - 0.01) r.warn = { k: "khClear", wall: wi + 1, have: r.dist, need: need };
        res.push(r); return;
      }
      /* hotă: partea ei de jos */
      var bottom = hoodAp.sub === "chimney" || hoodAp.sub === "canopy" ? (up.unit.cfg && up.unit.cfg.bottom != null ? up.unit.cfg.bottom : Math.max(K.workH + need, K.wallBottom)) : K.wallBottom;
      r.bottom = r1(bottom); r.dist = r1(bottom - K.workH);
      if (r.dist < need - 0.01) r.warn = { k: "khClear", wall: wi + 1, have: r.dist, need: need };
      if (hoodAp.w < hobAp.w - 0.01) r.warn2 = { k: "khNarrow", wall: wi + 1, hood: hoodAp.w, hob: hobAp.w };
      res.push(r);
    });
  });
  return res;
}

function applianceList(wallsOut) {
  var cnt = {}, order = [];
  wallsOut.forEach(function (wo) {
    wo.items.concat(wo.upper).forEach(function (it) {
      var u = it.unit; if (!u) return;
      var ids = {};
      (u.appliances || []).forEach(function (a) { ids[a.id] = a.mount; });
      for (var s in (u.slots || {})) if (u.slots[s] && !ids[u.slots[s]]) ids[u.slots[s]] = null;
      for (var id in ids) {
        var ap = applById(id); if (!ap) continue;
        var key = id + "|" + (ids[id] || "");
        if (!cnt[key]) { cnt[key] = { id: id, kind: ap.kind, mount: ids[id] || ap.mounts[0], n: 0 }; order.push(key); }
        cnt[key].n++;
      }
    });
  });
  return order.map(function (k) { return cnt[k]; });
}

/* =====================================================================
   BLATUL bucătăriei: spec-urile de blat din rânduri
   ---------------------------------------------------------------------
   Un blat acoperă rândul de jos de pe pereți consecutivi; un aragaz liber
   (`range`) îl desparte în două. Decupajele (plită, chiuvetă) vin din unități:
   x = centrul pe perete. Rezultatul e în forma pe care o așteaptă `wtApply`
   (`mods`, `cutouts`, `through`), plus tipul de îmbinare.
   ===================================================================== */
function worktopSpecs(Kin, spec, plan, names) {
  var K = mergeK(Kin), out = [], run = null;
  var walls = plan.walls;
  function flush() { if (run && run.mods.length) out.push(run); run = null; }
  function start() { return { mods: [], cutouts: [], walls: [], through: [], joint: (spec && spec.wtJoint) === "mitre" ? "mitre" : "butt", thick: K.topT }; }
  walls.forEach(function (wo, wi) {
    var corner = wi > 0 ? ((spec.corners || [])[wi - 1] || {}) : null;
    if (wi > 0 && run) {
      /* între pereți: continuă dacă ambele au corpuri jos */
      run.through.push((corner && corner.through === "second") ? "second" : "first");
    } else if (wi > 0) { run = null; }
    wo.items.forEach(function (it) {
      var u = it.unit, name = names && names[it.id];
      if (!u || u.gap || !name) { if (u && u.gap) flush(); return; }
      if (u.cfg && u.cfg.type === "nisa" && u.cfg.mode === "range") { flush(); return; }
      if (u.cat === "tall" || (u.cfg && u.cfg.H > K.workH)) { return; }   /* coloanele nu poartă blat */
      if (!run) run = start();
      run.mods.push(name);
      if (run.walls.indexOf(wi) < 0) run.walls.push(wi);
      (u.cutouts || []).forEach(function (c) {
        run.cutouts.push({ kind: c.kind, wall: wi, wallId: wo.wall, x: r1(it.from + it.w / 2), w: c.w, d: c.d, r: c.r, id: c.id });
      });
    });
  });
  flush();
  return out;
}

/* =====================================================================
   Îmbinarea de colț „la 45° cu freza” (D-142)
   ---------------------------------------------------------------------
   Pe lângă îmbinarea dreaptă (D-73), blatul poate fi tăiat la 45° în colț:
   fiecare piesă se termină cu un capăt înclinat, lungimea măsurată pe muchia
   din spate (cea lungă). Ambele piese pierd la capăt `P`, adâncimea blatului
   vecin, pe față; pe dedesubt, freza face tot locașurile pentru șuruburi,
   dar paralele cu linia îmbinării. Grosimea o dă materialul.
   Aici: doar cota de pierdere pe față și lungimea muchiei îmbinării.
   ===================================================================== */
function mitreGeometry(Pa, Pb) {
  /* două piese de adâncimi Pa, Pb se întâlnesc la 90°; linia îmbinării la 45° are
     lungimea √(Pa²+Pb²) numai dacă Pa = Pb; la adâncimi diferite, rămâne 45°
     dacă piesa mai adâncă se retează la lungimea celei mai mici (regula atelierului) */
  var P = Math.min(Pa, Pb);
  return { P: P, edge: r1(P * Math.SQRT2), setback: r1(Math.abs(Pa - Pb)) };
}

var API = { K_DEFAULTS: K_DEFAULTS, KITCHEN_UNITS: UNITS, kitchenHeights: heights, composeBays: compose, buildUnit: buildUnit,
            planKitchen: planKitchen, worktopSpecs: worktopSpecs, kitchenApplById: applById, kitchenApplList: applList,
            mitreGeometry: mitreGeometry, kitchenMerge: mergeK };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
