#!/usr/bin/env python3
"""Ebanist U.17 — sisteme glisante / escamotabile / aripă (sliding, pocket, wing): aduce datele brute
(tools/hw-data/raw/cat-sliding.json, citite din documente oficiale) într-o schemă comună: tools/hw-data/sliding/sliding.json.
Nu inventează nimic: fiecare număr de aici e copiat din raw (sursa în `src`); ce lipsește rămâne None (null).
Codurile de comandă sunt verificate la rulare: fiecare cod (fără spații) trebuie să apară în textul raw
(cele scrise ca listă comprimată, ex. «.250/.350/.600», au în VER șirurile care trebuie să existe).

    python3 tools/hw-data/sliding/normalize.py          # scrie sliding.json
    node tools/sliding-build.mjs                        # verifică și scrie app/ebanist-sliding-data.js

Schema unui sistem (toate cotele în mm, kg per ușă; None = necitit):
  key, brand, name, kind ("slide"|"pocket"|"wing"), run ("top"|"bottom"|None), mount ("overlay"|"inset"|"mixed"|"flush"|"pocket"|None),
  leaves [min,max] (uși pe set; la „wing”: foi pe pachet), lim {kg,h,w,th: [lo,hi], wN, kgTh, hRatio}, dw (formula lățimii ușii), clr (jocuri sus/jos, [drawing]),
  tz (decalaj între șine, [drawing]), trk (lungimi standard), plan (pocket: parametri ai formulelor producătorului), bom (reguli), info (formule și note ca în sursă),
  conflicts, unreadable, src.
Toate cotele rămân verificat:false (convenția D-48): nimic nu e «verificat» înainte de o piesă reală.
"""
import json, os, re
here = os.path.dirname(os.path.abspath(__file__))
RAWP = os.path.join(here, "..", "raw", "cat-sliding.json")
RAWT = re.sub(r"[\s]", "", open(RAWP, encoding="utf-8").read())
raw = json.load(open(RAWP, encoding="utf-8"))
RS = {s["id"]: s for s in raw["systems"]}

FAIL = []
NEW = []
CODES = {}          # cod -> {code, role, brand, src, chk, p}
SYSTEMS = []

def norm(code): return re.sub(r"[\s]", "", code)

# coduri scrise în raw ca listă comprimată: șirurile care trebuie să existe în raw (altfel norm(cod) trebuie să existe)
VER = {}
for L_, s_ in ((2500, ".250"), (3500, ".350"), (6000, ".600")):
    for b_ in ("056.3011", "056.3010", "056.3174", "055.3171"): VER[b_ + s_] = [b_ + ".250/.350/.600"]
VER["055.3208.072"] = ["055.3208.071/.072"]; VER["055.3209.072"] = ["055.3209.071/.072"]
VER["056.3160.072"] = ["056.3160.071/.072/.073"]; VER["056.3160.073"] = ["056.3160.071/.072/.073"]
for c_, s_ in (("402.33.643", "402.33.642/.643"), ("402.33.653", "402.33.652/.653"), ("402.30.643", "402.30.642/.643"), ("402.30.653", "402.30.652/.653"),
               ("402.30.803", "402.30.802/.803"), ("402.23.803", "402.23.802/.803"), ("402.23.603", "402.23.602/.603"), ("402.26.623", "402.26.622/.623"),
               ("402.31.655", "402.31.654/.655"), ("402.31.633", "402.31.632/.633"), ("402.31.843", "402.31.842/.843"), ("401.30.610", "401.30.609/.610"),
               ("401.30.613", "401.30.611/.613"), ("401.30.615", "401.30.614/.615")):
    VER[c_] = [s_]
for c_ in ("402.30.123", "402.30.303", "402.30.321", "402.30.220"): VER[c_] = ["402.30.107/.123/.303/.321/.220"]
VER["402.30.107"] = ["402.30.107/.123/.303/.321/.220"]
for c_ in ("408.25.001", "408.25.002", "408.25.003", "408.25.004", "408.25.005", "408.25.006"): VER[c_] = ["408.25.000"]
for c_ in ("940.58.006",): VER[c_] = ["940.58.005/940.58.006"]
for c_ in ("406.02.096", "406.02.097"): VER[c_] = ["406.02.095/.096/.097"]
for c_ in ("402.31.036", "402.31.038"): VER[c_] = ["402.31.034/.036/.038"]
VER["402.31.034"] = ["402.31.034/.036/.038"]
for c_ in ("407.40.091", "407.40.092", "407.40.093", "407.40.094", "407.40.095", "407.40.096", "407.40.097"): VER[c_] = ["407.40.097/407.40.093"]
VER["407.40.090"] = ["407.40.090..097"]
VER["401.30.016"] = ["401.30.017/401.30.016"]
for c_ in ("0 026 082", "0 026 083"): VER[c_] = ["0026081/0026082/0026083"]
VER["0 026 081"] = ["0026081/0026082/0026083"]
for c_ in ("0 041 373", "0 041 374", "0 041 375", "0 041 376", "0 041 377", "0 041 378", "0 041 379"): VER[c_] = ["0041372"]
for c_ in ("53521", "53523", "53525", "30995", "30997", "30999", "31001", "53439", "53443", "53441", "53445", "53449", "53451", "53453", "27651"):
    pass
for c_ in ("9 242 709", "9 242 710", "9 242 712", "9 242 713"): VER[c_] = ["9242708/9242709/9242710", "9242711/9242712/9242713"]
VER["9 242 708"] = ["9242708/9242709/9242710"]; VER["9 242 711"] = ["9242711/9242712/9242713"]
# Blum: liste comprimate cu sufixe .L3/.R3
for nl in (450, 500, 600, 700, 800):
    for sd in "LR": VER["801P%dE.%s3" % (nl, sd)] = ["801P%dE" % nl]
for nl in (450, 525, 600, 675, 750):
    for sd in "LR": VER["802P%dD.%s3" % (nl, sd)] = ["802P450D/525D/600D/675D/750D"]
for n_ in (1140, 1350, 1500, 1650, 1800, 1950, 2100, 2250, 2400, 2550, 2700, 2850):
    for sd in "LR":
        VER["801T%d.%s3" % (n_, sd)] = ["801T1140/1350/1500/1650/1800/1950/2100/2250/2400/2550/2700/2850" if n_ > 1140 else "801T1140/1350"]
        VER["802T%d.%s3" % (n_, sd)] = ["802T1140..802T2850"]
for sd in "LR":
    VER["801V605B.%s1" % sd] = ["801V605B.L1/.R1"]; VER["801V705B.%s3" % sd] = ["801V705B.L3/.R3"]
    VER["802V660B.%s1" % sd] = ["802V660B/802V680B(.L1/.R1)"]; VER["802V680B.%s1" % sd] = ["802V660B/802V680B(.L1/.R1)"]
    VER["802V760B.%s3" % sd] = ["802V760B/802V780B(.L3/.R3)"]; VER["802V780B.%s3" % sd] = ["802V760B/802V780B(.L3/.R3)"]
    VER["802M0002.%s2" % sd] = ["802M0002.L2/.R2"]
for L_ in (1050, 1200, 1250, 1350):
    for sd in "LR": VER["802L%dD%s3" % (L_, sd)] = ["802L%dDL3/DR3" % L_]
VER["802V560B"] = ["802V560B/802V580B"]; VER["802V580B"] = ["802V560B/802V580B"]
VER["661.1450.HG"] = ["661.1450.HG/664.3500"]

def K(code, role, brand, src, chk=False, **p):
    """un cod de comandă din catalog; verificat în textul raw"""
    need = VER.get(code) or [norm(code)]
    for n_ in need:
        if n_ not in RAWT: FAIL.append((code, n_))
    if code not in CODES:
        CODES[code] = {"code": code, "role": role, "brand": brand, "src": src, "chk": bool(chk), "p": p, "sys": [], "ver": need}
        NEW.append(code)
    return code

def OPT(code, **when): return {"code": code, "when": when}
def LINE(opts, q=1, label=None, chk=False, opt=False):
    return {"opts": opts, "q": q, "label": label, "chk": chk, "opt": opt}

def S(key, brand, name, kind, **kw):
    s = {"key": key, "brand": brand, "name": name, "kind": kind, "run": None, "mount": None, "leaves": None, "lim": {}, "dw": None,
         "clr": None, "tz": None, "trk": None, "plan": None, "bom": [], "info": [], "conflicts": [], "unreadable": [], "src": "", "verificat": False}
    s.update(kw); SYSTEMS.append(s)
    for c in NEW:
        if not CODES[c]["sys"]: CODES[c]["sys"] = [name]
    del NEW[:]
    return s

def I(k, t, src=None): return {"k": k, "t": t, "src": src}

