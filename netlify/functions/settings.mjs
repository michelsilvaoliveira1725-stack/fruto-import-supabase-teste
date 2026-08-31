import { getStore } from "@netlify/blobs";
import { requireAdmin, json } from "../lib/auth.mjs";

const STORE = "fruto-import-settings";
const KEY = "public";

const DEFAULT_HOME = {
  header: {
    showLogo: true,
    logoImage: "",
    brandLabelPosition: "left",
    showBrandName: false,
    brandName: "FRUTO IMPORT",
    homeLabel: "Início",
    sennelierLabel: "Sennelier",
    schminckeLabel: "Schmincke",
    raphaelLabel: "Raphaël",
    quoteLabel: "Orçamento",
    searchPlaceholder: "Pesquisar por produto, código ou categoria..."
  },
  eyebrow: "CATÁLOGO DIGITAL · FRUTO IMPORT",
  title: "Três referências mundiais em materiais artísticos.",
  intro: "Explore os produtos Sennelier, Schmincke e Raphaël, monte sua seleção e solicite seu orçamento de forma rápida.",
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
  raphael: {
    kicker: "Raphaël 🇫🇷", title: "RAPHAËL", description: "Pincéis franceses para artistas, com linhas profissionais para diferentes técnicas e estilos.",
    chip1: "Pincéis profissionais", chip2: "Belas-Artes", chip3: "França", button: "Ver Catálogo Raphaël →", image: "/assets/hero-raphael.png", catalogImage: "",
    catalogTitle: "Catálogo Raphaël", catalogSubtitle: "Pincéis Raphaël para artistas — selecione os produtos e monte sua solicitação de orçamento."
  }
};

const DEFAULT_QUOTE = {
  title: "Minha solicitação",
  intro: "As quantidades já foram definidas na escolha dos produtos. Confira a solicitação antes de gerar o PDF.",
  pdfHeaderTitle: "FRUTO IMPORT",
  pdfHeaderSubtitle: "Solicitação de Orçamento",
  pdfContactLabel: "WhatsApp Fruto Import",
  pdfFooterText: "Fruto Import",
  showCustomer: true,
  showNote: true,
  showSummary: true,
  showGrandTotal: true,
  showDownloadPdf: true,
  showShareNote: true,
  columns: { product: true, code: true, series: false, salePack: false, quantity: true, unitPrice: true, subtotal: false }
};

const DEFAULT_VIDEOS = {
  enabled: false,
  title: "Novidades em Vídeo",
  subtitle: "Assista às demonstrações e conheça de perto nossos materiais.",
  showAllButton: false,
  allButtonText: "Ver todos os vídeos",
  allButtonUrl: "",
  items: Array.from({ length: 4 }, () => ({ enabled: false, tag: "Novidade", title: "", subtitle: "", duration: "", url: "", thumbnail: "" }))
};

const DEFAULTS = { businessName: "Fruto Import", whatsapp: "5511996576368", home: { ...DEFAULT_HOME, videos: DEFAULT_VIDEOS }, quote: DEFAULT_QUOTE };

function clean(value, max = 360) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanPhone(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 15);
}

function valueOr(source, key, fallback, max) {
  return source && Object.prototype.hasOwnProperty.call(source, key) ? clean(source[key], max) : fallback;
}

function normalizeBrand(raw, fallback) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    kicker: valueOr(source, "kicker", fallback.kicker, 80),
    title: valueOr(source, "title", fallback.title, 80),
    description: valueOr(source, "description", fallback.description, 360),
    chip1: valueOr(source, "chip1", fallback.chip1, 60),
    chip2: valueOr(source, "chip2", fallback.chip2, 60),
    chip3: valueOr(source, "chip3", fallback.chip3, 60),
    button: valueOr(source, "button", fallback.button, 80),
    image: valueOr(source, "image", fallback.image, 500),
    catalogImage: valueOr(source, "catalogImage", fallback.catalogImage || "", 500),
    catalogTitle: valueOr(source, "catalogTitle", fallback.catalogTitle, 100),
    catalogSubtitle: valueOr(source, "catalogSubtitle", fallback.catalogSubtitle, 360)
  };
}

function normalizeBenefits(raw, fallback) {
  const arr = Array.isArray(raw) ? raw : [];
  return fallback.map((item, i) => {
    const source = arr[i] && typeof arr[i] === "object" ? arr[i] : {};
    return {
      title: valueOr(source, "title", item.title, 80),
      text: valueOr(source, "text", item.text, 160)
    };
  });
}

function boolOr(source, key, fallback) {
  return source && Object.prototype.hasOwnProperty.call(source, key) ? Boolean(source[key]) : fallback;
}

function normalizeVideos(raw, fallback = DEFAULT_VIDEOS) {
  const source = raw && typeof raw === "object" ? raw : {};
  const arr = Array.isArray(source.items) ? source.items : [];
  return {
    enabled: boolOr(source, "enabled", fallback.enabled),
    title: valueOr(source, "title", fallback.title, 100),
    subtitle: valueOr(source, "subtitle", fallback.subtitle, 220),
    showAllButton: boolOr(source, "showAllButton", fallback.showAllButton),
    allButtonText: valueOr(source, "allButtonText", fallback.allButtonText, 80),
    allButtonUrl: valueOr(source, "allButtonUrl", fallback.allButtonUrl, 500),
    items: fallback.items.map((item, i) => {
      const row = arr[i] && typeof arr[i] === "object" ? arr[i] : {};
      return {
        enabled: boolOr(row, "enabled", item.enabled),
        tag: valueOr(row, "tag", item.tag, 40),
        title: valueOr(row, "title", item.title, 100),
        subtitle: valueOr(row, "subtitle", item.subtitle, 140),
        duration: valueOr(row, "duration", item.duration, 12),
        url: valueOr(row, "url", item.url, 500),
        thumbnail: valueOr(row, "thumbnail", item.thumbnail, 500)
      };
    })
  };
}

