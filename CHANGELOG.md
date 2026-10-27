# Ebanist — jurnal de versiuni

Formatul: ce s-a schimbat pentru cine folosește aplicația, nu lista de
commit-uri. Versiunile mai vechi de 4.25.0 se citesc din istoricul git.

---

## 5.5.0 — 27 octombrie 2026

**Corpul de colț: colțul interior era pus greșit în 3D și în planul de montaj — corectat.**
- La **colț interior** (colț de cameră), ala B a corpului de colț (`angolare`) se întindea spre −z, adică **în interiorul peretelui A**, nu în cameră. Distinta (cotele pieselor) era corectă, dar așezarea celor două aripi în 3D, în explodat, în AR și în fișa de montaj era în perete. Acum ala B începe de la **fața alei A** (cu tot cu uși), stă pe partea camerei și se sprijină cu spatele pe peretele B, la stânga și la dreapta.
- Preview-ul spune cât trebuie să măsoare peretele B de la colț: lățimea alei B plus adâncimea alei A.
- **Colțul exterior (spigol ieșit) nu s-a schimbat.**
- Cotele din distinta corpurilor de colț nu s-au schimbat (golden 19–22 identice).
- Teste: 733 în browser; fuzz pe configurații aleatoare: 128 de cazuri cu „ala B nu începe la fața lui A” pe codul vechi, 0 pe cel nou. În fuzz mai apar pe corpurile de colț constatări vechi, neatinse de această corecție (reguli V3, invariantul I4, coliziuni la bara de umerașe); sunt de analizat separat.

---

## 5.4.0 — 27 octombrie 2026

**Colț între doi pereți** pentru lambriul cu lamele și boiseria cu rame.
- În Generator, la lambriu și boiserie: „Al doilea perete (colț)” = Da aduce lățimea peretelui B (câmpul „Largh. ala B”), partea colțului (stânga/dreapta) și felul lui (interior = colț de cameră, exterior = colț ieșit).
- **La colț interior, placarea lui B începe la fața placării lui A**: lățimea lui B se scade cu grosimea totală (suport + lamelă sau ramă). La colț exterior, B are lățimea întreagă. Fiecare perete se potrivește singur (lamele și rosturi, sau câmpuri și rame) cu aceeași închidere exactă ca la un perete singur.
- **Decupajele (prize) au alegere de perete (A sau B)**; pentru B, X se măsoară de la colț. Un decupaj din B în grosimea lui A se respinge.
- Distinta are piesele pe module „Nume A” și „Nume B”, ca la corpurile de colț. 3D-ul pune pereții în unghi drept, fără suprapuneri; preview-ul spune colțul și lățimea lui B, iar pașii de montaj sunt pe A și pe B cu felul colțului.
- Dictarea cu AI cunoaște „al doilea perete” și decupajele pe perete; textele sunt în 7 limbi.
- Limite: colț de 90° (nu alt unghi); colțul exterior are muchia lui A la vedere (fără tăietură în unghi la 45°); lățimea lui B trebuie să fie mai mare decât grosimea totală.
- Teste: 731 în browser, 7 unitare noi (patru colțuri fără suprapuneri), fuzz D-78 pe 15000 de configurații fără abateri, golden 44 și 45 verificate aritmetic, `validat:false`.

---

## 5.3.0 — 27 octombrie 2026

**Boiserie cu rame și câmpuri** — placare de perete cu rame aplicate pe un suport (stilul clasic și cel modern „boiserie”), lângă lambriul cu lamele.
- În Generator, tipul „Boiserie cu rame”: lățimea peretelui, înălțimea, lățimea ramei, lățimea dorită a câmpului și numărul de rânduri de câmpuri. Materialul corpului = ramele, materialul spatelui = suportul (câmpul); grosimile vin din materiale (D-41).
- **Câmpurile se potrivesc exact**: numărul de câmpuri e cel mai apropiat de lățimea dorită, iar (n+1)·ramă + n·câmp = lățimea și (m+1)·ramă + m·câmp = înălțimea, în mm întregi; restul de 0…n−1 mm îl iau ramele de capăt (mai late cu 1–2 mm), ca nimic să nu rămână în aer. Previzualizarea spune „4×2 câmpuri · câmp 525×1210 mm”.
- Distinta: montanții (cât înălțimea) și traversele (cât câmpul), grupate pe lățime; suportul din foi cu gaură pentru prize (aceleași decupaje ca la lambriu). Un decupaj care atinge o ramă e semnalat. 3D cu aceleași cote ca distinta; pașii de montaj spun câți montanți și câte traverse, câmpurile și mărimea lor, din model.
- Dictarea cu AI cunoaște tipul și cele trei câmpuri; textele sunt în 7 limbi.
- Limite: câmpul e suportul însuși (fără panou încastrat în canal, deci fără freză); montanții sunt continui, traversele între ei; fără profil de ramă (muchii drepte); fără colț între doi pereți; foaia de suport nu depășește placa.
- Teste: 727 în browser, 16 unitare noi pe modul (închidere exactă pe 3000 de combinații), fuzz D-78 pe 12000 de configurații fără nicio abatere pe boiserie, golden 42 și 43 (rest de 3 mm la ramele de capăt) verificate aritmetic, `validat:false`.

---

## 5.2.0 — 27 octombrie 2026

**Lambriu v2: prize, întrerupătoare și pereți mai lungi decât placa.**
- **Decupaje**: în Generator, la lambriu, „+ Decupaj” adaugă un rând (X de la stânga peretelui, Y de la pardoseală, lățime, înălțime; implicit 80×80 la 30 cm). Se pot pune până la 30.
- **Lamelele se întrerup pe toată lățimea lor** acolo unde decupajul le atinge (nu un crestat pe jumătate): distinta primește „Lamella tagliata”, cu lungimile rămase, grupate pe lungime. Pe fiecare lamelă, bucățile + decupajul = înălțimea, exact.
- **Suportul primește gaura exactă**, ca decupaj (`scasso`) pe foaia potrivită; un decupaj peste îmbinarea a două foi se împarte între ele. Foile cu găuri diferite sunt rânduri separate. Gaura se vede în 3D.
- **Lamele mai lungi decât placa** (de exemplu orizontale pe un perete de 3000 mm) se taie automat în părți egale, cu îmbinare cap la cap; previzualizarea spune câte. Bucățile sub 30 mm sunt marcate ca greu de montat.
- Dictarea cu AI cunoaște lista de decupaje. Textele sunt în 7 limbi.
- Limite: suportul (foaia) nu poate fi mai înalt decât placa (2800 mm implicit); decupajul rotund (doză Ø60) se aproximează cu un pătrat; fără colțuri între doi pereți (se fac două lambriuri, câte unul pe perete).
- Teste: 722 în browser, 12 unitare noi (închidere pe 2000 de combinații), fuzz D-78 pe 12000 de configurații cu decupaje fără nicio abatere, golden 40 și 41 (verificate aritmetic, `validat:false` până la privirea ta).

---

## 5.1.0 — 27 octombrie 2026

**Lambriul cu lamele** — un tip nou de „mobilier”: placare de perete cu lamele verticale sau orizontale, pe un suport. Tendința arhitecților în apartamentele noi și în livinguri.
- În Generator, tipul „Lambriu cu lamele” (și presetul din bandă). Alegi lățimea peretelui, înălțimea, lățimea lamelei, rostul dorit și direcția (verticale / orizontale). Materialul corpului = lamela, materialul spatelui = suportul (bifa „Spate”); grosimile vin din materiale (D-41).
- **Rostul se calculează, nu se ghicește**: numărul de lamele e cel mai apropiat de rostul dorit, iar rostul real se împarte egal, astfel încât prima lamelă începe la capătul peretelui și ultima se termină exact la celălalt capăt (n·lățime + (n−1)·rost = lungimea, toleranță 0, D-43). Previzualizarea spune „40 lamele · rost 20,5 mm”; sub 3 mm avertizează.
- Distinta: lamelele (cota finită, număr) și foile de suport (împărțite în lățimi întregi sub lățimea plăcii, suma exactă). O lamelă sau o foaie mai lungă decât placa oprește generarea cu un mesaj, nu scoate o distinctă imposibilă.
- 3D cu aceleași cote ca distinta (D-61), fișa de montaj cu pașii de montaj, rostul și numărul din model (D-51), etichete, deviz, plan de tăiere, pașaport, comandă de atelier: totul trece prin aceleași căi ca la celelalte tipuri.
- Dictarea cu AI cunoaște tipul și cele trei câmpuri noi; textele sunt în toate cele 7 limbi.
- Limite cunoscute: lamelele orizontale nu pot fi mai lungi decât placa (2800 mm implicit); fără găuriri CNC pentru lambriu (se lipește și se fixează); fără colțuri, prize, întrerupătoare sau decupaje în perete; două cazuri golden noi (38, 39) așteaptă validarea ta manuală.
- Teste: 718 în browser, golden 38 și 39, fuzz D-78 pe 9000 de configurații aleatoare fără nicio abatere pe lambriu.

---

## 5.0.0 — 27 octombrie 2026

**Fluxul comercial, de la ofertă la predare** — trei lucruri care lipseau între „am desenat” și „am predat”.
- **Plan de plată în ofertă**: în Setări, trei procente (avans, începutul fabricației, livrare) care trebuie să dea 100. Oferta PDF tipărește un tabel cu sumele (TVA inclus), calculate în cenți: suma etapelor este exact totalul. Gol = fără tabel. Un plan greșit nu se salvează.
- **Proces-verbal de recepție** („Atelier și șantier”, cu Pro): listă de verificări cu căsuțe, rezerve cu termen, declarația clientului, semnături. În 7 limbi; nu conține cifre din model.
- **Consilier tehnic**: o insignă galbenă sub semaforul de coerență. Avertizează la rafturi și blaturi prea lungi pentru grosimea și materialul lor (săgeată estimată) și la uși înalte și înguste (curbare). Nu blochează nimic. Regulile și valorile (modul de elasticitate, sarcină, limită) sunt date marcate `verificat:false`: orientative, de confirmat cu furnizorul plăcii.
- Pentru atelier: registrul de verificare a cotelor de găurire (`test/tools/hw-registry.js`, 86 de valori din `HW_DRILL`) se generează în ebanist-hq, ca foaie de completat pe piesa reală.
- Nu s-a atins geometria: distinta, goldenele și 3D-ul sunt neschimbate.

