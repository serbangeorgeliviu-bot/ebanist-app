/* =====================================================================
   Ebanist — viewer 3D WebGL (PBR)
   -------------------------------------------------------------------
   De ce fișier separat și nu în index.html: e modul ES (îi trebuie
   importmap pentru three), iar index.html rămâne fișierul pe care îl
   editezi de pe telefon. three.js e local în vendor/ — aplicația
   trebuie să meargă în atelier fără rețea.

   render3D() din index.html RĂMÂNE NEATINS: el produce SVG-ul folosit
   la export JPG, la desenul tehnic, la miniaturi și la vederea camerei.
   Aici se înlocuiește DOAR previzualizarea principală (#svg3d).

   Citește direct din scope-ul global al index.html: buildModule, matById,
   matAll, planPC, VIEW, buildCfg.
   ===================================================================== */

import * as THREE from "three";
/* percorso relativo: RoomEnvironment sta piatto in vendor/, e comunque
   importa 'three' che l'importmap risolve */
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

const MM = 0.001;                 // milimetri -> metri

/* ============ 1. FIBRA LEMNOASĂ (procedurală, zero fișiere) ========== */
function makeWoodNormalMap(size = 256, strength = 2.2) {
  const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const height = (u, v) => {
    let h = 0, amp = 1, f = 1;
    for (let o = 0; o < 4; o++) {
      h += amp * Math.sin(v * 46 * f + Math.sin(u * 2.7 * f + o) * 2.2 + hash(o) * 6.283);
      amp *= 0.5; f *= 2.13;
    }
    h += 0.18 * (hash(Math.floor(u * size) * 31 + Math.floor(v * size) * 57) - 0.5);
    return h;
  };
  const data = new Uint8Array(size * size * 4), d = 1 / size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size;
    let nx = -(height(u + d, v) - height(u - d, v)) * strength;
    let ny = -(height(u, v + d) - height(u, v - d)) * strength;
    let nz = 1;
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const k = (j * size + i) * 4;
    data[k] = (nx * .5 + .5) * 255; data[k + 1] = (ny * .5 + .5) * 255;
    data[k + 2] = (nz * .5 + .5) * 255; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* ============ 2. MATERIALE PBR ====================================== */
/* Derivate din câmpul `tx` al MATDB, nu din id-uri: așa prind automat
   referințele Dispano și materialele adăugate manual (matAdd). */
const TX_RULES = {
  solid: { roughness: 0.58, metalness: 0, clearcoat: 0.10, clearcoatRoughness: 0.45 },
  wood:  { roughness: 0.66, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.50, grain: true },
  gloss: { roughness: 0.09, metalness: 0, clearcoat: 1.00, clearcoatRoughness: 0.05 },
};
/* MDF brut nu e vopsit — e cel mai mat din catalog. Nu poate împărți
   aceeași regulă cu MDF-ul lăcuit, care e aproape oglindă. */
const ID_OVR = {
  mdf18: { roughness: .92, clearcoat: 0 }, dsp_mdf_19: { roughness: .92, clearcoat: 0 },
  dsp_mdf_10: { roughness: .92, clearcoat: 0 }, dsp_mdf_6: { roughness: .92, clearcoat: 0 },
  dsp_mdf_25: { roughness: .92, clearcoat: 0 }, dsp_mdf_mr12: { roughness: .90, clearcoat: 0 },
  mdf19_gloss: { roughness: .07, clearcoat: 1, clearcoatRoughness: .04 },
  pal18_nero: { roughness: .64 }, pal18_antracite: { roughness: .62 },
};

let WOOD_N = null;
const MAT_CACHE = new Map();

function materialFor(key) {
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  let m;
  if (key === "__hw") {
    m = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .28, metalness: 1, envMapIntensity: 1.25 });
  } else if (key === "__glass") {
    m = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f6, roughness: .03, metalness: 0,
      transmission: .9, thickness: .004, ior: 1.5, transparent: true, opacity: .45, side: THREE.DoubleSide });
  } else if (key === "__wall") {
    m = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: .95, metalness: 0, side: THREE.DoubleSide });
  } else {
    const info = (typeof matById === "function" && matById(key)) || { c: "#eeeee9", tx: "solid" };
    const r = Object.assign({}, TX_RULES[info.tx] || TX_RULES.solid, ID_OVR[key] || {});
    m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(info.c || "#eeeee9"),
      roughness: r.roughness, metalness: r.metalness || 0,
      clearcoat: r.clearcoat || 0, clearcoatRoughness: r.clearcoatRoughness ?? .4,
      envMapIntensity: .9, side: THREE.FrontSide,
    });
    if (r.grain) {
      if (!WOOD_N) WOOD_N = makeWoodNormalMap();
      /* Le UV vengono dal box unitario: un fianco da 2200 e un bordo da 18
         ricevono la stessa densita di fibra, quindi sui bordi stretti la
         venatura si comprime. Tenuta bassa apposta: si legge come fibra e
         non come rigatura. Per la densita corretta per pannello servirebbe
         una UV per istanza (mapping triplanare) — non vale il costo qui. */
      const n = WOOD_N.clone(); n.needsUpdate = true; n.repeat.set(1, 4);
      m.normalMap = n; m.normalScale = new THREE.Vector2(.20, .20);
    }
  }
  MAT_CACHE.set(key, m);
  return m;
}

