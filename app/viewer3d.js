/* =====================================================================
   Ebanist — viewer 3D WebGL (PBR)
   -------------------------------------------------------------------
   Fișier separat de index.html: e modul ES, iar index.html rămâne fișierul
   care se editează de pe telefon. three.js e local în vendor/ — aplicația
   trebuie să meargă în atelier fără rețea.

   render3D() din index.html RĂMÂNE NEATINS: el produce SVG-ul folosit la
   export JPG, la desenul tehnic, la miniaturi și la vederea camerei.
   Aici se desenează previzualizarea principală și Studioul 3D.

   4.29 — ce s-a schimbat:
     - un mesh per PANOU, grupat pe PIESA FIZICĂ (`pk` din buildCore): se
       poate selecta, izola, deschide (uși, sertare) fără să se miște restul;
     - lemnul are fibră colorată, proiectată pe piesă (triplanar în
       coordonatele ei de repaus): fibra nu „alunecă" când ușa se deschide;
     - studio: fundal în degrade, lumină de umplere din emisferă, umbră de
       contact sub corp;
     - feroneria și găurile vin din Modelul de Operații (ebanist-ops.js):
       ce se vede în 3D e exact ce scrie pe fișa piesei.

   Citește din scope-ul global al index.html: buildModule, matById, VIEW,
   roleMatId, PIECE_MAT_ROLE, deriveCarcass, carcassParams, generateOperations.
   ===================================================================== */

/* Percorsi diretti, NIENTE importmap: gli importmap arrivano solo con
   iOS 16.4 / Chrome 89. */
import { THREE, MM, pcOf, isRectPC, buildPrism, boundsOf, matKeyOf, explodeBoxes } from "./geo3d.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

/* ============ 1. FIBRA LEMNOASĂ (procedurală, zero fișiere) ========== */
/* Un factor de luminanță în jurul lui 1, nu o culoare: culoarea o dă
   materialul. Așa aceeași textură servește stejarul și nucul. Fibra
   curge pe verticală (axa v a texturii). */
function makeWoodTexture(seed = 1, size = 512) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d");
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const img = g.createImageData(size, size), d = img.data;
  /* inele: sinusoide deformate pe x, cu frecvență care variază — asta dă
     desenul de „flacără" al plăcii tăiate tangențial */
  const ph = [], amp = [], fr = [];
  /* frecvențe ÎNTREGI pe v: textura se repetă fără cusătură pe verticală */
  for (let i = 0; i < 5; i++) { ph.push(rnd() * 6.283); amp.push(0.25 + rnd() * 0.55); fr.push(1 + Math.floor(rnd() * 3)); }
  /* benzi de culoare mai late, ca la placa reală: câteva fâșii mai închise */
  const band = []; for (let i = 0; i < 4; i++) band.push([rnd(), 0.02 + rnd() * 0.05, 0.02 + rnd() * 0.03]);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let w = u * 64 * 6.283 / 6.283;
      for (let i = 0; i < 5; i++) w += amp[i] * Math.sin(v * 6.283 * fr[i] + ph[i] + u * 3.1 * (i + 1));
      const ring = 0.5 + 0.5 * Math.sin(w);
      const fine = 0.5 + 0.5 * Math.sin(u * 6.283 * 180 + Math.sin(v * 6.283 * 3 + u * 11) * 1.4);
      let b = 0; for (const [c, wd, k] of band) { const du = Math.min(Math.abs(u - c), 1 - Math.abs(u - c)); if (du < wd) b += k * (1 - du / wd); }
      const n = rnd();
      let f = 0.95 - 0.075 * Math.pow(ring, 2.2) - 0.028 * fine - b + (n - 0.5) * 0.035;
      f = Math.max(0, Math.min(1, f));
      const k = (y * size + x) * 4, c = Math.round(f * 255);
      d[k] = c; d[k + 1] = c; d[k + 2] = c; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ============ 2. MATERIALE PBR ====================================== */
const TX_RULES = {
  solid: { roughness: 0.52, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.42 },
  wood:  { roughness: 0.62, metalness: 0, clearcoat: 0.10, clearcoatRoughness: 0.48, grain: true },
  gloss: { roughness: 0.08, metalness: 0, clearcoat: 1.00, clearcoatRoughness: 0.04 },
};
const ID_OVR = {
  mdf18: { roughness: .92, clearcoat: 0 }, dsp_mdf_19: { roughness: .92, clearcoat: 0 },
  dsp_mdf_10: { roughness: .92, clearcoat: 0 }, dsp_mdf_6: { roughness: .92, clearcoat: 0 },
  dsp_mdf_25: { roughness: .92, clearcoat: 0 }, dsp_mdf_mr12: { roughness: .90, clearcoat: 0 },
  mdf19_gloss: { roughness: .07, clearcoat: 1, clearcoatRoughness: .04 },
  pal18_nero: { roughness: .64 }, pal18_antracite: { roughness: .62 },
};

