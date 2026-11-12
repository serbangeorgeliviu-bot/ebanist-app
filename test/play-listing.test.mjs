/* android/tools/play-listing.mjs — fără rețea: fetch simulat.
 *   cd test && node --test play-listing.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { readStore, makeClient, status, syncListing, setRollout, checkRollout, listReviews, replyReview } from "../android/tools/play-listing.mjs";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const SA = { client_email: "ci@p.iam.gserviceaccount.com", private_key: privateKey, token_uri: "https://oauth2.googleapis.com/token" };
const ok = (b) => new Response(JSON.stringify(b), { status: 200 });

function fake(over = {}) {
  const calls = [];
  const fn = async (url, opt = {}) => {
    const m = opt.method || "GET";
    calls.push({ url, method: m, body: opt.body });
    for (const [frag, rep] of Object.entries(over)) if (frag.startsWith("$") ? url.endsWith(frag.slice(1)) : `${m} ${url}`.includes(frag)) return typeof rep === "function" ? rep(opt) : rep;
    if (url.includes("oauth2")) return ok({ access_token: "tok" });
    if (url.endsWith("/edits")) return ok({ id: "E1" });
    return ok({});
  };
  return { fn, calls };
}
const client = (f) => makeClient({ sa: SA, pkg: "com.x", fetchFn: f.fn });

async function store(files) {
  const d = await mkdtemp(join(tmpdir(), "store-"));
  for (const [p, c] of Object.entries(files)) { await mkdir(join(d, p, ".."), { recursive: true }); await writeFile(join(d, p), c); }
  return d;
}

describe("readStore", () => {
  test("citește textele și imaginile, taie newline-ul final", async () => {
    const d = await store({ "ro/title.txt": "Ebanist\n", "ro/short.txt": "scurt\n", "ro/full.txt": "lung\n", "ro/images/phoneScreenshots/1.png": "x", "ro/images/phoneScreenshots/2.png": "y" });
    const s = await readStore(d);
    assert.equal(s.ro.title, "Ebanist");
    assert.equal(s.ro.images.phoneScreenshots.length, 2);
  });
  test("refuză titlul de 31 de caractere", async () => {
    const d = await store({ "ro/title.txt": "a".repeat(31), "ro/short.txt": "s", "ro/full.txt": "f" });
    await assert.rejects(readStore(d), /titlul are 31/);
  });
  test("refuză descrierea scurtă de 81 și lipsa unui fișier", async () => {
    const d = await store({ "ro/title.txt": "t", "ro/short.txt": "s".repeat(81), "ro/full.txt": "f" });
    await assert.rejects(readStore(d), /scurtă are 81/);
    const e = await store({ "ro/title.txt": "t", "ro/short.txt": "s" });
    await assert.rejects(readStore(e), /lipsește/);
  });
});

describe("status", () => {
  test("numai citire: nicio scriere, editarea se șterge, fără commit", async () => {
    const f = fake({
      "$/edits/E1/listings": ok({ listings: [{ language: "en-US", title: "T", shortDescription: "S", fullDescription: "F" }] }),
      "$/edits/E1/tracks": ok({ tracks: [{ track: "production", releases: [{ name: "7", status: "inProgress", userFraction: 0.2, versionCodes: ["7"] }] }] })
    });
    const r = await status(client(f));
    assert.equal(r.listings[0].title, "T");
    assert.equal(r.tracks[0].releases[0].userFraction, 0.2);
    assert.ok(!f.calls.some((c) => c.method === "PUT" || c.url.includes(":commit")));
    assert.ok(f.calls.some((c) => c.method === "DELETE" && c.url.endsWith("/edits/E1")));
  });
});

describe("syncListing", () => {
  const S = { ro: { title: "T", shortDescription: "S", fullDescription: "F", images: {} } };
  test("PUT pe limbă, apoi validate + commit", async () => {
    const f = fake();
    const r = await syncListing(client(f), S);
    assert.equal(r.dryRun, false);
    const put = f.calls.find((c) => c.method === "PUT");
    assert.ok(put.url.endsWith("/edits/E1/listings/ro"));
    assert.deepEqual(JSON.parse(put.body), { language: "ro", title: "T", shortDescription: "S", fullDescription: "F" });
    const i = f.calls.findIndex((c) => c.url.includes(":validate")), j = f.calls.findIndex((c) => c.url.includes(":commit"));
    assert.ok(i > 0 && j > i);
  });
  test("dry: nu confirmă", async () => {
    const f = fake();
    const r = await syncListing(client(f), S, { dryRun: true });
    assert.equal(r.dryRun, true);
    assert.ok(!f.calls.some((c) => c.url.includes(":commit")));
  });
  test("eșec la scriere: editarea se șterge, fără commit", async () => {
    const f = fake({ "PUT": new Response("nu", { status: 403 }) });
    await assert.rejects(syncListing(client(f), S), /HTTP 403/);
    assert.ok(f.calls.some((c) => c.method === "DELETE"));
    assert.ok(!f.calls.some((c) => c.url.includes(":commit")));
  });
  test("imagini: deleteall apoi urcare, cu tipul MIME", async () => {
    const d = await store({ "ro/images/featureGraphic/f.png": "png" });
    const f = fake();
    const s = { ro: { ...S.ro, images: { featureGraphic: [join(d, "ro/images/featureGraphic/f.png")] } } };
    await syncListing(client(f), s, { images: true });
    const di = f.calls.findIndex((c) => c.method === "DELETE" && c.url.endsWith("/listings/ro/featureGraphic"));
    const ui = f.calls.findIndex((c) => c.method === "POST" && c.url.includes("/upload/") && c.url.includes("/listings/ro/featureGraphic?uploadType=media"));
    assert.ok(di > 0 && ui > di);
  });
});

describe("rollout", () => {
  const prod = { track: "production", releases: [{ name: "7", status: "inProgress", userFraction: 0.2, versionCodes: ["7"] }] };
  test("0.5 schimbă userFraction", async () => {
    const f = fake({ "GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.x/edits/E1/tracks/production": ok(prod) });
    const r = await setRollout(client(f), { fraction: "0.5" });
    assert.deepEqual(r, { release: "7", before: 0.2, after: 0.5 });
    const put = JSON.parse(f.calls.find((c) => c.method === "PUT").body);
    assert.equal(put.releases[0].userFraction, 0.5);
  });
  test("1 = completed fără userFraction, numai cu confirm=da", async () => {
    assert.throws(() => checkRollout({ fraction: "1", confirm: "" }), /confirm=da/);
    const f = fake({ "GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.x/edits/E1/tracks/production": ok(prod) });
    await setRollout(client(f), { fraction: "1", confirm: "da" });
    const rel = JSON.parse(f.calls.find((c) => c.method === "PUT").body).releases[0];
    assert.equal(rel.status, "completed");
    assert.ok(!("userFraction" in rel));
  });
  test("fără lansare inProgress: eroare, fără commit", async () => {
    const f = fake({ "GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.x/edits/E1/tracks/production": ok({ releases: [{ status: "completed" }] }) });
    await assert.rejects(setRollout(client(f), { fraction: "0.5" }), /inProgress/);
    assert.ok(!f.calls.some((c) => c.url.includes(":commit")));
  });
  test("fracție invalidă", () => {
    for (const x of ["0", "1.5", "abc", ""]) assert.throws(() => checkRollout({ fraction: x }), /\(0, 1\]/);
  });
});

describe("recenzii", () => {
  test("listă normalizată", async () => {
    const f = fake({ "/reviews?": ok({ reviews: [{ reviewId: "r1", comments: [{ userComment: { starRating: 5, text: "ok", reviewerLanguage: "ro", appVersionName: "1.3.0" } }] }] }) });
    const r = await listReviews(client(f));
    assert.deepEqual(r[0], { id: "r1", stars: 5, lang: "ro", version: "1.3.0", text: "ok", replied: false });
  });
  test("răspuns ≤ 350, trimis la :reply", async () => {
    const f = fake();
    await replyReview(client(f), { reviewId: "r1", text: "Mulțumim!" });
    const c = f.calls.find((x) => x.url.endsWith("/reviews/r1:reply"));
    assert.equal(JSON.parse(c.body).replyText, "Mulțumim!");
    await assert.rejects(replyReview(client(f), { reviewId: "r1", text: "a".repeat(351) }), /351/);
  });
});
