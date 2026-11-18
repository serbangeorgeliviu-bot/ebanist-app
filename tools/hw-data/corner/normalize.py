#!/usr/bin/env python3
"""Ebanist U.17 — unități de colț, scoase/ieșiri pentru corpuri înalte și mecanisme de mișcare.

Aduce datele brute (tools/hw-data/raw/cat-corner.json și cat-motion.json, citite din documente oficiale)
într-o schemă comună: tools/hw-data/corner/units.json. Apoi `node tools/corner-build.mjs` verifică și scrie app/ebanist-corner-data.js.

    python3 tools/hw-data/corner/normalize.py

REGULA: niciun număr inventat. Fiecare număr din ieșire trebuie să apară ca număr în înregistrarea brută a produsului (verificat
la sfârșit; o abatere oprește scriptul). Ce nu e citit rămâne null. Numerele mici de numărare (1–8: câte coșuri) se admit, fiindcă
sursele le spun în cuvinte («2 front + 2 rear»). Interpretările (ce înseamnă o literă din tabel) sunt marcate în `interp`.

Schema unei unități:
  key, raw (id-ul produsului brut), brand, name, kind, body ("base"|"tall"|"wall"|"any"), hand (bool: există variantă stânga/dreapta),
  front ("hinged" = ușă cu balamale rămasă pe corp · "frame" = frontul stă pe cadrul care iese · "unit" = ușa stă pe mecanism · null = nespus),
  sizes: [{ id, door, cab:[lo,hi]|n, wi:[lo,hi], hi:[lo,hi], depth, open:[lo,hi], codes:[...] }]  (null = necitit)
  limits: aceleași chei, valabile pentru toate mărimile (mărimea suprascrie)
  bands: [{ id, hi:[lo,hi], n, code }]   variante după înălțimea interioară (axe, cadre)
  load: { shelf, front, rear, total, ... } kg
  draw: ce se știe pentru 3D (numai din sursă): trays, dia, travel ...
  codes: [{ code, desc, size, hand }]   hand: "L"|"R"|null
  interp: [text]   notes: [cheie i18n]   src: "S# pagină"
"""
import json, re, os, sys
here = os.path.dirname(os.path.abspath(__file__))
rawdir = os.path.join(here, "..", "raw")
C = {p["id"]: p for p in json.load(open(os.path.join(rawdir, "cat-corner.json"), encoding="utf-8"))["products"]}
M = {p["id"]: p for p in json.load(open(os.path.join(rawdir, "cat-motion.json"), encoding="utf-8"))["products"]}
CSRC = {s["id"]: s for s in json.load(open(os.path.join(rawdir, "cat-corner.json"), encoding="utf-8"))["sources"]}
MSRC = json.load(open(os.path.join(rawdir, "cat-motion.json"), encoding="utf-8"))["sources"]

units = []

def R(lo, hi): return [lo, hi]

def U(key, raw, brand, name, kind, body, **kw):
    u = {"key": key, "raw": raw, "brand": brand, "name": name, "kind": kind, "body": body, "hand": False, "front": None,
         "sizes": [], "limits": {}, "bands": [], "load": {}, "draw": {}, "codes": [], "interp": [], "notes": [], "src": "", "verificat": False}
    u.update(kw)
    units.append(u)
    return u

def S(id, **kw):
    s = {"id": str(id)}
    s.update(kw)
    return s

def K(code, desc, size=None, hand=None): return {"code": code, "desc": desc, "size": size, "hand": hand}

# =====================================================================  BLUM
U("blum_space_corner", "blum-space-corner-syncromotion", "Blum", "SPACE CORNER (SYNCROMOTION)", "cdrawer", "base",
  front="unit", src="Blum MA-493/0 (S01 p2-5), catalog 2020/21 (S03 p268)",
  sizes=[S(600, depth=600, label="NL 600"), S(650, depth=650, label="NL 650")],
  limits={"hiClear": {"M": 33, "C": 163, "D": 195}},
  load={"total": 65},
  draw={"drawers": 2},
  codes=[K("ZML.0330", "drilling template SPACE CORNER with SYNCROMOTION"), K("65.1106 / 65.1107", "add-on for SPACE CORNER (universal template)"),
         K("ZSI.450BI3E / ZSI.500BI3E", "ORGA-LINE BI3E set, NL 600 / 650"), K("ZSI.450FI3 / ZSI.500FI3", "ORGA-LINE FI3 set, NL 600 / 650")],
  interp=["NL 600/650 = lungimi nominale ale sertarului, citite ca adâncime interioară minimă a corpului (sursa nu spune «adâncime minimă» explicit)",
          "sertarul are fund pentagonal la 135°; reprezentat în 3D ca două sertare drepte (schematic)"],
  notes=["nCornerWidth"])
U("blum_movento_space_corner", "blum-movento-space-corner-us", "Blum", "MOVENTO | SPACE CORNER (US, with rigid fronts)", "cdrawer", "base",
  front="unit", src="Blum Inc. MOVENTO | SPACE CORNER (S04 p1-2)",
  limits={"sideMax": 16}, load={}, draw={"drawers": 2},
  codes=[K("769.6860S", "MOVENTO runner set for SPACE CORNER, max 16 mm drawer side"), K("T51.7601 R / L", "locking device right / left")],
  interp=["documentul american dă dimensiunile corpului în țoli (33, 36, 39, 42 in) și sarcina în lb (170); neconvertite, deci fără verificare de lățime"],
  notes=["nImperial"])
U("blum_space_tower", "blum-space-tower", "Blum", "SPACE TOWER", "tall", "tall", front="hinged",
  src="Blum TD-082/4 (S02 p2-6), catalog 2020/21 (S03 p300-301)",
  limits={"cab": R(275, 1200)}, load={"total": 70},
  draw={"levels": 5, "gallery": True},
  interp=["fiecare scoatere (LEGRABOX/MERIVOBOX/TANDEMBOX/MOVENTO/TANDEM) are greutatea totală de 70 kg (S02, ediția 2024); catalogul 2020 dă 30 sau 65 kg pentru TANDEMBOX",
          "înălțimile scoaterilor din desen (57, 436, 756, 1108, 1428, 1684) sunt un exemplu LEGRABOX, nu o regulă"],
  notes=["nTowerHinge"])
U("blum_space_twin", "blum-space-twin", "Blum", "SPACE TWIN", "pullout", "base", front="frame",
  src="Blum SPACE TWIN (S05 p3,8; S03 p265/268/315)",
  sizes=[S("legrabox", cab=R(185, 250), label="LEGRABOX"), S("tandembox", cab=R(165, 250), label="TANDEMBOX antaro")],
  load={"total": 20}, draw={"levels": 2},
  interp=["lățimea 185–250 / 165–250 e a corpului (cabinet width), citită ca lățime exterioară"])

