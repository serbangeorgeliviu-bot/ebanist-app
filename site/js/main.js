/* =====================================================================
   Ebanist — site de prezentare · scriptul inițial (fără dependențe)
   ---------------------------------------------------------------------
   Tot ce e greu (Three.js, GSAP, Lenis) se încarcă DUPĂ prima randare și
   doar unde are sens: 3D numai pe desktop cu WebGL, GSAP + Lenis numai
   pe desktop. Pe telefon: Canvas 2D pentru intro, scroll nativ, carusel.
   ===================================================================== */
(function () {
  "use strict";
  var EB = window.EB || {}, doc = document, root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var mm = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  var REDUCE = mm("(prefers-reduced-motion: reduce)");
  var DESKTOP = mm("(min-width: 901px) and (hover: hover) and (pointer: fine)");
  var store = function (s, k, v) { try { if (v === undefined) return window[s].getItem(k); window[s].setItem(k, v); } catch (e) { return null; } };

  /* Din iconița instalată (PWA vechi, start_url „/") se intră direct în
     aplicație: acolo nu e un vizitator, e cineva care a apăsat pe app. */
  if (mm("(display-mode: standalone)") && !location.search) { location.replace(EB.app || "/app/"); return; }

  root.classList.remove("no-js"); root.classList.add("js");

  function webgl() {
    try { var c = doc.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
  }
  var GL = DESKTOP && !REDUCE && webgl();
  function loadScript(src) { return new Promise(function (ok, ko) { var s = doc.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; doc.head.appendChild(s); }); }
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 200); };

  /* ---------- antetul devine opac după primii pixeli ---------- */
  var top = $("#top");
  function onScrollHead() { top.classList.toggle("solid", (window.scrollY || 0) > 30); }
  addEventListener("scroll", onScrollHead, { passive: true }); onScrollHead();

  /* ---------- titluri: dezvăluire pe linii, cu mască ----------
     În trei treceri (scriu tot, citesc tot, scriu tot): o singură
     reașezare a paginii, nu câte una pe titlu. */
  function doSplits() {
    var els = $$(".split").filter(function (el) { return !el.dataset.split; });
    els.forEach(function (el) {
      el.dataset.split = "1"; var html = [];
      Array.prototype.forEach.call(el.childNodes, function (n) {
        if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(function (w) { if (w.trim()) html.push(w.replace(/&/g, "&amp;").replace(/</g, "&lt;")); });
        else if (n.nodeType === 1) n.textContent.split(/\s+/).forEach(function (w) { if (w) html.push("<" + n.tagName.toLowerCase() + ">" + w + "</" + n.tagName.toLowerCase() + ">"); });
      });
      el.innerHTML = html.map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    });
    var all = els.map(function (el) { var lines = [], last = null; $$(".w", el).forEach(function (w) { var t = w.offsetTop; if (last === null || Math.abs(t - last) > 4) { lines.push([]); last = t; } lines[lines.length - 1].push(w.innerHTML); }); return lines; });
    els.forEach(function (el, i) { el.innerHTML = all[i].map(function (l) { return '<span class="ln"><span>' + l.join(" ") + "</span></span>"; }).join(""); });
  }
  (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(doSplits);

  /* ---------- foile (tabel, etichete, fișa de montaj) ----------
     Sunt desenate la mărimea lor naturală, cu text lizibil, și scalate
     vizual în cadrul lor — ca o foaie pusă pe masă, nu un text mic. */
  function fitAll() {
    $$(".fit").forEach(function (el) {
      var box = el.parentElement, pw = box.clientWidth - 24, ph = box.clientHeight - 24;
      if (pw <= 0 || ph <= 0) return;
      el.style.setProperty("--fs", Math.min(pw / el.offsetWidth, ph / el.offsetHeight, 1.1).toFixed(4));
    });
  }
  var fitT = 0; addEventListener("resize", function () { clearTimeout(fitT); fitT = setTimeout(fitAll, 120); });

  /* ---------- intrări la scroll ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add(e.target.classList.contains("prob-row") ? "cut" : "in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -12% 0px", threshold: .15 }) : null;
  /* „cut” numai pe .prob-row: .cut e și clasa tabelului (font-size 13px) */
  function show(el) { el.classList.add(el.classList.contains("prob-row") ? "cut" : "in"); }
  function watch() { $$(".rv,.split,.pile,.final,.c-draw,.prob-row").forEach(function (el) { io ? io.observe(el) : show(el); }); }
  if (REDUCE) $$(".rv,.split,.pile,.final,.prob-row").forEach(show);
  else (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(watch);

  /* ---------- cifre care numără ---------- */
  function countUp(el) {
    var txt = el.textContent, nums = txt.match(/\d+(?:[.,]\d+)?/g); if (!nums || REDUCE) return;
    var t0 = null, dur = 1200;
    function f(now) {
      if (t0 === null) t0 = now; var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3), i = 0;
      el.textContent = txt.replace(/\d+(?:[.,]\d+)?/g, function (n) { var dec = (n.split(/[.,]/)[1] || "").length, sep = n.indexOf(",") > -1 ? "," : "."; var v = (parseFloat(n.replace(",", ".")) * e).toFixed(dec); i++; return dec ? v.replace(".", sep) : v; });
      if (p < 1) requestAnimationFrame(f); else el.textContent = txt;
    }
    requestAnimationFrame(f);
  }
  var cio = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } }); }, { threshold: .6 }) : null;
  $$(".tot,.off dd,.story-head .note").forEach(function (el) { cio && cio.observe(el); });

  /* ---------- preț și cumpărare: billing.js e singura sursă ---------- */
  var B = window.BILLING || {};
  if (B.PRICE_MONTHLY && $("#proAmt")) $("#proAmt").textContent = String(B.PRICE_MONTHLY).replace(/\s*€$/, "") + " €";
  if (B.configured && B.buyUrl) {
    var m = $("#buyM"), y = $("#buyY");
    if (m) { m.href = B.buyUrl("monthly", ""); m.rel = "noopener"; }
    if (y) { y.href = B.buyUrl("yearly", ""); y.rel = "noopener"; }
    var f = $("#buyF");
    if (f) { if (B.hasPlan && B.hasPlan("founders")) { f.href = B.buyUrl("founders", ""); f.rel = "noopener"; } else { f.closest(".tier").remove(); } }
  }

  /* ---------- limba aleasă de mână (D-60) ----------
     Rădăcina „/" trimite la /ro/ /it/ /fr/ după limba browserului
     (netlify/edge-functions/lang.js). Cine alege o limbă primește
     cookie-ul eb_lang, pe care funcția îl citește ÎNAINTEA limbii
     browserului: alegerea lui câștigă de acum încolo. E singurul cookie al
     site-ului, funcțional, pus numai la un click pe o limbă; nu identifică
     pe nimeni. */
  function pickLang(l) {
    store("localStorage", "eb_lang_ok", "1");
    if (!l || !EB.langs || EB.langs.indexOf(l) < 0) return;
    try { doc.cookie = "eb_lang=" + l + ";path=/;max-age=31536000;samesite=lax" + (location.protocol === "https:" ? ";secure" : ""); } catch (e) {}
  }

  /* ---------- sugestie de limbă ---------- */
  (function () {
    var box = $("#suggest"); if (!box || !EB.langs) return;
    if (store("localStorage", "eb_lang_ok")) return;
    if (doc.referrer && doc.referrer.indexOf(location.origin) === 0) return;
    var want = null;
    (navigator.languages || [navigator.language || ""]).some(function (l) { var c = String(l).slice(0, 2).toLowerCase(); if (EB.langs.indexOf(c) > -1) { want = c; return true; } return false; });
    if (!want || want === EB.lang) return;
    var s = EB.suggest[want];
    $("#suggestText").textContent = s.text.replace("{lang}", EB.langNames[want]);
    var go = $("#suggestGo"); go.textContent = s.go; go.href = EB.home[want]; go.lang = want;
    box.lang = want; box.hidden = false;
    var close = function () { box.hidden = true; store("localStorage", "eb_lang_ok", "1"); };
    $("#suggestX").addEventListener("click", close);
    go.addEventListener("click", function () { box.hidden = true; pickLang(want); });
  })();
  $$(".langs a, .lang-menu a").forEach(function (a) { a.addEventListener("click", function () { pickLang(a.getAttribute("hreflang")); }); });

  /* lista de limbi de pe telefon se închide la un tap în afara ei și la Escape */
  (function () {
    var d = $(".lang-pick"); if (!d) return;
    doc.addEventListener("click", function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && d.open) { d.open = false; d.querySelector("summary").focus(); } });
  })();

  /* ---------- lightbox pentru foile reale ---------- */
  (function () {
    var dlg = $("#lightbox"), sheets = $$(".sheet-doc"); if (!dlg || !sheets.length || !dlg.showModal) return;
    var img = $("#lbImg"), cap = $("#lbCap"), cur = 0, opener = null;
    function show(i) { cur = (i + sheets.length) % sheets.length; var s = sheets[cur]; img.src = s.dataset.full; img.alt = s.dataset.cap; cap.textContent = String(cur + 1).padStart(2, "0") + " / " + sheets.length + " · " + s.dataset.cap; }
    sheets.forEach(function (s, i) { s.addEventListener("click", function () { opener = s; show(i); dlg.showModal(); }); });
    $("#lbClose").addEventListener("click", function () { dlg.close(); });
    $("#lbPrev").addEventListener("click", function () { show(cur - 1); });
    $("#lbNext").addEventListener("click", function () { show(cur + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") show(cur + 1); if (e.key === "ArrowLeft") show(cur - 1); });
    dlg.addEventListener("close", function () { opener && opener.focus(); });
  })();

  /* ---------- cursorul de trasare, cu coordonate în mm ---------- */
  if (DESKTOP && !REDUCE) {
    var xh = $("#xhair"), xt = $("#xhairTxt"), mmPx = 25.4 / 96, px = 0, py = 0, pend = false;
    addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return; px = e.clientX; py = e.clientY; root.classList.add("xh");
      if (!pend) { pend = true; requestAnimationFrame(function () { pend = false; xh.style.transform = "translate(" + px + "px," + py + "px)"; xt.textContent = "x " + Math.round(px * mmPx) + " · y " + Math.round((py + (window.scrollY || 0)) * mmPx); }); }
    }, { passive: true });
    doc.addEventListener("mouseleave", function () { root.classList.remove("xh"); });
  }

  /* ---------- povestea: pin pe desktop, carusel pe telefon ---------- */
  var story = $("#story"), pin = $("#storyPin"), stps = $$(".stp"), svs = [$(".sv-a"), $(".sv-b"), $(".sv-c"), $(".sv-d"), $(".sv-e")];
  var ticks = $$(".rail-ticks li"), railFill = $("#railFill"), storyCanvas = $("#storyCanvas");
  var story3d = null, storyIdx = -1;
  function setParams(w, h, d) { var P = $$("#params dd"); if (P.length) { P[0].textContent = w; P[1].textContent = h; P[2].textContent = d; } }
  function storyProgress(p) {
    var idx = Math.min(4, Math.floor(p * 5));
    if (railFill) railFill.style.setProperty("--p", p.toFixed(3));
    if (idx !== storyIdx) {
      storyIdx = idx;
      stps.forEach(function (s, i) { s.classList.toggle("on", i === idx); });
      ticks.forEach(function (t, i) { t.classList.toggle("on", i <= idx); });
      svs.forEach(function (s, i) {
        if (!s) return;
        var on = story3d ? (i === idx && i >= 2) : i === idx;
        s.classList.toggle("on", on);
      });
    }
    /* tabelul apare după ce piesele s-au culcat */
    if (story3d) {
      story3d.set(p);
      storyCanvas.style.opacity = p < .49 ? 1 : Math.max(0, 1 - (p - .49) / .03);
      if (svs[2]) svs[2].classList.toggle("on", p >= .5 && idx === 2);
    }
  }
  var track = null;
  if (story && !mm("(max-width: 900px)")) {
    /* piesa centrală: secțiunea se „fixează" și scroll-ul o derulează */
    track = doc.createElement("div"); track.className = "story-track";
    track.style.cssText = "position:relative;height:" + (REDUCE ? "auto" : "520vh");
    pin.parentNode.insertBefore(track, pin); track.appendChild(pin);
    if (!REDUCE) { pin.style.position = "sticky"; pin.style.top = "0"; }
    $$("tbody tr", story).forEach(function (tr, i) { tr.style.setProperty("--i", i); });
    var manual = function () {
      var r = track.getBoundingClientRect(), span = track.offsetHeight - innerHeight;
      storyProgress(Math.min(1, Math.max(0, -r.top / Math.max(1, span))));
    };
    if (REDUCE) storyProgress(0); else { addEventListener("scroll", manual, { passive: true }); manual(); }
    story._manual = manual;
  } else if (story) {
    /* telefon: carusel orizontal cu snap, fără pin lung */
    var wrap = doc.createElement("div"); wrap.className = "mstory";
    stps.forEach(function (s, i) {
      var card = doc.createElement("article"); card.className = "mcard";
      var v = doc.createElement("div"); v.className = "mv";
      var src = svs[i]; if (src) { var c = src.cloneNode(true); c.classList.add("on"); v.appendChild(c); }
      var tx = doc.createElement("div"); tx.className = "mt";
      tx.innerHTML = s.innerHTML; var pr = $(".params", tx); if (pr) pr.remove();
      card.appendChild(v); card.appendChild(tx); wrap.appendChild(card);
    });
    $$("img", wrap).forEach(function (im) { im.loading = "lazy"; });
    var dots = doc.createElement("div"); dots.className = "mdots"; dots.innerHTML = stps.map(function (_, i) { return "<i" + (i ? "" : ' class="on"') + "></i>"; }).join("");
    pin.parentNode.insertBefore(wrap, pin); pin.parentNode.insertBefore(dots, pin);
    wrap.addEventListener("scroll", function () { var i = Math.round(wrap.scrollLeft / (wrap.scrollWidth / stps.length)); $$("i", dots).forEach(function (d, k) { d.classList.toggle("on", k === i); }); }, { passive: true });
    pin.style.display = "none";
  }
  fitAll(); (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(fitAll);

  /* ---------- intro: o singură dată pe sesiune, sărită oricând ---------- */
  var intro = $("#intro"), heroStage = $("#heroStage");
  var wantIntro = !REDUCE && !store("sessionStorage", "eb_intro") && intro;
  var introCtl = null, introEnded = !wantIntro;
  function endIntro() {
    if (introEnded) return; introEnded = true;
    store("sessionStorage", "eb_intro", "1");
    intro.classList.add("out"); doc.body.style.overflow = "";
    setTimeout(function () { intro.hidden = true; }, 800);
    startHero();
  }
  function titleIn() {
    var w = $("#introWord"); if (!w.dataset.done) { w.dataset.done = 1; w.innerHTML = w.textContent.split("").map(function (c, i) { return '<b style="transition-delay:' + (i * 55) + 'ms">' + c + "</b>"; }).join(""); }
    requestAnimationFrame(function () { w.classList.add("on"); $(".intro-title").classList.add("on"); });
  }
  if (wantIntro) {
    intro.hidden = false; intro.removeAttribute("aria-hidden"); doc.body.style.overflow = "hidden";
    $("#introSkip").addEventListener("click", function () { introCtl ? introCtl.skip() : endIntro(); });
    addEventListener("keydown", function k(e) { if (e.key === "Escape") { removeEventListener("keydown", k); introCtl ? introCtl.skip() : endIntro(); } });
    var opts = { canvas: $("#introCanvas"), labelsEl: $("#introLabels"), names: EB.pieces || [], target: heroStage, onTitle: titleIn, onDone: function () { setTimeout(endIntro, 450); } };
    var failsafe = setTimeout(endIntro, 6500);
    var go = GL ? import("/site/js/scene3d.js?v=" + EB.ver).then(function (m) { introCtl = m.createIntro(opts); })
                : import("/site/js/intro2d.js?v=" + EB.ver).then(function (m) { introCtl = m.createIntro2D(opts); });
    go.catch(function () { clearTimeout(failsafe); endIntro(); });
  }

  /* ---------- 3D + GSAP + Lenis, după prima randare (desktop) ---------- */
  var heroStarted = false;
  function startHero() {
    if (heroStarted || !GL) return; heroStarted = true;
    import("/site/js/scene3d.js?v=" + EB.ver).then(function (m) {
      m.createHero({ canvas: $("#heroCanvas"), dimsEl: $("#heroDims"), stageEl: heroStage });
      if (track) {
        story.classList.add("gl");
        story3d = m.createStory({ canvas: storyCanvas, onParams: setParams });
        storyIdx = -1; story._manual && story._manual();
      }
    }).catch(function () {});
  }
  function startMotion() {
    if (!DESKTOP || REDUCE) return;
    Promise.all([loadScript("/site/vendor/gsap.min.js"), loadScript("/site/vendor/lenis.min.js")])
      .then(function () { return loadScript("/site/vendor/ScrollTrigger.min.js"); })
      .then(function () {
        var gsap = window.gsap, ST = window.ScrollTrigger; if (!gsap || !ST) return;
        gsap.registerPlugin(ST);
        if (window.Lenis) {
          var lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
          root.classList.add("lenis");
          lenis.on("scroll", ST.update);
          gsap.ticker.add(function (t) { lenis.raf(t * 1000); }); gsap.ticker.lagSmoothing(0);
          $$('a[href^="#"]').forEach(function (a) { a.addEventListener("click", function (e) { var t = $(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -70 }); } }); });
        }
        /* povestea: ScrollTrigger dă progresul, fără salturi */
        if (track) {
          removeEventListener("scroll", story._manual);
          ST.create({ trigger: track, start: "top top", end: "bottom bottom", scrub: .6, onUpdate: function (s) { storyProgress(s.progress); } });
        }
        /* hero: textul se retrage ușor la ieșire */
        gsap.to(".hero-copy", { yPercent: -12, opacity: .2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
      }).catch(function () {});
  }
  function afterFirstPaint() {
    idle(function () {
      startMotion();
      if (introEnded) startHero();
    });
  }
  if (doc.readyState === "complete") afterFirstPaint(); else addEventListener("load", afterFirstPaint);
})();