# =====================================================================================================  HETTICH
HB = "Hettich"
# ---- TopLine XL (top-hung, overlay, 2-track, 2/3/4 doors)
r = RS["het-topline-xl"]
K("9 275 796", "setRun", HB, "cat p.9", n=2, th=[18, 30], kg=60); K("9 275 786", "setRun", HB, "cat p.9", n=3, th=[18, 30], kg=60); K("9 278 780", "setRun", HB, "cat p.9", n=4, th=[18, 30], kg=60)
K("9 275 794", "setRun", HB, "cat p.9", n=2, th=[22, 30], kg=80); K("9 275 785", "setRun", HB, "cat p.9", n=3, th=[22, 30], kg=80); K("9 278 791", "setRun", HB, "cat p.9", n=4, th=[22, 30], kg=80)
K("9 275 787", "setRun", HB, "cat p.9", n=2, th=[32, 40], kg=100); K("9 275 783", "setRun", HB, "cat p.9", n=3, th=[32, 40], kg=100)
K("9 276 735", "silent", HB, "cat p.9", n=2, kg=[15, 35]); K("9 276 645", "silent", HB, "cat p.9", n=3, kg=[15, 35]); K("9 278 798", "silent", HB, "cat p.9", n=4, kg=[15, 35])
K("9 276 732", "silent", HB, "cat p.9", n=2, kg=[30, 80]); K("9 276 643", "silent", HB, "cat p.9", n=3, kg=[30, 80]); K("9 278 799", "silent", HB, "cat p.9", n=4, kg=[30, 80])
K("9 276 737", "silent", HB, "cat p.9", n=2, kg=[60, 100]); K("9 276 646", "silent", HB, "cat p.9", n=3, kg=[60, 100])
K("9 278 657", "profileSet", HB, "cat p.9", len=4000); K("9 278 801", "coverProfile", HB, "cat p.10", len=2000)
K("9 209 403", "tape", HB, "cat p.10", len=4000, col="black"); K("9 209 405", "tape", HB, "cat p.10", len=4000, col="white")
K("9 252 651", "adjust", HB, "cat p.10")
S("het_topline_xl", HB, "TopLine XL", "slide", run="top", mount="overlay", leaves=[2, 4],
  lim={"kg": [None, 100], "kgTh": [{"th": [18, 30], "kg": 60}, {"th": [22, 30], "kg": 80}, {"th": [32, 40], "kg": 100}],
       "h": [None, 3000], "w": [600, 2000], "wN": {"2": [600, 1000], "3": [750, 1350], "4": [650, 1000]}, "th": [18, 40], "hRatio": 3},
  clr={"top": 45, "bottom": 65, "drawing": True}, tz=8,
  trk={"std": [4000], "cut": None},
  bom=[LINE([OPT("9 275 796", n=[2], th=[18, 30], kgMax=60), OPT("9 275 794", n=[2], th=[22, 30], kgMax=80), OPT("9 275 787", n=[2], th=[32, 40], kgMax=100),
             OPT("9 275 786", n=[3], th=[18, 30], kgMax=60), OPT("9 275 785", n=[3], th=[22, 30], kgMax=80), OPT("9 275 783", n=[3], th=[32, 40], kgMax=100),
             OPT("9 278 780", n=[4], th=[18, 30], kgMax=60), OPT("9 278 791", n=[4], th=[22, 30], kgMax=80)], 1, "set"),
       LINE([OPT("9 276 735", n=[2], kgMax=35), OPT("9 276 732", n=[2], kgMax=80), OPT("9 276 737", n=[2], kgMax=100),
             OPT("9 276 645", n=[3], kgMax=35), OPT("9 276 643", n=[3], kgMax=80), OPT("9 276 646", n=[3], kgMax=100),
             OPT("9 278 798", n=[4], kgMax=35), OPT("9 278 799", n=[4], kgMax=80)], 1, "silent"),
       LINE([OPT("9 278 657")], {"len": 4000}, "profile"), LINE([OPT("9 252 651")], {"per": "door"}, "adjust")],
  info=[I("hint_noDoorFormula", "TopLine XL"), I("drawing", "top clearance ≥ 45 · bottom clearance ≥ 65 (drawing)", "cat p.7"), I("drawing", "door offset between tracks 8 (drawing)", "cat p.7"),
        I("rule", "TH ≤ 3 × TB", "cat p.6 graph"), I("rule", "centre support if cabinet width ≥ 1000 (drawing)", "cat p.7")],
  conflicts=["h:2600|3000", "w:600-2000|spec"], unreadable=r["unreadable"], src="HET-CAT21 cat p.3,6,7,9,10; HET-TLXL-PS")

# ---- TopLine L (2 or 3 doors)
r = RS["het-topline-l"]
K("9 242 708", "setRun", HB, "cat p.17", n=2, th=[10, 16], kg=50, side="L"); K("9 242 709", "setRun", HB, "cat p.17", n=2, th=[10, 16], kg=50, side="R"); K("9 242 710", "setRun", HB, "cat p.17", n=3, th=[10, 16], kg=50)
K("9 242 711", "setRun", HB, "cat p.17", n=2, th=[18, 30], kg=50, side="L"); K("9 242 712", "setRun", HB, "cat p.17", n=2, th=[18, 30], kg=50, side="R"); K("9 242 713", "setRun", HB, "cat p.17", n=3, th=[18, 30], kg=50)
K("9 242 238", "softClose", HB, "cat p.17", n=2, kg=50); K("9 242 240", "softClose", HB, "cat p.17", n=3, kg=50)
K("9 277 096", "softClose", HB, "cat p.17", n=2, kg=20); K("9 277 098", "softClose", HB, "cat p.17", n=3, kg=20)
K("9 242 227", "softOpen", HB, "cat p.17", n=2, kg=50); K("9 242 228", "softOpen", HB, "cat p.17", n=3, kg=50)
K("9 277 151", "softOpen", HB, "cat p.17", n=2, kg=20); K("9 277 152", "softOpen", HB, "cat p.17", n=3, kg=20)
K("9 254 630", "softColl", HB, "cat p.17", n=3); K("9 277 167", "profileSet", HB, "cat p.17", len=4000); K("9 277 440", "coverProfile", HB, "cat p.18", len=1500)
K("9 277 153", "thinDoor", HB, "cat p.18", th=[10, 12]); K("9 209 271", "tape", HB, "cat p.18", len=4000, col="black"); K("9 209 273", "tape", HB, "cat p.18", len=4000, col="white")
K("9 280 180", "adjustThin", HB, "cat p.19")
S("het_topline_l", HB, "TopLine L", "slide", run="top", mount="overlay", leaves=[2, 3],
  lim={"kg": [None, 50], "h": [None, 2600], "w": [550, 1500], "th": [10, 30]},
  clr={"top": 40, "bottom": None, "drawing": True},
  trk={"std": [4000], "cut": None},
  bom=[LINE([OPT("9 242 711", n=[2], th=[18, 30], side="L"), OPT("9 242 712", n=[2], th=[18, 30], side="R"), OPT("9 242 713", n=[3], th=[18, 30]),
             OPT("9 242 708", n=[2], th=[10, 16], side="L"), OPT("9 242 709", n=[2], th=[10, 16], side="R"), OPT("9 242 710", n=[3], th=[10, 16])], 1, "set"),
       LINE([OPT("9 277 167")], {"len": 4000}, "profile"), LINE([OPT("9 252 651", thMin=13), OPT("9 280 180")], {"per": "door"}, "adjust")],
  info=[I("hint_noDoorFormula", "TopLine L"), I("drawing", "top clearance ≥ 40 (drawing)", "cat p.15"), I("rule", "door thickness 10-12 mm needs thin-door set 9 277 153", "cat p.18")],
  conflicts=["w:550-1500|550-1350"], unreadable=r["unreadable"], src="HET-CAT21 cat p.3,14,15,17,18,19")

# ---- SlideLine M overlay (1 runner, bottom running)
r = RS["het-slideline-m-overlay"]
K("9 201 921", "setRun", HB, "cat p.27", kg=10, silent=True, minW=450); K("9 156 338", "setRun", HB, "cat p.27", kg=30, silent=True, minW=450); K("9 156 339", "setRun", HB, "cat p.27", kg=30, silent=False, minW=300)
for prof, c2, c1 in (("16", "9 209 166", "9 209 224"), ("18", "9 209 218", "9 209 226"), ("25", "9 209 222", "9 209 231")):
    K(c2, "profileSet", HB, "cat p.27", prof=int(prof), tracks=2, len=4000); K(c1, "profileSet", HB, "cat p.27", prof=int(prof), tracks=1, len=4000)
S("het_slideline_m_ov", HB, "SlideLine M (overlay)", "slide", run="bottom", mount="overlay", leaves=[2, 3],
  lim={"kg": [None, 30], "h": [300, 2000], "w": [300, 1800], "th": [16, 25], "hRatio": 2},
  trk={"std": [4000], "cut": "profile can be cut in two for top and bottom (cat p.27)"},
  bom=[LINE([OPT("9 201 921", kgMax=10, wMin=450), OPT("9 156 338", kgMax=30, wMin=450), OPT("9 156 339", kgMax=30)], {"per": "door"}, "set"),
       LINE([OPT("9 209 166", sth=[15, 16]), OPT("9 209 218", sth=[18, 19]), OPT("9 209 222", sth=[25])], 1, "profile2")],
  info=[I("hint_noDoorFormula", "SlideLine M"), I("rule", "H ≤ 2 × TB", "cat p.20-25"), I("rule", "centre reveal F = 10 mm (standard drilling)", "cat p.23"),
        I("rule", "min door width 450 with Silent, 300 without", "cat p.27")],
  unreadable=r["unreadable"], src="HET-CAT21 cat p.20-27")

# ---- SlideLine M inset
r = RS["het-slideline-m-inset"]
K("9 227 245", "profile2", HB, "cat p.35", chk=True, len=2500); K("9 227 246", "profile1", HB, "cat p.35", chk=True, len=2500)
K("9 227 183", "profile2", HB, "cat p.35", chk=True, len=2500, screw=True); K("9 227 188", "profile1", HB, "cat p.35", chk=True, len=2500, press=True)
K("9 229 240", "screwSet", HB, "cat p.35", sth=[16]); K("9 229 241", "screwSet", HB, "cat p.35", sth=[18, 19]); K("9 229 243", "screwSet", HB, "cat p.35", sth=[25])
K("9 227 006", "tapeAdh", HB, "cat p.35")
S("het_slideline_m_in", HB, "SlideLine M (inset)", "slide", run="bottom", mount="inset", leaves=[2, 3],
  lim={"kg": [None, 30], "h": [None, 2000], "w": [300, 1800], "th": [16, 25], "hRatio": 2},
  trk={"std": [2500], "cut": None},
  bom=[LINE([OPT("9 201 921", kgMax=10, wMin=450), OPT("9 156 338", kgMax=30, wMin=450), OPT("9 156 339", kgMax=30)], {"per": "door"}, "set"),
       LINE([OPT("9 227 245")], 1, "profile2", chk=True),
       LINE([OPT("9 229 240", sth=[16]), OPT("9 229 241", sth=[18, 19]), OPT("9 229 243", sth=[25])], 1, "screws")],
  info=[I("hint_noDoorFormula", "SlideLine M"), I("rule", "H ≤ 2 × TB", "cat p.28-33"), I("drawing", "2-track profile width 65 (drawing)", "cat p.33")],
  unreadable=r["unreadable"], src="HET-CAT21 cat p.28-36")

