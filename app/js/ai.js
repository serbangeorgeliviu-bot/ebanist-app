"use strict";
/* ===========================================================================
   Ebanist — app/js/ai.js

   Il campo magico: dettatura, chiamata al modello con schema d'uscita
   vincolato, validazione e clamp di quello che torna, diff leggibile e
   foglio di conferma. Niente entra nello stato senza passare di qui.
   =========================================================================== */
/* ================= AI MAGIC INPUT =================
   Traduttore: testo + voce + foto -> patch sullo state (configs / survey / layout).
   NON tocca la geometria: scrive solo negli stessi campi che scriverebbe la mano
   sui form. Ogni patch passa da validazione, clamp e conferma umana. */

const AI_I18N={
it:{aiKeyWarn:"⚠ La chiave resta su questo telefono e parte direttamente dal browser verso Anthropic. Usa una chiave dedicata, che puoi revocare da sola, e cancellala se il telefono cambia mano.",aiKeyBad:"Non sembra una chiave Anthropic (inizia con sk-ant-).",aiKeyDel:"Elimina la chiave",aiKeyDelAsk:"Eliminare la chiave API da questo telefono?",aiKeyGone:"Chiave eliminata ✓",aiKeyOk:"Chiave salvata ({k})",aiKeyFail:"Chiave NON salvata — il telefono blocca la memoria locale (navigazione privata?)",aiPh:"Descrivi il mobile a voce o per iscritto…",aiPhSv:"Detta le quote del muro, prese, tubi…",
  aiSend:"Genera",aiThinking:"Sto leggendo…",aiMic:"Detta",aiCam:"Foto",aiNoKey:"Manca la chiave API — Impostazioni → Assistente AI",
  aiNoSpeech:"Dettatura non disponibile su questo browser — usa il microfono della tastiera",
  aiErr:"L'assistente non ha risposto: {e}",aiNoChange:"Niente da cambiare",aiTitle:"Proposta dell'assistente",
  aiApply:"Applica",aiCancel:"Annulla",aiApplied:"Applicato",aiAsk:"Domande",aiWarnHdr:"Attenzione",
  aiSet:"Assistente AI",aiKeyLbl:"Chiave API Anthropic",aiKeyHint:"Resta solo su questo telefono: non entra nei backup né nella sincronizzazione.",
  aiModelLbl:"Modello",aiProxyLbl:"Endpoint proprio (opzionale)",aiProxyHint:"Se compilato, la chiamata passa di qui e la chiave non serve.",
  aiImgOnly:"Aggiungi anche una descrizione o una foto",aiCtxCfg:"Modulo corrente",aiCtxSv:"Rilievo corrente",
  aiBoundNote:"Taglio obliquo: la fabbrica taglia dritto. La distinta esporta il rettangolo di sbozzo; l'angolo resta nel 3D e nel disegno.",
  aiSecNote:"Le divisioni interne diventano tramezzi + contenuto per sezione: nessun mobile in più."},
ro:{aiKeyWarn:"⚠ Cheia rămâne pe telefonul ăsta și pleacă direct din browser către Anthropic. Folosește o cheie dedicată, pe care o poți revoca separat, și șterge-o dacă telefonul schimbă mâna.",aiKeyBad:"Nu pare o cheie Anthropic (începe cu sk-ant-).",aiKeyDel:"Șterge cheia",aiKeyDelAsk:"Ștergi cheia API de pe telefonul ăsta?",aiKeyGone:"Cheie ștearsă ✓",aiKeyOk:"Cheie salvată ({k})",aiKeyFail:"Cheia NU s-a salvat — telefonul blochează memoria locală (navigare privată?)",aiPh:"Descrie corpul cu vocea sau în scris…",aiPhSv:"Dictează cotele peretelui, prize, țevi…",
  aiSend:"Generează",aiThinking:"Citesc…",aiMic:"Dictează",aiCam:"Poză",aiNoKey:"Lipsește cheia API — Setări → Asistent AI",
  aiNoSpeech:"Dictarea nu merge pe browserul ăsta — folosește microfonul tastaturii",
  aiErr:"Asistentul n-a răspuns: {e}",aiNoChange:"Nimic de schimbat",aiTitle:"Propunerea asistentului",
  aiApply:"Aplică",aiCancel:"Renunță",aiApplied:"Aplicat",aiAsk:"Întrebări",aiWarnHdr:"Atenție",
  aiSet:"Asistent AI",aiKeyLbl:"Cheie API Anthropic",aiKeyHint:"Rămâne doar pe telefonul ăsta: nu intră în backup și nici în sincronizare.",
  aiModelLbl:"Model",aiProxyLbl:"Endpoint propriu (opțional)",aiProxyHint:"Dacă îl completezi, apelul trece pe acolo și cheia nu mai e necesară.",
  aiImgOnly:"Adaugă și o descriere sau o poză",aiCtxCfg:"Corpul curent",aiCtxSv:"Releveul curent",
  aiBoundNote:"Tăietură oblică: fabrica taie drept. Distinta exportă dreptunghiul de gabarit; unghiul rămâne în 3D și pe desen.",
  aiSecNote:"Compartimentările devin tramezzi + conținut pe secțiune: niciun corp în plus."},
en:{aiKeyWarn:"⚠ The key stays on this phone and goes straight from the browser to Anthropic. Use a dedicated key you can revoke on its own, and delete it if the phone changes hands.",aiKeyBad:"That does not look like an Anthropic key (starts with sk-ant-).",aiKeyDel:"Delete the key",aiKeyDelAsk:"Delete the API key from this phone?",aiKeyGone:"Key deleted ✓",aiKeyOk:"Key saved ({k})",aiKeyFail:"Key NOT saved — this phone blocks local storage (private browsing?)",aiPh:"Describe the unit by voice or in writing…",aiPhSv:"Dictate wall sizes, sockets, pipes…",
  aiSend:"Generate",aiThinking:"Reading…",aiMic:"Dictate",aiCam:"Photo",aiNoKey:"API key missing — Settings → AI assistant",
  aiNoSpeech:"Dictation is not available in this browser — use the keyboard microphone",
  aiErr:"The assistant did not answer: {e}",aiNoChange:"Nothing to change",aiTitle:"Assistant proposal",
  aiApply:"Apply",aiCancel:"Cancel",aiApplied:"Applied",aiAsk:"Questions",aiWarnHdr:"Careful",
  aiSet:"AI assistant",aiKeyLbl:"Anthropic API key",aiKeyHint:"Stays on this phone only: it never enters backups or sync.",
  aiModelLbl:"Model",aiProxyLbl:"Own endpoint (optional)",aiProxyHint:"If set, the call goes through it and no key is needed.",
  aiImgOnly:"Add a description or a photo as well",aiCtxCfg:"Current unit",aiCtxSv:"Current survey",
  aiBoundNote:"Angled cut: the factory cuts square. The cut list exports the bounding rectangle; the angle stays in the 3D and on the drawing.",
  aiSecNote:"Internal divisions become dividers + per-section content: no extra units."},
fr:{aiKeyWarn:"⚠ La clé reste sur ce téléphone et part directement du navigateur vers Anthropic. Utilisez une clé dédiée, révocable séparément, et supprimez-la si le téléphone change de mains.",aiKeyBad:"Cela ne ressemble pas à une clé Anthropic (commence par sk-ant-).",aiKeyDel:"Supprimer la clé",aiKeyDelAsk:"Supprimer la clé API de ce téléphone ?",aiKeyGone:"Clé supprimée ✓",aiKeyOk:"Clé enregistrée ({k})",aiKeyFail:"Clé NON enregistrée — ce téléphone bloque le stockage local (navigation privée ?)",aiPh:"Décrivez le meuble à la voix ou par écrit…",aiPhSv:"Dictez les cotes du mur, prises, tuyaux…",
  aiSend:"Générer",aiThinking:"Je lis…",aiMic:"Dicter",aiCam:"Photo",aiNoKey:"Clé API manquante — Réglages → Assistant IA",
  aiNoSpeech:"Dictée indisponible sur ce navigateur — utilisez le micro du clavier",
  aiErr:"L'assistant n'a pas répondu : {e}",aiNoChange:"Rien à changer",aiTitle:"Proposition de l'assistant",
  aiApply:"Appliquer",aiCancel:"Annuler",aiApplied:"Appliqué",aiAsk:"Questions",aiWarnHdr:"Attention",
  aiSet:"Assistant IA",aiKeyLbl:"Clé API Anthropic",aiKeyHint:"Reste sur ce téléphone : jamais dans les sauvegardes ni la synchro.",
  aiModelLbl:"Modèle",aiProxyLbl:"Endpoint propre (optionnel)",aiProxyHint:"S'il est rempli, l'appel passe par là et la clé devient inutile.",
  aiImgOnly:"Ajoutez aussi une description ou une photo",aiCtxCfg:"Meuble courant",aiCtxSv:"Relevé courant",
  aiBoundNote:"Coupe oblique : l'usine coupe droit. La liste exporte le rectangle d'encombrement ; l'angle reste en 3D et sur le dessin.",
  aiSecNote:"Les divisions internes deviennent des séparations + contenu par section : aucun meuble en plus."}};
