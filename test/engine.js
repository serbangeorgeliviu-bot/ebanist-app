/* Ebanist — caricatore del motore geometrico per le prove golden.
 *
 * Due motori, la stessa interfaccia:
 *   derive(p)                       -> il motore corrente (ebanist-core.js + index.html)
 *   EBANIST_ENGINE=legacy derive(p) -> il motore 4.23, letto da git
 *
 * Il motore 4.23 non ha una funzione di derivazione: le cote esistono solo
 * dentro la distinta. L'adattatore qui sotto le rilegge da li, cosi le stesse
 * prove girano su tutti e due e si vede esattamente quali cadono e quali no.
 * Il riferimento e il commit di v4.23.0, non una copia incollata: la base di
 * partenza non puo invecchiare da sola.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const V423 = "20357ab";   // v4.23.0 — la distinta sbagliata, quella da battere

/* --- estrazione della geometria da index.html -----------------------------
   Non si duplica il codice: si leggono le righe vere del file. Gli intervalli
   sono ancorati ai commenti di sezione, cosi se qualcuno sposta un blocco la
   prova si spegne subito invece di misurare una copia vecchia. */
function sliceBetween(lines, startRe, endRe) {
  let a = -1;
  for (let i = 0; i < lines.length; i++) if (startRe.test(lines[i])) { a = i; break; }
  if (a < 0) throw new Error("blocco non trovato: " + startRe);
  for (let j = a + 1; j < lines.length; j++) if (endRe.test(lines[j])) return lines.slice(a, j).join("\n");
  throw new Error("fine blocco non trovata: " + endRe);
}

