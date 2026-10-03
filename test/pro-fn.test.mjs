/* /api/pro (netlify/functions/pro.js) con fetch finto: si prova cosa
   risponde la funzione per ogni risposta di Stripe, senza chiave vera. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import handler from "../netlify/functions/pro.js";

const future = Math.floor(Date.parse("2026-10-27T00:00:00Z") / 1000);
const SUB = (o = {}) => Object.assign({ id: "sub_1AbCdEfGhIjKlMn", status: "active",
  items: { data: [{ current_period_end: future, price: { lookup_key: "ebanist_pro_monthly" } }] } }, o);

let seen;
function stripeReplies(map) {
  globalThis.fetch = async (url, opt) => {
    seen.push({ url, auth: opt && opt.headers && opt.headers.Authorization });
    for (const [frag, [status, body]] of Object.entries(map))
      if (url.includes(frag)) return new Response(JSON.stringify(body), { status });
    return new Response(JSON.stringify({ error: { message: "No such" } }), { status: 404 });
  };
}
const call = body => handler(new Request("https://ebanist.com/api/pro", { method: "POST", body: JSON.stringify(body) }));

describe("/api/pro", () => {
  beforeEach(() => { seen = []; process.env.STRIPE_SECRET_KEY = "rk_test_x"; });

  test("sessione pagata → abbonamento attivo, email, piano, fine periodo", async () => {
    stripeReplies({ "checkout/sessions/cs_test_abcdefghij12": [200, { status: "complete", customer_details: { email: "a@b.c" }, subscription: SUB() }] });
    const r = await call({ session: "cs_test_abcdefghij12" });
    const j = await r.json();
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(j, { ok: true, sub: "sub_1AbCdEfGhIjKlMn", status: "active", periodEnd: "2026-10-27T00:00:00.000Z", plan: "monthly", email: "a@b.c" });
    assert.strictEqual(seen[0].auth, "Bearer rk_test_x");
    assert.ok(seen[0].url.includes("expand[]=subscription"));
  });
  test("sessione non ancora completata → 402 not-paid", async () => {
    stripeReplies({ "checkout/sessions/": [200, { status: "open", subscription: null }] });
    const r = await call({ session: "cs_test_abcdefghij12" });
    assert.strictEqual(r.status, 402);
    assert.strictEqual((await r.json()).error, "not-paid");
  });
  test("abbonamento di un altro prodotto → 403 wrong-product", async () => {
    stripeReplies({ "subscriptions/": [200, SUB({ items: { data: [{ current_period_end: future, price: { lookup_key: "plaquist_pro" } }] } })] });
    const r = await call({ sub: "sub_1AbCdEfGhIjKlMn" });
    assert.strictEqual(r.status, 403);
  });
  test("stati Stripe ridotti a tre", async () => {
    for (const [s, want] of [["active", "active"], ["trialing", "active"], ["past_due", "active"], ["canceled", "expired"], ["unpaid", "expired"], ["incomplete", "inactive"]]) {
      stripeReplies({ "subscriptions/": [200, SUB({ status: s })] });
      assert.strictEqual((await (await call({ sub: "sub_1AbCdEfGhIjKlMn" })).json()).status, want, s);
    }
  });
  test("vecchia API: current_period_end sull'abbonamento", async () => {
    stripeReplies({ "subscriptions/": [200, SUB({ current_period_end: future, items: { data: [{ price: { lookup_key: "ebanist_pro_yearly" } }] } })] });
    const j = await (await call({ sub: "sub_1AbCdEfGhIjKlMn" })).json();
    assert.strictEqual(j.periodEnd, "2026-10-27T00:00:00.000Z");
    assert.strictEqual(j.plan, "yearly");
  });
  test("abbonamento inesistente → 404", async () => {
    stripeReplies({});
    assert.strictEqual((await call({ sub: "sub_1NonEsisteAbc12" })).status, 404);
  });
  test("input malformati non arrivano a Stripe", async () => {
    stripeReplies({});
    for (const b of [{ sub: "sub_../../charges" }, { session: "cs_live_x" }, {}, { sub: "cus_123456789" }])
      assert.strictEqual((await call(b)).status, 400, JSON.stringify(b));
    assert.strictEqual(seen.length, 0);
  });
  test("senza chiave configurata → 503, senza chiamare Stripe", async () => {
    delete process.env.STRIPE_SECRET_KEY; stripeReplies({});
    assert.strictEqual((await call({ sub: "sub_1AbCdEfGhIjKlMn" })).status, 503);
    assert.strictEqual(seen.length, 0);
  });
  test("Stripe irraggiungibile → 504; GET → 405", async () => {
    globalThis.fetch = async () => { throw new Error("down"); };
    assert.strictEqual((await call({ sub: "sub_1AbCdEfGhIjKlMn" })).status, 504);
    assert.strictEqual((await handler(new Request("https://ebanist.com/api/pro"))).status, 405);
  });

  /* Founders (4.39.0): plata unica, Pro pe viata. Codul e sesiunea. */
  const PAID = (o = {}) => Object.assign({ id: "cs_live_abcdefghij12", mode: "payment", status: "complete", payment_status: "paid",
    payment_intent: "pi_123", customer_details: { email: "f@b.c" },
    line_items: { data: [{ price: { lookup_key: "ebanist_pro_founders" } }] } }, o);
  test("founders pagato → attivo, senza scadenza, piano founders", async () => {
    stripeReplies({ "checkout/sessions/": [200, PAID()], "payment_intents/": [200, { latest_charge: { refunded: false } }] });
    const j = await (await call({ session: "cs_live_abcdefghij12" })).json();
    assert.deepStrictEqual(j, { ok: true, sub: "cs_live_abcdefghij12", status: "active", periodEnd: null, plan: "founders", email: "f@b.c" });
    assert.ok(seen[0].url.includes("expand[]=line_items"));
  });
  test("founders rimborsato → expired", async () => {
    stripeReplies({ "checkout/sessions/": [200, PAID()], "payment_intents/": [200, { latest_charge: { refunded: true } }] });
    assert.strictEqual((await (await call({ session: "cs_live_abcdefghij12" })).json()).status, "expired");
  });
  test("founders: chiave senza permesso sui payment intents → resta attivo", async () => {
    stripeReplies({ "checkout/sessions/": [200, PAID()], "payment_intents/": [403, { error: {} }] });
    assert.strictEqual((await (await call({ session: "cs_live_abcdefghij12" })).json()).status, "active");
  });
  test("founders non pagato → 402", async () => {
    stripeReplies({ "checkout/sessions/": [200, PAID({ payment_status: "unpaid" })] });
    assert.strictEqual((await call({ session: "cs_live_abcdefghij12" })).status, 402);
  });
  test("pagamento unico di un altro prodotto → 403", async () => {
    stripeReplies({ "checkout/sessions/": [200, PAID({ line_items: { data: [{ price: { lookup_key: "plaquist_x" } }] } })] });
    assert.strictEqual((await call({ session: "cs_live_abcdefghij12" })).status, 403);
  });

  /* Pro gratuito (D-63): codici in PRO_COMP_CODES, nessuna chiamata a Stripe. */
  const COMP = "comp_" + "A1b2C3d4E5f6G7h8J9k0L1m2";
  test("codice comp in elenco → attivo, senza scadenza, piano comp, anche senza chiave Stripe", async () => {
    delete process.env.STRIPE_SECRET_KEY; stripeReplies({});
    process.env.PRO_COMP_CODES = "comp_altroCodiceAltroCodice12, " + COMP + "\n";
    const r = await call({ sub: COMP });
    assert.deepStrictEqual(await r.json(), { ok: true, sub: COMP, status: "active", periodEnd: null, plan: "comp" });
    assert.strictEqual(seen.length, 0);
  });
  test("codice comp tolto dall'elenco (o elenco vuoto) → 404, la licenza si chiude", async () => {
    stripeReplies({});
    process.env.PRO_COMP_CODES = "comp_altroCodiceAltroCodice12";
    assert.strictEqual((await call({ sub: COMP })).status, 404);
    delete process.env.PRO_COMP_CODES;
    assert.strictEqual((await call({ sub: COMP })).status, 404);
    assert.strictEqual(seen.length, 0);
  });
  test("codice comp troppo corto o con caratteri strani → 400", async () => {
    stripeReplies({});
    process.env.PRO_COMP_CODES = "comp_short";
    for (const c of ["comp_short", "comp_../../" + "x".repeat(24)])
      assert.strictEqual((await call({ sub: c })).status, 400, c);
  });
});