function tia(k){ return (AI_I18N[state.lang]||AI_I18N.it)[k]||k; }

/* la chiave sta fuori da `state`: i backup e la sincronizzazione Supabase
   portano via tutto lo state, e una chiave API non deve viaggiare con loro. */
function aiKey(){ try{ return localStorage.getItem("ebanist_ai_key")||""; }catch(e){ return ""; } }
/* torna true solo se la chiave e' davvero rimasta scritta: in navigazione privata
   localStorage accetta la chiamata e non conserva niente, e il messaggio
   "manca la chiave" arriverebbe senza spiegazione. */
function aiSetKey(v){
  try{
    if(v) localStorage.setItem("ebanist_ai_key",v); else localStorage.removeItem("ebanist_ai_key");
    return aiKey()===(v||"");
  }catch(e){ return false; }
}
function aiModel(){ return (state.settings&&state.settings.aiModel)||"claude-opus-5"; }
function aiProxy(){ return ((state.settings&&state.settings.aiProxy)||"").trim(); }
const AI_MODELS=[["claude-opus-5","Opus 5"],["claude-sonnet-5","Sonnet 5"]];
const AI_ENDPOINT="https://api.anthropic.com/v1/messages";
const AI_SPEECH_LANG={it:"it-IT",ro:"ro-RO",en:"en-GB",fr:"fr-FR"};

/* ---------- enum del dominio: l'AI deve agganciarsi a QUESTI id ---------- */
/* Gli enum devono coprire TUTTO quello che offre il modulo a schermo: se un
   tipo esiste nella tendina e non qui, dettarlo a voce non puo funzionare e la
   validazione lo scarta senza che si capisca perche. Regola: un tipo nuovo
   entra in AI_ENUM nello stesso commit in cui entra nell'interfaccia. */
const AI_ENUM={
  type:["standard","angolare","scorrevole","scrivania","tavolo","letto","tondo","raccordato"],
  front:["piena","vetro","curvo"], support:["zoccolo","piedini","sospeso"],
  handles:["maniglia","push"], shelfType:["mobile","fisso"],
  corner:["sx","dx"], cornerKind:["int","ext"],
  secMode:["hangShelf","hang","shelf","empty","drawers","drawerShelf"],
  drawerSys:DRAWSYS_IDS, drawerDist:["fix","uguali","cucina"], drawerPos:["auto","vista","interno"],
  obst:["presa","interr","tubo","calorifero","vano","trave","altro"]};
/* i codici di altezza sponda validi: dipendono dal sistema, quindi l'unione */
const AI_DRAWH=Object.keys(DRAWSYS).reduce((a,k)=>{
  Object.keys(DRAWSYS[k].hs||{}).forEach(c=>{ if(a.indexOf(c)<0) a.push(c); }); return a; },[]);
function aiMatIds(){ return matVisible().map(m=>m.id); }
function aiMatLines(){ return matVisible().map(m=>{ const e=matById(m.id)||{}; return `  ${m.id} = ${e.label||""} (${e.th}mm, ${e.pw}x${e.ph})`; }).join("\n"); }

