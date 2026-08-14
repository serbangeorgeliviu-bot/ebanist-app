/* =====================================================================
   Ebanist — export del modello per l'AR nativa del telefono
   -------------------------------------------------------------------
   Android -> Scene Viewer (.glb)     iOS -> AR Quick Look (.usdz)

   Modulo caricato A RICHIESTA (import dinamico), non all'avvio: gli
   exporter piu fflate pesano ~100 KB che non ha senso pagare ogni volta.

   Non serve il renderer: la scena si costruisce a mano e gli exporter
   lavorano sul grafo. Quindi l'AR funziona ANCHE sui telefoni dove
   WebGL non parte e il viewer 3D e ricaduto su SVG.
   ===================================================================== */

/* Da geo3d.js, NON da viewer3d.js: l'export non deve dipendere dal viewer.
   Importando dal viewer, se quello non partiva moriva anche l'AR — proprio
   l'opposto del motivo per cui l'AR e stato scelto. */
import { THREE, MM, buildPrism, isRectPC, pcOf, matKeyOf, boundsOf } from "./geo3d.js";
import { GLTFExporter } from "./vendor/GLTFExporter.js";
import { USDZExporter } from "./vendor/USDZExporter.js";

/* Materiali dell'export: SEMPLICI di proposito — colore, ruvidita, metallo.
   Niente normal map procedurale: e una DataTexture, e farla digerire a
   entrambi gli exporter aggiunge rischio per un dettaglio che in AR, a
   mezzo metro dal mobile, non si vede. La venatura resta nell'anteprima. */
const ROUGH = { solid: 0.58, wood: 0.66, gloss: 0.09 };
const ROUGH_ID = {
  mdf18: .92, dsp_mdf_19: .92, dsp_mdf_10: .92, dsp_mdf_6: .92,
  dsp_mdf_25: .92, dsp_mdf_mr12: .90, mdf19_gloss: .07,
};

function exportMaterial(key, cache) {
  if (cache.has(key)) return cache.get(key);
  let m;
  if (key === "__hw") {
    m = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .28, metalness: 1 });
  } else if (key === "__glass") {
    m = new THREE.MeshStandardMaterial({ color: 0xe8f2f6, roughness: .05, metalness: 0,
      transparent: true, opacity: .5 });
  } else if (key === "__metal") {
    m = new THREE.MeshStandardMaterial({ color: 0x82868a, roughness: .42, metalness: .85 });
  } else {
    const info = (typeof matById === "function" && matById(key)) || { c: "#eeeee9", tx: "solid" };
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(info.c || "#eeeee9"),
      roughness: ROUGH_ID[key] != null ? ROUGH_ID[key] : (ROUGH[info.tx] || ROUGH.solid),
      metalness: 0,
    });
  }
  m.name = String(key);
  cache.set(key, m);
  return m;
}

/* Un Mesh per pannello, non InstancedMesh: l'export e una tantum, la
   performance non conta, e ne Scene Viewer ne Quick Look trattano
   l'instancing in modo affidabile. */
export function buildExportScene(boxes, cfg) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.name = "Mobile";
  const cache = new Map();
  const unit = new THREE.BoxGeometry(1, 1, 1);

  for (const b of boxes) {
    if (b.kind === "w" || b.kind === "g") continue;   // pareti e vetri della stanza non vanno in AR
    const key = matKeyOf(b, cfg);
    const mat = exportMaterial(key, cache);
    let mesh;
    if (isRectPC(b.pc)) {
      mesh = new THREE.Mesh(unit, mat);
      mesh.position.set((b.x0 + b.x1) / 2 * MM, (b.y0 + b.y1) / 2 * MM, (b.z0 + b.z1) / 2 * MM);
      mesh.scale.set(Math.abs(b.x1 - b.x0) * MM, Math.abs(b.y1 - b.y0) * MM, Math.abs(b.z1 - b.z0) * MM);
    } else {
      const pc = pcOf(b);
      const cx = pc.reduce((s, p) => s + p[0], 0) / 4, cz = pc.reduce((s, p) => s + p[1], 0) / 4;
      const cy = (b.y0 + b.y1) / 2;
      const geo = buildPrism(pc.map(([x, z]) => [x - cx, z - cz]), b.y0 - cy, b.y1 - cy);
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx * MM, cy * MM, cz * MM);
    }
    group.add(mesh);
  }

  /* Origine ai PIEDI e al centro in pianta: Scene Viewer e Quick Look
     appoggiano l'origine sul piano che trovano. Senza questo il mobile
     spunta mezzo dentro il pavimento. */
  const B = boundsOf(boxes);
  if (B) group.position.set(-B.cx, -B.floor, -B.cz);

  scene.add(group);
  return scene;
}

export function toGLB(scene) {
  return new Promise((res, rej) => {
    new GLTFExporter().parse(scene,
      (out) => res(new Blob([out], { type: "model/gltf-binary" })),
      (err) => rej(err),
      { binary: true });
  });
}

export async function toUSDZ(scene) {
  const bytes = await new USDZExporter().parseAsync(scene);
  return new Blob([bytes], { type: "model/vnd.usdz+zip" });
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const isAndroid = () => /android/i.test(navigator.userAgent);

/* Carica sulla funzione Netlify e restituisce l'indirizzo pubblico.
   Sta sullo stesso Netlify che pubblica il sito: nessun account, nessun
   login. In locale la funzione non esiste, l'upload fallisce e si ripiega
   sulla condivisione del file — e il comportamento voluto. */
export async function uploadModel(blob, filename) {
  const r = await fetch("/ar", {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "X-Filename": filename,
    },
    body: blob,
  });
  if (!r.ok) throw new Error("upload " + r.status);
  const j = await r.json().catch(() => null);
  if (!j || !j.url) throw new Error("indirizzo non restituito");
  return j.url;
}

/* Apre il visore AR di sistema. Torna false se non e stato possibile. */
export function openAR(url, title) {
  if (isAndroid()) {
    const intent = "intent://arvr.google.com/scene-viewer/1.0"
      + "?file=" + encodeURIComponent(url)
      + "&mode=ar_preferred&resizable=false"
      + "&title=" + encodeURIComponent(title || "Mobile")
      + "#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;"
      + "S.browser_fallback_url=" + encodeURIComponent(url) + ";end;";
    location.href = intent;
    return true;
  }
  if (isIOS()) {
    /* Quick Look si apre solo da un <a rel="ar"> con dentro un elemento:
       un anchor "nudo" viene ignorato da Safari. */
    const a = document.createElement("a");
    a.setAttribute("rel", "ar");
    a.href = url;
    a.appendChild(document.createElement("img"));
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
    return true;
  }
  return false;
}

/* Ripiego senza rete: si condivide il file. Su iPhone aprirlo dai File
   fa partire Quick Look lo stesso, quindi l'AR si ottiene comunque. */
export async function shareModel(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return true;
  }
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  return false;
}
