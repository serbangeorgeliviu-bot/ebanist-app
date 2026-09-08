# Ebanist — jurnal de versiuni

Formatul: ce s-a schimbat pentru cine folosește aplicația, nu lista de
commit-uri. Versiunile mai vechi de 4.25.0 se citesc din istoricul git.

---

## 4.26.0 — 8 septembrie 2026

**Ebanist Order Rail.** Aplicația nu mai e doar un CAD cu paywall: e linkul
de comandă al unui atelier de debitare. Un client necunoscut deschide linkul,
proiectează mobilierul, apasă „Trimite comanda", iar atelierul primește
pachetul gata de tăiat și prețul.

### Modul atelier

- Adresa `ebanist.com/a/<atelier>` deschide aplicația în numele atelierului:
  logo și nume în header și pe toate documentele, limba lui, moneda lui.
- **Limitele cad.** Fără zidul celor 2 proiecte, fără buton Pro, fără
  filigran — nu clientul plătește aplicația, atelierul i-o oferă.
- Un atelier nou = **un fișier JSON**. `ORDER_RAIL_README.md` §1.

### Preț și comandă

- Prețul atelierului se vede **în timp real**, defalcat pe corp și pe linie:
  m² per material, metri de cant, găuri, decupaje, manoperă, TVA.
- Un material care nu e în lista atelierului cade pe prețul implicit — și
  **se spune pe ecran**, în loc să treacă tăcut într-o sumă.
- Accesoriile (bara de umeraș, piciorușe, geam) se numără la bucată, nu la
  m² de placă: aplicația le scotea deja din nesting, acum le scoate și
  prețul.
- „Trimite comanda" cere nume și telefon — atât, fără cont — și trimite
  pachetul: distinta, fișa de asamblare, etichetele, pachetul JSON pentru
  debitare, snapshot-ul întreg cu amprentă SHA-256, și prețul.
- Un link de WhatsApp către atelier, cu numărul comenzii și totalul.

### Inbox și versionare

- `ebanist.com/a/<atelier>/inbox`, cu PIN. Comenzile trec prin patru stări,
  într-o singură direcție: primită → confirmată → tăiată → ridicată.
- **Confirmarea îngheață snapshot-ul.** Refuzul e în server, nu ascuns în
  interfață: în atelier, o comandă confirmată poate fi deja pe masa de
  debitat.
- O modificare de după confirmare naște **v2**, cu părinte și cu diferența
  pe piese afișată — nu se suprascrie nimic. O retrimitere fără nicio
  schimbare nu creează o versiune nouă.

### Primul PDF în câteva secunde

- Linkul de atelier pornește cu un **dulap 800×2000×600 deja generat**:
  clientul modifică, nu începe de la pagina albă.
- Fără intro, fără ecran Pro, fără niciun pas obligatoriu între deschiderea
  linkului și butonul de comandă.

### Măsurare, fără terți și fără cookie-uri

- Cinci evenimente în total, fără IP, fără user agent, fără nume sau
  telefon: `session_start`, `first_pdf_time`, `order_started`, `order_sent`,
  `order_confirmed`.
- `ebanist.com/api/stats?atelier=<slug>` dă numărul de comenzi, timpul
  **median** până la primul PDF și rata de abandon.

### Sub capotă

- Fișiere noi: `order-rail/` (preț, mod atelier, pachet, inbox, pagina
  comenzii, texte), `ateliers/*.json`, `netlify/functions/orders.js` și
  `stats.js` pe Netlify Blobs.
- Zero dependențe noi. ZIP-ul pachetului e scris de mână, ~80 de linii.
- Teste: **442** în total — 237 aplicația în mod normal (neschimbate), 89
  Order Rail, 66 motorul geometric (17 noi: regresia adâncimii cu spate
  aplicat), 28 motorul de preț, 22 licențele.
- `APP_VER` 4.26.0, cache-ul service worker-ului `ebanist-v57`.

---

## 4.25.0 — 6 septembrie 2026

Prima versiune care se poate vinde: aplicația are un preț, o pagină care o
explică unui străin, și o memorie care nu pierde munca nimănui.

### Datele nu se mai pierd

