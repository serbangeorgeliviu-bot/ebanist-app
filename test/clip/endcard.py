"""End card 1080x1920: ultimul cadru al înregistrării, estompat + logo + text.
python3 endcard.py <ultimul-cadru.png> <logo-icon.png> <out.png>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texts import T
from PIL import Image, ImageDraw, ImageFont, ImageFilter
bgp, icp, out = sys.argv[1:4]
INTER = "/usr/share/fonts/opentype/inter/Inter-%s.otf"
bg = Image.open(bgp).convert("RGB").resize((1080, 1920)).filter(ImageFilter.GaussianBlur(14))
bg = Image.blend(bg, Image.new("RGB", (1080, 1920), (16, 58, 43)), 0.82)
d = ImageDraw.Draw(bg)
ic = Image.open(icp).convert("RGBA").resize((300, 300)); bg.paste(ic, (390, 520), ic)
def ctr(t, y, name, size, col):
    f = ImageFont.truetype(INTER % name, size); d.text(((1080 - d.textlength(t, font=f)) / 2, y), t, font=f, fill=col)
ctr(T["end"][0], 900, "Black", 120, (255, 255, 255))
ctr("EBANIST", 1040, "Black", 190, (255, 214, 0))
ctr(T["end"][1], 1270, "Bold", 78, (255, 255, 255))
ctr("ebanist.com/app", 1420, "SemiBold", 60, (200, 225, 210))
bg.save(out)
