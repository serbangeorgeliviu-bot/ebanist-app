#!/usr/bin/env python3
"""Ebanist — sisteme de sertar dincolo de Blum/Häfele Matrix: aduce datele brute (tools/hw-data/raw/cat-drawers.json, citite din documente
oficiale Hettich, GRASS, Häfele, Accuride) într-o schemă comună: tools/hw-data/drawers/drawers.json.

    python3 -I tools/hw-data/drawers/normalize.py

NU inventează nimic. Fiecare număr vine din raw (copiat din câmpuri structurate sau citit dintr-un text pe care scriptul îl VERIFICĂ
în raw: `need()` oprește rularea dacă formula nu mai e în sursă). Ce nu e în raw rămâne null. Două feluri de „număr”:
  * dată de fabricant (deducții, înălțimi, NL, adâncime minimă, înălțimea spatelui) — cu `src`;
  * `derived` — o operație aritmetică simplă pe date din raw (EB·2 + 52,5 etc.), marcată.
Toate cotele rămân verificat:false (D-48) până se măsoară pe piese reale.

Schema unui sistem de CASĂ (box): key, brand, name, selectable, why[], runner, side, hs{cod:mm}, hsExcl{cod:motiv}, backHs{cod:mm}, nlBy{cod:[NL]},
  baseW/backW = {const:n} | {byT:{grosime lateral corp: n}}  (deducție din lățimea interioară LW),  baseL = {const:n} (din NL),
  rear (adâncimea minimă = NL + rear), minBackW, bottomTh, thRef, vis{sideTh,src}, front{...}, codes[]
Schema unei GLISIERE (runner): key, brand, name, kind side|concealed, load, nl, rear, wood{ded_lat,skl,minBoxW,derived,...}, holes{...}, art, codes[]
"""
import json, os, re, sys

here = os.path.dirname(os.path.abspath(__file__))
RAW = json.load(open(os.path.join(here, "..", "raw", "cat-drawers.json"), encoding="utf-8"))
RAW_TEXT = json.dumps(RAW, ensure_ascii=False)
SYS = {s["id"]: s for s in RAW["systems"]}
SRC = {s["id"]: s for s in RAW["sources"]}


def need(*frag):
    """formula citită din text: trebuie să existe în raw, altfel scriptul se oprește"""
    for f in frag:
        if f not in RAW_TEXT:
            sys.exit("lipsește din raw: " + f)


def codes_of(sid, pred=None, keep=("code", "desc", "src")):
    out = []
    for c in SYS[sid]["codes"]:
        if pred is None or pred(c):
            out.append({k: c[k] for k in keep if k in c})
    return out


def pattern(codes):
    """«9255xxx» din primul cod și prefixul comun (numai pentru afișare în catalog)"""
    flat = []
    for c in codes:
        v = c["code"]
        for x in (v if isinstance(v, list) else re.split(r"[/;]", str(v))):
            x = x.strip()
            if x and not x.startswith("0"):
                flat.append(x)
    if not flat:
        return "—"
    first = flat[0]
    p = os.path.commonprefix(flat)
    if len(p) >= len(first):
        return first
    if len(p) < 4:
        return first + "…"
    return p + "x" * (len(first) - len(p))


def classes_from_codes(sid, rx):
    """clasele de sarcină (XS/L/XL) și NL-urile lor, citite din descrierea codurilor (rx are două grupuri: clasa și NL)"""
    out = {}
    for c in SYS[sid]["codes"]:
        m = re.search(rx, c["desc"])
        if m:
            out.setdefault(m.group(1), [])
            if int(m.group(2)) not in out[m.group(1)]:
                out[m.group(1)].append(int(m.group(2)))
    return {k: sorted(v) for k, v in out.items()}


def ints(d):
    return {k: [int(x) for x in v] for k, v in d.items()}


# ====================================================================== GLISIERE
runners = []

