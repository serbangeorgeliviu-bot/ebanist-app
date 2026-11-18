#!/usr/bin/env python3
"""Ebanist U.16 — aduce datele brute ale mecanismelor de ridicare (raw/*.json, citite din documente oficiale)
într-o schemă comună: tools/lift-data/<marca>.json. Nu inventează nimic: ce lipsește în raw rămâne null.

    python3 tools/lift-data/normalize.py

Schema unui sistem:
  key, brand, name, motion (stay|swingup|parallel|liftup|bifold), flaps (1|2),
  select: { type: "LF" | "KHKG" | "springs", ... }
  limits: { cabH:[lo,hi], cabW:[lo,hi], kg:[lo,hi], hiMin, wiMin, depthMin }   (null = necitit)
  open:   { angle:[lo,hi] | null, note }
  mount:  { raw: ... valorile din desen, ca în sursă, cu marca "drawing" }       (numai pentru viitoarea găurire)
  src:    "S# pagina" · notes: [...]
Toate cotele rămân verificat:false până sunt confruntate cu produsul real.
"""
import json, re, os
here = os.path.dirname(os.path.abspath(__file__))
raw = lambda n: json.load(open(os.path.join(here, "raw", n), encoding="utf-8"))

def rng(s):
    """'4.4 - 5.8 kg *' -> (4.4, 5.8) sau None"""
    if not s: return None
    m = re.findall(r"\d+(?:\.\d+)?", str(s))
    return (float(m[0]), float(m[1])) if len(m) >= 2 else None

def hr(s):
    a, b = str(s).split("-"); return (int(a), int(b))

# ---------------------------------------------------------------- Blum
blum = raw("lift-blum.json")
B = {s["id"]: s for s in blum["systems"]}
def bsrc(i, k, d="cabinet"):  # sursă
    return "Blum " + str(B[i][d].get("src", ""))

blum_out = {"brand": "Blum", "sources": blum["sources"], "systems": []}

def LF(code, lo, hi, tipon=False, note=None):
    r = {"code": code, "lo": lo, "hi": hi, "tipon": tipon}
    if note: r["note"] = note
    return r