function matKeyOf(b, cfg) {
  if (b.kind === "w") return "__wall";
  if (b.kind === "g") return "__glass";
  if (b.hw) return "__hw";
  if (b.kind === "f") return cfg.matFront || cfg.matBody;
  return cfg.matBody;
}

/* ============ 3. GEOMETRIE ========================================= */
const pcOf = (b) => (typeof planPC === "function" ? planPC(b)
  : (b.pc || [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]]));

/* Dreptunghi -> poate merge instanțiat (box unitar scalat).
   Trapez (pereți 45-135°) -> are nevoie de geometrie proprie. */
function isRectPC(pc, eps = 0.5) {
  if (!pc) return true;
  const [bl, br, fr, fl] = pc;
  return Math.abs(bl[0] - fl[0]) < eps && Math.abs(br[0] - fr[0]) < eps;
}

/* Prismă cu bază patrulateră oarecare, extrudată pe Y.
   Winding (a,c,b)/(a,d,c): three.js consideră FAȚĂ triunghiul antiorar
   privit din exterior. Cu ordinea directă toate fețele ies pe dos și,
   fiind pe FrontSide, panoul trapezoidal dispare complet. */
function buildPrism(pc, y0, y1) {
  const v = [];
  const bot = pc.map(([x, z]) => [x, y0, z]);
  const top = pc.map(([x, z]) => [x, y1, z]);
  const quad = (a, b, c, d) => { v.push(...a, ...c, ...b, ...a, ...d, ...c); };
  quad(top[0], top[1], top[2], top[3]);
  quad(bot[3], bot[2], bot[1], bot[0]);
  for (let i = 0; i < 4; i++) quad(bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i]);
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

function boundsOf(boxes) {
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
           // raggio della sfera che contiene tutto: serve per inquadrare
           // sia la striscia larga 17vh sia l'anteprima verticale a 60vh
           rad: 0.5 * Math.hypot(w, h, dp) };
}

/* Vederea explodată: aceeași regulă ca în render3D — fiecare panou se
   depărtează pe direcția propriei grosimi. */
function explodeBoxes(boxes, amt) {
  if (!amt) return boxes;
  const B = boundsOf(boxes); if (!B) return boxes;
  let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9, Z0 = 1e9, Z1 = -1e9;
  boxes.forEach(b => { pcOf(b).forEach(([x, z]) => { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); });
    Y0 = Math.min(Y0, b.y0); Y1 = Math.max(Y1, b.y1); });
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

/* ============ 4. VIEWER ============================================ */
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const EASE = 0.18;          // urmărire exponențială ~300 ms la 60 fps
const SNAP = 0.00025;       // 0,25 mm: sub asta animația se consideră terminată

let R = null;               // { renderer, scene, camera, ... }

function boot(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setClearColor(0xe9e7e2, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);

  // mediu procedural: reflexii credibile pe PAL, fără niciun fișier HDR
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xcfe0ef, 0.45);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // podeaua: primește umbra, dar nu se vede ea însăși — ancorare fără cutie
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ opacity: 0.34 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const root = new THREE.Group();
  scene.add(root);

  R = { renderer, scene, camera, key, fill, ground, root, canvas,
        groups: new Map(), trapez: new Map(), anim: [], need: true,
        cam: { yaw: .46, pitch: .30, zoom: 1 }, bounds: null, raf: 0 };
  return R;
}

/* Reconstruiește scena din cutii. Reface mesh-urile doar când se schimbă
   NUMĂRUL de piese pe material; altfel doar re-țintește animația. */
