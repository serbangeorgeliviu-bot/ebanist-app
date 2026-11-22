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
  for (const n of ["EVENTS", "WHY", "PLAT", "PLAN", "KIND", "CODE", "FAILCODE", "RC", "BRAND"])
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
    const r = await handle(get("?days=9999&key=k"), memStore(), { FUNNEL_KEY: "k" }, now);
    assert.strictEqual((await r.json()).days, 90);
  });
  test("alte metode → 405", async () => {
    assert.strictEqual((await handle(new Request("https://ebanist.com/api/funnel", { method: "DELETE" }), memStore(), {}, now)).status, 405);
  });
});

describe("pw_unavail (D-129): ecranul Pro fără planuri de vândut", () => {
  const C = client().EBFunnel;
  const now = Date.parse("2026-11-01T12:00:00Z");
  test("client: poartă numai `code` din listă, fără motiv; străin → empty", () => {
    assert.deepStrictEqual(C.clean("pw_unavail", { plat: "play", code: "error" }), { e: "pw_unavail", plat: "play", code: "error" });
    assert.strictEqual(C.clean("pw_unavail", { code: "<script>" }).code, "empty");
    assert.strictEqual(C.clean("pw_unavail", {}).code, "empty");
    assert.strictEqual("why" in C.clean("pw_unavail", { why: "pdf", code: "unavailable" }), false);
  });
  test("server: același lucru, cu sesiunea; codul stă în cheie", () => {
    const rec = F.clean({ e: "pw_unavail", s: "ab12", plat: "play", code: "unavailable" });
    assert.deepStrictEqual(rec, { e: "pw_unavail", plat: "play", s: "ab12", code: "unavailable" });
    assert.strictEqual(F.clean({ e: "pw_unavail", s: "ab12", code: "x" }).code, "empty");
    const k = F.keyOf(rec, now, "r1");
    assert.match(k, /^d\/2026-11-01\/pw_unavail\/play\/-\/unavailable\/ab12\.r1$/);
    assert.strictEqual(F.parseKey(k).extra, "unavailable");
  });
  test("rezumat: sesiuni cu pw_unavail din cele care au văzut ecranul Pro", () => {
    const mk = (o) => F.keyOf(F.clean(o), now, Math.random().toString(36).slice(2, 6));
    const r = F.summarize([
      mk({ e: "pw_shown", s: "a1", plat: "play", why: "pdf" }), mk({ e: "pw_shown", s: "a2", plat: "play", why: "room" }),
      mk({ e: "pw_shown", s: "a3", plat: "play", why: "room" }), mk({ e: "pw_shown", s: "a4", plat: "play", why: "doc" }),
      mk({ e: "pw_unavail", s: "a1", plat: "play", code: "empty" }), mk({ e: "pw_unavail", s: "a2", plat: "play", code: "empty" }),
      mk({ e: "pw_unavail", s: "a2", plat: "play", code: "empty" })
    ]);
    assert.strictEqual(r.platforms.play.events.pw_unavail, 3);
    assert.strictEqual(r.platforms.play.sessions.pw_unavail, 2);
    assert.strictEqual(r.platforms.play.rates.unavail_per_shown_sessions_pct, 50);
  });
  test("aplicația trimite pw_unavail o singură dată pe sesiune, doar când nu sunt planuri", () => {
    const html = fs.readFileSync(path.join(here, "..", "app", "index.html"), "utf8");
    const i = html.indexOf('EBFunnel.send("pw_unavail"');
    assert.ok(i > 0);
    const around = html.slice(i - 160, i + 40);
    assert.match(around, /!PLAY\.plans\.length/);
    assert.match(around, /PLAY\.unSent/);
    assert.strictEqual(html.split('EBFunnel.send("pw_unavail"').length - 1, 1);
  });
});

