/* Ebanist — cote assolute: partizioni, profilo di profondita, ante, decupaje.
 *
 *   node --test test/layout.test.js
 *
 * Il caso vero: un prompt completo, con cote assolute, generava 13 pezzi
 * invece di 16 e quattro ante uguali al posto di due basse e due alte. Le
 * cote non avevano un campo dove atterrare e sparivano senza dire niente.
 *
 * Il criterio di accettazione e la distinta qui sotto, pezzo per pezzo.
 * NOTA sulle cifre del ticket: la tabella del ticket ha 11 righe e 16 pezzi
 * (non 15) e fa 7,40 m² di rettangoli pieni (non ~7,9). La pila verticale
 * 20 + 19 + 1500 + 19 + 342 + 19 + 342 + 19 = 2280 torna solo con il corpo
 * sui piedini da 20: fianco 2260, H complessiva 2280 — ed e cosi che e
 * scritta qui.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;

function settings() {
  S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__b",
    matOvr: {}, matAdd: [MM("__b", 19)], hwProd: { guida: "blum_tandem" } };
}
function build(cfg) {
  settings();
  const out = S.buildModule(cfg);
  const pieces = out.pieces.map(x => Object.assign({}, x));
  const G = S.deriveCarcass(S.carcassParams(cfg, {}));
  return { cfg, out, pieces, G,
    LY: () => S.validateLayout(cfg, G),
    close: () => Array.from(S.validateCarcassClosure(cfg, pieces, G)),
    inv: () => Array.from(S.failedInvariants(cfg, pieces, G, {})) };
}
const errsOf = cfg => { settings(); try { S.buildModule(cfg); return []; } catch (e) { return [e.message]; } };
const clone = o => JSON.parse(JSON.stringify(o));
/* il motore gira in un altro contesto vm: array e oggetti hanno un altro
   prototipo, e deepEqual stretto li direbbe diversi. Si confrontano i dati. */
const J = clone;

/* la configurazione che il parser deve produrre dal prompt della riproduzione */
const JACQUIN = {
  name: "Camera", type: "standard", L: 870, H: 2280, P: 360, plinth: 20, support: "piedini",
  tram: 0, shelves: 0, drawers: 0, doors: 4, back: 1, hang: 0, backMode: "applicato", shelfType: "mobile",
  matBody: "__b", matFront: "__b", matBack: "__b", geom: { setback_ripiano: 10 },
  depthProfile: [{ yFrom: 0, yTo: 620, depth: 250 }, { yFrom: 620, yTo: 2280, depth: 360 }],
  partitions: [
    { type: "setto", x: "center", yStart: 39, yEnd: 1539 },
    { type: "ripiano", y: 1539, span: "full" }, { type: "ripiano", y: 1900, span: "full" },
    { type: "ripiano", y: 620, span: "right" }, { type: "ripiano", y: 926, span: "right" },
    { type: "ripiano", y: 1232, span: "right" }],
  fronts: [
    { x: 0, y: 20, w: 433, h: 1538, hinge: "left" }, { x: 437, y: 20, w: 433, h: 1538, hinge: "right" },
    { x: 0, y: 1561, w: 433, h: 717, hinge: "left" }, { x: 437, y: 1561, w: 433, h: 717, hinge: "right" }],
  customCuts: [
    { on: "fianchi", corner: "back-bottom", w: 110, h: 600 },
    { on: "setti", corner: "back-bottom", w: 110, h: 581 }]
};

/* [nome, lung, larg, pz, quote (faccia inferiore), decupaj l×w] */
const ATTESA = [
  ["Fianco", 2260, 341, 2, null, "600x110"],
  ["Setto", 1500, 341, 1, null, "581x110"],
  ["Base", 832, 231, 1, null, null],
  ["Cielo", 832, 341, 1, null, null],
  ["Ripiano traversante", 830, 331, 2, [1539, 1900], null],
  ["Ripiano dx", 404, 341, 1, [620], null],
  ["Ripiano dx", 404, 331, 2, [926, 1232], null],
  ["Schienale sotto", 870, 600, 1, null, null],
  ["Schienale sopra", 1660, 870, 1, null, null],
  ["Anta", 1538, 433, 2, null, null],
  ["Anta", 717, 433, 2, null, null]
];

