# Ebanist — aplicația Android (WebView)

Pachet `com.domusrenov.ebanist`, Android 7+ (minSdk 24). Din versionCode 2 (1.1.0) înlocuiește TWA-ul
PWABuilder (versionCode 1): testarea plătită nu primește TWA, iar Google nu
numără bine activitatea testerilor într-un TWA.

Aplicația încarcă `https://whimsical-wisp-61cbbf.netlify.app/app/`. Codul
aplicației rămâne pe site — o versiune web nouă ajunge pe telefon fără `.aab` nou.
Un `.aab` nou trebuie doar când se schimbă ceva de aici (iconiță, permisiuni,
adresă, cerințe Google) — și atunci `versionCode` crește.

Ce face în plus față de un WebView gol:
- `window.print()` → tipărire / „Salvează ca PDF” (PrintManager, A4);
- descărcările `blob:` / `data:` → `Descărcări/Ebanist/` (MediaStore);
- `<input type=file>` → selectorul de fișiere; camera pentru «În camera ta»;
- Înapoi: închide foaia deschisă → istoric → la a doua apăsare iese;
- Android 7–9: exporturile cer permisiunea de scriere la primul export;
- ecran „Fără conexiune” cu Reîncearcă; margini pentru barele de sistem (Android 15+).

## Build

```
echo "sdk.dir=/cale/android-sdk" > local.properties
# keystore.properties (NU se pune în git):
#   storeFile=/cale/signing.keystore
#   storePassword=…   keyAlias=my-key-alias   keyPassword=…
gradle bundleRelease     # → app/build/outputs/bundle/release/app-release.aab
```

Cheia e cea de upload din PWABuilder (SHA-256 `30:25:FE:…:BF:1E`); Google
resemnează cu cheia Play (`63:8A:5E:…:C9:59`). Ambele sunt în
`/.well-known/assetlinks.json` — pentru linkurile care deschid aplicația.
