/* ebanist-share.js — roluri și reguli pentru proiecte partajate (pur) */
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const H = new Function(fs.readFileSync(path.join(__dirname, "../app/ebanist-share.js"), "utf8") + "\nreturn globalThis.EBShare;")();
test("roluri: cine poate ce", () => {
  assert.deepStrictEqual(["owner", "editor", "commenter", "viewer", undefined].map(H.canEdit), [true, true, false, false, false]);
  assert.deepStrictEqual(["owner", "editor", "commenter", "viewer", undefined].map(H.canComment), [true, true, true, false, false]);
  assert.deepStrictEqual(["owner", "editor", "viewer", null].map(H.isShared), [false, true, true, false]);
  assert.deepStrictEqual(H.ROLES, ["viewer", "commenter", "editor"]);
});
test("cod de invitație: spațiile și cratimele ies, majuscule", () => { assert.strictEqual(H.normCode(" ab12-cd 34\n"), "AB12CD34"); assert.strictEqual(H.normCode(null), ""); });
test("erori de la server → chei de text", () => {
  assert.strictEqual(H.errKey('project:code_invalid'), "shErrCode");
  assert.strictEqual(H.errKey("ERROR: project:already_member"), "shErrAlready");
  assert.strictEqual(H.errKey("project:not_allowed"), "shErrAllowed");
  assert.strictEqual(H.errKey("project:not_authenticated"), "shErrLogin");
  assert.strictEqual(H.errKey("altceva"), null); assert.strictEqual(H.errKey(undefined), null);
});
test("harta partajărilor și ce se trimite", () => {
  const m = H.shareMap([{ project_id: "a", role: "viewer", owner_name: "Liviu" }, { project_id: "b", role: "editor", owner_id: "u" }]);
  assert.strictEqual(m.a.owner_name, "Liviu"); assert.strictEqual(m.b.role, "editor");
  assert.strictEqual(H.pushable({ id: "a" }, m), false); assert.strictEqual(H.pushable({ id: "b" }, m), true); assert.strictEqual(H.pushable({ id: "own" }, m), true);
});
test("doar-citire: un proiect modificat local se readuce; editorul și proiectul propriu nu", () => {
  const A = { id: "a", n: 1 }, B = { id: "b", n: 1 }, C = { id: "c", n: 1 };
  const m = H.shareMap([{ project_id: "a", role: "commenter" }, { project_id: "b", role: "editor" }]);
  const meta = id => ({ lastSyncedSnapshot: JSON.stringify({ id, n: 1 }) });
  assert.deepStrictEqual(H.readOnlyChanged([{ ...A, n: 2 }, { ...B, n: 2 }, { ...C, n: 2 }], m, { a: meta("a"), b: meta("b"), c: meta("c") }), ["a"]);
  assert.deepStrictEqual(H.readOnlyChanged([A, B, C], m, { a: meta("a"), b: meta("b"), c: meta("c") }), []);
  assert.deepStrictEqual(H.readOnlyChanged([{ ...A, n: 2 }], m, {}), []);   // fără metadate nu ghicim
});