describe("rezumat: pw_unavail pe coduri (D-133)", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  test("byCode: evenimente și sesiuni distincte pe platformă/cod", () => {
    const mk = (o) => F.keyOf(F.clean(o), now, Math.random().toString(36).slice(2, 6));
    const r = F.summarize([
      mk({ e: "pw_unavail", s: "a1", plat: "play", code: "unavailable" }), mk({ e: "pw_unavail", s: "a1", plat: "play", code: "unavailable" }),
      mk({ e: "pw_unavail", s: "a2", plat: "play", code: "unavailable" }), mk({ e: "pw_unavail", s: "a3", plat: "play", code: "empty" }),
      mk({ e: "pw_unavail", s: "w1", plat: "web", code: "error" }), mk({ e: "open", s: "a1", plat: "play" })
    ]);
    assert.deepEqual(r.byCode["play/unavailable"], { events: 3, sessions: 2 });
    assert.deepEqual(r.byCode["play/empty"], { events: 1, sessions: 1 });
    assert.deepEqual(r.byCode["web/error"], { events: 1, sessions: 1 });
    assert.deepEqual(Object.keys(r.byCode).sort(), ["play/empty", "play/unavailable", "web/error"]);
  });
  test("fără pw_unavail: byCode gol", () => assert.deepEqual(F.summarize([F.keyOf(F.clean({ e: "open", s: "a", plat: "web" }), now, "x")]).byCode, {}));
});


describe("hw_use — ce articole de catalog s-au folosit (D-170)", () => {
  const C = client().EBFunnel, now = Date.UTC(2026, 10, 20, 12);
  const ev = { e: "hw_use", s: "ab12cd34", plat: "play", brand: "blum", fam: "lift", art: "blum_aventos_hk_s" };
  test("client și server curăță la fel: marcă din listă, familie și cod doar slug", () => {
    const a = C.clean("hw_use", ev), b = F.clean(ev);
    assert.deepStrictEqual({ ...a, s: "ab12cd34" }, b);
    assert.strictEqual(b.brand, "blum"); assert.strictEqual(b.art, "blum_aventos_hk_s");
  });
  test("marcă străină, familie sau cod cu spații/majuscule/bară → respins; nimic „reparat”", () => {
    for (const bad of [{ brand: "acme" }, { fam: "Lift" }, { art: "a b" }, { art: "../x" }, { art: "x" }, { brand: undefined }, { fam: undefined }, { art: undefined }]) {
      assert.strictEqual(C.clean("hw_use", { ...ev, ...bad }), null, JSON.stringify(bad));
      assert.strictEqual(F.clean({ ...ev, ...bad }), null, JSON.stringify(bad));
    }
  });
  test("câmpuri în plus (cantitate, nume proiect) nu trec", () => {
    const r = F.clean({ ...ev, qty: 40, project: "Casa Popescu", email: "a@b.ro" });
    assert.deepStrictEqual(Object.keys(r).sort(), ["art", "brand", "e", "fam", "plat", "s"]);
    assert.ok(!("qty" in C.clean("hw_use", { ...ev, qty: 3 })));
  });
  test("cheia se citește înapoi; rezumatul numără sesiuni distincte pe marcă, familie, articol", () => {
    const mk = (o) => F.keyOf(F.clean(o), now, Math.random().toString(36).slice(2, 6));
    const keys = [
      mk(ev), mk(ev),                                                         // aceeași sesiune, de două ori
      mk({ ...ev, s: "zz99" }),
      mk({ ...ev, s: "zz99", brand: "hafele", fam: "cern", art: "haf_cerniera" }),
      mk({ e: "open", s: "zz99", plat: "play" })
    ];
    assert.deepStrictEqual(F.parseKey(keys[0]).art, "blum_aventos_hk_s");
    const r = F.summarize(keys);
    assert.strictEqual(r.byBrand.blum.sessions, 2);
    assert.strictEqual(r.byBrand.blum.articles.blum_aventos_hk_s.sessions, 2);
    assert.strictEqual(r.byBrand.blum.families.lift.sessions, 2);
    assert.strictEqual(r.byBrand.hafele.articles.haf_cerniera.fam, "cern");
    assert.strictEqual(r.platforms.play.events.hw_use, 4);
  });
  test("aplicația trimite marca, familia și codul, o singură dată pe sesiune, fără articolele proprii", () => {
    const html = fs.readFileSync(path.join(here, "..", "app", "index.html"), "utf8");
    const m = html.match(/function hwUseReport\(\)\{[\s\S]*?\n\}?\s*function hwUseSoon/);
    assert.ok(m, "hwUseReport există");
    assert.match(m[0], /HWUSE_SENT/); assert.match(m[0], /own\.has\(pr\.id\)/); assert.match(m[0], /pr\.custom/);
    assert.doesNotMatch(m[0], /qty:|name:|\.name\b/, "nicio cantitate sau nume în eveniment");
  });
});


