# Audit Lighthouse · 27.09.2026

Lighthouse 12, profil **mobil** (Moto G Power emulat, rețea Slow 4G simulată,
CPU 4×). Serverul local imită Netlify: compresie brotli, `Cache-Control`,
CSP-ul din `netlify.toml`. Prima vizită, cu intro-ul pornit.

| Pagina | Performanță | Accesibilitate | Best practices | SEO | LCP | FCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` (EN) | 98 | 100 | 100 | 100 | 2,2 s | 1,6 s | 0,003 | 40 ms |
| `/ro/` | 98 | 100 | 100 | 100 | 2,1 s | 1,5 s | 0,003 | 70 ms |
| `/it/` | 98 | 100 | 100 | 100 | 2,1 s | 1,5 s | 0,003 | 80 ms |
| `/fr/` | 99 | 100 | 100 | 100 | 2,1 s | 1,5 s | 0,012 | 60 ms |
| `/` desktop | 99 | 100 | 100 | 100 | 0,5 s | — | 0,03 | 0 ms |

**LCP:** 2,1–2,2 s pe Slow 4G simulat (RTT 150 ms, 1,6 Mbps). Ținta de 2,0 s
„pe 4G” e depășită cu 0,1–0,2 s în profilul Lighthouse, care e mai lent decât un
4G real. Elementul LCP e titlul din hero (EN) sau imaginea dulapului (RO/IT/FR).

**JS inițial:** `main.js` 6,1 KB + `billing.js` 1,9 KB + GoatCounter 3,3 KB =
**11,3 KB gzip**. Pe telefon se adaugă intro-ul 2D (2,9 KB). Three.js (171 KB),
GSAP + ScrollTrigger (46 KB) și Lenis (4,7 KB) se încarcă doar pe desktop, după
prima randare.

## Ce a urcat scorul de la 85 la 98

1. CSS-ul e **inline** în pagină (build), nu mai e o cerere care blochează randarea.
2. **Fonturi subsetate**, câte un fișier pe stil, cu diacriticele RO/IT/FR incluse.
   Înainte, o pagină în română cerea 14 fișiere (latin + latin-ext); acum cere 6.
3. **Intro-ul pe telefon** e în Canvas 2D, fără `shadowBlur`, la DPR ≤ 1,5.
4. **Foile** (tabelul, etichetele, fișa de montaj) sunt randate la mărime naturală,
   cu text ≥ 12 px, și scalate vizual. „Legible font sizes” trece.
5. Titlurile se împart pe linii în trei treceri, deci o singură reașezare a paginii.

Rulare: `npx lighthouse http://localhost:8766/ro/ --form-factor=mobile`, cu un
server care comprimă (vezi `site-src/README.md`).
