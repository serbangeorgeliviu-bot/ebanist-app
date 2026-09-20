# Casuri golden — foaie de validare

Generat cu codul curent. **Niciunul nu e golden până nu îl confirmi.**
Ce verifici: cotele să fie cele pe care le-ai tăia tu, cu grosimea scrisă pe rând.

## Sinteză

| # | caz | L×H×P | grosimi | spate | rânduri | buc | închidere | invarianți |
|---|---|---|---|---|---|---|---|---|
| 01 | `armadio` | 1000×2200×600 | 3/19 | scanalato | 12 | 51 | ✓ | ✓ |
| 02 | `base-cassetti` | 600×720×560 | 3/19 | scanalato | 8 | 30 | ✓ | ✓ |
| 03 | `libreria` | 1880×775×282 | 3/19 | scanalato | 5 | 13 | ✓ | ✓ |
| 04 | `cassettiera` | 450×600×500 | 3/19 | scanalato | 7 | 23 | ✓ | ✓ |
| 05 | `mobile-base` | 800×720×560 | 3/19 | scanalato | 6 | 9 | ✓ | ✓ |
| 06 | `scorrevole` | 2400×2400×650 | 3/19 | scanalato | 8 | 16 | ✓ | ✓ |
| 07 | `dressing` | 1800×2200×500 | 3/19 | scanalato | 11 | 53 | ✓ | ✓ |
| 08 | `mobile-tv` | 1800×450×400 | 3/19 | scanalato | 9 | 22 | ✓ | ✓ |
| 09 | `pensile` | 800×720×320 | 3/19 | scanalato | 5 | 8 | ✓ | ✓ |
| 10 | `colonna` | 600×2100×560 | 3/19 | scanalato | 6 | 12 | ✓ | ✓ |
| 11 | `bagno` | 900×550×460 | 3/19 | scanalato | 7 | 17 | ✓ | ✓ |
| 12 | `vetrina` | 900×1800×400 | 3/19 | scanalato | 8 | 19 | ✓ | ✓ |
| 13 | `scrivania` | 1400×750×650 | — | — | 3 | 4 | ✓ | ✓ |
| 14 | `tavolo` | 1600×760×900 | — | — | 4 | 9 | ✓ | ✓ |
| 15 | `letto` | 1660×950×2060 | — | — | 5 | 19 | ✓ | ✓ |
| 16 | `tondo` | 600×1200×600 | — | — | 3 | 6 | ✓ | ✓ |
| 17 | `ovale` | 900×800×450 | — | — | 3 | 5 | ✓ | ✓ |
| 18 | `raccordato` | 900×1400×450 | — | — | 4 | 7 | ✓ | ✓ |
| 19 | `angolare-sx-int` | 1000×2200×600 | 3/19 | scanalato | 14 | 22 | ✓ | ✓ |
| 20 | `angolare-dx-int` | 1000×2200×600 | 3/19 | scanalato | 14 | 22 | ✓ | ✓ |
| 21 | `angolare-sx-ext` | 1000×2200×600 | 3/19 | scanalato | 14 | 22 | ✓ | ✓ |
| 22 | `angolare-dx-ext` | 1000×2200×600 | 3/19 | scanalato | 14 | 22 | ✓ | ✓ |
| 23 | `spate-in-cava` | 1000×2200×600 | 3/19 | scanalato | 7 | 13 | ✓ | ✓ |
| 24 | `spate-incastrat` | 1000×2200×600 | 18/19 | incassato | 7 | 13 | ✓ | ✓ |
| 25 | `spate-aplicat` | 1000×2200×600 | 18/19 | applicato | 7 | 13 | ✓ | ✓ |
| 26 | `armadio-18` | 1000×2200×600 | 3/18 | scanalato | 12 | 51 | ✓ | ✓ |
| 27 | `armadio-19` | 1000×2200×600 | 3/19 | scanalato | 12 | 51 | ✓ | ✓ |
| 28 | `libreria-18` | 1880×775×282 | 3/18 | scanalato | 5 | 13 | ✓ | ✓ |
| 29 | `libreria-19` | 1880×775×282 | 3/19 | scanalato | 5 | 13 | ✓ | ✓ |
| 30 | `cassettiera-18` | 450×600×500 | 3/18 | scanalato | 7 | 23 | ✓ | ✓ |
| 31 | `cassettiera-19` | 450×600×500 | 3/19 | scanalato | 7 | 23 | ✓ | ✓ |
| 32 | `base-18` | 800×720×560 | 3/18 | scanalato | 6 | 9 | ✓ | ✓ |
| 33 | `base-19` | 800×720×560 | 3/19 | scanalato | 6 | 9 | ✓ | ✓ |
| 34 | `colonna-18` | 600×2100×560 | 3/18 | scanalato | 6 | 12 | ✓ | ✓ |
| 35 | `colonna-19` | 600×2100×560 | 3/19 | scanalato | 6 | 12 | ✓ | ✓ |
| 36 | `grosimi-mixte` | 1000×2200×600 | 3/16/19/25 | scanalato | 8 | 13 | ✓ | ✓ |
| 37 | `sottile-16` | 800×1600×350 | 3/16 | scanalato | 5 | 10 | ✓ | ✓ |