---

## 4.84.0 — 27 octombrie 2026

**Pașaportul proiectului** — documentul pentru client, în „Per il cliente”, lângă oferta PDF. Cu Pro, ca celelalte documente.
- Pe o pagină A4, în limba aplicației (7 limbi): rezumatul (piese, suprafață, cant, mobile), **materialele** (decor sau cod, furnizor, grosime, m², cant), **feroneria** (produs și cod de articol; unde codul lipsește scrie „de confirmat”), **fabricația** (casete pentru data fabricației, controlul calității și semnătură) și un text liber pentru **garanție și întreținere**.
- Textul de garanție și întreținere se scrie o dată, în Setări, și apare pe fiecare pașaport. Dacă e gol, secțiunea nu apare.
- Dacă proiectul are o comandă de fabricație neschimbată (Atelier), pașaportul arată codul comenzii și spune că piesele au cod QR pe etichetă.
- Poartă urma versiunii (aplicație, motor geometric, reguli), ca distinta.
- **Nu declară conformitate.** Cifrele vin din model; ce aplicația nu știe (decor, furnizor, cod) rămâne „—”. Documentul spune explicit că nu înlocuiește declarațiile de conformitate ale producătorilor. Nu e un pașaport digital de produs al UE (DPP) și nu are încă pagină web cu QR: asta ar cere o migrare și o decizie despre datele clientului.
- Nou: `ebanist-passport.js`, `test/passport.test.js`, bloc e2e „Pașaportul proiectului”. Butoanele de export sunt acum 10.

---

## 4.83.0 — 27 octombrie 2026

**Modul Atelier — panou de birou. Tot ascuns.** Partea rămasă din E3: responsabilul și biroul tehnic văd, în ecranul Atelier, **unde stă fiecare comandă**.
- Un tabel cu comenzile deschise (confirmate sau în lucru), câte un rând pe comandă și câte o coloană pe fiecare din cele 7 postazioni: **✓** gata, **%** în lucru, **⚠** probleme, **—** neîncepută. Sub tabel, câte comenzi sunt în lucru pe fiecare postazione (coada).
- **Întârzierile:** comanda al cărei termen a trecut apare prima, cu zilele de întârziere în roșu. Comenzile **stagnante** (nicio mișcare de 24 de ore) și cele **neîncepute** sunt marcate. Deasupra, un rezumat: deschise, întârziate, stagnante.
- Numai citire, din funcțiile existente (`job_status_list`, `job_progress`): nicio migrare, nimic nou pe server. Operatorul și partenerul nu-l văd.
- Texte în cele 7 limbi. Teste noi în `atelier.test.js` și bloc e2e „Atelier panou”.

---

## 4.82.0 — 26 octombrie 2026

**Modul Atelier — QR pe foaia CNC și plan de tăiere cu coduri și QR. Tot ascuns.**
- **Foaia A3 a piesei (CNC)** primește, în colțul cartușului, **același QR ca eticheta piesei** și codul ei (`r12`). Numai dacă proiectul are o comandă creată din el și rândurile n-au fost schimbate de atunci; altfel foaia rămâne exact cum era. Același lucru în „Dosar tehnic A3".
- **Plan sezionatrice (QR)**, în Atelier → „Documente pe postazione": planul de tăiere tipărit, panou cu panou, cu codul fiecărei piese în dreptunghi, ordinea tăierilor și, sub panou, lista pieselor cu QR-ul fiecăreia. Fără comandă legată apar codurile și un avertisment, dar fără QR. Cu Pro, ca celelalte documente.
- Un singur cod pe piesă, același peste tot: eticheta, foaia CNC, planul de tăiere, foaia bordatricei și lista de vopsitorie. Se scanează la fiecare postazione prin care trece piesa.
- Texte în cele 7 limbi. Teste noi în `sheet.test.js` și bloc e2e „Atelier E5”.

---

## 4.81.0 — 26 octombrie 2026

**Modul Atelier, etapa E4a (D-92) — comandă agregată către furnizor. Tot ascuns.**
- În lista de comenzi, biroul și responsabilul pot **bifa mai multe comenzi deschise** și apăsa „Comandă agregată". Rândurile din instantaneele lor trec prin același plan de tăiere ca un proiect: panourile se împart între comenzi, deci se comandă mai puține decât suma comenzilor separate. Documentul arată, pe material: separat, împreună, din stoc, de comandat, plus economia de panouri și cantul în ml (+10% rezervă). Cu Pro, ca celelalte documente.
- Spune ce nu include: feroneria (se comandă din proiecte) și cantul pieselor profilate (calculat pe dreptunghi). Stocul de resturi e cel de pe acel dispozitiv; stocul comun al atelierului vine separat (are nevoie de migrare pe server).
- Instantaneele noi păstrează decorul în câmpul `decor` (material curat); cele din E1 își pierd decorul lipit la citire.
- Texte în cele 7 limbi. Teste noi în `atelier.test.js` și bloc e2e „Atelier E4”.

---

## 4.80.1 — 26 octombrie 2026

**Atelier: pornire din Setări.** Aplicația Android nu are bară de adresă, deci `?atelier=1` nu se putea folosi acolo. În **Setări**, chiar la început, apare secțiunea „Funcții în probă” cu un comutator „Modul Atelier”. Se aplică pe loc (e o preferință a dispozitivului, ca tema), iar apoi butonul „Atelier” apare în Cont, după login. Același efect ca `?atelier=1`, același flag. Modulul rămâne în probă și în afara Pro.

---

## 4.80.0 — 26 octombrie 2026

**Modul Atelier, etapa E3 (D-92) — documente pe postazione. Tot ascuns** (`?atelier=1` și login).
- În ecranul Atelier (biroul tehnic și responsabilul) apar două documente din **proiectul deschis**, cu Pro ca la celelalte documente:
  - **Foaia bordatricei:** cantul grupat pe decorul panoului (cant asortat), cu grosimea din Setări; pentru fiecare piesă cu cant: codul (`r1`, `r2`…, același cu al comenzii și al QR-ului de pe etichetă), cotele, bucățile, schița laturilor cu cant și metrii. La fiecare grup, totalul în ml și cu +10% rezervă (aceeași regulă ca la comanda către furnizor).
  - **Lista de vopsitorie:** numai panourile din MDF, pe material, cu suprafața celor două fețe și o linie de completat pentru culoare/finisaj. Canturile MDF-ului se chitează și se vopsesc: suprafața numără doar fețele.
- Numai grupare și tipărire: cotele sunt ale rândurilor distinctei, nimic recalculat; accesoriile nu apar.
- **Cititor de coduri (tastatură/HID):** în ecranul de scanare, codul citit + Enter deschide piesa; fără detector de cameră, câmpul e activ de la început.
- Neclar încă (decizii de luat): tipul cantului ca dată pe piesă (acum se ia în decorul panoului) și culoarea RAL/NCS (acum o scrii de mână pe foaie).
- Texte în cele 7 limbi. Teste noi în `atelier.test.js` și bloc e2e „Atelier E3”.

---

## 4.79.0 — 26 octombrie 2026

**Modul Atelier, etapa E2 (D-92) — cod QR pe etichetă, scanare, coadă offline. Tot ascuns** (`?atelier=1` și login; un cod de piesă scanat cu camera telefonului pornește modulul pe acel telefon).
- **Etichetele primesc QR** (16 mm, nivel M) când proiectul are o comandă creată din el și rândurile n-au fost schimbate de atunci. Dacă s-a schimbat ceva, QR-ul dispare: un `r7` nu poate arăta altă piesă decât cea înghețată în comandă. Fără comandă, etichetele rămân exact ca până acum. Codul e un link `ebanist.com/#e=<comandă>.<piesă>`: camera oricărui telefon îl deschide în aplicație, fără bibliotecă de scanare.
- **Scanare:** în Atelier, „Scanează eticheta” (camera din aplicație unde telefonul are detector QR; altfel camera telefonului sau lipești codul). Apare piesa (cote, material, cant, postazioni deja gata); operatorul alege postazione (o ține minte) și apasă **Gata**: 2 atingeri. După „Gata” sau „Problemă” se trece la scanarea următoare.
- **Coadă offline:** dacă pică Wi-Fi-ul, evenimentul se salvează pe telefon și pleacă singur când revine conexiunea (și la fiecare deschidere a ecranului). Același eveniment nu se dublează, iar unul refuzat de reguli (comandă închisă, fără drept) se aruncă, nu se reîncearcă la nesfârșit. Coada păstrează până la 500 de evenimente, 7 zile.
- Generatorul de QR e cod propriu (`ebanist-qr.js`, fără bibliotecă, funcționează offline). Verificat cu un decodor independent (jsQR) pe sute de șiruri aleatoare, pe toate versiunile 1–10 și pe eticheta tipărită (randată în PDF și citită înapoi). Verificarea a prins greșeli de tabel (versiunile 3, 5 și 8 la nivel M) înainte de a ajunge în aplicație.
- Limite cunoscute: codul identifică rândul din distinctă (un rând cu `pz: 3` e o singură piesă pentru progres); comanda nu se leagă încă de proiectul din cloud; legătura proiect → comandă se ține pe telefon.
- Texte în cele 7 limbi. Nou: `ebanist-qr.js`, `test/qr.test.js`, teste în `atelier.test.js` și bloc e2e „Atelier E2”.

---

## 4.78.0 — 26 octombrie 2026

