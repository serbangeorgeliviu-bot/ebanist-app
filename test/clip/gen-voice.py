"""Generează g1..g6.mp3 din texts.py (LANG_CLIP=it|en|fr|ro) cu o voce italiană nativă (Microsoft Neural, via edge-tts).
LANG_CLIP=en python3 gen-voice.py <out-dir> [voce] [rate]
Notă: edge-tts e o bibliotecă neoficială; pentru uz comercial: Azure Speech sau Google Cloud TTS (aceleași voci).
În mediile cu proxy TLS: CA_BUNDLE=/cale/ca-bundle.crt."""
import asyncio, os, ssl, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from texts import T
import edge_tts, edge_tts.communicate as C
out = sys.argv[1]; voice = sys.argv[2] if len(sys.argv) > 2 else T["voice"]
rate = sys.argv[3] if len(sys.argv) > 3 else T["rate"]
if os.environ.get("CA_BUNDLE"): C._SSL_CTX = ssl.create_default_context(cafile=os.environ["CA_BUNDLE"])
lines = T["vo"]
os.makedirs(out, exist_ok=True)
async def main():
    for i, t in enumerate(lines, 1):
        await edge_tts.Communicate(t, voice, rate=rate).save(os.path.join(out, f"g{i}.mp3"))
asyncio.run(main())
