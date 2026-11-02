/* =====================================================================
   Ebanist — proxy pentru Asistentul AI (D-107)
   ---------------------------------------------------------------------
     POST /api/ai
       Header  x-ebanist-license: <sub_… | cs_… | comp_…>   codul Pro
       Corp    cererea pentru Anthropic Messages API, neschimbată

   Cheia Anthropic stă numai în variabila de mediu ANTHROPIC_API_KEY din
   Netlify. Aplicația nu o mai vede, deci nu mai stă în localStorage și
   la următoarea rotire se schimbă o singură valoare, fără release.

   Cine poate apela: numai o licență Pro verificată (aceeași verificare
   ca /api/pro: Stripe sau cod comp_…). Licența Google Play nu se poate
   verifica de aici — acei utilizatori rămân pe cheia lor, ca până acum.
   Fără licență valabilă proxy-ul nu face niciun apel către Anthropic,
   deci nu poate fi folosit ca endpoint deschis pe banii noștri.

   Nu păstrează nimic. Trimite mai departe numai câmpurile cunoscute și
   numai modelele din listă; plafonează max_tokens.
   ===================================================================== */

import handlePro from "./pro.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
export const MODELS = ["claude-opus-5", "claude-sonnet-5"];
export const MAX_TOKENS = 4000;
const MAX_BODY = 5_500_000;          // limita funcțiilor Netlify e 6 MB
const FIELDS = ["model", "max_tokens", "system", "tools", "tool_choice", "messages"];
const CODE = /^(sub_[A-Za-z0-9]{8,64}|cs_(live|test)_[A-Za-z0-9]{10,200}|comp_[A-Za-z0-9]{24,64})$/;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex"
};
const reply = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: JSON_HEADERS });
const err = (message, s, type = "ebanist_proxy") => reply({ type: "error", error: { type, message } }, s);

/* Licențe verificate recent: nu întrebăm Stripe la fiecare mesaj. */
const TTL = 10 * 60 * 1000;
const seen = new Map();
export function _reset() { seen.clear(); }

async function licensed(code) {
  const hit = seen.get(code);
  if (hit && hit > Date.now()) return { ok: true };
  const payload = code.startsWith("cs_") ? { session: code } : { sub: code };
  const r = await handlePro(new Request("https://ebanist.com/api/pro", { method: "POST", body: JSON.stringify(payload) }));
  const j = await r.json().catch(() => null);
  if (r.status >= 500) return { ok: false, status: 503, message: "license-unavailable" };
  if (!j || !j.ok || j.status !== "active") return { ok: false, status: 403, message: "license-inactive" };
  seen.set(code, Date.now() + TTL);
  if (seen.size > 500) for (const [k, v] of seen) if (v < Date.now()) seen.delete(k);
  return { ok: true };
}

export default async (req) => {
  if (req.method !== "POST") return err("method", 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return err("not-configured", 503);

  const code = String(req.headers.get("x-ebanist-license") || "");
  if (!CODE.test(code)) return err("license-missing", 401);

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return err("too-large", 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return err("too-large", 413);

  let body;
  try { body = JSON.parse(raw); } catch (e) { return err("bad-json", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return err("bad-json", 400);
  if (!MODELS.includes(body.model)) return err("bad-model", 400);
  if (!Array.isArray(body.messages) || !body.messages.length) return err("bad-messages", 400);

  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = body[f];
  out.max_tokens = Math.min(Math.max(parseInt(out.max_tokens, 10) || 1024, 1), MAX_TOKENS);

  const lic = await licensed(code);
  if (!lic.ok) return err(lic.message, lic.status);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(out),
      signal: ctl.signal
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...JSON_HEADERS, "Content-Type": r.headers.get("content-type") || JSON_HEADERS["Content-Type"] }
    });
  } catch (e) {
    return err("unreachable", 504);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/ai" };
