# Ebanist — jurnal de versiuni

Formatul: ce s-a schimbat pentru cine folosește aplicația, nu lista de
commit-uri. Versiunile mai vechi de 4.25.0 se citesc din istoricul git.

---

## 4.45.0 — 9 octombrie 2026

**Cota de tăiere minus cantul, ca opțiune (D-69). Numai pe web, aplicația Android rămâne pe 4.40.8.** Cerut pentru meseriașii care taie la cota fără cant, ca în aplicațiile de debitare (CutList Optimizer, SketchCut).

- Setări → Panou standard: **„Cota de tăiere minus cantul”**, Da/Nu, implicit Nu. Grosimea cantului e cea din Prețuri („Grosime cant”).
- Activată: cota de tăiere = cota finită minus grosimea cantului pe fiecare latură cu cant. „L” scade din lățime, „C” din lungime. Rotunjirea la 0,1 mm se face o singură dată. 700×300 cu 2L+2C și cant de 2 mm → 696×296.
- **Distinta rămâne pe cota finită.** Cota de tăiere se **adaugă** lângă ea: în listă (✂ sub cote), în PDF (coloana „✂ Tăiere” și nota din subsol) și în CSV (trei coloane la final, deci importul nu se schimbă). Planul de tăiere așază piesele la cota de tăiere și o scrie pe piesă.
- Piesele cu unghiuri sau curbe și accesoriile rămân pe cota finită.
- Motorul nu se schimbă: aceeași distintă, cu opțiunea activată sau nu (test).
- Limita v1: o singură grosime de cant pe proiect. Combinația 2 mm pe fronturi și 0,4 mm în interior nu se poate încă.
- Teste: `edgecomp.test.js` (6). `test:full` 456/456 + golden 42/42, e2e 427/427. Verificat în Chromium: setări, listă, PDF, CSV și planul de tăiere.
- `SW_CACHE`/`CACHE` → `ebanist-v103`.

## 4.44.3 — 8 octombrie 2026

**„Aggiungi pezzo”: câmpul Materiale arată toată lista.** Feedback pe video, pe PC: cu „Pannello HDF 5mm” deja în câmp, săgeata deschidea o listă cu o singură voce și nu se putea alege alt material.

- La click în câmp, textul trece în placeholder și lista se deschide întreagă; ieși fără să alegi → revine valoarea de dinainte. La fel la „Rif. Modulo” și „Elemento”.
- Lista de materiale conține, după cele din proiect, tot catalogul vizibil (listinoul activ primul), nu doar materialele deja folosite.

## 4.44.2 — 7 octombrie 2026

**Mai puține înălțimi decât sertare: cele scrise sunt sus, restul umple spațiul.** Feedback de la testerul IT, pe video. Într-o secțiune cu 4 sertare a scris „200” și i-a rămas un singur sertar. A găsit singur ocolișul „200+200+200+200”, dar „un tâmplar obișnuit n-ar ghici”.

- Numărul de sertare rămâne cel din câmp (sau „Cassetti/sez.”). Înălțimile scrise sunt ale sertarelor de sus, de sus în jos. Sertarele rămase se pun dedesubt și își împart spațiul rămas din zonă, cu „Uguali”, sau iau înălțimea fixă, cu „Fisse”. Dacă sunt mai multe înălțimi decât sertare, crește numărul. Câmpul de număr nu se mai dezactivează.
- „200” pe 4 sertare, zonă 640 → 200 / 142 / 142 / 142, fiecare cutie urmând frontul ei.
- Textul de ajutor și asistentul AI spun regula nouă.
- Teste: `drawerh.test.js` +4. `test:full` 450/450 + golden 42/42, e2e 427/427. Verificat în Chromium pe cazul din video.
- `SW_CACHE`/`CACHE` → `ebanist-v101`.

## 4.44.1 — 7 octombrie 2026

**Lateralele LEGRABOX intră în catalog și în deviz.** Până acum, un sertar LEGRABOX intra în deviz numai cu glisiera MOVENTO. Lateralele metalice se cumpără separat și lipseau din preț.

- Catalog: categorie nouă, „Sponde cassetto metalliche (cp.)” (`HWDB.zarga`). Primul articol: Blum LEGRABOX pure, laterale stânga/dreapta, per. Codul real se formează din 770, înălțime (N/M/K/C/F), NL și 2S, de exemplu 770M5002S. Prețul de pornire e 31 € pe pereche, după SFS (CHF 28,85 net, M NL 300). Articolul e marcat `chk:1`: prețul se corectează în Catalog după furnizorul tău.
- Deviz: `DRAWSYS.legrabox.lat` leagă sistemul de lateralele lui. Se numără o pereche pe sertar (și pe tava extractibilă LEGRABOX), numai la corpurile LEGRABOX. Fișa de montaj are rândul ei la corpul respectiv.
- TANDEMBOX nu are încă lateralele în catalog: n-am găsit un preț european de referință. Matrix Box e set complet.
- `test:full` 446/446 + golden 42/42, e2e 427/427. Verificat în Chromium: trei corpuri (lemn / Matrix / Legrabox) → TANDEM 51 + Matrix 66 + MOVENTO 75 + laterale LEGRABOX 93 €.
- `SW_CACHE`/`CACHE` → `ebanist-v100`.

