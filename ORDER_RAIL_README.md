# Ebanist Order Rail — manual de operare

Cum adaugi un atelier, cum schimbi prețurile, cum citești comenzile și
cifrele. Nimic din ce scrie aici nu cere un programator.

Deciziile tehnice și de ce sunt așa: `DECISIONS.md`.

---

## Ce e Order Rail, în trei rânduri

Un atelier de debitare dă clienților lui un link. Clientul îl deschide,
proiectează mobilierul pe telefon, vede prețul atelierului în timp real și
apasă „Trimite comanda". Atelierul primește pachetul gata de tăiat, prețul
și datele clientului. Confirmă — și snapshot-ul se îngheață.

Fără cont, fără instalare, fără abonament pentru client.

---

## 1. Adaugi un atelier nou

**Un singur fișier.** Copiază `ateliers/demo.json`, redenumește-l cu
slug-ul atelierului și completează-l.

```
ateliers/tamplaria-popescu.json
```

Slug-ul poate conține doar litere mici, cifre și liniuță. El devine linkul:
`ebanist.com/a/tamplaria-popescu`.

```json
{
  "slug": "tamplaria-popescu",
  "name": "Tâmplăria Popescu",
  "logo": "https://…/logo.png",
  "language": "ro",
  "phone": "+40 741 000 000",
  "whatsapp": "40741000000",
  "pin": "4821",
  "pin_hint": "4 cifre",
  "currency": "RON",
  "price_list": { … }
}
```

| Câmp | Ce e |
|---|---|
| `name` | apare în header, pe toate documentele și în butonul de comandă |
| `logo` | adresă publică sau `data:image/png;base64,…`. Gol = fără logo. |
| `language` | `ro` `it` `fr` `en`. E limba în care pornește aplicația pentru clienții lui — dacă clientul își alege alta, alegerea lui rămâne. |
| `whatsapp` | **doar cifre**, cu prefixul de țară, fără `+` și fără spații. Altfel WhatsApp refuză linkul în tăcere. |
| `pin` | PIN-ul de inbox. Vezi §4 — fișierul e public, deci ăsta e doar rezerva. |
| `currency` | `RON`, `EUR`, orice cod ISO. Formatarea urmează limba. |

Salvezi, faci commit, deploy. Linkul merge imediat.

---

## 2. Schimbi prețurile

Tot în același fișier, în `price_list`:

```json
"price_list": {
  "default_m2": 140,
  "m2": { "pal18_alb": 120, "pfl3": 35, "mdf18": 190 },
  "edge_ml": { "0.4": 3.5, "0.8": 4.5, "2": 9.0 },
  "accessory": 45,
  "hole": 0.9,
  "cutout": 14.0,
  "labour_piece": 4.5,
  "vat": 19,
  "min_order": 0
}
```

| Cheie | Unitate | Ce acoperă |
|---|---|---|
| `m2` | preț / m² | per material, pe **ID**, nu pe nume tradus |
| `default_m2` | preț / m² | materialele care nu sunt în `m2` |
| `edge_ml` | preț / metru liniar | pe grosime de cant, în mm |
| `accessory` | preț / bucată | bară de umeraș, piciorușe, geam — piese care **nu se taie din placă** |
| `hole` | preț / bucată | o operație de găurire: o balama, un suport, un minifix, o glisieră |
| `cutout` | preț / bucată | un decupaj |
| `labour_piece` | preț / bucată | manopera per piesă tăiată |
| `vat` | % | TVA, aplicat pe net la final |
| `min_order` | preț | comandă minimă; `0` = fără |

**Aria e cea NETĂ**, nu colile cumpărate. Atelierul își pune marja de
pierderi în preț/m². Vezi `DECISIONS.md` §4.1.

### ID-urile materialelor

Prețurile se leagă de ID, nu de eticheta tradusă — aceeași placă se
numește altfel în fiecare limbă. Lista completă:

