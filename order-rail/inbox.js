"use strict";
/* ===========================================================================
   Order Rail — inbox.js

   La lista delle commesse di un atelier: PIN, elenco, stati. Stava dentro
   inbox.html; e' uscita per lo stesso motivo del corpo dell'app — con zero
   script inline in tutto il sito, `script-src` nella CSP resta 'self' e
   basta, senza 'unsafe-inline'.
   =========================================================================== */
/* Slug-ul din cale: /a/<slug>/inbox. Pagina e servită prin rescriere 200,
   deci calea rămâne cea frumoasă și e singura sursă. */
var SLUG = (location.pathname.match(/^\/a\/([a-z0-9][a-z0-9-]{0,40})\//) || [])[1] || "";
var CFG = null, T = ORI18N.pick("ro"), PIN = "";

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }

function money(n, cur){
  try{ return new Intl.NumberFormat(T._locale,{style:"currency",currency:cur||"EUR"}).format(n); }
  catch(e){ return (Math.round(n*100)/100).toFixed(2)+" "+(cur||"EUR"); }
}
function when(iso){
  try{ return new Date(iso).toLocaleString(T._locale); }catch(e){ return iso||""; }
}

function paintStatic(){
  $("lPin").textContent = T.pin;
  $("go").textContent = T.enter;
  $("atSub").textContent = T.inbox;
}

fetch("/ateliers/"+SLUG+".json").then(function(r){ return r.ok?r.json():null; }).then(function(c){
  CFG = c;
  if(c){
    T = ORI18N.pick(c.language||"ro");
    $("atName").textContent = c.name;
    document.title = c.name + " — " + T.inbox;
    document.documentElement.lang = c.language || "ro";
  }
  paintStatic();
}).catch(function(){ paintStatic(); });

$("go").addEventListener("click", load);
$("pin").addEventListener("keydown", function(e){ if(e.key==="Enter") load(); });

function load(){
  var pin = $("pin").value.trim();
  if(!pin){ $("pin").focus(); return; }
  var b = $("go"); b.disabled = true; var old = b.textContent; b.textContent = "…";
  $("msg").className = "msg"; $("msg").textContent = "";
  fetch("/api/orders?atelier="+encodeURIComponent(SLUG), { headers:{ "x-inbox-pin": pin } })
    .then(function(r){ return r.json().then(function(j){ return {s:r.status,j:j}; }); })
    .then(function(res){
      b.disabled = false; b.textContent = old;
      if(res.s === 401){ $("msg").className="msg err"; $("msg").textContent = T.badPin; return; }
      if(res.s === 503){ $("msg").className="msg err"; $("msg").textContent = T.noServer; return; }
      if(res.s !== 200){ $("msg").className="msg err"; $("msg").textContent = res.j.error||("HTTP "+res.s); return; }
      PIN = pin;
      $("gate").hidden = true; $("list").hidden = false;
      if(res.j.insecure){
        $("insecure").hidden = false;
        $("insecure").textContent = T.insecure;
      }
      render(res.j.orders||[]);
    })
    .catch(function(){ b.disabled=false; b.textContent=old;
      $("msg").className="msg err"; $("msg").textContent = T.noServer; });
}

var FLOW = ["received","confirmed","cut","collected"];

function render(list){
  var box = $("orders");
  if(!list.length){ box.innerHTML = '<p class="empty">'+esc(T.empty)+'</p>'; return; }
  var h = "";
  for(var i=0;i<list.length;i++){
    var o = list[i];
    var next = FLOW[FLOW.indexOf(o.status)+1];
    h += '<div class="ord" data-id="'+esc(o.id)+'">'+
      '<div class="top"><span class="id">'+esc(o.id)+'</span>'+
      (o.version>1 ? '<span class="v2">v'+o.version+'</span>' : '')+
      '<span class="pill '+esc(o.status)+'">'+esc(T.status[o.status]||o.status)+'</span>'+
      '<span class="amt">'+esc(o.price?money(o.price.total,o.price.currency):"—")+'</span></div>'+
      '<div class="who">'+esc(o.customer.name)+' · <a href="tel:'+esc(o.customer.phone)+'">'+esc(o.customer.phone)+'</a></div>'+
      '<div class="meta">'+esc(when(o.created_at))+' · '+o.pieces+' '+esc(T.pieces)+
        (o.confirmed_at ? ' · '+esc(T.frozenAt)+' '+esc(when(o.confirmed_at)) : '')+
        '<br>'+esc(T.hash)+': '+esc(String(o.hash||"").slice(0,16))+'…</div>'+
      '<div class="acts">'+
        '<a class="btn-s btn-sm" style="display:inline-block;text-decoration:none;line-height:1.6" href="/a/'+esc(SLUG)+'/order/'+esc(o.id)+'">'+esc(T.open)+'</a>'+
        (o.confirmed_at ? '' :
          '<button class="btn-s btn-sm" data-act="confirm" data-id="'+esc(o.id)+'">'+esc(T.confirm)+'</button>')+
        (next ? '<button class="btn-s btn-sm" data-act="status" data-next="'+esc(next)+'" data-id="'+esc(o.id)+'">'+
                esc(T.markAs.replace("{s}", T.status[next]))+'</button>' : '')+
      '</div></div>';
  }
  box.innerHTML = h;
  var btns = box.querySelectorAll("button[data-act]");
  for(var k=0;k<btns.length;k++) btns[k].addEventListener("click", act);
}

function act(e){
  var b = e.currentTarget, id = b.getAttribute("data-id"), a = b.getAttribute("data-act");
  /* Confirmarea îngheață snapshot-ul. Se cere o dată, explicit: după ea
     comanda nu se mai poate schimba, iar în atelier poate fi deja tăiată. */
  if(a === "confirm" && !confirm(T.confirmAsk.replace("{id}", id))) return;
  b.disabled = true;
  var body = a === "confirm" ? { atelier: SLUG } : { atelier: SLUG, status: b.getAttribute("data-next") };
  fetch("/api/orders/"+encodeURIComponent(id)+"/"+a, {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-inbox-pin": PIN },
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); })
    .then(function(){
      /* Confirmarea e ultimul pas al pâlniei și se măsoară de aici: e
         singurul loc unde se întâmplă. Fără el, rata de conversie s-ar
         opri la „trimisă" și n-am ști câte comenzi ajung efectiv la
         debitat. */
      if(a === "confirm"){
        try{
          fetch("/api/stats", { method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ e:"order_confirmed", a:SLUG, s:"inbox" }) }).catch(function(){});
        }catch(e){}
      }
      load2();
    })
    .catch(function(){ b.disabled = false; });
}
function load2(){
  fetch("/api/orders?atelier="+encodeURIComponent(SLUG), { headers:{ "x-inbox-pin": PIN } })
    .then(function(r){ return r.json(); })
    .then(function(j){ render(j.orders||[]); })
    .catch(function(){});
}