# --- Hettich Actro YOU (pentru AvanTech YOU și sertare din lemn cu Schnäpper)
a = SYS["hettich-actro-you"]
need("BB = LB - 24")
runners.append({
    "key": "het_actro_you", "brand": "Hettich", "name": "Actro YOU Silent System", "kind": "side",
    "load": {"XS": a["load_kg"]["XS"], "L": a["load_kg"]["L"], "XL": a["load_kg"]["XL"], "std": "EN 15338 Level 3"},
    "classes": classes_from_codes("hettich-actro-you", r"^(XS|L|XL)\b.*NL(\d+)"),
    "nl": a["nl"],
    "rear": 3, "rearRule": "NL + 3 (cabinet, din tabel bk_279: 273 pentru NL 270)",
    "wood": {"ded_lat": None, "skl": None, "minBoxW": None, "derived": False,
             "note": "formula de lățime pentru lemn nu e pe paginile Actro YOU (raw: null)"},
    "holes": {"usable": False, "ref": "drawing", "b1b2": a["drilling"]["hole_b1_b2_mm"],
              "firstRowFromFront": 37, "pair": 32, "refFloorMm": 38,
              "note": "37 mm de la Korpusvorderkante (text) și perechi la 32 mm; b1/b2 sunt cotate pe desen, referința lor nu e în tabel"},
    "art": "9318xxx", "codes": codes_of("hettich-actro-you"),
    "extra": [{"code": "9257263/264/265", "desc": "Schnäpper stânga/dreapta/L+R (sertar din lemn), reglaj înălțime până la +3 mm", "src": "H-TA23 bk_279"},
              {"code": "9257706", "desc": "Tiefenverstellung (reglaj adâncime +4 mm)", "src": "H-TA23 bk_257"}],
    "src": "H-TA23 bk_278,279 (pag. tipărită 260-261)", "verificat": False,
    "unreadable": a["unreadable"],
})

# --- Hettich Actro (ArciTech)
a = SYS["hettich-arcitech"]
b1 = {str(k): [v, None] for k, v in a["drilling"]["hole_b1_mm"].items()}
runners.append({
    "key": "het_actro_arcitech", "brand": "Hettich", "name": "Actro (ArciTech) Silent System", "kind": "side",
    "load": {"XS": 10, "L": 40, "XL": 70, "std": a["load_kg"]["std"]},
    "classes": classes_from_codes("hettich-arcitech", r"^Actro \(ArciTech\) (XS|L|XL) NL(\d+)"),
    "nl": a["nl"],
    "rear": 3, "rearRule": "NL + 3",
    "byThickness": {"18": "EB 13 (cod 9240884…)", "19": "EB 12 (cod 9240920…)"},
    "wood": {"ded_lat": None, "skl": None, "minBoxW": None, "derived": False, "note": "runner pentru ArciTech, nu pentru lemn"},
    "holes": {"usable": False, "ref": "drawing", "b1": a["drilling"]["hole_b1_mm"], "b1b2": b1,
              "note": "b1 din tabelul bk_327; referința (de la primul rând, la 37 mm de față) e numai pe desen"},
    "art": "9240xxx", "codes": [c for c in codes_of("hettich-arcitech") if c["desc"].startswith("Actro") or c["desc"].startswith("Push to open")],
    "src": "H-TA23 bk_326,327,328", "verificat": False, "unreadable": a["unreadable"],
})

# --- Hettich Actro 5D (lemn)
a = SYS["hettich-actro-5d"]
need("(LB - 42)", "NL - 10")
runners.append({
    "key": "het_actro_5d", "brand": "Hettich", "name": "Actro 5D Silent System (sertar din lemn)", "kind": "side",
    "load": {"XS": 10, "L": 40, "XL": 70, "std": a["load_kg"]["std"]},
    "classes": ints(a["nl_by_class"]), "nl": a["nl"],
    "rear": 3, "rearRule": "LT = NL + 3",
    "wood": {"ded_lat": 42, "skl": 10, "minBoxW": None, "derived": False, "maxSideTh": a["cabinet"]["side_thickness_max_mm"],
             "note": "SKW = LB − 42 (+0/−1,5); SKL = NL − 10; Zargendicke ≤ 16 mm (bk_385)", "src": "H-TA23 bk_385"},
    "holes": {"usable": False, "ref": "drawing", "b1b2": a["drilling"]["hole_b1_b2_mm"],
              "note": "37 mm de la față, perechi la 32; referința b1/b2 numai pe desen"},
    "art": "9318xxx", "codes": codes_of("hettich-actro-5d"),
    "src": "H-TA23 bk_382,384,385", "verificat": False, "unreadable": a["unreadable"],
})