blum_out["systems"] += [
 {"key": "blum_hk_xs", "brand": "Blum", "name": "AVENTOS HK-XS", "motion": "stay", "flaps": 1,
  "select": {"type": "LF", "metric": "cabinet height (mm) × front weight incl. handle (kg)", "pairFactor": 2,
             "rows": [LF("20K1101", 200, 1000), LF("20K1301", 500, 1500), LF("20K1501", 800, 1800),
                      LF("20K1101T", 180, 800, True), LF("20K1301T", 500, 1200, True), LF("20K1501T", 800, 1600, True)],
             "note": "LF-ul din tabel e pe o parte; cu mecanism pe ambele laterale se dublează (S1 p2)."},
  "limits": {"cabH": [240, 600], "cabW": [None, None], "kg": [None, None], "hiMin": 200, "wiMin": None, "depthMin": 125},
  "open": {"angle": [105, 105], "note": "limitat de balamalele cu unghi mai mic (S1 p2)"},
  "hingesNote": "3 balamale de la lățime 900 mm sau LF 1800; 4 de la 1200 mm sau LF 2700 (S1 p4)",
  "mount": {"raw": B["hk-xs"]["mounting"], "bodyW": 27},
  "src": "Blum TD-071/6 (HK-XS), p2–5", "verificat": False},
 {"key": "blum_hk_s", "brand": "Blum", "name": "AVENTOS HK-S (TIP-ON)", "motion": "stay", "flaps": 1,
  "select": {"type": "LF", "metric": "cabinet height (mm) × front weight incl. handle (kg)", "pairFactor": 1,
             "rows": [LF("1× 20K2A01 + 1× 20K2C01T", 220, 500, True), LF("2× 20K2C01T", 400, 1000, True),
                      LF("1× 20K2C01T + 1× 20K2E01T", 680, 1520, True), LF("2× 20K2E01T", 960, 2215, True)],
             "note": "Numai combinațiile TIP-ON citite din fișă (TD-065/5). Codurile standard EU nu au putut fi citite: lipsesc, nu sunt inventate."},
  "limits": {"cabH": [150, 400], "cabW": [None, None], "kg": [None, None], "hiMin": 150, "wiMin": None, "depthMin": 163},
  "open": {"angle": [75, 107], "note": "107° fără opritor; opritoare de 100° și 75° (S2 p2–3)"},
  "mount": {"raw": B["hk-s"]["mounting"], "bodyW": 29},
  "notes": ["Fișa spune și «max 400 mm» (p2) și «max 600 mm» (p4): s-a păstrat 400, mai prudent."],
  "src": "Blum TD-065/5 (HK-S TIP-ON), p2–6", "verificat": False},
 {"key": "blum_hk_top", "brand": "Blum", "name": "AVENTOS HK top", "motion": "stay", "flaps": 1,
  "select": {"type": "LF", "metric": "cabinet height (mm) × front weight incl. handle (kg)", "pairFactor": 1,
             "rows": [LF("22K2310 / 22K2300 / 22K2300T", 420, 1610), LF("22K2510 / 22K2500 / 22K2500T", 930, 2800),
                      LF("22K2710 / 22K2700 / 22K2700T", 1730, 5200), LF("22K2910 / 22K2900 / 22K2900T", 3200, 9000)],
             "note": "Fiecare rând: șuruburi de sistem / șuruburi pentru PAL / varianta TIP-ON. Un al treilea mecanism crește LF cu 50% (S3 p2)."},
  "limits": {"cabH": [205, 600], "cabW": [None, 1800], "kg": [None, 18], "hiMin": 173, "wiMin": None, "depthMin": 187},
  "open": {"angle": [75, 107], "note": "reglabil continuu (S3 p2)"},
  "mount": {"raw": B["hk-top"]["mounting"], "bodyW": 30},
  "src": "Blum TD-157/1 (HK top), p2–8", "verificat": False},
 {"key": "blum_hf_top", "brand": "Blum", "name": "AVENTOS HF top", "motion": "bifold", "flaps": 2,
  "select": {"type": "LF", "metric": "cabinet height (mm) × front weight incl. handle (kg)", "pairFactor": 1,
             "rows": [LF("22F2510 / 22F2500", 2700, 13500), LF("22F2810 / 22F2800", 10000, 19300)],
             "extra": {"leverArms": [{"code": "22F3200", "khLo": 480, "khHi": 610, "hiMin": 443},
                                     {"code": "22F3500", "khLo": 600, "khHi": 910, "hiMin": 512},
                                     {"code": "22F3900", "khLo": 840, "khHi": 1200, "hiMin": 632}]},
             "note": "Brațul se alege după înălțimea corpului. La fronturi inegale: TKH = FHo×2 + rosturi (S4 p2,p6)."},
  "limits": {"cabH": [480, 1200], "cabW": [None, 1800], "kg": [None, None], "hiMin": 443, "wiMin": None, "depthMin": 264},
  "open": {"angle": [81, 116], "note": "opritor în trepte (S4 p2)"},
  "hingesNote": "3 balamale de la lățime 1200 mm sau 12 kg; 4 de la 1800 mm sau 20 kg (S4 p6)",
  "mount": {"raw": B["hf-top"]["mounting"], "bodyW": 30},
  "src": "Blum TD-154/1 (HF top), p2–10", "verificat": False},
 {"key": "blum_hl_top", "brand": "Blum", "name": "AVENTOS HL top", "motion": "parallel", "flaps": 1,
  "select": {"type": "KHKG", "metric": "înălțime corp (mm) și greutate front (kg)",
             "rows": [{"code": "22L3201", "khLo": 300, "khHi": 339, "kgLo": 1.5, "kgHi": 9.0},
                      {"code": "22L3501", "khLo": 340, "khHi": 389, "kgLo": 1.75, "kgHi": 10.0},
                      {"code": "22L3801", "khLo": 390, "khHi": 540, "kgLo": 2.0, "kgHi": 12.25},
                      {"code": "22L3901", "khLo": 480, "khHi": 580, "kgLo": 2.5, "kgHi": 14.0}],
             "note": "Mecanism pe înălțimi: 22L2201/2211 la 300–389, 22L2501/2511 la 390–580 (S5 p2). În zonele de suprapunere se ia cel mai puternic."},
  "limits": {"cabH": [300, 580], "cabW": [None, 1800], "kg": [1.5, 14.0], "hiMin": 255, "wiMin": None, "depthMin": 264},
  "open": {"angle": None, "note": "mișcare paralelă; unghiul e doar în desen"},
  "mount": {"raw": B["hl-top"]["mounting"], "bodyW": 30, "lever": B["hl-top"]["geometry"].get("lever_arm_a_b_c_Y_mm")},
  "notes": ["Peste lățime interioară 1190 mm (corp 1228 mm) se recomandă stabilizator transversal (S5 p3,p7)."],
  "src": "Blum TD-145/3 (HL top), p2–7", "verificat": False},
 {"key": "blum_hs_top", "brand": "Blum", "name": "AVENTOS HS top", "motion": "liftup", "flaps": 1,
  "select": {"type": "KHKG", "metric": "înălțime corp (mm) și greutate front (kg)",
             "rows": [{"code": "22S2211 / 22S2201", "khLo": 350, "khHi": 450, "kgLo": 2.0, "kgHi": 11.5},
                      {"code": "22S2211 / 22S2201", "khLo": 450, "khHi": 540, "kgLo": 2.5, "kgHi": 12.5},
                      {"code": "22S2511 / 22S2501", "khLo": 480, "khHi": 660, "kgLo": 2.75, "kgHi": 15.25},
                      {"code": "22S2811 / 22S2801", "khLo": 650, "khHi": 800, "kgLo": 3.5, "kgHi": 18.5}],
             "note": "Un al treilea mecanism crește greutatea cu 50% (S6 p2). În suprapuneri se ia cel mai puternic."},
  "limits": {"cabH": [350, 800], "cabW": [None, 1800], "kg": [2.0, 18.5], "hiMin": 307, "wiMin": None, "depthMin": 264},
  "open": {"angle": None, "note": "frontul se înclină în sus și în spate; unghiul e doar în desen"},
  "mount": {"raw": B["hs-top"]["mounting"], "bodyW": 30},
  "src": "Blum TD-144/4 (HS top), p2–6", "verificat": False},
]

