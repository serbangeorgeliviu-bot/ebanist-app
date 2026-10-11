"""Generează g1..g6.mp3 din voice-script.txt cu o voce italiană nativă (Microsoft Neural, via edge-tts).
python3 gen-voice.py <out-dir> [voce] [rate]   ex.: python3 gen-voice.py work it-IT-GiuseppeMultilingualNeural +5%
Notă: edge-tts e o bibliotecă neoficială; pentru uz comercial: Azure Speech sau Google Cloud TTS (aceleași voci).
În mediile cu proxy TLS: CA_BUNDLE=/cale/ca-bundle.crt."""
import asyncio, os, ssl, sys
import edge_tts, edge_tts.communicate as C
out = sys.argv[1]; voice = sys.argv[2] if len(sys.argv) > 2 else "it-IT-GiuseppeMultilingualNeural"
rate = sys.argv[3] if len(sys.argv) > 3 else "+5%"
if os.environ.get("CA_BUNDLE"): C._SSL_CTX = ssl.create_default_context(cafile=os.environ["CA_BUNDLE"])
lines = [l.strip() for l in open(os.path.join(os.path.dirname(__file__), "voice-script.txt"), encoding="utf8")
         if l.strip() and not l.startswith("#")]
os.makedirs(out, exist_ok=True)
async def main():
    for i, t in enumerate(lines, 1):
        await edge_tts.Communicate(t, voice, rate=rate).save(os.path.join(out, f"g{i}.mp3"))
asyncio.run(main())