describe("Accettazione — corpo Jacquin 870 × 2260 × 360, cote assolute", () => {
  const b = build(JACQUIN);
  const P = b.out.pieces;
  const find = (nm, l, w) => P.find(p => p.elemento === nm && p.lung === l && p.larg === w);

  for (const [nm, l, w, pz, ys, cut] of ATTESA) {
    test(`${nm} ${l} × ${w} — ${pz}`, () => {
      const p = find(nm, l, w);
      assert.ok(p, "manca " + nm + " " + l + "×" + w + " — distinta: " + P.map(x => x.elemento + " " + x.lung + "×" + x.larg).join(", "));
      assert.equal(p.pz, pz);
      if (ys) assert.deepEqual(J(p.yInf), ys);
      const sc = p.scasso ? (Array.isArray(p.scasso) ? p.scasso : [p.scasso]) : [];
      if (cut) {
        assert.equal(sc.length, 1);
        assert.equal(sc[0].l + "x" + sc[0].w, cut);
        assert.equal(sc[0].x, 0); assert.equal(sc[0].y, 0); assert.equal(sc[0].rif, "jos-spate");
      } else assert.equal(sc.length, 0);
    });
  }
  test("nessuna riga in piu: 11 righe, 16 pezzi", () => {
    assert.equal(P.length, ATTESA.length, P.map(x => x.elemento).join(", "));
    assert.equal(P.reduce((s, x) => s + x.pz, 0), 16);
  });
  test("7,40 m² di rettangoli pieni (il decupaj non si sottrae: la fabbrica taglia il rettangolo)", () => {
    const m2 = P.reduce((s, x) => s + x.lung * x.larg * x.pz, 0) / 1e6;
    assert.equal(m2.toFixed(2), "7.40");
  });
  test("le ante stanno alle loro cote: y 20 e y 1561", () => {
    const doors = b.out.boxes.filter(x => x.role === "frontale");
    assert.deepEqual(J(doors.map(d => [d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0]),
      ),
      [[0, 20, 433, 1538], [437, 20, 433, 1538], [0, 1561, 433, 717], [437, 1561, 433, 717]]);
  });
  test("pila verticale e orizzontale, come le scrive il falegname", () => {
    const LY = b.LY();
    assert.deepEqual(J(LY.errors), []);
    assert.equal(LY.chains.V[0].text, "20 + 19 + 1500 + 19 + 342 + 19 + 342 + 19 = 2280");
    assert.ok(LY.chains.V.every(c => c.ok && c.total === 2280));
    assert.equal(LY.chains.H[0].text, "19 + 406.5 + 19 + 406.5 + 19 = 870");
    assert.equal(LY.chains.H[1].text, "19 + 832 + 19 = 870");
  });
  test("chiusura del gabarito a zero e nessun invariante caduto", () => {
    assert.deepEqual(b.close(), []);
    assert.deepEqual(b.inv(), []);
  });
  test("il profilo di profondita diventa il gradino gia collaudato", () => {
    assert.equal(b.G.treapta.activa, true);
    assert.equal(b.G.treapta.H, 620); assert.equal(b.G.treapta.P, 110);
  });
  test("deterministico: due generazioni, la stessa distinta", () => {
    assert.deepEqual(J(build(clone(JACQUIN)).out.pieces), J(P));
  });
  test("i decupaje detti nel testo coincidono con quelli del profilo — e senza il testo escono uguali", () => {
    const c = clone(JACQUIN); delete c.customCuts;
    const p2 = build(c).out.pieces;
    assert.deepEqual(J(p2.map(x => [x.elemento, x.lung, x.larg, x.pz, x.scasso || null])),
                     J(P.map(x => [x.elemento, x.lung, x.larg, x.pz, x.scasso || null])));
  });
});