## Perechile 18 / 19 — gabaritul nu se mișcă, cotele interne da

### 26-armadio-18 → 27-armadio-19

| rol | 18 mm | 19 mm | Δ |
|---|---|---|---|
| fianco | 2200×600 | 2200×600 | — (neschimbat) |
| base_cielo | 964×600 | 962×600 | -2 / +0 |
| zoccolo | 964×80 | 962×80 | -2 / +0 |
| divisorio | 2084×567 | 2082×567 | -2 / +0 |
| ripiano | 471×567 | 469×567 | -2 / +0 |
| accessorio | 469×25 | 467×25 | -2 / +0 |
| cassetto_frontale | 200×497 | 200×497 | — (neschimbat) |
| cassetto_fianco | 550×155 | 550×155 | — (neschimbat) |
| cassetto_fondo | 395×530 | 392×530 | -3 / +0 |
| frontale | 1506×495 | 1506×495 | — (neschimbat) |
| schienale | 2100×980 | 2098×978 | -2 / -2 |

### 28-libreria-18 → 29-libreria-19

| rol | 18 mm | 19 mm | Δ |
|---|---|---|---|
| fianco | 775×282 | 775×282 | — (neschimbat) |
| base_cielo | 1844×282 | 1842×282 | -2 / +0 |
| divisorio | 739×249 | 737×249 | -2 / +0 |
| ripiano | 600×249 | 599×249 | -1 / +0 |
| schienale | 1860×755 | 1858×753 | -2 / -2 |

### 30-cassettiera-18 → 31-cassettiera-19

| rol | 18 mm | 19 mm | Δ |
|---|---|---|---|
| fianco | 600×500 | 600×500 | — (neschimbat) |
| base_cielo | 414×500 | 412×500 | -2 / +0 |
| cassetto_frontale | 197×446 | 197×446 | — (neschimbat) |
| cassetto_fianco | 450×152 | 450×152 | — (neschimbat) |
| cassetto_fondo | 336×430 | 332×430 | -4 / +0 |
| schienale | 580×430 | 578×428 | -2 / -2 |

### 32-base-18 → 33-base-19

| rol | 18 mm | 19 mm | Δ |
|---|---|---|---|
| fianco | 720×560 | 720×560 | — (neschimbat) |
| base_cielo | 764×560 | 762×560 | -2 / +0 |
| zoccolo | 764×100 | 762×100 | -2 / +0 |
| ripiano | 762×527 | 760×527 | -2 / +0 |
| frontale | 614×395 | 614×395 | — (neschimbat) |
| schienale | 780×600 | 778×598 | -2 / -2 |

### 34-colonna-18 → 35-colonna-19

