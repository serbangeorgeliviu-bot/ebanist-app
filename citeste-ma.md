# Ebanist — instalare pe telefon

Acest pachet conține site-ul complet: pagina de prezentare în rădăcină și
aplicația în `app/`, gata de instalare ca PWA (Progressive Web App).

```
/                       pagina de prezentare (4 limbi) + termeni, confidențialitate, rambursare
/site.js                textele paginii de prezentare, în 4 limbi
/sw.js                  service worker de demontare — îl dezinstalează pe cel vechi, de pe scope „/”
/app/index.html         APLICAȚIA: doar marcajul — nicio linie de cod, niciun stil
/app/js/                corpul aplicației, 22 de fișiere, în ordinea din index.html
/app/styles/            foile de stil, în ordinea cascadei: tokens → shell → views → print
/app/data/              catalogul de materiale (date, nu cod)
/app/ebanist-core.js    nucleul geometric — deriveCarcass(), singurul loc cu cotele derivate
/app/config/billing.js  DE COMPLETAT: valorile Lemon Squeezy (vezi MONETIZARE.md)
/app/tools/genkey.py    generatorul de chei permanente EBP-XXXX-XXXX-XXXX
/order-rail/            Order Rail: prețuri, inbox-ul atelierului, pagina unei comenzi
```

**Din v4.29.0, `app/index.html` nu mai conține cod.** Era un singur fișier de
10.250 de rânduri, cu 8.350 de rânduri de JavaScript și 609 de CSS înăuntru.
Acum e doar marcaj; codul stă în `app/js/`, stilurile în `app/styles/`, și
ordinea de încărcare e scrisă negru pe alb la sfârșitul lui `index.html`.
Fișierele rămân **scripturi clasice**, nu module: se văd între ele exact ca
înainte, și aplicația pornește la fel și pe telefoanele vechi din atelier.
Nu există pas de build — se publică folderul așa cum e.

**Aplicația s-a mutat de la `/` la `/app/` în v4.25.0.** Aceeași origine,
deci nimeni nu-și pierde proiectele. `/sw.js` din rădăcină trebuie să rămână
servit de acolo, fără redirect — e singurul mod de a-l înlocui pe cel vechi.
Detaliile, în MONETIZARE.md §5.

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

1. Trimite-ți **tot folderul** (arhivat) pe telefon sau pe un stick și
   dezarhivează-l. Un singur `index.html` nu ajunge: aplicația încarcă
   nucleul geometric, catalogul de materiale și cele 22 de fișiere din
   `app/js/` — trebuie să stea lângă el, cu aceeași structură de foldere.
2. Deschide `app/index.html` cu **Chrome** → meniul ⋮ →
   **„Adaugă la ecranul de pornire"**.
3. Primești o scurtătură cu care intri direct în aplicație. Datele se
   salvează. (Diferența față de A: fără mod fullscreen și fără update
   automat — e varianta rapidă de lucru.)

---

## Teste (opțional, doar pe PC)

```
cd test && npm install
npm test              # 232 de teste în Chromium: aplicația, monetizarea, landing-ul
npm run test:geom     # 49 — motorul geometric, criteriul de acceptare (D-37)
npm run test:license  # 22 — cheile permanente și decizia „sunt Pro?”
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

1. `app/sw.js` → `const CACHE = "ebanist-v61"` — incrementează numărul.
2. `app/index.html` → `<meta name="app-version" content="4.29.0">` **și**
   `<meta name="sw-cache" content="ebanist-v61">` (aceeași valoare ca în
   `app/sw.js`).

Cele două numere stau în `<meta>`, nu în cod: de acolo le citește `version.js`
la pornire, și tot de acolo le recitește „Verifică actualizări" din documentul
descărcat de pe server.

Dacă adaugi un fișier nou pe care aplicația îl încarcă la pornire, pune-l în
`app/index.html` **și** în lista `SHELL` din `app/sw.js` — altfel nu există
offline, în atelier. `cd test && npm run check` compară cele două liste și
cade dacă nu se potrivesc; durează două secunde și nu cere nicio dependență.

Dacă cele două nume de cache nu coincid, „Verifică actualizări" scrie pagina
nouă într-un cache pe care service worker-ul îl șterge imediat ce pornește:
pare că a mers, iar la următoarea repornire revine versiunea veche. Testul de
regresie verifică asta la fiecare rulare.

---

Domus Renov · Ebanist v4.29.0
