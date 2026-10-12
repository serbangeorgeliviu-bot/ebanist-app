"""Voce italiană locală (Kokoro-ONNX, Apache 2.0), fără cont sau cheie.
pip install kokoro-onnx soundfile espeakng-loader
model: kokoro-v1.0.int8.onnx + voices-v1.0.bin din https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
python3 gen-voice-kokoro.py <dir-model> <out.mp3> "<text>" [voce=im_nicola] [speed=1.05]
Voci italiene: im_nicola (bărbat), if_sara (femeie). Taie apoi tăcerile cu ffmpeg silenceremove (vezi make-clip.sh)."""
import subprocess, sys, os, tempfile
import soundfile as sf
from kokoro_onnx import Kokoro
d, out, text = sys.argv[1:4]
voice = sys.argv[4] if len(sys.argv) > 4 else "im_nicola"; speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.05
k = Kokoro(os.path.join(d, "kokoro-v1.0.int8.onnx"), os.path.join(d, "voices-v1.0.bin"))
s, sr = k.create(text, voice=voice, speed=speed, lang="it")
w = os.path.join(tempfile.mkdtemp(), "v.wav"); sf.write(w, s, sr)
subprocess.check_call(["ffmpeg", "-loglevel", "error", "-y", "-i", w, "-ac", "1", "-b:a", "160k", out])