| rol | 18 mm | 19 mm | Δ |
|---|---|---|---|
| fianco | 2100×560 | 2100×560 | — (neschimbat) |
| base_cielo | 564×560 | 562×560 | -2 / +0 |
| zoccolo | 564×100 | 562×100 | -2 / +0 |
| ripiano | 562×527 | 560×527 | -2 / +0 |
| frontale | 1994×295 | 1994×295 | — (neschimbat) |
| schienale | 1980×580 | 1978×578 | -2 / -2 |


## Fiecare caz, rând cu rând

### 01-armadio

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 3 sertare (legno) · 2 uși (piena) · bară

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 472

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2082** | **567** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **469** | **567** | 4 | 19 | 1L |
| Asta appendiabiti | accessorio | — | **467** | **25** | 2 | — | — |
| Frontale cassetto | cassetto_frontale | H/L/P | **200** | **497** | 6 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **550** | **155** | 12 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **392** | **155** | 12 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **392** | **530** | 6 | 19 | — |
| Anta | frontale | H/L/P | **1506** | **495** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |

### 02-base-cassetti

`standard` · **600×720×560** · soclu 100 · zoccolo · 4 sertare (legno)

Interior: **L 562 · H 582 · P 547** · spate scanalato · secțiune 562

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **720** | **560** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **562** | **560** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **562** | **100** | 1 | 19 | 1L |
| Frontale cassetto | cassetto_frontale | H/L/P | **152** | **596** | 4 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **500** | **107** | 8 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **482** | **107** | 8 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **482** | **480** | 4 | 19 | — |
| Schienale | schienale | H/L/P | **598** | **578** | 1 | 3 | — |

### 03-libreria

`standard` · **1880×775×282** · soclu 0 · zoccolo · 2 tramezzi · 2 polițe

Interior: **L 1842 · H 737 · P 269** · spate scanalato · secțiune 601

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **775** | **282** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **1842** | **282** | 2 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **737** | **249** | 2 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **599** | **249** | 6 | 19 | 1L |
| Schienale | schienale | L/H/P | **1858** | **753** | 1 | 3 | — |

### 04-cassettiera

`standard` · **450×600×500** · soclu 0 · zoccolo · 3 sertare (legno)

Interior: **L 412 · H 562 · P 487** · spate scanalato · secțiune 412

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **600** | **500** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **412** | **500** | 2 | 19 | 1L |
| Frontale cassetto | cassetto_frontale | H/L/P | **197** | **446** | 3 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **450** | **152** | 6 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **332** | **152** | 6 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **332** | **430** | 3 | 19 | — |
| Schienale | schienale | H/L/P | **578** | **428** | 1 | 3 | — |

### 05-mobile-base

`standard` · **800×720×560** · soclu 100 · zoccolo · 1 polițe · 2 uși (piena)

Interior: **L 762 · H 582 · P 547** · spate scanalato · secțiune 762

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **720** | **560** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **762** | **560** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **762** | **100** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **760** | **527** | 1 | 19 | 1L |
| Anta | frontale | H/L/P | **614** | **395** | 2 | 19 | 2L+2C |
| Schienale | schienale | L/H/P | **778** | **598** | 1 | 3 | — |

### 06-scorrevole

`scorrevole` · **2400×2400×650** · soclu 0 · zoccolo · 2 tramezzi · 1 polițe · 2 uși (piena) · bară

Interior: **L 2362 · H 2362 · P 637** · spate scanalato · secțiune 775

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2400** | **650** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **2362** | **650** | 2 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2362** | **617** | 2 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **772** | **617** | 3 | 19 | 1L |
| Asta appendiabiti | accessorio | — | **770** | **25** | 3 | — | — |
| Anta scorrevole | frontale | H/L/P | **2355** | **1220** | 2 | 19 | 2L+2C |
| Schienale (1/2) | schienale | L/H/P | **1586** | **2378** | 1 | 3 | — |
| Schienale (2/2) | schienale | L/H/P | **792** | **2378** | 1 | 3 | — |

### 07-dressing

`standard` · **1800×2200×500** · soclu 80 · zoccolo · 2 tramezzi · 2 polițe · 2 sertare (legno) · bară

