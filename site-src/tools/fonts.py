"""Fonturile site-ului: câte un fișier woff2 pe stil, subsetat la EN/RO/IT/FR.
Sursele: fonturile variabile oficiale din github.com/google/fonts (SIL OFL).
Rulare: pip install fonttools brotli && python3 site-src/tools/fonts.py"""
import os, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
GF = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/'
SRC = {'F': 'fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf', 'FI': 'fraunces/Fraunces-Italic%5BSOFT,WONK,opsz,wght%5D.ttf',
       'IT': 'intertight/InterTight%5Bwght%5D.ttf', 'JB': 'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf'}
U = ("U+0020-007E,U+00A0-00FF,U+0102-0103,U+0152-0153,U+015E-015F,U+0162-0163,U+0178,U+0218-021B,U+02C6,U+02DA,U+02DC,"
     "U+2009,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2032-2033,U+20AC,U+2122,U+2190-2193,U+2212,U+2715")
JOBS = [('F', {'wght': 400, 'opsz': 60, 'SOFT': 0, 'WONK': 0}, 'fraunces-400'), ('FI', {'wght': 400, 'opsz': 60, 'SOFT': 0, 'WONK': 0}, 'fraunces-400-italic'),
        ('IT', {'wght': 400}, 'inter-tight-400'), ('IT', {'wght': 600}, 'inter-tight-600'),
        ('JB', {'wght': 400}, 'jetbrains-mono-400'), ('JB', {'wght': 500}, 'jetbrains-mono-500')]
cache = {}
for key, loc, name in JOBS:
    if key not in cache:
        path = f'/tmp/{key}.ttf'; urllib.request.urlretrieve(GF + SRC[key], path); cache[key] = path
    f = TTFont(cache[key]); axes = {a.axisTag for a in f['fvar'].axes}
    inst = instancer.instantiateVariableFont(f, {k: v for k, v in loc.items() if k in axes})
    o = subset.Options(); o.flavor = 'woff2'; o.name_IDs = ['*']; o.notdef_outline = True
    o.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'zero', 'tnum', 'lnum']
    s = subset.Subsetter(o); s.populate(unicodes=subset.parse_unicodes(U)); s.subset(inst)
    inst.flavor = 'woff2'; inst.save(f'{ROOT}/fonts/site-{name}.woff2'); print('✓', name)
