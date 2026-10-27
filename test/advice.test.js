"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "ebanist-advice.js"), "utf8"), ctx);
const A = ctx.EBAdvice;

const th = () => 18;
const row = (o) => Object.assign({ modulo: "C1", pz: 1, materiale: "PAL 18 Alb" }, o);

test("deflexia unui raft: formula 5wL^4/384EI", () => {
  const d = A.deflection(800, 18, 3000, 0.001);
  assert.ok(Math.abs(d - 3.66) < 0.02, String(d));
  assert.equal(A.deflection(0, 18, 3000, 1), null);
});

test("raftul scurt trece, cel lung din PAL 18 avertizează, grosimea mai mare îl scoate", () => {
  assert.equal(A.advise([row({ role: "ripiano", elemento: "Ripiano", lung: 600, larg: 300 })], { th }).length, 0);
  const w = A.advise([row({ role: "ripiano", elemento: "Ripiano", lung: 1000, larg: 300, pz: 3 })], { th });
  assert.equal(w.length, 1); assert.equal(w[0].id, "SHELF_SAG"); assert.equal(w[0].n, 3);
  assert.equal(A.advise([row({ role: "ripiano", elemento: "Ripiano", lung: 1000, larg: 300 })], { th: () => 30 }).length, 0);
});

test("fără rol sau fără grosime nu se spune nimic", () => {
  assert.equal(A.advise([row({ elemento: "Ripiano", lung: 1500, larg: 300 })], { th }).length, 0);
  assert.equal(A.advise([row({ role: "ripiano", lung: 1500, larg: 300 })], { th: () => 0 }).length, 0);
});

test("ușă înaltă și îngustă; materialul masiv e mai rigid decât PAL", () => {
  /* rândurile reale: ușa are rolul „frontale” și numele „Anta”; frontul de sertar are alt rol */
  const d = A.advise([row({ role: "frontale", elemento: "Anta", lung: 2000, larg: 500 })], { th });
  assert.equal(d.length, 1); assert.equal(d[0].id, "TALL_DOOR");
  assert.equal(A.advise([row({ role: "frontale", elemento: "Anta", lung: 2000, larg: 800 })], { th }).filter(x => x.id === "TALL_DOOR").length, 0);
  assert.equal(A.advise([row({ role: "cassetto_frontale", elemento: "Frontale cassetto", lung: 2000, larg: 500 })], { th }).length, 0);
  assert.equal(A.advise([row({ role: "frontale", elemento: "Fronte decor", lung: 2000, larg: 500 })], { th }).length, 0, "numai ușile „Anta…”");
  const pal = A.advise([row({ role: "ripiano", lung: 900, larg: 300 })], { th }).length;
  const masiv = A.advise([row({ role: "ripiano", lung: 900, larg: 300, materiale: "Stejar masiv" })], { th }).length;
  assert.equal(pal, 1); assert.equal(masiv, 0);
});

test("blatul lung avertizează, cel scurt nu", () => {
  assert.equal(A.advise([row({ role: "blat", lung: 800, larg: 600 })], { th }).length, 0);
  assert.equal(A.advise([row({ role: "blat", lung: 2400, larg: 600 })], { th }).length, 1);
});

test("rândurile identice se grupează; textele au aceleași chei în 7 limbi și se completează", () => {
  const w = A.advise([row({ role: "ripiano", lung: 1000, larg: 300 }), row({ role: "ripiano", lung: 1000, larg: 300, pz: 2 })], { th });
  assert.equal(w.length, 1); assert.equal(w[0].n, 3);
  const langs = Object.keys(A.TXT); assert.equal(langs.length, 7);
  const keys = Object.keys(A.TXT.it).sort();
  for (const l of langs) assert.deepEqual(Object.keys(A.TXT[l]).sort(), keys, l);
  for (const l of langs) assert.ok(!/\{\w+\}/.test(A.text(l, w[0])), l);
  assert.equal(A.DATA.verificat, false);
});

test("ușă grea: greutate din arie × grosime × densitate; sub prag nu spune nimic", () => {
  const big = A.advise([row({ role: "frontale", elemento: "Anta", lung: 2300, larg: 700, materiale: "MDF lăcuit" })], { th: () => 19 });
  const heavy = big.find(x => x.id === "HEAVY_DOOR");
  assert.ok(heavy, "MDF 2300×700×19 trebuie să dea ușă grea");
  assert.ok(Math.abs(heavy.values.kg - 2300 * 700 * 19 * 750 / 1e9) < 0.11, String(heavy.values.kg));
  assert.equal(A.advise([row({ role: "frontale", elemento: "Anta", lung: 700, larg: 500 })], { th: () => 19 }).filter(x => x.id === "HEAVY_DOOR").length, 0);
  assert.equal(A.advise([row({ role: "frontale", elemento: "Anta", lung: 2300, larg: 700 })], { th: () => 0 }).filter(x => x.id === "HEAVY_DOOR").length, 0, "fără grosime nu se estimează");
});

test("bară de haine: peste prag avertizează, sub prag nu; numai accesoriile „asta”", () => {
  const rod = (L) => row({ role: "accessorio", elemento: "Asta appendiabiti", lung: L, larg: 25, materiale: "Accessorio — asta appendiabiti ovale" });
  assert.equal(A.advise([rod(900)], { th: () => 0 }).length, 0);
  const w = A.advise([rod(1500)], { th: () => 0 });
  assert.equal(w.length, 1); assert.equal(w[0].id, "ROD_SPAN"); assert.equal(w[0].values.span, 1500);
  assert.equal(A.advise([row({ role: "accessorio", elemento: "Piedino regolabile", lung: 1500, larg: 25, materiale: "Accessorio — piedino" })], { th: () => 0 }).length, 0);
});

test("textele noi au toate cheile în 7 limbi și se completează", () => {
  const w = A.advise([row({ role: "frontale", elemento: "Anta", lung: 2300, larg: 700, materiale: "MDF" })], { th: () => 19 }).concat(A.advise([row({ role: "accessorio", elemento: "Asta", lung: 1500, larg: 25, materiale: "asta" })], { th: () => 0 }));
  assert.ok(w.length >= 2);
  for (const l of Object.keys(A.TXT)) for (const x of w) assert.ok(!/\{\w+\}/.test(A.text(l, x)), l + x.id);
});
