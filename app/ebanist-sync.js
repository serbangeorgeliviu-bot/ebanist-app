/* ebanist-sync.js — deciziile de sincronizare a unui proiect între dispozitive (pur, fără DOM și fără rețea; 5.81.0).
   Aceeași regulă ca până acum (câștigă updated_at-ul mai recent), cu o schimbare: când ambele părți s-au schimbat de la ultima sincronizare,
   versiunea locală NU se suprascrie în tăcere: rămâne ca o copie de conflict, iar cea de pe server se aplică (nimic nu se pierde, D-39). */
(function (root) {
  "use strict";
  var t = function (s) { var d = new Date(s || 0).getTime(); return isNaN(d) ? 0 : d; };
  var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  /* trimiterea unui proiect: `snap` = JSON-ul local de acum, `meta` = ce știm de la ultima sincronizare a lui, `remote` = rândul de pe server sau null.
     noop: nimic de trimis · push: se urcă · conflict: și serverul s-a schimbat de la ultima sincronizare, cu local schimbat */
  function decidePush(o) {
    var meta = o.meta || {}, remote = o.remote;
    if (meta.lastSyncedSnapshot === o.snap) return "noop";
    if (remote && meta.lastRemoteUpdatedAt && remote.updated_at !== meta.lastRemoteUpdatedAt && t(remote.updated_at) > t(meta.updatedAt)) {
      return remote.data && same(remote.data, JSON.parse(o.snap)) ? "same" : "conflict";
    }
    return "push";
  }

  /* aducerea unui rând de pe server: `local` = proiectul de aici sau null, `meta` = metadatele lui sau undefined, `remote` = {updated_at, data}
     noop · pull (se preia) · same (conținut identic: se notează doar metadatele) · conflict (și local s-a schimbat de la ultima sincronizare) */
  function decidePull(o) {
    var meta = o.meta, remote = o.remote, local = o.local;
    var newer = !meta || t(remote.updated_at) > t(meta.lastRemoteUpdatedAt);
    if (!newer) return "noop";
    if (!local) return "pull";
    if (same(local, remote.data)) return "same";
    var changed = !meta || JSON.stringify(local) !== meta.lastSyncedSnapshot;
    return changed ? "conflict" : "pull";
  }

  /* rândurile de pe server care merită descărcate: nu sunt în coada de ștergeri și sunt mai noi decât ce știm (listă ușoară: id + updated_at) */
  function needed(list, metaById, deleted) {
    var del = {}; (deleted || []).forEach(function (i) { del[i] = 1; });
    return (list || []).filter(function (r) { var m = metaById[r.id]; return r && r.id && !del[r.id] && (!m || t(r.updated_at) > t(m.lastRemoteUpdatedAt)); })
      .map(function (r) { return r.id; });
  }

  /* copia de conflict: același proiect, alt id, numele cu sufixul dat; fără istoric de sincronizare */
  function conflictCopy(local, id, suffix) {
    var c = JSON.parse(JSON.stringify(local));
    c.id = id; c.name = String(local.name || "") + " (" + suffix + ")";
    return c;
  }

  root.EBSync = { decidePush: decidePush, decidePull: decidePull, needed: needed, conflictCopy: conflictCopy };
})(typeof globalThis !== "undefined" ? globalThis : this);
