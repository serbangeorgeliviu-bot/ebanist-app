/* Ebanist — ajutor pentru testele sistemelor de sertar din ebanist-drawers-more.js: încarcă datele, logica și textele în sandbox-ul motorului
 * ÎNAINTEA geometriei din index.html (DRAWSYS le preia la încărcare), apoi construiește corpuri.
 *
 * engine.js încarcă motorul o singură dată (appEngine, memorat). Sandbox-ul de aici e propriul lui: același procedeu, cu cele trei fișiere în plus
 * puse imediat după ebanist-core.js (SLIDE_CATALOG trebuie să existe când drawers-more se încarcă).
 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const APP = path.join(__dirname, "..", "app");
const read = f => fs.readFileSync(path.join(APP, f), "utf8");

function load(withMore, htmlOverride) {
  const s = { console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat };
  s.globalThis = s;
  s.t = k => k;
  s.state = { lang: "it", settings: {} };
  vm.createContext(s);
  const run = (f, src) => vm.runInContext(src == null ? read(f) : src, s, { filename: f });
  run("ebanist-core.js");
  if (fs.existsSync(path.join(APP, "ebanist-lambriu.js"))) run("ebanist-lambriu.js");
  run("ebanist-contour.js");
  run("ebanist-lift.js");
  if (withMore) ["ebanist-drawers-more-data.js", "ebanist-drawers-more.js"].forEach(f => run(f));
  /* geometria din index.html, aceleași felii ca engine.js (nu se duplică codul) */
  const html = htmlOverride || read("index.html"), L = html.split("\n");
  const cut = (a, b) => { let i = L.findIndex(l => a.test(l)); if (i < 0) throw new Error("bloc negăsit " + a); for (let j = i + 1; j < L.length; j++) if (b.test(L[j])) return L.slice(i, j).join("\n"); throw new Error("sfârșit negăsit " + b); };
  const geo = [
    cut(/^const MAT_SOURCES=/, /^function matPriceByLabel\(/),
    cut(/^\/\* ================= CALCULATIONS/, /^\/\* ================= NESTING/),
    cut(/^const MAT_ACC=/, /^\/\* ================= PEZZI TRAPEZOIDALI/),
    cut(/^\/\* ================= PEZZI TRAPEZOIDALI/, /^\/\* ================= SISTEMI CASSETTO/),
    cut(/^\/\* ================= SISTEMI CASSETTO/, /^function buildCore\(/),
    cut(/^function buildCore\(/, /^\/\* --- dispatch: standard/),
    cut(/^function buildModule\(/, /^\/\* --- 3D perspective renderer/),
    cut(/^function hingeInfo\(/, /^function assemblySteps\(/)
  ].join("\n");
  /* DRAWSYS_IDS se completează în index.html (blocul «sisteme de sertar noi»): fără aceleași feliere nu l-am vedea, deci îl rulăm și pe el */
  run("app/index.html", geo);
  /* index.html expune `slideGuidaId` (în afara feliilor): glisiera corpului — sistemul metalic o poartă cu el, la lemn comandă catalogul */
  run("slideGuidaId", 'globalThis.slideGuidaId=function(cfg){const sys=drawSys((cfg&&cfg.drawerSys)||"legno");const own=cfg&&cfg.hwSel&&cfg.hwSel.guida;return (sys.metal&&sys.guida)?sys.guida:own?own:(((state.settings||{}).hwProd||{}).guida||"blum_tandem");};');
  run("ebanist-ops.js");
  return s;
}

const MM = E.MM;
const SETTINGS = (guida, extra) => Object.assign({ panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
  matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3), MM("pfl5", 5), MM("__b16", 16), MM("__b18", 18)], hwProd: { guida: guida || "blum_tandem" } }, extra || {});
const BASE = { type: "standard", L: 600, H: 720, P: 560, plinth: 100, tram: 0, shelves: 0, drawers: 3, doors: 0, back: 1, hang: 0,
  support: "zoccolo", shelfType: "mobile", drawerDist: "uguali" };

function build(S, cfg, guida, extra) {
  S.state.settings = SETTINGS(guida, extra);
  const full = Object.assign({ name: "X", matBody: "__b", matFront: "__b", matBack: "__k" }, BASE, cfg);
  const b = S.buildModule(full);
  const pieces = b.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(full, {}));
  const arr = x => Array.from(x || []);
  return { b, full, pieces, G, S,
    close: () => arr(S.validateCarcassClosure(full, pieces, G)),
    ko: () => { const M = S.carcassMaterials(full); const ths = [...new Set(Object.values(M.sp).concat(pieces.map(x => x.sp)).filter(x => x > 0))];
      return arr(S.failedInvariants(full, pieces, G, { materials: M.mats, thicknesses: ths })).map(r => r.id); },
    ops: () => JSON.parse(JSON.stringify(S.generateOperations({ boxes: b.boxes, cfg: full, G }))) };
}

const loadHtml = html => load(false, html);
module.exports = { load, loadHtml, build, BASE, SETTINGS, MM, APP, read };
