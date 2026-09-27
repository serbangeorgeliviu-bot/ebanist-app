/* =====================================================================
   Ebanist — scena 3D a site-ului (intro, hero, poveste)
   ---------------------------------------------------------------------
   Încărcat DOAR pe desktop cu WebGL și fără prefers-reduced-motion, după
   prima randare (import dinamic din main.js). Dulapul are cotele din
   distinta reală a aplicației: 1000 × 2200 × 600, PAL 19 mm, fronturi
   Nogal Victoria. Unitatea scenei: metrul (mm / 1000).
   ===================================================================== */
import * as THREE from "/site/vendor/three.module.min.js";

const MM = v => v / 1000;
const W = 1000, H = 2200, D = 600, T = 19;
const LASER = 0xff4d1a;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => 1 - Math.pow(1 - t, 3);                 // cubic out
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t, a, b) => clamp((t - a) / (b - a));


/* rotația care culcă o piesă: latura lungă pe X, lățimea pe Z, grosimea pe Y */
function flatQuat(sx, sy, sz) {
  const d = [sx, sy, sz], order = [0, 1, 2].sort((a, b) => d[b] - d[a]); // lung, lat, gros
  const world = [];
  world[order[0]] = new THREE.Vector3(1, 0, 0);
  world[order[1]] = new THREE.Vector3(0, 0, 1);
  world[order[2]] = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4().makeBasis(world[0], world[1], world[2]);
  if (m.determinant() < 0) { world[order[2]].negate(); m.makeBasis(world[0], world[1], world[2]); }
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/* ---------- materiale ---------- */
function woodTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = "#8a5c3c"; g.fillRect(0, 0, 512, 1024);
  /* fibra: linii verticale ușor ondulate, două tonuri */
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512, w = .6 + Math.random() * 2.2, a = .04 + Math.random() * .11;
    g.strokeStyle = Math.random() < .55 ? `rgba(40,24,14,${a})` : `rgba(160,110,70,${a * .8})`;
    g.lineWidth = w; g.beginPath();
    const amp = 2 + Math.random() * 6, f = .004 + Math.random() * .01, ph = Math.random() * 6;
    for (let y = 0; y <= 1024; y += 16) { const xx = x + Math.sin(y * f + ph) * amp; y ? g.lineTo(xx, y) : g.moveTo(xx, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function mats() {
  return {
    white: new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: .62, metalness: 0 }),
    board: new THREE.MeshStandardMaterial({ color: 0xe3ddd1, roughness: .7 }),
    hdf: new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: .8 }),
    walnut: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: .55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: .35, metalness: .8 }),
    edge: new THREE.LineBasicMaterial({ color: 0x2a2623, transparent: true, opacity: .55 }),
    laser: new THREE.LineBasicMaterial({ color: LASER }),
    laserGlow: new THREE.MeshBasicMaterial({ color: LASER, transparent: true, opacity: .9 })
  };
}

/* ---------- dulapul, piesă cu piesă ----------
   fiecare piesă: dimensiuni (sx, sy, sz în mm), poziția CENTRULUI în
   sistemul corpului (x de la fața laterală stângă, y de la pardoseală,
   z de la spate spre față), materialul și rolul. */
function wardrobeParts() {
  const inner = W - 2 * T;            // 962
  const P = [];
  const add = (role, sx, sy, sz, x, y, z, mat, board) => P.push({ role, sx, sy, sz, x, y, z, mat, board });
  add("sideL", T, H, D, T / 2, H / 2, D / 2, "white", 0);
  add("sideR", T, H, D, W - T / 2, H / 2, D / 2, "white", 1);
  add("bottom", inner, T, D, W / 2, 80 + T / 2, D / 2, "white");
  add("top", inner, T, D, W / 2, H - T / 2, D / 2, "white");
  add("plinth", inner, 80, T, W / 2, 40, D - 50 - T / 2, "white", 5);
  add("divider", T, 2082, 567, 491 + T / 2, 99 + 2082 / 2, 567 / 2, "white", 2);
  add("shelf", 469, T, 567, 491 + T + 469 / 2, 1180, 567 / 2, "white", 3);
  add("shelf", 469, T, 567, 491 + T + 469 / 2, 1640, 567 / 2, "white", 4);
  add("back", 978, 2098, 3, W / 2, 91 + 2098 / 2, 1.5, "hdf");
  for (let i = 0; i < 3; i++) add("drawer", 464, 200, T, T + 3 + 464 / 2, 110 + 105 + i * 215, 540, "walnut");
  add("doorL", 495, 2114, T, 3 + 495 / 2, 83 + 2114 / 2, D + 2 + T / 2, "walnut");
  add("doorR", 495, 2114, T, W - 3 - 495 / 2, 83 + 2114 / 2, D + 2 + T / 2, "walnut");
  return P;
}

