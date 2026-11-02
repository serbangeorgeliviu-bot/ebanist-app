/* /api/ai (netlify/functions/ai.js): licenza verificata, cheia solo sul server,
   campi e modelli in lista bianca. fetch finto: nessuna chiave vera. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import handler, { _reset } from "../netlify/functions/ai.js";

const COMP = "comp_" + "a".repeat(24);
let calls;
function fake({ anthropic = [200, { content: [{ type: "tool_use", input: {} }] }], stripe = [200, null] } = {}) {
  globalThis.fetch = async (url, opt) => {
    calls.push({ url: String(url), opt });
    if (String(url).includes("api.anthropic.com")) return new Response(JSON.stringify(anthropic[1]), { status: anthropic[0] });
    return new Response(JSON.stringify(stripe[1]), { status: stripe[0] });
  };
}
const body = (o = {}) => Object.assign({ model: "claude-opus-5", max_tokens: 2000, messages: [{ role: "user", content: "x" }] }, o);
const call = (b, code = COMP, extra = {}) => handler(new Request("https://ebanist.com/api/ai", {
  method: "POST", headers: Object.assign({ "x-ebanist-license": code }, extra), body: typeof b === "string" ? b : JSON.stringify(b) }));
const anth = () => calls.filter(c => c.url.includes("api.anthropic.com"));

describe("/api/ai", () => {
  beforeEach(() => { calls = []; _reset(); process.env.ANTHROPIC_API_KEY = "sk-ant-test"; process.env.PRO_COMP_CODES = COMP; delete process.env.PRO_COMP_CODES_2; fake(); });

  test("licenza comp valida → cererea ajunge la Anthropic cu cheia serverului", async () => {
    const r = await call(body());
    assert.strictEqual(r.status, 200);
    assert.strictEqual(anth().length, 1);
    assert.strictEqual(anth()[0].opt.headers["x-api-key"], "sk-ant-test");
  });
  test("fără cheie pe server → 503, nimic trimis", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    assert.strictEqual((await call(body())).status, 503);
    assert.strictEqual(calls.length, 0);
  });
  test("fără cod de licență → 401", async () => {
    const r = await call(body(), "");
    assert.strictEqual(r.status, 401);
    assert.strictEqual(anth().length, 0);
  });
  test("cod comp necunoscut → 403, Anthropic neatins", async () => {
    const r = await call(body(), "comp_" + "b".repeat(24));
    assert.strictEqual(r.status, 403);
    assert.strictEqual(anth().length, 0);
  });
  test("abonament Stripe expirat → 403", async () => {
    process.env.STRIPE_SECRET_KEY = "rk_test_x";
    fake({ stripe: [200, { id: "sub_1AbCdEfGh", status: "canceled", items: { data: [{ price: { lookup_key: "ebanist_pro_monthly" } }] } }] });
    assert.strictEqual((await call(body(), "sub_1AbCdEfGh")).status, 403);
    assert.strictEqual(anth().length, 0);
  });
  test("abonament Stripe activ → trece", async () => {
    process.env.STRIPE_SECRET_KEY = "rk_test_x";
    fake({ stripe: [200, { id: "sub_1AbCdEfGh", status: "active", items: { data: [{ price: { lookup_key: "ebanist_pro_monthly" } }] } }] });
    assert.strictEqual((await call(body(), "sub_1AbCdEfGh")).status, 200);
  });
  test("model din afara listei → 400", async () => {
    assert.strictEqual((await call(body({ model: "claude-haiku-5-5" }))).status, 400);
    assert.strictEqual(anth().length, 0);
  });
  test("max_tokens plafonat, câmpuri necunoscute eliminate", async () => {
    await call(body({ max_tokens: 99999, stream: true, metadata: { user_id: "x" } }));
    const sent = JSON.parse(anth()[0].opt.body);
    assert.strictEqual(sent.max_tokens, 4000);
    assert.strictEqual(sent.stream, undefined);
    assert.strictEqual(sent.metadata, undefined);
  });
  test("licența verificată se ține minte (a doua cerere nu mai întreabă)", async () => {
    process.env.STRIPE_SECRET_KEY = "rk_test_x";
    fake({ stripe: [200, { id: "sub_1AbCdEfGh", status: "active", items: { data: [{ price: { lookup_key: "ebanist_pro_monthly" } }] } }] });
    await call(body(), "sub_1AbCdEfGh"); await call(body(), "sub_1AbCdEfGh");
    assert.strictEqual(calls.filter(c => c.url.includes("api.stripe.com")).length, 1);
  });
  test("blocurile de imagine (base64) trec neschimbate către Anthropic", async () => {
    const img = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "/9j/".repeat(50000) } };
    const messages = [{ role: "user", content: [img, { type: "text", text: "vezi poza" }] }];
    const r = await call(body({ messages }));
    assert.strictEqual(r.status, 200);
    const sent = JSON.parse(anth()[0].opt.body);
    assert.deepStrictEqual(sent.messages, messages);
  });
  test("JSON stricat → 400; GET → 405; corp prea mare → 413", async () => {
    assert.strictEqual((await call("nu e json")).status, 400);
    assert.strictEqual((await handler(new Request("https://ebanist.com/api/ai"))).status, 405);
    assert.strictEqual((await call(body(), COMP, { "content-length": "9000000" })).status, 413);
  });
  test("eroarea Anthropic se întoarce cu același status", async () => {
    fake({ anthropic: [401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }] });
    const r = await call(body());
    assert.strictEqual(r.status, 401);
    assert.match((await r.json()).error.message, /x-api-key/);
  });
});
