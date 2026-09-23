# Ebanist — jurnal de versiuni

Formatul: ce s-a schimbat pentru cine folosește aplicația, nu lista de
commit-uri. Versiunile mai vechi de 4.25.0 se citesc din istoricul git.

---

## 4.35.3 — 23 septembrie 2026

**Textele Pro din aplicația Android spun ce se cumpără: plată în avans.**
Planurile din Google Play sunt pentru o lună sau un an, fără reînnoire
automată. Ecranul Pro scrie acum „O lună de Pro — preț” / „Un an — preț” și
„Plată unică… fără reînnoire automată; la final Pro se oprește, îl prelungești
din Ebanist sau din Google Play”. În Setări: „Pro activ · abonament Google Play
· plată în avans, fără reînnoire automată”. Comutatorul e `PLAY_PREPAID`.

---

## 4.35.2 — 23 septembrie 2026

**Planurile Google Play se recunosc după perioadă, nu numai după ID.** Un plan
de bază din Play Console nu-și poate schimba tipul și nici ID-ul refolosi; unul
refăcut (de ex. din „plată în avans” în „reînnoire automată”) primește alt ID.
Aplicația îl găsește acum după perioada lui (lunar / anual).

---

## 4.35.1 — 23 septembrie 2026

**Ecranul Pro din aplicația Android reîntreabă Google Play.** Dacă la prima
întrebare Play nu avea încă planurile (abonament abia creat, Play ocupat),
ecranul rămânea pe „Google Play nu răspunde” până la repornirea aplicației.
Acum reîntreabă la fiecare deschidere și arată codul primit de la Play.

---

## 4.35.0 — 23 septembrie 2026

**Numele pieselor apar în limba ta.** În română, engleză și franceză nu mai
scrie „Fianco”, „Tramezzo”, „Zoccolo”, ci „Laterală”, „Despărțitor”, „Soclu”
(„Side”, „Divider”, „Plinth” / „Côté”, „Séparation”, „Socle”). Se traduc
lista de debitare, planurile de debitare, panoul de piese din 3D, fișa piesei,
distinta PDF, etichetele, fișa de montaj și comparația de recalculare.

- În date, numele rămân în italiană: feroneria, calculele și proiectele vechi
  nu se schimbă. CSV-ul și pachetul de laborator pleacă tot în italiană, ca
  formatul de schimb cu atelierul.
- Un nume scris de mână rămâne cum l-ai scris.
- Căutarea din listă găsește piesa după ambele nume.

---

## 4.34.0 — 23 septembrie 2026

**Ebanist Pro se poate cumpăra din aplicația Android, prin Google Play.**
Regula Google pentru bunuri digitale: în aplicația din Play abonamentul se
plătește numai prin Play. Pe Android, ecranul Pro arată acum cele două planuri
(lunar și anual) cu prețul luat de la Google Play, în moneda utilizatorului, și
condițiile de reînnoire. Lemon Squeezy și pagina de rambursare nu mai apar acolo.

- Plata se confirmă la Google imediat. Pro se activează singur.
- La fiecare deschidere a aplicației se recitește abonamentul din Play. Unul
  anulat sau expirat își ia singur Pro-ul înapoi, la sfârșitul perioadei plătite.
- Setări → „Gestionează abonamentul în Google Play”.
- Codurile de activare EBP merg în continuare. Play nu le atinge.
- În browser și pe calculator nu se schimbă nimic.

Cere aplicația Android 1.2.0 (versionCode 4) și abonamentul `ebanist_pro`
creat în Play Console (planurile `monthly` și `yearly`).

---

## 4.33.1 — 23 septembrie 2026

**Rezumatul se derulează din nou pe telefon.** În aplicația Android pagina
Rezumat nu cobora cu degetul: tabelele de materiale, feronerie și costuri
„prindeau” gestul (efectul de apăsare pornea la începutul scroll-ului).
Tabelele se derulează acum doar lateral, pagina pe verticală.

---

## 4.33.0 — 23 septembrie 2026

