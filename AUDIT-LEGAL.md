# Audit juridic și fiscal — Ebanist

24 septembrie 2026. E o analiză de pornire, făcută pe textele și codul din
repo. Partea fiscală descrie ce trebuie lămurit, dar cotele din 2026 și
încadrarea le confirmă contabilul care semnează declarațiile.

## Ce s-a rezolvat în cod și în texte (v4.37.3)

| Problema | Rezolvare |
|---|---|
| Inbox-ul comenzilor se deschidea cu PIN-ul din `ateliers/<slug>.json`, fișier public (GDPR art. 32) | PIN-ul public merge doar la `demo`; restul atelierelor cer `INBOX_PIN_<SLUG>`. Blocare 15 min după 10 PIN-uri greșite. Telefonul clientului e mascat pe pagina publică a comenzii |
| Google Fonts încărcat de la Google (IP-ul vizitatorului la Google fără consimțământ) | Fonturile se servesc din `/fonts/`; CSP-ul nu mai permite Google Fonts |
| Termeni: „ca atare” și excluderea totală a răspunderii | Limită la suma plătită în 12 luni pentru profesioniști; garanția legală pentru consumatori (OUG 141/2021); fără limitare pentru intenție sau culpă gravă |
| Termeni: legea aplicabilă fără instanță și fără protecția consumatorului (Roma I art. 6, Bruxelles I bis art. 18) | Consumatorii păstrează legea și instanța de acasă; B2B, instanțele din România |
| Lipsă cale de reclamații / ANPC SAL | Reclamații la info@ în 14 zile; link ANPC SAL în textul român |
| Lipsă termeni de persoană împuternicită cu atelierele (GDPR art. 28) | Termeni §10 |
| Termeni vs. rambursare: 1 vs. 2 proiecte gratuite, PDF cu filigran vs. fără PDF | Aliniate cu aplicația (`FREE_PROJECTS=1`, documentele de atelier sunt Pro) |
| Rambursarea descria abonamente web active; plata web nu e deschisă | Menționat că plata web nu e încă deschisă |
| „Pe durata abonamentului”, dar pe Play se vând perioade plătite în avans | „Pe perioada în care Pro este activ” |
| Schimbarea prețului anunțată „pe email”, dar din Play nu avem emailul | Anunț în aplicație (și email dacă îl avem), cu 30 de zile înainte |
| Privacy fără comenzi (Order Rail), statistici, jurnalele serverului, transferuri SUA | Adăugate în toate cele 4 limbi |

## Ce rămâne — Liviu

1. **Adresa furnizorului**: afișată „comuna Racova, județul Bacău” (24.09). Pentru Legea 365/2002 („adresa geografică”) e mai sigur cu satul și numărul; decide dacă o completezi.
   Aceeași adresă apare și în Google Play dacă ești „trader” (DSA).
2. **`INBOX_PIN_<SLUG>`** pentru fiecare atelier real, pe ambele site-uri
   Netlify (ebanist-com și whimsical-wisp). PIN de cel puțin 6 cifre. Rețeta
   e în `URLS.md`.
3. **Lemon Squeezy → Settings → Refund policy**: aceleași 14 zile ca pe site,
   în ziua în care deschizi plata pe web.

## Decizia fiscală (24.09.2026)

**Acum: persoană fizică, venituri din drepturi de proprietate intelectuală**
(autorul software-ului), Declarația unică anual + cod special de TVA art. 317.
Contabilul confirmă încadrarea înainte de prima încasare.

**Mai târziu, dacă veniturile cresc: vânzarea trece pe Domus Renov SRL.**
Ce presupune mutarea, ca să nu fie o surpriză:
- Google Play: contul de dezvoltator personal nu devine firmă; se face un cont
  de organizație (cu număr D-U-N-S pentru Domus Renov) și aplicația se
  transferă în el. Utilizatorii și achizițiile rămân, dar numele vânzătorului
  se schimbă în magazin.
- Lemon Squeezy: datele de payout și fiscale ale magazinului se trec pe SRL.
- Site: furnizor și operator în `termeni.html`, `rambursare.html`,
  `privacy.html` și subsolul din `index.html` (4 limbi).
- Contabil: de la ce dată veniturile sunt ale SRL-ului și cum se tratează
  drepturile de autor asupra aplicației (cesiune către SRL).

## Ce rămâne — contabil

1. **Forma de impozitare**: decisă (vezi mai sus), de confirmat încadrarea. Variantele analizate:
   - venituri din **drepturi de proprietate intelectuală** (autorul
     software-ului): Declarația unică, fără PFA;
   - **PFA**;
   - vânzare prin **Domus Renov SRL**, cu schimbarea numelui pe site și în
     Google Play.
2. **TVA, art. 317 Cod fiscal**: încasările de la Google Ireland sunt o
   prestare de servicii intra-UE (B2B). Probabil e nevoie de cod special de
   TVA, declarația **D390** și, pentru comisionul reținut de Google, **D301**.
   TVA-ul clienților finali îl colectează Google (Play) și Lemon Squeezy (web).
3. **Formularul W-8BEN** la Lemon Squeezy (de făcut la deschiderea plății pe
   web). Fără el, SUA pot reține până la 30% din sume.
   **Google Play: făcut 25.09.2026.** W-8BEN aprobat, persoană fizică,
   tratatul România–SUA: servicii (vânzări în aplicație) art. 7(1) 0%,
   alte drepturi de autor art. 12(2) 10%; valabil până la 31.12.2029.
   Documentul 1042-S vine electronic. Cont bancar în EUR (RO…9902),
   prag de plată 1 EUR.
4. **Evidența**: rapoartele lunare Google Play (Earnings) și payout-urile
   Lemon Squeezy, păstrate ca documente justificative.

## Observații fără urgență

- „Ebanist” e un cuvânt comun în română (meseria), deci greu de înregistrat
  ca marcă verbală aici; un logo cu nume sau o marcă UE are mai multe șanse.
- Blocul „DE COMPLETAT…” din `termeni.html` și `rambursare.html` e ascuns ca
  comentariu HTML: citește-l înainte de discuția cu contabilul.
