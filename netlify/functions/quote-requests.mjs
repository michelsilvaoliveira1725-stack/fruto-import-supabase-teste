import { getAuthConfig, signToken, requireAdmin, json } from "../lib/auth.mjs";
import { getPortalState, clientFromRequest, clientDiscount } from "../lib/client-portal.mjs";

const SUPABASE_URL = Netlify.env.get("SUPABASE_URL") || "https://scwrzdwxnkjqkiawvdve.supabase.co";
const SUPABASE_ANON_KEY = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

async function internalAdminToken() {
  const config = await getAuthConfig();
  if (!config) throw new Error("Administrador não configurado.");
  return signToken(config);
}

async function callEdge(payload) {
  const token = await internalAdminToken();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fruto-quote-requests`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "x-fruto-admin-token": token
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(data?.error || "Não foi possível concluir a operação."), { status: r.status });
  return data;
}

function pdfBodyFromQuote(quote = {}) {
  return {
    items: Array.isArray(quote.items) ? quote.items : [],
    customer: String(quote.customer_name || quote.customer || ""),
    cep: String(quote.cep || ""),
    address: String(quote.address || ""),
    note: String(quote.note || ""),
    clientDiscountPercent: clientDiscount(quote.client_discount_percent ?? quote.clientDiscountPercent ?? 0),
    portalClientName: String(quote.portal_client_name || quote.portalClientName || "")
  };
}

async function generatePdfBase64(req, quote, { adminOverride = false } = {}) {
  const pdfUrl = new URL("/api/quote-pdf", req.url);
  const headers = new Headers({ "Content-Type": "application/json" });
  const cookie = req.headers.get("cookie") || "";
  if (cookie) headers.set("Cookie", cookie);
  if (adminOverride) headers.set("Authorization", `Bearer ${await internalAdminToken()}`);
  const r = await fetch(pdfUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(pdfBodyFromQuote(quote)),
    cache: "no-store"
  });
  if (!r.ok) {
    let msg = "Não foi possível gerar a cópia do PDF.";
    try { msg = (await r.json())?.error || msg; } catch {}
    throw new Error(msg);
  }
  const bytes = new Uint8Array(await r.arrayBuffer());
  return Buffer.from(bytes).toString("base64");
}

async function generateAndStorePdf(req, quoteId, quote, options = {}) {
  const pdfBase64 = await generatePdfBase64(req, quote, options);
  return await callEdge({ action: "store-pdf", quoteId, pdfBase64 });
}

export default async (req) => {
  try {
    if (req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }

      if (body?.action === "regenerate") {
        if (!(await requireAdmin(req))) return json({ error: "Sessão inválida ou expirada." }, 401);
        const quoteId = String(body?.quoteId || "").trim();
        const detail = await callEdge({ action: "detail", quoteId });
        await generateAndStorePdf(req, quoteId, detail.quote || {}, { adminOverride: true });
        return json({ ok: true, quoteId, pdfStored: true }, 200);
      }

      // Se o portal estiver ativo, só um cliente autenticado pode registrar o orçamento.
      const portal = await getPortalState();
      let portalClient = null;
      if (portal.enabled) {
        portalClient = await clientFromRequest(req, portal);
        if (!portalClient) return json({ error: "Faça login para finalizar o orçamento.", portalRequired: true }, 401);
      }

      // O Supabase só aceita um quote_id que já foi realmente finalizado pelo controle de estoque.
      const clientFields = portalClient ? {
        portalClientId: portalClient.id,
        portalClientName: portalClient.name,
        portalClientLogin: portalClient.login,
        clientDiscountPercent: clientDiscount(portalClient.discountPercent)
      } : {
        portalClientId: "", portalClientName: "", portalClientLogin: "", clientDiscountPercent: 0
      };
      const data = await callEdge({ action: "save", ...body, ...clientFields });
      const quoteId = String(body?.quoteId || data?.quoteId || "").trim();
      let pdfStored = false;
      let pdfWarning = "";
      try {
        await generateAndStorePdf(req, quoteId, {
          items: body?.items,
          customer: body?.customer,
          customer_name: body?.customer,
          cep: body?.cep,
          address: body?.address,
          note: body?.note,
          portalClientName: portalClient?.name || "",
          clientDiscountPercent: portalClient ? clientDiscount(portalClient.discountPercent) : 0
        });
        pdfStored = true;
      } catch (e) {
        console.error("quote-copy-pdf", e);
        pdfWarning = e?.message || "Não foi possível guardar a cópia do PDF.";
      }
      return json({ ...data, pdfStored, pdfWarning }, 200);
    }

    if (!(await requireAdmin(req))) return json({ error: "Sessão inválida ou expirada." }, 401);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const quoteId = String(url.searchParams.get("quoteId") || "").trim();
      if (quoteId) return json(await callEdge({ action: "pdf", quoteId }), 200);
      return json(await callEdge({ action: "list" }), 200);
    }

    if (req.method === "PATCH") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
      const quoteId = String(body?.quoteId || "").trim();
      if (body?.action === "edit") {
        const edited = await callEdge({
          action: "edit", quoteId,
          customer: body?.customer,
          cep: body?.cep,
          address: body?.address,
          note: body?.note
        });
        const detail = await callEdge({ action: "detail", quoteId });
        let pdfStored = false;
        let pdfWarning = "";
        try {
          await generateAndStorePdf(req, quoteId, detail.quote || {}, { adminOverride: true });
          pdfStored = true;
        } catch (e) {
          console.error("quote-edit-pdf", e);
          pdfWarning = e?.message || "Dados salvos, mas a cópia do PDF não pôde ser atualizada.";
        }
        return json({ ...edited, pdfStored, pdfWarning }, 200);
      }
      return json(await callEdge({ action: "check", quoteId, checked: body?.checked === true }), 200);
    }

    if (req.method === "DELETE") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
      return json(await callEdge({ action: "delete", quoteId: body?.quoteId }), 200);
    }

    return json({ error: "Método não permitido." }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: e.message || "Não foi possível concluir a operação." }, Number(e.status) || 502);
  }
};

export const config = { path: "/api/quote-requests", method: ["GET", "POST", "PATCH", "DELETE"] };
