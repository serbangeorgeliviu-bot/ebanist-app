/* Ebanist — deschidere push / TIP-ON / electric, suspendarea corpurilor, îmbinări demontabile și fără unealtă (ebanist-open.js).
 *
 *   node --test test/open.test.js
 *
 * Ce păzește:
 *  - datele: generatorul e la zi, fiecare articol are sursă și verificat:false, numerele cheie sunt cele din JSON-ul brut (nu din memorie);
 *  - textele: aceleași chei în toate cele 7 limbi, aceleași {substituții}; nume de articole în 7 limbi;
 *  - regulile din surse: limite de uși (kg/înălțime/lățime), AVENTOS, clase de sertare, portanța suspendărilor, grosimi de panou;
 *  - totul e opt-in pe corp: avertismentele apar numai la alegere explicită.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["ebanist-lift-data.js", "ebanist-liftfit.js", "ebanist-open-data.js", "ebanist-open-i18n.js", "ebanist-open.js"].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, "app", f), "utf8"), ctx, { filename: f }));
const O = ctx.EBOpen, DATA = ctx.EBOpenData, I18 = ctx.OPEN_I18N_RAW, LANGS = ["it", "ro", "en", "fr", "de", "pl", "es"];
const RAW = f => JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "hw-data", "raw", f), "utf8"));
const OP = RAW("cat-opening.json"), SU = RAW("cat-susp.json");
const J = x => JSON.stringify(x);

describe("Date: generate din documente oficiale, fără numere din memorie", () => {
  test("generatorul normalize.py e la zi (app/ebanist-open-data.js)", () => {
    const r = cp.spawnSync("python3", [path.join(ROOT, "tools", "hw-data", "open", "normalize.py"), "--check"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
  test("fiecare articol: id unic, sursă, verificat:false, brand, nume pentru toate cele 7 limbi", () => {
    const seen = new Set();
    ["push", "pushd", "pushpsu", "susp", "suprail", "conn"].forEach(c => DATA[c].forEach(it => {
      assert.ok(!seen.has(it.id), "id dublat " + it.id); seen.add(it.id);
      assert.ok(it.src && it.src.length > 3, "fără sursă " + it.id);
      assert.equal(it.verificat, false, it.id);
      assert.ok(it.brand && it.model, it.id);
      LANGS.forEach(l => { const n = O.nameOf(it, l); assert.ok(n && !/^[a-z_0-9]+$/.test(n) && !n.includes("undefined"), it.id + " " + l + ": " + n); });
    }));
  });
  test("sursele citate există în JSON-ul brut", () => {
    ["push", "pushd", "pushpsu", "susp", "suprail", "conn"].forEach(c => DATA[c].forEach(it => {
      /* primul id de sursă din `src` (HET-…, BLUM-…, HAF-…, 23T7…): trebuie să existe în sources sau să fie o pagină de catalog numită */
      const ids = (it.src.match(/\b(HET|BLUM|HAF|SAL|GRASS|CAM|KNAPP)[A-Z0-9-]*/g) || []);
      ids.forEach(i => assert.ok(DATA.sources[i] || /^(HAF-TECH23|HAF-2014-HANG|HET-TA2025|HET-SHOP|HET-BK|HET-MTA|HET-EASYS|HET-SAH|HET-ANZ|BLUM-CAT24|BLUM-TOB|BLUM-UNO|SAL|GRASS|CAM|KNAPP)/.test(i), it.id + " sursă necunoscută " + i));
    }));
  });
  test("numerele-cheie sunt cele din raw (Rastex 15, Rafix-20, Salice, Häfele 315.11, Hettich PTO, SAH 500)", () => {
    const rx = SU.connectors.find(x => x.id === "HET-RASTEX15").drilling_a, v = DATA.conn.find(x => x.id === "het_rastex15_b24").joint;
    Object.keys(rx.depth_by_thickness_mm).forEach(k => assert.equal(v.depthT[k], rx.depth_by_thickness_mm[k], "adâncime " + k));
    Object.keys(rx.dowel_axis_A_by_thickness_mm).forEach(k => assert.equal(v.axisT[k], rx.dowel_axis_A_by_thickness_mm[k], "A " + k));
    assert.equal(v.dia, rx.housing_dia_mm); assert.equal(DATA.conn.find(x => x.id === "het_rastex15_b34").joint.B, 34);
    const rf = SU.connectors.find(x => x.id === "HAF-RAFIX20").drilling_a, rv = DATA.conn.find(x => x.id === "haf_rafix").joint;
    assert.equal(rv.dia, rf.housing_bore_dia_mm); assert.equal(rv.depthT[16], 12.7); assert.equal(rv.depthT[19], 14.2); assert.equal(rv.axisT[16], rf.A_mm["16"]); assert.equal(rv.axisT[19], rf.A_mm["19"]);
    assert.equal(rv.B, null, "B nu e în sursă");
    const hs = OP.items.find(x => x.id === "haefele-push-soft-close-315.11").limits;
    DATA.push.filter(x => x.id.startsWith("haf_pushsoft")).forEach(x => { const code = x.art; assert.equal(x.lim.kg[1], hs.door_weight_kg[code]); assert.equal(x.lim.h[1], hs.max_door_height_mm[code]); });
    const sal = DATA.push.find(x => x.id === "sal_push_dp4"); assert.equal(O.doorQty(sal, 1600), 1); assert.equal(O.doorQty(sal, 1700), 2);
    const pto = DATA.push.find(x => x.id === "het_pto_silent_9239087").lim.sizes; assert.equal(J(pto.map(z => z.kg)), "[17.1,22,22]");
    const sah = DATA.susp.find(x => x.id === "het_sah500"); assert.equal(J(sah.frames.map(f => f.kg)), "[110,80,50]");
    assert.equal(DATA.susp.find(x => x.id === "het_sah216ahs").kgBracket, 55); assert.equal(DATA.suprail.find(x => x.id === "het_rail_l").kgCab, 130);
  });
  test("ce sursa nu dă rămâne null: Camar 816 fără portanță, Rafix B, TIP-ON pentru uși fără greutate maximă", () => {
    assert.equal(DATA.susp.find(x => x.id === "cam_816as").kgPair, null);
    assert.equal(O.suspCap(O.get("cam_816as"), {}), null);
    assert.equal(DATA.push.find(x => x.id === "blum_tipon_short").lim.kg, null);
    assert.equal(DATA.push.find(x => x.id === "blum_servo_x"), undefined);
  });
  test("nu reintegrează ce e deja făcut: nimic Lamello/Festool, nimic SERVO-DRIVE pentru AVENTOS, nimic E-Drive Häfele", () => {
    const all = ["push", "pushd", "pushpsu", "susp", "suprail", "conn"].flatMap(c => DATA[c]);
    assert.ok(!all.some(x => /lamello|festool/i.test(x.brand)));
    assert.ok(!all.some(x => /e-?drive/i.test(x.model + x.sysname)));
    assert.ok(!all.some(x => /aventos/i.test(x.sysname || "") && x.model === "SERVO-DRIVE"));
  });
});