function buildWardrobe(M, { edges = true } = {}) {
  const group = new THREE.Group(); const parts = [];
  for (const p of wardrobeParts()) {
    const geo = new THREE.BoxGeometry(MM(p.sx), MM(p.sy), MM(p.sz));
    const mesh = new THREE.Mesh(geo, M[p.mat]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), M.edge); mesh.add(e); }
    /* corpul centrat pe X și Z, pe pardoseală în Y */
    mesh.position.set(MM(p.x - W / 2), MM(p.y), MM(p.z - D / 2));
    mesh.userData = { ...p, home: mesh.position.clone(), homeQ: mesh.quaternion.clone() };
    group.add(mesh); parts.push(mesh);
  }
  /* bara de haine, în secțiunea stângă */
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, MM(467), 16), M.steel);
  rail.rotation.z = Math.PI / 2; rail.position.set(MM(T + 3 + 467 / 2 - W / 2), MM(1930), MM(300 - D / 2));
  rail.userData = { role: "rail", home: rail.position.clone(), homeQ: rail.quaternion.clone() };
  group.add(rail); parts.push(rail);
  return { group, parts };
}

/* deschide o ușă în jurul balamalei (latura exterioară) */
function openDoor(mesh, ang) {
  const u = mesh.userData, left = u.role === "doorL";
  const hinge = u.home.clone(); hinge.x += (left ? -1 : 1) * MM(u.sx / 2);
  const off = u.home.clone().sub(hinge).applyAxisAngle(new THREE.Vector3(0, 1, 0), left ? -ang : ang);
  mesh.position.copy(hinge.add(off));
  mesh.rotation.y = left ? -ang : ang;
}

function stage(canvas, { shadows = true, fov = 32 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, .05, 60);
  /* lumină laterală naturală, caldă, plus o umplere rece și slabă */
  const key = new THREE.DirectionalLight(0xffe2c4, 2.6); key.position.set(-3.2, 3.6, 2.2);
  key.castShadow = shadows; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: .5, far: 12 });
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xdfe3ea, 0x3a2c20, .95));
  const fill = new THREE.DirectionalLight(0xfff1e0, .55); fill.position.set(.5, 1.6, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xa9c1ff, .5); rim.position.set(3, 2, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .32 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  function resize() {
    const r = canvas.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  return { renderer, scene, camera, key, floor, resize, dispose() { ro.disconnect(); renderer.dispose(); } };
}

/* proiecție a unui punct 3D în pixeli CSS ai canvas-ului */
function project(v, camera, canvas) {
  const p = v.clone().project(camera), r = canvas.getBoundingClientRect();
  return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height, vis: p.z < 1 };
}

/* linii de cotă 3D: linia, extensiile și săgețile, în culoarea laserului */
function dimLine(a, b, off, M) {
  const g = new THREE.Group();
  const A = a.clone().add(off), B = b.clone().add(off);
  const pts = [a, A, A, B, B, b];
  const dir = B.clone().sub(A).normalize().multiplyScalar(.04), n = off.clone().normalize().multiplyScalar(.02);
  pts.push(A, A.clone().add(dir).add(n), A, A.clone().add(dir).sub(n), B, B.clone().sub(dir).add(n), B, B.clone().sub(dir).sub(n));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.LineSegments(geo, M.laser.clone()); line.material.transparent = true;
  g.add(line); g.userData.mid = A.clone().lerp(B, .5); g.userData.line = line;
  return g;
}
function wardrobeDims(M) {
  const x0 = -MM(W / 2), x1 = MM(W / 2), z1 = MM(D / 2) + MM(T + 2), z0 = -MM(D / 2), y1 = MM(H);
  return [
    dimLine(new THREE.Vector3(x0, 0, z1), new THREE.Vector3(x1, 0, z1), new THREE.Vector3(0, 0, .22), M),   // L
    dimLine(new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x1, y1, z1), new THREE.Vector3(.2, 0, .06), M),  // H
    dimLine(new THREE.Vector3(x1, y1, z0), new THREE.Vector3(x1, y1, z1), new THREE.Vector3(.2, .06, 0), M) // P
  ];
}