# ---- SlideLine 55 Plus (overlay / inset)
r = RS["het-slideline-55-plus"]
K("9 115 219", "runComp", HB, "cat p.45", mount="inset"); K("9 115 954", "runComp", HB, "cat p.45", mount="overlay")
K("9 115 217", "guideComp", HB, "cat p.45", mount="inset"); K("9 115 955", "guideComp", HB, "cat p.45", mount="overlay")
K("9 119 584", "silent", HB, "cat p.45", side="L", mount="inset"); K("9 119 585", "silent", HB, "cat p.45", side="R", mount="inset")
K("9 118 477", "stopNails", HB, "cat p.46", chk=True); K("9 115 218", "stayClosed", HB, "cat p.46"); K("9 136 109", "activator", HB, "cat p.47"); K("9 115 216", "doorStop", HB, "cat p.47")
K("0 025 120", "profilePlastic", HB, "cat p.46", kg=15, len=4000, col="white"); K("0 025 121", "profilePlastic", HB, "cat p.46", kg=15, len=4000, col="brown"); K("0 061 546", "profilePlastic", HB, "cat p.46", kg=15, len=4000, col="grey")
K("1 079 090", "profileAlu", HB, "cat p.47", kg=30, len=4000)
for mnt, run, gui in (("ov", "9 115 954", "9 115 955"), ("in", "9 115 219", "9 115 217")):
    S("het_slideline_55_" + mnt, HB, "SlideLine 55 Plus (" + ("overlay" if mnt == "ov" else "inset") + ")", "slide", run="bottom", mount="overlay" if mnt == "ov" else "inset", leaves=[1, 2],
      lim={"kg": [None, 30], "h": [700, 1500], "w": [400, 2000], "th": [16, 19]},
      trk={"std": [4000], "cut": None},
      bom=[LINE([OPT(run)], {"per": "door", "x": 2}, "run"), LINE([OPT(gui)], {"per": "door"}, "guide"),
           LINE([OPT("0 025 120", kgMax=15), OPT("1 079 090", kgMax=30)], {"len": 4000}, "profile", chk=True),
           LINE([OPT("9 115 218")], {"per": "door", "x": 4}, "stayClosed", opt=True)],
      info=[I("hint_noDoorFormula", "SlideLine 55 Plus"), I("rule", "profile: plastic 15 kg · aluminium 30 kg", "cat p.46-47"), I("rule", "door stop 9 115 216: 1 for 2 doors H<1000, 2 for H>1000", "cat p.47")],
      unreadable=r["unreadable"], src="HET-CAT21 cat p.28,40,41,45-47")

# ---- TopLine 25 / 27 (inset, top-hung)
r = RS["het-topline-25-27"]
K("0 026 081", "setTop", HB, "cat p.53", chk=True, n=1, kg=25); K("0 026 082", "setTop", HB, "cat p.53", chk=True, n=2, kg=25); K("0 026 083", "setTop", HB, "cat p.53", chk=True, n=3, kg=25)
K("9 323 120", "setTopSilent", HB, "cat p.53", n=2, kg=20); K("0 045 080", "guideSetSTB", HB, "cat p.54", n=2); K("0 045 081", "guideSetSTB", HB, "cat p.54", n=3)
K("0 071 117", "guideProfile", HB, "cat p.54", len=3000); K("0 046 416", "profile1", HB, "cat p.52", len=3500); K("0 046 417", "profile2", HB, "cat p.52", len=3500)
S("het_topline_25_27", HB, "TopLine 25 / 27", "slide", run="top", mount="inset", leaves=[1, 3],
  lim={"kg": [None, 25], "h": [None, 2000], "w": [500, 1750], "th": [16, 19]},
  trk={"std": [3500], "cut": None},
  bom=[LINE([OPT("0 026 081", n=[1]), OPT("0 026 082", n=[2]), OPT("0 026 083", n=[3])], 1, "set", chk=True),
       LINE([OPT("0 046 416", n=[1]), OPT("0 046 417", n=[2, 3])], {"len": 3500}, "profile"),
       LINE([OPT("0 045 080", n=[2]), OPT("0 045 081", n=[3])], 1, "guide")],
  info=[I("hint_noDoorFormula", "TopLine 25/27"), I("rule", "TL25: 1 door · TL27: 2 or 3 doors", "cat p.50-53"), I("rule", "20 kg with Silent set 9 323 120", "cat p.28")],
  unreadable=r["unreadable"], src="HET-CAT21 cat p.28,50-54")

# ---- KA 5740 retractable door (pocket)
r = RS["het-ka-5740"]
NLS = [350, 400, 450, 500, 550, 600, 650, 700]
B1 = {350: 352, 400: 402, 450: 452, 500: 502, 550: 552, 600: 602, 650: 652, 700: 702}
B2 = {350: 256, 400: 306, 450: 356, 500: 406, 550: 456, 600: 506, 650: 556, 700: 606}
kacodes = {350: "0 041 372", 400: "0 041 373", 450: "0 041 374", 500: "0 041 375", 550: "0 041 376", 600: "0 041 377", 650: "0 041 378", 700: "0 041 379"}
for nl, c in kacodes.items(): K(c, "doorSetPair", HB, "cat p.61", wMax=nl)
K("9 079 526", "accSet", HB, "cat p.61")
S("het_ka_5740", HB, "KA 5740", "pocket", mount="pocket", leaves=[1, 1],
  lim={"kg": [None, 8], "h": [600, 1500], "w": [300, 600], "th": [16, 19]},
  plan={"type": "ka5740", "dH": 6, "dW": 7, "yAdd": 2, "zMin": 3, "nl": NLS, "b1": {str(k): v for k, v in B1.items()}, "b2": {str(k): v for k, v in B2.items()}},
  bom=[LINE([OPT(kacodes[nl], wUp=nl) for nl in NLS], 1, "set"), LINE([OPT("9 079 526")], 1, "acc")],
  info=[I("formula", "H = LKH − 6", "cat p.59"), I("formula", "B = LKB − 7", "cat p.59"), I("formula", "Y = TD + 2", "cat p.59"), I("formula", "MKT = B1 + Y + Z (Z ≥ 3)", "cat p.59"),
        I("drawing", "runner plate 11 / 64 / 91 / 48 from door edge, E ≥ 60 from the ends (drawing)", "cat p.59")],
  unreadable=r["unreadable"], src="HET-CAT21 cat p.58-61")

# ---- WingLine L (wing); S / 230 / Wing 77 limits only
r = RS["het-wingline-l"]
K("9 277 991", "runWing", HB, "cat p.72", kg=12, guide=True, side="L", col="grey"); K("9 278 004", "runWing", HB, "cat p.72", kg=12, guide=True, side="R", col="grey")
K("9 278 005", "runWing", HB, "cat p.72", kg=12, guide=True, side="L", col="white"); K("9 278 007", "runWing", HB, "cat p.72", kg=12, guide=True, side="R", col="white")
K("9 278 485", "runWing", HB, "cat p.72", kg=25, guide=True, side="L", col="grey", pull=True); K("9 278 486", "runWing", HB, "cat p.72", kg=25, guide=True, side="R", col="grey", pull=True)
K("9 278 487", "runWing", HB, "cat p.72", kg=25, guide=True, side="L", col="white", pull=True); K("9 278 488", "runWing", HB, "cat p.72", kg=25, guide=True, side="R", col="white", pull=True)
K("9 278 260", "runWing", HB, "cat p.72", kg=12, guide=True, side="L", col="grey", push=True); K("9 278 285", "runWing", HB, "cat p.72", kg=12, guide=True, side="R", col="grey", push=True)
K("9 278 571", "runWing", HB, "cat p.72", chk=True, kg=25, guide=True, side="L", col="grey", push=True); K("9 278 580", "runWing", HB, "cat p.72", chk=True, kg=25, guide=True, side="R", col="grey", push=True)
K("9 278 610", "runWing", HB, "cat p.72", kg=12, guide=False, side="L", col="grey"); K("9 278 611", "runWing", HB, "cat p.72", kg=12, guide=False, side="R", col="grey")
K("9 237 917", "runnerProfile", HB, "cat p.76", len=2400, col="silver"); K("9 244 904", "runnerProfile", HB, "cat p.76", len=2400, col="white")
K("9 237 990", "guideProfile", HB, "cat p.76", len=2400, col="silver"); K("9 244 905", "guideProfile", HB, "cat p.76", len=2400, col="white"); K("9 298 326", "mountClip", HB, "cat p.76")
K("9 278 694", "hingeSetWing", HB, "cat p.74", hinges=2, fix="screw"); K("9 278 788", "hingeSetWing", HB, "cat p.74", hinges=2, fix="press")
K("9 278 742", "hingeSetWing", HB, "cat p.74", hinges=3, fix="screw"); K("9 278 787", "hingeSetWing", HB, "cat p.74", hinges=3, fix="press")
K("9 236 926", "damper", HB, "cat p.75", col="grey"); K("9 283 267", "damper", HB, "cat p.75", col="white")
K("9 237 710", "stayOpen", HB, "cat p.75", side="L"); K("9 237 711", "stayOpen", HB, "cat p.75", side="R"); K("9 236 460", "protClip", HB, "cat p.75")
for c, w, sd in (("9 238 120", "light", "L"), ("9 238 119", "light", "R"), ("9 238 121", "medium", "L"), ("9 238 124", "medium", "R"), ("9 238 123", "heavy", "L"), ("9 238 122", "heavy", "R")):
    K(c, "pullMove", HB, "cat p.77", duty=w, side=sd)
