#!/usr/bin/env python3
"""Ebanist — balamale de la alte mărci: aduce datele brute (tools/hw-data/raw/cat-hinges.json, citite din documente oficiale
Hettich / Salice / Grass / Häfele / Blum) într-o schemă comună, câte un fișier pe marcă: tools/hw-data/hinges/<marca>.json.

    python3 tools/hw-data/hinges/normalize.py

REGULI (aceleași ca la mecanismele de ridicare, tools/lift-data/normalize.py):
  * NICIun număr nu e scris aici din memorie: orice cotă, interval, cod sau tabel e copiat din raw (sau parsat dintr-un șir din raw).
    Ce lipsește în raw rămâne `null`. Ce scriu eu aici e numai structură: ce familie e de sticlă, ce cod e „cu vopsea neagră”, ordinea
    suprapunerilor (full/half/inset) din textul descrierii codului.
  * Fiecare cotă are `src` (id sursă + pagina) sau moștenește `src` al familiei.
  * `pattern.src`: "text" = scrisă într-un tabel/text (nume de tip, cod), "drawing" = citită de pe un desen. Găurile de dornuri și de
    placuță se generează în aplicație numai din ce are mărime + adâncime + reper în text/tabel (vezi ebanist-hinges-more.js).
  * `verificat` e mereu false (D-48).

Schema unei familii:
  key, brand, series, name, angle, kind, doorTh:[lo,hi], glass, noDrill, cup{dia,depth,depthMin,tb}, fix{id:{mode,hole,pattern}},
  plates:[id...] (sau "blum-clip"), parts[{id,art,overlay,fix,soft,spring,push,colour,variant,pattern,note,src}],
  adjust, count{rows[{n,h,kg:[lo,hi]|null}],widthMax,...}, tables[], protr, armLen, open[], notes[], src
"""
import json, os, re

here = os.path.dirname(os.path.abspath(__file__))
RAW = json.load(open(os.path.join(here, "..", "raw", "cat-hinges.json"), encoding="utf-8"))
F = {f["id"]: f for f in RAW["families"]}
SOURCES = {s["id"]: s for s in RAW["sources"]}


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def pair(a):
    return [num(a[0]), num(a[1])] if isinstance(a, list) and len(a) == 2 else None


def nums(s):
    return [float(x) if "." in x else int(x) for x in re.findall(r"\d+(?:\.\d+)?", str(s))]


def pat_from(s):
    """'52 x 5.5' / '45/9.5' / '48/6' → (spacing, offset) sau None"""
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:x|/)\s*(\d+(?:\.\d+)?)", str(s))
    return (float(m.group(1)) if "." in m.group(1) else int(m.group(1)),
            float(m.group(2)) if "." in m.group(2) else int(m.group(2))) if m else None


def hole_from(s):
    """'(o5x12)' / 'o10x11' → {dia,depth} sau None"""
    m = re.search(r"o\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)", str(s))
    if not m:
        return None
    a, b = m.group(1), m.group(2)
    return {"dia": float(a) if "." in a else int(a), "depth": float(b) if "." in b else int(b)}


def expand(codestr):
    """'9 071 208/209/210' → [...]; '311.04.642 / 242' → [...]; 'A / B' rămâne"""
    out, first = [], None
    for p in [x.strip() for x in re.split(r"[/;]", codestr) if x.strip()]:
        if first is not None and re.fullmatch(r"\d{3}", p):
            m = re.match(r"^(.*?)(\d{3})$", first)
            p = m.group(1) + p
        if first is None:
            first = p
        out.append(p)
    return out


def idof(pref, art):
    return pref + "_" + re.sub(r"[^A-Za-z0-9]+", "", art)


def table_of(title, t, rowLabel, colLabel, colkey, page=None):
    """{cols_X:[..], rows:{r:[..]}} → tabel generic (ca în ebanist-hinges.js tableGeneric)"""
    if not isinstance(t, dict) or "rows" not in t:
        return None
    cols = t.get(colkey) or t.get("cols_C") or t.get("cols_E") or t.get("cols_FD") or []
    return {"title": title, "rowLabel": rowLabel, "colLabel": colLabel, "cols": cols, "rows": t["rows"]}


def count_of(f, ref=None):
    h = f.get("hinge_count") or {}
    if "ref" in h and ref:
        h = (F[ref].get("hinge_count") or {})
        via = ref
    else:
        via = None
    rows = h.get("rows")
    if not isinstance(rows, list):
        return None
    out = []
    for r in rows:
        kg = None
        if num(r.get("kg_max")) is not None:
            kg = [None, r["kg_max"]]
        elif isinstance(r.get("kg"), str):
            n = nums(r["kg"])
            if len(n) == 2:
                kg = n
        out.append({"n": r["n"], "h": num(r.get("h_max_mm")), "kg": kg})
    c = {"rows": out, "widthMax": num(h.get("door_width_max_mm") or h.get("door_width_mm")), "src": h.get("src")}
    if num(h.get("min_spacing_X_mm")) is not None:
        c["minSpacing"] = h["min_spacing_X_mm"]
    if pair(h.get("end_hinge_from_edge_mm")):
        c["endEdge"] = h["end_hinge_from_edge_mm"]
    if via:
        c["via"] = via
    if h.get("note"):
        c["note"] = h["note"]
    if h.get("alt_chart_unlabelled"):
        c["alt"] = h["alt_chart_unlabelled"]
    return c


def adjust_of(arm):
    a = {}
    for k_src, k in (("adjust_side_mm", "side"), ("adjust_height_mm", "height"), ("adjust_depth_mm", "depth"),
                     ("adjust_overlay_mm", "overlay"), ("adjust_depth_plate200_mm", "depthPlate200"),
                     ("adjust_depth_Domi_mm", "depthDomi")):
        v = (arm or {}).get(k_src)
        if v is not None:
            a[k] = v
    return a or None


def base(fid, key, series, kind, **kw):
    f = F[fid]
    o = {"key": key, "brand": f["brand"], "series": series, "name": kw.pop("name", None), "angle": num(f["angle"]),
         "kind": kind, "doorTh": pair(f["door_th"]) or [None, None]}
    o.update(kw)
    return o