- **IndexedDB** e acum magazia durabilă a proiectelor și a licenței.
  localStorage rămâne oglinda sincronă care pornește aplicația instant, și
  cheia istorică `tagliapro` **nu se șterge niciodată**.
- Dacă browserul golește localStorage, proiectele se recuperează singure din
  IndexedDB la următoarea pornire.
- **Copie automată** într-un slot separat, cel mult o dată la 5 minute și
  doar când proiectele s-au schimbat. Se țin ultimele 5; se restaurează din
  Setări → Datele tale.
- Se cere **memorie protejată** (`navigator.storage.persist()`) la primul
  proiect salvat și la activarea licenței. Starea și spațiul folosit se văd
  în Setări.
- Pe iPhone, în browser, apare o singură dată ghidul **„Adaugă pe ecranul
  principal"** — aplicațiile instalate sunt scutite de ștergerea la 7 zile.
- Reminderul de backup se uită acum la ultimul export **în fișier**: sub 30
  de zile tace, peste insistă cel mult o dată pe săptămână.
- Bara roșie „memorie plină" apare doar când **ambele** memorii au refuzat
  scrierea. Înainte ar fi țipat degeaba de fiecare dată când localStorage se
  umplea iar datele erau, de fapt, în siguranță.

### Ebanist Pro

- Gratuit: **2 proiecte**, PDF-uri cu filigran. Restul aplicației e întreg —
  calcule, 3D, debitare, releveu, sincronizare, backup.
- Pro: proiecte nelimitate, PDF-uri curate, pachetul JSON pentru centrul de
  debitare, export JPG al randării 3D. **9 €/lună** sau **79 €/an**.
- Un ecran Pro dedicat, care spune de ce ai ajuns acolo. Zidul e verificat pe
  toate căile de creare: buton, salvare directă, duplicare, import CSV,
  import JSON.
- Plata prin **Lemon Squeezy** (merchant of record). Activare cu cheia din
  emailul de confirmare; revenirea din checkout deschide singură formularul.
- **Offline nu costă Pro.** Licența se recontrolează la 7 zile doar când e
  rețea; fără rețea nu se schimbă nimic. Pro cade doar dacă serverul,
  contactat, spune că abonamentul s-a terminat — și oricum după 14 zile de
  grație. **Niciun proiect nu se șterge, în niciun caz.**
- Cheile permanente `EBP-XXXX-XXXX-XXXX` se validează offline și nu expiră.
- „Deconectează licența de pe dispozitivul ăsta", din Setări.

### O pagină pentru cine nu ne cunoaște

- `ebanist.com` e acum o pagină de prezentare; aplicația stă la
  `ebanist.com/app/`. **Aceeași origine**: nimeni nu-și pierde proiectele la
  mutare. Adresele vechi redirecționează, iar service worker-ul vechi se
  autodezinstalează în loc să servească la nesfârșit aplicația din cache.
- Patru limbi cu detectare automată. Fără cookie-uri, fără scripturi terțe,
  fără banner.
- Pagini de termeni, confidențialitate (actualizată cu Lemon Squeezy) și
  rambursare.

### Primul contact

- Aplicația **detectează limba telefonului** la prima pornire. Înainte
  pornea mereu în italiană.
- Proiectul de start e acum un exemplu declarat, numit în limba ta, cu piese
  gata — butonul „PDF" produce ceva în zece secunde. **Nu ocupă un loc din
  cele două gratuite.** Numele clientului real a fost scos din el.
- `alert()`, `confirm()` și `prompt()` au dispărut din aplicație. În locul
  lor, o singură fereastră, în cele patru limbi, care nu blochează pagina și
  care apare corect și în PWA instalată pe iOS.

### Sub capotă

- Fișiere noi: `app/ebanist-store.js`, `app/ebanist-license.js`,
  `app/config/billing.js`, `app/tools/genkey.py`.
- Toate cele șase ieșiri pe hârtie trec printr-o singură funcție,
  `printOut()`: filigranul nu poate lipsi dintr-un document din greșeală.
- Teste: 232 în Chromium (de la 167) + 22 noi pentru licențe. Cele 49 ale
  motorului geometric trec neatinse.
- `APP_VER` 4.25.0, cache-ul service worker-ului `ebanist-v56`.