**Feroneria mesei și a patului e în catalog și în deviz.** Opt categorii noi
în Catalog → Feronerie: colțar de picior (standard / greu), fixare blat
(colțar / „opt"), feronerie de pat (standard / grea), colțar traversă
centrală, picior central reglabil, suport doagă lateral, suport doagă dublu,
pâslă.

- **O singură numărătoare.** Devizul, Rezumatul pe corp și fișa de montaj
  citesc cantitățile din aceeași funcție. Masa 4 picioare: 4 colțare,
  12 fixări de blat, 4 pâsle. Patul 1600 cu 14 doage: 4 feronerii de pat,
  2 colțare de traversă, 2 picioare centrale, 28 + 14 suporți de doage.
- **Fișa de montaj** arată acum produsul ales din catalog și codul lui.
- **Prețurile sunt orientative și codurile nu sunt încă ale unui furnizor**
  (marcate „cod de confirmat" cu *). Se schimbă din Catalog, ca la orice
  feronerie.

Atenție: **devizul proiectelor existente care au o masă sau un pat crește**
cu feroneria care până acum lipsea.

---

## 4.32.0 — 23 septembrie 2026

**Fișa de montaj pentru masă și pat.** Aceeași fișă ca la corpuri — imagini
3D cu piesele numerotate, lista pieselor, feroneria, sculele, pașii cu cote,
tabelul de control și lista de recepție — acum și pentru masă și pat.

- **Masa:** colțarele de picior cu șurub dublu M8 (la mijlocul traversei),
  ramele cu cele 10 mm lăsate la fiecare capăt pentru colțar, echerul ramei cu
  diagonala în mm, blatul prins cu colțare numărate pe traversă și șuruburi
  alese după grosimea blatului, întoarsă în doi, pâslă.
- **Patul:** se montează în cameră; feroneria de pat la înălțimea
  lateralelor; echerul cu diagonala; traversa centrală sub doage, cu
  picioarele ei centrale la înălțimea calculată; suporții de doage cu prima
  doagă și pasul lor; **salteaua standard care intră** (1600 × 2000 pe patul
  de 1660).

**3D-ul mesei și al patului arată acum ce e în distinta.** Masa avea în 3D
doar două traverse, desenate mai lungi decât în distinta; acum sunt patru, la
cota din distinta. La pat, traversa centrală era desenată cât laterala și
trecea prin doage; acum are 120 mm și stă sub ele. Cotele din distinta nu s-au
schimbat.

Feroneria mesei și a patului (colțare, feronerie de pat, suporți de doage,
picioare centrale) nu e încă în catalog și nici în deviz: fișa calculează
cantitățile și o spune.

---

## 4.31.0 — 23 septembrie 2026

**Fișa de montaj, refăcută de la zero.** Un capitol pe corp, gândit să stea
deschis pe podea în șantier. Toate cotele vin din același model care face
distinta și găurile: înălțimile tălpilor de balama, ale glisierelor, ale
polițelor și ale mânerelor sunt cele ale găurilor, nu numere scrise de mână.

- **Imagini:** corpul asamblat, **vederea explodată cu piesele numerotate**
  exact ca în listă, și feroneria cu corpul în transparență.
- **Ce e:** finisaj corp, fronturi, spate, cu grosimi, și **greutatea
  estimată** — peste 25 kg sau peste 1,6 m, fișa cere doi oameni.
- **Ce trebuie:** lista pieselor (nr., cote, cant, câte găuri, căsuță de
  bifat), feroneria cu produs, cod și cantitate, **sculele** — inclusiv
  burghiele exacte care apar pe piese.
- **Cum se montează:** pași numerotați, cu desen, în ordinea bună: bolțuri și
  dibluri, tălpi de balama și glisiere pe laterale înainte de închidere,
  spatele în canal înainte de tavan, echerul cu **diagonala în milimetri**,
  soclu / picioare / suspendare, ridicat, nivelat, fixare anti-răsturnare
  pentru corpurile înalte, polițe cu înălțimile lor, bara tăiată la cotă,
  sertare, uși cu reglajul (joc lateral, rost, sus, jos), mânere cu interax
  și poziție. Spatele în două bucăți și treapta din perete au pașii lor.
- **Control:** tabel cu cotele de proiect și coloană „Măsurat", listă de
  recepție de bifat, semnături montator / client / dată.

---

## 4.30.0 — 23 septembrie 2026

**Modul Client, pentru tabletă.** Butonul *Client* din colțul de sus întoarce
ecranul spre client. Dispar distinta, codurile, costurile interne, marja; rămân
mobila în 3D, finisajele și prețul final cu TVA.

- **Mobila se prezintă singură:** se rotește încet până când clientul o atinge;
  ușile se deschid, sertarele ies, vederi din față și 3/4.
- **Finisajele se aleg din cercuri de culoare**, pe familii — uni, lemn, lucios,
  beton, textil. Separat pentru fronturi și pentru corp. Prețul se schimbă sub
  ochii clientului, cu diferența față de propunerea inițială.
- **Numai variante de aceeași grosime.** Clientul alege o culoare, nu schimbă
  cote: nicio semnătură nu poate muta un milimetru din distinta.
- **Semnătura:** nume, semnătură cu degetul, bifa de acceptare. Oferta semnată
  se salvează în proiect (finisaje, preț, TVA, semnătură, data) și iese ca PDF
  „Ofertă acceptată", cu semnătura pe ea.
- **Finisajele semnate trec în proiect** și distinta se regenerează — aceleași
  cote, alt material. Dacă un corp are deja piese bifate ca tăiate, nu se
  atinge nimic: aplicația îți spune că e de decis în atelier.
- **Clientul nu iese din greșeală:** butonul Înapoi nu scoate din modul client,
  iar X-ul se ține apăsat o secundă.

Ofertele semnate apar în *Rezumat*, cu PDF-ul lor.

---

## 4.29.1 — 23 septembrie 2026

**Reparat: generatorul se oprea cu „reading 'back_y0'".** După actualizarea la
4.29.0, pe unele telefoane pagina nouă pornea cu motorul geometric vechi,
rămas în memoria browserului. Motorul vechi nu știa de treapta din perete, iar
generatorul se oprea pe spate. Acum generatorul merge și cu motorul vechi (fără
treaptă, ca înainte), iar actualizările descarcă fișierele direct de pe server,
nu din memoria browserului — pagina și motorul vin mereu din aceeași versiune.

---

## 4.29.0 — 23 septembrie 2026

**Spatele în două bucăți, pentru peretele cu treaptă.** În generator, la
„Interior", ai acum *Treaptă în perete, jos*: înălțimea și cât iese. Cazul din
baie — peretele iese jos cu 8 cm. Lateralele primesc decupajul în L jos-spate,
spatele iese din două piese (sus pe planul obișnuit, jos avansat în fața
treptei), iar baza, dacă e sub treaptă, se scurtează cu cât iese treapta. Și
montantul se decupează. Totul intră în distinta cu cotele lui, și controlul de
închidere trece la 0 mm. Dacă o poliță sau un sertar cade în treaptă, aplicația
îți spune — nu le mută singură.

**Fiecare piesă, cu găurile ei.** Atingi o piesă în 3D sau butonul de găuri din
distinta și se deschide *Fișa piesei*: desenul feței 5 (și 6, dacă are) cu
toate găurile colorate după diametru — cupe de balama Ø35, excentrice Ø15,
dibluri Ø8, suporți și șuruburi Ø5 — canalul spatelui, cotele de gabarit, și
tabelul cu fiecare operație: față, X, Y, diametru, adâncime. Găurile vin din
feronerie: balamale cu talpa lor pe laterală, minifix și dibluri la bază și
tavan, suporți de poliță, glisiere, mâneri. Pe un montant, suporții celor două
secțiuni devin o gaură străpunsă. Fișa se exportă și ca CSV.

Cotele de găurire sunt cele din catalogul Blum/Häfele, **neverificate încă pe
o piesă reală** — fișa o spune. Înainte de mașină, se verifică o dată pe o
piesă din atelier.

**Feroneria se vede separat.** Butonul *Feronerie* face corpul transparent și
lasă la vedere balamalele, excentricele, diblurile, glisierele și suporții; în
panoul din dreapta ai lista pe tipuri, cu cantități și coduri.

**3D mai aproape de realitate.** Lemnul are fibră (și nu „alunecă" când
deschizi ușa), lumina e de showroom, cu umbră de contact sub mobilă. Ușile se
deschid și sertarele ies. Poți roti complet, vedea din spate și de jos, și sări
direct la vederile față, lateral, sus, izometric. Un buton trece vederea pe
tot ecranul.

**O aplicație de birou pe ecranul mare.** Pe PC și pe tabletă în landscape,
navigarea stă într-o bară laterală, iar generatorul e un banc de lucru în trei
panouri: parametrii în stânga, 3D-ul în centru, piesele în dreapta — fiecare cu
scroll-ul lui. Distinta se citește ca un tabel, ferestrele se deschid în centru,
nu de jos. Pe telefon rămâne o coloană, cu bara de jos.

**Tipologiile au desen.** În loc de 20 de etichete care umpleau primul ecran,
o bandă de plăci cu mobila desenată — uși, sertare, polițe, proporții.

Reparat pe drum: o bară goală apărea în capul distinta; spatele aripii B a
corpului de colț ieșea în 3D cu materialul carcasei.

---

## 4.28.1 — 21 septembrie 2026

**Panourile vechi sunt din nou în selector.** În 4.28.0 am pus catalogul
Centro Legno în față și am marcat referințele vechi ca „inactive" — ceea ce
le scotea din selectorul generatorului, deși rămâneau în ecranul de catalog.
Greșeala mea: un decor pe care îl ai pe un proiect deschis nu trebuie să
dispară dintr-o listă fiindcă aplicația a decis că e demodat.

Acum se văd toate. Ce s-a schimbat e doar **ordinea**: referințele Centro
Legno apar primele în fiecare familie, cele din catalogul de dinainte după
ele, marcate ca atare. Ce alegi tu să ascunzi rămâne ascuns — dar numai ce
alegi tu.

**Butonul „ascunde / arată" din catalog funcționează de la prima apăsare.**
Ecranul de catalog și selectorul se uitau la două locuri diferite ca să
răspundă la aceeași întrebare — „se vede sau nu?" — și nu erau de acord.
De aici venea și panoul care apărea în catalog dar nu în selector. Acum
întrebarea are un singur răspuns, într-un singur loc.

---

## 4.28.0 — 20 septembrie 2026

**Grosimea vine din materialul pe care îl alegi.** Până acum era un singur
număr per corp, iar `18` stătea scris în opt locuri ca plasă de siguranță —
la selectorul de material, la spate, la desenul tehnic, în nouăsprezece
preseturi. Dacă alegeai o placă de 19, plasa ținea calculul la 18. De aici au
ieșit cele două distincte greșite. Acum fiecare element — laterală, bază,
tavan, spate, poliță, front, soclu, tramezzo — are materialul lui, iar
grosimea e cea a materialului. Un element fără material moștenește structura;
dacă nu există nici structură, aplicația **se oprește și îți spune**, în loc
să inventeze o grosime.

Poți pune grosimi diferite pe același corp: structură 19, tavan 25, spate 3,
poliță 16. Baza și tavanul cu grosimi diferite ies acum în două rânduri, nu
în unul — altfel în segherie ieșeau două panouri identice, unul tăiat din
placa greșită.

**Catalogul Centro Legno, cu selector nou.** Materialele au ieșit din cod în
fișiere pe care le poți edita. Selectorul caută simultan în nume și în cod —
în atelier cauți „22458", în șantier „avocado" — are filtru rapid de grosime
și arată pastila de culoare lângă fiecare referință. Un material per element,
cu „moștenește din structură" ca implicit. Ecranul de catalog are acum câmp
de cod articol și export/import JSON: codurile le citești de pe panoul de
mostre o dată, și nu le mai pierzi.

Culorile sunt marcate ca aproximate până le verifici pe mostră — punctul
galben de lângă nume. Proiectul nou pornește de la **19 mm**, nu 18.

**Distinta nu mai poate ieși greșită.** Înainte de orice export, aplicația
reconstruiește mobilul din piese — fiecare cu grosimea ei — și îl compară cu
ce ai comandat. Toleranță zero. Dacă o cotă nu se închide, exportul se
oprește și îți spune care corp, ce axă, de câți milimetri și ce piese. Pe
lângă asta, zece reguli verifică fiecare piesă la locul ei: poliță cu jocul
ei, sertar care intră până la capăt, uși care acoperă exact deschiderea.

Nu există buton de „continuă oricum". PDF, CSV, pachet de laborator,
etichete, fișă de montaj, desen, comandă — toate trec prin același punct.
Singura ieșire care nu se blochează e copia JSON a proiectului: e cu ea
repari o stricăciune, și nimeni nu taie după un backup.

**Foaia de închidere.** Înainte de distinta care pleacă la debitat vezi un
rând per corp: gabaritul comandat lângă cel recompus din piese, cu grosimile
scrise pe față. Corpurile care nu se închid apar primele, cu roșu. Butonul se
aprinde după ce confirmi că ai citit.

**Dacă schimbi un material după ce ai generat distinta**, aplicația știe și
blochează exportul până regenerezi. O distinta calculată cu o placă și
trimisă după ce ai schimbat-o e același defect, pe altă ușă.

Proiectele salvate se deschid ca înainte. Cele calculate cu motorul vechi
rămân neatinse, ca până acum — se semnalează, nu se rescriu singure.

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