# =====================================================================  KESSEBOHMER
LM = C["kb-lemans2"]
U("kb_lemans2", "kb-lemans2", "Kesseböhmer", "LeMans II (Arena Classic / Style / Pure)", "blind", "base", hand=True, front="hinged",
  src="Kesseböhmer MA 402118 (S07 p3-5), catalog 2013 (S06 p4-5), Demos K05 (S11 p27-32)",
  sizes=[S(400, door=400, wi=[764, None], open=R(361, 368)), S(450, door=450, wi=[800, None], open=R(411, 418)),
         S(500, door=500, wi=[910, None], open=R(461, 468)), S(600, door=600, wi=[960, None], open=R(561, 568))],
  limits={"depth": 500, "topClear": 60, "postMax": 65, "doorAngleMin": 85, "sideMin": 16},
  bands=[S("007944", hi=R(600, 750), code="00 7944"), S("007958", hi=R(650, 800), code="00 7958"), S("007945", hi=R(720, 900), code="00 7945")],
  load={"tray": 25}, draw={"levels": 2, "split": False},
  codes=[K("03 7918 / 03 7919", "Arena Classic set 400 R / L", 400), K("03 7920 / 03 7921", "Arena Classic 450 R / L", 450),
         K("03 7922 / 03 7923", "Arena Classic 500 R / L", 500), K("03 7924 / 03 7925", "Arena Classic 600 R / L", 600),
         K("07 7918 / 07 7919", "Arena Style 400 R / L", 400), K("07 7920 / 07 7921", "Arena Style 450 R / L", 450),
         K("07 7922 / 07 7923", "Arena Style 500 R / L", 500), K("07 7924 / 07 7925", "Arena Style 600 R / L", 600),
         K("00 7955 / 00 7956", "SoftStopp Plus (optional) R / L")],
  interp=["lățimea interioară minimă (764/800/910/960) = coloana «inner width» din MA 402118; deschiderea liberă (361–368 …) = «clear door opening»",
          "tăvile sunt două (față, spate); dimensiunile lor nu sunt în text (doar desenul de rotire)"],
  notes=["nDoorOnTray"])
U("kb_lemans2_highboard", "kb-lemans2-highboard", "Kesseböhmer", "LeMans II Highboard (semicolumn)", "blind", "tall", hand=True, front="hinged",
  src="Kesseböhmer MA 402123 (S08 p1,3-5), catalog 2013 (S06 p8-9)",
  sizes=[S(400, door=400, wi=[764, None], open=R(361, 368)), S(450, door=450, wi=[800, None], open=R(411, 418)),
         S(500, door=500, wi=[910, None], open=R(461, 468)), S(600, door=600, wi=[960, None], open=R(561, 568))],
  limits={"depth": 500, "hi": R(1265, None)},
  bands=[S("007943", hi=R(1265, None), code="00 7943")],
  load={"tray": 25}, draw={"levels": 2, "split": False},
  codes=[K("00 7943", "axle for clear height 1250 mm (2 M profiles, 2 bearing brackets)"), K("00 7955 / 00 7956", "SoftStopp Plus (optional) R / L")],
  interp=["aceleași seturi ca LeMans II (03 79xx / 07 79xx)"])
U("kb_dispensa_vvsx", "kb-dispensa-vvsx", "Kesseböhmer", "DISPENSA VVS-x (ARENA)", "tall", "tall", front="frame",
  src="Kesseböhmer MA 402053 (S10 p1,3-4), Demos K05 (S11 p15-23)",
  sizes=[S(150, cab=150, basketW=100), S(200, cab=200, basketW=150), S(300, cab=300, basketW=250), S(400, cab=400, basketW=350), S(450, cab=450, basketW=400)],
  limits={"depth": 500},
  bands=[S("b1", hi=R(900, 1300), n=3, frame=R(845, 1245)), S("b2", hi=R(1200, 1600), n=4, frame=R(1145, 1545)),
         S("b3", hi=R(1600, 2000), n=5, frame=R(1545, 1945)), S("b4", hi=R(1800, 2200), n=6, frame=R(1745, 2145))],
  load={"basket": 18, "total": 120, "slide": 100}, draw={"basketH": 94, "basketD": 462},
  codes=[K("496375-496394", "Demos sets Arena Style chrome/white, widths 150-450")],
  interp=["lățimea 150…450 = «cabinet» din tabelele Demos, citită ca lățime exterioară a corpului",
          "rezistența glisierei 100 kg (catalog) față de 120 kg «greutate proprie + încărcătură» (MA): ambele păstrate"],
  notes=["nFrontOnFrame"])
U("kb_base_basket_150", "kb-dispensa-junior-comfort", "Kesseböhmer", "Base basket 150 mm (side runner)", "pullout", "base", front="frame",
  src="Demos K05 (S11 p37-38)", sizes=[S(150, cab=150, wi=[112, None], depth=542)], limits={},
  load={"basket": 12}, draw={"levels": 2, "basketW": 112, "basketH": 540, "basketD": 481},
  codes=[K("233461 / 233460", "150 mm basket set with 2 shelves, Arena Style / Classic, right")],
  interp=["«h540» = înălțimea ansamblului (cadru + coșuri) din text; afișată fără rotunjire"])
U("kb_junior3", "kb-dispensa-junior-comfort", "Kesseböhmer", "Dispensa Junior III", "pullout", "base", front="frame",
  src="Demos K05 (S11 p39)", sizes=[S(300, cab=300), S(400, cab=400), S(450, cab=450)], limits={},
  load={"basket": 12, "total": 28}, draw={"levels": 2},
  codes=[K("245870 / 245871 / 353263", "Dispensa Junior III frame 300 / 400 / 450")])
U("kb_junior_slim", "kb-dispensa-junior-comfort", "Kesseböhmer", "Dispensa Junior Slim 150", "pullout", "base", front="frame",
  src="Demos K05 (S11 p42)", sizes=[S(150, cab=150, hi=R(640, 728), depth=490)], limits={},
  load={"basket": 12, "total": 28}, draw={"levels": 2}, codes=[K("393207 / 393208", "Junior Slim frame grey / anthracite")])