describe("Texte: 7 limbi, aceleași chei și aceleași substituții", () => {
  const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join(",");
  test("PH și MSG au toate cele 7 limbi, fără valori goale", () => {
    ["PH", "MSG"].forEach(T => Object.keys(I18[T]).forEach(k => {
      assert.equal(I18[T][k].length, 7, T + "." + k);
      I18[T][k].forEach((v, i) => assert.ok(typeof v === "string" && v.length > 1, T + "." + k + " " + LANGS[i]));
      const p0 = ph(I18[T][k][0]); I18[T][k].forEach((v, i) => assert.equal(ph(v), p0, T + "." + k + " substituții în " + LANGS[i]));
    }));
  });
  test("fiecare frază folosită de un articol există; fiecare cheie de avertisment folosită de cod există", () => {
    ["push", "pushd", "pushpsu", "susp", "suprail", "conn"].forEach(c => DATA[c].forEach(it => { if (it.ph) assert.ok(I18.PH[it.ph], it.id + " fraza " + it.ph); }));
    const src = fs.readFileSync(path.join(ROOT, "app", "ebanist-open.js"), "utf8");
    [...src.matchAll(/t\("(\w+)"\)/g)].forEach(m => assert.ok(I18.MSG[m[1]] || /^wOpenWhat_/.test(m[1]), "cheie lipsă " + m[1]));
    ["wOpenNoHandle", "wOpenConnNoDrill", "wOpenSuspNoDrill", "opsOpenNoDrill", "opsOpenPlace", "opsOpenB", "opsOpenNoF", "opsOpenThick"].forEach(k => assert.ok(I18.MSG[k], k));
    ["h", "w", "kg", "kh", "cabW", "gap", "nl", "lw", "sideT", "backT", "T"].forEach(w => assert.ok(I18.MSG["wOpenWhat_" + w], w));
  });
  test("catalogul: intrări noi în categoriile potrivite, cu nume în 7 limbi și preț 0 de completat; ce există deja nu se dublează", () => {
    const have = ["blum_tipon_a", "blum_tipon_t", "haf_pushlatch", "haf_onetouch"];
    const push = O.catalog("push", have); assert.ok(push.length >= 15);
    assert.ok(!push.some(x => have.includes(x.id)));
    LANGS.forEach(l => push.forEach(x => assert.ok(x.n[l] && x.n[l].length > 4)));
    push.forEach(x => assert.equal(x.price, 0));
    assert.ok(O.catalog("conn", ["haf_rafix", "haf_minifix"]).every(x => x.id !== "haf_rafix"));
    assert.ok(O.catalog("pushd", []).length >= 20 && O.catalog("susp", []).length >= 15 && O.catalog("suprail", []).length === 6 && O.catalog("pushpsu", []).length === 3);
    assert.ok(O.get("blum_tipon_a") && O.get("haf_rafix"), "datele pentru articolele existente");
  });
});

