/* La edge function che manda /api/pro di whimsical-wisp a ebanist.com:
   mai su ebanist.com (sarebbe un giro infinito), sempre altrove. */
import { test } from "node:test";
import assert from "node:assert";
import handler, { target } from "../netlify/edge-functions/pro-proxy.js";

test("su ebanist.com risponde la funzione locale", () => {
  assert.strictEqual(target("https://ebanist.com/api/pro"), null);
  assert.strictEqual(target("https://www.ebanist.com/api/pro"), null);
});
test("altrove si va a ebanist.com", () => {
  assert.strictEqual(target("https://whimsical-wisp-61cbbf.netlify.app/api/pro"), "https://ebanist.com/api/pro");
  assert.strictEqual(target("https://ebanist-com.netlify.app/api/pro"), "https://ebanist.com/api/pro");
});
test("inoltra metodo e corpo, rende stato e corpo, senza cache", async () => {
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }); };
  const r = await handler(new Request("https://whimsical-wisp-61cbbf.netlify.app/api/pro", { method: "POST", body: '{"sub":"comp_x"}', headers: { "content-type": "application/json" } }));
  assert.strictEqual(seen.url, "https://ebanist.com/api/pro");
  assert.strictEqual(seen.init.method, "POST");
  assert.strictEqual(seen.init.body, '{"sub":"comp_x"}');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(await r.text(), '{"ok":true}');
  assert.strictEqual(r.headers.get("cache-control"), "no-store");
});
test("ebanist.com irraggiungibile → 504 unreachable", async () => {
  globalThis.fetch = async () => { throw new Error("down"); };
  const r = await handler(new Request("https://whimsical-wisp-61cbbf.netlify.app/api/pro", { method: "POST", body: "{}" }));
  assert.strictEqual(r.status, 504);
  assert.strictEqual((await r.json()).error, "unreachable");
});
test("su ebanist.com non tocca niente", async () => {
  assert.strictEqual(await handler(new Request("https://ebanist.com/api/pro", { method: "POST", body: "{}" })), undefined);
});
