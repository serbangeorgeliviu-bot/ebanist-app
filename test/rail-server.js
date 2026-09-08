/* Serverul de probă pentru Order Rail.
 *
 * Imită exact regulile din `netlify.toml` — redirect 302 pe /a/<slug>,
 * rescriere 200 pe inbox și pe pagina de comandă, /api/* către o
 * implementare în memorie a funcțiilor — plus header-ele de securitate,
 * citite din același `netlify.toml`. Fără asta, un CSP care rupe pagina
 * s-ar descoperi după deploy, de pe telefon.
 *
 * Magazia e în memorie și se golește la fiecare pornire: probele trebuie
 * să înceapă mereu de la zero, altfel a doua rulare trece din inerție.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json",
               ".webmanifest":"application/manifest+json", ".css":"text/css", ".svg":"image/svg+xml",
               ".png":"image/png", ".ico":"image/x-icon", ".zip":"application/zip" };

const NETLIFY_TOML = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
const CSP = (NETLIFY_TOML.match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || "";

const SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const ORDER_ID = /^[0-9]{6}-[2-9A-HJ-NP-Z]{4}(-v[0-9]{1,3})?$/;
const FLOW = ["received", "confirmed", "cut", "collected"];

function makeStore() { return { orders: new Map(), events: [] }; }

/* Aceleași reguli ca în netlify/functions/orders.js. E o a doua
 * implementare — și se știe: nu poate proba funcția adevărată, probează
 * CONTRACTUL (rutele, codurile, înghețarea, PIN-ul). Diferența e scrisă
 * în DECISIONS.md ca să nu se creadă altceva.
 */
