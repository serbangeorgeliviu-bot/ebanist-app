#!/usr/bin/env python3
"""Ebanist — familia «deschidere push / suspendare / îmbinări fără unealtă»: aduce datele brute
(tools/hw-data/raw/cat-opening.json, cat-susp.json — citite din documente oficiale, fiecare număr cu sursă)
în app/ebanist-open-data.js.

    python3 tools/hw-data/open/normalize.py          scrie app/ebanist-open-data.js
    python3 tools/hw-data/open/normalize.py --check  numai verifică (cod 1 dacă fișierul generat nu e la zi)

REGULĂ: niciun număr din memorie. Fiecare literal numeric de mai jos e însoțit de `T("…")`: un fragment din JSON-ul brut care
trebuie să existe acolo (scriptul pică dacă nu). Ce sursa nu dă rămâne null. Toate cotele de găurire: verificat:false (D-48).
Schema unui articol:
  id, brand, model, ph (cheia frazei din ebanist-open-i18n.js), art, src, lim{...}, drill{...}|null, per, aux
"""
import json, os, sys, re

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, "..", "..", ".."))
RAWDIR = os.path.join(root, "tools", "hw-data", "raw")
OUT = os.path.join(root, "app", "ebanist-open-data.js")
OP = json.load(open(os.path.join(RAWDIR, "cat-opening.json"), encoding="utf-8"))
SU = json.load(open(os.path.join(RAWDIR, "cat-susp.json"), encoding="utf-8"))
RAWTXT = json.dumps(OP, ensure_ascii=False) + json.dumps(SU, ensure_ascii=False)
RAWTXT2 = RAWTXT.replace(", ", ",").replace(": ", ":")
problems = []

def T(*frags):
    """fiecare fragment trebuie să apară în JSON-ul brut (numai spații și ghilimele normalizate)"""
    for f in frags:
        if f not in RAWTXT and f not in RAWTXT2:
            problems.append("fragment lipsă în raw: " + f)
    return True

OPI = {i["id"]: i for i in OP["items"]}
SUS = {i["id"]: i for i in SU["suspension"]}
CON = {i["id"]: i for i in SU["connectors"]}

def N(x):
    """primul număr dintr-un text ('12.7 +0.2' -> 12.7)"""
    return float(re.findall(r"\d+(?:\.\d+)?", str(x))[0])

def clean(o):
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(v) for v in o]
    return o

# =====================================================================================================================
# PUSH — uși (HWDB.push). `lim`: kg=[lo,hi] greutatea ușii, h=[lo,hi] înălțimea ușii, w=[lo,hi] lățimea ușii, gap=min rost,
# `per` = număr pe ușă (1 sau [[de_la_înălțimea,n],…]).  `door:"lift"` = numai pe ușă basculantă (lista `lifts`).
# =====================================================================================================================
push = []
def P(**k):
    k.setdefault("brand", "Blum"); k.setdefault("per", 1); k.setdefault("verificat", False); push.append(k)

# --- Blum TIP-ON pentru uși (broșura EP-234/4 p.10,11,13; catalog 2024 p.676)
T('overlay doors up to approx 1300 mm high, output path approx 17 mm, Ø10 x 50 hole',
  'overlay doors from approx 1300 mm high or inset doors, output path approx 38 mm, Ø10 x 76',
  'for sprung hinges, no catch plate, output approx 38 mm, Ø10 x 76 (trial application recommended)',
  '"short_and_long_glue_on_catch_plate":2.6', '"short_and_long_screw_on_catch_plate":3.1', '"bumper_version":3.2',
  '"hole_dia_mm":10', '"short":"min 50"', '"long_and_bumper":"min 76"', '"hole_centre_from_cabinet_inner_side_mm":7.5',
  '"edge_distance_min_mm":1.5')
P(id="blum_tipon_short", model="TIP-ON", ph="door_short", art="956.1004", src="BLUM-TIPON-DOORS p10,11; BLUM-CAT24 p14,52,676",
  lim={"h": [None, 1300], "kg": None, "gapMin": 2.6, "gapMinScrew": 3.1, "stroke": 17, "adj": [-1.0, 4.0]},
  note="tipon", drill={"dia": 10, "depth": 50, "fromInner": 7.5, "edgeMin": 1.5, "ref": "inner"})
P(id="blum_tipon_a", model="TIP-ON", ph="door_long", art="956A1004 + 956A1501", src="BLUM-TIPON-DOORS p10,11; BLUM-CAT24 p14,676", existing=True,
  lim={"h": [1300, None], "kg": None, "gapMin": 2.6, "gapMinScrew": 3.1, "stroke": 38, "adj": [-1.0, 4.0]},
  note="tipon", drill={"dia": 10, "depth": 76, "fromInner": 7.5, "edgeMin": 1.5, "ref": "inner"})
P(id="blum_tipon_bumper", model="TIP-ON", ph="door_bumper", art="956A1006", src="BLUM-TIPON-DOORS p10,11; BLUM-CAT24 p102,676",
  lim={"h": None, "kg": None, "gapMin": 3.2, "stroke": 38, "adj": [-1.0, 4.0]}, sprung=True,
  note="bumper", drill={"dia": 10, "depth": 76, "fromInner": 7.5, "edgeMin": 1.5, "ref": "inner"})

# --- Blum TIP-ON pentru AVENTOS (catalog 2024 p10,14,16,50,51,52): numai HK top / HK-S / HK-XS (HF/HL/HS: numai SERVO-DRIVE)
T('"max_front_weight_kg":"18 kg for two lift mechanisms (HKi and HK top TIP-ON sets)"', '"min_gap_MF_mm":2',
  'HK top: KH 205-600 mm; HKi: KH max 600; TIP-ON 956.1004 for stay lifts up to 600 mm height',
  '"cabinet_width_mm":"up to 1800"', '"output_path_mm":17')