/* =====================================================================
   INTRO — panoul brut, laserul, piesele, asamblarea (max 4 s)
   ===================================================================== */
/* dispunerea reală pe panoul de 2800 × 2070: bucățile care pleacă din
   primul panou al planului de tăiere (laturi, despărțitor, polițe, soclu,
   laturi de sertar) */
const BOARD = { l: 2800, w: 2070 };
const LAYOUT = [
  { i: 0, x: 0, y: 0, l: 2200, w: 600 },   { i: 3, x: 2204, y: 0, l: 469, w: 567 },
  { i: 1, x: 0, y: 604, l: 2200, w: 600 }, { i: 4, x: 2204, y: 604, l: 469, w: 567 },
  { i: 2, x: 0, y: 1208, l: 2082, w: 567 },
  { i: 5, x: 0, y: 1779, l: 962, w: 80 }
];
const CUTS = [ // [x0,y0,x1,y1] în mm pe panou, în ordinea laserului
  [0, 602, 2800, 602], [0, 1206, 2800, 1206], [0, 1777, 2800, 1777],
  [2202, 0, 2202, 1206], [2084, 1206, 2084, 1777], [964, 1777, 964, 1861], [0, 1861, 2800, 1861]
];

export function createIntro({ canvas, labelsEl, names = [], onTitle, onDone }) {
  const S = stage(canvas, { shadows: true, fov: 30 });
  const M = mats();
  const { scene, camera, renderer } = S;
  const { group, parts } = buildWardrobe(M);
  scene.add(group);
  const byBoard = new Map(); parts.forEach(m => { if (m.userData.board !== undefined) byBoard.set(m.userData.board, m); });

  /* panoul întreg, culcat pe masă: centrat în origine, pe XZ */
  const bx = x => MM(x - BOARD.l / 2), bz = y => MM(y - BOARD.w / 2);
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(MM(BOARD.l), MM(T), MM(BOARD.w)), M.board);
  boardMesh.position.y = MM(T / 2); boardMesh.receiveShadow = true; boardMesh.castShadow = true;
  const boardG = new THREE.Group(); boardG.add(boardMesh); scene.add(boardG);

  /* piesele din panou: pleacă de pe panou (poziția de start) spre corp */
  const flat = [];
  for (const L of LAYOUT) {
    const m = byBoard.get(L.i); if (!m) continue;
    const start = new THREE.Vector3(bx(L.x + L.l / 2), MM(T / 2) + .001, bz(L.y + L.w / 2));
    /* orientarea „culcat": latura lungă a piesei pe X, lățimea pe Z */
    const d = m.userData, dims = [d.sx, d.sy, d.sz];
    const q = flatQuat(d.sx, d.sy, d.sz);
    flat.push({ m, start, startQ: q, L, dims });
  }
  const others = parts.filter(m => !flat.find(f => f.m === m));
  const placeGroup = new THREE.Group(); scene.add(placeGroup);

  /* laserul: o linie luminoasă care parcurge tăieturile */
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, .003, .006), M.laserGlow); beam.visible = false; scene.add(beam);
  const spark = new THREE.PointLight(LASER, 0, .8); scene.add(spark);
  const cutLines = CUTS.map(([x0, y0, x1, y1]) => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(bx(x0), MM(T) + .002, bz(y0)), new THREE.Vector3(bx(x1), MM(T) + .002, bz(y1))]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x2a2623, transparent: true, opacity: 0 })); scene.add(l); return l;
  });

  const dims = wardrobeDims(M); dims.forEach(d => { d.visible = false; group.add(d); });

  /* etichetele mono ale pieselor */
  const labels = flat.map((f, k) => {
    const s = document.createElement("span");
    s.textContent = `${names[f.L.i] || f.m.userData.role.toUpperCase()} ${Math.max(f.L.l, f.L.w)}×${Math.min(f.L.l, f.L.w)}×${T}`;
    labelsEl.appendChild(s); return s;
  });

  const T_TOTAL = 4.0;
  let t0 = null, raf = 0, finished = false, titled = false;
  const endPos = new THREE.Vector3(), camFrom = new THREE.Vector3(.2, 4.1, 3.3), camTo = new THREE.Vector3();
  const aim = new THREE.Vector3();
  function layout() {
    /* corpul final stă în dreapta cadrului, ca în hero */
    const wide = S.camera.aspect > 1.1;
    endPos.set(wide ? .78 : 0, 0, 0);
    camTo.set(wide ? -1.3 : -1.6, 1.55, wide ? 6.6 : 8.2);
  }
  layout();

  function frame(now) {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    /* 0 → 0.5: panoul apare din întuneric, lumină laterală */
    const a = ease(seg(t, 0, .6));
    boardMesh.material.opacity = a; boardMesh.material.transparent = a < 1;
    S.key.intensity = 2.6 * a;
    /* 0.5 → 1.7: laserul taie, linie după linie */
    const cutT = seg(t, .5, 1.7), nC = CUTS.length, ci = Math.min(nC - 1, Math.floor(cutT * nC)), cf = cutT * nC - ci;
    beam.visible = t > .5 && t < 1.72;
    if (beam.visible) {
      const [x0, y0, x1, y1] = CUTS[ci];
      const px = x0 + (x1 - x0) * cf, py = y0 + (y1 - y0) * cf;
      const len = Math.hypot(x1 - x0, y1 - y0) * cf;
      beam.scale.x = Math.max(.001, MM(len));
      beam.position.set(bx((x0 + px) / 2), MM(T) + .003, bz((y0 + py) / 2));
      beam.rotation.y = -Math.atan2(y1 - y0, x1 - x0);
      spark.position.set(bx(px), MM(T) + .05, bz(py)); spark.intensity = 1.6 + Math.random() * .8;
    } else spark.intensity = 0;
    cutLines.forEach((l, k) => { l.material.opacity = k < ci || (k === ci && cf > .98) || cutT >= 1 ? .8 : 0; });
    /* 1.6: piesele se desprind — panoul dispare, piesele rămân */
    const lift = ease(seg(t, 1.6, 1.9));
    boardMesh.visible = t < 1.62;
    cutLines.forEach(l => { l.visible = t < 1.62; });
    /* 1.7 → 3.0: piesele zboară și se asamblează */
    const fly = easeIO(seg(t, 1.8, 3.0));
    for (const f of flat) {
      const target = f.m.userData.home.clone().add(endPos);
      const up = f.start.clone(); up.y += .06 * lift;
      const k = clamp(fly * 1.08 - (f.L.i % 5) * .02);
      const mid = up.clone().lerp(target, k); mid.y += Math.sin(k * Math.PI) * .45;
      f.m.position.copy(k <= 0 ? up : mid);
      f.m.quaternion.copy(f.startQ).slerp(f.m.userData.homeQ, k);
    }
    /* restul pieselor (cer, bază, spate, uși) apar în jurul lor */
    const grow = ease(seg(t, 2.5, 3.2));
    for (const m of others) {
      m.visible = t > 2.45;
      m.position.copy(m.userData.home).add(endPos);
      m.position.y += (1 - grow) * .25;
      m.scale.setScalar(.001 + .999 * grow);
    }
    group.position.set(0, 0, 0);
    /* etichetele: vizibile cât piesele sunt pe panou */
    flat.forEach((f, k) => {
      const on = t > 1.75 + k * .03 && t < 2.2;
      labels[k].classList.toggle("on", on);
      if (on) { const p = project(f.m.position, camera, canvas); labels[k].style.left = p.x + "px"; labels[k].style.top = p.y + "px"; }
    });
    /* 2.9 → 4.0: camera se retrage, cotele se desenează, titlul */
    const pull = easeIO(seg(t, 2.6, 3.9));
    camera.position.copy(camFrom).lerp(camTo, pull);
    aim.set(0, 0, 0).lerp(new THREE.Vector3(endPos.x - .55, 1.05, 0), pull);
    camera.lookAt(aim);
    const dimT = seg(t, 3.1, 3.8);
    dims.forEach(d => { d.visible = dimT > 0; d.position.copy(endPos); d.userData.line.material.opacity = dimT; });
    if (!titled && t > 3.0) { titled = true; onTitle && onTitle(); }
    renderer.render(scene, camera);
    if (t < T_TOTAL) raf = requestAnimationFrame(frame);
    else finish();
  }
  function finish() {
    if (finished) return; finished = true;
    cancelAnimationFrame(raf);
    labels.forEach(l => l.remove());
    onDone && onDone();
    setTimeout(() => S.dispose(), 900);
  }
  raf = requestAnimationFrame(frame);
  return { skip() { if (!titled) { onTitle && onTitle(); } finish(); } };
}

