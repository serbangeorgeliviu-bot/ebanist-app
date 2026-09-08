/* Ebanist Order Rail — proba fluxului întreg, în browser.
 *
 *   cd test && npm run test:rail
 *
 * Ce acoperă: linkul de atelier, corpul implicit, prețul live, trimiterea
 * comenzii cu tot pachetul, inbox-ul cu PIN, confirmarea care îngheață,
 * versionarea v1→v2 cu diff, evenimentele, și rutele.
 *
 * Rutele se probează pe serverul din `rail-server.js`, care imită
 * `netlify.toml`. Verificarea cu `curl` pe domeniul public din cerință nu
 * se poate face din sesiunea asta (fără CLI Netlify și fără token — vezi
 * DECISIONS.md §1.1), deci aceleași verificări se fac aici, ca să nu
 * rămână nedovedite.
 */
const { serve } = require("./rail-server.js");
const { chromium } = require("playwright");

const results = [];
function ok(name, cond, detail) {
  results.push({ name, cond });
  console.log((cond ? "  \x1b[32m✓\x1b[0m " : "  \x1b[31m✗\x1b[0m ") + name +
    (detail !== undefined ? "  \x1b[2m→ " + detail + "\x1b[0m" : ""));
}
const head = s => console.log("\n\x1b[1m" + s + "\x1b[0m");
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { server, port, store } = await serve();
  const O = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, locale: "ro-RO" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", e => errs.push(String(e)));

  head("Rute — linkul scurt duce în aplicație, inbox-ul e pagina lui");
  {
    const r1 = await fetch(`${O}/a/demo`, { redirect: "manual" });
    ok("/a/demo redirecționează", r1.status === 302, r1.status + " → " + r1.headers.get("location"));
    ok("...spre aplicație, cu slug-ul în query", r1.headers.get("location") === "/app/?atelier=demo");
    const r2 = await fetch(`${O}/a/centro-legno`, { redirect: "manual" });
    ok("/a/centro-legno la fel", r2.headers.get("location") === "/app/?atelier=centro-legno");
    for (const p of ["/a/demo/inbox", "/a/centro-legno/inbox"]) {
      const r = await fetch(`${O}${p}`);
      const t = await r.text();
      ok(`${p} răspunde 200 cu pagina de inbox`, r.status === 200 && /id="gate"/.test(t), r.status);
    }
    const r3 = await fetch(`${O}/a/demo/order/260908-ABCD`);
    ok("/a/<slug>/order/<id> răspunde 200", r3.status === 200);
    for (const s of ["demo", "centro-legno"]) {
      const r = await fetch(`${O}/ateliers/${s}.json`);
      const j = await r.json();
      ok(`configurația ${s} se citește și e completă`,
        r.status === 200 && j.price_list && j.currency && j.language,
        j.name + " · " + j.currency + " · TVA " + j.price_list.vat + "%");
    }
  }

  head("Linkul de atelier — ce vede un necunoscut în prima secundă");
  await pg.goto(`${O}/a/demo`);
  await pg.waitForTimeout(3000);
  {
    const s = await pg.evaluate(() => ({
      active: OrderRail.active(), name: OrderRail.cfg && OrderRail.cfg.name,
      pro: isPro(), lang: state.lang,
      brand: document.querySelector(".brand-txt h1").textContent,
      pieces: proj() ? proj().pieces.length : 0,
      qty: proj() ? proj().pieces.reduce((a, x) => a + x.pz, 0) : 0,
      bar: document.getElementById("orBar").classList.contains("on"),
      btn: document.getElementById("orSendLbl").textContent,
      sheets: [...document.querySelectorAll(".sheet.on")].map(x => x.id)
    }));
    ok("modul atelier e activ", s.active);
    ok("limba e cea a atelierului", s.lang === "ro", s.lang);
    ok("numele atelierului a luat locul mărcii", s.brand === "Atelier Demo", s.brand);
    ok("limitele cad: isPro() e adevărat fără nicio licență", s.pro);
    ok("corpul implicit e deja generat", s.pieces > 0, s.pieces + " rânduri, " + s.qty + " piese");
    ok("bara de preț e pe ecran", s.bar);
    ok("butonul cheamă atelierul pe nume", /Atelier Demo/.test(s.btn), s.btn);
    ok("niciun panou nu stă în drum: fără intro, fără Pro", s.sheets.length === 0, s.sheets.join(",") || "niciunul");
    ok("niciun avertisment de material necotat pe corpul implicit",
      await pg.evaluate(() => document.getElementById("orWarn").hidden));
  }

  head("Prețul — se mișcă odată cu cotele, și se adună");
  {
    const before = await pg.evaluate(() => OrderRail.price(proj(), orDeps()).total);
    await pg.evaluate(() => { proj().pieces[0].pz = 4; persist(); render(); });
    await pg.waitForTimeout(300);
    const after = await pg.evaluate(() => OrderRail.price(proj(), orDeps()).total);
    ok("mai multe piese → preț mai mare", after > before, before + " → " + after);
    await pg.evaluate(() => { proj().pieces[0].pz = 2; persist(); render(); });
    await pg.waitForTimeout(300);
    const back = await pg.evaluate(() => OrderRail.price(proj(), orDeps()).total);
    ok("și se întoarce exact, fără drift de rotunjire", back === before, back + " vs " + before);
    ok("suma corpurilor dă netul",
      await pg.evaluate(() => EBPrice.modulesMatchTotal(OrderRail.price(proj(), orDeps()))));
    /* Ecranul scrie „1.222,57 RON": separatorul de mii e punctul în
       română. Se compară cifrele, nu formatarea. */
    const shown = await pg.textContent("#orAmt");
    const soloCifre = s => String(s).replace(/[^0-9]/g, "");
    ok("cifra de pe ecran e cea calculată",
      soloCifre(shown) === soloCifre(back.toFixed(2)), shown + " vs " + back);
    ok("accesoriile NU intră în m² de placă",
      await pg.evaluate(() => {
        const b = OrderRail.boq(proj(), orDeps());
        return !b.materials.some(m => isAccessoryMat(m.label));
      }));
  }

  head("Trimiterea comenzii");
  let id1 = null;
  {
    await pg.click("#orSendBtn"); await wait(500);
    ok("cere nume și telefon, fără cont", await pg.isVisible("#orName") && await pg.isVisible("#orPhone"));
    await pg.click("#orConfirmBtn"); await wait(400);
    ok("refuză fără nume", (await pg.textContent("#orFormMsg")).length > 0, await pg.textContent("#orFormMsg"));
    await pg.fill("#orName", "Ion Popescu");
    await pg.click("#orConfirmBtn"); await wait(400);
    ok("refuză fără telefon", store.orders.size === 0);
    await pg.fill("#orPhone", "0722334455");
    await pg.click("#orConfirmBtn"); await wait(3500);

    ok("comanda a ajuns pe server", store.orders.size === 1, store.orders.size);
    id1 = [...store.orders.keys()][0].split("/")[1];
    const rec = store.orders.get("demo/" + id1);
    ok("id-ul se poate citi la telefon", /^\d{6}-[2-9A-HJ-NP-Z]{4}$/.test(id1), id1);
    ok("pachetul are toate documentele",
      ["distinta", "montaj", "etichete"].every(k => rec.docs[k] && rec.docs[k].length > 500),
      Object.keys(rec.docs).join(", "));
    ok("...și pachetul de laborator", !!rec.lab && Array.isArray(rec.lab.pieces) && rec.lab.pieces.length > 0);
    ok("...și snapshot-ul complet", !!rec.snapshot && !!rec.snapshot.project);
    ok("pachetul de laborator NU conține prețuri",
      !/\bprice\b|\bprezzo\b|\bpret\b/i.test(JSON.stringify(rec.lab)));
    ok("hash SHA-256 pe snapshot", /^[0-9a-f]{64}$/.test(rec.order.hash), rec.order.hash.slice(0, 16) + "…");
    ok("versiunea aplicației călătorește cu comanda", !!rec.order.appVer, rec.order.appVer);
    ok("prețul e în comandă, defalcat", rec.order.price.total > 0 && rec.order.price.lines.length > 0,
      rec.order.price.total + " " + rec.order.price.currency);
    /* Se caută ELEMENTUL, nu cuvântul: stilul de tipărire luat din
       aplicație conține și regulile filigranului, iar o căutare de text
       le-ar confunda cu un filigran pus pe document. */
    ok("documentele nu au filigran: e un atelier, nu o versiune gratuită",
      !/<div class="wm-(diag|foot)"/.test(rec.docs.distinta) &&
      !/VERSIUNE GRATUIT|VERSIONE GRATUITA|FREE VERSION|VERSION GRATUITE/i.test(
        rec.docs.distinta.replace(/<style[\s\S]*?<\/style>/g, "")));
    ok("documentele poartă numele atelierului", /Atelier Demo/.test(rec.docs.distinta));
    ok("documentul e autonom, fără resurse externe",
      /<!DOCTYPE html>/.test(rec.docs.distinta) && !/<link[^>]+href="http/.test(rec.docs.distinta));
    const wa = await pg.getAttribute('a[href^="https://wa.me"]', "href");
    const waTxt = decodeURIComponent(wa || "");
    ok("linkul de WhatsApp conține id, client și preț",
      waTxt.includes(id1) && waTxt.includes("Ion Popescu") && /\d/.test(waTxt), (wa || "").slice(0, 60) + "…");
    ok("...și linkul direct la comandă", waTxt.includes("/a/demo/order/" + id1));
  }

  head("Hash stabil — același proiect, același număr");
  {
    const same = await pg.evaluate(async () => {
      const snap = { project: proj(), settings: { a: 1 } };
      const h1 = await OrderPkg.sha256(OrderPkg.canonical(snap));
      const h2 = await OrderPkg.sha256(OrderPkg.canonical(JSON.parse(JSON.stringify(snap))));
      /* Aceleași date, altă ordine a cheilor: hash-ul TREBUIE să iasă la
         fel, altfel „snapshot imutabil" nu înseamnă nimic. */
      const reordered = { settings: { a: 1 }, project: proj() };
      const h3 = await OrderPkg.sha256(OrderPkg.canonical(reordered));
      return { h1, h2, h3 };
    });
    ok("același proiect → același hash", same.h1 === same.h2);
    ok("ordinea cheilor nu schimbă hash-ul", same.h1 === same.h3);
    const diff = await pg.evaluate(async () => {
      const a = await OrderPkg.sha256(OrderPkg.canonical({ project: proj() }));
      const p = JSON.parse(JSON.stringify(proj())); p.pieces[0].lung += 1;
      const b = await OrderPkg.sha256(OrderPkg.canonical({ project: p }));
      return a !== b;
    });
    ok("o cotă schimbată cu 1 mm schimbă hash-ul", diff);
  }

  head("Inbox — PIN, listă, stări");
  const ip = await ctx.newPage();
  {
    await ip.goto(`${O}/a/demo/inbox`); await wait(900);
    await ip.fill("#pin", "0000"); await ip.click("#go"); await wait(600);
    ok("PIN greșit e refuzat", (await ip.textContent("#msg")).trim().length > 0, (await ip.textContent("#msg")).trim());
    ok("...și nu arată nimic", await ip.isHidden("#list"));
    await ip.fill("#pin", "1234"); await ip.click("#go"); await wait(800);
    ok("PIN bun deschide lista", await ip.isVisible("#list"));
    ok("comanda e acolo", await ip.evaluate(() => document.querySelectorAll(".ord").length) === 1);
    ok("cu numele și telefonul clientului", (await ip.textContent(".ord .who")).includes("Ion Popescu"));
    ok("starea de pornire e «primită»", (await ip.textContent(".ord .pill")).trim() === "primită");
    ok("inbox-ul spune că e în mod nesecurizat", await ip.isVisible("#insecure"));

    const api = await (await fetch(`${O}/api/orders?atelier=demo`)).json();
    ok("API-ul refuză fără PIN", !api.orders, JSON.stringify(api).slice(0, 40));
  }

  head("Confirmarea îngheață");
  {
    ip.on("dialog", d => d.accept());
    await ip.click('button[data-act="confirm"]'); await wait(1000);
    const rec = store.orders.get("demo/" + id1);
    ok("starea trece pe «confirmată»", (await ip.textContent(".ord .pill")).trim() === "confirmată");
    ok("se scrie momentul înghețării", !!rec.confirmed_at, rec.confirmed_at);
    ok("hash-ul e fixat", rec.frozen_hash === rec.order.hash);
    ok("butonul de confirmare dispare", await ip.evaluate(() => !document.querySelector('button[data-act="confirm"]')));

    /* Funcția refuză întoarcerea, nu doar interfața: o comandă
       confirmată poate fi deja pe masa de debitat. */
    const r = await fetch(`${O}/api/orders/${id1}/status`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-inbox-pin": "1234" },
      body: JSON.stringify({ atelier: "demo", status: "received" })
    });
    ok("nu se poate întoarce la «primită» — refuzul e în funcție", r.status === 409, r.status);

    const r2 = await fetch(`${O}/api/orders/${id1}/status`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-inbox-pin": "1234" },
      body: JSON.stringify({ atelier: "demo", status: "cut" })
    });
    ok("dar se poate merge înainte, la «tăiată»", r2.status === 200);
    const r3 = await fetch(`${O}/api/orders/${id1}/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atelier: "demo" })
    });
    ok("confirmarea cere PIN", r3.status === 401);
  }

  head("Versionarea — o modificare după confirmare naște v2");
  let id2 = null;
  {
    await pg.evaluate(() => { closeSheets(); proj().pieces[0].pz = 5; persist(); render(); });
    await wait(400);
    await pg.click("#orSendBtn"); await wait(400);
    await pg.click("#orConfirmBtn"); await wait(3500);

    ok("s-a creat o comandă nouă, nu s-a suprascris", store.orders.size === 2, store.orders.size);
    id2 = [...store.orders.keys()].map(k => k.split("/")[1]).find(x => x !== id1);
    const r2 = store.orders.get("demo/" + id2);
    ok("id-ul poartă versiunea", /-v2$/.test(id2), id2);
    ok("version = 2", r2.order.version === 2);
    ok("parent trimite la v1", r2.order.parent === id1);
    ok("diff-ul spune ce s-a schimbat",
      r2.order.diff && r2.order.diff.changed.length === 1 &&
      r2.order.diff.changed[0].from === 2 && r2.order.diff.changed[0].to === 5,
      JSON.stringify(r2.order.diff && r2.order.diff.changed[0] &&
        { de_la: r2.order.diff.changed[0].from, la: r2.order.diff.changed[0].to }));
    ok("v1 a rămas înghețată și neatinsă", !!store.orders.get("demo/" + id1).confirmed_at);
    ok("hash-ul lui v1 nu s-a schimbat",
      store.orders.get("demo/" + id1).order.hash === store.orders.get("demo/" + id1).frozen_hash);

    /* Fără nicio schimbare, o a doua apăsare nu trebuie să nască v3. */
    await pg.evaluate(() => closeSheets());
    await pg.click("#orSendBtn"); await wait(400);
    await pg.click("#orConfirmBtn"); await wait(3000);
    ok("retrimiterea fără nicio modificare NU creează o versiune nouă",
      store.orders.size === 2, store.orders.size + " comenzi");
  }

  head("Pagina comenzii");
  {
    const op = await ctx.newPage();
    await op.goto(`${O}/a/demo/order/${id2}`); await wait(1400);
    const txt = await op.textContent("body");
    ok("arată id-ul", (await op.textContent(".id")).trim() === id2);
    ok("arată clientul", txt.includes("Ion Popescu"));
    ok("arată amprenta snapshot-ului", /[0-9a-f]{32}/.test(await op.textContent(".hash")));
    ok("arată diferența față de v1", txt.includes("Ce s-a schimbat"));
    ok("are butoane pentru toate cele trei documente",
      await op.evaluate(() => document.querySelectorAll("button[data-doc]").length) === 3);
    ok("are descărcarea pachetului de debitare",
      await op.evaluate(() => !!document.querySelector('button[data-dl="lab"]')));
    await op.goto(`${O}/a/demo/order/260101-ZZZZ`); await wait(900);
    ok("un id inexistent spune că nu există, nu rămâne gol",
      (await op.textContent("body")).includes("nu există"));
    await op.close();
  }

  head("Măsurarea");
  {
    const st = await (await fetch(`${O}/api/stats?atelier=demo`)).json();
    ok("sesiunile se numără", st.sessions >= 1, st.sessions);
    ok("comenzile trimise se numără", st.orders_sent >= 2, st.orders_sent);
    ok("confirmările se numără", st.orders_confirmed >= 1, st.orders_confirmed);
    ok("rata de abandon se calculează", st.abandon_rate !== null, st.abandon_rate + "%");
    ok("evenimentele nu poartă nimic care identifică persoana",
      store.events.every(e => !e.ip && !e.ua && !e.name && !e.phone && Object.keys(e).length <= 5),
      Object.keys(store.events[0] || {}).join(","));

    /* Timpul până la primul PDF, măsurat pe o sesiune curată. */
    const fp = await ctx.newPage();
    await fp.goto(`${O}/a/centro-legno`); await wait(2600);
    await fp.evaluate(() => { window.print = () => {}; closeSheets(); setView("summary"); });
    await wait(400);
    await fp.click("#btnPdf"); await wait(1200);
    const st2 = await (await fetch(`${O}/api/stats?atelier=centro-legno`)).json();
    ok("timpul până la primul PDF se măsoară", st2.first_pdf_samples === 1, st2.first_pdf_median_s + " s");
    ok("...și e sub 10 minute, cu marjă", st2.first_pdf_median_s !== null && st2.first_pdf_median_s < 600,
      st2.first_pdf_median_s + " s");
    ok("al doilea atelier are moneda lui",
      await fp.evaluate(() => OrderRail.cfg.currency) === "EUR");
    ok("...și limba lui", await fp.evaluate(() => state.lang) === "it");
    await fp.close();
  }

  head("Modul normal nu s-a schimbat");
  {
    const np = await ctx.newPage();
    const nerr = [];
    np.on("pageerror", e => nerr.push(String(e)));
    await np.goto(`${O}/app/index.html`); await wait(2800);
    const s = await np.evaluate(() => ({
      active: OrderRail.active(), pro: isPro(),
      bar: document.getElementById("orBar").classList.contains("on"),
      brand: document.querySelector(".brand-txt h1").textContent
    }));
    ok("fără slug, modul atelier e oprit", !s.active);
    ok("gating-ul freemium e la locul lui", !s.pro);
    ok("bara de comandă nu apare", !s.bar);
    ok("marca rămâne Ebanist", s.brand === "Ebanist", s.brand);
    ok("filigranul se întoarce pentru versiunea gratuită", await np.evaluate(() => {
      window.print = () => {}; printOut._offered = 1;
      state.projects = [{ id: "w", name: "x", client: "", date: "2026-09-08",
        pieces: [{ id: "q", modulo: "M", elemento: "Fianco", lung: 700, larg: 500, pz: 2, bordo: "2L", materiale: "PAL melaminat Alb 18mm" }] }];
      state.activeId = "w";
      document.getElementById("btnPdf").click();
      return document.querySelectorAll("#printArea .wm-diag").length === 1;
    }));
    ok("niciun slug inventat nu activează modul", await np.evaluate(async () => {
      /* Un slug care nu există trebuie să dezactiveze modul complet, nu
         să lase aplicația jumătate-atelier. */
      OrderRail.slug = "nu-exista-atelierul";
      await OrderRail.load();
      return !OrderRail.active() && !OrderRail.ready;
    }));
    ok("nicio eroare JS în modul normal", nerr.length === 0, nerr[0] || "niciuna");
    await np.close();
  }

  ok("nicio eroare JS pe tot parcursul", errs.length === 0, errs[0] || "niciuna");

  const bad = results.filter(r => !r.cond).length;
  console.log(`\n\x1b[1m${results.length - bad}/${results.length} test superati\x1b[0m\n`);
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