describe("Uși: limitele din surse, nimic inventat", () => {
  test("Häfele 315.11.400: 7,5 kg și 700 mm; o ușă de 1000 mm și 9 kg le depășește", () => {
    const it = O.get("haf_pushsoft_315_11_400");
    assert.equal(O.doorCheck(it, { h: 600, w: 400, kg: 6 }).length, 0);
    const r = O.doorCheck(it, { h: 1000, w: 400, kg: 9 });
    assert.ok(r.some(x => x.what === "h" && x.hi === 700) && r.some(x => x.what === "kg" && x.hi === 7.5), J(r));
    assert.ok(O.doorCheck(it, { h: 600, w: 700, kg: 5 }).some(x => x.what === "w"), "lățime max 600");
  });
  test("Hettich Push to open Silent: fâșiile H/L/kg din desen; între ele nicio fâșie", () => {
    const it = O.get("het_pto_silent_9239087");
    assert.equal(O.doorCheck(it, { h: 2000, w: 500, kg: 15 }).length, 0);
    assert.equal(O.doorCheck(it, { h: 2300, w: 500, kg: 20 }).length, 0);
    assert.ok(O.doorCheck(it, { h: 2000, w: 500, kg: 18 }).length === 0, "18 kg încape în fâșia ≤2400 mm (22 kg)");
    assert.equal(O.doorCheck(it, { h: 2000, w: 100, kg: 5 })[0].k, "sizes");
    assert.equal(O.doorCheck(it, { h: 2900, w: 500, kg: 10 })[0].k, "sizes");
  });
  test("TIP-ON scurt: ușă peste ~1300 mm ies din domeniu; fără greutate maximă în sursă nu se inventează una", () => {
    const it = O.get("blum_tipon_short");
    assert.ok(O.doorCheck(it, { h: 1500, w: 400, kg: 30 }).some(x => x.what === "h" && x.hi === 1300));
    assert.ok(!O.doorCheck(it, { h: 1000, w: 400, kg: 80 }).some(x => x.what === "kg"));
  });
  test("TIP-ON pentru AVENTOS: numai pe HK top/HK-S/HK-XS, 18 kg, înălțime 205–600, lățime ≤ 1800", () => {
    const it = O.get("blum_tipon_aventos");
    assert.equal(O.doorCheck(it, { h: 400, w: 800, kg: 8, kh: 400, cabW: 900, lift: "blum_hk_top" }).length, 0);
    assert.equal(O.doorCheck(it, { h: 400, w: 800, kg: 8, kh: 400, lift: "blum_hf_top" })[0].k, "liftOnly", "HF top: numai SERVO-DRIVE");
    assert.equal(O.doorCheck(it, { h: 400, w: 800, kg: 8, kh: 400, lift: null })[0].k, "liftOnly");
    const r = O.doorCheck(it, { h: 700, w: 800, kg: 20, kh: 700, cabW: 1900, lift: "blum_hk_top" });
    assert.ok(r.some(x => x.what === "kg" && x.hi === 18) && r.some(x => x.what === "kh") && r.some(x => x.what === "cabW" && x.hi === 1800), J(r));
    assert.ok(O.doorCheck(O.get("blum_tipon_short"), { h: 500, w: 400, kg: 3, lift: "blum_hk_top" }).some(x => x.k === "notLift"));
    ["blum_hk_top", "blum_hk_s", "blum_hk_xs"].forEach(k => assert.ok(ctx.EBLiftFit.get(k), "cheia sistemului de ridicare există: " + k));
  });
  test("Häfele 356.06: ușă peste 1200 mm cere un fermoar suplimentar; Salice: 2 dispozitive peste 1600 mm", () => {
    assert.ok(O.doorCheck(O.get("haf_pushcatch_356_06_460"), { h: 1500, w: 400 }).some(x => x.k === "extraCatch" && x.h === 1200));
    assert.equal(O.doorQty(O.get("sal_mpush_dpm"), 1500), 1); assert.equal(O.doorQty(O.get("sal_mpush_dpm"), 1601), 2);
    assert.equal(O.doorQty(O.get("blum_tipon_short"), 3000), 1); assert.equal(O.doorQty(null, 3000), 1);
  });
});

