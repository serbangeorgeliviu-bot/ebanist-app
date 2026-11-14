/* =====================================================================
   Ebanist — Bucătărie: catalogul de aparate și grosimile de blat (D-142)
   ---------------------------------------------------------------------
   DATE, nu cod (ca `ebanist-hinges-data.js`). Fiecare aparat poartă cotele de
   NIȘĂ (cât loc cere în mobil) și ale corpului lui, în mm. Cotele sunt cele
   uzuale ale aparatelor europene de 60 / 45 cm — nu ale unui producător anume:
   TOATE sunt `verificat:false` până se confirmă pe fișa aparatului ales (D-48).
   Nu există aici coduri de articol și nici prețuri: aparatul real vine cu
   fișa lui, iar prețul îl pune omul în deviz.

   `mount` (cum stă aparatul în mobil):
     incasso   — încastrat, cu fața lui la vedere (cuptor, plită, inox)
     semi      — parțial integrat: front de mobil pe ușă, comenzile rămân la vedere
     scomparsa — integrat total: ușa aparatului poartă frontul mobilei
     libera    — aparat liber, doar locul lui în rând (aragaz, frigider liber)

   Câmpuri: id, kind, mounts[], w/h/d = corpul aparatului;
            niche{w,h,d} = golul cerut în mobil (h poate fi interval: hMin/hMax);
            cut{w,d,r}   = decupajul din blat (plită, chiuvetă);
            clear        = distanța minimă plită → hotă, mm (după tipul de combustibil).
   ===================================================================== */
