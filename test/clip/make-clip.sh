#!/usr/bin/env bash
# Montează clipul promo 1 (18 s, 1080x1920) din cadre AI + înregistrarea ecranului + voce + muzică.
#   WORK=<dir> bash make-clip.sh
# În $WORK trebuie să existe: S1.mp4 S2.mp4 S3.mp4 S4.mp4 (cadrele AI), g1.mp3..g6.mp3 (vocea, din
# voice-script.txt), music.wav, și <WORK>/screen/ — ieșirea lui `node ../clip-screen.js <WORK>/screen`.
# VO_TEMPO accelerează vocea (implicit 1.0; Giuseppe nu are nevoie). Cere: ffmpeg (cu libass), python3 + Pillow, fontul Inter. Vezi sources.md.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; W="${WORK:?setează WORK=<dir>}"; cd "$W"
ICON="${ICON:-$HERE/../../app/icons/icon-192.png}"
F="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1"
E="-an -c:v libx264 -pix_fmt yuv420p -crf 17 -preset medium"

# 1) înregistrarea ecranului: secvența de capturi -> 1080x1920 -> accelerată 4,5x
ffmpeg -loglevel error -y -f concat -safe 0 -i screen/list.txt -vf "fps=30,scale=1080:1920" -c:v libx264 -pix_fmt yuv420p -crf 18 screen_raw.mp4
ffmpeg -loglevel error -y -i screen_raw.mp4 -vf "setpts=PTS/4.5,fps=30" $E screen.mp4
ffmpeg -loglevel error -y -sseof -0.1 -i screen.mp4 -frames:v 1 endbg.png
ffmpeg -loglevel error -y -i S4.mp4 -vf "reverse,$F" $E s4rev.mp4          # sertarul se închide

# 2) end card
python3 "$HERE/endcard.py" endbg.png "$ICON" endcard.png
ffmpeg -loglevel error -y -loop 1 -i endcard.png -t 10 -vf "fps=30,format=yuv420p" -c:v libx264 -crf 18 endcard.mp4

# 3) voce: taie tăcerile de la capete, apoi timeline-ul din durate
for i in 1 2 3 4 5 6; do
  ffmpeg -loglevel error -y -i g$i.mp3 -af "silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.02,areverse,aresample=44100,atempo=${VO_TEMPO:-1.0}" -ac 1 t$i.wav
done
python3 "$HERE/timeline.py" $(for i in 1 2 3 4 5 6; do ffprobe -v error -show_entries format=duration -of csv=p=0 t$i.wav; done) > timeline.json
TL(){ python3 -c "import json;j=json.load(open('timeline.json'));print($1)"; }
END=$(TL "j['end']")

# 4) video: (sursă, început în sursă, durată) pe segmentele timeline-ului
mk(){ ffmpeg -loglevel error -y -ss "$2" -t "$3" -i "$1" -vf "$F" $E "$4"; }
SRC=(S1.mp4 screen.mp4 screen.mp4 S2.mp4 screen.mp4 screen.mp4 S3.mp4 s4rev.mp4 endcard.mp4 S1.mp4)
SS=(0 0.3 1.8 1.0 5.0 7.9 0.5 0 0 2.0)
for i in 0 1 2 3 4 5 6 7 8 9; do
  mk ${SRC[$i]} ${SS[$i]} $(TL "round(j['seg'][$i][1]-j['seg'][$i][0],3)") v$((i+1)).mp4
done
for i in 1 2 3 4 5 6 7 8 9 10; do echo "file 'v$i.mp4'"; done > vlist.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i vlist.txt -c copy vid_nocap.mp4

# sunete sintetice
ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=d=0.35:c=pink:a=0.5" -af "highpass=f=600,lowpass=f=5000,afade=t=in:d=0.12,afade=t=out:st=0.15:d=0.2,volume=1.4" swoosh.wav
ffmpeg -loglevel error -y -f lavfi -i "sine=f=1800:d=0.04" -af "afade=t=out:st=0.005:d=0.035,volume=0.5" click.wav

# 5) mix: voce la început, swoosh la tăieturi, click pe ecranele aplicației, muzică cu ducking
ST=($(TL "' '.join(str(int(x*1000)) for x in j['start'])"))
SW=($(TL "' '.join(str(int(x*1000)) for x in j['swoosh'])"))
CK=($(TL "' '.join(str(int(x*1000)) for x in j['click'])"))
ffmpeg -loglevel error -y -i t1.wav -i t2.wav -i t3.wav -i t4.wav -i t5.wav -i t6.wav -i music.wav -i swoosh.wav -i click.wav \
 -filter_complex "
[0]adelay=${ST[0]}|${ST[0]}[a1];[1]adelay=${ST[1]}|${ST[1]}[a2];[2]adelay=${ST[2]}|${ST[2]}[a3];[3]adelay=${ST[3]}|${ST[3]}[a4];[4]adelay=${ST[4]}|${ST[4]}[a5];[5]adelay=${ST[5]}|${ST[5]}[a6];
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,volume=1.6,asplit=2[vo][vosc];
[7]asplit=5[w1][w2][w3][w4][w5];
[w1]adelay=${SW[0]}|${SW[0]}[s1];[w2]adelay=${SW[1]}|${SW[1]}[s2];[w3]adelay=${SW[2]}|${SW[2]}[s3];[w4]adelay=${SW[3]}|${SW[3]}[s4];[w5]adelay=${SW[4]}|${SW[4]}[s5];
[8]asplit=4[c1][c2][c3][c4];
[c1]adelay=${CK[0]}|${CK[0]}[k1];[c2]adelay=${CK[1]}|${CK[1]}[k2];[c3]adelay=${CK[2]}|${CK[2]}[k3];[c4]adelay=${CK[3]}|${CK[3]}[k4];
[s1][s2][s3][s4][s5][k1][k2][k3][k4]amix=inputs=9:normalize=0,volume=0.9[fx];
[6]atrim=0:$(python3 -c "print($END+1)"),asetpts=PTS-STARTPTS,volume=0.55[m0];
[m0][vosc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=250[m];
[vo][m][fx]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:$END[out]" -map "[out]" -ar 44100 mix.wav

# 6) subtitrări + export
python3 "$HERE/captions.py" cap.ass timeline.json
ffmpeg -loglevel error -y -i vid_nocap.mp4 -i mix.wav -vf "ass=cap.ass:fontsdir=/usr/share/fonts/opentype/inter" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -c:a aac -b:a 192k -t $END -movflags +faststart clip1.mp4
echo "gata: $W/clip1.mp4"