## 4.44.0 — 7 octombrie 2026

**Adâncimea sertarului, aleasă pe fiecare secțiune** (U.13, a doua parte).

- Formular: în „Cassetti per sezione”, lângă înălțimi, fiecare secțiune are un câmp „NL” (lungimea nominală a glisierei, adică adâncimea sertarului). Gol = cea mai lungă care încape, ca înainte. Se salvează ca `cfg.secDrawerNL`.
- Motor: `drawerPlan(g.nl)` alege cea mai lungă lungime din listă care nu depășește valoarea cerută. Dacă valoarea nu e în listă sau nu încape, apare avertismentul `wDrawNL` („NL 420 … uso NL 400”). Cutia, fundul, 3D-ul și găurirea glisierei urmează NL-ul ales.
- Asistentul AI știe de `secDrawerNL`.
- Un proiect fără `secDrawerNL` dă aceeași distintă (testat).
- Teste: `test/drawerh.test.js` +5. `test:full` 446/446 + golden 42/42, e2e 427/427. Verificat în Chromium: NL 420 → 400 cu avertisment, secțiunea 2 rămâne pe automat (550).
- `SW_CACHE`/`CACHE` → `ebanist-v99`.

## 4.43.0 — 7 octombrie 2026

**Înălțimea fiecărui sertar, scrisă de mână** (ROADMAP U.13). Cerut de testerul IT: un mobilier înalt de 80 cm, cu două sertare de mărimi diferite în aceeași secțiune.

- Formular: în „Cassetti per sezione”, fiecare secțiune are un câmp de înălțimi, de sus în jos, de exemplu „200 / 450”. Câmpul apare și la un corp cu o singură secțiune. Când e completat, numărul de sertare al secțiunii vine din el, iar câmpul de număr se dezactivează. Se salvează ca `cfg.secDrawerH` (listă pe secțiune, de sus în jos).
- Motor: `drawerPlan` primește înălțimile (`g.hs`) și nu le mai împarte din zonă. Dacă nu încap în front, apare avertismentul `wDrawOver`. **Fiecare cutie urmează frontul ei**: la lemn, front − 45; la metal, înălțimea cea mai mare din listă care încape. Asta se aplică numai înălțimilor scrise de mână; „Uguali”, „Fisse” și „cucina” rămân ca înainte.
- Distinta: un rând pe sertar, apoi se adună rândurile cu aceleași cote. Când fronturile sunt egale, iese rândul unic de înainte. Linia de informație și fișa de montaj scriu cutia fiecărui sertar („cassa 530×155/405×550”). Asistentul AI știe de `secDrawerH`.
- Un proiect fără `secDrawerH` dă aceeași distintă (testat).
- Teste noi: `test/drawerh.test.js` (10). `test:full` 441/441 + golden 42/42, e2e 427/427. Verificat în Chromium: 1200 × 800, secțiunea 1 cu „200 / 450”, secțiunea 2 cu sertare egale (317 / 317).
- `SW_CACHE`/`CACHE` → `ebanist-v98`.

## 4.42.2 — 7 octombrie 2026

**Glisierele în deviz, la prețul sistemului fiecărui corp.** Până acum devizul punea la toate glisierele articolul ales în Catalog, inclusiv la sertarele metalice.

- `guidaIdFor(cfg)`: cutia de lemn folosește glisiera din Catalog; un sistem metalic își aduce articolul lui (LEGRABOX → MOVENTO, TANDEMBOX → TANDEM, Matrix Box → set Matrix Box P).
- `computeHardware()` numără glisierele pe articol: un rând pentru fiecare articol, cu prețul lui (inclusiv prețul corectat de utilizator în Catalog). Fișa de montaj, tabelul de feronerie al fiecărui corp și pașii de montaj scriu articolul corpului respectiv.
- Un proiect numai cu sertare de lemn are același deviz ca înainte. Proiectele cu LEGRABOX sau TANDEMBOX își schimbă prețul la glisiere: se trece de la articolul din catalog la cel al sistemului.
- Rămâne: lateralele metalice LEGRABOX/TANDEMBOX nu sunt în catalog și nu intră în deviz. Matrix Box e set complet.
- `run.js`: suma pe categorie adună rândurile; testul `ignore-build` știe de `android-hold` (D-67). Testul căzuse din 4.41.0. E2E 427/427, `test:full` 431/431 + golden 42/42. Verificat în Chromium cu trei corpuri (lemn / Matrix / Legrabox): trei rânduri, 51 + 66 + 75 €.
- `SW_CACHE`/`CACHE` → `ebanist-v97`.

## 4.42.1 — 7 octombrie 2026

**Glisierele din catalog, vizibile în Genera, și Häfele Matrix Box P ca sistem de sertar.** Bug raportat de testerul IT pe video: Setări → Catalog are 5 glisiere, dar „Sistema cassetto” arăta doar Legno / Legrabox / Tandembox / Solo frontale.

