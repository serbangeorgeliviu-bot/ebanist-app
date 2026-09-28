# Site-ul de prezentare Ebanist

`ebanist.com/` (EN), `/ro/`, `/it/`, `/fr/`. Aplicația rămâne la `/app/`, pe
**aceeași origine**. `localStorage` (cheia `tagliapro`), IndexedDB și
proiectele utilizatorilor nu se mută nicăieri.

## Cum e construit

HTML static, generat de un script Node fără dependențe. **Netlify nu rulează
niciun build.** Fișierele generate se comit, iar site-ul se publică exact ca
aplicația (`publish = "."`). Așa, publicarea aplicației și a TWA-ului Android nu
se schimbă cu nimic.

```
site-src/
├── template.html        pagina, cu {{cheie}} pentru texte și {{@bloc}} pentru părțile calculate
├── i18n/en.json …       TOATE textele, câte un fișier pe limbă (nimic scris în șablon)
├── site.config.json     APP_URL, limbi, e-mail, TikTok, GoatCounter
├── data/wardrobe-pieces.json   distinta reală a dulapului W1000, scoasă din aplicație
├── build.mjs            generatorul → /index.html, /ro/, /it/, /fr/, /sitemap.xml
└── tools/
    ├── capture.cjs      capturi și PDF-uri reale din aplicație (Playwright)
    ├── pdf2img.py       PDF/PNG → AVIF + WebP
    ├── og.cjs           imaginile OG per limbă
    └── fonts.py         fonturile subsetate (un fișier pe stil)
site/
├── css/site.css         design tokens (paleta aplicației) + toate secțiunile (inline la build)
├── js/main.js           scriptul inițial (~6 KB gzip): reveal, poveste, lightbox, cursor, limbă
├── js/scene3d.js        Three.js: intro, hero, povestea — DOAR pe desktop, încărcat lazy
├── js/intro2d.js        intro-ul pe telefon (Canvas 2D, fără Three.js)
├── js/count.js          GoatCounter, găzduit aici
├── vendor/              three.module.min.js, gsap, ScrollTrigger, lenis — locale, lazy
├── img/  docs/<lang>/  screens/<lang>/  og/
```

## Limba (D-60)

`ebanist.com/` trimite la `/ro/`, `/it/` sau `/fr/` după limba browserului
(`netlify.toml`, 302, condiția `Language`). Alegerea de mână câștigă: linkurile
de limbă pun cookie-ul `nf_lang`, pe care Netlify îl citește în locul
`Accept-Language`. Pe telefon (sub 560 px) limba se schimbă din butonul `RO ▾`
din antet (`langPick()` în `build.mjs`); sub 470 px din antet pleacă cuvântul
EBANIST, rămâne logo-ul.

## Comenzi

```bash
node site-src/build.mjs                    # regenerează cele 4 pagini + sitemap
cd test && npm test                        # suita completă; verifică și că paginile comise sunt la zi
python3 -m http.server 8000                # apoi http://localhost:8000/ și /ro/
```

**După orice modificare în `site-src/` sau în `site/css/site.css`, rulează
`node site-src/build.mjs` și comite rezultatul.** CSS-ul intră inline în
pagină, deci și el cere build. Testul „le pagine comitate sono aggiornate”
cade dacă ai uitat.

## Schimb un text

Îl editezi în `site-src/i18n/<lang>.json` (în toate cele 4 limbi), apoi faci
build. Cheile lipsă opresc build-ul cu un mesaj.

## Schimb prețul

Prețul **nu** e în site. Are o singură sursă: `app/config/billing.js`
(`PRICE_MONTHLY`, `PRICE_YEARLY`, linkurile Lemon Squeezy), același fișier pe
care îl citește aplicația. Build-ul îl scrie în pagină, iar `main.js` îl
recitește la încărcare. Butonul Pro duce la checkout-ul Lemon Squeezy de îndată
ce `BILLING.configured` e `true`. Până atunci duce în aplicație, la activare.

Ce e gratuit și ce e Pro urmează **D-55** (1 proiect gratuit; toate
documentele sunt Pro).

## Capturile și documentele (toate reale)

Nimic nu e desenat de mână. Toate imaginile de produs ies din aplicația din
acest repo, pe un proiect curat: „Wardrobe W1000”, 1000 × 2200 × 600, PAL
19 mm, fronturi Nogal Victoria, 30 de piese.

