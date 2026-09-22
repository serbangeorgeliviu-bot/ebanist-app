"use strict";
/* ===========================================================================
   Order Rail — order-view.js

   La pagina di una singola commessa, quella che il laboratorio apre dal
   link. Estratta da order-view.html: nessuno script inline in tutto il
   sito, cosi la CSP puo restare stretta.
   =========================================================================== */
var m = location.pathname.match(/^\/a\/([a-z0-9][a-z0-9-]{0,40})\/order\/([0-9]{6}-[2-9A-HJ-NP-Z]{4}(?:-v[0-9]{1,3})?)/);
var SLUG = m ? m[1] : "", ID = m ? m[2] : "";
var T = ORI18N.pick("ro"), REC = null;

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function money(n,c){ try{ return new Intl.NumberFormat(T._locale,{style:"currency",currency:c||"EUR"}).format(n); }
  catch(e){ return (Math.round(n*100)/100).toFixed(2)+" "+(c||"EUR"); } }
function when(iso){ try{ return new Date(iso).toLocaleString(T._locale); }catch(e){ return iso||""; } }

fetch("/ateliers/"+SLUG+".json").then(function(r){ return r.ok?r.json():null; }).then(function(c){
  if(c){ T = ORI18N.pick(c.language||"ro"); $("atName").textContent = c.name;
         document.documentElement.lang = c.language||"ro"; }
  return fetch("/api/orders/"+encodeURIComponent(ID)+"?atelier="+encodeURIComponent(SLUG));
}).then(function(r){ return r && r.ok ? r.json() : null; })
  .then(function(rec){
    if(!rec || !rec.order){ $("body").innerHTML = '<p class="empty">'+esc(T.notFound)+'</p>'; return; }
    REC = rec; paint(rec);
  })
  .catch(function(){ $("body").innerHTML = '<p class="empty">'+esc(T.notFound)+'</p>'; });

var DOC_LABEL = { distinta: "docCut", montaj: "docAssy", etichete: "docLabels" };

function row(sign, what, pc, qty){
  return '<tr><td><b>'+esc(sign)+'</b> '+esc(pc.modulo||"")+' · '+esc(pc.elemento||"")+
    ' <span style="color:var(--faint)">'+esc(pc.lung+"×"+pc.larg)+'</span></td>'+
    '<td class="n">'+esc(qty)+'</td><td class="n">'+esc(what)+'</td></tr>';
}
function paint(rec){
  var o = rec.order, p = o.price || {};
  var h = '<div class="card"><div class="id">'+esc(o.id)+'</div>'+
    '<div style="margin-top:8px"><span class="pill '+(rec.confirmed_at?"confirmed":"")+'">'+
      esc(T.status[rec.status]||rec.status)+'</span></div>'+
    '<div class="k">'+esc(T.client)+'</div><div class="v">'+esc(o.customer.name)+
      ' · <a href="tel:'+esc(o.customer.phone)+'">'+esc(o.customer.phone)+'</a></div>'+
    '<div class="k">'+esc(T.total)+'</div><div class="amt">'+esc(money(p.total,p.currency))+'</div>';

  if(p.lines && p.lines.length){
    h += '<table>';
    for(var i=0;i<p.lines.length;i++){
      var l = p.lines[i];
      h += '<tr><td>'+esc(l.label)+'</td><td class="n">'+esc(String(l.qty))+'</td>'+
           '<td class="n">'+esc(money(l.total,p.currency))+'</td></tr>';
    }
    h += '<tr class="sum"><td>'+esc(T.total)+'</td><td></td><td class="n">'+
         esc(money(p.total,p.currency))+'</td></tr></table>';
  }
  h += '<div class="k">'+esc(T.frozen)+'</div>'+
       '<div class="hash">'+esc(o.hash||"—")+'</div>'+
       '<div class="hint">'+esc(when(o.created_at))+
         (rec.confirmed_at ? ' · '+esc(T.frozenAt)+' '+esc(when(rec.confirmed_at)) : '')+
         ' · '+esc(T.appVer)+' '+esc(o.appVer||"—")+'</div></div>';

  /* v2: ce s-a schimbat față de versiunea dinainte. Atelierul poate să
     fi tăiat deja o parte din v1 — trebuie să vadă diferența din prima
     privire, nu să compare două distinte cu ochiul. */
  if(o.version > 1 && o.diff){
    h += '<div class="card"><div class="k" style="margin-top:0">'+
         esc(T.diffTitle.replace("{v}", "v"+(o.version-1)))+'</div>';
    if(o.diff.none) h += '<p class="hint">'+esc(T.diffNone)+'</p>';
    else {
      h += '<table>';
      var d = o.diff, q;
      for(q=0;q<d.added.length;q++)
        h += row("+", T.diffAdd, d.added[q].piece, d.added[q].pz+" ×");
      for(q=0;q<d.removed.length;q++)
        h += row("−", T.diffDel, d.removed[q].piece, d.removed[q].pz+" ×");
      for(q=0;q<d.changed.length;q++)
        h += row("~", T.diffQty, d.changed[q].piece, d.changed[q].from+" → "+d.changed[q].to+" ×");
      h += '</table>';
    }
    if(o.parent) h += '<p class="hint">'+esc(T.parentOf)+' '+esc(o.parent)+'</p>';
    h += '</div>';
  }

  /* Documentele. Se deschid gata de tipărit — „Salvează ca PDF" e în
     dialogul de tipărire al telefonului. De ce nu sunt fișiere .pdf:
     DECISIONS.md §3. */
  h += '<div class="card"><div class="k" style="margin-top:0">'+esc(T.docs)+'</div><div class="dl">';
  for(var k in (rec.docs||{})){
    h += '<button class="p" data-doc="'+esc(k)+'">'+esc(T[DOC_LABEL[k]]||k)+'</button>';
  }
  h += '<button data-dl="lab">'+esc(T.dlLab)+'</button>'+
       '<button data-dl="snapshot">'+esc(T.dlSnap)+'</button>'+
       '</div><p class="hint">'+esc(T.printHint)+'</p></div>';

  $("body").innerHTML = h;

  var docBtns = document.querySelectorAll("button[data-doc]");
  for(var a=0;a<docBtns.length;a++) docBtns[a].addEventListener("click", openDoc);
  var dlBtns = document.querySelectorAll("button[data-dl]");
  for(var b=0;b<dlBtns.length;b++) dlBtns[b].addEventListener("click", download);
}

/* Documentul se deschide într-o filă proprie, dintr-un blob: e HTML
   autonom, fără rețea, deci merge și în atelier fără semnal. */
function openDoc(e){
  var key = e.currentTarget.getAttribute("data-doc");
  var html = (REC.docs||{})[key];
  if(!html) return;
  var url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener");
  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}

function download(e){
  var key = e.currentTarget.getAttribute("data-dl");
  var data = REC[key];
  if(!data) return;
  var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  var a = document.createElement("a");
  a.href = url; a.download = key + "_" + REC.order.id + ".json"; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 8000);
}