/* ---------- SYSTEM PROMPT ---------- */
function aiSystem(mode){
  const P=[];
  P.push(`You are the parametric translator inside Ebanist, a cabinetmaking app used in real production. The user is a cabinetmaker working on site, writing from a phone in Italian, Romanian, English or French. You convert what they say (and what a photo shows) into a strict JSON patch on the application state. You never invent numbers he did not give and never redesign what he did not ask about.`);
  P.push(`ABSOLUTE RULES
1. All lengths are millimetres, integers, as measured on site. Never centimetres, never inches. "un metro ottantatre" = 1830. "doi metri" = 2000.
2. PARTIAL UPDATE. Emit ONLY the fields that must change. If he says "make it 20 mm deeper", emit just the new P. Never restate unchanged fields — every field you emit overwrites the current one.
3. STRICT ENUM MATCHING. Materials, types and options must be one of the ids listed below, copied exactly. If nothing matches what he described, leave the field out and put a line in "questions". Never invent an id, never translate an id.
4. If a measurement is missing, ambiguous or physically impossible, leave the field out and ask in "questions". A wrong number gets cut into a real panel and costs money; an unanswered question costs a sentence.
5. Write "notes" in the user's own language, one short sentence describing what you changed.`);
  P.push(`MATERIAL IDS (copy exactly, id only):\n${aiMatLines()}`);
  if(mode==="genera"){
    P.push(`SECTION 2 — the unit (configs)
The unit is ONE parametric carcass. Dimensions: L = width, H = height, P = depth, all outside, in mm. For "angolare" only, L2 = width of wing B.

INTERNAL DIVISIONS — hard rule. Never split the described unit into several units for its internal partitions. A "wardrobe with a 600 mm column on the left and hanging on the right" is ONE unit with tram=1 and secMode=["shelf","hang"]. Sections are created by "tram" (0..4 vertical dividers => tram+1 sections, left to right) and each section's content is one entry of "secMode":
  hangShelf = rail + shelves, hang = rail only, shelf = shelves only, empty = empty,
  drawers = a column of drawers, drawerShelf = drawers at the bottom with shelves above them
secMode.length must equal tram+1.

DRAWERS. "drawers" is the count PER SECTION. Where they go:
- No section is marked "drawers"/"drawerShelf" => the drawers are external fronts, at the bottom, in EVERY section. This is a chest of drawers or a kitchen base.
- At least one section marked "drawers"/"drawerShelf" => only those sections get them.
"drawerPos" then decides where those fronts sit, and BOTH are normal joinery — pick from what he said, do not assume:
  interno = behind the doors. The engine sets them back by "drawerInset" mm so the hinge arm clears them, gives them no handle, and the doors keep their full height. "wardrobe with two doors and three drawers INSIDE on the right" => tram=1, secMode=["hang","drawers"], drawers=3, doors=2, drawerPos="interno".
  vista = on the facade, visible next to the doors. The doors then cover only the sections left over, at full height. "wardrobe with a hanging section and a visible drawer column on the right" => same fields but drawerPos="vista", doors=1. The drawer column must be at one END of the unit, not between two door sections.
  auto (default) = interno when the unit has doors, vista otherwise. Emit it explicitly whenever he says where he wants them.
Heights: "drawerDist" decides. fix = every front "drawerFH" tall (default 200). uguali = the "drawerZone" mm are shared out equally. cucina = one shallow front on top and the rest equal — the kitchen base. With uguali/cucina always give "drawerZone" unless the drawers take the whole front.
System: "drawerSys" — legno (wooden box, the slide comes from the hardware catalog), legrabox, tandembox, nessuno (front only, the client supplies the boxes). Only name a Blum system if he named it. Ebanist's engine divides the inside into EQUAL sections; unequal widths are not supported yet, so if he asks for a specific section width, still emit the closest tram/secMode and add a line in "questions" saying the width ratio cannot be honoured.
"shelves" and "drawers" are counts PER SECTION, not totals.

CURVED BODIES AND DOORS. Three shapes leave the plain box, and each has ONE extra field:
  type="tondo" — a round or oval body. L and P are the OUTSIDE axes measured with a tape; equal L and P give a cylinder, different ones an oval. Shelves sit inside. No extra field.
  type="raccordato" — a rectangle with the two FRONT corners rounded; "rcorner" is the radius in mm (default 80). Give it only for this type.
  front="curvo" — bowed doors; "bow" is the camber in mm at the centre of the door (typical 30-60). Give it only for this front.
For all three the cut list still gets a straight rectangle at the DEVELOPED length, because the panel is cut flat and bent afterwards — do not shorten a dimension to "account for the curve", give the real outside sizes and let the engine compute the development and the kerf plan.

ANGLED CUTS (customCuts) — the only geometric modifier the engine has. "angL" and "angR" are the real corner angles of the room at the left and right end of the unit, 45..135, default 90. Under 90 the unit narrows towards the front (inside corner), over 90 it widens (outside corner). L is measured at the BACK wall. The engine applies them to the trapezoidal panels (Base / Cielo, Zoccolo) and renders the oblique cut in 3D. There is no per-panel modifier: do not try to angle a single Fianco or shelf — emit angL/angR and let the engine decide which panels are trapezoidal.

PRODUCTION vs SITE (bounding box): the factory only cuts at 90 degrees. Whatever angle you set, the cut list still exports the maximum bounding rectangle of each panel and the oblique line goes only to the assembly sheet as a guide. So never reduce a dimension "because of the angle" — give the real wall opening and let the engine do it.`);
  }else{
    P.push(`SECTION 3 — the site survey (survey)
The room is a closed outline of walls, walked in order. Each wall has: len (mm), angle (the real corner angle in degrees at the END of that wall, 90 for a square corner, 270 for an L-shaped room re-entrant), bow (out of plane, mm, optional). Walls are addressed by "n", 1-based, in the order they appear in the app. Emitting a wall with an n greater than the current count appends a new wall.

heights = three floor-to-ceiling measurements at three different points (the floor is never level). wallH = nominal wall height.

OBSTACLES (sockets, switches, pipes, radiators, openings, beams). Each is placed on ONE wall, with:
  wall = the 1-based wall number, fromCorner = mm from the START corner of that wall (his "de la stânga" / "da sinistra" when facing the wall), fromFloor = mm from the floor, w = width, h = height.
Default sizes when he does not say: presa/interr 80x80, tubo 60x60. If he gives only one dimension, use it for both and say so in "notes".
"The socket is at 1200 from the left and 300 from the floor" => {wall:1, type:"presa", fromCorner:1200, fromFloor:300, w:80, h:80}.
When a photo is attached, read what it shows (number and kind of sockets, pipes, radiator, window reveal) but take every NUMBER from what he says. Never estimate a dimension off a photo; if the photo shows something he did not measure, list it in "questions".

PLACEMENT (layout) — where a finished unit stands in the room. Ebanist places units against a wall: {name, wall (1-based), from = mm from the start corner of that wall along the wall, off = mm away from the wall face, lift = mm off the floor, rot = extra rotation in degrees}. "On wall 2, 500 from the corner" => {name:"<existing unit name>", wall:2, from:500}. Only use names that exist in the project; if he names a unit you do not see, ask in "questions".`);
  }
  P.push(`OUTPUT: call the tool "applica_patch" exactly once. No prose outside the tool call.`);
  return P.join("\n\n");
}

