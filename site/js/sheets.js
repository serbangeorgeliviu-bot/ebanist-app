/* „Câte plăci îți trebuie?" — folosește ebanist-nest.js, același cod ca în aplicație (D-156, 5.79.0).
   Se încarcă numai când secțiunea apare pe ecran; fără JS rămân textul și butonul spre aplicație. */
(function () {
  var sec = document.getElementById("sheets");
  if (!sec) return;
  var rows = document.getElementById("shRows"), res = document.getElementById("shRes"), svgs = document.getElementById("shSvgs");
  var sel = document.getElementById("shBoard"), D = sec.dataset, KERF = 4, MAXROWS = 30;
  var def = [[800, 400, 6], [720, 560, 4], [1200, 300, 2]];
  var loaded = false;

  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function addRow(v) {
    if (rows.children.length >= MAXROWS) return;
    var r = document.createElement("div"); r.className = "sh-row";
    ["l", "w", "q"].forEach(function (k, i) {
      var inp = document.createElement("input");
      inp.type = "number"; inp.inputMode = "numeric"; inp.min = "1"; inp.max = k === "q" ? "999" : "5000"; inp.step = "1";
      inp.value = v ? v[i] : ""; inp.dataset.k = k; inp.setAttribute("aria-label", sec.querySelectorAll(".sh-head span")[i].textContent);
      r.appendChild(inp);
    });
    var x = document.createElement("button"); x.type = "button"; x.className = "sh-x"; x.textContent = "×"; x.setAttribute("aria-label", D.rm);
    x.onclick = function () { r.remove(); calc(); };
    r.appendChild(x); rows.appendChild(r);
  }
  function read() {
    var out = [];
    Array.prototype.forEach.call(rows.children, function (r) {
      var v = {}; Array.prototype.forEach.call(r.querySelectorAll("input"), function (i) { v[i.dataset.k] = Math.round(+i.value); });
      if (v.l > 0 && v.w > 0 && v.q > 0) out.push({ lung: v.l, larg: v.w, pz: Math.min(v.q, 999) });
    });
    return out;
  }
  function svg(bd, i, total) {
    var W = 300, s = W / bd.L, H = Math.round(bd.W * s), o = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + fmt(D.lbl, { i: i + 1 }) + '"><rect class="b" width="' + W + '" height="' + H + '"/>';
    bd.rects.forEach(function (r) { o += '<rect class="p" x="' + (r.x * s).toFixed(1) + '" y="' + (r.y * s).toFixed(1) + '" width="' + (r.w * s).toFixed(1) + '" height="' + (r.h * s).toFixed(1) + '"/>'; });
    return '<figure><figcaption class="mono">' + fmt(D.lbl, { i: i + 1 }) + " · " + Math.round(bd.eff) + "%</figcaption>" + o + "</svg></figure>";
  }
  function calc() {
    if (!window.EBNest) return;
    var pcs = read(), b = sel.value.split("x"), L = +b[0], W = +b[1], label = b[0] + "×" + b[1];
    svgs.innerHTML = "";
    if (!pcs.length) { res.textContent = D.empty; res.className = "sh-res"; return; }
    var r = EBNest.nest(pcs, L, W, KERF, null);
    if (r.skipped.length) { res.textContent = D.err; res.className = "sh-res bad"; return; }
    var n = r.panels.length, used = 0, total = 0, cnt = 0;
    r.panels.forEach(function (p) { used += p.used; total += p.L * p.W; cnt += p.rects.length; });
    var u = Math.round(used / total * 100);
    res.className = "sh-res";
    res.innerHTML = "<b>" + (n === 1 ? fmt(D.res1, { b: label }) : fmt(D.res, { n: n, b: label })) + "</b><span>" +
      fmt(D.use, { u: u, w: 100 - u }) + " · " + fmt(D.pcs, { p: cnt, n: n, bw: n === 1 ? D.board1 : D.boards }) + "</span>";
    svgs.innerHTML = r.panels.slice(0, 4).map(function (p, i) { return svg(p, i, n); }).join("");
  }
  function init() {
    if (loaded) return; loaded = true;
    def.forEach(addRow);
    document.getElementById("shAdd").onclick = function () { addRow(); var l = rows.lastChild.querySelector("input"); if (l) l.focus(); };
    var t; rows.addEventListener("input", function () { clearTimeout(t); t = setTimeout(calc, 120); });
    sel.onchange = calc;
    var s = document.createElement("script");
    s.src = "/app/ebanist-nest.js"; s.onload = calc; document.head.appendChild(s);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { o.disconnect(); init(); } }); }, { rootMargin: "300px" }).observe(sec);
  } else init();
})();
