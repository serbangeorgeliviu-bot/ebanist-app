"""Sunet „satisfying” pentru cinema-clip.cjs (CLIP=sat): fundal grav + „toc-uri” de lemn în timpul montajelor.
Folosire: python3 sat-sound.py out.wav '[[t0,durată],…]' total_sec. Fără numpy în afara celui standard; sunet generat, nu eșantion."""
import sys, json, wave
import numpy as np
out, wins, total = sys.argv[1], json.loads(sys.argv[2]), float(sys.argv[3])
sr = 44100; n = int(total * sr); t = np.arange(n) / sr
rng = np.random.default_rng(7)
y = 0.05 * np.sin(2 * np.pi * 55 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * .1 * t)) + 0.03 * np.sin(2 * np.pi * 82.4 * t)
def thock(at, f, g):
    i = int(at * sr); L = int(.14 * sr)
    if i + L >= n: return
    k = np.arange(L) / sr; env = np.exp(-k * 38)
    body = np.sin(2 * np.pi * f * k) * env
    tick = rng.standard_normal(L) * np.exp(-k * 220) * .5
    y[i:i + L] += g * (body + tick)
for (t0, d) in wins:
    at = t0 + .12
    while at < t0 + d:
        thock(at, rng.uniform(150, 260), rng.uniform(.28, .5)); at += rng.uniform(.07, .23)
    thock(t0 + d + .05, 110, .7)   # ultima piesă se așază
y *= np.minimum(1, t / 0.6) * np.minimum(1, (total - t) / 0.8)
y = np.tanh(y * 1.4); y = y / max(1e-6, np.abs(y).max()) * .85
w = wave.open(out, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((y * 32767).astype(np.int16).tobytes()); w.close()