/* ---------- schema dello strumento (garantisce JSON valido) ---------- */
function aiSchema(mode){
  const num=(min,max)=>({type:"integer",minimum:min,maximum:max});
  const common={notes:{type:"string",description:"One short sentence, in the user's language."},
    questions:{type:"array",items:{type:"string"},description:"Anything ambiguous, missing or impossible. Empty if all clear."}};
  if(mode==="genera"){
    return {type:"object",properties:Object.assign({
      config:{type:"object",description:"ONLY the fields that must change.",properties:{
        name:{type:"string"},
        type:{type:"string",enum:AI_ENUM.type},
        L:num(100,6000), L2:num(300,6000), H:num(100,3500), P:num(100,1200),
        matBody:{type:"string",enum:aiMatIds()}, matFront:{type:"string",enum:aiMatIds()}, matBack:{type:"string",enum:aiMatIds()},
        plinth:num(0,400), tram:num(0,4), shelves:num(0,10), drawers:num(0,8), doors:num(0,4),
        back:num(0,1), hang:num(0,1), boxes:num(0,1), shelfEven:num(0,1), shelfStep:num(60,900), hangGap:num(0,3000),
        front:{type:"string",enum:AI_ENUM.front}, support:{type:"string",enum:AI_ENUM.support},
        handles:{type:"string",enum:AI_ENUM.handles}, shelfType:{type:"string",enum:AI_ENUM.shelfType},
        corner:{type:"string",enum:AI_ENUM.corner}, cornerKind:{type:"string",enum:AI_ENUM.cornerKind},
        drawerSys:{type:"string",enum:AI_ENUM.drawerSys,description:"Drawer system. legno = wooden box on the slide chosen in the catalog."},
        drawerDist:{type:"string",enum:AI_ENUM.drawerDist,description:"How the drawer front heights are shared out: fix = every front drawerFH tall, uguali = equal over drawerZone, cucina = one shallow front on top."},
        drawerFH:num(60,900), drawerZone:num(0,3000), drawerInset:num(0,200),
        drawerPos:{type:"string",enum:AI_ENUM.drawerPos,description:"Where the drawer fronts sit. vista = on the facade, visible. interno = behind the doors, set back. auto = behind the doors when a section is marked for drawers and the unit has doors, on the facade otherwise."},
        drawerH:{type:"string",enum:AI_DRAWH,description:"Metal system side height code (LEGRABOX N/M/K/C/F, TANDEMBOX N/M/K/C/D). Leave out to let the engine pick the tallest that the front covers."},
        angL:{type:"number",minimum:45,maximum:135,description:"Left corner angle, 90 = square."},
        angR:{type:"number",minimum:45,maximum:135,description:"Right corner angle, 90 = square."},
        bow:{type:"integer",minimum:0,maximum:200,description:"Curved door camber (mm), only with front=\"curvo\". The cut list gets the developed length, not the chord."},
        rcorner:{type:"integer",minimum:10,maximum:400,description:"Corner radius (mm), only with type=\"raccordato\"."},
        secMode:{type:"array",items:{type:"string",enum:AI_ENUM.secMode},maxItems:5,
          description:"Content of each section, left to right. Length must be tram+1."}}}},common)};
  }
  return {type:"object",properties:Object.assign({
    survey:{type:"object",properties:{
      wallH:num(1000,4000),
      heights:{type:"array",items:{type:["integer","null"]},maxItems:3},
      walls:{type:"array",maxItems:12,items:{type:"object",properties:{
        n:num(1,12), len:num(50,20000),
        angle:{type:"number",minimum:20,maximum:340}, bow:num(0,300)},required:["n"]}},
      obstacles:{type:"object",properties:{
        add:{type:"array",items:{type:"object",properties:{
          type:{type:"string",enum:AI_ENUM.obst}, wall:num(1,12),
          fromCorner:num(0,20000), fromFloor:num(0,4000), w:num(10,4000), h:num(10,4000)},required:["type","wall"]}},
        set:{type:"array",items:{type:"object",properties:{
          n:num(1,99), type:{type:"string",enum:AI_ENUM.obst}, wall:num(1,12),
          fromCorner:num(0,20000), fromFloor:num(0,4000), w:num(10,4000), h:num(10,4000)},required:["n"]}},
        remove:{type:"array",items:num(1,99)}}}}},
    layout:{type:"array",maxItems:20,items:{type:"object",properties:{
      name:{type:"string",description:"Name of an existing unit in this project."},
      wall:num(1,12), from:{type:"integer",minimum:-2000,maximum:20000},
      off:num(0,3000), lift:num(0,3000), rot:{type:"number",minimum:-180,maximum:180}},required:["name"]}}},common)};
}

/* ---------- contesto: cosa c'e' adesso nello state ---------- */
function aiContext(mode){
  if(mode==="genera"){
    const c=cfgFromForm(), keep={};
    ["name","type","L","L2","H","P","matBody","matFront","matBack","plinth","tram","shelves","drawers",
     "doors","back","hang","boxes","front","support","handles","shelfType","corner","cornerKind",
     "angL","angR","hangGap","shelfEven","shelfStep","secMode",
     "drawerSys","drawerDist","drawerFH","drawerZone","drawerH","drawerInset","drawerPos"].forEach(k=>{ if(c[k]!=null) keep[k]=c[k]; });
    return JSON.stringify(keep);
  }
  const sv=survey()||{walls:[],heights:[],obstacles:[]}, p=proj();
  const out={wallH:sv.wallH||null, heights:sv.heights||[],
    walls:(sv.walls||[]).map((w,i)=>({n:i+1,len:w.len,angle:w.angle,bow:w.bow})),
    obstacles:(sv.obstacles||[]).map((o,i)=>({n:i+1,type:o.type,
      wall:(sv.walls||[]).findIndex(w=>w.id===o.wall)+1||null,
      fromCorner:o.fromCorner,fromFloor:o.fromFloor,w:o.w,h:o.h})),
    units:p&&p.configs?Object.keys(p.configs):[],
    layout:p&&p.layout?Object.keys(p.layout).map(n=>({name:n,
      wall:(sv.walls||[]).findIndex(w=>w.id===p.layout[n].wall)+1||null,
      from:p.layout[n].from,off:p.layout[n].off,lift:p.layout[n].lift,rot:p.layout[n].rot})):[]};
  return JSON.stringify(out);
}