for c, w, sd in (("9 266 113", "light", "L"), ("9 266 111", "light", "R"), ("9 265 960", "medium", "L"), ("9 266 112", "medium", "R"), ("9 265 959", "heavy", "L"), ("9 265 958", "heavy", "R")):
    K(c, "pushMove", HB, "cat p.78", duty=w, side=sd)
K("9 282 527", "stayClosedMech", HB, "cat p.78"); K("9 282 901", "stayClosedMagD", HB, "cat p.78", setBack=8); K("9 282 900", "stayClosedMagS", HB, "cat p.78", setBack=13)
S("het_wingline_l", HB, "WingLine L", "wing", leaves=[2, 2],
  lim={"kg": [None, 25], "h": [500, 2400], "w": [250, 600], "th": [16, 25], "hNoGuideKg12": 1700},
  trk={"std": [2400], "cut": None},
  plan={"type": "wing", "hingesByH": [[1000, 8, 2], [1700, 14, 3], [2200, 17, 4], [2400, 25, 5]]},
  bom=[LINE([OPT("9 277 991", kgMax=12, side="L"), OPT("9 278 004", kgMax=12, side="R"), OPT("9 278 485", kgMax=25, side="L"), OPT("9 278 486", kgMax=25, side="R")], {"per": "pack"}, "run"),
       LINE([OPT("9 237 917")], {"per": "pack"}, "profile", chk=True), LINE([OPT("9 237 990")], {"per": "pack"}, "guideProfile", chk=True),
       LINE([OPT("9 236 926")], {"per": "pack"}, "damper", opt=True)],
  info=[I("rule", "hinges per wing: 2 ≤ 1000 mm / 8 kg · 3 ≤ 1700 / 14 · 4 ≤ 2200 / 17 · 5 ≤ 2400 / 25", "cat p.66-67"),
        I("rule", "wing 12 kg without bottom guide: height ≤ 1700; bottom guide recommended from 12 kg", "cat p.67"),
        I("drawing", "top 38 / 30.5 / 23 / 2 / 25 / 40 · bottom 26 / 16 / 26.5 / ≥ 55 / ≥ 15 / 40 (drawing, meaning not labelled)", "cat p.67")],
  unreadable=r["unreadable"], src="HET-CAT21 cat p.66-78")
for kk, nm in (("het-wingline-s", "WingLine S"), ("het-wingline-230", "WingLine 230"), ("het-wing-77", "Wing 77")):
    r = RS[kk]; L = r["limits"]
    lim = {"wingLimitsOnly": 1}
    if kk == "het-wingline-s": lim.update({"kg": [None, 5], "h": [None, 1000], "w": [250, 450], "th": [16, 22]})
    if kk == "het-wingline-230": lim.update({"h": [None, 3000], "w": [400, 600], "th": [16, 25]})
    if kk == "het-wing-77": lim.update({"h": [1000, 2400], "w": [400, 500], "th": [16, 19]})
    S("het_" + kk.split("het-")[1].replace("-", "_"), HB, nm, "wing", leaves=[2, 2], lim=lim, bom=[],
      info=[I("limitsOnly", nm)] + ([I("rule", "cabinet inside width ≤ 800 mm", "cat p.103")] if kk == "het-wing-77" else []),
      unreadable=r["unreadable"], src=L.get("src", "HET-CAT21"))

# =====================================================================================================  HAWA
WB = "Hawa"
for L_, s_ in ((2500, ".250"), (3500, ".350"), (6000, ".600")):
    K("056.3011" + s_, "trackSingle", WB, "cat p.13", len=L_); K("056.3010" + s_, "trackDouble", WB, "cat p.13", len=L_)
    K("056.3174" + s_, "clipPanel", WB, "cat p.13", len=L_); K("055.3171" + s_, "guideTrackPlastic", WB, "cat p.13", len=L_)
K("055.3091.071", "softCloseHawa", WB, "cat p.14", kg=[None, 18], pcs=2); K("055.3091.073", "softCloseHawa", WB, "cat p.14", kg=[18, 40])
K("056.3039.001", "clipComp", WB, "cat p.14", every=500); K("053.3207.071", "centering", WB, "cat p.14", n=2)
K("056.3180.071", "setCombIS", WB, "cat p.13", n=2, size=20); K("056.3181.071", "setCombMS", WB, "cat p.17", n=2, size=20); K("056.3182.071", "setCombFS", WB, "cat p.21", n=2, size=20)
K("056.3180.073", "setCombIS", WB, "cat p.26", n=2, size=35); K("056.3180.077", "setCombIS", WB, "cat p.26", n=3, size=35)
K("056.3181.073", "setCombMS", WB, "cat p.29", n=2, size=35); K("056.3181.074", "setCombMS", WB, "cat p.29", n=3, size=35)
K("056.3182.073", "setCombFS", WB, "cat p.33", n=2, size=35); K("056.3182.074", "setCombFS", WB, "cat p.33", n=3, size=35)
K("055.3043.073", "adapterSoft", WB, "cat p.27")
K("055.3216.071", "centreDoorFS", WB, "HAW-ONF text list", chk=True, size=50)
K("055.3208.071", "trackCombIS", WB, "HAW-ONF text list", len=2500, size=65); K("055.3208.072", "trackCombIS", WB, "HAW-ONF text list", len=4000, size=65)
K("055.3209.071", "trackCombMS", WB, "HAW-ONF text list", len=2500, size=65); K("055.3209.072", "trackCombMS", WB, "HAW-ONF text list", len=4000, size=65)
K("055.3204.071", "setCombFSul", WB, "HAW-ONF text list", n=2, size=65); K("055.3207.071", "centreDoorFSol", WB, "HAW-ONF text list", size="65/80"); K("055.3217.071", "centreDoorFS", WB, "HAW-ONF text list", size="65/80")
K("056.3160.071", "setCombL", WB, "HAW-ONF text list", n=1); K("056.3160.072", "setCombL", WB, "HAW-ONF text list", n=2); K("056.3160.073", "setCombL", WB, "HAW-ONF text list", n=3)
TRK3 = [(2500, ".250"), (3500, ".350"), (6000, ".600")]
def hawa_trk_line(): return LINE([OPT("056.3010" + s, lenUp=L) for L, s in TRK3], 1, "track")
def combino(key, name, run, mount, kg, hmax, wmax, th, leaves, dw, info, bom, src, conflicts=None):
    S(key, WB, name, "slide", run=run, mount=mount, leaves=leaves, lim={"kg": [None, kg], "h": [None, hmax], "w": [None, wmax], "th": th}, dw=dw,
      trk={"std": [2500, 3500, 6000], "cut": None}, bom=bom, info=info, conflicts=conflicts or [], unreadable=["hanger hole pattern / cabinet depth need drawings not transcribed"], src=src)
combino("hawa_combino_20_is", "Combino 20 H IS", "top", "inset", 20, 2200, 1200, [19, 19], [2, 2], {"base": "KIM", "tot": {"2": 26}},
        [I("formula", "TB = (KIM + 26)/2", "cat p.12"), I("formula", "TH = H − 26 (wooden panel; H not defined in the source)", "cat p.12")],
        [LINE([OPT("056.3180.071")], 1, "set"), hawa_trk_line(), LINE([OPT("053.3207.071")], 1, "centering")], "HAW-ONF cat p.12-14")
combino("hawa_combino_20_ms", "Combino 20 H MS", "top", "mixed", 20, 2200, 1200, [19, 19], [2, 2], {"base": "KIM", "tot": {"2": 16}},
        [I("formula", "TB = (KIM + 16)/2", "cat p.16"), I("formula", "TH = H − 12 (wooden panel; H not defined in the source)", "cat p.16")],
        [LINE([OPT("056.3181.071")], 1, "set"), hawa_trk_line(), LINE([OPT("053.3207.071")], 1, "centering")], "HAW-ONF cat p.16-18")
combino("hawa_combino_20_fs", "Combino 20 H FS", "bottom", "overlay", 20, 2200, 1200, [19, 19], [2, 2], {"base": "KAM", "tot": {"2": 16}},
        [I("formula", "TB = (KAM + 16)/2", "cat p.20")],
        [LINE([OPT("056.3182.071")], 1, "set"), hawa_trk_line(), LINE([OPT("053.3207.071")], 1, "centering")], "HAW-ONF cat p.20-22")
for mnt, nm, run, mt, base, tot, code in (("is", "IS", "top", "inset", "KIM", {"2": 26, "3": 56}, "056.3180"), ("ms", "MS", "top", "mixed", "KIM", {"2": 16, "3": 36}, "056.3181"),
                                          ("fs", "FS", "bottom", "overlay", "KAM", {"2": 16, "3": 36}, "056.3182")):
    f2 = "TB = (%s + %d)/2" % (base, tot["2"]); f3 = "TB = (%s + %d)/3" % (base, tot["3"])
    inf = [I("formula", f2, "cat p.25-36"), I("formula", f3, "cat p.25-36")]
    if mnt == "is": inf.append(I("formula", "TH = H − 36 (wooden panel; H not defined in the source)", "cat p.25-36"))
    combino("hawa_combino_35_" + mnt, "Combino 35 H " + nm, run, mt, 35, 2200, 1200, [19, 19], [2, 3], {"base": base, "tot": tot}, inf,
            [LINE([OPT(code + ".073", n=[2]), OPT(code + (".077" if mnt == "is" else ".074"), n=[3])], 1, "set"), hawa_trk_line()], "HAW-ONF cat p.25-36")
