(() => {
  "use strict";

  const PRO_VERSION = "V17.14";
  const money = value => {
    const n = Number(value);
    return Number.isFinite(n)
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
      : "Sob consulta";
  };
  const esc = value => String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const shortId = value => String(value || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "ORÇAMENTO";
  const clientDiscountValue = q => Math.max(0, Math.min(100, Number(q?.client_discount_percent || 0) || 0));
  const clientUnitPrice = (product, q) => {
    if (!product) return null;
    const base = typeof finalPrice === "function" ? finalPrice(product) : Number(product.price);
    if (base === null || base === undefined || !Number.isFinite(Number(base))) return null;
    const d = clientDiscountValue(q);
    return Math.round(Number(base) * (1 - d / 100) * 100) / 100;
  };

  function injectStyles() {
    if (document.getElementById("adminProV1714Styles")) return;
    const style = document.createElement("style");
    style.id = "adminProV1714Styles";
    style.textContent = `
      body.admin-pro-v1714{--pro-navy:#0b1736;--pro-blue:#143d7a;--pro-soft:#f5f7fb;--pro-border:#e4e9f2;--pro-green:#168653;--pro-gold:#b8892d;--pro-red:#b42318;background:#f5f7fb}
      body.admin-pro-v1714 .admin-header{background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--pro-border);box-shadow:0 3px 18px rgba(10,31,68,.04)}
      body.admin-pro-v1714 .admin-wrap{max-width:1500px;padding-top:26px}
      body.admin-pro-v1714 .admin-heading{background:#fff;border:1px solid var(--pro-border);border-radius:20px;padding:20px 22px;box-shadow:0 8px 30px rgba(12,31,65,.05);margin-bottom:18px}
      body.admin-pro-v1714 .admin-heading h1{letter-spacing:-.02em}
      body.admin-pro-v1714 .admin-shell{align-items:flex-start;gap:20px}
      body.admin-pro-v1714 .admin-section-nav{position:sticky;top:86px;border:1px solid var(--pro-border);border-radius:20px;background:#fff;padding:10px;box-shadow:0 10px 30px rgba(12,31,65,.05)}
      body.admin-pro-v1714 .admin-section-tab{border-radius:14px;transition:.18s ease;border:1px solid transparent}
      body.admin-pro-v1714 .admin-section-tab:hover{background:#f7f9fc;border-color:#e7ebf3;transform:translateY(-1px)}
      body.admin-pro-v1714 .admin-section-tab.active{background:var(--pro-navy);color:#fff;box-shadow:0 10px 22px rgba(11,23,54,.18)}
      body.admin-pro-v1714 .admin-content>.admin-section.panel,
      body.admin-pro-v1714 .admin-content>.admin-section>.panel{border-color:var(--pro-border);box-shadow:0 8px 28px rgba(12,31,65,.045);border-radius:20px}
      body.admin-pro-v1714 #quotesSection{padding:22px;background:#fff;overflow:visible}
      body.admin-pro-v1714 #quotesSection>.panel-title-row{align-items:flex-start;margin-bottom:16px}
      body.admin-pro-v1714 #quotesSection h2{font-size:26px;margin:4px 0 6px;letter-spacing:-.02em}
      body.admin-pro-v1714 .quote-checklist-summary{display:none}
      .quote-pro-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0 18px}
      .quote-pro-card{border:1px solid var(--pro-border);border-radius:16px;padding:15px 16px;background:linear-gradient(180deg,#fff,#fafbfe);min-height:88px;display:flex;flex-direction:column;justify-content:center}
      .quote-pro-card span{font-size:12px;color:#667085;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
      .quote-pro-card b{font-size:24px;color:var(--pro-navy);margin-top:4px}.quote-pro-card small{color:#8992a3;margin-top:2px}
      .quote-pro-tools{display:grid;grid-template-columns:minmax(220px,1fr) 180px;gap:10px;margin:0 0 14px}
      .quote-pro-tools input,.quote-pro-tools select{height:42px;border:1px solid #dfe5ee;border-radius:12px;padding:0 13px;background:#fff;color:#1d2939;outline:none}
      .quote-pro-tools input:focus,.quote-pro-tools select:focus{border-color:#8298c0;box-shadow:0 0 0 3px rgba(20,61,122,.08)}
      body.admin-pro-v1714 .quote-checklist-list{border:1px solid var(--pro-border);border-radius:16px;overflow:auto;background:#fff}
      body.admin-pro-v1714 .quote-checklist-table{min-width:860px}
      body.admin-pro-v1714 .quote-checklist-table th{background:#f7f9fc;color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:12px}
      body.admin-pro-v1714 .quote-checklist-table td{padding:13px 12px;vertical-align:middle;border-top:1px solid #eef1f5}
      body.admin-pro-v1714 .quote-checklist-table tbody tr{transition:.15s ease}
      body.admin-pro-v1714 .quote-checklist-table tbody tr:hover{background:#f8fbff}
      body.admin-pro-v1714 .quote-checklist-table .quote-checked-row{opacity:.72;background:#fbfcfd}
      .quote-pro-client b{display:block;color:#101828;font-size:14px}.quote-pro-client small{display:block;color:#7b8495;margin-top:3px;max-width:310px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .quote-pro-status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}
      .quote-pro-status:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
      .quote-pro-status.new{color:#087443;background:#eaf8f0}.quote-pro-status.checked{color:#475467;background:#f2f4f7}
      .quote-pro-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.quote-pro-actions button{white-space:nowrap}
      .quote-open-button{background:var(--pro-navy)!important;color:#fff!important;border-color:var(--pro-navy)!important}
      .quote-open-button:hover{filter:brightness(1.08)}
      .quote-pro-overlay{position:fixed;inset:0;background:rgba(11,23,54,.30);z-index:9997;opacity:0;pointer-events:none;transition:.2s ease;backdrop-filter:blur(2px)}
      .quote-pro-overlay.open{opacity:1;pointer-events:auto}
      .quote-pro-drawer{position:fixed;z-index:9998;top:0;right:0;width:min(560px,96vw);height:100vh;background:#fff;box-shadow:-18px 0 50px rgba(11,23,54,.18);transform:translateX(104%);transition:.24s ease;display:flex;flex-direction:column}
      .quote-pro-drawer.open{transform:translateX(0)}
      .quote-pro-head{padding:22px 22px 16px;border-bottom:1px solid var(--pro-border);background:linear-gradient(180deg,#fff,#fbfcfe)}
      .quote-pro-headline{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.quote-pro-headline h3{font-size:22px;margin:4px 0 3px;color:var(--pro-navy)}
      .quote-pro-close{width:38px;height:38px;border:1px solid var(--pro-border);background:#fff;border-radius:11px;font-size:22px;cursor:pointer;color:#475467}
      .quote-pro-head-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:16px}.quote-pro-head-actions button{min-height:40px}
      .quote-pro-scroll{overflow:auto;padding:18px 22px 28px}
      .quote-pro-section{border:1px solid var(--pro-border);border-radius:16px;padding:15px 16px;margin-bottom:13px;background:#fff}.quote-pro-section h4{margin:0 0 12px;color:#182230;font-size:14px;display:flex;align-items:center;justify-content:space-between}
      .quote-pro-data{display:grid;grid-template-columns:120px 1fr;gap:8px 12px;font-size:13px}.quote-pro-data span{color:#7b8495}.quote-pro-data b{font-weight:700;color:#293241;word-break:break-word}
      .quote-pro-note{border-radius:12px;background:#f7f9fc;padding:12px;font-size:13px;color:#344054;white-space:pre-wrap;line-height:1.45}
      .quote-pro-items{display:flex;flex-direction:column;gap:8px}.quote-pro-item{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #edf0f4;border-radius:12px;padding:9px;background:#fcfdff}.quote-pro-thumb{width:44px;height:44px;border-radius:9px;object-fit:contain;background:#f5f6f8}.quote-pro-thumb.placeholder{display:flex;align-items:center;justify-content:center;font-size:8px;color:#98a2b3}.quote-pro-item-info b{display:block;font-size:12px;color:#1d2939}.quote-pro-item-info span{display:block;font-size:11px;color:#7b8495;margin-top:2px}.quote-pro-item-value{text-align:right}.quote-pro-item-value b{display:block;font-size:12px;color:#1d2939}.quote-pro-item-value span{font-size:10px;color:#7b8495}
      .quote-pro-total{display:flex;justify-content:space-between;align-items:end;padding-top:12px;margin-top:10px;border-top:1px solid #e9edf3}.quote-pro-total span{font-size:12px;color:#667085}.quote-pro-total b{font-size:21px;color:var(--pro-navy)}
      .quote-pro-discount{display:inline-flex;padding:4px 8px;border-radius:999px;background:#fff6df;color:#8b6200;font-size:11px;font-weight:800}
      body.admin-pro-v1714 #clientsSection:before{content:"Uso interno do ADM · o cliente acessa somente o catálogo";display:block;margin-bottom:14px;border:1px solid #dbe6f6;background:#f5f9ff;color:#31527e;padding:10px 12px;border-radius:12px;font-size:12px;font-weight:700}
      body.admin-pro-v1714 #clientsSection .portal-admin-status, body.admin-pro-v1714 #clientsSection .portal-client-form{border:1px solid var(--pro-border);border-radius:16px;background:#fbfcfe;padding:16px}
      body.admin-pro-v1714 #clientsSection .portal-client-form{margin-top:18px}
      @media(max-width:1050px){.quote-pro-metrics{grid-template-columns:1fr 1fr}.quote-pro-tools{grid-template-columns:1fr}.quote-pro-head-actions{grid-template-columns:1fr 1fr}body.admin-pro-v1714 .admin-section-nav{position:static}}
      @media(max-width:700px){.quote-pro-metrics{grid-template-columns:1fr 1fr}.quote-pro-drawer{width:100vw}.quote-pro-data{grid-template-columns:1fr}.quote-pro-head-actions{grid-template-columns:1fr}.quote-pro-item{grid-template-columns:40px minmax(0,1fr)}.quote-pro-item-value{grid-column:2;text-align:left}.quote-pro-tools{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  let quoteSearch = "";
  let quoteStatus = "all";

  function enhanceStaticUi() {
    document.body.classList.add("admin-pro-v1714");
    const heading = document.querySelector("#quotesSection .panel-title-row > div");
    if (heading) {
      const eyebrow = heading.querySelector(".eyebrow"); if (eyebrow) eyebrow.textContent = "CONTROLE DE ORÇAMENTOS";
      const title = heading.querySelector("h2"); if (title) title.textContent = "Orçamentos finalizados";
      const p = heading.querySelector("p"); if (p) p.textContent = "Acompanhe, abra e confira os orçamentos finalizados pelos clientes sem sair do painel administrativo.";
    }
    const clients = document.querySelector("#clientsSection .section-heading-block");
    if (clients) {
      const eyebrow = clients.querySelector(".eyebrow"); if (eyebrow) eyebrow.textContent = "CLIENTES · CONTROLE INTERNO";
      const title = clients.querySelector("h2"); if (title) title.textContent = "Acessos e condições por cliente";
      const p = clients.querySelector("p"); if (p) p.textContent = "Esta área é somente para você administrar acessos e descontos. O cliente entra apenas no catálogo, quando você permitir.";
    }
    const clientTabSmall = document.querySelector('[data-admin-section="clientsSection"] small');
    if (clientTabSmall) clientTabSmall.textContent = "Acessos e condições";

    const quoteSection = document.getElementById("quotesSection");
    const summary = quoteSection?.querySelector(".quote-checklist-summary");
    if (quoteSection && !document.getElementById("quoteProMetrics")) {
      const metrics = document.createElement("div"); metrics.id = "quoteProMetrics"; metrics.className = "quote-pro-metrics";
      metrics.innerHTML = `
        <div class="quote-pro-card"><span>Total</span><b id="quoteProTotal">0</b><small>orçamentos registrados</small></div>
        <div class="quote-pro-card"><span>Novos</span><b id="quoteProNew">0</b><small>aguardando conferência</small></div>
        <div class="quote-pro-card"><span>Conferidos</span><b id="quoteProChecked">0</b><small>já visualizados</small></div>
        <div class="quote-pro-card"><span>Valor estimado</span><b id="quoteProValue">R$ 0,00</b><small>soma dos orçamentos</small></div>`;
      (summary || quoteSection.querySelector(".quote-checklist-list"))?.before(metrics);

      const tools = document.createElement("div"); tools.className = "quote-pro-tools"; tools.id = "quoteProTools";
      tools.innerHTML = `<input id="quoteProSearch" type="search" placeholder="Buscar por cliente, data ou código do orçamento..."><select id="quoteProStatus"><option value="all">Todos os status</option><option value="new">Somente novos</option><option value="checked">Somente conferidos</option></select>`;
      quoteSection.querySelector(".quote-checklist-list")?.before(tools);
      document.getElementById("quoteProSearch")?.addEventListener("input", e => { quoteSearch = e.target.value.toLowerCase().trim(); renderQuoteRequests(); });
      document.getElementById("quoteProStatus")?.addEventListener("change", e => { quoteStatus = e.target.value; renderQuoteRequests(); });
    }
    createDrawer();
  }

  function createDrawer() {
    if (document.getElementById("quoteProDrawer")) return;
    const overlay = document.createElement("div"); overlay.className = "quote-pro-overlay"; overlay.id = "quoteProOverlay";
    const drawer = document.createElement("aside"); drawer.className = "quote-pro-drawer"; drawer.id = "quoteProDrawer"; drawer.setAttribute("aria-hidden","true");
    drawer.innerHTML = `<div class="quote-pro-head"><div class="quote-pro-headline"><div><span class="eyebrow">FRUTO DE ARTE · ORÇAMENTO</span><h3 id="quoteProDrawerTitle">Orçamento</h3><div class="muted small" id="quoteProDrawerDate"></div></div><button class="quote-pro-close" id="quoteProClose" type="button" aria-label="Fechar">×</button></div><div class="quote-pro-head-actions" id="quoteProDrawerActions"></div></div><div class="quote-pro-scroll" id="quoteProDrawerContent"></div>`;
    document.body.append(overlay, drawer);
    overlay.addEventListener("click", closeQuoteDrawer);
    drawer.querySelector("#quoteProClose").addEventListener("click", closeQuoteDrawer);
  }

  function closeQuoteDrawer() {
    document.getElementById("quoteProOverlay")?.classList.remove("open");
    const drawer = document.getElementById("quoteProDrawer"); drawer?.classList.remove("open"); drawer?.setAttribute("aria-hidden","true");
  }

  function openQuoteDrawer(q) {
    createDrawer();
    const drawer = document.getElementById("quoteProDrawer");
    document.getElementById("quoteProDrawerTitle").textContent = `Orçamento #${shortId(q.quote_id)}`;
    document.getElementById("quoteProDrawerDate").textContent = `Criado em ${typeof formatQuoteDate === "function" ? formatQuoteDate(q.created_at) : String(q.created_at || "")}`;
    const actions = document.getElementById("quoteProDrawerActions"); actions.textContent = "";

    const seen = document.createElement("button"); seen.className = "primary"; seen.type="button"; seen.textContent = q.checked ? "✓ Conferido" : "Marcar como visto";
    seen.addEventListener("click", async () => {
      seen.disabled = true;
      try { await api("/api/quote-requests", { method:"PATCH", json:{ quoteId:q.quote_id, checked:!q.checked } }); q.checked = !q.checked; renderQuoteRequests(); openQuoteDrawer(q); }
      catch(e){ notice("quoteChecklistNotice", e.message, "error"); }
      finally { seen.disabled = false; }
    });
    const pdf = document.createElement("button"); pdf.className="secondary"; pdf.type="button"; pdf.textContent=q.has_pdf?"Abrir PDF":"Gerar PDF"; pdf.addEventListener("click",()=>openQuotePdf(q,pdf));
    const edit = document.createElement("button"); edit.className="secondary"; edit.type="button"; edit.textContent="Editar"; edit.addEventListener("click",()=>{ closeQuoteDrawer(); openQuoteEdit(q); });
    actions.append(seen,pdf,edit);

    const itemRows = Array.isArray(q.items) ? q.items : [];
    const discount = clientDiscountValue(q);
    let calcTotal = 0; let hasCalc = false;
    const itemsHtml = itemRows.length ? itemRows.map(row => {
      const p = Array.isArray(products) ? products.find(x => String(x.code) === String(row.code)) : null;
      const qty = Math.max(1, Number.parseInt(row.qty,10)||1);
      const unit = clientUnitPrice(p,q);
      const total = unit === null ? null : Math.round(unit*qty*100)/100;
      if (total !== null) { calcTotal += total; hasCalc = true; }
      const imgs = p && typeof productImages === "function" ? productImages(p) : [];
      const thumb = imgs[0] ? `<img class="quote-pro-thumb" src="${esc(imgs[0])}" alt="">` : `<div class="quote-pro-thumb placeholder">SEM FOTO</div>`;
      return `<div class="quote-pro-item">${thumb}<div class="quote-pro-item-info"><b>${esc(p?.name || row.code || "Produto")}</b><span>Cód. ${esc(row.code || "—")} · Qtd. ${qty}</span></div><div class="quote-pro-item-value"><b>${total===null?"Sob consulta":money(total)}</b><span>${unit===null?"":`${money(unit)} / un.`}</span></div></div>`;
    }).join("") : `<div class="muted small">Itens não disponíveis nesta cópia antiga do orçamento. Use o PDF para conferir.</div>`;
    const total = Number.isFinite(Number(q.total_estimated)) ? Number(q.total_estimated) : (hasCalc ? calcTotal : null);
    const clientName = q.customer_name || q.portal_client_name || "Cliente não informado";
    const accessInfo = q.portal_client_name || q.portal_client_login ? `<div class="quote-pro-data"><span>Cadastro de acesso</span><b>${esc(q.portal_client_name || q.portal_client_login)}</b></div>` : "";
    document.getElementById("quoteProDrawerContent").innerHTML = `
      <section class="quote-pro-section"><h4>Dados do cliente <span class="quote-pro-status ${q.checked?"checked":"new"}">${q.checked?"Conferido":"Novo"}</span></h4><div class="quote-pro-data"><span>Nome / empresa</span><b>${esc(clientName)}</b><span>Endereço</span><b>${esc(q.address || "Não informado")}</b><span>CEP</span><b>${esc(q.cep || "Não informado")}</b></div>${accessInfo}${discount>0?`<div style="margin-top:10px"><span class="quote-pro-discount">Condição do cliente: ${String(discount).replace(".",",")}% de desconto</span></div>`:""}</section>
      <section class="quote-pro-section"><h4>Observações</h4><div class="quote-pro-note">${esc(q.note || "Sem observações do cliente.")}</div></section>
      <section class="quote-pro-section"><h4>Itens do orçamento <span>${itemRows.length || q.item_count || 0}</span></h4><div class="quote-pro-items">${itemsHtml}</div><div class="quote-pro-total"><span>Total estimado</span><b>${total===null?"Sob consulta":money(total)}</b></div></section>
      <section class="quote-pro-section"><h4>Controle interno</h4><div class="quote-pro-data"><span>Código</span><b>${esc(q.quote_id || "—")}</b><span>Status</span><b>${q.checked?"Conferido":"Novo / aguardando conferência"}</b><span>PDF</span><b>${q.has_pdf?"Disponível":"Ainda não gerado"}</b></div><div class="quote-pro-actions" style="margin-top:14px"><button class="danger small-button" type="button" id="quoteProDelete">Excluir do controle</button></div></section>`;
    const del = document.getElementById("quoteProDelete"); del?.addEventListener("click", async()=>{ await deleteQuoteRequest(q,del); closeQuoteDrawer(); });
    document.getElementById("quoteProOverlay").classList.add("open"); drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false");
  }

  function updateQuoteMetrics() {
    const list = Array.isArray(quoteRequests) ? quoteRequests : [];
    const total = list.reduce((sum,q)=>sum+(Number(q.total_estimated)||0),0);
    const set=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=val;};
    set("quoteProTotal", String(list.length));
    set("quoteProNew", String(list.filter(q=>!q.checked).length));
    set("quoteProChecked", String(list.filter(q=>q.checked).length));
    set("quoteProValue", money(total));
    set("quoteChecklistTotal", String(list.length));
    set("quoteChecklistNew", String(list.filter(q=>!q.checked).length));
  }

  function filteredQuotes() {
    const list = Array.isArray(quoteRequests) ? [...quoteRequests] : [];
    return list.filter(q => {
      if (quoteStatus === "new" && q.checked) return false;
      if (quoteStatus === "checked" && !q.checked) return false;
      if (!quoteSearch) return true;
      const hay = [q.customer_name,q.portal_client_name,q.portal_client_login,q.quote_id,q.cep,q.address,q.created_at].join(" ").toLowerCase();
      return hay.includes(quoteSearch);
    });
  }

  function renderProQuotes() {
    const rows = document.getElementById("quoteChecklistRows"); if (!rows) return;
    updateQuoteMetrics();
    const table = rows.closest("table"); const thead = table?.querySelector("thead tr");
    if (thead) thead.innerHTML = "<th>Status</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Ações</th>";
    rows.textContent = "";
    const list = filteredQuotes();
    if (!list.length) { const tr=document.createElement("tr"); const td=document.createElement("td"); td.colSpan=6; td.className="muted"; td.textContent=quoteRequests.length?"Nenhum orçamento corresponde ao filtro.":"Nenhum orçamento finalizado ainda."; tr.appendChild(td); rows.appendChild(tr); return; }
    list.forEach(q => {
      const tr=document.createElement("tr"); tr.classList.toggle("quote-checked-row",q.checked===true);
      const status=document.createElement("td"); status.innerHTML=`<span class="quote-pro-status ${q.checked?"checked":"new"}">${q.checked?"Conferido":"Novo"}</span>`;
      const date=document.createElement("td"); date.textContent=typeof formatQuoteDate==="function"?formatQuoteDate(q.created_at):String(q.created_at||"");
      const client=document.createElement("td"); client.className="quote-pro-client"; client.innerHTML=`<b>${esc(q.customer_name||q.portal_client_name||"Cliente não informado")}</b><small>${esc(q.note||q.address||q.portal_client_login||"")}</small>`;
      const items=document.createElement("td"); items.textContent=String(q.item_count|| (Array.isArray(q.items)?q.items.length:0));
      const total=document.createElement("td"); total.innerHTML=`<b>${Number.isFinite(Number(q.total_estimated))?money(Number(q.total_estimated)):"—"}</b>`;
      const actions=document.createElement("td"); actions.className="quote-pro-actions";
      const open=document.createElement("button"); open.type="button"; open.className="secondary small-button quote-open-button"; open.textContent="Abrir orçamento"; open.addEventListener("click",()=>openQuoteDrawer(q));
      const pdf=document.createElement("button"); pdf.type="button"; pdf.className="secondary small-button"; pdf.textContent="PDF"; pdf.addEventListener("click",()=>openQuotePdf(q,pdf));
      const edit=document.createElement("button"); edit.type="button"; edit.className="secondary small-button"; edit.textContent="Editar"; edit.addEventListener("click",()=>openQuoteEdit(q));
      const del=document.createElement("button"); del.type="button"; del.className="danger small-button"; del.textContent="Excluir"; del.addEventListener("click",()=>deleteQuoteRequest(q,del));
      actions.append(open,pdf,edit,del);
      tr.append(status,date,client,items,total,actions);
      tr.addEventListener("dblclick",()=>openQuoteDrawer(q));
      rows.appendChild(tr);
    });
  }

  function installOverride() {
    try { renderQuoteRequests = renderProQuotes; } catch {}
    if (typeof renderQuoteRequests === "function") renderQuoteRequests();
  }

  function init() {
    injectStyles(); enhanceStaticUi(); installOverride();
    const refresh = document.getElementById("refreshQuotesBtn"); if (refresh) refresh.title = `Atualizar controle de orçamentos · ${PRO_VERSION}`;
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeQuoteDrawer(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();