# --- Hettich Quadro V6 (lemn, parțial)
a = SYS["hettich-quadro-v6"]
runners.append({
    "key": "het_quadro_v6", "brand": "Hettich", "name": "Quadro V6 Silent System", "kind": "side",
    "load": {"V6": a["load_kg"]["V6"], "std": a["load_kg"]["std"]},
    "classes": {}, "nl": a["nl"],
    "rear": 13, "rearRule": "KT ≥ NL + 13 (bk_392,395)",
    "wood": {"ded_lat": None, "skl": None, "minBoxW": None, "derived": False,
             "note": "nu există formulă de lățime/lungime în paginile citite (raw: null); EB 20 / EB 23 sunt date, formula nu"},
    "holes": {"usable": False, "ref": "unknown", "b1": a["drilling"]["hole_b1_b2_mm_EB20_Silent"], "b2PTO": a["drilling"]["b2_PTO"],
              "note": "numai pentru EB 20; referința nu e în tabel"},
    "art": "9135xxx", "codes": codes_of("hettich-quadro-v6"),
    "src": "H-TA23 bk_392,394,395", "verificat": False, "unreadable": a["unreadable"],
})

# --- GRASS Nova Pro (glisiera lui Nova Pro Scala)
a = SYS["grass-nova-pro-scala"]
need("MET = NL + 3")
runners.append({
    "key": "gr_nova_pro", "brand": "GRASS", "name": "Nova Pro Soft-close (S16/S19 și S18)", "kind": "side",
    "load": {"40": 40, "70": 70, "30": 30},
    "classes": {"40": sorted(int(k) for k in a["drilling"]["runner_rear_hole_mm_from_front_edge"]["40kg_S16/19/18"]),
                "70": sorted(int(k) for k in a["drilling"]["runner_rear_hole_mm_from_front_edge"]["70kg"])},
    "nl": a["nl"],
    "rear": 3, "rearRule": "MET = NL + 3 (cu sertar interior: NL + 12)", "rearInner": 12,
    "wood": {"ded_lat": None, "skl": None, "minBoxW": None, "derived": False, "note": "glisiera Nova Pro e pentru sistemul metalic Nova Pro Scala"},
    "holes": {"usable": False, "ref": "drawing", "rearPairs": a["drilling"]["runner_rear_hole_mm_from_front_edge"],
              "frontPair": [0, 32], "kv": [28, 37],
              "note": "perechea din spate citită din desenul MA110074 p.2; lanțul de cote pornește de la un reper la 37 sau 28 mm de KV: referința nu e în text"},
    "art": "F1011xxxxx", "codes": [c for c in codes_of("grass-nova-pro-scala") if "slide" in c["desc"]],
    "src": "G-NPS p31,33; G-MA110074 p.2", "verificat": False, "unreadable": a["unreadable"],
})