P(id="blum_tipon_aventos", model="TIP-ON", ph="aventos", art="956.1004 + 22K2310T…", src="BLUM-CAT24 p10,14,16,50,51,52,676",
  lim={"kg": [None, 18], "kh": [205, 600], "cabW": [None, 1800], "gapMin": 2, "stroke": 17}, lifts=["blum_hk_top", "blum_hk_s", "blum_hk_xs"],
  note="aventos", drill=None)

# --- Hettich Push to open Silent pentru uși cu balamale (bk_111, MTA 9 077 363 02, 309095): baterie 4 x AA, release 1.4 mm
T('"release_stroke_mm":1.4', '"stroke_length_mm":45', '"adjustment_mm":"+4 / -2"',
  '"door_weight_height_width":"max 17.1 kg for H<=2200 (W 200-600); <=22 kg for H<=2400 (W 400-600); <=22 kg for H<=2800 (W 500-600)',
  '"powered":"4 x LR6 (AA) batteries (included)"', '"9239087"')
P(id="het_pto_silent_9239087", brand="Hettich", model="Push to open Silent", ph="hinged", art="9239087 / 9239088 / 9239099", src="HET-BK111 p1; HET-ANZ p1; HET-MTA-PTOS p1",
  lim={"stroke": 1.4, "adj": [-2, 4], "sizes": [{"hMax": 2200, "wLo": 200, "wHi": 600, "kg": 17.1}, {"hMax": 2400, "wLo": 400, "wHi": 600, "kg": 22},
                                                  {"hMax": 2800, "wLo": 500, "wHi": 600, "kg": 22}]},
  battery="4 x AA", dims=[155, 60, 32] if T("155 x 60 x 32") else None, dimsKey="LWH", note="battery", drill=None)

# --- Hettich Push to open Magnet / Lock (MTA 9 393 364 01, eShop)
T('"opening_movement_mm":1.4', '"adjustment_mm":6', '"min_gap_P_mm":">=1.4 (drawing)"', '"9375985"', '"9375982"', '"9375969"', '"9381335"', '"9381496"')
P(id="het_pto_magnet_9375985", brand="Hettich", model="Push to open Magnet", ph="magnet_long", art="9375985", src="HET-SHOP 9375985; HET-MTA-PTO p1",
  lim={"stroke": 1.4, "gapMin": 1.4, "adj": [None, 6]}, note="magnet", drill=None, unsprung=True)
P(id="het_pto_magnet_9375982", brand="Hettich", model="Push to open Magnet", ph="magnet_short", art="9375982", src="HET-SHOP search; HET-MTA-PTO p1",
  lim={"stroke": 1.4, "gapMin": 1.4, "adj": [None, 6]}, note="magnet", drill=None, unsprung=True)
P(id="het_pto_magnet_9375969", brand="Hettich", model="Push to open Magnet", ph="magnet_screw", art="9375969", src="HET-SHOP search; HET-MTA-PTO p1",
  lim={"stroke": 1.4, "gapMin": 1.4, "adj": [None, 6]}, note="magnet", drill=None, unsprung=True)
P(id="het_pto_lock_9381335", brand="Hettich", model="Push to open Lock", ph="lock_drill", art="9381335", src="HET-SHOP 9381335; HET-MTA-PTO p1",
  lim={"gapMin": 1.4}, note="lock", drill=None)
P(id="het_pto_lock_9381496", brand="Hettich", model="Push to open Lock", ph="lock_screw", art="9381496", src="HET-SHOP 9381496; HET-MTA-PTO p1",
  lim={"gapMin": 1.4}, note="lock", drill=None)

# --- Häfele push soft close 315.11 (HAF-124): mecanic, pentru balamale fără arc de închidere
T('"315.11.400":7.5', '"315.11.401":20', '"315.11.411":25', '"315.11.400":700', '"315.11.401":2700', '"315.11.411":2700',
  '"door_width_max_mm":600', '"opening_angle_max_deg":110')
for code, kg, hmax in (("400", 7.5, 700), ("401", 20, 2700), ("411", 25, 2700)):
    P(id="haf_pushsoft_315_11_" + code, brand="Häfele", model="Push to open soft close", ph="soft", art="315.11." + code, src="HAF-124 p1",
      lim={"kg": [None, kg], "h": [None, hmax], "w": [None, 600], "angleMax": 110}, dims=[202, 18, 72] if T("202 x 18 x 72") else None, dimsKey="WDH", unsprung=True, note="mech", drill=None)

# --- Häfele/Grass Tipmatic (HAF-78, GRASS-18 p6): știft Ø10 × min 60, 10+F de la fața interioară (F = rostul)
T('"front_gap_adjust_mm":"2.5-5.5"', '"pin_hole_dia_mm":10', '"pin_hole_depth_min_mm":60', '"356.03.520"', '"68873-06"',
  '"pin_hole_tolerance":"+0.2/-0.1 (drawing)"')
P(id="haf_tipmatic_356_03_520", brand="Häfele", model="Tipmatic", ph="pin", art="356.03.520", src="HAF-78 p1-2 (drawing, approximate); GRASS-18 p6",
  lim={"gapMin": 2.5, "gapMax": 5.5}, note="pin", drill={"dia": 10, "depth": 60, "fromInner": "10+F", "ref": "inner"})
P(id="grass_tipmatic_68873", brand="Grass", model="Tipmatic", ph="pin", art="68873-06", src="GRASS-09 p14,15; GRASS-18 p4,6",
  lim={"gapMin": 2.5, "gapMax": 5.5}, note="pin", drill={"dia": 10, "depth": 60, "fromInner": "10+F", "ref": "inner"})

# --- Häfele prinderi magnetice și de presiune
T('"356.06.460"', '"356.06.471"', 'additional catch for door fronts >1200 mm or >=3 push hinges', '"245.50.301"', '"245.50.310"')
P(id="haf_pushcatch_356_06_460", brand="Häfele", model="Maxi Touch", ph="catch", art="356.06.460", src="HAF-241 p1",
  lim={"extraCatchH": 1200}, note="catch", drill=None)