function geometryOf(html) {
  const L = html.split("\n");
  const S = (a, b) => sliceBetween(L, a, b);
  return [
    S(/^const MATDB=\[/, /^function matPriceByLabel\(/),                 // catalogo + matById
    S(/^\/\* ================= CALCULATIONS/, /^\/\* ================= NESTING/),
    S(/^const MAT_ACC=/, /^\/\* ================= PEZZI TRAPEZOIDALI/),   // materiali accessorio
    S(/^\/\* ================= PEZZI TRAPEZOIDALI/, /^\/\* ================= SISTEMI CASSETTO/),
    S(/^\/\* ================= SISTEMI CASSETTO/, /^function buildCore\(/),
    S(/^function buildCore\(/, /^\/\* --- dispatch: standard/),
    S(/^function buildModule\(/, /^\/\* --- 3D perspective renderer/),
    S(/^function hingeInfo\(/, /^function assemblySteps\(/)
  ].join("\n");
}

function newSandbox() {
  const s = { console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat };
  s.globalThis = s;
  s.t = k => k;
  s.state = { lang: "it", settings: {} };
  vm.createContext(s);
  return s;
}

/* --- il motore corrente: ebanist-core.js + la geometria di index.html ------
   Si valuta il file, non si fa require: in radice package.json dichiara
   "type":"module" per la funzione Netlify, mentre ebanist-core.js deve restare
   uno script classico — quello che il browser carica con <script src>.
   Valutarlo cosi prova anche quello. */
let _app = null;
function appEngine() {
  if (_app) return _app;
  const s = newSandbox();
  const core = path.join(ROOT, "ebanist-core.js");
  if (fs.existsSync(core)) vm.runInContext(fs.readFileSync(core, "utf8"), s, { filename: "ebanist-core.js" });
  vm.runInContext(geometryOf(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")), s, { filename: "index.html" });
  return (_app = s);
}
function coreEngine() { const s = appEngine(); return s.deriveCarcass ? s : null; }

/* --- il motore 4.23, letto dal commit --------------------------------- */
let _v1 = null;
function legacyEngine() {
  if (_v1) return _v1;
  const html = execFileSync("git", ["show", V423 + ":index.html"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8");
  const s = newSandbox();
  vm.runInContext(geometryOf(html), s, { filename: "index.html@" + V423 });
  return (_v1 = s);
}

/* --- parametri di prova -> cfg del generatore ----------------------------- */
const MM = (id, th) => ({ id, l: { it: id }, th, price: 1, c: "#eeeeee", tx: "solid", pw: 2800, ph: 2070 });

function cfgOf(p) {
  return {
    type: "standard", L: p.W, H: p.H, P: p.D, t: p.t_fianco,
    plinth: p.piedini > 0 ? p.h_picior : p.h_zoccolo,
    support: p.piedini > 0 ? "piedini" : "zoccolo",
    tram: 0, shelves: p.n_ripiani || 0, drawers: 0, doors: p.n_ante || 0,
    back: p.t_back > 0 ? 1 : 0, hang: 0, shelfType: "mobile",
    matBody: "__body", matFront: "__body", matBack: "__back",
    backMode: p.backMode, geom: p
  };
}
function settingsOf(p) {
  return {
    panelL: 2800, panelW: 2070, kerf: 4,
    matBody: "__body", matFront: "__body", matBack: "__back",
    matOvr: {}, matAdd: [MM("__body", p.t_fianco), MM("__back", p.t_back)]
  };
}

function piecesFrom(E, p) {
  E.state.settings = settingsOf(p);
  return E.buildModule(cfgOf(p)).pieces;
}

/* Le cote del motore 4.23 non esistono come tali: si rileggono dalla distinta.
   Quelle che non compaiono in nessuna riga (reveal, le cote di montaggio
   dell'anta, la foratura) restano `undefined` — non si inventano. */
function legacyDerive(p) {
  const E = legacyEngine();
  const pieces = piecesFrom(E, p);
  const find = re => pieces.find(x => re.test(x.elemento));
  const fianco = find(/^Fianco/), bc = find(/^Base \/ Cielo/), zoc = find(/^Zoccolo/),
        rip = find(/^Ripiano/), anta = find(/^Anta/), sch = find(/^Schienale/);
  const anta_H = anta ? anta.lung : undefined;
  return {
    _engine: "v1 (index.html @ " + V423 + ")",
    Wi: bc && bc.lung, D_fianco: fianco && fianco.larg, H_fianco: fianco && fianco.lung,
    D_bc: bc && bc.larg, back_W: sch && sch.larg, back_H: sch && sch.lung,
    ripiano_W: rip && rip.lung, ripiano_D: rip && rip.larg,
    zoccolo_W: zoc && zoc.lung, zoccolo_H: zoc && zoc.larg,
    anta_W: anta && anta.larg, anta_H,
    reveal: undefined, anta_y0: undefined, anta_y1: undefined, foratura: undefined,
    cerniere: anta_H != null ? E.hingePositions(anta_H, p.n_cerniere || 0) : undefined,
    pieces
  };
}

/* Il motore corrente: le cote le da deriveCarcass, la distinta la da il
   generatore — che deve chiamare deriveCarcass e non ricalcolarsele. */
function coreDerive(p) {
  const C = coreEngine();
  if (!C) return null;
  /* Il motore gira in un contesto suo: array e oggetti che ne escono hanno i
     prototipi di quel contesto, e deepStrictEqual li rifiuterebbe per il
     prototipo invece che per il contenuto. Si riportano di qua. */
  const d = Object.assign({}, C.deriveCarcass(Object.assign({}, C.CARCASS_DEFAULTS, p)));
  d.cerniere = Array.from(d.cerniere || []);
  d.foratura = Object.assign({}, d.foratura);
  d._engine = "v2 (ebanist-core.js)";
  d.pieces = piecesFrom(C, p).map(x => Object.assign({}, x));
  return d;
}

function derive(p) {
  if (process.env.EBANIST_ENGINE === "legacy") return legacyDerive(p);
  return coreDerive(p) || legacyDerive(p);
}
function engineName() {
  if (process.env.EBANIST_ENGINE === "legacy") return "v1 (index.html @ " + V423 + ", motore 4.23)";
  return coreEngine() ? "v2 (ebanist-core.js + index.html)" : "v1 (ebanist-core.js assente)";
}

module.exports = { legacyEngine, appEngine, coreEngine, legacyDerive, coreDerive, derive, engineName, MM, cfgOf, settingsOf };