def cup_of(f, **over):
    c = f.get("cup") or {}
    o = {"dia": num(c.get("dia")), "depth": num(c.get("depth")), "depthMin": num(c.get("depth_min")),
         "tb": pair(c.get("tb")), "src": c.get("src") or ""}
    o.update(over)
    return o


def open_of(f):
    return list(f.get("unreadable") or [])


# ======================================================================================================== HETTICH
HET_FIX_MODE = {"TH52": "screw", "TH42": "screw", "TH22/L": "screw", "TA32": "screw", "TU12/S": "screw",
                "TH53": "press", "TH43": "press", "THS55": "fix", "TH45": "fix", "TH58": "premount", "TH48": "premount"}


def het_fix(f):
    """fixările cupei: id → {mode, hole, pattern}. Modelul de fixare vine din tabelul de coduri; pattern numai unde e scris (TH52 / TH42 / TH22/L)."""
    out = {}
    for fid, v in ((f.get("cup") or {}).get("dowel") or {}).items():
        if fid not in HET_FIX_MODE:
            continue
        o = {"mode": HET_FIX_MODE[fid], "hole": None, "pattern": None}
        if isinstance(v, dict):
            if num(v.get("hole_dia")) is not None and num(v.get("hole_depth")) is not None:
                o["hole"] = {"dia": v["hole_dia"], "depth": v["hole_depth"]}
            if v.get("pattern"):
                p = pat_from(v["pattern"])
                if p:
                    o["pattern"] = {"spacing": p[0], "offset": p[1], "src": "drawing"}
        else:
            p = pat_from(v)
            if p and HET_FIX_MODE[fid] == "screw":
                o["pattern"] = {"spacing": p[0], "offset": p[1], "src": "drawing"}
        out[fid] = o
    return out


def het_parts(fid, lines, soft):
    """lines: [(index în raw codes, [overlay...], fix, variant|None)]"""
    f = F[fid]
    parts = []
    for i, ovs, fx, var in lines:
        raw = f["codes"][i]
        codes = expand(raw["code"])
        if len(codes) != len(ovs):
            raise SystemExit("cod/overlay nepotrivite %s %s %s" % (fid, raw["code"], ovs))
        for c, ov in zip(codes, ovs):
            p = {"id": idof("het", c), "art": c, "overlay": ov, "fix": fx, "soft": soft, "spring": None, "push": False,
                 "colour": None, "variant": var, "pattern": None, "src": raw["src"]}
            parts.append(p)
    return parts


HET = []
f = F["hettich_sensys_8645i"]
cup_dowel = het_fix(f)
HET_PLATES = []
for t in f["plate"]["types"]:
    nm = t["name"]
    kind = t["type"]
    hole = hole_from(nm)
    if re.search(r"screw-on", nm):
        hole = None
    HET_PLATES.append({
        "id": idof("hetp", list(t["codes"].values())[0]),
        "kind": kind, "name": nm, "line": num(t.get("hole_line_LR_mm")), "pitch": num(t.get("hole_spacing_mm")),
        "lineSrc": "table" if kind == "cruciform" else "drawing",
        "hole": hole, "D": t.get("D_mm"), "codes": t["codes"], "art": list(t["codes"].values()),
        "src": f["plate"]["src"], "note": t.get("note")})
HET_PLATE_IDS = [p["id"] for p in HET_PLATES]
# ordinea implicită: cele cu mărime de gaură citită (cruce cu soclu expandabil / Euro) înaintea celor fără
HET_PLATE_IDS = sorted(HET_PLATE_IDS, key=lambda i: 0 if next(p for p in HET_PLATES if p["id"] == i)["hole"] and next(p for p in HET_PLATES if p["id"] == i)["kind"] == "cruciform" else 1)
HET_ACC = [{"name": a["name"], "code": a.get("code"), "codes": a.get("codes")} for a in f["plate"]["adapters"]]


def het_family(fid, key, series, kind, lines, soft, countref=None, plates=True, glass=False, noDrill=False, extra=None, plate_ids=None):
    f = F[fid]
    o = base(fid, key, series, kind, name=f["name"])
    o["glass"] = glass
    o["noDrill"] = noDrill
    o["cup"] = cup_of(f)
    o["fix"] = het_fix(f)
    o["plates"] = (plate_ids if plate_ids is not None else HET_PLATE_IDS) if plates else []
    o["parts"] = het_parts(fid, lines, soft)
    o["adjust"] = adjust_of(f.get("arm"))
    o["count"] = count_of(f, countref)
    g = f.get("gaps") or {}
    tabs = []
    if isinstance(g.get("min_reveal_table"), dict):
        t = table_of("min reveal (mm)", g["min_reveal_table"], "door thickness", "C (TB)", "cols_C", g.get("src"))
        if t:
            tabs.append(t)
    o["tables"] = tabs
    prot = g.get("hinge_protrusion_H_door_protrusion_T_at_D0_C3") or g.get("H_T_at_D0_C3") or g.get("H_T_at_D0_C5.5")
    o["protr"] = prot
    o["formulaD"] = g.get("formula_D")
    o["open"] = open_of(f)
    o["notes"] = list(f.get("options") or [])
    o["envelopeLabels"] = (f.get("envelope") or {}).get("note") or (f.get("envelope") or {}).get("label_H_drawing")
    o["src"] = (f.get("cup") or {}).get("src") or "HET-2017"
    if extra:
        o.update(extra)
    return o


HET.append(het_family("hettich_sensys_8645i", "het_8645i", "Sensys 8645i", "standard",
    [(0, ["full"], "TH52", None), (1, ["half"], "TH52", None), (2, ["inset"], "TH52", None),
     (3, ["full", "half", "inset"], "TH53", None), (4, ["full", "half", "inset"], "THS55", None),
     (5, ["full", "half", "inset"], "TH58", None)], True,
    extra={"accessories": HET_ACC, "conflicts": ["door thickness 15-24 (HET-2017 p16, HET-UK-2020, HET-BROCH) vs 15-22 (HET-SENS-11309 p17, older)"]}))
