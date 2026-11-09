/* Audit 2026-11-09 (E-01, E-02): limite de rată și de mărime pe funcțiile publice.
   Depozit în memorie, fetch finto: nicio cheie reală, nicio rețea. */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { allow, _setStore, clientIp } from "../netlify/functions/_limit.js";
import ai, { _reset, LIMITS } from "../netlify/functions/ai.js";
import fs from "node:fs";

const mem = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async setJSON(k, v) { m.set(k, v); } }; };

describe("_limit.allow", () => {
  beforeEach(() => _setStore(mem()));
  test("lasă să treacă până la max, apoi refuză", async () => {
    for (let i = 0; i < 3; i++) assert.strictEqual(await allow("t", "x", 3), true);
    assert.strictEqual(await allow("t", "x", 3), false);
  });
  test("id-uri diferite au contoare separate", async () => {
    await allow("t", "a", 1);
    assert.strictEqual(await allow("t", "a", 1), false);
    assert.strictEqual(await allow("t", "b", 1), true);
  });
  test("depozit stricat → fail-open (o comandă reală nu se refuză din cauza limitei)", async () => {
    _setStore({ async get() { throw new Error("down"); }, async setJSON() {} });
    assert.strictEqual(await allow("t", "x", 1), true);
  });
  test("în cheie nu intră valoarea brută", async () => {
    const st = mem(); _setStore(st);
    await allow("ai-ch", "comp_SECRETVALUE", 5);
    for (const k of st.m.keys()) assert.ok(!k.includes("SECRETVALUE"));
  });
  test("clientIp: antetul Netlify, apoi x-forwarded-for", () => {
    assert.strictEqual(clientIp(new Request("https://x", { headers: { "x-nf-client-connection-ip": "1.2.3.4" } })), "1.2.3.4");
    assert.strictEqual(clientIp(new Request("https://x", { headers: { "x-forwarded-for": "5.6.7.8, 9.9.9.9" } })), "5.6.7.8");
  });
});

describe("/api/ai: plafon pe licență", () => {
  const COMP = "comp_" + "b".repeat(24);
  let calls;
  beforeEach(() => {
    _reset(); _setStore(mem()); calls = 0;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test"; process.env.PRO_COMP_CODES = COMP;
    globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ content: [] }), { status: 200 }); };
  });
  const call = () => ai(new Request("https://ebanist.com/api/ai", { method: "POST",
    headers: { "x-ebanist-license": COMP, "x-nf-client-connection-ip": "8.8.8.8" },
    body: JSON.stringify({ model: "claude-opus-5", max_tokens: 100, messages: [{ role: "user", content: "x" }] }) }));
  test("după perCodeHour cereri → 429 și Anthropic neatins", async () => {
    for (let i = 0; i < LIMITS.perCodeHour; i++) assert.strictEqual((await call()).status, 200);
    const before = calls;
    const r = await call();
    assert.strictEqual(r.status, 429);
    assert.strictEqual(calls, before);
  });
});

describe("/api/orders: limite", () => {
  /* orders.js importă @netlify/blobs (absent în test): se citește sursa. */
  const src = fs.readFileSync(new URL("../netlify/functions/orders.js", import.meta.url), "utf8");
  test("limitele sunt rezonabile și declarate", () => {
    const body = Number(/MAX_ORDER_BODY = ([\d_]+)/.exec(src)[1].replace(/_/g, ""));
    const rate = Number(/ORDERS_PER_HOUR = (\d+)/.exec(src)[1]);
    assert.ok(body >= 500_000 && body <= 6_000_000);
    assert.ok(rate >= 5 && rate <= 100);
  });
  test("POST-ul de depunere verifică rata și mărimea ÎNAINTE de a parsa", () => {
    const i = src.indexOf('parts.length === 0) {');
    const seg = src.slice(i, i + 700);
    assert.ok(seg.indexOf("allow(") > 0 && seg.indexOf("allow(") < seg.indexOf("JSON.parse"));
    assert.ok(seg.indexOf("MAX_ORDER_BODY") < seg.indexOf("JSON.parse"));
  });
});