```
pal18_alb  pal18_dec  pal18_rovere  pal18_noce  pal18_antracite
pal18_grigio  pal18_nero  pal16_alb  pal25_alb
mdf18  mdf19_gloss  placaj18  pfl3  pfl5
dsp_w980_19  dsp_w908_19  dsp_w980_12  dsp_w908_16  dsp_w980_8
dsp_hydro_19  dsp_mdf_19  dsp_mdf_10  dsp_mdf_6  dsp_mdf_25
dsp_mdf_mr12  dsp_isorel_3
```

Ce lipsește cade pe `default_m2`, iar **clientul vede scris pe ecran** că
materialul acela e la preț generic, de confirmat cu atelierul. Un preț
tăcut pe o placă pe care atelierul n-o ține e felul în care se pierde o
comandă — la telefon, o zi mai târziu.

### Cum verifici că prețul e bun

Deschizi linkul, apeși ▸ Detaliu sub buton. Vezi fiecare linie: m² per
material, metri de cant, găuri, manoperă. Se verifică cu creionul.

---

## 3. Citești comenzile

```
ebanist.com/a/<slug>/inbox
```

PIN, și vezi lista. Fiecare comandă are patru stări, într-o singură
direcție:

```
primită → confirmată → tăiată → ridicată
```

- **Confirmă** îngheață snapshot-ul. De acolo, comanda nu se mai poate
  schimba — refuzul e în server, nu doar ascuns în interfață.
- Dacă clientul modifică proiectul și trimite din nou, se creează
  **v2**, o comandă nouă cu părinte, iar pagina ei arată **exact ce s-a
  schimbat pe piese** față de v1. v1 rămâne intactă: în atelier poate fi
  deja pe masa de debitat.
- Fiecare comandă are pagina ei: `ebanist.com/a/<slug>/order/<id>`, cu
  toate documentele și amprenta snapshot-ului.

### Ce primește atelierul

| Fișier | Ce e |
|---|---|
| `lab.json` | pachetul de debitare, **fără prețuri** — piese, cote, canturi, decupaje |
| `snapshot.json` | proiectul întreg, ca să poată fi redeschis identic |
| Listă de debitare | HTML gata de tipărit |
| Fișă de asamblare | HTML gata de tipărit |
| Etichete | HTML gata de tipărit, A4 |

Documentele se deschid gata de tipărit — „Salvează ca PDF" e în dialogul
de tipărire al telefonului sau al calculatorului. De ce nu sunt fișiere
`.pdf` direct: `DECISIONS.md` §3.

---

## 4. PIN-ul — de făcut înainte de primul client adevărat

`ateliers/<slug>.json` e un **fișier public**: oricine îl poate citi, deci
PIN-ul din el nu poate fi secretul.

Secretul adevărat e o variabilă de mediu în Netlify, una per atelier:

```
Site settings → Environment variables → Add

  Cheie:    INBOX_PIN_TAMPLARIA_POPESCU
  Valoare:  <hash-ul de mai jos>
```

Numele cheii e `INBOX_PIN_` + slug-ul cu majuscule și liniuțele înlocuite
cu underscore.

Hash-ul se face așa (PIN-ul `4821`, slug-ul `tamplaria-popescu`):

```bash
printf 'ebanist-inbox|tamplaria-popescu|4821' | sha256sum
```

Copiezi cele 64 de caractere ca valoare.

**Până când pui variabila**, inbox-ul merge cu PIN-ul din fișierul public
și **scrie pe ecran, cu galben, că e în mod nesecurizat**. Așa poți proba
tot fluxul azi, iar ziua în care pui variabilele nu cere nicio schimbare de
cod.

Ce apără PIN-ul: pe cineva care ghicește adresa inbox-ului. Ce nu apără:
pe cineva care are PIN-ul. Pentru o listă de comenzi de mobilă e
proporțional.

---

## 5. Citești cifrele

```
ebanist.com/api/stats?atelier=<slug>
```

Răspunde JSON:

```json
{
  "atelier": "demo",
  "sessions": 34,
  "orders_sent": 7,
  "orders_confirmed": 5,
  "first_pdf_median_s": 214,
  "first_pdf_samples": 28,
  "abandon_rate": 79
}
```