Interior: **L 1762 · H 2082 · P 487** · spate scanalato · secțiune 575

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **500** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **1762** | **500** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **1762** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2082** | **467** | 2 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **572** | **467** | 6 | 19 | 1L |
| Asta appendiabiti | accessorio | — | **570** | **25** | 3 | — | — |
| Frontale cassetto | cassetto_frontale | H/L/P | **200** | **597** | 6 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **450** | **155** | 12 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **495** | **155** | 12 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **495** | **430** | 6 | 19 | — |
| Schienale | schienale | H/L/P | **2098** | **1778** | 1 | 3 | — |

### 08-mobile-tv

`standard` · **1800×450×400** · soclu 60 · piedini · 1 tramezzi · 1 sertare (legno)

Interior: **L 1762 · H 352 · P 387** · spate scanalato · secțiune 872

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **390** | **400** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **1762** | **400** | 2 | 19 | 1L |
| Piedino regolabile | accessorio | — | **60** | **50** | 4 | — | — |
| Tramezzo | divisorio | H/P/L | **352** | **367** | 1 | 19 | 1L |
| Frontale cassetto | cassetto_frontale | H/L/P | **386** | **897** | 2 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **350** | **341** | 4 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **792** | **341** | 4 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **792** | **330** | 2 | 19 | — |
| Schienale | schienale | L/H/P | **1778** | **368** | 1 | 3 | — |

### 09-pensile

`standard` · **800×720×320** · soclu 0 · sospeso · 1 polițe · 2 uși (piena)

Interior: **L 762 · H 682 · P 307** · spate scanalato · secțiune 762

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **720** | **320** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **762** | **320** | 2 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **760** | **287** | 1 | 19 | 1L |
| Anta | frontale | H/L/P | **714** | **395** | 2 | 19 | 2L+2C |
| Schienale | schienale | L/H/P | **778** | **698** | 1 | 3 | — |

### 10-colonna

`standard` · **600×2100×560** · soclu 100 · zoccolo · 4 polițe · 2 uși (piena)

Interior: **L 562 · H 1962 · P 547** · spate scanalato · secțiune 562

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2100** | **560** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **562** | **560** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **562** | **100** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **560** | **527** | 4 | 19 | 1L |
| Anta | frontale | H/L/P | **1994** | **295** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **1978** | **578** | 1 | 3 | — |

### 11-bagno

`standard` · **900×550×460** · soclu 0 · sospeso · 2 sertare (legno)

Interior: **L 862 · H 512 · P 447** · spate scanalato · secțiune 862

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **550** | **460** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **862** | **460** | 2 | 19 | 1L |
| Frontale cassetto push | cassetto_frontale | H/L/P | **272** | **896** | 2 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **400** | **227** | 4 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **782** | **227** | 4 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **782** | **380** | 2 | 19 | — |
| Schienale | schienale | L/H/P | **878** | **528** | 1 | 3 | — |

### 12-vetrina

`standard` · **900×1800×400** · soclu 80 · zoccolo · 3 polițe · 2 uși (vetro)

Interior: **L 862 · H 1682 · P 387** · spate scanalato · secțiune 862

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **1800** | **400** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **862** | **400** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **862** | **80** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **860** | **367** | 3 | 19 | 1L |
| Montante anta vetro | frontale | H/L/P | **1714** | **70** | 4 | 19 | 2L+2C |
| Traversa anta vetro | traversa | L/H/P | **305** | **70** | 4 | 19 | 2C |
| Vetro anta | accessorio | — | **1604** | **335** | 2 | — | — |
| Schienale | schienale | H/L/P | **1698** | **878** | 1 | 3 | — |

### 13-scrivania

`scrivania` · **1400×750×650** · soclu 0 · zoccolo

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Piano scrivania | cielo | L/P/H | **1400** | **650** | 1 | — | 2L+2C |
| Fianco | fianco | H/P/L | **725** | **600** | 2 | — | 2L+2C |
| Pannello posteriore | schienale | L/H/P | **1350** | **338** | 1 | — | 1L |

### 14-tavolo