- Glisiera aleasă în catalog se aplica deja sertarului de lemn, dar formularul nu o arăta. Acum opțiunea o scrie: „Cassetto in legno · MOVENTO BLUMOTION”.
- **Matrix Box P e sistem nou de sertar**, cu formulele din catalogul Häfele DGH-M 2021 (MB 9.8–9.9). Fund de 16 mm = (NL − 3) × (LW − 62). Spatele are lățimea LW − 62 și înălțimea 53 / 69 / 92 mm pe laterale de 60 / 92 / 115. Adâncimea minimă a corpului e NL + 3, iar NL merge de la 270 la 650. Rămâne `chk:1` (de confirmat pe o piesă reală).
- **Lățimea cutiei de lemn vine dintr-un singur loc.** `woodDed()` citește `slideById()` din `ebanist-core.js`, aceeași tabelă pe care o folosește verificarea de închidere. Cu „Matrix Box” aleasă ca glisieră, cutia ieșea cu 50 mm mai lată decât aștepta verificarea (25 față de 75; acum 62, din catalogul Häfele). Celelalte glisiere nu se schimbă (42 / 42 / 25 / 26).
- `ebanist-core.js`: `haf_matrix` → `rear 3`, `ded_lat 62`; `CORE_REV` 4.42.1.
- Teste noi: `test/matrix.test.js` (7). `npm run test:full`: 431/431 + golden 42/42. Verificat în Chromium: lista de sisteme și cotele Matrix în distintă.
- Rămâne de făcut: devizul pune la glisiere prețul articolului ales în catalog și pentru sistemele metalice (Legrabox, Tandembox, Matrix). Prețul pe sistem sau pe corp ține de U.2.
- `SW_CACHE`/`CACHE` → `ebanist-v96`.

## 4.42.0 — 7 octombrie 2026

**Raft extractibil** (ROADMAP U.12). Cerut de același tester: în tronsonul pentru aparatură (lampă UV, freză), raftul trebuie să iasă pe glisiere.

- Formular: sub „Contenuto sezioni” apare „Ripiani estraibili”, cu câte un buton pentru fiecare secțiune cu rafturi. În secțiunea marcată, rafturile devin tăvi pe glisiere, la aceleași cote. Se salvează ca `cfg.secPull`.
- Tava e cutia unui sertar fără front, făcută cu sistemul ales pentru sertare. La lemn are laterale de 70 mm (`PULL_FH`) și fund HDF. La metal ia înălțimea cea mai mică din listă. La „Solo frontale” se face din lemn. În spatele ușilor se retrage ca sertarul interior, ca să treacă brațul balamalei.
- Distinta are rânduri proprii („Fianco / Fronte-Retro / Fondo ripiano estraibile”), cu rolurile cutiei de sertar, deci închiderea (D-43) și invariantele le verifică. Devizul numără câte o pereche de glisiere pe tavă. Găurirea glisierelor iese din `ebanist-ops.js`, iar „Apri” deschide tava în 3D.
- Linia de informație și fișa de montaj au un rând pentru tăvi. Asistentul AI știe de `secPull`.
- Un proiect fără `secPull` dă aceeași distintă (testat).
- Teste noi: `test/pullout.test.js` (11). `npm run test:full`: 424/424 + golden 42/42. Verificat în Chromium: 4 / 4 / 3 sertare, plus 1 sertar cu tava deasupra; 13 perechi de glisiere în deviz.
- Numai pe ebanist.com (`netlify/android-hold` rămâne).
- `SW_CACHE`/`CACHE` → `ebanist-v95`.

## 4.41.0 — 7 octombrie 2026

**Număr de sertare diferit pe fiecare secțiune** (ROADMAP U.11). Un tester din Italia face un mobilier pentru un salon de estetică, cu patru tronsoane: câte 4 sertare în primele două, 3 în al treilea, 1 sertar cu raft deasupra în al patrulea. „Cassetti/sez.” era un singur număr pentru toate secțiunile, așa că devizul se făcea din corpuri separate, cu laterale duble în loc de despărțitori.

- Formular: sub „Cassetti/sez.” apare „Cassetti per sezione”, cu un câmp pentru fiecare secțiune care primește sertare. Câmp gol = valoarea comună, 0 = secțiunea rămâne fără sertare. Se salvează ca `cfg.secDrawers`.
- Motor (`buildCore`): un `drawerPlan` pentru fiecare număr de sertare, iar secțiunile cu același număr îl împart. Rândurile identice din distintă se adună. Raftul de deasupra unei secțiuni „cassetti + ripiani” pornește de deasupra sertarelor ei. Rezultatul are în plus `draws` (un plan pe grup); `draw` rămâne primul plan.
- Feroneria se numără din fronturi, deci glisierele urmează singure. Linia de informație și fișa de montaj scriu câte o linie pentru fiecare plan („Sez. 1, 2 (4×): …”).
- Asistentul AI știe de `secDrawers`.
- Un proiect fără `secDrawers` generează aceeași distintă, rând cu rând (D-39); testul o verifică.
- Teste noi: `test/secdrawers.test.js` (14). `npm run test:full`: 413/413 + golden 42/42. Verificat în Chromium pe aplicația reală: 4 / 4 / 3 / 0 în formular, în 3D și în distintă.
- **Numai pe ebanist.com.** `netlify/android-hold` oprește deploy-urile proiectului Android (whimsical-wisp), care rămâne pe 4.40.8 până după aprobarea Google Play.
- `SW_CACHE`/`CACHE` → `ebanist-v94`.

