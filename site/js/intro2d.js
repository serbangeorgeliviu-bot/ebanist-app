/* =====================================================================
   Ebanist — intro pe telefon (Canvas 2D, fără Three.js)
   Aceeași poveste ca pe desktop, geometrie simplificată: panoul brut,
   laserul, piesele, apoi piesele zboară spre dulapul din hero.
   ===================================================================== */
const BOARD = { l: 2800, w: 2070 };
/* în ordinea numelor din i18n (intro.pieces) */
const LAYOUT = [
  [0, 0, 2200, 600], [0, 604, 2200, 600], [0, 1208, 2082, 567], [2204, 0, 469, 567], [2204, 604, 469, 567],
  [0, 1779, 962, 80], [2086, 1208, 500, 165], [2086, 1377, 500, 165], [2086, 1546, 500, 165]
];
const CUTS = [[0, 602, 2800, 602], [0, 1206, 2800, 1206], [0, 1777, 2800, 1777], [2202, 0, 2202, 1206], [2084, 1206, 2084, 1777], [2086, 1375, 2800, 1375], [2086, 1544, 2800, 1544], [0, 1861, 964, 1861]];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createIntro2D({ canvas, labelsEl, names = [], target, onTitle, onDone }) {
  const g = canvas.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 1.5);   // telefonul are de lucru și cu restul paginii
  let vw = 0, vh = 0;
  function size() { vw = innerWidth; vh = innerHeight; canvas.width = vw * dpr; canvas.height = vh * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size();
  /* panoul în izometric, centrat */
  const k = Math.min(vw * .8 / (BOARD.l * .87 + BOARD.w * .87), vh * .5 / ((BOARD.l + BOARD.w) * .5));
  const ox = vw / 2 - (BOARD.l - BOARD.w) * .87 * k / 2, oy = vh * .42 - (BOARD.l + BOARD.w) * .5 * k / 2;
  const iso = (x, y) => [ox + (x - y) * .87 * k, oy + (x + y) * .5 * k];
  const quad = (x, y, l, w) => [iso(x, y), iso(x + l, y), iso(x + l, y + w), iso(x, y + w)];
  const tr = target ? target.getBoundingClientRect() : { left: vw * .25, top: vh * .1, width: vw * .5, height: vw * .5 };
  /* ținta: silueta dulapului din imaginea hero (aprox. 36% × 80% din cadru) */
  const tx = tr.left + tr.width * .27, ty = tr.top + tr.height * .04, tw = tr.width * .46, th = tr.height * .9;
  const img = new Image(); img.src = "/site/img/hero-carcass-900.webp";
  const labels = LAYOUT.map((_, i) => { const s = document.createElement("span"); const L = LAYOUT[i]; s.textContent = `${names[i] || "PART"} ${Math.max(L[2], L[3])}×${Math.min(L[2], L[3])}×19`; labelsEl.appendChild(s); return s; });
  let t0 = null, raf = 0, done = false, titled = false;
  function poly(p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  function frame(now) {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    g.clearRect(0, 0, vw, vh);
    const a = ease(seg(t, 0, .5));
    /* panoul: față + grosime, lumină laterală din stânga */
    if (t < 1.75) {
      g.globalAlpha = a;
      const q = quad(0, 0, BOARD.l, BOARD.w);
      const grd = g.createLinearGradient(q[3][0], 0, q[1][0], 0); grd.addColorStop(0, "#efe9de"); grd.addColorStop(1, "#bdb6aa");
      poly([q[3], q[2], [q[2][0], q[2][1] + 6], [q[3][0], q[3][1] + 6]]); g.fillStyle = "#8f877b"; g.fill();
      poly([q[1], q[2], [q[2][0], q[2][1] + 6], [q[1][0], q[1][1] + 6]]); g.fillStyle = "#a39b8f"; g.fill();
      poly(q); g.fillStyle = grd; g.fill();
      /* tăieturile deja făcute */
      const cutT = seg(t, .5, 1.6), n = CUTS.length, ci = Math.min(n - 1, Math.floor(cutT * n)), cf = cutT * n - ci;
      g.lineWidth = 1; g.strokeStyle = "rgba(42,38,35,.8)";
      for (let i = 0; i < ci; i++) { const c = CUTS[i]; const p0 = iso(c[0], c[1]), p1 = iso(c[2], c[3]); g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); }
      if (t > .5 && cutT < 1) {
        const c = CUTS[ci], px = c[0] + (c[2] - c[0]) * cf, py = c[1] + (c[3] - c[1]) * cf;
        const p0 = iso(c[0], c[1]), p1 = iso(px, py);
        /* strălucirea: o linie lată și transparentă sub cea subțire (fără shadowBlur, care e scump) */
        g.strokeStyle = "rgba(255,77,26,.28)"; g.lineWidth = 8; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke();
        g.strokeStyle = "#ff4d1a"; g.lineWidth = 2; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(p1[0], p1[1], 2.2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }
    /* 1.6 → 3.0: piesele se ridică și zboară în dulap, care apare în locul lor */
    if (t >= 1.6) {
      const fly = easeIO(seg(t, 1.8, 2.9)), fade = 1 - seg(t, 2.5, 2.95);
      const cx0 = tx + tw / 2, cy0 = ty + th / 2;
      LAYOUT.forEach((L, i) => {
        const q = quad(L[0], L[1], L[2], L[3]);
        const k2 = clamp(fly * 1.1 - i * .015);
        const qc = q.reduce((s, v) => [s[0] + v[0] / 4, s[1] + v[1] / 4], [0, 0]);
        const lift = ease(seg(t, 1.6, 1.85)) * 10, sc = 1 - .75 * k2;
        const p = q.map(c => [cx0 + (qc[0] - cx0) * (1 - k2) + (c[0] - qc[0]) * sc, cy0 + (qc[1] - cy0) * (1 - k2) + (c[1] - qc[1]) * sc - lift * (1 - k2) - Math.sin(k2 * Math.PI) * 50]);
        g.globalAlpha = fade;
        poly(p); g.fillStyle = "#e9e3d8"; g.fill(); g.strokeStyle = "rgba(42,38,35,.7)"; g.lineWidth = 1; g.stroke();
        const on = t > 1.65 + i * .03 && t < 2.15;
        labels[i].classList.toggle("on", on);
        if (on) { labels[i].style.left = qc[0] + "px"; labels[i].style.top = (qc[1] - 12 - i % 2 * 12) + "px"; }
      });
      g.globalAlpha = ease(seg(t, 2.4, 3.1));
      if (img.complete && img.naturalWidth) g.drawImage(img, tr.left, tr.top, tr.width, tr.height);
      g.globalAlpha = 1;
    }
    /* 2.9 → 3.8: cotele generale în jurul dulapului */
    const dT = seg(t, 2.9, 3.7);
    if (dT > 0) {
      g.strokeStyle = "#ff4d1a"; g.lineWidth = 1.2; g.fillStyle = "#ff4d1a"; g.font = "500 11px 'JetBrains Mono', monospace";
      const x0 = tx - 18, y0 = ty, y1 = ty + th * dT;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y1); g.moveTo(x0 - 5, y0); g.lineTo(x0 + 5, y0); if (dT >= 1) { g.moveTo(x0 - 5, y1); g.lineTo(x0 + 5, y1); } g.stroke();
      const yb = ty + th + 18, xb1 = tx + tw * dT;
      g.beginPath(); g.moveTo(tx, yb); g.lineTo(xb1, yb); g.moveTo(tx, yb - 5); g.lineTo(tx, yb + 5); if (dT >= 1) { g.moveTo(xb1, yb - 5); g.lineTo(xb1, yb + 5); } g.stroke();
      if (dT >= 1) { g.save(); g.translate(x0 - 8, ty + th / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText("2200", 0, 0); g.restore(); g.textAlign = "center"; g.fillText("1000", tx + tw / 2, yb + 16); }
    }
    if (!titled && t > 3.0) { titled = true; onTitle && onTitle(); }
    if (t < 4) raf = requestAnimationFrame(frame); else finish();
  }
  function finish() { if (done) return; done = true; cancelAnimationFrame(raf); labels.forEach(l => l.remove()); onDone && onDone(); }
  raf = requestAnimationFrame(frame);
  return { skip() { if (!titled) onTitle && onTitle(); finish(); } };
}
