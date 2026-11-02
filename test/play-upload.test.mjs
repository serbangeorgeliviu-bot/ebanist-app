/* android/tools/play-upload.mjs — fără rețea: fetch simulat, cheie RSA generată pe loc.
 *   cd test && node --test play-upload.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { jwtAssertion, accessToken, checkInputs, publish } from "../android/tools/play-upload.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});
const SA = { client_email: "ci@proj.iam.gserviceaccount.com", private_key: privateKey, token_uri: "https://oauth2.googleapis.com/token" };
const ok = (b) => new Response(JSON.stringify(b), { status: 200 });

function fake(over = {}) {
  const calls = [];
  const fn = async (url, opt = {}) => {
    calls.push({ url, method: opt.method || "GET", headers: opt.headers || {}, body: opt.body });
    for (const [frag, rep] of Object.entries(over)) if (url.includes(frag)) return typeof rep === "function" ? rep(opt) : rep;
    if (url.includes("oauth2")) return ok({ access_token: "tok-123" });
    if (url.endsWith("/edits")) return ok({ id: "E1" });
    if (url.includes("/bundles")) return ok({ versionCode: 7 });
    if (url.includes("/tracks/")) return ok({});
    if (url.includes(":validate") || url.includes(":commit")) return ok({});
    return new Response("", { status: 200 });
  };
  return { fn, calls };
}

describe("JWT și token", () => {
  test("JWT: antet RS256, claim cu scope/aud, semnătură verificabilă", () => {
    const j = jwtAssertion(SA, 1_800_000_000_000);
    const [h, c, s] = j.split(".");
    assert.deepStrictEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "RS256", typ: "JWT" });
    const claim = JSON.parse(Buffer.from(c, "base64url"));
    assert.strictEqual(claim.iss, SA.client_email);
    assert.strictEqual(claim.scope, "https://www.googleapis.com/auth/androidpublisher");
    assert.strictEqual(claim.exp - claim.iat, 3600);
    assert.ok(createVerify("RSA-SHA256").update(h + "." + c).verify(publicKey, Buffer.from(s, "base64url")));
  });
  test("accessToken: trimite grant jwt-bearer și întoarce tokenul", async () => {
    const { fn, calls } = fake();
    assert.strictEqual(await accessToken(SA, fn), "tok-123");
    assert.match(calls[0].body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
  });
  test("token refuzat → eroare cu codul HTTP", async () => {
    const { fn } = fake({ oauth2: new Response("invalid_grant", { status: 400 }) });
    await assert.rejects(accessToken(SA, fn), /token → HTTP 400.*invalid_grant/);
  });
});

describe("intrări", () => {
  test("track și status necunoscute se refuză", () => {
    assert.throws(() => checkInputs({ track: "prod", status: "draft" }), /track necunoscut/);
    assert.throws(() => checkInputs({ track: "internal", status: "inProgress" }), /status necunoscut/);
  });
  test("production + completed cere confirm=da", () => {
    assert.throws(() => checkInputs({ track: "production", status: "completed", confirm: "" }), /confirm=da/);
    assert.throws(() => checkInputs({ track: "production", status: "completed", confirm: "yes" }), /confirm=da/);
    checkInputs({ track: "production", status: "completed", confirm: "da" });
    checkInputs({ track: "production", status: "draft" });
    checkInputs({ track: "internal", status: "completed" });
  });
});

describe("publish", () => {
  const base = { sa: SA, pkg: "com.domusrenov.ebanist", aab: Buffer.from("AAB"), track: "internal" };

  test("secvența: edit → bundle → track → validate → commit, cu draft implicit", async () => {
    const { fn, calls } = fake();
    const r = await publish({ ...base, fetchFn: fn });
    assert.deepStrictEqual(r, { versionCode: 7, track: "internal", status: "draft" });
    const seq = calls.slice(1).map((c) => c.method + " " + c.url.replace(/^.*applications\/com\.domusrenov\.ebanist/, ""));
    assert.deepStrictEqual(seq, [
      "POST /edits",
      "POST /edits/E1/bundles?uploadType=media",
      "PUT /edits/E1/tracks/internal",
      "POST /edits/E1:validate",
      "POST /edits/E1:commit"
    ]);
    const put = JSON.parse(calls.find((c) => c.method === "PUT").body);
    assert.deepStrictEqual(put, { track: "internal", releases: [{ name: "7", versionCodes: ["7"], status: "draft" }] });
    assert.ok(calls.slice(1).every((c) => c.headers.Authorization === "Bearer tok-123"));
  });

  test("notele de lansare: limbă și tăiere la 500 de caractere", async () => {
    const { fn, calls } = fake();
    await publish({ ...base, notes: "x".repeat(900), notesLang: "ro-RO", fetchFn: fn });
    const rel = JSON.parse(calls.find((c) => c.method === "PUT").body).releases[0];
    assert.strictEqual(rel.releaseNotes[0].language, "ro-RO");
    assert.strictEqual(rel.releaseNotes[0].text.length, 500);
  });

  test("production completed fără confirmare: nu se apelează nimic", async () => {
    const { fn, calls } = fake();
    await assert.rejects(publish({ ...base, track: "production", status: "completed", fetchFn: fn }), /confirm=da/);
    assert.strictEqual(calls.length, 0);
  });

  test("eșec la urcare → editarea se șterge, eroarea ajunge la apelant", async () => {
    const { fn, calls } = fake({ "/bundles": new Response('{"error":{"message":"Version code 7 has already been used."}}', { status: 403 }) });
    await assert.rejects(publish({ ...base, fetchFn: fn }), /urcă \.aab → HTTP 403.*already been used/);
    assert.ok(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/edits/E1")));
    assert.ok(!calls.some((c) => c.url.includes(":commit")));
  });

  test("validarea cade → fără commit", async () => {
    const { fn, calls } = fake({ ":validate": new Response("bad", { status: 400 }) });
    await assert.rejects(publish({ ...base, fetchFn: fn }), /validează → HTTP 400/);
    assert.ok(!calls.some((c) => c.url.includes(":commit")));
  });

  test("tokenul nu apare niciodată într-un mesaj de eroare", async () => {
    const { fn } = fake({ "/tracks/": new Response("nope", { status: 500 }) });
    await assert.rejects(publish({ ...base, fetchFn: fn }), (e) => !/tok-123/.test(e.message) && /500/.test(e.message));
  });
});