HET.append(het_family("hettich_sensys_8631i", "het_8631i", "Sensys 8631i", "thick",
    [(0, ["full", "half", "inset"], "TH52", None), (1, ["full", "half", "inset"], "TH53", None), (2, ["full", "half", "inset"], "TH58", None)], True, countref="hettich_sensys_8645i"))
HET.append(het_family("hettich_sensys_8646i", "het_8646i", "Sensys 8646i", "thin",
    [(0, ["full"], "TH52", None), (1, ["full"], "TH53", None), (2, ["full"], "TH58", None), (3, ["half", "inset"], "TH52", None)], True, countref="hettich_sensys_8645i",
    extra={"conflicts": ["door thickness 10-16 (HET-2017) vs 10-19 (HET-UK-2020)"]}))
HET.append(het_family("hettich_sensys_8657i", "het_8657i", "Sensys 8657i", "zero",
    [(0, ["full", "half"], "TH52", None), (1, ["full", "half"], "TH53", None), (2, ["full", "half"], "THS55", None), (3, ["full", "half"], "TH58", None)], True, countref="hettich_sensys_8645i"))
HET.append(het_family("hettich_sensys_8639i_W30_W45_W90", "het_8639i", "Sensys 8639i W", "angle",
    [(0, ["overlay", "inset"], "TH52", "W30"), (1, ["overlay", "inset"], "TH53", "W30"), (2, ["overlay", "inset"], "TH52", "W45"),
     (3, ["inset"], "TH52", "W90"), (4, ["inset"], "TH53", "W90")], True, countref="hettich_sensys_8645i"))
HET.append(het_family("hettich_sensys_8638i_alu", "het_8638i", "Sensys 8638i", "alu",
    [(0, ["full", "half", "inset"], "TA32", None)], True, plates=False, noDrill=True))
HET.append(het_family("hettich_intermat_9943", "het_9943", "Intermat 9943", "standard",
    [(0, ["full", "half", "inset"], "TH42", None), (1, ["full", "half", "inset"], "TH43", None), (2, ["full", "half", "inset"], "TH45", None),
     (3, ["full", "half", "inset"], "TH48", None)], False))
HET.append(het_family("hettich_intermat_9936", "het_9936", "Intermat 9936", "thick",
    [(0, ["full"], "TH42", None), (1, ["full"], "TH43", None), (2, ["full"], "TH45", None)], False))
HET.append(het_family("hettich_intermat_9935", "het_9935", "Intermat 9935", "thick",
    [(0, ["full", "half", "inset"], "TH22/L", None)], False))
HET.append(het_family("hettich_intermat_9904_glass", "het_9904", "Intermat 9904", "glass",
    [(0, ["full", "half", "inset"], "TU12/S", None)], False, plates=True, glass=True, noDrill=True,
    plate_ids=[idof("hetp", F["hettich_sensys_8645i"]["plate"]["types"][-1]["codes"]["1.5"])]))   # 9904: „System 8099 linear plate LR20, pressing in” (p105)
# Hettich 9936: Fix cu adâncimea cupei 11.3 (depth_fix)
for _f in HET:
    if _f["key"] == "het_9936":
        _f["fix"]["TH45"]["cupDepth"] = num(F["hettich_intermat_9936"]["cup"].get("depth_fix"))

# Avosys: sticlă, cu găuri de Ø12 în sticlă (nu în lemn)
f = F["hettich_avosys"]
av = base("hettich_avosys", "het_avosys", "Avosys", "glass", name=f["name"])
av["glass"] = True
av["noDrill"] = True
av["cup"] = {"dia": None, "depth": None, "depthMin": None, "tb": None, "src": (f["cup"] or {}).get("src")}
dv = list((f["cup"]["dowel"]).values())[0]
av["glassHoles"] = {"n": dv["holes"], "dia": dv["dia"], "spacing": dv["spacing_mm"], "src": dv["src"]}
av["fix"] = {}
av["plates"] = []
av["plateNote"] = f["plate"]["note"]
av["parts"] = []
for c in f["codes"]:
    glued = "glue" in c["desc"]
    av["parts"].append({"id": idof("het", c["code"]), "art": c["code"], "overlay": "overlay", "fix": "glued" if glued else "screw",
                        "soft": "Silent" in c["desc"], "spring": None, "push": False,
                        "colour": "obsidian" if "obsidian" in c["desc"] else ("nickel" if "nickel" in c["desc"] else None),
                        "variant": "glass-3-8" if glued else "glass-4-6", "pattern": None, "src": c["src"]})
av["adjust"] = adjust_of(f["arm"])
av["count"] = count_of(f)
av["protr"] = None
av["avosysTE"] = f["arm"].get("door_protrusion_TE_vs_plate_distance")
av["tables"] = []
av["open"] = open_of(f)
av["notes"] = list(f.get("options") or [])
av["src"] = "HET-AV-SHOP, HET-AV-MTA"
HET.append(av)

# ======================================================================================================== SALICE
SAL_ARMS = {"arm0": "full", "arm5": "overlay5", "arm9": "half", "arm17": "inset", "arm22": "inset"}
SAL_PAT = {"48": (48, 6), "45": (45, 9.5), "52": (52, 5.5)}


def sal_patterns(f):
    """spacing/offset din etichetele 48/6, 45/9.5, 52/5.5 (SAL-SIPLUS p17: 'drawing labels'; literele din cod A/P/U = 48/45/52, text)"""
    d = (f.get("cup") or {}).get("dowel") or {}
    pp = d.get("patterns") or {}
    out = {}
    for k, v in pp.items() if isinstance(pp, dict) else []:
        out[k.split("/")[0]] = (v["spacing"], v["offset"])
    return out


def sal_dowel_dia(f):
    return ((f.get("cup") or {}).get("dowel") or {}).get("dowel_dia") or {}