let WOOD = null;
const MAT_CACHE = new Map();

/* Proiecția triplanară în coordonatele de REPAUS ale piesei: `uRest` e
   matricea locală a mesh-ului (poziție × dimensiune), actualizată înainte de
   fiecare desen. Fețele laterale și frontale au fibra pe verticală, cele
   orizontale de-a lungul lui x — cum se taie de fapt un corp. */
function triplanar(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRest = { value: new THREE.Matrix4() };
    sh.uniforms.uEbScale = { value: new THREE.Vector2(1 / 0.42, 1 / 1.9) };
    m.userData.shader = sh;
    sh.vertexShader = "uniform mat4 uRest;\nvarying vec3 vEbP;\nvarying vec3 vEbN;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n vEbP = (uRest * vec4(transformed,1.0)).xyz;\n vEbN = normalize(mat3(uRest) * objectNormal);");
    sh.fragmentShader = "uniform vec2 uEbScale;\nvarying vec3 vEbP;\nvarying vec3 vEbN;\n" + sh.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec3 ebA = abs(vEbN); vec2 ebUV;
        if (ebA.x > ebA.y && ebA.x > ebA.z) ebUV = vec2(vEbP.z, vEbP.y);
        else if (ebA.y > ebA.z) ebUV = vec2(vEbP.z, vEbP.x);
        else ebUV = vec2(vEbP.x, vEbP.y);
        vec4 sampledDiffuseColor = texture2D(map, ebUV * uEbScale);
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  m.customProgramCacheKey = () => "eb-triplanar";
}