`tavolo` · **1600×760×900** · soclu 0 · zoccolo

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Piano tavolo | cielo | L/P/H | **1600** | **900** | 1 | — | 2L+2C |
| Traversa telaio | traversa | L/H/P | **1320** | **80** | 2 | — | 1L |
| Traversa telaio corta | traversa | L/H/P | **620** | **80** | 2 | — | 1L |
| Gamba legno 70×70 | accessorio | — | **735** | **70** | 4 | — | — |

### 15-letto

`letto` · **1660×950×2060** · soclu 0 · zoccolo

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Testiera | frontale | H/L/P | **1660** | **950** | 1 | — | 2L+2C |
| Pediera | frontale | H/L/P | **1660** | **400** | 1 | — | 2L+2C |
| Sponda laterale | fianco | H/P/L | **2022** | **300** | 2 | — | 1L |
| Traversa centrale | traversa | L/H/P | **2022** | **120** | 1 | — | — |
| Doga faggio 68mm | accessorio | — | **1612** | **68** | 14 | — | — |

### 16-tondo

`tondo` · **600×1200×600** · soclu 0 · zoccolo · 3 polițe

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fascia | fianco | H/P/L | **1885** | **1162** | 1 | — | — |
| Fondo / Cielo tondo | base_cielo | L/P/H | **562** | **562** | 2 | — | — |
| Ripiano tondo | ripiano | L/P/H | **562** | **562** | 3 | — | 1L |

### 17-ovale

`tondo` · **900×800×450** · soclu 0 · zoccolo · 2 polițe

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fascia | fianco | H/P/L | **2180** | **762** | 1 | — | — |
| Fondo / Cielo tondo | base_cielo | L/P/H | **862** | **412** | 2 | — | — |
| Ripiano tondo | ripiano | L/P/H | **862** | **412** | 2 | — | 1L |

### 18-raccordato

`raccordato` · **900×1400×450** · soclu 0 · zoccolo · 3 polițe

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fascia raccordata | fianco | H/P/L | **1731** | **1362** | 1 | — | — |
| Fondo / Cielo raccordato | base_cielo | L/P/H | **862** | **431** | 2 | — | — |
| Ripiano raccordato | ripiano | L/P/H | **862** | **431** | 3 | — | 1L |
| Schienale | schienale | L/H/P | **862** | **1362** | 1 | — | — |

### 19-angolare-sx-int

`angolare` · **1000×2200×600** · soclu 80 · zoccolo · 3 polițe · 1 uși (piena) · bară

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 962

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco (A) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (A) | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo (A) | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Ripiano mobile (A) | ripiano | L/P/H | **960** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (A) | accessorio | — | **958** | **25** | 1 | — | — |
| Anta (A) | frontale | H/L/P | **2114** | **994** | 1 | 19 | 2L+2C |
| Schienale (A) | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |
| Fianco (B) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (B) | base_cielo | L/P/H | **862** | **600** | 2 | 19 | 1L |
| Zoccolo (B) | zoccolo | L/H/P | **862** | **80** | 1 | 19 | 1L |
| Ripiano mobile (B) | ripiano | L/P/H | **860** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (B) | accessorio | — | **858** | **25** | 1 | — | — |
| Anta (B) | frontale | H/L/P | **2114** | **894** | 1 | 19 | 2L+2C |
| Schienale (B) | schienale | H/L/P | **2098** | **878** | 1 | 3 | — |

### 20-angolare-dx-int

`angolare` · **1000×2200×600** · soclu 80 · zoccolo · 3 polițe · 1 uși (piena) · bară

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 962

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco (A) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (A) | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo (A) | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Ripiano mobile (A) | ripiano | L/P/H | **960** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (A) | accessorio | — | **958** | **25** | 1 | — | — |
| Anta (A) | frontale | H/L/P | **2114** | **994** | 1 | 19 | 2L+2C |
| Schienale (A) | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |
| Fianco (B) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (B) | base_cielo | L/P/H | **862** | **600** | 2 | 19 | 1L |
| Zoccolo (B) | zoccolo | L/H/P | **862** | **80** | 1 | 19 | 1L |
| Ripiano mobile (B) | ripiano | L/P/H | **860** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (B) | accessorio | — | **858** | **25** | 1 | — | — |
| Anta (B) | frontale | H/L/P | **2114** | **894** | 1 | 19 | 2L+2C |
| Schienale (B) | schienale | H/L/P | **2098** | **878** | 1 | 3 | — |