## 4.40.8 — 6 octombrie 2026

**Dulapul cu uși glisante se deschide.** „Apri” rămânea fără efect la uși glisante, în vizualizarea 3D a configuratorului, în previzualizare și în Modul Client. Rotația pornea numai de la ușile cu balamale (`sub:"door"`, cu pivot), iar ușile glisante (`sub:"slide"`) nu au balamale. Raportat de un client Pro.

- `viewer3d.js`, `slideOpenX()`: fiecare ușă de pe șina din față alunecă peste ușa cea mai apropiată de pe șina din spate și descoperă compartimentul de sub ea.
- Verificat în Chromium cu WebGL: dulap glisant 2400, cu 2 uși; deschis, ușa din dreapta stă peste cea din stânga.
- `SW_CACHE`/`CACHE` → `ebanist-v93`.

## 4.40.7 — 6 octombrie 2026

**Un profil gola ales în catalog nu mai găurește frontul.** În Setări → Catalog → Mânere se poate alege „Profilo presa Gola/L” (Häfele), dar aplicația îl trata ca pe un mâner obișnuit. Fiecare ușă și fiecare front de sertar ieșea cu cele două găuri de 128 mm, iar fișa de montaj scria interaxul. La un front fără mâner, găurile acelea strică panoul. Defectul l-am găsit analizând cererea unui client Pro pentru gola.

- `handleIsProfile()` (index.html) citește articolul ales la „man”. Articolele cu `profile:1` din catalog (acum `haf_profil`) nu dau găuri de mâner în `ebanist-ops.js`, la fel ca push-ul. Balamalele rămân.
- Profilul rămâne în deviz, cu bucata pe front, ca înainte. Gola adevărată (fronturi scurtate, profil la metru în L/C, decupare în laterale) e ROADMAP U.7.
- Teste noi: 4 în `ops.test.js`. Verificat în Chromium pe aplicația reală: uși 2 → 0 mânere, sertare 3 → 0, balamalele neschimbate.
- `SW_CACHE`/`CACHE` → `ebanist-v92`.

## 4.40.6 — 6 octombrie 2026

Două corecturi în camera 3D, raportate de același client Pro după ce a verificat 4.40.5.

- **Fronturile de sertar aveau culoarea structurii.** Rolul `cassetto_frontale` nu are cheie de material proprie, așa că prelua materialul structurii, nu pe cel al frontului. Acum orice front, ușă sau sertar, are materialul frontului.
- **Sertarele nu se deschideau.** „Ante aperte” rotea numai ușile. Acum sertarele ies cu frontul și cutia lor, cu 55% din adâncimea cutiei, ca în vizualizatorul 3D al corpului.
- Verificat în Chromium (Playwright): o comodă cu sertare (structură antracit, fronturi verzi) și un corp cu uși pe același perete; fronturile sunt verzi, iar deschise ies cu 270 mm.
- `SW_CACHE`/`CACHE` → `ebanist-v91`.

## 4.40.5 — 6 octombrie 2026

Două corecturi în Releveu → camera, semnalate de un client Pro.

În producție pe 06.10 (ebanist.com și aplicația Android). Utilizatorii o primesc la a doua deschidere a aplicației, sau imediat din Setări → „Verifică actualizări”. Versiunea se citește în josul Setărilor: `Ebanist v4.40.5`.

- **Camera în 3D era toată albă.** Toate corpurile se desenau cu materialul implicit din Setări (`bianco_19`), oricare ar fi fost materialul ales pe corp. Acum fiecare piesă are culoarea materialului rolului ei din corpul ei (`roleMatId`), cu uși și structură separat. Fără venaturi în cameră: modelul acela există doar pentru un singur material.
- **Cota de poziție (X/Y/Z/R în bara corpului selectat, și cota din lista de amplasare) nu se putea scrie.** La fiecare cifră `renderPlan()` reconstruia câmpul: focusul se pierdea după prima cifră, tastatura se închidea, iar „900” devenea „9”. Acum câmpul în care se scrie nu se reconstruiește, iar restul se reîmprospătează când focusul iese din el.
- În cameră, ușile deschise se deschid pe partea `hinge` când e scrisă pe ușă (ca în 4.40.4); altfel, ca înainte.
- Verificat în Chromium (Playwright): pe codul vechi „900” devenea 9 și camera ieșea albă; pe cel nou, 900 și culorile corpurilor.
- `SW_CACHE`/`CACHE` → `ebanist-v90`.

## 4.40.4 — 6 octombrie 2026

**Partea balamalei scrisă la ușile cu cote se respectă acum în găurire și în 3D.** Cu asistentul AI, o ușă cu `hinge:"right"` era acceptată și afișată în patch, dar `physicalPieces()` pierdea câmpul: cupa, diblurile, talpa pe laterală și mânerul ieșeau după regula fixă (o ușă singură pe stânga, perechile stânga/dreapta), iar în 3D ușa se deschidea tot pe partea aceea. Corectură care ajunge la mașină, semnalată de un client Pro.

În producție pe 06.10.

