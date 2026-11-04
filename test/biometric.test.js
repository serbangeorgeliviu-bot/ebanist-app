/* Deblocare biometrică pe web (D-113): app/ebanist-biometric.js, cu un autentificator fals.
 *
 *   cd test && node --test biometric.test.js
 */
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const nodeCrypto = require("node:crypto");

const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-biometric.js"), "utf8");
const B = new Function("globalThis", SRC.replace(/\}\)\(typeof globalThis[^\n]*\n?$/, "})(globalThis);\n") + "\nreturn globalThis.EBBiometric;")(
  { TextEncoder, TextDecoder, btoa, atob });

/* autentificator fals: PRF = HMAC(secretul-dispozitivului, credId || salt). `uv` = omul a pus degetul. */
function fakeEnv(opts) {
  opts = opts || {};
  const crypto = nodeCrypto.webcrypto;
  const deviceSecret = nodeCrypto.randomBytes(32);
  const mem = new Map();
  const state = { uv: true, prf: opts.prf !== false, prompts: 0 };
  const creds = [];
  const env = {
    crypto, rpId: "ebanist.com", PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => opts.platform !== false },
    storage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) },
    credentials: {
      async create(o) {
        state.prompts++;
        if (!state.uv) return null;
        assert.strictEqual(o.publicKey.authenticatorSelection.userVerification, "required");
        assert.strictEqual(o.publicKey.authenticatorSelection.authenticatorAttachment, "platform");
        const id = nodeCrypto.randomBytes(32); creds.push(id);
        return { rawId: id.buffer.slice(id.byteOffset, id.byteOffset + id.byteLength),
          getClientExtensionResults: () => (state.prf ? { prf: { enabled: true } } : {}) };
      },
      async get(o) {
        state.prompts++;
        if (!state.uv) return null;
        assert.strictEqual(o.publicKey.userVerification, "required");
        const id = Buffer.from(o.publicKey.allowCredentials[0].id);
        assert.ok(creds.some(c => c.equals(id)), "credențial necunoscut");
        const salt = Buffer.from(o.publicKey.extensions.prf.eval.first);
        const out = nodeCrypto.createHmac("sha256", deviceSecret).update(id).update(salt).digest();
        return { getClientExtensionResults: () => (state.prf ? { prf: { results: { first: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) } } } : {}) };
      }
    }
  };
  return { env, state, mem };
}
const reject = async (p, msg) => { await assert.rejects(p, e => e.message === msg, msg); };

describe("activare și deblocare", () => {
  test("enroll → unlock întoarce exact token-ul", async () => {
    const { env } = fakeEnv();
    assert.strictEqual(B.has(env), false);
    await B.enroll(env, { email: "a@b.ro", refreshToken: "tok-abc123" });
    assert.strictEqual(B.has(env), true);
    assert.strictEqual(B.email(env), "a@b.ro");
    assert.strictEqual(await B.unlock(env), "tok-abc123");
  });
  test("nimic în clar în localStorage: nici token, nici cheia privată", async () => {
    const { env, mem } = fakeEnv();
    const tok = "supersecret-refresh-token-XYZ";
    await B.enroll(env, { refreshToken: tok });
    const raw = mem.get(B.KEY);
    assert.ok(!raw.includes(tok));
    const rec = JSON.parse(raw);
    assert.deepStrictEqual(Object.keys(rec).sort(), ["cid", "email", "pub", "tok", "v", "wiv", "wpriv"]);
  });
  test("deblocarea cere amprenta (un prompt), enroll două", async () => {
    const { env, state } = fakeEnv();
    await B.enroll(env, { refreshToken: "t" });
    assert.strictEqual(state.prompts, 2);
    await B.unlock(env);
    assert.strictEqual(state.prompts, 3);
  });
});

describe("rotația token-ului: re-criptare tăcută", () => {
  test("reseal nu cere amprenta, iar unlock dă token-ul NOU", async () => {
    const { env, state } = fakeEnv();
    await B.enroll(env, { refreshToken: "vechi" });
    const before = state.prompts;
    assert.strictEqual(await B.reseal(env, "nou-1"), true);
    assert.strictEqual(await B.reseal(env, "nou-2"), true);
    assert.strictEqual(state.prompts, before, "reseal nu are voie să ceară amprenta");
    assert.strictEqual(await B.unlock(env), "nou-2");
  });
  test("reseal fără activare sau fără token → false, nu scrie nimic", async () => {
    const { env, mem } = fakeEnv();
    assert.strictEqual(await B.reseal(env, "x"), false);
    await B.enroll(env, { refreshToken: "a" });
    assert.strictEqual(await B.reseal(env, ""), false);
    assert.strictEqual(await B.unlock(env), "a");
    assert.ok(mem.has(B.KEY));
  });
});

describe("refuzuri", () => {
  test("fără PRF → no-prf și nu se păstrează nimic", async () => {
    const { env } = fakeEnv({ prf: false });
    await reject(B.enroll(env, { refreshToken: "t" }), "no-prf");
    assert.strictEqual(B.has(env), false);
  });
  test("utilizatorul anulează → cancelled, nimic păstrat", async () => {
    const { env, state } = fakeEnv();
    state.uv = false;
    await reject(B.enroll(env, { refreshToken: "t" }), "cancelled");
    assert.strictEqual(B.has(env), false);
  });
  test("unlock anulat → cancelled; fără activare → no-record", async () => {
    const { env, state } = fakeEnv();
    await reject(B.unlock(env), "no-record");
    await B.enroll(env, { refreshToken: "t" });
    state.uv = false;
    await reject(B.unlock(env), "cancelled");
    assert.strictEqual(B.has(env), true, "o anulare nu șterge activarea");
  });
  test("fără sesiune → no-session", async () => {
    const { env } = fakeEnv();
    await reject(B.enroll(env, {}), "no-session");
  });
  test("alt dispozitiv (alt secret PRF) nu poate deschide blocul", async () => {
    const a = fakeEnv(), b = fakeEnv();
    await B.enroll(a.env, { refreshToken: "secret" });
    b.env.storage.setItem(B.KEY, a.mem.get(B.KEY));
    await assert.rejects(B.unlock(b.env));
  });
  test("bloc modificat → respins (GCM)", async () => {
    const { env, mem } = fakeEnv();
    await B.enroll(env, { refreshToken: "t" });
    const rec = JSON.parse(mem.get(B.KEY));
    const ct = Buffer.from(rec.tok.ct, "base64"); ct[0] ^= 1; rec.tok.ct = ct.toString("base64");
    mem.set(B.KEY, JSON.stringify(rec));
    await assert.rejects(B.unlock(env));
  });
  test("înregistrare coruptă → ca și cum nu ar exista", async () => {
    const { env, mem } = fakeEnv();
    mem.set(B.KEY, "{nu e json");
    assert.strictEqual(B.has(env), false);
    mem.set(B.KEY, JSON.stringify({ v: 2, cid: "a", pub: "b", wpriv: "c" }));
    assert.strictEqual(B.has(env), false);
  });
});

describe("clear și available", () => {
  test("clear șterge activarea", async () => {
    const { env } = fakeEnv();
    await B.enroll(env, { refreshToken: "t" });
    B.clear(env);
    assert.strictEqual(B.has(env), false);
  });
  test("available: autentificator de platformă da/nu, API lipsă → false", async () => {
    assert.strictEqual(await B.available(fakeEnv().env), true);
    assert.strictEqual(await B.available(fakeEnv({ platform: false }).env), false);
    const e = fakeEnv().env; e.PublicKeyCredential = undefined;
    assert.strictEqual(await B.available(e), false);
  });
});
