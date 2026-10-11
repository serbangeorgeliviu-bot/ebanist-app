/* android-migrate.html — mutarea datelor Android pe ebanist.com (L.10, D-71).
   Două origini simulate cu page.route; puntea EbanistAndroid imită
   MainActivity (bucățile, fișierul, migrateSize/migrateGet).
   cd test && node --test android-migrate.test.js */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OLD = "https://whimsical-wisp-61cbbf.netlify.app";
const NEW = "https://ebanist.com";
const PAGE = fs.readFileSync(path.join(__dirname, "..", "android-migrate.html"), "utf8");
const BLANK = "<!doctype html><title>x</title>";
const CHUNK = 256 * 1024;

/* Puntea: aceleași metode și aceleași reguli ca Bridge din MainActivity. */
function bridge() {
  const CH = 256 * 1024;
  let buf = null;
  window.EbanistAndroid = {
    migrateBegin() { buf = []; },
    migratePut(s) { buf.push(s); },
    migrateExported(n) { window.__exported = { json: buf.join(""), parts: buf.length, items: n }; },
    migrateSize() { return String((window.__MIG || "").length); },
    migrateGet(from) {
      const d = window.__MIG || "";
      if (from < 0 || from >= d.length) return "";
      let to = Math.min(d.length, from + CH);
      const c = d.charCodeAt(to - 1);
      if (to < d.length && to - from > 1 && c >= 0xd800 && c <= 0xdbff) to--;
      return d.slice(from, to);
    },
    migrateFinish(s) { window.__status = s; }
  };
}

async function setup() {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext();
  await ctx.route("**/*", (r) => {
    const u = new URL(r.request().url());
    const body = u.pathname === "/android-migrate.html" ? PAGE : BLANK;
    r.fulfill({ status: 200, contentType: "text/html", body });
  });
  return { browser, ctx };
}