U("kb_comfort2", "kb-dispensa-junior-comfort", "Kesseböhmer", "Comfort II (side frame)", "pullout", "base", hand=True, front="frame",
  src="Demos K05 (S11 p39-41)",
  sizes=[S(300, cab=R(190, 400), wi=[262, None]), S(400, cab=R(190, 400), wi=[362, None]), S(450, cab=R(190, 400), wi=[412, None])],
  limits={"hi": R(700, None), "depth": 480},
  load={"total": 20}, draw={"levels": 2},
  codes=[K("405930 / 405931", "Comfort II side frame left / right")],
  interp=["adâncimea minimă 480–496 (variază cu varianta): se folosește valoarea mică; înălțimea minimă 615/686 nu e atribuită, nefolosită"])
U("kb_tandem_ii_side", "kb-tandem-ii-side", "Kesseböhmer", "Tandem II / Tandem Side", "tall", "tall", front="frame",
  src="Demos K05 (S11 p24-26), kesseboehmer.com (S21)",
  sizes=[S(450, cab=450), S(600, cab=600)], limits={"depth": 500, "hi": R(600, None)},
  bands=[S("h600", hi=R(600, None), code="600"), S("h800", hi=R(800, None), code="800"), S("h1100", hi=R(1100, None), code="1100"), S("h1700", hi=R(1700, None), code="1700")],
  load={"slide": 60}, draw={"levels": 4},
  codes=[K("496499-496513", "Demos Tandem II complete sets 450/600 x 800/1100/1700"), K("395670-395697", "Tandem Side frame + door baskets 450/600 x 600/800/1100/1700")],
  interp=["înălțimile 600/800/1100/1700 sunt înălțimi interioare cu glisieră; folosite ca prag minim, nu ca interval"])
U("kb_magic_corner", "kb-magic-corner-demos", "Kesseböhmer", "Magic Corner (soft close)", "blind", "base", hand=True, front="unit",
  src="Demos K05 (S11 p33)", sizes=[S("900-1000", cab=R(900, 1000))], limits={"depth": 525},
  load={"front": 7, "rear": 9, "pairFront": 14, "pairRear": 18}, draw={"levels": 2, "split": True},
  codes=[K("135867", "Magic Corner right (Kesseb. 260401)", None, "R"), K("135868", "Magic Corner left (Kesseb. 260402)", None, "L"),
         K("135869 / 260400", "Arena Style basket set"), K("135916 / 260403", "Arena Classic basket set")],
  interp=["lățimea ușii nu e dată: ușa se prinde de mecanism (clip, 3 reglaje)",
          "sursă diferită față de Peka Magic Corner (7/9 kg per coș la Kesseböhmer, 8/10 la Peka): ambele păstrate"],
  notes=["nDoorOnTray"])
U("kb_carousel", "kb-carousels", "Kesseböhmer", "Carousel 270° (3/4) / 180° (1/2)", "carousel", "base", front="hinged",
  src="Demos K05 (S11 p34-35)",
  sizes=[S(800, cab=800, dia=720, depth=480), S(900, cab=900, dia=800, depth=510)],
  limits={"hi": R(655, 745)},
  load={"shelf": 25}, draw={"shape": "34", "shelves": 2},
  codes=[K("353254 (Kesseb. 250052)", "axle 655-745"), K("353255 / 260546", "Arena Style shelf, cabinet 800 dia 720", 800), K("353256 / 260547", "Arena Style shelf, cabinet 900 dia 800", 900)],
  interp=["diametrul 720/800 e al rafturilor Arena Style (Demos); «depth 480/510» = adâncimea minimă a corpului, din desen",
          "numărul de rafturi nu e dat: reprezentat cu două"])
U("kb_revo90", "kb-carousels", "Kesseböhmer", "Revo 90° (door on mechanism)", "carousel", "base", front="unit",
  src="Demos K05 (S11 p35-36)",
  sizes=[S(800, cab=800, dia=710), S(900, cab=900, dia=810)], limits={"hi": R(660, 860)},
  load={"mechanism": 50}, draw={"shape": "34", "shelves": 2},
  codes=[K("135888 / 260500", "Revo 90 mechanism 660-860"), K("135890 / 260503", "Revo 90 Arena Style shelf 800 dia 710", 800), K("135891 / 260506", "Revo 90 Arena Style shelf 900 dia 810", 900)],
  interp=["ușa e montată direct pe mecanism și se rotește cu raftul; desenul de ansamblu (p36) nu a fost interpretat"])
U("demos_half_88449", "demos-carousels-brand-unspecified", "Demos (brand not stated)", "1/2 round pull-out rotating tray 88449", "carousel", "base", front="hinged",
  src="Demos K05 (S11 p61)", sizes=[S(900, cab=900, depth=760)], limits={"hi": R(645, 790)}, load={"tray": 11},
  draw={"shape": "12", "shelves": 1, "trayH": 420}, codes=[K("88449", "1/2 circle pull-out rotating tray chrome")])
U("demos_half_88404", "demos-carousels-brand-unspecified", "Demos (brand not stated)", "1/2 round rotating tray 88404", "carousel", "base", front="hinged",
  src="Demos K05 (S11 p62)", sizes=[S(800, cab=800, depth=760)], limits={"hi": R(645, 790)}, load={},
  draw={"shape": "12", "shelves": 1, "trayH": 420}, codes=[K("88404", "1/2 circle rotating tray chrome")])
U("demos_34_162230", "demos-carousels-brand-unspecified", "Demos (brand not stated)", "3/4 round rotating tray 162230", "carousel", "base", front="hinged",
  src="Demos K05 (S11 p62)", sizes=[S(900, cab=900, depth=815)], limits={"hi": R(645, 790)}, load={},
  draw={"shape": "34", "shelves": 1}, codes=[K("162230", "3/4 circle rotating tray chrome")])

# =====================================================================  PEKA
PMC = C["peka-magic-corner-comfort"]["cabinet"]
U("peka_magic_corner_comfort", "peka-magic-corner-comfort", "Peka", "Magic Corner Comfort", "blind", "base", hand=True, front="hinged",
  src="Peka MA 950.0523.MA (S12 p1,2,4), data sheet (S14a)",
  sizes=[S("450/900", door=450, wi=[862, 971]), S("500/900", door=500, wi=[862, 971]), S("550/900", door=550, wi=[950, 968]),
         S("550/1000", door=550, wi=[962, 1171]), S("600/900", door=600, wi=[950, 968]), S("600/1000", door=600, wi=[962, 1171])],
  limits={"depth": 500, "hi": R(545, None)},
  load={"front": 8, "rear": 10, "total": 36}, draw={"levels": 2, "split": True},
  codes=[K("300.0580.xx", "Magic Corner Comfort 900 right", None, "R"), K("300.0581.xx", "900 left", None, "L"),
         K("300.0582.xx", "1000 right", None, "R"), K("300.0583.xx", "1000 left", None, "L")],
  interp=["«LB» (inner width) = lățimea interioară; lățimea frontului FB = lățimea ușii; tipul 900/1000 din cod = lățimea nominală a corpului",
          "etichetele rândurilor din tabelul MA (A, LM, B1, B2) nu sunt folosite"])
