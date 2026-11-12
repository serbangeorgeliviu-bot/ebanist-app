/* =====================================================================
   Ebanist — planuri cu reînnoire automată și probă gratuită în Play (D-132)
   ---------------------------------------------------------------------
   Abonamentul `ebanist_pro` are azi două planuri „prepaid" (monthly, yearly),
   fără reînnoire și fără ofertă de probă. Scriptul ADAUGĂ lângă ele două
   planuri cu reînnoire (monthly-auto, yearly-auto), cu aceleași prețuri pe
   țări, și câte o ofertă „trial7" (7 zile gratuit, numai pentru cine n-a mai
   avut abonamentul). Planurile prepaid NU se ating: cei care au cumpărat
   rămân cumpărători, iar aplicația nouă are cum să cadă înapoi pe ele.

   Comenzi (PLAY_SUBS_CMD):
     plan    numai citire: scrie copia de siguranță (backup.json) și arată ce s-ar adăuga.
     apply   PLAY_APPLY=da: patch pe abonament (planurile vechi trimise NEschimbate),
             activează planurile noi, creează și activează ofertele.
   Fără dependențe; autentificare din play-upload.mjs.
   ===================================================================== */
import { readFile, writeFile } from "node:fs/promises";
import { accessToken } from "./play-upload.mjs";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
export const PRODUCT = "ebanist_pro";
export const AUTO = { monthly: "monthly-auto", yearly: "yearly-auto" };
export const OFFER = "trial7";
export const TRIAL = "P7D";
const REGIONS_VERSION = process.env.PLAY_REGIONS_VERSION || "2022/02";

async function failure(what, res) {
  let body = "";
  try { body = (await res.text()).slice(0, 900); } catch (e) { /* fără corp */ }
  return new Error(what + " → HTTP " + res.status + (body ? ": " + body : ""));
}

export function makeApi({ sa, pkg, fetchFn = fetch }) {
  let tok = null;
  const call = async (what, method, path, body) => {
    tok ||= await accessToken(sa, fetchFn);
    const res = await fetchFn(API + "/" + pkg + path, {
      method, headers: { Authorization: "Bearer " + tok, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw await failure(what, res);
    const t = await res.text();
    return t ? JSON.parse(t) : {};
  };
  return { call };
}

/* Un plan prepaid → planul cu reînnoire corespunzător: aceleași perioade, aceleași prețuri. */
export function autoPlanFrom(prepaid, id) {
  const period = (prepaid.prepaidBasePlanType || {}).billingPeriodDuration;
  if (!period) throw new Error("planul " + prepaid.basePlanId + " nu e prepaid (fără billingPeriodDuration)");
  return {
    basePlanId: id,
    autoRenewingBasePlanType: {
      billingPeriodDuration: period,
      gracePeriodDuration: "P7D",
      resubscribeState: "RESUBSCRIBE_STATE_ACTIVE",
      prorationMode: "SUBSCRIPTION_PRORATION_MODE_CHARGE_ON_NEXT_BILLING_DATE",
      legacyCompatible: false
    },
    regionalConfigs: (prepaid.regionalConfigs || []).map((g) => ({ regionCode: g.regionCode, newSubscriberAvailability: g.newSubscriberAvailability !== false, price: g.price })),
    otherRegionsConfig: prepaid.otherRegionsConfig
  };
}

/* Oferta de probă: faza unică gratuită, numai pentru cei noi la acest abonament. */
export function trialOffer(basePlan, productId = PRODUCT) {
  const regions = (basePlan.regionalConfigs || []).map((g) => g.regionCode);
  return {
    productId, basePlanId: basePlan.basePlanId, offerId: OFFER,
    phases: [{ recurrenceCount: 1, duration: TRIAL, regionalConfigs: regions.map((r) => ({ regionCode: r, free: {} })), otherRegionsConfig: { free: {} } }],
    regionalConfigs: regions.map((r) => ({ regionCode: r, newSubscriberAvailability: true })),
    otherRegionsConfig: { otherRegionsNewSubscriberAvailability: true },
    targeting: { acquisitionRule: { scope: { thisSubscription: {} } } }
  };
}

export function plan(sub) {
  const have = new Set((sub.basePlans || []).map((b) => b.basePlanId));
  const add = [];
  for (const b of sub.basePlans || []) {
    const id = AUTO[b.basePlanId];
    if (id && b.prepaidBasePlanType && !have.has(id)) add.push(autoPlanFrom(b, id));
  }
  return { add, already: Object.values(AUTO).filter((id) => have.has(id)) };
}

export async function run({ sa, pkg, apply = false, fetchFn = fetch, backup }) {
  const api = makeApi({ sa, pkg, fetchFn });
  const sub = await api.call("citește abonamentul", "GET", "/subscriptions/" + PRODUCT);
  if (backup) await backup(sub);
  const p = plan(sub);
  const out = { productId: PRODUCT, existing: (sub.basePlans || []).map((b) => b.basePlanId + ":" + b.state), toAdd: p.add.map((b) => b.basePlanId + " " + b.autoRenewingBasePlanType.billingPeriodDuration + " (" + b.regionalConfigs.length + " regiuni)"), already: p.already, applied: false };
  if (!apply) return out;
  if (p.add.length) {
    /* Planurile vechi pleacă exact cum au venit (fără câmpurile numai-citire); cele noi se adaugă. */
    const keep = (sub.basePlans || []).map((b) => { const c = { ...b }; delete c.state; return c; });
    const body = { ...sub, basePlans: [...keep, ...p.add] };
    await api.call("adaugă planurile", "PATCH", "/subscriptions/" + PRODUCT + "?updateMask=basePlans&regionsVersion.version=" + encodeURIComponent(REGIONS_VERSION) + "&latencyTolerance=PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_SENSITIVE", body);
    for (const b of p.add) await api.call("activează " + b.basePlanId, "POST", "/subscriptions/" + PRODUCT + "/basePlans/" + b.basePlanId + ":activate", {});
  }
  for (const id of Object.values(AUTO)) {
    const bp = ((await api.call("recitește", "GET", "/subscriptions/" + PRODUCT)).basePlans || []).find((b) => b.basePlanId === id);
    if (!bp) continue;
    let existing = [];
    try { existing = (await api.call("oferte " + id, "GET", "/subscriptions/" + PRODUCT + "/basePlans/" + id + "/offers?pageSize=50")).subscriptionOffers || []; } catch (e) { /* fără oferte */ }
    if (existing.some((o) => o.offerId === OFFER)) continue;
    await api.call("creează oferta " + id, "POST", "/subscriptions/" + PRODUCT + "/basePlans/" + id + "/offers?offerId=" + OFFER + "&regionsVersion.version=" + encodeURIComponent(REGIONS_VERSION), trialOffer(bp));
    await api.call("activează oferta " + id, "POST", "/subscriptions/" + PRODUCT + "/basePlans/" + id + "/offers/" + OFFER + ":activate", {});
  }
  out.applied = true;
  return out;
}

async function main() {
  const e = process.env;
  const sa = JSON.parse(await readFile(e.PLAY_SA_FILE, "utf8"));
  const out = await run({
    sa, pkg: e.PLAY_PACKAGE || "com.domusrenov.ebanist", apply: e.PLAY_APPLY === "da",
    backup: async (sub) => writeFile(e.PLAY_BACKUP_FILE || "subs-backup.json", JSON.stringify(sub, null, 1))
  });
  console.log(JSON.stringify(out, null, 2));
}

if (import.meta.url === "file://" + process.argv[1]) {
  main().catch((err) => { console.error("::error::" + err.message); process.exit(1); });
}
