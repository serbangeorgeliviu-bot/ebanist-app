# Proiecte demo (FAZA T)

Trei proiecte complete, făcute **numai prin căile aplicației** (`generateInto`, `layout()`, `wtApply`, `EBKitchenUI.apply`): nicio piesă scrisă de mână, niciun câmp inventat.
Se reconstruiesc cu `node tools/showcase-build.cjs all` din specificațiile `tools/showcase/specs/*.cjs` (date, nu cod); scriptul rulează controalele aplicației
(audit, ops, foi A4, distinctă, CSV, feronerie, deviz, fișa de montaj, camera) și refuză să scrie un fișier cu abateri. Instantaneul de referință al fiecărui proiect
(rânduri, piese, operații, feronerie, preț, avertismente, hash al distinctei) e în `test/golden/showcase.json`; blocul «Proiecte demo» din `test/run.js` îl compară cu proiectul încărcat din aplicație.

**În aplicație:** Proiecte → «Proiecte demo» → Deschide. Se încarcă o COPIE (steag `showcase`), niciodată peste proiectele utilizatorului; o a doua apăsare redeschide copia neatinsă.
**Limita gratuită (D-55, 1 proiect):** copia NU se numără în limită (ca exemplul de pornire, `demo`) și încărcarea ei nu trece prin zidul de proiecte; steagul cade când copia se redenumește sau se duplică
(atunci e proiectul utilizatorului și se numără). Exportul documentelor rămâne Pro (`proGate` neschimbat): demo-ul se vede, se rotește și se deschide gratuit.
**Prețuri:** feroneria nouă (D-163…D-166) are preț 0 în catalog → devizul demo-urilor e subestimat (rândurile fără preț: `hwFree` în golden) până se completează prețurile.

## Ce demonstrează fiecare

### 1. Living — peretele TV («Noir & Noce»), 15 corpuri, 88 de rânduri de distinctă
Grafit Egger U961 (structură și fronturi) + nuc Lincoln H1714 (fond, rafturi, lambriu), cameră 5900 × 4200 × 2700, podea închisă.
- Raft deschis de la pardoseală la tavan, 2 coloane (7 rafturi), LED sub plafon, dimmer îngropat
- Vitrină «ramă + sticlă» (ușile și sticla se deschid în 3D) cu LED
- AVENTOS HK top cu **SERVO-DRIVE** (clapa de sus, stânga) și Häfele Free flap cu **E-Drive** (dreapta)
- Ridicător TV Häfele (`cu: hafele_tv_lift`) în consola centrală, 3 corpuri suspendate, TIP-ON pe sertarele Legrabox
- Lambriu canelat din nuc (tip `lambriu`) în spatele televizorului
- Uși pliante WingLine L la bar (`slide` + `fold`), sertare Legrabox, birou-consolă (Birou: raft de tastatură Hettich, trecere de cablu, corp cu sertare)

### 2. Bucătărie — insulă și coloane («Beton & Stejar»), 26 de corpuri, 181 de rânduri
Beton Egger F187 (baze), F186 (pensile), stejar Gladstone tobacco (coloane), blat ceramic sinterizat 20 mm cu îmbinare la 45°.
- Modulul Bucătărie: coloane cu nișe pentru frigider, cuptor + microunde, mașină de spălat vase, plită cu hotă, chiuvetă; colț în L cu **carusel**; coloană extractibilă; gola
- AVENTOS HS top cu **SERVO-DRIVE** pe pensilele de 720 mm, pensilă de sticlă cu LED, pensilă deschisă cu LED
- Insulă din corpuri normale (3 corpuri + blat), cu sertare Legrabox și LED

### 3. Dormitor și dressing («Stejar & Textil»), 11 corpuri, 75 de rânduri
Gri lavă Egger U741 (dulapuri), stejar Davos H3131 (lambriu, noptiere, birou), textil bej F416 (pat).
- Dulap cu **uși glisante** (Hettich TopLine L, 3 uși) și 2 sertare, LED cu **senzor pe ușă**
- Dressing cu **uși pliante** WingLine L și LED, raft deschis
- Pat cu **ladă ridicabilă pe pistoane** (somieră panou), noptiere suspendate cu TIP-ON
- Lambriu canelat în stejar în spatele patului, raft luminos (LED) deasupra
- Birou cu raft de tastatură, 2 treceri de cablu, corp cu 3 sertare, raft sub blat; pensilă cu clapă SERVO-DRIVE; **corp oval** (tip `tondo`)

