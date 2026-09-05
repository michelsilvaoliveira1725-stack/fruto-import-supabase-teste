(() => {
  "use strict";

  const VERSION = "V17.15";
  const STATUS = {
    novo: "Novo",
    em_analise: "Em análise",
    enviado: "Orçamento enviado",
    aguardando_retorno: "Aguardando retorno",
    aprovado: "Aprovado",
    encerrado: "Encerrado",
    cancelado: "Cancelado"
  };
  const $id = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const money = value => {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n) : "—";
  };
  const quoteCode = q => q?.quote_number ? `ORC-${String(q.quote_number).padStart(6,"0")}` : String(q?.quote_id || "").slice(0,8).toUpperCase();
  const dateText = value => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short" }).format(d);
  };
  const dateInput = value => {
    if (!value) return "";
    const d = new Date(value); if (Number.isNaN(d.getTime())) return "";
    const pad = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  let quoteSearch = "";
  let quoteStatus = "all";
  let currentQuote = null;

  function injectStyles() {
    if ($id("adminProV1715Styles")) return;
    const style = document.createElement("style");
    style.id = "adminProV1715Styles";
    style.textContent = `
      body.admin-pro-v1715{--navy:#0b1736;--soft:#f5f7fb;--line:#e4e9f2;--green:#087443;--gold:#9a6b00;--red:#b42318;background:#f5f7fb}
      body.admin-pro-v1715 .admin-header{background:rgba(255,255,255,.97);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
      body.admin-pro-v1715 .admin-wrap{max-width:1500px;padding-top:24px}
      body.admin-pro-v1715 .admin-heading{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px 22px;box-shadow:0 8px 28px rgba(11,23,54,.05);margin-bottom:18px}
      body.admin-pro-v1715 .admin-shell{gap:20px;align-items:flex-start}
      body.admin-pro-v1715 .admin-section-nav{position:sticky;top:84px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:10px;box-shadow:0 10px 28px rgba(11,23,54,.05)}
      body.admin-pro-v1715 .admin-section-tab{border-radius:14px;border:1px solid transparent;transition:.15s ease}
      body.admin-pro-v1715 .admin-section-tab:hover{background:#f7f9fc;border-color:#e7ebf3}
      body.admin-pro-v1715 .admin-section-tab.active{background:var(--navy);color:#fff;box-shadow:0 9px 20px rgba(11,23,54,.18)}
      body.admin-pro-v1715 .admin-content>.admin-section.panel,body.admin-pro-v1715 .admin-content>.admin-section>.panel{border-radius:20px;border-color:var(--line);box-shadow:0 8px 26px rgba(11,23,54,.045)}
      body.admin-pro-v1715 #quotesSection{padding:22px;background:#fff}
      body.admin-pro-v1715 #quotesSection h2{font-size:26px;letter-spacing:-.02em;margin:4px 0 6px}
      body.admin-pro-v1715 .quote-checklist-summary{display:none}
      .crm-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}
      .crm-metric{border:1px solid var(--line);background:linear-gradient(180deg,#fff,#fafbfe);border-radius:16px;padding:15px}
      .crm-metric span{display:block;color:#667085;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.crm-metric b{display:block;color:var(--navy);font-size:24px;margin-top:4px}.crm-metric small{color:#8a94a5}
      .crm-tools{display:grid;grid-template-columns:minmax(260px,1fr) 220px;gap:10px;margin-bottom:14px}
      .crm-tools input,.crm-tools select{height:42px;border:1px solid #dce3ee;border-radius:12px;background:#fff;padding:0 13px;font:inherit}
      body.admin-pro-v1715 .quote-checklist-list{border:1px solid var(--line);border-radius:16px;overflow:auto;background:#fff}
      body.admin-pro-v1715 .quote-checklist-table{min-width:980px}
      body.admin-pro-v1715 .quote-checklist-table th{background:#f7f9fc;color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:12px}
      body.admin-pro-v1715 .quote-checklist-table td{padding:13px 12px;border-top:1px solid #edf1f5;vertical-align:middle}
      .crm-status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:800;background:#f2f4f7;color:#475467}.crm-status:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
      .crm-status.novo{background:#eaf8f0;color:#087443}.crm-status.em_analise{background:#eef4ff;color:#315a9b}.crm-status.enviado{background:#edf7ff;color:#1769aa}.crm-status.aguardando_retorno{background:#fff6df;color:#8b6200}.crm-status.aprovado{background:#eaf8f0;color:#087443}.crm-status.encerrado{background:#f2f4f7;color:#475467}.crm-status.cancelado{background:#fff0ef;color:#b42318}
      .crm-open{background:var(--navy)!important;color:#fff!important;border-color:var(--navy)!important}
      .crm-due{color:#b54708;font-weight:800}.crm-overdue{color:#b42318;font-weight:800}
      .crm-overlay{position:fixed;inset:0;background:rgba(11,23,54,.34);z-index:9997;opacity:0;pointer-events:none;transition:.2s;backdrop-filter:blur(2px)}.crm-overlay.open{opacity:1;pointer-events:auto}
      .crm-drawer{position:fixed;z-index:9998;right:0;top:0;width:min(650px,97vw);height:100vh;background:#fff;transform:translateX(104%);transition:.22s ease;box-shadow:-18px 0 48px rgba(11,23,54,.18);display:flex;flex-direction:column}.crm-drawer.open{transform:translateX(0)}
      .crm-head{padding:20px 22px 15px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fff,#fbfcfe)}.crm-head-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.crm-head h3{margin:4px 0;color:var(--navy);font-size:22px}.crm-close{width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:22px;cursor:pointer}
      .crm-head-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.crm-head-actions button{min-height:38px}
      .crm-scroll{overflow:auto;padding:18px 22px 30px}.crm-section{border:1px solid var(--line);border-radius:16px;padding:15px 16px;margin-bottom:13px;background:#fff}.crm-section h4{margin:0 0 12px;color:#182230;font-size:14px}
      .crm-data{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px 12px;font-size:13px}.crm-data span{color:#7b8495}.crm-data b{color:#293241;word-break:break-word}
      .crm-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.crm-form .full{grid-column:1/-1}.crm-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#667085;font-weight:700}.crm-form input,.crm-form select,.crm-form textarea{width:100%;border:1px solid #dce3ee;border-radius:10px;padding:9px 10px;font:inherit;color:#1d2939;background:#fff}.crm-form textarea{resize:vertical}
      .crm-save-row{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
      .crm-items{display:flex;flex-direction:column;gap:8px}.crm-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px;border:1px solid #edf1f5;border-radius:12px;background:#fcfdff}.crm-item b{font-size:12px;color:#1d2939}.crm-item span{display:block;font-size:11px;color:#7b8495;margin-top:2px}.crm-item strong{font-size:12px;color:#1d2939;white-space:nowrap}
      .crm-total{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e9edf3;padding-top:12px;margin-top:10px}.crm-total b{font-size:22px;color:var(--navy)}
      .crm-note{white-space:pre-wrap;background:#f7f9fc;border-radius:12px;padding:11px;color:#344054;font-size:13px}
      body.admin-pro-v1715 #clientsSection:before{content:"Uso interno do ADM · o cliente acessa somente o catálogo";display:block;margin-bottom:14px;border:1px solid #dbe6f6;background:#f5f9ff;color:#31527e;padding:10px 12px;border-radius:12px;font-size:12px;font-weight:700}
      @media(max-width:900px){.crm-metrics{grid-template-columns:1fr 1fr}.crm-tools{grid-template-columns:1fr}.crm-form{grid-template-columns:1fr}.crm-form .full{grid-column:auto}body.admin-pro-v1715 .admin-section-nav{position:static}}
      @media(max-width:600px){.crm-drawer{width:100vw}.crm-metrics{grid-template-columns:1fr 1fr}.crm-data{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function statusLabel(value){ return STATUS[value] || STATUS.novo; }
  function followClass(value){
    if(!value) return "";
    const d=new Date(value); const now=new Date();
    if(d < now) return "crm-overdue";
    if(d.getTime()-now.getTime() < 24*60*60*1000) return "crm-due";
    return "";
  }

  function enhanceStaticUi() {
    document.body.classList.add("admin-pro-v1715");
    const heading = document.querySelector("#quotesSection .panel-title-row > div");
    if (heading) {
      const eyebrow=heading.querySelector(".eyebrow"); if(eyebrow) eyebrow.textContent="CONTROLE DE ORÇAMENTOS";
      const title=heading.querySelector("h2"); if(title) title.textContent="Orçamentos e acompanhamento";
      const p=heading.querySelector("p"); if(p) p.textContent="Acompanhe status, retornos e condições comerciais de cada orçamento sem sair do ADM.";
    }
    const clients = document.querySelector("#clientsSection .section-heading-block p");
    if (clients) clients.textContent = "Área interna para administrar acessos e descontos. O cliente entra apenas no catálogo quando você permitir.";
    createMetricsAndTools(); createDrawer(); installSecureLogout();
  }

  function createMetricsAndTools() {
    const section=$id("quotesSection"); if(!section) return;
    if(!$id("crmMetrics")){
      const box=document.createElement("div"); box.className="crm-metrics"; box.id="crmMetrics";
      box.innerHTML=`<div class="crm-metric"><span>Total</span><b id="crmTotal">0</b><small>orçamentos</small></div><div class="crm-metric"><span>Novos</span><b id="crmNew">0</b><small>aguardando análise</small></div><div class="crm-metric"><span>Para retornar</span><b id="crmFollow">0</b><small>com retorno agendado</small></div><div class="crm-metric"><span>Valor estimado</span><b id="crmValue">R$ 0,00</b><small>soma registrada</small></div>`;
      section.querySelector(".quote-checklist-summary")?.after(box);
    }
    if(!$id("crmTools")){
      const tools=document.createElement("div"); tools.className="crm-tools"; tools.id="crmTools";
      tools.innerHTML=`<input id="crmSearch" type="search" placeholder="Buscar ORC, cliente, telefone ou e-mail..."><select id="crmStatus"><option value="all">Todos os status</option>${Object.entries(STATUS).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select>`;
      section.querySelector(".quote-checklist-list")?.before(tools);
      $id("crmSearch")?.addEventListener("input",e=>{quoteSearch=String(e.target.value||"").toLowerCase().trim(); renderQuoteRequests();});
      $id("crmStatus")?.addEventListener("change",e=>{quoteStatus=e.target.value; renderQuoteRequests();});
    }
  }

  function createDrawer(){
    if($id("crmDrawer")) return;
    const overlay=document.createElement("div"); overlay.className="crm-overlay"; overlay.id="crmOverlay";
    const drawer=document.createElement("aside"); drawer.className="crm-drawer"; drawer.id="crmDrawer"; drawer.setAttribute("aria-hidden","true");
    drawer.innerHTML=`<div class="crm-head"><div class="crm-head-row"><div><span class="eyebrow">ORÇAMENTO</span><h3 id="crmDrawerTitle">Detalhes</h3><small id="crmDrawerMeta" class="muted"></small></div><button class="crm-close" id="crmClose" type="button">×</button></div><div class="crm-head-actions"><button class="primary" id="crmPdf" type="button">Abrir PDF</button><button class="secondary" id="crmMarkAnalysis" type="button">Marcar em análise</button><button class="danger" id="crmDelete" type="button">Excluir</button></div></div><div class="crm-scroll" id="crmBody"></div>`;
    document.body.append(overlay,drawer);
    overlay.addEventListener("click",closeDrawer); $id("crmClose").addEventListener("click",closeDrawer);
    $id("crmPdf").addEventListener("click",()=>{ if(currentQuote) openQuotePdf(currentQuote,$id("crmPdf")); });
    $id("crmMarkAnalysis").addEventListener("click",async()=>{ if(!currentQuote)return; await saveCommercial({status:"em_analise"}); });
    $id("crmDelete").addEventListener("click",async()=>{ if(!currentQuote)return; await deleteQuoteRequest(currentQuote,$id("crmDelete")); closeDrawer(); });
  }
  function openDrawer(q){ currentQuote=q; renderDrawer(); $id("crmOverlay").classList.add("open"); $id("crmDrawer").classList.add("open"); $id("crmDrawer").setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
  function closeDrawer(){ $id("crmOverlay")?.classList.remove("open"); $id("crmDrawer")?.classList.remove("open"); $id("crmDrawer")?.setAttribute("aria-hidden","true"); document.body.style.overflow=""; }

  function itemRows(q){
    return (Array.isArray(q.items)?q.items:[]).map(row=>{
      const p=(typeof products!=="undefined"?products:[]).find(x=>String(x.code)===String(row.code));
      const name=p?.name||row.code||"Produto"; const qty=Number(row.qty)||1;
      return `<div class="crm-item"><div><b>${esc(name)}</b><span>Código: ${esc(row.code||"")} · Quantidade: ${qty}</span></div><strong>${p&&typeof finalPrice==="function"&&finalPrice(p)!==null?money(finalPrice(p)*qty):""}</strong></div>`;
    }).join("") || `<div class="muted small">Itens não disponíveis para visualização.</div>`;
  }

  function renderDrawer(){
    const q=currentQuote; if(!q)return;
    $id("crmDrawerTitle").textContent=`${quoteCode(q)} · ${q.customer_name||"Cliente não informado"}`;
    $id("crmDrawerMeta").textContent=`Criado em ${dateText(q.created_at)} · Status atualizado em ${dateText(q.status_updated_at||q.updated_at)}`;
    const shipping=Number(q.shipping); const base=Number(q.total_estimated); const total=(Number.isFinite(base)?base:0)+(Number.isFinite(shipping)?shipping:0);
    $id("crmBody").innerHTML=`
      <section class="crm-section"><h4>Dados do cliente</h4><div class="crm-form"><label>Nome / empresa<input id="crmCustomer" maxlength="120" value="${esc(q.customer_name||"")}"></label><label>Telefone<input id="crmPhone" maxlength="40" value="${esc(q.phone||"")}"></label><label>E-mail<input id="crmEmail" maxlength="180" value="${esc(q.email||"")}"></label><label>CEP<input id="crmCep" maxlength="20" value="${esc(q.cep||"")}"></label><label class="full">Endereço<input id="crmAddress" maxlength="300" value="${esc(q.address||"")}"></label><label class="full">Observação do cliente<textarea id="crmNote" rows="2" maxlength="500">${esc(q.note||"")}</textarea></label></div><div class="crm-save-row"><button class="secondary" id="crmSaveContact" type="button">Salvar dados do cliente</button></div></section>
      <section class="crm-section"><h4>Acompanhamento comercial</h4><div class="crm-form"><label>Status<select id="crmStatusEdit">${Object.entries(STATUS).map(([v,l])=>`<option value="${v}" ${String(q.status||"novo")===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Retornar em<input id="crmFollowAt" type="datetime-local" value="${dateInput(q.follow_up_at)}"></label><label>Frete (R$)<input id="crmShipping" type="number" min="0" step="0.01" value="${q.shipping??""}"></label><label>Validade (dias)<input id="crmValidity" type="number" min="1" max="365" value="${q.validity_days??""}"></label><label class="full">Condição de pagamento<input id="crmPayment" maxlength="300" value="${esc(q.payment_terms||"")}" placeholder="Ex.: 50% Pix + 30/60 dias"></label><label class="full">Observação interna<textarea id="crmInternal" rows="3" maxlength="2000" placeholder="Somente você vê esta anotação">${esc(q.internal_note||"")}</textarea></label></div><div class="crm-save-row"><button class="primary" id="crmSaveCommercial" type="button">Salvar acompanhamento</button></div></section>
      <section class="crm-section"><h4>Itens do orçamento</h4><div class="crm-items">${itemRows(q)}</div><div class="crm-total"><span>Estimado ${Number.isFinite(shipping)&&shipping>0?`+ frete ${money(shipping)}`:""}</span><b>${Number.isFinite(base)?money(total):"—"}</b></div></section>
      ${q.internal_note?`<section class="crm-section"><h4>Nota interna atual</h4><div class="crm-note">${esc(q.internal_note)}</div></section>`:""}`;
    $id("crmSaveContact")?.addEventListener("click",saveContact);
    $id("crmSaveCommercial")?.addEventListener("click",()=>saveCommercial());
  }

  async function saveContact(){
    if(!currentQuote)return;
    const btn=$id("crmSaveContact"); btn.disabled=true;
    try{
      const d=await api("/api/quote-requests",{method:"PATCH",json:{action:"edit",quoteId:currentQuote.quote_id,customer:$id("crmCustomer").value,phone:$id("crmPhone").value,email:$id("crmEmail").value,cep:$id("crmCep").value,address:$id("crmAddress").value,note:$id("crmNote").value}});
      if(d.quote) Object.assign(currentQuote,d.quote);
      notice("quoteChecklistNotice","Dados do cliente atualizados.","success");
      await loadQuoteRequests();
    }catch(e){notice("quoteChecklistNotice",e.message,"error");}finally{btn.disabled=false;}
  }

  async function saveCommercial(forced={}){
    if(!currentQuote)return;
    const btn=$id("crmSaveCommercial")||$id("crmMarkAnalysis"); if(btn)btn.disabled=true;
    try{
      const follow=$id("crmFollowAt")?.value;
      const payload={action:"commercial",quoteId:currentQuote.quote_id,status:forced.status||$id("crmStatusEdit")?.value||currentQuote.status||"novo",followUpAt:follow?new Date(follow).toISOString():null,shipping:$id("crmShipping")?.value??currentQuote.shipping??null,paymentTerms:$id("crmPayment")?.value??currentQuote.payment_terms??"",validityDays:$id("crmValidity")?.value??currentQuote.validity_days??null,internalNote:$id("crmInternal")?.value??currentQuote.internal_note??""};
      const d=await api("/api/quote-requests",{method:"PATCH",json:payload});
      if(d.quote) Object.assign(currentQuote,d.quote);
      notice("quoteChecklistNotice","Acompanhamento salvo.","success");
      await loadQuoteRequests();
      const refreshed=(quoteRequests||[]).find(x=>x.quote_id===currentQuote.quote_id); if(refreshed){currentQuote=refreshed;renderDrawer();}
    }catch(e){notice("quoteChecklistNotice",e.message,"error");}finally{if(btn)btn.disabled=false;}
  }

  function renderCrmQuotes(){
    const rows=$id("quoteChecklistRows"); if(!rows)return;
    rows.textContent="";
    const all=Array.isArray(quoteRequests)?quoteRequests:[];
    const total=all.reduce((s,q)=>s+(Number(q.total_estimated)||0),0);
    const follow=all.filter(q=>q.follow_up_at && !["aprovado","encerrado","cancelado"].includes(q.status)).length;
    if($id("crmTotal"))$id("crmTotal").textContent=String(all.length);
    if($id("crmNew"))$id("crmNew").textContent=String(all.filter(q=>(q.status||"novo")==="novo").length);
    if($id("crmFollow"))$id("crmFollow").textContent=String(follow);
    if($id("crmValue"))$id("crmValue").textContent=money(total);
    if($id("quoteChecklistTotal"))$id("quoteChecklistTotal").textContent=String(all.length);
    if($id("quoteChecklistNew"))$id("quoteChecklistNew").textContent=String(all.filter(q=>(q.status||"novo")==="novo").length);

    const table=rows.closest("table"); if(table?.tHead) table.tHead.innerHTML="<tr><th>Número</th><th>Data</th><th>Cliente</th><th>Status</th><th>Retorno</th><th>Total</th><th>Ações</th></tr>";
    const list=all.filter(q=>{
      if(quoteStatus!=="all" && String(q.status||"novo")!==quoteStatus)return false;
      if(!quoteSearch)return true;
      return `${quoteCode(q)} ${q.customer_name||""} ${q.phone||""} ${q.email||""}`.toLowerCase().includes(quoteSearch);
    });
    if(!list.length){const tr=document.createElement("tr");tr.innerHTML='<td colspan="7" class="muted">Nenhum orçamento encontrado.</td>';rows.appendChild(tr);return;}
    list.forEach(q=>{
      const tr=document.createElement("tr"); const status=String(q.status||"novo");
      tr.innerHTML=`<td><b>${esc(quoteCode(q))}</b></td><td>${esc(dateText(q.created_at))}</td><td><b>${esc(q.customer_name||"Cliente não informado")}</b><small style="display:block;color:#7b8495">${esc(q.phone||q.email||"")}</small></td><td><span class="crm-status ${esc(status)}">${esc(statusLabel(status))}</span></td><td class="${followClass(q.follow_up_at)}">${esc(dateText(q.follow_up_at))}</td><td><b>${money(q.total_estimated)}</b></td><td><div class="quote-row-actions"><button type="button" class="secondary small-button crm-open">Abrir orçamento</button><button type="button" class="secondary small-button">PDF</button></div></td>`;
      const buttons=tr.querySelectorAll("button"); buttons[0].addEventListener("click",()=>openDrawer(q)); buttons[1].addEventListener("click",()=>openQuotePdf(q,buttons[1])); rows.appendChild(tr);
    });
  }

  function installOverride(){ try{renderQuoteRequests=renderCrmQuotes;}catch{} if(typeof renderQuoteRequests==="function")renderQuoteRequests(); }

  function installSecureLogout(){
    const btn=$id("logoutBtn"); if(!btn||btn.dataset.v1715)return; btn.dataset.v1715="1";
    btn.addEventListener("click",async e=>{e.preventDefault();e.stopImmediatePropagation();try{await fetch("/api/admin/logout",{method:"POST",cache:"no-store"});}catch{}localStorage.removeItem("fruto_import_admin_token");location.reload();},true);
  }

  function init(){
    localStorage.setItem("fruto_import_admin_token", localStorage.getItem("fruto_import_admin_token") || "cookie");
    injectStyles(); enhanceStaticUi(); installOverride();
    const refresh=$id("refreshQuotesBtn"); if(refresh)refresh.title=`Atualizar orçamentos · ${VERSION}`;
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
