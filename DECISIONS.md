# Ebanist Order Rail — jurnalul deciziilor

Fiecare decizie luată în timpul construcției, cu motivul, în ordine.
Regula de lucru: când o decizie era neclară, am ales varianta cea mai simplă
care funcționează, am scris-o aici și am mers mai departe.

Jurnalul de decizii de program (D-nn) stă în `ebanist-hq/02-decizii/DECIZII.md`.
Ăsta e jurnalul tehnic al acestui livrabil.

---

## 0. Starea de plecare (8 septembrie 2026)

Repo `ebanist-app`, branch `claude/ebanist-monetizare-6fixjp`, 2 commit-uri
înaintea lui `origin/main`.

Teste înainte de a atinge ceva — **toate verzi**:

| Suită | Rezultat |
|---|---|
| `npm test` (Chromium, aplicația întreagă) | 237 / 237 |
| `npm run test:geom` (motor geometric, criteriul D-37) | 49 / 49 |
| `npm run test:license` (chei Pro) | 22 / 22 |

Nu există build step: `netlify.toml` publică folderul așa cum e, cu
`command = ""`. Singura dependență npm în rădăcină e `@netlify/blobs`,
deja acolo pentru funcția AR — deci Blobs nu adaugă nimic nou.

Ce am găsit și e relevant pentru Order Rail:

- 26 de materiale în `MATDB` (nu 14 — 14 sunt cele „clasice", restul sunt
  decoruri Egger `dsp_*`). Lista de prețuri a atelierului trebuie să le
  poată acoperi pe toate, cu un preț implicit pentru cele necotate.
- `computeTotals(p)` dă deja `{pcs, area, edge, mats}` cu aria și metrii de
  cant per material. Motorul de preț nu recalculează geometrie — o citește.
- `computeHardware(p, S)` dă cantitățile de balamale, glisiere, suporți și
  conectori. De acolo ies găurile.
- Toate cele șase ieșiri pe hârtie trec prin `printOut()` (v4.25.0).
- Aplicația stă la `/app/`, prezentarea în rădăcină, service worker cu
  scope `/app/`.

---

## 1. Constrângeri de mediu, descoperite la Pasul 0

### 1.1 Netlify nu poate fi legat și nu se poate face deploy din sesiunea asta

`.netlify/state.json` nu există, CLI-ul `netlify` nu e instalat, iar
`NETLIFY_AUTH_TOKEN` nu e setat în mediu. `netlify link` și
`netlify deploy --prod` cer amândouă autentificare, care nu se poate face
neinteractiv fără token.

**Decizie:** construiesc tot, verific local cu un server care servește
aceleași rute și aceiași header ca Netlify, și las deploy-ul ca o singură
comandă documentată în `ORDER_RAIL_README.md`. Nu inventez un token și nu
raportez un deploy care nu s-a întâmplat.

**Consecință:** verificarea cu `curl` pe domeniul public din Pasul 6 nu se
poate face. Am înlocuit-o cu aceleași verificări pe serverul local de probă,
rulate în suita de teste, ca să nu rămână nedovedite.

### 1.2 Domeniul e `ebanist.com`, nu `ebanist.app`

Cerința spune `https://ebanist.app/a/demo`. Domeniul oficial a devenit
`ebanist.com` acum două zile (D-41 în HQ): `.app` rămâne doar redirect, și
azi niciunul dintre ele nu servește încă nimic — DNS-ul nu e legat de
Netlify. Am folosit `ebanist.com` peste tot; linkurile din `URLS.md` sunt
scrise pe `.com` și devin valide în momentul în care DNS-ul e pus.

---

## 2. Rutare

### 2.1 `/a/<slug>` face redirect 302 la `/app/?atelier=<slug>`, nu rewrite 200

Un rewrite 200 ar servi conținutul lui `/app/index.html` la adresa
`/a/demo`. Dar `index.html` își încarcă toate fișierele cu căi relative
(`./ebanist-core.js`, `./vendor/...`): la adresa `/a/demo` acelea s-ar
rezolva ca `/a/ebanist-core.js` și ar da 404. Aplicația nu ar porni deloc.

Alternativa ar fi `<base href="/app/">`, care strică ancorele interne și
înregistrarea service worker-ului.