**Modul Atelier, etapa E1 (D-92) — comenzi pe postazione. Ascuns** (`?atelier=1` și login). Folosește migrarea 1.6, rulată pe serverul real la 26.10.
- În ecranul Atelier apare lista de **comenzi**. Biroul tehnic și responsabilul creează o comandă din proiectul deschis (titlu, client ca etichetă, termen) și îi schimbă starea: ciornă, confirmată, în lucru, finalizată, expediată, montată sau anulată (final, cu confirmare).
- Comanda **îngheață piesele** proiectului (`pk` stabil `r1`, `r2`…). **Niciun preț, client sau telefon** nu intră în ea; lista de câmpuri e verificată și în aplicație, și pe server.
- Pe comenzile deschise se înregistrează început / gata / problemă pe fiecare postazione, cu identificator unic (idempotent). Operatorul vede doar postazioni lui; biroul și responsabilul le văd pe toate și văd progresul; partenerul vede doar starea comenzilor la care e trecut.

---

## 4.77.0 — 26 octombrie 2026

**Modul Atelier, etapa E0 (D-92) — ascuns.** Nu se vede în aplicația obișnuită: apare numai cu `?atelier=1` în adresă (rămâne pornit pe acel dispozitiv; `?atelier=0` îl oprește) și numai după ce te-ai conectat la cont.
- Din Cont apare butonul „Atelier”. Poți crea un atelier, intra într-unul cu un cod de invitație (16 cifre, 4-4-4-4, valabil 7 zile, o singură folosire) sau deschide unul în care ești membru.
- Patru roluri: **responsabil**, **birou tehnic**, **operator** (cu postazioni) și **partener**. Responsabilul invită, schimbă rolurile și scoate membri; biroul vede lista; operatorul și partenerul își văd doar rândul. Ultimul responsabil nu poate ieși sau fi retrogradat.
- Totul se verifică pe server (migrarea 1.5 din `ebanist-hq`, politici RLS și funcții `atelier_*`, testate pe un Postgres real); aplicația doar afișează. Proiectele rămân private ca până acum.
- Texte în cele 7 limbi. Nu face parte din Pro și nu schimbă nimic pentru cine nu pornește flag-ul. Nou: `ebanist-atelier.js`, `test/atelier.test.js`, bloc e2e „Atelier E0”.
- Migrarea 1.5 (și 1.4, care lipsea) sunt rulate pe serverul real din 26.10; ecranul rămâne ascuns până la decizia de preț (D-55, D-54).

---

## 4.76.0 — 22 octombrie 2026

**Pro pe web: codul de activare se poate primi pe email (ROADMAP U.14, D-90).**
- În ecranul Pro, sub câmpul de cod, apare „Nu ai codul? Primește-l pe email” (numai pe web, nu pe Android). Clientul scrie emailul plății și primește codul `sub_…` (sau `cs_…` la Founders) pe acea adresă, în limba aplicației.
- Rezolvă cazul în care redirectul de după plată se pierde (plată prin Link în alt browser, pagină închisă): chitanța Stripe nu conține codul, deci clientul nu se putea activa singur.
- Răspunsul aplicației e același, există sau nu o plată pe adresa respectivă; codul nu apare niciodată pe ecran, doar în email. Limită: 3 cereri/oră pe adresă, 10/oră pe IP. Numai abonamente active și Founders nerambursate.
- Nou: `netlify/functions/pro-restore.js` (`POST /api/pro-restore`), `test/pro-restore.test.mjs` (în `test:license` și `test:all`). Variabile noi în Netlify: `RESEND_API_KEY`, `PRO_MAIL_FROM`; cheia Stripe restricționată primește „Read” pe Customers. Fără ele, funcția răspunde 503 și aplicația trimite la info@ebanist.com.

---

## 4.75.0 — 20 octombrie 2026

**Mânere noi, mâner separat pentru sertare, trei tipuri de gola, balamale mai realiste.**
- **20 de modele de mâner** în catalog, alese pe corp la „Feronerie corp”: bare rotunde (96, 128, 160, 192, 320 mm; inox, negru, bronz), bară pătrată nichel, mâner punte negru, arcuite (alb, crom), scoică bronz, butoane (crom, alamă, lemn, ceramică, pătrat negru), inel alamă patinată, încastrate (oval 120×40, rotund Ø40) și pe muchie (aluminiu 150, negru 300). Fiecare se desenează în 3D cu forma și finisajul lui și se găurește după tip: bara și scoica cu două găuri la interax, butonul și inelul cu una, cel încastrat cu locaș la freză, cel pe muchie cu două găuri de ghidaj pe spate. Prețurile sunt orientative, iar dimensiunile trebuie verificate pe articolul real.
- **Sertarele pot avea alt mâner decât ușile** („Mânere sertare”, implicit „ca la uși”). În deviz apare pe rând separat, iar fișa de montaj scrie un rând pe articol, cu montajul lui.
- **Gola în trei feluri** („Tip de gola”): profil L + C în corp (ca până acum), profil J pe muchia de sus a fiecărui front, sau priză frezată în front, fără profil. Rosturile implicite sunt ale tipului. Cotele J și ale frezării sunt de verificat înainte de mașină.
- **Balamaua în 3D rămâne legată când ușa e deschisă**: brațul de pe lateral și cupa din ușă sunt unite la orice unghi.
- Dacă mânerul ales e mai lung decât frontul, previzualizarea te avertizează.

## 4.74.7 — 20 octombrie 2026

**Unghiul tăieturii scris pe desen.** În scheda pezzo și în foaia A3 de fabricație, panoul pe pantă are acum conturul trapezoidal și unghiul (de ex. „28,9°”) scris lângă muchia înclinată, nu doar în textul de sub cote.

## 4.74.6 — 20 octombrie 2026

**Buton nou în setări: „Repară aplicația”.** Dacă după o actualizare pagina e nouă dar un fișier a rămas vechi (de exemplu scheda pezzo nu arată tăietura la unghi deși versiunea afișată e cea nouă), butonul golește memoria locală a fișierelor, scoate service worker-ul și reîncarcă din server. Proiectele și setările nu se ating.

## 4.74.5 — 20 octombrie 2026

**Scheda pezzo arată tăietura la unghi.** Ușa (și orice panou pe pantă) se desenează cu conturul ei real, trapez, și nu cu dreptunghiul de gabarit. Sub cote apare unghiul tăieturii de sus, în grade, atât față de lățime, cât și față de înălțime, plus înălțimea în cele două colțuri.

## 4.74.4 — 20 octombrie 2026

**Actualizarea nu mai lasă aplicația pe jumătate nouă.** „Actualizează” (și „Verifică actualizări”) reîncărcau pagina după 0,9 secunde, înainte ca fișierele noi să fie descărcate: pagina era cea nouă, dar 3D-ul și motorul rămâneau cele vechi până la a doua pornire (de aceea, după actualizare, ușile încă nu se deschideau sub pantă). Acum aplicația așteaptă să se instaleze versiunea nouă, apoi se reîncarcă.

## 4.74.3 — 20 octombrie 2026

**Selectorul „Cielo inclinato” are acum toată lățimea**: textul „Pendenza sulla larghezza” nu se mai taie pe telefon.

## 4.74.2 — 20 octombrie 2026

**Verificare cap-coadă: patru defecte reparate.**
- **Ușile nu se deschideau sub tavanul înclinat pe lățime** (butonul „Ante aperte” din 3D nu făcea nimic). Acum se deschid, ca la tavanul drept. Reparat și pentru ușa de pe aripa corpului de colț, care nu se deschidea deloc.
- **Tastatura acoperea câmpul în care scriai** (de exemplu înălțimea). Când apare tastatura (și în aplicația Android, și în browser), previzualizarea 3D și butonul „Generează” nu mai rămân lipite pe ecran, bara de jos se ascunde, foile se ridică deasupra tastaturii, iar câmpul activ urcă singur în zona vizibilă.
- **Distinta unui corp cu tavan înclinat nu se mai putea exporta**: regula „piesă mai mare decât corpul” (A9) compara piesele cu înălțimea cea mai joasă. Acum le compară cu cea mai înaltă.
- **Distinta cu uși pliabile (3–4 foi) nu se mai putea exporta**: rosturile dintre foile unui pachet nu intrau în suma lățimilor (I4). Acum intră.

## 4.74.1 — 20 octombrie 2026

**Reparat: 3D-ul nu se schimba la uși pliabile și tavan înclinat.** Câmpurile „Uși pliabile”, „Cielo inclinato” (tip și cele două înălțimi), „Tavan”, „Anti-curbare” și „Gola” puneau valoarea în proiect, dar previzualizarea nu se redesena până nu atingeai alt câmp. Acum 3D-ul se schimbă imediat la fiecare dintre ele.

## 4.74.0 — 19 octombrie 2026

**Notificare de actualizare la deschidere.** Când pe server există o versiune mai nouă decât cea deschisă, apare sus o bară: „Versiune nouă disponibilă: vX” cu „Actualizează” și „Mai târziu”. Verificarea se face în liniște, la 2,5 secunde după pornire și la revenirea în aplicație (cel mult o dată la 30 de minute); fără internet nu apare nimic. Aplicația nu se reîncarcă singură, deci un proiect aflat în lucru nu se pierde. „Mai târziu” tace bara până la următoarea deschidere. Butonul „Verifică actualizări” din setări merge ca înainte.

## 4.73.0 — 19 octombrie 2026

**Häfele One Touch în catalog.** Categoria „Push-open” are un articol nou, „One Touch — push-to-open pentru uși”, selectabil pe corp la „Feronerie corp” (sau ca implicit în Catalog). Intră în deviz, în fișa de montaj și în PDF, o bucată pe ușă, la fel pe uși drepte, trapezoidale sub pantă și pliante. Codul de articol și prețul (6 €) sunt provizorii și marcate „de verificat”: îl poți înlocui cu articolul tău în Catalog propriu. Push-open nu are găuri proprii în mașină, deci nu apare nimic nou în fișa piesei.

## 4.72.0 — 19 octombrie 2026

**Uși trapezoidale sub tavanul înclinat.** Când corpul are „Cielo inclinato” pe lățime, fiecare ușă devine un trapez: marginea de sus e paralelă cu tavanul, la rostul de sus sub el, iar cota rândului din distinctă e înălțimea maximă a ușii. Foaia piesei și prospectul A3 desenează conturul trapezoidal; în 3D și în camera 3D ușa închisă urmează panta.