describe("Sertare: clase, sisteme, lățime interioară", () => {
  test("TIP-ON BLUMOTION L3 pe LEGRABOX: NL 350–600; 300 iese; LW minim 294", () => {
    const it = O.get("blum_tobm_lbx_l3");
    assert.equal(O.drawerCheck(it, { sys: "legrabox", nl: 450, lw: 600 }).length, 0);
    assert.ok(O.drawerCheck(it, { sys: "legrabox", nl: 300, lw: 600 }).some(x => x.what === "nl" && x.lo === 350 && x.hi === 600));
    assert.ok(O.drawerCheck(it, { sys: "legrabox", nl: 450, lw: 290 }).some(x => x.what === "lw" && x.lo === 294));
  });
  test("același set pe MOVENTO: LW minim 314 (diferit de LEGRABOX); L5: NL până la 750 pe MOVENTO, 650 pe LEGRABOX", () => {
    assert.ok(O.drawerCheck(O.get("blum_tobm_lbx_l3"), { sys: "movento", nl: 450, lw: 300 }).some(x => x.what === "lw" && x.lo === 314));
    const l5 = O.get("blum_tobm_lbx_l5");
    assert.equal(O.drawerCheck(l5, { sys: "movento", nl: 750, lw: 600 }).length, 0);
    assert.ok(O.drawerCheck(l5, { sys: "legrabox", nl: 700, lw: 600 }).some(x => x.what === "nl" && x.hi === 650));
  });
  test("sistem nepotrivit: TIP-ON BLUMOTION TANDEMBOX pe un sertar LEGRABOX; Hettich ArciTech pe lemn", () => {
    assert.equal(O.drawerCheck(O.get("blum_tobm_tb_l1"), { sys: "legrabox", nl: 500, lw: 600 })[0].k, "pushdSys");
    assert.equal(O.drawerCheck(O.get("het_ptos_arci_l1"), { sys: "legno", nl: 500, lw: 600 })[0].k, "pushdSys");
    assert.equal(O.drawerCheck(O.get("het_ptos_arci_l1"), { sys: "arcitech", nl: 500, lw: 600 }).length, 0);
  });
  test("clasele Hettich Actro YOU din cataloagele bk_262: NL 270–350 la XS, 450–650 la XL", () => {
    assert.ok(O.drawerCheck(O.get("het_ptos_actro_xs"), { sys: "actro", nl: 450, lw: 600 }).some(x => x.what === "nl"));
    assert.equal(O.drawerCheck(O.get("het_ptos_actro_xl"), { sys: "actro", nl: 550, lw: 600 }).length, 0);
  });
  test("alimentatoare: Easys 27 de unități/alimentator, Z10NA300 2, Blum sistem: unul pe corp (limita nu e în sursă)", () => {
    assert.equal(O.psuCount(O.get("het_easys_psu"), 27), 1); assert.equal(O.psuCount(O.get("het_easys_psu"), 28), 2);
    assert.equal(O.psuCount(O.get("blum_servo_psu_uno"), 3), 2); assert.equal(O.psuCount(O.get("blum_servo_psu_sys"), 40), 1); assert.equal(O.psuCount(O.get("blum_servo_psu_sys"), 0), 0);
    assert.equal(J(O.get("het_easys_9078139").aux), J([{ cat: "pushpsu", id: "het_easys_psu", per: "body" }]));
  });
});

