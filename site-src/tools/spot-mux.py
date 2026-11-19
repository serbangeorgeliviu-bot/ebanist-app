#!/usr/bin/env python3
"""Montajul spotului Ebanist (9:16, italiană): cadrele 3D reale (vid-spot/seq), cele două cadre cu meseriașul (vid-spot/in/pA.mp4, pB.mp4),
vocea (vo.mp3, linii cu timpi), muzica (music.mp3), subtitrări arse, etichete de funcții, cardul final.
Rulare: python3 site-src/tools/spot-mux.py   → vid-spot/ebanist-spot-it.mp4"""
import os, subprocess, json, sys
LANG = sys.argv[1] if len(sys.argv) > 1 else "it"
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
V = os.path.join(ROOT, "vid-spot"); IN = os.path.join(V, "in"); OV = os.path.join(V, "ov"); SEQ = os.path.join(V, "seq")
os.makedirs(OV, exist_ok=True)
FPS = 24
W, H = 1080, 1920
BOLD = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
if not os.path.exists(BOLD): BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BLACK = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
if not os.path.exists(BLACK): BLACK = BOLD
GREEN = (22, 163, 111, 255)

# timpii vocii (secunde, din generarea vidIQ): start, durată
VO = [(0, 5.64), (5.64, 4.68), (10.32, 6.92), (17.24, 4.68), (21.92, 4.67), (26.59, 4.99), (31.58, 6.77)]
SUB = [  # [(text, linie, parte din linie 0..1 start, end)]
 ("Chi lavora il legno lo sa:", 0, 0.0, .45), ("il mobile perfetto si decide\nprima di tagliare il pannello.", 0, .45, 1),
 ("Questo è Ebanist.", 1, 0, .45), ("Disegni il mobile,\ne lo vedi subito in 3D.", 1, .45, 1),
 ("Luci LED.", 2, 0, .2), ("Ante che si alzano\ncon Servo-Drive.", 2, .2, .62), ("Cassetti, ante pieghevoli,\nscorrevoli.", 2, .62, 1),
 ("Soggiorno, cucina,\ncamera da letto:", 3, 0, .6), ("ogni pezzo al suo posto.", 3, .6, 1),
 ("Distinta di taglio,\netichette, schede di montaggio,", 4, 0, .75), ("pronte in un attimo.", 4, .75, 1),
 ("Oltre 100 decori Egger.", 5, 0, .45), ("Ferramenta Blum,\nHettich e Häfele.", 5, .45, 1),
 ("Ebanist.", 6, 0, .1), ("Su Google Play\ne su ebanist.com", 6, .1, .6), ("Funziona anche su iPhone.\nProvalo gratis.", 6, .6, 1),
]
# scene: (nume, durată pe ecran, etichetă sus)
SCENES = [
 ("pA", 5.64, None), ("L1", 4.68, "Progetta e vedi in 3D"),
 ("L2", 2.3, "Vetrina con LED"), ("L3", 2.3, "AVENTOS + SERVO-DRIVE"), ("L4", 2.32, "Ante pieghevoli"),
 ("L5", 1.28, "Soggiorno"), ("K1", 1.7, "Cucina"), ("B1", 1.7, "Camera da letto"),
 ("A3", 2.3, "Scheda del pezzo A4"), ("X1", 2.37, "Esploso 3D"),
 ("H1", 2.2, "Ferramenta e forature"), ("D1", 1.4, "Ante scorrevoli, LED a sensore"), ("D3", 1.39, "Letto con contenitore"),
 ("pB", 3.82, None), ("END", 5.6, None),
]

EN_SUB = [
 ("Anyone who works with wood knows it:", 0, 0.0, .4), ("the perfect piece of furniture is decided\nbefore you cut the panel.", 0, .4, 1),
 ("This is Ebanist.", 1, 0, .35), ("Design the furniture,\nand see it instantly in 3D.", 1, .35, 1),
 ("LED lights.", 2, 0, .15), ("Doors that lift\nwith Servo-Drive.", 2, .15, .55), ("Drawers, folding\nand sliding doors.", 2, .55, 1),
 ("Living room, kitchen,\nbedroom:", 3, 0, .6), ("every part in its place.", 3, .6, 1),
 ("Cutting lists, labels,\nassembly sheets,", 4, 0, .65), ("ready in a moment.", 4, .65, 1),
 ("Over 100 Egger decors.", 5, 0, .5), ("Blum, Hettich\nand H\u00e4fele hardware.", 5, .5, 1),
 ("Ebanist.", 6, 0, .1), ("On Google Play\nand at ebanist.com", 6, .1, .6), ("Works on iPhone too.\nTry it free.", 6, .6, 1),
]
EN_TAGS = {"L1": "Design and see it in 3D", "L2": "Display cabinet with LED", "L3": "AVENTOS + SERVO-DRIVE", "L4": "Folding doors",
 "L5": "Living room", "K1": "Kitchen", "B1": "Bedroom", "A3": "Part sheet (A4)", "X1": "3D exploded view",
 "H1": "Hardware and drilling", "D1": "Sliding doors, sensor LED", "D3": "Bed with storage"}
