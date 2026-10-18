/* Ebanist — audit 18.10.2026: sp_top/top în mediul aserțiunilor (D-72) și
 * redeschiderea IndexedDB după un timeout.
 *
 *   node --test test/envstore.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const E = require("./engine.js");
const S = E.appEngine(), MM = E.MM;

const BASE = { name: "R", type: "standard", L: 900, H: 720, P: 560, plinth: 100, tram: 0, shelves: 1, drawers: 0,
  matBody: "__b", matFront: "__b", matBack: "__k" };
S.state.settings = { panelL: 2800, panelW: 2070, kerf: 4, matBody: "__b", matFront: "__b", matBack: "__k",
  matOvr: {}, matAdd: [MM("__b", 19), MM("__k", 3)], hwProd: {} };
const derive = cfg => S.deriveCarcass(S.carcassParams(Object.assign({}, BASE, cfg), {}));

describe("assertionEnv: tavanul", () => {
  const rule = { id: "T", severity: "blocking", when: 'top == "none"', then: "sp_top == 0" };
  const rule2 = { id: "U", severity: "blocking", when: 'top == "plin"', then: "sp_top > 0" };
  test("sp_top și top sunt citibile din regulă", () => {
    assert.equal(Array.from(S.checkAssertions(derive({ top: "none" }), {}, [rule, rule2])).length, 0);
    assert.equal(Array.from(S.checkAssertions(derive({}), {}, [rule, rule2])).length, 0);
  });
  test("o regulă falsă pe sp_top chiar cade", () => {
    const bad = { id: "X", severity: "blocking", when: 'top == "none"', then: "sp_top > 0" };
    assert.equal(Array.from(S.checkAssertions(derive({ top: "none" }), {}, [bad])).length, 1);
  });
});

describe("EBStore: timeout la deschidere", () => {
  function load(idb) {
    const g = { indexedDB: idb, setTimeout, clearTimeout, Promise };
    g.window = g; g.self = g;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-store.js"), "utf8"), g, { filename: "ebanist-store.js" });
    return g.EBStore || g.window.EBStore;
  }
  test("după un timeout nu e declarată rotundă pe loc", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const store = load({ open: () => ({}) });          // open() nu răspunde niciodată
    assert.ok(store, "EBStore încărcat");
    const p = store.get ? store.get("x") : Promise.reject(new Error("fără get"));
    t.mock.timers.tick(4000);
    await p.catch(() => {});
    assert.equal(store.available(), true);
  });
});
