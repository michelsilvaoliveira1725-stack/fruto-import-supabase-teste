(() => {
  "use strict";

  let lastQuoteNumber = null;
  const quoteLabel = n => n ? `ORC-${String(n).padStart(6, "0")}` : "";

  function injectStyles() {
    if (document.getElementById("siteV1715Styles")) return;
    const style = document.createElement("style");
    style.id = "siteV1715Styles";
    style.textContent = `
      .global-catalog-search{margin-top:18px;display:flex;gap:8px;max-width:700px}
      .global-catalog-search input{flex:1;min-width:0;height:46px;border:1px solid #d9e0eb;border-radius:13px;padding:0 15px;font:inherit;background:#fff;box-shadow:0 8px 24px rgba(11,23,54,.06)}
      .global-catalog-search button{height:46px;border:0;border-radius:13px;padding:0 18px;background:#0b1736;color:#fff;font-weight:800;cursor:pointer}
      .global-search-hint{display:block;margin-top:7px;color:#758096;font-size:12px}
      .customer-contact-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .customer-contact-fields label{min-width:0}
      @media(max-width:650px){.global-catalog-search{flex-direction:column}.global-catalog-search button{width:100%}.customer-contact-fields{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectGlobalSearch() {
    const landingCopy = document.querySelector("#landing .landing-copy > div");
    if (!landingCopy || document.getElementById("globalCatalogSearch")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="global-catalog-search" id="globalCatalogSearch">
        <input id="globalCatalogSearchInput" type="search" placeholder="Buscar código ou produto nas 3 marcas" aria-label="Buscar em todo o catálogo">
        <button type="button" id="globalCatalogSearchBtn">Buscar em tudo</button>
      </div>
      <small class="global-search-hint">Pesquisa simultaneamente Sennelier, Schmincke e Raphaël.</small>`;
    landingCopy.appendChild(wrap);

    const input = document.getElementById("globalCatalogSearchInput");
    const run = () => {
      const term = String(input.value || "").trim();
      if (!term) return;
      currentBrand = "__GLOBAL__";
      currentCat = "Todos";
      currentVariation = "Todas";
      currentSeries = "Todas";
      visibleLimit = PAGE_SIZE;
      document.getElementById("landing")?.classList.add("hidden");
      document.getElementById("catalogSection")?.classList.remove("hidden");
      document.getElementById("headerSearch")?.classList.remove("hidden");
      document.querySelectorAll(".nav-brand").forEach(b => b.classList.remove("active"));
      const search = document.getElementById("search");
      if (search) search.value = term;
      const cats = document.getElementById("cats"); if (cats) cats.textContent = "";
      document.getElementById("variationFilters")?.classList.add("hidden");
      document.getElementById("seriesFilters")?.classList.add("hidden");
      const title = document.getElementById("catalogTitle"); if (title) title.textContent = "Busca em todo o catálogo";
      const subtitle = document.getElementById("catalogSubtitle"); if (subtitle) subtitle.textContent = "Resultados encontrados nas marcas Sennelier, Schmincke e Raphaël.";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.getElementById("globalCatalogSearchBtn")?.addEventListener("click", run);
    input?.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
  }

  function patchGlobalSearchLogic() {
    if (typeof filteredProducts !== "function" || filteredProducts.__v1715) return;
    const originalFiltered = filteredProducts;
    filteredProducts = function() {
      if (currentBrand !== "__GLOBAL__") return originalFiltered();
      const q = String(document.getElementById("search")?.value || "").toLowerCase().trim();
      return products.filter(p => !q || `${p.code} ${p.name} ${p.brand} ${p.cat} ${p.variation || ""} ${p.series || ""}`.toLowerCase().includes(q));
    };
    filteredProducts.__v1715 = true;

    if (typeof categories === "function" && !categories.__v1715) {
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
      categories.__v1715 = true;
    }

    if (typeof render === "function" && !render.__v1715) {
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
      render.__v1715 = true;
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
    if (typeof quotePayload !== "function" || quotePayload.__v1715) return;
    const originalPayload = quotePayload;
    quotePayload = function() {
      return {
        ...originalPayload(),
        phone: String(document.getElementById("customerPhone")?.value || "").trim(),
        email: String(document.getElementById("customerEmail")?.value || "").trim()
      };
    };
    quotePayload.__v1715 = true;

    if (typeof resetQuoteAfterFinalize === "function" && !resetQuoteAfterFinalize.__v1715) {
      const originalReset = resetQuoteAfterFinalize;
      resetQuoteAfterFinalize = function() {
        originalReset();
        const phone = document.getElementById("customerPhone"); if (phone) phone.value = "";
        const email = document.getElementById("customerEmail"); if (email) email.value = "";
      };
      resetQuoteAfterFinalize.__v1715 = true;
    }

    if (typeof saveFinalizedQuote === "function" && !saveFinalizedQuote.__v1715) {
      const originalSave = saveFinalizedQuote;
      saveFinalizedQuote = async function(...args) {
        const data = await originalSave(...args);
        lastQuoteNumber = data?.quoteNumber || data?.quote?.quote_number || null;
        return data;
      };
      saveFinalizedQuote.__v1715 = true;
    }

    if (typeof whatsappMessage === "function" && !whatsappMessage.__v1715) {
      whatsappMessage = function(pdfUrl = "") {
        const ref = quoteLabel(lastQuoteNumber);
        const lines = [ref ? `Olá, Fruto de Arte! Segue o orçamento ${ref} em PDF:` : "Olá, Fruto de Arte! Segue o orçamento em PDF:"];
        if (pdfUrl) lines.push(pdfUrl);
        return lines.join("\n");
      };
      whatsappMessage.__v1715 = true;
    }
  }

  function init() {
    injectStyles();
    patchGlobalSearchLogic();
    injectGlobalSearch();
    injectContactFields();
    patchQuotePayload();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
