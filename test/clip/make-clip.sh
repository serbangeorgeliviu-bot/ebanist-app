#!/usr/bin/env bash
# Montează clipul promo 1 (18 s, 1080x1920) din cadre AI + înregistrarea ecranului + voce + muzică.
#   WORK=<dir> bash make-clip.sh
# În $WORK trebuie să existe: S1.mp4 S2.mp4 S3.mp4 S4.mp4 (cadrele AI), g1.mp3..g6.mp3 (vocea, din
# voice-script.txt), music.wav, și <WORK>/screen/ — ieșirea lui `node ../clip-screen.js <WORK>/screen`.
# Cere: ffmpeg (cu libass), python3 + Pillow, fontul Inter. Vezi sources.md.
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
ffmpeg -loglevel error -y -loop 1 -i endcard.png -t 7 -vf "fps=30,format=yuv420p" -c:v libx264 -crf 18 endcard.mp4

# 3) video: (sursă, început, durată) pe timeline-ul vocii
mk(){ ffmpeg -loglevel error -y -ss "$2" -t "$3" -i "$1" -vf "$F" $E "$4"; }
mk S1.mp4 0 2.03 v1.mp4        # hook
mk screen.mp4 0.3 1.17 v2.mp4  # tipologie
mk screen.mp4 1.8 1.19 v3.mp4  # cote
mk S2.mp4 1.0 1.31 v4.mp4      # match-cut: tăiere
mk screen.mp4 5.0 1.0 v5.mp4   # 3D
mk screen.mp4 7.9 0.89 v6.mp4  # lista de debitare
mk S3.mp4 0.5 1.41 v7.mp4
mk s4rev.mp4 0 1.32 v8.mp4
mk endcard.mp4 0 6.45 v9.mp4
mk S1.mp4 2.0 1.28 v10.mp4     # se leagă de hook (loop)
for i in 1 2 3 4 5 6 7 8 9 10; do echo "file 'v$i.mp4'"; done > vlist.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i vlist.txt -c copy vid_nocap.mp4

# 4) voce: taie tăcerile de la capete
for i in 1 2 3 4 5 6; do
  ffmpeg -loglevel error -y -i g$i.mp3 -af "silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.02,areverse,aresample=44100" -ac 1 t$i.wav
done
# sunete sintetice
ffmpeg -loglevel error -y -f lavfi -i "anoisesrc=d=0.35:c=pink:a=0.5" -af "highpass=f=600,lowpass=f=5000,afade=t=in:d=0.12,afade=t=out:st=0.15:d=0.2,volume=1.4" swoosh.wav
ffmpeg -loglevel error -y -f lavfi -i "sine=f=1800:d=0.04" -af "afade=t=out:st=0.005:d=0.035,volume=0.5" click.wav

# 5) mix: voce la VO_START, swoosh la tăieturi, click pe ecranele aplicației, muzică cu ducking
ffmpeg -loglevel error -y -i t1.wav -i t2.wav -i t3.wav -i t4.wav -i t5.wav -i t6.wav -i music.wav -i swoosh.wav -i click.wav \
 -filter_complex "
[0]adelay=0|0[a1];[1]adelay=2030|2030[a2];[2]adelay=4470|4470[a3];[3]adelay=7590|7590[a4];[4]adelay=10320|10320[a5];[5]adelay=16770|16770[a6];
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,volume=1.6,asplit=2[vo][vosc];
[7]asplit=5[w1][w2][w3][w4][w5];
[w1]adelay=1900|1900[s1];[w2]adelay=4250|4250[s2];[w3]adelay=7450|7450[s3];[w4]adelay=10200|10200[s4];[w5]adelay=16650|16650[s5];
[8]asplit=4[c1][c2][c3][c4];
[c1]adelay=3200|3200[k1];[c2]adelay=5700|5700[k2];[c3]adelay=6700|6700[k3];[c4]adelay=9000|9000[k4];
[s1][s2][s3][s4][s5][k1][k2][k3][k4]amix=inputs=9:normalize=0,volume=0.9[fx];
[6]atrim=0:19,asetpts=PTS-STARTPTS,volume=0.55[m0];
[m0][vosc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=250[m];
[vo][m][fx]amix=inputs=3:normalize=0,alimiter=limit=0.95,atrim=0:18.05[out]" -map "[out]" -ar 44100 mix.wav

# 6) subtitrări + export
python3 "$HERE/captions.py" cap.ass
ffmpeg -loglevel error -y -i vid_nocap.mp4 -i mix.wav -vf "ass=cap.ass:fontsdir=/usr/share/fonts/opentype/inter" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -c:a aac -b:a 192k -t 18.05 -movflags +faststart clip1.mp4
echo "gata: $W/clip1.mp4"