Balamalele și mânerul se așază după marginea cea mai joasă a ușii, la fel în fișa de operații, în deviz și în 3D; numărul de balamale se calculează pe înălțimea cea mai mică. Fiecare ușă primește partea balamalei explicit (prima jumătate stânga, a doua dreapta). Rămân dreptunghiulare ușile cu sertare deasupra, ușile pliante și pantele pe adâncime.

Limite declarate: ușa deschisă în camera 3D se desenează încă dreptunghiular; în 3D, panourile trapezoidale pot arăta benzi de nuanță (numai redare, cotele sunt corecte); canturile tăiate la unghi nu se găuresc încă.

## 4.71.0 — 19 octombrie 2026

**Releveu propune panta tavanului.** Sub cele trei înălțimi măsurate ai un câmp nou, „Tavan”: orizontal, înclinat pe lățime (punctul 1 = stânga, punctul 3 = dreapta) sau înclinat pe adâncime (punctul 1 = față, punctul 3 = spate). Când punctele 1 și 3 diferă cu peste 20 mm și nu ai ales nimic, ecranul îți sugerează că tavanul pare înclinat.

Cu panta aleasă, „Completează generatorul” pune în Constructor tavanul înclinat: cele două înălțimi măsurate minus 20 mm, înălțimea corpului fiind cea mai mare. Nu generează nimic singur: vezi cotele în formular și apeși tu „Generează”. Dacă diferența e sub 20 mm sau lipsește punctul 1 sau 3, rămâne comportamentul de până acum (înălțimea punctului celui mai jos minus 20 mm), iar mesajul spune de ce.

## 4.70.0 — 19 octombrie 2026

**Mobilier cu tavan înclinat: sub scară, la mansardă.** În Constructor ai un câmp nou, „Cielo inclinato”: pantă pe lățime sau pe adâncime. Scrii cele două înălțimi, de la pardoseală până la fața de sus a tavanului (stânga și dreapta, sau față și spate); înălțimea corpului e cea mai mare, iar unghiul se calculează și se afișează.

Laterale, tavan, despărțitoare și spate urmează panta: laterale de înălțimi diferite sau trapezoidale, tavanul ca un singur panou cu lungimea măsurată pe pantă și cu capetele tăiate la unghi, despărțitoare cu înălțimea de la poziția lor, spate trapezoidal. Ușile se opresc la punctul cel mai jos al deschiderii lor. Polițele, sertarele și bara stau sub partea cea mai joasă. În 3D, în exportul AR și în prospectul A3 se vede conturul înclinat.

Închiderea gabaritului verifică înălțimea la ambele capete, lungimea tavanului și fiecare despărțitor, cu toleranța de jumătate de milimetru: rândurile distinctei sunt întregi, iar tavanul înclinat contribuie cu grosimea împărțită la cosinusul unghiului. **În fișa piesei, îmbinările cu tavanul înclinat nu se găuresc încă**, iar piesele pe pantă dau avertisment: cere o piesă reală (bevelul) înainte să meargă în mașină.

Pasul 1: nu merge împreună cu cotele absolute, cu unghiurile în plan, cu tavanul din două traverse, cu treapta din perete, cu gola, cu spatele aplicat sau pe alte tipologii; în aceste cazuri apare o eroare cu motivul. Proiectele vechi rămân neschimbate.

## 4.69.0 — 19 octombrie 2026

**Uși pliante, „a pacchetto”.** În Constructor → „Frontale e appoggio” ai un câmp nou, „Uși pliante”: 2, 3 sau 4 foi pe pachet. Fiecare ușă devine un pachet de foi legate cu balamale între ele, suspendat pe o șină sus. Lățimea pachetului e lățimea ușii de până acum, împărțită în foi cu 3 mm între ele; sus rămâne loc pentru șină. Partea pe care se strânge pachetul e cea de la „Lato cerniere”, aceeași alegere ca la balamale.

Distinta are rândul „Anta pieghevole” (câte foi, cu cota finită) și un set de șină pe pachet. Devizul și fișa de montaj numără balamalele dintre foi, un mâner pe pachet și sistemul de șină, o singură dată; sistemul are categorie proprie în Catalog, cu preț de reglat. În 3D și în camera 3D, la „Ante aperte” foile se strâng una lângă alta, perpendicular pe față, deci se vede cât iese pachetul în față; același spațiu intră în zona de deschidere din planul camerei.

Fișa piesei are găurile balamalelor dintre foi (cupa Ø35 într-o foaie, placa în vecina). **Cotele sistemului și ale găurilor sunt de catalog, nu luate de pe un sistem real:** marcate nevalidate până la un sistem montat. Nu se aplică pe front cu sticlă sau bombat și nici pe cotele absolute ale fronturilor: acolo rămân uși obișnuite, cu avertisment; foile mai înguste de 100 mm nu se generează. Proiectele vechi rămân neschimbate.

## 4.68.2 — 18 octombrie 2026

**Balamaua din 3D seamănă acum cu CLIP top.** Până acum era un bloc cu un stâlp, nu o balama. Acum are cupa Ø35 cu inel, flanșa de 57 × 27,5 mm cu cele două găuri la 45 mm și șuruburi, legătura (linkul) înclinată, placa de montaj de pe lateral cu două șuruburi la 32 mm și brațul lung de tablă, cu profil mai înalt spre ușă, fantă și două șuruburi de reglaj. Cutia neagră a amortizorului BLUMOTION apare doar la modelele cu amortizor. Cotele cupei și flanșei sunt din fișa Blum 71B3590 (același corp, cu boss INSERTA): cupă Ø35, adâncime 13, flanșă 57 × 27,5 × 6,4, găuri Ø8 la 45 mm, excentric 9,5.

Brațul stă pe placa de pe lateral și rămâne pe loc când ușa se deschide; cupa și linkul merg cu ușa. Forma brațului și lungimea lui sunt aproximări după fotografiile Blum, nu după un desen cotat. Nu schimbă nicio cotă, nicio gaură și nicio distinctă.

## 4.68.1 — 18 octombrie 2026

**Mânerele și balamalele nu mai dispar din 3D când schimbi materialul.** Când schimbai decorul frontului sau al corpului, piesele își schimbau materialul, dar feroneria (mânere, balamale, culisante) nu se mai reconstruia: rămâneai cu uși și sertare fără mânere până la altă modificare care schimba geometria. Semnătura modelului din viewer include acum și materialul fiecărei piese, deci orice schimbare de decor refă și feroneria.

## 4.68.0 — 18 octombrie 2026

**Feroneria aleasă se schimbă acum live în 3D.** Până acum, când alegeai alt tip de feronerie la „Feroneria aleasă pe corp” nu se întâmpla nimic: formularul își reafișa lista fără să redeseneze, iar modelul 3D nu își recalcula nici găurile, pentru că semnătura lui nu includea alegerea. Acum fiecare schimbare redesenează imediat și refă găurile și feroneria.

În plus, forma din 3D urmează articolul ales: **mâner** bară neagră, bară inox sau **buton** (cu o singură gaură, nu două); **balama** Blum cu amortizor (BLUMOTION) sau fără, Häfele în inox, Duomatic cu braț gros; **culisantă** ascunsă (Tandem, Movento cu clemă neagră) sau laterală (rolă 230M, cu bile Häfele); **îmbinări** desenate în 3D: șurub Confirmat, lamelă Lamello, tenon Festool Domino și conector Clamex, cu orientarea canalului din Modelul de Operații. Îmbinările și balamalele se văd în modul „Feronerie” sau la vedere explodată.

Intern: `GL3D.focusOn(pk, raza, deplasare)` apropie camera de un punct al unei piese (folosit la capturi și la filmele de prezentare, nu are buton în aplicație).

La corpul care alege un buton, fișa piesei are o singură gaură în ușă, ca în realitate. Profilul Gola/L ales pe corp nu mai e ignorat (înainte conta doar alegerea din Catalog).

## 4.67.0 — 18 octombrie 2026

**Ocluzie ambientală reală (SSAO) în 3D, în Client și în randările din dosar.** Colțurile unde raftul întâlnește lateralul, spatele sau separatorul, golurile de sub sertare și locul unde corpul atinge peretele sau podeaua sunt acum întunecate de un calcul real făcut din adâncimea scenei, nu de o aproximare pe cutie. Se calculează la jumătate de rezoluție, în trei treceri (normale și adâncime, ocluzie, estompare), și numai când scena se schimbă. La telefoanele cu memorie puțină se folosesc 8 eșantioane în loc de 12. Dacă dispozitivul nu poate face trecerea, aplicația o oprește singură și rămâne ocluzia simulată de la 4.65.0.

Nu schimbă nicio cotă, nicio distinctă și nicio piesă.

## 4.66.0 — 18 octombrie 2026

**Feroneria în 3D, desenată cu detaliu.** Balamaua Blum are tazza cu inel, flanșa cu urechi și șuruburi, brațul din tablă, pivotul, placa de montaj de pe lateral cu două șuruburi și șurubul de reglaj. Culisanta de sertar are șina de pe lateral (placă și două buze), consola din spate, reazemul și rola din față; partea mobilă, cu clema de față și pârghia de eliberare, merge cu sertarul când îl deschizi, deci culisanta se vede cum se telescopează. Mânerul bară are capete rotunjite, stâlpi și rozete la față, într-un metal închis satinat.

Nu schimbă nicio cotă, nicio gaură și nicio distinctă: feroneria rămâne cea din Modelul de Operații, doar forma ei în 3D e mai fidelă. Tipurile de culisantă sunt desenate la fel (Tandem/Movento au aceeași formă generică); cotele reale ale fiecărui model rămân cele din fișele producătorului, folosite la găurire.

## 4.65.0 — 18 octombrie 2026

**3D și modul Client, mai realiste.** Lemnul are acum fibră neregulată, cu pori și variații de lățime, nu dungi egale; fiecare piesă are fibra ei, deci ușile și sertarele vecine nu mai sunt copii una după alta. Muchiile panourilor prind lumina, ca un cant teșit. Uni-ul melaminic are un grăunte fin, în loc de plastic neted. Interiorul corpului are ocluzie ambientală simulată: colțurile unde raftul întâlnește lateralul sau spatele sunt mai întunecate, iar spre fundul corpului lumina scade. Gresia din cameră are plăci cu tonuri ușor diferite și rost închis la culoare.

