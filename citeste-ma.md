# Ebanist — instalare pe telefon

Acest pachet conține aplicația completă, gata de instalare ca PWA
(Progressive Web App) și gata de transformat în APK pentru Google Play.

Fișiere: index.html (aplicația), manifest.webmanifest, sw.js (offline),
icon-192.png, icon-512.png, icon-maskable-512.png.

---

## Varianta A — instalare corectă ca aplicație (10 minute, gratuit)

1. Intră pe **app.netlify.com/drop** (sau tiiny.host / GitHub Pages).
   Pe Netlify: cont gratuit, apoi tragi acest folder dezarhivat în pagină.
2. Primești un link de tip `https://numele-tau.netlify.app`.
3. Deschide linkul pe telefon în **Chrome** → apare automat bannerul
   **„Instalează aplicația"** (sau meniul ⋮ → *Instalează aplicația*).
4. Gata: iconiță pe ecran, pornește fullscreen fără browser,
   **funcționează offline** în atelier, datele se salvează pe telefon.

## Varianta B — APK / Google Play (după varianta A)

1. Intră pe **pwabuilder.com** și lipește linkul de la pasul A.
2. Alege **Android** → *Generate package* → primești un **.aab**
   (pentru Play Console) și un **.apk de test** (instalabil direct).
3. Pentru magazin: cont **Google Play Console** (taxă unică 25 $),
   încarci .aab-ul + capturi de ecran + descriere. Restul e completare
   de formulare.

## Varianta C — imediat, fără hosting (2 minute)

1. Trimite-ți fișierul **index.html** pe telefon (WhatsApp/email/drive).
2. Deschide-l cu **Chrome** → meniul ⋮ → **„Adaugă la ecranul de pornire"**.
3. Primești o scurtătură cu care intri direct în aplicație. Datele se
   salvează. (Diferența față de A: fără mod fullscreen și fără update
   automat — e varianta rapidă de lucru.)

---

## Teste (opțional, doar pe PC)

```
cd test && npm install && npm test
```

Pornește un server local, deschide aplicația în Chromium la dimensiune de
telefon și verifică lucrurile care se strică în tăcere: tasta Înapoi pe
Android, calculele de cost și bordare, și că toate vizualizările se desenează
fără erori JS. Playwright stă în `test/package.json`, separat — cel din
rădăcină servește funcției Netlify și nu trebuie să-l atingă.

---

## La fiecare reîncărcare a aplicației

Dacă modifici aplicația și o reurci, **două** valori trebuie schimbate
împreună, altfel telefoanele rămân pe versiunea veche:

1. `sw.js` → `const CACHE = "ebanist-v53"` — incrementează numărul.
2. `index.html` → `const APP_VER="4.22.0"` **și** `const SW_CACHE="ebanist-v53"`
   (aceeași valoare ca în `sw.js`).

Dacă cele două nume de cache nu coincid, „Verifică actualizări" scrie pagina
nouă într-un cache pe care service worker-ul îl șterge imediat ce pornește:
pare că a mers, iar la următoarea repornire revine versiunea veche. Testul de
regresie verifică asta la fiecare rulare.

---

Domus Renov · Ebanist v4.22.0
