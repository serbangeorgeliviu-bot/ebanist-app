/* ebanist-elab.js — prospect, secțiune A–A, plan C–C (pur, fără DOM) */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../app", f), "utf8");
const S = new Function(rd("ebanist-sheet.js") + "\n" + rd("ebanist-elab.js") + "\nreturn globalThis.EBElab;")();
const bx = (x0, x1, y0, y1, z0, z1, kind, role, sub) => ({ x0, x1, y0, y1, z0, z1, kind: kind || "p", role, sub });
/* corp 600×720×500: doi fianci, bază, cap, spate, ușă */
const BOXES = [bx(0, 19, 0, 720, 0, 500, "p", "fianco"), bx(581, 600, 0, 720, 0, 500, "p", "fianco"),
  bx(19, 581, 100, 119, 0, 500, "p", "base"), bx(19, 581, 701, 720, 0, 500, "p", "cielo"),
  bx(19, 581, 100, 701, 0, 3, "p", "schienale"), bx(0, 600, 100, 720, 500, 519, "f", "frontale"), bx(100, 120, 0, 100, 20, 480, "p", "zoccolo")];

test("planurile de tăiere: mijlocul coloanei și al golului", () => {
  const c = S.cutPlanes(BOXES);
  assert.equal(c.x, 300);
  assert.ok(c.y > 119 && c.y < 701);
});
test("secțiunea A–A: ce e dincoace de plan dispare, ce e tăiat e separat", () => {
  const p = S.project(BOXES, "secx", 300, { lo: [0, 0, 0], hi: [600, 720, 519] });
  const roles = a => a.map(r => r.b.role).sort();
  assert.deepEqual(roles(p.cut), ["base", "cielo", "frontale", "schienale"].sort(), "tăiate: orizontale, spate, ușă");
  assert.deepEqual(roles(p.vis), ["fianco", "zoccolo"].sort() , "vizibil: fiancul din spatele planului");
});
test("planul C–C: ce e deasupra planului dispare", () => {
  const p = S.project(BOXES, "secy", 300, { lo: [0, 0, 0], hi: [600, 720, 519] });
  assert.ok(!p.cut.concat(p.vis).some(r => r.b.role === "cielo"), "capul e deasupra");
  assert.ok(p.cut.some(r => r.b.role === "fianco") && p.cut.some(r => r.b.role === "schienale"));
  assert.ok(p.vis.some(r => r.b.role === "base"), "baza se vede dedesubt");
});
test("hașura după material", () => {
  assert.equal(S.classify(bx(0, 1, 0, 1, 0, 1, "p", "schienale")), "back");
  assert.equal(S.classify(bx(0, 1, 0, 1, 0, 1, "f", "frontale")), "door");
  assert.equal(S.classify(bx(0, 1, 0, 1, 0, 1, "g")), "glass");
  assert.equal(S.classify(bx(0, 1, 0, 1, 0, 1, "m")), "metal");
  assert.equal(S.classify(bx(0, 1, 0, 1, 0, 1, "p", "fianco")), "body");
});
test("foaia: A3, texte prin tr(), text utilizator scăpat, cote de ansamblu", () => {
  const svg = S.elevationsSheetSVG(BOXES, { tr: k => "«" + k + "»", meta: { project: "<img>", name: "N", matBody: "M", tBody: 19, date: "d", ver: "v" } });
  assert.match(svg, /viewBox="0 0 420 297"/);
  for (const k of ["eaViewFront", "eaViewSect", "eaViewPlan", "eaLegend", "eaBody", "eaBack", "eaDoor", "eaNote", "eaUnit", "eaTitle", "shProject"]) assert.ok(svg.includes("«" + k + "»"), k);
  assert.ok(!svg.includes("<img>"));
  assert.ok(svg.includes(">600<") && svg.includes(">720<") && svg.includes("eh-body"));
});