SAL_PLATES = [
    {"id": "salp_cross37_BAR", "kind": "cruciform", "name": "Cruciform 37x32 (BAR*), dowel o10x11.5", "line": 37, "pitch": 32, "lineSrc": "text",
     "hole": {"dia": 10, "depth": 11.5}, "art": ["BAR*"], "codes": None, "src": "SAL-PLATES p6-19"},
    {"id": "salp_cross37_BAV", "kind": "cruciform", "name": "Cruciform 37x32 (BAV*), dowel o10x10", "line": 37, "pitch": 32, "lineSrc": "text",
     "hole": {"dia": 10, "depth": 10}, "art": ["BAV*"], "codes": None, "src": "SAL-PLATES p6-19"},
    {"id": "salp_linear21_BAP", "kind": "linear", "name": "Domi snap-on straight 21+32 (BAP*), dowel o10x11.5", "line": 21, "pitch": 32, "lineSrc": "text",
     "hole": {"dia": 10, "depth": 11.5}, "art": ["BAP*"], "codes": None, "src": "SAL-PLATES p6-19"},
    {"id": "salp_cross28_S200", "kind": "cruciform", "name": "Traditional Series 200 cruciform 28x32", "line": 28, "pitch": 32, "lineSrc": "text",
     "hole": None, "art": ["Series 200"], "codes": None, "src": "SAL-PLATES p6-19"},
    {"id": "salp_cross37_S200", "kind": "cruciform", "name": "Traditional Series 200 cruciform 37x32", "line": 37, "pitch": 32, "lineSrc": "text",
     "hole": None, "art": ["Series 200"], "codes": None, "src": "SAL-PLATES p6-19"},
]
SAL_PLATE_IDS = [p["id"] for p in SAL_PLATES]
_sp = F["salice_silentia_s100_105"]["plate"]
SAL_PLATE_NOTE = {"heights_H_mm": _sp.get("heights_H_mm"), "fixing_hole": _sp.get("fixing_hole")}


def sal_family(fid, key, series, kind, arms_codes, **kw):
    f = F[fid]
    o = base(fid, key, series, kind, name=f["name"])
    o["glass"] = False
    o["noDrill"] = False
    o["cup"] = cup_of(f)
    pats = sal_patterns(f)
    dd = sal_dowel_dia(f)
    # fixarea „wood screw” (litere A/P/U = 48/45/52): șurub direct în lemn; modelul cupei = numai cupa + tuburile din cod
    o["fix"] = {"woodscrew": {"mode": "screw", "hole": None, "pattern": None}}
    o["plates"] = SAL_PLATE_IDS
    parts = []
    for arm, byp in arms_codes.items():
        for p, code in byp.items():
            sp = pats[p]
            parts.append({"id": idof("sal", code), "art": code, "overlay": SAL_ARMS[arm], "fix": "woodscrew", "soft": True,
                          "spring": None, "push": False, "colour": None, "variant": "arm" + arm[3:], "src": "SAL-SIPLUS p17",
                          "pattern": {"spacing": sp[0], "offset": sp[1], "src": "text", "dia": dd.get(p)}})
    o["parts"] = parts
    o["adjust"] = adjust_of(f["arm"])
    o["count"] = count_of(f)
    o["armFormulas"] = (f.get("arm") or {}).get("H_formulas_mm")
    o["tables"] = []
    g = f.get("gaps") or {}
    for k, t in g.items():
        if isinstance(t, dict) and "T" in t:
            cols = t["T"]
            rows = {}
            for kk, vv in t.items():
                if kk != "T" and isinstance(vv, list):
                    rows[kk] = vv
                elif kk.endswith("_by_K") and isinstance(vv, dict):
                    for K, arr in vv.items():
                        rows[kk[0] + " K=" + K] = arr
            o["tables"].append({"title": k, "rowLabel": "", "colLabel": "door T (mm)", "cols": cols, "rows": rows})
    o["formulaC"] = g.get("formula_C")
    o["protr"] = None
    o["open"] = open_of(f)
    o["notes"] = list(f.get("options") or [])
    o["envelopeLabels"] = (f.get("envelope") or {}).get("label_drawing_p15") or (f.get("envelope") or {}).get("label_drawing_p25")
    o["src"] = (f.get("cup") or {}).get("dowel", {}).get("src") or "SAL-SIPLUS"
    o.update(kw)
    return o


def codes_by(f, keymap):
    cb = f["arm"]["codes_by_arm"]
    out = {}
    for k, v in cb.items():
        if not isinstance(v, dict):
            continue
        m = re.match(r"(?:110deg_)?(arm\d+)", k)
        out[m.group(1)] = v
    return out


SAL = []
SAL.append(sal_family("salice_silentia_s100_105", "sal_s100", "Silentia+ S100", "standard", codes_by(F["salice_silentia_s100_105"], None)))
SAL.append(sal_family("salice_silentia_s200_94", "sal_s200_94", "Silentia+ S200", "thick", codes_by(F["salice_silentia_s200_94"], None)))
SAL.append(sal_family("salice_silentia_s200_155", "sal_s200_155", "Silentia+ S200", "zero", codes_by(F["salice_silentia_s200_155"], None)))
s7 = sal_family("salice_silentia_s700", "sal_s700_110", "Silentia+ S700", "standard", codes_by(F["salice_silentia_s700"], None),
                conflicts=["Series 700 155 deg: catalogue p49 lists the same codes as Series 200 155 (probable catalogue copy error): not catalogued"])
SAL.append(s7)

# S300 / N: formule de înălțime fără coduri transcrise → câte un articol pe braț, fără cod


def sal_nocode(fid, key, series, kind, armnames):
    f = F[fid]
    o = sal_family(fid, key, series, kind, {})
    o["parts"] = [{"id": key + "_" + a, "art": None, "overlay": SAL_ARMS[a], "fix": "woodscrew", "soft": True, "spring": None, "push": False,
                   "colour": None, "variant": "arm" + a[3:], "pattern": None, "src": "SAL-SIPLUS"} for a in armnames]
    return o


SAL.append(sal_nocode("salice_silentia_s300", "sal_s300", "Silentia+ S300", "thick", ["arm0"]))
n = sal_nocode("salice_silentia_N", "sal_sN", "Silentia+ N", "thick", ["arm0", "arm9", "arm22"])
n["conflicts"] = ["cup depth 15.5 (p80 text) vs 13.5 (p11 overview row)"]
SAL.append(n)

