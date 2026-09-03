const BRANDS = ["Sennelier", "Schmincke", "Raphaël"];
const PAGE_SIZE = 48;
const DEFAULT_HOME = {
  header: {
    showLogo: true,
    logoImage: "",
    brandLabelPosition: "left",
    showBrandName: false,
    brandName: "FRUTO IMPORTADORA",
    homeLabel: "Início",
    sennelierLabel: "Sennelier",
    schminckeLabel: "Schmincke",
    raphaelLabel: "Raphaël",
    quoteLabel: "Orçamento",
    searchPlaceholder: "Pesquisar por produto, código ou categoria..."
  },
  eyebrow: "CATÁLOGO DIGITAL · FRUTO IMPORTADORA",
  title: "Três referências mundiais em materiais artísticos.",
  intro: "Explore os produtos Sennelier, Schmincke e Raphaël, monte sua seleção e solicite seu orçamento de forma rápida.",
  benefits: [
    { title: "Busca rápida", text: "Encontre por nome, código ou categoria." },
    { title: "Quantidade já na seleção", text: "Informe a quantidade desejada antes de adicionar ao orçamento." },
    { title: "PDF + WhatsApp", text: "Gere o PDF e abra automaticamente a conversa com a Fruto Importadora." }
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
    catalogImage: "/assets/banner-sennelier-v17-4.jpg",
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
    catalogImage: "/assets/banner-schmincke-v17-6.jpg",
    catalogTitle: "Catálogo Schmincke",
    catalogSubtitle: "Materiais artísticos de excelência alemã — selecione os produtos e monte sua solicitação de orçamento."
  },
  raphael: {
    kicker: "Raphaël 🇫🇷", title: "RAPHAËL",
    description: "Pincéis franceses para artistas, com linhas profissionais para diferentes técnicas e estilos.",
    chip1: "Pincéis profissionais", chip2: "Belas-Artes", chip3: "França",
    button: "Ver Catálogo Raphaël →", image: "/assets/hero-raphael.png", catalogImage: "/assets/banner-raphael-v17-6.jpg",
    catalogTitle: "Catálogo Raphaël", catalogSubtitle: "Pincéis Raphaël para artistas — selecione os produtos e monte sua solicitação de orçamento."
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
  title: "Minha solicitação",
  intro: "As quantidades já foram definidas na escolha dos produtos. Confira a solicitação antes de gerar o PDF.",
  pdfHeaderTitle: "FRUTO IMPORTADORA", pdfHeaderSubtitle: "Solicitação de Orçamento", pdfContactLabel: "WhatsApp Fruto Importadora", pdfFooterText: "Fruto Importadora",
  showCustomer: true, showAddress: false, showNote: true, showSummary: true, showGrandTotal: true, showDownloadPdf: true, showShareNote: true,
  columns: { product: true, code: true, series: false, salePack: false, quantity: true, unitPrice: true, subtotal: false }
};

let products = [];
let settings = { businessName: "Fruto Importadora", whatsapp: "5511996576368", home: DEFAULT_HOME, quote: DEFAULT_QUOTE };
let currentBrand = "";
let currentCat = "Todos";
let currentVariation = "Todas";
let currentSeries = "Todas";
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxName = "";
let visibleLimit = PAGE_SIZE;
let selected = {};
let toastTimer;
let detailProductCode = "";
let catalogVersion = "";
let catalogRefreshTimer = null;
let quoteFinalizeId = "";

try {
  selected = JSON.parse(localStorage.getItem("fruto_import_list") || "{}");
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) selected = {};
  for (const code of Object.keys(selected)) selected[code] = clampQty(selected[code]);
} catch { selected = {}; }

const $ = id => document.getElementById(id);

function clampQty(value) {
  return Math.max(1, Math.min(9999, Number.parseInt(value, 10) || 1));
}

function salePack(product) {
  const pack = Number(product?.salePack);
  return pack === 5 ? 5 : pack === 4 ? 4 : pack === 3 ? 3 : 1;
}

function stockControlEnabled(product) {
  return product?.stockControl === true;
}

function stockQuantity(product) {
  const n = Number.parseInt(product?.stockQuantity, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 999999) : 0;
}

function maxAllowedQty(product) {
  if (!stockControlEnabled(product)) return 9999;
  const stock = Math.min(9999, stockQuantity(product));
  const pack = salePack(product);
  return pack === 1 ? stock : Math.floor(stock / pack) * pack;
}

function normalizeQtyForProduct(value, product) {
  const pack = salePack(product);
  const raw = clampQty(value);
  let normalized = pack === 1 ? raw : Math.max(pack, Math.min(9999, Math.ceil(raw / pack) * pack));
  if (stockControlEnabled(product)) {
    const max = maxAllowedQty(product);
    if (max <= 0) return 0;
    normalized = Math.min(normalized, max);
  }
  return normalized;
}

function salePackLabel(product) {
  const pack = salePack(product);
  return pack === 1 ? "Unitário" : `Fechado com ${pack}`;
}

function isAvailable(product) {
  return product?.available !== false && (!stockControlEnabled(product) || maxAllowedQty(product) >= salePack(product));
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

function hasActiveDiscount(product) {
  return numericPrice(product.price) !== null && Boolean(product.discountActive) && discountValue(product.discountPercent) > 0;
}

function finalPrice(product) {
  const price = numericPrice(product.price);
  if (price === null) return null;
  const discount = discountValue(product.discountPercent);
  return hasActiveDiscount(product) ? Math.round(price * (1 - discount / 100) * 100) / 100 : price;
}

function formatMoney(value) {
  const n = Number(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0);
}

function productImages(product) {
  const source = Array.isArray(product?.images) ? product.images : [product?.image];
  return [...new Set(source.map(v => String(v || "").trim()).filter(Boolean))].slice(0, 10);
}

// V16.4: tenta primeiro a URL original e, se ela falhar naquele navegador/rede,
// usa uma rota segura do próprio site para carregar a mesma imagem.
const RELIABLE_IMAGE_HOSTS = new Set([
  "scwrzdwxnkjqkiawvdve.supabase.co",
  "cdn.shopify.com",
  "img2.activant-inet.com",
  "cdn.abicart.com"
]);

function imageCandidates(urls) {
  const out = [];
  const source = Array.isArray(urls) ? urls : [urls];
  for (const value of source) {
    const raw = String(value || "").trim();
    if (!raw || out.includes(raw)) continue;
    out.push(raw);
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.protocol === "https:" && RELIABLE_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) {
        const proxy = `/api/image-proxy?url=${encodeURIComponent(parsed.href)}`;
        if (!out.includes(proxy)) out.push(proxy);
      }
    } catch {}
  }
  return out;
}

function attachReliableImage(img, urls, { alt = "", lazy = true, onEmpty = null } = {}) {
  const candidates = imageCandidates(urls);
  img.alt = alt;
  if (lazy) img.loading = "lazy";
  else img.removeAttribute("loading");
  img.decoding = "async";
  let index = 0;

  const load = () => {
    if (index >= candidates.length) {
      img.removeAttribute("src");
      img.classList.add("image-load-failed");
      if (typeof onEmpty === "function") onEmpty(img);
      return;
    }
    img.classList.remove("image-load-failed");
    // Importante: não acrescentar ?v, ?retry ou qualquer outro parâmetro.
    img.src = candidates[index];
  };

  img.onload = () => img.classList.remove("image-load-failed");
  img.onerror = () => {
    index += 1;
    load();
  };

  load();
  return img;
}

