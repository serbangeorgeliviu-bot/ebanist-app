"""Ep. 7 — „6 clienți. 1 armadio.": 6 fulgere din episoade + fotografii reale de șantier (Ken Burns) + inserto aplicație + voce + end card.
python3 recap.py <out.mp4>   env: SK=<dir cu ep1..ep6.mp4>  PHOTOS=<dir cu .webp>  SCREEN=<screen.mp4>  ENDCARD=<png>  MUSIC=<wav>  VO=<mp3 sau gol>
"""
import os, subprocess, sys, tempfile, json
from PIL import Image
out = sys.argv[1]; T = tempfile.mkdtemp(); E = os.environ
SK, PH, SCREEN, END, MUSIC, VO = E["SK"], E["PHOTOS"], E["SCREEN"], E["ENDCARD"], E.get("MUSIC", ""), E.get("VO", "")
VOS = [x.rsplit(":", 1) for x in E.get("VOS", "").split(",") if x]   # voce pe bucăți: "fisier:secunde,fisier:secunde"
F = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p"
ENC = ["-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium"]
def run(*a): subprocess.check_call(["ffmpeg", "-loglevel", "error", "-y", *a])
def photo(name, d, n):
    im = Image.open(os.path.join(PH, name + ".webp")).convert("RGB"); p = f"{T}/{n}.jpg"; im.save(p, quality=92)
    run("-loop", "1", "-framerate", "30", "-t", str(d), "-i", p, "-vf", f"scale=1296:2304:force_original_aspect_ratio=increase,crop=1296:2304,zoompan=z='min(zoom+0.0012,1.12)':d=1:s=1080x1920:fps=30,format=yuv420p", *ENC, f"{T}/{n}.mp4")
scenes = []   # (archivo, durată, text, y)
FL, ss = 0.5, [1.0, 1.0, 1.0, 1.0, 0.7, 1.0]
for i in range(6):
    run("-ss", str(ss[i]), "-t", str(FL), "-i", f"{SK}/ep{i+1}.mp4", "-vf", F, *ENC, f"{T}/f{i}.mp4"); scenes.append((f"f{i}", FL))
plan = [("bagno-cutting-1600", 1.6), ("SCREEN", 1.8), ("bagno-carcass-1600", 1.6), ("bagno-assembled-1600", 1.6),
        ("bagno-finished-1600", 1.8), ("bagno-open-1600", 1.6), ("bagno-hatch-1600", 1.6)]
for k, (n, d) in enumerate(plan):
    if n == "SCREEN": run("-ss", "3.0", "-t", str(d), "-i", SCREEN, "-vf", F, *ENC, f"{T}/s{k}.mp4")
    else: photo(n, d, f"s{k}")
    scenes.append((f"s{k}", d))
run("-loop", "1", "-t", "2.8", "-i", END, "-vf", F, *ENC, f"{T}/end.mp4"); scenes.append(("end", 2.8))
open(f"{T}/l.txt", "w").write("".join(f"file '{T}/{n}.mp4'\n" for n, _ in scenes))
run("-f", "concat", "-safe", "0", "-i", f"{T}/l.txt", "-c", "copy", f"{T}/v.mp4")
total = sum(d for _, d in scenes)
# timp de început al fiecărei scene
t0 = []; c = 0
for _, d in scenes: t0.append(c); c += d
# subtitrări
Y, W = r"{\c&H00D6FF&}", r"{\c&HFFFFFF&}"
cap = [(0.0, 1.5, f"6 {Y}CLIENTI.{W}"), (1.5, 3.0, f"6 {Y}FRASI.{W}"), (t0[6], t0[7], "POI ARRIVA\\NIL CANTIERE."),
       (t0[7], t0[8], "MISURE. 3D.\\NPEZZI."), (t0[9], t0[10], "MONTAGGIO."), (t0[10], t0[11], f"ZERO {Y}«PIÙ O MENO»{W}."),
       (t0[12], t0[13], "(SÌ, C'ERA UN\\NCOLLETTORE)"), (t0[13] + 0.2, total, f"QUAL È LA TUA {Y}FRASE\\NDA INCUBO?{W}")]