function materialFor(key) {
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  let m;
  if (key === "__hw") {
    m = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: .3, metalness: 1, envMapIntensity: 1.2 });
  } else if (key === "__hwdark") {
    m = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: .35, metalness: .9, envMapIntensity: 1.1 });
  } else if (key === "__plastic") {
    m = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: .55, metalness: 0 });
  } else if (key === "__wooddowel") {
    m = new THREE.MeshStandardMaterial({ color: 0xc9a46b, roughness: .8, metalness: 0 });
  } else if (key === "__glass") {
    m = new THREE.MeshPhysicalMaterial({ color: 0xe8f2f6, roughness: .03, metalness: 0,
      transmission: .9, thickness: .004, ior: 1.5, transparent: true, opacity: .42, side: THREE.DoubleSide });
  } else if (key === "__wall") {
    m = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: .95, metalness: 0, side: THREE.DoubleSide });
  } else if (key === "__metal") {
    m = new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: .4, metalness: .85, envMapIntensity: 1.1 });
  } else if (key === "__hole") {
    m = new THREE.MeshBasicMaterial({ color: 0x17130f, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  } else if (key === "__groove") {
    m = new THREE.MeshBasicMaterial({ color: 0x2a231b, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  } else {
    const info = (typeof matById === "function" && matById(key)) || { c: "#eeeee9", tx: "solid" };
    const r = Object.assign({}, TX_RULES[info.tx] || TX_RULES.solid, ID_OVR[key] || {});
    const col = new THREE.Color(info.c || "#eeeee9");
    m = new THREE.MeshPhysicalMaterial({
      color: col, roughness: r.roughness, metalness: r.metalness || 0,
      clearcoat: r.clearcoat || 0, clearcoatRoughness: r.clearcoatRoughness ?? .4,
      envMapIntensity: .85, side: THREE.FrontSide,
    });
    if (r.grain) {
      if (!WOOD) WOOD = makeWoodTexture(7);
      /* la textura scade luminozitatea (~0,9 în medie): culoarea se ridică
         ca media să rămână cea a mostrei */
      m.color.multiplyScalar(1.08);
      m.map = WOOD;
    }
    triplanar(m);
  }
  MAT_CACHE.set(key, m);
  return m;
}
/* Materialul „fantomă": piesele din jurul celei selectate, sau corpul în
   modul feronerie. Transparent, fără umbre, fără scriere în adâncime. */
const GHOST = () => MAT_CACHE.get("__ghost") || (MAT_CACHE.set("__ghost", new THREE.MeshStandardMaterial({
  color: 0xb9c2b4, transparent: true, opacity: .14, depthWrite: false, roughness: .9 })), MAT_CACHE.get("__ghost"));

/* Materialul unei cutii: rolul întâi (fiecare element are materialul lui —
   D-41), apoi regula veche din geo3d pentru cutiile fără rol. */
function keyOf(b, cfg) {
  if (b.kind === "w") return "__wall";
  if (b.kind === "g" || b.role === "vetro") return "__glass";
  if (b.kind === "m" || b.role === "cassetto_metallo") return "__metal";
  if (b.role === "piedino") return "__hwdark";
  if (b.role === "asta") return "__hw";
  try {
    if (b.role && typeof PIECE_MAT_ROLE === "object" && PIECE_MAT_ROLE[b.role] && typeof roleMatId === "function") {
      const id = roleMatId(cfg, PIECE_MAT_ROLE[b.role]);
      if (id) return id;
    }
  } catch (e) { /* ruolo senza materiale: ricade sulla regola vecchia */ }
  return matKeyOf(b, cfg);
}

/* ============ 3. VIEWER ============================================ */
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT);
const DISC = new THREE.CircleGeometry(0.5, 24);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const EASE = 0.2;
const SNAP = 0.00025;

let R = null;

function gradientBg(dark) {
  const cv = document.createElement("canvas"); cv.width = 4; cv.height = 256;
  const g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  if (dark) { gr.addColorStop(0, "#2b3129"); gr.addColorStop(.62, "#1d221b"); gr.addColorStop(1, "#141712"); }
  else { gr.addColorStop(0, "#f4f5f1"); gr.addColorStop(.62, "#e6e8e1"); gr.addColorStop(1, "#d6d9cf"); }
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* umbra de contact: un disc cu degrade radial sub corp. Ține loc de
   ocluzia ambientală pe care un telefon nu și-o permite. */
function contactTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(.55, "rgba(0,0,0,.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
function isDark() {
  const a = document.documentElement.getAttribute("data-theme");
  if (a === "dark") return true; if (a === "light") return false;
  return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
}

function boot(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const dark = isDark();
  scene.background = gradientBg(dark);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  if ("environmentIntensity" in scene) scene.environmentIntensity = 0.75;

  const hemi = new THREE.HemisphereLight(0xf6f3ec, 0x6f685c, 0.42);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
  key.castShadow = true;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  key.shadow.mapSize.set(lowMem ? 1024 : 2048, lowMem ? 1024 : 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xd6e4f2, 0.28);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: dark ? 0.34 : 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, opacity: dark ? .8 : .5 }));
  contact.rotation.x = -Math.PI / 2; contact.renderOrder = -1;
  scene.add(contact);

  const root = new THREE.Group();
  scene.add(root);

  R = { renderer, scene, camera, key, fill, rim, hemi, ground, contact, root, canvas, dark,
        pieces: new Map(), model: null, sig: "", need: true, raf: 0,
        st: { explode: 0, open: 0, mode: "real", hw: false, holes: false, sel: null, iso: false, edges: true },
        cam: { yaw: .46, pitch: .30, zoom: 1, cx: 0, cy: 0, cz: 0, rad: 1 }, bounds: null, full: null };
  return R;
}

/* --- pezzi ----------------------------------------------------------- */
function restOf(b) {
  return { px: (b.x0 + b.x1) / 2 * MM, py: (b.y0 + b.y1) / 2 * MM, pz: (b.z0 + b.z1) / 2 * MM,
           sx: Math.max(Math.abs(b.x1 - b.x0), .01) * MM, sy: Math.max(Math.abs(b.y1 - b.y0), .01) * MM,
           sz: Math.max(Math.abs(b.z1 - b.z0), .01) * MM };
}
function applyRest(mesh, c) {
  mesh.position.set(c.px, c.py, c.pz); mesh.scale.set(c.sx, c.sy, c.sz); mesh.updateMatrix();
}
function makeMesh(b, cfg) {
  const key = keyOf(b, cfg);
  let mesh;
  if (isRectPC(b.pc)) {
    mesh = new THREE.Mesh(UNIT, materialFor(key));
    const c = restOf(b); mesh.userData.cur = Object.assign({}, c); mesh.userData.tgt = c;
    applyRest(mesh, c);
    const ln = new THREE.LineSegments(UNIT_EDGES, new THREE.LineBasicMaterial({ color: 0x2b2a26, transparent: true, opacity: .16 }));
    ln.raycast = () => {}; mesh.add(ln); mesh.userData.lines = ln;
  } else {
    const pc = pcOf(b);
    const cx = pc.reduce((s, p) => s + p[0], 0) / pc.length, cz = pc.reduce((s, p) => s + p[1], 0) / pc.length;
    const cy = (b.y0 + b.y1) / 2;
    mesh = new THREE.Mesh(buildPrism(pc.map(([x, z]) => [x - cx, z - cz]), b.y0 - cy, b.y1 - cy), materialFor(key));
    mesh.position.set(cx * MM, cy * MM, cz * MM); mesh.updateMatrix();
    mesh.userData.prism = true;
  }
  mesh.matrixAutoUpdate = false;
  mesh.castShadow = mesh.receiveShadow = b.kind !== "g";
  mesh.userData.key = key; mesh.userData.base = mesh.material;
  mesh.onBeforeRender = (r, s, c, g, mat) => {
    const sh = mat.userData && mat.userData.shader;
    if (sh) { sh.uniforms.uRest.value.copy(mesh.matrix); mat.uniformsNeedUpdate = true; }
  };
  return mesh;
}

/* Gruppa per pezzo fisico. La trasformazione del gruppo porta esplosione e
   apertura; i figli restano nelle coordinate di riposo. */
function pieceGroup(pk) {
  let P = R.pieces.get(pk);
  if (P) return P;
  const g = new THREE.Group(); g.matrixAutoUpdate = false;
  R.root.add(g);
  P = { pk, g, meshes: [], hw: new THREE.Group(), holes: new THREE.Group(), role: null, boxes: [],
        cur: { ex: 0, ey: 0, ez: 0, ang: 0, sl: 0 }, tgt: { ex: 0, ey: 0, ez: 0, ang: 0, sl: 0 }, pivot: null };
  g.add(P.hw, P.holes);
  R.pieces.set(pk, P);
  return P;
}
function disposePiece(P) {
  R.root.remove(P.g);
  P.meshes.forEach(m => { if (m.userData.prism) m.geometry.dispose(); if (m.userData.lines) m.userData.lines.material.dispose(); });
  clearGroup(P.hw); clearGroup(P.holes);
}
function clearGroup(g) {
  for (const c of [...g.children]) { g.remove(c); if (c.userData.own) c.geometry.dispose(); if (c.isInstancedMesh) c.dispose(); }
}

function setModel(boxes, cfg) {
  /* le cutie spinte senza `pk` (tipologie speciali, fațete de ușă curbă)
     primesc unul sintetic: se văd, dar nu se forează */
  let syn = 100000;
  boxes = boxes.map(b => (b.pk == null ? Object.assign({}, b, { pk: "s" + (syn++) }) : b));
  const byPk = new Map();
  boxes.forEach(b => { const k = String(b.pk); if (!byPk.has(k)) byPk.set(k, []); byPk.get(k).push(b); });

  for (const [pk, P] of [...R.pieces]) {
    const nb = byPk.get(pk);
    const same = nb && nb.length === P.meshes.length && nb.every((b, i) => {
      const m = P.meshes[i]; return !m.userData.prism && isRectPC(b.pc) && m.userData.key === keyOf(b, cfg);
    });
    if (!same) { disposePiece(P); R.pieces.delete(pk); }
  }
  for (const [pk, bs] of byPk) {
    let P = R.pieces.get(pk);
    if (P) { bs.forEach((b, i) => { P.meshes[i].userData.tgt = restOf(b); }); }
    else {
      P = pieceGroup(pk);
      bs.forEach(b => { const m = makeMesh(b, cfg); m.userData.pk = pk; P.meshes.push(m); P.g.add(m); });
    }
    P.boxes = bs; P.role = bs[0].role || null; P.sub = bs[0].sub || null; P.grp = bs[0].grp || null;
  }
  return boxes;
}

/* --- ferramenta e fori dal Modello di Operazioni ---------------------- */
function cyl(mat, a, b, dia) {
  const va = new THREE.Vector3(a[0] * MM, a[1] * MM, a[2] * MM), vb = new THREE.Vector3(b[0] * MM, b[1] * MM, b[2] * MM);
  const m = new THREE.Mesh(CYL, materialFor(mat));
  const len = va.distanceTo(vb);
  m.position.copy(va).add(vb).multiplyScalar(.5);
  m.scale.set(dia * MM, Math.max(len, 1e-5), dia * MM);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  m.castShadow = true;
  return m;
}
function box(mat, lo, hi) {
  const m = new THREE.Mesh(UNIT, materialFor(mat));
  m.position.set((lo[0] + hi[0]) / 2 * MM, (lo[1] + hi[1]) / 2 * MM, (lo[2] + hi[2]) / 2 * MM);
  m.scale.set(Math.max(Math.abs(hi[0] - lo[0]), .2) * MM, Math.max(Math.abs(hi[1] - lo[1]), .2) * MM, Math.max(Math.abs(hi[2] - lo[2]), .2) * MM);
  m.castShadow = true;
  return m;
}
const along = (w, ax, d) => { const o = w.slice(); o[ax] += d; return o; };

function buildHardware(model) {
  for (const P of R.pieces.values()) { clearGroup(P.hw); clearGroup(P.holes); P.pivot = null; }
  if (!model || !model.ops) return;
  const O = model.ops;
  /* cerniere: dicono anche da che parte si apre l'anta */
  O.hw.forEach(h => {
    const P = R.pieces.get(String(h.piece)); if (!P) return;
    const A = h.against != null ? R.pieces.get(String(h.against)) : null;
    const tag = (m, always) => { m.userData.hw = h.type; m.userData.always = !!always; m.userData.rel = [String(h.piece), String(h.against)]; return m; };
    if (h.type === "cerniera") {
      const w = h.w;                                            // tazza, faccia interna dell'anta
      P.hw.add(tag(cyl("__hw", along(w, 2, 0), along(w, 2, 12), 35)));
      if (h.plate && A) {
        const p = h.plate, sd = h.hingeLeft ? 1 : -1;
        A.hw.add(tag(box("__hw", [p[0], p[1] - 24, p[2] - 18], [p[0] + sd * 11, p[1] + 24, p[2] + 18])));
        /* braccio: dalla tazza alla basetta */
        P.hw.add(tag(box("__hw", [Math.min(w[0], p[0] + sd * 11), w[1] - 9, Math.min(w[2] - 14, p[2])],
                                 [Math.max(w[0], p[0] + sd * 11), w[1] + 9, w[2]])));
      }
      if (!P.pivot) P.pivot = { x: h.hingeLeft ? P.boxes[0].x0 : P.boxes[0].x1, z: P.boxes[0].z1, left: h.hingeLeft };
    } else if (h.type === "minifix") {
      P.hw.add(tag(cyl("__hw", h.w, along(h.w, h.dir.ax, -h.dir.side * 12.5), 15)));
      const e = h.edge; P.hw.add(tag(cyl("__hw", along(e, h.eAx, h.eSide * 11), along(e, h.eAx, -h.eSide * 32), 5)));
    } else if (h.type === "tassello") {
      P.hw.add(tag(cyl("__wooddowel", along(h.w, h.eAx, h.eSide * 12), along(h.w, h.eAx, -h.eSide * 23), 8)));
    } else if (h.type === "reggipiano") {
      const w = h.w, s = h.dir.side;
      P.hw.add(tag(cyl("__hw", along(w, 0, -s * 10), along(w, 0, s * 9), 5)));
      P.hw.add(tag(box("__hw", [w[0] + s * 1, w[1] + 2, w[2] - 5], [w[0] + s * 9, w[1] + 3.5, w[2] + 5])));
    } else if (h.type === "guida") {
      const w = h.w, s = h.side < 0 ? 1 : -1;
      P.hw.add(tag(box("__metal", [w[0], w[1] - 6, w[2] - h.len], [w[0] + s * 13, w[1] + 22, w[2] - 4])));
    } else if (h.type === "maniglia") {
      const w = h.w, ia = h.ia, L2 = ia / 2 + 22;
      const a = h.vertical ? [w[0], w[1] - L2, w[2] + 32] : [w[0] - L2, w[1], w[2] + 32];
      const b = h.vertical ? [w[0], w[1] + L2, w[2] + 32] : [w[0] + L2, w[1], w[2] + 32];
      P.hw.add(tag(cyl("__hwdark", a, b, 12), true));
      const p1 = h.vertical ? [w[0], w[1] - ia / 2, w[2]] : [w[0] - ia / 2, w[1], w[2]];
      const p2 = h.vertical ? [w[0], w[1] + ia / 2, w[2]] : [w[0] + ia / 2, w[1], w[2]];
      P.hw.add(tag(cyl("__hwdark", p1, along(p1, 2, 32), 9), true));
      P.hw.add(tag(cyl("__hwdark", p2, along(p2, 2, 32), 9), true));
    }
  });
  /* fori e cave: dischi scuri sulla superficie, un InstancedMesh per pezzo */
  O.pieces.forEach(pc => {
    const P = R.pieces.get(String(pc.pk)); if (!P) return;
    const drills = pc.operations.filter(o => o.type === "drill" && o._w);
    if (drills.length) {
      const n = drills.reduce((s, o) => s + (o.through ? 2 : 1), 0);
      const im = new THREE.InstancedMesh(DISC, materialFor("__hole"), n);
      const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      let i = 0;
      const put = (w, ax, side, dia) => {
        const nrm = new THREE.Vector3(); nrm.setComponent(ax, side);
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
        v.set(w[0] * MM, w[1] * MM, w[2] * MM).addScaledVector(nrm, 0.25 * MM);
        sc.set(dia * MM, dia * MM, 1);
        M4.compose(v, q, sc); im.setMatrixAt(i++, M4);
      };
      drills.forEach(o => {
        put(o._w, o._ax, o._side, o.dia);
        if (o.through) { const w2 = o._w.slice(); w2[o._ax] -= o._side * pc.thickness; put(w2, o._ax, -o._side, o.dia); }
      });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.userData.holes = true;
      P.holes.add(im);
    }
    pc.operations.filter(o => o.type === "groove" && o._lo).forEach(o => {
      const m = box("__groove", o._lo, o._hi); m.castShadow = false; m.userData.own = false;
      P.holes.add(m);
    });
  });
}

/* --- stato → visibilità ------------------------------------------------ */
function applyState() {
  const st = R.st, sel = st.sel != null ? String(st.sel) : null;
  const hwMode = st.mode === "hw";
  for (const P of R.pieces.values()) {
    const isSel = sel === P.pk;
    const show = !(st.iso && sel && !isSel);
    P.g.visible = show;
    const ghost = (hwMode && !isSel) || (sel && !isSel && !st.iso);
    P.meshes.forEach(m => {
      const glass = m.userData.key === "__glass";
      m.material = ghost ? (glass ? GHOST() : GHOST()) : m.userData.base;
      m.castShadow = !ghost && !glass;
      const ln = m.userData.lines;
      if (ln) {
        ln.visible = st.edges || isSel;
        ln.material.color.setHex(isSel ? 0xd4af37 : (R.dark ? 0x0a0c09 : 0x2b2a26));
        ln.material.opacity = isSel ? 1 : ghost ? .25 : (st.mode === "real" ? .14 : .32);
      }
    });
    /* ferramenta: le maniglie sempre (si vedono da fuori); il resto quando
       lo si chiede, o attorno al pezzo selezionato */
    P.hw.children.forEach(m => {
      const rel = m.userData.rel || [];
      m.visible = m.userData.always || st.hw || hwMode || (!!sel && rel.indexOf(sel) >= 0);
    });
    P.holes.visible = st.holes || hwMode || isSel;
  }
  R.need = true; kick();
}

/* bersagli di esplosione e apertura, per pezzo */
function setTargets(boxesOrig) {
  const ex = explodeBoxes(boxesOrig, R.st.explode || 0);
  const first = new Map();
  boxesOrig.forEach((b, i) => { const k = String(b.pk); if (!first.has(k)) first.set(k, i); });
  /* profondità di ogni cassetto: sertarul iese cât jumătate din el */
  const grpD = {};
  boxesOrig.forEach(b => { if (b.grp && b.sub === "dbox") grpD[b.grp] = Math.max(grpD[b.grp] || 0, b.z1 - b.z0); });
  for (const P of R.pieces.values()) {
    const i = first.get(P.pk); if (i == null) continue;
    const a = boxesOrig[i], b = ex[i];
    P.tgt.ex = (b.x0 - a.x0) * MM; P.tgt.ey = (b.y0 - a.y0) * MM; P.tgt.ez = (b.z0 - a.z0) * MM;
    const open = R.st.open ? 1 : 0;
    P.tgt.ang = (open && P.pivot && P.sub === "door") ? (P.pivot.left ? -1 : 1) * 1.72 : 0;
    P.tgt.sl = (open && P.grp) ? (grpD[P.grp] || 400) * 0.55 * MM : 0;
  }
}

function updateBoundsAndLights(boxes) {
  const B = boundsOf(boxes);
  if (!B) return;
  R.full = B;
  const s = B.size;
  R.ground.position.set(B.cx, B.floor + 0.0005, B.cz); R.ground.scale.set(s * 6, s * 6, 1);
  /* l'impronta vera, un po' allargata */
  let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
  boxes.forEach(b => { if (b.kind === "w") return; pcOf(b).forEach(([x, z]) => { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); }); });
  R.contact.position.set(B.cx, B.floor + 0.001, B.cz);
  R.contact.scale.set((X1 - X0) * MM * 1.5 + .15, (Z1 - Z0) * MM * 1.9 + .15, 1);
  R.key.position.set(B.cx - s * 0.8, B.cy + s * 3.2, B.cz + s * 1.4);
  R.key.target.position.set(B.cx, B.cy, B.cz);
  R.fill.position.set(B.cx + s * 2.0, B.cy + s * 0.5, B.cz + s * 0.8);
  R.rim.position.set(B.cx - s * 0.5, B.cy + s * 1.5, B.cz - s * 2);
  const sc = R.key.shadow.camera;
  sc.left = -s * 1.9; sc.right = s * 1.9; sc.top = s * 1.9; sc.bottom = -s * 1.9;
  sc.near = s * 0.1; sc.far = s * 8; sc.updateProjectionMatrix();
}

