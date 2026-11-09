/* =====================================================================
   Ebanist — limită de cereri (audit 2026-11-09: E-01, E-02)
   ---------------------------------------------------------------------
   Numără cererile într-o fereastră fixă (implicit o oră) în Netlify
   Blobs, ca `pro-restore.js`. Un singur loc, ca limitele să nu se
   rescrie în fiecare funcție.

   Dacă magazia nu răspunde, cererea TRECE (fail-open): o plată sau o
   comandă reală nu se refuză din cauza unei limite. Pentru /api/ai
   plafonul de cost rămâne bugetul din consola furnizorului.
   În cheie intră numai amprenta (sha-256 tăiat) a IP-ului sau a
   codului, niciodată valoarea.
   ===================================================================== */
import { createHash } from "node:crypto";

let injected = null;
/* Pentru teste: un depozit cu get()/setJSON(). */
export function _setStore(s) { injected = s; }

const sha = s => createHash("sha256").update(String(s)).digest("hex").slice(0, 40);

async function store() {
  if (injected) return injected;
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "ebanist-limits", consistency: "strong" });
}

/* true = încă în limită. */
export async function allow(kind, id, max, windowMs = 3600000) {
  try {
    const st = await store();
    const key = kind + "-" + sha(id) + "-" + Math.floor(Date.now() / windowMs);
    const n = (await st.get(key, { type: "json" })) || 0;
    if (n >= max) return false;
    await st.setJSON(key, n + 1);
    return true;
  } catch (e) {
    return true;
  }
}

export function clientIp(req) {
  return req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "-";
}

export const HOUR = 3600000, DAY = 86400000;