# Air: tăietură specială în ușă (fără cupă Ø35), braț în panou
f = F["salice_air"]
air = base("salice_air", "sal_air", "Air", "air", name=f["name"])
air.update({"glass": False, "noDrill": True, "cup": {"dia": None, "depth": num(f["cup"]["depth"]), "depthMin": None, "tb": pair(f["cup"]["tb"]), "src": "SAL-AIR p8"},
            "fix": {}, "plates": [], "adjust": None, "protr": None, "tables": [], "open": open_of(f), "notes": list(f["options"]), "src": "SAL-AIR p8,14"})
air["airMax"] = {"kg": f["arm"]["max_door_weight_kg"], "h": f["arm"]["max_door_mm"]["height"], "w": f["arm"]["max_door_mm"]["width"], "stop": f["arm"]["stop_device_deg"]}
air["count"] = None
air["parts"] = []
for c in f["codes"]:
    codes = [x.strip() for x in c["code"].split("/")]
    d = c["desc"]
    for x in codes:
        air["parts"].append({"id": idof("sal", x), "art": x, "overlay": "air", "fix": None, "soft": "soft" in d, "spring": "unsprung" if "unsprung" in d else None,
                             "push": "Push" in d or "push" in d, "colour": "nickel" if "nickel" in d else None, "variant": "set" if "bags" in d else None,
                             "pattern": None, "src": c["src"], "note": "D vs S letters not labelled (likely right/left, unverified)" if "D vs S" in d else None})
SAL.append(air)

# Vetro: sticlă
f = F["salice_vetro_universal_CBG"]
vu = base("salice_vetro_universal_CBG", "sal_cbg", "Vetro CBG", "glass", name=f["name"])
vu.update({"glass": True, "noDrill": True, "cup": {"dia": None, "depth": None, "depthMin": None, "tb": pair(f["cup"]["tb"]), "src": "SAL-UNIV p4"},
           "fix": {}, "plates": [], "adjust": None, "protr": None, "tables": [], "open": open_of(f), "notes": list(f["options"]), "src": "SAL-UNIV p3-4, SAL-VETRO"})
vu["count"] = count_of(f)
vu["parts"] = []
for x, nm in zip([y.strip() for y in f["codes"][0]["code"].split("/")], ["nickel", "titanium"]):
    vu["parts"].append({"id": idof("sal", x), "art": x, "overlay": "universal", "fix": "glued", "soft": True, "spring": None, "push": False, "colour": nm,
                        "variant": None, "pattern": None, "src": f["codes"][0]["src"]})
SAL.append(vu)

f = F["salice_vetro_series200_glass"]
v2 = base("salice_vetro_series200_glass", "sal_glass200", "Vetro S200", "glass", name=f["name"])
v2.update({"glass": True, "noDrill": True, "cup": {"dia": num(f["cup"]["dia"]), "depth": None, "depthMin": None, "tb": pair(f["cup"]["tb"]), "src": "SAL-VETRO"},
           "fix": {}, "plates": [], "adjust": None, "protr": None, "tables": [], "count": None, "open": open_of(f), "notes": list(f["options"]), "src": "SAL-VETRO p4-12",
           "parts": [{"id": "sal_glass200_nocode", "art": None, "overlay": "glass", "fix": "screw", "soft": False, "spring": "sprung", "push": False, "colour": None,
                      "variant": None, "pattern": None, "src": "SAL-VETRO"}]})
SAL.append(v2)

# pivot 270
f = F["salice_pivot_270"]
pv = sal_family("salice_pivot_270", "sal_pivot270", "Pivot 270", "pivot", {})
pv["parts"] = [{"id": "sal_CM3A99", "art": f["codes"][0]["code"], "overlay": "inset_half", "fix": "woodscrew", "soft": False, "spring": "sprung", "push": False, "colour": None,
                "variant": "270", "pattern": None, "src": f["codes"][0]["src"], "note": f["codes"][0]["desc"]}]
pv["envelopeLabels"] = f["envelope"]["cup_view_drawing_mm"]
pv["tables"] = [{"title": "R 270", "rowLabel": "", "colLabel": "", "cols": [], "rows": {k: v for k, v in f["gaps"]["R_table_270"].items() if k != "note"}}]
pv["open"] = open_of(f)
SAL.append(pv)

# corner 65
f = F["salice_corner_s200"]
cs = sal_family("salice_corner_s200", "sal_corner65", "Corner S200", "corner", {})
cs["parts"] = []
fixmap = [("wood screw", "woodscrew"), ("dowel", "dowel"), ("Rapido", "rapido")]
for c, (lab, fx) in zip(f["codes"], fixmap):
    arr = [x.strip() for x in c["code"].split("/")]
    for i, x in enumerate(arr):
        pat = None
        if fx == "woodscrew":
            p = ["48", "45", "52"][i]
            pat = {"spacing": SAL_PAT[p][0], "offset": SAL_PAT[p][1], "src": "text", "dia": None}
            sp = sal_patterns(f)[p]
            pat["spacing"], pat["offset"] = sp
        cs["parts"].append({"id": idof("sal", x), "art": x, "overlay": "corner", "fix": fx, "soft": False, "spring": None, "push": False, "colour": "nickel",
                            "variant": "65", "pattern": pat, "src": c["src"]})
cs["fix"] = {"woodscrew": {"mode": "screw", "hole": None, "pattern": None}, "dowel": {"mode": "dowel", "hole": None, "pattern": None},
             "rapido": {"mode": "rapido", "hole": None, "pattern": None}}
cs["tables"] = []
cs["cornerE"] = f["gaps"]["E_min_cross"]
cs["spaceNeeded"] = f["plate"]["space_needed_mm"]
cs["adjust"] = {"diagonal": f["arm"]["diagonal_adjust_mm"]}
SAL.append(cs)

# ======================================================================================================== GRASS
GRA_PLATES = []
gp = F["grass_tiomos_110"]["plate"]
GRA_PLATE_DEFS = [("cross37_screw", "cruciform", 37, "1D cross 37/32 screw-on"), ("cross37_Euro_o6.3", "cruciform", 37, "1D cross 37/32 Euro screws"),
                  ("cross37_premountedEuro", "cruciform", 37, "1D cross 37/32 premounted Euro screws"),
                  ("cross37_press_o10", "cruciform", 37, "1D cross 37/32 press-in o10"),
                  ("linear20_screw", "linear", 20, "1D linear 20/32 screw-on"), ("cross28_screw", "cruciform", 28, "1D cross 28/32 screw-on")]
