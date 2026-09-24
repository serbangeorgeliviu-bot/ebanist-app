# Ebanist Order Rail — adrese și PIN-uri

> **Stare la 24.09.2026: ebanist.com e pe Netlify, cu HTTPS.**
> Ce mai lipsește e în tabelul de jos.
>
> - Site Netlify **`ebanist-com`** (ID `fab6445a-6860-450a-9123-f849f6cee578`),
>   legat de `ebanist-app` / `main`, publish `.`, fără build, funcții
>   `netlify/functions`. Primul deploy: `ready` (commit `56aa6bd`), funcțiile
>   `orders`, `stats`, `model`, `_armodel` sunt publicate. Adresa tehnică:
>   https://ebanist-com.netlify.app
> - Domeniu primar `ebanist.com`; aliasuri `www.ebanist.com`, `ebanist.app`,
>   `www.ebanist.app` (Netlify trimite 301 spre `ebanist.com`).
> - DNS-ul `ebanist.com` **rămâne la register.it** (NS ns1/ns2.register.it),
>   pentru că mutarea NS ar fi dezactivat serviciile de email register.it.
>   Acolo s-au schimbat doar: A `@` → `75.2.60.5`, CNAME `www` →
>   `ebanist-com.netlify.app`. MX, SPF, recordurile de mail și PEC, neatinse.
>   Adăugat și `_dmarc` TXT `"v=DMARC1; p=none; rua=mailto:info@ebanist.com"`.
> - Email (register.it, pachetul inclus: 3 cutii, 2 GB): cutia `info@ebanist.com`;
>   `feedback@` și `support@` sunt alias spre `info@`. Primire și trimitere
>   verificate pe 24.09 (mesajul din info@ ajunge în Inbox la Gmail).
> - `ebanist.app` (Namecheap): A `@` → `75.2.60.5`, CNAME `www` →
>   `ebanist-com.netlify.app`; forwarding-ul de mail neatins.
> - Certificat Let's Encrypt emis pe 24.09 pentru `ebanist.com` și
>   `www.ebanist.com` (expiră 23.12, reînnoire automată).
> - **`whimsical-wisp-61cbbf` NU s-a atins**: aplicația Android rămâne pe
>   https://whimsical-wisp-61cbbf.netlify.app/app/ până după aprobarea de
>   producție (~17.10). Netlify Blobs sunt per site: comenzile, cifrele și
>   modelele AR de pe `ebanist.com` sunt separate de cele de pe whimsical-wisp.
>
> | Ce mai e de făcut | Cine / unde |
> |---|---|
> | Certificatul să includă și `ebanist.app` / `www.ebanist.app` (după propagare); dacă nu apare singur: Netlify → ebanist.com → Domain management → HTTPS → Renew certificate | Liviu / sesiunea următoare |
> | Testul `/`, `/app/`, `/privacy.html`, `/termeni.html`, 301 de la `ebanist.app` | sesiunea următoare |
> | `INBOX_PIN_<SLUG>` (opțional, vezi mai jos) | Liviu, Netlify → ebanist-com → Environment variables |

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
