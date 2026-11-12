/* Cererea de recenzie: decizia „e momentul?" (app/ebanist-review.js).
 *
 *   cd test && node --test review.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-review.js"), "utf8");
const R = new Function("globalThis", SRC.replace(/\}\)\(typeof globalThis[^\n]*\n?$/, "})(globalThis);\n") + "\nreturn globalThis.EBReview;")({});

const DAY = 864e5, T0 = Date.parse("2026-11-01T10:00:00Z");
const OK = { can: true, paywall: false, busy: false, hidden: false };
const ripe = (o = {}) => Object.assign({ first: T0, sessions: 2, good: 1, lastAsk: 0, asks: 0 }, o);
const at = (days) => T0 + days * DAY;

describe("when: toate condițiile deodată", () => {
  test("starea coaptă, la 1 zi → da", () => assert.deepStrictEqual(R.due(ripe(), at(1), OK), { ok: true, why: "" }));
  test("fără punte nativă (web, iOS, .aab vechi) → niciodată", () =>
    assert.strictEqual(R.due(ripe(), at(30), { ...OK, can: false }).why, "no-bridge"));
  test("prea tânăr: 23 h", () => assert.strictEqual(R.due(ripe(), at(1) - 36e5, OK).why, "young"));
  test("prea puține sesiuni", () => assert.strictEqual(R.due(ripe({ sessions: 1 }), at(8), OK).why, "sessions"));
  test("prea puține momente bune", () => assert.strictEqual(R.due(ripe({ good: 0 }), at(8), OK).why, "good"));
  test("a văzut ecranul Pro în sesiune → nu cerem", () => assert.strictEqual(R.due(ripe(), at(8), { ...OK, paywall: true }).why, "paywall"));
  test("foaie deschisă sau aplicație în fundal → nu cerem", () => {
    assert.strictEqual(R.due(ripe(), at(8), { ...OK, busy: true }).why, "busy");
    assert.strictEqual(R.due(ripe(), at(8), { ...OK, hidden: true }).why, "busy");
  });
  test("a doua cerere: nu înainte de 45 de zile", () => {
    const s = ripe({ lastAsk: at(8), asks: 1 });
    assert.strictEqual(R.due(s, at(8 + 44), OK).why, "gap");
    assert.strictEqual(R.due(s, at(8 + 45), OK).ok, true);
  });
  test("cel mult 4 cereri în viață", () => assert.strictEqual(R.due(ripe({ asks: 4, lastAsk: at(1) }), at(400), OK).why, "max"));
  test("stare goală sau stricată → nu cerem, nu aruncă", () => {
    for (const bad of [null, undefined, "x", 5, {}, { first: "abc", sessions: -4, good: NaN }])
      assert.strictEqual(R.due(bad, at(400), OK).ok, false);
  });
});

describe("numărătoare", () => {
  test("prima sesiune fixează începutul, următoarele nu-l mută", () => {
    let s = R.session(null, T0);
    s = R.session(s, at(3));
    assert.strictEqual(s.first, T0); assert.strictEqual(s.sessions, 2);
  });
  test("good crește cu 1", () => assert.strictEqual(R.good(ripe({ good: 1 })).good, 2));
  test("după o cerere: good de la zero, asks +1, lastAsk setat", () => {
    const s = R.asked(ripe(), at(9));
    assert.deepStrictEqual(s, { first: T0, sessions: 2, good: 0, lastAsk: at(9), asks: 1 });
    assert.strictEqual(R.due(s, at(9 + 91), OK).why, "good");
  });
  test("traseu complet: 1 zi, 2 sesiuni, 1 moment bun → cereri rare, nu în fiecare zi", () => {
    let s = null, asks = 0;
    for (let day = 0; day <= 200; day++) {
      s = R.session(s, at(day));
      s = R.good(s);
      if (R.due(s, at(day), OK).ok) { s = R.asked(s, at(day)); asks++; }
    }
    assert.ok(asks >= 1 && asks <= 4, "cereri: " + asks);
  });
});

describe("persistență", () => {
  test("load/save prin localStorage, cu zgomot tolerat", () => {
    const store = {};
    const g = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } };
    const L = new Function("globalThis", SRC.replace(/\}\)\(typeof globalThis[^\n]*\n?$/, "})(globalThis);\n") + "\nreturn globalThis.EBReview;")(g);
    assert.deepStrictEqual(L.load(), { first: 0, sessions: 0, good: 0, lastAsk: 0, asks: 0 });
    L.save({ first: T0, sessions: 2, good: 1, lastAsk: 0, asks: 0 });
    assert.strictEqual(L.load().sessions, 2);
    store[L.KEY] = "{nu json";
    assert.strictEqual(L.load().sessions, 0);
  });
  test("cheia e separată de proiecte (tagliapro)", () => assert.strictEqual(R.KEY, "ebanist_review"));
});