U("peka_magic_corner_standard", "peka-magic-corner-standard", "Peka", "Magic Corner Standard", "blind", "base", hand=True, front="unit",
  src="Peka MA 950.0321.MA (S13 p1,2,5), data sheet (S14b)",
  sizes=[S("450/900", door=450, wi=[860, 971]), S("550/900", door=550, wi=[960, 971]), S("600/900", door=600, wi=[960, 971]),
         S("550/1000", door=550, wi=[960, 1071]), S("600/1000", door=600, wi=[960, 1071])],
  limits={"depth": 500, "hi": R(540, None)},
  load={"front": 7, "rear": 9, "total": 32}, draw={"levels": 2, "split": True},
  codes=[K("300.0826.xx", "li 900", None, "L"), K("300.0831.xx", "re 900", None, "R"), K("300.0814.xx", "li 1000", None, "L"), K("300.0817.xx", "re 1000", None, "R"),
         K("950.0351.MA / 950.0352.MA", "drilling template left / right")],
  interp=["lățimile 400 și 500 apar în lista FB dar nu în tabelul LB: nu sunt oferite ca mărimi",
          "legătura FB 550/600 ↔ rândurile Y 546/596 din tabel e interpretată (Y = FB − 4)"],
  notes=["nDoorOnTray"])
U("peka_pinello_cargo", "peka-pinello-cargo", "Peka", "Pinello Cargo", "pullout", "base", front="frame",
  src="Peka data sheet (S14c)", sizes=[S(200, cab=200, wi=[162, 168], depth=506, hi=R(517, None)), S(300, cab=300, wi=[262, 268], depth=520, hi=R(525, None))],
  limits={}, load={"total": 30}, draw={"levels": 3},
  interp=["valorile 506/520 și 517/525 se citesc în ordinea listei, 200 apoi 300 (atribuire neconfirmată)", "2–4 nivele (Blum LEGRABOX sau Grass Nova Pro)"])
U("peka_hochschrank", "peka-hochschrank-standard", "Peka", "Hochschrank Standard", "tall", "tall", front="frame",
  src="Peka data sheet (S14d)", sizes=[S(150, cab=150), S(275, cab=275), S(300, cab=300), S(400, cab=400), S(450, cab=450)],
  limits={"wiMin": 112, "depth": 505},
  bands=[S("b1", hi=R(900, 1300)), S("b2", hi=R(1200, 1600)), S("b3", hi=R(1600, 2000)), S("b4", hi=R(1805, 2205))],
  load={"total": 120, "runner": 100}, draw={"levels": 5},
  interp=["lățimea interioară minimă 112 / 162 nu e atribuită pe lățimi: se folosește cea mică", "al cincilea interval din text (1999) nu e atribuit, nefolosit"])
U("peka_pleno_plus", "peka-pleno-plus-maxi", "Peka", "Pleno Plus", "tall", "tall", hand=False, front="hinged",
  src="Peka data sheet (S14e)", sizes=[S(600, cab=600, wi=[562, 568])], limits={"depth": 500},
  bands=[S("h1", hi=R(1300, None)), S("h2", hi=R(1600, None)), S("h3", hi=R(1900, None))],
  load={"total": 97}, draw={"levels": 4, "doorShelves": True},
  interp=["sarcina 0–94 / 0–97 kg: valoarea mai mare e păstrată, atribuirea pe înălțimi neconfirmată"])
U("peka_pleno_maxi", "peka-pleno-plus-maxi", "Peka", "Pleno Maxi", "tall", "tall", front="hinged",
  src="Peka data sheet (S14f)", sizes=[S(450, cab=450, wi=[404, None]), S(600, cab=600, wi=[554, None]), S(750, cab=750, wi=[704, None])],
  limits={"depth": 500},
  bands=[S("h1", hi=R(1150, None)), S("h2", hi=R(1450, None)), S("h3", hi=R(1800, None))],
  load={"total": 78}, draw={"levels": 4, "doorShelves": True},
  interp=["perechile lățime ↔ LB min sunt în ordine crescătoare (450/404, 600/554, 750/704)"])
U("peka_extendo", "peka-extendo", "Peka", "Extendo (pull-out shelf)", "pullout", "base", front="hinged",
  src="Peka data sheet (S14g)",
  sizes=[S(450, cab=450, wi=[412, 418]), S(500, cab=500, wi=[462, 468]), S(550, cab=550, wi=[512, 518]), S(600, cab=600, wi=[562, 568]), S(900, cab=900, wi=[862, 868])],
  limits={"depth": 508, "hi": R(138, None)}, load={}, draw={"levels": 1},
  interp=["adâncimea minimă 508 / 515 / 519 nu e atribuită pe lățimi: se folosește 508 (cea mai mică)", "sarcina nu e dată"])

# =====================================================================  HETTICH
U("hettich_salso", "hettich-salso", "Hettich", "Salso", "blind", "base", hand=True, front="hinged",
  src="Hettich catalog 08/2025 (S15 p14-16)",
  sizes=[S(400, door=400, wi=[760, None], open=R(360, None)), S(450, door=450, wi=[860, None], open=R(410, None)),
         S(500, door=500, wi=[960, None], open=R(460, None)), S(600, door=600, wi=[960, None], open=R(560, None))],
  limits={"depth": 465, "hi": R(620, 820), "doorAngleMax": 85},
  load={"tray": 18}, draw={"levels": 2, "split": False},
  codes=[K("9 381 049 / 9 381 050", "Salso set 400 left / right silver", 400), K("9 381 051 / 9 381 052", "Salso set 450/500 left / right silver", "450"),
         K("9 381 053 / 9 381 054", "Salso set 600 left / right silver", 600), K("9 381 077-084", "shelf set 400 chrome/white")],
  interp=["A, B din tabelul de planificare = lățime interioară și deschidere liberă (la fel ca în MA LeMans)",
          "conflict de sursă: pagina de magazin dă înălțime interioară 620–780 și adâncime 460, cataloagul 620–820 și 465; cataloagul folosit"])