describe("«Statistici anonime» debifat în Setări (5.95.0)", () => {
  const sent = [];
  const mk = (g) => client(Object.assign({ navigator: { sendBeacon: (u, b) => { sent.push(u); return true; } }, localStorage: { getItem() { return null; }, setItem() {} } }, g)).EBFunnel;
  test("cu __ebStatsOff nu pleacă niciun eveniment (nici open, nici hw_use)", () => {
    sent.length = 0; const F = mk({ __ebStatsOff: true });
    assert.strictEqual(F.send("open"), false);
    assert.strictEqual(F.send("hw_use", { brand: "blum", fam: "lift", art: "blum_hk_s" }), false);
    assert.strictEqual(sent.length, 0);
  });
  test("fără steag (implicit) pleacă, ca până acum", () => {
    sent.length = 0; const F = mk({});
    assert.strictEqual(F.send("open"), true); assert.strictEqual(sent.length, 1);
  });
  test("aplicația: casetă în Setări → Datele tale, implicit bifată (trimite), cu text în 7 limbi, aplicată pe loc și la pornire", () => {
    const html = fs.readFileSync(path.join(here, "..", "app", "index.html"), "utf8");
    assert.match(html, /id="sStatsOff"/); assert.match(html, /\$\("sStatsOff"\)\.checked=!S\.statsOff/);
    assert.match(html, /state\.settings\.statsOff=!ev\.target\.checked; applyStatsFlag\(\); persist\(\)/); assert.match(html, /applyStatsFlag\(\); EBFunnel\.send\("open"\)/);
    for (const l of ["ro", "it", "en", "fr", "de", "pl", "es"]) { const m = html.match(new RegExp("^" + l + ":\\{[^\\n]*", "m")); assert.ok(m, l); assert.match(m[0], /"?stStatsLbl"?:/, l); assert.match(m[0], /"?stStatsHint"?:/, l); }
  });
});