describe("Suspendare: portanța din surse, cu temeiul ei", () => {
  test("SAH 500: portanța depinde de cadrul de încercare (cel mai apropiat); fără dimensiuni, cel mai prudent (50 kg pe clemă)", () => {
    const it = O.get("het_sah500");
    assert.equal(O.suspCap(it, { H: 1000, T: 300 }).kg, 220); assert.equal(O.suspCap(it, { H: 600, T: 600 }).kg, 160); assert.equal(O.suspCap(it, { H: 300, T: 600 }).kg, 100);
    assert.equal(O.suspCap(it, {}).kg, 100, "fără H/T: cel mai prudent");
    assert.equal(O.suspCap(it, { H: 650, T: 580 }).frame.id, "B");
  });
  test("SAH 216: 55 kg pe clemă → 110 kg pe pereche; Häfele 290.03.91: 130 kg pe pereche; Libra: 150", () => {
    assert.equal(O.suspCap(O.get("het_sah216ahs"), {}).kg, 110); assert.equal(O.suspCap(O.get("haf_hang_290_03_91"), {}).kg, 130); assert.equal(O.suspCap(O.get("haf_libra_h2"), {}).kg, 150);
    assert.equal(O.suspCap(O.get("haf_hang_290_03_91"), {}).basis, "pair");
    /* Häfele UK 2023 pp.212-228: Traser 50 kg pe cleamă; Spider/Koala 130 kg pe pereche; 290.21.900/901 nu spune baza sarcinii de 65 kg => nicio capacitate */
    assert.equal(O.suspCap(O.get("haf_traser6_290_28_900"), {}).kg, 100); assert.equal(O.suspCap(O.get("haf_traser8_290_32_90"), {}).perKg, 50);
    assert.equal(O.suspCap(O.get("haf_spider_290_36_910"), {}).kg, 130); assert.equal(O.suspCap(O.get("haf_koala_290_36_920"), {}).basis, "pair");
    assert.equal(O.suspCap(O.get("haf_rapid_290_21_90"), {}), null);
    /* Hettich SAH 209 (shop 9045794): 20 kg pe cleamă; Blum 48N0510/48N0610 (catalog 2020/21 p.556): 130 kg pe pereche */
    assert.equal(O.suspCap(O.get("het_sah209"), {}).kg, 40); assert.equal(O.get("het_sah209").wall, "hook");
    assert.equal(O.suspCap(O.get("blum_hang_48n0510"), {}).kg, 130); assert.equal(O.suspCap(O.get("blum_hang_48n0610"), {}).basis, "pair");
    assert.equal(O.get("haf_traser6_290_28_900").rails[0], "haf_rail_290_10_970"); assert.equal(O.get("haf_rail_290_10_970").length, 2029);
  });
  test("Camar 818: 720 N pe punct de agățare → 2 puncte, ÷9,81; Camar 816: fără portanță în sursă → «noKg», nu o valoare inventată", () => {
    const c = O.suspCap(O.get("cam_818"), {}); assert.ok(Math.abs(c.kg - 146.8) < 0.2, J(c));
    const r = O.suspCheck(O.get("cam_816as"), null, { kg: 40, hung: true }); assert.ok(r.some(x => x.k === "noKg"), J(r));
  });
  test("sarcină peste portanță: avertisment cu valorile; sub portanță: curat", () => {
    const sah = O.get("het_sah215"); // 45 kg pe clemă
    assert.equal(O.suspCheck(sah, O.get("het_rail_b"), { kg: 70, hung: true }).length, 0);
    const r = O.suspCheck(sah, O.get("het_rail_b"), { kg: 95, hung: true }); assert.ok(r.some(x => x.k === "load" && x.cap === 90 && x.kg === 95), J(r));
  });
  test("șina: Hettich L 130 kg pe corp: o sarcină de 140 kg iese pe șină chiar dacă clema ține", () => {
    const r = O.suspCheck(O.get("het_sah216ahs"), O.get("het_rail_l"), { kg: 109, hung: true }); assert.ok(r.some(x => x.k === "rail" && x.cap === 130) === false, "109 ≤ 110 și ≤ 130");
    const r2 = O.suspCheck(O.get("haf_hang_290_03_91"), O.get("het_rail_l"), { kg: 129, hung: true }); assert.equal(r2.length, 0, J(r2));
    const r3 = O.suspCheck(O.get("het_sah500"), O.get("het_rail_l"), { kg: 140, H: 1000, T: 300, hung: true }); assert.ok(r3.some(x => x.k === "rail" && x.cap === 130), J(r3));
  });
  test("grosimi: SAH 130 T19 numai pentru lateral 19; SAH 500 numai cu fond 3–8 mm; SAH 305 fond ≥ 16 mm; corp nesuspendat", () => {
    assert.ok(O.suspCheck(O.get("het_sah130"), null, { kg: 10, hung: true, sideT: 18 }).some(x => x.k === "sideT" && x.lo === 19));
    assert.equal(O.suspCheck(O.get("het_sah130"), null, { kg: 10, hung: true, sideT: 19 }).length, 0);
    assert.ok(O.suspCheck(O.get("het_sah500"), null, { kg: 10, hung: true, backT: 10 }).some(x => x.what === "backT" && x.lo === 3 && x.hi === 8));
    assert.ok(O.suspCheck(O.get("het_sah305"), null, { kg: 5, hung: true, backT: 10 }).some(x => x.what === "backT" && x.lo === 16));
    assert.ok(O.suspCheck(O.get("het_sah215"), null, { kg: 5, hung: false }).some(x => x.k === "notHung"));
  });
  test("șina implicită: prima din lista articolului; alegerea explicită are prioritate; fără șină (Libra) nimic", () => {
    assert.equal(O.railFor(O.get("het_sah216"), null).id, "het_rail_b"); assert.equal(O.railFor(O.get("het_sah216"), "het_rail_l").id, "het_rail_l");
    assert.equal(O.railFor(O.get("haf_libra_h1"), null), null);
  });
});

