"""Subtitrări ASS (pop-up, cuvinte-cheie colorate). python3 captions.py <out.ass>
Timpii = timeline-ul vocii din make-clip.sh (VO_START)."""
import sys
Y, W, R = r"{\c&H00D6FF&}", r"{\c&HFFFFFF&}", r"{\c&H303BFF&}"   # galben, alb, roșu (BGR)
cues = [  # start, end, text, y
 (0.00, 1.95, f"PERDERE {Y}TEMPO{W}\\NA CALCOLARE LE\\NMISURE A MANO?", 1450),
 (2.03, 3.20, f"{Y}EBANIST{W}: SCEGLI\\NIL MOBILE,", 1450),
 (3.20, 4.39, "METTI LE MISURE,", 1450),
 (4.39, 5.70, "IN POCHI SECONDI", 1450),
 (5.70, 7.55, "HAI IL 3D E LA\\NLISTA DI TAGLIO", 1450),
 (7.59, 9.00, "NIENTE ERRORI,\\NMENO SCARTI,", 1450),
 (9.00, 10.30, f"PIÙ {R}SOLDI{W} IN TASCA", 1450),
 (10.32, 12.68, f"SALVALO: SI CHIAMA\\N{Y}EBANIST{W}", 330),
 (12.68, 15.12, f"TU QUANTO {Y}TEMPO{W}\\NPERDI PER UNA\\NLISTA DI TAGLIO?", 330),
 (15.12, 16.77, "SCRIVILO QUI SOTTO", 330),
 (16.77, 18.05, "OPPURE VUOI\\NCONTINUARE A…", 1450),
]
t = lambda s: f"{int(s//3600)}:{int(s%3600//60):02d}:{s%60:05.2f}"
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: C,Inter Black,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,9,3,5,40,40,0,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
pop = r"\fscx70\fscy70\t(0,110,\fscx104\fscy104)\t(110,200,\fscx100\fscy100)"
open(sys.argv[1], "w").write(hdr + "".join(
    f"Dialogue: 0,{t(s)},{t(e)},C,,0,0,0,,{{\\pos(540,{y}){pop}}}{tx}\n" for s, e, tx, y in cues))
