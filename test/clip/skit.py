"""Skit „Cliente": un clip AI cu personajul + baloane de text (clientul = alb, meșterul = galben) + coadă înghețată.
python3 skit.py <spec.json> <clip.mp4> <out.mp4>
spec: {"hold":2.5, "bubbles":[{"t0":0,"t1":2,"who":"c|m","text":"..."}], "tag":"Ebanist"}"""
import json, subprocess, sys, tempfile, os
spec = json.load(open(sys.argv[1])); clip, out = sys.argv[2], sys.argv[3]
dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",clip]).decode())
total = dur + spec.get("hold", 2.0)
t = lambda s: f"{int(s//3600)}:{int(s%3600//60):02d}:{s%60:05.2f}"
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: C,Inter ExtraBold,58,&H00202020,&H00202020,&H00FFFFFF,&H00FFFFFF,0,0,0,0,100,100,0,0,3,26,0,7,90,150,0,1
Style: M,Inter ExtraBold,58,&H00202020,&H00202020,&H0000D6FF,&H0000D6FF,0,0,0,0,100,100,0,0,3,26,0,3,150,90,0,1
Style: T,Inter ExtraBold,56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,5,2,1,60,0,70,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
pop = r"\fscx80\fscy80\t(0,120,\fscx104\fscy104)\t(120,200,\fscx100\fscy100)"
ev = ""
for b in spec["bubbles"]:
    st = "C" if b["who"] == "c" else "M"
    y = 210 if st == "C" else 1640
    ev += f"Dialogue: 0,{t(b['t0'])},{t(b['t1'])},{st},,0,0,0,,{{\\pos({90 if st=='C' else 990},{y}){pop}}}{b['text']}\n"
if spec.get("tag"):
    ev += f"Dialogue: 0,{t(total-1.4)},{t(total)},T,,0,0,0,,{{\\fad(250,0)}}{spec['tag']}\n"
ass = os.path.join(tempfile.mkdtemp(), "skit.ass"); open(ass, "w").write(hdr + ev)
hold = spec.get("hold", 2.0)
fc = (f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,split[a][b];"
      f"[b]trim=start={dur-0.04:.3f},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={hold},"
      f"zoompan=z='min(zoom+0.0009,1.10)':d=1:s=1080x1920:fps=30[tail];"
      f"[a][tail]concat=n=2:v=1:a=0[v];[v]ass={ass}:fontsdir=/usr/share/fonts/opentype/inter[o]")
subprocess.check_call(["ffmpeg","-loglevel","error","-y","-i",clip,"-filter_complex",fc,"-map","[o]","-t",f"{total:.2f}",
    "-c:v","libx264","-pix_fmt","yuv420p","-crf","18","-preset","medium","-an",out.replace(".mp4","_v.mp4")])
print(out.replace(".mp4","_v.mp4"), total)