combino("hawa_combino_50_ms", "Combino 50 H MS", "bottom", "mixed", 50, 2400, 1400, [19, 25], [2, 3], {"base": "KAM", "tot": {"2": 16, "3": 36}},
        [I("formula", "TB = (KAM + 16)/2 · TB = (KAM + 36)/3 (labelled KAM in the drawing, not KIM)", "cat p.40")], [hawa_trk_line()], "HAW-ONF cat p.38-52")
combino("hawa_combino_50_fs", "Combino 50 H FS", "bottom", "overlay", 50, 2400, 1400, [19, 25], [2, 3], None,
        [I("limitsOnly", "Combino 50 H FS"), I("unverified", "FS pages not rendered in the source")], [hawa_trk_line()], "HAW-ONF cat p.38-52")
for v, nm, run, mt, base, tot, th in (("is_ol", "IS ol", "top", "inset", "KIM", {"2": 26, "3": 56}, [25, 40]), ("ms_ol", "MS ol", "top", "mixed", "KIM", {"2": 16, "3": 36}, [25, 25]),
                                      ("fs_ol", "FS ol", "top", "overlay", "KAM", {"2": 16, "3": 36}, [19, 40]), ("fs_ul", "FS ul", "bottom", "overlay", "KAM", {"2": 16, "3": 36}, [25, 25])):
    inf = [I("formula", "TB = (%s + %d)/2 · TB = (%s + %d)/3" % (base, tot["2"], base, tot["3"]), "cat p.54-67")]
    if v == "is_ol": inf.append(I("formula", "TH = H − 58 (door 40 mm; H not defined in the source)", "cat p.54-67"))
    bm = [hawa_trk_line()]
    if v == "is_ol": bm.insert(0, LINE([OPT("055.3208.071", lenUp=2500), OPT("055.3208.072", lenUp=4000)], 1, "track65"))
    if v == "ms_ol": bm.insert(0, LINE([OPT("055.3209.071", lenUp=2500), OPT("055.3209.072", lenUp=4000)], 1, "track65"))
    if v == "fs_ul": bm.insert(0, LINE([OPT("055.3204.071", n=[2])], 1, "set"))
    combino("hawa_combino_65_" + v, "Combino 65 H " + nm, run, mt, 65, 2600, 1400, th, [2, 3], {"base": base, "tot": tot}, inf, bm, "HAW-ONF cat p.54-67")
for v, nm, run, th in (("fs_ol", "FS ol", "top", [19, 40]), ("fs_ul", "FS ul", "bottom", [25, 40])):
    combino("hawa_combino_80_" + v, "Combino 80 H " + nm, run, "overlay", 80, 2800, 1600, th, [2, 3], {"base": "KAM", "tot": {"2": 16, "3": 36}},
            [I("formula", "TB = (KAM + 16)/2 · TB = (KAM + 36)/3", "cat p.69-77")], [hawa_trk_line()], "HAW-ONF cat p.69-77")
S("hawa_combino_l_40", WB, "Combino L 40 H FS", "slide", run="bottom", mount="overlay", leaves=[1, 3],
  lim={"kg": [None, 40], "h": [None, 1500], "w": [None, 1500], "th": [19, 19], "wSynchro": 800}, trk={"std": [], "cut": None},
  bom=[LINE([OPT("056.3160.071", n=[1]), OPT("056.3160.072", n=[2]), OPT("056.3160.073", n=[3])], 1, "set")],
  info=[I("formula", "Synchro 4 doors: TB = (KAM + 40)/4 (KAM 1910–3100)", "cat p.88"), I("unverified", "Synchro 2 doors: formula read ambiguously ('TB = KAM + 38 / 4')"), I("limitsOnly", "Combino L 40 H FS")],
  unreadable=["drilling"], src="HAW-ONF cat p.79-91")
def clipo(key, name, run, mount, kg, hmax, th, leaves, dw, info):
    S(key, WB, name, "slide", run=run, mount=mount, leaves=leaves, lim={"kg": [None, kg], "h": [None, hmax], "w": [None, 1000], "th": th}, dw=dw, trk={"std": [], "cut": None},
      bom=[], info=info + [I("noCodes", name)], unreadable=["order codes and drilling not extracted"], src="HAW-ONF cat p.92-151")
clipo("hawa_clipo_15_is", "Clipo 15 H IS", "top", "inset", 15, 1400, [16, 19], [2, 2], {"base": "KIM", "tot": {"2": 16}}, [I("formula", "TB = (KIM + 16)/2", "cat p.95")])
clipo("hawa_clipo_15_ms", "Clipo 15 H MS", "top", "mixed", 15, 1400, [16, 19], [2, 2], None, [])
clipo("hawa_clipo_15_fs", "Clipo 15 H FS", "bottom", "overlay", 15, 1400, [19, 25], [2, 2], None, [])
clipo("hawa_clipo_16_is", "Clipo 16 H IS", "top", "inset", 16, 1400, [16, 19], [2, 2], None, [])
clipo("hawa_clipo_16_ms", "Clipo 16 H MS", "top", "mixed", 16, 1400, [16, 19], [2, 2], None, [])
clipo("hawa_clipo_16_fs", "Clipo 16 H FS", "bottom", "overlay", 16, 1400, [16, 25], [2, 2], None, [])
clipo("hawa_clipo_16_hm", "Clipo 16 HM IS", "top", "inset", 16, 1400, [19, 25], [2, 2], {"base": "KIM", "tot": {"2": 16}}, [I("formula", "TB = (KIM + 16)/2 · TH = KIM − 9 (HM IS; as printed)", "cat p.123/125")])
clipo("hawa_clipo_26_is", "Clipo 26 H IS", "top", "inset", 26, 2200, [19, 25], [2, 3], {"base": "KIM", "tot": {"2": 26}}, [I("formula", "TB = (KIM + 26)/2", "cat p.129")])
clipo("hawa_clipo_26_ms", "Clipo 26 H MS", "top", "mixed", 26, 2200, [19, 19], [2, 3], {"base": "KAM", "tot": {"2": 16, "3": 36}},
      [I("formula", "TB = (KAM + 16)/2 · TB = (KAM + 36)/3", "cat p.125-135"), I("formula", "groove length = KAM − 2S − 2 (S not defined)", "cat p.134")])
clipo("hawa_clipo_36_is", "Clipo 36 H IS", "top", "inset", 36, 2200, [19, 25], [2, 3], None, [])
clipo("hawa_clipo_36_ms", "Clipo 36 H MS", "top", "mixed", 36, 2400, [25, 25], [2, 3], None, [])
clipo("hawa_clipo_36_hm", "Clipo 36 HM IS", "top", "inset", 36, 2400, [19, 40], [2, 3], None, [])

# ---- Hawa Concepta III (pocket: pivot and slide in) — 15 / 25 / 35, Push or Pull
C3 = RS["hawa-concepta-iii"]
for c, sd in (("53520", "L"), ("53521", "R")): K(c, "basicSet", WB, "cat p.159", size=15, side=sd)
for c, sd in (("53522", "L"), ("53523", "R")): K(c, "slideInSet", WB, "cat p.159", size=15, side=sd, mode="push")
for c, sd in (("53524", "L"), ("53525", "R")): K(c, "slideInSet", WB, "cat p.165", size=15, side=sd, mode="pull")
for c, sd in (("30994", "L"), ("30995", "R")): K(c, "basicSet", WB, "cat p.171,178", size=25, side=sd, hr=[1200, 2200])
for c, sd in (("30996", "L"), ("30997", "R")): K(c, "basicSet", WB, "cat p.185", size=35, side=sd, hr=[1900, 2700])
for c, sd in (("30998", "L"), ("30999", "R")): K(c, "slideInSet", WB, "cat p.171", size="25/35", side=sd, mode="push")
for c, sd in (("31000", "L"), ("31001", "R")): K(c, "slideInSet", WB, "cat p.178", size="25/35", side=sd, mode="pull")
K("30778", "upright", WB, "cat p.177", len=1974, hr=[1200, 2200]); K("25680", "guideInset", WB, "cat p.159")
K("31005", "connector55", WB, "cat p.160", len=560, pos="top+bottom"); K("31430", "connector55", WB, "cat p.160", len=560, pos="top")
K("31006", "connector110", WB, "cat p.178", len=500, pos="top"); K("31246", "connector110", WB, "cat p.178", len=500, pos="bottom"); K("31007", "connector110", WB, "cat p.178", len=500, pos="plinth26")
C3LIM = {"15": ([4, 15], [600, 1400], [350, 700]), "25": ([6, 25], [1200, 2200], [350, 750]), "35": ([10, 35], [1900, 2700], [350, 750])}
for sz in ("15", "25", "35"):
    basic = {"15": ("53520", "53521"), "25": ("30994", "30995"), "35": ("30996", "30997")}[sz]
    for mode in ("push", "pull"):
        slin = {("15", "push"): ("53522", "53523"), ("15", "pull"): ("53524", "53525"), ("25", "push"): ("30998", "30999"), ("35", "push"): ("30998", "30999"),
                ("25", "pull"): ("31000", "31001"), ("35", "pull"): ("31000", "31001")}[(sz, mode)]
        kg, h, w = C3LIM[sz]
        bm = [LINE([OPT(basic[0], side="L"), OPT(basic[1], side="R")], {"per": "door"}, "basic"), LINE([OPT(slin[0], side="L"), OPT(slin[1], side="R")], {"per": "door"}, "slidein")]
        S("hawa_concepta_iii_%s_%s" % (sz, mode), WB, "Concepta III %s %s" % (sz, mode.capitalize()), "pocket", mount="pocket", leaves=[1, 2],
          lim={"kg": kg, "h": h, "w": w, "th": [18, 26]},
          plan={"type": "concepta3", "z3": 3, "z3R": [2, 5], "z12": [3, 6], "t1Min": 414, "mAddS": 3, "mMaxSub": 320, "hw": 92},
          bom=bm,
          info=[I("formula", "T1 = TB + 92 + Z3 − M", "HAW-C3-EP"), I("formula", "KT1 ≥ T1 + RE (RE not defined in the legend)", "HAW-C3-EP"), I("formula", "E1 = TB − M", "HAW-C3-EP"),
                I("formula", "M ≥ S + 3 · M ≤ TB − 320 · T1 ≥ 414", "HAW-C3-EP"), I("rule", "Z1, Z2 = 3–6 · Z3 = 2–5 (3 recommended)", "HAW-C3-EP"),
                I("rule", "weight limit falls with width and height: see Hawa weight table", "cat p.176")],
          unreadable=C3["unreadable"], src="HAW-ONF cat p.156-189; HAW-C3-SPE; HAW-C3-EP")

