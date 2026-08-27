const $ = id => document.getElementById(id);
const PAGE_SIZE = 100;
const DEFAULT_HOME = {
  eyebrow: "CATÁLOGO DIGITAL · FRUTO IMPORT",
  title: "Duas referências mundiais em materiais artísticos.",
  intro: "Explore os produtos Sennelier e Schmincke, monte sua seleção e solicite seu orçamento de forma rápida.",
  benefits: [
    { title: "Busca rápida", text: "Encontre por nome, código ou categoria." },
    { title: "Quantidade já na seleção", text: "Informe a quantidade desejada antes de adicionar ao orçamento." },
    { title: "PDF + WhatsApp", text: "Gere o PDF e abra automaticamente a conversa com a Fruto Import." }
  ],
  sennelier: {
    kicker: "Sennelier 🇫🇷",
    title: "SENNELIER",
    description: "Desde 1887 — tradição francesa em pigmentos, pastéis, óleos, aquarelas e materiais para artistas.",
    chip1: "até 2.000 produtos",
    chip2: "Pastéis",
    chip3: "Aquarelas",
    button: "Ver Catálogo Sennelier →",
    image: "/assets/hero-sennelier.webp",
    catalogImage: "",
    catalogTitle: "Catálogo Sennelier",
    catalogSubtitle: "Materiais artísticos de tradição francesa — selecione os produtos e monte sua solicitação de orçamento."
  },
  schmincke: {
    kicker: "Schmincke 🇩🇪",
    title: "SCHMINCKE",
    description: "Excelência alemã em aquarelas, tintas artísticas, Horadam e linhas profissionais de alta performance.",
    chip1: "até 2.000 produtos",
    chip2: "Horadam",
    chip3: "Aero Color",
    button: "Ver Catálogo Schmincke →",
    image: "/assets/hero-schmincke.webp",
    catalogImage: "",
    catalogTitle: "Catálogo Schmincke",
    catalogSubtitle: "Materiais artísticos de excelência alemã — selecione os produtos e monte sua solicitação de orçamento."
  },
  videos: {
    enabled: false,
    title: "Novidades em Vídeo",
    subtitle: "Assista às demonstrações e conheça de perto nossos materiais.",
    showAllButton: false,
    allButtonText: "Ver todos os vídeos",
    allButtonUrl: "",
    items: Array.from({ length: 4 }, () => ({ enabled: false, tag: "Novidade", title: "", subtitle: "", duration: "", url: "", thumbnail: "" }))
  }
};
const DEFAULT_QUOTE = {
  title: "Minha solicitação", intro: "As quantidades já foram definidas na escolha dos produtos. Confira a solicitação antes de gerar o PDF.",
  pdfHeaderTitle: "FRUTO IMPORT", pdfHeaderSubtitle: "Solicitação de Orçamento", pdfContactLabel: "WhatsApp Fruto Import", pdfFooterText: "Fruto Import",
  showCustomer: true, showNote: true, showSummary: true, showGrandTotal: true, showDownloadPdf: true, showShareNote: true,
  columns: { product: true, code: true, series: false, salePack: false, quantity: true, unitPrice: true, subtotal: false }
};

let token = localStorage.getItem("fruto_import_admin_token") || "";
let products = [];
let configured = false;
let page = 1;
let activeAdminBrand = "all";
let activeAvailability = "all";
let activeQualityFilter = "all";
let activeAdminSection = localStorage.getItem("fruto_import_admin_section") || "productsSection";
let editingImages = [];
let pendingImageFiles = [];
let pendingPrimaryFile = null;
let duplicateSessionActive = false;
let saveContinueDuplicate = false;
function productCodeKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .toLowerCase();
}

let removedImages = [];
let removedVideoThumbs = [];
const MAX_PRODUCT_IMAGES = 10;
let currentSettings = { businessName: "Fruto Import", whatsapp: "5511996576368", home: DEFAULT_HOME, quote: DEFAULT_QUOTE };

function notice(id, msg, type = "") {
  const el = $(id);
  el.textContent = msg;
  el.className = `notice ${type}`;
  el.classList.toggle("hidden", !msg);
}

function numericPrice(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function discountValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(100, Math.round(n * 10) / 10) : 0;
}

function formatMoney(value) {
  const n = numericPrice(value);
  return n === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function finalPrice(product) {
  const price = numericPrice(product.price);
  const discount = discountValue(product.discountPercent);
  if (price === null) return null;
  return product.discountActive && discount > 0 ? Math.round(price * (1 - discount / 100) * 100) / 100 : price;
}

function productImages(product) {
  const source = Array.isArray(product?.images) ? product.images : [product?.image];
  return [...new Set(source.map(v => String(v || "").trim()).filter(Boolean))].slice(0, MAX_PRODUCT_IMAGES);
}

// V16.4: fallback de visualização para que fotos do Supabase e dos CDNs atuais
// abram de forma consistente em computadores/redes diferentes. A URL original
// continua sendo a que é salva no cadastro do produto.
const ADMIN_RELIABLE_IMAGE_HOSTS = new Set([
  "scwrzdwxnkjqkiawvdve.supabase.co",
  "cdn.shopify.com",
  "img2.activant-inet.com",
  "cdn.abicart.com"
]);

function adminImageCandidates(url) {
  const raw = String(url || "").trim();
  if (!raw) return [];
  const out = [raw];
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol === "https:" && ADMIN_RELIABLE_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) {
      out.push(`/api/image-proxy?url=${encodeURIComponent(parsed.href)}`);
    }
  } catch {}
  return [...new Set(out)];
}

function attachAdminReliableImage(img, url, { alt = "", lazy = true } = {}) {
  const candidates = adminImageCandidates(url);
  img.alt = alt;
  if (lazy) img.loading = "lazy";
  else img.removeAttribute("loading");
  img.decoding = "async";
  let index = 0;
  const load = () => {
    if (index >= candidates.length) {
      img.removeAttribute("src");
      img.classList.add("image-load-failed");
      return;
    }
    img.classList.remove("image-load-failed");
    img.src = candidates[index];
  };
  img.onload = () => img.classList.remove("image-load-failed");
  img.onerror = () => { index += 1; load(); };
  load();
  return img;
}

function seriesLabel(value) {
  const clean = String(value || "").trim().replace(/^s[eé]rie\s*/i, "");
  return clean ? `Série ${clean}` : "";
}

function variationValue(value) {
  return String(value || "").trim();
}

function salePackValue(value) {
  const pack = Number(value);
  return pack === 5 ? 5 : pack === 3 ? 3 : 1;
}

function salePackLabel(product) {
  const pack = salePackValue(product?.salePack);
  return pack === 1 ? "Unitário" : `Fechado com ${pack}`;
}

