/* ebanist-sync.js — deciziile de sincronizare între dispozitive (pur). Înainte nu exista niciun test pe sincronizare. */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const S = new Function(fs.readFileSync(path.join(__dirname, "../app/ebanist-sync.js"), "utf8") + "\nreturn globalThis.EBSync;")();
const P = (n, x) => ({ id: "p1", name: n, pieces: x || [] });
const meta = (p, ru, ua) => ({ lastSyncedSnapshot: JSON.stringify(p), lastRemoteUpdatedAt: ru, updatedAt: ua || ru });

test("push: neschimbat local → noop; schimbat și serverul neatins → push; proiect nou → push", () => {
  const p = P("A"), m = meta(p, "2026-11-17T10:00:00Z");
  assert.strictEqual(S.decidePush({ snap: JSON.stringify(p), meta: m, remote: { updated_at: "2026-11-17T10:00:00Z", data: p } }), "noop");
  const p2 = P("A2");
  assert.strictEqual(S.decidePush({ snap: JSON.stringify(p2), meta: m, remote: { updated_at: "2026-11-17T10:00:00Z", data: p } }), "push");
  assert.strictEqual(S.decidePush({ snap: JSON.stringify(p2), meta: undefined, remote: null }), "push");
});
test("push: serverul s-a schimbat de pe alt dispozitiv și local e schimbat → conflict (nu se suprascrie în tăcere)", () => {
  const base = P("A"), m = meta(base, "2026-11-17T10:00:00Z", "2026-11-17T10:00:00Z");
  const mine = P("A-local"), theirs = P("A-remote");
  assert.strictEqual(S.decidePush({ snap: JSON.stringify(mine), meta: m, remote: { updated_at: "2026-11-17T11:00:00Z", data: theirs } }), "conflict");
});
test("push: serverul schimbat dar cu același conținut ca local → same, fără copie", () => {
  const base = P("A"), m = meta(base, "2026-11-17T10:00:00Z"), mine = P("A2");
  assert.strictEqual(S.decidePush({ snap: JSON.stringify(mine), meta: m, remote: { updated_at: "2026-11-17T11:00:00Z", data: mine } }), "same");
});
test("pull: proiect nou de pe server → pull; neschimbat local și mai nou pe server → pull; schimbat local și mai nou pe server → conflict", () => {
  const base = P("A"), m = meta(base, "2026-11-17T10:00:00Z"), rem = { updated_at: "2026-11-17T11:00:00Z", data: P("B") };
  assert.strictEqual(S.decidePull({ local: null, meta: undefined, remote: rem }), "pull");
  assert.strictEqual(S.decidePull({ local: base, meta: m, remote: rem }), "pull");
  assert.strictEqual(S.decidePull({ local: P("A-local"), meta: m, remote: rem }), "conflict");
});
test("pull: nu e mai nou → noop; fără metadate dar conținut identic → same (fără conflict fals la prima autentificare)", () => {
  const base = P("A"), m = meta(base, "2026-11-17T10:00:00Z");
  assert.strictEqual(S.decidePull({ local: base, meta: m, remote: { updated_at: "2026-11-17T10:00:00Z", data: base } }), "noop");
  assert.strictEqual(S.decidePull({ local: base, meta: undefined, remote: { updated_at: "2026-11-17T10:00:00Z", data: base } }), "same");
  assert.strictEqual(S.decidePull({ local: base, meta: undefined, remote: { updated_at: "2026-11-17T10:00:00Z", data: P("X") } }), "conflict");
});
test("needed: numai ce e mai nou ca la ultima sincronizare și nu e în coada de ștergeri", () => {
  const ids = S.needed([{ id: "a", updated_at: "2026-11-17T10:00:00Z" }, { id: "b", updated_at: "2026-11-17T12:00:00Z" }, { id: "c", updated_at: "2026-11-17T12:00:00Z" }, { id: "d", updated_at: "2026-11-17T09:00:00Z" }],
    { a: { lastRemoteUpdatedAt: "2026-11-17T10:00:00Z" }, b: { lastRemoteUpdatedAt: "2026-11-17T11:00:00Z" } }, ["c"]);
  assert.deepStrictEqual(ids, ["b", "d"]);
});
test("copia de conflict: alt id, sufix în nume, originalul neatins", () => {
  const o = P("Bucătărie", [{ lung: 800 }]), c = S.conflictCopy(o, "zz9", "conflict 10:42");
  assert.strictEqual(c.id, "zz9"); assert.strictEqual(c.name, "Bucătărie (conflict 10:42)"); assert.strictEqual(o.name, "Bucătărie");
  c.pieces[0].lung = 1; assert.strictEqual(o.pieces[0].lung, 800);
});

test("ștergere de pe alt dispozitiv: se scoate un proiect sincronizat, absent de pe server și nemodificat local", () => {
  const a = P("A"); a.id = "a"; const b = P("B"); b.id = "b"; const c = P("C"); c.id = "c";
  const m = { a: meta(a, "t"), b: meta(b, "t"), c: meta(c, "t") };
  assert.deepStrictEqual(S.remoteDeletions({ list: [{ id: "a" }, { id: "b" }], projects: [a, b, c], metaById: m, deleted: [] }), ["c"]);
});
test("ștergere: proiect modificat local rămâne; proiect fără metadate (nou) rămâne; ce e deja în coada de ștergeri nu se ia a doua oară", () => {
  const a = P("A"); a.id = "a"; const b = P("B"); b.id = "b"; const n = P("N"); n.id = "n"; const d = P("D"); d.id = "d";
  const m = { a: meta(a, "t"), b: meta(b, "t"), d: meta(d, "t") };
  const a2 = { ...a, name: "A edited" };
  assert.deepStrictEqual(S.remoteDeletions({ list: [{ id: "b" }], projects: [a2, b, n, d], metaById: m, deleted: ["d"] }), []);
});
test("ștergere: plase de siguranță — listă goală, listă de dimensiunea paginii, prea multe dintr-odată", () => {
  const mk = i => { const p = P("P" + i); p.id = "p" + i; return p; }, ps = [1, 2, 3, 4, 5, 6].map(mk), m = {};
  ps.forEach(p => { m[p.id] = meta(p, "t"); });
  assert.deepStrictEqual(S.remoteDeletions({ list: [], projects: ps, metaById: m, deleted: [] }), []);
  assert.deepStrictEqual(S.remoteDeletions({ list: Array.from({ length: 1000 }, (_, i) => ({ id: "x" + i })), projects: ps, metaById: m, deleted: [] }), []);
  assert.deepStrictEqual(S.remoteDeletions({ list: [{ id: "p1" }], projects: ps, metaById: m, deleted: [] }), []);   // 5 din 6 absente: greșeală probabilă
  assert.deepStrictEqual(S.remoteDeletions({ list: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }], projects: ps, metaById: m, deleted: [] }), ["p5", "p6"]);
  assert.deepStrictEqual(S.remoteDeletions({ list: null, projects: ps, metaById: m, deleted: [] }), []);
});
