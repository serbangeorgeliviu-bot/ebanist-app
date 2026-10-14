# tools/clip — clip de marketing din Ebanist (fără AI, fără abonament)

Randează un corp din Ebanist cadru cu cadru în Chromium headless, prin `GL3D.capture()` (aceleași cote și aceleași găuri ca în aplicație), apoi `ffmpeg` pune textul și produce un MP4 vertical 1080×1920. **Nu scrie nimic în `app/` și nu atinge motorul.**

```
node tools/clip/clip.cjs --in <proiect.ebanist.json> --lang ro --secs 20 --out out/clip.mp4
```

| Opțiune | Implicit | Ce face |
|---|---|---|
| `--in` | — | proiect exportat (`.ebanist.json`), backup, sau `{cfg, settings}` ca în `test/golden/<nume>/input.json` |
| `--module` | primul corp | numele corpului din `configs` |
| `--project` | primul | numele proiectului dintr-un backup cu mai multe |
| `--lang` | `ro` | `ro`, `fr`, `it`, `en` (hook, subtitrări, CTA) |
| `--hook "text"` | text implicit pe limbă | textul primelor secunde |
| `--secs` / `--fps` | 20 / 24 | durata și cadrele pe secundă |
| `--size` | `1080x1920` | dimensiunea cadrului |
| `--keep-frames` | nu | păstrează JPEG-urile din `/tmp/ebclip-*` |

**Cronologia** (`scene(t)` din `clip.cjs`, funcție pură de `t`, deci același input dă aceleași cadre): corp închis și rotit → vedere explodată → apropiere cu găurile → corp închis cu ușile deschise → CTA.

**Cerințe:** Node 18+, `playwright` (global sau în `test/node_modules`), Chromium, `ffmpeg` cu `drawtext`. Durează ~7 min pentru 20 s cu WebGL software (SwiftShader).

**Limite cunoscute (v1)**
- Găurile apar mici pe cadrul întreg; o secvență cu piesa izolată (`GL3D.select(pk, true)`) e de făcut.
- Cotele `HW_DRILL` sunt `verificat:false` (D-48): clipul nu spune „gata pentru CNC”.
- Un proiect de client real nu se pune în repo și nu se publică cu numele clientului. Folderul `out/` e ignorat de git.