## Scenarii pentru clipuri verticale (30–45 s), cu ce există în aplicație
Randare: `GL3D.capture(cfg, {w:1080, h:1920, yaw, pitch, zoom, open, warm:true, led:true})` pe cadru, sau `GL3D.offlineBegin/Frame/End` (ca `site-src/tools/kitchen-clip.cjs`).
Camera de cameră: `GL3D.render(cfg, {boxes: roomBoxes(), room:{floor, tone: proj().floorTone}, leds: roomLeds()})`. `warm:true` = atmosfera caldă; `led:true/false` = lumina.
Corpurile care se deschid (uși, clape, sertare) se filmează **ca corp singur** (nume în `proj().configs`); camera 3D a camerei arată luminile și mobila întreagă, dar nu deschide ușile pe balamale.

**Living (≈40 s)**
1. 0–2 s camera, yaw 0 → 0,35, LED **stins**; la 2 s LED **aprins** (`ledOn`) — luminile cresc pe lambriu și în rafturi.
2. 2–6 s apropiere pe peretele TV (zoom 1,6 → 2,2).
3. 6–11 s `S3 Vitrină`: `open:true` — ușile cu sticlă se deschid, LED-ul din vitrină.
4. 11–16 s `S4 Clapă sus` (AVENTOS + SERVO-DRIVE) se deschide; apoi `D3 Free flap` (E-Drive) la 14 s.
5. 16–21 s `D2 Bar uși pliante` se deschid (pachetul de foi), LED aprins.
6. 21–26 s `C3 TV lift`: ridicătorul urcă ecranul.
7. 26–31 s sertarele `C4 Console drawers` / `S2 Sertare` ies (TIP-ON, Legrabox).
8. 31–37 s `GL3D.assemble` pe `S3 Vitrină` (montaj animat) sau explozie (`explode:0 → 0,9`).
9. 37–40 s înapoi în cameră, LED aprins, titlu.

**Bucătărie (≈40 s)**
1. 0–5 s camera, orbită yaw −0,55 → 0,5; la 3 s LED aprins (pensila deschisă luminează).
2. 5–10 s insula și blatul ceramic (zoom pe blat, îmbinarea la 45° din colț).
3. 10–15 s `Wall unit with doors 1.4 ↑` (clapă AVENTOS HS cu SERVO-DRIVE).
4. 15–20 s `L-shaped corner (carousel) 1.8` deschis (carusel).
5. 20–25 s `Pull-out pantry 1.3` (coloana extractibilă, 5 sertare).
6. 25–30 s `Island drawers`, apoi `Glass-door wall unit 1.5 ↑` cu LED.
7. 30–38 s explozie pe `Oven tall unit (+ microwave) 1.2` sau montaj animat; 38–40 s camera.

**Dormitor (≈40 s)**
1. 0–5 s camera, yaw 0,4 → −0,3; LED aprins la 2 s (raftul de deasupra patului, lambriul).
2. 5–11 s `W1 Sliding wardrobe`: ușile glisează, LED-ul cu senzor pe ușă se aprinde **la deschidere** (`open:true`).
3. 11–16 s `W2 Folding-door dressing` (uși pliante), LED.
4. 16–22 s `B2 Bed lift-up`: somiera se ridică, apoi noptierele `B3`/`B4`.
5. 22–28 s `D1 Desk`: raftul de tastatură și trecerile de cablu; `D2 Desk wall unit` (SERVO-DRIVE).
6. 28–33 s `D3 Oval shelf`; 33–40 s camera, LED stins → aprins ca încheiere.

## Ce nu face aplicația încă (nu s-a falsificat)
LED-ul e o bandă pe corp, sub plafonul corpului (`led: top|manual`): nu există LED în plintă / sub corpul suspendat, în firidă sau în sertar, nici în cornișă de tavan. Pentru lumină în nișă se folosește corpul deschis cu LED sub plafon. Ușile escamotabile (pocket) pe corp standard dau acum `I4` blocant la audit (frontul + jocurile nu acoperă deschiderea) — nu se folosesc; uși glisante și pliante sunt prezente (TopLine L, WingLine L).
Ușa basculantă și ușile pe balamale nu se deschid în camera 3D (doar sertarele, pliantele și, la corp singur, tot).
