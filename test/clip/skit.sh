#!/usr/bin/env bash
# Skit „Cliente": video (skit.py) + sunet (ambianța clipului + pop la baloane + thud opțional).
#   bash skit.sh <spec.json> <clip.mp4> <out.mp4> [thud_ms]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SPEC="$1"; CLIP="$2"; OUT="$3"; THUD="${4:-}"
TMP="$(mktemp -d)"
python3 "$HERE/skit.py" "$SPEC" "$CLIP" "$TMP/o.mp4" >/dev/null
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/o_v.mp4")
ffmpeg -loglevel error -y -i "$CLIP" -vn -af "volume=0.9" "$TMP/amb.wav"
ffmpeg -loglevel error -y -f lavfi -i "sine=f=1800:d=0.04" -af "afade=t=out:st=0.005:d=0.035,volume=0.5" "$TMP/click.wav"
ffmpeg -loglevel error -y -f lavfi -i "sine=f=140:d=0.35" -af "afade=t=out:st=0.02:d=0.33,volume=1.2" "$TMP/thud.wav"
MS=$(python3 -c "import json;print(' '.join(str(int(b['t0']*1000)) for b in json.load(open('$SPEC'))['bubbles']))")
IN="-i $TMP/o_v.mp4 -i $TMP/amb.wav"; FC="[1]apad=whole_dur=$TOTAL[amb];"; MIX="[amb]"; N=1; i=0
for m in $MS; do IN="$IN -i $TMP/click.wav"; FC="$FC[$((i+2))]adelay=$m|$m[k$i];"; MIX="$MIX[k$i]"; N=$((N+1)); i=$((i+1)); done
if [ -n "$THUD" ]; then IN="$IN -i $TMP/thud.wav"; FC="$FC[$((i+2))]adelay=$THUD|$THUD[th];"; MIX="$MIX[th]"; N=$((N+1)); fi
# shellcheck disable=SC2086
ffmpeg -loglevel error -y $IN -filter_complex "${FC}${MIX}amix=inputs=$N:normalize=0,alimiter=limit=0.95,atrim=0:$TOTAL[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -t "$TOTAL" "$OUT"
echo "gata: $OUT"