describe("Validazione — nessuna cota si perde, nessuna si aggiusta in silenzio", () => {
  const withP = (fn) => { const c = clone(JACQUIN); fn(c); return c; };
  const has = (errs, re) => errs.some(e => re.test(e));

  test("ripiano 'right' senza setto a quella cota -> errore", () => {
    const e = errsOf(withP(c => c.partitions.push({ type: "ripiano", y: 2100, span: "right" })));
    assert.ok(has(e, /cere un setto activ/), e.join("\n"));
  });
  test("setto che finisce nel vuoto -> errore", () => {
    const e = errsOf(withP(c => { c.partitions[0].yEnd = 1400; }));
    assert.ok(has(e, /se oprește la 1400/), e.join("\n"));
  });
  test("ripiano traversante che taglia il setto -> errore", () => {
    const e = errsOf(withP(c => c.partitions.push({ type: "ripiano", y: 1000, span: "full" })));
    assert.ok(has(e, /traversant, dar setto/), e.join("\n"));
  });
  test("due ripiani nella stessa fascia -> errore", () => {
    const e = errsOf(withP(c => c.partitions.push({ type: "ripiano", y: 630, span: "right" })));
    assert.ok(has(e, /se suprapun/), e.join("\n"));
  });
  test("ripiano che taglia il gradino -> errore", () => {
    const e = errsOf(withP(c => c.partitions.push({ type: "ripiano", y: 610, span: "left" })));
    assert.ok(has(e, /taie treapta/), e.join("\n"));
  });
  test("ante sovrapposte o fuori dal gabarito -> errore", () => {
    assert.ok(has(errsOf(withP(c => { c.fronts[1].x = 400; })), /se suprapun/));
    assert.ok(has(errsOf(withP(c => { c.fronts[3].h = 800; })), /iese din gabarit/));
  });
  test("decupaj del testo diverso da quello del profilo -> errore", () => {
    const e = errsOf(withP(c => { c.customCuts[1].h = 561; }));
    assert.ok(has(e, /≠ 581×110 cerut de profilul/), e.join("\n"));
  });
  test("profilo a tre zone o con P diverso -> errore", () => {
    assert.ok(has(errsOf(withP(c => { c.depthProfile = [{ yFrom: 0, yTo: 300, depth: 200 },
      { yFrom: 300, yTo: 620, depth: 250 }, { yFrom: 620, yTo: 2280, depth: 360 }]; })), /profil nesuportat/));
    assert.ok(has(errsOf(withP(c => { c.P = 400; })), /adâncimea maximă din profil e 360/));
    assert.ok(has(errsOf(withP(c => { c.depthProfile[1].yTo = 2260; })), /nu la H = 2280/));
  });
  test("cassetti insieme alle partizioni -> errore dichiarato, non cassetti persi", () => {
    assert.ok(has(errsOf(withP(c => { c.drawers = 3; })), /sertarele nu se pot combina/));
  });
  test("cote assolute su una tipologia diversa da standard -> errore", () => {
    assert.ok(has(errsOf(withP(c => { c.type = "tondo"; })), /doar pe tipologia standard/));
  });
});

