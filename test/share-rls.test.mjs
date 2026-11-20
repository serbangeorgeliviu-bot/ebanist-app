/* Proiecte partajate (D-159): migrația REALĂ 20261118_project_sharing.sql peste o schemă care imită Supabase, într-un Postgres local de unică folosință,
 * cu 4 utilizatori simulați (proprietar, editor, viewer, străin). Verifică ce hotărăște serverul: RLS, funcțiile de invitație, rolurile.
 *
 *   cd test && node --test share-rls.test.mjs        (cere Postgres instalat; altfel testele se sar)
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = ["/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/15/bin", "/usr/lib/postgresql/14/bin"].find(d => fs.existsSync(path.join(d, "initdb")));
const root = process.getuid && process.getuid() === 0;
const PORT = 54000 + Math.floor(Math.random() * 900);
let dir, lines = [];

function run(cmd, args, opt = {}) {
  const full = root ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args];
  return execFileSync(full[0], full[1], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opt });
}
const psql = (file, extra = []) => run(path.join(BIN, "psql"), ["-h", dir, "-p", String(PORT), "-U", "postgres", "-d", "t", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", ...extra, "-f", file]);

describe("partajare: RLS și funcții, cu 4 utilizatori simulați", { skip: !BIN && "Postgres nu e instalat" }, () => {
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ebpg-")); if (root) { fs.chmodSync(dir, 0o777); }
    run(path.join(BIN, "initdb"), ["-D", path.join(dir, "data"), "-U", "postgres", "--auth=trust", "-E", "UTF8"]);
    run(path.join(BIN, "pg_ctl"), ["-D", path.join(dir, "data"), "-o", `-p ${PORT} -k ${dir} -c listen_addresses=''`, "-w", "-l", path.join(dir, "log"), "start"]);
    run(path.join(BIN, "createdb"), ["-h", dir, "-p", String(PORT), "-U", "postgres", "t"]);
    psql(path.join(here, "sql", "share-stub.sql"));
    psql(path.join(here, "..", "supabase", "migrations", "20261118_project_sharing.sql"));
    psql(path.join(here, "..", "supabase", "migrations", "20261120_project_comment_author_revoke.sql"));   // întărirea propusă: triggerul de comentarii trebuie să meargă și fără EXECUTE
    lines = psql(path.join(here, "sql", "share-scenario.sql")).split("\n").map(s => s.trim()).filter(Boolean).filter(s => !/^(DO|CREATE TABLE|INSERT)/.test(s));
  });
  after(() => { if (process.env.SHOW) console.log(lines.join("\n")); try { run(path.join(BIN, "pg_ctl"), ["-D", path.join(dir, "data"), "-m", "immediate", "stop"]); } catch (e) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });
  const has = (re) => assert.ok(lines.some(l => re.test(l)), "lipsește: " + re + "\n" + lines.join("\n"));
  const none = (re) => assert.ok(!lines.some(l => re.test(l)), "nu trebuie: " + re + "\n" + lines.filter(l => re.test(l)).join("\n"));

  test("scenariul a rulat până la capăt", () => { assert.ok(lines.length >= 30, lines.length + " rânduri"); });
  test("nicio regulă nu a fost încălcată (niciun rând «PERMIS (GREȘIT)»)", () => none(/GREȘIT/));
  test("proprietarul: creează, invită cu trei coduri, rămâne proprietar la final", () => {
    has(/^A creează proiect: rol=owner$/); has(/^A invită: 3 coduri, lungime 10$/); has(/^A după toate: rol=owner$/);
  });
  test("codul de invitație merge o singură dată; expirat, inexistent și fără autentificare sunt respinse", () => {
    has(/^B acceptă \(editor\): true, rol=editor$/); has(/^B reutilizează codul: respins \(project:code_invalid\)$/); has(/^C cu cod consumat: respins \(project:code_invalid\)$/);
    has(/^D cu cod expirat: respins \(project:code_invalid\)$/); has(/^D cu cod inexistent: respins \(project:code_invalid\)$/); has(/^anonim acceptă: respins \(project:not_authenticated\)$/);
  });
  test("editorul modifică, dar nu șterge, nu schimbă proprietarul și nu partajează mai departe; comentează", () => {
    has(/^B vede proiectul: 1$/); has(/^B modifică datele: 1 rând/); has(/^B încearcă să-și treacă proprietatea: proprietarul rămâne A = true$/);
    has(/^B șterge proiectul: 0 rând/); has(/^B partajează mai departe: respins \(project:not_allowed\)$/); has(/^B comentează: ok$/);
  });
  test("viewerul citește (inclusiv modificarea editorului), nu modifică, nu comentează, nu vede invitațiile", () => {
    has(/^C vede proiectul: 1$/); has(/^C modifică datele: 0 rând/); has(/^C comentează: respins \(RLS\)$/); has(/^C citește comentariile: 1$/);
    has(/^C vede v=2 /); has(/^C \(viewer\) vede invitațiile proprietarului: 0$/); has(/^C vede în project_members: 1 /);
  });
  test("un străin nu vede nimic: proiect, comentarii, membri, invitații; nu poate lista membrii", () => {
    has(/^D \(străin\) vede proiectul: 0$/); has(/^D vede comentarii: 0$/); has(/^D vede membri: 0$/); has(/^D vede invitații: 0$/);
    has(/^D rol: null$/); has(/^D listează membrii: respins \(project:not_allowed\)$/);
  });
  test("proprietarul vede membrii și comentariile, retrogradează un editor (care nu mai poate scrie) și îl scoate (nu mai vede nimic)", () => {
    has(/^A listează membrii: 2$/); has(/^A vede comentarii: 1$/); has(/^B după retrogradare modifică: 0 rând/); has(/^B scos: vede proiectul: 0$/);
  });
  test("un membru poate ieși singur; nu poate scoate proprietarul", () => {
    has(/^C iese singur: vede proiectul: 0$/); has(/^C scoate proprietarul: fără efect$|^C scoate pe altcineva: respins$/);
  });
});