# ---------------------------------------------------------------- Hettich
het = raw("lift-hettich.json")
H = {s["id"]: s for s in het["systems"]}

def springs_of(sysid):
    t = H[sysid]["selection"]["table"]["table_kg_by_inside_carcase_height_mm_and_spring_N"]
    out = []
    for N, e in sorted(t.items(), key=lambda kv: int(kv[0])):
        rs = []
        for hrange, kg in e["kg"].items():
            r = rng(kg)
            if r:
                lo, hi = hr(hrange)
                rs.append({"hLo": lo, "hHi": hi, "kgLo": r[0], "kgHi": r[1], "star": "*" in str(kg)})
        out.append({"code": e["code"], "N": int(N), "ranges": rs})
    return out

def sets_of(sysid):
    out = []
    for c in H[sysid]["codes"]:
        d = c["desc"].lower()
        if "fitting set" in d or "hk fitting" in d or re.search(r"\bset\b", d) and "spring" not in d and "cross" not in d and "adapter" not in d:
            m = re.search(r"(\d{3})\s*-\s*(\d{3})", c["range"] or "")
            if m: out.append({"code": c["code"], "hLo": int(m.group(1)), "hHi": int(m.group(2))})
    return out

def hsys(key, hid, name, motion, flaps, open_deg, note=None, notes=None):
    L = H[hid]["selection"]["limits"]
    s = {"key": key, "brand": "Hettich", "name": name, "motion": motion, "flaps": flaps,
         "select": {"type": "springs", "metric": "înălțime interioară corp (mm) și greutate front cu mâner (kg)",
                    "sets": sets_of(hid), "springs": springs_of(hid),
                    "note": "Setul după înălțimea interioară; perechea de arcuri după înălțime și greutate exactă; dacă două arcuri se potrivesc, se ia cel mai puternic."},
         "limits": {"cabH": L["inside_carcase_height_mm"], "cabW": [L.get("inside_carcase_width_min_mm"), None],
                    "kg": L.get("flap_weight_kg_incl_handle"), "hiMin": L["inside_carcase_height_mm"][0],
                    "wiMin": L.get("inside_carcase_width_min_mm"), "depthMin": L.get("inside_carcase_depth_min_mm")},
         "open": {"angle": open_deg, "note": note},
         "mount": {"raw": H[hid]["mounting"], "geometry": H[hid]["geometry"]},
         "src": "Hettich " + str(H[hid]["selection"]["table"].get("src", "")), "verificat": False}
    if notes: s["notes"] = notes
    return s