### 21-angolare-sx-ext

`angolare` · **1000×2200×600** · soclu 80 · zoccolo · 3 polițe · 1 uși (piena) · bară

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 962

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco (A) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (A) | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo (A) | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Ripiano mobile (A) | ripiano | L/P/H | **960** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (A) | accessorio | — | **958** | **25** | 1 | — | — |
| Anta (A) | frontale | H/L/P | **2114** | **994** | 1 | 19 | 2L+2C |
| Schienale (A) | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |
| Fianco (B) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (B) | base_cielo | L/P/H | **862** | **600** | 2 | 19 | 1L |
| Zoccolo (B) | zoccolo | L/H/P | **862** | **80** | 1 | 19 | 1L |
| Ripiano mobile (B) | ripiano | L/P/H | **860** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (B) | accessorio | — | **858** | **25** | 1 | — | — |
| Anta (B) | frontale | H/L/P | **2114** | **894** | 1 | 19 | 2L+2C |
| Schienale (B) | schienale | H/L/P | **2098** | **878** | 1 | 3 | — |

### 22-angolare-dx-ext

`angolare` · **1000×2200×600** · soclu 80 · zoccolo · 3 polițe · 1 uși (piena) · bară

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 962

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco (A) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (A) | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo (A) | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Ripiano mobile (A) | ripiano | L/P/H | **960** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (A) | accessorio | — | **958** | **25** | 1 | — | — |
| Anta (A) | frontale | H/L/P | **2114** | **994** | 1 | 19 | 2L+2C |
| Schienale (A) | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |
| Fianco (B) | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo (B) | base_cielo | L/P/H | **862** | **600** | 2 | 19 | 1L |
| Zoccolo (B) | zoccolo | L/H/P | **862** | **80** | 1 | 19 | 1L |
| Ripiano mobile (B) | ripiano | L/P/H | **860** | **567** | 3 | 19 | 1L |
| Asta appendiabiti (B) | accessorio | — | **858** | **25** | 1 | — | — |
| Anta (B) | frontale | H/L/P | **2114** | **894** | 1 | 19 | 2L+2C |
| Schienale (B) | schienale | H/L/P | **2098** | **878** | 1 | 3 | — |

### 23-spate-in-cava

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 2 uși (piena)

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 472

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2082** | **567** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **469** | **567** | 4 | 19 | 1L |
| Anta | frontale | H/L/P | **2114** | **495** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |

### 24-spate-incastrat

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 2 uși (piena)

Interior: **L 962 · H 2082 · P 582** · spate incassato · secțiune 472

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **962** | **582** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2082** | **562** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **469** | **562** | 4 | 19 | 1L |
| Anta | frontale | H/L/P | **2114** | **495** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **2200** | **962** | 1 | 18 | — |

### 25-spate-aplicat

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 2 uși (piena)

Interior: **L 962 · H 2082 · P 582** · spate applicato · secțiune 472

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **582** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **962** | **582** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2082** | **562** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **469** | **562** | 4 | 19 | 1L |
| Anta | frontale | H/L/P | **2114** | **495** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **2200** | **1000** | 1 | 18 | — |

### 26-armadio-18

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 3 sertare (legno) · 2 uși (piena) · bară