function normalizeQuote(raw, fallback = DEFAULT_QUOTE) {
  const source = raw && typeof raw === "object" ? raw : {};
  const cols = source.columns && typeof source.columns === "object" ? source.columns : {};
  const columns = {};
  for (const [key, val] of Object.entries(fallback.columns)) columns[key] = boolOr(cols, key, val);
  if (!Object.values(columns).some(Boolean)) Object.assign(columns, fallback.columns);
  return {
    title: valueOr(source, "title", fallback.title, 100),
    intro: valueOr(source, "intro", fallback.intro, 280),
    pdfHeaderTitle: valueOr(source, "pdfHeaderTitle", fallback.pdfHeaderTitle, 80),
    pdfHeaderSubtitle: valueOr(source, "pdfHeaderSubtitle", fallback.pdfHeaderSubtitle, 100),
    pdfContactLabel: valueOr(source, "pdfContactLabel", fallback.pdfContactLabel, 80),
    pdfFooterText: valueOr(source, "pdfFooterText", fallback.pdfFooterText, 80),
    showCustomer: boolOr(source, "showCustomer", fallback.showCustomer),
    showNote: boolOr(source, "showNote", fallback.showNote),
    showSummary: boolOr(source, "showSummary", fallback.showSummary),
    showGrandTotal: boolOr(source, "showGrandTotal", fallback.showGrandTotal),
    showDownloadPdf: boolOr(source, "showDownloadPdf", fallback.showDownloadPdf),
    showShareNote: boolOr(source, "showShareNote", fallback.showShareNote),
    columns
  };
}

function normalizeHeader(raw, fallback = DEFAULT_HOME.header) {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawLabelPosition = valueOr(source, "brandLabelPosition", fallback.brandLabelPosition || "left", 12);
  const brandLabelPosition = ["left", "center", "right", "hidden"].includes(rawLabelPosition) ? rawLabelPosition : "left";
  return {
    showLogo: boolOr(source, "showLogo", fallback.showLogo !== false),
    logoImage: valueOr(source, "logoImage", fallback.logoImage || "", 500),
    brandLabelPosition,
    showBrandName: boolOr(source, "showBrandName", fallback.showBrandName),
    brandName: valueOr(source, "brandName", fallback.brandName, 40),
    homeLabel: valueOr(source, "homeLabel", fallback.homeLabel, 30),
    sennelierLabel: valueOr(source, "sennelierLabel", fallback.sennelierLabel, 30),
    schminckeLabel: valueOr(source, "schminckeLabel", fallback.schminckeLabel, 30),
    raphaelLabel: valueOr(source, "raphaelLabel", fallback.raphaelLabel, 30),
    quoteLabel: valueOr(source, "quoteLabel", fallback.quoteLabel, 30),
    searchPlaceholder: valueOr(source, "searchPlaceholder", fallback.searchPlaceholder, 100)
  };
}

function normalizeHome(raw, fallback = DEFAULTS.home) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    header: normalizeHeader(source.header, fallback.header || DEFAULT_HOME.header),
    eyebrow: valueOr(source, "eyebrow", fallback.eyebrow, 100),
    title: valueOr(source, "title", fallback.title, 180),
    intro: valueOr(source, "intro", fallback.intro, 360),
    videos: normalizeVideos(source.videos, fallback.videos || DEFAULT_VIDEOS),
    benefits: normalizeBenefits(source.benefits, fallback.benefits),
    sennelier: normalizeBrand(source.sennelier, fallback.sennelier),
    schmincke: normalizeBrand(source.schmincke, fallback.schmincke),
    raphael: normalizeBrand(source.raphael, fallback.raphael)
  };
}

function normalizeStored(current) {
  const source = current && typeof current === "object" ? current : {};
  return {
    businessName: "Fruto Import",
    whatsapp: cleanPhone(source.whatsapp || DEFAULTS.whatsapp) || DEFAULTS.whatsapp,
    home: normalizeHome(source.home, DEFAULTS.home),
    quote: normalizeQuote(source.quote, DEFAULT_QUOTE)
  };
}

async function readSettings() {
  const current = await getStore(STORE).get(KEY, { type: "json", consistency: "strong" });
  return normalizeStored(current);
}

export default async (req) => {
  if (req.method === "GET") return json(await readSettings());
  if (req.method !== "PUT") return json({ error: "Método não permitido." }, 405);
  if (!(await requireAdmin(req))) return json({ error: "Acesso não autorizado." }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

  const current = await readSettings();
  let whatsapp = current.whatsapp;
  if (Object.prototype.hasOwnProperty.call(body, "whatsapp")) {
    whatsapp = cleanPhone(body.whatsapp);
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
      return json({ error: "Informe o WhatsApp com DDD e código do país. Ex.: 5511999999999." }, 400);
    }
    if (!whatsapp) whatsapp = DEFAULTS.whatsapp;
  }

  const home = body.home && typeof body.home === "object"
    ? normalizeHome(body.home, current.home)
    : current.home;

  const quote = body.quote && typeof body.quote === "object" ? normalizeQuote(body.quote, current.quote) : current.quote;
  const settings = { businessName: "Fruto Import", whatsapp, home, quote };
  await getStore(STORE).setJSON(KEY, settings);
  return json({ ok: true, ...settings });
};

export const config = {
  path: "/api/settings",
  method: ["GET", "PUT"]
};