fmt = lambda s: f"{int(s//3600)}:{int(s%3600//60):02d}:{s%60:05.2f}"
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: C,Inter Black,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,9,3,5,40,40,0,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
pop = r"\fscx70\fscy70\t(0,110,\fscx104\fscy104)\t(110,200,\fscx100\fscy100)"
ass = f"{T}/c.ass"
open(ass, "w").write(hdr + "".join(f"Dialogue: 0,{fmt(a)},{fmt(b)},C,,0,0,0,,{{\\pos(540,{1500 if i<2 else (1720 if i==len(cap)-1 else 1450)}){pop}}}{tx}\n" for i, (a, b, tx) in enumerate(cap)))
run("-i", f"{T}/v.mp4", "-vf", f"ass={ass}:fontsdir=/usr/share/fonts/opentype/inter", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-an", f"{T}/vc.mp4")
# audio: pop la fulgere, voce, muzică cu ducking
run("-f", "lavfi", "-i", "sine=f=1800:d=0.04", "-af", "afade=t=out:st=0.005:d=0.035,volume=0.5", f"{T}/click.wav")
run("-f", "lavfi", "-i", "anoisesrc=d=0.35:c=pink:a=0.5", "-af", "highpass=f=600,lowpass=f=5000,afade=t=in:d=0.12,afade=t=out:st=0.15:d=0.2,volume=1.2", f"{T}/sw.wav")
ins = ["-i", f"{T}/click.wav", "-i", f"{T}/sw.wav"]; fc = ""; mix = []; n = 2
for i in range(6): fc += f"[0]adelay={int(i*FL*1000)}|{int(i*FL*1000)}[k{i}];"; mix.append(f"[k{i}]")
ct = [t0[6], t0[7], t0[10], t0[13]]
fc = fc.replace("[0]", "[0]")
for j, t in enumerate(ct): fc += f"[1]adelay={int(max(t-0.1,0)*1000)}|{int(max(t-0.1,0)*1000)}[w{j}];"; mix.append(f"[w{j}]")
inp = ["-i", f"{T}/click.wav", "-i", f"{T}/sw.wav"]; idx = 2
# split ale input-urilor (un singur -i per fișier): refolosim cu asplit
fc = "[0]asplit=6[a0][a1][a2][a3][a4][a5];[1]asplit=4[b0][b1][b2][b3];"
mix = []
for i in range(6): fc += f"[a{i}]adelay={int(i*FL*1000)}|{int(i*FL*1000)}[k{i}];"; mix.append(f"[k{i}]")
for j, t in enumerate(ct): d = int(max(t - 0.1, 0) * 1000); fc += f"[b{j}]adelay={d}|{d}[w{j}];"; mix.append(f"[w{j}]")
have_vo = bool(VO or VOS)
if VOS:
    for p, _ in VOS: inp += ["-i", p]
    base = 2
    for j, (_, t) in enumerate(VOS): fc += f"[{base+j}]adelay={int(float(t)*1000)}|{int(float(t)*1000)}[v{j}];"
    fc += "".join(f"[v{j}]" for j in range(len(VOS))) + f"amix=inputs={len(VOS)}:normalize=0,volume=1.6,apad=whole_dur={total}[vo];[vo]asplit=2[vo1][vo2];"; mix.append("[vo1]"); nxt = base + len(VOS)
elif VO:
    inp += ["-i", VO]; fc += f"[2]adelay={int(t0[6]*1000)}|{int(t0[6]*1000)},apad=whole_dur={total}[vo];[vo]asplit=2[vo1][vo2];"; mix.append("[vo1]"); nxt = 3
else: nxt = 2
if MUSIC:
    inp += ["-i", MUSIC]
    fc += f"[{nxt}]atrim=0:{total},asetpts=PTS-STARTPTS,volume=0.4[m0];"
    fc += (f"[m0][vo2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=250[m];" if have_vo else "[m0]anull[m];"); mix.append("[m]")
fc += "".join(mix) + f"amix=inputs={len(mix)}:normalize=0,alimiter=limit=0.95,atrim=0:{total}[a]"
run(*inp, "-filter_complex", fc, "-map", "[a]", "-ar", "44100", f"{T}/a.wav")
run("-i", f"{T}/vc.mp4", "-i", f"{T}/a.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total), "-movflags", "+faststart", out)
print(out, total)