```bash
python3 -m http.server 8765 &
NODE_PATH=test/node_modules node site-src/tools/capture.cjs     # en ro it fr
python3 site-src/tools/pdf2img.py                               # pip install pymupdf pillow
node site-src/build.mjs
```

| Fișier | Dimensiune | Starea aplicației |
|---|---|---|
| `site/screens/<l>/phone-build-780` | 390×844 @2x | Generator, ușile deschise în 3D |
| `site/screens/<l>/phone-list-780` | 390×844 @2x | Lista de debitare |
| `site/screens/<l>/phone-nest-780` | 390×844 @2x | Debitare, plan pe panou |
| `site/screens/<l>/phone-summary-780` | 390×844 @2x | Rezumat (materiale, cost) |
| `site/screens/<l>/phone-survey-780` | 390×844 @2x | Releveu |
| `site/screens/<l>/tablet-client-1600` | 1180×820 @2x | Modul Client |
| `site/screens/<l>/pc-explode-1600` | 1440×900 @2x | Generator PC, vedere explodată |
| `site/docs/<l>/distinta-0` | A4 | PDF distinta (după foaia de închidere) |
| `site/docs/<l>/etichete-0` | A4 | Etichete 70×37, 24/foaie |
| `site/docs/<l>/montaj-0`, `montaj-1` | A4 | Fișa de montaj |
| `site/docs/<l>/desen-0` | A4 | Desen tehnic 2D |
| `site/docs/<l>/oferta-0` | A4 | Oferta PDF |

Fiecare pagină A4 există în trei variante: `-720.avif`, `-720.webp` (pe pagină)
și `-1500.webp` (lightbox).

Randările 3D din `site/img/3d-*` sunt tot capturi ale vizualizatorului din
aplicație. `hero-carcass-*` e cadrul final al scenei Three.js a site-ului,
folosit ca imagine de pornire și pe telefon.

Fotografiile de mobilier (`site/img/work/`) sunt lucrări proprii (Domus Renov),
trimise de Liviu pe 27.09.2026: nișa din MDF cu ramă de pin, corpul nivelat cu
laserul, dulapul finisat, rosturile ușilor, grila și soclul. La conversie se
șterg TOATE metadatele (EXIF, inclusiv GPS: pozele sunt făcute la clienți).
Nu se pun pe site fotografii de mobilier care nu e al nostru.

## Mișcare și performanță

- **Intro** (max. 4 s, o dată pe sesiune, `sessionStorage.eb_intro`, butonul Skip
  e vizibil de la început, Escape îl sare). Pe desktop cu WebGL rulează Three.js:
  panoul de 2800×2070, ferăstrăul circular cu rumeguș, piesele cu etichetele lor,
  asamblarea și cotele.
  Pe telefon aceeași poveste, în Canvas 2D. Cu `prefers-reduced-motion` nu rulează deloc.
- **Povestea** (a–e): pe desktop e fixată pe ecran și derulată de scroll (ScrollTrigger
  + Lenis). Pe telefon e un carusel cu snap, fără pin lung.
- Three.js, GSAP și Lenis se încarcă **doar pe desktop**, după prima randare.
  JS inițial: ~11 KB gzip (main + billing + GoatCounter).
- Toate foile (tabelul, etichetele, fișa) sunt randate la mărime naturală, cu text
  ≥ 12 px, și scalate vizual în cadrul lor.

## Analytics

GoatCounter, fără cookie-uri și fără banner. Scriptul e găzduit local
(`site/js/count.js`) și trimite la `https://ebanist.goatcounter.com/count`
(adăugat în CSP, la `img-src`). Fiecare CTA spre aplicație are
`data-goatcounter-click` (`cta-header`, `cta-hero`, `cta-price-free`,
`cta-price-pro`, `cta-price-yearly`, `cta-final`), iar linkurile TikTok au `tiktok-header`, `tiktok-hero`, `tiktok-section`.

**De făcut o singură dată:** contul `ebanist` pe goatcounter.com. Până atunci,
cererile se pierd fără efect asupra paginii.

## Deploy

Push pe `main` și Netlify publică. Pentru `/ro/`, `/it/`, `/fr/` nu trebuie
nimic de configurat. Vechile linkuri `/?lang=xx` primesc 301 spre pagina limbii
(`netlify.toml`). Service worker-ul din rădăcină (`/sw.js`) doar se
dezinstalează și nu mai interceptează nicio pagină. Cel al aplicației rămâne
în `/app/`.