- `ebanist-ops.js`: piesa fizică poartă `hinge` de pe cutie; `hingeLeft` vine din `hinge` când există, altfel regula de până acum. Ușile fără cote nu se schimbă.
- O pereche inversată (balamalele la mijloc) are nevoie de un despărțitor acolo; fără el rămâne avertismentul `opsNoHingePanel`, ca înainte.
- Teste noi: 4 în `ops.test.js` (ușă singură pe dreapta, pereche inversată, fără `hinge` = ca înainte, talpa pe despărțitor).
- `SW_CACHE`/`CACHE` → `ebanist-v89`.

## 4.40.2 — 3 octombrie 2026

Dictarea în aplicația Android: dacă puntea are `EbanistAndroid.speech`, microfonul folosește recunoașterea vocală a sistemului (Android 1.2.1). Cu un `.aab` mai vechi și în browser, totul rămâne ca înainte.

- `SW_CACHE`/`CACHE` → `ebanist-v87`.

## 4.40.3 — 3 octombrie 2026 (completare)

- `netlify/edge-functions/pro-proxy.js`: pe orice adresă în afară de ebanist.com, `/api/pro` e trimis la `https://ebanist.com/api/pro`. Aplicația Android încarcă `whimsical-wisp-61cbbf.netlify.app`, un proiect Netlify separat, fără `STRIPE_SECRET_KEY` și `PRO_COMP_CODES`. Acum `sub_…` și `comp_…` se verifică și acolo, cu cheile dintr-un singur loc. Se scoate odată cu ROADMAP L.10. Test nou: `test/pro-proxy-edge.test.mjs`.

## 4.40.3 — 3 octombrie 2026

**Pro gratuit, pe viață, pentru autor și testeri (D-63).** Un cod `comp_…` (24–64 de caractere aleatoare) se pune în ecranul Pro la „Am deja o cheie”, ca un `sub_…`.

- `/api/pro`: `{ sub: "comp_…" }` se caută în variabila Netlify `PRO_COMP_CODES` (separate prin virgulă, spațiu sau rând nou), fără Stripe. Răspunde `plan:"comp"`, `periodEnd:null`. Un cod scos din listă dă 404, iar aplicația închide Pro la reverificarea de 7 zile.
- `ebanist-license.js`: `comp_…` e recunoscut și verificat pe același drum ca abonamentele Stripe.
- Teste noi: 3 în `pro-fn.test.mjs`, 1 în `license.test.js`.
- `SW_CACHE`/`CACHE` → `ebanist-v88`.

## Android 1.2.1 (versionCode 5) — 3 octombrie 2026

**Butonul AR nu mergea în aplicația Android din 1.1.0** (WebView-ul propriu care a înlocuit TWA-ul): apăsat, arăta „Nicio aplicație de pe telefon nu poate deschide acest link”. Scene Viewer se deschide printr-un link `intent://`, pe care Chrome îl înțelege singur, iar WebView-ul nu. `MainActivity.openExternal` îl trimitea ca `ACTION_VIEW` pe schema `intent`, pe care nu o deschide nicio aplicație.

- `openIntentUri`: `Intent.parseUri(…, URI_INTENT_SCHEME)`, numai activități `BROWSABLE`, fără componentă sau selector impuse de pagină. Dacă ARCore lipsește, se deschide pagina lui din Play (ca în Chrome), apoi `browser_fallback_url`.
- **Dictarea** (microfonul din „Descrie mobila”) nu mergea nici ea: WebView-ul nu are Web Speech API. Puntea nouă `EbanistAndroid.speech(lang)` deschide recunoașterea vocală a sistemului (`RecognizerIntent`, fără permisiune de microfon în aplicație); textul vine înapoi prin `window.__ebSpeech`. Partea web e în 4.40.2.
- Cere `.aab` nou.

## 4.40.1 — 3 octombrie 2026

Corectură de text pe site, secțiunea Preț: nota de sub tabel spunea doar „Anulezi când vrei”, deși Founders e plată unică. Acum spune că abonamentul se anulează oricând, iar Founders se plătește o singură dată (RO, EN, IT, FR).

- `SW_CACHE`/`CACHE` → `ebanist-v86`.

## 4.40.0 — 3 octombrie 2026

**Ce primești cu Pro, scris rând cu rând, în aplicație și pe site.**

- Ecranul Pro din aplicație: lista de 5 avantaje (veche, mai spunea „2 proiecte” și „pachet JSON”) e înlocuită de un tabel Gratuit / Pro cu 12 rânduri, aliniat cu ce blochează efectiv `proGate` (D-55: 1 proiect gratuit, toate documentele Pro). Sub tabel, cele trei moduri de plată (lunar, anual, Founders) și fraza „toate trei deblochează aceleași funcții”. Pe Android (Google Play) apare doar tabelul.
- Site, secțiunea Preț: al treilea nivel, Founders (149 €, din `billing.js`, butonul duce la linkul Stripe; dacă `LINK_FOUNDERS` e `null`, nivelul dispare), apoi același tabel de comparație. Founders e adăugat și în JSON-LD.
- Texte în ro, it, en, fr (`cmp_*` în aplicație, `cmp.*` și `price.fd*` în `site-src/i18n`).
- `SW_CACHE`/`CACHE` → `ebanist-v85`.

## 4.39.0 — 3 octombrie 2026