# --- GRASS Dynapro (ascunsă; pentru lemn și pentru Vionaro V8/V13)
a = SYS["grass-dynapro"]
need("LWS = (LWK - 42)", "NL - 10", "min LWS = 138")
runners.append({
    "key": "gr_dynapro", "brand": "GRASS", "name": "Dynapro Soft-close EB 21", "kind": "concealed",
    "load": {"30": 30, "40": 40, "50": 50, "60": 60, "70": 70},
    "classes": {k[:-2]: v for k, v in a["nl_by_class"].items() if isinstance(v, list)},
    "nl": a["nl"],
    "rear": 3, "rearRule": "MET = NL + 3 (sertar interior: NL + 21, min 12)",
    "wood": {"ded_lat": 42, "skl": 10, "minBoxW": 138, "derived": False, "maxSideTh": 16,
             "note": "LWS = (LWK − 42) +0/−1,5; SKL = NL − 10 ±0,5; LWS min 138 (2D/3D/4D); EB 21 = 21 mm pe lateral", "src": "G-DYN p13,15"},
    "holes": {"usable": False, "ref": "drawing",
              "positionSet": [0, 32, 128, 160, 192, 224, 256, 288, 352],
              "note": "setul de poziții e în text, atribuirea NL → găuri e numai pe desen"},
    "art": "F1301xxxxx", "codes": a["codes"] and [{k: c[k] for k in ("code", "desc", "src")} for c in a["codes"]],
    "src": "G-DYN p12,13,15,21", "verificat": False, "unreadable": a["unreadable"],
})

# --- Häfele Matrix Runner UM A / A50
a = SYS["hafele-matrix-runner-um"]
need("UM A: max drawer width", "Cabinet depth (min) = drawer length SL + 18")
runners.append({
    "key": "haf_matrix_um_a", "brand": "Häfele", "name": "Matrix Runner UM A 30 kg", "kind": "concealed",
    "load": {"30": 30}, "classes": {"30": [270, 300, 350, 400, 450, 500, 550]}, "nl": a["nl_by_variant"]["UM A 30kg (p226) SC and PTO"],
    "rear": 18, "rearRule": "adâncime min. corp = SL + 18",
    "wood": {"ded_lat": None, "skl": None, "minBoxW": None, "derived": False,
             "note": "formula din catalog («LW − 49 + 2 × grosimea laterală») nu e ne-ambiguă ca deducție: nefolosită (raw)"},
    "holes": {"usable": False, "ref": "drawing", "note": "mapare NL → găuri numai pe desen"},
    "art": "433.03.7xx", "codes": [c for c in codes_of("hafele-matrix-runner-um") if re.match(r"UM A( PTO)? NL|PTO \d|NL\d", c["desc"]) and c["code"].startswith("433.03.7")],
    "src": "HAF-UK23 p226,227", "verificat": False, "unreadable": a["unreadable"],
})
runners.append({
    "key": "haf_matrix_um_a50", "brand": "Häfele", "name": "Matrix Runner UM A50 50 kg", "kind": "concealed",
    "load": {"50": 50}, "classes": {"50": [450, 500, 550]}, "nl": a["nl_by_variant"]["UM A50"],
    "rear": 28, "rearRule": "adâncime min. corp 450→478, 500→528, 550→578 (= NL + 28)",
    "wood": {"ded_lat": None, "skl": None, "minBoxW": None, "derived": False, "note": "SB = LW − 42 + 2 × grosimea laterală: ambiguu, nefolosit"},
    "holes": {"usable": False, "ref": "drawing", "note": "mapare NL → găuri numai pe desen (0 32 128 224 320 416 480)"},
    "art": "433.03.57x", "codes": [c for c in codes_of("hafele-matrix-runner-um") if "A50" in c["desc"]],
    "src": "HAF-UK23 p227A,228", "verificat": False, "unreadable": a["unreadable"],
})

# --- Accuride 3832SC
a = SYS["accuride-3832sc"]
need("12.7 mm per side")
runners.append({
    "key": "acc_3832sc", "brand": "Accuride", "name": "Accuride 3832SC / 3832HDSC", "kind": "side",
    "load": {"3832SC": a["load_kg"]["3832SC"], "3832HDSC": a["load_kg"]["3832HDSC"]},
    "classes": {}, "nl": a["nl"],
    "rear": None, "rearRule": None,
    "wood": {"ded_lat": 25.4, "skl": None, "minBoxW": None, "derived": True, "maxSideTh": None,
             "note": "2 × 12,7 mm (spațiu lateral din fișă); `derived`: dată din raw, înmulțită cu 2"},
    "holes": {"usable": False, "ref": "unknown", "table": a["drilling"]["table_cols_SL_TR_A_B_C_D_E_F_mm"],
              "note": "tabelul A–F are ordinea coloanelor incertă (raw)"},
    "art": "3832-00xx", "codes": a["codes"],
    "src": "ACC-3832SC p1,2", "verificat": False, "unreadable": a["unreadable"],
})