async function api(url, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (opts.json) {
    headers.set("Content-Type", "application/json");
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }
  const r = await fetch(url, { ...opts, headers, cache: "no-store" });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function normalizedHome(raw) {
  const home = raw && typeof raw === "object" ? raw : {};
  const v = home.videos && typeof home.videos === "object" ? home.videos : {};
  return {
    ...DEFAULT_HOME,
    ...home,
    benefits: DEFAULT_HOME.benefits.map((fallback, i) => ({ ...fallback, ...(Array.isArray(home.benefits) ? home.benefits[i] : {}) })),
    sennelier: { ...DEFAULT_HOME.sennelier, ...(home.sennelier || {}) },
    schmincke: { ...DEFAULT_HOME.schmincke, ...(home.schmincke || {}) },
    videos: {
      ...DEFAULT_HOME.videos,
      ...v,
      items: DEFAULT_HOME.videos.items.map((fallback, i) => ({ ...fallback, ...(Array.isArray(v.items) ? v.items[i] : {}) }))
    }
  };
}
function normalizedQuote(raw) {
  const q = raw && typeof raw === "object" ? raw : {};
  return { ...DEFAULT_QUOTE, ...q, columns: { ...DEFAULT_QUOTE.columns, ...(q.columns || {}) } };
}

async function checkStatus() {
  try {
    const d = await api("/api/admin/status");
    configured = !!d.configured;
    if (token) {
      try {
        await Promise.all([loadProducts(), loadSettings()]);
        showDashboard();
        return;
      } catch {
        token = "";
        localStorage.removeItem("fruto_import_admin_token");
      }
    }
    showAuth();
  } catch (e) {
    $("authIntro").textContent = "Não foi possível conectar ao painel.";
    notice("authNotice", e.message, "error");
  }
}

function showAuth() {
  $("authBox").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("setupFields").classList.toggle("hidden", configured);
  $("loginFields").classList.toggle("hidden", !configured);
  $("authIntro").textContent = configured
    ? "Entre com sua senha para administrar o catálogo."
    : "Primeiro acesso: use a chave inicial fornecida e crie sua senha de administrador.";
}

function setAdminSection(sectionId, persist = true) {
  const allowed = new Set(["overviewSection", "productsSection", "homepageSection", "serviceSection"]);
  const target = allowed.has(sectionId) ? sectionId : "productsSection";
  activeAdminSection = target;
  document.querySelectorAll(".admin-section").forEach(section => {
    section.classList.toggle("hidden", section.id !== target);
  });

document.querySelectorAll(".admin-section-tab").forEach(button => {
    const active = button.dataset.adminSection === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (persist) localStorage.setItem("fruto_import_admin_section", target);
}

function setProductBrandFilter(brand) {
  activeAdminBrand = ["Sennelier", "Schmincke"].includes(brand) ? brand : "all";
  page = 1;
  document.querySelectorAll(".product-brand-tab").forEach(button => {
    const active = button.dataset.productBrand === activeAdminBrand;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (!$('originalCode').value && activeAdminBrand !== "all") $('brand').value = activeAdminBrand;
  renderRows();
}

function showDashboard() {
  $("authBox").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  updateStats();
  setAdminSection(activeAdminSection, false);
  renderRows();
}

async function setup() {
  notice("authNotice", "");
  try {
    const d = await api("/api/admin/setup", {
      method: "POST",
      json: { setupKey: $("setupKey").value, password: $("setupPassword").value }
    });
    token = d.token;
    localStorage.setItem("fruto_import_admin_token", token);
    configured = true;
    await Promise.all([loadProducts(), loadSettings()]);
    showDashboard();
    notice("mainNotice", "Administrador configurado. O catálogo já está pronto para receber produtos e personalizações.", "success");
  } catch (e) {
    notice("authNotice", e.message, "error");
  }
}

async function login() {
  notice("authNotice", "");
  try {
    const d = await api("/api/admin/login", { method: "POST", json: { password: $("loginPassword").value } });
    token = d.token;
    localStorage.setItem("fruto_import_admin_token", token);
    await Promise.all([loadProducts(), loadSettings()]);
    showDashboard();
  } catch (e) {
    notice("authNotice", e.message, "error");
  }
}

async function resetPassword() {
  notice("authNotice", "");
  const password = $("resetPassword").value;
  const confirm = $("resetPasswordConfirm").value;
  if (password.length < 8) return notice("authNotice", "A nova senha deve ter pelo menos 8 caracteres.", "error");
  if (password !== confirm) return notice("authNotice", "As senhas não conferem.", "error");
  try {
    const d = await api("/api/admin/reset", { method: "POST", json: { setupKey: $("resetKey").value, password } });
    token = d.token;
    localStorage.setItem("fruto_import_admin_token", token);
    await Promise.all([loadProducts(), loadSettings()]);
    showDashboard();
    notice("mainNotice", "Senha redefinida com sucesso.", "success");
    $("resetKey").value = $("resetPassword").value = $("resetPasswordConfirm").value = "";
  } catch (e) {
    notice("authNotice", e.message, "error");
  }
}

async function changePassword() {
  const password = $("changePassword").value;
  const confirm = $("changePasswordConfirm").value;
  if (password.length < 8) return notice("mainNotice", "A nova senha deve ter pelo menos 8 caracteres.", "error");
  if (password !== confirm) return notice("mainNotice", "As senhas não conferem.", "error");
  try {
    const d = await api("/api/admin/change-password", { method: "POST", json: { password } });
    token = d.token;
    localStorage.setItem("fruto_import_admin_token", token);
    $("changePassword").value = $("changePasswordConfirm").value = "";
    notice("mainNotice", "Senha alterada com sucesso.", "success");
  } catch (e) {
    notice("mainNotice", e.message, "error");
  }
}

async function loadProducts() {
  const d = await api("/api/products");
  products = Array.isArray(d.products) ? d.products : [];
  updateStats();
  renderRows();
  refreshBulkFilters();
  refreshOrganizeFilters();
}

async function loadSettings() {
  const d = await api("/api/settings");
  currentSettings = { ...currentSettings, ...d, home: normalizedHome(d.home), quote: normalizedQuote(d.quote) };
  $("whatsapp").value = currentSettings.whatsapp || "5511996576368";
  fillQuoteForm(currentSettings.quote);
  fillHomeForm(currentSettings.home);
}

function fillQuoteForm(raw) {
  const q = normalizedQuote(raw);
  $("quoteTitleAdmin").value = q.title;
  $("quoteIntroAdmin").value = q.intro;
  $("pdfHeaderTitleAdmin").value = q.pdfHeaderTitle;
  $("pdfHeaderSubtitleAdmin").value = q.pdfHeaderSubtitle;
  $("pdfContactLabelAdmin").value = q.pdfContactLabel;
  $("pdfFooterTextAdmin").value = q.pdfFooterText;
  $("quoteShowCustomer").checked = q.showCustomer;
  $("quoteShowNote").checked = q.showNote;
  $("quoteShowSummary").checked = q.showSummary;
  $("quoteShowGrandTotal").checked = q.showGrandTotal;
  $("quoteShowDownloadPdf").checked = q.showDownloadPdf;
  $("quoteShowShareNote").checked = q.showShareNote;
  const map = { Product:"product", Code:"code", Series:"series", SalePack:"salePack", Quantity:"quantity", UnitPrice:"unitPrice", Subtotal:"subtotal" };
  Object.entries(map).forEach(([id, key]) => $(`quoteCol${id}`).checked = Boolean(q.columns[key]));
}
function quotePayloadAdmin() {
  return {
    title: $("quoteTitleAdmin").value,
    intro: $("quoteIntroAdmin").value,
    pdfHeaderTitle: $("pdfHeaderTitleAdmin").value,
    pdfHeaderSubtitle: $("pdfHeaderSubtitleAdmin").value,
    pdfContactLabel: $("pdfContactLabelAdmin").value,
    pdfFooterText: $("pdfFooterTextAdmin").value,
    showCustomer: $("quoteShowCustomer").checked,
    showNote: $("quoteShowNote").checked,
    showSummary: $("quoteShowSummary").checked,
    showGrandTotal: $("quoteShowGrandTotal").checked,
    showDownloadPdf: $("quoteShowDownloadPdf").checked,
    showShareNote: $("quoteShowShareNote").checked,
    columns: {
      product: $("quoteColProduct").checked, code: $("quoteColCode").checked, series: $("quoteColSeries").checked,
      salePack: $("quoteColSalePack").checked, quantity: $("quoteColQuantity").checked,
      unitPrice: $("quoteColUnitPrice").checked, subtotal: $("quoteColSubtotal").checked
    }
  };
}
function renderVideoSlotsAdmin(home) {
  const box = $("videoSlotsAdmin");
  box.textContent = "";
  const videos = normalizedHome(home).videos;
  videos.items.forEach((item, i) => {
    const n = i + 1;
    const card = document.createElement("div");
    card.className = "video-slot-admin";
    card.innerHTML = `
      <div class="video-slot-head"><b>Vídeo ${n}</b><label><input type="checkbox" id="video${n}Enabled" ${item.enabled ? "checked" : ""}> Exibir</label></div>
      <input type="hidden" id="video${n}CurrentThumb" value="${String(item.thumbnail || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">
      <div class="form-grid">
        <div class="field"><label>Selo</label><input id="video${n}Tag" maxlength="40" value="${String(item.tag || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>
        <div class="field"><label>Duração</label><input id="video${n}Duration" maxlength="12" placeholder="01:30" value="${String(item.duration || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>
        <div class="field full"><label>Título</label><input id="video${n}Title" maxlength="100" value="${String(item.title || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>
        <div class="field full"><label>Texto curto</label><input id="video${n}Subtitle" maxlength="140" value="${String(item.subtitle || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>
        <div class="field full"><label>Link do vídeo</label><input id="video${n}Url" maxlength="500" placeholder="https://..." value="${String(item.url || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>
        <div class="field full"><label>Miniatura</label><input id="video${n}ThumbFile" type="file" accept="image/jpeg,image/png,image/webp"></div>
      </div>
      <div class="video-admin-actions">
        <button type="button" class="secondary small-button" id="video${n}RemoveThumb">Excluir miniatura</button>
        <button type="button" class="danger small-button" id="video${n}Clear">Excluir vídeo</button>
      </div>
      <img id="video${n}ThumbPreview" class="video-admin-preview ${item.thumbnail ? "" : "hidden"}" src="${String(item.thumbnail || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" alt="Prévia do vídeo ${n}">
    `;
    box.appendChild(card);
    $(`video${n}ThumbFile`).addEventListener("change", () => previewFile(`video${n}ThumbFile`, `video${n}ThumbPreview`));
    $(`video${n}Enabled`).addEventListener("change", () => { if ($(`video${n}Enabled`).checked) $("videosEnabledAdmin").checked = true; });
    $(`video${n}RemoveThumb`).addEventListener("click", () => {
      const old = $(`video${n}CurrentThumb`).value;
      if (old) removedVideoThumbs.push(old);
      $(`video${n}CurrentThumb`).value = "";
      $(`video${n}ThumbFile`).value = "";
      const preview = $(`video${n}ThumbPreview`); preview.src = ""; preview.classList.add("hidden");
    });
    $(`video${n}Clear`).addEventListener("click", () => {
      const old = $(`video${n}CurrentThumb`).value;
      if (old) removedVideoThumbs.push(old);
      $(`video${n}Enabled`).checked = false;
      $(`video${n}Tag`).value = "Novidade";
      $(`video${n}Duration`).value = "";
      $(`video${n}Title`).value = "";
      $(`video${n}Subtitle`).value = "";
      $(`video${n}Url`).value = "";
      $(`video${n}CurrentThumb`).value = "";
      $(`video${n}ThumbFile`).value = "";
      const preview = $(`video${n}ThumbPreview`); preview.src = ""; preview.classList.add("hidden");
    });
  });
}

function fillHomeForm(home) {
  const h = normalizedHome(home);
  $("homeEyebrow").value = h.eyebrow;
  $("homeTitle").value = h.title;
  $("homeIntro").value = h.intro;

  $("currentSennelierHero").value = h.sennelier.image;
  $("sennelierHeroPreview").src = h.sennelier.image;
  $("sennelierKickerAdmin").value = h.sennelier.kicker;
  $("sennelierTitleAdmin").value = h.sennelier.title;
  $("sennelierDescriptionAdmin").value = h.sennelier.description;
  $("sennelierChip1Admin").value = h.sennelier.chip1;
  $("sennelierChip2Admin").value = h.sennelier.chip2;
  $("sennelierChip3Admin").value = h.sennelier.chip3;
  $("sennelierButtonAdmin").value = h.sennelier.button;
  $("sennelierCatalogTitleAdmin").value = h.sennelier.catalogTitle;
  $("sennelierCatalogSubtitleAdmin").value = h.sennelier.catalogSubtitle;
  $("currentSennelierCatalogHero").value = h.sennelier.catalogImage || "";
  $("sennelierCatalogHeroPreview").src = h.sennelier.catalogImage || "";
  $("sennelierCatalogHeroPreview").classList.toggle("hidden", !h.sennelier.catalogImage);

  $("currentSchminckeHero").value = h.schmincke.image;
  $("schminckeHeroPreview").src = h.schmincke.image;
  $("schminckeKickerAdmin").value = h.schmincke.kicker;
  $("schminckeTitleAdmin").value = h.schmincke.title;
  $("schminckeDescriptionAdmin").value = h.schmincke.description;
  $("schminckeChip1Admin").value = h.schmincke.chip1;
  $("schminckeChip2Admin").value = h.schmincke.chip2;
  $("schminckeChip3Admin").value = h.schmincke.chip3;
  $("schminckeButtonAdmin").value = h.schmincke.button;
  $("schminckeCatalogTitleAdmin").value = h.schmincke.catalogTitle;
  $("schminckeCatalogSubtitleAdmin").value = h.schmincke.catalogSubtitle;
  $("currentSchminckeCatalogHero").value = h.schmincke.catalogImage || "";
  $("schminckeCatalogHeroPreview").src = h.schmincke.catalogImage || "";
  $("schminckeCatalogHeroPreview").classList.toggle("hidden", !h.schmincke.catalogImage);

  h.benefits.forEach((item, i) => {
    $(`benefit${i + 1}TitleAdmin`).value = item.title;
    $(`benefit${i + 1}TextAdmin`).value = item.text;
  });
  $("videosEnabledAdmin").checked = h.videos.enabled;
  $("videosTitleAdmin").value = h.videos.title;
  $("videosSubtitleAdmin").value = h.videos.subtitle;
  $("videosShowAllAdmin").checked = h.videos.showAllButton;
  $("videosAllButtonTextAdmin").value = h.videos.allButtonText;
  $("videosAllButtonUrlAdmin").value = h.videos.allButtonUrl;
  renderVideoSlotsAdmin(h);
}

function updateStats() {
  if (!$("statSennelier")) return;
  const sen = products.filter(p => p.brand === "Sennelier").length;
  const sch = products.filter(p => p.brand === "Schmincke").length;
  $("statSennelier").textContent = sen.toLocaleString("pt-BR");
  $("statSchmincke").textContent = sch.toLocaleString("pt-BR");
  if ($("brandCountSennelier")) $("brandCountSennelier").textContent = sen.toLocaleString("pt-BR");
  if ($("brandCountSchmincke")) $("brandCountSchmincke").textContent = sch.toLocaleString("pt-BR");
  const available = products.filter(isAvailable).length;
  const soldout = products.length - available;
  const lowStock = products.filter(p => stockControlEnabled(p) && isAvailable(p) && stockQuantityValue(p.stockQuantity) <= 3).length;
  const noPrice = products.filter(p => numericPrice(p.price) === null).length;
  const noPhoto = products.filter(p => productImages(p).length === 0).length;
  if ($("overviewTotal")) $("overviewTotal").textContent = products.length.toLocaleString("pt-BR");
  if ($("overviewAvailable")) $("overviewAvailable").textContent = available.toLocaleString("pt-BR");
  if ($("overviewSoldout")) $("overviewSoldout").textContent = soldout.toLocaleString("pt-BR");
  if ($("overviewLowStock")) $("overviewLowStock").textContent = lowStock.toLocaleString("pt-BR");
  if ($("overviewNoPrice")) $("overviewNoPrice").textContent = noPrice.toLocaleString("pt-BR");
  if ($("overviewNoPhoto")) $("overviewNoPhoto").textContent = noPhoto.toLocaleString("pt-BR");
}

async function saveSettings() {
  notice("mainNotice", "");
  const button = $("saveSettings");
  button.disabled = true;
  try {
    const d = await api("/api/settings", { method: "PUT", json: { whatsapp: $("whatsapp").value, quote: quotePayloadAdmin() } });
    currentSettings = { ...currentSettings, ...d, home: normalizedHome(d.home || currentSettings.home), quote: normalizedQuote(d.quote) };
    $("whatsapp").value = d.whatsapp || "5511996576368";
    fillQuoteForm(currentSettings.quote);
    notice("mainNotice", "Atendimento e orçamento salvos com sucesso.", "success");
  } catch (e) {
    notice("mainNotice", e.message, "error");
  } finally {
    button.disabled = false;
  }
}

function stockControlEnabled(product) {
  return product?.stockControl === true;
}

function stockQuantityValue(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 999999) : 0;
}

function stockOrderLimit(product) {
  if (!stockControlEnabled(product)) return 9999;
  const pack = salePackValue(product?.salePack);
  return Math.floor(stockQuantityValue(product.stockQuantity) / pack) * pack;
}

function isAvailable(product) {
  return product?.available !== false && stockOrderLimit(product) >= salePackValue(product?.salePack);
}

function currentFiltered() {
  const q = $("adminSearch").value.toLowerCase().trim();
  return products.filter(p => {
    const brandOk = activeAdminBrand === "all" || p.brand === activeAdminBrand;
    const availabilityOk = activeAvailability === "all" || (activeAvailability === "available" ? isAvailable(p) : !isAvailable(p));
    const searchOk = !q || `${p.code} ${p.name} ${p.brand} ${p.cat} ${p.variation || ""} ${p.series || ""} ${salePackLabel(p)} ${isAvailable(p) ? "disponível" : "esgotado"}`.toLowerCase().includes(q);
    const qualityOk = activeQualityFilter === "all"
      || (activeQualityFilter === "lowstock" && stockControlEnabled(p) && isAvailable(p) && stockQuantityValue(p.stockQuantity) <= 3)
      || (activeQualityFilter === "noprice" && numericPrice(p.price) === null)
      || (activeQualityFilter === "nophoto" && productImages(p).length === 0)
      || (activeQualityFilter === "stockcontrol" && stockControlEnabled(p));
    return brandOk && availabilityOk && searchOk && qualityOk;
  });
}

function createAdminProductTable(list) {
  const wrap = document.createElement("div");
  wrap.className = "admin-list grouped-admin-list";
  const table = document.createElement("table");
  table.className = "admin-table";
  table.innerHTML = "<thead><tr><th>Foto</th><th>Produto</th><th>Detalhes</th><th>Preço</th><th>Ações</th></tr></thead>";
  const tb = document.createElement("tbody");

  list.forEach(p => {
    const tr = document.createElement("tr");
    if (!isAvailable(p)) tr.classList.add("soldout-row");
    const tdImg = document.createElement("td");
    const images = productImages(p);
    if (images[0]) {
      const img = document.createElement("img"); img.className = "thumb"; attachAdminReliableImage(img, images[0], { alt: p.name, lazy: true }); tdImg.appendChild(img);
      if (images.length > 1) { const count = document.createElement("div"); count.className = "admin-photo-count"; count.textContent = `${images.length} fotos`; tdImg.appendChild(count); }
    } else tdImg.textContent = "—";

    const tdName = document.createElement("td");
    const top = document.createElement("div"); top.className = "admin-product-name-line";
    const b = document.createElement("b"); b.textContent = p.name; top.appendChild(b);
    const badge = document.createElement("span"); badge.className = `availability-badge ${isAvailable(p) ? "available" : "soldout"}`; badge.textContent = isAvailable(p) ? "Disponível" : "Esgotado"; top.appendChild(badge);
    const small = document.createElement("div"); small.className = "product-code"; small.textContent = p.code;
    tdName.append(top, small);

    const tdMeta = document.createElement("td");
    tdMeta.textContent = `${variationValue(p.variation) ? `${variationValue(p.variation)} · ` : ""}${p.series ? `${seriesLabel(p.series)} · ` : ""}${salePackLabel(p)}${stockControlEnabled(p) ? ` · Estoque: ${stockQuantityValue(p.stockQuantity)}` : ""}`;

    const tdPrice = document.createElement("td"); tdPrice.className = "admin-price-cell";
    const basePrice = numericPrice(p.price), discount = discountValue(p.discountPercent);
    if (basePrice === null) tdPrice.textContent = "—";
    else if (p.discountActive && discount > 0) {
      const old = document.createElement("span"); old.className = "admin-old-price"; old.textContent = formatMoney(basePrice);
      const promo = document.createElement("b"); promo.textContent = `${formatMoney(finalPrice(p))} · -${String(discount).replace(".", ",")}%`;
      tdPrice.append(old, document.createElement("br"), promo);
    } else tdPrice.textContent = formatMoney(basePrice);

    const tdActions = document.createElement("td");
    const edit = document.createElement("button"); edit.className = "secondary small-button"; edit.textContent = "Editar"; edit.addEventListener("click", () => editProduct(p.code));
    const duplicate = document.createElement("button"); duplicate.className = "secondary small-button"; duplicate.textContent = "Duplicar"; duplicate.addEventListener("click", () => duplicateProduct(p.code));
    const del = document.createElement("button"); del.className = "danger small-button"; del.textContent = "Excluir"; del.addEventListener("click", () => deleteProduct(p.code));
    const actionsWrap = document.createElement("div"); actionsWrap.className = "admin-row-actions"; actionsWrap.append(edit, duplicate, del);
    tdActions.append(actionsWrap);
    tr.append(tdImg, tdName, tdMeta, tdPrice, tdActions); tb.appendChild(tr);
  });
  table.appendChild(tb); wrap.appendChild(table); return wrap;
}

function renderRows() {
  const host = $("productGroups"); if (!host) return;
  const list = currentFiltered();
  host.textContent = "";
  $("noRows").classList.toggle("hidden", !!list.length);
  const availableCount = list.filter(isAvailable).length;
  const soldCount = list.length - availableCount;
  $("adminResult").textContent = `${activeAdminBrand === "all" ? "Todos" : activeAdminBrand} · ${list.length.toLocaleString("pt-BR")} produto(s) · ${availableCount} disponíveis · ${soldCount} esgotados`;
  if (!list.length) return;

  const q = $("adminSearch").value.trim();
  const brands = activeAdminBrand === "all" ? ["Sennelier", "Schmincke"] : [activeAdminBrand];
  brands.forEach(brand => {
    const brandProducts = list.filter(p => p.brand === brand);
    if (!brandProducts.length) return;
    const brandSection = document.createElement("section"); brandSection.className = "admin-brand-group";
    const brandHead = document.createElement("div"); brandHead.className = "admin-brand-group-head";
    const bh = document.createElement("h3"); bh.textContent = brand;
    const bc = document.createElement("span"); bc.textContent = `${brandProducts.length} produto(s)`;
    brandHead.append(bh, bc); brandSection.appendChild(brandHead);

    const cats = [...new Set(brandProducts.map(p => p.cat || "Sem categoria"))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
    cats.forEach(cat => {
      const catProducts = brandProducts.filter(p => (p.cat || "Sem categoria") === cat).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{numeric:true}));
      const details = document.createElement("details"); details.className = "admin-category-group"; if (q) details.open = true;
      const summary = document.createElement("summary");
      const title = document.createElement("span"); title.className = "category-group-title"; title.textContent = cat;
      const counts = document.createElement("span"); counts.className = "category-group-counts";
      const avail = catProducts.filter(isAvailable).length; counts.textContent = `${catProducts.length} produto(s) · ${avail} disp. · ${catProducts.length-avail} esg.`;
      summary.append(title, counts); details.appendChild(summary);

      const variationKeys = [...new Set(catProducts.map(p => variationValue(p.variation) || "__semvariacao"))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
      const hasVariations = variationKeys.some(value => value !== "__semvariacao");
      const appendSeriesGroups = (container, subset) => {
        const withSeries = subset.some(p => String(p.series || "").trim());
        if (!withSeries) { container.appendChild(createAdminProductTable(subset)); return; }
        const seriesValues = [...new Set(subset.map(p => String(p.series || "").trim() || "__semserie"))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
        seriesValues.forEach(series => {
          const seriesProducts = subset.filter(p => (String(p.series || "").trim() || "__semserie") === series);
          const block = document.createElement("div"); block.className = "admin-series-group";
          const head = document.createElement("div"); head.className = "admin-series-group-head";
          head.textContent = series === "__semserie" ? `Sem série · ${seriesProducts.length}` : `${seriesLabel(series)} · ${seriesProducts.length}`;
          block.append(head, createAdminProductTable(seriesProducts)); container.appendChild(block);
        });
      };
      if (hasVariations) {
        variationKeys.forEach(variation => {
          const variationProducts = catProducts.filter(p => (variationValue(p.variation) || "__semvariacao") === variation);
          const block = document.createElement("div"); block.className = "admin-variation-group";
          const head = document.createElement("div"); head.className = "admin-variation-group-head";
          head.textContent = variation === "__semvariacao" ? `Sem variação · ${variationProducts.length}` : `${variation} · ${variationProducts.length}`;
          block.appendChild(head);
          appendSeriesGroups(block, variationProducts);
          details.appendChild(block);
        });
      } else appendSeriesGroups(details, catProducts);
      brandSection.appendChild(details);
    });
    host.appendChild(brandSection);
  });
}

function resetForm() {
  $("productForm").reset();
  $("originalCode").value = "";
  editingImages = [];
  pendingImageFiles = [];
  pendingPrimaryFile = null;
  removedImages = [];
  $("formTitle").textContent = "Novo produto";
  $("cancelEdit").classList.add("hidden");
  $("saveDuplicateNext")?.classList.add("hidden");
  $("endDuplicateSession")?.classList.add("hidden");
  duplicateSessionActive = false;
  saveContinueDuplicate = false;
  $("saveBtn").textContent = "Salvar produto";
  $("brand").value = activeAdminBrand === "Schmincke" ? "Schmincke" : "Sennelier";
  $("variation").value = "";
  $("series").value = "";
  $("shortDescription").value = "";
  $("salePack").value = "1";
  $("available").value = "true";
  $("stockControl").checked = false;
  $("stockQuantity").value = "";
  $("stockQuantityField").classList.add("hidden");
  $("price").value = "";
  $("discountPercent").value = "";
  $("discountActive").checked = false;
  $("imageFiles").value = "";
  renderProductImageEditor();
}

function editProduct(code) {
  duplicateSessionActive = false;
  saveContinueDuplicate = false;
  $("saveDuplicateNext")?.classList.add("hidden");
  $("endDuplicateSession")?.classList.add("hidden");
  const p = products.find(x => productCodeKey(x.code) === productCodeKey(code));
  if (!p) return;
  setAdminSection("productsSection");
  $("originalCode").value = p.code;
  $("code").value = p.code;
  $("name").value = p.name;
  $("brand").value = p.brand;
  $("cat").value = p.cat;
  $("variation").value = p.variation || "";
  $("series").value = p.series || "";
  $("shortDescription").value = p.shortDescription || "";
  $("salePack").value = String(salePackValue(p.salePack));
  $("available").value = p.available === false ? "false" : "true";
  $("stockControl").checked = stockControlEnabled(p);
  $("stockQuantity").value = stockControlEnabled(p) ? stockQuantityValue(p.stockQuantity) : "";
  $("stockQuantityField").classList.toggle("hidden", !stockControlEnabled(p));
  $("price").value = numericPrice(p.price) ?? "";
  $("discountPercent").value = discountValue(p.discountPercent) || "";
  $("discountActive").checked = Boolean(p.discountActive);
  editingImages = productImages(p);
  pendingImageFiles = [];
  pendingPrimaryFile = null;
  removedImages = [];
  $("imageFiles").value = "";
  renderProductImageEditor();
  $("formTitle").textContent = "Editar produto";
  $("cancelEdit").classList.remove("hidden");
  $("saveBtn").textContent = "Salvar alterações";
  window.scrollTo({ top: document.querySelector("#productForm").getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
}

function fillDuplicateForm(p, message = true) {
  $("originalCode").value = "";
  $("code").value = "";
  $("name").value = p.name || "";
  $("brand").value = p.brand || "Sennelier";
  $("cat").value = p.cat || "";
  $("variation").value = p.variation || "";
  $("series").value = p.series || "";
  $("shortDescription").value = p.shortDescription || "";
  $("salePack").value = String(salePackValue(p.salePack));
  $("available").value = p.available === false ? "false" : "true";
  $("stockControl").checked = stockControlEnabled(p);
  $("stockQuantity").value = stockControlEnabled(p) ? stockQuantityValue(p.stockQuantity) : "";
  $("stockQuantityField").classList.toggle("hidden", !stockControlEnabled(p));
  $("price").value = numericPrice(p.price) ?? "";
  $("discountPercent").value = discountValue(p.discountPercent) || "";
  $("discountActive").checked = Boolean(p.discountActive);
  editingImages = productImages(p);
  pendingImageFiles = [];
  pendingPrimaryFile = null;
  removedImages = [];
  $("imageFiles").value = "";
  renderProductImageEditor();
  $("formTitle").textContent = "Duplicação contínua";
  $("saveBtn").textContent = "Salvar e encerrar";
  $("saveDuplicateNext")?.classList.remove("hidden");
  $("endDuplicateSession")?.classList.remove("hidden");
  $("cancelEdit").classList.add("hidden");
  if (message) notice("mainNotice", "Sessão de duplicação iniciada. Informe um novo código e salve; use “Salvar e duplicar próximo” para continuar sem buscar o produto novamente.", "");
  $("code").focus();
}

function duplicateProduct(code) {
  const p = products.find(x => productCodeKey(x.code) === productCodeKey(code));
  if (!p) return;
  setAdminSection("productsSection");
  duplicateSessionActive = true;
  saveContinueDuplicate = false;
  fillDuplicateForm(p);
  window.scrollTo({ top: document.querySelector("#productForm").getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth" });
}

function endDuplicateSession() {
  resetForm();
  notice("mainNotice", "Sessão de duplicação encerrada. Formulário limpo.", "success");
}

function saveAndDuplicateNext() {
  if (!duplicateSessionActive) return;
  saveContinueDuplicate = true;
  $("productForm").requestSubmit();
}

function exportAdminBackup() {
  const payload = { exportedAt: new Date().toISOString(), version: "V16", products };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fruto-import-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice("mainNotice", "Backup dos produtos exportado.", "success");
}

function openProductsWithFilter(filter) {
  setAdminSection("productsSection");
  activeAdminBrand = "all"; activeAvailability = "all"; activeQualityFilter = "all";
  document.querySelectorAll(".product-brand-tab").forEach(b => b.classList.toggle("active", b.dataset.productBrand === "all"));
  document.querySelectorAll(".availability-tab").forEach(b => b.classList.toggle("active", b.dataset.availability === "all"));
  if (filter === "available" || filter === "soldout") {
    activeAvailability = filter;
    document.querySelectorAll(".availability-tab").forEach(b => b.classList.toggle("active", b.dataset.availability === filter));
  } else if (["lowstock","noprice","nophoto"].includes(filter)) activeQualityFilter = filter;
  if ($("adminQualityFilter")) $("adminQualityFilter").value = activeQualityFilter;
  $("adminSearch").value = "";
  renderRows();
  document.querySelector(".product-list-panel")?.scrollIntoView({behavior:"smooth", block:"start"});
}

function renderProductImageEditor() {
  const box = $("productImagesPreview");
  if (!box) return;
  box.textContent = "";

  editingImages.forEach((url, index) => {
    const isPrimary = pendingPrimaryFile === null && index === 0;
    const tile = document.createElement("div");
    tile.className = `admin-image-tile${isPrimary ? " primary" : ""}`;
    const img = document.createElement("img");
    attachAdminReliableImage(img, url, { alt: `Foto ${index + 1}`, lazy: false });
    const badge = document.createElement("span");
    badge.textContent = isPrimary ? "Principal" : `${index + 1}`;

    if (!isPrimary) {
      const makePrimary = document.createElement("button");
      makePrimary.type = "button";
      makePrimary.className = "admin-image-primary";
      makePrimary.textContent = "Tornar principal";
      makePrimary.setAttribute("aria-label", `Tornar a foto ${index + 1} principal`);
      makePrimary.addEventListener("click", () => {
        const [selected] = editingImages.splice(index, 1);
        if (selected) editingImages.unshift(selected);
        pendingPrimaryFile = null;
        renderProductImageEditor();
      });
      tile.appendChild(makePrimary);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-image-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remover foto ${index + 1}`);
    remove.addEventListener("click", () => {
      const [removed] = editingImages.splice(index, 1);
      if (removed) removedImages.push(removed);
      renderProductImageEditor();
    });
    tile.append(img, badge, remove);
    box.appendChild(tile);
  });

  pendingImageFiles.forEach((file, index) => {
    const becomesPrimaryByDefault = !editingImages.length && pendingPrimaryFile === null && index === 0;
    const isPrimary = pendingPrimaryFile === file || becomesPrimaryByDefault;
    const tile = document.createElement("div");
    tile.className = `admin-image-tile pending${isPrimary ? " primary" : ""}`;
    const img = document.createElement("img");
    const previewUrl = URL.createObjectURL(file);
    img.src = previewUrl;
    img.alt = `Nova foto ${index + 1}`;
    img.onload = () => URL.revokeObjectURL(previewUrl);
    const badge = document.createElement("span");
    badge.textContent = isPrimary ? "Principal" : "Nova";

    if (!isPrimary) {
      const makePrimary = document.createElement("button");
      makePrimary.type = "button";
      makePrimary.className = "admin-image-primary";
      makePrimary.textContent = "Tornar principal";
      makePrimary.setAttribute("aria-label", `Tornar a nova foto ${index + 1} principal`);
      makePrimary.addEventListener("click", () => {
        const [selected] = pendingImageFiles.splice(index, 1);
        if (selected) {
          pendingImageFiles.unshift(selected);
          pendingPrimaryFile = selected;
        }
        renderProductImageEditor();
      });
      tile.appendChild(makePrimary);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-image-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remover nova foto ${index + 1}`);
    remove.addEventListener("click", () => {
      const [removed] = pendingImageFiles.splice(index, 1);
      if (removed && pendingPrimaryFile === removed) pendingPrimaryFile = null;
      renderProductImageEditor();
    });
    tile.append(img, badge, remove);
    box.appendChild(tile);
  });

  if (!editingImages.length && !pendingImageFiles.length) {
    const empty = document.createElement("div");
    empty.className = "admin-images-empty";
    empty.textContent = "Nenhuma foto cadastrada.";
    box.appendChild(empty);
  }
  $("clearNewImages").classList.toggle("hidden", !pendingImageFiles.length);
}

async function optimizeImage(file, maxSide = 1600, quality = 0.84) {
  if (file.size > 15 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 15 MB antes da otimização.");
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 700 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch (err) {
    if (err && err.message && err.message.includes("15 MB")) throw err;
    return file;
  }
}

async function uploadImage(file, hero = false) {
  const optimized = await optimizeImage(file, hero ? 1800 : 1600, hero ? 0.82 : 0.84);
  if (optimized.size > 4 * 1024 * 1024) throw new Error("A foto continua acima de 4 MB após a otimização. Escolha uma imagem menor.");
  const fd = new FormData();
  fd.append("file", optimized);
  const d = await api("/api/images", { method: "POST", body: fd });
  return d.url;
}

function imageId(url) {
  const m = String(url || "").match(/^\/api\/images\/([^/?#]+)/);
  return m ? m[1] : "";
}

function supabaseUploadId(url) {
  const m = String(url || "").match(/\/storage\/v1\/object\/public\/product-images\/(uploads\/[^?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function deleteUploadedImage(url) {
  const id = imageId(url);
  if (id) return await api(`/api/images/${id}`, { method: "DELETE" });
  const storageId = supabaseUploadId(url);
  if (storageId) await api(`/api/images`, { method: "DELETE", json: { id: storageId } });
}

async function saveProduct(e) {
  e.preventDefault();
  notice("mainNotice", "");
  const btn = $("saveBtn");
  btn.disabled = true;
  const original = $("originalCode").value;
  const files = [...pendingImageFiles];
  const uploadedUrls = [];
  try {
    if (editingImages.length + files.length > MAX_PRODUCT_IMAGES) {
      throw new Error(`Use no máximo ${MAX_PRODUCT_IMAGES} fotos por produto.`);
    }
    for (const file of files) uploadedUrls.push(await uploadImage(file));
    const primaryPendingIndex = pendingPrimaryFile ? files.indexOf(pendingPrimaryFile) : -1;
    let images;
    if (primaryPendingIndex >= 0 && uploadedUrls[primaryPendingIndex]) {
      const primaryUrl = uploadedUrls[primaryPendingIndex];
      const remainingUploads = uploadedUrls.filter((_, index) => index !== primaryPendingIndex);
      images = [primaryUrl, ...editingImages, ...remainingUploads].slice(0, MAX_PRODUCT_IMAGES);
    } else {
      images = [...editingImages, ...uploadedUrls].slice(0, MAX_PRODUCT_IMAGES);
    }
    const payload = {
      code: $("code").value,
      name: $("name").value,
      brand: $("brand").value,
      cat: $("cat").value,
      variation: $("variation").value,
      series: $("series").value,
      shortDescription: $("shortDescription").value,
      available: $("available").value === "true",
      stockControl: $("stockControl").checked,
      stockQuantity: $("stockControl").checked ? stockQuantityValue($("stockQuantity").value) : 0,
      salePack: salePackValue($("salePack").value),
      price: $("price").value,
      discountPercent: $("discountPercent").value,
      discountActive: $("discountActive").checked,
      images,
      image: images[0] || ""
    };
    if (original) await api(`/api/products/${encodeURIComponent(original)}`, { method: "PUT", json: payload });
    else await api("/api/products", { method: "POST", json: payload });

    const keep = new Set(images);
    for (const url of removedImages) if (!keep.has(url)) deleteUploadedImage(url).catch(() => {});
    await loadProducts();
    if (!original && duplicateSessionActive && saveContinueDuplicate) {
      const nextBase = { ...payload, images, image: images[0] || "" };
      saveContinueDuplicate = false;
      duplicateSessionActive = true;
      fillDuplicateForm(nextBase, false);
      notice("mainNotice", "Produto salvo. A sessão continua aberta para o próximo item; informe o novo código e ajuste o que precisar.", "success");
    } else {
      resetForm();
      notice("mainNotice", original ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.", "success");
    }
  } catch (err) {
    saveContinueDuplicate = false;
    for (const url of uploadedUrls) deleteUploadedImage(url).catch(() => {});
    notice("mainNotice", err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function deleteProduct(code) {
  const p = products.find(x => productCodeKey(x.code) === productCodeKey(code));
  if (!p || !confirm(`Excluir ${p.code} — ${p.name}?`)) return;
  notice("mainNotice", "");
  try {
    await api(`/api/products/${encodeURIComponent(code)}`, { method: "DELETE" });
    for (const url of productImages(p)) deleteUploadedImage(url).catch(() => {});
    await loadProducts();
    if (productCodeKey($("originalCode").value) === productCodeKey(code)) resetForm();
    notice("mainNotice", "Produto excluído.", "success");
  } catch (e) {
    notice("mainNotice", e.message, "error");
  }
}

function homePayload(sennelierImage, schminckeImage, sennelierCatalogImage, schminckeCatalogImage) {
  return {
    eyebrow: $("homeEyebrow").value,
    title: $("homeTitle").value,
    intro: $("homeIntro").value,
    benefits: [1, 2, 3].map(i => ({
      title: $(`benefit${i}TitleAdmin`).value,
      text: $(`benefit${i}TextAdmin`).value
    })),
    videos: {
      enabled: $("videosEnabledAdmin").checked,
      title: $("videosTitleAdmin").value,
      subtitle: $("videosSubtitleAdmin").value,
      showAllButton: $("videosShowAllAdmin").checked,
      allButtonText: $("videosAllButtonTextAdmin").value,
      allButtonUrl: $("videosAllButtonUrlAdmin").value,
      items: [1,2,3,4].map(n => ({
        enabled: $(`video${n}Enabled`).checked,
        tag: $(`video${n}Tag`).value,
        title: $(`video${n}Title`).value,
        subtitle: $(`video${n}Subtitle`).value,
        duration: $(`video${n}Duration`).value,
        url: $(`video${n}Url`).value,
        thumbnail: $(`video${n}CurrentThumb`).value
      }))
    },
    sennelier: {
      kicker: $("sennelierKickerAdmin").value,
      title: $("sennelierTitleAdmin").value,
      description: $("sennelierDescriptionAdmin").value,
      chip1: $("sennelierChip1Admin").value,
      chip2: $("sennelierChip2Admin").value,
      chip3: $("sennelierChip3Admin").value,
      button: $("sennelierButtonAdmin").value,
      image: sennelierImage,
      catalogImage: sennelierCatalogImage || "",
      catalogTitle: $("sennelierCatalogTitleAdmin").value,
      catalogSubtitle: $("sennelierCatalogSubtitleAdmin").value
    },
    schmincke: {
      kicker: $("schminckeKickerAdmin").value,
      title: $("schminckeTitleAdmin").value,
      description: $("schminckeDescriptionAdmin").value,
      chip1: $("schminckeChip1Admin").value,
      chip2: $("schminckeChip2Admin").value,
      chip3: $("schminckeChip3Admin").value,
      button: $("schminckeButtonAdmin").value,
      image: schminckeImage,
      catalogImage: schminckeCatalogImage || "",
      catalogTitle: $("schminckeCatalogTitleAdmin").value,
      catalogSubtitle: $("schminckeCatalogSubtitleAdmin").value
    }
  };
}

async function saveHomeSettings() {
  notice("mainNotice", "");
  const buttons = [$("saveHomeSettings"), $("saveHomeSettingsBottom")];
  buttons.forEach(b => { b.disabled = true; });

  const persistedSen = normalizedHome(currentSettings.home).sennelier.image;
  const persistedSch = normalizedHome(currentSettings.home).schmincke.image;
  let senImage = $("currentSennelierHero").value || persistedSen || DEFAULT_HOME.sennelier.image;
  let schImage = $("currentSchminckeHero").value || persistedSch || DEFAULT_HOME.schmincke.image;
  const persistedSenCatalog = normalizedHome(currentSettings.home).sennelier.catalogImage || "";
  const persistedSchCatalog = normalizedHome(currentSettings.home).schmincke.catalogImage || "";
  let senCatalogImage = $("currentSennelierCatalogHero").value || "";
  let schCatalogImage = $("currentSchminckeCatalogHero").value || "";
  let newSenUploaded = false;
  let newSchUploaded = false;
  let newSenCatalogUploaded = false;
  let newSchCatalogUploaded = false;

  try {
    const senFile = $("sennelierHeroFile").files[0];
    const schFile = $("schminckeHeroFile").files[0];
    if (senFile) {
      senImage = await uploadImage(senFile, true);
      newSenUploaded = true;
    }
    if (schFile) {
      schImage = await uploadImage(schFile, true);
      newSchUploaded = true;
    }
    const senCatalogFile = $("sennelierCatalogHeroFile").files[0];
    const schCatalogFile = $("schminckeCatalogHeroFile").files[0];
    if (senCatalogFile) { senCatalogImage = await uploadImage(senCatalogFile, true); newSenCatalogUploaded = true; }
    if (schCatalogFile) { schCatalogImage = await uploadImage(schCatalogFile, true); newSchCatalogUploaded = true; }

    for (let n = 1; n <= 4; n++) {
      const file = $(`video${n}ThumbFile`)?.files?.[0];
      if (file) {
        const oldThumb = $(`video${n}CurrentThumb`).value;
        const newThumb = await uploadImage(file, true);
        $(`video${n}CurrentThumb`).value = newThumb;
        if (oldThumb && oldThumb !== newThumb) deleteUploadedImage(oldThumb).catch(() => {});
      }
    }
    const d = await api("/api/settings", { method: "PUT", json: { home: homePayload(senImage, schImage, senCatalogImage, schCatalogImage) } });
    currentSettings = { ...currentSettings, ...d, home: normalizedHome(d.home) };

    if (persistedSen && persistedSen !== senImage) deleteUploadedImage(persistedSen).catch(() => {});
    if (persistedSch && persistedSch !== schImage) deleteUploadedImage(persistedSch).catch(() => {});
    if (persistedSenCatalog && persistedSenCatalog !== senCatalogImage) deleteUploadedImage(persistedSenCatalog).catch(() => {});
    if (persistedSchCatalog && persistedSchCatalog !== schCatalogImage) deleteUploadedImage(persistedSchCatalog).catch(() => {});

    $("sennelierHeroFile").value = "";
    $("schminckeHeroFile").value = "";
    $("sennelierCatalogHeroFile").value = "";
    $("schminckeCatalogHeroFile").value = "";
    for (const old of [...new Set(removedVideoThumbs)]) { if (old) deleteUploadedImage(old).catch(() => {}); }
    removedVideoThumbs = [];
    fillHomeForm(currentSettings.home);
    notice("mainNotice", "Página inicial atualizada com sucesso. Vídeos e miniaturas salvos.", "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    if (newSenUploaded && senImage !== persistedSen) deleteUploadedImage(senImage).catch(() => {});
    if (newSchUploaded && schImage !== persistedSch) deleteUploadedImage(schImage).catch(() => {});
    if (newSenCatalogUploaded && senCatalogImage !== persistedSenCatalog) deleteUploadedImage(senCatalogImage).catch(() => {});
    if (newSchCatalogUploaded && schCatalogImage !== persistedSchCatalog) deleteUploadedImage(schCatalogImage).catch(() => {});
    notice("mainNotice", e.message, "error");
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}

function setHeroDefault(brand) {
  const isSen = brand === "Sennelier";
  const input = $(isSen ? "sennelierHeroFile" : "schminckeHeroFile");
  const current = $(isSen ? "currentSennelierHero" : "currentSchminckeHero");
  const preview = $(isSen ? "sennelierHeroPreview" : "schminckeHeroPreview");
  const url = isSen ? DEFAULT_HOME.sennelier.image : DEFAULT_HOME.schmincke.image;
  input.value = "";
  current.value = url;
  preview.src = url;
  notice("mainNotice", `Imagem padrão de ${brand} selecionada. Clique em “Salvar página inicial” para confirmar.`, "");
}

function previewFile(inputId, previewId) {
  const input = $(inputId);
  const file = input.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) {
    alert("A imagem deve ter no máximo 15 MB. O painel fará a otimização antes do envio.");
    input.value = "";
    return;
  }
  $(previewId).src = URL.createObjectURL(file);
  $(previewId).classList.remove("hidden");
}


function refreshBulkFilters() {
  const brand = $("bulkBrand")?.value || "Sennelier";
  const cats = [...new Set(products.filter(p => p.brand === brand).map(p => p.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const catSel = $("bulkCategory"); if (!catSel) return;
  const currentCat = catSel.value;
  catSel.innerHTML = cats.map(c => `<option value="${String(c).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${c}</option>`).join("");
  if (cats.includes(currentCat)) catSel.value = currentCat;
  refreshBulkVariation();
}
function refreshBulkVariation() {
  const brand=$("bulkBrand")?.value || "Sennelier", cat=$("bulkCategory")?.value || "";
  const vals=[...new Set(products.filter(p=>p.brand===brand && (!cat || p.cat===cat)).map(p=>variationValue(p.variation)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  const sel=$("bulkVariation"); if(!sel) return refreshBulkSeries(); const cur=sel.value;
  sel.innerHTML='<option value="">Todas / sem filtro</option>'+vals.map(v=>`<option value="${v.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${v}</option>`).join('');
  if(vals.includes(cur)) sel.value=cur;
  refreshBulkSeries();
}
function refreshBulkSeries() {
  const brand=$("bulkBrand")?.value || "Sennelier", cat=$("bulkCategory")?.value || "", variation=$("bulkVariation")?.value || "";
  const vals=[...new Set(products.filter(p=>p.brand===brand && (!cat || p.cat===cat) && (!variation || variationValue(p.variation)===variation)).map(p=>String(p.series||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  const sel=$("bulkSeries"); if(!sel) return; const cur=sel.value;
  sel.innerHTML='<option value="">Todas / sem filtro</option>'+vals.map(v=>`<option value="${v.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${seriesLabel(v)}</option>`).join('');
  if(vals.includes(cur)) sel.value=cur;
}
function bulkMatches() {
  const brand=$("bulkBrand").value, cat=$("bulkCategory").value, variation=$("bulkVariation")?.value || "", series=$("bulkSeries").value;
  const priceState=$("bulkPriceState")?.value || "all";
  return products.filter(p=>{
    const base=p.brand===brand && p.cat===cat && (!variation || variationValue(p.variation)===variation) && (!series || String(p.series||"").trim()===series);
    if(!base) return false;
    const hasPrice=numericPrice(p.price)!==null;
    if(priceState==="noprice") return !hasPrice;
    if(priceState==="withprice") return hasPrice;
    return true;
  });
}
function previewBulkPrice() {
  const price=numericPrice($("bulkPrice").value); if(price===null) return notice("mainNotice","Informe um valor válido para aplicar em massa.","error");
  const list=bulkMatches(); if(!list.length) return notice("mainNotice","Nenhum produto encontrado com esses filtros.","error");
  const box=$("bulkPreviewBox"), rows=$("bulkPreviewRows"); rows.textContent="";
  list.slice(0,300).forEach(p=>{ const tr=document.createElement("tr"); [p.code,p.name,p.series?seriesLabel(p.series):"—",numericPrice(p.price)===null?"—":formatMoney(p.price),formatMoney(price)].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td)}); rows.appendChild(tr); });
  $("bulkPreviewTitle").textContent=`${list.length} produto(s) serão alterados`;
  const priceStateLabel = $("bulkPriceState")?.value === "noprice" ? " · somente sem preço" : $("bulkPriceState")?.value === "withprice" ? " · somente com preço" : "";
  const variationLabel = $("bulkVariation")?.value ? ` · ${$("bulkVariation").value}` : " · todas as variações";
  $("bulkPreviewInfo").textContent=`${$("bulkBrand").value} · ${$("bulkCategory").value}${variationLabel}${$("bulkSeries").value ? ` · ${seriesLabel($("bulkSeries").value)}` : " · todas as séries"}${priceStateLabel}. Novo valor: ${formatMoney(price)}.`;
  box.classList.remove("hidden");
}
async function saveBulkPrice() {
  const price=numericPrice($("bulkPrice").value), list=bulkMatches(); if(price===null || !list.length) return;
  if(!confirm(`Aplicar ${formatMoney(price)} em ${list.length} produto(s)?`)) return;
  const btn=$("bulkSaveBtn"); btn.disabled=true;
  try { await api("/api/products/bulk-price",{method:"PUT",json:{brand:$("bulkBrand").value,cat:$("bulkCategory").value,variation:$("bulkVariation")?.value || "",series:$("bulkSeries").value,priceState:$("bulkPriceState")?.value || "all",price}}); await loadProducts(); refreshBulkFilters(); $("bulkPreviewBox").classList.add("hidden"); notice("mainNotice",`Preço atualizado em ${list.length} produto(s).`,"success"); }
  catch(e){ notice("mainNotice",e.message,"error"); } finally { btn.disabled=false; }
}

function refreshOrganizeFilters() {
  const brand = $("organizeBrand")?.value || "Sennelier";
  const cats = [...new Set(products.filter(p => p.brand === brand).map(p => p.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  const sel = $("organizeCategory"); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = cats.map(c => `<option value="${String(c).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${c}</option>`).join("");
  if (cats.includes(cur)) sel.value = cur;
  refreshOrganizeSubfilters();
}
function refreshOrganizeSubfilters() {
  const brand=$("organizeBrand")?.value || "Sennelier", cat=$("organizeCategory")?.value || "";
  const subset=products.filter(p=>p.brand===brand && p.cat===cat);
  const variations=[...new Set(subset.map(p=>variationValue(p.variation)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  const vsel=$("organizeCurrentVariation"); if(vsel){ const cur=vsel.value; vsel.innerHTML='<option value="">Todas / sem filtro</option>'+variations.map(v=>`<option value="${v.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${v}</option>`).join(''); if(variations.includes(cur)) vsel.value=cur; }
  const series=[...new Set(subset.map(p=>String(p.series||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
  const ssel=$("organizeSeries"); if(ssel){ const cur=ssel.value; ssel.innerHTML='<option value="">Todas / sem filtro</option>'+series.map(v=>`<option value="${v.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${seriesLabel(v)}</option>`).join(''); if(series.includes(cur)) ssel.value=cur; }
  if ($("organizeNewCategory") && !$("organizeNewCategory").value) $("organizeNewCategory").value = cat;
}
function organizeMatches() {
  const brand=$("organizeBrand").value, cat=$("organizeCategory").value, variation=$("organizeCurrentVariation")?.value || "", series=$("organizeSeries")?.value || "";
  return products.filter(p=>p.brand===brand && p.cat===cat && (!variation || variationValue(p.variation)===variation) && (!series || String(p.series||"").trim()===series));
}
function previewOrganize() {
  const newCat=String($("organizeNewCategory")?.value || "").trim(), newVariation=String($("organizeNewVariation")?.value || "").trim();
  if(!newCat) return notice("mainNotice","Informe a nova categoria.","error");
  const list=organizeMatches(); if(!list.length) return notice("mainNotice","Nenhum produto encontrado com esses filtros.","error");
  const rows=$("organizePreviewRows"); rows.textContent="";
  list.slice(0,300).forEach(p=>{ const tr=document.createElement("tr"); [p.code,p.name,p.cat,newCat,newVariation||"—"].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td)}); rows.appendChild(tr); });
  $("organizePreviewTitle").textContent=`${list.length} produto(s) serão reorganizados`;
  $("organizePreviewInfo").textContent=`${$("organizeBrand").value} · ${$("organizeCategory").value} → ${newCat}${newVariation ? ` · ${newVariation}` : " · sem variação"}. Preço, estoque, fotos e desconto permanecem iguais.`;
  $("organizePreviewBox").classList.remove("hidden");
}
async function saveOrganize() {
  const list=organizeMatches(), newCat=String($("organizeNewCategory")?.value || "").trim(), newVariation=String($("organizeNewVariation")?.value || "").trim();
  if(!newCat || !list.length) return;
  if(!confirm(`Reorganizar ${list.length} produto(s) para “${newCat}”${newVariation ? ` / ${newVariation}` : ""}?`)) return;
  const btn=$("organizeSaveBtn"); btn.disabled=true;
  try {
    await api("/api/products/bulk-organize",{method:"PUT",json:{brand:$("organizeBrand").value,cat:$("organizeCategory").value,currentVariation:$("organizeCurrentVariation")?.value || "",series:$("organizeSeries")?.value || "",newCat,newVariation}});
    await loadProducts();
    $("organizePreviewBox").classList.add("hidden");
    $("organizeNewVariation").value="";
    notice("mainNotice",`${list.length} produto(s) reorganizados com sucesso.`,"success");
  } catch(e){ notice("mainNotice",e.message,"error"); } finally { btn.disabled=false; }
}
function clearCatalogHero(brand) {
  const isSen=brand==="Sennelier"; const cur=$(isSen?"currentSennelierCatalogHero":"currentSchminckeCatalogHero"); const input=$(isSen?"sennelierCatalogHeroFile":"schminckeCatalogHeroFile"); const preview=$(isSen?"sennelierCatalogHeroPreview":"schminckeCatalogHeroPreview");
  cur.value=""; input.value=""; preview.src=""; preview.classList.add("hidden"); notice("mainNotice",`Imagem do catálogo ${brand} removida da prévia. Clique em Salvar página inicial para confirmar.`,"");
}

document.querySelectorAll(".admin-section-tab").forEach(button => {
  button.addEventListener("click", () => setAdminSection(button.dataset.adminSection));
});
document.querySelectorAll(".product-brand-tab").forEach(button => {
  button.addEventListener("click", () => setProductBrandFilter(button.dataset.productBrand));
});

$("setupBtn").addEventListener("click", setup);
$("loginBtn").addEventListener("click", login);
$("setupPassword").addEventListener("keydown", e => { if (e.key === "Enter") setup(); });
$("loginPassword").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
$("stockControl").addEventListener("change", () => {
  $("stockQuantityField").classList.toggle("hidden", !$("stockControl").checked);
  if ($("stockControl").checked && $("stockQuantity").value === "") $("stockQuantity").value = "0";
});
$("productForm").addEventListener("submit", saveProduct);
$("saveDuplicateNext")?.addEventListener("click", saveAndDuplicateNext);
$("endDuplicateSession")?.addEventListener("click", endDuplicateSession);
$("cancelEdit").addEventListener("click", resetForm);
$("adminSearch").addEventListener("input", () => { renderRows(); });
document.querySelectorAll(".availability-tab").forEach(button => {
  button.addEventListener("click", () => {
    activeAvailability = button.dataset.availability || "all";
    document.querySelectorAll(".availability-tab").forEach(b => b.classList.toggle("active", b === button));
    renderRows();
  });
});
$("saveSettings").addEventListener("click", saveSettings);
$("saveHomeSettings").addEventListener("click", saveHomeSettings);
$("saveHomeSettingsBottom").addEventListener("click", saveHomeSettings);
$("resetSennelierHero").addEventListener("click", () => setHeroDefault("Sennelier"));
$("resetSchminckeHero").addEventListener("click", () => setHeroDefault("Schmincke"));
$("logoutBtn").addEventListener("click", () => {
  token = "";
  localStorage.removeItem("fruto_import_admin_token");
  showAuth();
});
$("imageFiles").addEventListener("change", () => {
  const selected = Array.from($("imageFiles").files || []);
  if (!selected.length) return;

  const room = MAX_PRODUCT_IMAGES - editingImages.length - pendingImageFiles.length;
  if (room <= 0) {
    alert(`Use no máximo ${MAX_PRODUCT_IMAGES} fotos por produto.`);
    $("imageFiles").value = "";
    return;
  }

  const accepted = selected.slice(0, room);
  pendingImageFiles.push(...accepted);
  if (accepted.length < selected.length) {
    alert(`Foram adicionadas ${accepted.length} foto(s). O limite é de ${MAX_PRODUCT_IMAGES} fotos por produto.`);
  }

  // Limpa apenas o seletor do navegador. As novas fotos ficam guardadas em
  // pendingImageFiles, permitindo escolher outra foto depois sem substituir as anteriores.
  $("imageFiles").value = "";
  renderProductImageEditor();
});
$("clearNewImages").addEventListener("click", () => {
  pendingImageFiles = [];
  pendingPrimaryFile = null;
  $("imageFiles").value = "";
  renderProductImageEditor();
});
$("sennelierHeroFile").addEventListener("change", () => previewFile("sennelierHeroFile", "sennelierHeroPreview"));
$("schminckeHeroFile").addEventListener("change", () => previewFile("schminckeHeroFile", "schminckeHeroPreview"));


$("showResetBtn")?.addEventListener("click", () => $("resetFields").classList.toggle("hidden"));
$("resetPasswordBtn")?.addEventListener("click", resetPassword);
$("changePasswordBtn")?.addEventListener("click", changePassword);

$("adminQualityFilter")?.addEventListener("change", () => { activeQualityFilter = $("adminQualityFilter").value || "all"; renderRows(); });
$("clearAdminFilters")?.addEventListener("click", () => { activeAdminBrand="all"; activeAvailability="all"; activeQualityFilter="all"; $("adminSearch").value=""; $("adminQualityFilter").value="all"; document.querySelectorAll(".product-brand-tab").forEach(b=>b.classList.toggle("active",b.dataset.productBrand==="all")); document.querySelectorAll(".availability-tab").forEach(b=>b.classList.toggle("active",b.dataset.availability==="all")); renderRows(); });
document.querySelectorAll("[data-overview-filter]").forEach(b => b.addEventListener("click", () => openProductsWithFilter(b.dataset.overviewFilter)));
$("overviewNewProduct")?.addEventListener("click", () => { setAdminSection("productsSection"); resetForm(); document.querySelector(".product-editor-panel")?.scrollIntoView({behavior:"smooth",block:"start"}); });
$("overviewBulkPrice")?.addEventListener("click", () => { setAdminSection("productsSection"); document.querySelector(".bulk-price-panel")?.scrollIntoView({behavior:"smooth",block:"start"}); });
$("overviewExportBackup")?.addEventListener("click", exportAdminBackup);

checkStatus();

$("saveSettingsBottom")?.addEventListener("click", saveSettings);
$("sennelierCatalogHeroFile")?.addEventListener("change", () => previewFile("sennelierCatalogHeroFile", "sennelierCatalogHeroPreview"));
$("schminckeCatalogHeroFile")?.addEventListener("change", () => previewFile("schminckeCatalogHeroFile", "schminckeCatalogHeroPreview"));
$("clearSennelierCatalogHero")?.addEventListener("click", () => clearCatalogHero("Sennelier"));
$("clearSchminckeCatalogHero")?.addEventListener("click", () => clearCatalogHero("Schmincke"));
$("bulkBrand")?.addEventListener("change", () => { refreshBulkFilters(); $("bulkPreviewBox")?.classList.add("hidden"); });
$("bulkCategory")?.addEventListener("change", () => { refreshBulkVariation(); $("bulkPreviewBox")?.classList.add("hidden"); });
$("bulkVariation")?.addEventListener("change", () => { refreshBulkSeries(); $("bulkPreviewBox")?.classList.add("hidden"); });
$("bulkSeries")?.addEventListener("change", () => $("bulkPreviewBox")?.classList.add("hidden"));
$("organizeBrand")?.addEventListener("change", () => { if($("organizeNewCategory")) $("organizeNewCategory").value=""; refreshOrganizeFilters(); $("organizePreviewBox")?.classList.add("hidden"); });
$("organizeCategory")?.addEventListener("change", () => { if($("organizeNewCategory")) $("organizeNewCategory").value=$("organizeCategory").value; refreshOrganizeSubfilters(); $("organizePreviewBox")?.classList.add("hidden"); });
$("organizeCurrentVariation")?.addEventListener("change", () => $("organizePreviewBox")?.classList.add("hidden"));
$("organizeSeries")?.addEventListener("change", () => $("organizePreviewBox")?.classList.add("hidden"));
$("organizePreviewBtn")?.addEventListener("click", previewOrganize);
$("organizeSaveBtn")?.addEventListener("click", saveOrganize);
$("bulkPreviewBtn")?.addEventListener("click", previewBulkPrice);
$("bulkSaveBtn")?.addEventListener("click", saveBulkPrice);

$("bulkPriceState")?.addEventListener("change", () => $("bulkPreviewBox")?.classList.add("hidden"));