/* ---------- chiamata ---------- */
async function aiCall(mode,text,imgs){
  const blocks=[];
  (imgs||[]).forEach(im=>blocks.push({type:"image",source:{type:"base64",media_type:im.mime,data:im.b64}}));
  blocks.push({type:"text",text:`${mode==="genera"?"CURRENT UNIT":"CURRENT SURVEY"} (JSON):\n${aiContext(mode)}\n\nUSER (lang=${state.lang}):\n${text||"(only the photo)"}`});
  const body={model:aiModel(),max_tokens:2000,system:aiSystem(mode),
    tools:[{name:"applica_patch",description:"Apply a partial patch to the Ebanist state.",input_schema:aiSchema(mode)}],
    tool_choice:{type:"tool",name:"applica_patch"},
    messages:[{role:"user",content:blocks}]};
  const proxy=aiProxy(), headers={"content-type":"application/json"};
  if(!proxy){
    if(!aiKey()) throw new Error(tia("aiNoKey"));
    headers["x-api-key"]=aiKey();
    headers["anthropic-version"]="2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"]="true";
  }
  const r=await fetch(proxy||AI_ENDPOINT,{method:"POST",headers,body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);
  if(!r.ok) throw new Error((j&&j.error&&j.error.message)||("HTTP "+r.status));
  const tc=(j&&j.content||[]).find(b=>b.type==="tool_use");
  if(!tc) throw new Error("no tool_use");
  return tc.input||{};
}

/* ---------- validazione + clamp: niente entra nello state senza passare di qui ---------- */
const AI_CFG_INT={L:[100,6000],L2:[300,6000],H:[100,3500],P:[100,1200],plinth:[0,400],tram:[0,4],
  shelves:[0,10],drawers:[0,8],doors:[0,4],back:[0,1],hang:[0,1],boxes:[0,1],shelfEven:[0,1],
  shelfStep:[60,900],hangGap:[0,3000],drawerFH:[60,900],drawerZone:[0,3000],drawerInset:[0,200],
  bow:[0,200],rcorner:[10,400]};
function aiInt(v,lo,hi){ const n=Math.round(parseFloat(v)); return isFinite(n)?Math.max(lo,Math.min(hi,n)):null; }
function aiNormCfg(raw,warn){
  const out={};
  if(!raw||typeof raw!=="object") return out;
  for(const k in AI_CFG_INT){ if(raw[k]==null) continue;
    const v=aiInt(raw[k],AI_CFG_INT[k][0],AI_CFG_INT[k][1]); if(v!=null) out[k]=v; }
  for(const k of ["type","front","support","handles","shelfType","corner","cornerKind","drawerSys","drawerDist","drawerPos"]){
    if(raw[k]==null) continue;
    if(AI_ENUM[k].indexOf(raw[k])>=0) out[k]=raw[k]; else warn.push(`${k}: "${raw[k]}" ?`); }
  if(raw.drawerH!=null){
    if(AI_DRAWH.indexOf(raw.drawerH)>=0) out.drawerH=raw.drawerH; else warn.push(`drawerH: "${raw.drawerH}" ?`); }
  for(const k of ["matBody","matFront","matBack"]){
    if(raw[k]==null) continue;
    if(matById(raw[k])) out[k]=raw[k]; else warn.push(`${k}: "${raw[k]}" ?`); }
  if(typeof raw.name==="string"&&raw.name.trim()) out.name=raw.name.trim().slice(0,60);
  for(const k of ["angL","angR"]){ if(raw[k]==null) continue;
    const n=parseFloat(raw[k]); if(isFinite(n)) out[k]=angClamp(n); }
  if(Array.isArray(raw.secMode)){
    const arr=raw.secMode.filter(x=>AI_ENUM.secMode.indexOf(x)>=0);
    const n=(out.tram!=null?out.tram:(buildCfg.tram||0))+1;
    if(arr.length){ while(arr.length<n) arr.push(arr[arr.length-1]); out.secMode=arr.slice(0,n); }
  }
  return out;
}
function aiNormSurvey(raw,warn){
  const sv=survey(); if(!sv||!raw||typeof raw!=="object") return null;
  const out={walls:[],obst:{add:[],set:[],remove:[]}};
  if(raw.wallH!=null){ const v=aiInt(raw.wallH,1000,4000); if(v!=null) out.wallH=v; }
  if(Array.isArray(raw.heights)){
    out.heights=raw.heights.slice(0,3).map(v=>v==null?null:aiInt(v,500,5000)); }
  (raw.walls||[]).forEach(w=>{
    const n=aiInt(w.n,1,12); if(n==null) return;
    const o={n};
    if(w.len!=null) o.len=aiInt(w.len,50,20000);
    if(w.angle!=null){ const a=parseFloat(w.angle); if(isFinite(a)) o.angle=Math.max(20,Math.min(340,a)); }
    if(w.bow!=null) o.bow=aiInt(w.bow,0,300);
    out.walls.push(o);
  });
  const ob=raw.obstacles||{};
  /* i muri creati da QUESTA patch contano gia': l'ostacolo detto nella stessa frase
     sta sul muro appena dettato. Il numero si risolve in id solo al momento di applicare. */
  out.nWalls=Math.max(sv.walls.length,...out.walls.map(w=>w.n),0);
  const wallN=n=>{ const v=aiInt(n,1,12); return (v!=null&&v<=out.nWalls)?v:null; };
  const dflt=t=>(t==="presa"||t==="interr")?80:(t==="tubo"?60:100);
  (ob.add||[]).forEach(o=>{
    if(AI_ENUM.obst.indexOf(o.type)<0){ warn.push(`obstacle: "${o.type}" ?`); return; }
    const n=wallN(o.wall); if(!n){ warn.push(`obstacle ${o.type}: ${ts("svWall")} ${o.wall} ?`); return; }
    out.obst.add.push({id:uid(),type:o.type,wallN:n,
      fromCorner:aiInt(o.fromCorner,0,20000),fromFloor:aiInt(o.fromFloor,0,4000),
      w:aiInt(o.w,10,4000)!=null?aiInt(o.w,10,4000):dflt(o.type),
      h:aiInt(o.h,10,4000)!=null?aiInt(o.h,10,4000):dflt(o.type)});
  });
  (ob.set||[]).forEach(o=>{
    const cur=sv.obstacles[(aiInt(o.n,1,99)||0)-1]; if(!cur) return;
    const patch={id:cur.id};
    if(o.type&&AI_ENUM.obst.indexOf(o.type)>=0) patch.type=o.type;
    if(o.wall!=null){ const n=wallN(o.wall); if(n) patch.wallN=n; }
    ["fromCorner","fromFloor","w","h"].forEach(k=>{ if(o[k]!=null) patch[k]=aiInt(o[k],0,20000); });
    out.obst.set.push(patch);
  });
  (ob.remove||[]).forEach(n=>{ const cur=sv.obstacles[(aiInt(n,1,99)||0)-1]; if(cur) out.obst.remove.push(cur.id); });
  return out;
}
function aiNormLayout(raw,warn,nWalls){
  const p=proj(), sv=survey(); if(!p||!sv||!Array.isArray(raw)) return [];
  const max=Math.max(sv.walls.length,nWalls||0);
  const out=[];
  raw.forEach(o=>{
    const nm=String(o.name||"").trim();
    if(!p.configs||!p.configs[nm]){ warn.push(`layout: "${nm}" ?`); return; }
    const patch={name:nm};
    if(o.wall!=null){ const n=aiInt(o.wall,1,12);
      if(!n||n>max){ warn.push(`layout ${nm}: ${ts("svWall")} ${o.wall} ?`); return; } patch.wallN=n; }
    if(o.from!=null) patch.from=aiInt(o.from,-2000,20000);
    if(o.off!=null) patch.off=aiInt(o.off,0,3000);
    if(o.lift!=null) patch.lift=aiInt(o.lift,0,3000);
    if(o.rot!=null){ const r=parseFloat(o.rot); if(isFinite(r)) patch.rot=Math.max(-180,Math.min(180,r)); }
    out.push(patch);
  });
  return out;
}

