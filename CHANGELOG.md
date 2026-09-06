# Ebanist — jurnal de versiuni

Formatul: ce s-a schimbat pentru cine folosește aplicația, nu lista de
commit-uri. Versiunile mai vechi de 4.25.0 se citesc din istoricul git.

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

- `ebanist.app` e acum o pagină de prezentare; aplicația stă la
  `ebanist.app/app/`. **Aceeași origine**: nimeni nu-și pierde proiectele la
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
