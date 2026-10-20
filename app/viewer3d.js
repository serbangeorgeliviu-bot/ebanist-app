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
import { THREE, MM, pcOf, isRectPC, buildPrism, buildVPrism, buildPrism3, boundsOf, matKeyOf, explodeBoxes } from "./geo3d.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

/* ============ 1. FIBRA LEMNOASĂ (procedurală, zero fișiere) ========== */
/* Un factor de luminanță în jurul lui 1, nu o culoare: culoarea o dă
   materialul. Așa aceeași textură servește stejarul și nucul. Fibra
   curge pe verticală (axa v a texturii). */
function makeWoodTexture(seed = 1, size = 1024) {
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
  /* pori: dungi scurte pe direcția fibrei, ca la stejarul real */
  const pores = new Float32Array(size * size), nP = Math.round(size * size / 120);
  for (let i = 0; i < nP; i++) {
    const px = Math.floor(rnd() * size), py = Math.floor(rnd() * size), ln = 4 + Math.floor(rnd() * 16), st = 0.08 + rnd() * 0.2;
    for (let j = 0; j < ln; j++) { const k = ((py + j) % size) * size + px, a = st * Math.sin(Math.PI * (j + 0.5) / ln); if (a > pores[k]) pores[k] = a; }
  }
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      /* spațiere neregulată: u e deformat lent, ca să nu apară dungi egale */
      const uu = u + 0.018 * Math.sin(u * 6.283 * 3 + ph[0]) + 0.01 * Math.sin(u * 6.283 * 9 + ph[1] + v * 6.283);
      let w = uu * 20 * 6.283;
      for (let i = 0; i < 5; i++) w += amp[i] * 2.4 * Math.sin(v * 6.283 * fr[i] + ph[i] + u * 3.1 * (i + 1));
      const A = 0.62 + 0.38 * Math.sin(u * 6.283 * 2.3 + v * 6.283 + ph[2]);
      const ring = A * Math.pow(0.5 + 0.5 * Math.sin(w), 2.6);
      const fine = 0.5 + 0.5 * Math.sin(u * 6.283 * 180 + Math.sin(v * 6.283 * 3 + u * 11) * 1.4);
      let b = 0; for (const [c, wd, k] of band) { const du = Math.min(Math.abs(u - c), 1 - Math.abs(u - c)); if (du < wd) b += k * (1 - du / wd); }
      const n = rnd();
      let f = 0.97 - 0.24 * ring - 0.05 * fine - b * 1.8 + (n - 0.5) * 0.04 - pores[y * size + x];
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


/* Uni melaminic: nu e plat, are un grăunte fin izotrop (aproape invizibil
   de aproape, dar rupe aspectul de plastic neted). Factor de luminanță ~1. */
function makeFineTexture(seed = 3, size = 256) {
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  let s = seed * 7919 + 104729;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const base = new Float32Array(size * size);
  for (let i = 0; i < base.length; i++) base[i] = rnd();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    /* două scări: zgomot pe pixel + o ondulare largă (petele plăcii) */
    const a = base[y * size + x], b = base[((y + 1) % size) * size + (x + 1) % size];
    const m = 0.5 + 0.5 * Math.sin(x / size * 6.283 * 3 + Math.sin(y / size * 6.283 * 2) * 1.7);
    const f = 0.965 + 0.02 * (a + b - 1) + 0.014 * m;
    const k = (y * size + x) * 4, c = Math.round(Math.max(0, Math.min(1, f)) * 255);
    d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  return tex;
}


/* ============ 1b. OCLUZIE AMBIENTALĂ ÎN SPAȚIUL ECRANULUI (SSAO) =======
   Trei treceri la jumătate de rezoluție: (1) normale + adâncime într-o țintă
   cu textură de adâncime, (2) ocluzia (hemisferă orientată după normală,
   12 eșantioane rotite cu un zgomot 4×4), (3) estompare 4×4. Materialele
   panourilor citesc rezultatul din shader (uAoTex) și îl înmulțesc cu lumina.
   Fără WebGL2 sau la eroare se oprește singur și rămâne ocluzia simulată. */
const SSAO = {
  enabled: true, rtN: null, rtA: null, rtB: null, quad: null, scene: null, cam: null, aoMat: null, blurMat: null, nrm: null,
  U: { uAoTex: { value: null }, uAoInv: { value: new THREE.Vector2(1, 1) }, uAoOn: { value: 0 } },
};
const SSAO_VERT = "varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const SSAO_FRAG = `
uniform sampler2D tNormal; uniform sampler2D tDepth; uniform sampler2D tNoise;
uniform mat4 uProj; uniform mat4 uProjInv; uniform vec2 uNoiseScale; uniform float uRadius; uniform float uBias;
uniform vec3 uKernel[SAMPLES];
varying vec2 vUv;
vec3 viewPos(vec2 uv, float d){ vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv, d);
  vec3 N = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
  vec3 rv = normalize(texture2D(tNoise, vUv * uNoiseScale).xyz * 2.0 - 1.0);
  vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T); mat3 TBN = mat3(T, B, N);
  float occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    vec3 sp = P + TBN * uKernel[i] * uRadius;
    vec4 o = uProj * vec4(sp, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;
    float sd = texture2D(tDepth, suv).x;
    vec3 sP = viewPos(suv, sd);
    float rc = smoothstep(0.0, 1.0, uRadius / max(abs(P.z - sP.z), 1e-4));
    occ += (sP.z >= sp.z + uBias && sd < 0.99999 ? 1.0 : 0.0) * rc;
  }
  gl_FragColor = vec4(vec3(1.0 - occ / float(SAMPLES)), 1.0);
}`;
const SSAO_BLUR = `
uniform sampler2D tAO; uniform vec2 uTexel; varying vec2 vUv;
void main(){ float s = 0.0; for (int x = -2; x < 2; x++) for (int y = -2; y < 2; y++) s += texture2D(tAO, vUv + (vec2(float(x), float(y)) + 0.5) * uTexel).r; gl_FragColor = vec4(vec3(s / 16.0), 1.0); }`;

function ssaoSetup(w2, h2) {
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4, N = lowMem ? 8 : 12;
  if (!SSAO.rtN) {
    const dt = new THREE.DepthTexture(w2, h2); dt.type = THREE.UnsignedIntType;
    SSAO.rtN = new THREE.WebGLRenderTarget(w2, h2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: dt, depthBuffer: true });
    const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    SSAO.rtA = new THREE.WebGLRenderTarget(w2, h2, lin); SSAO.rtB = new THREE.WebGLRenderTarget(w2, h2, lin);
    SSAO.nrm = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    /* nucleu: eșantioane în emisfera +z, mai dese aproape de centru; zgomot de rotație 4×4 */
    let sd = 5; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    const kern = [];
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 0.95 + 0.05).normalize();
      const t = i / N; v.multiplyScalar(0.12 + 0.88 * t * t); kern.push(v);
    }
    const nd = new Uint8Array(16 * 4);
    for (let i = 0; i < 16; i++) { const a = rnd() * 6.2832; nd[i * 4] = Math.round((Math.cos(a) * .5 + .5) * 255); nd[i * 4 + 1] = Math.round((Math.sin(a) * .5 + .5) * 255); nd[i * 4 + 2] = 128; nd[i * 4 + 3] = 255; }
    const noise = new THREE.DataTexture(nd, 4, 4, THREE.RGBAFormat); noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
    noise.minFilter = noise.magFilter = THREE.NearestFilter; noise.needsUpdate = true;
    SSAO.aoMat = new THREE.ShaderMaterial({
      defines: { SAMPLES: N }, vertexShader: SSAO_VERT, fragmentShader: SSAO_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tNormal: { value: SSAO.rtN.texture }, tDepth: { value: dt }, tNoise: { value: noise },
        uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uNoiseScale: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 0.1 }, uBias: { value: 0.004 }, uKernel: { value: kern } },
    });
    SSAO.blurMat = new THREE.ShaderMaterial({ vertexShader: SSAO_VERT, fragmentShader: SSAO_BLUR, depthTest: false, depthWrite: false,
      uniforms: { tAO: { value: SSAO.rtA.texture }, uTexel: { value: new THREE.Vector2(1, 1) } } });
    SSAO.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), SSAO.aoMat); SSAO.quad.frustumCulled = false;
    SSAO.scene = new THREE.Scene(); SSAO.scene.add(SSAO.quad); SSAO.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  if (SSAO.rtN.width !== w2 || SSAO.rtN.height !== h2) { SSAO.rtN.setSize(w2, h2); SSAO.rtA.setSize(w2, h2); SSAO.rtB.setSize(w2, h2); }
}
/* ce intră în ocluzie: pereții și panourile opace; nu liniile, spriturile,
   transparentele (sticlă, fantome), găurile, umbra de contact și solul */
function ssaoSkip(o) {
  if (!o.visible) return false;
  if (o.isLine || o.isSprite || o.isPoints) return true;
  if (o === R.ground || o === R.contact) return true;
  const m = o.material;
  return !!(m && (m.transparent || m.isMeshBasicMaterial || m.isShadowMaterial));
}
function ssaoPass() {
  const r = R.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2());
  const w2 = Math.max(2, Math.ceil(sz.x / 2)), h2 = Math.max(2, Math.ceil(sz.y / 2));
  ssaoSetup(w2, h2);
  const hid = []; R.scene.traverse(o => { if (ssaoSkip(o)) { hid.push(o); o.visible = false; } });
  const bg = R.scene.background, ov = R.scene.overrideMaterial, au = r.shadowMap.autoUpdate, prev = r.getRenderTarget();
  R.scene.background = null; R.scene.overrideMaterial = SSAO.nrm; r.shadowMap.autoUpdate = false;
  r.setRenderTarget(SSAO.rtN); r.setClearColor(0x000000, 1); r.clear(); r.render(R.scene, R.camera);
  R.scene.background = bg; R.scene.overrideMaterial = ov; r.shadowMap.autoUpdate = au;
  hid.forEach(o => { o.visible = true; });
  const u = SSAO.aoMat.uniforms;
  u.uProj.value.copy(R.camera.projectionMatrix); u.uProjInv.value.copy(R.camera.projectionMatrixInverse);
  u.uNoiseScale.value.set(w2 / 4, h2 / 4);
  const size = (R.full && R.full.size) || 1; u.uRadius.value = Math.max(0.03, Math.min(0.14, size * 0.05));
  SSAO.quad.material = SSAO.aoMat; r.setRenderTarget(SSAO.rtA); r.render(SSAO.scene, SSAO.cam);
  SSAO.blurMat.uniforms.uTexel.value.set(1 / w2, 1 / h2);
  SSAO.quad.material = SSAO.blurMat; r.setRenderTarget(SSAO.rtB); r.render(SSAO.scene, SSAO.cam);
  r.setRenderTarget(prev);
  SSAO.U.uAoTex.value = SSAO.rtB.texture; SSAO.U.uAoInv.value.set(1 / sz.x, 1 / sz.y); SSAO.U.uAoOn.value = 1;
}
function renderScene() {
  if (SSAO.enabled) {
    try { ssaoPass(); }
    catch (e) { console.warn("SSAO oprit:", e); SSAO.enabled = false; SSAO.U.uAoOn.value = 0; R.renderer.setRenderTarget(null); }
  } else SSAO.U.uAoOn.value = 0;
  R.renderer.render(R.scene, R.camera);
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

let WOOD = null, FINE = null;
const MAT_CACHE = new Map();

/* Proiecția triplanară în coordonatele de REPAUS ale piesei: `uRest` e
   matricea locală a mesh-ului (poziție × dimensiune), actualizată înainte de
   fiecare desen. Fețele laterale și frontale au fibra pe verticală, cele
   orizontale de-a lungul lui x — cum se taie de fapt un corp. */
function triplanar(m, o) {
  o = o || {};
  const sc = o.scale || [1 / 0.42, 1 / 1.9], bump = o.bump || 0, rough = o.rough || 0, edge = o.edge === undefined ? 1 : o.edge;
  m.userData.tp = 1;
  m.onBeforeCompile = function (sh) {
    sh.uniforms.uRest = { value: new THREE.Matrix4() };
    sh.uniforms.uEbScale = { value: new THREE.Vector2(sc[0], sc[1]) };
    sh.uniforms.uEbOff = { value: new THREE.Vector2(0, 0) };
    sh.uniforms.uEbRect = { value: 1 };
    sh.uniforms.uEbLo = { value: new THREE.Vector3() };
    sh.uniforms.uEbHi = { value: new THREE.Vector3() };
    sh.uniforms.uEbOn = { value: 0 };
    sh.uniforms.uAoTex = SSAO.U.uAoTex; sh.uniforms.uAoInv = SSAO.U.uAoInv; sh.uniforms.uAoOn = SSAO.U.uAoOn;
    this.userData.shader = sh;
    sh.vertexShader = "uniform mat4 uRest;\nvarying vec3 vEbP;\nvarying vec3 vEbN;\nvarying vec3 vEbL;\nvarying vec3 vEbS;\nvarying vec3 vEbAx;\nvarying vec3 vEbAy;\nvarying vec3 vEbAz;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vEbP = (uRest * vec4(transformed,1.0)).xyz;
       vEbN = normalize(mat3(uRest) * objectNormal);
       vEbL = transformed;
       vEbS = vec3(length(uRest[0].xyz), length(uRest[1].xyz), length(uRest[2].xyz));
       vEbAx = normalize(mat3(modelViewMatrix) * vec3(1.,0.,0.));
       vEbAy = normalize(mat3(modelViewMatrix) * vec3(0.,1.,0.));
       vEbAz = normalize(mat3(modelViewMatrix) * vec3(0.,0.,1.));`);
    sh.fragmentShader = "uniform vec2 uEbScale;\nuniform vec2 uEbOff;\nuniform float uEbRect;\nuniform vec3 uEbLo;\nuniform vec3 uEbHi;\nuniform float uEbOn;\nuniform sampler2D uAoTex;\nuniform vec2 uAoInv;\nuniform float uAoOn;\nvarying vec3 vEbP;\nvarying vec3 vEbN;\nvarying vec3 vEbL;\nvarying vec3 vEbS;\nvarying vec3 vEbAx;\nvarying vec3 vEbAy;\nvarying vec3 vEbAz;\nfloat ebT = 0.9;\nfloat ebAO = 1.0;\n" + sh.fragmentShader
    .replace("#include <map_fragment>",
      `#ifdef USE_MAP
        vec3 ebA = abs(vEbN); vec2 ebUV;
        if (ebA.x > ebA.y && ebA.x > ebA.z) ebUV = vec2(vEbP.z, vEbP.y);
        else if (ebA.y > ebA.z) ebUV = vec2(vEbP.z, vEbP.x);
        else ebUV = vec2(vEbP.x, vEbP.y);
        vec4 sampledDiffuseColor = texture2D(map, ebUV * uEbScale + uEbOff);
        ebT = sampledDiffuseColor.r;
        diffuseColor *= sampledDiffuseColor;
        diffuseColor.rgb *= 0.955 + 0.09 * fract(uEbOff.x * 7.31 + uEbOff.y * 3.17);
      #endif`)
    .replace("#include <opaque_fragment>", "float ebSS = 1.0; if (uAoOn > .5) ebSS = texture2D(uAoTex, gl_FragCoord.xy * uAoInv).r;\noutgoingLight *= (uAoOn > .5 ? mix(1.0, ebAO, 0.4) : ebAO) * pow(ebSS, 3.0);\n#include <opaque_fragment>")
    .replace("#include <roughnessmap_fragment>",
      `float roughnessFactor = roughness;
       ${rough ? "roughnessFactor = clamp(roughness * (0.74 + (1.0 - ebT) * " + rough.toFixed(2) + "), 0.04, 1.0);" : ""}`)
    .replace("#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
       ${bump ? `{
         vec2 ebdH = vec2(dFdx(ebT), dFdy(ebT)) * ${bump.toFixed(5)};
         vec3 ebSX = dFdx(-vViewPosition), ebSY = dFdy(-vViewPosition);
         vec3 ebR1 = cross(ebSY, normal), ebR2 = cross(normal, ebSX);
         float ebDet = dot(ebSX, ebR1);
         vec3 ebG = sign(ebDet) * (ebdH.x * ebR1 + ebdH.y * ebR2);
         normal = normalize(abs(ebDet) * normal - ebG);
       }` : ""}
       if (uEbOn > .5) {
         vec3 ebP = vEbP, ebNa = abs(vEbN);
         vec3 ebIn = step(uEbLo - 0.0025, ebP) * step(ebP, uEbHi + 0.0025);
         if (ebIn.x * ebIn.y * ebIn.z > .5) {
           float ebW = 0.10, ebK = 0.5;
           if (ebNa.x < .5) { ebAO *= 1.0 - ebK * (1.0 - smoothstep(0.0, ebW, ebP.x - uEbLo.x)); ebAO *= 1.0 - ebK * (1.0 - smoothstep(0.0, ebW, uEbHi.x - ebP.x)); }
           if (ebNa.y < .5) { ebAO *= 1.0 - ebK * (1.0 - smoothstep(0.0, ebW, ebP.y - uEbLo.y)); ebAO *= 1.0 - ebK * (1.0 - smoothstep(0.0, ebW, uEbHi.y - ebP.y)); }
           if (ebNa.z < .5) { ebAO *= 1.0 - ebK * (1.0 - smoothstep(0.0, ebW, ebP.z - uEbLo.z)); }
           /* adâncimea: spre fundul corpului lumina scade */
           ebAO *= 1.0 - 0.16 * smoothstep(0.0, 1.0, (uEbHi.z - ebP.z) / max(uEbHi.z - uEbLo.z, 0.05));
         }
       }
       ${edge ? `if (uEbRect > .5) {
         vec3 ebD = (0.5 - abs(vEbL)) * vEbS, ebN = abs(vEbN), ebTd = vec3(0.);
         float ebM = 1.0;
         if (ebN.x > ebN.y && ebN.x > ebN.z) { ebM = min(ebD.y, ebD.z); ebTd = ebD.y < ebD.z ? sign(vEbL.y) * vEbAy : sign(vEbL.z) * vEbAz; }
         else if (ebN.y > ebN.z) { ebM = min(ebD.x, ebD.z); ebTd = ebD.x < ebD.z ? sign(vEbL.x) * vEbAx : sign(vEbL.z) * vEbAz; }
         else { ebM = min(ebD.x, ebD.y); ebTd = ebD.x < ebD.y ? sign(vEbL.x) * vEbAx : sign(vEbL.y) * vEbAy; }
         float ebE = 1.0 - smoothstep(0.0, 0.0017, ebM);
         normal = normalize(normal + ebTd * ebE * 1.1);
         diffuseColor.rgb *= 1.0 - 0.07 * (1.0 - smoothstep(0.0, 0.0003, ebM));
       }` : ""}`);
  };
  m.customProgramCacheKey = () => "eb-triplanar-" + sc[0].toFixed(2) + "-" + bump + "-" + rough + "-" + edge;
}

/* Un material per mesh: three încarcă uniformele unui material numai când se
   schimbă materialul între două desene, deci uRest, decalajul fibrei și
   volumul de ocluzie ar rămâne ale primului mesh. Clona refolosește același
   program compilat, doar uniformele sunt ale ei. */
function perMesh(m) {
  if (!m.userData.tp) return m;
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey;
  c.userData = { tp: 1, own: 1 };
  return c;
}
function materialFor(key) {
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  let m;
  if (key === "__hw") {
    m = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: .3, metalness: 1, envMapIntensity: 1.2 });
  } else if (key === "__hwdark") {
    m = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: .35, metalness: .9, envMapIntensity: 1.1 });
  } else if (key === "__inox") {
    m = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: .27, metalness: 1, envMapIntensity: 1.3 });
  } else if (key === "__blackmetal") {
    m = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: .38, metalness: .85, envMapIntensity: 1.1 });
  } else if (key === "__zinc") {
    m = new THREE.MeshStandardMaterial({ color: 0xb3b7ba, roughness: .4, metalness: .95, envMapIntensity: 1.15 });
  } else if (key === "__zincD" || key === "__inoxD") {
    m = materialFor(key.slice(0, -1)).clone(); m.side = THREE.DoubleSide;
  } else if (key === "__brass") {
    m = new THREE.MeshStandardMaterial({ color: 0xc7a24c, roughness: .35, metalness: .9, envMapIntensity: 1.2 });
  } else if (key === "__chrome") {
    m = new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: .07, metalness: 1, envMapIntensity: 1.6 });
  } else if (key === "__nickel") {
    m = new THREE.MeshStandardMaterial({ color: 0xbdb8ad, roughness: .32, metalness: 1, envMapIntensity: 1.2 });
  } else if (key === "__bronze") {
    m = new THREE.MeshStandardMaterial({ color: 0x8d6a4c, roughness: .4, metalness: .85, envMapIntensity: 1.1 });
  } else if (key === "__antique") {
    m = new THREE.MeshStandardMaterial({ color: 0x6f5733, roughness: .5, metalness: .8, envMapIntensity: 1 });
  } else if (key === "__alu") {
    m = new THREE.MeshStandardMaterial({ color: 0xc6c9cc, roughness: .45, metalness: .85, envMapIntensity: 1.1 });
  } else if (key === "__whitemetal") {
    m = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: .35, metalness: .25 });
  } else if (key === "__ceramic") {
    m = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .15, metalness: 0, envMapIntensity: 1.2 });
  } else if (key === "__woodknob") {
    m = new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: .62, metalness: 0 });
  } else if (key === "__flushdark") {
    m = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: .7, metalness: .2 });
  } else if (key === "__domino") {
    m = new THREE.MeshStandardMaterial({ color: 0x8c5b39, roughness: .8, metalness: 0 });
  } else if (key === "__nylon") {
    m = new THREE.MeshStandardMaterial({ color: 0xe4e0d4, roughness: .62, metalness: 0 });
  } else if (key === "__nylongrey") {
    m = new THREE.MeshStandardMaterial({ color: 0x80858b, roughness: .6, metalness: 0 });
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
  } else if (key === "__beech") {
    if (!WOOD) WOOD = makeWoodTexture(7);
    m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#d8b98c"), roughness: .6, clearcoat: .15, clearcoatRoughness: .5, map: WOOD });
    triplanar(m, { bump: 0.0007, rough: 2.4 });
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
      triplanar(m, { bump: 0.0007, rough: 2.4 });
    } else if (info.tx === "gloss") {
      triplanar(m, {});
    } else {
      if (!FINE) FINE = makeFineTexture(3);
      m.map = FINE; m.color.multiplyScalar(1.03);
      triplanar(m, { scale: [1 / 0.16, 1 / 0.16], bump: 0.0004, rough: 1.2 });
    }
  }
  MAT_CACHE.set(key, m);
  return m;
}
/* Materialul „fantomă": piesele din jurul celei selectate, sau corpul în
   modul feronerie. Transparent, fără umbre, fără scriere în adâncime. */
/* Pezzi che non tornano nella chiusura del gabarito (rosso-ambra, pieno). */
const FLAG = () => MAT_CACHE.get("__flag") || (MAT_CACHE.set("__flag", new THREE.MeshStandardMaterial({
  color: 0xc02f2f, emissive: 0x4a0d0d, roughness: .7 })), MAT_CACHE.get("__flag"));
const WALL_FADE = () => MAT_CACHE.get("__wallfade") || (MAT_CACHE.set("__wallfade", new THREE.MeshStandardMaterial({
  color: 0xd8d2c6, roughness: .95, transparent: true, opacity: .09, depthWrite: false, side: THREE.DoubleSide })), MAT_CACHE.get("__wallfade"));
let TILE = null;
/* gresie: 4×4 plăci în aceeași textură, fiecare cu tonul ei, rost închis la
   culoare, puncte fine și vene slabe (un singur desen repetat ar arăta ca un
   carton cu grilă) */
function tileTexture() {
  if (TILE) return TILE;
  const N = 4, T = 256, S = N * T, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d");
  let sd = 11; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
    const k = (rnd() - 0.5) * 22, x0 = tx * T, y0 = ty * T;
    g.fillStyle = `rgb(${Math.round(196 + k)},${Math.round(188 + k)},${Math.round(174 + k)})`; g.fillRect(x0, y0, T, T);
    for (let i = 0; i < 700; i++) { const a = rnd() * 0.09; g.fillStyle = rnd() < .5 ? `rgba(70,62,50,${a})` : `rgba(255,252,244,${a})`; g.fillRect(x0 + rnd() * T, y0 + rnd() * T, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
    for (let v = 0; v < 3; v++) { g.strokeStyle = `rgba(120,108,92,${0.05 + rnd() * 0.06})`; g.lineWidth = 1 + rnd() * 1.5; g.beginPath(); let vx = x0 + rnd() * T, vy = y0; g.moveTo(vx, vy); for (let q = 1; q <= 6; q++) { vx += (rnd() - 0.5) * 60; vy = y0 + q * T / 6; g.lineTo(vx, vy); } g.stroke(); }
    g.strokeStyle = "#8f8676"; g.lineWidth = 5; g.strokeRect(x0 + 2.5, y0 + 2.5, T - 5, T - 5);
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.5; g.strokeRect(x0 + 6, y0 + 6, T - 12, T - 12);
  }
  TILE = new THREE.CanvasTexture(cv);
  TILE.wrapS = TILE.wrapT = THREE.RepeatWrapping; TILE.colorSpace = THREE.SRGBColorSpace; TILE.anisotropy = 8;
  return TILE;
}
/* podeaua camerei: poligonul pereților, plăci de 600 mm (se vede scara) */
function setRoom(room) {
  R.room = room || null;
  const poly = room && room.floor && room.floor.length >= 3 ? room.floor : null;
  const sig = poly ? JSON.stringify(poly.map(p => [Math.round(p[0]), Math.round(p[1])])) : "";
  if (R.floorSig === sig) return;
  R.floorSig = sig;
  if (R.floor) { R.scene.remove(R.floor); R.floor.geometry.dispose(); R.floor.material.dispose(); R.floor = null; }
  if (!poly) return;
  const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0] * MM, -p[1] * MM)));
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
  const t = tileTexture().clone(); t.needsUpdate = true; t.repeat.set(1 / 2.4, 1 / 2.4);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: t, color: 0xb5ac9a, roughness: .42, metalness: 0, clearcoat: .35, clearcoatRoughness: .3 }));
  m.receiveShadow = true; m.renderOrder = -2; R.floor = m; R.scene.add(m);
}
function fadeWalls() {
  if (!R.camera) return;
  const cp = R.camera.position;
  for (const P of R.pieces.values()) for (const m of P.meshes) {
    const w = m.userData.wall; if (!w) continue;
    const near = !!R.room && ((cp.x - w.cx) * w.nx + (cp.z - w.cz) * w.nz) > 0;
    const want = near ? WALL_FADE() : m.userData.base;
    if (m.material !== want) { m.material = want; R.need = true; }
  }
}
const GHOST = () => MAT_CACHE.get("__ghost") || (MAT_CACHE.set("__ghost", new THREE.MeshStandardMaterial({
  color: 0xb9c2b4, transparent: true, opacity: .14, depthWrite: false, roughness: .9 })), MAT_CACHE.get("__ghost"));

/* Materialul unei cutii: rolul întâi (fiecare element are materialul lui —
   D-41), apoi regula veche din geo3d pentru cutiile fără rol. */
function keyOf(b, cfg) {
  if (b.kind === "w") return "__wall";
  if (b.kind === "g" || b.role === "vetro") return "__glass";
  if (b.kind === "m" || b.role === "cassetto_metallo") return "__metal";
  if (b.role === "piedino") return "__hwdark";
  /* doghe di faggio e gambe in massello: non sono il pannello del corpo */
  if (b.role === "doga" || b.role === "gamba") return "__beech";
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
  if ("environmentIntensity" in scene) scene.environmentIntensity = 0.58;

  const hemi = new THREE.HemisphereLight(0xf6f3ec, 0x6f685c, 0.34);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.9);
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
        st: { explode: 0, open: 0, mode: "real", hw: false, holes: false, dims: false, sel: null, iso: false, edges: true },
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
/* peretele își știe fața dinafară: când camera e de partea aceea, peretele se subțiază */
function wallInfo(b) {
  const q = pcOf(b), cx = q.reduce((a, p) => a + p[0], 0) / q.length, cz = q.reduce((a, p) => a + p[1], 0) / q.length;
  const nx = q[3][0] - q[0][0], nz = q[3][1] - q[0][1], nl = Math.hypot(nx, nz) || 1;
  return { cx: cx * MM, cz: cz * MM, nx: nx / nl, nz: nz / nl };
}
function makeMesh(b, cfg) {
  const key = keyOf(b, cfg);
  let mesh;
  if (b.prism3) {
    /* panou pe pantă în camera 3D: prismă între două poligoane deja în coordonatele camerei */
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
    const sh = q => q.map(([x, y, z]) => [x - cx, y - cy, z - cz]);
    mesh = new THREE.Mesh(buildPrism3(sh(b.prism3.A), sh(b.prism3.B)), perMesh(materialFor(key)));
    mesh.position.set(cx * MM, cy * MM, cz * MM); mesh.updateMatrix();
    mesh.userData.prism = true;
  } else if (b.vp) {
    /* panou pe pantă (D-86): profil în plan vertical, relativ la centrul cutiei de gabarit */
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2, vx = b.vp.ax === "x";
    const cu = vx ? cx : cz, e0 = (vx ? b.z0 - cz : b.x0 - cx), e1 = (vx ? b.z1 - cz : b.x1 - cx);
    mesh = new THREE.Mesh(buildVPrism({ ax: b.vp.ax, pts: b.vp.pts.map(([u, y]) => [u - cu, y - cy]) }, e0, e1), perMesh(materialFor(key)));
    mesh.position.set(cx * MM, cy * MM, cz * MM); mesh.updateMatrix();
    mesh.userData.prism = true;
  } else if (isRectPC(b.pc)) {
    mesh = new THREE.Mesh(UNIT, perMesh(materialFor(key)));
    const c = restOf(b); mesh.userData.cur = Object.assign({}, c); mesh.userData.tgt = c;
    applyRest(mesh, c);
    const ln = new THREE.LineSegments(UNIT_EDGES, new THREE.LineBasicMaterial({ color: 0x2b2a26, transparent: true, opacity: .16 }));
    ln.raycast = () => {}; mesh.add(ln); mesh.userData.lines = ln;
  } else {
    const pc = pcOf(b);
    const cx = pc.reduce((s, p) => s + p[0], 0) / pc.length, cz = pc.reduce((s, p) => s + p[1], 0) / pc.length;
    const cy = (b.y0 + b.y1) / 2;
    mesh = new THREE.Mesh(buildPrism(pc.map(([x, z]) => [x - cx, z - cz]), b.y0 - cy, b.y1 - cy), perMesh(materialFor(key)));
    mesh.position.set(cx * MM, cy * MM, cz * MM); mesh.updateMatrix();
    mesh.userData.prism = true;
  }
  mesh.matrixAutoUpdate = false;
  { let h = 2166136261; const id = String(b.pk != null ? b.pk : b.role || "") + ":" + String(b.role || "");
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    mesh.userData.off0 = ((h >>> 0) % 1000) / 1000; mesh.userData.off1 = (((h >>> 10) >>> 0) % 1000) / 1000; }
  if (b.kind === "w") mesh.userData.wall = wallInfo(b);
  mesh.castShadow = b.kind !== "g" && b.kind !== "w";   // pereții camerei nu aruncă umbră: ar întuneca toată camera
  mesh.receiveShadow = b.kind !== "g";
  mesh.userData.key = key; mesh.userData.base = mesh.material;
  mesh.onBeforeRender = (r, s, c, g, mat) => {
    const sh = mat.userData && mat.userData.shader;
    if (sh) { sh.uniforms.uRest.value.copy(mesh.matrix); sh.uniforms.uEbOff.value.set(mesh.userData.off0 || 0, mesh.userData.off1 || 0); sh.uniforms.uEbRect.value = mesh.userData.prism ? 0 : 1; const ao = mesh.userData.ao; sh.uniforms.uEbOn.value = ao ? 1 : 0; if (ao) { sh.uniforms.uEbLo.value.set(ao.lo[0], ao.lo[1], ao.lo[2]); sh.uniforms.uEbHi.value.set(ao.hi[0], ao.hi[1], ao.hi[2]); } mat.uniformsNeedUpdate = true; }
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
  P.meshes.forEach(m => { if (m.userData.prism) m.geometry.dispose(); if (m.userData.base && m.userData.base.userData.own) m.userData.base.dispose(); if (m.userData.lines) m.userData.lines.material.dispose(); });
  clearGroup(P.hw); clearGroup(P.holes);
}
function clearGroup(g) {
  for (const c of [...g.children]) { g.remove(c); if (c.userData.own) c.geometry.dispose(); if (c.isInstancedMesh) c.dispose(); }
}


/* Interiorul fiecărui corp (carcasa: flancuri, bază, tavan, spate): de aici
   vine ocluzia ambientală simulată din shader. Întoarce o funcție care dă,
   pentru o cutie, volumul interior al corpului în care stă (sau null: ușile,
   sertarele care ies și tot ce e în afara unui corp nu primesc ocluzie). */
function carcassAO(boxes) {
  const car = boxes.filter(b => /^(fianco|base|cielo|schienale)$/.test(b.role || "") && isRectPC(b.pc) && !b.vp && !b.prism3);
  const cl = [];
  car.forEach(b => {
    const hit = cl.filter(c => b.x0 <= c.X1 + 1 && b.x1 >= c.X0 - 1 && b.y0 <= c.Y1 + 1 && b.y1 >= c.Y0 - 1 && b.z0 <= c.Z1 + 1 && b.z1 >= c.Z0 - 1);
    const c = hit[0] || { X0: 1e9, X1: -1e9, Y0: 1e9, Y1: -1e9, Z0: 1e9, Z1: -1e9, bs: [] };
    hit.slice(1).forEach(o => { c.bs.push(...o.bs); cl.splice(cl.indexOf(o), 1); });
    if (!hit.length) cl.push(c);
    c.bs.push(b);
    c.X0 = Math.min(...c.bs.map(q => q.x0)); c.X1 = Math.max(...c.bs.map(q => q.x1));
    c.Y0 = Math.min(...c.bs.map(q => q.y0)); c.Y1 = Math.max(...c.bs.map(q => q.y1));
    c.Z0 = Math.min(...c.bs.map(q => q.z0)); c.Z1 = Math.max(...c.bs.map(q => q.z1));
  });
  cl.forEach(c => {
    const fi = c.bs.filter(q => q.role === "fianco").sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1));
    const ba = c.bs.filter(q => q.role === "base"), ci = c.bs.filter(q => q.role === "cielo"), sc = c.bs.filter(q => q.role === "schienale");
    const lo = [c.X0, c.Y0, c.Z0], hi = [c.X1, c.Y1, c.Z1];
    if (fi.length >= 2) { lo[0] = fi[0].x1; hi[0] = fi[fi.length - 1].x0; }
    if (ba.length) lo[1] = Math.max(...ba.map(q => q.y1));
    if (ci.length) hi[1] = Math.min(...ci.map(q => q.y0));
    if (sc.length) lo[2] = Math.max(...sc.map(q => q.z1));
    c.ao = hi[0] > lo[0] && hi[1] > lo[1] && hi[2] > lo[2] ? { lo: lo.map(v => v * MM), hi: hi.map(v => v * MM) } : null;
  });
  return (b) => {
    if (b.sub || /^cassetto/.test(b.role || "") || b.kind === "w" || !isRectPC(b.pc) || b.vp || b.prism3) return null;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
    const c = cl.find(q => q.ao && cx >= q.X0 - 1 && cx <= q.X1 + 1 && cy >= q.Y0 - 1 && cy <= q.Y1 + 1 && cz >= q.Z0 - 1 && cz <= q.Z1 + 1);
    return c ? c.ao : null;
  };
}

function setModel(boxes, cfg) {
  /* le cutie spinte senza `pk` (tipologie speciali, fațete de ușă curbă)
     primesc unul sintetic: se văd, dar nu se forează */
  let syn = 100000;
  boxes = boxes.map(b => (b.pk == null ? Object.assign({}, b, { pk: "s" + (syn++) }) : b));
  const aoOf = carcassAO(boxes);
  const byPk = new Map();
  boxes.forEach(b => { const k = String(b.pk); if (!byPk.has(k)) byPk.set(k, []); byPk.get(k).push(b); });

  for (const [pk, P] of [...R.pieces]) {
    const nb = byPk.get(pk);
    const same = nb && nb.length === P.meshes.length && nb.every((b, i) => {
      const m = P.meshes[i]; return !b.vp && !b.prism3 && !m.userData.prism && isRectPC(b.pc) && m.userData.key === keyOf(b, cfg);   // un panou pe pantă (vp) nu refolosește cutia unitate
    });
    if (!same) { disposePiece(P); R.pieces.delete(pk); }
  }
  for (const [pk, bs] of byPk) {
    let P = R.pieces.get(pk);
    if (P) { bs.forEach((b, i) => { P.meshes[i].userData.ao = aoOf(b); P.meshes[i].userData.tgt = restOf(b); if (b.kind === "w") P.meshes[i].userData.wall = wallInfo(b); }); }
    else {
      P = pieceGroup(pk);
      bs.forEach(b => { const m = makeMesh(b, cfg); m.userData.pk = pk; m.userData.ao = aoOf(b); P.meshes.push(m); P.g.add(m); });
    }
    P.boxes = bs; P.role = bs[0].role || null; P.sub = bs[0].sub || null; P.grp = bs[0].grp || null; P.fold = bs[0].fold || null;
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
const SPH = new THREE.SphereGeometry(0.5, 18, 12);
function sph(mat, c, dia) {
  const m = new THREE.Mesh(SPH, materialFor(mat));
  m.position.set(c[0] * MM, c[1] * MM, c[2] * MM); m.scale.setScalar(dia * MM); m.castShadow = true;
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

/* alegerea de feronerie: pe corp (cfg.hwSel) sau cea din Catalog; intră în semnătura
   modelului ca schimbarea ei să refacă găurile și feroneria din 3D */
function hwProdSig() { try { return typeof state === "object" && state.settings ? JSON.stringify(state.settings.hwProd || null) : ""; } catch (e) { return ""; } }
function hwId(cat) {
  try { const it = typeof hwItemFor === "function" && R && R.cfg ? hwItemFor(R.cfg, cat) : null; return it && it.id ? String(it.id) : ""; }
  catch (e) { return ""; }
}

/* D-89 — mânerul după modelul din catalog (h.hm): bară rotundă, bară pătrată, punte, arc, scoică,
   buton rotund/pătrat, inel, încastrat oval/rotund, profil pe muchie. Fără model: ca înainte (bară 128 / buton). */
function drawHandle(P, h, tag) {
  const w = h.w, mid = hwId("man");
  const m = h.hm || (h.knob ? { t: "knob", d: 30, fin: mid === "haf_bar128" ? "__inox" : "__blackmetal" }
                            : { t: "bar", ia: h.ia || 128, fin: mid === "haf_bar128" ? "__inox" : "__blackmetal" });
  const F = m.fin || "__blackmetal", ia = m.ia || 0, ax = h.vertical ? 1 : 0;
  const at = (u, d) => { const p = w.slice(); p[ax] += u; p[2] += d; return p; };
  const add = o => P.hw.add(tag(o, true));
  const L = m.L || ia + 44;
  switch (m.t) {
    case "knob": {
      const d = m.d || 30;
      add(cyl(F, w, at(0, 3), d * .55)); add(cyl(F, at(0, 1.5), at(0, d * .75), d * .28)); add(sph(F, at(0, d * .95), d));
      break; }
    case "knobSq": {
      const d = m.d || 30;
      add(cyl(F, at(0, 0), at(0, d * .5), d * .35));
      const lo = w.slice(), hi = w.slice(); lo[0] -= d / 2; hi[0] += d / 2; lo[1] -= d / 2; hi[1] += d / 2; lo[2] += d * .45; hi[2] += d * .45 + d * .5;
      add(box(F, lo, hi)); break; }
    case "ring": {
      const d = m.d || 40;
      add(cyl(F, w, at(0, 4), 22)); add(cyl(F, at(0, 3), at(0, 9), 8));
      const tor = new THREE.Mesh(new THREE.TorusGeometry((d / 2) * MM, 2.6 * MM, 10, 36), materialFor(F));
      tor.position.set(w[0] * MM, (w[1] - d / 2 + 4) * MM, (w[2] + 9) * MM); tor.castShadow = true; tor.userData.own = true;
      add(tor); break; }
    case "flush": case "flushR": {
      /* la nivelul feței: rama în finisaj, fundul închis */
      const round = m.t === "flushR", Lf = round ? m.d : m.L, Wf = round ? m.d : (m.W || 40);
      if (round) { add(cyl(F, at(0, -0.2), at(0, 0.9), Lf)); add(cyl("__flushdark", at(0, 0.6), at(0, 1.0), Lf - 6)); }
      else {
        const lo = w.slice(), hi = w.slice(), ux = h.vertical ? 1 : 0, vx = 1 - ux;
        lo[ux] -= Lf / 2; hi[ux] += Lf / 2; lo[vx] -= Wf / 2; hi[vx] += Wf / 2; lo[2] -= 0.2; hi[2] += 0.9;
        add(box(F, lo, hi));
        const lo2 = lo.slice(), hi2 = hi.slice(); lo2[ux] += 3; hi2[ux] -= 3; lo2[vx] += 3; hi2[vx] -= 3; lo2[2] = w[2] + 0.6; hi2[2] = w[2] + 1.0;
        add(box("__flushdark", lo2, hi2));
      }
      break; }
    case "edge": {
      /* profil în L pe muchie: talpă pe muchie + buză în față, cu rost de prindere */
      const e = h.edge || { n: 1, s: 1, at: w[1] }, T = h.T || 19, Le = m.L || 150, n = e.n, s = e.s, along = 1 - n;
      const lo = w.slice(), hi = w.slice();
      lo[along] = w[along] - Le / 2; hi[along] = w[along] + Le / 2;
      lo[n] = s > 0 ? e.at : e.at - 2; hi[n] = s > 0 ? e.at + 2 : e.at;
      lo[2] = w[2] - T + 4; hi[2] = w[2] + 10;
      add(box(F, lo, hi));
      const l2 = lo.slice(), h2 = hi.slice();
      l2[n] = s > 0 ? e.at - 24 : e.at - 2; h2[n] = s > 0 ? e.at + 2 : e.at + 24;
      l2[2] = w[2] + 8; h2[2] = w[2] + 10;
      add(box(F, l2, h2)); break; }
    case "cup": {
      const Lc = m.L || ia + 30, lo = w.slice(), hi = w.slice();
      lo[ax] -= Lc / 2; hi[ax] += Lc / 2; const vx = 1 - ax;
      lo[vx] -= 14; hi[vx] += 14; hi[2] = w[2] + 2.5;
      add(box(F, lo, hi));
      const l2 = lo.slice(), h2 = hi.slice(); h2[vx] = lo[vx] + 3; h2[2] = w[2] + 20; add(box(F, l2, h2));
      const l3 = lo.slice(), h3 = hi.slice(); l3[vx] = lo[vx]; h3[vx] = lo[vx] + 16; l3[2] = w[2] + 17; h3[2] = w[2] + 20; add(box(F, l3, h3));
      break; }
    case "barsq": case "dpull": {
      const sq = m.t === "dpull" ? 8 : 12, pr = m.t === "dpull" ? 30 : 34, Lb = m.t === "dpull" ? ia + sq : L;
      [-1, 1].forEach(k => { const c = at(k * ia / 2, 0), lo = c.slice(), hi = c.slice();
        lo[0] -= sq / 2.4; hi[0] += sq / 2.4; lo[1] -= sq / 2.4; hi[1] += sq / 2.4; hi[2] += pr; add(box(F, lo, hi)); });
      const c = at(0, pr), lo = c.slice(), hi = c.slice(); lo[ax] -= Lb / 2; hi[ax] += Lb / 2; const vx = 1 - ax;
      lo[vx] -= sq / 2; hi[vx] += sq / 2; lo[2] -= sq / 2; hi[2] += sq / 2; add(box(F, lo, hi));
      break; }
    case "bow": {
      const n = 12, pts = [];
      for (let i = 0; i <= n; i++) { const u = -L / 2 + L * i / n, q = Math.min(1, Math.abs(2 * u / L)); pts.push(at(u, 16 + 12 * (1 - q * q))); }
      for (let i = 0; i < n; i++) add(cyl(F, pts[i], pts[i + 1], 10));
      pts.forEach((p, i) => { if (i % 3 === 0) add(sph(F, p, 10)); });
      [-1, 1].forEach(k => add(cyl(F, at(k * ia / 2, 0), at(k * ia / 2, 22), 9)));
      break; }
    default: {   /* bară rotundă pe două picioare */
      const d = m.d || 12, zb = 32, a = at(-L / 2, zb), b = at(L / 2, zb);
      add(cyl(F, a, b, d)); add(sph(F, a, d)); add(sph(F, b, d));
      [-1, 1].forEach(k => { const p1 = at(k * ia / 2, 0);
        add(cyl(F, at(k * ia / 2, 1.5), at(k * ia / 2, 33), 8.5)); add(cyl(F, p1, at(k * ia / 2, 3), 17)); });
    }
  }
}

function buildHardware(model) {
  for (const P of R.pieces.values()) { clearGroup(P.hw); clearGroup(P.holes); P.pivot = null; }
  if (R.linkG) clearGroup(R.linkG);
  R.links = [];
  if (!model || !model.ops) return;
  const O = model.ops;
  /* cerniere: dicono anche da che parte si apre l'anta */
  O.hw.forEach(h => {
    const P = R.pieces.get(String(h.piece)); if (!P) return;
    const A = h.against != null ? R.pieces.get(String(h.against)) : null;
    const tag = (m, always) => { m.userData.hw = h.type; m.userData.always = !!always; m.userData.rel = [String(h.piece), String(h.against)]; return m; };
    if (h.type === "cerniera") {
      /* Blum CLIP top (fișa 71B3590/71B3550): cupă Ø35 adâncă 13, flanșă 57 × 27,5 cu două găuri la 45 mm
         (excentric 9,5 față de cupă), braț lung din tablă îndoită, pe placa de montaj de pe lateral;
         amortizorul BLUMOTION e o cutie neagră pe braț; două șuruburi de reglaj pe capătul brațului */
      const w = h.w, sd = h.hingeLeft ? 1 : -1, hid = hwId("cern");
      const HM = /^haf_/.test(hid) ? "__inox" : "__zinc", damper = /^blum_71b/.test(hid) || /^haf_/.test(hid), inset = hid === "haf_duomatic";
      const y = w[1], z0 = w[2];
      /* — partea din ușă: cupă, flanșă cu urechi, șuruburi, brațul de legătură — */
      P.hw.add(tag(cyl(HM, along(w, 2, 0), along(w, 2, 13), 35)));
      P.hw.add(tag(cyl(HM, along(w, 2, -1.7), along(w, 2, 0.3), 37)));
      const fx0 = w[0] - sd * 14, fx1 = w[0] + sd * 13.5;
      P.hw.add(tag(box(HM, [Math.min(fx0, fx1), y - 28.5, z0 - 1.7], [Math.max(fx0, fx1), y + 28.5, z0 - 0.1])));
      [-1, 1].forEach(k => {
        const c = [w[0] + sd * 9.5, y + k * 22.5, z0 - 1.7];
        P.hw.add(tag(cyl("__blackmetal", c, [c[0], c[1], c[2] - 0.15], 8.4)));
        P.hw.add(tag(cyl("__inox", [c[0], c[1], c[2] - 0.1], [c[0], c[1], c[2] - 1.6], 6)));
      });
      if (h.plate && A) {
        const p = h.plate, up = p[0] + sd * 0, zp = p[2];
        const xo = (d) => p[0] + sd * d;
        /* — placa de montaj de pe lateral: bază 3 mm, 45 × 40, cu două șuruburi la 32 mm — */
        A.hw.add(tag(box(HM, [Math.min(p[0], xo(3)), p[1] - 22.5, zp - 20], [Math.max(p[0], xo(3)), p[1] + 22.5, zp + 20])));
        [-1, 1].forEach(k => A.hw.add(tag(cyl("__inox", [xo(3), p[1] + k * 16, zp + 13], [xo(4.4), p[1] + k * 16, zp + 13], 6.5))));
        /* — brațul: tablă îndoită, mai înalt spre ușă (profil trapez), lat de 22 mm — */
        const zNear = z0 - 16, zFar = zNear - 56;
        const sh = new THREE.Shape();
        sh.moveTo(zFar, 3); sh.lineTo(zNear, 3); sh.lineTo(zNear, inset ? 27 : 23); sh.lineTo(zFar + 18, 16); sh.lineTo(zFar, 13); sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, { depth: 22, bevelEnabled: false });
        g.translate(0, 0, -11);
        /* (a, b, depth) → (z, xo, y): permutare ciclică, deci rotație proprie */
        const M = new THREE.Matrix4().set(0, sd, 0, p[0] * 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
        g.applyMatrix4(M); g.translate(0, p[1], 0); g.scale(MM, MM, MM);
        const arm = new THREE.Mesh(g, materialFor(HM + "D")); arm.castShadow = true; arm.userData.own = true;
        A.hw.add(tag(arm));
        /* amortizor, pivot și șuruburi de reglaj */
        if (damper) A.hw.add(tag(box("__blackmetal", [xo(4), p[1] - 8, zNear - 22], [xo(11), p[1] + 8, zNear - 3])));
        A.hw.add(tag(cyl("__inox", [xo(14), p[1] - 11, zNear - 1], [xo(14), p[1] + 11, zNear - 1], 5.5)));
        [[zFar + 9, 13.2], [zFar + 31, 18]].forEach(([zz, hh]) => {
          A.hw.add(tag(cyl("__inox", [xo(hh), p[1], zz], [xo(hh + 1.6), p[1], zz], 7.5)));
          A.hw.add(tag(box("__blackmetal", [xo(hh + 1.6), p[1] - 0.6, zz - 2.8], [xo(hh + 1.9), p[1] + 0.6, zz + 2.8])));
          A.hw.add(tag(box("__blackmetal", [xo(hh + 1.6), p[1] - 2.8, zz - 0.6], [xo(hh + 1.9), p[1] + 2.8, zz + 0.6])));
        });
        A.hw.add(tag(box("__blackmetal", [xo(12), p[1] - 3, zFar + 16], [xo(17.6), p[1] + 3, zFar + 26])));  // fanta de reglaj
        /* legătura din ușă: stâlp scurt de la flanșă la pivot */
        /* capătul din ușă se mișcă odată cu ușa, capătul din braț rămâne pe lateral: legătura se
           recalculează la fiecare cadru (updateLinks), deci balamaua rămâne legată și cu ușa deschisă */
        const a = [w[0], y, z0 - 1.7], b = [xo(14), y, zNear - 1], lk = new THREE.Mesh(UNIT, materialFor(HM));
        lk.castShadow = true; tag(lk); lk.userData.own = true;
        if (!R.linkG) { R.linkG = new THREE.Group(); R.root.add(R.linkG); }
        R.linkG.add(lk); R.links.push({ m: lk, P, A, a, b, rel: lk.userData.rel });
        P.hw.add(tag(cyl("__inox", [a[0] - sd * 0, y - 10, z0 - 3.5], [a[0], y + 10, z0 - 3.5], 4.5)));
      } else {
        P.hw.add(tag(box(HM, [w[0] - 5, y - 8, z0 - 24], [w[0] + 5, y + 8, z0 - 1.6])));
      }
      if (!P.pivot) P.pivot = { x: h.hingeLeft ? P.boxes[0].x0 : P.boxes[0].x1, z: P.boxes[0].z1, left: h.hingeLeft };
    } else if (h.type === "cerniera_pliante") {
      /* balamaua dintre două foi ale unui pachet pliant: cupa în prima foaie, placa pe fața dinapoi a vecinei */
      const w = h.w, HM = /^haf_/.test(hwId("cern")) ? "__inox" : "__zinc";
      P.hw.add(tag(cyl(HM, along(w, 2, 0), along(w, 2, 13), 35)));
      if (h.plate && A) { const p = h.plate; A.hw.add(tag(box(HM, [p[0] - 22.5, p[1] - 22.5, p[2] - 3], [p[0] + 22.5, p[1] + 22.5, p[2]]))); }
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
      /* culisantă ascunsă: șina corpului (profil C pe lateral, rolă, fixare în
         spate) rămâne pe loc; alergătorul cu clemă de față merge cu sertarul */
      const w = h.w, s = h.side < 0 ? 1 : -1, y = w[1], z1 = w[2], zf = z1 - h.len, gid = hwId("guida");
      const side = gid === "blum_230m" || gid === "haf_ball", movento = gid === "blum_movento";
      const X = (a, b) => [w[0] + s * a, w[0] + s * b].sort((u, v) => u - v);
      const bx = (m, xa, xb, ya, yb, za, zb, G) => { const x = X(xa, xb); (G || P.hw).add(tag(box(m, [x[0], y + ya, za], [x[1], y + yb, zb]))); };
      bx("__zinc", 0, 1.8, -10, 26, zf + 6, z1 - 6);              // placa de fixare pe lateral
      bx("__zinc", 0, 13, -10, -8.2, zf + 6, z1 - 6);             // buza de jos
      bx("__zinc", 0, 13, 24.2, 26, zf + 6, z1 - 6);              // buza de sus
      bx("__zinc", 0, 10, -10, 26, zf, zf + 6);                   // consola din spate
      bx("__zinc", 0, 8, -10, 26, z1 - 6, z1);                    // reazemul din față
      [-1, 1].forEach(k => { const c = [w[0] + s * 1.8, y + 8 + k * 6, z1 - 3]; P.hw.add(tag(cyl("__inox", c, [c[0] + s * 1.2, c[1], c[2]], 5.5))); });
      const x0 = w[0] + s * 4, rl = [x0, y + 8, z1 - 24];
      P.hw.add(tag(cyl("__nylon", rl, [x0 + s * 7, rl[1], rl[2]], 13)));
      if (side) {
        /* culisantă laterală: șina corpului e vizibilă, cu role sau bile */
        bx("__zinc", 1.8, 7.5, -4, 30, zf + 8, z1 - 8);
        const nb = gid === "haf_ball" ? 7 : 3;
        for (let k = 0; k < nb; k++) {
          const zz = zf + 22 + k * ((h.len - 44) / Math.max(nb - 1, 1)), c = [w[0] + s * 7.5, y + 13, zz];
          if (gid === "haf_ball") { P.hw.add(tag(sph("__inox", [c[0], c[1] - 6, zz], 5))); P.hw.add(tag(sph("__inox", [c[0], c[1] + 6, zz], 5))); }
          else P.hw.add(tag(cyl("__nylon", [c[0] - s * 3, y + 13, zz], [c[0] + s * 4, y + 13, zz], 12)));
        }
      }
      /* partea mobilă, pe peretele sertarului din partea aceasta */
      let D = null;
      for (const Q of R.pieces.values()) {
        if (!Q.grp || Q.role !== "cassetto_fianco" || !Q.boxes.length) continue;
        const B = Q.boxes[0]; if (B.x1 - B.x0 > 30) continue;
        const fxd = h.side < 0 ? B.x0 : B.x1;
        if (Math.abs(fxd - w[0]) < 40 && y >= B.y0 - 6 && y <= B.y1 && B.z0 < z1 && B.z1 > zf) { D = Q; break; }
      }
      const G = D ? D.hw : P.hw, rel = D ? [String(D.pk), String(h.piece)] : null;
      const gb = (m, xa, xb, ya, yb, za, zb) => { const x = X(xa, xb); const q = tag(box(m, [x[0], y + ya, za], [x[1], y + yb, zb])); if (rel) q.userData.rel = rel; G.add(q); };
      if (side) gb("__zinc", 7.5, 12.7, -4, 30, zf + 8, z1 - 8);   // șina sertarului
      else gb("__zinc", 2.2, 12, -8.6, -4.6, zf + 22, z1 - 14);    // alergătorul de jos
      gb("__zinc", 2.2, 4, -8.6, 18, zf + 22, zf + 30);           // cârligul din spate
      gb(movento ? "__blackmetal" : "__nylongrey", 2.2, 12.5, -8.6, 16, z1 - 40, z1 - 8);    // clema de fixare din față
      gb("__nylon", 8, 12.5, 16, 19, z1 - 40, z1 - 24);           // pârghia de eliberare
    } else if (h.type === "maniglia") {
      drawHandle(P, h, tag);
    } else if (h.type === "gola_fresata") {
      /* priza frezată: fâșie închisă pe muchia de sus, pe spatele frontului — se vede ca adâncitura de prindere */
      P.hw.add(tag(box("__flushdark", [h.x0 + 1, h.w[1] - 0.2, h.zB], [h.x1 - 1, h.w[1] + 0.3, h.zB + h.d]), true));
    } else if (h.type === "confirmat") {
      /* șurub confirmat 7×50: capul pe fața exterioară a lui F, tija intră în muchia lui E */
      const Fb = A && A.boxes && A.boxes[0], ext = Fb ? [Fb.x1 - Fb.x0, Fb.y1 - Fb.y0, Fb.z1 - Fb.z0][h.eAx] : 19;
      const hd = along(h.w, h.eAx, h.eSide * ext), tip = along(h.w, h.eAx, -h.eSide * (50 - ext));
      P.hw.add(tag(cyl("__brass", hd, tip, 7)));
      P.hw.add(tag(cyl("__brass", hd, along(hd, h.eAx, h.eSide * 3.5), 10.5)));
    } else if (h.type === "biscuit" || h.type === "domino" || h.type === "clamex") {
      /* lamela / tenon / conector: corp care trece din F în E, orientat după canal */
      const D = { biscuit: [56, 4, 12.5, 12.5, "__wooddowel"], domino: [22, 8, 15, 25, "__domino"], clamex: [64, 9.7, 14, 14, "__nylongrey"] }[h.type];
      const lo = h.w.slice(), hi = h.w.slice();
      const e0 = h.w[h.eAx] + h.eSide * D[2], e1 = h.w[h.eAx] - h.eSide * D[3];
      lo[h.eAx] = Math.min(e0, e1); hi[h.eAx] = Math.max(e0, e1);
      lo[h.sAx] = h.w[h.sAx] - D[0] / 2; hi[h.sAx] = h.w[h.sAx] + D[0] / 2;
      lo[h.camAx] = h.w[h.camAx] - D[1] / 2; hi[h.camAx] = h.w[h.camAx] + D[1] / 2;
      P.hw.add(tag(box(D[4], lo, hi)));
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
/* ---- COTE DI LUCE ------------------------------------------------------
   Le cote vengono da `dimensionSpec` (ebanist-ops.js, min/max dei pezzi): il
   3D mostra quello che la distinta taglia. Linee e etichette senza test di
   profondita, cosi si leggono anche attraverso le ante; spariscono quando il
   mobile e esploso, perche le cote descriverebbero un corpo che non c'e. */
const DIM_COLOR = 0xb8860b;
const LBL_CACHE = new Map();
function labelTexture(text) {
  let t = LBL_CACHE.get(text);
  if (t) return t;
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96;
  const g = cv.getContext("2d");
  g.fillStyle = "rgba(255,255,255,.92)"; g.strokeStyle = "#b8860b"; g.lineWidth = 5;
  const r = 20; g.beginPath(); g.moveTo(r, 6); g.arcTo(250, 6, 250, 90, r); g.arcTo(250, 90, 6, 90, r); g.arcTo(6, 90, 6, 6, r); g.arcTo(6, 6, 250, 6, r); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = "#14181d"; g.font = "700 50px 'Barlow Condensed', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 128, 50);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  LBL_CACHE.set(text, t);
  return t;
}
function clearDims() {
  if (!R.dims) return;
  for (const c of [...R.dims.children]) {
    R.dims.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();      // texturile restano in LBL_CACHE
  }
}
function buildDims(model) {
  if (!R.dims) { R.dims = new THREE.Group(); R.dims.renderOrder = 10; R.root.add(R.dims); }
  clearDims();
  const spec = model && model.ops && typeof dimensionSpec === "function" ? dimensionSpec(model.ops.pieces) : null;
  R.dimSpec = spec;
  if (!spec) return;
  const size = Math.max(spec.L, spec.H, spec.P) * MM, off = 70, tick = 28, lh = size * 0.065;
  const lineMat = new THREE.LineBasicMaterial({ color: DIM_COLOR, depthTest: false, transparent: true });
  const pts = [];
  const seg = (a, b) => pts.push(a[0] * MM, a[1] * MM, a[2] * MM, b[0] * MM, b[1] * MM, b[2] * MM);
  const label = (txt, at) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(txt), depthTest: false, transparent: true }));
    sp.position.set(at[0] * MM, at[1] * MM, at[2] * MM); sp.scale.set(lh * 256 / 96, lh, 1); sp.renderOrder = 11;
    R.dims.add(sp);
  };
  const [x0, y0, z0] = spec.min, [x1, y1, z1] = spec.max, zf = z1 + 4;
  /* L sotto, H a sinistra, P a destra: davanti al mobile */
  seg([x0, y0 - off, zf], [x1, y0 - off, zf]); seg([x0, y0 - off - tick, zf], [x0, y0 - off + tick, zf]); seg([x1, y0 - off - tick, zf], [x1, y0 - off + tick, zf]);
  label(String(spec.L), [(x0 + x1) / 2, y0 - off, zf]);
  seg([x0 - off, y0, zf], [x0 - off, y1, zf]); seg([x0 - off - tick, y0, zf], [x0 - off + tick, y0, zf]); seg([x0 - off - tick, y1, zf], [x0 - off + tick, y1, zf]);
  label(String(spec.H), [x0 - off, (y0 + y1) / 2, zf]);
  seg([x1 + off, y0, z0], [x1 + off, y0, z1]); seg([x1 + off, y0 - tick, z0], [x1 + off, y0 + tick, z0]); seg([x1 + off, y0 - tick, z1], [x1 + off, y0 + tick, z1]);
  label(String(spec.P), [x1 + off, y0, (z0 + z1) / 2]);
  /* luci libere, una linea per colonna e per vano */
  spec.gaps.forEach(g => {
    seg([g.x, g.y0, zf], [g.x, g.y1, zf]); seg([g.x - tick / 2, g.y0, zf], [g.x + tick / 2, g.y0, zf]); seg([g.x - tick / 2, g.y1, zf], [g.x + tick / 2, g.y1, zf]);
    label(String(Math.round(g.h)), [g.x, (g.y0 + g.y1) / 2, zf]);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const ls = new THREE.LineSegments(geo, lineMat); ls.renderOrder = 10; ls.frustumCulled = false;
  R.dims.add(ls);
}

/* Un pezzo e segnalato se la sua riga di distinta e fra quelle che la
   chiusura del gabarito (D-43) nomina in un guasto. */
function isFlagged(P) {
  if (!R.flag || !R.model || !R.model.meta) return false;
  const m = R.model.meta[P.pk];
  return !!(m && m.row && R.flag.has(String(m.row.elemento)));
}

function applyState() {
  const st = R.st, sel = st.sel != null ? String(st.sel) : null;
  const hwMode = st.mode === "hw";
  for (const P of R.pieces.values()) {
    const isSel = sel === P.pk;
    const show = !(st.iso && sel && !isSel);
    P.g.visible = show;
    const ghost = (hwMode && !isSel) || (sel && !isSel && !st.iso);
    const flagged = !ghost && isFlagged(P);
    P.meshes.forEach(m => {
      const glass = m.userData.key === "__glass";
      m.material = ghost ? (glass ? GHOST() : GHOST()) : flagged && !glass ? FLAG() : m.userData.base;
      m.castShadow = !ghost && !glass && !m.userData.wall;
      const ln = m.userData.lines;
      if (ln) {
        ln.visible = st.edges || isSel;
        ln.material.color.setHex(isSel ? 0xd4af37 : flagged ? 0x7a1111 : (R.dark ? 0x0a0c09 : 0x2b2a26));
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
  (R.links || []).forEach(L => { L.m.visible = (st.hw || hwMode || (!!sel && L.rel.indexOf(sel) >= 0)) && L.P.g.visible && L.A.g.visible; });
  if (R.dims) R.dims.visible = !!st.dims && !(st.explode > 0.01) && !(st.iso && sel);
  fadeWalls();
  R.need = true; kick();
}

/* Ante scorrevoli aperte: non hanno cerniere, quindi niente perno — prima
   «Apri» le lasciava ferme. Ogni anta del binario davanti scorre fino a
   coprire l'anta del binario dietro piu vicina: si apre il vano che copriva.
   Restituisce lo spostamento in x (mm) per pk. */
function slideOpenX(boxes) {
  const by = new Map();
  boxes.forEach(b => { if (b.sub !== "slide" || b.pk == null) return;
    const k = String(b.pk), d = by.get(k);
    if (!d) by.set(k, { pk: k, x0: b.x0, x1: b.x1, z: b.z1 });
    else { d.x0 = Math.min(d.x0, b.x0); d.x1 = Math.max(d.x1, b.x1); d.z = Math.max(d.z, b.z1); } });
  const ds = [...by.values()], out = {};
  if (ds.length < 2) return out;
  const zMax = Math.max(...ds.map(d => d.z));
  const front = ds.filter(d => d.z > zMax - 1), back = ds.filter(d => d.z <= zMax - 1);
  if (!back.length) return out;
  front.forEach(f => {
    const cf = (f.x0 + f.x1) / 2;
    let best = null;
    back.forEach(k => { const c = (k.x0 + k.x1) / 2; if (!best || Math.abs(c - cf) < Math.abs((best.x0 + best.x1) / 2 - cf)) best = k; });
    out[f.pk] = best.x0 - f.x0;
  });
  return out;
}

/* bersagli di esplosione e apertura, per pezzo */
function setTargets(boxesOrig) {
  const ex = explodeBoxes(boxesOrig, R.st.explode || 0);
  const first = new Map();
  boxesOrig.forEach((b, i) => { const k = String(b.pk); if (!first.has(k)) first.set(k, i); });
  /* profondità di ogni cassetto: sertarul iese cât jumătate din el */
  const grpD = {};
  boxesOrig.forEach(b => { if (b.grp && b.sub === "dbox") grpD[b.grp] = Math.max(grpD[b.grp] || 0, b.z1 - b.z0); });
  const slideX = slideOpenX(boxesOrig);
  for (const P of R.pieces.values()) {
    const i = first.get(P.pk); if (i == null) continue;
    const a = boxesOrig[i], b = ex[i];
    P.tgt.ex = ((b.x0 - a.x0) + (R.st.open ? (slideX[P.pk] || 0) : 0)) * MM; P.tgt.ey = (b.y0 - a.y0) * MM; P.tgt.ez = (b.z0 - a.z0) * MM;
    const open = R.st.open ? 1 : 0;
    /* ușa trapezoidală (pantă) nu are balamale în lista de feronerie: pivotul vine din partea balamalei a cutiei */
    if (P.sub === "door" && !P.pivot) {
      if (a.z1 - a.z0 > a.x1 - a.x0) P.pivot = { x: a.x1, z: a.z0, left: false };   // ușa de pe aripa corpului de colț: stă în planul x, balamaua la capătul dinspre perete
      else if (a.hinge === "left" || a.hinge === "right") P.pivot = { x: a.hinge === "left" ? a.x0 : a.x1, z: a.z1, left: a.hinge === "left" };
    }
    P.tgt.ang = (open && P.pivot && P.sub === "door") ? (P.pivot.left ? -1 : 1) * 1.72 : 0;
    /* pachet pliant (U.9): foaia se rotește 90° în jurul muchiei ei de pe partea pachetului și se așază
       lângă celelalte, perpendicular pe față — la fel ca în camera 3D și în planul de balamale */
    if (P.sub === "fold" && P.fold) {
      const F = P.fold, left = a.hinge === "left", th = a.z1 - a.z0;
      const gap = (typeof FOLD === "object" && FOLD.open_gap != null) ? FOLD.open_gap : 3;
      const px = left ? a.x0 : a.x1, stack = left ? F.x0 + F.k * (th + gap) : F.x1 - (F.n - 1 - F.k) * (th + gap);
      P.pivot = { x: px, z: a.z1, left };
      P.tgt.ang = open ? (left ? -1 : 1) * Math.PI / 2 : 0;
      P.tgt.ex += open ? (stack - px) * MM : 0;
    }
    P.tgt.sl = (open && P.grp) ? (grpD[P.grp] || 400) * 0.55 * MM : 0;
  }
}

function updateBoundsAndLights(boxes) {
  const B = boundsOf(boxes, !!R.room);
  if (!B) return;
  R.full = B;
  const s = B.size;
  R.ground.position.set(B.cx, B.floor + 0.0005, B.cz); R.ground.scale.set(s * 6, s * 6, 1);
  /* l'impronta vera, un po' allargata */
  let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
  boxes.forEach(b => { if (b.kind === "w" && !R.room) return; pcOf(b).forEach(([x, z]) => { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); }); });
  R.contact.visible = !R.room;
  if (R.floor) R.floor.position.y = B.floor + 0.0002;
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
  /* privire de aproape (GL3D.focusOn): centrul e un punct al piesei, cu raza dată */
  if (R.focusOv) {
    const P = R.pieces.get(String(R.focusOv.pk));
    if (P) {
      const B = boundsOf(P.boxes), o = R.focusOv.off || [0, 0, 0];
      if (B) return { cx: B.cx + P.tgt.ex + o[0] * MM, cy: B.cy + P.tgt.ey + o[1] * MM, cz: B.cz + P.tgt.ez + o[2] * MM, rad: R.focusOv.rad * MM, size: (R.full && R.full.size) || B.size };
    }
  }
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
  updateLinks();
  return moving;
}

/* legăturile balamalelor: între un punct al ușii (care se rotește) și unul al lateralului */
const VLA = new THREE.Vector3(), VLB = new THREE.Vector3();
function updateLinks() {
  if (!R.links) return;
  for (const L of R.links) {
    VLA.set(L.a[0] * MM, L.a[1] * MM, L.a[2] * MM).applyMatrix4(L.P.g.matrix);
    VLB.set(L.b[0] * MM, L.b[1] * MM, L.b[2] * MM).applyMatrix4(L.A.g.matrix);
    const len = Math.max(VLA.distanceTo(VLB), 1e-5);
    L.m.position.copy(VLA).add(VLB).multiplyScalar(0.5);
    L.m.scale.set(3.2 * MM, 17 * MM, len);
    L.m.rotation.set(0, Math.atan2(VLB.x - VLA.x, VLB.z - VLA.z), 0);
  }
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
  if (R.room) fadeWalls();
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
  /* giro lento, per il modo cliente: il mobile si presenta da solo */
  if (R.spin && typeof VIEW === "object") VIEW.yaw += 0.0035;
  const a = step(), b = stepCamera() || !!R.spin;
  renderScene();
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
      setRoom(opts.room);
      R.cfg = cfg;
      boxes = setModel(boxes, cfg);
      const sig = JSON.stringify(boxes.map(b => [b.pk, b.role, Math.round(b.x0), Math.round(b.x1), Math.round(b.y0), Math.round(b.y1), Math.round(b.z0), Math.round(b.z1), keyOf(b, cfg)])) + "|" + cfg.handles + "|" + cfg.shelfType + "|" + JSON.stringify(cfg.hwSel || null) + "|" + (cfg.antiWarp || "") + "|" + hwProdSig();
      if (sig !== R.sig) {
        R.sig = sig;
        R.model = computeModel(cfg, boxes, built || { pieces: [] });
        buildHardware(R.model);
        buildDims(R.model);
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
  /* nomi di riga (`elemento`) da evidenziare in rosso; vuoto/null = niente */
  flag(names) {
    if (!this.ok) return;
    R.flag = names && names.length ? new Set(names.map(String)) : null;
    applyState();
  },
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
  /* ieșirea din camera 3D: fără podea, cu umbra de contact la loc */
  leaveRoom() { if (!R) return; setRoom(null); R.contact.visible = true; R.need = true; kick(); },
  /* per le prove: podeaua și pereții camerei */
  roomInfo() { if (!R) return null; let walls = 0, faded = 0; for (const P of R.pieces.values()) for (const m of P.meshes) if (m.userData.wall) { walls++; if (m.material === WALL_FADE()) faded++; }
    return { room: !!R.room, floor: !!R.floor, walls, faded, contactHidden: R.contact ? !R.contact.visible : null }; },
  /* per le prove: cosa c'e nel gruppo delle cote */
  dimsInfo() { return R && R.dims ? { visible: R.dims.visible, labels: R.dims.children.filter(c => c.isSprite).length, spec: R.dimSpec } : null; },
  snapshot() { if (!this.ok) return null; renderScene(); return R.canvas.toDataURL("image/png"); },
  theme() { if (!this.ok) return; R.dark = isDark(); R.scene.background = gradientBg(R.dark);
    R.ground.material.opacity = R.dark ? .34 : .16; R.contact.material.opacity = R.dark ? .8 : .5; applyState(); },
  spin(on) { if (!this.ok) return; R.spin = !!on; kick(); },
  /* Una fotografia del mobile per un documento: stato dato, animazioni
     chiuse all'istante, dimensione fissa. Torna l'immagine e, per ogni pezzo,
     dove cade il suo centro nell'immagine (0..1) — per numerarlo.
     Il chiamante ridisegna poi quello che c'era prima. */
  capture(cfg, o) {
    if (!this.ok) return null;
    o = o || {};
    const prev = Object.assign({}, R.st), V = (typeof VIEW === "object") ? VIEW : null;
    const pv = V ? { yaw: V.yaw, pitch: V.pitch, zoom: V.zoom } : null;
    const spin = R.spin; R.spin = false;
    try {
      this.render(cfg, { explode: o.explode || 0 });
      Object.assign(R.st, { mode: o.mode || "real", hw: !!o.hw, holes: !!o.holes, open: !!o.open,
        sel: null, iso: false, dims: false, edges: o.edges !== false, explode: o.explode || 0 });
      setTargets(R.boxes); applyState();
      if (V) { V.yaw = o.yaw != null ? o.yaw : .62; V.pitch = o.pitch != null ? o.pitch : .36; V.zoom = o.zoom || 1; }
      const w = o.w || 1200, h = o.h || 900;
      R.renderer.setPixelRatio(1); R.renderer.setSize(w, h, false);
      R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
      /* tutto al bersaglio, subito: una foto non aspetta l'animazione */
      for (const P of R.pieces.values()) {
        Object.assign(P.cur, P.tgt);
        P.meshes.forEach(m => { if (!m.userData.prism) { m.userData.cur = Object.assign({}, m.userData.tgt); } });
      }
      /* o.focus: încadrează o singură piesă (pk), fără s-o selecteze în imagine */
      if (o.focus != null) R.st.sel = String(o.focus);
      const B = focusBounds(); R.st.sel = null;
      Object.assign(R.cam, { cx: B.cx, cy: B.cy, cz: B.cz, rad: B.rad || B.size });
      /* o.target [x,y,z] mm + o.rad mm: un punct anume (de ex. o balama), pentru fotografii de detaliu */
      if (o.target) Object.assign(R.cam, { cx: o.target[0] * MM, cy: o.target[1] * MM, cz: o.target[2] * MM, rad: (o.rad || 80) * MM });
      if (V) Object.assign(R.cam, { yaw: V.yaw, pitch: V.pitch, zoom: V.zoom });
      step(); stepCamera();
      R.scene.updateMatrixWorld(true);
      renderScene();
      const img = R.canvas.toDataURL("image/jpeg", 0.9);
      const labels = [];
      const M = R.model, v = new THREE.Vector3();
      if (M && M.ops) M.ops.pieces.forEach(pc => {
        const P = R.pieces.get(String(pc.pk)); if (!P || !P.g.visible) return;
        v.set((pc.min[0] + pc.max[0]) / 2 * MM, (pc.min[1] + pc.max[1]) / 2 * MM, (pc.min[2] + pc.max[2]) / 2 * MM);
        v.applyMatrix4(P.g.matrixWorld).project(R.camera);
        labels.push({ pk: pc.pk, n: pc.n, role: pc.role, x: (v.x + 1) / 2, y: (1 - v.y) / 2 });
      });
      return { img, labels, w, h };
    } finally {
      Object.assign(R.st, prev); R.spin = spin;
      if (V && pv) Object.assign(V, pv);
      resize();
    }
  },
  /* apropie camera de o piesă: pk, raza vizată (mm) și o deplasare (mm) față de centrul piesei;
     focusOn(null) revine la corpul întreg. Folosit la capturi și la filme. */
  focusOn(pk, radMm, off) { if (!this.ok) return; R.focusOv = pk == null ? null : { pk: String(pk), rad: radMm || 150, off: off || [0, 0, 0] }; R.need = true; kick(); },
  /* câte corpuri de feronerie sunt în scenă (pentru teste: schimbarea materialului nu le pierde) */
  /* ținta de mișcare a unei piese (pentru teste): translația și unghiul la deschidere/explozie */
  tgtOf(pk) { const P = R && R.pieces.get(String(pk)); return P ? { ex: P.tgt.ex / MM, ey: P.tgt.ey / MM, ez: P.tgt.ez / MM, ang: P.tgt.ang, sub: P.sub, pivot: P.pivot ? { ...P.pivot } : null } : null; },
  /* pentru teste: ce fel de plasă are fiecare piesă (prismă = contur propriu, altfel cutie unitate scalată) */
  meshKinds() { const o = []; if (R) for (const P of R.pieces.values()) o.push({ pk: P.pk, role: P.role, prism: P.meshes.map(m => !!m.userData.prism) }); return o; },
  hwCount() { let n = 0; if (R) for (const P of R.pieces.values()) n += P.hw.children.length; return n; },
  ssao(on) { SSAO.enabled = !!on; if (!on) SSAO.U.uAoOn.value = 0; if (R) { R.need = true; kick(); } },
  touch() { if (this.ok) { R.need = true; kick(); } },
  resize,
};

window.GL3D = GL3D;
if (typeof window.__gl3dReady === "function") window.__gl3dReady();

export { THREE, MM, buildPrism, buildVPrism, buildPrism3, isRectPC, pcOf, matKeyOf, boundsOf, explodeBoxes };