/* un pezzo selezionato e isolato: la camera lo inquadra da solo */
function focusBounds() {
  const st = R.st;
  if (st.iso && st.sel != null) {
    const P = R.pieces.get(String(st.sel));
    if (P) {
      const B = boundsOf(P.boxes);
      if (B) return { cx: B.cx + P.tgt.ex, cy: B.cy + P.tgt.ey, cz: B.cz + P.tgt.ez, rad: Math.max(B.rad, .12), size: B.size };
    }
  }
  return R.full || { cx: 0, cy: 0, cz: 0, rad: .9, size: 1 };
}

const M4 = new THREE.Matrix4(), M4b = new THREE.Matrix4(), QI = new THREE.Quaternion(), V1 = new THREE.Vector3(), VS = new THREE.Vector3();
function step() {
  let moving = false;
  const f = (c, t, k) => { const d = t[k] - c[k]; if (Math.abs(d) > SNAP) { c[k] += d * EASE; moving = true; } else c[k] = t[k]; };
  for (const P of R.pieces.values()) {
    for (const m of P.meshes) {
      if (m.userData.prism) continue;
      const c = m.userData.cur, t = m.userData.tgt;
      for (const k of ["px", "py", "pz", "sx", "sy", "sz"]) f(c, t, k);
      applyRest(m, c);
    }
    for (const k of ["ex", "ey", "ez", "ang", "sl"]) f(P.cur, P.tgt, k);
    /* T(esplosione) · T(perno) · R(y) · T(−perno) · T(uscita cassetto) */
    const c = P.cur;
    M4.makeTranslation(c.ex, c.ey, c.ez + c.sl);
    if (c.ang && P.pivot) {
      const px = P.pivot.x * MM, pz = P.pivot.z * MM;
      M4b.makeTranslation(px, 0, pz); M4.multiply(M4b);
      M4b.makeRotationY(c.ang); M4.multiply(M4b);
      M4b.makeTranslation(-px, 0, -pz); M4.multiply(M4b);
    }
    P.g.matrix.copy(M4); P.g.matrixWorldNeedsUpdate = true;
  }
  return moving;
}

