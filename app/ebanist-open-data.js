/* GENERAT de tools/hw-data/open/normalize.py din tools/hw-data/raw/cat-opening.json și cat-susp.json — nu se editează.
 * Surse: documente oficiale (vezi `sources`). Fiecare număr are sursă; ce nu e citit = null; toate cotele verificat:false (D-48). */
(function (root) {
"use strict";
var EBOpenData = {
 "push": [
  {
   "id": "blum_tipon_short",
   "model": "TIP-ON",
   "ph": "door_short",
   "art": "956.1004",
   "src": "BLUM-TIPON-DOORS p10,11; BLUM-CAT24 p14,52,676",
   "lim": {
    "h": [
     null,
     1300
    ],
    "kg": null,
    "gapMin": 2.6,
    "gapMinScrew": 3.1,
    "stroke": 17,
    "adj": [
     -1.0,
     4.0
    ]
   },
   "note": "tipon",
   "drill": {
    "dia": 10,
    "depth": 50,
    "fromInner": 7.5,
    "edgeMin": 1.5,
    "ref": "inner"
   },
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tipon_a",
   "model": "TIP-ON",
   "ph": "door_long",
   "art": "956A1004 + 956A1501",
   "src": "BLUM-TIPON-DOORS p10,11; BLUM-CAT24 p14,676",
   "existing": true,
   "lim": {
    "h": [
     1300,
     null
    ],
    "kg": null,
    "gapMin": 2.6,
    "gapMinScrew": 3.1,
    "stroke": 38,
    "adj": [
     -1.0,
     4.0
    ]
   },
   "note": "tipon",
   "drill": {
    "dia": 10,
    "depth": 76,
    "fromInner": 7.5,
    "edgeMin": 1.5,
    "ref": "inner"
   },
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tipon_bumper",
   "model": "TIP-ON",
   "ph": "door_bumper",
   "art": "956A1006",
   "src": "BLUM-TIPON-DOORS p10,11; BLUM-CAT24 p102,676",
   "lim": {
    "h": null,
    "kg": null,
    "gapMin": 3.2,
    "stroke": 38,
    "adj": [
     -1.0,
     4.0
    ]
   },
   "sprung": true,
   "note": "bumper",
   "drill": {
    "dia": 10,
    "depth": 76,
    "fromInner": 7.5,
    "edgeMin": 1.5,
    "ref": "inner"
   },
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tipon_aventos",
   "model": "TIP-ON",
   "ph": "aventos",
   "art": "956.1004 + 22K2310T…",
   "src": "BLUM-CAT24 p10,14,16,50,51,52,676",
   "lim": {
    "kg": [
     null,
     18
    ],
    "kh": [
     205,
     600
    ],
    "cabW": [
     null,
     1800
    ],
    "gapMin": 2,
    "stroke": 17
   },
   "lifts": [
    "blum_hk_top",
    "blum_hk_s",
    "blum_hk_xs"
   ],
   "note": "aventos",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_pto_silent_9239087",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "hinged",
   "art": "9239087 / 9239088 / 9239099",
   "src": "HET-BK111 p1; HET-ANZ p1; HET-MTA-PTOS p1",
   "lim": {
    "stroke": 1.4,
    "adj": [
     -2,
     4
    ],
    "sizes": [
     {
      "hMax": 2200,
      "wLo": 200,
      "wHi": 600,
      "kg": 17.1
     },
     {
      "hMax": 2400,
      "wLo": 400,
      "wHi": 600,
      "kg": 22
     },
     {
      "hMax": 2800,
      "wLo": 500,
      "wHi": 600,
      "kg": 22
     }
    ]
   },
   "battery": "4 x AA",
   "dims": [
    155,
    60,
    32
   ],
   "dimsKey": "LWH",
   "note": "battery",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_pto_magnet_9375985",
   "brand": "Hettich",
   "model": "Push to open Magnet",
   "ph": "magnet_long",
   "art": "9375985",
   "src": "HET-SHOP 9375985; HET-MTA-PTO p1",
   "lim": {
    "stroke": 1.4,
    "gapMin": 1.4,
    "adj": [
     null,
     6
    ]
   },
   "note": "magnet",
   "drill": null,
   "unsprung": true,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_pto_magnet_9375982",
   "brand": "Hettich",
   "model": "Push to open Magnet",
   "ph": "magnet_short",
   "art": "9375982",
   "src": "HET-SHOP search; HET-MTA-PTO p1",
   "lim": {
    "stroke": 1.4,
    "gapMin": 1.4,
    "adj": [
     null,
     6
    ]
   },
   "note": "magnet",
   "drill": null,
   "unsprung": true,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_pto_magnet_9375969",
   "brand": "Hettich",
   "model": "Push to open Magnet",
   "ph": "magnet_screw",
   "art": "9375969",
   "src": "HET-SHOP search; HET-MTA-PTO p1",
   "lim": {
    "stroke": 1.4,
    "gapMin": 1.4,
    "adj": [
     null,
     6
    ]
   },
   "note": "magnet",
   "drill": null,
   "unsprung": true,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_pto_lock_9381335",
   "brand": "Hettich",
   "model": "Push to open Lock",
   "ph": "lock_drill",
   "art": "9381335",
   "src": "HET-SHOP 9381335; HET-MTA-PTO p1",
   "lim": {
    "gapMin": 1.4
   },
   "note": "lock",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_pto_lock_9381496",
   "brand": "Hettich",
   "model": "Push to open Lock",
   "ph": "lock_screw",
   "art": "9381496",
   "src": "HET-SHOP 9381496; HET-MTA-PTO p1",
   "lim": {
    "gapMin": 1.4
   },
   "note": "lock",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_pushsoft_315_11_400",
   "brand": "Häfele",
   "model": "Push to open soft close",
   "ph": "soft",
   "art": "315.11.400",
   "src": "HAF-124 p1",
   "lim": {
    "kg": [
     null,
     7.5
    ],
    "h": [
     null,
     700
    ],
    "w": [
     null,
     600
    ],
    "angleMax": 110
   },
   "dims": [
    202,
    18,
    72
   ],
   "dimsKey": "WDH",
   "unsprung": true,
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_pushsoft_315_11_401",
   "brand": "Häfele",
   "model": "Push to open soft close",
   "ph": "soft",
   "art": "315.11.401",
   "src": "HAF-124 p1",
   "lim": {
    "kg": [
     null,
     20
    ],
    "h": [
     null,
     2700
    ],
    "w": [
     null,
     600
    ],
    "angleMax": 110
   },
   "dims": [
    202,
    18,
    72
   ],
   "dimsKey": "WDH",
   "unsprung": true,
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_pushsoft_315_11_411",
   "brand": "Häfele",
   "model": "Push to open soft close",
   "ph": "soft",
   "art": "315.11.411",
   "src": "HAF-124 p1",
   "lim": {
    "kg": [
     null,
     25
    ],
    "h": [
     null,
     2700
    ],
    "w": [
     null,
     600
    ],
    "angleMax": 110
   },
   "dims": [
    202,
    18,
    72
   ],
   "dimsKey": "WDH",
   "unsprung": true,
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_tipmatic_356_03_520",
   "brand": "Häfele",
   "model": "Tipmatic",
   "ph": "pin",
   "art": "356.03.520",
   "src": "HAF-78 p1-2 (drawing, approximate); GRASS-18 p6",
   "lim": {
    "gapMin": 2.5,
    "gapMax": 5.5
   },
   "note": "pin",
   "drill": {
    "dia": 10,
    "depth": 60,
    "fromInner": "10+F",
    "ref": "inner"
   },
   "per": 1,
   "verificat": false
  },
  {
   "id": "grass_tipmatic_68873",
   "brand": "Grass",
   "model": "Tipmatic",
   "ph": "pin",
   "art": "68873-06",
   "src": "GRASS-09 p14,15; GRASS-18 p4,6",
   "lim": {
    "gapMin": 2.5,
    "gapMax": 5.5
   },
   "note": "pin",
   "drill": {
    "dia": 10,
    "depth": 60,
    "fromInner": "10+F",
    "ref": "inner"
   },
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_pushcatch_356_06_460",
   "brand": "Häfele",
   "model": "Maxi Touch",
   "ph": "catch",
   "art": "356.06.460",
   "src": "HAF-241 p1",
   "lim": {
    "extraCatchH": 1200
   },
   "note": "catch",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_pressure_245_50_301",
   "brand": "Häfele",
   "model": "Pressure catch",
   "ph": "pressure",
   "art": "245.50.301",
   "src": "HAF-154 p1",
   "lim": {
    "pullKg": 4
   },
   "note": "catch",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "haf_pressure_245_50_310",
   "brand": "Häfele",
   "model": "Compact catch",
   "ph": "pressure",
   "art": "245.50.310",
   "src": "HAF-154 p1",
   "lim": {
    "pullKg": 3
   },
   "note": "catch",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "sal_push_dp4",
   "brand": "Salice",
   "model": "PUSH",
   "ph": "mech_adapter",
   "art": "DP4SNB/G",
   "src": "SAL-MECH p1-3; SAL-PUSH p9",
   "lim": {
    "adj": [
     -1,
     2.5
    ]
   },
   "per": [
    [
     0,
     1
    ],
    [
     1600.01,
     2
    ]
   ],
   "note": "mech",
   "drill": null,
   "verificat": false
  },
  {
   "id": "sal_mpush_dpm",
   "brand": "Salice",
   "model": "Magnetic Push",
   "ph": "magnetic",
   "art": "DPMSNB/G",
   "src": "SAL-AIR p28; SAL-MAG p1",
   "lim": {
    "adj": [
     -0.5,
     2.5
    ]
   },
   "per": [
    [
     0,
     1
    ],
    [
     1600.01,
     2
    ]
   ],
   "note": "magnet",
   "drill": null,
   "verificat": false
  }
 ],
 "pushd": [
  {
   "id": "blum_tobm_lbx_s0",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_S0",
   "sysname": "LEGRABOX / MOVENTO",
   "art": "T60L7040",
   "src": "BLUM-CAT24 p396,398,400,504; BLUM-TOB p24-25",
   "lim": {
    "kg": [
     null,
     10
    ],
    "nl": [
     270,
     300
    ],
    "lwMin": 294
   },
   "sys": [
    "legrabox",
    "movento"
   ],
   "sysNl": {
    "legrabox": [
     270,
     300
    ],
    "movento": [
     270,
     320
    ]
   },
   "sysLw": {
    "legrabox": 294,
    "movento": 314
   },
   "gapMin": 2.5,
   "unit": "S0",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_mer_s0",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_S0",
   "sysname": "MERIVOBOX",
   "art": "T60H4040",
   "src": "BLUM-CAT24 p398",
   "lim": {
    "kg": [
     null,
     10
    ],
    "nl": [
     270,
     300
    ],
    "lwMin": 297
   },
   "sys": [
    "merivobox"
   ],
   "sysNl": {
    "merivobox": [
     270,
     300
    ]
   },
   "sysLw": {
    "merivobox": 297
   },
   "gapMin": 2.5,
   "unit": "S0",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_tb_s0",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_S0",
   "sysname": "TANDEMBOX",
   "art": "T60B3030",
   "src": "BLUM-CAT24 p400",
   "lim": {
    "kg": [
     null,
     10
    ],
    "nl": [
     270,
     300
    ],
    "lwMin": 287
   },
   "sys": [
    "tandembox"
   ],
   "sysNl": {
    "tandembox": [
     270,
     300
    ]
   },
   "sysLw": {
    "tandembox": 287
   },
   "gapMin": 2.5,
   "unit": "S0",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_lbx_s1",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_S1",
   "sysname": "LEGRABOX / MOVENTO",
   "art": "T60L7140",
   "src": "BLUM-CAT24 p396,398,400,504; BLUM-TOB p24-25",
   "lim": {
    "kg": [
     10,
     20
    ],
    "nl": [
     270,
     300
    ],
    "lwMin": 294
   },
   "sys": [
    "legrabox",
    "movento"
   ],
   "sysNl": {
    "legrabox": [
     270,
     300
    ],
    "movento": [
     270,
     320
    ]
   },
   "sysLw": {
    "legrabox": 294,
    "movento": 314
   },
   "gapMin": 2.5,
   "unit": "S1",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_mer_s1",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_S1",
   "sysname": "MERIVOBOX",
   "art": "T60H4140",
   "src": "BLUM-CAT24 p398",
   "lim": {
    "kg": [
     10,
     20
    ],
    "nl": [
     270,
     300
    ],
    "lwMin": 297
   },
   "sys": [
    "merivobox"
   ],
   "sysNl": {
    "merivobox": [
     270,
     300
    ]
   },
   "sysLw": {
    "merivobox": 297
   },
   "gapMin": 2.5,
   "unit": "S1",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_tb_s1",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_S1",
   "sysname": "TANDEMBOX",
   "art": "T60B3130",
   "src": "BLUM-CAT24 p400",
   "lim": {
    "kg": [
     10,
     20
    ],
    "nl": [
     270,
     300
    ],
    "lwMin": 287
   },
   "sys": [
    "tandembox"
   ],
   "sysNl": {
    "tandembox": [
     270,
     300
    ]
   },
   "sysLw": {
    "tandembox": 287
   },
   "gapMin": 2.5,
   "unit": "S1",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_lbx_l1",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L1",
   "sysname": "LEGRABOX / MOVENTO",
   "art": "T60L7340",
   "src": "BLUM-CAT24 p396,398,400,504; BLUM-TOB p24-25",
   "lim": {
    "kg": [
     null,
     20
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 294
   },
   "sys": [
    "legrabox",
    "movento"
   ],
   "sysNl": {
    "legrabox": [
     350,
     600
    ],
    "movento": [
     350,
     600
    ]
   },
   "sysLw": {
    "legrabox": 294,
    "movento": 314
   },
   "gapMin": 2.5,
   "unit": "L1",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_mer_l1",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L1",
   "sysname": "MERIVOBOX",
   "art": "T60H4340",
   "src": "BLUM-CAT24 p398",
   "lim": {
    "kg": [
     null,
     20
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 297
   },
   "sys": [
    "merivobox"
   ],
   "sysNl": {
    "merivobox": [
     350,
     600
    ]
   },
   "sysLw": {
    "merivobox": 297
   },
   "gapMin": 2.5,
   "unit": "L1",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_tb_l1",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L1",
   "sysname": "TANDEMBOX",
   "art": "T60B3330",
   "src": "BLUM-CAT24 p400",
   "lim": {
    "kg": [
     null,
     20
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 287
   },
   "sys": [
    "tandembox"
   ],
   "sysNl": {
    "tandembox": [
     350,
     600
    ]
   },
   "sysLw": {
    "tandembox": 287
   },
   "gapMin": 2.5,
   "unit": "L1",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_lbx_l3",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L3",
   "sysname": "LEGRABOX / MOVENTO",
   "art": "T60L7540",
   "src": "BLUM-CAT24 p396,398,400,504; BLUM-TOB p24-25",
   "lim": {
    "kg": [
     15,
     40
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 294
   },
   "sys": [
    "legrabox",
    "movento"
   ],
   "sysNl": {
    "legrabox": [
     350,
     600
    ],
    "movento": [
     350,
     600
    ]
   },
   "sysLw": {
    "legrabox": 294,
    "movento": 314
   },
   "gapMin": 2.5,
   "unit": "L3",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_mer_l3",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L3",
   "sysname": "MERIVOBOX",
   "art": "T60H4540",
   "src": "BLUM-CAT24 p398",
   "lim": {
    "kg": [
     15,
     40
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 297
   },
   "sys": [
    "merivobox"
   ],
   "sysNl": {
    "merivobox": [
     350,
     600
    ]
   },
   "sysLw": {
    "merivobox": 297
   },
   "gapMin": 2.5,
   "unit": "L3",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_tb_l3",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L3",
   "sysname": "TANDEMBOX",
   "art": "T60B3530",
   "src": "BLUM-CAT24 p400",
   "lim": {
    "kg": [
     15,
     30
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 287
   },
   "sys": [
    "tandembox"
   ],
   "sysNl": {
    "tandembox": [
     350,
     600
    ]
   },
   "sysLw": {
    "tandembox": 287
   },
   "gapMin": 2.5,
   "unit": "L3",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_lbx_l5",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L5",
   "sysname": "LEGRABOX / MOVENTO",
   "art": "T60L7570",
   "src": "BLUM-CAT24 p396,398,400,504; BLUM-TOB p24-25",
   "lim": {
    "kg": [
     35,
     70
    ],
    "nl": [
     450,
     650
    ],
    "lwMin": 294
   },
   "sys": [
    "legrabox",
    "movento"
   ],
   "sysNl": {
    "legrabox": [
     450,
     650
    ],
    "movento": [
     450,
     750
    ]
   },
   "sysLw": {
    "legrabox": 294,
    "movento": 314
   },
   "gapMin": 2.5,
   "unit": "L5",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_mer_l5",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L5",
   "sysname": "MERIVOBOX",
   "art": "T60H4570",
   "src": "BLUM-CAT24 p398",
   "lim": {
    "kg": [
     35,
     70
    ],
    "nl": [
     450,
     600
    ],
    "lwMin": 297
   },
   "sys": [
    "merivobox"
   ],
   "sysNl": {
    "merivobox": [
     450,
     600
    ]
   },
   "sysLw": {
    "merivobox": 297
   },
   "gapMin": 2.5,
   "unit": "L5",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tobm_tb_l5",
   "model": "TIP-ON BLUMOTION",
   "ph": "cls_L5",
   "sysname": "TANDEMBOX",
   "art": "T60B3560",
   "src": "BLUM-CAT24 p400",
   "lim": {
    "kg": [
     30,
     65
    ],
    "nl": [
     450,
     650
    ],
    "lwMin": 287
   },
   "sys": [
    "tandembox"
   ],
   "sysNl": {
    "tandembox": [
     450,
     650
    ]
   },
   "sysLw": {
    "tandembox": 287
   },
   "gapMin": 2.5,
   "unit": "L5",
   "note": "tipon",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tipon_lbx_40",
   "model": "TIP-ON",
   "ph": "lbx_profile",
   "sysname": "LEGRABOX 40 kg",
   "art": "750.xxxxT",
   "src": "BLUM-CAT24 p406,407",
   "lim": {
    "kg": [
     null,
     40
    ],
    "nl": [
     270,
     600
    ]
   },
   "sys": [
    "legrabox"
   ],
   "sysNl": {
    "legrabox": [
     270,
     600
    ]
   },
   "gapRec": 3.5,
   "note": "profile",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_tipon_lbx_70",
   "model": "TIP-ON",
   "ph": "lbx_profile",
   "sysname": "LEGRABOX 70 kg",
   "art": "753.xxxxT",
   "src": "BLUM-CAT24 p406,407",
   "lim": {
    "kg": [
     null,
     70
    ],
    "nl": [
     450,
     650
    ]
   },
   "sys": [
    "legrabox"
   ],
   "sysNl": {
    "legrabox": [
     450,
     650
    ]
   },
   "gapRec": 3.5,
   "note": "profile",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_actro_xs",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_actro",
   "art": "9257890",
   "src": "HET-BK262 p262",
   "lim": {
    "kg": [
     null,
     10
    ],
    "nl": [
     270,
     350
    ],
    "lwMin": 275
   },
   "sys": [
    "actro",
    "avantech"
   ],
   "sysNl": {
    "actro": [
     270,
     350
    ],
    "avantech": [
     270,
     350
    ]
   },
   "sysLw": {
    "actro": 275,
    "avantech": 275
   },
   "gapMin": 2.5,
   "unit": "xs",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_arci_xs",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_arci",
   "art": "9241038",
   "src": "HET-BK310; HET-SHOP 9241049",
   "lim": {
    "kg": [
     null,
     10
    ],
    "nl": [
     270,
     350
    ],
    "lwMin": 275
   },
   "sys": [
    "arcitech"
   ],
   "sysNl": {
    "arcitech": [
     270,
     350
    ]
   },
   "sysLw": {
    "arcitech": 275
   },
   "gapMin": 2.5,
   "unit": "xs",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_actro_l1",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_actro",
   "art": "9257891",
   "src": "HET-BK262 p262",
   "lim": {
    "kg": [
     8,
     20
    ],
    "nl": [
     270,
     600
    ],
    "lwMin": 275
   },
   "sys": [
    "actro",
    "avantech"
   ],
   "sysNl": {
    "actro": [
     270,
     600
    ],
    "avantech": [
     270,
     600
    ]
   },
   "sysLw": {
    "actro": 275,
    "avantech": 275
   },
   "gapMin": 2.5,
   "unit": "l1",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_arci_l1",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_arci",
   "art": "9241049",
   "src": "HET-BK310; HET-SHOP 9241049",
   "lim": {
    "kg": [
     8,
     20
    ],
    "nl": [
     270,
     650
    ],
    "lwMin": 275
   },
   "sys": [
    "arcitech"
   ],
   "sysNl": {
    "arcitech": [
     270,
     650
    ]
   },
   "sysLw": {
    "arcitech": 275
   },
   "gapMin": 2.5,
   "unit": "l1",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_actro_l2",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_actro",
   "art": "9257892",
   "src": "HET-BK262 p262",
   "lim": {
    "kg": [
     10,
     40
    ],
    "nl": [
     350,
     600
    ],
    "lwMin": 275
   },
   "sys": [
    "actro",
    "avantech"
   ],
   "sysNl": {
    "actro": [
     350,
     600
    ],
    "avantech": [
     350,
     600
    ]
   },
   "sysLw": {
    "actro": 275,
    "avantech": 275
   },
   "gapMin": 2.5,
   "unit": "l2",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_arci_l2",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_arci",
   "art": "9241050",
   "src": "HET-BK310; HET-SHOP 9241049",
   "lim": {
    "kg": [
     10,
     40
    ],
    "nl": [
     350,
     650
    ],
    "lwMin": 275
   },
   "sys": [
    "arcitech"
   ],
   "sysNl": {
    "arcitech": [
     350,
     650
    ]
   },
   "sysLw": {
    "arcitech": 275
   },
   "gapMin": 2.5,
   "unit": "l2",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_actro_xl",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_actro",
   "art": "9257893",
   "src": "HET-BK262 p262",
   "lim": {
    "kg": [
     20,
     70
    ],
    "nl": [
     450,
     650
    ],
    "lwMin": 275
   },
   "sys": [
    "actro",
    "avantech"
   ],
   "sysNl": {
    "actro": [
     450,
     650
    ],
    "avantech": [
     450,
     650
    ]
   },
   "sysLw": {
    "actro": 275,
    "avantech": 275
   },
   "gapMin": 2.5,
   "unit": "xl",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_ptos_arci_xl",
   "brand": "Hettich",
   "model": "Push to open Silent",
   "ph": "drw_arci",
   "art": "9241051",
   "src": "HET-BK310; HET-SHOP 9241049",
   "lim": {
    "kg": [
     20,
     70
    ],
    "nl": [
     450,
     650
    ],
    "lwMin": 275
   },
   "sys": [
    "arcitech"
   ],
   "sysNl": {
    "arcitech": [
     450,
     650
    ]
   },
   "sysLw": {
    "arcitech": 275
   },
   "gapMin": 2.5,
   "unit": "xl",
   "note": "mech",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "het_easys_9078139",
   "brand": "Hettich",
   "model": "Easys",
   "ph": "easys",
   "art": "9078139",
   "src": "HET-BK345 p345; HET-EASYS-MTA p10,19",
   "lim": {
    "kg": [
     null,
     40
    ],
    "kgTwo": 70
   },
   "sys": [
    "avantech",
    "arcitech",
    "innotech",
    "actro",
    "quadro"
   ],
   "aux": [
    {
     "cat": "pushpsu",
     "id": "het_easys_psu",
     "per": "body"
    }
   ],
   "elec": {
    "V": 24,
    "A": 3.75,
    "W": 90
   },
   "clearBehind": {
    "arcitech": 51,
    "innotech": 72,
    "actro": 82,
    "quadro": 82
   },
   "unitDims": [
    170,
    68,
    46
   ],
   "note": "elec",
   "drill": null,
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_servo_drawer",
   "model": "SERVO-DRIVE",
   "ph": "drawer_sys",
   "art": "Z10A3000.04",
   "src": "BLUM-CAT24 p364,366,367",
   "lim": {
    "kg": null,
    "trigger": 2
   },
   "sys": [
    "legrabox",
    "merivobox",
    "tandembox"
   ],
   "aux": [
    {
     "cat": "pushpsu",
     "id": "blum_servo_psu_sys",
     "per": "body"
    }
   ],
   "elec": {
    "V": 24
   },
   "note": "elec",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  },
  {
   "id": "blum_servo_uno",
   "model": "SERVO-DRIVE",
   "ph": "uno",
   "art": "Z10UB00xx",
   "src": "BLUM-CAT24 p388; BLUM-UNO p4,10",
   "lim": {
    "kg": null
   },
   "sys": [
    "pullout"
   ],
   "aux": [
    {
     "cat": "pushpsu",
     "id": "blum_servo_psu_uno",
     "per": "body"
    }
   ],
   "elec": {
    "V": 24
   },
   "note": "elec",
   "drill": null,
   "brand": "Blum",
   "per": 1,
   "verificat": false
  }
 ],
 "pushpsu": [
  {
   "id": "het_easys_psu",
   "brand": "Hettich",
   "model": "Easys",
   "ph": "psu_easys",
   "art": "9082363",
   "src": "HET-BK347 p347; HET-EASYS-PSU p3",
   "lim": {
    "maxUnits": 27,
    "W": 90,
    "A": 3.75
   },
   "verificat": false
  },
  {
   "id": "blum_servo_psu_sys",
   "brand": "Blum",
   "model": "SERVO-DRIVE",
   "ph": "psu_sys",
   "art": "Z10NE04xx",
   "src": "BLUM-CAT24 p362,365",
   "lim": {
    "maxUnits": null
   },
   "verificat": false
  },
  {
   "id": "blum_servo_psu_uno",
   "brand": "Blum",
   "model": "SERVO-DRIVE",
   "ph": "psu_uno",
   "art": "Z10NA300",
   "src": "BLUM-UNO p11",
   "lim": {
    "maxUnits": 2
   },
   "verificat": false
  }
 ],
 "susp": [
  {
   "id": "het_sah500",
   "brand": "Hettich",
   "model": "SAH 500",
   "ph": "s_concealed_body",
   "art": "9385584 + 9385585",
   "src": "HET-SHOP-9385585; HET-SAH500-MTA p5-6",
   "kgBracket": null,
   "frames": [
    {
     "id": "A",
     "h": 1000,
     "t": 300,
     "kg": 110
    },
    {
     "id": "B",
     "h": 600,
     "t": 600,
     "kg": 80
    },
    {
     "id": "C",
     "h": 300,
     "t": 600,
     "kg": 50
    }
   ],
   "backT": [
    3,
    8
   ],
   "rails": [],
   "wall": "element",
   "adj": {
    "h": 11,
    "d": [
     -2,
     10
    ],
    "side": 3
   },
   "liftOff": 6.5,
   "wallElementH": 118,
   "wallHolePitch": 48,
   "drill": {
    "holes": 4,
    "dia": 10,
    "depth": 12.5,
    "pitchA": 32,
    "pitchB": 64,
    "fromRear": 43.5,
    "cMin": 14.5,
    "ref": "rearEdge+topInner"
   },
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah216ahs",
   "brand": "Hettich",
   "model": "SAH 216",
   "ph": "s_behind_ahs",
   "art": "9277718",
   "src": "HET-TA2025-SUSP bk_838,846; HET-SHOP-9277718",
   "kgBracket": 55,
   "rails": [
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 8,
    "d": 25,
    "side": 3
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah216",
   "brand": "Hettich",
   "model": "SAH 216",
   "ph": "s_behind",
   "art": "0079717",
   "src": "HET-TA2025-SUSP bk_848",
   "kgBracket": 55,
   "rails": [
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 8,
    "d": 25,
    "side": 3
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah215ahs",
   "brand": "Hettich",
   "model": "SAH 215",
   "ph": "s_behind_ahs",
   "art": "9277719",
   "src": "HET-TA2025-SUSP bk_838,842",
   "kgBracket": 45,
   "rails": [
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 8,
    "d": 25,
    "side": 3
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah215",
   "brand": "Hettich",
   "model": "SAH 215",
   "ph": "s_behind",
   "art": "0079716",
   "src": "HET-TA2025-SUSP bk_844",
   "kgBracket": 45,
   "rails": [
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 8,
    "d": 25,
    "side": 3
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah130",
   "brand": "Hettich",
   "model": "SAH 130",
   "ph": "s_pressin",
   "art": "0079724 (T19)",
   "src": "HET-TA2025-SUSP bk_850",
   "kgBracket": 35,
   "sideT": 19,
   "rails": [
    "het_rail_l",
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 7,
    "d": 15,
    "side": 3
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah15",
   "brand": "Hettich",
   "model": "SAH 15",
   "ph": "s_inbody",
   "art": "9208645 (T16)",
   "src": "HET-TA2025-SUSP bk_852",
   "kgBracket": 30,
   "sideT": 16,
   "rails": [
    "het_rail_l",
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 9,
    "d": 18,
    "side": 6
   },
   "liftOff": 6,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah116",
   "brand": "Hettich",
   "model": "SAH 116",
   "ph": "s_inbody",
   "art": "0019476 (T21)",
   "src": "HET-TA2025-SUSP bk_854",
   "kgBracket": 40,
   "sideT": 21,
   "rails": [
    "het_rail_l",
    "het_rail_b"
   ],
   "wall": "rail",
   "adj": {
    "h": 7,
    "d": 15,
    "side": 3
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah305",
   "brand": "Hettich",
   "model": "SAH 305",
   "ph": "s_rearpanel",
   "art": "0040669",
   "src": "HET-TA2025-SUSP bk_856",
   "kgBracket": 15,
   "backTmin": 16,
   "rails": [],
   "wall": "hook",
   "adj": {
    "side": 8
   },
   "drill": {
    "dia": 30,
    "depth": 11.5,
    "ref": "rear"
   },
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_hang_290_03_91",
   "brand": "Häfele",
   "model": "290.03.91",
   "ph": "s_concealed",
   "art": "290.03.911 / 290.03.910",
   "src": "HAF-2014-HANG 14CFC77",
   "kgPair": 130,
   "rails": [
    "haf_rail_290_10_900"
   ],
   "wall": "rail",
   "adj": {
    "h": 15,
    "d": 20
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_hang_290_03_92",
   "brand": "Häfele",
   "model": "290.03.92",
   "ph": "s_concealed",
   "art": "290.03.921 / 290.03.920",
   "src": "HAF-2014-HANG 14CFC78",
   "kgPair": 130,
   "rails": [
    "haf_rail_290_10_900",
    "haf_rail_290_09_910"
   ],
   "wall": "rail",
   "adj": {
    "h": 15
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_hang_290_03_93",
   "brand": "Häfele",
   "model": "290.03.93",
   "ph": "s_hookoff",
   "art": "290.03.936 / 290.03.935",
   "src": "HAF-2014-HANG 14CFC78A",
   "kgPair": 130,
   "rails": [
    "haf_rail_290_10_900",
    "haf_rail_290_09_910"
   ],
   "wall": "rail",
   "adj": {
    "h": 15
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_libra_h2",
   "brand": "Häfele",
   "model": "Libra H2",
   "ph": "s_libra",
   "art": "290.41.910",
   "src": "HAF-2014-HANG 14CFC79",
   "kgPair": 150,
   "rails": [],
   "wall": "plate",
   "adj": {
    "h": 13,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_libra_h1",
   "brand": "Häfele",
   "model": "Libra H1",
   "ph": "s_libra",
   "art": "290.41.900",
   "src": "HAF-2014-HANG 14CFC80",
   "kgPair": 150,
   "rails": [],
   "wall": "plate",
   "adj": {
    "h": 13,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_libra_h3",
   "brand": "Häfele",
   "model": "Libra H3",
   "ph": "s_libra",
   "art": "290.41.915 / 290.41.905",
   "src": "HAF-2014-HANG 14CFC80",
   "kgPair": 150,
   "rails": [],
   "wall": "plate",
   "adj": {
    "h": 13,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_brk_291_04_312",
   "brand": "Häfele",
   "model": "291.04.312",
   "ph": "s_bracket_hook",
   "art": "291.04.312",
   "src": "HAF-2014-HANG 14CFC76",
   "kgBracket": 40,
   "kgNote": "unit",
   "rails": [],
   "wall": "hook",
   "outline": [
    45,
    57
   ],
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_brk_291_04_311",
   "brand": "Häfele",
   "model": "291.04.311",
   "ph": "s_bracket_plate",
   "art": "291.04.311 + 290.08.921",
   "src": "HAF-2014-HANG 14CFC76",
   "kgBracket": 60,
   "kgNote": "unit",
   "rails": [],
   "wall": "plate",
   "outline": [
    45,
    57
   ],
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_traser6_290_28_900",
   "brand": "Häfele",
   "model": "Traser-6 290.28.900",
   "ph": "s_traser",
   "art": "290.28.900",
   "src": "HAF-2023-HANG 23T7-214",
   "kgBracket": 50,
   "rails": [
    "haf_rail_290_10_970"
   ],
   "wall": "rail",
   "adj": {
    "h": 18,
    "side": 18
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_traser6_290_28_905",
   "brand": "Häfele",
   "model": "Traser-6 290.28.905 (siguranță activă)",
   "ph": "s_traser",
   "art": "290.28.905",
   "src": "HAF-2023-HANG 23T7-214",
   "kgBracket": 50,
   "rails": [
    "haf_rail_290_10_970"
   ],
   "wall": "rail",
   "adj": {
    "h": 18,
    "d": 18,
    "side": 18
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_traser6_290_28_91",
   "brand": "Häfele",
   "model": "Traser-6 290.28.91 (montaj rapid)",
   "ph": "s_traser",
   "art": "290.28.916 / 290.28.915",
   "src": "HAF-2023-HANG 23T7-214",
   "kgBracket": 50,
   "rails": [
    "haf_rail_290_10_970"
   ],
   "wall": "rail",
   "adj": {
    "h": 18,
    "d": 18,
    "side": 18
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_traser8_290_32_90",
   "brand": "Häfele",
   "model": "Traser-8 290.32.90",
   "ph": "s_traser",
   "art": "290.32.901 / 290.32.902",
   "src": "HAF-2023-HANG 23T7-215",
   "kgBracket": 50,
   "rails": [
    "haf_rail_290_10_970"
   ],
   "wall": "rail",
   "adj": {
    "h": 11,
    "d": 10,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_traser8_290_32_93",
   "brand": "Häfele",
   "model": "Traser-8 290.32.93 (suport superior)",
   "ph": "s_traser",
   "art": "290.32.931 / 290.32.930",
   "src": "HAF-2023-HANG 23T7-215",
   "kgBracket": 50,
   "rails": [
    "haf_rail_290_10_970"
   ],
   "wall": "rail",
   "adj": {
    "h": 11,
    "d": 10,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_traser8_290_33_900",
   "brand": "Häfele",
   "model": "Traser-8 290.33.900",
   "ph": "s_traser",
   "art": "290.33.900",
   "src": "HAF-2023-HANG 23T7-215",
   "kgBracket": 50,
   "rails": [
    "haf_rail_290_10_970"
   ],
   "wall": "rail",
   "adj": {
    "h": 11,
    "d": 10,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_rapid_290_21_90",
   "brand": "Häfele",
   "model": "290.21.90 (montaj rapid)",
   "ph": "s_concealed",
   "art": "290.21.901 / 290.21.900",
   "src": "HAF-2023-HANG 23T7-217",
   "rails": [
    "haf_rail_290_10_900",
    "haf_rail_290_09_910"
   ],
   "wall": "rail",
   "adj": {
    "h": 18,
    "side": 16
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_spider_290_36_910",
   "brand": "Häfele",
   "model": "Spider 290.36.910",
   "ph": "s_concealed",
   "art": "290.36.910 + 290.35.911",
   "src": "HAF-2023-HANG 23T7-226",
   "kgPair": 130,
   "rails": [],
   "wall": "plate",
   "adj": {
    "h": 18,
    "side": 17
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "haf_koala_290_36_920",
   "brand": "Häfele",
   "model": "Koala 290.36.920",
   "ph": "s_concealed",
   "art": "290.36.920 + 290.36.925 / 290.35.920",
   "src": "HAF-2023-HANG 23T7-227",
   "kgPair": 130,
   "rails": [],
   "wall": "plate",
   "adj": {
    "h": 11,
    "d": 10,
    "side": 12
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "het_sah209",
   "brand": "Hettich",
   "model": "SAH 209",
   "ph": "s_behind",
   "art": "9045794",
   "src": "HET-SHOP-9045794",
   "kgBracket": 20,
   "rails": [],
   "wall": "hook",
   "adj": {
    "h": 5,
    "side": 7
   },
   "liftOff": 7.5,
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "blum_hang_48n0510",
   "brand": "Blum",
   "model": "Cârlig de perete cu șuruburi 48N0510",
   "ph": "s_nylon",
   "art": "48N0510.02 / 48N0510.03",
   "src": "BLUM-CAT2021 p.556",
   "kgPair": 130,
   "rails": [],
   "wall": "hook",
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "blum_hang_48n0610",
   "brand": "Blum",
   "model": "Cârlig de perete cu fixare prin lovire 48N0610",
   "ph": "s_nylon",
   "art": "48N0610.02 / 48N0610.03 + MZM.0078",
   "src": "BLUM-CAT2021 p.556",
   "kgPair": 130,
   "rails": [],
   "wall": "hook",
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "cam_806_14",
   "brand": "Camar",
   "model": "806 14 P2 VI",
   "ph": "s_plate",
   "art": "806 14 P2 VI",
   "src": "CAM-CERT camar_806; CAM-SHEET 273-276",
   "kgPair": 50,
   "kgNote": "unit",
   "rails": [
    "cam_rail_875"
   ],
   "wall": "rail",
   "adj": {
    "h": 25
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "cam_806_22",
   "brand": "Camar",
   "model": "806 22 P2 IN",
   "ph": "s_plate",
   "art": "806 22 P2 IN",
   "src": "CAM-CERT camar_806; CAM-SHEET 273-276",
   "kgPair": 65,
   "kgNote": "unit",
   "rails": [
    "cam_rail_875"
   ],
   "wall": "rail",
   "adj": {
    "h": 25
   },
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "cam_821",
   "brand": "Camar",
   "model": "821 12 Z1 IN",
   "ph": "s_concealed",
   "art": "821 12 Z1 IN",
   "src": "CAM-CERT; CAM-SHEET 313-326",
   "kgPair": 60,
   "kgNote": "unit",
   "rails": [],
   "wall": "rail",
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "cam_818",
   "brand": "Camar",
   "model": "818 32 Z1 D1",
   "ph": "s_concealed",
   "art": "818 32 Z1 D1",
   "src": "CAM-CERT; CAM-SHEET 299-308",
   "nPoint": 720,
   "rails": [
    "cam_rail_875"
   ],
   "wall": "rail",
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "cam_801",
   "brand": "Camar",
   "model": "801 02 Z1 IN",
   "ph": "s_concealed",
   "art": "801 02 Z1 IN",
   "src": "CAM-CERT; DIN 68840",
   "nPoint": 850,
   "rails": [],
   "wall": "rail",
   "drill": null,
   "per": "body",
   "verificat": false
  },
  {
   "id": "cam_816as",
   "brand": "Camar",
   "model": "816 AS Z1",
   "ph": "s_antidrop",
   "art": "816 AS Z1 DU / 816 AS Z1 50",
   "src": "CAM-SHEET 283-286",
   "kgPair": null,
   "rails": [
    "cam_rail_875"
   ],
   "wall": "rail",
   "adj": {
    "h": 12,
    "side": 10
   },
   "outline": [
    148,
    42
   ],
   "drill": {
    "holes": 3,
    "dia": 10,
    "pitch": 32,
    "ref": "unclear"
   },
   "per": "body",
   "verificat": false
  }
 ],
 "suprail": [
  {
   "id": "het_rail_l",
   "brand": "Hettich",
   "model": "Rail L",
   "ph": "r_l",
   "art": "9208678",
   "src": "HET-TA2025-SUSP bk_858",
   "kgCab": 130,
   "profile": [
    68,
    42
   ],
   "thick": 1.75,
   "verificat": false
  },
  {
   "id": "het_rail_b",
   "brand": "Hettich",
   "model": "Rail B",
   "ph": "r_b",
   "art": "9007651",
   "src": "HET-TA2025-SUSP bk_858",
   "kgCab": 150,
   "length": 3000,
   "verificat": false
  },
  {
   "id": "haf_rail_290_10_900",
   "brand": "Häfele",
   "model": "290.10.900",
   "ph": "r_wall",
   "art": "290.10.900",
   "src": "HAF-2014-HANG 14CFC78",
   "length": 2032,
   "kgCab": null,
   "verificat": false
  },
  {
   "id": "haf_rail_290_09_910",
   "brand": "Häfele",
   "model": "290.09.910",
   "ph": "r_wall",
   "art": "290.09.910",
   "src": "HAF-2014-HANG 14CFC78B",
   "length": 1250,
   "kgCab": null,
   "verificat": false
  },
  {
   "id": "haf_rail_290_10_970",
   "brand": "Häfele",
   "model": "290.10.970",
   "ph": "r_wall",
   "art": "290.10.970",
   "src": "HAF-2023-HANG 23T7-216",
   "length": 2029,
   "kgCab": null,
   "verificat": false
  },
  {
   "id": "cam_rail_875",
   "brand": "Camar",
   "model": "875 AS Z1 00 60",
   "ph": "r_wall",
   "art": "875 AS Z1 00 60",
   "src": "CAM-CERT plech_pro_806_818",
   "nPoint": 1975,
   "kgCab": null,
   "verificat": false
  }
 ],
 "conn": [
  {
   "id": "het_rastex15_b24",
   "brand": "Hettich",
   "model": "Rastex 15",
   "ph": "c_rastex_b24",
   "art": "0025064 (19) / 0025062 (16) / 0071950 (19, rim); Rapid S 0044750 / Twister 0020056",
   "src": "HET-TA2025-CONN bk_750,752-754",
   "T": [
    12,
    29
   ],
   "joint": {
    "kind": "housing",
    "dia": 15,
    "depthT": {
     "12": 10.0,
     "15": 12.2,
     "16": 12.7,
     "18": 13.4,
     "19": 13.7,
     "22": 15.7,
     "29": 19.2
    },
    "axisT": {
     "12": 6.0,
     "15": 7.5,
     "16": 8.0,
     "18": 9.0,
     "19": 9.5,
     "22": 11.0,
     "29": 14.5
    },
    "B": 24,
    "shankDia": 8,
    "shankDepth": 24,
    "fDia": null,
    "fDepth": null,
    "note": "Hettich Rastex 15 B24"
   },
   "verificat": false
  },
  {
   "id": "het_rastex15_b34",
   "brand": "Hettich",
   "model": "Rastex 15",
   "ph": "c_rastex_b34",
   "art": "0025064 (19) / 0025062 (16) / 0071950 (19, rim); Rapid S 0044750 / Twister 0020056",
   "src": "HET-TA2025-CONN bk_750,752-754",
   "T": [
    12,
    29
   ],
   "joint": {
    "kind": "housing",
    "dia": 15,
    "depthT": {
     "12": 10.0,
     "15": 12.2,
     "16": 12.7,
     "18": 13.4,
     "19": 13.7,
     "22": 15.7,
     "29": 19.2
    },
    "axisT": {
     "12": 6.0,
     "15": 7.5,
     "16": 8.0,
     "18": 9.0,
     "19": 9.5,
     "22": 11.0,
     "29": 14.5
    },
    "B": 34,
    "shankDia": 8,
    "shankDepth": 34,
    "fDia": null,
    "fDepth": null,
    "note": "Hettich Rastex 15 B34"
   },
   "verificat": false
  },
  {
   "id": "het_rastex25",
   "brand": "Hettich",
   "model": "Rastex 25",
   "ph": "c_rastex25",
   "art": "0013116",
   "src": "HET-TA2025-CONN bk_757",
   "T": [
    null,
    null
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_vb20",
   "brand": "Hettich",
   "model": "VB 20",
   "ph": "c_vb20",
   "art": "0025049",
   "src": "HET-TA2025-CONN bk_760-761",
   "T": [
    19,
    20
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_vb21",
   "brand": "Hettich",
   "model": "VB 21",
   "ph": "c_vb21",
   "art": "0047454",
   "src": "HET-TA2025-CONN bk_760-761",
   "T": [
    19,
    20
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_vb54_16",
   "brand": "Hettich",
   "model": "VB 54 Toolex",
   "ph": "c_vb54",
   "art": "0073618",
   "src": "HET-TA2025-CONN bk_768",
   "T": [
    16,
    16
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_vb54_19",
   "brand": "Hettich",
   "model": "VB 54 Toolex",
   "ph": "c_vb54",
   "art": "0073619",
   "src": "HET-TA2025-CONN bk_768",
   "T": [
    19,
    19
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_vb135",
   "brand": "Hettich",
   "model": "VB 135",
   "ph": "c_vb135",
   "art": "0073616",
   "src": "HET-TA2025-CONN bk_769",
   "T": [
    16,
    30
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_alfa_stop",
   "brand": "Hettich",
   "model": "Alfa Stop",
   "ph": "c_alfa",
   "art": "9131206",
   "src": "HET-TA2025-CONN bk_769",
   "T": [
    16,
    30
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "het_beta",
   "brand": "Hettich",
   "model": "Beta",
   "ph": "c_beta",
   "art": "9132007",
   "src": "HET-TA2025-CONN bk_769",
   "T": [
    16,
    30
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "haf_rafix",
   "brand": "Häfele",
   "model": "Rafix 20",
   "ph": "c_rafix20",
   "art": "263.11.703 (16) / 263.11.705 (19)",
   "src": "HAF-TECH23 23T7-29/30/31",
   "existing": true,
   "T": [
    16,
    19
   ],
   "joint": {
    "kind": "housing",
    "dia": 20,
    "depthT": {
     "16": 12.7,
     "19": 14.2
    },
    "axisT": {
     "16": 8.0,
     "19": 9.5
    },
    "B": null,
    "shankDia": 10,
    "shankDepth": null,
    "fDia": 5,
    "fDepth": 11,
    "legacyB": true,
    "note": "Häfele Rafix-20"
   },
   "verificat": false
  },
  {
   "id": "haf_rafix_tab",
   "brand": "Häfele",
   "model": "Rafix TAB",
   "ph": "c_rafix_tab",
   "art": "263.09.731",
   "src": "HAF-TECH23 23T7-33",
   "T": [
    16,
    null
   ],
   "joint": {
    "kind": "housing",
    "dia": 20,
    "depthT": {
     "16": 12.7
    },
    "axisT": {
     "16": 8.0
    },
    "B": null,
    "shankDia": 10,
    "shankDepth": null,
    "fDia": 5,
    "fDepth": 11,
    "legacyB": true,
    "note": "Häfele Rafix-20 TAB"
   },
   "verificat": false
  },
  {
   "id": "haf_tab18_screw",
   "brand": "Häfele",
   "model": "TAB 18",
   "ph": "c_tab18_screw",
   "art": "263.66.558",
   "src": "HAF-TECH23 23T7-43",
   "T": [
    19,
    26
   ],
   "joint": {
    "kind": "plug",
    "dia": 18,
    "depthT": {
     "19": 15.0
    },
    "axisT": {
     "19": 9.5
    },
    "note": "Häfele TAB 18 (screw)"
   },
   "verificat": false
  },
  {
   "id": "haf_tab18_plug",
   "brand": "Häfele",
   "model": "TAB 18",
   "ph": "c_tab18_plug",
   "art": "263.67.537 (16) / 263.67.555 (19)",
   "src": "HAF-TECH23 23T7-43",
   "T": [
    16,
    19
   ],
   "joint": {
    "kind": "plug",
    "dia": 18,
    "depthT": {
     "16": 13.0,
     "19": 15.0
    },
    "axisT": {
     "16": 8.0,
     "19": 9.5
    },
    "note": "Häfele TAB 18 (plug-fit)"
   },
   "verificat": false
  },
  {
   "id": "haf_tab",
   "brand": "Häfele",
   "model": "TAB",
   "ph": "c_tab",
   "art": "263.73.535",
   "src": "HAF-TECH23 23T7-40",
   "T": [
    16,
    23
   ],
   "joint": {
    "kind": "plug",
    "dia": 18,
    "depthT": {
     "16": 13.0,
     "19": 13.0,
     "23": 13.0
    },
    "axisT": null,
    "note": "Häfele TAB"
   },
   "verificat": false
  },
  {
   "id": "haf_tab15",
   "brand": "Häfele",
   "model": "TAB 15",
   "ph": "c_tab15",
   "art": "263.73.611",
   "src": "HAF-TECH23 23T7-42",
   "T": [
    16,
    19
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "haf_tofix",
   "brand": "Häfele",
   "model": "Tofix",
   "ph": "c_tofix",
   "art": "261.95.704",
   "src": "HAF-TECH23 23T7-37",
   "T": [
    18,
    26
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "haf_onefix",
   "brand": "Häfele",
   "model": "OneFix",
   "ph": "c_onefix",
   "art": "263.03.104",
   "src": "HAF-TECH23 23T7-38",
   "T": [
    15,
    null
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "haf_turn",
   "brand": "Häfele",
   "model": "Turn",
   "ph": "c_turn",
   "art": "263.87.600",
   "src": "HAF-TECH23 23T7-41",
   "T": [
    18,
    null
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "haf_rvclip",
   "brand": "Häfele",
   "model": "RV clip",
   "ph": "c_rvclip",
   "art": "262.72.701 + 262.72.953",
   "src": "HAF-TECH23 23T7-56",
   "T": [
    null,
    null
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "haf_maxifix",
   "brand": "Häfele",
   "model": "Maxifix",
   "ph": "c_maxifix",
   "art": "262.87.003 / 262.87.713",
   "src": "HAF-TECH23 23T7-26,27",
   "T": [
    19,
    null
   ],
   "joint": {
    "kind": "housing",
    "dia": 35,
    "depthFn": {
     "k": 0.5,
     "c": 6.5
    },
    "axisT": null,
    "B": 35,
    "shankDia": 9,
    "shankDepth": 35,
    "fDia": null,
    "fDepth": null,
    "note": "Häfele Maxifix B35"
   },
   "verificat": false
  },
  {
   "id": "kn_duo35_ml",
   "brand": "Knapp",
   "model": "DUO 35",
   "ph": "c_duo35_ml",
   "art": "K061",
   "src": "KNAPP-DOCS DUO 35 mL-oL Instruction; knapp-belastungswerte-duo-35",
   "T": [
    10,
    20
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "kn_duo35_ol",
   "brand": "Knapp",
   "model": "DUO 35",
   "ph": "c_duo35_ol",
   "art": "K062",
   "src": "KNAPP-DOCS DUO 35 mL-oL Instruction; knapp-belastungswerte-duo-35",
   "T": [
    10,
    20
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "kn_duo30",
   "brand": "Knapp",
   "model": "DUO 30",
   "ph": "c_duo30",
   "art": "—",
   "src": "knapp-belastungswerte-duo-30-de",
   "T": [
    16,
    19
   ],
   "joint": null,
   "verificat": false
  },
  {
   "id": "kn_uno30",
   "brand": "Knapp",
   "model": "UNO 30",
   "ph": "c_uno30",
   "art": "K120",
   "src": "mont_uno30_de_en_fr.pdf; belastungswerte_uno30_2014",
   "T": [
    16,
    19
   ],
   "joint": null,
   "verificat": false
  }
 ],
 "sources": {
  "HAF-229": {
   "title": "Haefele UK Furniture Fittings Technology 2023, Section 9 p.229, E-drive Free flap / Free fold-up-swing, driver, mains leads (page amended 29.09.23)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T9-229.pdf"
  },
  "HAF-FREE19": {
   "title": "Haefele 'Free Flap 2019' catalogue (Free E-Drive pp.39-44; text partly font-garbled, English parts readable)",
   "url": "https://htdocs.kirz.com/HTHMKT/Catalogue/FF/new-freedom-in-motion-free.pdf"
  },
  "HAF-216": {
   "title": "Haefele UK 23T9 p.216-217 Free up (cutting dim. -88 mm / -113 mm with electric)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T9-216.pdf"
  },
  "HAF-218": {
   "title": "Haefele UK 23T9 p.218-219 Free swing",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T9-218.pdf"
  },
  "HAF-124": {
   "title": "Haefele UK 23T9 p.124 Push to open soft close mechanism for concealed hinges (amended 16.02.26)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T9-124.pdf"
  },
  "HAF-78": {
   "title": "Haefele UK 23T9 p.78-79 Grass Tipmatic accessories (amended 18.10.24)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T9-78.pdf"
  },
  "HAF-241": {
   "title": "Haefele UK 23T9 p.241 Push magnetic door catch for concealed fixing (Maxi Touch)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T9-241.pdf"
  },
  "HAF-154": {
   "title": "Haefele UK 23T8 p.154 Pressure catches (amended 14.09.23)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T8-154.pdf"
  },
  "HAF-165": {
   "title": "Haefele UK 23T8 p.165 Flexa-Touch drawer latch",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T8-165.pdf"
  },
  "BLUM-TIPON-DOORS": {
   "title": "Blum brochure 'TIP-ON for doors' EP-234/4 EN-GB/07.19-1 (distributor copy)",
   "url": "https://www.ldlonline.co.uk/media/wysiwyg/others/media/tip-on-for-doors.pdf"
  },
  "BLUM-CAT24": {
   "title": "Blum Catalogue and technical manual 2024-2025 (web edition, one URL per catalogue page; pages used: 14,16,50,51,52,102,364,365,366,388,394,396,397,398,400,404-407,504,505,676,698)",
   "url": "https://publications.blum.com/2024/catalogue/en/{page}/"
  },
  "BLUM-TOB": {
   "title": "Blum brochure 'TIP-ON BLUMOTION for LEGRABOX and MOVENTO' EP-412/3 EN-AL/07.23",
   "url": "https://d2.blum.com/services/BEC003/tob0010-ep-412_ep_dok_bau_$sen_$aof_$v3.pdf"
  },
  "BLUM-UNO": {
   "title": "Blum SERVO-DRIVE uno Instruction leaflet (older TANDEM/TANDEMBOX uno; distributor copy; undated)",
   "url": "https://cdn.shopify.com/s/files/1/1588/9599/files/Servo_Drive_Uno_Instructions.pdf"
  },
  "BLUM-KA160": {
   "title": "Blum Catalogue 2024/2025 extract 'Motion technologies' (catalogue pp.570-582 incl. SERVO-DRIVE flex)",
   "url": "https://d2.blum.com/services/BEC003/ka160-kp-007_ka_dok_bau_%24sen_%24aof_%24v6.pdf"
  },
  "HET-BK111": {
   "title": "Hettich Technik und Anwendung 2025, p.111 Push to open Silent fuer Drehtueren (DE; EN version bk_113 under /en_DE/)",
   "url": "https://catalog.hettich.com/General/TA_2025/de_DE/catalogs/TA_2025_de_DE/pdf/save/bk_113.pdf"
  },
  "HET-MTA-PTOS": {
   "title": "Hettich MTA 9 077 363 02 (04.06.2024) Push to open Silent for hinged doors, assembly instruction",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_907736302_PTO_Silent_fuer_Scharniere.pdf"
  },
  "HET-ANZ": {
   "title": "Hettich 309095 Anzahl Push to open Silent je Drehtuer",
   "url": "https://web2.hettich.com/hbh/addon/montage/309095_Anzahl_PushtoOpenSilent_DE.pdf"
  },
  "HET-MTA-PTO": {
   "title": "Hettich MTA 9 393 364 01 (21.05.2026) Push to open (Magnet/Lock) for handleless fronts",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_939336401_PTO_Scharniere.pdf"
  },
  "HET-SHOP": {
   "title": "Hettich eShop product pages (orders 9239087, 9375985, 9381335, 9381496, 9241049, 9257890-93, 9078139, 9082363)",
   "url": "https://shop.hettich.com/gb_EN/p/{order_no}"
  },
  "HET-BK262": {
   "title": "Hettich TA 2025 p.262 Push to open Silent for Actro YOU (AvanTech YOU)",
   "url": "https://catalog.hettich.com/General/TA_2025/en_DE/catalogs/TA_2025_en_DE/pdf/save/bk_264.pdf"
  },
  "HET-BK310": {
   "title": "Hettich TA 2025 Push to open Silent for ArciTech",
   "url": "https://catalog.hettich.com/General/TA_2025/en_DE/catalogs/TA_2025_en_DE/pdf/save/bk_310.pdf"
  },
  "HET-MTA-ARCI": {
   "title": "Hettich MTA 9 239 323 01 (20.10.2022) ArciTech Push to open Silent assembly",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_923932301_AT_PTO_Silent.pdf"
  },
  "HET-BK345": {
   "title": "Hettich TA 2025 p.345 Easys drive unit, mounting bracket",
   "url": "https://catalog.hettich.com/General/TA_2025/en_DE/catalogs/TA_2025_en_DE/pdf/save/bk_347.pdf"
  },
  "HET-BK347": {
   "title": "Hettich TA 2025 p.347 Easys power supply unit, holder, power cable",
   "url": "https://catalog.hettich.com/General/TA_2025/en_DE/catalogs/TA_2025_en_DE/pdf/save/bk_349.pdf"
  },
  "HET-EASYS-MTA": {
   "title": "Hettich MTA 9 304 972 03 Easys 100 installation/operating manual (2023)",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_930497203_en_Easys_AVT_YOU_AT_IA.pdf"
  },
  "HET-EASYS-PSU": {
   "title": "Hettich MTA 9 345 401 00 (13.11.2023) Easys power supply unit safety/instructions",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_934540100_en_Easys_Netzteil_Sicherh-AW.pdf"
  },
  "HET-EASYS-DU": {
   "title": "Hettich MTA 9 384 191 00 Easys DriveUnit installation (drawing only)",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_938419100_Easys_DriveUnit.pdf"
  },
  "GRASS-09": {
   "title": "Grass brochure 'TIPMATIC' (2009, chapter 6, distributor copy)",
   "url": "https://res.cloudinary.com/amerhart/image/upload/Documents/Product/Grass_641.000.09.9862_BRO.pdf"
  },
  "GRASS-18": {
   "title": "Grass Tiomos catalogue (Jun 2018) incl. Tiomos 110 Tipmatic Plus and Tipmatic pin",
   "url": "https://res.cloudinary.com/amerhart/image/upload/Documents/Product/Grass_F046140360213_CAT.pdf"
  },
  "SAL-PUSH": {
   "title": "Salice PUSH catalogue D0CASA005ENG",
   "url": "https://www.salice.com/media/Catalog/hinges/push/Salice_PUSH_D0CASA005ENG.pdf"
  },
  "SAL-MECH": {
   "title": "Salice Mechanical Push with adjustment (ENG)",
   "url": "https://www.salice.com/downloads/2817/2190/Salice-Mechanical-Push-with-adjustment-ENG.pdf"
  },
  "SAL-AIR": {
   "title": "Salice AIR D0CASA014ENG (Push-to-open hinge + Magnetic Push)",
   "url": "https://www.salice.com/media/Catalog/hinges/air/Salice_AIR_D0CASA014ENG.pdf"
  },
  "SAL-MAG": {
   "title": "Salice Magnetic Push release devices and retaining catches (ENG)",
   "url": "https://www.salice.com/downloads/2853/2136/Salice-Magnetic-Push-release-devices-and-retaining-catches-ENG.pdf"
  },
  "HET-SAH500-MTA": {
   "title": "Hettich SAH 500 installation instructions MTA 9 348 672 00 (24.03.2025)",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_934867200_SAH_500_KAT.pdf"
  },
  "HET-SHOP-9385585": {
   "title": "Hettich shop, SAH 500 wall element left 9385585 (read via WebFetch; values cross-checked with HET-SAH500-MTA)",
   "url": "https://shop.hettich.com/cl_EN/Further-products/Cabinet-suspension-brackets-and-suspension-rails/SAH-500-cabinet-suspension-bracket%2C-inside-the-cabinet-body/SAH-500-cabinet-suspension-bracket%2C-wall-mounted-element%2C-left/p/9385585"
  },
  "HET-SHOP-9385584": {
   "title": "Hettich shop, SAH 500 cabinet body element right 9385584",
   "url": "https://shop.hettich.com/gr_EN/Further-products/Cabinet-suspension-brackets-and-suspension-rails/SAH-500-cabinet-suspension-bracket%2C-inside-the-cabinet-body/SAH-500-cabinet-suspension-bracket%2C-cabinet-body-element%2C-right/p/9385584"
  },
  "HET-SHOP-9277718": {
   "title": "Hettich shop, SAH 216 with lift-off guard 9277718",
   "url": "https://shop.hettich.com/lu_FR/Autres-produits/Suspension-d%27armoire-et-rails-de-fixation/Suspension-d%E2%80%99armoire-SAH-216%2C-derri%C3%A8re-la-paroi-arri%C3%A8re/Suspension-d%27armoire-SAH-216-avec-s%C3%A9curit%C3%A9-anti-d%C3%A9crochement/p/9277718"
  },
  "HET-SAH216-MTA": {
   "title": "Hettich SAH 216 AHS installation instructions MTA 9 276 803 00",
   "url": "https://web2.hettich.com/hbh/addon/montage/MTA_927680300_SAH_216_Set_AHS.pdf"
  },
  "HET-TA2025-SUSP": {
   "title": "Hettich Technical Information 2025 en_DE, cabinet suspension brackets (file bk_NNN = printed page NNN-2)",
   "url": "https://catalog.hettich.com/General/TA_2025/en_DE/catalogs/TA_2025_en_DE/pdf/save/bk_NNN.pdf"
  },
  "HET-TA2025-CONN": {
   "title": "Hettich Technical Information 2025 en_DE, connecting fittings for cabinet bodies",
   "url": "https://catalog.hettich.com/General/TA_2025/en_DE/catalogs/TA_2025_en_DE/pdf/save/bk_NNN.pdf"
  },
  "HET-IMOS": {
   "title": "Hettich imos infosheet connecting technology (order-number cross-check only)",
   "url": "https://www.hettich.com/fileadmin/Hettich_International/Planning/imos/Infosheet_Hettich_Connecting_Technology.pdf"
  },
  "CAM-CERT": {
   "title": "Camar load certificates (distributor copy, Drevotrust CZ): camar_806, 807, 801, 814-35, 814-64, 818, 821, 822, 704, plech_pro_704, plech_pro_806_818 (.pdf, *_certifikat_nosnosti.pdf)",
   "url": "https://webdata.drevotrust.cz/montazni_navody/camar/certifikaty_nosnosti/"
  },
  "CAM-SHEET": {
   "title": "Camar catalogue sheets 4.1.1 (official camar.it): 273-276 (806), 283/284 (816 AS Z1 DU, cat. p.276-277), 285/286 (816 AS Z1 50), 287-290 (816 32), 299-308 (818), 313-326 (821)",
   "url": "https://www.camar.it/images/prodotti/pdf/NNN.pdf"
  },
  "CAM-LEG": {
   "title": "Camar legend for cabinet-hanger pictograms",
   "url": "https://www.camar.it/legende/legenda-reggipensili.pdf"
  },
  "HAF-2014-HANG": {
   "title": "Häfele UK Components catalogue 2014 hanger pages: 14CFC76, 14CFC77, 14CFC78, 14CFC78A (amended 2017), 14CFC78B (created 2017), 14CFC79, 14CFC80 (same base URL)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/14CFC77.pdf"
  },
  "HAF-TECH23": {
   "title": "Häfele UK Furniture Fittings Technology 2023, section 7 connecting fittings (23T7-26..56)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T7-NN.pdf"
  },
  "KNAPP-DOCS": {
   "title": "KNAPP product downloads (official): KNAPP_DUO_35_mL-oL_Instruction-1.pdf (2020/03), belastungswerte_uno30_2014.pdf, mont_uno30_de_en_fr.pdf (2020/03), knapp-belastungswerte-duo-30-de / duo-35-f1-de / duo-35-f2-de / uno-30-de .pdf (2026/01)",
   "url": "https://www.knapp-verbinder.com/downloads/produkt-downloads/"
  },
  "HAF-2023-HANG": {
   "title": "Häfele UK Furniture Fittings Technology 2023, section 7 cabinet hangers (23T7-212..228; pages read as images)",
   "url": "https://files.hafele.co.uk/CatalogFiles/www/23T7-NNN.pdf"
  },
  "HET-SHOP-9045794": {
   "title": "Hettich shop, SAH 209 cabinet suspension bracket behind the rear panel, 9045794 (page read in Bulgarian, numbers only)",
   "url": "https://shop.hettich.com/ba_BG/Further-products/Cabinet-suspension-brackets-and-suspension-rails/SAH-209-cabinet-suspension-bracket%2C-behind-the-rear-panel/Cabinet-suspension-bracket-SAH-209/p/9045794"
  },
  "BLUM-CAT2021": {
   "title": "Blum Catalogue and technical manual 2020/2021 (PDF copy hosted by a distributor; Blum's own edition, KA-140), p.556 Wall hanging bracket; the 2022/23 and 2024-25 editions have the same section (publications.blum.com) but their page text was not readable",
   "url": "https://www.ldlonline.co.uk/media/wysiwyg/others/media/blum-catalogue.pdf"
  }
 },
 "notes": {
  "opening": [
   "All numbers carry src ids from 'sources'. Values marked drawing were read from rendered page images (80-110 dpi) or drawing labels in extracted text; verify before CAM/CNC use.",
   "Blum catalogue 2024-2025 is a web edition: page N = https://publications.blum.com/2024/catalogue/en/N/ (printed page number in catalogue = N; HTML header shows N+4 as PDF page).",
   "CONFLICT Haefele Free E: HAF-FREE19 (2019) 'parallel connection for up to three drive units' vs HAF-229 (UK 2023) 'only one Free E drive unit per driver'. Also HAF-229 heading 'Driver, 24W' vs table 90 W / 3.75 A; HAF-FREE19 drive unit 'wattage 60 W'.",
   "CONFLICT/variant Blum TIP-ON BLUMOTION MOVENTO: BLUM-TOB p25 L5 NL 'or 750 mm (MOVENTO)' vs BLUM-CAT24 p504 L5 NL 450-750; S0/S1 MOVENTO 320 (brochure) vs 270-320 (catalogue).",
   "CONFLICT Hettich PTO Silent drawers: shop pages list broader NL ranges than catalogue bk_264/bk_310 (e.g. 9257891 NL 250-600 on shop vs 270-600).",
   "Premise corrections: SERVO-DRIVE flex is for refrigerators/freezers/dishwashers, not drawers (BLUM-CAT24 p574 / BLUM-KA160); SERVO-DRIVE uno for drawers = waste-bin pull-outs (and AVENTOS single lift); the drawer system is 'SERVO-DRIVE for LEGRABOX|MERIVOBOX|TANDEMBOX'. Hettich 'Silent Power' not found; Hettich 'Touch Latch' not a Hettich name (Push to open Magnet/Lock). Salice 'Easy-ride'/'Air push' not found as products (Salice Air hinge has a Push version + Magnetic Push).",
   "Hettich Push to open Silent for HINGED doors is battery-operated (4 x AA), not mains; Easys is the mains 24 V system (drawers).",
   "Häfele E-Drive for drawers/doors: none found; E-Drive exists only for Free flap/fold/up/swing (HAF-229).",
   "Blum 'Z10NA300' leaflet (BLUM-UNO) is the older TANDEM/TANDEMBOX uno document; current Z10NA40x/Z10NE04 electrical data not retrieved.",
   "Local copies: /tmp/claude-0/-home-user/39871daa-ecac-5d3e-a259-3b91d048a27e/scratchpad/dl-opening/ (PDFs + .txt) and .../scratchpad/blumcat/ (Blum catalogue pages p<N>.txt)."
  ],
  "susp": [
   "Hettich catalogue file numbering: file bk_NNN prints page NNN-2 (e.g. bk_752 shows 'page 750'). Hettich TA 2025 does not contain SAH 500; SAH 500 data comes from MTA 9 348 672 00 and the Hettich shop.",
   "Camar 816 and 811: no official load/adjustment table for 811; 816 AS has adjustment from official sheet but no load certificate (certificate path 404). Retailer claims (65 kg) are NOT used.",
   "Häfele hanger pages are from the 2014 UK catalogue (amended 2017): current range may differ. 'Prima', 'Dispenza', 'Tube' hangers: no such Häfele hangers found in any official document (Libra H1/H2/H3 and codes 290.03.9xx are the verified products).",
   "Knapp: official range has no 'Z-Tab', 'Hanger' or 'Wedge' furniture connector. Hook-in connectors are DUO 30/35, UNO 30; other furniture connectors exist (MODULAR, KLICK, DEKLICK, FIYU, CLIPS, FAST, KOMBI, QUICK-SET, SOLID, SILVER, SUNNY, CHAMP, CHICO, CONTRA, TUCK, EASY-CON) with instruction PDFs at knapp-verbinder.com/downloads/produkt-downloads/ but not extracted here (e.g. MODULAR-Detailkatalog-2024.pdf, KNAPP_MODULAR_Instruction.pdf downloaded, not interpreted).",
   "Hettich 'Sorinos' not looked up (not in TA 2025 pages checked). Hettich 'Rafix' does not exist: Rafix is Häfele. Häfele 'Duo' = Knapp DUO. French cleats: no official catalogue entry found (Häfele hangers use rails).",
   "Values read from drawings are marked 'drawing'; many role assignments (which number is which distance) were not legible from text and are flagged as such, not guessed.",
   "CAD: Hettich zips listed; Häfele, Camar, Knapp CAD URLs not found/not searched (null).",
   "Conflicts: Rafix TAB drilling depth 14.2 +0.2 (Häfele UK catalogue) vs a retailer 14.5 for 262.34.502 (not official, not used). SAH 500 110 kg (shop) vs 1100 N (MTA drawing): consistent. Hettich shop says Rastex 15 min panel 16 for a specific article vs catalogue range 12-29 for thickness-specific articles.",
   "D-186 follow-up (24.11.2026), Häfele UK 2023 section 7 pp.212-228 read as images: added Traser-6, Traser-8, rapid-fitting 290.21.900/901, Spider, Koala and rail 290.10.970. NOT added: Atlas system (290.24.910/915/919, 290.15.940, 290.27.938: 'tested with a load of 369 kg' is a system test value, not a per-bracket capacity; lower support geometry not modelled); retailer-only articles 290.21.930, 290.02.721/290.07.721 (Grass), 290.40.901, 290.11.9xx, Z-Clip (not on pp.212-228 of the official catalogue). 290.21.900/901 load 65 kg: page does not say per hanger or per pair, so no capacity is derived (a retailer listing for a different code, 290.21.930, says 65 kg per piece / 130 kg per pair: not used).",
   "24.11.2026: Hettich SAH 209 (shop page 9045794: 20 kg per bracket, EN 15939 frame A) and Blum wall hanging brackets 48N0510 (screw-on) / 48N0610 (knock-in), 130 kg per pair, DIN EN 15939 frame A, from Blum catalogue 2020/2021 p.556 (read as image). Older Blum edition: 2022/23 and 2024-25 hold the same section but the flipbook text is not readable; check the codes in the current edition. A distributor listing (Demos 2024) quoting adjustments of +/-7.5 mm height and +/-2.5 mm side for a concealed Blum hanger is NOT used (not Blum's own document)."
  ]
 }
};
if (typeof module === "object" && module.exports) module.exports = EBOpenData;
root.EBOpenData = EBOpenData;
})(typeof globalThis !== "undefined" ? globalThis : this);
