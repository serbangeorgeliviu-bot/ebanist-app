"""Convertește capturile de ajutor (site/screens/<lang>/help-*.png) în AVIF + WebP la 780 px.
Rulează după help-capture.cjs. Cere: pip install pillow (cu AVIF).
Nu atinge restul capturilor și documentele: pdf2img.py le face pe ale lui."""
import glob, os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
W = 780  # = SHOTS[*].w din app/ebanist-help.js

n = 0
for png in sorted(glob.glob(f'{ROOT}/site/screens/*/help-*.png')):
    im = Image.open(png).convert('RGB')
    r = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    base = f'{png[:-4]}-{W}'
    r.save(f'{base}.webp', quality=80, method=6)
    r.save(f'{base}.avif', quality=58)
    os.remove(png)
    n += 1
print(n, 'capturi convertite;', 'dimensiune:', r.size)
