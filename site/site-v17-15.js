(() => {
  "use strict";

  const VERSION = "V17.16";
  const DRAFT_ACTIVITY_KEY = "fruto_quote_activity_v1716";
  const FINAL_STATE_KEY = "fruto_quote_final_v1716";
  const TTL_MS = 24 * 60 * 60 * 1000;

  let lastQuoteNumber = null;
  let successState = null;
  let expiryTimer = null;

  const quoteLabel = n => n ? `ORC-${String(n).padStart(6, "0")}` : "";
  const now = () => Date.now();

  function safeJsonParse(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function injectStyles() {
    if (document.getElementById("siteV1716Styles")) return;
    document.getElementById("siteV1715Styles")?.remove();
    const style = document.createElement("style");
    style.id = "siteV1716Styles";
    style.textContent = `
      .topbar #headerSearch.global-search-top{display:flex!important;margin-left:auto;flex:1 1 360px;max-width:520px;min-width:260px;order:20}
      .topbar #headerSearch.global-search-top input{height:42px;min-width:0;border-radius:12px 0 0 12px;border:1px solid #d9e0eb;border-right:0;background:#fff;padding:0 14px;box-shadow:none}
      .topbar #headerSearch.global-search-top button{height:42px;width:48px;border-radius:0 12px 12px 0;background:#0b1736;color:#fff;border:1px solid #0b1736;font-size:20px}
      .topbar #headerSearch.global-search-top.hidden{display:flex!important}
      .customer-contact-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .customer-contact-fields label{min-width:0}

      .quote-success-overlay{position:fixed;inset:0;z-index:12000;background:rgba(11,23,54,.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;pointer-events:none;transition:.2s ease}
      .quote-success-overlay.open{opacity:1;pointer-events:auto}
      .quote-success-card{width:min(590px,100%);background:#fff;border-radius:22px;border:1px solid #e2e7ef;box-shadow:0 28px 80px rgba(11,23,54,.24);overflow:hidden}
      .quote-success-head{padding:24px 24px 18px;background:linear-gradient(180deg,#f8fbff,#fff);border-bottom:1px solid #e8edf4}
      .quote-success-badge{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;background:#eaf8f0;color:#087443;font-size:12px;font-weight:900}
      .quote-success-head h2{margin:12px 0 7px;color:#0b1736;font-size:25px;letter-spacing:-.02em}
      .quote-success-head p{margin:0;color:#667085;line-height:1.5}
      .quote-success-body{padding:20px 24px 24px}
      .quote-success-ref{border:1px solid #e2e7ef;background:#f8fafc;border-radius:14px;padding:14px 15px;margin-bottom:15px}
      .quote-success-ref span{display:block;font-size:11px;color:#7b8495;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      .quote-success-ref b{display:block;margin-top:4px;font-size:22px;color:#0b1736}
      .quote-success-expiry{font-size:12px;color:#667085;margin:0 0 16px;line-height:1.45}
      .quote-success-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .quote-success-actions button{min-height:44px;border-radius:12px;border:1px solid #dce3ee;background:#fff;color:#23314f;font-weight:800;cursor:pointer;padding:0 12px}
      .quote-success-actions .primary{background:#0b1736;color:#fff;border-color:#0b1736}
      .quote-success-actions .whatsapp{background:#168653;color:#fff;border-color:#168653}
      .quote-success-actions .wide{grid-column:1/-1}
      .quote-success-actions .danger-soft{color:#a12a21;background:#fff7f6;border-color:#f1cbc7}
      .quote-success-foot{margin-top:14px;padding-top:13px;border-top:1px solid #edf0f4;color:#7a8495;font-size:11px;line-height:1.45}

      @media(max-width:980px){
        .topbar{flex-wrap:wrap}
        .topbar #headerSearch.global-search-top{order:50;flex:1 0 100%;max-width:none;min-width:0;margin-left:0;margin-top:8px}
      }
      @media(max-width:650px){
        .customer-contact-fields{grid-template-columns:1fr}
        .quote-success-actions{grid-template-columns:1fr}
        .quote-success-actions .wide{grid-column:auto}
        .quote-success-head{padding:20px 18px 15px}.quote-success-body{padding:17px 18px 20px}
      }
    `;
    document.head.appendChild(style);
  }

  function moveGlobalSearchToTop() {
    document.getElementById("globalCatalogSearch")?.closest("div")?.remove();
    document.querySelector(".global-search-hint")?.remove();

    const searchBox = document.getElementById("headerSearch");
    const quoteButton = document.getElementById("listBtn");
    const input = document.getElementById("search");
    const button = document.getElementById("searchBtn");
    if (!searchBox || !quoteButton || !input || !button) return;

    quoteButton.insertAdjacentElement("afterend", searchBox);
    searchBox.classList.add("global-search-top");
    searchBox.classList.remove("hidden");
    input.placeholder = "Buscar código ou produto nas 3 marcas...";
    input.setAttribute("aria-label", "Buscar em Sennelier, Schmincke e Raphaël");
    button.title = "Buscar em todas as marcas";

    const runGlobal = event => {
      if (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      const term = String(input.value || "").trim();
      if (!term) return;
      currentBrand = "__GLOBAL__";
      currentCat = "Todos";
      currentVariation = "Todas";
      currentSeries = "Todas";
      visibleLimit = PAGE_SIZE;
      document.getElementById("landing")?.classList.add("hidden");
      document.getElementById("catalogSection")?.classList.remove("hidden");
      document.querySelectorAll(".nav-brand").forEach(b => b.classList.remove("active"));
      document.getElementById("cats").textContent = "";
      document.getElementById("variationFilters")?.classList.add("hidden");
      document.getElementById("seriesFilters")?.classList.add("hidden");
      const title = document.getElementById("catalogTitle");
      const subtitle = document.getElementById("catalogSubtitle");
      if (title) title.textContent = "Busca em todo o catálogo";
      if (subtitle) subtitle.textContent = "Resultados encontrados nas marcas Sennelier, Schmincke e Raphaël.";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    button.addEventListener("click", runGlobal, true);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") runGlobal(event);
    }, true);
  }

  function patchGlobalSearchLogic() {
    if (typeof filteredProducts !== "function" || filteredProducts.__v1716) return;
    const originalFiltered = filteredProducts;
    filteredProducts = function() {
      if (currentBrand !== "__GLOBAL__") return originalFiltered();
      const q = String(document.getElementById("search")?.value || "").toLowerCase().trim();
      return products.filter(p => !q || `${p.code} ${p.name} ${p.brand} ${p.cat} ${p.variation || ""} ${p.series || ""}`.toLowerCase().includes(q));
    };
    filteredProducts.__v1716 = true;

    if (typeof categories === "function" && !categories.__v1716) {
      const originalCategories = categories;
      categories = function() {
        if (currentBrand === "__GLOBAL__") {
          const cats = document.getElementById("cats"); if (cats) cats.textContent = "";
          document.getElementById("variationFilters")?.classList.add("hidden");
          document.getElementById("seriesFilters")?.classList.add("hidden");
          return;
        }
        return originalCategories();
      };
      categories.__v1716 = true;
    }

    if (typeof render === "function" && !render.__v1716) {
      const originalRender = render;
      render = function() {
        originalRender();
        if (currentBrand === "__GLOBAL__") {
          const empty = document.querySelector("#grid .empty-state");
          if (empty) empty.innerHTML = "<b>Nenhum produto encontrado nas três marcas.</b>Tente outro código, nome ou categoria.";
          const result = document.getElementById("result");
          const term = String(document.getElementById("search")?.value || "").trim();
          if (result) result.textContent = `${filteredProducts().length.toLocaleString("pt-BR")} produto(s) encontrado(s) em todas as marcas${term ? ` para “${term}”` : ""}`;
        }
      };
      render.__v1716 = true;
    }
  }

  function injectContactFields() {
    const nameLabel = document.getElementById("customerNameLabel");
    if (!nameLabel || document.getElementById("customerPhone")) return;
    const wrap = document.createElement("div");
    wrap.className = "customer-contact-fields";
    wrap.innerHTML = `
      <label>Telefone / WhatsApp <span>opcional</span><input id="customerPhone" inputmode="tel" maxlength="30" placeholder="(11) 99999-9999"></label>
      <label>E-mail <span>opcional</span><input id="customerEmail" type="email" maxlength="160" placeholder="cliente@empresa.com"></label>`;
    nameLabel.insertAdjacentElement("afterend", wrap);
  }

  function patchQuotePayload() {
    if (typeof quotePayload !== "function" || quotePayload.__v1716) return;
    const originalPayload = quotePayload;
    quotePayload = function() {
      return {
        ...originalPayload(),
        phone: String(document.getElementById("customerPhone")?.value || "").trim(),
        email: String(document.getElementById("customerEmail")?.value || "").trim()
      };
    };
    quotePayload.__v1716 = true;

    if (typeof resetQuoteAfterFinalize === "function" && !resetQuoteAfterFinalize.__v1716) {
      const originalReset = resetQuoteAfterFinalize;
      resetQuoteAfterFinalize = function() {
        originalReset();
        const phone = document.getElementById("customerPhone"); if (phone) phone.value = "";
        const email = document.getElementById("customerEmail"); if (email) email.value = "";
      };
      resetQuoteAfterFinalize.__v1716 = true;
    }

    if (typeof saveFinalizedQuote === "function" && !saveFinalizedQuote.__v1716) {
      const originalSave = saveFinalizedQuote;
      saveFinalizedQuote = async function(...args) {
        const data = await originalSave(...args);
        lastQuoteNumber = data?.quoteNumber || data?.quote?.quote_number || null;
        return data;
      };
      saveFinalizedQuote.__v1716 = true;
    }

    if (typeof whatsappMessage === "function" && !whatsappMessage.__v1716) {
      whatsappMessage = function(pdfUrl = "") {
        const ref = quoteLabel(lastQuoteNumber);
        const lines = [ref ? `Olá, Fruto de Arte! Segue o orçamento ${ref} em PDF:` : "Olá, Fruto de Arte! Segue o orçamento em PDF:"];
        if (pdfUrl) lines.push(pdfUrl);
        return lines.join("\n");
      };
      whatsappMessage.__v1716 = true;
    }
  }

  function draftSnapshot() {
    return JSON.stringify({
      selected: typeof selected === "object" && selected ? selected : {},
      customer: String(document.getElementById("customerName")?.value || ""),
      phone: String(document.getElementById("customerPhone")?.value || ""),
      email: String(document.getElementById("customerEmail")?.value || ""),
      cep: String(document.getElementById("customerCep")?.value || ""),
      address: String(document.getElementById("customerAddress")?.value || ""),
      note: String(document.getElementById("customerNote")?.value || "")
    });
  }

  function touchDraft() {
    const hasItems = typeof selected === "object" && selected && Object.keys(selected).length > 0;
    if (!hasItems) return;
    localStorage.setItem(DRAFT_ACTIVITY_KEY, String(now()));
  }

  function clearStoredDraft({ close = false } = {}) {
    try {
      selected = {};
      quoteFinalizeId = "";
      if (typeof save === "function") save();
    } catch {}
    ["customerName","customerPhone","customerEmail","customerCep","customerAddress","customerNote"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    localStorage.removeItem(DRAFT_ACTIVITY_KEY);
    localStorage.removeItem(FINAL_STATE_KEY);
    successState = null;
    clearTimeout(expiryTimer);
    if (typeof render === "function" && currentBrand) render();
    if (typeof renderItems === "function") renderItems();
    if (close) closeSuccess();
  }

  function checkDraftExpiry() {
    const hasItems = typeof selected === "object" && selected && Object.keys(selected).length > 0;
    const stamp = Number(localStorage.getItem(DRAFT_ACTIVITY_KEY) || 0);
    if (!hasItems) {
      localStorage.removeItem(DRAFT_ACTIVITY_KEY);
      return;
    }
    if (!stamp) {
      touchDraft();
      return;
    }
    if (now() - stamp >= TTL_MS) clearStoredDraft();
  }

  function createSuccessModal() {
    if (document.getElementById("quoteSuccessOverlay")) return;
    const overlay = document.createElement("div");
    overlay.className = "quote-success-overlay";
    overlay.id = "quoteSuccessOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "quoteSuccessTitle");
    overlay.innerHTML = `
      <div class="quote-success-card">
        <div class="quote-success-head">
          <span class="quote-success-badge">✓ Orçamento registrado</span>
          <h2 id="quoteSuccessTitle">Orçamento criado com sucesso</h2>
          <p>Seu orçamento continua disponível neste navegador para consulta e ajustes durante o período de segurança.</p>
        </div>
        <div class="quote-success-body">
          <div class="quote-success-ref"><span>Número do orçamento</span><b id="quoteSuccessNumber">ORC-000000</b></div>
          <p class="quote-success-expiry" id="quoteSuccessExpiry">A seleção será mantida por até 24 horas.</p>
          <div class="quote-success-actions">
            <button class="whatsapp" type="button" id="quoteSuccessWhatsapp">Abrir WhatsApp</button>
            <button class="primary" type="button" id="quoteSuccessPdf">Abrir PDF</button>
            <button class="wide" type="button" id="quoteSuccessContinue">Continuar / atualizar seleção</button>
            <button type="button" id="quoteSuccessNew">Fazer novo orçamento</button>
            <button class="danger-soft" type="button" id="quoteSuccessClear">Limpar agora</button>
          </div>
          <div class="quote-success-foot">Se você alterar a seleção depois de um orçamento já finalizado, a próxima finalização poderá gerar um novo número de orçamento. O controle antigo permanece no ADM.</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById("quoteSuccessWhatsapp")?.addEventListener("click", () => {
      if (!successState?.pdfUrl) return;
      const wa = typeof whatsappUrl === "function" ? whatsappUrl(successState.pdfUrl) : "";
      if (wa) window.location.href = wa;
    });
    document.getElementById("quoteSuccessPdf")?.addEventListener("click", () => {
      if (successState?.pdfUrl) window.open(successState.pdfUrl, "_blank", "noopener");
    });
    document.getElementById("quoteSuccessContinue")?.addEventListener("click", () => {
      closeSuccess();
      if (typeof openDrawer === "function") openDrawer();
    });
    document.getElementById("quoteSuccessNew")?.addEventListener("click", () => {
      clearStoredDraft({ close: true });
      if (typeof openDrawer === "function") openDrawer();
    });
    document.getElementById("quoteSuccessClear")?.addEventListener("click", () => clearStoredDraft({ close: true }));
  }

  function updateExpiryText() {
    const el = document.getElementById("quoteSuccessExpiry");
    if (!el || !successState) return;
    const remaining = Math.max(0, Number(successState.expiresAt || 0) - now());
    if (!remaining) {
      clearStoredDraft({ close: true });
      return;
    }
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.ceil((remaining % 3600000) / 60000);
    el.textContent = `Esta seleção ficará disponível por até 24 horas neste navegador. Tempo restante aproximado: ${hours}h ${minutes}min.`;
  }

  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!successState?.expiresAt) return;
    const remaining = Math.max(0, successState.expiresAt - now());
    if (!remaining) return clearStoredDraft({ close: true });
    expiryTimer = setTimeout(() => clearStoredDraft({ close: true }), Math.min(remaining, 2147483647));
  }

  function persistSuccess(saved, pdfUrl, snapshot) {
    const quoteId = String(saved?.quoteId || (typeof createQuoteId === "function" ? createQuoteId() : "")).trim();
    const quoteNumber = saved?.quoteNumber || saved?.quote?.quote_number || lastQuoteNumber || null;
    successState = {
      quoteId,
      quoteNumber,
      pdfUrl,
      createdAt: now(),
      expiresAt: now() + TTL_MS,
      snapshot
    };
    lastQuoteNumber = quoteNumber;
    localStorage.setItem(FINAL_STATE_KEY, JSON.stringify(successState));
    localStorage.setItem(DRAFT_ACTIVITY_KEY, String(now()));
    scheduleExpiry();
  }

  function showSuccess(state = successState) {
    if (!state) return;
    successState = state;
    lastQuoteNumber = state.quoteNumber || lastQuoteNumber;
    const overlay = document.getElementById("quoteSuccessOverlay");
    if (!overlay) return;
    const number = document.getElementById("quoteSuccessNumber");
    if (number) number.textContent = quoteLabel(state.quoteNumber) || "Orçamento registrado";
    updateExpiryText();
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeSuccess() {
    document.getElementById("quoteSuccessOverlay")?.classList.remove("open");
    if (!document.getElementById("drawer")?.classList.contains("open")) document.body.style.overflow = "";
  }

  function restoreSuccessIfValid() {
    const state = safeJsonParse(localStorage.getItem(FINAL_STATE_KEY), null);
    if (!state || !state.expiresAt) return;
    if (Number(state.expiresAt) <= now()) {
      clearStoredDraft();
      return;
    }
    successState = state;
    lastQuoteNumber = state.quoteNumber || null;
    scheduleExpiry();
    setTimeout(() => showSuccess(state), 250);
  }

  function markEditedAfterFinalize() {
    if (!successState?.snapshot) return;
    const current = draftSnapshot();
    if (current === successState.snapshot) return;
    try { quoteFinalizeId = ""; } catch {}
    localStorage.removeItem(FINAL_STATE_KEY);
    successState = null;
    touchDraft();
  }

  function installDraftTracking() {
    document.addEventListener("input", event => {
      if (event.target?.closest?.("#drawer") || event.target?.id === "search") {
        if (event.target?.id !== "search") {
          touchDraft();
          setTimeout(markEditedAfterFinalize, 0);
        }
      }
    }, true);
    document.addEventListener("click", event => {
      if (event.target?.closest?.(".product-select,.product-qty-picker,.quote-card,.quote-qty-controls,#clearList")) {
        setTimeout(() => { touchDraft(); markEditedAfterFinalize(); }, 0);
      }
    }, true);
    window.addEventListener("focus", checkDraftExpiry);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDraftExpiry(); });
    setInterval(checkDraftExpiry, 5 * 60 * 1000);
  }

  async function finalizeForSuccess(button, { download = false } = {}) {
    const payload = quotePayload();
    if (!payload.items.length) {
      alert("Adicione pelo menos um produto ao orçamento.");
      return;
    }
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = download ? "Gerando..." : "Finalizando...";
    const snapshot = draftSnapshot();
    try {
      let blob = null;
      if (download && typeof generatePdfBlob === "function") blob = await generatePdfBlob();
      const totalEstimated = typeof quoteTotalEstimated === "function" ? quoteTotalEstimated() : null;
      await finalizeQuoteStock();
      const saved = await saveFinalizedQuote(payload, totalEstimated);
      if (!saved?.pdfStored) throw new Error(saved?.pdfWarning || "O orçamento foi salvo, mas a cópia do PDF ainda não ficou disponível. Tente novamente.");
      const quoteId = String(saved?.quoteId || createQuoteId()).trim();
      const pdfUrl = quotePdfShareUrl(quoteId);
      persistSuccess(saved, pdfUrl, snapshot);
      if (download && blob && typeof downloadBlob === "function") {
        downloadBlob(blob, `${quoteLabel(saved?.quoteNumber || saved?.quote?.quote_number) || "orcamento"}-fruto-de-arte.pdf`);
      }
      if (typeof renderItems === "function") renderItems();
      showSuccess();
    } catch (err) {
      alert(err?.message || "Não foi possível finalizar o orçamento.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function interceptFinalizeButtons() {
    const send = document.getElementById("sendWhatsApp");
    const download = document.getElementById("downloadPdf");
    if (send && !send.dataset.v1716) {
      send.dataset.v1716 = "1";
      send.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        finalizeForSuccess(send, { download: false });
      }, true);
    }
    if (download && !download.dataset.v1716) {
      download.dataset.v1716 = "1";
      download.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        finalizeForSuccess(download, { download: true });
      }, true);
    }
  }

  function init() {
    injectStyles();
    patchGlobalSearchLogic();
    moveGlobalSearchToTop();
    injectContactFields();
    patchQuotePayload();
    createSuccessModal();
    checkDraftExpiry();
    installDraftTracking();
    interceptFinalizeButtons();
    restoreSuccessIfValid();
    console.info(`Fruto de Arte ${VERSION} ativo`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