het_out = {"brand": "Hettich", "sources": het["sources"], "systems": [
 hsys("het_la_hf", "lift-advanced-hf", "Lift Advanced HF", "bifold", 2, None,
      "bi-fold; balamale cu unghi ≥110° pentru clapa de sus, la cel puțin 90 mm de interiorul laterală"),
 hsys("het_la_hk", "lift-advanced-hk", "Lift Advanced HK", "swingup", 1, [0, 85],
      "deschidere maximă 85°"),
 hsys("het_la_hl", "lift-advanced-hl", "Lift Advanced HL", "parallel", 1, None, "mișcare paralelă"),
 hsys("het_la_hs", "lift-advanced-hs", "Lift Advanced HS", "liftup", 1, [0, 40], "înclinare ~40°, clapa rămâne deasupra corpului"),
]}
for s in het_out["systems"]:
    s["notes"] = (s.get("notes") or []) + ["Prinderea în corp: găuri Ø5×12; poziția exactă (reperul cotelor) nu e confirmată în sursă."]


# ---------------------------------------------------------------- Blum SERVO-DRIVE (electrical motion support)
srv = raw("lift-blum-servo.json")
SV = {a["system"].split()[1] + " " + a["system"].split()[2]: a for a in srv["servo"]["aventos"] if "top" in a["system"] and "classic" not in a["system"]}
def servo(key, desc, drv, depth, bodyW, cap, hole, src, wall=None):
    return {"key": key, "servo": {"depthMin": depth, "depthMinWallBracket": wall, "bodyW": bodyW, "drv": drv,
            "codes": {"drive": desc, "cap": cap, "switch": "23P5020", "psu": "Z10NE04xx (72 W, 24 V DC, 3,0 A)"},
            "cableHole": hole, "unitsPerSupply": 16, "src": src}}
SERVO = [
 servo("blum_hk_top", "23KA000", "blum_servo_hk", 235, 67, "23K8000", {"dia": 10, "x": 38.5, "y": 82}, "Blum TD-157/1 (HK top), SERVO-DRIVE", wall=261),
 servo("blum_hf_top", "23.A000", "blum_servo_hf", 264, 66, "23.8000", {"dia": 10, "x": 38.5, "yByKH": [[480, 519, 102], [520, 1200, 124]]}, "Blum TD-154/1 (HF top), SERVO-DRIVE"),
 servo("blum_hl_top", "23.A001", "blum_servo_unit", 264, 66, "23.8001", {"dia": 10, "x": 38.5, "y": 71}, "Blum TD-145/3 (HL top), SERVO-DRIVE"),
 servo("blum_hs_top", "23.A001", "blum_servo_unit", 264, 66, "23.8001", {"dia": 10, "x": 38.5, "y": 45}, "Blum TD-144/4 (HS top), SERVO-DRIVE"),
]
for sv in SERVO:
    for sysd in blum_out["systems"]:
        if sysd["key"] == sv["key"]:
            sysd["servo"] = sv["servo"]
            sysd.setdefault("notes", []).append("SERVO-DRIVE: aceleași seturi și intervale de greutate ca la AVENTOS standard; se schimbă lățimea mecanismului (30 → 66/67 mm) și, la HK top, adâncimea minimă (187 → 235 mm). 16 unități AVENTOS pe alimentator = calcul 50/3 (Blum dă 50 de unități, una AVENTOS = 3), nu cifră tipărită.")

