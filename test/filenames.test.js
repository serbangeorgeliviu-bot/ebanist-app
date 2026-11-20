/* Netlify refuză publicarea dacă un fișier are # sau ? în nume (5.94.0–5.94.5 au stat nepublicate din cauza unuia).   node --test filenames.test.js */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("child_process");
const path = require("path");
test("niciun fișier urmărit de git nu are # sau ? în nume (deploy Netlify)", () => {
  const out = execFileSync("git", ["-c", "core.quotepath=off", "ls-files", "-z"], { cwd: path.join(__dirname, ".."), encoding: "utf8", maxBuffer: 1 << 26 });
  const bad = out.split("\0").filter(f => /[#?]/.test(f));
  assert.deepEqual(bad, [], "nume invalide pentru Netlify: " + JSON.stringify(bad));
});