P(id="haf_pressure_245_50_301", brand="Häfele", model="Pressure catch", ph="pressure", art="245.50.301", src="HAF-154 p1", lim={"pullKg": 4}, note="catch", drill=None)
P(id="haf_pressure_245_50_310", brand="Häfele", model="Compact catch", ph="pressure", art="245.50.310", src="HAF-154 p1", lim={"pullKg": 3}, note="catch", drill=None)

# --- Salice PUSH mecanic și Magnetic Push (SAL-MECH, SAL-PUSH, SAL-MAG): peste 1600 mm, două dispozitive
T('doors over 1600 mm high: use two mechanical release catches', '"DP4SNB/G"', '"DPMSNB/G"',
  '"magnetic_push_depth_adjust_mm":"-0.5 to +2.5"')
P(id="sal_push_dp4", brand="Salice", model="PUSH", ph="mech_adapter", art="DP4SNB/G", src="SAL-MECH p1-3; SAL-PUSH p9",
  lim={"adj": [-1, 2.5]}, per=[[0, 1], [1600.01, 2]], note="mech", drill=None)
P(id="sal_mpush_dpm", brand="Salice", model="Magnetic Push", ph="magnetic", art="DPMSNB/G", src="SAL-AIR p28; SAL-MAG p1",
  lim={"adj": [-0.5, 2.5]}, per=[[0, 1], [1600.01, 2]], note="magnet", drill=None)

# =====================================================================================================================
# PUSHD — sertare (HWDB.pushd). `sys` = sistemele de sertar pe care merge; `nl`=[lo,hi] pe sistem; `kg`=[lo,hi] (greutatea recomandată a sertarului)
# =====================================================================================================================
pushd = []
def D(**k):
    k.setdefault("brand", "Blum"); k.setdefault("per", 1); k.setdefault("verificat", False); pushd.append(k)

T('<=10 kg, NL 270-300 (LEGRABOX/MERIVOBOX/TANDEMBOX) / 270-320 (MOVENTO)', '"S1":">10-20 kg same NL"',
  '<=20 kg, NL 350-600, 40 kg (30 kg TANDEMBOX) profile only', '15-40 kg (15-30 TANDEMBOX), NL 350-600, 40 kg profile only',
  '35-70 kg (LEGRABOX/MERIVOBOX/MOVENTO), >30-65 kg TANDEMBOX; NL 450-650 (LEGRABOX), 450-600 (MERIVOBOX), 450-650 (TANDEMBOX), 450-750 (MOVENTO set)',
  '"LEGRABOX":294', '"MERIVOBOX":297', '"TANDEMBOX":287', '"MOVENTO":314', '"front_gap_FS_min_mm":2.5',
  '"T60L7040"', '"T60L7140"', '"T60L7340"', '"T60L7540"', '"T60L7570"', '"T60H4040/4140/4340/4540/4570"', '"T60B3030/3130/3330/3530/3560"')
# (clasă, kg-lo, kg-hi, NL pe sistem, cod LEGRABOX/MOVENTO, cod MERIVOBOX, cod TANDEMBOX)
CL = {
    "S0": ((None, 10), {"lbx": [270, 300], "mov": [270, 320], "mer": [270, 300], "tb": [270, 300]}, "T60L7040", "T60H4040", "T60B3030"),
    "S1": ((10, 20), {"lbx": [270, 300], "mov": [270, 320], "mer": [270, 300], "tb": [270, 300]}, "T60L7140", "T60H4140", "T60B3130"),
    "L1": ((None, 20), {"lbx": [350, 600], "mov": [350, 600], "mer": [350, 600], "tb": [350, 600]}, "T60L7340", "T60H4340", "T60B3330"),
    "L3": ((15, 40), {"lbx": [350, 600], "mov": [350, 600], "mer": [350, 600], "tb": [350, 600]}, "T60L7540", "T60H4540", "T60B3530"),
    "L5": ((35, 70), {"lbx": [450, 650], "mov": [450, 750], "mer": [450, 600], "tb": [450, 650]}, "T60L7570", "T60H4570", "T60B3560"),
}
TBKG = {"L1": (None, 20), "L3": (15, 30), "L5": (30, 65)}      # TANDEMBOX: L1 ≤ 20 (profil 30 kg), L3 15–30, L5 >30–65
for cl, (kg, nls, c_lbx, c_mer, c_tb) in CL.items():
    D(id="blum_tobm_lbx_" + cl.lower(), model="TIP-ON BLUMOTION", ph="cls_" + cl, sysname="LEGRABOX / MOVENTO", art=c_lbx, src="BLUM-CAT24 p396,398,400,504; BLUM-TOB p24-25",
      lim={"kg": list(kg), "nl": nls["lbx"], "lwMin": 294}, sys=["legrabox", "movento"], sysNl={"legrabox": nls["lbx"], "movento": nls["mov"]}, sysLw={"legrabox": 294, "movento": 314},
      gapMin=2.5, unit=cl, note="tipon", drill=None)
    D(id="blum_tobm_mer_" + cl.lower(), model="TIP-ON BLUMOTION", ph="cls_" + cl, sysname="MERIVOBOX", art=c_mer, src="BLUM-CAT24 p398",
      lim={"kg": list(kg), "nl": nls["mer"], "lwMin": 297}, sys=["merivobox"], sysNl={"merivobox": nls["mer"]}, sysLw={"merivobox": 297},
      gapMin=2.5, unit=cl, note="tipon", drill=None)
    D(id="blum_tobm_tb_" + cl.lower(), model="TIP-ON BLUMOTION", ph="cls_" + cl, sysname="TANDEMBOX", art=c_tb, src="BLUM-CAT24 p400",
      lim={"kg": list(TBKG.get(cl, kg)), "nl": nls["tb"], "lwMin": 287}, sys=["tandembox"], sysNl={"tandembox": nls["tb"]}, sysLw={"tandembox": 287},
      gapMin=2.5, unit=cl, note="tipon", drill=None)