function setBoxes(boxes, cfg) {
  const groups = new Map(), traps = [];
  for (const b of boxes) {
    const key = matKeyOf(b, cfg);
    if (isRectPC(b.pc)) { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(b); }
    else traps.push({ b, key });
  }

  // --- dreptunghiuri: un InstancedMesh per material ---
  for (const [key, list] of groups) {
    let g = R.groups.get(key);
    if (!g || g.mesh.count !== list.length) {
      if (g) { R.root.remove(g.mesh); g.mesh.dispose(); }
      const mesh = new THREE.InstancedMesh(UNIT, materialFor(key), list.length);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g = { mesh, cur: list.map(targetOf) };   // piese noi apar direct la cotă
      R.root.add(mesh); R.groups.set(key, g);
    }
    g.tgt = list.map(targetOf);
  }
  // materiale dispărute din configurație
  for (const [key, g] of [...R.groups]) {
    if (!groups.has(key)) { R.root.remove(g.mesh); g.mesh.dispose(); R.groups.delete(key); }
  }

  // --- trapeze: geometrie proprie, nu se pot instanția ---
  const seen = new Set();
  traps.forEach(({ b, key }, i) => {
    const pc = pcOf(b);
    const id = key + "|" + i;
    seen.add(id);
    const sig = pc.flat().join(",") + "|" + b.y0 + "|" + b.y1;
    let t = R.trapez.get(id);
    if (!t || t.sig !== sig) {
      if (t) { R.root.remove(t.mesh); t.mesh.geometry.dispose(); }
      const cx = pc.reduce((s, p) => s + p[0], 0) / 4, cz = pc.reduce((s, p) => s + p[1], 0) / 4;
      const cy = (b.y0 + b.y1) / 2;
      const geo = buildPrism(pc.map(([x, z]) => [x - cx, z - cz]), b.y0 - cy, b.y1 - cy);
      const mesh = new THREE.Mesh(geo, materialFor(key));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(cx * MM, cy * MM, cz * MM);
      R.root.add(mesh);
      t = { mesh, sig }; R.trapez.set(id, t);
    }
  });
  for (const [id, t] of [...R.trapez]) {
    if (!seen.has(id)) { R.root.remove(t.mesh); t.mesh.geometry.dispose(); R.trapez.delete(id); }
  }

  // --- încadrare + umbre pe gabaritul real ---
  const B = boundsOf(boxes);
  if (B) {
    R.bounds = B;
    const s = B.size;
    R.ground.position.set(B.cx, B.floor + 0.001, B.cz);
    R.ground.scale.set(s * 4, s * 4, 1);
    R.key.position.set(B.cx + s * 1.4, B.cy + s * 2.2, B.cz + s * 1.6);
    R.key.target.position.set(B.cx, B.cy, B.cz);
    R.fill.position.set(B.cx - s * 1.6, B.cy + s * 0.9, B.cz - s * 1.2);
    // shadow-camera strânsă pe mobilă: altfel aceiași 1024 px se împrăștie
    // pe scenă goală și umbra dintre polițe iese pastă
    const sc = R.key.shadow.camera;
    sc.left = -s * 1.3; sc.right = s * 1.3; sc.top = s * 1.3; sc.bottom = -s * 1.3;
    sc.near = s * 0.2; sc.far = s * 7;
    sc.updateProjectionMatrix();
  }
  R.need = true;
  kick();
}

function targetOf(b) {
  return { px: (b.x0 + b.x1) / 2 * MM, py: (b.y0 + b.y1) / 2 * MM, pz: (b.z0 + b.z1) / 2 * MM,
           sx: Math.abs(b.x1 - b.x0) * MM, sy: Math.abs(b.y1 - b.y0) * MM, sz: Math.abs(b.z1 - b.z0) * MM };
}

const M4 = new THREE.Matrix4(), QI = new THREE.Quaternion(),
      VP = new THREE.Vector3(), VS = new THREE.Vector3();

/* Un pas de animație. Întoarce true cât timp mai e ceva în mișcare —
   asta ține bucla pornită DOAR în timpul tranziției. */
function step() {
  let moving = false;
  for (const g of R.groups.values()) {
    if (!g.tgt) continue;
    for (let i = 0; i < g.tgt.length; i++) {
      const c = g.cur[i] || (g.cur[i] = Object.assign({}, g.tgt[i])), t = g.tgt[i];
      for (const k of ["px", "py", "pz", "sx", "sy", "sz"]) {
        const d = t[k] - c[k];
        if (Math.abs(d) > SNAP) { c[k] += d * EASE; moving = true; } else c[k] = t[k];
      }
      VP.set(c.px, c.py, c.pz);
      VS.set(Math.max(c.sx, 1e-5), Math.max(c.sy, 1e-5), Math.max(c.sz, 1e-5));
      M4.compose(VP, QI, VS);
      g.mesh.setMatrixAt(i, M4);
    }
    g.mesh.instanceMatrix.needsUpdate = true;
    g.mesh.computeBoundingSphere();
  }
  return moving;
}

