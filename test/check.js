/* Ebanist — il controllo a freddo, senza browser e senza dipendenze.
 *
 * Risponde a tre domande che nessuna prova di funzione pone, e che da
 * quando l'app non e piu un solo index.html sono diventate facili da
 * sbagliare in silenzio:
 *
 *   1. ogni file di codice si legge? (`node --check`, parsing vero)
 *   2. l'elenco degli script di index.html e il guscio del service worker
 *      nominano gli stessi file? Se no, l'app parte online e si apre
 *      VUOTA in officina senza rete.
 *   3. il numero di versione e il nome della cache sono allineati fra
 *      index.html e sw.js?
 *
 * Gira in un paio di secondi: e la prima cosa da lanciare, prima delle
 * prove vere.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app");
const out = [];
let bad = 0;
const ok = (cond, what, note) => {
  out.push((cond ? "\x1b[32m  ✓\x1b[0m " : "\x1b[31m  ✗\x1b[0m ") + what +
           (note ? "  \x1b[2m→ " + note + "\x1b[0m" : ""));
  if (!cond) bad++;
};
const head = s => out.push("\n\x1b[1m" + s + "\x1b[0m");

/* --- 1. tutto quello che il browser esegue deve almeno leggersi -------- */
head("Ogni file di codice si legge");
function scripts(dir, skip) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === ".git" ? [] : scripts(f, skip);
    return e.isFile() && e.name.endsWith(".js") && !skip.test(f) ? [f] : [];
  });
}
/* vendor e roba di terzi: si aggiorna a blocchi, non la scriviamo noi.
   I moduli ES non passano da `node --check` in modalita script. */
const SKIP = /[\\/](vendor|node_modules)[\\/]|viewer3d\.js$|geo3d\.js$|arexport\.js$/;
const files = [...scripts(APP, SKIP), ...scripts(path.join(ROOT, "order-rail"), SKIP),
               path.join(ROOT, "site.js")].filter(f => fs.existsSync(f));
let broken = [];
for (const f of files) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { broken.push(path.relative(ROOT, f) + ": " + String(e.stderr || "").split("\n")[2]); }
}
ok(broken.length === 0, `${files.length} file di codice, nessun errore di sintassi`, broken[0] || "");

/* --- 2. index.html e sw.js devono nominare gli stessi file ------------- */
head("Il guscio offline e l'elenco degli script");
const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(APP, "sw.js"), "utf8");

const declared = [
  ...[...html.matchAll(/<script src="\.\/([^"]+\.js)"><\/script>/g)].map(m => m[1]),
  ...[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+\.css)"/g)].map(m => m[1]),
];
ok(declared.length >= 24, `index.html dichiara ${declared.length} file propri`);

const missingOnDisk = declared.filter(f => !fs.existsSync(path.join(APP, f)));
ok(missingOnDisk.length === 0, "e ognuno esiste davvero sul disco", missingOnDisk.join(", "));

const missingInShell = declared.filter(f => !sw.includes('"./' + f + '"'));
ok(missingInShell.length === 0,
   "e ognuno sta nel guscio del service worker",
   missingInShell.length ? "fuori dal guscio: " + missingInShell.join(", ") : "");

const shellFiles = [...sw.matchAll(/"\.\/((?:js|styles)\/[^"]+)"/g)].map(m => m[1]);
const ghosts = shellFiles.filter(f => !fs.existsSync(path.join(APP, f)));
ok(ghosts.length === 0, "e il guscio non nomina file che non ci sono", ghosts.join(", "));

/* --- 3. versione e cache ------------------------------------------------ */
head("Versione e cache");
const ver = (html.match(/<meta name="app-version" content="([^"]+)"/) || [])[1];
const pageCache = (html.match(/<meta name="sw-cache" content="([^"]+)"/) || [])[1];
const swCache = (sw.match(/const CACHE = "([^"]+)"/) || [])[1];
ok(!!ver && /^\d+\.\d+\.\d+$/.test(ver), "index.html porta un numero di versione", ver);
ok(!!pageCache && pageCache === swCache,
   "e il nome della cache combacia con sw.js", `index.html=${pageCache} · sw.js=${swCache}`);

/* --- 4. niente codice dentro il marcato -------------------------------- */
head("Niente codice dentro le pagine");
for (const page of ["app/index.html", "index.html", "order-rail/inbox.html",
                    "order-rail/order-view.html"]) {
  const src = fs.readFileSync(path.join(ROOT, page), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(src), `${page}: nessuno <script> inline`);
}

console.log(out.join("\n"));
console.log(`\n\x1b[1m${out.filter(l => l.includes("✓")).length}/` +
            `${out.filter(l => /✓|✗/.test(l)).length} controlli superati\x1b[0m\n`);
process.exit(bad ? 1 : 0);