for name, o in (("blum", blum_out), ("hettich", het_out)):
    json.dump(o, open(os.path.join(here, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(name, [s["key"] for s in o["systems"]])

# ---------------------------------------------------------------- Häfele
haf = raw("lift-hafele.json")
F = {s["id"]: s for s in haf["systems"]}

def rng_conservative(s):
    """'1.9-3.7 (BRO) / 1.8-3.7 (UK)' -> (max lo, min hi): cea mai îngustă dintre sursele care se contrazic"""
    pairs = re.findall(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)", str(s or ""))
    if not pairs: return None
    los = [float(a) for a, b in pairs]; his = [float(b) for a, b in pairs]
    return (max(los), min(his))

def grid_models(tbl_cols, rows, codes):
    """tabel pe înălțime: rows = [[h, "lo-hi", ...]] cu coloanele de modele -> [{id, code, points:[[h, lo, hi]]}]"""
    models = []
    for ci, col in enumerate(tbl_cols):
        pts = []
        for r in rows:
            rg = rng_conservative(r[ci + 1]) if ci + 1 < len(r) else None
            if rg: pts.append([float(r[0]), rg[0], rg[1]])
        if pts: models.append({"id": col, "code": codes.get(col), "points": pts})
    return models

def grid_sys(key, fid, name, motion, flaps, axis, models, limits, openDeg, notes, srcnote):
    return {"key": key, "brand": "Häfele", "name": name, "motion": motion, "flaps": flaps,
            "select": {"type": "GRID", "axis": axis, "overlap": "center", "metric": "înălțime (mm) și greutate front cu mâner (kg), din tabelul producătorului",
                       "models": models,
                       "note": "Între rândurile tabelului se ia intervalul cel mai îngust al celor două rânduri vecine (nu se interpolează)."},
            "limits": limits, "open": openDeg, "mount": {"raw": F[fid].get("mounting")},
            "notes": notes, "src": "Häfele " + srcnote, "verificat": False}

ff = F["free_flap"]["selection"]["table"]
cod = lambda desc_re: {}
codes_flap = {"A": "372.91.320 / .720 / .370", "B": "372.91.321 / .721 / .371", "C": "372.91.322 / .722 / .372",
              "D": "372.91.330 / .730 / .380", "E": "372.91.331 / .731 / .381", "F": "372.91.332 / .732 / .382", "G": "372.91.333 / .733 / .383"}
t17 = ff["free_flap_1_7_kg_by_flap_height_mm"]; t315 = ff["free_flap_3_15_kg_by_flap_height_mm"]
codes_swing = {"S1": "372.34.500 / .700 / .300", "S2": "372.34.510 / .710 / .303", "S3": "372.34.520 / .720 / .306",
               "S4": "372.34.501 / .701 / .301", "S5": "372.34.511 / .711 / .304", "S6": "372.34.521 / .721 / .307",
               "S7": "372.34.502 / .702 / .302", "S8": "372.34.512 / .712 / .305", "S9": "372.34.522 / .722 / .308"}
sw = F["free_swing"]["selection"]["table"]
sw_models = []
for band in sw.values():
    sw_models += grid_models(band["columns"][1:], band["rows"], codes_swing)
fs = F["free_space"]["selection"]["table"]
codes_space = {"B": "372.27.7x0 / .5x0 / .35x / .30x (sursele nu se pun de acord: HTH 2022 listează 493.05.5xx)"}

def kg_bands(table, label_fn, depth, cabH, cabW=None, kg=None):
    rows = []
    for r in table["rows"]:
        d = dict(zip(table["columns"], r))
        khs = d.get("cabinet_height_KH_mm") or d.get("KH_mm")
        lo, hi = hr(khs)
        rg = rng_conservative(d["front_weight_kg"])
        if rg:
            rows.append({"code": label_fn(d), "khLo": lo, "khHi": hi, "kgLo": rg[0], "kgHi": rg[1]})
    return rows

fold_t = F["free_fold"]["selection"]["table"]
up_t = F["free_up"]["selection"]["table"]

haf_out = {"brand": "Häfele", "sources": haf["sources"], "systems": [
 grid_sys("haf_free_flap_17", "free_flap", "Free flap 1.7", "stay", 1, "flapH",
          grid_models(t17["columns"][1:], t17["rows"], codes_flap),
          {"cabH": [200, 450], "cabW": [None, None], "kg": [None, 14.7], "hiMin": None, "wiMin": None, "depthMin": 109},
          {"angle": [0, 107], "note": "107°; opritor 90° (372.91.499)"},
          ["Tabelul e pe înălțimea clapei (200–450 mm). Greutatea maximă a fronturilor cu push-to-open: vezi sursa (lățime ≤ 1200 mm)."],
          "catalog UK 9.204 + broșura «Free»"),
 grid_sys("haf_free_flap_315", "free_flap", "Free flap 3.15", "stay", 1, "flapH",
          grid_models(t315["columns"][1:], t315["rows"], codes_flap),
          {"cabH": [350, 650], "cabW": [None, None], "kg": [None, 27.3], "hiMin": None, "wiMin": None, "depthMin": 131},
          {"angle": [0, 107], "note": "107°"},
          ["Tabelul e pe înălțimea clapei (350–650 mm)."], "catalog UK 9.206 + broșura «Free»"),
 grid_sys("haf_free_swing", "free_swing", "Free swing", "liftup", 1, "kh",
          sw_models,
          {"cabH": [370, 800], "cabW": [None, None], "kg": [None, 17.1], "hiMin": None, "wiMin": None, "depthMin": 273},
          {"angle": None, "note": "frontul basculează în sus și în spate; unghiul nu e dat numeric"},
          ["Două seturi la fronturi de 1800 mm sau mai late; bară transversală ca la Free up (tăiată la lățimea interioară − 88 mm).",
           "Surse în conflict: depășirea peste partea de sus a corpului «≤40» (broșură) sau «≥40» (catalog UK)."],
          "broșura «Free» p30–33, catalog UK 9.218"),
 grid_sys("haf_free_space", "free_space", "Free space 1.11", "stay", 1, "kh",
          grid_models(fs["columns"][1:], fs["rows"], codes_space),
          {"cabH": [225, 650], "cabW": [None, None], "kg": [None, 19.1], "hiMin": 173, "wiMin": None, "depthMin": 63},
          {"angle": [90, 107], "note": "90° sau 107°"},
          ["Codurile diferă între surse (372.27.xxx vs 493.05.5xx): nu s-a ales unul."], "HTH 2022 p3.7, FSMI"),
 {"key": "haf_free_fold", "brand": "Häfele", "name": "Free fold", "motion": "bifold", "flaps": 2,
  "select": {"type": "KHKG", "overlap": "center", "metric": "înălțime corp KH (mm) și greutate front în două piese (kg)",
             "rows": kg_bands(fold_t, lambda d: "%s %s (gri) / %s (alb) / %s (antracit)" % (d["model"], d["grey"], d["white"], d["anthracite"]), None, None),
             "note": "Fronturile sunt în două piese egale (1:1). Greutatea maximă din tabel 20,9 kg; textul broșurii spune 12,3 kg pentru fronturi înalte (surse în conflict)."},
  "limits": {"cabH": [480, 1040], "cabW": [None, None], "kg": [None, 20.9], "hiMin": None, "wiMin": None, "depthMin": 288},
  "open": {"angle": None, "note": "tabel de geometrie deschisă în sursă (unghi, T, U, V, W)"},
  "mount": {"raw": F["free_fold"].get("mounting")},
  "notes": ["Cod pe piață: seria 372.37 (broșură, HTH) sau 372.38 (catalog UK, alte intervale de greutate): se alege seria pieței țintă.",
            "Adâncime minimă 288 mm (broșură, HTH) sau «>270» (desen UK)."],
  "src": "Häfele broșura «Free» p22–25, HTH 2022, catalog UK 9.2xx", "verificat": False},
 {"key": "haf_free_up", "brand": "Häfele", "name": "Free up", "motion": "parallel", "flaps": 1,
  "select": {"type": "KHKG", "overlap": "center", "metric": "înălțime corp KH (mm) și greutate front (kg)",
             "rows": kg_bands(up_t, lambda d: "%s %s (gri) / %s (alb) / %s (antracit)" % (d["model"], d["grey"], d["white"], d["anthracite"]), None, None),
             "note": "Fața trebuie să aibă cel puțin înălțimea LH a intervalului (280/308/343/388 mm). Cu bară transversală după lățimea interioară."},
  "limits": {"cabH": [320, 600], "cabW": [None, None], "kg": [None, 19.6], "hiMin": None, "wiMin": None, "depthMin": 277},
  "open": {"angle": None, "note": "mișcare paralelă"},
  "mount": {"raw": F["free_up"].get("mounting")},
  "notes": ["Surse în conflict la unele cote de geometrie (T, V1) pe intervalul 430–600 mm."],
  "src": "Häfele broșura «Free» p26–29, HTH 2022, catalog UK 9.216", "verificat": False},
]}
json.dump(haf_out, open(os.path.join(here, "hafele.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("hafele", [s["key"] for s in haf_out["systems"]])

# ---------------------------------------------------------------- Häfele Free Slim (din cat-motion.json)
mot = raw("cat-motion.json")
MP = {x["id"]: x for x in mot["products"]}
def slim(pid, key, name, codes_text):
    v = MP[pid]["variants"][0]
    txt = v["dims"]["flap_weight_kg_by_height"]
    pts = []
    for h, lo, hi in re.findall(r"(\d{3})\s*(?:mm)?\s*(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)", txt):
        pts.append([float(h), float(lo), float(hi)])
    assert len(pts) == 18, (pid, len(pts))
    return grid_sys(key, "free_flap", name, "stay", 1, "kh",
                    [{"id": v["id"], "code": codes_text, "points": pts}],
                    {"cabH": [225, 650], "cabW": [None, 1800], "kg": [None, v["load_kg"]], "hiMin": None, "wiMin": None, "depthMin": 245},
                    {"angle": [0, 107], "note": "90° sau 107°"},
                    ["Tabelul e pe înălțimea corpului (225–650 mm), pe setul de 2 fitinguri; cu al treilea fiting +50%.",
                     "Cele «8 mm» din reclama Häfele sunt lățimea de montaj în canal (fișa UK 9.197C): sursele folosesc și «adâncime».",
                     "Găurirea nu e tipărită în fișa UK: lipsește, nu e inventată."],
                    "catalog UK 9.197C/D")
haf_out["systems"] += [
    slim("haefele-free-slim-flap-1.12", "haf_free_slim_112", "Free Slim 1.12",
         "372.92.700 / .500 / .360 / .300 (șuruburi); .701/.501/.361/.301 (dibluri Ø10); .702/.502/.362/.302 (în canal)"),
    slim("haefele-free-slim-flap-1.10-push", "haf_free_slim_110p", "Free Slim 1.10 push",
         "372.92.704 / .504 / .364 / .304 (șuruburi); .705/.505/.365/.305 (dibluri Ø10); .706/.506/.366/.306 (în canal)"),
]
json.dump(haf_out, open(os.path.join(here, "hafele.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("hafele+slim", len(haf_out["systems"]))