T('"recommended_front_gap_FS_mm":3.5', '270-600 (40 kg), 450-650 (70 kg)', '"750.2701T-750.6001T / 753.4501T-753.6501T"')
D(id="blum_tipon_lbx_40", model="TIP-ON", ph="lbx_profile", sysname="LEGRABOX 40 kg", art="750.xxxxT", src="BLUM-CAT24 p406,407",
  lim={"kg": [None, 40], "nl": [270, 600]}, sys=["legrabox"], sysNl={"legrabox": [270, 600]}, gapRec=3.5, note="profile", drill=None)
D(id="blum_tipon_lbx_70", model="TIP-ON", ph="lbx_profile", sysname="LEGRABOX 70 kg", art="753.xxxxT", src="BLUM-CAT24 p406,407",
  lim={"kg": [None, 70], "nl": [450, 650]}, sys=["legrabox"], sysNl={"legrabox": [450, 650]}, gapRec=3.5, note="profile", drill=None)

# --- Hettich Push to open Silent pentru sertare (bk_262, bk_310): AvanTech YOU / Actro YOU / ArciTech
T('"min_cabinet_width_mm":275', '"min_drawer_front_gap_mm":2.5', '"actro_you":"9257890"', '"arci":"9241038"', '"arci":"9241049"', '"arci":"9241050"', '"arci":"9241051"',
  '"NL_mm":"270-350"', '"NL_mm":"270-600 (Actro YOU) / 270-650 (ArciTech)"', '"NL_mm":"350-600 / 350-650"', '"NL_mm":"450-650"')
HC = [("xs", (None, 10), [270, 350], [270, 350], "9257890", "9241038"), ("l1", (8, 20), [270, 600], [270, 650], "9257891", "9241049"),
      ("l2", (10, 40), [350, 600], [350, 650], "9257892", "9241050"), ("xl", (20, 70), [450, 650], [450, 650], "9257893", "9241051")]
for cl, kg, nlA, nlC, cA, cC in HC:
    D(id="het_ptos_actro_" + cl, brand="Hettich", model="Push to open Silent", ph="drw_actro", art=cA, src="HET-BK262 p262",
      lim={"kg": list(kg), "nl": nlA, "lwMin": 275}, sys=["actro", "avantech"], sysNl={"actro": nlA, "avantech": nlA}, sysLw={"actro": 275, "avantech": 275}, gapMin=2.5, unit=cl, note="mech", drill=None)
    D(id="het_ptos_arci_" + cl, brand="Hettich", model="Push to open Silent", ph="drw_arci", art=cC, src="HET-BK310; HET-SHOP 9241049",
      lim={"kg": list(kg), "nl": nlC, "lwMin": 275}, sys=["arcitech"], sysNl={"arcitech": nlC}, sysLw={"arcitech": 275}, gapMin=2.5, unit=cl, note="mech", drill=None)

# --- Hettich Easys (electromecanic): 40 kg pe unitate, 70 kg cu două; PSU 24 V 3,75 A 90 W, până la 27 de unități
T('"drawer_weight_kg_per_drive_unit":40', '"drawer_weight_two_drive_units_kg":70', '"9078139"', '"9082363"', '"max 27 drive units per PSU (system limit)"',
  '"output 24 V, 3.75 A / 90 W max"' if False else '24 V, 3.75 A / 90 W max')
D(id="het_easys_9078139", brand="Hettich", model="Easys", ph="easys", art="9078139", src="HET-BK345 p345; HET-EASYS-MTA p10,19",
  lim={"kg": [None, 40], "kgTwo": 70}, sys=["avantech", "arcitech", "innotech", "actro", "quadro"], aux=[{"cat": "pushpsu", "id": "het_easys_psu", "per": "body"}],
  elec={"V": 24, "A": 3.75, "W": 90}, clearBehind={"arcitech": 51, "innotech": 72, "actro": 82, "quadro": 82},
  unitDims=[170, 68, 46], note="elec", drill=None)
T('behind-drawer free depth: ArciTech >=51 / InnoTech >=72 / Actro-Quadro >=82 (drawing, HET-EASYS-DU); AvanTech X=15',
  '170 x 68 x 46 (drawing, bk345)')

# --- Blum SERVO-DRIVE pentru sertare (BLUM-CAT24 p364–367) și uno
T('"Z10A3000.04"', '"Z10NE04xx"', '"trigger_path_mm":2', '"max_units_per_Z10NA300"' if False else '"uno_max_units_per_Z10NA300":2', '"Z10UB00xx"')
D(id="blum_servo_drawer", model="SERVO-DRIVE", ph="drawer_sys", art="Z10A3000.04", src="BLUM-CAT24 p364,366,367",
  lim={"kg": None, "trigger": 2}, sys=["legrabox", "merivobox", "tandembox"], aux=[{"cat": "pushpsu", "id": "blum_servo_psu_sys", "per": "body"}],
  elec={"V": 24}, note="elec", drill=None)
D(id="blum_servo_uno", model="SERVO-DRIVE", ph="uno", art="Z10UB00xx", src="BLUM-CAT24 p388; BLUM-UNO p4,10",
  lim={"kg": None}, sys=["pullout"], aux=[{"cat": "pushpsu", "id": "blum_servo_psu_uno", "per": "body"}], elec={"V": 24}, note="elec", drill=None)

pushpsu = [
    dict(id="het_easys_psu", brand="Hettich", model="Easys", ph="psu_easys", art="9082363", src="HET-BK347 p347; HET-EASYS-PSU p3",
         lim={"maxUnits": 27, "W": 90, "A": 3.75}, verificat=False),
    dict(id="blum_servo_psu_sys", brand="Blum", model="SERVO-DRIVE", ph="psu_sys", art="Z10NE04xx", src="BLUM-CAT24 p362,365",
         lim={"maxUnits": None}, verificat=False),
    dict(id="blum_servo_psu_uno", brand="Blum", model="SERVO-DRIVE", ph="psu_uno", art="Z10NA300", src="BLUM-UNO p11",
         lim={"maxUnits": 2}, verificat=False),
]