# ---- Hawa Folding Concepta III (pocket + folding wings) — 20 / 25, Push or Pull
FC = RS["hawa-folding-concepta-iii"]
for c, sd in (("53438", "L"), ("53439", "R")): K(c, "foldSet", WB, "cat p.204", size=20, side=sd, mode="push")
for c, sd in (("53442", "L"), ("53443", "R")): K(c, "foldSet", WB, "cat p.219", size=20, side=sd, mode="pull")
for c, sd in (("53440", "L"), ("53441", "R")): K(c, "foldSet", WB, "cat p.233", size=25, side=sd, mode="push")
for c, sd in (("53444", "L"), ("53445", "R")): K(c, "foldSet", WB, "cat p.248", size=25, side=sd, mode="pull")
for c, sd in (("53448", "L"), ("53449", "R")): K(c, "trackSetCab", WB, "cat p.206", side=sd)
for c, sd in (("53450", "L"), ("53451", "R")): K(c, "trackSetFront", WB, "cat p.207", n=2, side=sd)
for c, sd in (("53452", "L"), ("53453", "R")): K(c, "trackSetFront", WB, "cat p.207", n=3, side=sd)
K("53454", "trackSetFront", WB, "cat p.207", n=4); K("31519", "uprightSet", WB, "cat p.207", hr=[1200, 2200]); K("52110", "uprightSet", WB, "cat p.208", len=2085, n=3); K("52109", "uprightSet", WB, "cat p.204-208", len=2765, n=4, chk=True)
K("31538", "stopSet3", WB, "cat p.204-208", n=3)
for sz, lim in (("20", ([6, 20], [1200, 2200])), ("25", ([10, 25], [1900, 2700]))):
    sets = {("20", "push"): ("53438", "53439"), ("20", "pull"): ("53442", "53443"), ("25", "push"): ("53440", "53441"), ("25", "pull"): ("53444", "53445")}
    for mode in ("push", "pull"):
        a = sets[(sz, mode)]
        S("hawa_folding_concepta_iii_%s_%s" % (sz, mode), WB, "Folding Concepta III %s %s" % (sz, mode.capitalize()), "wing", mount="pocket", leaves=[2, 4],
          lim={"kg": lim[0], "h": lim[1], "w": [350, 750], "th": [18, 26]},
          plan={"type": "concepta3fold", "z3": 3, "z3R": [2, 5], "t2Min": 344, "m2AddS": 75, "m2MaxSub": 250, "m3MaxSub": 320, "hw": 92},
          bom=[LINE([OPT(a[0], side="L"), OPT(a[1], side="R")], {"per": "door"}, "set"),
               LINE([OPT("53450", n=[2], side="L"), OPT("53451", n=[2], side="R"), OPT("53452", n=[3], side="L"), OPT("53453", n=[3], side="R"), OPT("53454", n=[4])], {"per": "door"}, "track", chk=True)],
          info=[I("formula", "T2 = TB + 92 + Z3 − M2", "HAW-FC3-EP"), I("formula", "KT2 ≥ T2", "HAW-FC3-EP"), I("formula", "E2 = TB − M2", "HAW-FC3-EP"),
                I("formula", "M2 ≥ S + 75 · M2 ≤ TB − 250 (3 doors: M ≤ TB − 320) · T2 ≥ 344", "HAW-FC3-EP"), I("rule", "Z1 = 0–6 · Z3 = 2–5", "HAW-FC3-EP")],
          unreadable=FC["unreadable"], src="HAW-ONF cat p.198-248; HAW-FC3-EP")

# ---- Hawa Concepta 40 / 50: limits + codes only
C4 = RS["hawa-concepta-40-50"]
K("27650", "set40", WB, "cat p.259"); K("27651", "set50", WB, "cat p.264")
for sz, kg, h in (("40", [20, 40], [1851, 2500]), ("50", [25, 50], [2301, 2850])):
    S("hawa_concepta_" + sz, WB, "Concepta " + sz, "pocket", mount="pocket", leaves=[1, 1], lim={"kg": kg, "h": h, "w": [300, 900], "th": [19, 50]},
      plan={"type": "generic"}, bom=[LINE([OPT("27650" if sz == "40" else "27651")], 1, "set")],
      info=[I("limitsOnly", "Concepta " + sz)], unreadable=C4["unreadable"], src="HAW-ONF cat p.258-264")

# =====================================================================================================  BLUM REVEGO
BB = "Blum"
bl = RS["blum-revego"]
UNO_NL = [450, 500, 600, 700, 800]; DUO_NL = [450, 525, 600, 675, 750]
for nl in UNO_NL:
    for sd in ("L", "R"): K("801P%dE.%s3" % (nl, sd), "pocketProf", BB, "BLU-ORD p.17", nl=nl, side=sd, kind="uno", potMin=nl + 100)
for nl in DUO_NL:
    for sd in ("L", "R"): K("802P%dD.%s3" % (nl, sd), "pocketProf", BB, "BLU-ORD p.38", nl=nl, side=sd, kind="duo", potMin=nl + 100)
HB_N = [1140, 1350, 1500, 1650, 1800, 1950, 2100, 2250, 2400, 2550, 2700, 2850]
for n_ in HB_N:
    for sd in ("L", "R"):
        K("801T%d.%s3" % (n_, sd), "hingeBracket", BB, "BLU-ORD p.17", chk=True, kind="uno", poh=n_, side=sd)
        K("802T%d.%s3" % (n_, sd), "hingeBracket", BB, "BLU-ORD p.38", chk=True, kind="duo", poh=n_, side=sd)
K("801V505B", "pocketConn", BB, "BLU-ORD p.18", kind="uno", plinth=True, sd=[15, 19])
for sd in ("L", "R"):
    K("801V605B.%s1" % sd, "pocketConn", BB, "BLU-ORD p.18", kind="uno", plinth=False, side=sd, sd=[15, 19]); K("801V705B.%s3" % sd, "pocketConn", BB, "BLU-ORD p.18", kind="uno", worktop=True, side=sd, sd=[15, 19])
    K("802V660B.%s1" % sd, "pocketConn", BB, "BLU-ORD p.39", kind="duo", plinth=False, side=sd, sd=[15, 17]); K("802V680B.%s1" % sd, "pocketConn", BB, "BLU-ORD p.39", kind="duo", plinth=False, side=sd, sd=[18, 19])
    K("802V760B.%s3" % sd, "pocketConn", BB, "BLU-ORD p.39", kind="duo", worktop=True, side=sd, sd=[15, 17]); K("802V780B.%s3" % sd, "pocketConn", BB, "BLU-ORD p.39", kind="duo", worktop=True, side=sd, sd=[18, 19])
    K("802M0002.%s2" % sd, "assemblySet", BB, "BLU-ORD p.40", side=sd)
K("802V560B", "pocketConn", BB, "BLU-ORD p.39", kind="duo", plinth=True, sd=[15, 17]); K("802V580B", "pocketConn", BB, "BLU-ORD p.39", kind="duo", plinth=True, sd=[18, 19])
for L_ in (1050, 1200, 1250, 1350):
    for sd in ("L", "R"): K("802L%dD%s3" % (L_, sd), "trackDuo", BB, "BLU-ORD p.39", lwa=L_, side=sd)
K("801V5002", "pocketConnRear", BB, "BLU-ORD p.19", kind="uno"); K("802V5002", "pocketConnRear", BB, "BLU-ORD p.40", kind="duo")
K("661.1450.HG", "screwsSys", BB, "BLU-ORD p.19"); K("664.3500", "screwsChip", BB, "BLU-ORD p.19")
def rev_bom(kind):
    P = "801P" if kind == "uno" else "802P"; NL = UNO_NL if kind == "uno" else DUO_NL
    pro = [OPT("%s%d%s.%s3" % (P, nl, "E" if kind == "uno" else "D", sd), nlUp=nl, side=sd) for nl in NL for sd in ("L", "R")]
    hbr = [OPT("%s%d.%s3" % ("801T" if kind == "uno" else "802T", n_, sd), pohFrom=n_, side=sd) for n_ in HB_N for sd in ("L", "R")]
    if kind == "uno":
        con = [OPT("801V505B", plinth=True), OPT("801V605B.L1", plinth=False, side="L"), OPT("801V605B.R1", plinth=False, side="R")]
    else:
        con = [OPT("802V560B", plinth=True, sth=[15, 16, 17]), OPT("802V580B", plinth=True, sth=[18, 19]),
               OPT("802V660B.L1", plinth=False, sth=[15, 16, 17], side="L"), OPT("802V660B.R1", plinth=False, sth=[15, 16, 17], side="R"),
               OPT("802V680B.L1", plinth=False, sth=[18, 19], side="L"), OPT("802V680B.R1", plinth=False, sth=[18, 19], side="R")]
    lines = [LINE(pro, 1, "profile"), LINE(hbr, 1, "bracket", chk=True), LINE(con, 1, "connector")]
    if kind == "duo":
        lines.append(LINE([OPT("802L%dD%s3" % (L_, sd), lwaUp=L_, side=sd) for L_ in (1050, 1200, 1250, 1350) for sd in ("L", "R")], 1, "track"))
        lines.append(LINE([OPT("802M0002.L2", side="L"), OPT("802M0002.R2", side="R")], 1, "assembly"))
    return lines
