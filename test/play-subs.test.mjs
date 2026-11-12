/* android/tools/play-subs.mjs — fără rețea: fetch simulat.
 *   cd test && node --test play-subs.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert";
import { generateKeyPairSync } from "node:crypto";
import { autoPlanFrom, trialOffer, plan, run, regionsVersion, AUTO, OFFER, TRIAL } from "../android/tools/play-subs.mjs";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const SA = { client_email: "ci@p.iam.gserviceaccount.com", private_key: privateKey, token_uri: "https://oauth2.googleapis.com/token" };
const ok = (b) => new Response(JSON.stringify(b), { status: 200 });
const price = (u) => ({ currencyCode: "EUR", units: String(u) });
const prepaid = (id, period, u) => ({ basePlanId: id, state: "ACTIVE", prepaidBasePlanType: { billingPeriodDuration: period, timeExtension: "TIME_EXTENSION_ACTIVE" },
  regionalConfigs: [{ regionCode: "RO", newSubscriberAvailability: true, price: { currencyCode: "RON", units: String(u) } }, { regionCode: "DE", newSubscriberAvailability: true, price: price(u) }],
  otherRegionsConfig: { usdPrice: { currencyCode: "USD", units: "10" }, eurPrice: price(u), newSubscriberAvailability: true } });
const SUB = { packageName: "com.x", productId: "ebanist_pro", basePlans: [prepaid("monthly", "P1M", 11), prepaid("yearly", "P1Y", 95)], listings: [{ languageCode: "en-US", title: "Ebanist Pro" }] };

function fake(sub = SUB) {
  const calls = [];
  let current = JSON.parse(JSON.stringify(sub)), offers = {};
  const fn = async (url, opt = {}) => {
    const m = opt.method || "GET";
    calls.push({ url, method: m, body: opt.body });
    if (url.includes("oauth2")) return ok({ access_token: "t" });
    if (m === "POST" && url.endsWith("/pricing:convertRegionPrices")) return ok({ regionVersion: { version: "2025/03" } });
    if (m === "PATCH") { current = JSON.parse(opt.body); current.basePlans = current.basePlans.map((b) => ({ ...b, state: b.state || "DRAFT" })); return ok(current); }
    if (m === "GET" && /\/subscriptions\/ebanist_pro$/.test(url)) return ok(current);
    if (m === "GET" && url.includes("/offers?")) return ok({ subscriptionOffers: offers[url.split("/basePlans/")[1].split("/")[0]] || [] });
    if (m === "POST" && url.includes("/offers?offerId=")) { offers[url.split("/basePlans/")[1].split("/")[0]] = [JSON.parse(opt.body)]; return ok({}); }
    return ok({});
  };
  return { fn, calls };
}

describe("planuri cu reînnoire din cele prepaid", () => {
  test("aceleași perioade și prețuri, fără câmpuri numai-citire", () => {
    const a = autoPlanFrom(prepaid("monthly", "P1M", 11), "monthly-auto");
    assert.equal(a.basePlanId, "monthly-auto");
    assert.equal(a.autoRenewingBasePlanType.billingPeriodDuration, "P1M");
    assert.equal(a.regionalConfigs.length, 2);
    assert.equal(a.regionalConfigs[0].price.currencyCode, "RON");
    assert.ok(!("state" in a) && !("prepaidBasePlanType" in a));
    assert.deepEqual(a.otherRegionsConfig.eurPrice, price(11));
  });
  test("un plan care nu e prepaid nu se transformă", () => assert.throws(() => autoPlanFrom({ basePlanId: "x" }, "x-auto"), /nu e prepaid/));
  test("oferta de probă: 7 zile gratuit, o singură fază, numai pentru cei noi la abonament", () => {
    const o = trialOffer({ basePlanId: "monthly-auto", regionalConfigs: [{ regionCode: "RO" }, { regionCode: "DE" }] });
    assert.equal(o.offerId, OFFER); assert.equal(o.phases.length, 1);
    assert.equal(o.phases[0].duration, TRIAL); assert.equal(o.phases[0].recurrenceCount, 1);
    assert.deepEqual(o.phases[0].regionalConfigs.map((g) => g.regionCode), ["RO", "DE"]);
    assert.ok(o.phases[0].regionalConfigs.every((g) => g.free));
    assert.deepEqual(o.targeting, { acquisitionRule: { scope: { thisSubscription: {} } } });
  });
  test("plan(): adaugă numai ce lipsește; idempotent", () => {
    assert.deepEqual(plan(SUB).add.map((b) => b.basePlanId), ["monthly-auto", "yearly-auto"]);
    const done = { ...SUB, basePlans: [...SUB.basePlans, { basePlanId: "monthly-auto" }, { basePlanId: "yearly-auto" }] };
    assert.equal(plan(done).add.length, 0);
    assert.deepEqual(plan(done).already, ["monthly-auto", "yearly-auto"]);
  });
});

describe("run", () => {
  test("fără apply: numai citire, copie de siguranță, nicio scriere", async () => {
    const f = fake(); let saved = null;
    const r = await run({ sa: SA, pkg: "com.x", apply: false, fetchFn: f.fn, backup: async (s) => { saved = s; } });
    assert.equal(r.applied, false);
    assert.deepEqual(r.toAdd.map((x) => x.split(" ")[0]), ["monthly-auto", "yearly-auto"]);
    assert.equal(saved.basePlans.length, 2);
    assert.ok(f.calls.every((c) => c.method === "GET" || c.url.includes("oauth2")));
  });
  test("apply: planurile vechi pleacă neschimbate, cele noi se adaugă, apoi activare și oferte", async () => {
    const f = fake();
    const r = await run({ sa: SA, pkg: "com.x", apply: true, fetchFn: f.fn });
    assert.equal(r.applied, true);
    const patch = f.calls.find((c) => c.method === "PATCH");
    assert.match(patch.url, /updateMask=basePlans/); assert.match(patch.url, /regionsVersion\.version=2025%2F03/);
    assert.equal(r.regionsVersion, "2025/03");
    const body = JSON.parse(patch.body);
    assert.deepEqual(body.basePlans.map((b) => b.basePlanId), ["monthly", "yearly", "monthly-auto", "yearly-auto"]);
    assert.deepEqual(body.basePlans[0].prepaidBasePlanType, SUB.basePlans[0].prepaidBasePlanType);
    assert.ok(!("state" in body.basePlans[0]));
    const acts = f.calls.filter((c) => c.url.endsWith(":activate")).map((c) => c.url.split("/subscriptions/ebanist_pro/")[1]);
    assert.deepEqual(acts, ["basePlans/monthly-auto:activate", "basePlans/yearly-auto:activate", "basePlans/monthly-auto/offers/trial7:activate", "basePlans/yearly-auto/offers/trial7:activate"]);
    assert.equal(f.calls.filter((c) => c.method === "POST" && c.url.includes("/offers?offerId=trial7")).length, 2);
  });
  test("a doua rulare nu mai scrie nimic", async () => {
    const f = fake();
    await run({ sa: SA, pkg: "com.x", apply: true, fetchFn: f.fn });
    const n = f.calls.length;
    await run({ sa: SA, pkg: "com.x", apply: true, fetchFn: f.fn });
    assert.equal(f.calls.slice(n).filter((c) => c.method !== "GET" && !c.url.includes("oauth2") && !c.url.endsWith("/pricing:convertRegionPrices")).length, 0);
  });
  test("eroare la patch: nimic activat, eroarea ajunge la om", async () => {
    const f = fake(); const inner = f.fn;
    const fn = async (u, o = {}) => (o.method === "PATCH" ? new Response("regionsVersion invalid", { status: 400 }) : inner(u, o));
    await assert.rejects(run({ sa: SA, pkg: "com.x", apply: true, fetchFn: fn }), /HTTP 400.*regionsVersion/);
    assert.ok(!f.calls.some((c) => c.url.endsWith(":activate")));
  });
});

describe("versiunea de regiuni", () => {
  test("vine de la Play (convertRegionPrices), nu e scrisă în cod", async () => {
    const f = fake();
    const { makeApi } = await import("../android/tools/play-subs.mjs");
    const v = await regionsVersion(makeApi({ sa: SA, pkg: "com.x", fetchFn: f.fn }), {});
    assert.equal(v, "2025/03");
  });
  test("PLAY_REGIONS_VERSION din mediu are întâietate; răspuns fără versiune = eroare", async () => {
    assert.equal(await regionsVersion(null, { PLAY_REGIONS_VERSION: "2024/01" }), "2024/01");
    const { makeApi } = await import("../android/tools/play-subs.mjs");
    const fn = async (u, o = {}) => (u.includes("oauth2") ? ok({ access_token: "t" }) : ok({}));
    await assert.rejects(regionsVersion(makeApi({ sa: SA, pkg: "com.x", fetchFn: fn }), {}), /regionVersion/);
  });
});
