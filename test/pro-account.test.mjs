/* /api/pro-account (D-185): Pro legat de cont. Supabase si Stripe sunt false.
   Adresa vine NUMAI de la Supabase, numai daca e confirmata. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import handler from "../netlify/functions/pro-account.js";

const future = Math.floor(Date.parse("2026-12-04T00:00:00Z") / 1000);
const SUB = (id, o = {}) => Object.assign({ id, status: "active",
  items: { data: [{ current_period_end: future, price: { lookup_key: "ebanist_pro_monthly" } }] } }, o);
const TOKEN = "aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccc";

let stripeCalls, sbCalls;
function world({ user = { id: "u1", email: "Andrea@Example.com", email_confirmed_at: "2026-11-01T00:00:00Z" }, sbStatus = 200,
  customers = [], subs = [], sessions = [] } = {}) {
  stripeCalls = []; sbCalls = [];
  globalThis.fetch = async (url, opt) => {
    if (url.includes("/auth/v1/user")) {
      sbCalls.push({ url, headers: opt.headers });
      return new Response(JSON.stringify(sbStatus === 200 ? user : {}), { status: sbStatus });
    }
    stripeCalls.push(url);
    const body = url.includes("/customers?") ? { data: customers }
      : url.includes("/subscriptions?") ? { data: subs }
      : url.includes("/checkout/sessions?") ? { data: sessions }
      : { error: {} };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}
const call = (body) => handler(new Request("https://ebanist.com/api/pro-account", { method: "POST", body: JSON.stringify(body) }));

describe("/api/pro-account", () => {
  beforeEach(() => { process.env.STRIPE_SECRET_KEY = "rk_test_x"; });

  test("cont confirmat cu abonament activ → codul, cautat dupa adresa din Supabase", async () => {
    world({ customers: [{ id: "cus_1" }], subs: [SUB("sub_1UMv4hFvCaKbylK7HytsnZ8f")] });
    const r = await call({ token: TOKEN, email: "altcineva@example.com" });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true, codes: ["sub_1UMv4hFvCaKbylK7HytsnZ8f"] });
    assert.ok(stripeCalls.some(u => u.includes(encodeURIComponent("Andrea@Example.com"))), "adresa contului");
    assert.ok(!stripeCalls.some(u => u.includes("altcineva")), "adresa din cerere se ignora");
    assert.strictEqual(sbCalls[0].headers.Authorization, "Bearer " + TOKEN);
  });
  test("nicio plata pe adresa → lista goala, nu eroare", async () => {
    world();
    const r = await call({ token: TOKEN });
    assert.deepStrictEqual(await r.json(), { ok: true, codes: [] });
  });
  test("abonament expirat sau alt produs → nu intra", async () => {
    world({ customers: [{ id: "cus_1" }], subs: [SUB("sub_1ScadutAbcdefgh", { status: "canceled" }),
      SUB("sub_1AltProdus1234", { items: { data: [{ price: { lookup_key: "plaquist_pro" } }] } })] });
    assert.deepStrictEqual((await (await call({ token: TOKEN })).json()).codes, []);
  });
  test("Founders platit → codul cs_…", async () => {
    const ses = { id: "cs_live_abcdefghij12", mode: "payment", status: "complete", payment_status: "paid",
      line_items: { data: [{ price: { lookup_key: "ebanist_pro_founders" } }] } };
    world({ customers: [{ id: "cus_1" }], sessions: [ses] });
    assert.deepStrictEqual((await (await call({ token: TOKEN })).json()).codes, ["cs_live_abcdefghij12"]);
  });
  test("cont neconfirmat → 403, Stripe nu e interogat", async () => {
    world({ user: { id: "u2", email: "x@example.com", email_confirmed_at: null }, customers: [{ id: "cus_1" }], subs: [SUB("sub_1UMv4hFvCaKbylK7HytsnZ8f")] });
    const r = await call({ token: TOKEN });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).error, "unconfirmed");
    assert.strictEqual(stripeCalls.length, 0);
  });
  test("jeton respins de Supabase → 401", async () => {
    world({ sbStatus: 401 });
    const r = await call({ token: TOKEN });
    assert.strictEqual(r.status, 401);
    assert.strictEqual(stripeCalls.length, 0);
  });
  test("Supabase cazut → 504 (aplicatia reincearca la pornire)", async () => {
    world({ sbStatus: 500 });
    assert.strictEqual((await call({ token: TOKEN })).status, 504);
  });
  test("jeton lipsa sau gresit ca forma → 400, nimeni nu e intrebat", async () => {
    world();
    assert.strictEqual((await call({})).status, 400);
    assert.strictEqual((await call({ token: "nu-e-jwt" })).status, 400);
    assert.strictEqual(sbCalls.length + stripeCalls.length, 0);
  });
  test("fara cheie Stripe → 503; GET → 405", async () => {
    world(); delete process.env.STRIPE_SECRET_KEY;
    assert.strictEqual((await call({ token: TOKEN })).status, 503);
    const g = await handler(new Request("https://ebanist.com/api/pro-account", { method: "GET" }));
    assert.strictEqual(g.status, 405);
  });
});

describe("legatura din aplicatie (D-185)", () => {
  test("client: accountCodes in EBLicense, proFromAccount chemat dupa login, numai pe web", async () => {
    const fs = await import("node:fs"), path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "..");
    const lic = fs.readFileSync(path.join(root, "app/ebanist-license.js"), "utf8");
    const app = fs.readFileSync(path.join(root, "app/index.html"), "utf8");
    assert.ok(lic.includes("accountCodes: accountCodes") && lic.includes('"/api/pro-account"'));
    assert.strictEqual((app.match(/startLiveSync\(\); proFromAccount\(\);/g) || []).length, 2, "dupa login si la pornire");
    const fn = app.slice(app.indexOf("async function proFromAccount"), app.indexOf("async function proDeactivate"));
    assert.ok(/isPro\(\)\|\|playOn\(\)/.test(fn) && fn.includes("window.EbanistAndroid"), "nu pe Android, nu daca e deja Pro");
    for (const l of ["it", "ro", "en", "fr", "de", "pl", "es"])
      assert.ok(new RegExp('Object\\.assign\\(I18N\\.' + l + ',\\{"proFromAcct"').test(app), "proFromAcct " + l);
  });
});