| Cifră | Ce spune |
|---|---|
| `sessions` | câți au deschis linkul |
| `first_pdf_median_s` | **secunde până la primul PDF**, median. E cifra care spune dacă „sub 10 minute" e adevărat sau doar scris în plan. Median, nu medie: o filă lăsată deschisă peste noapte ar strica media. |
| `abandon_rate` | % din sesiuni care n-au trimis nimic |
| `orders_confirmed` | câte au ajuns efectiv la debitat |

Se scriu cinci evenimente și atât: `session_start`, `first_pdf_time`,
`order_started`, `order_sent`, `order_confirmed`. **Fără IP, fără user
agent, fără nume, fără telefon.** Singurul lucru care leagă două
evenimente e un id aleator care trăiește cât ține fila deschisă. De aia
nu e nevoie de banner de cookie-uri — adică primul lucru pe care l-ar
vedea un client necunoscut nu e o casetă de închis.

---

## 6. Deploy

Nu există build step. Site-ul se publică așa cum e.

```bash
netlify login          # o singură dată
netlify link           # alegi site-ul care conține „ebanist"
netlify deploy --prod
```

Apoi verifici în 30 de secunde:

```bash
curl -sI https://ebanist.com/a/demo | head -2            # 302 → /app/?atelier=demo
curl -s  -o /dev/null -w "%{http_code}\n" https://ebanist.com/a/demo/inbox
curl -s  -o /dev/null -w "%{http_code}\n" https://ebanist.com/a/centro-legno/inbox
curl -s  https://ebanist.com/ateliers/demo.json | head -3
curl -s  https://ebanist.com/api/stats?atelier=demo
```

Ultima comandă e și proba că **Netlify Blobs merge în producție** — până
la primul deploy real, funcțiile au rulat doar contra unei magazii în
memorie care le imită contractul.

### Dacă Blobs nu răspunde

Aplicația trece singură pe **fallback local**: comanda se salvează pe
dispozitiv, se descarcă un ZIP cu tot pachetul, iar linkul de WhatsApp
rămâne funcțional — atelierul primește comanda oricum. Clientul vede scris
ce s-a întâmplat, nu un ecran care se preface că a mers.

Inbox-ul, în schimb, arată atunci doar ce e pe server. Dacă e gol și
comenzile au venit pe WhatsApp, ăsta e motivul.

---

## 7. Probe

```bash
cd test && npm install
npm test              # 237 — aplicația în mod normal, neschimbată
npm run test:rail     #  89 — Order Rail, fluxul întreg în Chromium
npm run test:price    #  28 — motorul de preț, fără browser
npm run test:geom     #  66 — motorul geometric, inclusiv regresia +18 mm
npm run test:license  #  22 — cheile Pro
```

`npm run test:rail` pornește un server care imită `netlify.toml` —
redirecturile, rescrierile, header-ele de securitate — și parcurge tot
drumul: link → corp implicit → preț → comandă → inbox cu PIN →
confirmare → v2 cu diff → cifre.

`npm run test:geom:v1` cade cu 19 teste. E intenționat și preexistent:
rulează motorul vechi (4.23) ca să arate erorile corectate de D-37.

---

## 8. Ce trebuie completat înainte de primul client adevărat

- [ ] **Prețurile reale.** Cele două ateliere seed au prețuri plauzibile
      marcate `"_placeholder": true`. Nu sunt ale nimănui.
- [ ] **Numerele de WhatsApp.** `demo` și `centro-legno` au numere false.
      Un link către un număr inexistent se deschide și nu spune nimic.
- [ ] **Variabilele `INBOX_PIN_…`** în Netlify (§4).
- [ ] **Logo-urile** atelierelor.
- [ ] **DNS-ul pe `ebanist.com`** — azi domeniul nu e legat de Netlify, deci
      niciun link de mai sus nu răspunde încă. Pașii: `MONETIZARE.md` §2a.
