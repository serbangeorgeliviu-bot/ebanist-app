/* ebanist-share.js — proiecte partajate între utilizatori: roluri și reguli (pur, fără DOM și fără rețea; 5.82.0, D-159).
   Rolurile vin de pe server (project_role_of / project_shared_list): owner | editor | commenter | viewer. Serverul decide (RLS); aici doar ce arătăm și ce nu trimitem. */
(function (root) {
  "use strict";
  var ROLES = ["viewer", "commenter", "editor"];             /* rolurile care se pot da prin invitație */
  var canEdit = function (r) { return r === "owner" || r === "editor"; };
  var canComment = function (r) { return r === "owner" || r === "editor" || r === "commenter"; };
  var isShared = function (r) { return !!r && r !== "owner"; };
  var normCode = function (s) { return String(s == null ? "" : s).replace(/[^0-9A-Za-z]/g, "").toUpperCase(); };

  /* eroarea serverului (RAISE EXCEPTION 'project:…') → cheie de text; necunoscut → null */
  function errKey(msg) {
    var m = /project:(\w+)/.exec(String(msg || ""));
    return !m ? null : ({ code_invalid: "shErrCode", already_member: "shErrAlready", not_allowed: "shErrAllowed", not_authenticated: "shErrLogin" })[m[1]] || null;
  }

  /* `rows` = rândurile project_shared_list → harta {id: {role, owner_id, owner_name}} */
  function shareMap(rows) {
    var m = {};
    (rows || []).forEach(function (r) { if (r && r.project_id) m[r.project_id] = { role: r.role, owner_id: r.owner_id, owner_name: r.owner_name || "" }; });
    return m;
  }

  /* proiectele partajate fără drept de scriere care s-au modificat local de la ultima sincronizare: se readuc la starea sincronizată (serverul oricum ar respinge scrierea) */
  function readOnlyChanged(projects, map, metaById) {
    return (projects || []).filter(function (p) {
      var s = map[p.id], m = metaById[p.id];
      return s && !canEdit(s.role) && m && m.lastSyncedSnapshot && JSON.stringify(p) !== m.lastSyncedSnapshot;
    }).map(function (p) { return p.id; });
  }

  /* ce se trimite pe server: proiectele proprii și cele la care am rol de editor */
  function pushable(p, map) { var s = map[p.id]; return !s || canEdit(s.role); }

  root.EBShare = { ROLES: ROLES, canEdit: canEdit, canComment: canComment, isShared: isShared, normCode: normCode, errKey: errKey, shareMap: shareMap, readOnlyChanged: readOnlyChanged, pushable: pushable };
})(typeof globalThis !== "undefined" ? globalThis : this);