for k, kind, line, nm in GRA_PLATE_DEFS:
    codes = gp["codes"][k]
    GRA_PLATES.append({"id": idof("grap", list(codes.values())[0]), "kind": kind, "name": nm, "line": line, "pitch": gp["hole_spacing_mm"], "lineSrc": "text",
                       "hole": None, "D": list(codes.keys()), "codes": codes, "art": list(codes.values()), "src": gp["src"], "note": None})
GRA_PLATE_IDS = [p["id"] for p in GRA_PLATES]


def gra_parts(f, lines):
    """lines: [(index cod, overlay, fix, soft, spring)] — intervalele 'F..519..F..522' rămân un singur articol (maparea crank ↔ cod nu e scrisă explicit)"""
    out = []
    for i, ov, fx, soft, spring in lines:
        c = f["codes"][i]
        for j, x in enumerate([y.strip() for y in c["code"].split("/")] if "/" in c["code"] else [c["code"]]):
            ovj = ov[j] if isinstance(ov, list) else ov
            out.append({"id": idof("gra", x), "art": x, "overlay": ovj, "fix": fx, "soft": soft, "spring": spring, "push": False, "colour": None,
                        "variant": None, "pattern": None, "src": c["src"], "note": c["desc"]})
    return out


def gra_family(fid, key, series, kind, parts, glass=False, noDrill=False, plates=True, **kw):
    f = F[fid]
    o = base(fid, key, series, kind, name=f["name"])
    c = f.get("cup") or {}
    o.update({"glass": glass, "noDrill": noDrill, "cup": {"dia": num(c.get("dia")), "depth": num(c.get("depth")), "depthMin": num(c.get("depth_min")),
                                                          "tb": pair(c.get("tb")), "src": c.get("src") or ""},
              "fix": {}, "plates": GRA_PLATE_IDS if plates else [], "parts": parts, "adjust": adjust_of_grass(f.get("arm")), "count": count_of(f),
              "protr": None, "open": open_of(f), "notes": list(f.get("options") or []), "src": c.get("src") or "GRA-CAT"})
    tabs = []
    g = f.get("gaps") or {}
    for k in ("min_gap_table", "min_reveal_table", "min_reveal", "min_gap"):
        t = g.get(k)
        if isinstance(t, dict) and "rows" in t:
            tt = table_of(k.replace("_", " ") + " (mm)", t, "door thickness", "C (TB)", "cols_C")
            if tt:
                tabs.append(tt)
    o["tables"] = tabs
    arm = f.get("arm") or {}
    env = f.get("envelope") or {}
    al = env.get("arm_length_mm_drawing") or arm.get("arm_length_mm_drawing") or env.get("arm_length_drawing")
    o["armLen"] = {"v": al, "src": "drawing"} if isinstance(al, (int, float)) else None
    o.update(kw)
    return o


def adjust_of_grass(arm):
    a = {}
    for k_src, k in (("adjust_side_mm", "side"), ("adjust_height_mm", "height"), ("adjust_depth_mm", "depth")):
        v = (arm or {}).get(k_src)
        if v is not None:
            a[k] = v
    return a or None


GRA = []
f = F["grass_tiomos_110"]
GRA.append(gra_family("grass_tiomos_110", "gra_tiomos110", "Tiomos 110", "standard",
    gra_parts(f, [(0, "crank0_3_9.5_19", "screw", True, None), (1, "crank0_3_9.5_19", None, False, "sprung"), (2, "crank0_3_9.5_19", None, False, "unsprung"),
                  (3, "crank0_3_9.5_19", "press", True, None), (4, "crank0_3_9.5_19", "impresso", True, None)]),
    cupPatterns={"spacing": f["cup"]["dowel"]["patterns"]["45/9.5"]["spacing"], "offset": f["cup"]["dowel"]["patterns"]["45/9.5"]["offset"], "src": "drawing"}))
f = F["grass_tiomos_95"]
GRA.append(gra_family("grass_tiomos_95", "gra_tiomos95", "Tiomos 95", "thick",
    gra_parts(f, [(0, "crank0_3_9.5_19", "screw", True, None), (1, "crank0_3_9.5_19", None, False, "sprung"), (2, "crank0_3_9.5_19", None, False, "unsprung")])))
f = F["grass_tiomos_160"]
GRA.append(gra_family("grass_tiomos_160", "gra_tiomos160", "Tiomos 160", "zero",
    gra_parts(f, [(0, "crank0_3_9.5", "screw", True, None), (1, "crank0_3_9.5", None, False, "sprung"), (2, "crank0_3_9.5", None, False, "unsprung")])))
f = F["grass_tiomos_110_AL"]
GRA.append(gra_family("grass_tiomos_110_AL", "gra_tiomos110al", "Tiomos 110 AL", "alu",
    gra_parts(f, [(0, "crank0_3_9.5_19", "screw", True, None)]), noDrill=True))
f = F["grass_tiomos_mirro"]
GRA.append(gra_family("grass_tiomos_mirro", "gra_mirro", "Tiomos Mirro", "glass",
    gra_parts(f, [(0, "glass", "glued", True, None), (1, "glass", "glued", False, "sprung"), (2, "glass", "glued", False, "unsprung")]), glass=True, noDrill=True))
f = F["grass_tiomos_95_GL_mini"]
GRA.append(gra_family("grass_tiomos_95_GL_mini", "gra_gl95mini", "Tiomos 95 GL Mini", "glass",
    gra_parts(f, [(0, "overlay3", "screw", False, None)]), glass=True, noDrill=True))
f = F["grass_nexis_impresso_04"]
GRA.append(gra_family("grass_nexis_impresso_04", "gra_nexis04", "Nexis Impresso 04", "standard",
    gra_parts(f, [(0, "full", None, True, "sprung"), (1, "half", None, True, "sprung"), (2, "inset", None, True, "sprung")])))