(function (root) {
"use strict";

var APPL = [];
function a(id, kind, mounts, body, niche, extra) {
  var o = { id: id, kind: kind, mounts: mounts, w: body[0], h: body[1], d: body[2], niche: null, verificat: false };
  if (niche) o.niche = { w: niche[0], h: niche[1], d: niche[2] };
  if (extra) for (var k in extra) o[k] = extra[k];
  APPL.push(o);
}

/* --- cuptoare --- */
a("oven60",        "oven",  ["incasso"], [595, 595, 548], [560, 595, 550]);
a("oven45",        "oven",  ["incasso"], [595, 455, 548], [560, 455, 550], { sub: "compact" });
a("oven45_steam",  "oven",  ["incasso"], [595, 455, 548], [560, 455, 550], { sub: "steam" });
a("oven45_micro",  "oven",  ["incasso"], [595, 455, 548], [560, 455, 550], { sub: "combi" });
/* --- cuptor cu microunde, cafea, sertar de încălzit --- */
a("micro38",       "micro", ["incasso"], [595, 382, 320], [560, 380, 300]);
a("micro45",       "micro", ["incasso"], [595, 455, 400], [560, 455, 400]);
a("coffee45",      "coffee",["incasso"], [595, 455, 450], [560, 455, 450]);
a("warm14",        "warm",  ["incasso"], [595, 140, 540], [560, 140, 550]);
a("warm29",        "warm",  ["incasso"], [595, 290, 540], [560, 290, 550]);

/* --- plite: decupajul din blat; `fuel` decide distanța până la hotă --- */
function hob(id, sub, fuel, w, cw, cd) {
  var o = { id: id, kind: "hob", sub: sub, fuel: fuel, mounts: ["incasso"], w: w, h: 55, d: 520, niche: null,
            cut: { w: cw, d: cd, r: 6 }, verificat: false };
  APPL.push(o);
}
hob("hob_ind30",   "ind",  "elec",  300, 270, 490);
hob("hob_ind60",   "ind",  "elec",  590, 560, 490);
hob("hob_ind80",   "ind",  "elec",  780, 750, 490);
hob("hob_ind90",   "ind",  "elec",  900, 880, 490);
hob("hob_cer60",   "cer",  "elec",  590, 560, 490);
hob("hob_gas60",   "gas",  "gas",   590, 560, 480);
hob("hob_gas75",   "gas",  "gas",   750, 700, 480);
hob("hob_gas90",   "gas",  "gas",   900, 860, 480);

/* --- hote: telescopică (în pensilă), sub pensilă, coș, insulă ---
   h = înălțimea părții vizibile; `cab` = intră într-un corp suspendat de aceeași lățime. */
function hood(id, sub, w, h, d, extra) {
  var o = { id: id, kind: "hood", sub: sub, mounts: [sub === "tele" ? "scomparsa" : "incasso"], w: w, h: h, d: d, niche: null, verificat: false };
  if (extra) for (var k in extra) o[k] = extra[k];
  APPL.push(o);
}
hood("hood_tele60",   "tele",    598, 150, 290, { cab: true });
hood("hood_tele90",   "tele",    898, 150, 290, { cab: true });
hood("hood_canopy60", "canopy",  600, 150, 480);
hood("hood_canopy90", "canopy",  900, 150, 480);
hood("hood_chim60",   "chimney", 600, 900, 500, { duct: 200 });
hood("hood_chim90",   "chimney", 900, 900, 500, { duct: 200 });

/* --- mașini de spălat vase: nișa cere 820–870 mm înălțime sub blat --- */
a("dw60_total", "dw", ["scomparsa"], [598, 815, 550], [600, 820, 570], { hMax: 870, sub: "total", front: true });
a("dw60_semi",  "dw", ["semi"],      [598, 815, 550], [600, 820, 570], { hMax: 870, sub: "semi",  front: true, ctrl: 90 });
a("dw60_inox",  "dw", ["incasso"],   [598, 815, 550], [600, 820, 570], { hMax: 870, sub: "inox" });
a("dw45_total", "dw", ["scomparsa"], [448, 815, 550], [450, 820, 570], { hMax: 870, sub: "total", front: true });
a("dw45_inox",  "dw", ["incasso"],   [448, 815, 550], [450, 820, 570], { hMax: 870, sub: "inox" });

/* --- frigidere, congelatoare, răcitor de vin --- */
a("fridge178",  "fridge", ["scomparsa"], [540, 1775, 545], [560, 1780, 550], { front: true });
a("fridge158",  "fridge", ["scomparsa"], [540, 1575, 545], [560, 1580, 550], { front: true });
a("fridge122",  "fridge", ["scomparsa"], [540, 1218, 545], [560, 1220, 550], { front: true });
a("fridge102",  "fridge", ["scomparsa"], [540, 1018, 545], [560, 1020, 550], { front: true });
a("fridge88",   "fridge", ["scomparsa"], [540, 875, 545],  [560, 880, 550],  { front: true });
a("fridge_uc",  "fridge", ["scomparsa", "incasso"], [595, 815, 545], [600, 820, 570], { hMax: 870, front: true, sub: "uc" });
a("freezer_uc", "freezer",["scomparsa", "incasso"], [595, 815, 545], [600, 820, 570], { hMax: 870, front: true, sub: "uc" });
a("freezer88",  "freezer",["scomparsa"], [540, 875, 545],  [560, 880, 550],  { front: true });
a("freezer178", "freezer",["scomparsa"], [540, 1775, 545], [560, 1780, 550], { front: true });
a("wine_uc",    "wine",   ["incasso", "scomparsa"], [595, 815, 545], [600, 820, 570], { hMax: 870, front: true, sub: "uc" });
a("fridge_free60", "fridge", ["libera"], [600, 1850, 650], [600, 1850, 650]);
a("fridge_sbs90",  "fridge", ["libera"], [910, 1780, 700], [910, 1780, 700]);

/* --- mașini de spălat rufe și uscător: 820 mm sub blat, adâncime 600 --- */
a("washer60_total", "washer", ["scomparsa"], [596, 818, 550], [600, 820, 600], { hMax: 870, front: true });
a("washer60_free",  "washer", ["libera"],    [595, 850, 600], [600, 850, 600], { hMax: 870 });
a("dryer60_total",  "dryer",  ["scomparsa"], [596, 818, 600], [600, 820, 600], { hMax: 870, front: true });
a("washdry60_total","washdry",["scomparsa"], [596, 818, 600], [600, 820, 600], { hMax: 870, front: true });

/* --- aragaz / cuptor cu plită, liber în rând --- */
a("range60",  "range", ["libera"], [600, 850, 600],  [600, 850, 600],  { fuel: "gas" });
a("range90",  "range", ["libera"], [900, 850, 600],  [900, 850, 600],  { fuel: "gas" });
a("range100", "range", ["libera"], [1000, 850, 600], [1000, 850, 600], { fuel: "gas" });
a("range120", "range", ["libera"], [1200, 850, 600], [1200, 850, 600], { fuel: "gas" });

/* --- chiuvete: decupajul e al modelului ales; aici sunt cote de pornire --- */
function sink(id, sub, w, d, cw, cd, r, bowls) {
  APPL.push({ id: id, kind: "sink", sub: sub, mounts: ["incasso"], w: w, h: 180, d: d, niche: null,
              cut: { w: cw, d: cd, r: r }, bowls: bowls, verificat: false });
}
sink("sink1",      "1",     800,  500, 780,  440, 10, 1);
sink("sink1_dr",   "1dr",   1000, 500, 980,  460, 10, 1);
sink("sink15",     "15",    1000, 500, 980,  460, 10, 2);
sink("sink2",      "2",     1160, 500, 1140, 440, 10, 2);
sink("sink_round", "round", 480,  480, 440,  440, 220, 1);

var KINDS = ["oven", "micro", "coffee", "warm", "hob", "hood", "dw", "fridge", "freezer", "wine", "washer", "dryer", "washdry", "range", "sink"];
var MOUNTS = ["incasso", "semi", "scomparsa", "libera"];

/* grosimile de blat uzuale, mm (D-142): 12 ceramică/inox/compact, 20 cuarț/ceramică, 28–30 laminat subțire,
   38–40 laminat/postformat, 50 lemn masiv. Materialul vine din catalog (`materials-worktops.json`). */
var WORKTOP_THICKS = [12, 20, 28, 30, 38, 40, 50];

/* distanța minimă plită → hotă (mm): uzuală pentru hote de bucătărie, de confirmat pe fișa hotei */
var HOOD_CLEAR = { elec: 650, gas: 750 };

var API = { KITCHEN_APPL: APPL, KITCHEN_KINDS: KINDS, KITCHEN_MOUNTS: MOUNTS, WORKTOP_THICKS: WORKTOP_THICKS, HOOD_CLEAR: HOOD_CLEAR };
if (typeof module !== "undefined" && module.exports) module.exports = API;
for (var k in API) if (Object.prototype.hasOwnProperty.call(API, k)) root[k] = API[k];

})(typeof globalThis !== "undefined" ? globalThis : this);