**Founders: Pro pe viață, 149 €, plată unică, limitat la 100.** A treia opțiune din ecranul Pro, sub lunar și anual.

- `app/config/billing.js`: `LINK_FOUNDERS` (`buy.stripe.com/4gM3…02`) și `PRICE_FOUNDERS`. Pus pe `null`, butonul dispare (ofertă închisă).
- `/api/pro`: o sesiune de checkout în modul `payment` se verifică după rândurile ei (`line_items`), lookup key `ebanist_pro_founders`. Răspunde fără dată de expirare, plan `founders`. Dacă plata a fost rambursată integral, statusul devine `expired` (cere drept de citire pe Payment Intents; fără el, rambursarea nu se verifică și clientul rămâne Pro).
- Codul de activare pe alt dispozitiv e id-ul sesiunii (`cs_live_…`), recunoscut în câmpul de cheie la fel ca `sub_…`. Reverificarea la 7 zile trimite sesiunea.
- Teste noi în `test/pro-fn.test.mjs` (5): plătit, rambursat, cheie fără permisiune, neplătit, alt produs.
- `SW_CACHE`/`CACHE` → `ebanist-v84`.

## 4.38.3 — 2 octombrie 2026

Corecturi găsite la înregistrarea clipurilor pentru YouTube, pe aplicația reală. Nicio cotă din distinta nu se schimbă: golden-urile validate (42/42) rămân identice, motorul (`ebanist-core.js`) nu e atins.

- **Verificările de coerență vorbesc limba interfeței.** Motivele din foaia de închidere și din foaia de verificare („Adâncimea recompusă din laterală…”, „Polița e mai adâncă…”) erau scrise în română și apăreau așa și în engleză, italiană și franceză. Acum se traduc la afișare (fișier nou `app/ebanist-au-i18n.js`, indexat după textul exact din motor), la fel rândul cu cotele („600 mm ordered, 560 mm from the parts (−40 mm)”) și numele pieselor implicate. Testul nou `test/au-i18n.test.js` pică dacă o regulă nouă din motor nu are traducere în it, en, fr.
- **Foaia de închidere nu mai taie mesajul la jumătatea unui cuvânt** („… · Fian”): fiecare motiv pe rândul lui, întreg.
- **„Modifică piesa” arată numele piesei în limba interfeței** („Side”, „Côté”, „Laterală”), nu numele intern italian („Fianco”). La salvare, distinta păstrează numele intern, deci etichetele și rolurile rămân aceleași; și lista de sugestii e tradusă.
- **Același număr de piese peste tot (D-61), și în locurile rămase:** mesajul de după „Generează”, foaia de închidere și fișa de montaj („Numără piesele”) spuneau 30 pentru un dulap de 29 de piese, pentru că adunau și bara de umerașe.
- `SW_CACHE`/`CACHE` → `ebanist-v83`.

## 4.38.2 — 30 septembrie 2026

Corecturi găsite în testarea închisă, la capturile pentru Google Play. Nicio cotă din distinta nu se schimbă: golden-urile validate (42/42) rămân identice.

- **Fișa de montaj și distinta spun aceleași cote.** 3D-ul (și din el Modelul de Operații și fișa de montaj) desena raftul mobil la toată lățimea secțiunii (471,5), fără jocul pe care distinta îl scade (469), și fundul de sertar între fața și spatele cutiei (462), nu în canal cum e tăiat (480; la sertarele metalice 500 în loc de 490). Acum 3D-ul desenează piesa din distintă (D-52). Fișa de montaj tipărește cota rândului de distintă, deci aceeași cu eticheta (un front de 463,5 în 3D e 464 pe ambele).
- **Un singur număr de piese.** Același dulap arăta 26 de piese sub 3D, 29 în „Piese” și 30 în distintă. Acum toate ecranele (generator, distinta, proiecte, optimizare, sumar, PDF, statistici) numără piesele tăiate din placă: fundurile HDF intră, accesoriile (bara de umerașe, picioarele, sticla) nu. Costurile și Order Rail nu se schimbă.
- **Materialele în limba interfeței.** Catalogul Centro Legno are nume traduse pentru culorile simple (Bianco → White / Alb / Blanc, Nero, Grigio medio, Rovere chiaro, Tessuto…); numele de decor ale furnizorului rămân. Accesoriile („Accessorio — asta appendiabiti ovale”) apar în limba aleasă. Rândurile deja salvate își păstrează eticheta (D-39, D-42) și se traduc doar la afișare.
- Test nou `test/model-distinta.test.js`: pentru fiecare tipologie, fiecare piesă din 3D trebuie să aibă rândul ei de distintă la aceleași cote (0,5 mm). Înainte, potrivirea accepta 2,5 mm și de aceea n-a văzut raftul.
- `SW_CACHE`/`CACHE` → `ebanist-v82`.

## 4.38.1 — 29 septembrie 2026