# =====================================================================================================================
# SUSP — suspendare corpuri (HWDB.susp = perechea de cleme; HWDB.suprail = șina/placa de perete)
# `kgBracket` = sarcina pe clemă (kg), `kgPair` = pe pereche; `frames` = cadrele de încercare (EN 15939) la SAH 500
# =====================================================================================================================
susp = []
def S(**k):
    k.setdefault("per", "body"); k.setdefault("verificat", False); susp.append(k)

T('"frame_A_per_bracket":110', '"frame_B_per_bracket":80', '"frame_C_per_bracket":50', 'frame A H=1000 T=300, B H=600 T=600, C H=300 T=600',
  '"rear_panel_thickness_mm":"3-8 (also usable without rear panel)"')
S(id="het_sah500", brand="Hettich", model="SAH 500", ph="s_concealed_body", art="9385584 + 9385585", src="HET-SHOP-9385585; HET-SAH500-MTA p5-6",
  kgBracket=None, frames=[{"id": "A", "h": 1000, "t": 300, "kg": 110}, {"id": "B", "h": 600, "t": 600, "kg": 80}, {"id": "C", "h": 300, "t": 600, "kg": 50}],
  backT=[3, 8], rails=[], wall="element", adj={"h": 11, "d": [-2, 10], "side": 3}, liftOff=6.5, wallElementH=118, wallHolePitch=48,
  drill={"holes": 4, "dia": 10, "depth": 12.5, "pitchA": 32, "pitchB": 64, "fromRear": 43.5, "cMin": 14.5, "ref": "rearEdge+topInner"})  # MTA p.5 (desen citit ca imagine): 43,5 de la muchia din spate a lateralului până la coloana din spate; 32 între coloane (pe adâncime), 64 între rânduri (pe înălțime); C ≥ 14,5 de la fața interioară a tavanului până la rândul de sus; depth 12,5 din fața interioară
T('"reference_from_rear_edge_mm":43.5', '"C_min_mm":14.5', 'depth 12.5 +0.5/-0')
T('"per_bracket":55', '"per_bracket":45', '"per_bracket":35', '"per_bracket":30', '"per_bracket":40', '"per_bracket":15')
S(id="het_sah216ahs", brand="Hettich", model="SAH 216", ph="s_behind_ahs", art="9277718", src="HET-TA2025-SUSP bk_838,846; HET-SHOP-9277718",
  kgBracket=55, rails=["het_rail_b"], wall="rail", adj={"h": 8, "d": 25, "side": 3}, liftOff=7.5, drill=None)
S(id="het_sah216", brand="Hettich", model="SAH 216", ph="s_behind", art="0079717", src="HET-TA2025-SUSP bk_848",
  kgBracket=55, rails=["het_rail_b"], wall="rail", adj={"h": 8, "d": 25, "side": 3}, liftOff=7.5, drill=None)
S(id="het_sah215ahs", brand="Hettich", model="SAH 215", ph="s_behind_ahs", art="9277719", src="HET-TA2025-SUSP bk_838,842",
  kgBracket=45, rails=["het_rail_b"], wall="rail", adj={"h": 8, "d": 25, "side": 3}, liftOff=7.5, drill=None)
S(id="het_sah215", brand="Hettich", model="SAH 215", ph="s_behind", art="0079716", src="HET-TA2025-SUSP bk_844",
  kgBracket=45, rails=["het_rail_b"], wall="rail", adj={"h": 8, "d": 25, "side": 3}, liftOff=7.5, drill=None)
S(id="het_sah130", brand="Hettich", model="SAH 130", ph="s_pressin", art="0079724 (T19)", src="HET-TA2025-SUSP bk_850",
  kgBracket=35, sideT=19, rails=["het_rail_l", "het_rail_b"], wall="rail", adj={"h": 7, "d": 15, "side": 3}, liftOff=7.5, drill=None)
S(id="het_sah15", brand="Hettich", model="SAH 15", ph="s_inbody", art="9208645 (T16)", src="HET-TA2025-SUSP bk_852",
  kgBracket=30, sideT=16, rails=["het_rail_l", "het_rail_b"], wall="rail", adj={"h": 9, "d": 18, "side": 6}, liftOff=6, drill=None)
S(id="het_sah116", brand="Hettich", model="SAH 116", ph="s_inbody", art="0019476 (T21)", src="HET-TA2025-SUSP bk_854",
  kgBracket=40, sideT=21, rails=["het_rail_l", "het_rail_b"], wall="rail", adj={"h": 7, "d": 15, "side": 3}, liftOff=7.5, drill=None)
S(id="het_sah305", brand="Hettich", model="SAH 305", ph="s_rearpanel", art="0040669", src="HET-TA2025-SUSP bk_856",
  kgBracket=15, backTmin=16, rails=[], wall="hook", adj={"side": 8}, drill={"dia": 30, "depth": 11.5, "ref": "rear"})
T('"per_pair":130', '"per_pair":150', '"291.04.312 with screw hook":40', '"291.04.311 with wall plate":60')
S(id="haf_hang_290_03_91", brand="Häfele", model="290.03.91", ph="s_concealed", art="290.03.911 / 290.03.910", src="HAF-2014-HANG 14CFC77",
  kgPair=130, rails=["haf_rail_290_10_900"], wall="rail", adj={"h": 15, "d": 20}, drill=None)
S(id="haf_hang_290_03_92", brand="Häfele", model="290.03.92", ph="s_concealed", art="290.03.921 / 290.03.920", src="HAF-2014-HANG 14CFC78",
  kgPair=130, rails=["haf_rail_290_10_900", "haf_rail_290_09_910"], wall="rail", adj={"h": 15}, drill=None)