function stepCamera() {
  const V = (typeof VIEW === "object" && VIEW) || { yaw: .46, pitch: .3, zoom: 1 };
  const c = R.cam;
  const ty = V.yaw;
  const tp = Math.min(1.52, Math.max(-0.25, V.pitch));
  const tz = Math.min(8, Math.max(0.35, V.zoom));
  const B = focusBounds();
  let moving = false;
  const f = (a, b, k = 0.16) => { const d = b - a; if (Math.abs(d) > 1e-4) { moving = true; return a + d * k; } return b; };
  c.yaw = f(c.yaw, ty); c.pitch = f(c.pitch, tp); c.zoom = f(c.zoom, tz);
  c.cx = f(c.cx, B.cx, .14); c.cy = f(c.cy, B.cy, .14); c.cz = f(c.cz, B.cz, .14); c.rad = f(c.rad, B.rad || B.size, .14);
  const vf = R.camera.fov * Math.PI / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * R.camera.aspect);
  const d = c.rad / Math.sin(Math.min(vf, hf) / 2) * 1.04 / c.zoom;
  R.camera.position.set(
    c.cx + d * Math.sin(c.yaw) * Math.cos(c.pitch),
    c.cy + d * Math.sin(c.pitch),
    c.cz + d * Math.cos(c.yaw) * Math.cos(c.pitch));
  R.camera.lookAt(c.cx, c.cy, c.cz);
  const full = R.full || B;
  R.camera.near = Math.max(0.005, d - full.size * 2.2, 0.005);
  R.camera.far = d + full.size * 8;
  R.camera.updateProjectionMatrix();
  return moving;
}