# ====================================================================== CASE METALICE
boxes = []


def nl_by(sid, keys):
    return {k: SYS[sid]["nl_by_height"][k] for k in keys}


# --- AvanTech YOU (H77 exclus: înălțimea spatelui nu e în sursă)
a = SYS["hettich-avantech-you"]
need("NL - 21 (H101, H139, H187, H251)", "LB - 24")
rwh = a["deductions"]["back_panel_height_RWH"]
boxes.append({
    "key": "het_avantech", "brand": "Hettich", "name": "AvanTech YOU", "selectable": True, "why": [],
    "runner": "het_actro_you", "side": "het_avantech_zarga",
    "hs": {"101": 101, "139": 139, "187": 187, "251": 251},
    "hsExcl": {"77": "înălțimea spatelui nu e în sursă (raw: «not stated»)"},
    "backHs": {"101": rwh["H101"], "139": rwh["H139"], "187": rwh["H187"], "251": rwh["H251"]},
    "nlBy": nl_by("hettich-avantech-you", ["101", "139", "187", "251"]),
    "baseW": {"const": -24}, "backW": {"const": -24}, "baseL": {"const": -21},
    "rear": 3, "rearInner": 12, "rearInnerPTO": 21, "minBackW": None,
    "bottomTh": None, "thRef": None, "vis": {"sideTh": None, "src": None},
    "front": {"method": "screw", "alt": "knock", "jig": [{"name": "Practica 250", "code": "9219328"}],
              "adj": "height, side, tilt (integrated)", "stab": {"name": "Frontstabilisator", "code": "9123080", "note": "KB > 600 mm și/sau front > 450 mm"},
              "thinFront": {"code": "9268149", "minFront": 10}},
    "codes": [c for c in codes_of("hettich-avantech-you") if c["desc"].startswith("AvanTech YOU Zargenset")],
    "extra": [{"code": "9257702", "desc": "Stabilisator Rückwand (plastic) pentru spate din lemn/alu", "src": "H-TA23 bk_269"}],
    "src": "H-TA23 bk_256-265,269,279 (pag. tipărită 238-263)", "verificat": False, "unreadable": a["unreadable"],
})

# --- ArciTech (H78 doar NL 500; Frontauszug-urile nu sunt înălțimi de zargă)
a = SYS["hettich-arcitech"]
need("BB = LB - 2xEB - 52.5", "RB = LB - 2xEB - 64", "NL - 24.5", "15", "13", "12")
EB = {"16": 15, "18": 13, "19": 12}
nl_arc = [270, 300, 350, 400, 450, 500, 550, 650]
assert nl_arc == a["nl"]
boxes.append({
    "key": "het_arcitech", "brand": "Hettich", "name": "ArciTech", "selectable": True, "why": [],
    "runner": "het_actro_arcitech", "side": "het_arcitech_zarga",
    "hs": {"78": 78, "94": 94, "126": 126}, "hsExcl": {},
    "backHs": {"78": 68.5, "94": 84.5, "126": 116.5},
    "nlBy": {"78": [500], "94": nl_arc, "126": nl_arc},
    "baseW": {"byT": {t: -(2 * e + 52.5) for t, e in EB.items()}, "derived": True, "EB": EB},
    "backW": {"byT": {t: -(2 * e + 64) for t, e in EB.items()}, "derived": True, "EB": EB},
    "baseL": {"const": -24.5},
    "rear": 3, "rearInner": 12, "rearInnerPTO": 21, "minBackW": None,
    "bottomTh": None, "thRef": None, "vis": {"sideTh": None, "src": None},
    "front": {"method": "knock", "jig": [{"name": "Practica 200", "code": "9162018", "range": "Blendenauflage −5…+20 mm; înălțime front de la fața de jos a fundului până la +30 mm"}],
              "adj": None, "ptoGap": "2,5–5 mm"},
    "codes": [c for c in codes_of("hettich-arcitech") if c["desc"].startswith("ArciTech")],
    "src": "H-TA23 bk_296-301,326-327", "verificat": False, "unreadable": a["unreadable"],
})