S(id="haf_hang_290_03_93", brand="Häfele", model="290.03.93", ph="s_hookoff", art="290.03.936 / 290.03.935", src="HAF-2014-HANG 14CFC78A",
  kgPair=130, rails=["haf_rail_290_10_900", "haf_rail_290_09_910"], wall="rail", adj={"h": 15}, drill=None)
S(id="haf_libra_h2", brand="Häfele", model="Libra H2", ph="s_libra", art="290.41.910", src="HAF-2014-HANG 14CFC79",
  kgPair=150, rails=[], wall="plate", adj={"h": 13, "side": 12}, drill=None)
S(id="haf_libra_h1", brand="Häfele", model="Libra H1", ph="s_libra", art="290.41.900", src="HAF-2014-HANG 14CFC80",
  kgPair=150, rails=[], wall="plate", adj={"h": 13, "side": 12}, drill=None)
S(id="haf_libra_h3", brand="Häfele", model="Libra H3", ph="s_libra", art="290.41.915 / 290.41.905", src="HAF-2014-HANG 14CFC80",
  kgPair=150, rails=[], wall="plate", adj={"h": 13, "side": 12}, drill=None)
S(id="haf_brk_291_04_312", brand="Häfele", model="291.04.312", ph="s_bracket_hook", art="291.04.312", src="HAF-2014-HANG 14CFC76",
  kgBracket=40, kgNote="unit", rails=[], wall="hook", outline=[45, 57] if T("45 x 57, dia 35 hole") else None, drill=None)
S(id="haf_brk_291_04_311", brand="Häfele", model="291.04.311", ph="s_bracket_plate", art="291.04.311 + 290.08.921", src="HAF-2014-HANG 14CFC76",
  kgBracket=60, kgNote="unit", rails=[], wall="plate", outline=[45, 57] if T("45 x 57, dia 35 hole") else None, drill=None)
T('"806 14 P2 VI":50', '"806 22 P2 IN":65', '"821 12 Z1 IN":"60 kg recommended', '"818 32 Z1 D1":"720 N per hooking point', '"801 02 Z1 IN":"850 N')
S(id="cam_806_14", brand="Camar", model="806 14 P2 VI", ph="s_plate", art="806 14 P2 VI", src="CAM-CERT camar_806; CAM-SHEET 273-276",
  kgPair=50, kgNote="unit", rails=["cam_rail_875"], wall="rail", adj={"h": 25}, drill=None)
S(id="cam_806_22", brand="Camar", model="806 22 P2 IN", ph="s_plate", art="806 22 P2 IN", src="CAM-CERT camar_806; CAM-SHEET 273-276",
  kgPair=65, kgNote="unit", rails=["cam_rail_875"], wall="rail", adj={"h": 25}, drill=None)
S(id="cam_821", brand="Camar", model="821 12 Z1 IN", ph="s_concealed", art="821 12 Z1 IN", src="CAM-CERT; CAM-SHEET 313-326",
  kgPair=60, kgNote="unit", rails=[], wall="rail", drill=None)
S(id="cam_818", brand="Camar", model="818 32 Z1 D1", ph="s_concealed", art="818 32 Z1 D1", src="CAM-CERT; CAM-SHEET 299-308",
  nPoint=720, rails=["cam_rail_875"], wall="rail", drill=None)
S(id="cam_801", brand="Camar", model="801 02 Z1 IN", ph="s_concealed", art="801 02 Z1 IN", src="CAM-CERT; DIN 68840",
  nPoint=850, rails=[], wall="rail", drill=None)
S(id="cam_816as", brand="Camar", model="816 AS Z1", ph="s_antidrop", art="816 AS Z1 DU / 816 AS Z1 50", src="CAM-SHEET 283-286",
  kgPair=None, rails=["cam_rail_875"], wall="rail", adj={"h": 12, "side": 10}, outline=[148, 42] if T("148 high x 42 wide") else None,
  drill={"holes": 3, "dia": 10, "pitch": 32, "ref": "unclear"})

T('"rail_L_per_cabinet":130', '"rail_B_per_cabinet":150', '"9208678"', '"9007651"', '"290.10.900"', '"290.09.910"', '"875 AS Z1 00 60":"1975 N per hooking point')
suprail = [
    dict(id="het_rail_l", brand="Hettich", model="Rail L", ph="r_l", art="9208678", src="HET-TA2025-SUSP bk_858", kgCab=130, profile=[68, 42], thick=1.75, verificat=False),
    dict(id="het_rail_b", brand="Hettich", model="Rail B", ph="r_b", art="9007651", src="HET-TA2025-SUSP bk_858", kgCab=150, length=3000, verificat=False),
    dict(id="haf_rail_290_10_900", brand="Häfele", model="290.10.900", ph="r_wall", art="290.10.900", src="HAF-2014-HANG 14CFC78", length=2032, kgCab=None, verificat=False),
    dict(id="haf_rail_290_09_910", brand="Häfele", model="290.09.910", ph="r_wall", art="290.09.910", src="HAF-2014-HANG 14CFC78B", length=1250, kgCab=None, verificat=False),
    dict(id="cam_rail_875", brand="Camar", model="875 AS Z1 00 60", ph="r_wall", art="875 AS Z1 00 60", src="CAM-CERT plech_pro_806_818", nPoint=1975, kgCab=None, verificat=False),
]

# =====================================================================================================================
# CONN — îmbinări demontabile / fără unealtă (HWDB.conn). `joint` = geometria pentru ops/3D (HW_DRILL.joints.variants):
#   kind "housing": locaș în FAȚA piesei E la B de muchie + canal în muchia lui E; kind "plug": gaură în MUCHIA piesei E, pe axa A (grosime)
#   `t` = {grosime: valoare}; `T` = [min, max] grosimea panoului
# =====================================================================================================================
conn = []
def C(**k):
    k.setdefault("verificat", False); conn.append(k)