function resize() {
  if (!R) return;
  const el = R.canvas, w = el.clientWidth || 1, h = el.clientHeight || 1;
  const dpr = Math.min(window.devicePixelRatio || 1,
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 1.25 : 2);
  R.renderer.setPixelRatio(dpr);
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h;
  R.camera.updateProjectionMatrix();
  R.need = true; kick();
}

function frame() {
  R.raf = 0;
  const a = step(), b = stepCamera();
  R.renderer.render(R.scene, R.camera);
  R.need = false;
  if (a || b) kick();
}
function kick() {
  if (!R) return;
  if (R.raf) cancelAnimationFrame(R.raf);
  R.raf = requestAnimationFrame(frame);
}

/* ============ 4. MODELLO: distinta + operazioni ====================== */
function computeModel(cfg, boxes, built) {
  let ops = null, G = null;
  try {
    if (typeof generateOperations === "function") {
      try { G = (typeof deriveCarcass === "function" && typeof carcassParams === "function") ? deriveCarcass(carcassParams(cfg, {})) : null; } catch (e) { G = null; }
      ops = generateOperations({ boxes, cfg, G });
    }
  } catch (e) { console.warn("ops:", e); ops = null; }
  const rows = (built && built.pieces) || [];
  const meta = {};
  if (ops) ops.pieces.forEach((p, i) => {
    const m = typeof matchOpsRow === "function" ? matchOpsRow(p, rows) : null;
    meta[String(p.pk)] = { n: p.n || i + 1, row: m ? m.row : null, exact: m ? m.exact : false, ops: p };
  });
  return { cfg, rows, ops, meta, G };
}