/* Camera din VIEW-ul existent (yaw/pitch/zoom), cu damping.
   pitch e mereu > 0 => nu se poate intra cu camera prin podea. */
function stepCamera() {
  const V = (typeof VIEW === "object" && VIEW) || { yaw: .46, pitch: .3, zoom: 1 };
  const c = R.cam;
  const ty = Math.min(1.45, Math.max(0.08, V.yaw));
  const tp = Math.min(1.20, Math.max(0.05, V.pitch));
  const tz = Math.min(3, Math.max(0.5, V.zoom));
  let moving = false;
  const f = (a, b) => { const d = b - a; if (Math.abs(d) > 1e-4) { moving = true; return a + d * 0.16; } return b; };
  c.yaw = f(c.yaw, ty); c.pitch = f(c.pitch, tp); c.zoom = f(c.zoom, tz);

  const B = R.bounds || { cx: 0, cy: 0, cz: 0, size: 1, rad: .9 };
  /* distanza calcolata dal fov REALE su tutte e due gli assi, non da un
     fattore fisso: la stessa scena deve entrare in una striscia larga e
     bassa (17vh) e in un'anteprima verticale (60vh). */
  const vf = R.camera.fov * Math.PI / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * R.camera.aspect);
  const d = (B.rad || B.size) / Math.sin(Math.min(vf, hf) / 2) * 1.06 / c.zoom;
  R.camera.position.set(
    B.cx + d * Math.sin(c.yaw) * Math.cos(c.pitch),
    B.cy + d * Math.sin(c.pitch),
    B.cz + d * Math.cos(c.yaw) * Math.cos(c.pitch));
  R.camera.lookAt(B.cx, B.cy, B.cz);
  R.camera.near = Math.max(0.01, B.size * 0.05);
  R.camera.far = B.size * 30;
  R.camera.updateProjectionMatrix();
  return moving;
}

function resize() {
  if (!R) return;
  const el = R.canvas, w = el.clientWidth || 1, h = el.clientHeight || 1;
  const dpr = Math.min(window.devicePixelRatio || 1,
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 1 : 1.75);
  R.renderer.setPixelRatio(dpr);
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h;
  R.camera.updateProjectionMatrix();
  R.need = true; kick();
}

/* Buclă la cerere: se desenează doar cât timp ceva se mișcă.
   Un dulap care stă pe ecran costă ZERO — ăsta e motivul pentru care
   telefonul nu se încălzește. */
function frame() {
  R.raf = 0;
  const a = step(), b = stepCamera();
  R.renderer.render(R.scene, R.camera);
  R.need = false;
  if (a || b) kick();
}
/* Si CANCELLA e si riprogramma, non si esce se c'e gia una richiesta in coda.
   Un rAF chiesto mentre il canvas e nascosto (app aperta in background, tab
   GENERA non ancora visitata) puo non scattare MAI: con la guardia "se c'e
   gia una richiesta, esci" il flag restava alzato e il viewer non disegnava
   piu nulla per il resto della sessione. */
function kick() {
  if (!R) return;
  if (R.raf) cancelAnimationFrame(R.raf);
  R.raf = requestAnimationFrame(frame);
}

/* ============ 5. API PUBLIC ======================================== */
const GL3D = {
  ok: false,
  init(canvas) {
    try { boot(canvas); this.ok = true; }
    catch (e) { console.warn("WebGL indisponibil, rămâne SVG:", e); this.ok = false; }
    return this.ok;
  },
  render(cfg, opts) {
    if (!this.ok) return;
    try {
      let boxes = (opts && opts.boxes) ? opts.boxes.slice() : buildModule(cfg).boxes;
      boxes = explodeBoxes(boxes, (opts && opts.explode) || 0);
      setBoxes(boxes, cfg);
    } catch (e) { console.warn("viewer3d:", e); }
  },
  touch() { if (this.ok) { R.need = true; kick(); } },
  resize,
};

window.GL3D = GL3D;
if (typeof window.__gl3dReady === "function") window.__gl3dReady();