describe("Îmbinări: grosimea panoului din sursă", () => {
  test("Rastex 15: 12–29 mm; Rafix-20: 16–19; TAB 18 pe șurub: de la 19; Maxifix: de la 19", () => {
    assert.equal(O.connCheck(O.get("het_rastex15_b24"), 19).length, 0); assert.ok(O.connCheck(O.get("het_rastex15_b24"), 10).some(x => x.lo === 12 && x.hi === 29));
    assert.ok(O.connCheck(O.get("haf_rafix"), 22).length === 1 && O.connCheck(O.get("haf_rafix"), 18).length === 0);
    assert.ok(O.connCheck(O.get("haf_tab18_screw"), 16).length === 1); assert.ok(O.connCheck(O.get("haf_maxifix"), 18).length === 1);
    assert.equal(O.connCheck(O.get("haf_rvclip"), 19).length, 0, "RV clip: gama nu e în sursă, nu se verifică");
  });
  test("variante de găurire: housing pentru Rastex/Rafix/Rafix TAB/Maxifix, plug pentru TAB, nodrill pentru restul — fără Minifix în tăcere", () => {
    const j = O.joints();
    assert.equal(j.ofId.het_rastex15_b24, "housing"); assert.equal(j.ofId.haf_rafix, "housing"); assert.equal(j.ofId.haf_maxifix, "housing");
    assert.equal(j.ofId.haf_tab18_plug, "plug"); assert.equal(j.ofId.het_vb20, "nodrill"); assert.equal(j.ofId.kn_uno30, "nodrill");
    Object.keys(j.variants).forEach(k => assert.equal(j.variants[k].verificat, false, k));
    assert.equal(j.kinds.housing.verificat, false);
  });
});