f = F["grass_nexis_impresso_22"]
GRA.append(gra_family("grass_nexis_impresso_22", "gra_nexis22", "Nexis Impresso 22", "standard",
    gra_parts(f, [(0, ["full", "half"], None, True, "sprung"), (1, ["full", "half"], None, True, "unsprung")])))
f = F["grass_nexis_impresso_65"]
GRA.append(gra_family("grass_nexis_impresso_65", "gra_nexis65", "Nexis Impresso 65", "zero",
    gra_parts(f, [(0, ["full", "half"], None, True, "sprung"), (1, "full", None, True, "unsprung")])))
# Nexis 22: liniile 0 și 1 conțin perechi full/half → se desfac
for fam in GRA:
    if fam["key"] in ("gra_nexis22", "gra_nexis65"):
        pass

# ======================================================================================================== HÄFELE
HAF_PLATES = [
    {"id": "hafp_cross37", "kind": "cruciform", "name": "Cruciform 37/32 two-part, +-2 mm height (Hospa or premounted Euro screws)", "line": 37, "pitch": 32,
     "lineSrc": "text", "hole": None, "art": [F["hafele_metalla_310_110"]["plate"]["cruciform_H0_code"]["black_Hospa"], F["hafele_metalla_310_110"]["plate"]["cruciform_H0_code"]["black_euro"],
                                               F["hafele_metalla_310_110"]["plate"]["cruciform_H0_code"]["nickel_Hospa"]],
     "codes": F["hafele_metalla_310_110"]["plate"]["cruciform_H0_code"], "src": "HAF-UK 23T9-16, 20, 26, 39", "note": None},
    {"id": "hafp_linear", "kind": "linear", "name": "Linear 2-hole H0 (311.70.730 black / 311.70.750 nickel)", "line": None, "pitch": None, "lineSrc": None, "hole": None,
     "art": ["311.70.730", "311.70.750"], "codes": None, "src": "HAF-UK 23T9-16", "note": "hole line/spacing not read"},
]
HAF_PLATE_IDS = [p["id"] for p in HAF_PLATES]


def haf_parts(f, lines):
    """lines: [(index, [colour...] sau None, overlay, soft, spring, push)]. Codurile se desfac pe '/' ; pattern-ul 45/9.5 sau 48/6 se citește din descriere (text)."""
    out = []
    for i, cols, ov, soft, spring, push in lines:
        c = f["codes"][i]
        raw = c["code"]
        # „311.04.651/251; 311.04.654/254” → două grupuri
        groups = [g.strip() for g in raw.split(";")]
        for gi, grp in enumerate(groups):
            codes = expand(grp)
            ovs = ov if isinstance(ov, list) else [ov]
            ovv = ovs[gi] if gi < len(ovs) else ovs[-1]
            pat = pat_from(c["desc"]) if re.search(r"\d+/\d", c["desc"]) else None
            for j, x in enumerate(codes):
                out.append({"id": idof("haf", x), "art": x, "overlay": ovv, "fix": None, "soft": soft, "spring": spring, "push": push,
                            "colour": (cols[j] if cols and j < len(cols) else None), "variant": None,
                            "pattern": {"spacing": pat[0], "offset": pat[1], "src": "text"} if pat else None, "src": c["src"], "note": c["desc"]})
    return out


def haf_family(fid, key, series, kind, parts, **kw):
    f = F[fid]
    c = f.get("cup") or {}
    o = base(fid, key, series, kind, name=f["name"])
    o.update({"glass": False, "noDrill": False,
              "cup": {"dia": num(c.get("dia")), "depth": num(c.get("depth")), "depthMin": num(c.get("depth_min")), "tb": pair(c.get("tb")), "src": c.get("src") or "HAF-UK"},
              "fix": {}, "plates": HAF_PLATE_IDS, "parts": parts, "adjust": adjust_of(f.get("arm")), "count": count_of(f), "protr": None,
              "open": open_of(f), "notes": list(f.get("options") or []), "src": "HAF-UK"})
    g = f.get("gaps") or {}
    tabs = []
    t = g.get("min_gap_table")
    if isinstance(t, dict):
        tt = table_of("min gap (mm)", t, "door thickness", "E (TB)", "cols_E")
        if tt:
            tabs.append(tt)
    o["tables"] = tabs
    o["conflicts"] = ["hinge count: example text '1500 mm, 8-12 kg = 3 hinges' vs weight band 6-9 for 3 hinges"]
    o.update(kw)
    return o


HAF = []
f = F["hafele_metalla_310_110"]
HAF.append(haf_family("hafele_metalla_310_110", "haf_310_110", "Metalla 310", "standard", haf_parts(f, [
    (0, ["black", "nickel"], "full", True, None, False), (1, ["black", "nickel"], "full", False, None, False),
    (2, None, "full", False, "unsprung", False), (3, None, "full", False, None, True), (4, None, "full", False, "unsprung", False),
    (5, ["black", "nickel"], ["half", "inset"], True, None, False)])))
f = F["hafele_metalla_540_110"]
HAF.append(haf_family("hafele_metalla_540_110", "haf_540_110", "Metalla 540", "standard", haf_parts(f, [
    (0, ["black", "nickel"], "full", True, "sprung", False), (1, ["black", "nickel"], "full", False, "unsprung", False),
    (2, ["black", "nickel"], "half", True, None, False), (3, ["black"], "inset", True, None, False)])))
f = F["hafele_metalla_310_155"]
HAF.append(haf_family("hafele_metalla_310_155", "haf_310_155", "Metalla 310 155", "zero", haf_parts(f, [
    (0, ["black", "nickel"], "full", True, None, False), (1, ["black", "nickel"], "full", False, None, False),
    (2, ["black", "nickel"], "inset", True, None, False)])))
f = F["hafele_165_standard"]
HAF.append(haf_family("hafele_165_standard", "haf_165", "165", "zero", haf_parts(f, [
    (0, None, "full", False, None, False), (1, None, "half", False, None, False)])))