R15 = CON["HET-RASTEX15"]["drilling_a"]
T('"housing_dia_mm":15', '"12":10', '"15":12.2', '"16":12.7', '"18":13.4', '"19":13.7', '"22":15.7', '"29":19.2', '"12":6', '"15":7.5', '"16":8', '"18":9',
  '"19":9.5', '"22":11', '"29":14.5', '"distance_B_mm":"24 +0.5/-0.3 or 34 +0.5/-0.3 (housing centre to panel edge)"')
depthR = {int(k): float(v) for k, v in R15["depth_by_thickness_mm"].items()}
axisR = {int(k): float(v) for k, v in R15["dowel_axis_A_by_thickness_mm"].items()}
for B in (24, 34):
    C(id="het_rastex15_b%d" % B, brand="Hettich", model="Rastex 15", ph="c_rastex_b%d" % B, art="0025064 (19) / 0025062 (16) / 0071950 (19, rim); Rapid S 0044750 / Twister 0020056" if T("0044750", "0020056", "0025064", "0025062", "0071950") else None, src="HET-TA2025-CONN bk_750,752-754",
      T=[12, 29], joint={"kind": "housing", "dia": 15, "depthT": depthR, "axisT": axisR, "B": B, "shankDia": 8, "shankDepth": B,
                         "fDia": None, "fDepth": None, "note": "Hettich Rastex 15 B%d" % B})
T('"housing_dia_mm":25', '"hole_distance_A_mm":"dowel length + 9 (e.g. 33.5 shown)"')
C(id="het_rastex25", brand="Hettich", model="Rastex 25", ph="c_rastex25", art="0013116", src="HET-TA2025-CONN bk_757", T=[None, None], joint=None)
T('"housing_dia_mm":30', '"depth_mm":"15 +0.5"', '"through_hole_dia_mm":10')
C(id="het_vb20", brand="Hettich", model="VB 20", ph="c_vb20", art="0025049", src="HET-TA2025-CONN bk_760-761", T=[19, 20], joint=None)
C(id="het_vb21", brand="Hettich", model="VB 21", ph="c_vb21", art="0047454", src="HET-TA2025-CONN bk_760-761", T=[19, 20], joint=None)
T('"VB 54/16 DFS":"0073618"' if False else '"VB 54/16 DFS 0073618"', '"VB 54/19 DFS 0073619"')
C(id="het_vb54_16", brand="Hettich", model="VB 54 Toolex", ph="c_vb54", art="0073618", src="HET-TA2025-CONN bk_768", T=[16, 16], joint=None)
C(id="het_vb54_19", brand="Hettich", model="VB 54 Toolex", ph="c_vb54", art="0073619", src="HET-TA2025-CONN bk_768", T=[19, 19], joint=None)
T('dia 20, depth 9.5 +0.5; 16 mm min thickness; 12.5, 8 (drawing)')
C(id="het_vb135", brand="Hettich", model="VB 135", ph="c_vb135", art="0073616", src="HET-TA2025-CONN bk_769", T=[16, 30], joint=None)
C(id="het_alfa_stop", brand="Hettich", model="Alfa Stop", ph="c_alfa", art="9131206", src="HET-TA2025-CONN bk_769", T=[16, 30], joint=None)
C(id="het_beta", brand="Hettich", model="Beta", ph="c_beta", art="9132007", src="HET-TA2025-CONN bk_769", T=[16, 30], joint=None)

# --- Häfele Rafix-20: Ø20, adâncimea X și axa A după grosime (23T7-29/30/31); B nu e în sursă
RF = CON["HAF-RAFIX20"]["drilling_a"]
T('"housing_bore_dia_mm":20', '"16":8.0', '"19":9.5', '"16":"12.7 +0.2"', '"19":"14.2 +0.2"', '"through_hole_for_tightening_dia_mm":10',
  '"bolt distance B not stated; no loads"')
C(id="haf_rafix", brand="Häfele", model="Rafix 20", ph="c_rafix20", art="263.11.703 (16) / 263.11.705 (19)", src="HAF-TECH23 23T7-29/30/31", existing=True, T=[16, 19],
  joint={"kind": "housing", "dia": 20, "depthT": {int(k): N(v) for k, v in RF["depth_X_mm"].items()}, "axisT": {int(k): float(v) for k, v in RF["A_mm"].items()},
         "B": None, "shankDia": 10, "shankDepth": None, "fDia": 5, "fDepth": 11, "legacyB": True, "note": "Häfele Rafix-20"})
T('"A_mm":8.0', '"X_mm":12.7', 'dia 24 head, dia 20 bore (drawing)')
C(id="haf_rafix_tab", brand="Häfele", model="Rafix TAB", ph="c_rafix_tab", art="263.09.731", src="HAF-TECH23 23T7-33", T=[16, None],
  joint={"kind": "housing", "dia": 20, "depthT": {16: 12.7}, "axisT": {16: 8.0}, "B": None, "shankDia": 10, "shankDepth": None, "fDia": 5, "fDepth": 11, "legacyB": True,
         "note": "Häfele Rafix-20 TAB"})

# --- Häfele TAB: gaură Ø18 în MUCHIA raftului (A = axa pe grosime, X = adâncimea)
T('"hole_dia_mm":18', '"A_mm":9.5', '"X_mm":15.0', '"16 mm":{"A":8.0,"X":13.0}', '"19 mm":{"A":9.5,"X":15.0}', '"A_mm":8.0', '"X_mm":13.0')
C(id="haf_tab18_screw", brand="Häfele", model="TAB 18", ph="c_tab18_screw", art="263.66.558", src="HAF-TECH23 23T7-43", T=[19, 26],
  joint={"kind": "plug", "dia": 18, "depthT": {19: 15.0}, "axisT": {19: 9.5}, "note": "Häfele TAB 18 (screw)"})
