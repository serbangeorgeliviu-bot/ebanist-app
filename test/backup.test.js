/* Backup complet: stoc în fișier, chei criptate cu parolă (app/ebanist-backup.js).
 *
 *   cd test && node --test backup.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-backup.js"), "utf8");
const B = new Function("globalThis", SRC.replace(/\}\)\(typeof globalThis[^\n]*\n?$/, "})(globalThis);\n") + "\nreturn globalThis.EBBackup;")(
  { crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob });

describe("build — ce intră în fișier", () => {
  const base = { ver: "5.23.0", date: "2026-11-02", projects: [{ id: "p1" }], settings: { kerf: 4 } };
  test("stocul intră (lipsea până la D-111)", () => {
    const p = B.build({ ...base, stock: [{ id: "s1", mat: "Alb 19", L: 2800, W: 2070, n: 3 }] });
    assert.deepStrictEqual(p.state.stock, [{ id: "s1", mat: "Alb 19", L: 2800, W: 2070, n: 3 }]);
    assert.strictEqual(p.ebanist_backup, 1);
  });
  test("fără stoc → listă goală, nu câmp lipsă; poze și chei numai dacă există", () => {
    const p = B.build(base);
    assert.deepStrictEqual(p.state.stock, []);
    assert.strictEqual(p.photos, undefined); assert.strictEqual(p.secrets, undefined);
    const q = B.build({ ...base, photos: { a: "x" }, secrets: { v: 1 } });
    assert.deepStrictEqual(q.photos, { a: "x" }); assert.deepStrictEqual(q.secrets, { v: 1 });
  });
  test("stockFrom: un backup vechi, fără stoc, nu are voie să șteargă stocul curent", () => {
    assert.strictEqual(B.stockFrom({ state: { projects: [] } }), null);
    assert.strictEqual(B.stockFrom({ state: { stock: "x" } }), null);
    assert.deepStrictEqual(B.stockFrom({ state: { stock: [] } }), []);
    assert.deepStrictEqual(B.stockFrom({ state: { stock: [{ id: 1 }] } }), [{ id: 1 }]);
  });
});

describe("pickSecrets — ce se salvează", () => {
  test("cheia AI și codul Pro de pe web", () => {
    assert.deepStrictEqual(B.pickSecrets("sk-ant-x", { kind: "stripe", key: "sub_1AbCdEfGhIjKl" }), { aiKey: "sk-ant-x", proCode: "sub_1AbCdEfGhIjKl" });
    assert.deepStrictEqual(B.pickSecrets("", { kind: "stripe", key: "comp_" + "a".repeat(24) }), { proCode: "comp_" + "a".repeat(24) });
  });
  test("licența Google Play NU se salvează (Play o restabilește singur)", () => {
    assert.deepStrictEqual(B.pickSecrets("k", { kind: "play", key: "token-de-achizitie" }), { aiKey: "k" });
    assert.strictEqual(B.pickSecrets("", { kind: "play", key: "t" }), null);
  });
  test("nimic de salvat → null", () => {
    assert.strictEqual(B.pickSecrets("", null), null);
    assert.strictEqual(B.pickSecrets("", { kind: "stripe" }), null);
  });
});

describe("seal / open — criptare cu parolă", () => {
  const S = { aiKey: "sk-ant-api03-SECRET", proCode: "sub_1AbCdEfGhIjKl" };

  test("dus-întors cu parola corectă", async () => {
    const blk = await B.seal(S, "parola-mea-1");
    assert.deepStrictEqual(await B.open(blk, "parola-mea-1"), S);
  });
  test("blocul nu conține cheile în clar", async () => {
    const txt = JSON.stringify(await B.seal(S, "parola-mea-1"));
    assert.ok(!txt.includes("SECRET") && !txt.includes("sub_1Ab"));
  });
  test("parolă greșită → bad-password", async () => {
    const blk = await B.seal(S, "parola-mea-1");
    await assert.rejects(B.open(blk, "alta-parola"), /bad-password/);
    await assert.rejects(B.open(blk, ""), /bad-password/);
  });
  test("bloc modificat (un octet din ct) → respins de GCM", async () => {
    const blk = await B.seal(S, "p4r0la!");
    const raw = Buffer.from(blk.ct, "base64"); raw[0] ^= 1;
    await assert.rejects(B.open({ ...blk, ct: raw.toString("base64") }, "p4r0la!"), /bad-password/);
  });
  test("de fiecare dată alt salt și alt iv (aceeași parolă, alt text criptat)", async () => {
    const a = await B.seal(S, "p"), b = await B.seal(S, "p");
    assert.notStrictEqual(a.salt, b.salt); assert.notStrictEqual(a.iv, b.iv); assert.notStrictEqual(a.ct, b.ct);
  });
  test("blocuri străine sau strâmbe → bad-block, nu excepție necontrolată", async () => {
    for (const bad of [null, {}, { v: 2 }, { v: 1, kdf: "x" }, { v: 1, kdf: "PBKDF2-SHA256", it: 5, salt: "", iv: "", ct: "" },
                       { v: 1, kdf: "PBKDF2-SHA256", it: 600000, salt: "%%%", iv: "!", ct: "?" }])
      await assert.rejects(B.open(bad, "x"), /bad-block/);
  });
  test("un număr de iterații absurd (DoS prin fișier) se refuză", async () => {
    const blk = await B.seal(S, "p");
    await assert.rejects(B.open({ ...blk, it: 1e9 }, "p"), /bad-block/);
  });
  test("parola unicode", async () => {
    const blk = await B.seal(S, "șțăîâ-пароль-密码");
    assert.deepStrictEqual(await B.open(blk, "șțăîâ-пароль-密码"), S);
  });
});
