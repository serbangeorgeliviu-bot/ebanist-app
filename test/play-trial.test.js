/* Proba gratuită și planurile cu reînnoire în ecranul Pro de pe Play (D-132).
 *
 *   cd test && node --test play-trial.test.js
 *
 * Partea nativă (PlayBilling.java) nu se poate rula aici; testul verifică ce se poate verifica din sursă:
 * că aplicația alege textele după ce vinde de fapt și că există texte în toate cele 7 limbi.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const JAVA = fs.readFileSync(path.join(root, "android", "app", "src", "main", "java", "com", "domusrenov", "ebanist", "PlayBilling.java"), "utf8");
const GRADLE = fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");

describe("texte: câte o variantă în fiecare din cele 7 limbi", () => {
  for (const key of ["playTrialM", "playTrialY", "playBuyYA"])
    for (const L of ["it", "ro", "en", "fr", "de", "es", "pl"])
      test(`${key} în ${L}`, () => assert.match(HTML, new RegExp("Object\\.assign\\(I18N\\." + L + ",\\{[^\\n]*" + key + ':"[^"]+"')));
  test("fiecare text de probă poartă prețul {p}", () => {
    for (const m of HTML.matchAll(/(playTrialM|playTrialY):"([^"]+)"/g)) assert.ok(m[2].includes("{p}"), m[0]);
  });
});

describe("ecranul Pro alege după ce se vinde", () => {
  test("playAuto(): există un plan cu reînnoire", () => assert.match(HTML, /function playAuto\(\)\{ return \(PLAY\.plans\|\|\[\]\)\.some\(p=>p\.auto\); \}/));
  test("probă → text cu zilele; fără probă → text obișnuit; prepaid → textele vechi", () => {
    assert.match(HTML, /AU\?\(x\.trialDays>0\?t\(tk\)\.replace\("\{d\}",x\.trialDays\):t\(ak\)\):t\(pk\)/);
    assert.match(HTML, /lab\(m,"playTrialM","proBuyM","playBuyM1"\)/);
    assert.match(HTML, /lab\(y,"playTrialY","playBuyYA","playBuyY"\)/);
  });
  test("termenii: reînnoire automată sau plată în avans, după planul vândut", () => assert.match(HTML, /t\(AU\?"playTerms":"playTermsPre"\)/));
  test("PLAY_PREPAID nu mai există ca valoare fixă", () => assert.ok(!/const PLAY_PREPAID=/.test(HTML)));
});

describe("partea nativă (sursa Java)", () => {
  test("planurile cu reînnoire înlocuiesc prepaid, cu cădere înapoi pe prepaid", () => {
    assert.match(JAVA, /plans = auto\.length\(\) > 0 \? auto : prepaid;/);
    assert.match(JAVA, /RecurrenceMode\.NON_RECURRING/);
  });
  test("proba: faza gratuită dă trialDays; cumpărarea o preferă dacă Play o dă", () => {
    assert.match(JAVA, /j\.put\("trialDays", trialDays\(o\.getBasePlanId\(\)\)\)/);
    assert.match(JAVA, /getPriceAmountMicros\(\) == 0\) trialToken = o\.getOfferToken\(\);/);
    assert.match(JAVA, /if \(trialToken != null\) token = trialToken;/);
  });
  test("planurile prepaid vechi nu dispar din cod: același PRODUCT_ID, aceeași confirmare", () => {
    assert.match(JAVA, /PRODUCT_ID = "ebanist_pro"/);
    assert.match(JAVA, /acknowledgePurchase/);
  });
  test("versiunea Android: versionCode 9, 1.4.0", () => { assert.match(GRADLE, /versionCode 9/); assert.match(GRADLE, /versionName "1\.4\.0"/); });
});

describe("isoDays (oglinda JS a funcției Java)", () => {
  const iso = (s) => { if (!s || s[0] !== "P") return 0; let n = 0, num = 0; for (const c of s.slice(1)) { if (/\d/.test(c)) { num = num * 10 + +c; continue; } n += c === "D" ? num : c === "W" ? 7 * num : c === "M" ? 30 * num : c === "Y" ? 365 * num : 0; num = 0; } return n; };
  test("P7D=7, P1W=7, P1M=30, P1Y=365, gol=0", () => { assert.equal(iso("P7D"), 7); assert.equal(iso("P1W"), 7); assert.equal(iso("P1M"), 30); assert.equal(iso("P1Y"), 365); assert.equal(iso(""), 0); });
  test("sursa Java are aceeleași reguli", () => assert.match(JAVA, /c == 'D'\) n \+= num; else if \(c == 'W'\) n \+= 7 \* num; else if \(c == 'M'\) n \+= 30 \* num; else if \(c == 'Y'\) n \+= 365 \* num;/));
});