- În panourile care se derulează (Setări, AI, Pro), butonul X nu mai acoperă textul de sub el: după primul scroll stă pe o bandă opacă, iar conținutul trece pe sub ea.
- Termeni, Rambursare, Confidențialitate: vânzătorul înregistrat (*merchant of record*) e **Link, LLC** (Dublin, TVA OSS EU440000220), cum scrie pe factura Stripe, nu „Stripe”. Chitanța vine de la Link, iar pe extras plata apare ca `LINK.COM* EBANIST.COM`.
- Setări: după ce abonamentul web s-a încheiat, „Copiază codul pentru alt dispozitiv” nu mai apare (codul nu mai activează nimic). „Deconectează” rămâne.
- `SW_CACHE`/`CACHE` → `ebanist-v81`.

## 4.38.0 — 27 septembrie 2026

**Pro se poate plăti pe web, prin Stripe (D-58).**
- Butoanele Pro din browser deschid linkul de plată Stripe (Managed Payments: Stripe e *merchant of record*, facturează și colectează TVA-ul). Contul e pe Domus Renov SRL. În aplicația Android rămâne numai Google Play (D-54).
- După plată, Stripe trimite clientul înapoi la `/app/?stripe=1&session_id=…`. Aplicația întreabă `/api/pro` (funcție Netlify nouă, cu `STRIPE_SECRET_KEY` numai pe server) și Pro pornește singur, fără cheie de copiat.
- Codul abonamentului (`sub_…`) activează Pro pe alt dispozitiv: Setări → „Copiază codul”, apoi îl lipești în câmpul de cheie de pe celălalt dispozitiv. Reverificare o dată la 7 zile și imediat după data de reînnoire. Offline nu se schimbă nimic; Pro cade numai când Stripe spune că abonamentul s-a încheiat, cu aceleași 14 zile de grație.
- Numai prețurile cu lookup key `ebanist_pro_monthly` / `ebanist_pro_yearly` deblochează Ebanist.
- Termeni, rambursare, confidențialitate și landing: Stripe în loc de Lemon Squeezy, furnizor Domus Renov SRL.
- `SW_CACHE`/`CACHE` → `ebanist-v80`.

## 4.37.3 — 24 septembrie 2026

- Fonturile (Barlow, Barlow Condensed) se servesc din `/fonts/`, nu de la Google Fonts: pagina nu mai trimite IP-ul vizitatorului la Google.
- Order Rail: inbox-ul unui atelier real se deschide doar cu PIN-ul secret (`INBOX_PIN_<SLUG>`); PIN-ul public merge numai la `demo`. Blocare 15 minute după 10 PIN-uri greșite. Pe pagina publică a comenzii, telefonul clientului e mascat.
- Termeni, rambursare, confidențialitate: aliniate între ele și cu aplicația (auditul juridic e în repo-ul privat ebanist-hq).
- `SW_CACHE`/`CACHE` → `ebanist-v79`.

## 4.37.2 — 24 septembrie 2026

