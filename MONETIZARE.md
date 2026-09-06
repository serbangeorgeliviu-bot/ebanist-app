# Ebanist — monetizare

Ce s-a construit în v4.25.0, ce trebuie completat de tine înainte de
lansare, și cum se testează fluxul complet pe telefon.

---

## 0. Ce am găsit când am deschis repo-ul (citește asta întâi)

Promptul spunea că există deja: gating freemium la 2 proiecte, watermark PDF,
sistem de licențe `EBP-XXXX-XXXX-XXXX` cu checksum FNV, generator Python,
`PRO_BUY_URL`, reminder de backup la 7 zile, versiunea 4.23.0.

**Nu exista nimic din toate astea, în afară de reminderul de backup.**
Versiunea din repo era 4.24.0. Nu există niciun `isPro`, `watermark`,
`PRO_BUY_URL` sau cod de licență în istoricul git. Probabil au fost
proiectate în altă parte și nu au ajuns niciodată în cod.

Ce înseamnă practic:

- Am **construit de la zero** gating-ul, watermark-ul și licențele, nu le-am
  verificat.
- Formatul cheilor permanente `EBP-XXXX-XXXX-XXXX` **l-am definit eu**
  (alfabet, sare, poziția checksum-ului) — vezi §4. Nu există chei vechi
  emise, deci nu am rupt compatibilitatea cu nimeni. Dacă ai emis chei
  manual după alt algoritm, spune-mi și schimb validatorul.
- Versiunea nouă e **4.25.0** (bump minor de la 4.24.0), nu 4.24.0.

---

## 1. Ce s-a implementat

### Persistența datelor (prioritate zero)

- `app/ebanist-store.js` — strat IndexedDB fără dependențe: `kv` (stare,
  licență, meta) și `backups` (sloturile automate).
- Cheia legacy `tagliapro` din localStorage **se citește, se migrează și
  NU se șterge**. Rămâne oglinda sincronă care pornește aplicația instant
  (IndexedDB e asincron, iar decizia „pun filigran pe PDF?" trebuie luată
  imediat).
- La pornire: se citește IndexedDB și câștigă înregistrarea mai recentă.
  Dacă localStorage e gol și IndexedDB are date → se recuperează tot.
- `navigator.storage.persist()` se cere la primul proiect salvat și la
  activarea licenței. Starea (protejat / neprotejat) + spațiul folosit se
  văd în Setări → „Datele tale".
- Ghid „Adaugă pe ecranul principal", o singură dată, doar pe iOS în
  browser (PWA instalată e exceptată — detecția prinde și iPad-ul, care se
  declară Macintosh).
- Backup automat într-un slot IndexedDB separat, la maximum o dată la 5
  minute și doar dacă proiectele s-au schimbat; se țin ultimele 5.
  Restaurare din Setări.
- Reminderul de backup: acum se uită la **ultimul export în fișier**. Sub
  30 de zile tace; peste, insistă cel mult o dată pe săptămână.

