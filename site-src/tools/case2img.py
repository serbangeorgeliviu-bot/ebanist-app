"""PNG-urile din case-capture.cjs → AVIF + WebP (și șterge PNG-urile)."""
import os, glob
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
def save(png, w):
    im = Image.open(png).convert('RGB'); r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    r.save(png[:-4] + f'-{w}.webp', quality=82, method=6); r.save(png[:-4] + f'-{w}.avif', quality=60); os.remove(png)
for png in glob.glob(f'{ROOT}/site/screens/*/case-bagno-*.png'): save(png, 780)
for png in glob.glob(f'{ROOT}/site/img/case/labels-*.png'): save(png, 1200)
print('ok')
