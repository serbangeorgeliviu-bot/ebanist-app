"""Convertește capturile (PNG) și PDF-urile aplicației în AVIF + WebP pentru site.
Rulează după capture.cjs. Cere: pip install pymupdf pillow"""
import io, os, glob
import pymupdf
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
TMP = '/tmp/ebanist-docs'
PAGES = [('distinta', 0), ('etichete', 0), ('montaj', 0), ('montaj', 1), ('desen', 0), ('oferta', 0)]

def save(im, base, widths, lightbox=None):
    for w in widths:
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(f'{base}-{w}.webp', quality=80, method=6)
        r.save(f'{base}-{w}.avif', quality=58)
    if lightbox:
        r = im.resize((lightbox, round(im.height * lightbox / im.width)), Image.LANCZOS)
        r.save(f'{base}-{lightbox}.webp', quality=82, method=6)

for L in ['en', 'ro', 'it', 'fr']:
    out = f'{ROOT}/site/docs/{L}'; os.makedirs(out, exist_ok=True)
    for name, i in PAGES:
        f = f'{TMP}/{L}-{name}.pdf'
        if not os.path.exists(f): continue
        pix = pymupdf.open(f)[i].get_pixmap(dpi=180)
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        save(im, f'{out}/{name}-{i}', [720], lightbox=1500)
    for png in glob.glob(f'{ROOT}/site/screens/{L}/*.png'):
        im = Image.open(png).convert('RGB')
        w = 780 if 'phone' in png else 1600
        save(im, png[:-4], [w])
        os.remove(png)
    print(L, 'ok')
