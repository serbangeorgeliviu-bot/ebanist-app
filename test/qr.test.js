/* Generatorul de cod QR din Atelier E2 (app/ebanist-qr.js). Rulează: node --test qr.test.js
   „Golden”-urile de mai jos au fost verificate pe 26.10.2026 cu un decodor independent (jsQR 1.4.0):
   toate se citesc înapoi la textul de intrare. Dacă `jsqr` e instalat (npm i jsqr în afara repo-ului,
   NODE_PATH către el), testul face și citirea înapoi; fără el, rămân golden-urile și structura. */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-qr.js"), "utf8"), ctx);
const Q = ctx.EBQR;
let jsQR = null; try { jsQR = require("jsqr"); } catch (e) { /* opțional */ }

const URL_ = "https://ebanist.com/?atelier=1#e=6f1c2b7e-9a3d-4c58-8e21-0b5d7a9c4e13.r12";
const GOLD = [
  ["A", "M", 1, 3, "2092585037e9da56"],
  ["HELLO WORLD", "L", 1, 3, "d611fb7162361a13"],
  [URL_, "M", 5, 2, "6980d1d17c311215"],
  ["x".repeat(100), "M", 6, 0, "3b1cbac996b5a950"],
  ["y".repeat(213), "M", 10, 1, "f07f0416270dd373"],
  ["z".repeat(271), "L", 10, 1, "2d9234da39da9eea"],
  ["Tâmplărie €", "M", 2, 4, "94fb3caab176d0bb"],
  /* versiunea 8-M: 4 blocuri (nu 5); o greșeală de tabel aici producea coduri ilizibile */
  ["m".repeat(130), "M", 8, 1, "0d7605fb1de5c472"]
];
const hash = q => crypto.createHash("sha256").update(q.modules.map(r => r.map(b => b ? 1 : 0).join("")).join("")).digest("hex").slice(0, 16);

function decode(q, scale = 4, border = 4) {
  const n = q.size, W = (n + border * 2) * scale, d = new Uint8ClampedArray(W * W * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules[y][x])
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + border) * scale + dy) * W + (x + border) * scale + dx) * 4; d[i] = d[i + 1] = d[i + 2] = 0;
    }
  const r = jsQR(d, W, W); return r && r.data;
}

test("golden: versiune, mască și matrice identice cu cele verificate", () => {
  for (const [t, l, ver, mask, h] of GOLD) {
    const q = Q.encode(t, l);
    assert.equal(q.version, ver, `versiune ${t.slice(0, 12)}`);
    assert.equal(q.mask, mask, `mască ${t.slice(0, 12)}`);
    assert.equal(hash(q), h, `matrice ${t.slice(0, 12)}`);
    assert.equal(q.size, ver * 4 + 17);
  }
});

test("structură: cele trei finder-e, tiparul de sincronizare și modulul întunecat", () => {
  const q = Q.encode(URL_), m = q.modules, n = q.size;
  const finder = (cx, cy) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy)); assert.equal(m[cy + dy][cx + dx], d !== 2, `finder ${cx},${cy} ${dx},${dy}`); } };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  for (let i = 8; i < n - 8; i++) { assert.equal(m[6][i], i % 2 === 0, "timing orizontal " + i); assert.equal(m[i][6], i % 2 === 0, "timing vertical " + i); }
  assert.equal(m[n - 8][8], true, "modulul întunecat");
});

test("informația de format: aceleași 15 biți în ambele copii și cod BCH valid", () => {
  for (const [t, l] of GOLD) {
    const q = Q.encode(t, l), m = q.modules, n = q.size;
    let a = 0, b = 0;
    const c1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    c1.forEach(([x, y], i) => { if (m[y][x]) a |= 1 << i; });
    for (let i = 0; i < 8; i++) if (m[8][n - 1 - i]) b |= 1 << i;
    for (let i = 8; i < 15; i++) if (m[n - 15 + i][8]) b |= 1 << i;
    assert.equal(a, b, "copiile diferă pentru " + t.slice(0, 10));
    const data = ((a ^ 0x5412) >>> 10); let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    assert.equal(((data << 10) | rem) ^ 0x5412, a, "BCH");
    assert.equal(data >>> 3, l === "L" ? 1 : 0, "nivelul de corecție");
    assert.equal(data & 7, q.mask);
  }
});

test("capacitatea: 213 octeți la M, 271 la L; peste ea ridică qr:too_long", () => {
  assert.equal(Q.capacity("M"), 213);
  assert.equal(Q.capacity("L"), 271);
  assert.doesNotThrow(() => Q.encode("a".repeat(213), "M"));
  assert.throws(() => Q.encode("a".repeat(214), "M"), /qr:too_long/);
  assert.throws(() => Q.encode("a".repeat(272), "L"), /qr:too_long/);
});

test("UTF-8: se numără octeții, nu caracterele", () => {
  assert.throws(() => Q.encode("€".repeat(72), "M"), /qr:too_long/); /* 216 octeți */
  assert.doesNotThrow(() => Q.encode("€".repeat(71), "M")); /* 213 octeți */
});

test("determinist: același text → aceeași matrice", () => {
  assert.equal(hash(Q.encode(URL_)), hash(Q.encode(URL_)));
});

test("svg: viewBox cu zona liniștită de 4 module, o singură cale, fără culori în afară de alb/negru", () => {
  const s = Q.svg(URL_), n = Q.encode(URL_).size;
  assert.match(s, new RegExp(`viewBox="0 0 ${n + 8} ${n + 8}"`));
  assert.equal((s.match(/<path /g) || []).length, 1);
  assert.ok(!/script|onload|http/i.test(s.replace('xmlns="http://www.w3.org/2000/svg"', "")));
  assert.match(Q.svg("x", { size: 80 }), /width="80" height="80"/);
});

test("citire înapoi cu jsQR (dacă e instalat): fiecare versiune 1–10, la capacitate maximă, ambele niveluri", { skip: !jsQR }, () => {
  for (const l of ["L", "M"]) {
    const seen = new Set();
    for (let len = 1; len <= Q.capacity(l); len++) {
      const q = Q.encode("k".repeat(len), l);
      if (!seen.has(q.version)) { seen.add(q.version); assert.equal(decode(q), "k".repeat(len), `${l} v${q.version} len ${len}`); }
      if (len === Q.capacity(l) || Q.encode("k".repeat(len + 1), l).version !== q.version) assert.equal(decode(q), "k".repeat(len), `${l} v${q.version} plin`);
    }
    assert.equal(seen.size, 10, "toate cele 10 versiuni");
  }
});

test("citire înapoi cu jsQR (dacă e instalat): toate golden-urile + 150 de șiruri aleatoare, versiunile 1–10", { skip: !jsQR }, () => {
  for (const [t, l] of GOLD) assert.equal(decode(Q.encode(t, l)), t);
  const al = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:/#?=&.";
  for (let i = 0; i < 150; i++) {
    const lvl = i % 2 ? "L" : "M", len = 1 + Math.floor(Math.random() * Q.capacity(lvl));
    let s = ""; for (let k = 0; k < len; k++) s += al[Math.floor(Math.random() * al.length)];
    assert.equal(decode(Q.encode(s, lvl)), s, `${lvl} ${len}`);
  }
});
