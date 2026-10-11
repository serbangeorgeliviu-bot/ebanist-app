"""Subtitrări ASS (pop-up, cuvinte-cheie colorate). python3 captions.py <out.ass> <timeline.json>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texts import T
Ys = [1450,1450,1450,1450,1450,1450,1450,330,330,330,1450]   # poziția verticală pe cue
import json
cues = [(a, b, T["cap"][i], Ys[i]) for a, b, i in json.load(open(sys.argv[2]))["cues"]]
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