**AI Magic Input, după primul test real cu promptul Jacquin.**
- **Decupajele nu mai inversează axele**: câmpurile se cheamă acum `height` (pe înălțimea piesei) și `depth` (pe adâncime), nu `w`/`h`. Modelul citea „600 × 110" invers și ieșea un decupaj de 600 mm adâncime pe o laterală de 341.
- **Grosimea spusă e obligatorie**: „truciolare 19" nu mai poate deveni un PAL de 18. Dacă sunt mai multe materiale de 19, modelul îl alege pe cel mai apropiat de nume și întreabă de celelalte.
- **Distinta așteptată scrisă în prompt nu mai blochează.** Numerele de verificare sunt comparate cu piesele generate:
  - piesele așteptate („Fianco 2260 × 341");
  - pila de verificare („20 + 19 + … = 2280");
  - fața de sus a unei polițe (1558), marginea de sus a unei uși (2278), rostul (3), golurile coloanei (287, 288), fața de jos a tavanului (2261).
- **Când piesele nu se pot genera**, cotele de verificare apar ca „încă neverificate", nu ca „pierdute".
- `CORE_REV` 4.37.2: un telefon cu motorul vechi în cache își reîncarcă motorul la pornire.

---

## 4.37.1 — 24 septembrie 2026

**Repară „validateLayout is not defined" după actualizarea la 4.37.0.**
- Telefonul putea rămâne cu pagina nouă și motorul geometric vechi în cache. Asistentul cădea la primul „Genera".
- Pagina verifică acum revizia motorului la pornire. Dacă e veche, descarcă imediat una proaspătă, înainte de orice altceva.
- Service worker-ul nu mai actualizează `index.html` singur, în fundal. Tot pachetul aplicației se schimbă odată, la instalarea versiunii noi.

---

## 4.37.0 — 24 septembrie 2026

**AI Magic Input înțelege cote absolute și nu mai pierde nimic în tăcere.**
Un prompt complet („setto care se oprește la 1539, 3 polițe în dreapta la 620, 926, 1232, adâncime 250 sub 620…") dădea 13 piese în loc de 16 și 4 uși egale: cotele n-aveau unde să aterizeze și erau aruncate fără niciun mesaj.
- **Cote absolute în corp** (toate opționale, proiectele vechi generează identic):
  - `partitions` — despărțitoare verticale la cota lor (`yStart`/`yEnd`, pot să se oprească la jumătate) și polițe la cota feței de jos, pe toată lățimea sau doar într-o coloană;
  - `depthProfile` — adâncime pe zone de înălțime; se rezolvă în treapta deja verificată (laterale decupate, bază scurtată, spate din două bucăți);
  - `fronts` — uși cu poziție și dimensiuni explicite (ex. 2 jos + 2 sus);
  - `customCuts` — decupaje dreptunghiulare în colțul lateralelor și despărțitoarelor. Piesa rămâne în distintă la dreptunghiul complet; decupajul apare pe desen și pe etichetă.
- **Validare înainte de generare**: o poliță care taie un despărțitor, un despărțitor care se termină în gol, două piese suprapuse, o ușă în afara gabaritului, un decupaj care nu se potrivește cu profilul — toate opresc generarea, cu motivul scris.
- **Nicio cotă ignorată**: fiecare număr din text trebuie să ajungă într-un câmp sau într-o piesă. Dacă rămâne unul neinterpretat, „Aplică" dispare și se afișează lista.
- **Ecran de confirmare cu tabelul pieselor**: denumire, dimensiune, bucăți, cotă, decupaje, total m² și ml de cant, plus pila verticală pe fiecare coloană („20 + 19 + 1500 + 19 + 342 + 19 + 342 + 19 = 2280").
- Generatorul arată o bandă „Cote absolute active", cu buton de ștergere.
- Test nou: `cd test && npm run test:layout` (corpul Jacquin 870 × 2260 × 360, 16 piese, 7,40 m²).

---

## 4.36.2 — 24 septembrie 2026

**Backup-ul se poate restaura din nou pe Android.**
- Pe Android, selectorul de fișiere lăsa să se aleagă numai CSV — backup-ul `.json` nu apărea. Acum se poate alege orice fișier.
- **Setări → „Restaurează din fișier (backup .json)”**: buton direct pentru restaurare (înainte era doar Proiecte → Importă).
- Cheia Anthropic nu intră în backup, intenționat: după restaurare se pune din nou în Setări → Asistent AI.

---

## Pagini legale — 24 septembrie 2026

**Termenii, confidențialitatea și rambursările spun acum ce e adevărat.**
- **Termeni:** gratuit și Pro, așa cum sunt din 4.36 (un proiect gratuit, documentele în Pro); cumpărarea prin Google Play în aplicația Android (plată în avans, fără reînnoire automată, vânzător Liviu George Serban, rambursări după politica Google Play); pe web, plata online vine mai târziu, până atunci Pro se activează cu cod.
- **Confidențialitate:** rândul pentru Google Play Billing (ce primește aplicația: doar confirmarea achiziției, fără nume, email sau card).
- **Rambursări:** cum se cere o rambursare pentru o cumpărare din Google Play.

Bannerul „de verificat de un jurist” rămâne pe pagina de termeni.

---

## 4.36.1 — 24 septembrie 2026

**Audit complet: 19 tipologii × 4 limbi × telefon/tabletă/PC.** Am trecut prin
toate vederile, 3D-ul, documentele, modul Client și foile, căutând erori JS,
texte stricate („undefined”, „NaN”), traduceri lipsă și ecrane care ies din pagină.
Au ieșit la iveală cinci erori, toate reparate:

- **Uși glisante și dressing:** distinta era blocată. Spatele din HDF se
  împărțea după placa de proiect (2800×2070), nu după placa HDF-ului
  (2750×1300), și ieșea o piesă de 1778 mm care nu intra în placa ei. Acum se
  împarte după formatul materialului, cu îmbinările în spatele polițelor.
- **Colțar:** distinta era blocată. Verificarea fronturilor aduna ușile ambelor
  aripi, fiindcă rândurile salvate nu mai știau din ce aripă vin. Acum aripa se
  citește din numele modulului.
- **Order Rail:** atelierul primea comanda fără distinta PDF. Captura
  automată se oprea la foaia de închidere. Acum trece dacă toate corpurile se
  închid și se oprește dacă unul nu se închide.
- **Order Rail:** fiecare comandă apărea cu „preț generic”. Listele de prețuri
  ale atelierelor demo aveau doar codurile vechi de materiale; acum le au și pe
  cele din catalogul curent.
- **Masă, pat, birou, corpuri rotunde:** panoul de piese spunea „Nicio piesă:
  configurează corpul”. Acum spune că piesele sunt în listă, dar găurile nu sunt
  încă în modelul 3D.

Goldenele validate nu s-au schimbat (42/42).

---

## 4.36.0 — 23 septembrie 2026

**Gratuitul arată ce face aplicația, Pro produce.**

- **Gratuit:** 1 proiect propriu (exemplul nu se socotește). Toate tipologiile,
  3D-ul cu piese și găuri, lista de debitare și devizul pe ecran, releveul,
  câte panouri ies la debitare.
- **Pro:** proiecte nelimitate, distinta PDF, CSV, etichetele, fișa de
  montaj, desenul tehnic, comanda de feronerie, oferta PDF, modul Client cu
  semnătură, planurile de tăiere cu ordinea tăierilor și resturile în stoc,
  fișa piesei cu găuri și CSV-ul lor, JPG, AR, „În camera ta”.
- Nimic nu se pierde. Proiectele existente rămân deschise și editabile, iar
  backup-ul nu e blocat niciodată. Poarta Pro apare înainte de lucru, nu după.
- Filigranul nu se mai vede: un document de atelier iese curat, și numai din Pro.

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
