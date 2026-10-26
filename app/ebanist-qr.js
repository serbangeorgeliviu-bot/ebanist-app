/* =====================================================================
   Ebanist — generator de cod QR (modul Atelier E2, D-92)

   Cod propriu, fără bibliotecă: etichetele se tipăresc și din PWA offline,
   deci nu avem de unde aduce un script la nevoie. Suportă mod octet,
   corecție de erori L sau M, versiunile 1–10 (până la 213 de octeți la M).
   Verificat în test/qr.test.js cu un decodor independent (jsQR).

   Algoritmul: ISO/IEC 18004 (structura de date, Reed-Solomon pe GF(256) cu
   polinomul 0x11D, 8 măști cu penalizare, informația de format și de versiune).
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EBQR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* indexat după versiune (0 neutilizat); nivel 0 = L, 1 = M */
  var ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
  ];
  var NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
  ];
  var FORMAT_BITS = [1, 0]; /* L = 01, M = 00 */
  var MAX_VERSION = 10;

  function utf8(str) {
    var out = [], s = unescape(encodeURIComponent(String(str)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var na = Math.floor(ver / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver, lvl) {
    return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[lvl][ver] * NUM_BLOCKS[lvl][ver];
  }

  /* — Reed-Solomon — */
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(deg) {
    var res = [], i, j, root = 1;
    for (i = 0; i < deg - 1; i++) res.push(0);
    res.push(1);
    for (i = 0; i < deg; i++) {
      for (j = 0; j < res.length; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return res;
  }
  function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ res.shift();
      res.push(0);
      divisor.forEach(function (c, i) { res[i] ^= gfMul(c, f); });
    });
    return res;
  }

  function addEccAndInterleave(data, ver, lvl) {
    var nb = NUM_BLOCKS[lvl][ver], eccLen = ECC_PER_BLOCK[lvl][ver];
    var raw = Math.floor(rawModules(ver) / 8);
    var numShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var blocks = [], div = rsDivisor(eccLen), k = 0, i, j;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (j = 0; j < blocks.length; j++) {
        if (i !== shortLen - eccLen || j >= numShort) out.push(blocks[j][i]);
      }
    }
    return out;
  }

  /* — matricea — */
  function alignPositions(ver) {
    if (ver === 1) return [];
    var na = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    var step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    var res = [6];
    for (var pos = size - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function build(codewords, ver, lvl) {
    var size = ver * 4 + 17, mod = [], fn = [], i, j;
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }

    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPositions(ver);
    for (i = 0; i < ap.length; i++) for (j = 0; j < ap.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    function drawFormat(mask) {
      var data = (FORMAT_BITS[lvl] << 3) | mask, rem = data;
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function bit(n) { return ((bits >>> n) & 1) !== 0; }
      var n;
      for (n = 0; n <= 5; n++) set(8, n, bit(n));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (n = 9; n < 15; n++) set(14 - n, 8, bit(n));
      for (n = 0; n < 8; n++) set(size - 1 - n, 8, bit(n));
      for (n = 8; n < 15; n++) set(8, size - 15 + n, bit(n));
      set(8, size - 8, true);
    }
    drawFormat(0); /* rezervă zona; se rescrie după alegerea măștii */

    if (ver >= 7) {
      var rem = ver;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vbits = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var b = ((vbits >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3);
        set(a, c, b); set(c, a, b);
      }
    }

    /* datele, în zigzag de la dreapta-jos */
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < codewords.length * 8) {
            mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }

    function applyMask(mask) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!fn[y][x] && inv) mod[y][x] = !mod[y][x];
      }
    }

    function penalty() {
      var score = 0, x, y, run, c;
      function lineScore(get) {
        var s = 0, r = 1, prev = get(0), k;
        for (k = 1; k < size; k++) {
          var cur = get(k);
          if (cur === prev) { r++; if (r === 5) s += 3; else if (r > 5) s++; }
          else { r = 1; prev = cur; }
        }
        var str = "";
        for (k = 0; k < size; k++) str += get(k) ? "1" : "0";
        var pos = -1;
        while ((pos = str.indexOf("10111010000", pos + 1)) >= 0) s += 40;
        pos = -1;
        while ((pos = str.indexOf("00001011101", pos + 1)) >= 0) s += 40;
        return s;
      }
      for (y = 0; y < size; y++) score += lineScore(function (k) { return mod[y][k]; });
      for (x = 0; x < size; x++) score += lineScore(function (k) { return mod[k][x]; });
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3;
      }
      var dark = 0;
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
      var total = size * size, k2 = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      return score + Math.max(k2, 0) * 10;
    }

    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var p = penalty();
      if (p < bestScore) { bestScore = p; best = m; }
      applyMask(m); /* anulează masca */
    }
    applyMask(best); drawFormat(best);
    return { size: size, modules: mod, version: ver, mask: best };
  }

  /* text → { size, modules[y][x], version, mask }; ridică dacă nu încape */
  function encode(text, level) {
    var lvl = level === "L" ? 0 : 1;
    var bytes = utf8(text), ver, cap;
    for (ver = 1; ver <= MAX_VERSION; ver++) {
      cap = dataCodewords(ver, lvl) * 8;
      var need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= cap) break;
    }
    if (ver > MAX_VERSION) throw new Error("qr:too_long");
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }
    for (var pad = 0xEC; data.length < dataCodewords(ver, lvl); pad ^= 0xEC ^ 0x11) data.push(pad);
    return build(addEccAndInterleave(data, ver, lvl), ver, lvl);
  }

  /* SVG cu zona liniștită de 4 module; `px` = latura în unități (mm pe etichetă) */
  function svg(text, opts) {
    opts = opts || {};
    var q = encode(text, opts.level), n = q.size, border = opts.border == null ? 4 : opts.border;
    var dim = n + border * 2, d = [];
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        if (!q.modules[y][x]) { x++; continue; }
        var x0 = x; while (x < n && q.modules[y][x]) x++;
        d.push("M" + (x0 + border) + " " + (y + border) + "h" + (x - x0) + "v1h-" + (x - x0) + "z");
      }
    }
    var size = opts.size ? ' width="' + opts.size + '" height="' + opts.size + '"' : "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + " " + dim + '"' + size +
      ' shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d.join("") + '" fill="#000"/></svg>';
  }

  /* octeți maximi la nivelul dat (pentru teste și avertismente) */
  function capacity(level) {
    var lvl = level === "L" ? 0 : 1;
    return Math.floor((dataCodewords(MAX_VERSION, lvl) * 8 - 4 - 16) / 8);
  }

  return { encode: encode, svg: svg, capacity: capacity };
});