Interior: **L 964 · H 2084 · P 587** · spate scanalato · secțiune 473

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **600** | 2 | 18 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **964** | **600** | 2 | 18 | 1L |
| Zoccolo | zoccolo | L/H/P | **964** | **80** | 1 | 18 | 1L |
| Tramezzo | divisorio | H/P/L | **2084** | **567** | 1 | 18 | 1L |
| Ripiano mobile | ripiano | L/P/H | **471** | **567** | 4 | 18 | 1L |
| Asta appendiabiti | accessorio | — | **469** | **25** | 2 | — | — |
| Frontale cassetto | cassetto_frontale | H/L/P | **200** | **497** | 6 | 18 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **550** | **155** | 12 | 18 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **395** | **155** | 12 | 18 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **395** | **530** | 6 | 18 | — |
| Anta | frontale | H/L/P | **1506** | **495** | 2 | 18 | 2L+2C |
| Schienale | schienale | H/L/P | **2100** | **980** | 1 | 3 | — |

### 27-armadio-19

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 3 sertare (legno) · 2 uși (piena) · bară

Interior: **L 962 · H 2082 · P 587** · spate scanalato · secțiune 472

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **962** | **600** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2082** | **567** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **469** | **567** | 4 | 19 | 1L |
| Asta appendiabiti | accessorio | — | **467** | **25** | 2 | — | — |
| Frontale cassetto | cassetto_frontale | H/L/P | **200** | **497** | 6 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **550** | **155** | 12 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **392** | **155** | 12 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **392** | **530** | 6 | 19 | — |
| Anta | frontale | H/L/P | **1506** | **495** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **2098** | **978** | 1 | 3 | — |

### 28-libreria-18

`standard` · **1880×775×282** · soclu 0 · zoccolo · 2 tramezzi · 2 polițe

Interior: **L 1844 · H 739 · P 269** · spate scanalato · secțiune 603

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **775** | **282** | 2 | 18 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **1844** | **282** | 2 | 18 | 1L |
| Tramezzo | divisorio | H/P/L | **739** | **249** | 2 | 18 | 1L |
| Ripiano mobile | ripiano | L/P/H | **600** | **249** | 6 | 18 | 1L |
| Schienale | schienale | L/H/P | **1860** | **755** | 1 | 3 | — |

### 29-libreria-19

`standard` · **1880×775×282** · soclu 0 · zoccolo · 2 tramezzi · 2 polițe

Interior: **L 1842 · H 737 · P 269** · spate scanalato · secțiune 601

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **775** | **282** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **1842** | **282** | 2 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **737** | **249** | 2 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **599** | **249** | 6 | 19 | 1L |
| Schienale | schienale | L/H/P | **1858** | **753** | 1 | 3 | — |

### 30-cassettiera-18

`standard` · **450×600×500** · soclu 0 · zoccolo · 3 sertare (legno)

Interior: **L 414 · H 564 · P 487** · spate scanalato · secțiune 414

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **600** | **500** | 2 | 18 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **414** | **500** | 2 | 18 | 1L |
| Frontale cassetto | cassetto_frontale | H/L/P | **197** | **446** | 3 | 18 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **450** | **152** | 6 | 18 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **336** | **152** | 6 | 18 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **336** | **430** | 3 | 18 | — |
| Schienale | schienale | H/L/P | **580** | **430** | 1 | 3 | — |

### 31-cassettiera-19

`standard` · **450×600×500** · soclu 0 · zoccolo · 3 sertare (legno)

Interior: **L 412 · H 562 · P 487** · spate scanalato · secțiune 412

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **600** | **500** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **412** | **500** | 2 | 19 | 1L |
| Frontale cassetto | cassetto_frontale | H/L/P | **197** | **446** | 3 | 19 | 2L+2C |
| Fianco cassetto | cassetto_fianco | P/H/L | **450** | **152** | 6 | 19 | 1L |
| Fronte/Retro cassetto | cassetto_fianco | L/H/P | **332** | **152** | 6 | 19 | 1L |
| Fondo cassetto | cassetto_fondo | L/P/H | **332** | **430** | 3 | 19 | — |
| Schienale | schienale | H/L/P | **578** | **428** | 1 | 3 | — |

### 32-base-18

`standard` · **800×720×560** · soclu 100 · zoccolo · 1 polițe · 2 uși (piena)

