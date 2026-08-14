/* =====================================================================
   Ebanist — geometria condivisa fra il viewer e l'export AR
   -------------------------------------------------------------------
   Modulo PURO: nessun effetto collaterale, nessun renderer, nessun DOM
   toccato al caricamento. Esiste per una ragione precisa: l'export AR
   NON deve dipendere dal viewer 3D. Prima arexport.js importava da
   viewer3d.js, quindi se il viewer non partiva moriva anche l'AR — che
   e l'opposto del motivo per cui l'AR e stato scelto.

   La geometria sta qui una volta sola: se il modello in AR e quello a
   schermo divergono, il cliente vede un mobile e ne riceve un altro.

   CONTRATTO (lo stesso di buildModule in index.html, cote in MILLIMETRI):
     box = { x0,x1, y0,y1, z0,z1, kind, pc?, sub? }
     x = larghezza, y = altezza (y0 = pavimento), z = profondita
     z0 = RETRO, z1 = FRONTE. pc = 4 spigoli in pianta, puo essere trapezio.
   ===================================================================== */

import * as THREE from "./vendor/three.module.min.js";

export { THREE };
export const MM = 0.001;                 // millimetri -> metri

export const pcOf = (b) => (typeof planPC === "function" ? planPC(b)
  : (b.pc || [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]]));

/* Rettangolo -> puo andare istanziato (box unitario scalato).
   Trapezio (pareti 45-135°) -> gli serve geometria propria. */
export function isRectPC(pc, eps = 0.5) {
  if (!pc) return true;
  // piu di quattro spigoli = base tonda/ovale/raccordata: mai istanziabile come
  // scatola. Senza questa riga il controllo guardava solo i primi quattro punti
  // di un cerchio e lo scambiava per un rettangolo.
  if (pc.length !== 4) return false;
  const [bl, br, fr, fl] = pc;
  return Math.abs(bl[0] - fl[0]) < eps && Math.abs(br[0] - fr[0]) < eps;
}

/* Prisma con base quadrilatera qualsiasi, estruso su Y.
   Winding (a,c,b)/(a,d,c): three considera FACCIA il triangolo percorso in
   senso antiorario visto da fuori. Con l'ordine diretto tutte e sei le
   facce escono al rovescio e, essendo su FrontSide, il pannello sparisce. */
export function buildPrism(pc, y0, y1) {
  const n = pc.length;
  const v = [];
  const bot = pc.map(([x, z]) => [x, y0, z]);
  const top = pc.map(([x, z]) => [x, y1, z]);
  const quad = (a, b, c, d) => { v.push(...a, ...c, ...b, ...a, ...d, ...c); };
  const tri = (a, b, c) => { v.push(...a, ...b, ...c); };
  if (n === 4) {
    // quadrilateri: percorso invariato, byte per byte. Questo modulo alimenta
    // anche l'export AR — un cambio qui si vedrebbe su tutti i mobili gia fatti.
    quad(top[0], top[1], top[2], top[3]);
    quad(bot[3], bot[2], bot[1], bot[0]);
  } else {
    /* basi a piu lati (tondo, ovale, angolo raccordato): ventaglio dal primo
       vertice. Vale perche queste basi sono convesse per costruzione — sono
       ellissi campionate o archi, non profili qualunque. */
    for (let i = 1; i < n - 1; i++) {
      tri(top[0], top[i + 1], top[i]);        // faccia superiore
      tri(bot[0], bot[i], bot[i + 1]);        // inferiore: verso opposto
    }
  }
  for (let i = 0; i < n; i++) quad(bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]);
  const pos = new Float32Array(v.map((n) => n * MM));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0, k = 0; i < pos.length; i += 3, k += 2) { uv[k] = pos[i] * 2; uv[k + 1] = pos[i + 1] * 2; }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

export function boundsOf(boxes) {
  let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9, Z0 = 1e9, Z1 = -1e9, any = false;
  for (const b of boxes) {
    if (b.kind === "w") continue;
    any = true;
    pcOf(b).forEach(([x, z]) => { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); });
    Y0 = Math.min(Y0, b.y0); Y1 = Math.max(Y1, b.y1);
  }
  if (!any) return null;
  const w = (X1 - X0) * MM, h = (Y1 - Y0) * MM, dp = (Z1 - Z0) * MM;
  return { cx: (X0 + X1) / 2 * MM, cy: (Y0 + Y1) / 2 * MM, cz: (Z0 + Z1) / 2 * MM,
           size: Math.max(w, h, dp), floor: Y0 * MM,
           rad: 0.5 * Math.hypot(w, h, dp) };
}

export function matKeyOf(b, cfg) {
  if (b.kind === "w") return "__wall";
  if (b.kind === "g") return "__glass";
  if (b.hw) return "__hw";
  if (b.kind === "f") return cfg.matFront || cfg.matBody;
  if (b.sub === "back") return cfg.matBack || cfg.matBody;
  return cfg.matBody;
}

/* Vista esplosa: ogni pannello si allontana lungo il proprio spessore,
   stessa regola di render3D. */
export function explodeBoxes(boxes, amt) {
  if (!amt) return boxes;
  let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9, Z0 = 1e9, Z1 = -1e9;
  boxes.forEach(b => { pcOf(b).forEach(([x, z]) => { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); });
    Y0 = Math.min(Y0, b.y0); Y1 = Math.max(Y1, b.y1); });
  if (X1 < X0) return boxes;
  const CX = (X0 + X1) / 2, CY = (Y0 + Y1) / 2, CZ = (Z0 + Z1) / 2;
  const k = Math.max(X1 - X0, Y1 - Y0, Z1 - Z0) * 0.32 * amt, sg = v => v < -0.5 ? -1 : 1;
  return boxes.map(b => {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0, mn = Math.min(dx, dy, dz);
    let ox = 0, oy = 0, oz = 0;
    if (mn === dx) ox = sg((b.x0 + b.x1) / 2 - CX) * k;
    else if (mn === dy) oy = sg((b.y0 + b.y1) / 2 - CY) * k;
    else oz = sg((b.z0 + b.z1) / 2 - CZ) * k;
    const o = Object.assign({}, b, { x0: b.x0 + ox, x1: b.x1 + ox, y0: b.y0 + oy, y1: b.y1 + oy, z0: b.z0 + oz, z1: b.z1 + oz });
    if (b.pc) o.pc = b.pc.map(q => [q[0] + ox, q[1] + oz]);
    return o;
  });
}