describe("codul numeric Play pe pw_unavail și pw_fail (D-179)", () => {
  const C = client().EBFunnel, now = Date.UTC(2026, 10, 20, 12);
  test("clientul transformă detail-ul Play în rc din lista închisă", () => {
    assert.strictEqual(C.clean("pw_unavail", { plat: "play", code: "unavailable", rc: "3 Billing unavailable" }).rc, "3");
    assert.strictEqual(C.clean("pw_unavail", { plat: "play", code: "error", rc: "-1 Service disconnected" }).rc, "m1");
    assert.strictEqual(C.clean("pw_unavail", { plat: "play", code: "error", rc: 12 }).rc, "12");
    for (const bad of ["99 x", "abc", "", undefined, null, "<script>", NaN]) assert.strictEqual("rc" in C.clean("pw_unavail", { code: "error", rc: bad }), false, String(bad));
  });
  test("pw_fail: renunțare / eroare / indisponibil; altceva devine error; rc numai dacă e din listă", () => {
    assert.deepStrictEqual(C.clean("pw_fail", { plat: "play", code: "canceled", rc: "1 User canceled" }), { e: "pw_fail", plat: "play", code: "canceled", rc: "1" });
    assert.strictEqual(C.clean("pw_fail", { code: "x" }).code, "error");
    assert.strictEqual("why" in C.clean("pw_fail", { why: "pdf", code: "error" }), false);
  });
  test("serverul respinge ce nu e în listă și păstrează rc în cheie", () => {
    assert.deepStrictEqual(F.clean({ e: "pw_fail", s: "ab12", plat: "play", code: "canceled", rc: "1" }), { e: "pw_fail", plat: "play", s: "ab12", code: "canceled", rc: "1" });
    assert.strictEqual("rc" in F.clean({ e: "pw_unavail", s: "ab12", plat: "play", code: "error", rc: "77" }), false);
    assert.strictEqual("rc" in F.clean({ e: "pw_fail", s: "ab12", plat: "play", code: "error", rc: "1; DROP" }), false);
    const k = F.keyOf(F.clean({ e: "pw_unavail", s: "ab12", plat: "play", code: "unavailable", rc: "3" }), now, "r1");
    assert.match(k, /^d\/2026-11-20\/pw_unavail\/play\/-\/unavailable_3\/ab12\.r1$/);
    assert.strictEqual(F.parseKey(k).extra, "unavailable_3");
  });
  test("rezumat: byCode neschimbat, byRc și byFail pe cod Play; chei vechi fără rc = na", () => {
    const mk = (o) => F.keyOf(F.clean(o), now, Math.random().toString(36).slice(2, 6));
    const r = F.summarize([
      mk({ e: "pw_unavail", s: "a1", plat: "play", code: "unavailable", rc: "3" }), mk({ e: "pw_unavail", s: "a2", plat: "play", code: "unavailable", rc: "3" }),
      mk({ e: "pw_unavail", s: "a3", plat: "play", code: "unavailable" }), mk({ e: "pw_unavail", s: "a4", plat: "play", code: "error", rc: "m1" }),
      mk({ e: "pw_fail", s: "b1", plat: "play", code: "canceled", rc: "1" }), mk({ e: "pw_fail", s: "b1", plat: "play", code: "canceled", rc: "1" }),
      mk({ e: "pw_fail", s: "b2", plat: "play", code: "error", rc: "6" }), mk({ e: "pw_fail", s: "b3", plat: "play", code: "error" })
    ]);
    assert.deepEqual(r.byCode["play/unavailable"], { events: 3, sessions: 3 });
    assert.deepEqual(r.byRc["play/unavailable/3"], { events: 2, sessions: 2 });
    assert.deepEqual(r.byRc["play/unavailable/na"], { events: 1, sessions: 1 });
    assert.deepEqual(r.byRc["play/error/m1"], { events: 1, sessions: 1 });
    assert.deepEqual(r.byFail["play/canceled/1"], { events: 2, sessions: 1 });
    assert.deepEqual(r.byFail["play/error/6"], { events: 1, sessions: 1 });
    assert.deepEqual(r.byFail["play/error/na"], { events: 1, sessions: 1 });
    assert.strictEqual(r.platforms.play.events.pw_fail, 4);
  });
  test("aplicația trimite pw_fail numai la „cumpără” eșuat și pw_unavail cu codul Play", () => {
    const html = fs.readFileSync(path.join(here, "..", "app", "index.html"), "utf8");
    assert.match(html, /if\(fromBuy\) EBFunnel\.send\("pw_fail",\{code:d\.code,rc:d\.detail\}\)/);
    assert.match(html, /EBFunnel\.send\("pw_unavail",\{[^}]*rc:PLAY\.detail\}/);
  });
});

describe("doc_sample — documentul de probă gratuit (D-180)", () => {
  const C = client().EBFunnel;
  const ev = { e: "doc_sample", s: "ab12cd34", plat: "play", why: "doc" };
  test("clientul și serverul păstrează numai motivul, la fel", () => {
    const a = C.clean("doc_sample", ev), b = F.clean(ev);
    assert.deepStrictEqual(a, { e: "doc_sample", plat: "play", why: "doc" });
    assert.deepStrictEqual({ ...a, s: "ab12cd34" }, b);
    assert.strictEqual(F.clean({ ...ev, why: "inventat" }).why, "plain");
    assert.ok(!("plan" in b) && !("code" in b));
  });
  test("rezumatul îl numără pe platformă și pe motiv", () => {
    const now = Date.UTC(2026, 10, 22);
    const keys = [F.keyOf(F.clean(ev), now, "aaaa"), F.keyOf(F.clean({ ...ev, s: "zz9", why: "pdf" }), now, "bbbb")];
    const r = F.summarize(keys);
    assert.strictEqual(r.platforms.play.events.doc_sample, 2);
    assert.strictEqual(r.byWhy.doc.doc_sample, 1);
    assert.strictEqual(r.byWhy.pdf.doc_sample, 1);
  });
});
