import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getStore } from "@netlify/blobs";
import { json } from "../lib/auth.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_KEY = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || "";
const SETTINGS_STORE = "fruto-import-settings";
const SETTINGS_KEY = "public";

async function publicCatalog() {
  const key = SUPABASE_KEY || SUPABASE_ANON_KEY;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_catalog`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store"
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,180)}`);
  return await r.json();
}

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function safePdfText(value) {
  return String(value ?? "").normalize("NFC").replace(/[^\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u20AC\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2122]/g, "?");
}

function wrapText(text, font, size, maxWidth) {
  const words = safePdfText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function formatDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date());
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

function money(value) {
  return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function salePack(product) {
  const pack = Number(product?.salePack);
  return pack === 5 ? 5 : pack === 4 ? 4 : pack === 3 ? 3 : 1;
}

function stockControlEnabled(product) { return product?.stockControl === true; }

function stockQuantity(product) {
  const n = Number.parseInt(product?.stockQuantity, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 999999) : 0;
}

function maxAllowedQty(product) {
  if (!stockControlEnabled(product)) return 9999;
  const pack = salePack(product);
  const max = Math.min(9999, stockQuantity(product));
  return pack === 1 ? max : Math.floor(max / pack) * pack;
}

function productAvailable(product) {
  return product?.available !== false && (!stockControlEnabled(product) || maxAllowedQty(product) >= salePack(product));
}

function normalizeQty(value, product) {
  const pack = salePack(product);
  const raw = Math.max(1, Math.min(9999, Number.parseInt(value, 10) || pack));
  let qty = pack === 1 ? raw : Math.max(pack, Math.min(9999, Math.ceil(raw / pack) * pack));
  if (stockControlEnabled(product)) qty = Math.min(qty, maxAllowedQty(product));
  return qty;
}

const DEFAULT_QUOTE = {
  pdfHeaderTitle:"FRUTO IMPORT",
  pdfHeaderSubtitle:"Solicitação de Orçamento",
  pdfContactLabel:"WhatsApp Fruto Import",
  pdfFooterText:"Fruto Import",
  showCustomer:true,
  showNote:true,
  showSummary:true,
  showGrandTotal:true,
  columns:{ product:true, code:true, series:false, salePack:false, quantity:true, unitPrice:true, subtotal:false }
};

function quoteSettings(raw) {
  const q = raw && typeof raw === "object" ? raw : {};
  return { ...DEFAULT_QUOTE, ...q, columns: { ...DEFAULT_QUOTE.columns, ...(q.columns || {}) } };
}

function seriesLabel(value) {
  const v = String(value||"").trim().replace(/^s[eé]rie\s*/i,"");
  return v ? `Serie ${v}` : "-";
}

function salePackLabel(product) {
  const pack = salePack(product);
  return pack === 1 ? "Unitario" : `Fechado com ${pack}`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Dados inválidos." }, 400); }

  const requested = Array.isArray(body.items) ? body.items.slice(0, 250) : [];
  if (!requested.length) return json({ error: "Adicione produtos antes de gerar o PDF." }, 400);

  let products = [];
  try {
    products = await publicCatalog();
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível consultar o catálogo atual. Tente novamente." }, 502);
  }

  const settings = await getStore(SETTINGS_STORE).get(SETTINGS_KEY, { type: "json", consistency: "strong" }) || {
    businessName: "Fruto Import",
    whatsapp: "5511996576368"
  };

  const q = quoteSettings(settings.quote);
  const map = new Map(products.map(p => [String(p.code), p]));

  const items = requested.map(row => {
    const p = map.get(clean(row.code, 60));
    if (!p || !productAvailable(p)) return null;

    const qty = normalizeQty(row.qty, p);
    if (!qty) return null;

    const unitPrice = finalPrice(p);

    return {
      ...p,
      qty,
      unitPrice,
      subtotal: unitPrice === null ? null : Math.round(unitPrice * qty * 100) / 100,
      discount: hasActiveDiscount(p) ? discountValue(p.discountPercent) : 0,
      basePrice: numericPrice(p.price)
    };
  }).filter(Boolean);

  if (!items.length) return json({ error: "Os produtos selecionados não estão mais disponíveis." }, 409);

  const customer = clean(body.customer, 100);
  const note = clean(body.note, 280);

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.05, 0.12, 0.24);
  const blue = rgb(0.04, 0.22, 0.66);
  const green = rgb(0.05, 0.48, 0.27);
  const gray = rgb(0.38, 0.42, 0.48);
  const light = rgb(0.94, 0.95, 0.97);
  const white = rgb(1, 1, 1);
  const pageSize = [595.28, 841.89];
  const margin = 44;
  let page;
  let y;

  function newPage() {
    page = pdf.addPage(pageSize);
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 94, width, height: 94, color: navy });
    page.drawText(safePdfText(q.pdfHeaderTitle || "FRUTO IMPORT"), { x: margin, y: height - 50, size: 22, font: bold, color: white });
    page.drawText(safePdfText(q.pdfHeaderSubtitle || "Solicitacao de Orcamento"), { x: margin, y: height - 73, size: 11, font: regular, color: white });
    y = height - 122;
  }

  function ensureSpace(heightNeeded = 34) {
    if (y - heightNeeded < 48) newPage();
  }

  newPage();

  page.drawText(safePdfText(`Data: ${formatDate()}`), { x: margin, y, size: 9, font: regular, color: gray });
  y -= 18;

  if (q.showCustomer && customer) {
    page.drawText(safePdfText(`Cliente: ${customer}`), { x: margin, y, size: 10, font: bold, color: navy });
    y -= 20;
  }

  if (q.showNote && note) {
    const lines = wrapText(`Observacao: ${note}`, regular, 9, 505);
    for (const line of lines) {
      page.drawText(line, { x: margin, y, size: 9, font: regular, color: gray });
      y -= 13;
    }
    y -= 5;
  }

  const brandOrder = ["Sennelier", "Schmincke", "Raphaël"];
  const ordered = [...items].sort((a, b) => {
    const ai = brandOrder.indexOf(a.brand);
    const bi = brandOrder.indexOf(b.brand);
    const ax = ai < 0 ? 99 : ai;
    const bx = bi < 0 ? 99 : bi;
    return ax - bx || a.name.localeCompare(b.name, "pt-BR");
  });

  const defs = [
    ["product","PRODUTO",210],
    ["code","CODIGO",76],
    ["series","SERIE",62],
    ["salePack","VENDA",72],
    ["quantity","QTD.",42],
    ["unitPrice","VALOR",78],
    ["subtotal","TOTAL ITEM",86]
  ].filter(([key]) => q.columns[key]);

  if (!defs.length) defs.push(["product","PRODUTO",507]);

  const baseWidth = defs.reduce((sum,d)=>sum+d[2],0);
  const cols = defs.map(d => ({ key:d[0], label:d[1], width:d[2] * 507 / baseWidth }));

  function drawTableHeader() {
    ensureSpace(38);
    page.drawRectangle({ x: margin, y: y - 5, width: 507, height: 24, color: blue });
    let hx = margin;

    for (const col of cols) {
      page.drawText(col.label, { x: hx + 5, y: y + 2, size: 7.2, font: bold, color: white });
      hx += col.width;
    }

    y -= 31;
  }

  function drawBrandTitle(brand) {
    ensureSpace(48);
    y -= 4;
    page.drawText(safePdfText(brand.toUpperCase()), { x: margin, y, size: 13, font: bold, color: navy });
    y -= 9;
    page.drawRectangle({ x: margin, y, width: 507, height: 2, color: brand === "Sennelier" ? rgb(0.72,0.52,0.22) : blue });
    y -= 22;
  }

  let currentBrand = null;

  for (const item of ordered) {
    if (item.brand !== currentBrand) {
      currentBrand = item.brand || "Outros";
      drawBrandTitle(currentBrand);
      drawTableHeader();
    }

    const productCol = cols.find(c=>c.key==="product");
    const nameLines = productCol ? wrapText(item.name, regular, 8.5, Math.max(40, productCol.width - 10)).slice(0, 3) : [""];
    const rowHeight = Math.max(32, 15 + nameLines.length * 10);

    if (y - (rowHeight + 5) < 48) {
      newPage();
      drawBrandTitle(currentBrand);
      drawTableHeader();
    }

    page.drawRectangle({ x: margin, y: y - rowHeight + 7, width: 507, height: rowHeight, color: light });

    let x = margin;
    for (const col of cols) {
      if (col.key === "product") {
        let nameY = y - 5;
        for (const line of nameLines) {
          page.drawText(line, { x:x+5, y:nameY, size:8.5, font:regular, color:navy });
          nameY -= 10;
        }
      } else {
        let text = "";

        if (col.key === "code") text = item.code;
        else if (col.key === "series") text = item.series ? seriesLabel(item.series) : "-";
        else if (col.key === "salePack") text = salePackLabel(item);
        else if (col.key === "quantity") text = String(item.qty);
        else if (col.key === "unitPrice") text = item.unitPrice === null ? "Sob consulta" : money(item.unitPrice);
        else if (col.key === "subtotal") text = item.subtotal === null ? "Sob consulta" : money(item.subtotal);

        page.drawText(safePdfText(text), {
          x:x+5,
          y:y-5,
          size: col.width < 60 ? 7.2 : 7.8,
          font: (col.key==="quantity"||col.key==="unitPrice"||col.key==="subtotal") ? bold : regular,
          color: (col.key==="unitPrice"||col.key==="subtotal") && item.unitPrice!==null ? green : navy
        });
      }
      x += col.width;
    }

    y -= rowHeight + 5;
  }

  const priced = items.filter(item => item.unitPrice !== null);
  const withoutPrice = items.length - priced.length;
  const grandTotal = Math.round(priced.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;

  ensureSpace(110);
  y -= 8;

  if (q.showSummary) {
    page.drawText(safePdfText(`Total de itens diferentes: ${items.length}`), { x: margin, y, size: 10, font: bold, color: navy });
    y -= 18;
    page.drawText(safePdfText(`Quantidade total: ${items.reduce((sum, item) => sum + item.qty, 0)}`), { x: margin, y, size: 10, font: bold, color: navy });
    y -= 20;
  }

  if (q.showGrandTotal && priced.length) {
    page.drawText(safePdfText(`Total estimado: ${money(grandTotal)}`), { x: margin, y, size: 13, font: bold, color: green });
    y -= 18;
  }

  if (q.showGrandTotal && withoutPrice) {
    page.drawText(safePdfText(`${withoutPrice} produto(s) permanece(m) com preco sob consulta.`), { x: margin, y, size: 9, font: regular, color: gray });
    y -= 18;
  }

  y -= 8;

  const phone = String(settings.whatsapp || "");
  if (phone) {
    page.drawText(safePdfText(`${q.pdfContactLabel || "WhatsApp Fruto Import"}: +${phone}`), { x: margin, y, size: 9, font: regular, color: gray });
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(safePdfText(`${q.pdfFooterText || "Fruto Import"}  |  Pagina ${i + 1} de ${pages.length}`), { x: margin, y: 26, size: 8, font: regular, color: gray });
  });

  const bytes = await pdf.save();

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fruto-import-orcamento.pdf"`,
      "Cache-Control": "no-store"
    }
  });
};

export const config = {
  path: "/api/quote-pdf",
  method: ["POST"]
};