function seedIdb(page, kv, bk) {
  return page.evaluate(([kv, bk]) => new Promise((res, rej) => {
    const rq = indexedDB.open("ebanist", 1);
    rq.onupgradeneeded = () => {
      rq.result.createObjectStore("kv");
      rq.result.createObjectStore("backups", { keyPath: "id" });
    };
    rq.onsuccess = () => {
      const t = rq.result.transaction(["kv", "backups"], "readwrite");
      kv.forEach(([k, v]) => t.objectStore("kv").put(v, k));
      bk.forEach((b) => t.objectStore("backups").put(b));
      t.oncomplete = () => { rq.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }), [kv, bk]);
}

function readIdb(page) {
  return page.evaluate(() => new Promise((res) => {
    indexedDB.databases().then((dbs) => {
      if (!dbs.some((d) => d.name === "ebanist")) { res(null); return; }
      const rq = indexedDB.open("ebanist");
      rq.onsuccess = () => {
        const db = rq.result, out = { kv: {}, bk: [] };
        const t = db.transaction(["kv", "backups"], "readonly");
        t.objectStore("kv").openCursor().onsuccess = (e) => {
          const c = e.target.result; if (c) { out.kv[c.key] = c.value; c.continue(); }
        };
        t.objectStore("backups").getAll().onsuccess = (e) => { out.bk = e.target.result; };
        t.oncomplete = () => { db.close(); res(out); };
      };
    });
  }));
}

async function migrate(ctx) {
  const page = await ctx.newPage();
  await page.addInitScript(bridge);
  await page.goto(OLD + "/android-migrate.html");
  await page.waitForFunction(() => window.__exported || window.__status, null, { timeout: 10000 });
  const exp = await page.evaluate(() => window.__exported || null);
  assert.ok(exp, "exportul pe adresa veche n-a ajuns la Android: " + (await page.evaluate(() => window.__status)));
  await page.close();
  const p2 = await ctx.newPage();
  await p2.addInitScript(bridge);
  await p2.addInitScript((d) => { window.__MIG = d; }, exp.json);
  await p2.goto(NEW + "/android-migrate.html");
  await p2.waitForFunction(() => window.__status, null, { timeout: 10000 });
  const status = await p2.evaluate(() => window.__status);
  await p2.close();
  return { exp, status };
}

test("proiectele, licența și backup-urile trec pe ebanist.com; nimic nu se suprascrie", async () => {
  const { browser, ctx } = await setup();
  try {
    /* un proiect mare (> 2 bucăți) cu emoji pe granița bucăților */
    const big = "x".repeat(CHUNK - 40) + "🪵".repeat(50) + "y".repeat(CHUNK);
    const tp = JSON.stringify({ projects: [{ name: "Cucina 🪵 Rossi", note: big }] });
    const old = await ctx.newPage();
    await old.goto(OLD + "/");
    await old.evaluate((tp) => {
      localStorage.setItem("tagliapro", tp);
      localStorage.setItem("ebanist_ai_key", "sk-ant-test");
      localStorage.setItem("ebanist_theme", "light");
    }, tp);
    await seedIdb(old,
      [["state", { savedAt: 1, state: { projects: [{ name: "Cucina 🪵 Rossi" }] } }],
       ["license", { kind: "play", plan: "yearly" }],
       ["device", "dev-123"]],
      [{ id: "auto-1", at: 1, ver: "4.45.1", json: "{}" }, { id: "auto-2", at: 2, ver: "4.45.1", json: "{}" }]);

    /* ebanist.com are deja o cheie a lui (ex. tema aleasă) și un backup cu același id */
    const neu = await ctx.newPage();
    await neu.goto(NEW + "/");
    await neu.evaluate(() => localStorage.setItem("ebanist_theme", "dark"));
    await seedIdb(neu, [["meta", { seenIosTip: 5 }]], [{ id: "auto-2", at: 99, ver: "nou", json: "{}" }]);

    const { exp, status } = await migrate(ctx);
    assert.ok(exp.parts >= 3, "trimis pe bucăți: " + exp.parts);
    assert.match(status, /^ok:/);

    const ls = await neu.evaluate(() => ({
      tp: localStorage.getItem("tagliapro"), ai: localStorage.getItem("ebanist_ai_key"),
      theme: localStorage.getItem("ebanist_theme")
    }));
    assert.strictEqual(ls.tp, tp, "tagliapro identic, emoji întregi");
    assert.strictEqual(ls.ai, "sk-ant-test");
    assert.strictEqual(ls.theme, "dark", "cheia deja prezentă pe ebanist.com rămâne");

    const idb = await readIdb(neu);
    assert.deepStrictEqual(idb.kv.license, { kind: "play", plan: "yearly" });
    assert.strictEqual(idb.kv.device, "dev-123");
    assert.strictEqual(idb.kv.state.state.projects[0].name, "Cucina 🪵 Rossi");
    assert.deepStrictEqual(idb.kv.meta, { seenIosTip: 5 });
    const b2 = idb.bk.find((b) => b.id === "auto-2");
    assert.strictEqual(b2.ver, "nou", "backup-ul existent nu se suprascrie");
    assert.ok(idb.bk.some((b) => b.id === "auto-1"));

    /* adresa veche rămâne neatinsă */
    assert.strictEqual(await old.evaluate(() => localStorage.getItem("tagliapro")), tp);
    const oldIdb = await readIdb(old);
    assert.strictEqual(oldIdb.bk.length, 2);
  } finally { await browser.close(); }
});

test("instalare fără date vechi: nicio bază creată pe adresa veche, mutarea se încheie ok", async () => {
  const { browser, ctx } = await setup();
  try {
    const { exp, status } = await migrate(ctx);
    assert.strictEqual(exp.items, 0);
    assert.match(status, /^ok:0$/);
    const old = await ctx.newPage();
    await old.goto(OLD + "/");
    assert.strictEqual(await readIdb(old), null, "open() nu lasă o bază goală în urmă");
    const neu = await ctx.newPage();
    await neu.goto(NEW + "/");
    assert.strictEqual(await readIdb(neu), null);
  } finally { await browser.close(); }
});

test("fără EbanistAndroid (browser obișnuit) pagina nu atinge nimic", async () => {
  const { browser, ctx } = await setup();
  try {
    const page = await ctx.newPage();
    await page.goto(NEW + "/android-migrate.html");
    await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => localStorage.length), 0);
    assert.strictEqual(await readIdb(page), null);
  } finally { await browser.close(); }
});