U("hettich_orta", "hettich-orta-goro", "Hettich", "Orta (with pot-and-pan drawer)", "blind", "base", front="hinged",
  src="Hettich catalog 08/2025 (S15 p18-20)",
  sizes=[S(400, door=400, wi=[725, None], open=R(340, None)), S(450, door=450, wi=[755, None], open=R(385, None)),
         S(500, door=500, wi=[795, None], open=R(420, None)), S(600, door=600, wi=[945, None], open=R(535, None))],
  limits={"depth": 500, "hi": R(575, None)}, load={"front": 7, "rear": 11}, draw={"levels": 2, "split": True, "drawer": True},
  codes=[K("9 381 093-096", "Orta centre upright silver 400/450/500/600"), K("9 381 109-116", "Orta shelf set 400")],
  interp=["al treilea rând al tabelului e tipărit «550» deși lățimile sunt 400/450/500/600: citit ca 500 (interpretat)", "număr de coșuri nespus: reprezentat 2 + 2"])
U("hettich_goro", "hettich-orta-goro", "Hettich", "Goro", "blind", "base", hand=True, front="hinged",
  src="Hettich catalog 08/2025 (S15 p22-23)", sizes=[S(450, door=450, wi=[860, 1020])], limits={"depth": 485, "hi": R(615, None)},
  load={"front": 7, "rear": 9}, draw={"levels": 2, "split": True, "drawer": True},
  codes=[K("9 381 117 / 9 381 118 / 9 381 119 / 9 381 120", "Goro centre upright 450 L/R silver/anthracite")],
  interp=["intervalul 860–1020 e din desen (lățime interioară)"])
U("hettich_olona", "hettich-olona-iseo-lario", "Hettich", "Olona", "tall", "tall", front="frame",
  src="Hettich catalog 08/2025 (S15 p24-26)", sizes=[S(300, cab=300, wi=[257, None]), S(400, cab=400, wi=[357, None])],
  limits={"depth": 494, "hi": R(1600, 2250)}, bands=[S("a", hi=R(1600, 1950)), S("b", hi=R(1900, 2250))],
  load={"total": 100}, draw={"levels": 5},
  codes=[K("9 380 988-991", "runners"), K("9 380 992-999", "centre upright")],
  interp=["adâncimea minimă 494 (șină 9380988/989) sau 504 (9380990/991): se folosește 494; intervalele de înălțime pe lățimi nu sunt atribuite, se folosește reuniunea"])
U("hettich_iseo", "hettich-olona-iseo-lario", "Hettich", "Iseo (swivel larder)", "tall", "tall", front="hinged",
  src="Hettich catalog 08/2025 (S15 p28-30)", sizes=[S(600, cab=600)], limits={"depth": 495, "hi": R(1695, None), "doorAngleMax": 115},
  load={"shelf": 10, "doorShelf": 5, "total": 85}, draw={"levels": 4, "doorShelves": True},
  codes=[K("9 381 008 / 9 381 009", "Iseo frame silver / other"), K("9 381 010-012", "shelves")])
U("hettich_lario", "hettich-olona-iseo-lario", "Hettich", "Lario", "pullout", "base", front="frame",
  src="Hettich catalog 08/2025 (S15 p4-13)",
  sizes=[S(150, cab=150, wi=[112, 118]), S(200, cab=200, wi=[162, 168]), S(300, cab=300, wi=[262, 268]), S(400, cab=400, wi=[362, 368])],
  limits={"depth": 480}, load={"tier2": 10, "tier3": 15}, draw={"levels": 3},
  codes=[K("9 381 014-033", "Lario sets depending on width/finish")],
  interp=["adâncimea minimă variază 480…525 cu varianta; se folosește 480", "glisiera Quadro V6 NL 470 se comandă separat"])
U("hettich_naro", "hettich-olona-iseo-lario", "Hettich", "Naro", "pullout", "base", front="frame",
  src="Hettich catalog 08/2025 (S15 p4-13)", sizes=[S(450, cab=450), S(600, cab=600), S(900, cab=900)], limits={},
  load={"tray": 15}, draw={"levels": 3}, codes=[K("9 381 041-046", "Naro")])
U("hettich_carousel", "hettich-corner-3-4-carousel", "Hettich", "Corner carousel 3/4 (Arena Style / Classic)", "carousel", "base", front="hinged",
  src="Hettich catalog TA 2023 p.873 (HET-BK905)",
  sizes=[S(800, cab=800, dia=700, axis=360), S(900, cab=900, dia=820, axis=420)], limits={},
  load={"shelf": 15}, draw={"shape": "34", "shelves": 2},
  codes=[K("9 079 941 / 0 070 553", "700 for 800x800, Arena Style / Classic", 800), K("9 079 955 / 0 070 554", "820 for 900x900, Arena Style / Classic", 900),
         K("9 080 040", "Revo 90 folding-door corner fitting")],
  interp=["«pivot of shelves 360 / 420 mm from walls»: axa de rotație la 360 (800) / 420 (900) mm de ambii pereți"])

# =====================================================================  HAFELE / VAUTH-SAGEL / GRASS
U("hafele_corner_549_42", "hafele-corner-549-42", "Häfele", "Corner pull-out shelving unit 549.42", "blind", "base", hand=True, front=None,
  src="Häfele UK p1.46 (S18a)",
  sizes=[S(400, door=400, cab=R(800, None)), S(450, door=450, cab=R(900, None)), S(500, door=500, cab=R(1000, None)), S(600, door=600, cab=R(1000, None))],
  limits={"depth": 470}, load={"shelf": 20, "total": 40}, draw={"levels": 2, "split": False},
  codes=[K("549.42.341 / 549.42.340", "800 cab / 400 door left / right", 400), K("549.42.346 / 549.42.345", "900 / 450", 450),
         K("549.42.351 / 549.42.350", "1000 / 500", 500), K("549.42.361 / 549.42.360", "1000 / 600", 600),
         K("549.42.991 / 549.42.990", "corner pull-out frame left / right")],
  interp=["«built-in depth 470 or 480»: se folosește 470 ca minim", "fixarea ușii nu e descrisă"])
U("hafele_swingout_549_38", "hafele-swingout-corner-549-38", "Häfele", "Swing out corner unit 549.38 / 549.86", "blind", "base", hand=True, front=None,
  src="Häfele UK (S18d)",
  sizes=[S(400, door=400, open=R(360, None), cab=R(800, None)), S(450, door=450, open=R(410, None)), S(500, door=500), S(600, door=600)],
  limits={"depth": 470}, load={"front": 7.5, "rear": 10, "total": 35}, draw={"levels": 2, "split": True},
  codes=[K("549.38.248 / 549.38.249", "chrome wire L/R, 800 cabinet"), K("549.86.194 / 549.86.195", "chrome wire 900/1000 L/R")],
  interp=["lățimea minimă a corpului 800 (ușă 400) dată explicit; 900 / 1000 pentru celelalte uși nu sunt atribuite în text pentru această unitate"])