function seriesValue(value) {
  return String(value || "").trim().replace(/^s[eé]rie\s*/i, "");
}

function seriesLabel(value) {
  const v = seriesValue(value);
  return v ? `Série ${v}` : "";
}

function compareSeries(a, b) {
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

const NO_VARIATION = "__sem_variacao__";
function variationValue(value) {
  return String(value || "").trim();
}
function variationKey(product) {
  return variationValue(product?.variation) || NO_VARIATION;
}
function variationLabel(value) {
  return value === NO_VARIATION ? "Sem variação" : String(value || "").trim();
}
function compareVariation(a, b) {
  if (a === NO_VARIATION) return 1;
  if (b === NO_VARIATION) return -1;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

function priceBlock(product) {
  const wrap = document.createElement("div");
  wrap.className = "product-price";
  const price = numericPrice(product.price);

  if (price === null) {
    const consult = document.createElement("span");
    consult.className = "price-consult";
    consult.textContent = "Preço sob consulta";
    wrap.appendChild(consult);
    return wrap;
  }

  if (hasActiveDiscount(product)) {
    const top = document.createElement("div");
    top.className = "price-promo-line";
    const old = document.createElement("span");
    old.className = "price-old";
    old.textContent = formatMoney(price);
    const badge = document.createElement("span");
    badge.className = "discount-badge";
    badge.textContent = `-${String(discountValue(product.discountPercent)).replace(".", ",")}%`;
    top.append(old, badge);
    const current = document.createElement("strong");
    current.className = "price-current promo";
    current.textContent = formatMoney(finalPrice(product));
    wrap.append(top, current);
  } else {
    const current = document.createElement("strong");
    current.className = "price-current";
    current.textContent = formatMoney(price);
    wrap.appendChild(current);
  }
  return wrap;
}

function homeSettings() {
  const home = settings.home && typeof settings.home === "object" ? settings.home : {};
  const videos = home.videos && typeof home.videos === "object" ? home.videos : {};
  return {
    ...DEFAULT_HOME,
    ...home,
    header: { ...DEFAULT_HOME.header, ...(home.header || {}) },
    benefits: DEFAULT_HOME.benefits.map((fallback, i) => ({ ...fallback, ...(Array.isArray(home.benefits) ? home.benefits[i] : {}) })),
    sennelier: { ...DEFAULT_HOME.sennelier, ...(home.sennelier || {}) },
    schmincke: { ...DEFAULT_HOME.schmincke, ...(home.schmincke || {}) },
    raphael: { ...DEFAULT_HOME.raphael, ...(home.raphael || {}) },
    videos: { ...DEFAULT_HOME.videos, ...videos, items: DEFAULT_HOME.videos.items.map((fallback, i) => ({ ...fallback, ...(Array.isArray(videos.items) ? videos.items[i] : {}) })) }
  };
}
function quoteSettings() {
  const q = settings.quote && typeof settings.quote === "object" ? settings.quote : {};
  return { ...DEFAULT_QUOTE, ...q, columns: { ...DEFAULT_QUOTE.columns, ...(q.columns || {}) } };
}

function applySettings() {
  const h = homeSettings();
  const header = h.header || DEFAULT_HOME.header;
  const brandName = $("headerBrandName");
  const logoButton = $("homeLogo");
  const logoMark = $("headerLogoMark");
  const logoImage = $("headerLogoImage");
  const showLogo = header.showLogo !== false;
  const customLogo = String(header.logoImage || "").trim();
  brandName.textContent = header.brandName || DEFAULT_HOME.header.brandName;
  brandName.classList.toggle("hidden", !header.showBrandName);
  logoButton.classList.toggle("hidden", !showLogo && !header.showBrandName);
  logoMark.classList.toggle("hidden", !showLogo || Boolean(customLogo));
  logoImage.classList.add("hidden");
  if (showLogo && customLogo) {
    logoImage.classList.remove("hidden");
    if (logoImage.dataset.sourceUrl !== customLogo) {
      logoImage.dataset.sourceUrl = customLogo;
      attachReliableImage(logoImage, [customLogo], {
        alt: "Logo Fruto Importadora",
        lazy: false,
        onEmpty: () => {
          delete logoImage.dataset.sourceUrl;
          logoImage.classList.add("hidden");
          logoMark.classList.remove("hidden");
        }
      });
    }
  } else {
    delete logoImage.dataset.sourceUrl;
    logoImage.removeAttribute("src");
  }
  const labelPosition = ["left", "center", "right", "hidden"].includes(header.brandLabelPosition) ? header.brandLabelPosition : "left";
  document.body.dataset.brandLabelPosition = labelPosition;
  $("navHomeLabel").textContent = header.homeLabel || DEFAULT_HOME.header.homeLabel;
  $("navSennelierLabel").textContent = header.sennelierLabel || DEFAULT_HOME.header.sennelierLabel;
  $("navSchminckeLabel").textContent = header.schminckeLabel || DEFAULT_HOME.header.schminckeLabel;
  $("navRaphaelLabel").textContent = header.raphaelLabel || DEFAULT_HOME.header.raphaelLabel;
  $("quoteButtonLabel").textContent = header.quoteLabel || DEFAULT_HOME.header.quoteLabel;
  $("search").placeholder = header.searchPlaceholder || DEFAULT_HOME.header.searchPlaceholder;
  $("landingEyebrow").textContent = h.eyebrow;
  $("landingTitle").textContent = h.title;
  $("landingIntro").textContent = h.intro;

  const map = [
    ["sennelier", "sennelier"],
    ["schmincke", "schmincke"],
    ["raphael", "raphael"]
  ];
  for (const [prefix, key] of map) {
    const b = h[key];
    $(`${prefix}Kicker`).textContent = b.kicker;
    $(`${prefix}Title`).textContent = b.title;
    $(`${prefix}Description`).textContent = b.description;
    const chipValues = [b.chip1, b.chip2, b.chip3].map(value => String(value || "").trim());
    chipValues.forEach((value, i) => {
      const chip = $(`${prefix}Chip${i + 1}`);
      chip.textContent = value;
      chip.classList.toggle("hidden", !value);
    });
    const chipBox = $(`${prefix}Chip1`).closest(".chips");
    if (chipBox) chipBox.classList.toggle("hidden", !chipValues.some(Boolean));
    $(`${prefix}ButtonText`).textContent = b.button;
    const img = $(`${prefix}HeroImage`);
    const desiredImage = String(b.image || "").trim();
    if (img.getAttribute("src") !== desiredImage) img.src = desiredImage;
  }

  h.benefits.forEach((item, i) => {
    $(`benefit${i + 1}Title`).textContent = item.title;
    $(`benefit${i + 1}Text`).textContent = item.text;
  });
  renderHomeVideos(h.videos);
  applyQuoteSettings();
}

function save() {
  try { localStorage.setItem("fruto_import_list", JSON.stringify(selected)); } catch {}
  updateCount();
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function updateCount() {
  $("count").textContent = Object.keys(selected).length;
}

function countByBrand(brand) {
  return products.filter(p => p.brand === brand).length;
}

function safeUrl(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  try { const u = new URL(v, location.origin); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; }
}
function youtubeThumbnail(url) {
  try {
    const u = new URL(String(url || "").trim(), location.origin);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.split("/").filter(Boolean)[0] || "";
    else if (u.hostname.includes("youtube.com")) id = u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : "");
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
  } catch { return ""; }
}
function renderHomeVideos(raw) {
  const section = $("homeVideosSection");
  if (!section) return;
  const v = raw && typeof raw === "object" ? raw : DEFAULT_HOME.videos;
  const items = (Array.isArray(v.items) ? v.items : []).filter(x => x && x.enabled && x.title && x.url).slice(0,4);
  const visible = Boolean(v.enabled) && items.length > 0;
  section.classList.toggle("hidden", !visible);
  if (!visible) return;
  $("homeVideosTitle").textContent = v.title || "Novidades em Vídeo";
  $("homeVideosSubtitle").textContent = v.subtitle || "";
  const box = $("homeVideosGrid"); box.textContent = "";
  items.forEach(item => {
    const card = document.createElement("button");
    card.type = "button"; card.className = "home-video-card";
    const media = document.createElement("div"); media.className = "home-video-thumb";
    const ytThumb = youtubeThumbnail(item.url);
    const thumb = item.thumbnail || ytThumb;
    if (thumb) { const img=document.createElement("img"); img.src=thumb; img.alt=item.title; img.loading="lazy"; img.onerror=()=>{ if (ytThumb && img.src !== ytThumb) img.src=ytThumb; }; media.appendChild(img); }
    else { const ph=document.createElement("div"); ph.className="video-placeholder"; ph.textContent="FRUTO IMPORTADORA"; media.appendChild(ph); }
    const play=document.createElement("span"); play.className="video-play"; play.textContent="▶"; media.appendChild(play);
    if (item.duration) { const d=document.createElement("span"); d.className="video-duration"; d.textContent=item.duration; media.appendChild(d); }
    const info=document.createElement("div"); info.className="home-video-info";
    if (item.tag) { const tag=document.createElement("span"); tag.className="video-tag"; tag.textContent=item.tag; info.appendChild(tag); }
    const title=document.createElement("b"); title.textContent=item.title; info.appendChild(title);
    if (item.subtitle) { const sub=document.createElement("span"); sub.textContent=item.subtitle; info.appendChild(sub); }
    card.append(media, info);
    card.addEventListener("click", () => openVideo(item.url, item.title));
    box.appendChild(card);
  });
  const all = $("homeVideosAll");
  const allUrl = safeUrl(v.allButtonUrl);
  all.textContent = v.allButtonText || "Ver todos os vídeos";
  all.classList.toggle("hidden", !(v.showAllButton && allUrl));
  all.onclick = () => { if (allUrl) window.open(allUrl, "_blank", "noopener"); };
}
function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {}
  return "";
}
function openVideo(url, title) {
  const clean = safeUrl(url); if (!clean) return;
  const modal = $("videoModal"); const frame=$("videoFrame"); const direct=$("videoDirect");
  $("videoModalTitle").textContent = title || "Vídeo";
  const yt = youtubeEmbed(clean);
  frame.src=""; direct.src=""; frame.classList.add("hidden"); direct.classList.add("hidden");
  if (yt) { frame.src = yt; frame.classList.remove("hidden"); }
  else if (/\.(mp4|webm|ogg)(\?|$)/i.test(clean)) { direct.src=clean; direct.classList.remove("hidden"); }
  else { window.open(clean, "_blank", "noopener"); return; }
  modal.classList.remove("hidden"); document.body.style.overflow="hidden";
}
function closeVideo() {
  const modal=$("videoModal"); if (!modal) return;
  modal.classList.add("hidden"); $("videoFrame").src=""; $("videoDirect").pause(); $("videoDirect").src="";
  if (!$("drawer").classList.contains("open") && $("imageLightbox").classList.contains("hidden")) document.body.style.overflow="";
}
function applyQuoteSettings() {
  const q = quoteSettings();
  $("quoteDrawerTitle").textContent = q.title;
  $("quoteDrawerIntro").textContent = q.intro;
  $("quoteDrawerIntro").classList.toggle("hidden", !q.intro);
  $("customerNameLabel").classList.toggle("hidden", !q.showCustomer);
  $("customerAddressFields").classList.toggle("hidden", !q.showAddress);
  $("customerNoteLabel").classList.toggle("hidden", !q.showNote);
  $("drawerSummary").classList.toggle("hidden", !q.showSummary);
  $("downloadPdf").classList.toggle("hidden", !q.showDownloadPdf);
  $("shareNote").classList.toggle("hidden", !q.showShareNote);
}

function updateLandingCounts() {
  const s = countByBrand("Sennelier");
  const c = countByBrand("Schmincke");
  const r = countByBrand("Raphaël");
  $("sennelierCount").textContent = s.toLocaleString("pt-BR");
  $("schminckeCount").textContent = c.toLocaleString("pt-BR");
  $("raphaelCount").textContent = r.toLocaleString("pt-BR");
  $("totalCount").textContent = (s + c + r).toLocaleString("pt-BR");
}

function setNavActive(value) {
  document.querySelectorAll(".nav-brand").forEach(btn => {
    const own = btn.dataset.brand || btn.dataset.view;
    btn.classList.toggle("active", own === value);
  });
}

function showHome() {
  currentBrand = "";
  currentCat = "Todos";
  currentVariation = "Todas";
  currentSeries = "Todas";
  visibleLimit = PAGE_SIZE;
  $("landing").classList.remove("hidden");
  $("catalogSection").classList.add("hidden");
  $("headerSearch").classList.add("hidden");
  $("cats").textContent = "";
  $("search").value = "";
  setNavActive("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyCatalogHero(brand, brandSettings = null) {
  const h = homeSettings();
  const brandKey = brand === "Sennelier" ? "sennelier" : brand === "Schmincke" ? "schmincke" : "raphael";
  const b = brandSettings || h[brandKey];
  const catalogHero = $("catalogHero");
  catalogHero.classList.toggle("schmincke", brand === "Schmincke");
  catalogHero.classList.toggle("raphael", brand === "Raphaël");
  const banner = String(b?.catalogImage || "").trim();
  catalogHero.classList.toggle("has-catalog-banner", Boolean(banner));
  if (banner) {
    const safeBanner = banner.replace(/["\\]/g, ch => `\\${ch}`);
    catalogHero.style.backgroundImage = `linear-gradient(rgba(8,31,75,.34), rgba(8,31,75,.44)), url("${safeBanner}")`;
    catalogHero.style.backgroundSize = "cover";
    catalogHero.style.backgroundPosition = "center center";
  } else {
    catalogHero.style.backgroundImage = "";
    catalogHero.style.backgroundSize = "";
    catalogHero.style.backgroundPosition = "";
  }
}

async function refreshSettingsNow() {
  try {
    const r = await fetch("/api/settings", { cache: "no-store" });
    if (!r.ok) return false;
    const next = await r.json();
    settings = { ...settings, ...next };
    applySettings();
    if (currentBrand) {
      const h = homeSettings();
      const brandKey = currentBrand === "Sennelier" ? "sennelier" : currentBrand === "Schmincke" ? "schmincke" : "raphael";
      applyCatalogHero(currentBrand, h[brandKey]);
      $("catalogCountry").textContent = h[brandKey].kicker;
      $("catalogTitle").textContent = h[brandKey].catalogTitle;
      $("catalogSubtitle").textContent = h[brandKey].catalogSubtitle;
    }
    return true;
  } catch {
    return false;
  }
}

function openBrand(brand) {
  if (!BRANDS.includes(brand)) return;
  currentBrand = brand;
  currentCat = "Todos";
  currentVariation = "Todas";
  currentSeries = "Todas";
  visibleLimit = PAGE_SIZE;
  $("landing").classList.add("hidden");
  $("catalogSection").classList.remove("hidden");
  $("headerSearch").classList.remove("hidden");
  $("search").value = "";

  const h = homeSettings();
  const brandKey = brand === "Sennelier" ? "sennelier" : brand === "Schmincke" ? "schmincke" : "raphael";
  const b = h[brandKey];
  applyCatalogHero(brand, b);
  $("catalogCountry").textContent = b.kicker;
  $("catalogTitle").textContent = b.catalogTitle;
  $("catalogSubtitle").textContent = b.catalogSubtitle;
  $("productsTitle").textContent = `Produtos ${brand}`;
  setNavActive(brand);
  categories();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function categories() {
  const cats = ["Todos", ...new Set(products.filter(p => p.brand === currentBrand).map(p => p.cat).filter(Boolean))]
    .sort((a, b) => a === "Todos" ? -1 : b === "Todos" ? 1 : a.localeCompare(b, "pt-BR"));
  const box = $("cats");
  box.textContent = "";
  cats.forEach(cat => {
    const b = document.createElement("button");
    b.textContent = cat;
    b.className = cat === currentCat ? "active" : "";
    b.addEventListener("click", () => {
      currentCat = cat;
      currentVariation = "Todas";
      currentSeries = "Todas";
      visibleLimit = PAGE_SIZE;
      categories();
      render();
    });
    box.appendChild(b);
  });
  variationFilters();
}

function variationFilters() {
  const box = $("variationFilters");
  if (!box) return seriesFilters();
  const categoryProducts = currentCat === "Todos" ? [] : products.filter(p => p.brand === currentBrand && p.cat === currentCat);
  const values = [...new Set(categoryProducts.map(variationKey))].sort(compareVariation);
  const hasNamedVariation = values.some(value => value !== NO_VARIATION);

  if (!hasNamedVariation) {
    currentVariation = "Todas";
    box.textContent = "";
    box.classList.add("hidden");
    seriesFilters();
    return;
  }

  if (currentVariation !== "Todas" && !values.includes(currentVariation)) currentVariation = "Todas";
  box.textContent = "";
  const title = document.createElement("span");
  title.className = "variation-filter-label";
  title.textContent = "Variações / tamanhos:";
  box.appendChild(title);

  ["Todas", ...values].forEach(value => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = value === currentVariation ? "active" : "";
    button.textContent = value === "Todas" ? "Todas as variações" : variationLabel(value);
    button.addEventListener("click", () => {
      currentVariation = value;
      currentSeries = "Todas";
      visibleLimit = PAGE_SIZE;
      variationFilters();
      render();
    });
    box.appendChild(button);
  });
  box.classList.remove("hidden");
  seriesFilters();
}

function seriesFilters() {
  const box = $("seriesFilters");
  if (!box) return;
  const values = currentCat === "Todos" ? [] : [...new Set(products
    .filter(p => p.brand === currentBrand && p.cat === currentCat && (currentVariation === "Todas" || variationKey(p) === currentVariation))
    .map(p => seriesValue(p.series))
    .filter(Boolean))].sort(compareSeries);

  if (!values.length) {
    currentSeries = "Todas";
    box.textContent = "";
    box.classList.add("hidden");
    return;
  }

  if (currentSeries !== "Todas" && !values.includes(currentSeries)) currentSeries = "Todas";
  box.textContent = "";
  const title = document.createElement("span");
  title.className = "series-filter-label";
  title.textContent = "Séries:";
  box.appendChild(title);

  ["Todas", ...values].forEach(value => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = value === currentSeries ? "active" : "";
    button.textContent = value === "Todas" ? "Todas as séries" : seriesLabel(value);
    button.addEventListener("click", () => {
      currentSeries = value;
      visibleLimit = PAGE_SIZE;
      seriesFilters();
      render();
    });
    box.appendChild(button);
  });
  box.classList.remove("hidden");
}

function filteredProducts() {
  const q = $("search").value.toLowerCase().trim();
  return products.filter(p =>
    p.brand === currentBrand &&
    (currentCat === "Todos" || p.cat === currentCat) &&
    (currentVariation === "Todas" || variationKey(p) === currentVariation) &&
    (currentSeries === "Todas" || seriesValue(p.series) === currentSeries) &&
    (!q || `${p.code} ${p.name} ${p.brand} ${p.cat} ${p.variation || ""} ${p.series || ""}`.toLowerCase().includes(q))
  );
}

function createQtyPicker(initialQty, product) {
  const pack = salePack(product);
  const wrap = document.createElement("div");
  wrap.className = "product-qty-picker";

  const label = document.createElement("span");
  label.textContent = pack === 1 ? "Qtd." : `Qtd. (${pack} em ${pack})`;

  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  minus.setAttribute("aria-label", `Diminuir quantidade em ${pack}`);

  const input = document.createElement("input");
  input.type = "number";
  input.min = String(pack);
  input.max = String(maxAllowedQty(product));
  input.step = String(pack);
  input.inputMode = "numeric";
  input.value = normalizeQtyForProduct(initialQty || pack, product);
  input.setAttribute("aria-label", pack === 1 ? "Quantidade desejada" : `Quantidade desejada, múltiplos de ${pack}`);

  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";
  plus.setAttribute("aria-label", `Aumentar quantidade em ${pack}`);

  minus.addEventListener("click", () => {
    input.value = normalizeQtyForProduct(Math.max(pack, Number(input.value) - pack), product);
  });
  plus.addEventListener("click", () => {
    const current = Number(input.value) || pack;
    const next = normalizeQtyForProduct(current + pack, product);
    if (stockControlEnabled(product) && next <= current) {
      toast("Quantidade solicitada maior que a disponível.");
      return;
    }
    input.value = next;
  });
  input.addEventListener("change", () => {
    const requested = Number.parseInt(input.value, 10) || pack;
    const normalized = normalizeQtyForProduct(requested, product);
    if (stockControlEnabled(product) && requested > maxAllowedQty(product)) toast("Quantidade solicitada maior que a disponível.");
    else if (String(normalized) !== String(input.value)) toast(pack === 1 ? "Quantidade ajustada." : `Este produto é vendido fechado com ${pack} unidades.`);
    input.value = normalized || pack;
  });

  wrap.append(label, minus, input, plus);
  return { wrap, input };
}

function openLightbox(images, index, name) {
  lightboxImages = Array.isArray(images) ? images.filter(Boolean) : [];
  if (!lightboxImages.length) return;
  lightboxIndex = Math.max(0, Math.min(index || 0, lightboxImages.length - 1));
  lightboxName = name || "Produto";
  updateLightbox();
  $("imageLightbox").classList.remove("hidden");
  $("imageLightbox").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function updateLightbox() {
  const src = lightboxImages[lightboxIndex];
  $("lightboxImage").src = src || "";
  $("lightboxImage").alt = `${lightboxName} — foto ${lightboxIndex + 1}`;
  $("lightboxCaption").textContent = `${lightboxName} · Foto ${lightboxIndex + 1} de ${lightboxImages.length}`;
  $("lightboxPrev").classList.toggle("hidden", lightboxImages.length < 2);
  $("lightboxNext").classList.toggle("hidden", lightboxImages.length < 2);
}

function moveLightbox(delta) {
  if (lightboxImages.length < 2) return;
  lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
  updateLightbox();
}

function closeLightbox() {
  if (!$("imageLightbox")) return;
  $("imageLightbox").classList.add("hidden");
  $("imageLightbox").setAttribute("aria-hidden", "true");
  $("lightboxImage").src = "";
  lightboxImages = [];
  if (!$("drawer").classList.contains("open")) document.body.style.overflow = "";
}


function closeProductDetail() {
  const modal = $("productDetailModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  detailProductCode = "";
  if (!$("drawer").classList.contains("open") && $("imageLightbox").classList.contains("hidden") && $("videoModal").classList.contains("hidden")) document.body.style.overflow = "";
}

function openProductDetail(product) {
  if (!product) return;
  detailProductCode = product.code;
  const modal = $("productDetailModal");
  const images = productImages(product);
  const main = $("productDetailImage");
  const thumbs = $("productDetailThumbs");
  thumbs.textContent = "";
  if (images.length) {
    main.classList.remove("hidden");
    attachReliableImage(main, images, { alt: product.name, lazy: false, onEmpty: () => main.classList.add("hidden") });
    images.forEach((url, index) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = index === 0 ? "active" : "";
      const img = document.createElement("img");
      attachReliableImage(img, [url], { alt: "" });
      b.appendChild(img);
      b.addEventListener("click", () => {
        attachReliableImage(main, [url, ...images.filter(x => x !== url)], { alt: product.name, lazy: false, onEmpty: () => main.classList.add("hidden") });
        main.classList.remove("hidden");
        thumbs.querySelectorAll("button").forEach((x, i) => x.classList.toggle("active", i === index));
      });
      thumbs.appendChild(b);
    });
  } else {
    main.src = ""; main.alt = ""; main.classList.add("hidden");
  }
  $("productDetailBrand").textContent = product.brand;
  $("productDetailName").textContent = product.name;
  const meta = [
    `Código: ${product.code}`,
    product.cat || "",
    variationValue(product.variation),
    product.series ? seriesLabel(product.series) : "",
    `Forma de venda: ${salePackLabel(product)}`,
    isAvailable(product) ? "Disponível" : "Esgotado"
  ].filter(Boolean);
  $("productDetailMeta").textContent = meta.join(" · ");
  const priceHost = $("productDetailPrice");
  priceHost.textContent = "";
  priceHost.appendChild(priceBlock(product));
  const desc = String(product.shortDescription || "").trim();
  $("productDetailDescription").textContent = desc || "Descrição resumida não informada para este produto.";
  $("productDetailDescription").classList.toggle("muted", !desc);
  const qtyHost = $("productDetailQty");
  qtyHost.textContent = "";
  qtyHost.classList.toggle("hidden", !isAvailable(product));
  const picker = createQtyPicker(selected[product.code] || salePack(product), product);
  qtyHost.appendChild(picker.wrap);
  const add = $("productDetailAdd");
  add.disabled = !isAvailable(product);
  add.classList.toggle("soldout-button", !isAvailable(product));
  add.textContent = !isAvailable(product) ? "Produto esgotado" : (selected[product.code] ? "✓ Atualizar quantidade" : "+ Adicionar ao orçamento");
  add.onclick = isAvailable(product) ? (() => { addToQuote(product.code, picker.input.value); closeProductDetail(); }) : null;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function render() {
  if (!currentBrand) return;
  const list = filteredProducts();
  const shown = list.slice(0, visibleLimit);
  const variationInfo = currentVariation !== "Todas" ? ` · ${variationLabel(currentVariation)}` : "";
  const seriesInfo = currentSeries !== "Todas" ? ` · ${seriesLabel(currentSeries)}` : "";
  $("result").textContent = `${list.length.toLocaleString("pt-BR")} produto(s) encontrado(s)${variationInfo}${seriesInfo}`;
  $("resetFilter").classList.toggle("hidden", currentCat === "Todos" && currentVariation === "Todas" && currentSeries === "Todas" && !$("search").value.trim());
  const grid = $("grid");
  grid.textContent = "";

  if (!list.length) {
    const e = document.createElement("div");
    e.className = "empty-state";
    const brandCount = countByBrand(currentBrand);
    if (!brandCount) {
      e.innerHTML = `<b>Nenhum produto cadastrado em ${currentBrand} ainda.</b>Os produtos podem ser incluídos pelo painel administrativo.`;
    } else {
      e.innerHTML = `<b>Nenhum produto encontrado.</b>Tente outra pesquisa ou limpe os filtros.`;
    }
    grid.appendChild(e);
    $("loadMore").classList.add("hidden");
    updateCount();
    return;
  }

  shown.forEach(p => {
    const card = document.createElement("article");
    card.className = "product-card" + (selected[p.code] ? " is-selected" : "") + (!isAvailable(p) ? " is-soldout" : "");

    const media = document.createElement("div");
    media.className = "product-media";
    const pic = document.createElement("div");
    pic.className = "product-pic";
    const mini = document.createElement("span");
    mini.className = "brand-mini";
    mini.textContent = p.brand;
    pic.appendChild(mini);
    const images = productImages(p);
    let activeImageIndex = 0;
    let mainImage = null;
    if (images.length) {
      mainImage = document.createElement("img");
      attachReliableImage(mainImage, images, { alt: p.name });
      mainImage.className = "product-main-image";
      mainImage.title = "Clique para ampliar";
      mainImage.addEventListener("click", () => openLightbox(images, activeImageIndex, p.name));
      pic.appendChild(mainImage);
    } else {
      const placeholder = document.createElement("span");
      placeholder.textContent = "FOTO DO PRODUTO";
      pic.appendChild(placeholder);
    }
    media.appendChild(pic);
    if (images.length > 1) {
      const thumbs = document.createElement("div");
      thumbs.className = "product-thumbs";
      images.forEach((url, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = index === 0 ? "active" : "";
        button.setAttribute("aria-label", `Ver foto ${index + 1} de ${p.name}`);
        const thumb = document.createElement("img");
        attachReliableImage(thumb, [url], { alt: "" });
        button.appendChild(thumb);
        button.addEventListener("click", () => {
          activeImageIndex = index;
          if (mainImage) attachReliableImage(mainImage, [url, ...images.filter(x => x !== url)], { alt: p.name });
          thumbs.querySelectorAll("button").forEach((btn, i) => btn.classList.toggle("active", i === index));
        });
        thumbs.appendChild(button);
      });
      media.appendChild(thumbs);
    }

    const body = document.createElement("div");
    body.className = "product-body";
    const code = document.createElement("div");
    code.className = "product-code";
    code.textContent = p.code;
    const h = document.createElement("h3");
    h.textContent = p.name;
    const cat = document.createElement("div");
    cat.className = "product-category";
    const categoryParts = [p.cat];
    if (variationValue(p.variation)) categoryParts.push(variationValue(p.variation));
    if (p.series) categoryParts.push(seriesLabel(p.series));
    if (salePack(p) > 1) categoryParts.push(salePackLabel(p));
    cat.textContent = categoryParts.join(" · ");
    const price = priceBlock(p);
    if (!isAvailable(p)) {
      const sold = document.createElement("span"); sold.className = "catalog-soldout-badge"; sold.textContent = "Esgotado"; body.appendChild(sold);
    }

    const qtyPicker = createQtyPicker(selected[p.code] || salePack(p), p);
    qtyPicker.wrap.classList.toggle("hidden", !isAvailable(p));
    const btn = document.createElement("button");
    btn.className = "product-select" + (selected[p.code] ? " selected" : "") + (!isAvailable(p) ? " soldout-button" : "");
    btn.disabled = !isAvailable(p);
    btn.textContent = !isAvailable(p) ? "Produto esgotado" : (selected[p.code] ? "✓ Atualizar quantidade" : "+ Adicionar ao orçamento");
    if (isAvailable(p)) btn.addEventListener("click", () => addToQuote(p.code, qtyPicker.input.value));

    body.append(code, h, cat, price, qtyPicker.wrap, btn);
    card.append(media, body);
    card.classList.add("product-card-clickable");
    card.title = "Clique para ver os detalhes do produto";
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, input, .product-thumbs, .product-main-image")) return;
      openProductDetail(p);
    });
    grid.appendChild(card);
  });

  $("loadMore").classList.toggle("hidden", visibleLimit >= list.length);
  updateCount();
}

function addToQuote(code, qty) {
  const product = products.find(p => p.code === code);
  if (!product) return;
  if (!isAvailable(product)) { toast("Este produto está esgotado no momento."); return; }
  const requested = Number.parseInt(qty, 10) || salePack(product);
  const normalized = normalizeQtyForProduct(requested, product);
  if (stockControlEnabled(product) && requested > maxAllowedQty(product)) toast("Quantidade solicitada maior que a disponível.");
  if (!normalized) { toast("Este produto está esgotado no momento."); return; }
  selected[code] = normalized;
  save();
  render();
  renderItems();
  toast(`Produto adicionado com quantidade ${selected[code]}.`);
}

function openDrawer() {
  $("drawer").classList.add("open");
  $("drawerOverlay").classList.add("open");
  $("drawer").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderItems();
}

function closeDrawer() {
  $("drawer").classList.remove("open");
  $("drawerOverlay").classList.remove("open");
  $("drawer").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderItems() {
  const box = $("items");
  box.textContent = "";
  for (const code of Object.keys(selected)) {
    const product = products.find(p => p.code === code);
    if (!product || !isAvailable(product)) delete selected[code];
    else {
      const normalized = normalizeQtyForProduct(selected[code], product);
      if (!normalized) delete selected[code]; else selected[code] = normalized;
    }
  }
  save();
  const entries = Object.entries(selected);
  const q = quoteSettings();

  if (!entries.length) {
    const e = document.createElement("div");
    e.className = "quote-empty-state";
    e.innerHTML = "<b>Sua solicitação está vazia.</b>Adicione produtos dos catálogos Sennelier ou Schmincke para montar seu orçamento.";
    box.appendChild(e);
    $("drawerSummary").textContent = "0 produtos selecionados";
    $("drawerSummary").classList.toggle("hidden", !q.showSummary);
    if ($("overviewProducts")) $("overviewProducts").textContent = "0";
    if ($("overviewUnits")) $("overviewUnits").textContent = "0";
    if ($("overviewTotal")) $("overviewTotal").textContent = "R$ 0,00";
    return;
  }

  const rows = entries
    .map(([code, qty]) => {
      const product = products.find(p => p.code === code);
      return product ? { product, qty: normalizeQtyForProduct(qty, product) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.product.name.localeCompare(b.product.name, "pt-BR"));

  rows.forEach(({ product: p, qty }) => {
    const card = document.createElement("article");
    card.className = "quote-card";

    const media = document.createElement("div");
    media.className = "quote-card-media";
    const images = productImages(p);
    if (images.length) {
      const img = document.createElement("img");
      attachReliableImage(img, images, { alt: p.name });
      media.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "video-placeholder";
      ph.textContent = p.brand === "Schmincke" ? "SCHMINCKE" : "SENNELIER";
      media.appendChild(ph);
    }

    const body = document.createElement("div");
    body.className = "quote-card-body";

    const brandRow = document.createElement("div");
    brandRow.className = "quote-brand-row";
    const brandChip = document.createElement("span");
    brandChip.className = "quote-brand-chip";
    brandChip.textContent = p.brand;
    brandRow.appendChild(brandChip);
    if (p.series) {
      const s = document.createElement("span");
      s.className = "quote-meta-chip";
      s.textContent = seriesLabel(p.series);
      brandRow.appendChild(s);
    }
    if (salePack(p) > 1) {
      const pack = document.createElement("span");
      pack.className = "quote-meta-chip";
      pack.textContent = salePackLabel(p);
      brandRow.appendChild(pack);
    }
    body.appendChild(brandRow);

    const title = document.createElement("h4");
    title.className = "quote-card-title";
    title.textContent = p.name;
    body.appendChild(title);

    const code = document.createElement("div");
    code.className = "quote-card-code";
    code.textContent = `Código: ${p.code}`;
    body.appendChild(code);

    const grid = document.createElement("div");
    grid.className = "quote-card-grid";

    const addData = (label, value) => {
      const cell = document.createElement("div");
      cell.className = "quote-data";
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("b");
      strong.textContent = value;
      cell.append(span, strong);
      grid.appendChild(cell);
    };

    if (q.columns.quantity) {
      const cell = document.createElement("div");
      cell.className = "quote-data quote-qty-data";
      const span = document.createElement("span"); span.textContent = "Quantidade";
      const controls = document.createElement("div"); controls.className = "quote-qty-controls";
      const pack = salePack(p);
      const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−";
      const value = document.createElement("b"); value.textContent = String(qty);
      const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+";
      minus.addEventListener("click", () => { selected[p.code] = normalizeQtyForProduct(Math.max(pack, qty - pack), p); save(); renderItems(); render(); });
      plus.addEventListener("click", () => {
        const next = normalizeQtyForProduct(qty + pack, p);
        if (stockControlEnabled(p) && next <= qty) { toast("Quantidade solicitada maior que a disponível."); return; }
        selected[p.code] = next; save(); renderItems(); render();
      });
      controls.append(minus, value, plus); cell.append(span, controls); grid.appendChild(cell);
    }
    if (q.columns.unitPrice) {
      const unit = finalPrice(p);
      addData("Valor do item", unit === null ? "Sob consulta" : formatMoney(unit));
    }
    if (q.columns.subtotal) {
      const unit = finalPrice(p);
      addData("Total do item", unit === null ? "Sob consulta" : formatMoney(unit * qty));
    }
    if (q.columns.salePack) addData("Forma de venda", salePackLabel(p));
    if (q.columns.series && p.series) addData("Série", seriesLabel(p.series));
    if (q.columns.code) addData("Código", p.code);

    body.appendChild(grid);

    const remove = document.createElement("button");
    remove.className = "quote-card-remove";
    remove.textContent = "×";
    remove.title = "Remover produto";
    remove.setAttribute("aria-label", `Remover ${p.name}`);
    remove.addEventListener("click", () => removeItem(p.code));

    card.append(media, body, remove);
    box.appendChild(card);
  });

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const pricedRows = rows.filter(row => finalPrice(row.product) !== null);
  const totalValue = pricedRows.reduce((sum, row) => sum + finalPrice(row.product) * row.qty, 0);
  const withoutPrice = rows.length - pricedRows.length;
  let valueText = "";
  if (q.showGrandTotal) valueText = pricedRows.length
    ? ` · Total estimado: ${formatMoney(totalValue)}${withoutPrice ? ` · ${withoutPrice} item(ns) sob consulta` : ""}`
    : " · Valores sob consulta";
  $("drawerSummary").textContent = `${rows.length} produto(s) · ${totalQty} unidade(s)${valueText}`;
  $("drawerSummary").classList.toggle("hidden", !q.showSummary);
  if ($("overviewProducts")) $("overviewProducts").textContent = String(rows.length);
  if ($("overviewUnits")) $("overviewUnits").textContent = String(totalQty);
  if ($("overviewTotal")) {
    $("overviewTotal").textContent = pricedRows.length ? formatMoney(totalValue) : "Sob consulta";
    if (withoutPrice && pricedRows.length) $("overviewTotal").textContent += ` + ${withoutPrice} sob consulta`;
  }
}

function removeItem(code) {
  delete selected[code];
  save();
  render();
  renderItems();
}

function clearList() {
  if (Object.keys(selected).length && !confirm("Limpar toda a solicitação de orçamento?")) return;
  selected = {};
  save();
  render();
  renderItems();
}

function resetQuoteAfterFinalize() {
  selected = {};
  quoteFinalizeId = "";
  save();
  if ($("customerName")) $("customerName").value = "";
  if ($("customerCep")) $("customerCep").value = "";
  if ($("customerAddress")) $("customerAddress").value = "";
  if ($("customerNote")) $("customerNote").value = "";
  render();
  renderItems();
}


function createQuoteId() {
  if (quoteFinalizeId) return quoteFinalizeId;
  if (globalThis.crypto?.randomUUID) quoteFinalizeId = crypto.randomUUID();
  else quoteFinalizeId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return quoteFinalizeId;
}

async function finalizeQuoteStock() {
  const payload = quotePayload();
  if (!payload.items.length) throw new Error("Adicione pelo menos um produto ao orçamento.");
  const r = await fetch("/api/quote-stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: createQuoteId(),
      items: payload.items,
      customer: payload.customer || ""
    }),
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    quoteFinalizeId = "";
    throw new Error(data.error || "Não foi possível atualizar o estoque.");
  }
  await refreshCatalogNow({ force: true, silent: true });
  return data;
}

async function fetchCatalogVersion() {
  const r = await fetch("/api/catalog-version", { cache: "no-store" });
  if (!r.ok) return "";
  const d = await r.json();
  return String(d.version || "");
}

async function refreshCatalogNow({ force = false, silent = false } = {}) {
  try {
    const version = await fetchCatalogVersion();
    if (!force && version && catalogVersion && version === catalogVersion) return false;
    const r = await fetch("/api/products", { cache: "no-store" });
    if (!r.ok) return false;
    const d = await r.json();
    products = Array.isArray(d.products) ? d.products : [];
    if (version) catalogVersion = version;
    for (const code of Object.keys(selected)) {
      const product = products.find(item => item.code === code);
      if (!product || !isAvailable(product)) delete selected[code];
      else {
        const normalized = normalizeQtyForProduct(selected[code], product);
        if (!normalized) delete selected[code]; else selected[code] = normalized;
      }
    }
    save();
    updateLandingCounts();
    if (currentBrand) { categories(); render(); }
    renderItems();
    if (!silent) toast("Catálogo atualizado automaticamente.");
    return true;
  } catch { return false; }
}

function startCatalogAutoRefresh() {
  clearInterval(catalogRefreshTimer);
  catalogRefreshTimer = setInterval(() => {
    if (!document.hidden) {
      refreshCatalogNow({ silent: true });
      refreshSettingsNow();
    }
  }, 7000);
}

function formatCepInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits;
}

function quotePayload() {
  return {
    items: Object.entries(selected).map(([code, qty]) => {
      const product = products.find(p => p.code === code);
      return { code, qty: product ? normalizeQtyForProduct(qty, product) : clampQty(qty) };
    }),
    customer: quoteSettings().showCustomer ? $("customerName").value.trim() : "",
    cep: quoteSettings().showAddress ? $("customerCep").value.trim() : "",
    address: quoteSettings().showAddress ? $("customerAddress").value.trim() : "",
    note: quoteSettings().showNote ? $("customerNote").value.trim() : ""
  };
}

async function generatePdfBlob() {
  const payload = quotePayload();
  if (!payload.items.length) throw new Error("Adicione pelo menos um produto ao orçamento.");
  const r = await fetch("/api/quote-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!r.ok) {
    let msg = "Não foi possível gerar o PDF.";
    try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return await r.blob();
}


async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function quoteTotalEstimated() {
  return Object.entries(selected).reduce((sum, [code, qty]) => {
    const product = products.find(p => p.code === code);
    if (!product) return sum;
    const price = finalPrice(product);
    return price === null ? sum : sum + price * normalizeQtyForProduct(qty, product);
  }, 0);
}

async function saveFinalizedQuote(blob) {
  const payload = quotePayload();
  const pdfBase64 = await blobToBase64(blob);
  const r = await fetch("/api/quote-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: createQuoteId(),
      ...payload,
      totalEstimated: quoteTotalEstimated(),
      pdfBase64
    }),
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || "O orçamento foi finalizado, mas não foi possível guardar a cópia no atendimento.");
  return data;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function whatsappMessage() {
  const customer = quoteSettings().showCustomer ? $("customerName").value.trim() : "";
  const cep = quoteSettings().showAddress ? $("customerCep").value.trim() : "";
  const address = quoteSettings().showAddress ? $("customerAddress").value.trim() : "";
  const note = quoteSettings().showNote ? $("customerNote").value.trim() : "";
  const lines = [
    customer
      ? `Olá, Fruto Importadora! Sou ${customer}. Segue minha solicitação de orçamento em PDF.`
      : "Olá, Fruto Importadora! Segue minha solicitação de orçamento em PDF."
  ];
  if (address) lines.push(`Endereço: ${address}${cep ? ` - CEP ${cep}` : ""}`);
  else if (cep) lines.push(`CEP: ${cep}`);
  if (note) lines.push(`Observação: ${note}`);
  return lines.join("\n");
}

function whatsappUrl() {
  const phone = String(settings.whatsapp || "5511996576368").replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage())}` : "";
}

async function sendPdf() {
  const payload = quotePayload();
  if (!payload.items.length) {
    alert("Adicione pelo menos um produto ao orçamento.");
    return;
  }

  const btn = $("sendWhatsApp");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Gerando PDF...";

  try {
    const blob = await generatePdfBlob();
    const filename = `fruto-importadora-orcamento-${new Date().toISOString().slice(0,10)}.pdf`;
    const file = new File([blob], filename, { type: "application/pdf" });
    const shortMessage = whatsappMessage();

    // Em celulares compatíveis, tenta compartilhar o próprio PDF. O usuário
    // escolhe o WhatsApp no menu de compartilhamento e o arquivo segue anexado.
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Solicitação de orçamento - Fruto Importadora",
          text: shortMessage,
          files: [file]
        });
        await finalizeQuoteStock();
        await saveFinalizedQuote(blob);
        resetQuoteAfterFinalize();
        toast("Solicitação finalizada. Um novo orçamento já pode ser iniciado.");
        return;
      } catch (shareErr) {
        // Se o cliente cancelar, não abrimos outro fluxo automaticamente.
        if (shareErr && shareErr.name === "AbortError") {
          toast("Compartilhamento cancelado. O PDF não foi enviado.");
          return;
        }
        // Em navegadores que bloqueiam o compartilhamento após gerar o PDF,
        // seguimos para o modo compatível abaixo.
      }
    }

    // Modo compatível: confirma o estoque, baixa o PDF e abre o WhatsApp apenas com mensagem curta.
    await finalizeQuoteStock();
    await saveFinalizedQuote(blob);
    downloadBlob(blob, filename);
    const wa = whatsappUrl();
    if (wa) {
      resetQuoteAfterFinalize();
      toast("Solicitação finalizada. Abrindo o WhatsApp.");
      window.location.href = wa;
    } else {
      resetQuoteAfterFinalize();
      toast("PDF gerado. O orçamento foi limpo para uma nova solicitação.");
    }
  } catch (err) {
    alert(err.message || "Não foi possível gerar o PDF.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function downloadPdf() {
  const btn = $("downloadPdf");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Gerando...";
  try {
    const blob = await generatePdfBlob();
    await finalizeQuoteStock();
    await saveFinalizedQuote(blob);
    downloadBlob(blob, `fruto-importadora-orcamento-${new Date().toISOString().slice(0,10)}.pdf`);
    resetQuoteAfterFinalize();
    toast("PDF gerado. O orçamento foi limpo para uma nova solicitação.");
  } catch (err) {
    alert(err.message || "Não foi possível gerar o PDF.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function load() {
  const settingsTask = (async () => {
    try {
      const settingsResponse = await fetch("/api/settings", { cache: "no-store" });
      if (settingsResponse.ok) settings = { ...settings, ...(await settingsResponse.json()) };
    } catch {}
    applySettings();
    document.documentElement.classList.remove("settings-loading");
  })();

  try {
    const catalogResponse = await fetch("/api/products", { cache: "no-store" });
    if (!catalogResponse.ok) throw new Error("Catálogo indisponível.");
    const catalogData = await catalogResponse.json();
    products = Array.isArray(catalogData.products) ? catalogData.products : [];
    catalogVersion = await fetchCatalogVersion();
    for (const code of Object.keys(selected)) {
      const product = products.find(item => item.code === code);
      if (!product || !isAvailable(product)) delete selected[code];
      else {
        const normalized = normalizeQtyForProduct(selected[code], product);
        if (!normalized) delete selected[code]; else selected[code] = normalized;
      }
    }
    save();
    await settingsTask;
    updateLandingCounts();
    renderItems();
  } catch {
    products = [];
    await settingsTask;
    updateLandingCounts();
    toast("Não foi possível carregar o catálogo. Atualize a página em alguns instantes.");
  }
}

document.querySelectorAll("[data-open-brand]").forEach(btn => btn.addEventListener("click", () => openBrand(btn.dataset.openBrand)));
document.querySelectorAll("[data-brand]").forEach(btn => btn.addEventListener("click", () => openBrand(btn.dataset.brand)));
document.querySelector('[data-view="home"]').addEventListener("click", showHome);
$("homeLogo").addEventListener("click", showHome);
$("backHome").addEventListener("click", showHome);
$("search").addEventListener("input", () => { if (currentBrand) { visibleLimit = PAGE_SIZE; render(); } });
$("searchBtn").addEventListener("click", () => { if (currentBrand) render(); });
$("resetFilter").addEventListener("click", () => { $("search").value = ""; currentCat = "Todos"; currentVariation = "Todas"; currentSeries = "Todas"; visibleLimit = PAGE_SIZE; categories(); render(); });
$("loadMore").addEventListener("click", () => { visibleLimit += PAGE_SIZE; render(); });
$("listBtn").addEventListener("click", openDrawer);
$("closeDrawer").addEventListener("click", closeDrawer);
$("drawerOverlay").addEventListener("click", closeDrawer);
$("clearList").addEventListener("click", clearList);
$("sendWhatsApp").addEventListener("click", sendPdf);
$("downloadPdf").addEventListener("click", downloadPdf);
$("lightboxClose").addEventListener("click", closeLightbox);
$("videoModalClose").addEventListener("click", closeVideo);
$("productDetailClose").addEventListener("click", closeProductDetail);
$("productDetailModal").addEventListener("click", e => { if (e.target === $("productDetailModal")) closeProductDetail(); });
$("videoModal").addEventListener("click", e => { if (e.target === $("videoModal")) closeVideo(); });
$("lightboxPrev").addEventListener("click", () => moveLightbox(-1));
$("lightboxNext").addEventListener("click", () => moveLightbox(1));
$("imageLightbox").addEventListener("click", e => { if (e.target === $("imageLightbox")) closeLightbox(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshCatalogNow({ silent: true });
    refreshSettingsNow();
  }
});
window.addEventListener("focus", () => {
  refreshCatalogNow({ silent: true });
  refreshSettingsNow();
});

if ($("customerCep")) {
  $("customerCep").addEventListener("input", e => {
    e.target.value = formatCepInput(e.target.value);
  });
}

window.addEventListener("pageshow", event => {
  if (event.persisted) window.location.reload();
});

document.addEventListener("keydown", e => {
  if (!$("productDetailModal").classList.contains("hidden")) {
    if (e.key === "Escape") closeProductDetail();
    return;
  }
  if (!$("imageLightbox").classList.contains("hidden")) {
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") moveLightbox(-1);
    else if (e.key === "ArrowRight") moveLightbox(1);
    return;
  }
  if (e.key === "Escape") closeDrawer();
});

updateCount();
load().finally(startCatalogAutoRefresh);