function api(store, req, body, url, cfgOf) {
  const p = url.pathname.replace(/^\/api\/orders/, "").replace(/^\/+|\/+$/g, "");
  const parts = p ? p.split("/") : [];
  const pin = req.headers["x-inbox-pin"] || (body && body.pin) || url.searchParams.get("pin");

  if (url.pathname === "/api/stats") {
    if (req.method === "POST") {
      if (!body || !body.a || !SLUG.test(body.a)) return [400, { error: "bad-slug" }];
      store.events.push({ e: body.e, a: body.a, s: body.s, t: Date.now(), ms: body.ms });
      return [200, { ok: true }];
    }
    const slug = url.searchParams.get("atelier");
    if (!slug || !SLUG.test(slug)) return [400, { error: "bad-slug" }];
    const evs = store.events.filter(e => e.a === slug);
    const sess = new Set(evs.filter(e => e.e === "session_start").map(e => e.s));
    const sent = new Set(evs.filter(e => e.e === "order_sent").map(e => e.s));
    const times = evs.filter(e => e.e === "first_pdf_time" && typeof e.ms === "number").map(e => e.ms).sort((a, b) => a - b);
    return [200, {
      atelier: slug, sessions: sess.size, orders_sent: evs.filter(e => e.e === "order_sent").length,
      orders_confirmed: evs.filter(e => e.e === "order_confirmed").length,
      first_pdf_median_s: times.length ? Math.round(times[times.length >> 1] / 1000) : null,
      first_pdf_samples: times.length,
      abandon_rate: sess.size ? Math.round((1 - sent.size / sess.size) * 100) : null
    }];
  }

  if (req.method === "POST" && parts.length === 0) {
    const o = body && body.order;
    if (!o || !o.id || !o.atelier) return [400, { error: "missing-order" }];
    if (!SLUG.test(o.atelier)) return [400, { error: "bad-slug" }];
    if (!ORDER_ID.test(o.id)) return [400, { error: "bad-id" }];
    if (!o.customer || !o.customer.name || !o.customer.phone) return [400, { error: "missing-customer" }];
    const key = o.atelier + "/" + o.id;
    if (store.orders.has(key)) return [409, { error: "id-exists" }];
    store.orders.set(key, {
      order: o, lab: body.lab || null, snapshot: body.snapshot || null, docs: body.docs || {},
      received_at: new Date().toISOString(), status: "received",
      history: [{ at: new Date().toISOString(), status: "received" }]
    });
    return [200, { id: o.id, status: "received" }];
  }

  if (req.method === "GET" && parts.length === 0) {
    const slug = url.searchParams.get("atelier");
    if (!slug || !SLUG.test(slug)) return [400, { error: "bad-slug" }];
    const cfg = cfgOf(slug);
    if (!cfg || String(pin || "") !== String(cfg.pin)) return [401, { error: "bad-pin", insecure: true }];
    const out = [];
    for (const [k, rec] of store.orders) {
      if (!k.startsWith(slug + "/")) continue;
      out.push({
        id: rec.order.id, version: rec.order.version || 1, parent: rec.order.parent || null,
        customer: rec.order.customer, created_at: rec.order.created_at, status: rec.status,
        confirmed_at: rec.confirmed_at || null, hash: rec.order.hash,
        pieces: rec.order.pieces, modules: rec.order.modules,
        price: rec.order.price ? { total: rec.order.price.total, currency: rec.order.price.currency } : null
      });
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [200, { atelier: slug, count: out.length, insecure: true, orders: out }];
  }

  if (req.method === "GET" && parts.length === 1) {
    const slug = url.searchParams.get("atelier");
    if (!slug || !SLUG.test(slug)) return [400, { error: "bad-slug" }];
    if (!ORDER_ID.test(parts[0])) return [400, { error: "bad-id" }];
    const rec = store.orders.get(slug + "/" + parts[0]);
    return rec ? [200, rec] : [404, { error: "not-found" }];
  }

  if (req.method === "POST" && parts.length === 2) {
    const [id, action] = parts;
    if (!ORDER_ID.test(id)) return [400, { error: "bad-id" }];
    const slug = (body && body.atelier) || url.searchParams.get("atelier");
    if (!slug || !SLUG.test(slug)) return [400, { error: "bad-slug" }];
    const cfg = cfgOf(slug);
    if (!cfg || String(pin || "") !== String(cfg.pin)) return [401, { error: "bad-pin" }];
    const rec = store.orders.get(slug + "/" + id);
    if (!rec) return [404, { error: "not-found" }];
    if (action === "confirm") {
      if (rec.confirmed_at) return [200, { id, status: rec.status, confirmed_at: rec.confirmed_at, already: true }];
      rec.confirmed_at = new Date().toISOString();
      rec.status = "confirmed"; rec.frozen_hash = rec.order.hash;
      return [200, { id, status: rec.status, confirmed_at: rec.confirmed_at, frozen_hash: rec.frozen_hash }];
    }
    if (action === "status") {
      const next = String((body && body.status) || "");
      if (FLOW.indexOf(next) < 0) return [400, { error: "bad-status" }];
      if (rec.confirmed_at && FLOW.indexOf(next) < FLOW.indexOf("confirmed")) return [409, { error: "frozen" }];
      rec.status = next;
      return [200, { id, status: rec.status }];
    }
    return [404, { error: "unknown-action" }];
  }
  return [404, { error: "not-found" }];
}

function serve(store) {
  store = store || makeStore();
  const cfgCache = {};
  const cfgOf = slug => {
    if (cfgCache[slug] !== undefined) return cfgCache[slug];
    try { cfgCache[slug] = JSON.parse(fs.readFileSync(path.join(ROOT, "ateliers", slug + ".json"), "utf8")); }
    catch (e) { cfgCache[slug] = null; }
    return cfgCache[slug];
  };

  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const send = (code, headers, body) => { rq.writeHead(code, headers); rq.end(body); };
      const sendJson = (code, obj) => send(code, { "Content-Type": "application/json" }, JSON.stringify(obj));

      if (url.pathname.startsWith("/api/")) {
        let raw = "";
        req.on("data", c => raw += c);
        req.on("end", () => {
          let body = null;
          if (raw) { try { body = JSON.parse(raw); } catch (e) {} }
          const [code, out] = api(store, req, body, url, cfgOf);
          sendJson(code, out);
        });
        return;
      }

      // /a/<slug>  -> 302 verso l'app
      let m = url.pathname.match(/^\/a\/([a-z0-9][a-z0-9-]{0,40})\/?$/);
      if (m) return send(302, { Location: "/app/?atelier=" + m[1] }, "");
      // /a/<slug>/inbox e /a/<slug>/order/<id> -> riscrittura 200
      let rel = null;
      if (/^\/a\/[a-z0-9-]+\/inbox\/?$/.test(url.pathname)) rel = "order-rail/inbox.html";
      else if (/^\/a\/[a-z0-9-]+\/order\/[^\/]+\/?$/.test(url.pathname)) rel = "order-rail/order-view.html";
      else rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      if (rel.endsWith("/")) rel += "index.html";

      const f = path.join(ROOT, rel);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        return send(404, { "Content-Type": "text/plain" }, "404");
      }
      const h = { "Content-Type": MIME[path.extname(f)] || "application/octet-stream",
                  "X-Content-Type-Options": "nosniff" };
      if (CSP) h["Content-Security-Policy"] = CSP;
      rq.writeHead(200, h);
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(0, "127.0.0.1", () => res({ server: s, store, port: s.address().port }));
  });
}

module.exports = { serve, makeStore, api };
