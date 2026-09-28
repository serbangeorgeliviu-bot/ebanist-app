/* D-60 — la radice «/» nella lingua del visitatore.
   La edge function (netlify/edge-functions/lang.js) non gira fuori da
   Netlify; la sua decisione e pura e si prova qui. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fn, { preferred, chooseLang, decide } from "../netlify/edge-functions/lang.js";

const R = "https://ebanist.com/";
const go = (url, cookie, al) => { const d = decide(url, cookie, al); return d ? d.location : null; };

test("il browser decide quando non c'e una scelta a mano", () => {
  assert.equal(go(R, undefined, "ro-RO,ro;q=0.9,en-US;q=0.8"), "/ro/");
  assert.equal(go(R, undefined, "it-IT,it;q=0.9"), "/it/");
  assert.equal(go(R, undefined, "fr-FR"), "/fr/");
  assert.equal(go(R, undefined, "RO"), "/ro/", "maiuscole");
});

test("inglese, nessuna lingua o lingua che il sito non ha: resta la pagina inglese", () => {
  assert.equal(go(R, undefined, "en-US,en;q=0.9,ro;q=0.8"), null, "inglese prima del romeno");
  assert.equal(go(R, undefined, ""), null, "Googlebot: nessun Accept-Language");
  assert.equal(go(R, undefined, undefined), null);
  assert.equal(go(R, undefined, "de-DE,de;q=0.9"), null);
  assert.equal(go(R, undefined, "*"), null);
});

test("vale l'ordine di preferenza (q), non l'ordine scritto", () => {
  assert.equal(go(R, undefined, "en;q=0.5,it;q=0.9"), "/it/");
  assert.equal(go(R, undefined, "de-DE,ro;q=0.5"), "/ro/", "la prima lingua che il sito ha");
  assert.equal(go(R, undefined, "ro;q=0,it"), "/it/", "q=0 vuol dire no");
  assert.deepEqual(preferred("ro-RO, en;q=0.8 , it;q=0.9"), ["ro", "it", "en"]);
});

test("la scelta a mano (cookie eb_lang) vince sempre sul browser", () => {
  assert.equal(go(R, "en", "ro-RO,ro;q=0.9"), null, "romeno che ha scelto l'inglese");
  assert.equal(go(R, "it", "ro-RO"), "/it/");
  assert.equal(go(R, "fr", "en-US"), "/fr/");
  assert.equal(go(R, "ro", ""), "/ro/");
  assert.equal(chooseLang("xx", "fr-FR"), "fr", "un cookie non valido si ignora");
  assert.equal(chooseLang("RO", "it-IT"), "it", "il cookie lo scrive la pagina in minuscolo");
});

test("solo la radice, e i vecchi /?lang=xx restano a netlify.toml", () => {
  assert.equal(go("https://ebanist.com/ro/", undefined, "it-IT"), null);
  assert.equal(go("https://ebanist.com/app/", undefined, "ro-RO"), null);
  assert.equal(go("https://ebanist.com/?lang=it", undefined, "ro-RO"), null);
  assert.equal(go("https://ebanist.com/?utm_source=play", undefined, "ro-RO"), "/ro/?utm_source=play", "la query resta");
});

test("la risposta: 302 non memorizzabile, oppure niente (prosegue la pagina statica)", async () => {
  const ctx = c => ({ cookies: { get: k => (k === "eb_lang" ? c : undefined) } });
  const req = al => new Request(R, { headers: al ? { "accept-language": al } : {} });
  const r = await fn(req("ro-RO"), ctx(undefined));
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/ro/");
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.equal(await fn(req("ro-RO"), ctx("en")), undefined);
  assert.equal(await fn(req(""), ctx(undefined)), undefined);
});