> **Ce NU rezolvă asta, și trebuie spus.** Pe iOS, ștergerea după 7 zile de
> inactivitate lovește **toată** memoria scriptabilă — IndexedDB inclusiv,
> nu doar localStorage. IndexedDB rezolvă altceva, real: plafonul de 5 MB al
> lui localStorage (aplicația stochează logo-uri base64 și relevee — bara
> roșie „memorie plină" exista deja în cod) și ștergerile parțiale.
> Apărările reale contra celor 7 zile sunt trei, și toate sunt în app:
> **PWA instalată pe ecranul principal** (exceptată), **contul Supabase**
> (sincronizare, exista deja) și **backupul în fișier**.

### Freemium

| | Gratuit | Pro |
|---|---|---|
| Proiecte | 2 | nelimitat |
| PDF | cu filigran (diagonală + subsol `ebanist.com — versiune gratuită`) | curat |
| Pachet JSON pentru centrul de debitare | — | da |
| Export JPG 3D | — | da |
| Restul (calcule, 3D, debitare, releveu, sync, backup) | tot | tot |

Toate cele **șase** ieșiri pe hârtie trec printr-o singură funcție,
`printOut()`. Un al șaptelea document ori o cheamă, ori nu se printează —
filigranul nu poate lipsi din greșeală.

Zidul celor 2 proiecte e verificat pe **toate** căile: butonul „Proiect nou",
salvarea directă, „Duplică proiectul", importul CSV, importul JSON al unui
proiect. Refresh-ul nu îl ocolește (numără proiectele, nu creările), iar
ștergerea unui proiect eliberează corect locul.

Momentele de upgrade (ecran dedicat `shPro`, niciodată `alert()`):
al treilea proiect, prima tipărire ca utilizator gratuit (**după** ce
documentul a ieșit — înainte ar fi un taxă de trecere), pachetul de
laborator, exportul JPG.

### Licențe

- `app/config/billing.js` — singura configurație a încasării, folosită și de
  aplicație și de landing. `PRO_BUY_URL` a devenit `BILLING.buyUrl(plan, email)`.
- `app/ebanist-license.js` — pur, fără DOM, testabil în node: checksum-ul
  cheilor permanente, recunoașterea formatului, apelurile Lemon Squeezy și
  decizia „sunt Pro?".
- Activare: `POST /v1/licenses/activate` cu `license_key` + `instance_name`.
- Validare: `POST /v1/licenses/validate` o dată la 7 zile, doar când e rețea.
- Dezactivare: `POST /v1/licenses/deactivate`, din Setări.
- Offline / eroare de rețea → **nu se schimbă nimic**. Pro cade doar când
  serverul, contactat, spune `expired` sau `disabled`, și oricum după 14 zile
  de grație peste `expires_at`. Proiectele nu se șterg în niciun caz.
- Cheile `EBP-…` se validează offline și nu expiră niciodată.

**Nicio cheie API în client, și nicio funcție Netlify nouă.** Am verificat
documentația curentă Lemon Squeezy (septembrie 2026): cele trei rute de
licență sunt publice — cer doar `Accept: application/json` și un corp
`application/x-www-form-urlencoded`. Cheia API a magazinului servește la
altceva (citit comenzi și clienți) și nu are ce căuta într-un browser.
`connect-src 'self' https:` din `netlify.toml` permite deja
`api.lemonsqueezy.com`; nu am lărgit CSP-ul.

### Landing

- Rădăcina `ebanist.com` = pagină de prezentare. Aplicația la `/app/`.
- **Aceeași origine**, deci IndexedDB și localStorage existente nu se pierd.
- Patru limbi (RO/IT/FR/EN), detectare automată, selector cu patru butoane.
  Limba aleasă călătorește la app prin `?lang=`.
- Zero scripturi terțe, zero cookie-uri, zero banner. Analytics fără cookie
  (GoatCounter) e pregătit, comentat, o singură linie.
- `termeni.html`, `privacy.html` (actualizat cu Lemon Squeezy în toate cele
  patru limbi), `rambursare.html`.

### Onboarding

- Proiectul de start a devenit un **exemplu declarat** (`demo:1`): se
  numește în limba utilizatorului, are piese, deci butonul „PDF" produce
  ceva imediat. **Nu ocupă un loc din cei doi gratuiți.** În momentul în
  care e redenumit sau duplicat, încetează să fie exemplu și începe să
  conteze.
- Numele clientului real („Arredi Ufficio Jacquin" / „Jacquin Construction
  Monaco") a fost scos: un străin care deschide linkul nu trebuie să dea
  peste comanda altcuiva.
- Aplicația detectează acum limba telefonului la prima pornire. Înainte
  pornea mereu în italiană.
- Cele 3 carduri de intro erau deja traduse în toate patru limbile; se sar
  cu butonul „Începe" sau cu X-ul.
- `alert()`, `confirm()` și `prompt()` au dispărut complet din aplicație —
  o singură componentă `dialog()`, în cele patru limbi.

---

## 2. CE TREBUIE SĂ FACI TU

### a) Domeniul și emailurile — se face ÎNAINTE de restul

Domeniul oficial e **ebanist.com** (D-41). `ebanist.app` rămâne doar
redirect. Tot codul e deja pe `.com` — inclusiv filigranul de pe fiecare PDF
și `RETURN_URL`-ul din `billing.js`.

**1. Netlify → domeniul principal.**
Site settings → Domain management → *Add custom domain* → `ebanist.com`, apoi
*Set as primary domain*. Adaugă și `www.ebanist.com` (Netlify îl
redirecționează singur pe apex).

**2. DNS la register.it** (panoul din care ai făcut captura: DOMINIO & DNS).
Cel mai simplu e să lași register.it ca registrar și să pui doar recordurile:

| Tip | Nume | Valoare |
|---|---|---|
| A | `@` | `75.2.60.5` (load balancerul Netlify) |
| CNAME | `www` | `<numele-sitului>.netlify.app` |

Verifică valoarea A în panoul Netlify înainte de a o scrie — Netlify o
afișează la *Domain management*, și e singura sursă de adevăr dacă o schimbă.
Alternativa, mai curată dacă nu ai alte servicii pe domeniu: muți nameserverele
la Netlify DNS și nu mai atingi nimic manual.

**3. `ebanist.app` ca redirect.**
Netlify → Domain management → *Add domain alias* → `ebanist.app`, și pui DNS-ul
lui (la Namecheap) pe aceleași valori. Netlify trimite singur 301 către
domeniul principal — nu se poate face din `netlify.toml`, fiindcă acolo
condițiile sunt Country/Language/Role/Cookie, nu Host.

> **.app nu iartă.** E un TLD cu HSTS preload obligatoriu: browserul nici
> măcar nu încearcă `http://`. Până când Netlify emite certificatul pentru
> alias, `ebanist.app` **nu răspunde deloc** — nu „răspunde prost". Întâi
> DNS-ul, apoi aștepți certificatul, abia apoi testezi.

**4. Emailurile — blocant.**
Codul folosește acum două adrese care **încă nu există**:

- `info@ebanist.com` — în paginile legale și în ecranul Pro („magazinul nu e
  încă deschis, scrie-ne").
- `feedback@ebanist.com` — butonul „Sugerează o funcție" din Setări.

Vechea `feedback@ebanist.app` era forwarding pe Namecheap. Până nu creezi
echivalentele pe `.com`, butonul de feedback deschide un mail către o adresă
inexistentă și cine vrea o cheie nu are unde scrie. Register.it le are
incluse: panoul → pictograma **EMAIL** → activezi cutiile sau forwardingul.
E primul lucru din lista lor de sugestii, și aici chiar e primul.

### b) Lemon Squeezy — pașii exacți

1. **Cont și magazin.** lemonsqueezy.com → cont pe persoană fizică (conform
   deciziei comerciale: separat de Domus Renov). Store name → subdomeniul
   rezultat e `LS_STORE`.
2. **Produs.** Products → New Product → *Ebanist Pro*.
   - Pricing model: **Subscription**.
   - Două variante: *Lunar* 9 € / lună și *Anual* 79 € / an.
   - Tax category: **Software as a Service (SaaS)**.
3. **Chei de licență.** În fiecare variantă → tab *License keys* →
   **Enable license keys**.
   - *Activation limit*: **3** (telefon + tabletă + PC — recomandarea mea;
     1 e prea puțin pentru „o aplicație, trei moduri de interfață").
   - *License length*: **expires with subscription**. Așa `expires_at` vine
     completat și grația de 14 zile are pe ce lucra.
4. **Redirect după plată.** Product → Settings → *Redirect after purchase*:
   `https://ebanist.com/app/?activate=1`
5. **Linkurile de checkout.** Fiecare variantă → *Share* → copiază linkul.
   Se termină cu `/checkout/buy/<UUID>` — acel UUID intră în
   `LS_VARIANT_MONTHLY` și `LS_VARIANT_YEARLY`.
6. **Variant id numeric** (opțional, dar pune-l): Products → Variants → ID-ul
   din URL → `LS_VARIANT_ID`. Împiedică o cheie de la alt produs din același
   magazin (mâine: Plaquist) să deblocheze Ebanist.
7. **Politica de rambursare** din dashboard trebuie să spună **același
   lucru** cu `rambursare.html` (14 zile). Dacă diferă, comandă ce scrie în
   checkout.

Apoi completează `app/config/billing.js`. Până atunci aplicația știe că
magazinul nu e deschis: nu produce linkuri rupte, spune asta și acceptă
oricum o cheie.

### c) Texte juridice

`termeni.html` și `rambursare.html` au fiecare un chenar galben
**DE COMPLETAT**. Sunt schițe scrise de dezvoltator, nu documente verificate
juridic. Ce trebuie decis:

- **Cine facturează.** Deciziile spun *persoană fizică, separat de Domus
  Renov*; textele scriu încă Domus Renov SRL. Trebuie ales și corectat în
  ambele fișiere plus în subsolul landing-ului.
- Legea aplicabilă și instanța competentă.
- Formularea despre garanții — în UE nu se poate exclude totul.
- Adresa `info@ebanist.com` trebuie să existe (azi în cod e activ doar
  `feedback@ebanist.com`).

### d) Video landing

`index.html`, secțiunea `.demo` — un dreptunghi declarat. Înlocuiește tot
blocul `<div class="ph">…</div>` cu:

```html
<video src="/media/ebanist-15s.mp4" poster="/media/ebanist-poster.jpg"
       autoplay muted loop playsinline style="width:100%;display:block"></video>
```

15 secunde, fără sunet, filmat pe telefon: cote scrise → „Generează" →
lista de debitare → PDF. Fără tăieturi de montaj — trebuie să se vadă că e
o singură trecere.

---

## 3. Cum se testează fluxul complet, manual

### iPhone / Safari (cazul care contează)

1. Fereastră privată nouă → `ebanist.com`. Landing în română (sau limba
   telefonului). Înțelegi ce face în 30 s.
2. „Încearcă gratuit" → `/app/?lang=ro`. Apare intro-ul. „Începe".
3. Apare ghidul „Adaugă pe ecranul principal" (doar pe iOS, o singură dată).
4. Proiectul „Exemplu — Dulap 2 uși" e deja acolo, cu piese. Apasă
   Sumar → „PDF listă" → iese cu filigran diagonal + subsol.
5. Imediat după, se deschide singur ecranul Pro. Închide-l.
6. Creează două proiecte proprii. Merge.
7. La al treilea → ecranul Pro, cu motivul scris („Varianta gratuită ține 2
   proiecte. Ăsta ar fi al 3-lea.").
8. „Deblochează Pro — 9 €/lună" → checkout Lemon Squeezy în filă nouă.
   **Test mode** (comută în dashboard) → cardul `4242 4242 4242 4242`,
   dată viitoare, CVC oricare.
9. După plată → revii la `ebanist.com/app/?activate=1` → formularul de
   activare se deschide singur.
10. Cheia e în emailul de confirmare. Lipește-o → „Activează" → „Pro activ ✓".
11. Setări → Abonament: scrie „Pro activ · Se reînnoiește pe …".
12. Sumar → „PDF listă" → **fără filigran**.
13. Setări → Datele tale: verifică ce scrie despre memoria protejată.
14. **Testul ștergerii:** Safari → Reglaje → Avansat → Date site web → șterge
    datele pentru ebanist.com… **nu**, asta șterge tot, inclusiv IndexedDB.
    Testul corect e din consolă (Safari desktop conectat la telefon, sau
    Chrome Android): `localStorage.clear()` apoi reload.
    **Toate proiectele și licența trebuie să fie încă acolo.**
    Automatizat: `cd test && npm test`, secțiunea „localStorage svuotato".
15. Adaugă pe ecranul principal → deschide de acolo → totul e la locul lui.

### Android / Chrome

Același traseu. În plus:
- Bannerul „Instalează aplicația" apare de la sine.
- Setări → Datele tale ar trebui să spună „Memorie protejată ✓" (Chrome
  acordă `persist()` mai ușor decât Safari).

### Ce trebuie să verifici că NU se întâmplă

- Utilizator vechi, cu `ebanist.com/index.html` în favorite sau pe ecran:
  trebuie să ajungă la `/app/` **cu proiectele intacte**. Vezi §5.
- Expirarea abonamentului nu șterge niciun proiect.
- Offline (mod avion): Pro rămâne activ, PDF-urile ies fără filigran.

---

## 4. Cheile permanente `EBP-XXXX-XXXX-XXXX`

Format definit acum (nu exista): 12 simboli din alfabetul
`23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 de caractere, fără `0 1 I O` — o
cheie se dictează la telefon). Primii 10 sunt aleatori, ultimii 2 sunt
checksum FNV-1a pe 32 de biți al `"ebanist-pro-2026" + primii10`, luat în
două felii de 5 biți.

```
cd app/tools
python3 genkey.py 20                       # 20 de chei
python3 genkey.py --check EBP-AB23-CD45-EF67
```

Checksum-ul e scris de două ori — în Python și în JavaScript — și
`npm run test:license` verifică la fiecare rulare că cele două sunt de acord.
Dacă atingi unul, atinge-l și pe celălalt în același commit.

---

## 5. Mutarea la `/app/` — cum nu se pierde nimeni

Riscul real nu era localStorage (aceeași origine, se păstrează), ci
**service worker-ul vechi**, înregistrat pe scope `/`, care servea aplicația
din cache înainte să ajungă cererea la server. Fără intervenție ar fi
continuat să arate vechea aplicație la `/` **pentru totdeauna**.

Soluția, în trei bucăți:

1. `/sw.js` a rămas la aceeași adresă, dar acum e un **service worker de
   demontare**: se autodezinstalează și, cât timp e viu, redirecționează
   navigările la `/app/`. Un service worker se poate înlocui doar cu altul
   la aceeași adresă — de aia fișierul nu s-a mutat.
2. Nu șterge nicio cache. De curățenie se ocupă `/app/sw.js`, care în
   `activate` șterge tot ce nu e cache-ul lui curent. Invers ar fi însemnat
   să arunce cache-ul proaspăt al aplicației.
3. `netlify.toml`: 301 de la `/index.html` și de la fiecare fișier vechi
   (`/ebanist-core.js`, `/vendor/*`, `/icons/*`, …) către echivalentul din
   `/app/`. `/sw.js` **nu** se redirecționează niciodată, cu `Cache-Control:
   max-age=0` — altfel cel vechi ar rămâne în viață.

În plus, landing-ul verifică `localStorage.tagliapro`: cine are deja
proiecte e dus direct în aplicație, nu pus să citească o prezentare.

**Atenție la ordinea celor două mutări.** Schimbarea de cale (`/` → `/app/`)
păstrează datele fiindcă originea rămâne aceeași. Schimbarea de **domeniu**
(`.app` → `.com`) NU le păstrează: IndexedDB și localStorage sunt legate de
origine, iar `ebanist.app` și `ebanist.com` sunt origini diferite. Azi nu e
o problemă — pe `.app` nu a rulat niciodată aplicația, deci nimeni nu are
date acolo. Dacă totuși ai testat aplicația pe `.app` și vrei proiectele
de acolo, singurul drum e „Backup complet" pe vechiul domeniu și „Importă"
pe cel nou. Redirectul nu mută datele, doar utilizatorul.

---

## 6. Decizii luate pe drum (unde erau două variante rezonabile)

- **Oglinda licenței în localStorage.** Cine o editează cu mâna își
  deblochează Pro. E adevărat pentru orice aplicație care decide offline, iar
  apărarea reală e în altă parte (cheile expiră și se recontrolează la 7
  zile). Nu am cheltuit nicio linie în plus pe asta.
- **Proiectul exemplu nu consumă cotă gratuită.** Altfel utilizatorul se
  lovea de zid la al DOILEA proiect al lui, nu la al treilea, și dădea vina
  pe aplicație.
- **Restaurarea unui backup propriu nu trece prin zid.** Sunt proiectele
  tale, de pe telefonul vechi. A le refuza ar însemna să ții ostatică munca
  cuiva care tocmai și-a schimbat telefonul. Cine ajunge peste doi proiecte
  le păstrează pe toate, dar nu mai poate crea altele noi până nu coboară
  sub limită sau trece la Pro. Importul unui singur proiect **trece** prin
  zid — ăla e o creare.
- **Propunerea Pro după tipărire, nu înainte.** Înainte de tipărire ar fi un
  pedaj. După, e răspunsul la întrebarea pe care utilizatorul tocmai și-a
  pus-o uitându-se la filigran. O singură dată pe sesiune.
- **`status: "inactive"` NU taie Pro.** Lemon Squeezy numește „inactive" o
  cheie fără dispozitive active — starea normală imediat după o schimbare de
  telefon, nu o revocare. Doar `expired` și `disabled` închid ușa.
- **Filigranul la 8% opacitate.** Un filigran care face ilizibilă o cotă nu e
  o limită comercială, e un document care trimite o piesă greșită în atelier.
- **Nicio funcție Netlify pentru licențe.** Rutele sunt publice; un proxy ar
  fi adăugat un punct de cădere între un tâmplar offline și PDF-ul lui.
- **ebanist.com canonic, .app doar redirect.** Alegerea ta. Un singur
  domeniu în filigran, în paginile legale și în `RETURN_URL` — dacă cele
  două ar circula amândouă, jumătate dintre PDF-uri ar trimite clientul pe
  un domeniu care e doar un redirect, iar mâine, dacă `.app` expiră, pe
  nicăieri. `.app` se păstrează ca alias fiindcă e ieftin și fiindcă unii
  vor tasta așa.
- **Landing în 4 limbi, nu 3.** Aplicația avea deja engleză; a o omite din
  landing ar fi însemnat ca un vizitator anglofon să nimerească româna.

---

## 7. Un bug real, găsit de teste

Prima versiune a stratului IndexedDB pierdea datele exact în cazul pentru
care fusese scrisă. La pornire, `persist()` programa scrierea stării
*tocmai încărcate* după 400 ms, iar realinierea cu IndexedDB venea la 900 ms.
Cu localStorage golit — adică fix cazul iPhone — starea de pornire (goală, cu
doar exemplul în ea) suprascria proiectele reale înainte să le citească
cineva. Magazia durabilă ștergea ce trebuia să apere.

Regula acum: **nicio scriere în IndexedDB până nu s-a citit**, iar citirea
pornește imediat, nu după o secundă. Testul „localStorage svuotato — i
progetti sono ancora li" din `test/run.js` fixează asta pentru totdeauna.

---

## 8. Testele

```
cd test
npm install
npm test              # 232 de teste în Chromium, inclusiv toată monetizarea
npm run test:geom     # 49 — motorul geometric, criteriul de acceptare (D-37)
npm run test:license  # 22 — checksum Python↔JS, decizia Pro, formatele
```

Ce acoperă partea nouă:

- migrarea `tagliapro` → IndexedDB, fără ștergerea cheii vechi și fără
  recalcularea cotelor (`geomVersion` rămâne 1);
- proiectele și licența supraviețuiesc golirii lui localStorage;
- zidul celor 2 proiecte pe toate cele cinci căi de creare, plus eliberarea
  locului la ștergere, plus dispariția lui la Pro;
- filigranul pe toate documentele care tipăresc, absent la Pro;
- activarea unei chei permanente valide, respingerea uneia cu un caracter
  schimbat, acceptarea fără cratime și cu litere mici;
- expirarea, grația de 14 zile, revocarea — și că niciunul din cazuri nu
  șterge un proiect;
- forma URL-ului de checkout și faptul că segnaposturile necompletate nu
  produc un link rupt;
- landing-ul: patru limbi, zero scripturi terțe, zero cookie-uri;
- redirect-urile vechilor adrese și service worker-ul de demontare.

`npm run test:geom:v1` cade cu 19 teste — asta e intenționat și
preexistent: rulează motorul vechi (4.23) ca să arate erorile corectate de
D-37.