describe("Avertismentele unui corp (opt-in)", () => {
  const env = { doors: [{ h: 800, w: 450, kg: 8 }], drawers: { n: 0 }, bodyKg: 40, G: { H: 720, T: 350 }, sideT: 19, backT: 3, hung: true, kh: 700, cabW: 900 };
  test("fără alegere explicită: nimic", () => { assert.equal(O.warnBody({ handles: "push" }, env).length, 0); assert.equal(O.warnBody({ handles: "push", hwSel: {} }, env).length, 0); });
  test("push ales dar mânere: avertisment; ușă prea grea pentru 315.11.400: range kg", () => {
    const w = O.warnBody({ handles: "maniglia", hwSel: { push: "haf_pushsoft_315_11_400" } }, env);
    assert.ok(w.some(x => x.k === "noHandle") && w.some(x => x.k === "range" && x.what === "kg"), J(w));
  });
  test("rostul minim din sursă (nu e în model): TIP-ON scurt 2,6, Hettich Magnet 1,4, sertar Blum 2,5 — nota apare numai la alegere explicită", () => {
    const g = (sel, e) => O.warnBody({ handles: "push", hwSel: sel }, Object.assign({}, env, e || {})).filter(x => x.k === "gapMin").map(x => x.lo);
    assert.equal(J(g({ push: "blum_tipon_short" })), "[2.6]"); assert.equal(J(g({ push: "het_pto_magnet_9375985" })), "[1.4]");
    assert.equal(J(g({ pushd: "blum_tobm_lbx_l3" }, { drawers: { n: 2, sys: "legrabox", nl: 450, lw: 600 } })), "[2.5]");
    assert.equal(g({}).length, 0); assert.equal(J(g({ push: "blum_tipon_short" }, { doors: [] })), "[]");
  });
  test("suspendare: sarcina conținutului (cfg.suspKg) se adaugă greutății corpului", () => {
    const base = { handles: "maniglia", hwSel: { susp: "het_sah215", suprail: "het_rail_b" } };
    assert.equal(O.warnBody(Object.assign({ suspKg: 30 }, base), env).filter(x => x.k === "load").length, 0);   // 40 + 30 = 70 ≤ 90
    assert.equal(O.warnBody(Object.assign({ suspKg: 60 }, base), env).filter(x => x.k === "load").length, 1);   // 100 > 90
  });
  test("fără șină aleasă: se spune ce se numără; cu șină aleasă: nu", () => {
    assert.ok(O.warnBody({ hwSel: { susp: "het_sah215" } }, env).some(x => x.k === "suspRails" && x.rail === "Rail B"));
    assert.ok(!O.warnBody({ hwSel: { susp: "het_sah215", suprail: "het_rail_b" } }, env).some(x => x.k === "suspRails"));
  });
  test("îmbinare aleasă: grosime în afara gamei", () => {
    const w = O.warnBody({ hwSel: { conn: "haf_rafix" } }, Object.assign({}, env, { sideT: 25 })); assert.ok(w.some(x => x.k === "connT" && x.lo === 16 && x.hi === 19), J(w));
  });
  test("msg(): fiecare avertisment dă text în fiecare limbă, fără {acolade} rămase", () => {
    const warns = [].concat(
      O.warnBody({ handles: "maniglia", hwSel: { push: "haf_pushsoft_315_11_400", pushd: "blum_tobm_tb_l1", susp: "het_sah215", conn: "haf_rafix" }, suspKg: 80 },
        { doors: [{ h: 2900, w: 700, kg: 40 }], drawers: { n: 2, sys: "legrabox", nl: 280, lw: 200 }, bodyKg: 60, G: { H: 720, T: 350 }, sideT: 25, backT: 3, hung: false, lift: "blum_hk_top", kh: 700, cabW: 900 }),
      O.warnBody({ hwSel: { susp: "cam_816as" } }, env),
      O.warnBody({ hwSel: { push: "blum_tipon_aventos" } }, Object.assign({}, env, { lift: null })),
      O.warnBody({ hwSel: { push: "het_pto_silent_9239087" } }, { doors: [{ h: 2000, w: 100, kg: 5 }] }),
      O.warnBody({ hwSel: { push: "haf_pushcatch_356_06_460" }, handles: "push" }, { doors: [{ h: 1500, w: 400, kg: 5 }] }),
      O.warnBody({ hwSel: { susp: "het_sah215", suprail: "het_rail_l" }, suspKg: 100 }, env),
      [{ k: "opsOpenNoDrill" }, { k: "opsOpenB", sys: "X" }, { k: "opsOpenNoF", sys: "X" }, { k: "opsOpenThick", sys: "X", v: 20 }, { k: "wOpenConnNoDrill", sys: "X" }, { k: "wOpenSuspNoDrill", sys: "X" }, { k: "opsOpenPlace" }]);
    const kinds = new Set(warns.map(w => w.k)); ["range", "load", "gapMin", "noHandle", "pushdSys", "notHung", "connT", "noKg", "liftOnly", "sizes", "extraCatch", "rail"].forEach(k => assert.ok(kinds.has(k), "lipsește cazul " + k));
    LANGS.forEach(l => { const t = k => (ctx.OPEN_I18N[l] || {})[k] || (k.startsWith("wOpenWhat_") ? k : "");
      warns.forEach(w => { const m = O.msg(w, t); assert.ok(m && m.length > 8 && !/\{\w+\}/.test(m) && !/undefined/.test(m), l + " " + w.k + ": " + m); }); });
  });
});
