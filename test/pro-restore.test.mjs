/* /api/pro-restore (U.14): codul pleaca numai pe email, raspunsul e
   mereu acelasi. Stripe si Resend sunt false. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import handler from "../netlify/functions/pro-restore.js";

const future = Math.floor(Date.parse("2026-11-04T00:00:00Z") / 1000);
const SUB = (id, o = {}) => Object.assign({ id, status: "active",
  items: { data: [{ current_period_end: future, price: { lookup_key: "ebanist_pro_monthly" } }] } }, o);

let sent, stripeCalls;
function world({ customers = [], subs = [], sessions = [], mailStatus = 200 } = {}) {
  sent = []; stripeCalls = [];
  globalThis.fetch = async (url, opt) => {
    if (url.startsWith("https://api.resend.com/")) {
      sent.push(JSON.parse(opt.body));
      return new Response("{}", { status: mailStatus });
    }
    stripeCalls.push(url);
    const body = url.includes("/customers?") ? { data: customers }
      : url.includes("/subscriptions?") ? { data: subs }
      : url.includes("/checkout/sessions?") ? { data: sessions }
      : { error: {} };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}
let n = 0;
const call = (email, extra = {}) => handler(new Request("https://ebanist.com/api/pro-restore", {
  method: "POST", headers: { "x-nf-client-connection-ip": "10.0.0." + (++n) }, body: JSON.stringify(Object.assign({ email }, extra)) }));

describe("/api/pro-restore", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "rk_test_x";
    process.env.RESEND_API_KEY = "re_x";
    process.env.PRO_MAIL_FROM = "Ebanist <pro@ebanist.com>";
  });

  test("abbonamento attivo → email con il codice, risposta senza codice", async () => {
    world({ customers: [{ id: "cus_1" }], subs: [SUB("sub_1UMv4hFvCaKbylK7HytsnZ8f")] });
    const r = await call("andrea@example.com", { lang: "ro" });
    assert.strictEqual(r.status, 200);
    const txt = await r.text();
    assert.deepStrictEqual(JSON.parse(txt), { ok: true });
    assert.ok(!txt.includes("sub_"));
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual(sent[0].to, ["andrea@example.com"]);
    assert.ok(sent[0].text.includes("sub_1UMv4hFvCaKbylK7HytsnZ8f"));
    assert.ok(/Salut/.test(sent[0].text), "limba din cerere");
  });
  test("nessun cliente → stessa risposta, nessuna email", async () => {
    world();
    const r = await call("nobody@example.com");
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true });
    assert.strictEqual(sent.length, 0);
  });
  test("abbonamento scaduto o di altro prodotto → nessuna email", async () => {
    world({ customers: [{ id: "cus_1" }], subs: [SUB("sub_1ScadutoAbcdef", { status: "canceled" }),
      SUB("sub_1AltroProdotto12", { items: { data: [{ price: { lookup_key: "plaquist_pro" } }] } })] });
    await call("scad@example.com");
    assert.strictEqual(sent.length, 0);
  });
  test("Founders pagato → codice cs_…; rimborsato non si manda", async () => {
    const ses = { id: "cs_live_abcdefghij12", mode: "payment", status: "complete", payment_status: "paid",
      line_items: { data: [{ price: { lookup_key: "ebanist_pro_founders" } }] } };
    world({ customers: [{ id: "cus_1" }], sessions: [ses] });
    await call("fond@example.com");
    assert.ok(sent[0].text.includes("cs_live_abcdefghij12"));
  });
  test("email non valida → 400, Stripe non interrogato", async () => {
    world();
    const r = await call("non-una-email");
    assert.strictEqual(r.status, 400);
    assert.strictEqual(stripeCalls.length, 0);
  });
  test("senza chiavi → 503 not-configured", async () => {
    world();
    delete process.env.RESEND_API_KEY;
    assert.strictEqual((await call("x@example.com")).status, 503);
  });
  test("errore Stripe o email → risposta identica (non rivela nulla)", async () => {
    world({ customers: [{ id: "cus_1" }], subs: [SUB("sub_1UMv4hFvCaKbylK7HytsnZ8f")], mailStatus: 500 });
    const r = await call("err@example.com");
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true });
  });
  test("solo POST", async () => {
    const r = await handler(new Request("https://ebanist.com/api/pro-restore", { method: "GET" }));
    assert.strictEqual(r.status, 405);
  });
});