**Decizie:** 302. Linkul care se dă clientului rămâne scurt și frumos
(`ebanist.com/a/demo`), browserul aterizează pe `/app/?atelier=demo`.
Cerința prevede explicit varianta asta („funcționează și ca
`?atelier=<slug>` dacă routing-ul PWA e static").

Paginile de inbox și de comandă **sunt** rewrite 200, fiindcă sunt fișiere
proprii care își încarcă resursele cu căi absolute.

### 2.2 Service worker-ul de demontare din rădăcină nu mai înghite `/a/` și `/api/`

`/sw.js` (introdus în v4.25.0 ca să dezinstaleze service worker-ul vechi de
pe scope `/`) redirecționa **orice** navigare din afara lui `/app/` către
`/app/`. Cu Order Rail, asta ar fi rupt `/a/demo` și inbox-ul pentru
utilizatorii vechi, în fereastra de timp în care mai e viu.

**Decizie:** exclus `/a/` și `/api/` din redirectul lui. Restul
comportamentului rămâne.

---

## 3. Documentele comenzii sunt HTML gata de tipărit, nu fișiere PDF

Cerința spune „PDF distinta, PDF fișa asamblare, PDF etichete".

Aplicația nu produce fișiere PDF și nu a produs niciodată: cele șase
documente se generează ca HTML în `#printArea` și ies pe hârtie prin
`window.print()`, unde utilizatorul alege „Salvează ca PDF". Nu există
niciun generator de PDF în cod.

Ca să pun fișiere `.pdf` adevărate în pachet ar fi trei drumuri:

1. **O bibliotecă de PDF în client** (jsPDF + html2canvas ≈ 700 KB).
   Contrazice „fără dependențe noi grele", și randarea prin canvas ar
   transforma tabelul distintei într-o imagine — nu se mai poate căuta,
   nu se mai poate copia o cotă din el.
2. **Randare pe server** (Puppeteer / Chromium într-o funcție). Depășește
   free tier-ul Netlify Functions și contrazice „buget zero".
3. **Un scriitor de PDF scris de mână.** Fezabil pentru distinta și
   etichete (tabele și text), nerealist pentru fișa de asamblare, care e
   un desen izometric SVG.

**Decizie:** pachetul conține documentele ca **HTML autonom, gata de
tipărit** — un fișier per document, cu stilul de print înăuntru, fără
resurse externe. Pe pagina comenzii fiecare are un buton care îl deschide
și cheamă direct dialogul de tipărire; pe iPhone și pe Android „Salvează ca
PDF" e la o apăsare.

Partea citită de mașină — pachetul de laborator JSON, în formatul existent,
fără prețuri — e în pachet ca JSON adevărat. Aia contează pentru debitare;
restul e hârtie pentru om.

Ce se pierde: atelierul face o apăsare în plus dacă vrea fișierul `.pdf` pe
disc. Ce se câștigă: zero dependențe, documente care rămân text real, și
aceleași documente pe care aplicația le tipărește deja — fără un al doilea
generator care să apuce să divergă de primul.

---

## 4. Motorul de preț

### 4.1 Ce se numără

Prețul se calculează din ce știe deja aplicația, fără geometrie nouă:

| Element | Sursa | Unitate |
|---|---|---|
| Plăci | `computeTotals(p).mats[k].area` | m² per material |
| Cant | `computeTotals(p).mats[k].edge` | m, la grosimea din setări |
| Găuri | `computeHardware(p, S)` | buc. |
| Decupaje | `scList(x)` per piesă | buc. |
| Manoperă | numărul de piese | buc. |

**Aria e cea netă, nu cea a colilor cumpărate.** Atelierul taie din colile
lui și își pune marja în preț/m²; a factura clientului final colile întregi
plus pierderile ar însemna să-i vinzi deșeul altcuiva. Optimizarea de
debitare rămâne în aplicație pentru atelier, nu intră în prețul clientului.

### 4.2 Ce înseamnă „o gaură"

Nu se numără găuri fizice, ci **operații de găurire facturabile**, fiindcă
asta se plătește în realitate:

- o balama = 1 (cupa Ø35 și cele două șuruburi sunt o singură operație)
- un suport de raft = 1
- un conector (minifix) = 1
- o glisieră = 1

Un decupaj (`scasso`) se numără separat, la prețul lui, fiindcă e altă
sculă și alt timp.

Alternativa — numărul real de găuri, cu adâncimi și diametre — ar cere
tabela de scule a mașinii, care nu există (vezi `PROFIL-MASINI.json`, câmpuri
`null`). Modelul de aici e cel pe care un atelier îl poate verifica cu
creionul.

### 4.3 Materialele necotate

Lista de prețuri a atelierului nu trebuie să conțină toate cele 26 de
materiale. Ce lipsește cade pe `default_m2` din configurație, iar interfața
**spune care material a căzut pe preț implicit**. Un preț tăcut pe un
material pe care atelierul nu-l ține e felul în care se pierde o comandă.

### 4.4 Rotunjirea

Toate calculele se fac în virgulă mobilă și se rotunjesc **o singură dată**,
la afișare și la scrierea în comandă, la 2 zecimale. Aceeași regulă ca la
milimetri în motorul geometric: fără rotunjiri în lanț.

---

## 5. Persistență

### 5.1 Netlify Blobs, cu fallback local

Implementarea principală e Netlify Blobs prin Netlify Functions —
`@netlify/blobs` e deja în `package.json`, e în free tier și nu cere nicio
cheie externă.

Funcțiile detectează singure dacă Blobs e disponibil. Când nu e (dezvoltare
locală fără `netlify dev`, sau free tier depășit), aplicația trece pe
**fallback local**: comanda se salvează în IndexedDB, se descarcă un pachet
și linkul de WhatsApp rămâne funcțional. Atelierul primește comanda pe
WhatsApp oricum; inbox-ul arată atunci doar comenzile de pe dispozitivul
ăla, și **o spune pe ecran** în loc să pară gol.

Motivul pentru care fallback-ul nu e opțional: dacă persistența cade,
lucrul clientului — zece minute de proiectare — nu are voie să dispară.

### 5.2 Pachetul e un ZIP, scris de mână, fără dependențe

Fallback-ul cere descărcarea unui ZIP. Nicio bibliotecă nu e necesară: un
ZIP fără compresie (metoda `store`) e un format pe care îl scrii în ~80 de
linii, iar CRC-32 e o tabelă și un ciclu. Fișierele din pachet sunt JSON și
HTML, deci comprimarea ar economisi lățime de bandă pe care oricum n-o
folosim — pachetul se descarcă local.

### 5.3 PIN-ul e o încuietoare de ușă, nu un seif

PIN-ul de 4 cifre stă în `ateliers/<slug>.json`, care e un fișier **public**
— oricine îl poate citi. Deci PIN-ul din config nu poate fi secretul.

**Decizie:** funcția nu compară PIN-ul cu ce scrie în fișierul public, ci cu
**hash-ul SHA-256 al PIN-ului plus o sare**, ținut într-o variabilă de mediu
Netlify per atelier (`INBOX_PIN_<SLUG>`). În fișierul public stă doar
`pin_hint` („4 cifre"), nu PIN-ul.

Când variabila de mediu lipsește — adică azi, până le pune Liviu —
funcția acceptă PIN-ul din config **și scrie în răspuns că inbox-ul e în
mod nesecurizat**. Așa se poate proba tot fluxul azi, iar ziua în care se
pun variabilele nu cere nicio schimbare de cod.

Ce apără asta: pe cineva care ghicește adresa inbox-ului. Ce NU apără:
pe cineva care are PIN-ul. Pentru o listă de comenzi de mobilă e proporțional;
n-am pus autentificare adevărată fiindcă ar cere conturi, iar cerința spune
explicit că nu vrem conturi.

### 5.4 Confirmarea îngheață, nu blochează

„Confirmă" scrie `confirmed_at` și fixează hash-ul. Snapshot-ul confirmat
devine imutabil: orice scriere ulterioară pe el e refuzată de funcție, nu
doar ascunsă în interfață.

O modificare după confirmare creează **v2**, o comandă nouă care ține
`parent` și `version`, cu diff-ul pe piese față de v1. Motivul: în atelier,
o comandă confirmată poate fi deja tăiată. Suprascrierea ei e felul în care
se taie de două ori aceeași placă.

---

## 6. Evenimente

Log minimal, fără terți, în Blobs (sau localStorage la fallback):
`session_start`, `first_pdf_time`, `order_started`, `order_sent`,
`order_confirmed` — cu slug și timestamp, atât.

**Nu se scrie nimic care identifică persoana.** Fără IP, fără user agent,
fără id de dispozitiv. Un contor de sesiuni cu un id aleator care trăiește
cât ține fila, ca să se poată lega `session_start` de `order_sent` și să
iasă rata de abandon. Asta ține pagina în afara obligației de banner de
cookie-uri, care ar fi primul lucru pe care l-ar vedea un client necunoscut.

---

## 7. Ce NU am atins

Motorul geometric, 3D-ul, coliziunile, debitarea și calculul adâncimilor —
neatinse, conform regulilor. Am adăugat doar **un test de regresie** pentru
adâncimea finală cu spate aplicat (`backMode: "applicato"`): fianco la
`D − t_back`, iar corpul montat exact la `D`, nu la `D + 18`.

Nicio funcție existentă ștearsă. Tot ce se ascunde în mod atelier —
gating-ul freemium, butonul Pro, filigranul — se ascunde prin feature flag,
iar în modul normal se comportă exact ca înainte. Cele 237 de teste
existente probează asta la fiecare rulare.

---

## 8. Ce s-a descoperit în timpul construcției

### 8.1 Accesoriile erau facturate la m² de PAL

Prima versiune a motorului de preț trata fiecare linie din distinta ca pe o
placă. Bara de umeraș — 760 × 25 mm — ieșea la **0,019 m²**, adică 2,66 lei,
iar atelierul ar fi plătit-o din buzunar. La fel pentru piciorușe și geam.

Aplicația avea deja convenția ei: piesele al căror material începe cu
`Accessorio —` sunt scoase din m² în nesting, în costuri și în stoc. Motorul
de preț folosește acum **exact aceeași regulă**, expusă ca `isAccessoryMat()`
într-un singur loc. O a doua regulă ar fi însemnat că o comandă costă altfel
decât arată devizul intern al atelierului.

Accesoriile devin o linie proprie, la bucată, cu preț în `price_list.accessory`.

**Găsit de avertismentul de material necotat**, care a semnalat bara ca
„preț generic". Fără avertismentul acela, greșeala ar fi trecut tăcută în
fiecare deviz.

### 8.2 Versiuni fantomă: snapshot-ul își includea propria evidență

Proiectul ține minte ultima comandă trimisă (`lastOrder`), ca a doua
trimitere să devină v2 în loc de o comandă nouă fără legătură. Dar
`lastOrder` intra în snapshot, deci **în hash**: a doua apăsare pe „Trimite"
producea alt hash chiar dacă nu se schimbase nicio cotă, iar aplicația
năștea un v2 pentru nimic. Atelierul ar fi primit versiuni fantomă ale unei
comenzi neschimbate — exact zgomotul din cauza căruia oamenii încetează să
citească notificările.

Snapshot-ul e acum **desenul**, nu evidența: `lastOrder`, `orSeeded` și
`demo` se scot înainte de hash. Proba „retrimiterea fără nicio modificare NU
creează o versiune nouă" fixează asta.

### 8.3 Proiectul de start al aplicației nu e bun ca punct de plecare

Aplicația pornește cu un proiect exemplu care are deja piese. Pe linkul unui
atelier, un client necunoscut ar fi văzut o listă de piese străine în loc de
corpul lui.

În mod atelier se înlocuiesc piesele **exemplului** (`demo`) cu dulapul
800×2000×600. Un proiect al utilizatorului nu se atinge niciodată — condiția
e explicită în cod.

### 8.4 Serviciul worker de demontare ar fi înghițit `/a/`

`/sw.js` din rădăcină (v4.25.0) redirecționa orice navigare din afara lui
`/app/` către `/app/`. Cu Order Rail, asta ar fi rupt exact linkul de atelier
pentru utilizatorii care mai au service worker-ul vechi viu — adică pentru
clienții de dinainte. Exclus `/a/` și `/api/`.

---

## 9. Deploy — ce s-a putut și ce nu

`npx netlify-cli status` răspunde **„Not logged in"**. Nu există
`~/.netlify/config.json`, nici `NETLIFY_AUTH_TOKEN` în mediu. `netlify link`
și `netlify deploy --prod` cer amândouă autentificare, care nu se poate face
neinteractiv fără token.

**Deploy-ul NU s-a făcut.** Nu inventez un token și nu raportez ca reușit
ceva ce nu s-a întâmplat.

Ce s-a făcut în loc: aceleași verificări pe care le-ar fi făcut `curl` pe
domeniul public rulează acum în `test/rail.js`, pe un server care imită
`netlify.toml` — rutele, codurile de răspuns, header-ele de securitate.
Comanda de deploy, într-un singur rând, e în `ORDER_RAIL_README.md`.

Ce rămâne nedovedit până la primul deploy real, și trebuie spus:

- **Netlify Blobs în producție.** Funcțiile sunt scrise pe API-ul lui, dar
  au rulat doar contra unei magazii în memorie care imită contractul. Prima
  comandă adevărată e și proba lui.
- **Comportamentul rutelor la Netlify.** `netlify.toml` e citit de proba
  locală doar pentru CSP; regulile de redirect sunt reimplementate, nu
  interpretate de Netlify. Un `curl` după deploy le confirmă în 30 de
  secunde — comenzile sunt scrise în README.
