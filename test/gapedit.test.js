const test = require("node:test"), assert = require("node:assert");
const { appEngine } = require("./engine.js"); const retargetGap = (...a) => appEngine().retargetGap(...a);
const tR = 19;
const P = [{ type: "ripiano", y: 400 }, { type: "ripiano", y: 800 }, { type: "ripiano", y: 1200, span: "left" }];
test("muta raftul de deasupra golului", () => {
  const r = retargetGap(P, { y0: 419, y1: 800 }, 300, tR);
  assert.equal(r.partitions[1].y, 719); assert.equal(r.partitions[0].y, 400);
});
test("gol până în tavan: mută raftul de dedesubt", () => {
  const r = retargetGap(P, { y0: 819, y1: 2000 }, 500, tR);
  assert.equal(r.partitions[1].y, 2000 - 500 - tR);
});
test("raft parțial sau inexistent: eroare, nimic mutat", () => {
  assert.equal(retargetGap(P, { y0: 1219, y1: 2000 }, 300, tR).error, "noShelf");
  assert.equal(retargetGap(P, { y0: 5, y1: 7 }, 300, tR).error, "noShelf");
});
test("cotă invalidă", () => {
  assert.equal(retargetGap(P, { y0: 419, y1: 800 }, "x", tR).error, "bad");
  assert.equal(retargetGap(P, { y0: 419, y1: 800 }, -5, tR).error, "bad");
  assert.equal(retargetGap([], { y0: 1, y1: 2 }, 10, tR).error, "noShelf");
});
test("nu modifică lista originală", () => {
  const before = JSON.stringify(P); retargetGap(P, { y0: 419, y1: 800 }, 300, tR);
  assert.equal(JSON.stringify(P), before);
});
