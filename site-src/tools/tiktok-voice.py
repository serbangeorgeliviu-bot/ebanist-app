"""Vocea filmului TikTok: Piper (TTS local, voce italiană Paola) → voice.wav.
Intrare: JSON [{start, avail, text}] (secunde); fiecare replică se încadrează în `avail`
(se accelerează până la 0,82, apoi se avertizează). Rulare: v/bin/python tiktok-voice.py cues.json out.wav total_sec voice.onnx"""
import sys, json, wave, io
import numpy as np
from piper import PiperVoice
try:
    from piper import SynthesisConfig
except Exception:
    SynthesisConfig = None
cues = json.load(open(sys.argv[1])); out = sys.argv[2]; total = float(sys.argv[3]); v = PiperVoice.load(sys.argv[4])
sr = v.config.sample_rate
def synth(text, scale):
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        if SynthesisConfig: v.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=scale))
        else: v.synthesize_wav(text, w)
    b.seek(0)
    with wave.open(b, "rb") as r:
        return np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float32) / 32768
track = np.zeros(int((total + 1) * sr), dtype=np.float32)
for c in cues:
    scale = 1.0; a = synth(c["text"], scale); d = len(a) / sr
    if d > c["avail"] and SynthesisConfig:
        scale = max(0.82, c["avail"] / d * 0.96); a = synth(c["text"], scale); d = len(a) / sr
    if d > c["avail"] + 0.05: print("AVERT replica prea lunga:", c["text"], round(d, 2), ">", c["avail"], file=sys.stderr)
    s = int(c["start"] * sr); e = min(len(track), s + len(a)); track[s:e] += a[:e - s]
    print(round(c["start"], 2), round(d, 2), round(scale, 2), c["text"])
track = np.clip(track * 0.95, -1, 1)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((track * 32767).astype(np.int16).tobytes())