/* ---------- diff leggibile: si vede cosa cambia PRIMA di applicare ---------- */
function aiLbl(k){
  const map={L:t("fWidth"),L2:t("fL2"),H:t("fHeight"),P:t("fDepth"),plinth:t("fPlinth"),tram:t("fTram"),
    shelves:t("fShelvesSec"),drawers:t("fDrawersSec"),doors:t("fDoorsN"),back:t("fBack"),hang:t("fHang"),
    front:t("fFront"),support:t("fSupport"),handles:t("fHandles"),shelfType:t("fShelfT"),type:t("fType"),
    matBody:t("matBody"),matFront:t("matFront"),matBack:t("matBack"),angL:t("fAngL"),angR:t("fAngR"),
    hangGap:t("fHangGap"),shelfEven:t("fShelfEven"),shelfStep:t("fShelfStep"),secMode:t("fSections"),
    boxes:t("fBoxes"),corner:t("fCorner"),cornerKind:t("fCornerKind"),name:t("fModule"),
    bow:t("fBow"),rcorner:t("fRcorner")};
  return map[k]||k;
}
function aiVal(k,v){
  if(v==null||v==="") return "—";
  if(/^mat/.test(k)){ const m=matById(v); return m?m.label:v; }
  if(k==="secMode") return (v||[]).map(x=>t("sec_"+x)).join(" · ");
  if(["back","hang","boxes","shelfEven"].indexOf(k)>=0) return v?t("optYes"):t("optNo");
  if(["type","front","support","handles","shelfType","corner","cornerKind"].indexOf(k)>=0){
    const m={standard:"typeStandard",angolare:"typeCorner",scorrevole:"typeSliding",scrivania:"typeDesk",
      tavolo:"typeTable",letto:"typeBed",piena:"frontFull",vetro:"frontGlass",zoccolo:"supPlinth",
      piedini:"supFeet",sospeso:"supWall",maniglia:"hManiglia",push:"hPush",mobile:"shMobile",
      fisso:"shFisso",sx:"cornSx",dx:"cornDx",int:"cornInt",ext:"cornExt",
      tondo:"typeRound",raccordato:"typeFillet",curvo:"frontCurved"};
    return m[v]?t(m[v]):v;
  }
  return String(v);
}
function aiRow(label,from,to){ return `<div class="aidiff"><b>${esc(label)}</b><span>${esc(from)} → <b style="color:var(--red);min-width:0">${esc(to)}</b></span></div>`; }

/* ---------- stato del modulo ---------- */
let aiPatch=null, aiMode="genera", aiImgs=[], aiRec=null, aiBusy=false;