for kind in ("uno", "duo"):
    S("blum_revego_" + kind, BB, "REVEGO " + kind, "pocket", mount="pocket", leaves=[1, 1] if kind == "uno" else [2, 2],
      lim={"kg": [None, 35], "h": [1130, 2980], "w": [442, 898] if kind == "uno" else [442, 748], "th": [18, 26]},
      plan={"type": "revego", "kind": kind, "pob": 100 if kind == "uno" else 150, "eb": [450, 900] if kind == "uno" else [900, 1500], "eh": [1155, 3012], "etMin": 573,
            "lwa": [350, 800] if kind == "uno" else [750, 1350], "ltaMin": 518 if kind == "uno" else 483, "poh": [1142, 2999], "potMin": 553,
            "fsByFd": [[18, 20, 2], [20.1, 23, 2.5], [23.1, 26, 3]], "fsmMin": 2.0, "fsmMax": 8.0, "fsRange": [1.0, 4.0], "fsGap": 2, "potv": 100, "porw": 3, "nlMaxAdd": 8, "fuAdd": 15, "fuMin": 7,
            "nl": UNO_NL if kind == "uno" else DUO_NL, "trackSub": 12},
      bom=rev_bom(kind),
      info=[I("formula", "EB = LWA + POB (uno 100 · duo 150)", "BLU-ORD p.12-14"), I("formula", "ET = POT + FS(2) + FD", "BLU-ORD p.12-14"),
            I("formula", "FB = EB − Fsl − Fsr" if kind == "uno" else "FB = (EB − Fsl − Fsm − Fsr)/2", "BLU-ORD p.20-23"),
            I("formula", "POT ≥ NL + POTV (≥ 100) + PORW (≥ 3) · Max NL = FB + 8", "BLU-ORD p.20-23"), I("formula", "FU = FB − NL + 15 (min 7)", "BLU-ORD p.20-23"),
            I("formula", "FH = POH − Fo − Fu · EH = POH + POVH (top + bottom)", "BLU-ORD p.20-23"), I("formula", "LTA = POT − 35 · LHA = POH", "BLU-ORD p.41-43")]
           + ([I("formula", "track length X = LWA − 12", "BLU-ORD p.77-80")] if kind == "duo" else []),
      unreadable=bl["unreadable"], src="BLU-ORD p.10-23,38-43; BLU-WEB")

# =====================================================================================================  HÄFELE
FB_ = "Häfele"
def hk(code, role, src, **p): return K(code, role, FB_, src, **p)
hk("402.33.013", "fitSet", "p1.17", sys="12C", n=2, soft=False); hk("402.33.014", "fitSet", "p1.17", sys="12C", n=2, soft=True)
hk("402.33.642", "trackTopGroove", "p1.17", len=2500, tracks=1); hk("402.33.643", "trackTopGroove", "p1.17", len=3500, tracks=1)
hk("402.33.652", "trackTopGroove", "p1.17", len=2500, tracks=2); hk("402.33.653", "trackTopGroove", "p1.17", len=3500, tracks=2)
hk("402.30.642", "trackTopScrew", "p1.17", len=2500, tracks=1); hk("402.30.643", "trackTopScrew", "p1.17", len=3500, tracks=1)
hk("402.30.652", "trackTopScrew", "p1.17", len=2500, tracks=2); hk("402.30.653", "trackTopScrew", "p1.17", len=3500, tracks=2)
hk("402.30.802", "guideBottom", "p1.17", len=2500, tracks=1); hk("402.30.803", "guideBottom", "p1.17", len=3500, tracks=1); hk("402.30.220", "guideExtra", "p1.17")
hk("402.33.018", "fitSet", "p1.19", sys="20C", n=2, soft=False); hk("402.33.019", "fitSet", "p1.19", sys="20C", n=2, soft=True)
hk("402.30.107", "housing", "p1.19"); hk("402.30.123", "runGearSoft", "p1.19"); hk("402.30.303", "stopperClip", "p1.19"); hk("402.30.321", "stopperSoft", "p1.19")
hk("402.33.026", "fitSet", "p1.21", sys="40C", n=2, soft=False); hk("402.33.027", "fitSet", "p1.21", sys="40C", n=2, soft=True)
hk("402.33.029", "fitSet", "p1.27", sys="20A", n=1, soft=False); hk("402.33.030", "fitSet", "p1.27", sys="20A", n=1, soft=True)
hk("402.23.002", "fitSet", "p1.25", sys="55A", n=2); hk("402.23.003", "fitSet", "p1.25", sys="55A", n=3)
hk("402.23.802", "guideTop", "p1.25", len=2500); hk("402.23.803", "guideTop", "p1.25", len=3500); hk("402.23.602", "trackBottomPress", "p1.25", len=2500); hk("402.23.603", "trackBottomPress", "p1.25", len=3500)
hk("402.26.622", "runGuideTrack", "p1.25", len=2500); hk("402.26.623", "runGuideTrack", "p1.25", len=3500)
hk("402.31.028", "fitSet", "p1.29", chk=True, sys="40A", n=2, soft=False); hk("402.31.029", "fitSet", "p1.29", sys="40A", n=2, soft=True); hk("402.31.032", "fitSet", "p1.29", sys="40A", n=3, soft=True)
hk("402.31.654", "trackTopSingle", "p1.28", len=2500); hk("402.31.655", "trackTopSingle", "p1.28", len=3500)
hk("402.31.632", "guideBottom", "p1.28", len=2500, tracks=1); hk("402.31.633", "guideBottom", "p1.28", len=3500, tracks=1); hk("402.31.842", "guideBottomDouble", "p1.28", len=2500); hk("402.31.843", "guideBottomDouble", "p1.28", len=3500)
hk("402.31.034", "fitSet", "p1.31", chk=True, sys="60A"); hk("402.31.036", "fitSet", "p1.31", chk=True, sys="60A"); hk("402.31.038", "fitSet", "p1.31", chk=True, sys="60A")
FL = {"908": ("407.40.097", "407.40.093", 450), "1208": ("407.40.096", "407.40.092", 600), "1508": ("407.40.095", "407.40.091", 750), "1808": ("407.40.094", "407.40.090", 900)}
for iw, (cb, cs, dw_) in FL.items():
    hk(cb, "trackSetFlush", "p1.33", len=int(iw), doorW=dw_, col="black"); hk(cs, "trackSetFlush", "p1.33", len=int(iw), doorW=dw_, col="silver")
hk("401.30.609", "runGuideTrack18", "p1.71", v=1); hk("401.30.610", "runGuideTrack18", "p1.71", v=2)
hk("401.30.611", "guideDouble18", "p1.71", v=1); hk("401.30.613", "guideDouble18", "p1.71", v=2); hk("401.30.614", "runDouble18", "p1.71", v=1); hk("401.30.615", "runDouble18", "p1.71", v=2)
hk("401.30.017", "fitSet", "p1.71", chk=True, sys="50A"); hk("401.30.016", "fitSet", "p1.71", chk=True, sys="50A"); hk("401.30.341", "softSelf", "p1.71")
PARK = (("408.25.000", 340, 230), ("408.25.001", 408, 294), ("408.25.002", 440, 326), ("408.25.003", 504, 390), ("408.25.004", 536, 422), ("408.25.005", 600, 486), ("408.25.006", 664, 550))
for c, gl, rt in PARK: hk(c, "parkGuide", "p1.123", guideLen=gl, retract=rt)
hk("408.00.404", "doorFixPark", "p1.123", mount="infront", soft=True); hk("408.00.405", "doorFixPark", "p1.123", mount="infront", soft=False)
hk("408.00.406", "doorFixPark", "p1.123", mount="vorfront", soft=True); hk("408.00.412", "doorFixPark", "p1.123", mount="vorfront", soft=False)
hk("940.58.005", "frameAdaptor", "p2.84", maxW=760); hk("940.58.006", "frameAdaptor", "p2.84", maxW=915); hk("940.58.020", "jointSet", "p2.84"); hk("940.58.030", "cavitySet", "p2.84")
hk("406.02.095", "frontinoSet", "p1.79A", cabW=[1200, 1799], size="S"); hk("406.02.096", "frontinoSet", "p1.79A", cabW=[1800, 2199], size="M"); hk("406.02.097", "frontinoSet", "p1.79A", cabW=[2200, 2400], size="L")
def hflt(key, name, rk, kg, hmax, wmax, th, leaves, dw, lines, info, src, minw=None, mount="overlay", run="top"):
    S(key, FB_, name, "slide", run=run, mount=mount, leaves=leaves, lim={"kg": [None, kg], "h": [None, hmax], "w": [minw, wmax], "th": th}, dw=dw,
      trk={"std": [2500, 3500], "cut": None}, bom=lines, info=info, unreadable=RS[rk]["unreadable"], src=src)
GRV = [OPT("402.33.652", lenUp=2500), OPT("402.33.653", lenUp=3500)]
BTM = [OPT("402.30.802", lenUp=2500), OPT("402.30.803", lenUp=3500)]
hflt("haf_fline21_12c", "Slido F-Line21 12C", "haf-fline21-12c", 12, 1200, 1000, [16, 19], [2, 2], None,
     [LINE([OPT("402.33.013", soft=False), OPT("402.33.014", soft=True)], 1, "set"), LINE(GRV, 1, "track"), LINE(BTM, 1, "guide")],
     [I("hint_noDoorFormula", "F-Line21 12C"), I("formula", "B = A − 10.5 (groove tracks) · B = A − 24 (screw-fix tracks); A not defined in the source", "p1.16"), I("rule", "min door width 340 · min panel thickness 19", "p1.16")], "HAF-25S1-16", minw=340)