/* ============ 5. API PUBLIC ======================================== */
const GL3D = {
  ok: false,
  err: null,
  init(canvas) {
    try {
      const tmp = document.createElement("canvas");
      if (!tmp.getContext("webgl2")) {
        const one = tmp.getContext("webgl") || tmp.getContext("experimental-webgl");
        throw new Error(one ? "solo WebGL1, three ne vuole 2" : "WebGL assente");
      }
      boot(canvas);
      this.ok = true;
    } catch (e) {
      this.err = String((e && e.message) || e).slice(0, 70);
      console.warn("WebGL non disponibile, resta SVG:", e);
      this.ok = false;
    }
    return this.ok;
  },
  render(cfg, opts) {
    if (!this.ok) return;
    try {
      opts = opts || {};
      let built = null;
      let boxes = opts.boxes ? opts.boxes.slice() : (built = buildModule(cfg)).boxes;
      if (opts.explode != null) R.st.explode = opts.explode;
      boxes = setModel(boxes, cfg);
      const sig = JSON.stringify(boxes.map(b => [b.pk, b.role, Math.round(b.x0), Math.round(b.x1), Math.round(b.y0), Math.round(b.y1), Math.round(b.z0), Math.round(b.z1)])) + "|" + cfg.handles + "|" + cfg.shelfType;
      if (sig !== R.sig) {
        R.sig = sig;
        R.model = computeModel(cfg, boxes, built || { pieces: [] });
        buildHardware(R.model);
        if (R.st.sel != null && !R.pieces.has(String(R.st.sel))) { R.st.sel = null; R.st.iso = false; }
      }
      R.boxes = boxes;
      updateBoundsAndLights(boxes);
      setTargets(boxes);
      applyState();
      window.dispatchEvent(new CustomEvent("gl3d-model"));
    } catch (e) { console.warn("viewer3d:", e); }
  },
  /* stato di visualizzazione: { explode, open, mode:'real'|'hw', hw, holes, edges } */
  set(p) {
    if (!this.ok) return;
    Object.assign(R.st, p || {});
    if (R.boxes) setTargets(R.boxes);
    applyState();
  },
  get state() { return R ? Object.assign({}, R.st) : {}; },
  select(pk, iso) {
    if (!this.ok) return;
    R.st.sel = pk == null ? null : String(pk);
    R.st.iso = !!(iso && pk != null);
    applyState();
    window.dispatchEvent(new CustomEvent("gl3d-select", { detail: { pk: R.st.sel, iso: R.st.iso } }));
  },
  pick(clientX, clientY) {
    if (!this.ok) return null;
    const r = R.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, R.camera);
    const list = [];
    for (const P of R.pieces.values()) if (P.g.visible) P.meshes.forEach(m => { if (m.userData.key !== "__glass") list.push(m); });
    R.scene.updateMatrixWorld(true);
    const hit = rc.intersectObjects(list, false)[0];
    return hit ? hit.object.userData.pk : null;
  },
  /* la vista: 'front' | 'side' | 'top' | 'iso' | 'back' */
  view(name) {
    if (typeof VIEW !== "object") return;
    const V = { front: [0, .06], side: [Math.PI / 2, .06], back: [Math.PI, .08], top: [0, 1.5], iso: [.62, .38] }[name] || [.46, .3];
    VIEW.yaw = V[0]; VIEW.pitch = V[1]; VIEW.zoom = 1;
    R.need = true; kick();
  },
  model() { return R ? R.model : null; },
  snapshot() { if (!this.ok) return null; R.renderer.render(R.scene, R.camera); return R.canvas.toDataURL("image/png"); },
  theme() { if (!this.ok) return; R.dark = isDark(); R.scene.background = gradientBg(R.dark);
    R.ground.material.opacity = R.dark ? .34 : .16; R.contact.material.opacity = R.dark ? .8 : .5; applyState(); },
  touch() { if (this.ok) { R.need = true; kick(); } },
  resize,
};

window.GL3D = GL3D;
if (typeof window.__gl3dReady === "function") window.__gl3dReady();

export { THREE, MM, buildPrism, isRectPC, pcOf, matKeyOf, boundsOf, explodeBoxes };
