/* =====================================================================
   Ebanist — Modul Atelier, etapa E0 (D-92, ebanist-hq/07-atelier/SPEC-ATELIER-v1.md)

   Partea PURĂ a modulului: roluri, capacități, postazioni, ajutoare pentru
   slug și codul de invitație, textele în 7 limbi. Ecranul și apelurile
   Supabase stau în index.html; aici nu există rețea, ca să se poată testa
   în Node (test/atelier.test.js).

   E0 e ASCUNS: apare numai cu ?atelier=1 (rămâne ținut în localStorage
   `ebAtelier`) și numai după login. Nu face parte din Pro (D-55) până nu se
   decide prețul și regula Google Play pentru un plan B2B (D-54).
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBAtelier = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* aceleași valori ca în enumul `atelier_role` din migrarea 1.5 */
  var ROLES = ["responsabil", "birou", "operator", "partener"];
  /* cele 7 postazioni din prezentare; E1 le folosește pentru stări */
  var STATIONS = ["magazzino", "sezionatrice", "bordatrice", "cnc", "verniciatura", "assemblaggio", "spedizione"];

  /* ce poate face fiecare rol în E0. Serverul decide oricum (RLS + funcții);
     asta doar ascunde butoanele care ar eșua. */
  var CAPS = {
    "members.list": ["responsabil", "birou"],
    "members.manage": ["responsabil"],
    "invite.create": ["responsabil"],
    /* E1 (migrarea 1.6): comenzi */
    "job.create": ["responsabil", "birou"],
    "job.state": ["responsabil", "birou"],
    "job.progress": ["responsabil", "birou"],
    "job.event": ["responsabil", "birou", "operator"]
  };
  function can(role, cap) { return (CAPS[cap] || []).indexOf(role) >= 0; }

  var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;
  function isSlug(s) { return typeof s === "string" && SLUG_RE.test(s); }
  /* „Tâmplăria Test” → „tamplaria-test”: fără diacritice, litere mici, liniuțe */
  function slugify(name) {
    var s = String(name == null ? "" : name).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (s.length > 40) s = s.slice(0, 40).replace(/-+$/g, "");
    return s;
  }

  /* codul de invitație: 16 cifre hex, afișat 4-4-4-4; se acceptă orice grupare și litere mici */
  function normCode(s) {
    var c = String(s == null ? "" : s).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return /^[0-9A-F]{16}$/.test(c) ? c : null;
  }
  function fmtCode(c) { return String(c).replace(/(.{4})(?=.)/g, "$1-"); }

  /* stările comenzii și tipurile de eveniment: aceleași valori ca enumurile din migrarea 1.6 */
  var JOB_STATES = ["draft", "confirmed", "in_progress", "done", "shipped", "installed", "cancelled"];
  var JOB_EVENTS = ["start", "done", "issue"];

  /* Instantaneul comenzii: piesele proiectului, ÎNGHEȚATE. Numai câmpurile din lista albă a
     serverului (`job_snapshot_ok`): niciun preț, niciun client, niciun telefon. Cheia `pk` e
     stabilă la același proiect (r1, r2… în ordinea distinctei). `h` aduce ce nu știe modulul
     pur: etichetă de material și nota de decupaj. Întoarce null dacă nu e nimic de înghețat. */
  function buildSnapshot(p, h) {
    h = h || {};
    var rows = (p && p.pieces) || [];
    if (!rows.length || rows.length > 2000) return null;
    function s(v, n) { v = v == null ? "" : String(v); return v.slice(0, n || 200); }
    var pieces = rows.map(function (x, i) {
      var o = { pk: "r" + (i + 1) };
      if (x.modulo) o.modulo = s(x.modulo);
      if (x.elemento) o.elemento = s(x.elemento);
      if (x.lung != null && isFinite(x.lung)) o.lung = +x.lung;
      if (x.larg != null && isFinite(x.larg)) o.larg = +x.larg;
      o.pz = x.pz > 0 ? Math.round(x.pz) : 1;
      var m = h.material ? h.material(x) : x.materiale; if (m) o.material = s(m);
      if (x.bordo) o.bordo = s(x.bordo, 40);
      var n = h.note ? h.note(x) : ""; if (n) o.note = s(n, 200);
      return o;
    });
    var meta = { units: "mm" };
    if (h.appVer) meta.app_ver = s(h.appVer, 20);
    if (p.name) meta.project_name = s(p.name, 120);
    return { pieces: pieces, meta: meta };
  }

  /* erorile serverului au forma `atelier:<cod>` sau `job:<cod>`; întoarce cheia de text */
  function errKey(err) {
    var m = err && /(?:atelier|job):([a-z_]+)/.exec(String(err.message || err));
    var k = m ? "err_" + m[1] : "err_generic";
    return I18N.it[k] ? k : "err_generic";
  }

  /* — texte, 7 limbi, aceleași chei peste tot (verificat în test/atelier.test.js) — */
  var I18N = {
    it: {
      atTitle: "Atelier", atBeta: "Funzione in prova. Non fa parte di Pro.",
      atNeedLogin: "Accedi con il tuo account per usare l'Atelier.", atOpenAccount: "Apri account",
      atNoNet: "Serve la connessione.", atMine: "I tuoi atelier", atNone: "Non fai ancora parte di nessun atelier.",
      atOpen: "Apri", atBack: "Indietro", atLoading: "Carico…",
      atCreateTitle: "Crea un atelier", atName: "Nome dell'atelier", atSlug: "Indirizzo (minuscole, cifre, trattino)",
      atCreate: "Crea atelier", atJoinTitle: "Ho un codice d'invito", atCode: "Codice", atJoin: "Entra",
      atRole: "Ruolo", role_responsabil: "Responsabile", role_birou: "Ufficio tecnico", role_operator: "Operatore", role_partener: "Partner",
      atMembers: "Membri", atYou: "tu", atRemove: "Rimuovi", atLeave: "Esci dall'atelier",
      atConfirmRemove: "Rimuovere questo membro?", atConfirmLeave: "Uscire da questo atelier?",
      atInviteTitle: "Invita", atInviteBtn: "Crea invito", atInviteHint: "Il codice vale 7 giorni e si usa una sola volta.",
      atStations: "Postazioni", atPending: "Inviti in sospeso", atNoPending: "Nessun invito in sospeso.",
      atCopy: "Copia", atCopied: "Codice copiato", atDone: "Fatto",
      st_magazzino: "Magazzino", st_sezionatrice: "Sezionatrice", st_bordatrice: "Bordatrice", st_cnc: "CNC",
      st_verniciatura: "Verniciatura", st_assemblaggio: "Assemblaggio", st_spedizione: "Spedizione",
      err_not_authenticated: "Devi accedere.", err_slug_invalid: "Indirizzo non valido: usa minuscole, cifre e trattini.",
      err_name_invalid: "Nome troppo corto.", err_slug_taken: "Questo indirizzo è già preso.",
      err_code_invalid: "Codice non valido, scaduto o già usato.", err_already_member: "Fai già parte di questo atelier.",
      err_not_allowed: "Non hai il permesso per farlo.", err_last_owner: "Deve restare almeno un responsabile.",
      err_not_found: "Non trovato.", err_generic: "Non è andata. Riprova."
    },
    ro: {
      atTitle: "Atelier", atBeta: "Funcție în probă. Nu face parte din Pro.",
      atNeedLogin: "Conectează-te cu contul tău ca să folosești Atelierul.", atOpenAccount: "Deschide contul",
      atNoNet: "Trebuie conexiune.", atMine: "Atelierele tale", atNone: "Nu faci încă parte din niciun atelier.",
      atOpen: "Deschide", atBack: "Înapoi", atLoading: "Se încarcă…",
      atCreateTitle: "Creează un atelier", atName: "Numele atelierului", atSlug: "Adresă (litere mici, cifre, liniuță)",
      atCreate: "Creează atelier", atJoinTitle: "Am un cod de invitație", atCode: "Cod", atJoin: "Intră",
      atRole: "Rol", role_responsabil: "Responsabil", role_birou: "Birou tehnic", role_operator: "Operator", role_partener: "Partener",
      atMembers: "Membri", atYou: "tu", atRemove: "Scoate", atLeave: "Ieși din atelier",
      atConfirmRemove: "Scoți acest membru?", atConfirmLeave: "Ieși din acest atelier?",
      atInviteTitle: "Invită", atInviteBtn: "Creează invitație", atInviteHint: "Codul e valabil 7 zile și se folosește o singură dată.",
      atStations: "Posturi de lucru", atPending: "Invitații în așteptare", atNoPending: "Nicio invitație în așteptare.",
      atCopy: "Copiază", atCopied: "Cod copiat", atDone: "Gata",
      st_magazzino: "Magazie", st_sezionatrice: "Sezionatrice", st_bordatrice: "Bordatrice", st_cnc: "CNC",
      st_verniciatura: "Vopsitorie", st_assemblaggio: "Asamblare", st_spedizione: "Expediție",
      err_not_authenticated: "Trebuie să te conectezi.", err_slug_invalid: "Adresă nevalidă: folosește litere mici, cifre și liniuțe.",
      err_name_invalid: "Nume prea scurt.", err_slug_taken: "Adresa aceasta e deja luată.",
      err_code_invalid: "Cod nevalid, expirat sau deja folosit.", err_already_member: "Faci deja parte din acest atelier.",
      err_not_allowed: "Nu ai permisiunea să faci asta.", err_last_owner: "Trebuie să rămână cel puțin un responsabil.",
      err_not_found: "Nu s-a găsit.", err_generic: "Nu a mers. Încearcă din nou."
    },
    en: {
      atTitle: "Workshop", atBeta: "Trial feature. Not part of Pro.",
      atNeedLogin: "Sign in with your account to use the Workshop.", atOpenAccount: "Open account",
      atNoNet: "A connection is required.", atMine: "Your workshops", atNone: "You are not in any workshop yet.",
      atOpen: "Open", atBack: "Back", atLoading: "Loading…",
      atCreateTitle: "Create a workshop", atName: "Workshop name", atSlug: "Address (lowercase, digits, hyphen)",
      atCreate: "Create workshop", atJoinTitle: "I have an invite code", atCode: "Code", atJoin: "Join",
      atRole: "Role", role_responsabil: "Manager", role_birou: "Technical office", role_operator: "Operator", role_partener: "Partner",
      atMembers: "Members", atYou: "you", atRemove: "Remove", atLeave: "Leave workshop",
      atConfirmRemove: "Remove this member?", atConfirmLeave: "Leave this workshop?",
      atInviteTitle: "Invite", atInviteBtn: "Create invite", atInviteHint: "The code is valid for 7 days and works once.",
      atStations: "Stations", atPending: "Pending invites", atNoPending: "No pending invites.",
      atCopy: "Copy", atCopied: "Code copied", atDone: "Done",
      st_magazzino: "Warehouse", st_sezionatrice: "Panel saw", st_bordatrice: "Edge bander", st_cnc: "CNC",
      st_verniciatura: "Paint shop", st_assemblaggio: "Assembly", st_spedizione: "Shipping",
      err_not_authenticated: "You need to sign in.", err_slug_invalid: "Invalid address: use lowercase letters, digits and hyphens.",
      err_name_invalid: "Name too short.", err_slug_taken: "That address is already taken.",
      err_code_invalid: "Invalid, expired or already used code.", err_already_member: "You are already in this workshop.",
      err_not_allowed: "You are not allowed to do this.", err_last_owner: "At least one manager must remain.",
      err_not_found: "Not found.", err_generic: "That didn't work. Try again."
    },
    fr: {
      atTitle: "Atelier", atBeta: "Fonction en test. Ne fait pas partie de Pro.",
      atNeedLogin: "Connectez-vous avec votre compte pour utiliser l'Atelier.", atOpenAccount: "Ouvrir le compte",
      atNoNet: "Une connexion est nécessaire.", atMine: "Vos ateliers", atNone: "Vous ne faites encore partie d'aucun atelier.",
      atOpen: "Ouvrir", atBack: "Retour", atLoading: "Chargement…",
      atCreateTitle: "Créer un atelier", atName: "Nom de l'atelier", atSlug: "Adresse (minuscules, chiffres, tiret)",
      atCreate: "Créer l'atelier", atJoinTitle: "J'ai un code d'invitation", atCode: "Code", atJoin: "Rejoindre",
      atRole: "Rôle", role_responsabil: "Responsable", role_birou: "Bureau technique", role_operator: "Opérateur", role_partener: "Partenaire",
      atMembers: "Membres", atYou: "vous", atRemove: "Retirer", atLeave: "Quitter l'atelier",
      atConfirmRemove: "Retirer ce membre ?", atConfirmLeave: "Quitter cet atelier ?",
      atInviteTitle: "Inviter", atInviteBtn: "Créer l'invitation", atInviteHint: "Le code est valable 7 jours et ne sert qu'une fois.",
      atStations: "Postes", atPending: "Invitations en attente", atNoPending: "Aucune invitation en attente.",
      atCopy: "Copier", atCopied: "Code copié", atDone: "Fait",
      st_magazzino: "Magasin", st_sezionatrice: "Scie à panneaux", st_bordatrice: "Plaqueuse de chants", st_cnc: "CNC",
      st_verniciatura: "Peinture", st_assemblaggio: "Assemblage", st_spedizione: "Expédition",
      err_not_authenticated: "Vous devez vous connecter.", err_slug_invalid: "Adresse invalide : minuscules, chiffres et tirets.",
      err_name_invalid: "Nom trop court.", err_slug_taken: "Cette adresse est déjà prise.",
      err_code_invalid: "Code invalide, expiré ou déjà utilisé.", err_already_member: "Vous faites déjà partie de cet atelier.",
      err_not_allowed: "Vous n'avez pas l'autorisation.", err_last_owner: "Il doit rester au moins un responsable.",
      err_not_found: "Introuvable.", err_generic: "Ça n'a pas marché. Réessayez."
    },
    de: {
      atTitle: "Werkstatt", atBeta: "Testfunktion. Nicht Teil von Pro.",
      atNeedLogin: "Melde dich mit deinem Konto an, um die Werkstatt zu nutzen.", atOpenAccount: "Konto öffnen",
      atNoNet: "Verbindung erforderlich.", atMine: "Deine Werkstätten", atNone: "Du gehörst noch keiner Werkstatt an.",
      atOpen: "Öffnen", atBack: "Zurück", atLoading: "Lädt…",
      atCreateTitle: "Werkstatt anlegen", atName: "Name der Werkstatt", atSlug: "Adresse (Kleinbuchstaben, Ziffern, Bindestrich)",
      atCreate: "Werkstatt anlegen", atJoinTitle: "Ich habe einen Einladungscode", atCode: "Code", atJoin: "Beitreten",
      atRole: "Rolle", role_responsabil: "Leiter", role_birou: "Technisches Büro", role_operator: "Bediener", role_partener: "Partner",
      atMembers: "Mitglieder", atYou: "du", atRemove: "Entfernen", atLeave: "Werkstatt verlassen",
      atConfirmRemove: "Dieses Mitglied entfernen?", atConfirmLeave: "Diese Werkstatt verlassen?",
      atInviteTitle: "Einladen", atInviteBtn: "Einladung erstellen", atInviteHint: "Der Code gilt 7 Tage und nur einmal.",
      atStations: "Stationen", atPending: "Offene Einladungen", atNoPending: "Keine offenen Einladungen.",
      atCopy: "Kopieren", atCopied: "Code kopiert", atDone: "Fertig",
      st_magazzino: "Lager", st_sezionatrice: "Plattensäge", st_bordatrice: "Kantenanleimmaschine", st_cnc: "CNC",
      st_verniciatura: "Lackiererei", st_assemblaggio: "Montage", st_spedizione: "Versand",
      err_not_authenticated: "Du musst dich anmelden.", err_slug_invalid: "Ungültige Adresse: Kleinbuchstaben, Ziffern und Bindestriche.",
      err_name_invalid: "Name zu kurz.", err_slug_taken: "Diese Adresse ist schon vergeben.",
      err_code_invalid: "Code ungültig, abgelaufen oder bereits benutzt.", err_already_member: "Du gehörst dieser Werkstatt schon an.",
      err_not_allowed: "Dafür fehlt dir die Berechtigung.", err_last_owner: "Mindestens ein Leiter muss bleiben.",
      err_not_found: "Nicht gefunden.", err_generic: "Das hat nicht geklappt. Versuche es erneut."
    },
    pl: {
      atTitle: "Warsztat", atBeta: "Funkcja testowa. Nie należy do Pro.",
      atNeedLogin: "Zaloguj się na swoje konto, aby korzystać z Warsztatu.", atOpenAccount: "Otwórz konto",
      atNoNet: "Wymagane połączenie.", atMine: "Twoje warsztaty", atNone: "Nie należysz jeszcze do żadnego warsztatu.",
      atOpen: "Otwórz", atBack: "Wstecz", atLoading: "Ładowanie…",
      atCreateTitle: "Utwórz warsztat", atName: "Nazwa warsztatu", atSlug: "Adres (małe litery, cyfry, myślnik)",
      atCreate: "Utwórz warsztat", atJoinTitle: "Mam kod zaproszenia", atCode: "Kod", atJoin: "Dołącz",
      atRole: "Rola", role_responsabil: "Kierownik", role_birou: "Biuro techniczne", role_operator: "Operator", role_partener: "Partner",
      atMembers: "Członkowie", atYou: "ty", atRemove: "Usuń", atLeave: "Opuść warsztat",
      atConfirmRemove: "Usunąć tego członka?", atConfirmLeave: "Opuścić ten warsztat?",
      atInviteTitle: "Zaproś", atInviteBtn: "Utwórz zaproszenie", atInviteHint: "Kod jest ważny 7 dni i działa jeden raz.",
      atStations: "Stanowiska", atPending: "Oczekujące zaproszenia", atNoPending: "Brak oczekujących zaproszeń.",
      atCopy: "Kopiuj", atCopied: "Skopiowano kod", atDone: "Gotowe",
      st_magazzino: "Magazyn", st_sezionatrice: "Piła formatowa", st_bordatrice: "Okleiniarka", st_cnc: "CNC",
      st_verniciatura: "Lakiernia", st_assemblaggio: "Montaż", st_spedizione: "Wysyłka",
      err_not_authenticated: "Musisz się zalogować.", err_slug_invalid: "Nieprawidłowy adres: małe litery, cyfry i myślniki.",
      err_name_invalid: "Nazwa zbyt krótka.", err_slug_taken: "Ten adres jest już zajęty.",
      err_code_invalid: "Kod nieprawidłowy, wygasły lub już użyty.", err_already_member: "Już należysz do tego warsztatu.",
      err_not_allowed: "Nie masz uprawnień do tej czynności.", err_last_owner: "Musi pozostać co najmniej jeden kierownik.",
      err_not_found: "Nie znaleziono.", err_generic: "Nie udało się. Spróbuj ponownie."
    },
    es: {
      atTitle: "Taller", atBeta: "Función en prueba. No forma parte de Pro.",
      atNeedLogin: "Inicia sesión con tu cuenta para usar el Taller.", atOpenAccount: "Abrir cuenta",
      atNoNet: "Hace falta conexión.", atMine: "Tus talleres", atNone: "Todavía no formas parte de ningún taller.",
      atOpen: "Abrir", atBack: "Atrás", atLoading: "Cargando…",
      atCreateTitle: "Crear un taller", atName: "Nombre del taller", atSlug: "Dirección (minúsculas, cifras, guion)",
      atCreate: "Crear taller", atJoinTitle: "Tengo un código de invitación", atCode: "Código", atJoin: "Entrar",
      atRole: "Rol", role_responsabil: "Responsable", role_birou: "Oficina técnica", role_operator: "Operario", role_partener: "Socio",
      atMembers: "Miembros", atYou: "tú", atRemove: "Quitar", atLeave: "Salir del taller",
      atConfirmRemove: "¿Quitar a este miembro?", atConfirmLeave: "¿Salir de este taller?",
      atInviteTitle: "Invitar", atInviteBtn: "Crear invitación", atInviteHint: "El código vale 7 días y se usa una sola vez.",
      atStations: "Puestos", atPending: "Invitaciones pendientes", atNoPending: "No hay invitaciones pendientes.",
      atCopy: "Copiar", atCopied: "Código copiado", atDone: "Hecho",
      st_magazzino: "Almacén", st_sezionatrice: "Seccionadora", st_bordatrice: "Canteadora", st_cnc: "CNC",
      st_verniciatura: "Pintura", st_assemblaggio: "Montaje", st_spedizione: "Expedición",
      err_not_authenticated: "Debes iniciar sesión.", err_slug_invalid: "Dirección no válida: minúsculas, cifras y guiones.",
      err_name_invalid: "Nombre demasiado corto.", err_slug_taken: "Esa dirección ya está en uso.",
      err_code_invalid: "Código no válido, caducado o ya usado.", err_already_member: "Ya formas parte de este taller.",
      err_not_allowed: "No tienes permiso para hacerlo.", err_last_owner: "Debe quedar al menos un responsable.",
      err_not_found: "No encontrado.", err_generic: "No ha funcionado. Inténtalo de nuevo."
    }
  };

  /* — texte E1: comenzi — */
  var JOB_TXT = {
    it: { jobsTitle: "Commesse", jobNone: "Nessuna commessa.", jobNew: "Nuova commessa dal progetto aperto",
      jobName: "Titolo", jobClient: "Cliente (etichetta)", jobDue: "Consegna", jobCreate: "Crea commessa",
      jobNoProject: "Apri prima un progetto con dei pezzi.", jobCreated: "Commessa creata (bozza)",
      jobPieces: "pezzi", jobSnapNote: "Si congelano solo i pezzi: nessun prezzo, nessun dato del cliente.",
      jobState: "Stato", state_draft: "Bozza", state_confirmed: "Confermata", state_in_progress: "In lavorazione",
      state_done: "Finita", state_shipped: "Spedita", state_installed: "Montata", state_cancelled: "Annullata",
      jobProgress: "Avanzamento", evStart: "Inizio", evDone: "Fatto", evIssue: "Problema", evSent: "Registrato",
      jobConfirmCancel: "Annullare la commessa? Non si può più cambiare.",
      err_title_invalid: "Titolo troppo corto.", err_snapshot_invalid: "Elenco pezzi non valido.",
      err_project_not_yours: "Il progetto non è tuo.", err_partner_invalid: "Partner non valido.",
      err_cancelled_final: "Commessa annullata: non si cambia più.", err_not_open: "La commessa non è aperta.",
      err_piece_unknown: "Pezzo sconosciuto.", err_client_id_required: "Richiesta non valida." },
    ro: { jobsTitle: "Comenzi", jobNone: "Nicio comandă.", jobNew: "Comandă nouă din proiectul deschis",
      jobName: "Titlu", jobClient: "Client (etichetă)", jobDue: "Termen", jobCreate: "Creează comanda",
      jobNoProject: "Deschide mai întâi un proiect cu piese.", jobCreated: "Comandă creată (ciornă)",
      jobPieces: "piese", jobSnapNote: "Se îngheață doar piesele: fără prețuri, fără datele clientului.",
      jobState: "Stare", state_draft: "Ciornă", state_confirmed: "Confirmată", state_in_progress: "În lucru",
      state_done: "Terminată", state_shipped: "Expediată", state_installed: "Montată", state_cancelled: "Anulată",
      jobProgress: "Progres", evStart: "Început", evDone: "Gata", evIssue: "Problemă", evSent: "Înregistrat",
      jobConfirmCancel: "Anulezi comanda? Nu se mai poate schimba.",
      err_title_invalid: "Titlu prea scurt.", err_snapshot_invalid: "Lista de piese nu e validă.",
      err_project_not_yours: "Proiectul nu e al tău.", err_partner_invalid: "Partener nevalid.",
      err_cancelled_final: "Comandă anulată: nu se mai schimbă.", err_not_open: "Comanda nu e deschisă.",
      err_piece_unknown: "Piesă necunoscută.", err_client_id_required: "Cerere nevalidă." },
    en: { jobsTitle: "Jobs", jobNone: "No jobs.", jobNew: "New job from the open project",
      jobName: "Title", jobClient: "Client (label)", jobDue: "Due", jobCreate: "Create job",
      jobNoProject: "Open a project with pieces first.", jobCreated: "Job created (draft)",
      jobPieces: "pieces", jobSnapNote: "Only the pieces are frozen: no prices, no client data.",
      jobState: "State", state_draft: "Draft", state_confirmed: "Confirmed", state_in_progress: "In progress",
      state_done: "Done", state_shipped: "Shipped", state_installed: "Installed", state_cancelled: "Cancelled",
      jobProgress: "Progress", evStart: "Start", evDone: "Done", evIssue: "Issue", evSent: "Recorded",
      jobConfirmCancel: "Cancel the job? It can't be changed afterwards.",
      err_title_invalid: "Title too short.", err_snapshot_invalid: "Invalid piece list.",
      err_project_not_yours: "This project is not yours.", err_partner_invalid: "Invalid partner.",
      err_cancelled_final: "Job cancelled: it can't change any more.", err_not_open: "The job is not open.",
      err_piece_unknown: "Unknown piece.", err_client_id_required: "Invalid request." },
    fr: { jobsTitle: "Commandes", jobNone: "Aucune commande.", jobNew: "Nouvelle commande depuis le projet ouvert",
      jobName: "Titre", jobClient: "Client (étiquette)", jobDue: "Échéance", jobCreate: "Créer la commande",
      jobNoProject: "Ouvrez d'abord un projet avec des pièces.", jobCreated: "Commande créée (brouillon)",
      jobPieces: "pièces", jobSnapNote: "Seules les pièces sont figées : ni prix, ni données du client.",
      jobState: "État", state_draft: "Brouillon", state_confirmed: "Confirmée", state_in_progress: "En cours",
      state_done: "Terminée", state_shipped: "Expédiée", state_installed: "Posée", state_cancelled: "Annulée",
      jobProgress: "Avancement", evStart: "Début", evDone: "Fait", evIssue: "Problème", evSent: "Enregistré",
      jobConfirmCancel: "Annuler la commande ? Elle ne pourra plus changer.",
      err_title_invalid: "Titre trop court.", err_snapshot_invalid: "Liste de pièces invalide.",
      err_project_not_yours: "Ce projet n'est pas le vôtre.", err_partner_invalid: "Partenaire invalide.",
      err_cancelled_final: "Commande annulée : elle ne change plus.", err_not_open: "La commande n'est pas ouverte.",
      err_piece_unknown: "Pièce inconnue.", err_client_id_required: "Requête invalide." },
    de: { jobsTitle: "Aufträge", jobNone: "Keine Aufträge.", jobNew: "Neuer Auftrag aus dem offenen Projekt",
      jobName: "Titel", jobClient: "Kunde (Bezeichnung)", jobDue: "Termin", jobCreate: "Auftrag anlegen",
      jobNoProject: "Öffne zuerst ein Projekt mit Teilen.", jobCreated: "Auftrag angelegt (Entwurf)",
      jobPieces: "Teile", jobSnapNote: "Eingefroren werden nur die Teile: keine Preise, keine Kundendaten.",
      jobState: "Status", state_draft: "Entwurf", state_confirmed: "Bestätigt", state_in_progress: "In Arbeit",
      state_done: "Fertig", state_shipped: "Versendet", state_installed: "Montiert", state_cancelled: "Storniert",
      jobProgress: "Fortschritt", evStart: "Start", evDone: "Fertig", evIssue: "Problem", evSent: "Erfasst",
      jobConfirmCancel: "Auftrag stornieren? Danach lässt er sich nicht mehr ändern.",
      err_title_invalid: "Titel zu kurz.", err_snapshot_invalid: "Teileliste ungültig.",
      err_project_not_yours: "Das Projekt gehört dir nicht.", err_partner_invalid: "Ungültiger Partner.",
      err_cancelled_final: "Auftrag storniert: keine Änderung mehr.", err_not_open: "Der Auftrag ist nicht offen.",
      err_piece_unknown: "Unbekanntes Teil.", err_client_id_required: "Ungültige Anfrage." },
    pl: { jobsTitle: "Zlecenia", jobNone: "Brak zleceń.", jobNew: "Nowe zlecenie z otwartego projektu",
      jobName: "Tytuł", jobClient: "Klient (etykieta)", jobDue: "Termin", jobCreate: "Utwórz zlecenie",
      jobNoProject: "Najpierw otwórz projekt z elementami.", jobCreated: "Zlecenie utworzone (szkic)",
      jobPieces: "elementy", jobSnapNote: "Zamrażane są tylko elementy: bez cen i danych klienta.",
      jobState: "Status", state_draft: "Szkic", state_confirmed: "Potwierdzone", state_in_progress: "W toku",
      state_done: "Gotowe", state_shipped: "Wysłane", state_installed: "Zamontowane", state_cancelled: "Anulowane",
      jobProgress: "Postęp", evStart: "Start", evDone: "Gotowe", evIssue: "Problem", evSent: "Zapisano",
      jobConfirmCancel: "Anulować zlecenie? Nie będzie można go już zmienić.",
      err_title_invalid: "Tytuł zbyt krótki.", err_snapshot_invalid: "Nieprawidłowa lista elementów.",
      err_project_not_yours: "To nie jest twój projekt.", err_partner_invalid: "Nieprawidłowy partner.",
      err_cancelled_final: "Zlecenie anulowane: nie można go już zmienić.", err_not_open: "Zlecenie nie jest otwarte.",
      err_piece_unknown: "Nieznany element.", err_client_id_required: "Nieprawidłowe żądanie." },
    es: { jobsTitle: "Pedidos", jobNone: "Ningún pedido.", jobNew: "Nuevo pedido desde el proyecto abierto",
      jobName: "Título", jobClient: "Cliente (etiqueta)", jobDue: "Entrega", jobCreate: "Crear pedido",
      jobNoProject: "Abre primero un proyecto con piezas.", jobCreated: "Pedido creado (borrador)",
      jobPieces: "piezas", jobSnapNote: "Solo se congelan las piezas: sin precios ni datos del cliente.",
      jobState: "Estado", state_draft: "Borrador", state_confirmed: "Confirmado", state_in_progress: "En curso",
      state_done: "Terminado", state_shipped: "Enviado", state_installed: "Montado", state_cancelled: "Cancelado",
      jobProgress: "Avance", evStart: "Inicio", evDone: "Hecho", evIssue: "Problema", evSent: "Registrado",
      jobConfirmCancel: "¿Cancelar el pedido? Ya no se podrá cambiar.",
      err_title_invalid: "Título demasiado corto.", err_snapshot_invalid: "Lista de piezas no válida.",
      err_project_not_yours: "Este proyecto no es tuyo.", err_partner_invalid: "Socio no válido.",
      err_cancelled_final: "Pedido cancelado: ya no cambia.", err_not_open: "El pedido no está abierto.",
      err_piece_unknown: "Pieza desconocida.", err_client_id_required: "Solicitud no válida." }
  };
  Object.keys(JOB_TXT).forEach(function (l) { Object.assign(I18N[l], JOB_TXT[l]); });

  function t(lang, key) { return (I18N[lang] || I18N.it)[key] || I18N.it[key] || key; }

  /* flag E0: ?atelier=1 lo pornește (și rămâne), ?atelier=0 îl oprește */
  function flagOn(win) {
    try {
      var q = new URLSearchParams(win.location.search).get("atelier");
      if (q === "1") win.localStorage.setItem("ebAtelier", "1");
      else if (q === "0") win.localStorage.removeItem("ebAtelier");
      return win.localStorage.getItem("ebAtelier") === "1";
    } catch (e) { return false; }
  }

  return { JOB_STATES: JOB_STATES, JOB_EVENTS: JOB_EVENTS, buildSnapshot: buildSnapshot,
           ROLES: ROLES, STATIONS: STATIONS, CAPS: CAPS, can: can, isSlug: isSlug, slugify: slugify,
           normCode: normCode, fmtCode: fmtCode, errKey: errKey, I18N: I18N, t: t, flagOn: flagOn };
});