# --- InnoTech Atira (numai catalog: nu are deducții pentru casă)
a = SYS["hettich-innotech-atira"]
boxes.append({
    "key": "het_atira", "brand": "Hettich", "name": "InnoTech Atira", "selectable": False,
    "why": ["BL/BB/RB pentru casă: nu sunt în sursă (raw: null)"],
    "runner": "het_quadro_v6", "side": "het_atira_zarga",
    "hs": {"54": 54, "70": 70}, "hsExcl": {}, "backHs": {}, "nlBy": {},
    "nlList": a["nl"], "baseW": None, "backW": None, "baseL": None,
    "rear": None, "rearPTO": a["cabinet"]["PTO_runner_depth_X_mm"], "minBackW": None,
    "bottomTh": None, "thRef": None, "vis": {"sideTh": None, "src": None},
    "front": {"method": None, "jig": [{"name": "Practica 200", "code": "9162018", "range": "Blendenauflage −6…+20 mm; înălțime de la fața de jos a fundului până la +35 mm"}]},
    "codes": codes_of("hettich-innotech-atira"),
    "src": "H-IMOS 4.1.3; H-MTA-IA-PTO p.2-3; H-TA23 bk_1109", "verificat": False, "unreadable": a["unreadable"],
})

# --- GRASS Nova Pro Scala
a = SYS["grass-nova-pro-scala"]
need("BB = LWK - 2 x EB", "NL - 19")
EBg = {"16": 29, "18": 30, "19": 29}
rwh = a["deductions"]["back_panel_height_RWH_mm"]
boxes.append({
    "key": "gr_nps", "brand": "GRASS", "name": "Nova Pro Scala", "selectable": True, "why": [],
    "runner": "gr_nova_pro", "side": "gr_nps_zarga",
    "hs": {"63": 63, "90": 90, "122": 122, "186": 186, "250": 250}, "hsExcl": {},
    "backHs": {k[1:]: v for k, v in rwh.items()},
    "nlBy": nl_by("grass-nova-pro-scala", ["63", "90", "122", "186", "250"]),
    "baseW": {"byT": {t: -2 * e for t, e in EBg.items()}, "derived": True, "EB": EBg},
    "backW": {"byT": {t: -2 * e for t, e in EBg.items()}, "derived": True, "EB": EBg, "same": "RWB = BB"},
    "baseL": {"const": -19},
    "rear": 3, "rearInner": 12, "minBackW": None,
    "bottomTh": 16, "thRef": 16, "vis": {"sideTh": None, "src": None},
    "front": {"method": "hook", "jig": [], "adj": "height ±2 mm, side, tilt (integrated)", "support": "front–bottom connector recomandat la KB ≥ 800 mm"},
    "note": "Nova Pro One (H90) = aceleași cote; cu spate de oțel: BL = NL − 13",
    "codes": [c for c in codes_of("grass-nova-pro-scala") if "Drawer sides" in c["desc"]],
    "src": "G-NPS p17,19,21,23,25; G-MA110074 p.1-2 (cote pentru plăci de 16 mm)", "verificat": False, "unreadable": a["unreadable"],
})