function aiVeil(on){
  const sfx=aiMode==="genera"?"Build":"Survey";
  const el=$("aiVeil"+sfx), tx=$("aiVeilTxt"+sfx);
  if(tx) tx.textContent=tia("aiThinking");
  if(el) el.classList.toggle("on",!!on);
}
function aiBarHTML(mode){
  const mic=`<svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v4M8 22h8"/></svg>`;
  const cam=`<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  return `<div class="aibar">
    <textarea id="aiTxt${mode}" rows="2" placeholder="${esc(tia(mode==="genera"?"aiPh":"aiPhSv"))}"></textarea>
    <div class="airow">
      <button class="aibtn" id="aiMic${mode}" title="${esc(tia("aiMic"))}" aria-label="${esc(tia("aiMic"))}">${mic}</button>
      <button class="aibtn" id="aiCam${mode}" title="${esc(tia("aiCam"))}" aria-label="${esc(tia("aiCam"))}">${cam}</button>
      <input type="file" id="aiFile${mode}" accept="image/*" capture="environment" multiple style="display:none">
      <button class="aisend" id="aiGo${mode}">${esc(tia("aiSend"))}</button>
    </div>
    <div class="airow" id="aiThumbs${mode}" style="display:none"></div>
  </div>`;
}

/* le immagini vanno rimpicciolite: una foto da telefono e' 4 MB e il lato lungo
   utile per il modello e' 1568 px. */
function aiShrink(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error("read"));
    fr.onload=()=>{
      const img=new Image();
      img.onerror=()=>rej(new Error("img"));
      img.onload=()=>{
        const s=Math.min(1,1568/Math.max(img.width,img.height));
        const cv=document.createElement("canvas");
        cv.width=Math.round(img.width*s); cv.height=Math.round(img.height*s);
        cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
        const url=cv.toDataURL("image/jpeg",0.82);
        res({mime:"image/jpeg",b64:url.split(",")[1],url});
      };
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function aiRenderThumbs(mode){
  const box=$("aiThumbs"+mode); if(!box) return;
  box.style.display=aiImgs.length?"flex":"none";
  box.innerHTML=aiImgs.map((im,i)=>`<img class="aithumb" src="${im.url}" data-rm="${i}" alt="">`).join("")+
    (aiImgs.length?`<span class="mini" style="align-self:center">${aiImgs.length}</span>`:"");
  box.querySelectorAll("[data-rm]").forEach(el=>el.addEventListener("click",()=>{
    aiImgs.splice(+el.dataset.rm,1); aiRenderThumbs(mode);
  }));
}

/* ---------- dettatura ---------- */
function aiToggleMic(mode){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const btn=$("aiMic"+mode), ta=$("aiTxt"+mode);
  if(!SR){ toast(tia("aiNoSpeech")); ta.focus(); return; }
  if(aiRec){ try{aiRec.stop();}catch(e){} aiRec=null; btn.classList.remove("rec"); return; }
  const rec=new SR();
  rec.lang=AI_SPEECH_LANG[state.lang]||"it-IT";
  rec.continuous=true; rec.interimResults=true; rec.maxAlternatives=1;
  const base=ta.value?ta.value.replace(/\s+$/,"")+" ":"";
  /* Android non manda un solo risultato provvisorio che si aggiorna: ne accoda
     uno per ogni parola, ognuno con la frase intera fino a quel punto —
     "un", "un metro", "un metro e ottanta". Concatenarli scriveva la frase
     dieci volte. Il provvisorio buono e' SEMPRE l'ultimo, non la somma.
     Le frasi finali arrivano invece in coda e restano nella lista a ogni
     evento: si tiene l'indice di quelle gia' prese, si scarta la ripetizione
     e, se la nuova estende la precedente, la sostituisce. */
  let done="", taken=0, lastFin="";
  rec.onresult=e=>{
    let interim="";
    for(let i=taken;i<e.results.length;i++){
      const r=e.results[i], alt=r[0];
      if(!alt) continue;
      if(!r.isFinal){ interim=alt.transcript; continue; }   /* ultimo, non somma */
      taken=i+1; interim="";   /* i provvisori prima di una finale sono la stessa frase */
      const txt=alt.transcript.trim();
      if(!txt||txt===lastFin) continue;
      if(done.slice(-txt.length)===txt) continue;           /* gia' in coda */
      if(lastFin&&txt.indexOf(lastFin)===0) done=done.slice(0,done.length-lastFin.length)+txt;
      else done+=(done?" ":"")+txt;
      lastFin=txt;
    }
    interim=interim.trim();
    ta.value=base+done+(interim?(done?" ":"")+interim:"");
  };
  rec.onerror=()=>{ btn.classList.remove("rec"); aiRec=null; };
  rec.onend=()=>{ btn.classList.remove("rec"); aiRec=null; };
  try{ rec.start(); aiRec=rec; btn.classList.add("rec"); }
  catch(e){ toast(tia("aiNoSpeech")); }
}

/* ---------- invio ---------- */
async function aiRun(mode){
  if(aiBusy) return;
  const ta=$("aiTxt"+mode), txt=(ta.value||"").trim();
  if(!txt&&!aiImgs.length){ toast(tia("aiImgOnly")); ta.focus(); return; }
  if(!aiProxy()&&!aiKey()){ toast(tia("aiNoKey")); return; }
  if(mode==="rilievo"&&!proj()){ toast(ts("svNoProject")); return; }
  aiMode=mode; aiBusy=true; aiVeil(true);
  const go=$("aiGo"+mode); go.disabled=true; const old=go.textContent; go.textContent=tia("aiThinking");
  try{
    const raw=await aiCall(mode,txt,aiImgs);
    const warn=[];
    aiPatch={mode,notes:String(raw.notes||""),questions:(raw.questions||[]).map(String),warn,
      cfg:mode==="genera"?aiNormCfg(raw.config,warn):null,
      sv:null,lay:[]};
    if(mode==="rilievo"){
      aiPatch.sv=aiNormSurvey(raw.survey,warn);
      aiPatch.lay=aiNormLayout(raw.layout,warn,aiPatch.sv&&aiPatch.sv.nWalls);
    }
    aiShowSheet();
  }catch(e){
    toast(tia("aiErr").replace("{e}",e&&e.message?e.message:"?"));
  }finally{
    aiBusy=false; aiVeil(false); go.disabled=false; go.textContent=old;
  }
}

/* ---------- foglio di conferma ---------- */
function aiShowSheet(){
  const P=aiPatch; if(!P) return;
  const rows=[]; const notes=[];
  if(P.mode==="genera"&&P.cfg){
    const cur=cfgFromForm();
    Object.keys(P.cfg).forEach(k=>{
      const a=aiVal(k,cur[k]), b=aiVal(k,P.cfg[k]);
      if(a!==b) rows.push(aiRow(aiLbl(k),a,b));
    });
    if(P.cfg.tram!=null||P.cfg.secMode) notes.push(tia("aiSecNote"));
    if(isAng(P.cfg.angL)||isAng(P.cfg.angR)) notes.push(tia("aiBoundNote"));
  }
  if(P.mode==="rilievo"){
    const sv=survey()||{walls:[],obstacles:[]};
    if(P.sv){
      if(P.sv.wallH!=null&&P.sv.wallH!==sv.wallH) rows.push(aiRow(ts("svWallH"),sv.wallH||"—",P.sv.wallH));
      if(P.sv.heights) P.sv.heights.forEach((v,i)=>{
        if(v!=null&&v!==(sv.heights||[])[i]) rows.push(aiRow(ts("svPoint")+" "+(i+1),(sv.heights||[])[i]||"—",v)); });
      P.sv.walls.forEach(w=>{
        const cur=sv.walls[w.n-1]||{};
        const lbl=ts("svWall")+" "+w.n+(sv.walls[w.n-1]?"":" +");
        if(w.len!=null&&w.len!==cur.len) rows.push(aiRow(lbl+" · "+ts("svLen"),cur.len||"—",w.len));
        if(w.angle!=null&&w.angle!==cur.angle) rows.push(aiRow(lbl+" · "+ts("svAngle"),cur.angle||"—",w.angle));
        if(w.bow!=null&&w.bow!==cur.bow) rows.push(aiRow(lbl+" · "+ts("svBow"),cur.bow||"—",w.bow));
      });
      P.sv.obst.add.forEach(o=>{
        rows.push(aiRow("+ "+obstLabel(o.type),ts("svWall")+" "+o.wallN,
          `${o.fromCorner!=null?o.fromCorner:"?"} / ${o.fromFloor!=null?o.fromFloor:"?"} · ${o.w}×${o.h}`));
      });
      P.sv.obst.set.forEach(o=>{
        const i=sv.obstacles.findIndex(x=>x.id===o.id);
        rows.push(aiRow(obstLabel((sv.obstacles[i]||{}).type||"altro")+" "+(i+1),"…",
          Object.keys(o).filter(k=>k!=="id").map(k=>k==="wallN"?ts("svWall")+" "+o[k]:k+"="+o[k]).join(" ")||"—"));
      });
      P.sv.obst.remove.forEach(id=>{
        const i=sv.obstacles.findIndex(x=>x.id===id);
        rows.push(aiRow("− "+obstLabel((sv.obstacles[i]||{}).type||"altro"),String(i+1),"—"));
      });
    }
    P.lay.forEach(l=>{
      const bits=[]; if(l.wallN) bits.push(ts("svWall")+" "+l.wallN);
      ["from","off","lift","rot"].forEach(k=>{ if(l[k]!=null) bits.push(k+"="+l[k]); });
      rows.push(aiRow(l.name,"…",bits.join(" · ")||"—"));
    });
  }
  P.rows=rows.length;
  $("aiSheetTitle").textContent=tia("aiTitle");
  $("aiSheetNote").textContent=P.notes||"";
  $("aiSheetDiff").innerHTML=rows.length?rows.join(""):`<p class="mini">${esc(tia("aiNoChange"))}</p>`;
  const w=[];
  if(notes.length) w.push(notes.map(n=>`<p class="mini" style="margin-top:6px">${esc(n)}</p>`).join(""));
  if(P.warn.length) w.push(`<p class="aiwarn"><b>${esc(tia("aiWarnHdr"))}:</b> ${esc(P.warn.join(" · "))}</p>`);
  if(P.questions.length) w.push(`<p class="aiwarn"><b>${esc(tia("aiAsk"))}:</b> ${esc(P.questions.join(" "))}</p>`);
  $("aiSheetWarn").innerHTML=w.join("");
  $("btnAiApply").querySelector("span").textContent=tia("aiApply");
  $("btnAiCancel").querySelector("span").textContent=tia("aiCancel");
  $("btnAiApply").style.display=rows.length?"":"none";
  openSheet("shAI");
}

function aiApply(){
  const P=aiPatch; if(!P) return;
  snapUndo();
  if(P.mode==="genera"&&P.cfg){
    /* aggiornamento parziale: solo le chiavi arrivate, il resto resta com'e' */
    buildCfg=Object.assign({},cfgFromForm(),P.cfg);
    if(P.cfg.matBody){ const m=matById(P.cfg.matBody); if(m) buildCfg.t=m.th; }
    if(P.cfg.tram!=null&&buildCfg.secMode&&buildCfg.secMode.length!==P.cfg.tram+1) buildCfg.secMode=null;
    buildSecMode=buildCfg.secMode||null;
    buildObst=buildCfg.obstacles||[];
    syncBuildForm(); renderSecChips(); drawPreview();
    setView("build");
  }
  if(P.mode==="rilievo"){
    const sv=survey();
    if(sv&&P.sv){
      if(P.sv.wallH!=null) sv.wallH=P.sv.wallH;
      if(P.sv.heights){ sv.heights=sv.heights||[null,null,null];
        P.sv.heights.forEach((v,i)=>{ if(v!=null) sv.heights[i]=v; }); }
      P.sv.walls.forEach(w=>{
        while(sv.walls.length<w.n) sv.walls.push({id:uid(),len:null,angle:90,bow:null});
        const cur=sv.walls[w.n-1];
        ["len","angle","bow"].forEach(k=>{ if(w[k]!=null) cur[k]=w[k]; });
      });
      /* i muri esistono adesso: il numero diventa id */
      const wid=n=>{ const w=sv.walls[(n||0)-1]; return w?w.id:null; };
      sv.obstacles=sv.obstacles||[];
      P.sv.obst.remove.forEach(id=>{ sv.obstacles=sv.obstacles.filter(o=>o.id!==id); });
      P.sv.obst.set.forEach(o=>{ const cur=sv.obstacles.find(x=>x.id===o.id); if(!cur) return;
        const q=Object.assign({},o); delete q.wallN;
        if(o.wallN!=null){ const id=wid(o.wallN); if(id) q.wall=id; }
        Object.assign(cur,q); });
      P.sv.obst.add.forEach(o=>{ const q=Object.assign({},o); delete q.wallN;
        q.wall=wid(o.wallN); if(q.wall) sv.obstacles.push(q); });
    }
    if(P.lay.length){
      const L=layout();
      if(L) P.lay.forEach(l=>{
        const q={};
        if(l.wallN!=null){ const w=sv.walls[l.wallN-1]; if(w) q.wall=w.id; }
        ["from","off","lift","rot"].forEach(k=>{ if(l[k]!=null) q[k]=l[k]; });
        L[l.name]=Object.assign({wall:null,from:0},L[l.name]||{},q);
      });
    }
    setView("survey"); renderSurvey();
  }
  persist(); closeSheets(); aiPatch=null;
  aiImgs=[]; aiRenderThumbs("genera"); aiRenderThumbs("rilievo");
  undoToast(tia("aiApplied"));
}

/* ---------- montaggio ---------- */
let aiMounted=false;
function aiMount(){
  const mounts=[["aiBarBuild","genera"],["aiBarSurvey","rilievo"]];
  mounts.forEach(([id,mode])=>{
    const host=$(id); if(!host) return;
    host.innerHTML=aiBarHTML(mode);
    $("aiGo"+mode).addEventListener("click",()=>aiRun(mode));
    $("aiMic"+mode).addEventListener("click",()=>{ aiMode=mode; aiToggleMic(mode); });
    $("aiCam"+mode).addEventListener("click",()=>$("aiFile"+mode).click());
    $("aiFile"+mode).addEventListener("change",async e=>{
      aiMode=mode;
      for(const f of Array.from(e.target.files||[]).slice(0,4)){
        try{ aiImgs.push(await aiShrink(f)); }catch(err){ toast(t("importErr")); }
      }
      aiRenderThumbs(mode); e.target.value="";
    });
    $("aiTxt"+mode).addEventListener("focus",()=>{ aiMode=mode; });
  });
  aiRenderThumbs("genera"); aiRenderThumbs("rilievo");
  if(aiMounted) return;              // al cambio lingua si rifanno solo le barre
  aiMounted=true;
  $("btnAiApply").addEventListener("click",aiApply);
  $("btnAiCancel").addEventListener("click",()=>{ closeSheets(); aiPatch=null; });
}