U("vs_cor_flex", "vs-cor-flex-hafele", "Vauth-Sagel (Häfele)", "VS COR Flex", "blind", "base", front=None,
  src="Häfele UK p1.50-1.53 (S18b)",
  sizes=[S(450, door=450, cab=R(900, None), wi=[693, None], open=R(381, None)), S(500, door=500, cab=R(1000, None), wi=[802, None], open=R(444, None))],
  limits={"depth": 480}, load={"basket": 8, "total": 32}, draw={"levels": 2, "split": True},
  codes=[K("548.29.343 / 548.29.344", "Planero lava grey 900 / 1000"), K("548.29.233 / 548.29.234", "Premea white/chrome")],
  interp=["ușile 450 / 500 ↔ corpurile 900 / 1000 în ordinea listei", "baskets libere față de ușă: 40 mm (S18b)"])
U("vs_cor_fold", "vs-cor-fold-hafele", "Vauth-Sagel (Häfele)", "VS COR Fold", "blind", "base", hand=True, front="unit",
  src="Häfele UK p1.54-1.57 (S18c)",
  sizes=[S(400, door=400, cab=R(800, None)), S(450, door=450, cab=R(900, None)), S(500, door=500, cab=R(900, None)), S(600, door=600, cab=R(900, None))],
  limits={"depth": 485}, load={"front": 8, "rear": 9.5, "total": 35}, draw={"levels": 2, "split": True},
  codes=[K("548.13.384 / 548.13.385", "Planero 800 L/R"), K("548.13.386 / 548.13.387", "Planero 900 L/R")],
  interp=["ușa 400 pentru corp 800, 450–600 pentru corp 900 (900 utilizabil și în 1000/1200)"], notes=["nDoorOnTray"])
U("vs_cornerstone_swing", "vs-cornerstone-swing", "Vauth-Sagel (Häfele)", "Cornerstone Swing", "blind", "base", front=None, hand=True,
  src="Häfele UK (S18g)",
  sizes=[S(400, door=400, cab=R(800, None)), S(450, door=450, cab=R(900, None)), S(500, door=500, cab=R(1000, None)), S(600, door=600, cab=R(1000, None))],
  limits={"depth": 490, "hi": R(651, 690), "postMax": 65, "wiMin": 414}, load={"shelf": 18, "total": 36}, draw={"levels": 2, "split": False},
  codes=[K("542.05.870-873", "Premea lava grey, 800/900/1000/1000 (door 400/450/500/600)"), K("542.05.999", "soft close add-on")],
  interp=["«installation height 651–690» citită ca înălțime interioară; dreapta/stânga nespuse în sursă (variante L/R presupuse ca la celelalte, de confirmat)"])
U("vs_cor_wheel_pro", "vs-cor-wheel-pro", "Vauth-Sagel (Häfele)", "VS COR Wheel Pro", "carousel", "base", front="hinged",
  src="Häfele UK p1.69 (S18h)", sizes=[S(900, cab=900, dia=720, depth=815)], limits={"hi": R(620, None)}, load={"shelf": 27.5},
  draw={"shape": "34", "shelves": 2}, codes=[K("542.62.812", "White/Chrome"), K("542.26.412", "Lava grey")])
U("hafele_ninka_arc", "haefele-corner-units", "Häfele", "Ninka Pro(arc) 3/4 carousel", "carousel", "base", front="hinged",
  src="Häfele UK p1.70 (HAF-20D1-70)", sizes=[S(800, cab=800), S(900, cab=900)], limits={"hi": R(667, 713)}, load={"total": 25},
  draw={"shape": "34", "shelves": 2}, codes=[K("542.85.550", "Ninka Pro(arc) set")],
  interp=["«spindle height 667–713» citită ca înălțime interioară"])
U("hafele_utensio_inline", "hafele-utensio-inline", "Häfele", "Utensio Pro Inline Corner", "blind", "base", front=None,
  src="Häfele UK (S18e)",
  sizes=[S(450, door=450, cab=R(900, None), wi=[825, None]), S(500, door=500, cab=R(1000, None), wi=[875, None]), S(600, door=600, cab=R(1200, None), wi=[975, None])],
  limits={"depth": 489, "hi": R(548, None)}, load={"front": 15, "rear": 10, "total": 50}, draw={"levels": 2, "split": True},
  codes=[K("542.35.309 / 542.35.312 / 542.35.315", "folded baskets 900 / 1000 / 1200")],
  interp=["lățimile de instalare 825/875/975 citite ca lățime interioară minimă", "înălțimea de instalare 548 citită ca înălțime interioară minimă"])
U("hafele_utensio_glide", "hafele-utensio-glide", "Häfele", "Utensio Pro Glide Corner", "blind", "base", hand=True, front=None,
  src="Häfele UK (S18f)",
  sizes=[S(400, door=400, cab=R(800, None), wi=[760, None], open=R(380, None)), S(450, door=450, cab=R(900, None), wi=[860, None], open=R(430, None)),
         S(500, door=500, cab=R(1000, None), wi=[910, None], open=R(480, None)), S(600, door=600, cab=R(1000, None), wi=[960, None], open=R(580, None))],
  limits={"hi": R(640, None)}, load={"shelf": 20, "total": 40}, draw={"levels": 2, "split": False},
  codes=[K("542.35.302 / 542.35.301", "800/400 L/R", 400), K("542.35.304 / 542.35.303", "900/450", 450), K("542.35.306 / 542.35.305", "1000/500", 500),
         K("542.35.308 / 542.35.307", "1000/600", 600), K("542.35.339", "add-on soft close")],
  interp=["X1 / X2 din tabel = lățime interioară minimă / deschidere liberă minimă (ca la Salso)", "«installation height 640 ± 25»: 640 ca înălțime interioară minimă; pas de reglare 25"])