/* =====================================================================
   HERO — corpul se rotește ușor sub deget / cursor
   ===================================================================== */
export function createHero({ canvas, dimsEl, stageEl }) {
  const S = stage(canvas, { shadows: true, fov: 26 });
  const M = mats(); const { scene, camera, renderer } = S;
  const { group, parts } = buildWardrobe(M);
  scene.add(group);
  const doorR = parts.find(m => m.userData.role === "doorR");
  const dims = wardrobeDims(M); dims.forEach(d => group.add(d));
  const tags = ["L 1000", "H 2200", "P 600"].map(txt => { const s = document.createElement("span"); s.textContent = txt; dimsEl.appendChild(s); return s; });
  camera.position.set(-2.0, 1.75, 5.3); const look = new THREE.Vector3(0, 1.05, 0);
  let doorA = 0, doorT = 1.95;
  let tx = .38, ty = 0, rx = .38, ry = 0, visible = true, raf = 0, dragging = false, lastX = 0, lastY = 0, idle = 0;
  const onMove = e => {
    if (dragging) { const dx = e.clientX - lastX, dy = e.clientY - lastY; tx += dx * .006; ty = clamp(ty + dy * .002, -.12, .18); lastX = e.clientX; lastY = e.clientY; idle = 0; return; }
    if (e.pointerType !== "mouse") return;
    const r = stageEl.getBoundingClientRect();
    tx = .38 + ((e.clientX - r.left) / r.width - .5) * .7; ty = ((e.clientY - r.top) / r.height - .5) * .12; idle = 0;
  };
  stageEl.addEventListener("pointerdown", e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  addEventListener("pointerup", () => { dragging = false; });
  addEventListener("pointermove", onMove, { passive: true });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(stageEl);
  function loop() {
    raf = 0; if (!visible) return;
    idle += 1 / 60; if (idle > 4 && !dragging) tx += .0015;
    rx += (tx - rx) * .06; ry += (ty - ry) * .06;
    group.rotation.y = rx; group.rotation.x = ry * .3;
    doorA += (doorT - doorA) * .04; openDoor(doorR, doorA);
    camera.lookAt(look);
    renderer.render(scene, camera);
    dims.forEach((d, k) => { const p = project(d.userData.mid.clone().applyMatrix4(group.matrixWorld), camera, canvas); tags[k].style.left = p.x + "px"; tags[k].style.top = p.y + "px"; });
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  stageEl.classList.add("gl");
  return { snapshot: () => { renderer.render(scene, camera); return canvas.toDataURL("image/png"); } };
}

/* =====================================================================
   POVESTEA — a) parametri  b) explodat  c) piesele se culcă
   progress: 0 → 1 pe toată secțiunea; etapele d, e sunt în DOM (SVG)
   ===================================================================== */
export function createStory({ canvas, onParams }) {
  const S = stage(canvas, { shadows: true, fov: 28 });
  const M = mats(); const { scene, camera, renderer } = S;
  let { group, parts } = buildWardrobe(M);
  scene.add(group);
  const dims = wardrobeDims(M); dims.forEach(d => group.add(d));
  /* ținta „culcat": piesele pe masă, în grilă, ca în lista de debitare */
  const flatTargets = []; let cx = -2.4, cz = -1.1, rowH = 0;
  const sorted = parts.slice().sort((a, b) => (b.userData.sy * b.userData.sx || 0) - (a.userData.sy * a.userData.sx || 0));
  for (const m of sorted) {
    const d = m.userData; if (!d.sx) { flatTargets.push({ m, p: d.home.clone(), q: d.homeQ.clone() }); continue; }
    const dimsA = [d.sx, d.sy, d.sz].sort((a, b) => b - a), L = MM(dimsA[0]), Wd = MM(dimsA[1]);
    if (cx + L > 2.4) { cx = -2.4; cz += rowH + .06; rowH = 0; }
    const q = flatQuat(d.sx, d.sy, d.sz);
    flatTargets.push({ m, p: new THREE.Vector3(cx + L / 2, MM(T / 2), cz + Wd / 2), q });
    cx += L + .06; rowH = Math.max(rowH, Wd);
  }
  let progress = 0, visible = false, raf = 0, dirty = true;
  const bb = new THREE.Box3(); flatTargets.forEach(f => bb.expandByPoint(f.p));
  const bc = bb.getCenter(new THREE.Vector3()), bs = bb.getSize(new THREE.Vector3());
  const camA = new THREE.Vector3(-2.2, 1.9, 5.4), lookA = new THREE.Vector3(0, 1.0, 0);
  const lookC = bc.clone(), camC = new THREE.Vector3();
  function fitFlat() {
    const vfov = camera.fov * Math.PI / 180, need = Math.max(bs.z + 1.3, (bs.x + 1.2) / camera.aspect) / 2 / Math.tan(vfov / 2);
    camC.set(bc.x, need + .2, bc.z + need * .28);
  }
  fitFlat(); addEventListener("resize", () => { fitFlat(); dirty = true; });
  let lastW = 1000, lastH = 2200, lastD = 600;
  function apply() {
    const p = progress;
    /* a) 0 → .2: cotele se schimbă live 800→1000, 2000→2200, 560→600 */
    const pa = easeIO(seg(p, 0, .16));
    const w = Math.round(800 + 200 * pa), h = Math.round(2000 + 200 * pa), d = Math.round(560 + 40 * pa);
    if (w !== lastW || h !== lastH || d !== lastD) { lastW = w; lastH = h; lastD = d; onParams && onParams(w, h, d); }
    group.scale.set(w / W, h / H, d / D);
    /* b) .2 → .4: vederea explodată */
    const pb = easeIO(seg(p, .2, .32)) * (1 - easeIO(seg(p, .38, .46)));
    /* c) .4 → .6: piesele se culcă pe masă */
    const pc = easeIO(seg(p, .4, .49));
    for (const ft of flatTargets) {
      const m = ft.m, u = m.userData, home = u.home;
      const ex = new THREE.Vector3(home.x * 2.6, home.y * 1.12 + (u.role === "top" ? .4 : 0) - (u.role === "bottom" || u.role === "plinth" ? .08 : 0), home.z * 3 + (u.role && u.role.startsWith("door") ? 1.0 : 0) + (u.role === "drawer" ? .55 : 0) - (u.role === "back" ? .6 : 0));
      const pos = home.clone().lerp(ex, pb).lerp(ft.p.clone().divide(group.scale), pc);
      m.position.copy(pos);
      m.quaternion.copy(u.homeQ).slerp(ft.q, pc);
    }
    dims.forEach(dd => { dd.visible = pb < .05 && pc < .05; });
    camera.position.copy(camA).lerp(camC, pc);
    camera.lookAt(lookA.clone().lerp(lookC, pc));
    group.rotation.y = (.38 - .5 * seg(p, 0, .34)) * (1 - pc);
    renderer.render(scene, camera);
  }
  function loop() { raf = 0; if (!visible) return; if (dirty) { apply(); dirty = false; } raf = requestAnimationFrame(loop); }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
  return { set(p) { if (p !== progress) { progress = p; dirty = true; } } };
}
