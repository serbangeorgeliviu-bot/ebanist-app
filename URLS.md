# Ebanist Order Rail — adrese și PIN-uri

> **Niciunul dintre linkurile de mai jos nu răspunde încă.** Domeniul
> `ebanist.com` nu e legat de Netlify (DNS-ul nu e pus), iar deploy-ul nu
> s-a putut face din sesiunea de dezvoltare — CLI-ul Netlify răspunde
> „Not logged in", fără token în mediu. Vezi `DECISIONS.md` §1.1 și §9.
>
> Devin valide în ordinea asta:
> **1.** DNS + Netlify (`MONETIZARE.md` §2a) → **2.** `netlify deploy --prod`.

---

## Atelier 1 — Centro Legno (IT, EUR)

| | |
|---|---|
| **Link pentru clienți** | https://ebanist.com/a/centro-legno |
| Inbox comenzi | https://ebanist.com/a/centro-legno/inbox |
| PIN inbox | `2468` |
| Cifre | https://ebanist.com/api/stats?atelier=centro-legno |
| Configurație | `ateliers/centro-legno.json` |
| Limbă / monedă | italiană / EUR, TVA 22% |

## Atelier 2 — Demo (RO, RON)

| | |
|---|---|
| **Link pentru clienți** | https://ebanist.com/a/demo |
| Inbox comenzi | https://ebanist.com/a/demo/inbox |
| PIN inbox | `1234` |
| Cifre | https://ebanist.com/api/stats?atelier=demo |
| Configurație | `ateliers/demo.json` |
| Limbă / monedă | română / RON, TVA 19% |

---

## PIN-urile astea sunt provizorii

Sunt scrise în `ateliers/<slug>.json`, care e un **fișier public** —
oricine poate deschide `ebanist.com/ateliers/demo.json` și le citește.
Până când pui variabilele de mediu, inbox-ul afișează el însuși, cu
galben, că e în mod nesecurizat.

Cum le faci reale, în trei minute per atelier: `ORDER_RAIL_README.md` §4.

Pe scurt: în Netlify → Environment variables →

```
INBOX_PIN_DEMO           = sha256 de „ebanist-inbox|demo|<PIN nou>"
INBOX_PIN_CENTRO_LEGNO   = sha256 de „ebanist-inbox|centro-legno|<PIN nou>"
```

```bash
printf 'ebanist-inbox|demo|1234' | sha256sum
```

Din momentul în care variabila există, PIN-ul din fișierul public nu mai
e acceptat și avertismentul galben dispare. Nicio schimbare de cod.

---

## Alte adrese ale sitului

| Adresă | Ce e |
|---|---|
| https://ebanist.com/ | pagina de prezentare, 4 limbi |
| https://ebanist.com/app/ | aplicația, în mod normal (freemium) |
| https://ebanist.com/termeni.html | termeni și condiții |
| https://ebanist.com/privacy.html | confidențialitate |
| https://ebanist.com/rambursare.html | rambursare |

`ebanist.app` rămâne doar redirect către `.com` (D-41), și se configurează
ca *domain alias* în panoul Netlify — nu din `netlify.toml`.

---

## Cum probezi totul acum, fără deploy

```bash
cd test && npm install
CHROME_PATH=/opt/pw-browsers/chromium npm run test:rail
```

Pornește un server local care imită `netlify.toml` și parcurge tot
drumul — link, corp implicit, preț, comandă, inbox cu PIN, confirmare,
v2 cu diff, cifre. 89 de probe.