describe("Le cote del testo: ognuna deve atterrare", () => {
  const PROMPT = "Corp unic 870 × 2260 × 360, pe picioare de 20, truciolare 19, spate aplicat. " +
    "Setto vertical central de la 39 la 1539: se oprește la cota 1539, nu merge până la cielo. " +
    "2 ripiani traversanți pe toată lățimea, deasupra setto-ului, la 1539 și 1900. " +
    "3 ripiani doar în coloana dreapta, la cote absolute 620, 926, 1232. Coloana stânga fără ripiani. " +
    "Schienale în 2 bucăți pe verticală (870×600 și 870×1660), pentru că adâncimea corpului e 250 sub cota 620 și 360 peste. " +
    "Ripiani retrași 10 de la față. 4 ante: 2 × (433×1538) jos la y 20, 2 × (433×717) sus la y 1561. " +
    "3 decupaje dreptunghiulare în colțul spate-jos al celor 3 piese verticale: 600 × 110 pe laterale, 581 × 110 pe setto.";
  /* gli stessi numeri noti che raccoglie aiCheck(): la patch, i pezzi, le grossezze */
  function known(cfg) {
    const b = build(cfg), k = [];
    const walk = v => { if (typeof v === "number") k.push(v); else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.keys(v).forEach(x => walk(v[x])); };
    walk(cfg); k.push(19);
    b.out.pieces.forEach(x => { k.push(x.lung, x.larg); (x.yInf || []).forEach(v => k.push(v));
      (x.scasso ? [].concat(x.scasso) : []).forEach(c => k.push(c.l, c.w)); });
    const LY = S.validateLayout(cfg, b.G);   // come aiCheck: solo se il corpo ha cote assolute
    if (LY.active) S.layoutNumbers(LY, b.G).forEach(v => k.push(v));
    return k;
  }
  /* come lo scrive davvero il falegname: con la distinta che si aspetta, la
     pila di verifica e le cote derivate (facce dei ripiani, bordi delle ante,
     rost). Sono verifiche, non entrate — e devono risultare consumate. */
  const PROMPT_VERIFICA = PROMPT + " Mi aspetto: Fianco 2260 × 341 — 2; Setto 1500 × 341; Base 832 × 231; Cielo 832 × 341; " +
    "Ripiano traversante 830 × 331 — 2; Ripiano dx 404 × 341 a 620; Ripiano dx 404 × 331 — 2; Schienale 870 × 600 e 870 × 1660; " +
    "Anta 433 × 1538 — 2, Anta 433 × 717 — 2. Verifica: 20 + 19 + 1500 + 19 + 342 + 19 + 342 + 19 = 2280; " +
    "colonna dx 581 + 287 + 287 + 288; il cielo parte da 2261; il ripiano a 1539 finisce a 1558; " +
    "le ante alte arrivano a 2278, rost orizzontale 3, rost verticale 4; 19 + 832 + 19 = 870.";
  test("distinta attesa, pila di verifica e cote derivate nel testo: tutte consumate", () => {
    assert.deepEqual(J(S.unconsumedCotas(PROMPT_VERIFICA, known(JACQUIN)).map(c => c.raw)), []);
  });
  test("una cota attesa che il motore NON produce resta fuori (1661 al posto di 1660)", () => {
    const t = PROMPT_VERIFICA.replace("870 × 1660;", "870 × 1661;");
    assert.deepEqual(J(S.unconsumedCotas(t, known(JACQUIN)).map(c => c.raw)), ["1661"]);
  });
  test("il prompt della riproduzione: zero cote non interpretate", () => {
    assert.deepEqual(J(S.unconsumedCotas(PROMPT, known(JACQUIN)).map(c => c.raw)), []);
  });
  test("se il parser perde un ripiano, la sua cota salta fuori — e si ferma", () => {
    const c = clone(JACQUIN); c.partitions = c.partitions.filter(q => q.y !== 1232);
    assert.deepEqual(J(S.unconsumedCotas(PROMPT, known(c)).map(x => x.raw)), ["1232"]);
  });
  test("la config di prima (sezioni uguali) perdeva otto cote: adesso si vedono tutte", () => {
    const old = { name: "Camera", type: "standard", L: 870, H: 2280, P: 360, plinth: 20, support: "piedini",
      tram: 1, shelves: 3, drawers: 0, doors: 4, back: 1, hang: 0, backMode: "applicato",
      matBody: "__b", matFront: "__b", matBack: "__b" };
    const lost = S.unconsumedCotas(PROMPT, known(old)).map(x => x.raw);
    for (const v of ["39", "1539", "1900", "620", "926", "1232", "250", "1538", "717", "1561", "600", "110", "581"])
      assert.ok(lost.includes(v), v + " doveva risultare non interpretata: " + lost.join(","));
  });
  test("conteggi, codici e unita", () => {
    const r = S.extractCotas("2 ripiani, 3 decupaje, 2 × (433×1538), Egger H1145 ST10, 2,26 m, 45 cm, 1.539, 18mm");
    assert.deepEqual(J(r.map(c => c.value)), [433, 1538, 2260, 450, 1539, 18]);
  });
});

describe("Proiectele existente: migrare no-op", () => {
  test("un corpo senza i campi nuovi non passa da validateLayout e genera come prima", () => {
    const c = { name: "X", type: "standard", L: 800, H: 2000, P: 560, plinth: 80, support: "zoccolo",
      tram: 1, shelves: 3, drawers: 0, doors: 2, back: 1, hang: 1, matBody: "__b", matFront: "__b", matBack: "__b" };
    const b = build(c);
    assert.equal(S.validateLayout(c, b.G).active, false);
    const d = build(Object.assign(clone(c), { partitions: [], fronts: [], depthProfile: [], customCuts: [] }));
    assert.deepEqual(J(d.out.pieces), J(b.out.pieces));
  });
  test("migrateLayoutCfg non aggiunge niente e toglie solo gli array vuoti", () => {
    const c = { L: 800, tram: 1, partitions: [], fronts: [{ x: 0, y: 0, w: 100, h: 100 }] };
    S.migrateLayoutCfg(c);
    assert.deepEqual(J(c), { L: 800, tram: 1, fronts: [{ x: 0, y: 0, w: 100, h: 100 }] });
  });
});
