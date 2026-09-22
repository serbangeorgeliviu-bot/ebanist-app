/* Il motore, caricato una volta sola per tutti i casi golden.
   Si valuta il file VERO — ebanist-core.js e i blocchi veri di /app/js/ —
   non una copia: un golden che gira su una copia certifica la copia.
   Il taglio dei blocchi e la lettura dei sorgenti stanno in un posto solo,
   ../engine.js: erano tre copie della stessa funzione, e la prima volta che
   l'app si e spostata sono scivolate via tutte e tre insieme. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { appSource, geometryOf } = require("../engine.js");
const APP = path.resolve(__dirname, "..", "..", "app");

let _s = null;
function engine() {
  if (_s) return _s;
  const s = { console, Math, Number, String, Array, Object, JSON, isFinite, parseInt, parseFloat };
  s.globalThis = s; s.t = k => k; s.state = { lang: "it", settings: {} };
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(path.join(APP, "ebanist-core.js"), "utf8"), s, { filename: "ebanist-core.js" });
  vm.runInContext(geometryOf(appSource()), s, { filename: "app/js/*.js" });
  return (_s = s);
}

/* La distinta di un caso, ridotta a quello che conta in segheria.
   `Array.from` / `Object.assign`: gli oggetti escono dal contesto del motore
   e portano i suoi prototipi. */
function runCase(cs) {
  const s = engine();
  s.state.settings = JSON.parse(JSON.stringify(cs.settings));
  const cfg = JSON.parse(JSON.stringify(cs.cfg));
  const r = s.buildModule(cfg);
  /* I CONTROLLI GIRANO SUI PEZZI INTERI. La riduzione qui sotto serve a
     rendere il file golden leggibile da un falegname; farla prima
     toglierebbe `axis_mapping` e i controlli misurerebbero il vuoto —
     e passerebbero, dicendo che va tutto bene. */
  const full = Array.from(r.pieces).map(x => Object.assign({}, x));
  const pieces = full.map(x => {
    const a = x.axis_mapping;
    const o = { elemento: x.elemento, role: x.role || null,
                /* gli assi in una stringa sola: leggibile, e protetti lo
                   stesso — se qualcuno li scambia, il golden cade */
                ax: a ? (a.lung + "/" + a.larg + "/" + a.sp) : null,
                lung: x.lung, larg: x.larg, pz: x.pz, sp: (x.sp != null ? x.sp : null),
                bordo: x.bordo || "" };
    if (x.wing) o.wing = x.wing;
    if (x.shape) o.shape = x.shape;
    if (x.ys) o.ys = Array.from(x.ys);
    if (x.seg) o.seg = x.seg.i + "/" + x.seg.n;
    if (x.curve) o.curve = { dev: x.curve.dev, corda: x.curve.corda || null };
    if (x.mat) o.mat = x.mat;
    return o;
  });
  /* le cote derivate e i controlli, per i casi a cassa */
  let geom = null, chiusura = null, invarianti = null;
  const CASSA = ["standard", "scorrevole", "angolare"];
  if (CASSA.indexOf(cfg.type) >= 0) {
    const G = s.deriveCarcass(s.carcassParams(cfg, {}));
    const M = s.carcassMaterials(cfg);
    geom = { L_int: G.L_int, H_int: G.H_int, P_int: G.P_int,
             tip_schienale: G.tip_schienale, sp: Object.assign({}, G.sp),
             sectiune_W: G.sectiune_W, rezerva_glisiera: G.rezerva_glisiera };
    const wings = (cfg.type === "angolare")
      ? [[Object.assign({}, cfg), full.filter(p => p.wing === "A" || !p.wing)],
         [Object.assign({}, cfg, { L: Math.max(300, cfg.L2 || 900) }), full.filter(p => p.wing === "B")]]
      : [[cfg, full]];
    chiusura = []; invarianti = [];
    for (const [corpo, rows] of wings) {
      if (!rows.length) continue;
      const Gw = s.deriveCarcass(s.carcassParams(corpo, {}));
      for (const e of Array.from(s.validateCarcassClosure(corpo, rows, Gw)))
        chiusura.push({ axa: e.axa, chain: e.chain, delta: e.delta });
      const ths = [...new Set(Object.values(M.sp).concat(rows.map(p => p.sp)).filter(v => v > 0))];
      for (const r2 of Array.from(s.failedInvariants(corpo, rows, Gw, { materials: M.mats, thicknesses: ths })))
        invarianti.push({ id: r2.id, regola: r2.regola });
    }
  }
  return { pieces, geom, chiusura, invarianti };
}
module.exports = { engine, runCase };