Interior: **L 764 · H 584 · P 547** · spate scanalato · secțiune 764

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **720** | **560** | 2 | 18 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **764** | **560** | 2 | 18 | 1L |
| Zoccolo | zoccolo | L/H/P | **764** | **100** | 1 | 18 | 1L |
| Ripiano mobile | ripiano | L/P/H | **762** | **527** | 1 | 18 | 1L |
| Anta | frontale | H/L/P | **614** | **395** | 2 | 18 | 2L+2C |
| Schienale | schienale | L/H/P | **780** | **600** | 1 | 3 | — |

### 33-base-19

`standard` · **800×720×560** · soclu 100 · zoccolo · 1 polițe · 2 uși (piena)

Interior: **L 762 · H 582 · P 547** · spate scanalato · secțiune 762

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **720** | **560** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **762** | **560** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **762** | **100** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **760** | **527** | 1 | 19 | 1L |
| Anta | frontale | H/L/P | **614** | **395** | 2 | 19 | 2L+2C |
| Schienale | schienale | L/H/P | **778** | **598** | 1 | 3 | — |

### 34-colonna-18

`standard` · **600×2100×560** · soclu 100 · zoccolo · 4 polițe · 2 uși (piena)

Interior: **L 564 · H 1964 · P 547** · spate scanalato · secțiune 564

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2100** | **560** | 2 | 18 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **564** | **560** | 2 | 18 | 1L |
| Zoccolo | zoccolo | L/H/P | **564** | **100** | 1 | 18 | 1L |
| Ripiano mobile | ripiano | L/P/H | **562** | **527** | 4 | 18 | 1L |
| Anta | frontale | H/L/P | **1994** | **295** | 2 | 18 | 2L+2C |
| Schienale | schienale | H/L/P | **1980** | **580** | 1 | 3 | — |

### 35-colonna-19

`standard` · **600×2100×560** · soclu 100 · zoccolo · 4 polițe · 2 uși (piena)

Interior: **L 562 · H 1962 · P 547** · spate scanalato · secțiune 562

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2100** | **560** | 2 | 19 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **562** | **560** | 2 | 19 | 1L |
| Zoccolo | zoccolo | L/H/P | **562** | **100** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **560** | **527** | 4 | 19 | 1L |
| Anta | frontale | H/L/P | **1994** | **295** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **1978** | **578** | 1 | 3 | — |

### 36-grosimi-mixte

`standard` · **1000×2200×600** · soclu 80 · zoccolo · 1 tramezzi · 2 polițe · 2 uși (piena)

Interior: **L 962 · H 2076 · P 587** · spate scanalato · secțiune 472

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **2200** | **600** | 2 | 19 | 2L+2C |
| Base | base | L/P/H | **962** | **600** | 1 | 19 | 1L |
| Cielo | cielo | L/P/H | **962** | **600** | 1 | 25 | 1L |
| Zoccolo | zoccolo | L/H/P | **962** | **80** | 1 | 19 | 1L |
| Tramezzo | divisorio | H/P/L | **2076** | **567** | 1 | 19 | 1L |
| Ripiano mobile | ripiano | L/P/H | **469** | **567** | 4 | 16 | 1L |
| Anta | frontale | H/L/P | **2114** | **495** | 2 | 19 | 2L+2C |
| Schienale | schienale | H/L/P | **2092** | **978** | 1 | 3 | — |

### 37-sottile-16

`standard` · **800×1600×350** · soclu 0 · sospeso · 3 polițe · 2 uși (piena)

Interior: **L 768 · H 1568 · P 337** · spate scanalato · secțiune 768

| element | rol | axe | lung | lăț | buc | sp | cant |
|---|---|---|---|---|---|---|---|
| Fianco | fianco | H/P/L | **1600** | **350** | 2 | 16 | 2L+2C |
| Base / Cielo | base_cielo | L/P/H | **768** | **350** | 2 | 16 | 1L |
| Ripiano mobile | ripiano | L/P/H | **766** | **317** | 3 | 16 | 1L |
| Anta | frontale | H/L/P | **1594** | **395** | 2 | 16 | 2L+2C |
| Schienale | schienale | H/L/P | **1584** | **784** | 1 | 3 | — |

