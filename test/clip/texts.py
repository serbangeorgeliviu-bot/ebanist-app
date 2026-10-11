"""Textele clipului pe limbi: voce, subtitrări, end card, nume de proiect.
LANG=it|en|fr|ro (implicit it). Câte 6 bucăți de voce = 6 cadre; ultima se leagă gramatical de prima (loop).
Subtitrările: Y=galben (cuvânt-cheie), R=roșu (bani), \\N = rând nou."""
import os
Y, W, R = r"{\c&H00D6FF&}", r"{\c&HFFFFFF&}", r"{\c&H303BFF&}"   # BGR
LANG = os.environ.get("LANG_CLIP", "it")
T = {
 "it": dict(
  voice="it-IT-GiuseppeMultilingualNeural", rate="+5%", project="Cucina Rossi",
  vo=["Perdere ore a calcolare le misure a mano?",
      "Ebanist: scegli il mobile, metti le misure,",
      "e in pochi secondi hai il 3D e la lista di taglio.",
      "Niente errori, meno scarti, più soldi in tasca.",
      "Salvalo: si chiama Ebanist. Tu quanto tempo perdi per una lista di taglio? Scrivilo qui sotto.",
      "Oppure vuoi continuare a"],
  cap=[f"PERDERE {Y}TEMPO{W}\\NA CALCOLARE LE\\NMISURE A MANO?", f"{Y}EBANIST{W}: SCEGLI\\NIL MOBILE,", "METTI LE MISURE,",
       "IN POCHI SECONDI", "HAI IL 3D E LA\\NLISTA DI TAGLIO", "NIENTE ERRORI,\\NMENO SCARTI,", f"PIÙ {R}SOLDI{W} IN TASCA",
       f"SALVALO: SI CHIAMA\\N{Y}EBANIST{W}", f"TU QUANTO {Y}TEMPO{W}\\NPERDI PER UNA\\NLISTA DI TAGLIO?", "SCRIVILO QUI SOTTO",
       "OPPURE VUOI\\NCONTINUARE A…"],
  end=("SCARICA", "provalo gratis")),
 "en": dict(
  voice="en-US-AndrewNeural", rate="+5%", project="Kitchen Smith",
  vo=["Wasting hours calculating measurements by hand?",
      "Ebanist: pick the cabinet, enter the sizes,",
      "and in seconds you get the 3D and the cutting list.",
      "No mistakes, less waste, more money in your pocket.",
      "Save it: it's called Ebanist. How much time do you lose on a cutting list? Tell me below.",
      "Or do you want to keep"],
  cap=[f"WASTING {Y}TIME{W}\\NCALCULATING\\NMEASUREMENTS BY HAND?", f"{Y}EBANIST{W}: PICK\\NTHE CABINET,", "ENTER THE SIZES,",
       "IN SECONDS", "YOU GET THE 3D AND\\NTHE CUTTING LIST", "NO MISTAKES,\\NLESS WASTE,", f"MORE {R}MONEY{W}\\NIN YOUR POCKET",
       f"SAVE IT: IT'S CALLED\\N{Y}EBANIST{W}", f"HOW MUCH {Y}TIME{W} DO YOU\\NLOSE ON A\\NCUTTING LIST?", "TELL ME BELOW",
       "OR DO YOU WANT\\NTO KEEP…"],
  end=("DOWNLOAD", "try it free")),
 "fr": dict(
  voice="fr-FR-HenriNeural", rate="+5%", project="Cuisine Martin",
  vo=["Perdre des heures à calculer les mesures à la main ?",
      "Ebanist : choisis le meuble, entre les mesures,",
      "et en quelques secondes, tu as la 3D et la liste de coupe.",
      "Zéro erreur, moins de chutes, plus d'argent dans ta poche.",
      "Enregistre-la : ça s'appelle Ebanist. Combien de temps tu perds sur une liste de coupe ? Dis-le-moi en commentaire.",
      "Ou tu veux continuer à"],
  cap=[f"PERDRE DU {Y}TEMPS{W}\\NÀ CALCULER LES\\NMESURES À LA MAIN ?", f"{Y}EBANIST{W} : CHOISIS\\NLE MEUBLE,", "ENTRE LES MESURES,",
       "EN QUELQUES SECONDES", "TU AS LA 3D ET\\NLA LISTE DE COUPE", "ZÉRO ERREUR,\\NMOINS DE CHUTES,", f"PLUS D'{R}ARGENT{W}\\NDANS TA POCHE",
       f"ENREGISTRE-LA : ÇA\\NS'APPELLE {Y}EBANIST{W}", f"COMBIEN DE {Y}TEMPS{W}\\NTU PERDS SUR UNE\\NLISTE DE COUPE ?", "DIS-LE-MOI\\NEN COMMENTAIRE",
       "OU TU VEUX\\NCONTINUER À…"],
  end=("TÉLÉCHARGE", "essaie gratuitement")),
 "ro": dict(
  voice="ro-RO-EmilNeural", rate="+5%", project="Bucătărie Popescu",
  vo=["Pierzi ore calculând măsurile de mână?",
      "Ebanist: alegi mobila, introduci măsurile,",
      "și în câteva secunde ai 3D-ul și lista de debitare.",
      "Zero greșeli, mai puține resturi, mai mulți bani în buzunar.",
      "Salveaz-o: se numește Ebanist. Cât timp pierzi tu cu o listă de debitare? Scrie-mi mai jos.",
      "Sau continui să"],
  cap=[f"PIERZI ORE ({Y}TIMP{W})\\NCALCULÂND MĂSURILE\\NDE MÂNĂ?", f"{Y}EBANIST{W}: ALEGI\\NMOBILA,", "INTRODUCI MĂSURILE,",
       "ÎN CÂTEVA SECUNDE", "AI 3D-UL ȘI\\NLISTA DE DEBITARE", "ZERO GREȘELI,\\NMAI PUȚINE RESTURI,", f"MAI MULȚI {R}BANI{W}\\NÎN BUZUNAR",
       f"SALVEAZ-O: SE\\NNUMEȘTE {Y}EBANIST{W}", f"CÂT {Y}TIMP{W} PIERZI TU\\NCU O LISTĂ\\NDE DEBITARE?", "SCRIE-MI MAI JOS",
       "SAU CONTINUI\\NSĂ…"],
  end=("DESCARCĂ", "încearcă gratuit")),
}[LANG]
