/* Ebanist — caricatore del motore geometrico per le prove golden.
 *
 * Due motori, la stessa interfaccia:
 *   coreEngine()   -> ebanist-core.js (motore v2, deriveCarcass)
 *   legacyEngine() -> le funzioni di geometria estratte da index.html (motore v1)
 *
 * Il motore v1 non ha una funzione di derivazione: le cote esistono solo
 * dentro la distinta. L'adattatore qui sotto le rilegge da li, cosi le stesse
 * prove girano su tutti e due e si vede esattamente quali cadono su v4.23.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* --- motore v1: estratto da index.html ------------------------------------
   Non si duplica il codice: si leggono le righe vere del file pubblicato.
   Se qualcuno sposta un blocco, la prova si spegne subito invece di misurare
   una copia vecchia. Gli intervalli sono ancorati ai commenti di sezione. */
function sliceBetween(lines, startRe, endRe, from) {
  let a = -1;
  for (let i = from || 0; i < lines.length; i++) if (startRe.test(lines[i])) { a = i; break; }
  if (a < 0) throw new Error("blocco non trovato: " + startRe);
  for (let j = a + 1; j < lines.length; j++) if (endRe.test(lines[j])) return { a, b: j, text: lines.slice(a, j).join("\n") };
  throw new Error("fine blocco non trovata: " + endRe);
}

let _legacy = null;
function legacyEngine() {
  if (_legacy) return _legacy;
  const lines = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").split("\n");
  const S = (start, end, from) => sliceBetween(lines, start, end, from).text;
  const code = [
    S(/^const MATDB=\[/, /^function matPriceByLabel\(/),                 // catalogo materiali + matById
    S(/^\/\* ================= CALCULATIONS/, /^\/\* ================= NESTING/),
    S(/^\/\* ================= PEZZI TRAPEZOIDALI/, /^\/\* ================= SISTEMI CASSETTO/),
    S(/^\/\* ================= SISTEMI CASSETTO/, /^function buildCore\(/),
    S(/^function buildCore\(/, /^\/\* --- dispatch: standard/),
    S(/^function buildModule\(/, /^\/\* --- 3D perspective renderer/),
    S(/^function hingeInfo\(/, /^function assemblySteps\(/)
  ].join("\n");
  const sandbox = { console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat };
  sandbox.t = k => k;
  sandbox.state = { lang: "it", settings: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "index.html (estratto)" });
  _legacy = sandbox;
  return sandbox;
}

/* --- motore v2 ----------------------------------------------------------- */
function coreEngine() {
  const f = path.join(ROOT, "ebanist-core.js");
  if (!fs.existsSync(f)) return null;
  delete require.cache[require.resolve(f)];
  return require(f);
}

/* --- parametri di prova -> cfg del motore v1 ------------------------------ */
const MM = (id, th) => ({ id, l: { it: id }, th, price: 1, c: "#eeeeee", tx: "solid", pw: 2800, ph: 2070 });

function legacyDerive(p) {
  const E = legacyEngine();
  const tF = p.t_fianco, tB = p.t_back;
  E.state.settings = {
    panelL: 2800, panelW: 2070, kerf: 4,
    matBody: "__body", matFront: "__body", matBack: "__back",
    matOvr: {}, matAdd: [MM("__body", tF), MM("__back", tB)]
  };
  const cfg = {
    type: "standard", L: p.W, H: p.H, P: p.D, t: tF,
    plinth: p.piedini > 0 ? p.h_picior : p.h_zoccolo,
    support: p.piedini > 0 ? "piedini" : "zoccolo",
    tram: 0, shelves: p.n_ripiani || 0, drawers: 0, doors: p.n_ante || 0,
    back: p.t_back > 0 ? 1 : 0, hang: 0, shelfType: "mobile",
    matBody: "__body", matFront: "__body", matBack: "__back"
  };
  const out = E.buildModule(cfg);
  const find = re => out.pieces.find(x => re.test(x.elemento));
  const fianco = find(/^Fianco/), bc = find(/^Base \/ Cielo/), zoc = find(/^Zoccolo/),
        rip = find(/^Ripiano/), anta = find(/^Anta/), sch = find(/^Schienale/);
  const anta_H = anta ? anta.lung : undefined;
  return {
    _engine: "v1 (index.html)",
    Wi: bc ? bc.lung : undefined,
    D_fianco: fianco ? fianco.larg : undefined,
    H_fianco: fianco ? fianco.lung : undefined,
    D_bc: bc ? bc.larg : undefined,
    back_W: sch ? sch.larg : undefined,
    back_H: sch ? sch.lung : undefined,
    ripiano_W: rip ? rip.lung : undefined,
    ripiano_D: rip ? rip.larg : undefined,
    zoccolo_W: zoc ? zoc.lung : undefined,
    zoccolo_H: zoc ? zoc.larg : undefined,
    anta_W: anta ? anta.larg : undefined,
    anta_H,
    /* il motore v1 non conosce reveal ne le cote di montaggio dell'anta:
       non esistono da nessuna parte, nemmeno implicite. */
    reveal: undefined, anta_y0: undefined, anta_y1: undefined,
    cerniere: anta_H != null ? E.hingePositions(anta_H, p.n_cerniere || 0) : undefined,
    pieces: out.pieces
  };
}

function coreDerive(p) {
  const C = coreEngine();
  if (!C) return null;
  const r = C.deriveCarcass(p);
  r._engine = "v2 (ebanist-core.js)";
  return r;
}

/* Quale motore misuriamo: EBANIST_ENGINE=legacy forza il v1. */
function derive(p) {
  if (process.env.EBANIST_ENGINE === "legacy") return legacyDerive(p);
  return coreDerive(p) || legacyDerive(p);
}
function engineName() {
  return (process.env.EBANIST_ENGINE === "legacy" || !coreEngine())
    ? "v1 (index.html, motore 4.23)" : "v2 (ebanist-core.js)";
}

module.exports = { legacyEngine, coreEngine, legacyDerive, coreDerive, derive, engineName, MM };