if LANG == "en":
    SUB = EN_SUB
    SCENES = [(n, d, EN_TAGS.get(n) if t else None) for (n, d, t) in SCENES]
    SEQ_ALIAS = {"A3": "A3en"}
    OUTNAME = "ebanist-spot-en.mp4"
else:
    SEQ_ALIAS = {}
    OUTNAME = "ebanist-spot-it.mp4"

def font(p, s): return ImageFont.truetype(p, s)

def text_stroke(d, xy, t, f, fill, stroke, sw, anchor="mm", spacing=10):
    d.multiline_text(xy, t, font=f, fill=fill, anchor=anchor, align="center", spacing=spacing, stroke_width=sw, stroke_fill=stroke)

def mk_sub(i, text, y=1560):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    sz = 72
    while sz > 40:
        f = font(BLACK, sz)
        if max(d.textlength(l, font=f) for l in text.split("\n")) <= 960: break
        sz -= 2
    text_stroke(d, (W // 2, y), text, font(BLACK, sz), (255, 255, 255, 255), (0, 0, 0, 255), 8)
    p = os.path.join(OV, f"sub{i:02d}.png"); im.save(p); return p

def mk_tag(name, text):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(BOLD, 46); b = d.textbbox((0, 0), text, font=f); tw = b[2] - b[0]
    x0 = (W - tw) // 2 - 36; y0 = 150
    d.rounded_rectangle((x0, y0, x0 + tw + 72, y0 + 88), 44, fill=(14, 59, 42, 235))
    d.ellipse((x0 + 22, y0 + 34, x0 + 42, y0 + 54), fill=GREEN)
    d.text((x0 + 56, y0 + 44), text, font=f, fill=(255, 255, 255, 255), anchor="lm")
    p = os.path.join(OV, f"tag_{name}.png"); im.save(p); return p

def mk_title():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    logo = Image.open(os.path.join(ROOT, "site/video/ebanist-logo-512.png")).convert("RGBA").resize((300, 300))
    im.alpha_composite(logo, (W // 2 - 150, 520))
    text_stroke(d, (W // 2, 900), "EBANIST", font(BLACK, 150), (255, 255, 255, 255), (0, 0, 0, 255), 6)
    p = os.path.join(OV, "title.png"); im.save(p); return p

def mk_end():
    im = Image.new("RGB", (W, H), (8, 34, 25)); d = ImageDraw.Draw(im)
    for y in range(H):  # degrade
        c = int(8 + 14 * y / H); d.line((0, y, W, y), fill=(c, 34 + c, 25 + c // 2))
    logo = Image.open(os.path.join(ROOT, "site/video/ebanist-logo-512.png")).convert("RGBA").resize((340, 340))
    im.paste(logo, (W // 2 - 170, 230), logo)
    d.text((W // 2, 650), "EBANIST", font=font(BLACK, 150), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 760), ("Your furniture, from design to assembly" if LANG == "en" else "Il tuo mobile, dal progetto al montaggio"), font=font(BOLD, 44), fill=(160, 220, 195), anchor="mm")
    def pill(y, a, b):
        d.rounded_rectangle((120, y, W - 120, y + 180), 40, fill=(255, 255, 255))
        d.text((W // 2, y + 62), a, font=font(BOLD, 40), fill=(90, 100, 95), anchor="mm")
        d.text((W // 2, y + 124), b, font=font(BLACK, 62), fill=(14, 59, 42), anchor="mm")
    pill(900, "Android", "Google Play")
    pill(1120, ("Web · also iPhone and PC" if LANG == "en" else "Sito web · anche iPhone e PC"), "ebanist.com")
    d.text((W // 2, 1420), ("Try it free" if LANG == "en" else "Provalo gratis"), font=font(BLACK, 90), fill=(255, 255, 255), anchor="mm")
    d.text((W // 2, 1530), ("Search “Ebanist” on Google Play" if LANG == "en" else "Cerca “Ebanist” su Google Play"), font=font(BOLD, 44), fill=(160, 220, 195), anchor="mm")
    p = os.path.join(OV, "end.png"); im.save(p); return p

def run(a): subprocess.run(a, check=True)

def seg_part(name, dur, idx):
    out = os.path.join(V, f"part{idx:02d}.mp4")
    base = ["ffmpeg", "-loglevel", "error", "-y"]
    enc = ["-r", str(FPS), "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-an"]
    if name in ("pA", "pB"):
        src = os.path.join(IN, ("pA_ui_en.mp4" if LANG == "en" else "pA_ui.mp4") if name == "pA" else name + ".mp4")
        vf = f"scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,eq=contrast=1.05:saturation=1.08"
        run(base + ["-i", src, "-t", f"{dur}", "-vf", vf] + enc + [out])
    elif name == "END":
        run(base + ["-loop", "1", "-framerate", str(FPS), "-i", os.path.join(OV, "end.png"), "-t", f"{dur}"] + enc + [out])
    else:
        d = os.path.join(SEQ, SEQ_ALIAS.get(name, name)); n = len([f for f in os.listdir(d) if f.endswith(".jpg")])
        run(base + ["-framerate", f"{n / dur:.5f}", "-i", os.path.join(d, "f_%04d.jpg"), "-t", f"{dur}",
                    "-vf", f"fps={FPS},scale={W}:{H},zoompan=z='1+0.0006*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}"] + enc + [out])
    return out

def main():
    mk_title(); mk_end()
    subs = []
    for i, (t, ln, a, b) in enumerate(SUB):
        s, d = VO[ln]; subs.append((mk_sub(i, t, 1790 if ln == 0 else 1560), s + d * a, s + d * b))
    tags = []; t0 = 0.0; parts = []
    for i, (name, dur, tag) in enumerate(SCENES):
        parts.append(seg_part(name, dur, i))
        if tag: tags.append((mk_tag(name, tag), t0 + 0.15, t0 + dur - 0.05))
        t0 += dur
    total = t0
    lst = os.path.join(V, "parts.txt"); open(lst, "w").write("\n".join(f"file '{p}'" for p in parts))
    silent = os.path.join(V, "silent.mp4"); run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])
    # titlul EBANIST la intrarea în L1, subtitrări, etichete
    ovs = [(os.path.join(OV, "title.png"), 5.64, 7.4)] + subs[:] + tags
    # subtitrările de pe cardul final se omit (cardul spune deja tot) după 35.4
    ovs = [(p, a, b) for (p, a, b) in ovs if not (a >= 35.4 and "sub" in os.path.basename(p))]
    ins = []; fc = []; last = "0:v"
    for k, (p, a, b) in enumerate(ovs, 1):
        ins += ["-loop", "1", "-framerate", str(FPS), "-i", p]
        fc.append(f"[{k}:v]format=rgba,fade=t=in:st={a:.3f}:d=0.12:alpha=1[f{k}]")
        fc.append(f"[{last}][f{k}]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})':shortest=1[o{k}]"); last = f"o{k}"
    comp = os.path.join(V, "comp.mp4")
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", silent] + ins + ["-filter_complex", ";".join(fc), "-map", f"[{last}]",
         "-r", str(FPS), "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-t", f"{total}", comp])
    # audio: vocea normalizzata, muzica più bassă sotto voce (sidechain), fade-out
    out = os.path.join(V, OUTNAME)
    vo_in = os.path.join(IN, "vo.mp3")
    if LANG == "en":
        starts = [0, 5.64, 10.32, 17.24, 21.92, 26.59, 31.58]; slot = [5.64, 4.68, 6.92, 4.68, 4.67, 4.99, 6.77]
        durs = [6.269, 4.911, 6.844, 4.441, 4.127, 5.068, 6.348]
        ins_a = []; fl = []
        for i in range(7):
            ins_a += ["-i", os.path.join(IN, "en", f"l{i}.mp3")]
            tempo = max(1.0, durs[i] / slot[i]) if durs[i] > slot[i] else 1.0
            fl.append(f"[{i}:a]atempo={tempo:.3f},adelay={int(starts[i]*1000)}|{int(starts[i]*1000)}[a{i}]")
        fl.append("".join(f"[a{i}]" for i in range(7)) + "amix=inputs=7:normalize=0[vm]")
        vo_in = os.path.join(V, "vo_en.wav")
        run(["ffmpeg", "-loglevel", "error", "-y"] + ins_a + ["-filter_complex", ";".join(fl), "-map", "[vm]", "-ac", "1", vo_in])
    af = (f"[1:a]loudnorm=I=-15:TP=-1.5:LRA=7,apad=pad_dur={total},asplit=2[vo][vsc];"
          f"[2:a]volume=0.85,atrim=0:{total},afade=t=in:d=0.5,afade=t=out:st={total-1.6:.2f}:d=1.6[mu];"
          f"[mu][vsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[duck];"
          f"[vo][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]")
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", comp, "-i", vo_in, "-i", os.path.join(IN, "music.mp3"),
         "-filter_complex", af, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100",
         "-movflags", "+faststart", "-t", f"{total}", out])
    print("gata", out, f"{total:.2f}s")

main()