f = F["hafele_270"]
HAF.append(haf_family("hafele_270", "haf_270", "270", "pivot", haf_parts(f, [(0, None, "full", False, None, False)])))
f = F["hafele_pie_cut_90"]
HAF.append(haf_family("hafele_pie_cut_90", "haf_piecut90", "Pie-cut 90", "corner", haf_parts(f, [(0, None, "corner", False, None, False)])))
for fam in HAF:
    fam["conflicts"] = fam.get("conflicts") or []
    for p in fam["parts"]:
        if p["art"] == "311.84.506":   # „unsprung / push 48/6”: al doilea cod e push (ordinea din descriere)
            p["spring"], p["push"] = None, True

# ======================================================================================================== BLUM
BLUM = []


def blum_parts(f, lines):
    out = []
    for i, ovs, fx, soft, spring, var in lines:
        c = f["codes"][i]
        raw = c["code"]
        codes = [x.strip() for x in raw.split("/")]
        for j, x in enumerate(codes):
            ov = ovs[j] if j < len(ovs) else None
            out.append({"id": idof("blum", x), "art": x, "overlay": ov, "fix": fx, "soft": soft, "spring": spring, "push": False, "colour": None,
                        "variant": var, "pattern": None, "src": c["src"], "note": c["desc"]})
    return out


f = F["blum_clip_top_blumotion_105"]
d = f["cup"]["dowel"]["expando_knock_in"]
b1 = base("blum_clip_top_blumotion_105", "blum_clip105", "CLIP top BLUMOTION 105", "standard", name=f["name"])
b1.update({"glass": False, "noDrill": False,
           "cup": {"dia": num(f["cup"]["dia"]), "depth": None, "depthMin": None, "tb": pair(f["cup"]["tb"]), "src": f["cup"]["dowel"]["src"]},
           "fix": {"screw": {"mode": "screw", "hole": None, "pattern": None},
                   "knockin": {"mode": "press", "hole": {"dia": d["dowel_dia"], "depth": None}, "pattern": {"spacing": d["spacing"], "offset": d["offset"], "src": "drawing"}},
                   "expando": {"mode": "premount", "hole": {"dia": d["dowel_dia"], "depth": None}, "pattern": {"spacing": d["spacing"], "offset": d["offset"], "src": "drawing"}}},
           "plates": "blum-clip", "adjust": {"note": "see source"}, "count": None, "protr": f["arm"]["protrusion_drawing_mm"],
           "open": open_of(f), "notes": list(f["options"]), "src": "BLUM-TD151 p2-4", "armLen": None})
b1["parts"] = blum_parts(f, [
    (0, ["overlay", "half", "inset"], "screw", True, "sprung", None), (1, ["overlay", "half", "inset"], "screw", False, "sprung", None),
    (2, ["overlay", "half", "inset"], "screw", False, "unsprung", None), (3, ["overlay", "half", "inset"], "knockin", True, "sprung", None),
    (4, ["overlay", "half", "inset"], "expando", True, "sprung", None)])
mt = f["gaps"]["min_gap_F"]
b1["tables"] = [{"title": "min gap F (mm)", "rowLabel": "TB", "colLabel": "FD", "cols": mt["cols_FD"], "rows": mt["rows_TB"]}]
b1["tbRule"] = f["gaps"]["TB_vs_FA_formulas"]
BLUM.append(b1)

f = F["blum_m_blumotion_105"]
b2 = base("blum_m_blumotion_105", "blum_m105", "M BLUMOTION 105", "standard", name=f["name"])
b2.update({"glass": False, "noDrill": False,
           "cup": {"dia": num(f["cup"]["dia"]), "depth": None, "depthMin": None, "tb": None, "src": "BLUM-M105-FL, BLUM-M105-MA"},
           "fix": {"screw": {"mode": "screw", "hole": None, "pattern": None}}, "plates": [], "plateNote": "plate pre-mounted on the hinge; hole line 37 from front edge, spacing 32 (drawing)",
           "adjust": {"note": "see source"}, "count": None, "protr": None, "tables": [], "open": open_of(f), "notes": list(f["options"]), "src": "BLUM-M105-FL p2", "armLen": None})
b2["parts"] = []
for i, (ovs, var, soft, spring) in enumerate([(["overlay", "half", "inset"], "MD0", True, "sprung"), (["overlay", "half", "inset"], "MD3", True, "sprung")]):
    c = f["codes"][i]
    for j, x in enumerate([y.strip() for y in c["code"].split("/")]):
        b2["parts"].append({"id": idof("blum", x), "art": x, "overlay": ovs[j], "fix": "screw", "soft": soft, "spring": spring, "push": False, "colour": None,
                            "variant": var, "pattern": None, "src": c["src"], "note": c["desc"]})
for i in (2, 3):
    c = f["codes"][i]
    x = c["code"].replace(" etc.", "")
    b2["parts"].append({"id": idof("blum", x), "art": x, "overlay": None, "fix": "screw", "soft": False, "spring": "sprung" if i == 2 else "unsprung", "push": False,
                        "colour": None, "variant": None, "pattern": None, "src": c["src"], "note": c["desc"]})
BLUM.append(b2)

# ======================================================================================================== scriere
NOTEWORD = {"Hettich": "Hettich", "Salice": "Salice", "Grass": "Grass", "Häfele": "Haefele", "Blum": "Blum"}
USED = {"Hettich": ["HET"], "Salice": ["SAL"], "Grass": ["GRA"], "Häfele": ["HAF"], "Blum": ["BLUM"]}


def write(brand, fn, fams, plates):
    pre = USED[brand][0]
    out = {"brand": brand, "sources": [s for s in RAW["sources"] if s["id"].startswith(pre)],
           "plates": plates, "families": fams, "notes": [n for n in RAW["notes"] if NOTEWORD[brand] in n]}
    json.dump(out, open(os.path.join(here, fn), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(fn, len(fams), "familii", sum(len(x["parts"]) for x in fams), "articole")


write("Hettich", "hettich.json", HET, HET_PLATES)
write("Salice", "salice.json", SAL, SAL_PLATES)
write("Grass", "grass.json", GRA, GRA_PLATES)
write("Häfele", "hafele.json", HAF, HAF_PLATES)
write("Blum", "blum.json", BLUM, [])
