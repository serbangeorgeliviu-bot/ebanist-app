/* Ebanist — un materiale senza prezzo non costa 0 € nel preventivo.
 *
 *   node --test test/price-missing.test.js
 *
 * I 17 materiali Centro Legno hanno `prezzo_mq:null`. Prima diventavano
 * 0 €/m² e il Bianco di default dava un preventivo senza pannelli.
 * Quello che deve restare vero:
 *  - catalogo senza prezzo -> prezzo generale (priceM2) e missing:true;
 *  - prezzo scritto dall'utente in Catalogo (matOvr), anche 0 -> vale quello;
 *  - catalogo con prezzo -> vale quello, missing:false;
 *  - materiale fuori catalogo -> prezzo generale, come sempre.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const S = E.appEngine();

const cat = (id, prezzo_mq) => S.matFromCatalog({ id, nome: id, spessore: 19, prezzo_mq });
const set = o => { S.state.settings = Object.assign({ priceM2: 42, matOvr: {},
  matAdd: [cat("senza", null), cat("con", 15.02)] }, o); };

test("catalogo senza prezzo: prezzo generale, segnalato", () => {
  set({});
  assert.deepEqual({ ...S.matPriceInfo("senza") }, { price: 42, missing: true });
  assert.equal(S.matFromCatalog({ id: "x", spessore: 19, prezzo_mq: null }).priced, false);
});

test("prezzo scritto dall'utente: vale quello, anche 0", () => {
  set({ matOvr: { senza: { price: 11.5 } } });
  assert.deepEqual({ ...S.matPriceInfo("senza") }, { price: 11.5, missing: false });
  set({ matOvr: { senza: { price: 0 } } });
  assert.deepEqual({ ...S.matPriceInfo("senza") }, { price: 0, missing: false });
});

test("catalogo con prezzo: vale quello", () => {
  set({});
  assert.deepEqual({ ...S.matPriceInfo("con") }, { price: 15.02, missing: false });
});

test("fuori catalogo: prezzo generale, senza avviso", () => {
  set({});
  assert.deepEqual({ ...S.matPriceInfo("Pannello qualsiasi") }, { price: 42, missing: false });
});