Pe drum s-a corectat un defect: proiecția fibrei folosea matricea primei piese pentru toate piesele cu același material, deci fibra de pe fețele sertarelor ieșea cu desen de „flacără" în loc de linii drepte. Acum fiecare piesă are propriul material (același program compilat), deci fibra urmează piesa.

Nu schimbă nicio cotă, nicio distinctă și nicio piesă; e doar aspectul în 3D și în randările din Client și din dosarul tehnic.

## 4.64.1 — 18 octombrie 2026

**Telefon: constructorul nu mai iese din ecran.** Cu cele cinci butoane de documente (desen tehnic, prospecte, montaj, dosar, „în camera ta") rândul de butoane depășea lățimea telefonului și împingea toată pagina în lateral (antetul și marginea stângă tăiate). Rândul trece acum pe mai multe linii; un test e2e pe 412 px lățime verifică.

## 4.64.0 — 18 octombrie 2026

**Dosarul tehnic complet pe A3 (D-83, pasul 4).** Butonul „Dosar tehnic A3" deschide o fereastră cu foile de tipărit, câte una pe pagină A3:
- **Copertă și cuprins:** proiect, client, randare 3D, corpurile proiectului, cuprinsul foilor cu „pentru cine", „cum se citesc foile" și „despre"; sigla utilizatorului, dacă există.
- **Prezentare pentru client:** randare 3D mare (cu două vederi mici, ușile deschise și frontal), materiale cu culoarea lor, feroneria inclusă și loc de semnătură; fără prețuri.
- **Raport tehnic:** capitole din șabloane traduse și din datele modelului (descriere, materiale, construcție, feronerie, note de fabricație, montaj și siguranță, controale), fără text generat liber.
- Plus foile deja existente: prospecte și secțiuni, montaj și, la alegere, foaia de fabricație a fiecărei piese.
- 53 de chei noi în toate cele 7 limbi, verificate în e2e.

## 4.63.0 — 18 octombrie 2026

**Foaia A3 de montaj (D-83, pasul 3).** Butonul „Fișă de montaj A3" tipărește, pentru fiecare corp cu piese generate, o foaie landscape cu cartuș:
- vederea explodată (aceeași captură WebGL ca la fișa A4) cu baloane de poziție — numerele sunt pozițiile din lista de piese, ca în panoul de piese din 3D; fără WebGL, desenul SVG de rezervă;
- lista de piese pe poziții (L, lățime, grosime, cant), feroneria cu produse, coduri și cantități (inclusiv îmbinarea aleasă: confirmat, lamelă, Domino, Clamex), uneltele și greutatea estimată;
- secvența de montaj din fișa A4 (aceiași pași, aceleași cote), cu corpul textului care se micșorează dacă sunt mulți pași;
- 4 chei noi în toate cele 7 limbi, verificate în e2e.

## 4.62.0 — 18 octombrie 2026

**Prospecte și secțiuni pe A3 (D-83, pasul 2).** Butonul „Elaborat A3" de lângă desenul tehnic tipărește o foaie landscape cu cartuș:
- prospect frontal, secțiune verticală A–A (fața în stânga) și plan C–C, la aceeași scară dacă încape; planurile de tăiere sunt marcate pe prospect;
- planurile trec prin mijlocul celei mai late coloane și al celui mai înalt gol, deci arată rafturi, sertare, spate și uși;
- hașuri după materialul tăiat (structură, spate, fronturi; sticlă și metal separat) și legendă cu materialul și grosimea proiectului;
- cote în lanț: lățimi, înălțimi de la podea, adâncimi, grosimi de panou; geometria vine din cutiile modelului, nimic scris de mână;
- 14 chei noi în toate cele 7 limbi, verificate în e2e.

## 4.61.0 — 18 octombrie 2026

**Cote din fișele producătorilor (D-84).**
- **Ghidaje Blum:** pozițiile de fixare pe lateral urmează lungimea nominală NL, din fișele Blum: MOVENTO 760H (față 18/37/69 mm, spate 197 / 261 / 243-261-293 după NL) și TANDEM plus 563H (37 + 133…517 după NL, pe grila de 32). Seria vine din ghidajul corpului; fără serie sau fără NL în tabel rămân pozițiile de dinainte, iar NL în afara tabelului e marcat ca aproximativ.
- **Lamello Clamex P-14** ca tip de îmbinare, din fișa Lamello (frezare P-System Ø100,4×7, canal 14 mm adânc, 9,8 mm înalt, ~69,6 mm lung, min. 37 mm de la capăt, pas max. 300 mm).
- Domino: lungimea canalului 22 mm (tenon 8×22×40).

## 4.60.0 — 18 octombrie 2026

**Tipuri de îmbinare (D-84).** Pe fiecare corp, la „Tip îmbinare" (articolul `conn`), se alege cum se prind baza, tavanul și rafturile fixe de laterale; motorul de operații generează găurirea potrivită:
- **Minifix** (ca până acum), **Confirmat** (Ø7 prin fața laterală, pilot Ø5×50 în cantul piesei), **Tasel** 8×35 cu clei, **Lamelă** Lamello #20, **Festool Domino** 8×40.
- Operație nouă `slot` (canal dreptunghiular, pe față sau în cant): apare în fișa piesei, în tabel, în CSV și pe foaia A3; lamelă și Domino sunt centrate pe grosime, fără să treacă prin piesă.
- Fișa de montaj descrie pasul îmbinării alese.
- Cotele sunt de catalog, `verificat:false`.
- 10 chei noi în toate cele 7 limbi.

## 4.59.0 — 18 octombrie 2026

**Foaia A3 de fabricație (D-83, pasul 1).** Din fișa piesei, butonul „Foaie de fabricație A3" tipărește o foaie landscape cu cartuș (firmă, proiect, client, piesă, material, grosime, cantitate, cant, scară, dată, versiune):
- cotare în lanț de la muchie la axa găurii, cu pașii egali strânși în „n×pas" (sistemul de 32);
- fiecare gaură, canal și decupaj poartă o literă legată de tabelul de prelucrări (Ø, adâncime, față, cantitate) și de lista pozițiilor;
- detalii la scară mare pe grupurile de găuri, cotate de la muchia piesei;
- toate textele în limba din meniu (22 chei noi, în toate cele 7 limbi); trece prin `printOut()` ca orice document.

## 4.58.1 — 18 octombrie 2026

**„Camera în 3D" arată ca vizorul corpului.** Până acum camera era desenată în SVG, plat: pereți translucizi, fără lumină și fără umbre. Acum folosește același vizor WebGL ca la corp:

- umbre ale corpurilor pe podea, materialele reale ale corpurilor;
- **podea din plăci de 600 mm** (se vede scara camerei), cu poligonul real al pereților;
- **pereții dinspre cameră se subțiază**, deci vezi mereu interiorul, indiferent din ce parte te uiți; pereții nu mai aruncă umbră peste cameră;
- rotire și zoom cu degetul ca la corp; la închidere, canvasul, camera și umbra de contact revin cum erau în Constructor.
- Fără WebGL se păstrează desenul SVG de dinainte.

Teste: 5 verificări noi în `run.js`; `test:full` 635/635 cu golden 42/42, e2e 551/551.

---

## 4.58.0 — 18 octombrie 2026

**Releveu (D-82).** Idei luate de la Leica DISTO Plan, fără hardware:

- **Decalajul de închidere se spune cu cifră** („Decalaj 12 mm”) și, când o singură cotă îl explică, cu cauza probabilă: „Peretele 1 ar trebui să fie 3188 mm sau Peretele 3, 3200 mm”. Mai multe erori deodată nu primesc nicio explicație inventată.
- **Bară lipicioasă** cu conturul mic și decalajul, vizibilă cât tastezi pereții (planul mare rămânea la ~670 px mai sus pe telefon).
- **Perete de închidere calculat**, la cerere; mesajul spune că e calculat, nu măsurat, și că unghiul ultimului colț s-a recalculat.
- **Diagonale** între două colțuri, cu diferența față de plan; se desenează pe plan (roșu peste 10 mm).
- **Enter** trece de la lungime la unghi și la peretele următor; după ultimul perete, cu contur deschis, adaugă unul nou.
- **Obstacolele se văd pe plan**, la poziția lor pe perete.
- **Poze legate de punct:** pe fiecare perete, obstacol și înălțime; micșorate la 1280 px, în IndexedDB (nu în localStorage), în backup și în exportul JSON al proiectului. Nu se sincronizează prin Supabase.
- **Import DXF** al conturului camerei (ASCII; unități din `$INSUNITS`; arcele devin coarde, cu avertisment). DWG nu se citește: se cere export DXF.
- Chei noi în toate cele 7 limbi.

Teste: `survey.test.js` (21), 15 verificări noi în `run.js`; `test:full` 635/635 cu golden 42/42, e2e 546/546.

---

## 4.57.0 — 18 octombrie 2026

**Audit și îmbunătățiri de interfață.**

- **Coerența pe 3D.** În Studio 3D apare un buton roșu cu numărul problemelor când gabaritul sau un invariant pe rol nu se închide; la atingere, piesele nominalizate devin roșii.
- **Cote de lumină pe 3D.** Butonul „Cote" arată L × H × P și luminile libere dintre bază, rafturi și tavan, calculate din piesele fizice (`dimensionSpec`). Se ascund în vederea explodată și în fotografiile pentru documente.
- **Restul recuperabil pe planul de tăiere.** Zonele libere cu latura scurtă ≥ „Păstrează resturile de la" sunt conturate în verde, cu cota; sfrido rămâne hașurat.
- **Iconița de cant în lista de debitare**, aceeași ca pe etichete, lângă textul cantului.
- **Exportul din Rezumat, în trei grupe:** pentru client, debitare și furnizor, atelier și șantier.
- **Corp în afara echerului:** foaia de închidere spune acum că lățimea nu se verifică (avertisment, nu blocaj); adâncimea și înălțimea se verifică în continuare.
- **Piese înguste:** axa grosimii vine din rol, nu doar din cea mai scurtă extensie; o placă de 18 mm adâncă de 15 mm nu mai citea 15 drept grosime și nu mai pierdea găurile.
- **Stocarea:** un timeout la deschiderea IndexedDB nu mai oprește salvările toată sesiunea; după 3 timeouturi la rând se comportă ca înainte.
- **Aserțiuni:** `sp_top` și `top` intră în mediul aserțiunilor (D-72).
- **Cheile `EBP-` sunt ritirate (D-81).** Nicio cheie nu fusese vândută; validarea cu sare din client dispare, o licență `legacy` rămasă pe un dispozitiv nu mai dă Pro, `genkey.py` e șters. Pro rămâne pe Stripe, Play, `comp_…`, Founders și Lemon Squeezy.
- `computeHardware` fără setări citește pe cele din aplicație (cădea cu un articol necunoscut).
- Chei noi în toate cele 7 limbi: `vtCoh`, `vtDims`, `nestKeep`, `nestWaste`, `expClient`, `expShop`, `expSite`; avertismentul „în afara echerului" în `AU_I18N`.

**Rămâne deschis (nemodificat):** fundul sertarelor metalice cu 4 mm sub fața bazei (D-78 punctul 4); mesajele de la cote absolute rămân în română în toate limbile.

Teste: `test:full` 614/614 cu golden 42/42, `run.js` 533/533.

---

## 4.56.1 — 13 octombrie 2026

**Limba din linkul site-ului vine și în aplicația deja folosită.** Cine deschidea aplicația din `/es/`, `/de/`, `/pl/` (sau orice pagină de limbă a site-ului) și avea deja date salvate pe dispozitiv rămânea în limba veche: `?lang=` era citit numai la prima pornire. Acum un `?lang=` valid din link are prioritate și se reține ca alegere (`langChosen`). Fără `?lang=` rămâne limba aleasă.

Notă: aplicația se actualizează „cache-first” (fiecare versiune nouă se instalează la prima deschidere și se vede la a doua). Pe un dispozitiv care a deschis aplicația înainte de 4.56.0, prima deschidere după lansare arată încă versiunea veche, fără `de`, `pl`, `es`; a doua deschidere (sau «Verifică actualizări» din Setări) aduce versiunea nouă.

Teste: `run.js` — „Lingua dal link del sito” (3 verificări).

---

## 4.56.0 — 13 octombrie 2026

**Poloneză și spaniolă în aplicație.** A șasea și a șaptea limbă a interfeței, după ro, it, en, fr, de: tot ce se vede pe ecran și în documente (listă de debitare, fișă de montaj, distinta PDF, ofertă, mod Client, Order Rail) apare în limba aleasă din Setări → Limbă. Prima pornire alege `pl` sau `es` singură dacă browserul o cere (`es-MX` și alte variante regionale intră pe `es`).

- Aceleași chei în șapte limbi: `I18N` (975), `SURVEY_I18N`, `AUTH_I18N`, `AI_I18N`, `EL_I18N`, `ACC_I18N`, `AU_I18N`, `order-rail/i18n.js`, numele feroneriei, ale sistemelor de sertar și ale materialelor din catalog.
- Numerele se formatează `pl-PL` / `es-ES`; dictarea vocală la fel; asistentul AI primește poloneza și spaniola ca limbi de intrare.
- Site: `/pl/` și `/es/` cu capturi și documente reale în limba lor, `hreflang`, sitemap, redirect `?lang=`, Edge Function (`pl`, `es`). Pagina de caz are textul tradus, dar capturile din proiectul real rămân în engleză (ca la germană).
- Nimic din geometrie nu se schimbă.
- Terminologia de tâmplărie merită citită de un vorbitor nativ înainte de promovare; paginile juridice (`privacy`, `termeni`, `rambursare`) nu au încă secțiuni în `de`, `pl`, `es`.

---

## 4.55.0 — 13 octombrie 2026

**Germană în aplicație.** A cincea limbă a interfeței, după ro, it, en, fr: tot ce se vede pe ecran și în documente (listă de debitare, fișă de montaj, distinta PDF, ofertă, mod Client, Order Rail) apare în limba aleasă din Setări → Limbă. Prima pornire alege germana singură dacă browserul o cere (`de`, `de-AT`, `de-CH`).

- Dicționarele `I18N` (975 chei), `SURVEY_I18N`, `AUTH_I18N`, `AI_I18N`, `EL_I18N`, `ACC_I18N`, mesajele verificărilor de coerență (`AU_I18N`) și textele paginilor de atelier (`order-rail/i18n.js`) au aceleași chei în cinci limbi. Numele feroneriei, ale sistemelor de sertar și ale materialelor din catalog au varianta germană (`de`).
- Numerele și monedele se formatează `de-DE` (virgulă zecimală, punct la mii). Dictarea vocală folosește `de-DE`; asistentul AI primește germana ca limbă de intrare.
- Nimic din geometrie nu se schimbă: cotele, piesele și golden-urile sunt identice.
- Terminologia (Korpus, Seitenwand, Einlegeboden, Topfband, Zuschnittliste, Umleimer/Kante…) a fost aleasă din meseria de tâmplărie; **merită citită de un tâmplar vorbitor nativ înainte de promovare în DE/AT/CH.**

---

## Server — 12 octombrie 2026

- `/api/pro`: codurile Pro gratuite (`comp_…`) se citesc și din `PRO_COMP_CODES_2`, pe lângă `PRO_COMP_CODES`. Se pot adăuga coduri fără a rescrie valoarea secretă veche. Fără schimbări în aplicație (fără `APP_VER`).

---

## 4.54.0 — 12 octombrie 2026

**Audit: erori de calcul și de randare, comenzi mai clare.** Găsite cu un fuzz nou (`test/fuzz.js`: configurații aleatoare pe toate tipologiile, cu verificarea închiderii, a invarianților, a găuririi și a coliziunilor 3D între piese) și cu o trecere vizuală pe telefon.

Corectate:
- **Spate în două bucăți (plăci late, ≥ ~2150 mm cu despărțitori):** suma bucăților dădea +1 mm (două jumătăți de 1099,5 → 1100 + 1100). Acum fiecare lungime e diferența dintre două cote rotunjite; închiderea e la 0 mm. Era cazul în ~1 din 3 combinații lată + despărțitori.
- **Sertarele interioare (în spatele ușilor) intrau până la 17 mm în baza corpului** (frontalul pornea de la marginea corpului, nu de la fața bazei). Acum stau pe baza. Cotele pieselor nu se schimbă, doar poziția pe înălțime.
- **Rafturi + sertare fără secțiuni marcate** (regula veche: „Sertare/secț.” pune sertare în toate secțiunile): rafturile treceau prin sertare. Acum pornesc deasupra sertarelor. Se schimbă cotele `ys` ale rafturilor la presetul Dulap (și la Cabina/Dressing); golden-urile 01, 07, 26, 27 actualizate (vezi mai jos).
- **Uși scurte (sub ~280 mm):** cele două cupe de balama cădeau la 9 mm una de alta (arretramento 100 pe o ușă de 209). Acum ≥ 80 mm între ele (nu mai aproape de 40 mm de capete); ușile normale rămân identice.
- **Traverse de 100 mm (U.3):** două excentrice Minifix puse în același loc la fiecare capăt. Acum o singură fixare la mijloc când nu încap două la distanță.
- **Invariantul I5 pe sertare metalice late** (LEGRABOX/TANDEMBOX/Matrix): citea spatele sertarului ca adâncime și dădea alarmă falsă pe orice sertar mai lat de ~535 mm.
- **Tooltip și nume accesibil** ale butoanelor din antet (Cont, Setări, Client) în limba aplicației (erau doar în italiană).
- **Comenzi:** butonul „Generează lista” rămâne lipit deasupra barei de jos pe telefon și tabletă (stătea la capătul formularului); butonul AI se numește „Generează cu AI”, ca să nu semene cu cel principal.

Rămas deschis (nu e schimbat, are nevoie de o cifră verificată): la sistemele metalice (TANDEMBOX, LEGRABOX, Matrix) fundul cutiei coboară cu 4 mm sub fața bazei (`lift` 13 mm, marcat „de verificat”): fie frontalul pornește mai sus, fie `lift` e mai mare.

Teste: `auditfixes.test.js` (10), `test:all` 593/593, golden 42/42 (01, 07, 26, 27: doar `ys` ale rafturilor).
`APP_VER` 4.54.0, `CORE_REV` 4.54.0, `SW_CACHE`/`CACHE` → `ebanist-v113`.

## 4.53.0 — 11 octombrie 2026

**Catalog propriu de feronerie și alegere pe corp (ROADMAP U.2).** Cerut de G. Roscigno.

- **Setări → Catalog:** la fiecare categorie, „＋ Adaugă articol” (marcă, nume, cod, preț). Articolele proprii stau în setări (`hwAdd`), ca datele materialelor, și apar în aceleași liste ca cele Blum/Häfele; se pot șterge.
- **Constructor → Feronerie corp:** pentru fiecare categorie (balamale, mânere, push, glisiere, suporți, picioare, îmbinări, anti-curbare) poți alege alt articol decât cel din catalog, numai pentru corpul respectiv.
- **Un singur calcul:** devizul are câte un rând pe articol, cu prețul lui; lista de feronerie din fișa de montaj și textele de montaj folosesc articolul corpului. Fără alegere, nimic nu se schimbă.
- Găurirea rămâne pe `HW_DRILL` (cotele per articol vin cu 2B.4).
- Teste: `test:all` 583/583, golden 42/42, e2e 509/509.
- `APP_VER` 4.53.0, `SW_CACHE`/`CACHE` → `ebanist-v112`. Android: fără `.aab`.

## 4.52.0 — 11 octombrie 2026

**Profil anti-curbare pe uși înalte (ROADMAP U.6).** Cerut de G. Roscigno: ușile înalte se curbează și se montează raddrizzanti tip Würth.

- Constructor → **Profil anti-curbare**: *Niciunul* (implicit), *Auto* (uși de la 1800 mm în sus) sau *Pe toate ușile*. Proiectele existente nu se schimbă.
- Profilul iese ca **accesoriu** în distinctă (câte unul pe ușă) și în deviz, în categoria nouă *Profil anti-curbare* din catalogul de feronerie (Würth / generic; prețuri de verificat).
- În **găurire**, ușa primește un canal pe fața interioară, pe înălțime, lângă marginea liberă (opusă balamalelor). Cotele canalului sunt date nevalidate (`verificat:false`) până la un profil real.
- Teste: `antiwarp.test.js` (11) și verificări în e2e. `test:all` 583/583.
- `APP_VER` 4.52.0, `SW_CACHE`/`CACHE` → `ebanist-v111`. Android: fără `.aab`.

## 4.51.0 — 11 octombrie 2026

**Până la 8 uși și 8 despărțitori în formular (ROADMAP U.5).** Cerut de G. Roscigno: un dulap de 3 m are 6 uși. Formularul tăia la 4 (`Math.min(4,…)`); prin asistentul AI nu exista limită.

- `Ante` și `Tramezzi` merg acum până la **8** (9 secțiuni). Limita e o constantă, `MAX_DOORS` / `MAX_TRAM`, folosită de formular, de cfg, de butoanele pentru partea balamalelor (U.1) și de asistentul AI (câmpurile de secțiune au acum până la 9 intrări).
- **Balamale implicite pe perechi, peste 4 uși:** prima stânga, a doua dreapta, a treia stânga… Cu secțiunile aliniate pe perechi (6 uși, 2 despărțitori), fiecare placă de balama are un panou alături, fără avertismentul `opsNoHingePanel`. **Până la 4 uși regula veche rămâne** (proiectele salvate nu se schimbă, D-39). O ușă aleasă cu mâna (U.1) rămâne cum ai ales-o.
- Planul camerei desenează deschiderea ușii din partea scrisă a balamalei, nu din poziția ei față de corp (valabil și pentru U.1).
- **Uși foarte înguste:** sub 150 mm se generează, dar apare un avertisment („reduce numărul de uși sau lărgește corpul”).
- Verificat: 3D, feronerie (cerniere pe toate ușile), fișa de montaj, închiderea la 0 mm și invarianții la 5, 6 și 8 uși.
- Teste: `doors8.test.js` (11) și 8 verificări în e2e. `test:full` 572/572 + golden 42/42, e2e 495/495.
- `APP_VER` 4.51.0, `SW_CACHE`/`CACHE` → `ebanist-v110`. Android: fără `.aab`.

## 4.50.0 — 11 octombrie 2026

**Gola: profil de aluminiu în loc de mâner (ROADMAP U.7, D-75).** Cerut de G. Roscigno. Până acum un profil gola ales din catalog doar scotea găurile de mâner, dar frontalele rămâneau pe înălțimea întreagă și profilul se număra cu bucata.

- Constructor → *Apertura* → **Gola (profil)**, cu două cote ale profilului: **gola sus** (implicit 40 mm) și **rostul C** (implicit 60 mm). Sunt cotele profilului pe care îl cumperi, nu valori de catalog verificat: se scriu în formular.
- **Frontalele se scurtează.** Sus, profilul L ia locul jocului (`gap_sup` devine înălțimea lui, în `deriveCarcass`, deci ușile, regulile de date și fișa de montaj rămân coerente). Între două sertare suprapuse rămâne rostul C, exact. Peste un rând de sertare, ușa începe la rostul C.
- **Profilele sunt rânduri de accesorii** în distinctă („Profilo gola L”: lățimea corpului, unul; „Profilo gola C”: lățimea frontalului, câte unul în fiecare rost), nu panouri: nu intră în gabarit și nu se taie din placă. În **deviz la metru** (0,8 m, 1,59 m…), cu preț pe metru, două categorii noi în catalogul de feronerie (preț de pornire de verificat). Fișa de montaj le tipărește în metri.
- **Decupare în laterale** la fiecare profil C: 60 înălțime × 20 adâncime pe muchia din față, în `scasso`, după primul grup de sertare. Corpul rămâne închis la 0 mm (D-43).
- Fără mâner și fără push: niciun mâner în deviz, nicio gaură de mâner, ușile și frontalele poartă „gola” în nume. Se vede și în 3D (profilele sunt desenate).
- Asistentul AI: `handles:"gola"`, `golaH`, `golaC`.
- **Rămâne:** gola ca rol propriu din PAL (acum numai aluminiu); decuparea în despărțitorii dintre secțiuni; profil în blocurile `drawerBlocks` numără C-urile, dar nu desenează decuparea.
- Teste: `gola.test.js` (15) și 8 verificări în e2e. `test:full` 561/561 + golden 42/42, e2e 487/487.
- **Traduceri:** 4 teste noi în e2e verifică că `I18N` (958 chei), `SURVEY_I18N` (117), `AI_I18N` (52) și `EL_I18N` (61) au aceleași chei în RO/IT/EN/FR. O funcție nouă fără textul ei într-o limbă pică testul, nu apare la utilizator.
- `APP_VER` 4.50.0, `SW_CACHE`/`CACHE` → `ebanist-v109`, `CORE_REV` 4.50.0. Android: fără `.aab`.

## 4.49.0 — 11 octombrie 2026

**Sertare pe o coloană la cotă și editor manual de cote (ROADMAP U.4).** Cerut de G. Roscigno: un dulap de 2700 cu 900 uși / 450 sertare / 450 rafturi / 900 uși, dintr-un singur corp, nu din mai multe. (U.11, numărul de sertare pe secțiune, era deja livrat în 4.41.0.)

- **`drawerBlocks`:** o coloană de sertare ÎN coloana a `col`-a a corpului, între două cote: `{col, yStart, yEnd, n | heights, nl, inner}`. Coloana se numără de la stânga printre setti-urile care taie acea înălțime. Până acum sertarele nu se combinau cu partițiile la cote absolute (eroare declarată).
- Înălțimile, adâncimea și lățimea ies din **același `drawerPlan`** ca la secțiuni; cutia sertarului și frontalul folosesc aceeași funcție (`drawBoxAt`), deci 3D, distinctă, glisiere în deviz și fișă de montaj le citesc fără cod paralel. Frontalul la vedere pleacă de la fianc (cu luciul vizibil) sau de la mijlocul setto-ului, cu rostul de 3 mm.
- **Ce nu are loc oprește generarea cu motivul:** un raft care trece prin zonă, un setto care se oprește în ea, zona în afara luminii interioare, coloană inexistentă la acea înălțime, ușă peste sertare, două blocuri suprapuse, număr sau înălțimi greșite. Sertarele nu schimbă închiderea gabaritului (D-43), care rămâne la 0 mm.
- **Editor manual: Constructor → „Cote la cotă”.** Setti, rafturi, uși (cu partea balamalelor), sertare pe blocuri și decupaje, scrise de mână, fără asistentul AI. Aceleași chei ca patch-ul AI, același `validateLayout`: o cotă care nu are loc apare sub listă, cu coloanele scrise ca la tâmplar (`80 + 19 + 2582 + 19 = 2700`), nu la „Generează”. Primul element oprește secțiunile egale (tram, sertare/secțiune → 0). Un raft nou stă pe „stânga” când există un setto.
- **Asistentul AI** scrie și el `drawerBlocks` („2700: uși jos, sertare la mijloc, rafturi, uși sus”).
- Proiectele vechi: aceeași distinctă (golden 42/42). Mesajul „sertarele nu se combină cu partiții” trimite acum la `drawerBlocks`.
- Teste: `drawerblocks.test.js` (23) și 12 verificări în e2e (formular, editor, distinctă, feronerie, fișă de montaj). `test:full` 546/546 + golden 42/42, e2e 475/475.
- `APP_VER` 4.49.0, `SW_CACHE`/`CACHE` → `ebanist-v108`, `CORE_REV` 4.49.0. Android: fără `.aab`.

## 4.48.0 — 11 octombrie 2026

**Blatul peste compoziție, cu îmbinare dreaptă la colț și decupaje (ROADMAP U.8, D-73).** Cerut de G. Roscigno, care până acum punea o piesă liberă cât bucătăria ca să-i iasă devizul.

- **Releveu → cardul „Blat”** (apare când există pereți și corpuri așezate). „Adaugă blat” ia corpurile așezate jos pe pereți; poți scoate sau adăuga corpuri. Alegi materialul blatului (grosimea vine din el, D-41) și depășirea în față (20 mm) și la capetele libere.
- Fiecare perete are **piesa lui** (`type:"blat"`, un modul ca oricare): lungimea din corpurile de pe perete, adâncimea din cel mai ieșit front plus depășirea, stă pe cel mai înalt corp. Intră în plan, în camera 3D, în distinctă și în deviz, la prețul materialului.
- **Colț: îmbinare dreaptă, cap la cap.** O piesă trece până în colț, cealaltă se oprește în muchia ei din față; alegi tu care trece, per colț. Cantul se pune în față și la capetele libere, nu pe îmbinare. Merge cu până la 8 pereți consecutivi (L, U) și numai la colț de 90°.
- **Locașurile la freză** pentru șuruburile de îmbinare, **pe dedesubt, în ambele piese**, pe aceeași linie. Sunt găuri Ø35 în fișa piesei și în CSV. **Cotele lor sunt nevalidate** (`verificat:false`, ca `HW_DRILL`): se verifică pe dima și pe șurubul folosit înainte să meargă în mașină.
- **Decupaje** (chiuvetă 780×480, plită 560×490, altul), cu rază la colțuri, la cotă: centrul pe perete, distanța din față, lățime, adâncime, rază. Sunt operații „freză” prin placă în fișa piesei (cu CSV) și apar în distinctă ca decupaje cu rază. În 3D, placa e găurită. Stau în margini (30 mm) și nu se suprapun.
- **Nu se recalculează singur.** Dacă mut un corp, cardul spune „nu mai corespunde corpurilor: recalculează”, iar piesele rămân cum erau până apeși „Calculează”.
- Avertismente: corpuri la înălțimi diferite, corp care iese din blat, colț fără corp dedesubt, decupaj peste un locaș, piesă mai mare decât placa materialului (formatul se setează în catalog).
- Un blat nu se deschide în constructor, ci doar din Releveu.
- Rol nou `blat` în motor și în ops, `ebanist-worktop.js` (funcție pură, testabilă), `CORE_REV` 4.48.0.
- **Rămâne:** îmbinare la 45° și blat pe pereți în unghi; blat peste pereți neconsecutivi; locașurile oblonge ale dimei (acum rotunde); blat din mai multe plăci pe un perete lung (acum o singură piesă, cu avertisment dacă depășește placa).
- Teste: `worktop.test.js` (29) și 14 verificări în e2e. `test:full` 523/523 + golden 42/42, e2e 463/463.
- Testul de migrare din e2e era un race (prima pagină își scria starea în IndexedDB înainte de al doilea `goto`; pica la ~jumătate din rulări pe mașini încărcate, și pe codul de dinainte). Seed-ul se scrie acum înainte de pornirea aplicației.
- `APP_VER` 4.48.0, `SW_CACHE`/`CACHE` → `ebanist-v107`. Android: fără `.aab`.

## 4.47.0 — 11 octombrie 2026

**Corp fără tavan: plin, două traverse sau nimic (ROADMAP U.3, D-72).** Cerut de G. Roscigno pentru corpurile de sub chiuvetă și de sub plită, care n-au tavan.

- Constructor → *Frontali e appoggio* → **Chiusura in alto**: *Cielo pieno* (implicit, ca până acum), *Due traverse* sau *Nessuna*. Cu traverse apare lățimea unei traverse (implicit 100 mm, între 30 și 400). Nu apare la birou, masă, pat, rotund, racordat.
- **Două traverse:** o linie în distinctă, „Traversa cielo”, 2 buc., față și spate, lungimea între laterale, același material și **aceeași grosime ca tavanul** (rolul „cielo”, D-41). Baza iese separat. Înălțimea interioară rămâne aceeași.
- **Fără tavan:** nicio piesă sus, laterale libere. Înălțimea interioară crește cu grosimea tavanului (582 → 601 mm pe corpul de test), iar spatele în canal intră numai jos și urcă până la marginea laterale.
- Tot motorul vine dintr-un loc: `deriveCarcass()` primește `top` și `top_rail_W`; închiderea (D-43), invarianții și cotele absolute citesc grosimea de sus din `topSp()`. Închiderea are un lanț nou pentru traverse (lungime + 2 laterale = lățimea corpului) și cade dacă o traversă e tăiată prea scurtă.
- **Găurire:** traversele se prind de ambele laterale cu minifix, iar tramezul urcă și se prinde de **amândouă** traversele. Fără tavan, semnul de „sub tavan” nu mai cade fals pe marginea laturii.
- **Fișa de montaj** are pașii ei pentru traverse („bază și cele două traverse”) și pentru corpul deschis sus; nu mai pomenește un tavan care nu există.
- **Asistentul AI** înțelege „fără tavan”, „cu două traverse” (`top`, `topRailW`).
- **Perete în unghi:** traversele nu se pot face (două traverse drepte nu urmează un perete oblic): tavanul rămâne întreg și apare un avertisment. „Fără tavan” merge și acolo.
- O traversă sub 30 mm sau două traverse care umplu adâncimea opresc generarea cu motivul, nu o ascund.
- **Proiectele vechi nu se schimbă (D-39):** fără `top`, aceeași distinctă. Golden 42/42 neatinse.
- Teste: `top.test.js` (23) și 12 verificări în e2e (formular, distinctă, fișa de montaj). `test:full` 494/494 + golden 42/42, e2e 449/449.
- `APP_VER` 4.47.0, `SW_CACHE`/`CACHE` → `ebanist-v106`, `CORE_REV` 4.47.0. Aplicația Android o primește fără `.aab`.

## 4.46.0 — 11 octombrie 2026

**Partea balamalelor, aleasă pe fiecare ușă din formular (ROADMAP U.1).** Cerut de G. Roscigno. Până acum partea o hotăra o regulă fixă (o ușă singură pe stânga, perechile stânga/dreapta); alegerea exista numai prin asistentul AI (`fronts[].hinge`).

- Constructor → *Frontali e appoggio* → **Lato cerniere**: câte un buton pe ușă, de la stânga. Un tap = stânga, două = dreapta, trei = înapoi la „auto”. Ușile din sticlă o au și ele. Nu apare la uși glisante, uși curbe, mese, paturi, rotunde.
- Alegerea ajunge în găurire (cupa de ⌀35 pe marginea aleasă, placa pe flancul de lângă ea), la mâner și în 3D, care deschide ușa de acolo. Se salvează în proiect (`cfg.doorHinge`).
- **Proiectele vechi nu se schimbă (D-39):** fără alegere, regula de până acum. Distinta e aceeași, rând cu rând, cu sau fără alegere.
- **Cerniere una spre alta, la mijloc, fără despărțitor:** placa n-are pe ce să se fixeze. Formularul avertizează (⚠ sub butoane), iar găurirea nu mai pune placa pe flancul de la capătul corpului. Înainte, o pereche inversată fără despărțitor (și la `fronts`) găurea placa pe flancul opus, la 450 mm de ușă, fără nicio avertizare. Acum ușa rămâne fără placă și ops scoate avertismentul `opsNoHingePanel`. Cu despărțitor la mijloc, placa e pe despărțitor, ca până acum.
- Traduceri RO / IT / EN / FR.
- Teste: `doorhinge.test.js` (11) și 11 verificări în e2e. `test:full` 471/471 + golden 42/42, e2e 438/438. Verificat în Chromium pe formularul real.
- `APP_VER` 4.46.0, `SW_CACHE`/`CACHE` → `ebanist-v105`. Aplicația Android o primește fără `.aab` (încarcă web-ul).

## Android 1.3.0 (versionCode 6) — 11 octombrie 2026 · `.aab` de construit și urcat

**Aplicația Android trece pe `ebanist.com` (ROADMAP L.10, D-71).** Până acum încărca `whimsical-wisp-61cbbf.netlify.app`, deci a doua adresă trebuia ținută cu tot cu variabilele ei din Netlify.

- `MainActivity.HOST` = `ebanist.com`. Linkurile `/app` și `/a/<atelier>` deschid aplicația pe ambele adrese (`assetlinks.json` e servit pe amândouă, verificat live). Un link spre adresa veche se deschide pe ebanist.com.
- **Proiectele nu se pierd la actualizare.** Pentru WebView, cele două adrese sunt origini diferite: localStorage (`tagliapro`, cheia AI, sesiunea Supabase) și IndexedDB `ebanist` (starea, licența, `device`, backup-urile automate) ar fi rămas pe cea veche, iar aplicația ar fi pornit goală. La prima pornire după actualizare, `/android-migrate.html` le citește pe adresa veche și le scrie pe ebanist.com, **numai cheile care lipsesc**. Nimic nu se suprascrie și nimic nu se șterge. Copia rămâne pe adresa veche și în `files/origin-backup.json`.
- Mutarea are trei încercări la pornire, iar o pornire fără semnal nu se numără. O pagină care nu răspunde e oprită după 45 s. O instalare nouă sare peste mutare.
- `whimsical-wisp` **rămâne publicat**: îl încarcă telefoanele neactualizate și servește pagina de mutare. Tot de aceea rămâne `pro-proxy.js`.
- Founders pe Play (L.11) nu intră (D-70).
- Teste: `android-migrate.test.js` (3, Chromium: două origini simulate, emoji pe granița bucăților, chei existente păstrate, nicio bază goală creată). `test:full` 460/460 + golden 42/42, e2e 427/427. `gradle assembleDebug` trece.

## Android pe versiunea web curentă — 10 octombrie 2026

**Ebanist e în producție pe Google Play** (1.2.1, versionCode 5, publicată 10.10). `netlify/android-hold` șters (1c4391c, D-67): proiectul Android (whimsical-wisp) publică din nou, deploy-ul din 10.10 06:22 UTC servește 4.45.1. Intră în aplicație: sertare pe secțiune (4.41.0, U.11), raftul extractibil (4.42.x, U.12), înălțimea și adâncimea sertarelor pe secțiune (4.43.0–4.44.x, U.13), cota de tăiere minus cantul (4.45.0, D-69), materialul fără preț în deviz (4.45.1). Fără `.aab` nou: aplicația încarcă web-ul. Plata pe Android rămâne numai Google Play (D-54) — `billing.js`, `ebanist-license.js` neschimbate din 4.40.8. `test:full` 460/460 + golden 42/42.

## 4.45.1 — 10 octombrie 2026

**Un material fără preț nu mai costă 0 € în deviz.** Cele 17 materiale Centro Legno au `prezzo_mq: null`, iar aplicația îl transforma în 0 €/m². Corpul și fronturile implicite ale unui proiect nou sunt „Bianco”, deci devizul pe setările implicite ieșea fără panouri: la dulapul de test 1160×2500×600, 47,95 € în loc de 517,03 € la panouri.

- Materialul fără preț în Catalog primește **prețul general pe m²** din Setări → Prețuri și apare în Riepilogo cu „⚠ prezzo da impostare”.
- **PDF preventivo** cere confirmare înainte de tipărire, cu numele materialelor fără preț și prețul folosit.
- Un preț scris de utilizator în Catalog (chiar și 0) are prioritate, ca înainte.
- Prețurile reale ale celor 17 materiale nu sunt încă în catalog. Se completează din lista Centro Legno, fără valori inventate.
- Teste: `price-missing.test.js` (4). `test:full` 460/460 + golden 42/42, e2e 427/427. Verificat în Chromium: Riepilogo și confirmarea pentru oferta PDF.
- `APP_VER` 4.45.1, `SW_CACHE`/`CACHE` → `ebanist-v104`. Android rămâne pe 4.40.8.

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