U("grass_quaturis_s", "grass-quaturis-s", "GRASS", "Quaturis S", "blind", "base", hand=True, front="hinged",
  src="GRASS Quaturis brochure 07/2015 (S19 p8-12)",
  sizes=[S(450, door=450, cab=R(870, None), open=R(412, 418)), S(500, door=500, cab=R(920, None), open=R(462, 468)), S(600, door=600, cab=R(1020, None), open=R(562, 568))],
  limits={"depth": 490, "sideMin": 16, "hi": R(600, 900)},
  bands=[S("base", hi=R(600, 900), n=2), S("tall3", hi=R(900, 1200), n=3), S("tall4", hi=R(1200, 1500), n=4)],
  load={"shelf": 20}, draw={"levels": 2, "split": False},
  codes=[K("F154147594 / F154147595", "fitting set left / right, KH 600-900"), K("F154148027 / F154148028", "tall 900-1200 L/R"), K("F154148029 / F154148030", "tall 1200-1500 L/R")],
  interp=["lățimile corpului pe tipul 450/500/600: min 870 / 920 / 1020 cu balama standard (cu balama de colț 880 / 930 / 1030)", "broșura e din 2015, poate înlocuită"])
U("grass_quaturis_75", "grass-quaturis-75-vs-cor-spin", "GRASS / Vauth-Sagel", "Quaturis 75 / VS COR Spin (pie-cut 3/4)", "carousel", "base", front="hinged",
  src="GRASS (S19 p16-17), Vauth-Sagel D7100001000 / D7100003000 (S20a/b p1)",
  sizes=[S(800, cab=800), S(900, cab=900)], limits={"hi": R(690, 910), "depth": 500},
  load={}, draw={"shape": "34", "shelves": 2},
  codes=[K("F154147590-593", "Quaturis 75 sets 1-4"), K("F154147355 / F154145804", "wood shelf set 800 / 900")],
  interp=["adâncimea 500 = setul 1 (cel mai mic dintre 500/510/515/525)", "sarcina pe raft nu e dată; conflict 515/525 (Quaturis) vs 512/522 (VS COR Spin): se folosește 500"])

# =====================================================================  MOTION (cat-motion.json)
FS = M["hettich-furnspin"]
U("hettich_furnspin", "hettich-furnspin", "Hettich", "FurnSpin (rotating cabinet body)", "spin", "any", hand=True, front=None,
  src="Hettich FurnSpin data sheet V5 (HET-FS-DS5 p7-14), catalog (HET-FS-CAT p12-17), DIM certificate (HET-FS-DIM)",
  sizes=[S("S", load=80, fit=339, fitH=40, bbox=R(377, 450), half=169.5, X=R(192, 207), gap=5, gapMin=3, gapBelow=381, hiMax=2000, panelKg=R(8, 15), bottomOuter=16, bottomSpin=19),
         S("M", load=100, fit=402, fitH=40, bbox=R(440, 515), half=201, X=R(218, 234), gap=7, gapMin=3, gapBelow=448, hiMax=2200, panelKg=R(9, 18), bottomOuter=18, bottomSpin=22),
         S("XL", load=120, fit=526, fitH=45, bbox=R(564, 664), half=263, X=R(275, 296), gap=7, gapMin=3, gapBelow=574, hiMax=2400, panelKg=R(10, 20), bottomOuter=18, bottomSpin=25)],
  limits={"spinH": R(700, 2400), "reveal": 3, "topClear": 75, "topOuter": 16, "sideOuter": 16, "backOuter": 16, "topSpin": 16, "panelSpin": 16, "ptoSwitchH": 1800},
  load={}, draw={"endDeg": 180},
  codes=[K("9 349 281 / 9 349 282", "S Silent System left / right"), K("9 349 283-286", "S PTO Silent top/bottom left/right"),
         K("9 349 287 / 9 349 288", "M Silent System left / right"), K("9 349 289 / 9 349 290 / 9 349 301 / 9 349 302", "M PTO Silent"),
         K("9 349 303 / 9 349 304", "XL Silent System left / right"), K("9 349 305-308", "XL PTO Silent top/bottom left/right")],
  interp=["rotație în jurul axei verticale prin centrul casetei de gabarit, două poziții de capăt 0° și 180°; sensul nu se inversează",
          "modelul de găurire nu e în fișa tehnică (vine din configuratorul Hettich): fără găuri generate",
          "poziția corpului rotativ în corpul exterior e schematică; înălțimea rotativului = înălțimea interioară minus cele două fitinguri (schematic)"],
  notes=["nFurnSpinNoDrill"])
EDW = M["haefele-utensio-pro-easy-down"]
U("hafele_easy_down", "haefele-utensio-pro-easy-down", "Häfele", "Utensio Pro Easy Down (pull-down, 3 baskets)", "pulldown", "wall", front="hinged",
  src="Häfele UK 1.144A (HAF-144A p1)",
  sizes=[S(500, cab=500, wi=[464, None], depth=242, hi=R(582, None), travel=418), S(600, cab=600, wi=[564, None], depth=242, hi=R(582, None), travel=418)],
  limits={}, load={"total": 8}, draw={"baskets": 3},
  codes=[K("542.35.153", "folded baskets 500"), K("542.35.154", "accent 500"), K("542.35.155", "glass 500"), K("542.35.156", "folded 600"), K("542.35.157", "accent 600"), K("542.35.158", "glass 600")],
  interp=["«installed width/depth/height» citite ca spațiu interior minim"])
U("kb_imove", "kessebohmer-imove", "Kesseböhmer", "iMove (pull-down, single / double tray)", "pulldown", "wall", front="hinged",
  src="Kesseböhmer MA 404352 (KES-IMOVE p2-3)", sizes=[S("single/double", depth=279)], limits={}, load={"total": 8}, draw={"baskets": 2},
  interp=["cursa nu e dată în text: coborârea e schematică", "adâncimea interioară minimă 279 (Y); X 57–82"])
U("hafele_tv_lift", "haefele-led-tv-lift-700", "Häfele", "LED TV lift 700 mm + swivel bracket", "tvlift", "any", front=None,
  src="Häfele UK 3.35 (HAF-25L3-35 p1)", sizes=[S("700", travel=700)], limits={}, load={"total": 65, "upsideDown": 29}, draw={"vesa": R(400, 300), "swivel": 30},
  codes=[K("421.68.422", "LED TV lift black"), K("421.68.493", "swivel bracket black")],
  interp=["dimensiunile interioare ale corpului nu sunt în desen: fără verificare de adâncime; macara în 3 secțiuni telescopice (schematic)"])
U("accuride_db_lift", "accuride-db-lift-0019", "Accuride (Häfele)", "DB Lift-0019 (mechanical, push-to-open)", "tvlift", "any", front=None,
  src="Häfele UK 6.54 (HAF-17D6-54 p1)", sizes=[S("538", travel=538)], limits={}, load={"total": 6.5}, draw={"swivel": 112.5, "screenH": 450},
  codes=[K("421.68.375", "lift"), K("421.68.377", "weight pack extension plate"), K("421.68.376", "weight packs")],
  interp=["greutatea ecranului 2,5–6,5 kg, înălțimea ecranului ≤ 450 mm"])
