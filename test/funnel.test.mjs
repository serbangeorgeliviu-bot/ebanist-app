/* Pâlnia de conversie: clientul (app/ebanist-funnel.js) și serverul
 * (netlify/functions/_funnel.js + funnel.js) — listele închise rămân
 * identice, nimic din afara lor nu trece, rezumatul iese din chei.
 *
 *   cd test && node --test funnel.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as F from "../netlify/functions/_funnel.js";
import { handle } from "../netlify/functions/funnel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "..", "app", "ebanist-funnel.js"), "utf8");
function client(globals = {}) {
  const g = Object.assign({ Blob: class { constructor(p) { this.p = p; } } }, globals);
  new Function("globalThis", SRC.replace(/\}\)\(typeof globalThis[^\n]*\n?$/, "})(globalThis);\n"))(g);
  return g;
}

describe("listele clientului = listele serverului", () => {
  const C = client().EBFunnel;
  for (const n of ["EVENTS", "WHY", "PLAT", "PLAN", "KIND"])
    test(n, () => assert.deepStrictEqual(C[n], F[n]));
  test("fiecare motiv din PRO_WHY al aplicației e în listă", () => {
    const html = fs.readFileSync(path.join(here, "..", "app", "index.html"), "utf8");
    const m = html.match(/const PRO_WHY=\{([^}]*)\}/);
    const keys = [...m[1].matchAll(/(\w+):"/g)].map(x => x[1]);
    assert.ok(keys.length >= 10);
    for (const k of keys) assert.ok(F.WHY.includes(k), k);
    assert.ok(F.WHY.includes("plain"));
  });
});

describe("clean (client)", () => {
  const C = client().EBFunnel;
  test("eveniment necunoscut → null", () => assert.strictEqual(C.clean("login", {}), null));
  test("pw_shown fără motiv → plain; motiv străin → plain", () => {
    assert.strictEqual(C.clean("pw_shown", {}).why, "plain");
    assert.strictEqual(C.clean("pw_shown", { why: "<script>" }).why, "plain");
    assert.strictEqual(C.clean("pw_shown", { why: "pdf" }).why, "pdf");
  });
  test("câmpuri în plus nu trec (e-mail, cheie, nume de proiect)", () => {
    const r = C.clean("pro_on", { why: "pdf", plan: "yearly", kind: "stripe", email: "a@b.c", key: "sub_x", project: "Casa Rossi" });
    assert.deepStrictEqual(r, { e: "pro_on", plat: "web", why: "pdf", plan: "yearly", kind: "stripe" });
  });
  test("open și rv_ask nu poartă motiv", () => {
    assert.deepStrictEqual(C.clean("open", { why: "pdf" }), { e: "open", plat: "web" });
    assert.deepStrictEqual(C.clean("rv_ask", { plat: "play" }), { e: "rv_ask", plat: "play" });
  });
});

describe("send (client)", () => {
  function run(globals, name, extra) {
    const sent = [];
    const store = {};
    const g = client(Object.assign({
      navigator: { sendBeacon: (u, b) => { sent.push({ u, body: JSON.parse(b.p[0]) }); return true; } },
      localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }
    }, globals));
    const ok = g.EBFunnel.send(name, extra);
    return { ok, sent, g, store };
  }
  test("pleacă la /api/funnel cu id de sesiune și platformă", () => {
    const { ok, sent } = run({}, "pw_shown", { why: "pdf" });
    assert.ok(ok);
    assert.strictEqual(sent[0].u, "/api/funnel");
    assert.match(sent[0].body.s, /^[a-z0-9]{1,12}$/);
    assert.strictEqual(sent[0].body.plat, "web");
  });
  test("pe Android platforma e play", () => {
    const { sent } = run({ EbanistAndroid: { billingAvailable: () => "1" } }, "open");
    assert.strictEqual(sent[0].body.plat, "play");
  });
  test("browser automat (webdriver) → nu trimite", () => {
    const { ok, sent } = run({ navigator: { webdriver: true, sendBeacon: () => { throw new Error("n-ar trebui"); } } }, "open");
    assert.strictEqual(ok, false); assert.strictEqual(sent.length, 0);
  });
  test("mod atelier → nu trimite", () => {
    const { ok } = run({ OrderRail: { active: () => true } }, "open");
    assert.strictEqual(ok, false);
  });
  test("pro_on își ia motivul și planul din ultimul pw_buy (întoarcerea din checkout)", () => {
    const sent = [], store = {};
    const g = client({
      navigator: { sendBeacon: (u, b) => { sent.push(JSON.parse(b.p[0])); return true; } },
      localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }
    });
    g.EBFunnel.send("pw_buy", { why: "client", plan: "yearly" });
    g.EBFunnel.send("pro_on", { kind: "stripe" });
    assert.strictEqual(sent[1].why, "client"); assert.strictEqual(sent[1].plan, "yearly"); assert.strictEqual(sent[1].kind, "stripe");
  });
  test("un pw_buy mai vechi de 24 h nu se mai leagă de pro_on", () => {
    const sent = [], store = { ebanist_pw_last: JSON.stringify({ why: "client", plan: "yearly", t: Date.now() - 25 * 36e5 }) };
    const g = client({
      navigator: { sendBeacon: (u, b) => { sent.push(JSON.parse(b.p[0])); return true; } },
      localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }
    });
    g.EBFunnel.send("pro_on", { kind: "play" });
    assert.strictEqual(sent[0].why, "plain"); assert.strictEqual(sent[0].plan, undefined);
  });
});

describe("clean (server)", () => {
  test("cere id de sesiune valid", () => {
    assert.strictEqual(F.clean({ e: "open", plat: "web" }), null);
    assert.strictEqual(F.clean({ e: "open", s: "has space" }), null);
    assert.ok(F.clean({ e: "open", s: "ab12cd34" }));
  });
  test("aruncă tot ce nu e în listă", () => {
    const r = F.clean({ e: "pw_buy", s: "ab12", plat: "ios", why: "x", plan: "weekly", email: "a@b.c" });
    assert.deepStrictEqual(r, { e: "pw_buy", plat: "web", s: "ab12", why: "plain" });
  });
});

describe("chei și rezumat", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  test("cheia se citește înapoi", () => {
    const rec = F.clean({ e: "pw_buy", s: "ab12cd34", plat: "play", why: "pdf", plan: "monthly" });
    const k = F.keyOf(rec, now, "r4nd");
    assert.strictEqual(k, "d/2026-11-01/pw_buy/play/pdf/monthly/ab12cd34.r4nd");
    assert.deepStrictEqual(F.parseKey(k), { day: "2026-11-01", e: "pw_buy", plat: "play", why: "pdf", extra: "monthly", s: "ab12cd34" });
  });
  test("chei străine se ignoră", () => {
    assert.strictEqual(F.parseKey("altceva/ceva"), null);
    assert.strictEqual(F.parseKey("d/2026-11-01/hack/web/-/-/s.r"), null);
  });
  test("lastDays: azi inclusiv, n zile", () => {
    assert.deepStrictEqual(F.lastDays(3, now), ["2026-11-01", "2026-10-31", "2026-10-30"]);
  });
  test("rezumat: evenimente, sesiuni distincte, rate, pe motiv", () => {
    const mk = (o) => F.keyOf(F.clean(o), now, Math.random().toString(36).slice(2, 6));
    const keys = [
      ...["a1", "a2", "a3", "a4"].map(s => mk({ e: "open", s, plat: "play" })),
      mk({ e: "pw_shown", s: "a1", plat: "play", why: "pdf" }),
      mk({ e: "pw_shown", s: "a1", plat: "play", why: "pdf" }),      // aceeași sesiune, de două ori
      mk({ e: "pw_shown", s: "a2", plat: "play", why: "client" }),
      mk({ e: "pw_buy", s: "a1", plat: "play", why: "pdf", plan: "yearly" }),
      mk({ e: "pro_on", s: "a1", plat: "play", why: "pdf", kind: "play" }),
      mk({ e: "open", s: "w1", plat: "web" })
    ];
    const r = F.summarize(keys);
    const P = r.platforms.play;
    assert.strictEqual(P.events.pw_shown, 3);
    assert.strictEqual(P.sessions.pw_shown, 2);
    assert.strictEqual(P.sessions.open, 4);
    assert.strictEqual(P.rates.shown_per_open_sessions_pct, 50);
    assert.strictEqual(P.rates.buy_per_shown_events_pct, 33.3);
    assert.strictEqual(P.rates.pro_per_buy_events_pct, 100);
    assert.strictEqual(r.byWhy.pdf.pw_shown, 2);
    assert.strictEqual(r.byWhy.pdf.pro_per_shown_pct, 50);
    assert.strictEqual(r.byWhy.client.pro_per_shown_pct, 0);
    assert.strictEqual(r.platforms.web.rates.shown_per_open_sessions_pct, 0);
  });
  test("fără date: rate null, nu NaN", () => {
    const r = F.summarize([F.keyOf(F.clean({ e: "pw_buy", s: "a", plat: "web" }), now, "x")]);
    assert.strictEqual(r.platforms.web.rates.buy_per_shown_events_pct, null);
  });
});

describe("/api/funnel", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  function memStore() {
    const m = new Map();
    return { m, set: async (k, v) => { m.set(k, v); }, list: async ({ prefix }) => ({ blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }) };
  }
  const post = (b) => new Request("https://ebanist.com/api/funnel", { method: "POST", body: typeof b === "string" ? b : JSON.stringify(b) });
  const get = (qs = "", headers = {}) => new Request("https://ebanist.com/api/funnel" + qs, { headers });

  test("POST valid scrie o cheie, fără corp util", async () => {
    const st = memStore();
    const r = await handle(post({ e: "pw_shown", s: "ab12", plat: "play", why: "pdf" }), st, {}, now);
    assert.strictEqual(r.status, 200);
    const [k, v] = [...st.m.entries()][0];
    assert.match(k, /^d\/2026-11-01\/pw_shown\/play\/pdf\/-\/ab12\./);
    assert.strictEqual(v, "1");
  });
  test("POST invalid / prea mare / json prost", async () => {
    const st = memStore();
    assert.strictEqual((await handle(post({ e: "x", s: "ab" }), st, {}, now)).status, 400);
    assert.strictEqual((await handle(post("{nu json"), st, {}, now)).status, 400);
    assert.strictEqual((await handle(post({ e: "open", s: "ab", pad: "x".repeat(500) }), st, {}, now)).status, 413);
    assert.strictEqual(st.m.size, 0);
  });
  test("GET fără FUNNEL_KEY în mediu → 404 (nu e public)", async () => {
    assert.strictEqual((await handle(get("?key=orice"), memStore(), {}, now)).status, 404);
  });
  test("GET cu cheie greșită → 403; corectă → rezumat", async () => {
    const st = memStore();
    await handle(post({ e: "open", s: "ab12", plat: "web" }), st, {}, now);
    const env = { FUNNEL_KEY: "secret-key-1" };
    assert.strictEqual((await handle(get("?key=nope"), st, env, now)).status, 403);
    assert.strictEqual((await handle(get(""), st, env, now)).status, 403);
    const r = await handle(get("?days=7", { "x-funnel-key": "secret-key-1" }), st, env, now);
    assert.strictEqual(r.status, 200);
    const j = await r.json();
    assert.strictEqual(j.days, 7); assert.strictEqual(j.platforms.web.events.open, 1);
  });
  test("GET: days se limitează la 90", async () => {
    const r = await handle(get("?days=9999", { "x-funnel-key": "k" }), memStore(), { FUNNEL_KEY: "k" }, now);
    assert.strictEqual((await r.json()).days, 90);
  });
  test("cheia în query string NU mai e acceptată (E-05): ajunge în jurnale", async () => {
    const st = memStore();
    const env = { FUNNEL_KEY: "secret-key-1" };
    assert.strictEqual((await handle(get("?key=secret-key-1"), st, env, now)).status, 403);
  });
  test("alte metode → 405", async () => {
    assert.strictEqual((await handle(new Request("https://ebanist.com/api/funnel", { method: "DELETE" }), memStore(), {}, now)).status, 405);
  });
});
