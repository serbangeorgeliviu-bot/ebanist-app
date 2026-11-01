/* =====================================================================
   Ebanist — urcă un .aab în Google Play (Android Publisher API v3)
   ---------------------------------------------------------------------
   Folosit de .github/workflows/android-aab.yml, doar când rularea cere un
   track. Fără dependențe: semnează singur JWT-ul contului de serviciu
   (node:crypto) și vorbește cu API-ul prin fetch. Nu e o acțiune terță
   care să țină cheia contului de serviciu.

   Ce face, într-o „editare" Play (se aplică toată sau deloc):
     1. deschide editarea
     2. urcă .aab-ul  → primește versionCode
     3. pune versiunea pe track-ul cerut (draft sau completed)
     4. validează și confirmă (commit)

   Ce NU face: nu atinge formularul „Data safety", declarațiile de
   conținut, abonamentele sau pagina aplicației.

   Implicit status = draft: versiunea apare în Play Console ca ciornă și
   nu pleacă la nimeni până n-o trimiți tu la verificare. „completed" pe
   production cere confirmare explicită în workflow.
   ===================================================================== */

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

export const TRACKS = ["internal", "alpha", "beta", "production"];
export const STATUSES = ["draft", "completed"];
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const b64u = (b) => Buffer.from(b).toString("base64url");

/* JWT pentru schimbul cu token de acces (flux „service account"). */
export function jwtAssertion(sa, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat, exp: iat + 3600
  }));
  const sig = createSign("RSA-SHA256").update(head + "." + claim).sign(sa.private_key);
  return head + "." + claim + "." + b64u(sig);
}

async function failure(what, res) {
  let body = "";
  try { body = (await res.text()).slice(0, 600); } catch (e) { /* fără corp */ }
  return new Error(what + " → HTTP " + res.status + (body ? ": " + body : ""));
}

export async function accessToken(sa, fetchFn = fetch, now = Date.now()) {
  const res = await fetchFn(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtAssertion(sa, now)
    }).toString()
  });
  if (!res.ok) throw await failure("token", res);
  const j = await res.json();
  if (!j.access_token) throw new Error("token: răspuns fără access_token");
  return j.access_token;
}

export function checkInputs({ track, status, confirm }) {
  if (!TRACKS.includes(track)) throw new Error("track necunoscut: " + track + " (permise: " + TRACKS.join(", ") + ")");
  if (!STATUSES.includes(status)) throw new Error("status necunoscut: " + status + " (permise: " + STATUSES.join(", ") + ")");
  if (track === "production" && status === "completed" && confirm !== "da")
    throw new Error("production + completed pleacă la toți utilizatorii: cere confirm=da în workflow");
}

export async function publish({ sa, pkg, aab, track, status = "draft", notes = "", notesLang = "ro-RO", confirm = "", fetchFn = fetch }) {
  checkInputs({ track, status, confirm });
  const token = await accessToken(sa, fetchFn);
  const auth = { Authorization: "Bearer " + token };
  const json = { ...auth, "Content-Type": "application/json" };
  const base = API + "/" + pkg;

  let res = await fetchFn(base + "/edits", { method: "POST", headers: json, body: "{}" });
  if (!res.ok) throw await failure("deschide editarea", res);
  const editId = (await res.json()).id;
  if (!editId) throw new Error("editarea nu are id");

  try {
    res = await fetchFn(UPLOAD + "/" + pkg + "/edits/" + editId + "/bundles?uploadType=media", {
      method: "POST", headers: { ...auth, "Content-Type": "application/octet-stream" }, body: aab
    });
    if (!res.ok) throw await failure("urcă .aab", res);
    const versionCode = (await res.json()).versionCode;
    if (!versionCode) throw new Error("Play n-a întors versionCode");

    const release = { name: String(versionCode), versionCodes: [String(versionCode)], status };
    if (notes) release.releaseNotes = [{ language: notesLang, text: String(notes).slice(0, 500) }];
    res = await fetchFn(base + "/edits/" + editId + "/tracks/" + track, {
      method: "PUT", headers: json, body: JSON.stringify({ track, releases: [release] })
    });
    if (!res.ok) throw await failure("setează track-ul " + track, res);

    res = await fetchFn(base + "/edits/" + editId + ":validate", { method: "POST", headers: auth });
    if (!res.ok) throw await failure("validează", res);
    res = await fetchFn(base + "/edits/" + editId + ":commit", { method: "POST", headers: auth });
    if (!res.ok) throw await failure("confirmă editarea", res);
    return { versionCode: Number(versionCode), track, status };
  } catch (e) {
    /* Editarea rămasă deschisă expiră singură; o ștergem ca să nu blocheze. */
    try { await fetchFn(base + "/edits/" + editId, { method: "DELETE", headers: auth }); } catch (_) { /* best effort */ }
    throw e;
  }
}

/* CLI: node play-upload.mjs <fișier.aab>
   Mediu: PLAY_SA_FILE (calea JSON-ului), PLAY_TRACK, PLAY_STATUS, PLAY_NOTES,
          PLAY_NOTES_LANG, PLAY_CONFIRM, PLAY_PACKAGE. */
async function main() {
  const e = process.env;
  const sa = JSON.parse(await readFile(e.PLAY_SA_FILE, "utf8"));
  if (!sa.client_email || !sa.private_key) throw new Error("JSON-ul contului de serviciu nu are client_email / private_key");
  const aab = await readFile(process.argv[2]);
  const out = await publish({
    sa, aab, pkg: e.PLAY_PACKAGE || "com.domusrenov.ebanist",
    track: e.PLAY_TRACK, status: e.PLAY_STATUS || "draft",
    notes: e.PLAY_NOTES || "", notesLang: e.PLAY_NOTES_LANG || "ro-RO", confirm: e.PLAY_CONFIRM || ""
  });
  console.log("Urcat: versionCode " + out.versionCode + " → " + out.track + " (" + out.status + ")");
}

if (import.meta.url === "file://" + process.argv[1]) {
  main().catch((err) => { console.error("::error::" + err.message); process.exit(1); });
}