hflt("haf_fline21_20c", "Slido F-Line21 20C", "haf-fline21-20c", 20, 1400, 1250, [16, 19], [2, 2], None,
     [LINE([OPT("402.33.018", soft=False), OPT("402.33.019", soft=True)], 1, "set"), LINE(GRV, 1, "track"), LINE(BTM, 1, "guide")],
     [I("hint_noDoorFormula", "F-Line21 20C"), I("formula", "B = A − 10 (groove) · B = A − 23.5 (screw); A not defined in the source", "p1.18"), I("rule", "min door width 360 (one soft close) · 550 (two)", "p1.18")], "HAF-25S1-18", minw=360)
hflt("haf_fline21_40c", "Slido F-Line21 40C", "haf-fline21-40c", 40, 2200, 1250, [16, 19], [2, 2], None,
     [LINE([OPT("402.33.026", soft=False), OPT("402.33.027", soft=True)], 1, "set"), LINE(GRV, 1, "track"), LINE(BTM, 1, "guide")],
     [I("hint_noDoorFormula", "F-Line21 40C"), I("rule", "wooden doors: Planofit straightening system must be used (p1.144-147)", "p1.20")], "HAF-25S1-20", minw=390)
hflt("haf_fline21_20a", "Slido F-Line21 20A", "haf-fline21-20a", 20, 1400, 1250, [16, 19], [1, 1], None,
     [LINE([OPT("402.33.029", soft=False), OPT("402.33.030", soft=True)], {"per": "door"}, "set"), LINE([OPT("402.33.642", lenUp=2500), OPT("402.33.643", lenUp=3500)], {"per": "door"}, "track")],
     [I("hint_noDoorFormula", "F-Line21 20A"), I("rule", "min door width 360 (one soft close) · 550 (two)", "p1.26")], "HAF-25S1-26", minw=360)
hflt("haf_fline15_55a", "Slido F-Line15 55A", "haf-fline15-55a", 55, None, None, [16, None], [2, 3], None,
     [LINE([OPT("402.23.002", n=[2]), OPT("402.23.003", n=[3])], 1, "set"), LINE([OPT("402.26.622", lenUp=2500), OPT("402.26.623", lenUp=3500)], 1, "track", chk=True),
      LINE([OPT("402.23.802", lenUp=2500), OPT("402.23.803", lenUp=3500)], 1, "guide")],
     [I("hint_noDoorFormula", "F-Line15 55A"), I("unverified", "max door height and width not stated in the text of the source")], "HAF-25S1-24", run="bottom")
hflt("haf_fline31_40a", "Slido F-Line31 40A", "haf-fline31-40a", 40, None, None, [16, 25], [2, 3], {"base": "KAM", "lt": 20},
     [LINE([OPT("402.31.029", n=[2]), OPT("402.31.032", n=[3])], 1, "set"), LINE([OPT("402.31.654", lenUp=2500), OPT("402.31.655", lenUp=3500)], 1, "track"),
      LINE([OPT("402.31.632", lenUp=2500), OPT("402.31.633", lenUp=3500)], 1, "guide")],
     [I("rule", "recommended door overlap LT = 20 · door offset LM = 0", "p1.28"), I("formula", "C = IH + top panel + base panel + 10 + 26 + Y (groove) · C = IH + top panel + base panel + 22.5 + 38.5 (screw)", "p1.28"),
      I("unverified", "max door height and width not stated · door-width table not transcribed"), I("rule", "min door width: 2 doors 520 (soft close both) · 3 doors 350 / 820", "p1.28")], "HAF-25S1-28")
hflt("haf_fline31_60a", "Slido F-Line31 60A", "haf-fline31-60a", 60, None, None, [16, 25], [1, 3], {"base": "KAM", "lt": 20},
     [LINE([OPT("402.31.036")], 1, "set", chk=True), LINE([OPT("402.31.654", lenUp=2500), OPT("402.31.655", lenUp=3500)], 1, "track")],
     [I("rule", "recommended door overlap LT = 20 · door offset LM = 0", "p1.30"), I("rule", "min door width: 1 door 620 · 2 doors 620 · 3 doors 400", "p1.30"), I("unverified", "height/width limits and the code mapping of the fitting sets not readable")], "HAF-25S1-30")
S("haf_fflush52_20a", FB_, "Slido F-Flush52 20A", "slide", run="bottom", mount="flush", leaves=[2, 2],
  lim={"kg": [None, 20], "h": [None, 1600], "w": [450, 900], "th": [18, 22]}, trk={"std": [908, 1208, 1508, 1808], "cut": None},
  bom=[LINE([OPT(FL[k][1], doorW=FL[k][2]) for k in ("908", "1208", "1508", "1808")], 1, "trackset", chk=True)],
  info=[I("rule", "track length by door width: 450→908 · 600→1208 · 750→1508 · 900→1808 (internal)", "p1.33"), I("rule", "spacer plates: 2 for 18 mm · 1 for 20 mm · none for 22 mm", "p1.33")],
  unreadable=RS["haf-fflush52-20a"]["unreadable"], src="HAF-25S1-32")
hflt("haf_fline18_50a", "Slido F-Line18 50A", "haf-fline18-50a", 50, None, None, [16, None], [2, 2], None,
     [LINE([OPT("401.30.017")], 1, "set", chk=True)], [I("hint_noDoorFormula", "F-Line18 50A"), I("formula", "K = 20 mm − X", "p1.70"), I("unverified", "max height/width not stated in the source")], "HAF-25S1-70", minw=380, mount="inset", run="bottom")
S("haf_frontino_40fs", FB_, "Hawa Frontino 40 FS", "slide", run="top", mount="flush", leaves=[2, 2],
  lim={"kg": [None, 40], "h": [None, 2360], "w": [587, 1194], "th": [19, 19]}, trk={"std": [], "cut": None},
  bom=[LINE([OPT("406.02.095", cabWUp=1799), OPT("406.02.096", cabWUp=2199), OPT("406.02.097", cabWUp=2400)], 1, "set")],
  info=[I("rule", "no cabinet preparation · sets by cabinet width S 1200–1799 · M 1800–2199 · L 2200–2400", "p1.79A"), I("unverified", "door-width formula (table in the order list) not transcribed")],
  unreadable=RS["haf-hawa-frontino-40fs"]["unreadable"], src="HAF-25S1-79A")
S("haf_fpark71_25b", FB_, "Slido F-Park71 25B", "pocket", mount="pocket", leaves=[1, 1],
  lim={"kg": [None, 25], "h": [1501, 2300], "w": [None, 700], "th": [16, 25], "thVor": [16, 19]},
  plan={"type": "fpark", "guides": [[gl, rt] for _, gl, rt in PARK], "hingesByH": [[1800, 2, 2], [2300, 3, 2]], "h1Sub": 11, "h2Add": 11},
  bom=[LINE([OPT(c, guideLen=gl) for c, gl, _ in PARK], {"per": "door"}, "guide"),
       LINE([OPT("408.00.404", mount="infront", soft=True), OPT("408.00.406", mount="vorfront", soft=True)], {"per": "door"}, "doorFix")],
  info=[I("formula", "overlay = door width − retraction distance (Vorfront) · − door leaf thickness (Infront)", "p1.122"), I("formula", "H1 = H/2 − 11 · H2 = H/2 + 11", "p1.122"),
        I("rule", "hinges: 1500–1800 mm → 2 soft-close + 2 plain · 1801–2300 → 3 soft-close + 2 plain", "p1.122"), I("rule", "cup drilling pattern 52/7.5, depth 13 mm, 95°", "p1.122")],
  unreadable=RS["haf-fpark71-25b"]["unreadable"], src="HAF-25S1-122")
S("haf_pocket_hideaway", FB_, "Slido Pocket Hideaway", "pocket", mount="pocket", leaves=[1, 1],
  lim={"kg": [None, 56], "h": [None, 2032], "w": [None, 915], "th": [28, 50]}, plan={"type": "generic", "straight": True},
  bom=[LINE([OPT("940.58.005", wUp=760), OPT("940.58.006", wUp=915)], 1, "frame", chk=True)],
  info=[I("limitsOnly", "Pocket Hideaway"), I("rule", "interior wall pocket door (not a furniture system) · frame adaptor 35–44 mm", "p2.84")], unreadable=RS["haf-pocket-hideaway"]["unreadable"], src="HAF-25S2-84")

# ---- verificări finale + ieșire
if FAIL:
    for f in FAIL: print("LIPSA", f)
    raise SystemExit(1)
for s in SYSTEMS:
    for ln in s["bom"]:
        for o in ln["opts"]: assert o["code"] in CODES, (s["key"], o["code"])
ref = {}
for s in SYSTEMS:
    for ln in s["bom"]:
        for o in ln["opts"]:
            if s["name"] not in ref.setdefault(o["code"], []): ref[o["code"]].append(s["name"])
for c, names in ref.items(): CODES[c]["sys"] = names
keys = [s["key"] for s in SYSTEMS]; assert len(keys) == len(set(keys)), "chei duplicate"
out = {"sources": [{"id": x["id"], "title": x.get("title", ""), "url": x.get("url", "")} for x in raw["sources"]], "notes": raw["notes"],
       "codes": list(CODES.values()), "systems": SYSTEMS}
json.dump(out, open(os.path.join(here, "sliding.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(SYSTEMS), "sisteme,", len(CODES), "coduri")
