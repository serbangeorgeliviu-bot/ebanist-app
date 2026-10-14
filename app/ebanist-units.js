/* =====================================================================
   Ebanist — unități de lungime: milimetri / inch (D-81)
   ---------------------------------------------------------------------
   Funcții PURE, fără DOM. Motorul rămâne în milimetri, cu precizie deplină;
   inch-ul există numai la margini: la citirea unui câmp (`parseLen`) și la
   afișare (`fmtLen`). Rotunjirea la fracție (1/16, 1/32) se face doar la
   emitere și nu se întoarce niciodată în model.

   Formate acceptate la intrare (unitatea implicită vine din setare):
     800   800mm   80cm   0.8m
     31.5   31,5"   31 1/2   31-1/2"   1/2   2'   2'-7 1/2"   2ft 7in
   ===================================================================== */
(function (root) {
"use strict";

var MM_PER_IN = 25.4;

function toIn(mm) { return mm / MM_PER_IN; }
function toMm(inch) { return inch * MM_PER_IN; }

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/* mm → text în inch. opt.mode: "frac16" (implicit) | "frac32" | "dec".
   opt.unit: adaugă ″ . opt.feet: peste 12 in scrie 2'-7 1/2″. */
function fmtIn(mm, opt) {
  opt = opt || {};
  var v = +mm;
  if (!isFinite(v)) return "";
  var mode = opt.mode || "frac16";
  var a = Math.abs(toIn(v)), whole, num = 0, den = 1;
  if (mode === "dec") {
    a = Math.round(a * 1000) / 1000;
    whole = Math.floor(a);
    var dec = Math.round((a - whole) * 1000) / 1000;
    if (dec) { whole = whole + dec; }
  } else {
    den = mode === "frac32" ? 32 : 16;
    var n = Math.round(a * den);
    whole = Math.floor(n / den); num = n % den;
    if (num) { var g = gcd(num, den); num /= g; den /= g; }
  }
  var ft = 0;
  if (opt.feet && whole >= 12) { ft = Math.floor(whole / 12); whole -= ft * 12; }
  var body = mode === "dec" ? String(+whole.toFixed(3))
           : (num ? (whole ? whole + " " : "") + num + "/" + den : String(whole));
  var zero = !ft && body === "0";
  if (ft) body = (body === "0" ? ft + "'" : ft + "'-" + body);
  var inchMark = opt.unit && !(ft && body.slice(-1) === "'") ? "\u2033" : "";
  return (v < 0 && !zero ? "-" : "") + body + inchMark;
}

/* mm → text în unitatea aleasă. units: "mm" | "in". */
function fmtLen(mm, units, opt) {
  var v = +mm;
  if (!isFinite(v)) return "";
  if (units === "in") return fmtIn(v, opt);
  var r = Math.round(v * 10) / 10;
  return String(r).replace(/\.0$/, "");
}

/* «800 mm» sau «31 1/2″ (800)» — pentru documente: cota în inch ALĂTURI de mm,
   nu în locul ei (ca `cutLW`, D-69). */
function fmtDual(mm, units, opt) {
  if (units !== "in") return fmtLen(mm, "mm");
  return fmtIn(mm, Object.assign({ unit: true }, opt || {})) + " (" + fmtLen(mm, "mm") + ")";
}

var UNIT_RX = "(mm|cm|m|feet|foot|ft|inches|inch|in|'|\"|′|″|”|’)";
var SEG = new RegExp(
  "\\s*(\\d+[\\s-]+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?|[.,]\\d+)\\s*" + UNIT_RX + "?", "iy");

function numToken(tok) {
  /* «31 1/2», «31-1/2», «1/2», «31,5» */
  var m = /^(\d+)[\s-]+(\d+)\/(\d+)$/.exec(tok);
  if (m) return m[3] === "0" ? NaN : +m[1] + m[2] / m[3];
  m = /^(\d+)\/(\d+)$/.exec(tok);
  if (m) return m[2] === "0" ? NaN : m[1] / m[2];
  return +tok.replace(",", ".");
}

function unitFactor(u) {
  u = (u || "").toLowerCase();
  if (u === "mm") return 1;
  if (u === "cm") return 10;
  if (u === "m") return 1000;
  if (u === "ft" || u === "feet" || u === "foot" || u === "'" || u === "′" || u === "’") return 12 * MM_PER_IN;
  if (u === "in" || u === "inch" || u === "inches" || u === '"' || u === "″" || u === "”") return MM_PER_IN;
  return null;
}

/* text → mm (număr) sau null dacă e gol / ilizibil.
   defUnit: "mm" | "in" — unitatea unui număr fără sufix. */
function parseLen(str, defUnit) {
  if (str == null) return null;
  var s = String(str).trim();
  if (!s) return null;
  var neg = false;
  if (s.charAt(0) === "-" || s.charAt(0) === "−") { neg = true; s = s.slice(1).trim(); }
  var defF = defUnit === "in" ? MM_PER_IN : 1;
  var total = 0, pos = 0, got = 0;
  SEG.lastIndex = 0;
  while (pos < s.length) {
    SEG.lastIndex = pos;
    var m = SEG.exec(s);
    if (!m) return null;
    var n = numToken(m[1]);
    if (!isFinite(n)) return null;
    var f = m[2] ? unitFactor(m[2]) : defF;
    /* «2'-7 1/2» : după picioare, un număr fără sufix înseamnă inch */
    if (!m[2] && got && lastUnitWasFeet) f = MM_PER_IN;
    total += n * f;
    var lastUnitWasFeet = !!m[2] && unitFactor(m[2]) === 12 * MM_PER_IN;
    got++;
    pos = SEG.lastIndex;
    /* separatori între segmente */
    var sep = /^[\s,\-]+/.exec(s.slice(pos));
    if (sep) pos += sep[0].length;
  }
  if (!got) return null;
  return neg ? -total : total;
}

var API = { MM_PER_IN: MM_PER_IN, toIn: toIn, toMm: toMm, fmtIn: fmtIn, fmtLen: fmtLen,
            fmtDual: fmtDual, parseLen: parseLen };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