C(id="haf_tab18_plug", brand="Häfele", model="TAB 18", ph="c_tab18_plug", art="263.67.537 (16) / 263.67.555 (19)", src="HAF-TECH23 23T7-43", T=[16, 19],
  joint={"kind": "plug", "dia": 18, "depthT": {16: 13.0, 19: 15.0}, "axisT": {16: 8.0, 19: 9.5}, "note": "Häfele TAB 18 (plug-fit)"})
C(id="haf_tab", brand="Häfele", model="TAB", ph="c_tab", art="263.73.535", src="HAF-TECH23 23T7-40", T=[16, 23],
  joint={"kind": "plug", "dia": 18, "depthT": {16: 13.0, 19: 13.0, 23: 13.0}, "axisT": None, "note": "Häfele TAB"})
T('"A_mm":"8.0 (16 mm) / 9.0 (18/19 mm)"', '"depth_D_mm":"13.0 +/-0.2 (16) / 15.0 +/-0.2 (18-19)"')
C(id="haf_tab15", brand="Häfele", model="TAB 15", ph="c_tab15", art="263.73.611", src="HAF-TECH23 23T7-42", T=[16, 19], joint=None)
T('"hole_dia_mm":25', 'B - C + 7.5 (B = thickness, C = 9)')
C(id="haf_tofix", brand="Häfele", model="Tofix", ph="c_tofix", art="261.95.704", src="HAF-TECH23 23T7-37", T=[18, 26], joint=None)
C(id="haf_onefix", brand="Häfele", model="OneFix", ph="c_onefix", art="263.03.104", src="HAF-TECH23 23T7-38", T=[15, None], joint=None)
C(id="haf_turn", brand="Häfele", model="Turn", ph="c_turn", art="263.87.600", src="HAF-TECH23 23T7-41", T=[18, None], joint=None)
C(id="haf_rvclip", brand="Häfele", model="RV clip", ph="c_rvclip", art="262.72.701 + 262.72.953", src="HAF-TECH23 23T7-56", T=[None, None], joint=None)
T('"housing_dia_mm":35', '"A_mm":9.5', '"bolt_hole_dia_mm":9', '"B_mm":"35 or 55"', '"depth_mm":"15.5 or 1/2 thickness + 6.5"')
C(id="haf_maxifix", brand="Häfele", model="Maxifix", ph="c_maxifix", art="262.87.003 / 262.87.713", src="HAF-TECH23 23T7-26,27", T=[19, None],
  joint={"kind": "housing", "dia": 35, "depthFn": {"k": 0.5, "c": 6.5}, "axisT": None, "B": 35, "shankDia": 9, "shankDepth": 35, "fDia": None, "fDepth": None,
         "note": "Häfele Maxifix B35"})
# --- Knapp (agățare, oțel): numai cataloage și limite de grosime
T('"panel_th":[10,20]', '"K061 (mL, blue zinc)"', '"K062 (oL, yellow zinc)"', '"K120"')
C(id="kn_duo35_ml", brand="Knapp", model="DUO 35", ph="c_duo35_ml", art="K061", src="KNAPP-DOCS DUO 35 mL-oL Instruction; knapp-belastungswerte-duo-35", T=[10, 20], joint=None)
C(id="kn_duo35_ol", brand="Knapp", model="DUO 35", ph="c_duo35_ol", art="K062", src="KNAPP-DOCS DUO 35 mL-oL Instruction; knapp-belastungswerte-duo-35", T=[10, 20], joint=None)
C(id="kn_duo30", brand="Knapp", model="DUO 30", ph="c_duo30", art="—", src="knapp-belastungswerte-duo-30-de", T=[16, 19], joint=None)
C(id="kn_uno30", brand="Knapp", model="UNO 30", ph="c_uno30", art="K120", src="mont_uno30_de_en_fr.pdf; belastungswerte_uno30_2014", T=[16, 19], joint=None)

# =====================================================================================================================
srcs = {}
for s in OP["sources"] + SU["sources"]:
    srcs[s["id"]] = {"title": s.get("title"), "url": s.get("url")}
DATA = {"push": push, "pushd": pushd, "pushpsu": pushpsu, "susp": susp, "suprail": suprail, "conn": conn,
        "sources": srcs,
        "notes": {"opening": OP["notes"], "susp": SU["notes"]}}
DATA = clean(DATA)

ids = set()
for cat in ("push", "pushd", "pushpsu", "susp", "suprail", "conn"):
    for it in DATA[cat]:
        if it["id"] in ids: problems.append("id dublat " + it["id"])
        ids.add(it["id"])
        if not it.get("src"): problems.append("fără sursă " + it["id"])
        if it.get("verificat") is not False: problems.append("verificat trebuie false " + it["id"])
if problems:
    print("\n".join(problems)); sys.exit(1)

js = ("/* GENERAT de tools/hw-data/open/normalize.py din tools/hw-data/raw/cat-opening.json și cat-susp.json — nu se editează.\n"
      " * Surse: documente oficiale (vezi `sources`). Fiecare număr are sursă; ce nu e citit = null; toate cotele verificat:false (D-48). */\n"
      "(function (root) {\n\"use strict\";\nvar EBOpenData = " + json.dumps(DATA, ensure_ascii=False, indent=1, sort_keys=False) + ";\n"
      "if (typeof module === \"object\" && module.exports) module.exports = EBOpenData;\nroot.EBOpenData = EBOpenData;\n"
      "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n")
if "--check" in sys.argv:
    cur = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
    if cur != js:
        print("app/ebanist-open-data.js nu e la zi: rulează python3 tools/hw-data/open/normalize.py"); sys.exit(1)
    print("la zi"); sys.exit(0)
open(OUT, "w", encoding="utf-8").write(js)
print("scris %s: push %d, pushd %d, pushpsu %d, susp %d, suprail %d, conn %d" % (OUT, len(push), len(pushd), len(pushpsu), len(susp), len(suprail), len(conn)))