# --- Vionaro V8
a = SYS["grass-vionaro-v8"]
need("BB = LWK - 22", "RWB = LWK - 32", "16 mm wooden back panel: NL - 27")
rwh = a["deductions"]["back_panel_height_RWH"]
boxes.append({
    "key": "gr_v8", "brand": "GRASS", "name": "Vionaro V8", "selectable": True, "why": [],
    "runner": "gr_dynapro", "side": "gr_v8_zarga",
    "hs": {"72": 72, "89": 89, "121": 121, "200": 200, "250": 250}, "hsExcl": {},
    "backHs": {k[1:]: v for k, v in rwh.items()},
    "nlBy": nl_by("grass-vionaro-v8", ["72", "89", "121", "200", "250"]),
    "baseW": {"const": -22}, "backW": {"const": -32}, "baseL": {"const": -27, "alt": {"headline": -19, "steelBack": -11},
              "note": "NL − 19 e formula de titlu cu nota ** (spate din PAL de 16 mm: NL − 27, spate de oțel: NL − 11); aplicația are spate din PAL"},
    "rear": 3, "rearInner": 12, "minBackW": 148,
    "bottomTh": 16, "thRef": 16, "vis": {"sideTh": 8, "src": "G-V8 (sistem «8 mm slim»)"},
    "front": {"method": "lock", "jig": [], "adj": "4D (integrated)", "support": "front–bottom connector: KB 600–800 mm 1×, KB 800–1200 mm 2×"},
    "codes": [c for c in codes_of("grass-vionaro-v8")],
    "src": "G-V8 p15,17,19,21,23,41", "verificat": False, "unreadable": a["unreadable"],
})

# --- Vionaro V13 (H63 exclus: înălțimea spatelui nu e etichetată)
a = SYS["grass-vionaro-v13"]
need("BB = LWK - 21", "RWB = LWK - 42", "NL - 12")
rwh = a["deductions"]["back_panel_height_RWH"]
boxes.append({
    "key": "gr_v13", "brand": "GRASS", "name": "Vionaro V13", "selectable": True, "why": [],
    "runner": "gr_dynapro", "side": "gr_v13_zarga",
    "hs": {"89": 89, "121": 121, "185": 185, "249": 249},
    "hsExcl": {"63": "înălțimea spatelui nu e etichetată (raw: «H63 RWH not labelled»)"},
    "backHs": {"89": rwh["H89"], "121": rwh["H121"], "185": rwh["H185"], "249": rwh["H249"]},
    "nlBy": nl_by("grass-vionaro-v13", ["89", "121", "185", "249"]),
    "baseW": {"const": -21}, "backW": {"const": -42}, "baseL": {"const": -12},
    "rear": 3, "minBackW": 120,
    "bottomTh": 16, "thRef": 16, "vis": {"sideTh": 13, "src": "G-V13 (sistem «13 mm side»)"},
    "front": {"method": "lock", "jig": [], "adj": "4D (integrated)"},
    "codes": [c for c in codes_of("grass-vionaro-v13")],
    "src": "G-V13 p11,13,15,17,19", "verificat": False, "unreadable": a["unreadable"],
})

# ====================================================================== SETURI DE LATERALE (HWDB.zarga)
sides = []
for box in boxes:
    sides.append({"key": box["side"], "brand": box["brand"], "box": box["key"],
                  "name": box["name"] + " — laterale (set)", "art": pattern(box["codes"]) if box["codes"] else "—", "codes": box["codes"]})

# ====================================================================== note, conflicte
notes = list(RAW["notes"])
conflicts = [
    {"what": "Vionaro V8 BL", "text": "NL − 19 (titlu) cu nota ** «16-mm back panel: BL = NL − 27, steel back panel: BL = NL − 11»; se folosește NL − 27 (spate din PAL, ca în aplicație)"},
    {"what": "Dynapro/Actro 5D «LWS/SKW»", "text": "raw le numește «inner width», dar cu EB 21 = 21 mm pe lateral și aceeași formulă ca Blum (LW − 42) sunt lățimea EXTERIOARĂ a casei, ca la ded_lat 42"},
    {"what": "Găurire", "text": "nicio cotă de gaură nu are reperul ei în text/tabel (numai pe desen): nu se generează găuri, doar avertisment"},
    {"what": "Accuride rear", "text": "adâncimea minimă a corpului nu e în fișă (null): casa din lemn pe 3832SC nu se calculează"},
]

out = {"sources": RAW["sources"], "runners": runners, "boxes": boxes, "sides": sides, "notes": notes, "conflicts": conflicts}
dst = os.path.join(here, "drawers.json")
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("scris", os.path.relpath(dst), "-", len(runners), "glisiere,", len(boxes), "casete,", len(sides), "seturi de laterale")