U("hafele_dresscode", "haefele-dresscode-wardrobe-lift", "Häfele", "Dresscode wardrobe lift", "wardlift", "any", front=None,
  src="Häfele UK 2.25 (HAF-20D2-25 p1)", sizes=[S("440-610", wi=[440, 610]), S("600-1000", wi=[600, 1000])], limits={}, load={"min": 10},
  codes=[K("805.22.560 / 805.22.760", "440-610 umber grey / white"), K("805.22.561 / 805.22.761", "600-1000 umber grey / white")],
  interp=["sarcina e «≥ 10 kg» (minim, fără maxim în pagină); cursa nu e dată: coborârea e schematică"])
U("hettich_comfortspin", "hettich-comfortspin", "Hettich", "ComfortSpin (turntable 360°)", "turntable", "any", front=None,
  src="Hettich ComfortSpin (HET-CS-WEB, HET-CS-MAN)", sizes=[S("tray", w=425, d=285, h=37, plateSide=70)], limits={}, load={"total": 8, "offCentre": 3},
  codes=[K("9264627", "DIY shop, transparent"), K("9325328", "hettich.com page, transparent")],
  interp=["conflict de cod de articol 9264627 / 9325328: ambele păstrate", "tava 425 × 285 × 37; spațiu necesar 425 × 285"])
BR = M["haefele-hebgo-folding-brackets"]
U("hafele_fold_hinged_spring", "haefele-hebgo-folding-brackets", "Häfele", "Folding bracket, hinged spring 287.41.906 / 915", "bracket", "any", front=None,
  src="Häfele UK 7.204 (HAF-23T7-204)", sizes=[S("pair", pairKg=40)], limits={}, load={"pair": 40},
  codes=[K("287.41.906", "bracket"), K("287.41.915", "bracket")],
  interp=["A/B/C 250/25/85 și 380/25/120: sensul literelor nu e dat în text"])
U("hafele_fold_hinged_adj", "haefele-hebgo-folding-brackets", "Häfele", "Folding bracket, hinged adjustable 287.55", "bracket", "any", front=None,
  src="Häfele UK 7.204 (HAF-23T7-204)", sizes=[S("pair", pairKg=60)], limits={}, load={"pair": 60}, draw={"positions": [90, 80, 70, 0]},
  codes=[K("287.55.730 / 287.55.740", "white"), K("287.55.930 / 287.55.940", "galvanised")], interp=["A/B/C 300/200/30 și 400/270/36"])
U("hafele_hebgo_light", "haefele-hebgo-folding-brackets", "Häfele", "Hebgo light duty 287.42", "bracket", "any", front=None,
  src="Häfele UK 7.205 (HAF-23T7-205)", sizes=[S("pair", pairKg=150)], limits={}, load={"pair": 150},
  codes=[K("287.42.403", "A 330"), K("287.42.412", "A 380"), K("287.42.421", "A 480"), K("287.42.430", "A 580")],
  interp=["A/B 330/134, 380/134, 480/152, 580/178"])
U("hafele_hebgo_heavy", "haefele-hebgo-folding-brackets", "Häfele", "Hebgo heavy duty 287.43", "bracket", "any", front=None,
  src="Häfele UK 7.206 (HAF-23T7-206)", sizes=[S("pair", pairKg=500)], limits={}, load={"pair": 500},
  codes=[K("287.43.400", "A 420"), K("287.43.419", "A 480"), K("287.43.428", "A 580"), K("287.43.437", "A 680")],
  interp=["A/B 420/180, 480/180, 580/220, 680/220", "grosimea blatului → rost minim: 25:17, 30:17, 35:22, 40:28"])
U("hafele_tikla_table", "haefele-hebgo-folding-brackets", "Häfele", "Tikla table bracket 287.53.936", "bracket", "any", front=None,
  src="Häfele UK 7.207 (HAF-23T7-207)", sizes=[S("pair", pairKg=100, len=360)], limits={}, load={"pair": 100}, codes=[K("287.53.936", "Tikla table bracket")])
U("hafele_tikla_bench", "haefele-hebgo-folding-brackets", "Häfele", "Tikla bench bracket 287.48.110", "bracket", "any", front=None,
  src="Häfele UK 7.207 (HAF-23T7-207)", sizes=[S("pair", pairKg=400, len=360)], limits={}, load={"pair": 400}, codes=[K("287.48.110", "Tikla bench bracket")])

# ---------------------------------------------------------------------  proveniență: fiecare număr trebuie să existe în înregistrarea brută
def tokens(obj):
    s = json.dumps(obj, ensure_ascii=False)
    out = set()
    for m in re.finditer(r"\d+(?:[.,]\d+)?", s):
        t = m.group(0).replace(",", ".")
        out.add(float(t))
        out.add(float(t.replace(".", "")) if "." in t and False else float(t))
    return out

def nums(o, path=""):
    if isinstance(o, bool): return
    if isinstance(o, (int, float)): yield path, o
    elif isinstance(o, dict):
        for k, v in o.items(): yield from nums(v, path + "/" + k)
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from nums(v, path + "[%d]" % i)

SKIP = {"interp", "notes", "src", "key", "raw", "name", "brand", "codes"}
bad = []
for u in units:
    rec = C.get(u["raw"]) or M.get(u["raw"])
    if rec is None: bad.append((u["key"], "raw lipsă " + u["raw"])); continue
    T = tokens(rec)
    for k, v in u.items():
        if k in SKIP: continue
        for p, n in nums(v, k):
            if n in (1, 2, 3, 4, 5, 6, 7, 8, 0): continue          # numere de numărare
            if n not in T: bad.append((u["key"], p, n))
    # id-urile mărimilor sunt etichete (numere nominale scrise în text) — verificate și ele
    for s in u["sizes"]:
        if re.fullmatch(r"\d+", str(s["id"])) and float(s["id"]) not in T and float(s["id"]) > 8: bad.append((u["key"], "size id", s["id"]))
if bad:
    print("NUMERE FĂRĂ SURSĂ ÎN ÎNREGISTRAREA BRUTĂ:")
    for b in bad: print("  ", b)
    sys.exit(1)

srcs = {"corner": [s for s in json.load(open(os.path.join(rawdir, "cat-corner.json"), encoding="utf-8"))["sources"]],
        "motion": MSRC}
json.dump({"sources": srcs, "units": units}, open(os.path.join(here, "units.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(units), "unități →", os.path.join(here, "units.json"))
